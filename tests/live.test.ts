import { describe, expect, it } from 'vitest'
import { MyMacrosClient } from '../src/client.js'
import type { SessionStore } from '../src/credentials.js'
import { todayDate } from '../src/lib/date.js'
import { createRateLimitedFetch } from './live-utils.js'

// ────────────────────────────────────────────────────────────────────────────
// Environment-based configuration
// ────────────────────────────────────────────────────────────────────────────

const enabled = process.env.MYMACROS_LIVE_TESTS === '1'
const user = process.env.MYMACROS_TEST_USER
const password = process.env.MYMACROS_TEST_PASSWORD
const delayMs = Number.parseInt(process.env.MYMACROS_LIVE_DELAY_MS ?? '500', 10)

/**
 * In-memory session store so each test starts without cached credentials and
 * never touches the OS keyring or on-disk config files.
 */
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

/**
 * Build a fresh client that logs in via env vars and serializes API requests
 * with a configurable inter-request delay.
 */
function buildClient() {
  expect(user, 'MYMACROS_TEST_USER must be set').toBeTruthy()
  expect(password, 'MYMACROS_TEST_PASSWORD must be set').toBeTruthy()

  return new MyMacrosClient(
    { MYMACROS_USER: user, MYMACROS_PASSWORD: password },
    {
      sessionStore: memorySessionStore(),
      fetch: createRateLimitedFetch(
        globalThis.fetch.bind(globalThis),
        Number.isFinite(delayMs) ? Math.max(100, delayMs) : 500,
      ),
    },
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Read-only tests — safe to run any number of times
// ────────────────────────────────────────────────────────────────────────────

describe.skipIf(!enabled)('live API (read-only)', () => {
  it('reads the dedicated test account daily log', async () => {
    const client = buildClient()
    const { api } = todayDate()
    const result = await client.getDailyMeals(api)

    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Array.isArray(result.meals)).toBe(true)
    expect(result.dailyTotals).toBeDefined()
    expect(typeof result.dailyTotals.calories).toBe('number')
    expect(typeof result.dailyTotals.protein).toBe('number')
    expect(typeof result.dailyTotals.carbs).toBe('number')
    expect(typeof result.dailyTotals.fat).toBe('number')
  }, 30_000)

  it('searches for a known food', async () => {
    const client = buildClient()
    const result = await client.searchFood('egg')

    expect(result.sections.length).toBeGreaterThan(0)
    const allFoods = result.sections.flatMap((s) => s.foods)
    expect(allFoods.length).toBeGreaterThan(0)
    // At least one result should contain "egg" in the name
    const egg = allFoods.find((f) => f.foodName.toLowerCase().includes('egg'))
    expect(egg).toBeDefined()
    expect(egg!.foodId).toBeTruthy()
  }, 30_000)

  it('retrieves a food item by ID', async () => {
    const client = buildClient()
    // First search to obtain a real food ID
    const search = await client.searchFood('egg', 5)
    const foods = search.sections.flatMap((s) => s.foods)
    expect(foods.length).toBeGreaterThan(0)
    const foodId = foods[0].foodId

    const result = await client.getFoodItem(foodId)

    expect(result.food).toBeDefined()
    expect(result.food.foodId).toBe(foodId)
    expect(result.food.foodName).toBeTruthy()
    expect(result.food.calories).toBeGreaterThan(0)
    expect(typeof result.food.starred).toBe('boolean')
    expect(typeof result.food.isCustom).toBe('boolean')
    // Should return available meal slots for logging
    expect(Array.isArray(result.meals)).toBe(true)
    expect(result.meals.length).toBeGreaterThan(0)
    expect(result.meals[0].id).toBeTruthy()
    expect(result.meals[0].name).toBeTruthy()
  }, 30_000)

  it('browses top-level food categories', async () => {
    const client = buildClient()
    const categories = await client.browseCategories(5)

    expect(Array.isArray(categories)).toBe(true)
    if (categories.length > 0) {
      expect(typeof categories[0]).toBe('string')
      expect(categories[0].length).toBeGreaterThan(0)
    }
    // Menu ID 5 (breakfast) should return at least one category
    // on any active account
  }, 30_000)

  it('browses foods within a category', async () => {
    const client = buildClient()
    // "Custom & Favs" is available on every account
    const foods = await client.browseFoods(1, 'Custom & Favs', 10)

    expect(Array.isArray(foods)).toBe(true)
    if (foods.length > 0) {
      expect(foods[0].foodId).toBeTruthy()
      expect(foods[0].foodName).toBeTruthy()
      expect(typeof foods[0].calories).toBe('number')
      expect(typeof foods[0].starred).toBe('boolean')
    }
  }, 30_000)

  it('retrieves available account dates', async () => {
    const client = buildClient()
    const dates = await client.getDates()

    expect(Array.isArray(dates)).toBe(true)
    expect(dates.length).toBeGreaterThan(0)
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  }, 30_000)

  it('gets active meals for today', async () => {
    const client = buildClient()
    const { api } = todayDate()
    const meals = await client.getActiveMeals(api)

    expect(Array.isArray(meals)).toBe(true)
    if (meals.length > 0) {
      expect(meals[0].mealID).toBeTruthy()
      expect(meals[0].mealName).toBeTruthy()
      expect(meals[0].mealOrder).toBeTruthy()
    }
  }, 30_000)

  it('reads daily log for a past date', async () => {
    const client = buildClient()
    const dates = await client.getDates()
    expect(dates.length).toBeGreaterThan(0)
    // Pick the oldest date (last in array) to minimise overlap with today
    const pastDisplay = dates[dates.length - 1]
    const [year, month, day] = pastDisplay.split('-')
    const apiDate = `${month}-${day}-${year}` // MM-DD-YYYY

    const result = await client.getDailyMeals(apiDate)

    expect(result.date).toBe(pastDisplay)
    expect(Array.isArray(result.meals)).toBe(true)
    expect(result.dailyTotals).toBeDefined()
    if (result.meals.length > 0) {
      expect(result.meals[0].name).toBeTruthy()
      expect(result.meals[0].totals.calories).toBeGreaterThanOrEqual(0)
    }
  }, 30_000)
})

// ────────────────────────────────────────────────────────────────────────────
// Reversible write tests — each pair restores the account to its original
// state so they are idempotent across repeated runs.
// ────────────────────────────────────────────────────────────────────────────

describe.skipIf(!enabled)('live API (reversible writes)', () => {
  it('stars and un-stars a food, restoring original state', async () => {
    const client = buildClient()
    const search = await client.searchFood('egg', 5)
    const foods = search.sections.flatMap((s) => s.foods)
    expect(foods.length).toBeGreaterThan(0)
    const foodId = foods[0].foodId

    // Capture original starred state
    const before = await client.getFoodItem(foodId)
    const originalStarred = before.food.starred

    try {
      // Star it
      const starResult = await client.toggleStar(foodId, 'add')
      expect(starResult.success).toBe(true)

      // Verify starred
      const afterStar = await client.getFoodItem(foodId)
      expect(afterStar.food.starred).toBe(true)

      // Unstar it (only if originally unstarred; otherwise restar)
      const unstarResult = await client.toggleStar(foodId, 'remove')
      expect(unstarResult.success).toBe(true)

      // Verify
      const afterUnstar = await client.getFoodItem(foodId)
      expect(afterUnstar.food.starred).toBe(false)
    } finally {
      // Restore the original state (idempotent guard)
      if (originalStarred) {
        await client.toggleStar(foodId, 'add')
      }
    }
  }, 60_000)

  it('saves and clears a day note, returning to original state', async () => {
    const client = buildClient()
    const { api } = todayDate()

    // Capture current day note so we can restore it later
    const before = await client.getDailyMeals(api)
    const originalNote = before.notes.day ?? null

    const testNote = `[TEST] Live note ${Date.now()} — safe to delete`

    try {
      // Save a unique test note
      const saveResult = await client.saveNote({ mealName: '--1', note: testNote, date: api })
      expect(saveResult.success).toBe(true)

      // Verify it appears
      const withNote = await client.getDailyMeals(api)
      expect(withNote.notes.day).toBe(testNote)
    } finally {
      // Restore the original note (or clear if none existed)
      await client.saveNote({ mealName: '--1', note: originalNote ?? '', date: api })
      const restored = await client.getDailyMeals(api)
      if (originalNote) {
        expect(restored.notes.day).toBe(originalNote)
      } else {
        // An empty note is stripped by the normalizer
        expect(restored.notes.day).toBeUndefined()
      }
    }
  }, 60_000)
})