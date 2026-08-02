import { describe, expect, it } from 'vitest'
import { MyMacrosClient } from '../src/client.js'
import type { SessionStore } from '../src/credentials.js'

function createMemorySessionStore(): SessionStore {
  let session: { sessionId: string; timestamp: number; username?: string } | null = null
  return {
    load: async () => session,
    save: async (sessionId, storage = 'keyring', username?: string) => {
      session = { sessionId, timestamp: Date.now(), username }
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

    it('covers read-operation endpoint contracts and transformations', async () => {
      const { fetchImpl, calls } = mockFetch([
        { body: { success: true, session_id: 'sess', uname: 'user' } },
        { body: { success: true, food_results: [{ title: 'Results', food: [] }] } },
        {
          body: {
            success: true,
            food_item: { foodID: '7', foodName: ' Egg ' },
            meals: [{ mealID: '1', mealName: 'Lunch' }],
          },
        },
        { body: { success: true, results: [' Protein ', 'Vegetables'] } },
        { body: { success: true, food: [{ foodID: '8', foodName: ' Chicken ' }] } },
        { body: { success: true, nutri: { all_dates: ['02-17-2026', 'bad'] } } },
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )

      await expect(client.searchFood('egg')).resolves.toEqual({
        sections: [{ title: 'Results', count: 0, foods: [] }],
      })
      await expect(client.getFoodItem('7')).resolves.toMatchObject({
        food: { foodId: '7', foodName: 'Egg' },
        meals: [{ id: '1', name: 'Lunch' }],
      })
      await expect(client.browseCategories(5)).resolves.toEqual(['Protein', 'Vegetables'])
      await expect(client.browseFoods(5, 'Chicken', 1)).resolves.toMatchObject([
        { foodId: '8', foodName: 'Chicken' },
      ])
      await expect(client.getDates()).resolves.toEqual(['2026-02-17', 'bad'])
      expect(calls.map((call) => call.url)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('FoodSearch.php'),
          expect.stringContaining('GetFoodItem.php'),
          expect.stringContaining('FoodCategoryFetch.php'),
          expect.stringContaining('DM.php'),
        ]),
      )
      expect(calls[4].body).toContain('cat_name=Chicken')
    })

    it('covers write-operation endpoint contracts', async () => {
      const { fetchImpl, calls } = mockFetch([
        { body: { success: true, session_id: 'sess', uname: 'user' } },
        ...Array.from({ length: 8 }, () => ({ body: { success: true } })),
      ])
      const client = createClient(
        { MYMACROS_USER: 'user', MYMACROS_PASSWORD: 'pass' },
        fetchImpl as typeof fetch,
      )
      await client.addFood({
        mealId: '1',
        mealOrder: '1',
        mealName: 'Lunch',
        foodUserId: '-1',
        foodId: '7',
        servingSize: 2,
        servingName: 'Serving',
        date: '02-17-2026',
      })
      await client.addQuickFood({
        mealId: '1',
        mealOrder: '1',
        mealName: 'Lunch',
        name: 'Quick',
        calories: 100,
        protein: 10,
        carbs: 5,
        fat: 2,
        date: '02-17-2026',
      })
      await client.removeFood({ uniqueId: 'u', foodId: '7', mealName: 'Lunch', date: '02-17-2026' })
      await client.updateFood({
        foodId: '7',
        preUniqueId: 'u',
        preMealName: 'Lunch',
        preServingName: 'Serving',
        newMealName: 'Dinner',
        newServingSize: 3,
        date: '02-17-2026',
      })
      await client.copyMeal({
        fromDate: '02-17-2026',
        toDate: '02-18-2026',
        fromMealName: 'Lunch',
        newMealId: '2',
        newMealOrder: '2',
        newMealName: 'Dinner',
        copiedUniqueIds: ['u'],
      })
      await client.deleteMeal('Lunch', '02-17-2026')
      await client.saveNote({ mealName: '--1', note: 'note', date: '02-17-2026' })
      await client.toggleStar('7', 'add')
      expect(calls.slice(1).map((call) => new URL(call.url).pathname)).toEqual([
        '/assets/script/Tracking/Food/SaveFood.php',
        '/assets/script/Tracking/Food/SaveFood.php',
        '/assets/script/Tracking/Food/RemoveFromMeal.php',
        '/assets/script/Tracking/Food/UpdateFoodLog.php',
        '/assets/script/Tracking/Food/CopyMeal.php',
        '/assets/script/Tracking/Food/DeleteMeal.php',
        '/assets/script/notes.php',
        '/assets/script/Tracking/Food/alternateStarred.php',
      ])
      expect(
        calls.slice(1).map((call) => Object.fromEntries(new URLSearchParams(call.body))),
      ).toEqual([
        {
          meal_id: '1',
          meal_order: '1',
          meal_name: 'Lunch',
          food_user_id: '-1',
          food_id: '7',
          serving_size: '2',
          serving_name: 'Serving',
          date: '02-17-2026',
          session_id: 'sess',
        },
        {
          meal_id: '1',
          meal_order: '1',
          meal_name: 'Lunch',
          fast_track: 'true',
          food_id: '0',
          food_name: 'Quick',
          calories: '100',
          total_protein: '10',
          total_carbs: '5',
          total_fat: '2',
          serving_size: '1',
          serving_name: 'Serving',
          date: '02-17-2026',
          session_id: 'sess',
        },
        {
          date: '02-17-2026',
          meal_name: 'Lunch',
          food_id: '7',
          unique_id: 'u',
          session_id: 'sess',
        },
        {
          date: '02-17-2026',
          food_id: '7',
          pre_meal_name: 'Lunch',
          pre_serving_name: 'Serving',
          pre_unique_id: 'u',
          new_meal_name: 'Dinner',
          new_serving_size: '3',
          session_id: 'sess',
        },
        {
          from_date: '02-17-2026',
          to_date: '02-18-2026',
          from_meal_name: 'Lunch',
          new_meal_id: '2',
          new_meal_order: '2',
          new_meal_name: 'Dinner',
          copied_unique_ids: '["u"]',
          session_id: 'sess',
        },
        { meal: 'Lunch', date: '02-17-2026', session_id: 'sess' },
        { meal_name: '--1', note: 'note', date: '02-17-2026', session_id: 'sess' },
        { food_id: '7', action: 'add', session_id: 'sess' },
      ])
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
