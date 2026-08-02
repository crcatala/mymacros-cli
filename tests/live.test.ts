import { describe, expect, it } from 'vitest'
import { MyMacrosClient } from '../src/client.js'
import type { SessionStore } from '../src/credentials.js'
import { createRateLimitedFetch } from './live-utils.js'

const enabled = process.env.MYMACROS_LIVE_TESTS === '1'
const user = process.env.MYMACROS_TEST_USER
const password = process.env.MYMACROS_TEST_PASSWORD
const delayMs = Number.parseInt(process.env.MYMACROS_LIVE_DELAY_MS ?? '500', 10)

function memorySessionStore(): SessionStore {
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

describe.skipIf(!enabled)('live API (read-only)', () => {
  it('reads the dedicated test account daily log', async () => {
    expect(user).toBeTruthy()
    expect(password).toBeTruthy()

    const client = new MyMacrosClient(
      { MYMACROS_USER: user, MYMACROS_PASSWORD: password },
      {
        sessionStore: memorySessionStore(),
        fetch: createRateLimitedFetch(
          globalThis.fetch.bind(globalThis),
          Number.isFinite(delayMs) ? Math.max(0, delayMs) : 500,
        ),
      },
    )
    const result = await client.getDailyMeals(todayApiDate())

    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Array.isArray(result.meals)).toBe(true)
  }, 20_000)
})

function todayApiDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}-${date.getFullYear()}`
}
