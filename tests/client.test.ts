import { describe, expect, it } from 'vitest'
import { MyMacrosClient } from '../src/client.js'
import type { SessionStore } from '../src/credentials.js'

function createMemorySessionStore(): SessionStore {
  let session: { sessionId: string; timestamp: number } | null = null
  return {
    load: async () => session,
    save: async (sessionId, storage = 'keyring') => {
      session = { sessionId, timestamp: Date.now() }
      return storage
    },
    clear: async () => {
      session = null
    },
  }
}

function mockFetch(responses: Array<{ body: unknown; ok?: boolean; status?: number }>) {
  let callIndex = 0
  const calls: { url: string; body: string }[] = []

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body = init?.body?.toString() ?? ''
    calls.push({ url, body })

    const response = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: 'OK',
      json: async () => response.body,
    } as Response
  }

  return { fetchImpl, calls }
}

function createClient(
  env: Record<string, string | undefined>,
  fetch: typeof globalThis.fetch,
): MyMacrosClient {
  return new MyMacrosClient(env, { fetch, sessionStore: createMemorySessionStore() })
}

describe('MyMacrosClient', () => {
  describe('login', () => {
    it('stores a session on successful login', async () => {
      const { fetchImpl } = mockFetch([
        {
          body: { success: true, session_id: 'abc123', uname: 'testuser', email: 'test@test.com' },
        },
      ])
      const client = createClient({}, fetchImpl as typeof fetch)

      const result = await client.login('testuser', 'testpass')

      expect(result.success).toBe(true)
      expect(result.session_id).toBe('abc123')
      expect(client.lastSessionStorage).toBe('keyring')
    })

    it('redacts passwords and session IDs from debug output', async () => {
      const { fetchImpl } = mockFetch([
        { body: { success: true, session_id: 'secret-session', uname: 'testuser' } },
      ])
      const messages: string[] = []
      const client = new MyMacrosClient(
        {},
        {
          fetch: fetchImpl as typeof fetch,
          sessionStore: createMemorySessionStore(),
          debug: true,
          onDebug: (message) => messages.push(message),
        },
      )

      await client.login('testuser', 'secret-password')

      expect(messages.join('\n')).not.toContain('secret-password')
      expect(messages.join('\n')).not.toContain('secret-session')
      expect(messages.join('\n')).toContain('[REDACTED]')
    })

    it('throws on failed login', async () => {
      const { fetchImpl } = mockFetch([
        { body: { success: false, reason: 'The password you entered does not match.' } },
      ])
      const client = createClient({}, fetchImpl as typeof fetch)

      await expect(client.login('testuser', 'wrong')).rejects.toThrow(
        'The password you entered does not match.',
      )
    })

    it('throws when the response has no session_id', async () => {
      const { fetchImpl } = mockFetch([{ body: { success: true } }])
      const client = createClient({}, fetchImpl as typeof fetch)

      await expect(client.login('testuser', 'pass')).rejects.toThrow()
    })
  })

  describe('ensureSession', () => {
    it('auto-logins from env vars when no session is cached', async () => {
      const { fetchImpl, calls } = mockFetch([
        { body: { success: true, session_id: 'env-session', uname: 'envuser' } },
      ])
      const client = createClient(
        { MYMACROS_USER: 'envuser', MYMACROS_PASSWORD: 'envpass' },
        fetchImpl as typeof fetch,
      )

      await client.ensureSession()

      expect(calls).toHaveLength(1)
      expect(calls[0].url).toContain('login.php')
      expect(calls[0].body).toContain('username=envuser')
    })

    it('throws when no session is cached and env vars are absent', async () => {
      const { fetchImpl } = mockFetch([])
      const client = createClient({}, fetchImpl as typeof fetch)

      await expect(client.ensureSession()).rejects.toThrow('No valid session')
    })
  })

  describe('request with re-auth', () => {
    it('injects session_id into requests', async () => {
      const { fetchImpl, calls } = mockFetch([
        { body: { success: true, session_id: 'sess1', uname: 'user' } },
        { body: { success: true, data: 'hello' } },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      await client.request('test.php', { foo: 'bar' })

      expect(calls).toHaveLength(2)
      expect(calls[1].body).toContain('session_id=sess1')
      expect(calls[1].body).toContain('foo=bar')
    })

    it('re-authenticates on no_session and retries once', async () => {
      const { fetchImpl, calls } = mockFetch([
        { body: { success: true, session_id: 'old-session', uname: 'user' } },
        { body: { success: false, no_session: true, reason: 'Code 821' } },
        { body: { success: true, session_id: 'new-session', uname: 'user' } },
        { body: { success: true, data: 'result' } },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      const result = await client.request<{ success: boolean; data: string }>('test.php')

      expect(result.data).toBe('result')
      expect(calls).toHaveLength(4)
      expect(calls[3].body).toContain('session_id=new-session')
    })

    it('throws when a session expires without credentials for re-login', async () => {
      const { fetchImpl } = mockFetch([
        { body: { success: true, session_id: 'sess', uname: 'user' } },
        { body: { success: false, no_session: true, reason: 'Code 821' } },
      ])
      const client = createClient({}, fetchImpl as typeof fetch)
      await client.login('user', 'pass')

      await expect(client.request('test.php')).rejects.toThrow('Session expired')
    })

    it('throws on non-session API errors', async () => {
      const { fetchImpl } = mockFetch([
        { body: { success: true, session_id: 'sess', uname: 'user' } },
        { body: { success: false, reason: 'Something broke', code: 541 } },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      await expect(client.request('test.php')).rejects.toThrow('Something broke (Code 541)')
    })

    it('throws on HTTP errors', async () => {
      const { fetchImpl } = mockFetch([
        { body: { success: true, session_id: 'sess', uname: 'user' } },
        { body: {}, ok: false, status: 500 },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      await expect(client.request('test.php')).rejects.toThrow('HTTP 500')
    })

    it('re-authenticates browse requests after session expiry', async () => {
      const { fetchImpl, calls } = mockFetch([
        { body: { success: true, session_id: 'old-session', uname: 'user' } },
        { body: { success: false, no_session: true, reason: 'Code 821' } },
        { body: { success: true, session_id: 'new-session', uname: 'user' } },
        {
          body: {
            success: true,
            food: [{ foodID: '1', foodName: 'Sample Food', starred: false }],
          },
        },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      const foods = await client.browseFoods(1)

      expect(foods).toHaveLength(1)
      expect(calls).toHaveLength(4)
      expect(calls[3].body).toContain('session_id=new-session')
    })

    it('returns active meal IDs and order for write commands', async () => {
      const { fetchImpl } = mockFetch([
        { body: { success: true, session_id: 'sess', uname: 'user' } },
        {
          body: {
            success: true,
            active_meals: [{ mealID: '1', mealName: 'Lunch', mealOrder: '1' }],
          },
        },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      await expect(client.getActiveMeals('02-17-2026')).resolves.toEqual([
        { mealID: '1', mealName: 'Lunch', mealOrder: '1' },
      ])
    })
  })
})
