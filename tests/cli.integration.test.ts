import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  getDailyMeals: vi.fn(),
  searchFood: vi.fn(),
  getFoodItem: vi.fn(),
  getRawFoodItem: vi.fn(),
  browseFoods: vi.fn(),
  browseCategories: vi.fn(),
  getDates: vi.fn(),
  getActiveMeals: vi.fn(),
  addFood: vi.fn(),
  addQuickFood: vi.fn(),
  removeFood: vi.fn(),
  updateFood: vi.fn(),
  copyMeal: vi.fn(),
  deleteMeal: vi.fn(),
  saveNote: vi.fn(),
  toggleStar: vi.fn(),
  login: vi.fn(),
}))

vi.mock('../src/cli/client.js', () => ({ createClient: vi.fn(() => client) }))

import { runCli } from '../src/run.js'

const food = {
  foodId: '42',
  foodName: 'Egg',
  brand: 'Farm',
  servingName: 'Large',
  servingSize: 1,
  calories: 70,
  protein: 6,
  carbs: 0,
  fat: 5,
  fiber: 0,
  sugar: 0,
  sodium: 60,
  saturatedFat: 1.5,
  cholesterol: 186,
  starred: false,
  isCustom: false,
}
const daily = {
  date: '2026-02-17',
  meals: [
    {
      name: 'Breakfast',
      entries: [{ ...food, uniqueId: 'entry-1', mealName: 'Breakfast' }],
      totals: { calories: 70, protein: 6, carbs: 0, fat: 5 },
    },
  ],
  dailyTotals: { calories: 70, protein: 6, carbs: 0, fat: 5 },
  notes: {},
}

async function run(args: string[]) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let out = ''
  let err = ''
  stdout.on('data', (chunk) => {
    out += chunk
  })
  stderr.on('data', (chunk) => {
    err += chunk
  })
  process.exitCode = undefined
  await runCli([...args, '--json'], { env: {}, stdout, stderr })
  return { out, err, exitCode: process.exitCode ?? 0 }
}

function resetClient() {
  for (const method of Object.values(client)) method.mockReset()
  client.getDailyMeals.mockResolvedValue(daily)
  client.getFoodItem.mockResolvedValue({
    food,
    meals: [
      { id: '0', name: 'Breakfast' },
      { id: '1', name: 'Lunch' },
    ],
  })
  client.getRawFoodItem.mockResolvedValue({ success: true, food_item: { userID: '-1' } })
  client.browseFoods.mockResolvedValue([food])
  client.browseCategories.mockResolvedValue(['Chicken'])
  client.searchFood.mockResolvedValue({ sections: [{ title: 'Results', count: 1, foods: [food] }] })
  client.getDates.mockResolvedValue(['2026-02-17'])
  client.getActiveMeals.mockResolvedValue([{ mealID: '0', mealName: 'Breakfast', mealOrder: '0' }])
  client.login.mockResolvedValue({ success: true, uname: 'test-user', email: 'test@example.test' })
  for (const method of [
    'addFood',
    'addQuickFood',
    'removeFood',
    'updateFood',
    'copyMeal',
    'deleteMeal',
    'saveNote',
    'toggleStar',
  ] as const)
    client[method].mockResolvedValue({ success: true })
}

afterEach(() => {
  resetClient()
  vi.unstubAllEnvs()
  process.exitCode = undefined
})

resetClient()

describe('CLI commands with a mocked client', () => {
  it('renders read commands as JSON', async () => {
    expect(JSON.parse((await run(['daily', '2026-02-17'])).out).date).toBe('2026-02-17')
    expect(JSON.parse((await run(['search', 'egg'])).out).sections[0].foods[0].foodId).toBe('42')
    expect(JSON.parse((await run(['food', '42'])).out).food.foodName).toBe('Egg')
    expect(JSON.parse((await run(['browse', 'types'])).out).subcategories).toEqual(['Chicken'])
    expect(JSON.parse((await run(['browse', 'custom'])).out).foods).toHaveLength(1)
    expect(JSON.parse((await run(['dates'])).out).dates).toEqual(['2026-02-17'])
    expect(client.getDailyMeals).toHaveBeenCalled()
    expect(client.searchFood).toHaveBeenCalledWith('egg', 25)
    expect(client.browseCategories).toHaveBeenCalledWith(5)
    expect(client.browseFoods).toHaveBeenCalledWith(1, 'Custom & Favs', 25)
  })

  it('logs in with environment credentials without touching real storage', async () => {
    vi.stubEnv('MYMACROS_USER', 'test-user')
    vi.stubEnv('MYMACROS_PASSWORD', 'test-password')
    const result = await run(['auth', 'login'])
    expect(JSON.parse(result.out)).toEqual({
      success: true,
      username: 'test-user',
      email: 'test@example.test',
    })
    expect(client.login).toHaveBeenCalledWith('test-user', 'test-password')
  })

  it('executes mutation command workflows with resolved API values', async () => {
    expect(
      JSON.parse(
        (await run(['add', '42', '--meal', 'Breakfast', '--serving', '2', '--date', '2026-02-17']))
          .out,
      ).success,
    ).toBe(true)
    expect(
      JSON.parse(
        (
          await run([
            'add-quick',
            '--name',
            'Shake',
            '--cal',
            '200',
            '--protein',
            '20',
            '--carbs',
            '10',
            '--fat',
            '5',
            '--date',
            '2026-02-17',
          ])
        ).out,
      ).success,
    ).toBe(true)
    expect(JSON.parse((await run(['remove', 'entry-1', '--date', '2026-02-17'])).out).success).toBe(
      true,
    )
    expect(
      JSON.parse((await run(['update', 'entry-1', '--serving', '2', '--date', '2026-02-17'])).out)
        .success,
    ).toBe(true)
    expect(
      JSON.parse(
        (await run(['copy-meal', 'Breakfast', '--to-date', '2026-02-18', '--date', '2026-02-17']))
          .out,
      ).success,
    ).toBe(true)
    expect(
      JSON.parse((await run(['delete-meal', 'Breakfast', '--date', '2026-02-17'])).out).success,
    ).toBe(true)
    expect(
      JSON.parse((await run(['note', 'great day', '--date', '2026-02-17'])).out).note.type,
    ).toBe('day')
    expect(JSON.parse((await run(['star', '42'])).out).starred).toBe(true)
    expect(JSON.parse((await run(['unstar', '42'])).out).starred).toBe(false)
    expect(client.addFood).toHaveBeenCalledWith(
      expect.objectContaining({ foodId: '42', servingSize: 2, date: '02-17-2026' }),
    )
    expect(client.copyMeal).toHaveBeenCalledWith(
      expect.objectContaining({ copiedUniqueIds: ['entry-1'], toDate: '02-18-2026' }),
    )
    expect(client.toggleStar).toHaveBeenLastCalledWith('42', 'remove')
  })

  it.each([
    [['daily', 'not-a-date'], 'Invalid date'],
    [['search', 'egg', '--limit', '-1'], 'Invalid --limit'],
    [['browse', 'unknown'], 'Unknown category'],
    [['dates', '--limit', '-1'], 'Invalid --limit'],
    [['add', '42', '--serving', '0'], 'Invalid --serving'],
    [['add-quick', '--name', 'Shake'], 'Invalid macro values'],
    [['remove', 'entry-1', '--date', 'bad'], 'Invalid --date'],
    [['update', 'entry-1'], 'Provide at least one'],
    [['copy-meal', 'Breakfast', '--to-date', 'bad'], 'Invalid --to-date'],
    [['delete-meal', 'Breakfast', '--date', 'bad'], 'Invalid --date'],
    [['note', 'hello', '--date', 'bad'], 'Invalid --date'],
  ])('returns usage errors without calling the API for %j', async (args, message) => {
    const result = await run(args)
    expect(result.exitCode).toBe(2)
    expect(result.err).toContain(message)
    for (const method of Object.values(client)) expect(method).not.toHaveBeenCalled()
  })
})
