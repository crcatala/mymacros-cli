import { describe, expect, it } from 'vitest'
import {
  normalizeDailyMeals,
  normalizeFoodItem,
  normalizeFoodLogEntry,
  normalizeSearchResults,
  num,
  round2,
} from '../src/client.js'
import type {
  ApiFoodItem,
  ApiFoodLogEntry,
  DailyMealsApiResponse,
  FoodSearchApiResponse,
} from '../src/types.js'

// ============================================================================
// Helpers
// ============================================================================

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.234)).toBe(1.23)
    expect(round2(1.235)).toBe(1.24)
    expect(round2(1.999)).toBe(2)
    expect(round2(0)).toBe(0)
    expect(round2(100)).toBe(100)
    expect(round2(5.357143)).toBe(5.36)
    expect(round2(0.03571429)).toBe(0.04)
  })
})

describe('num', () => {
  it('parses string numbers', () => {
    expect(num('5.357143')).toBe(5.357143)
    expect(num('0')).toBe(0)
    expect(num('100')).toBe(100)
    expect(num('-28204')).toBe(-28204)
  })

  it('returns 0 for invalid/missing values', () => {
    expect(num(undefined)).toBe(0)
    expect(num('')).toBe(0)
    expect(num('abc')).toBe(0)
  })
})

// ============================================================================
// normalizeFoodLogEntry
// ============================================================================

describe('normalizeFoodLogEntry', () => {
  const makeEntry = (overrides?: Partial<ApiFoodLogEntry>): ApiFoodLogEntry => ({
    food_id: '164298',
    uniqueID: '668',
    meal_name: 'Breakfast',
    food_name: 'Pringles ',
    serving_name: 'Gr',
    serving_size: '19',
    calories: '5.357143',
    total_fat: '0.3214286',
    carbs: '0.5357143',
    protein: '0.03571429',
    saturated_fat: '0.1',
    mono_fat: '0',
    poly_fat: '0',
    cholesterol: '0.5',
    fiber: '0.03571429',
    sugar: '0.2',
    sodium: '10',
    ...overrides,
  })

  it('multiplies nutrition values by serving_size', () => {
    const result = normalizeFoodLogEntry(makeEntry())
    expect(result.calories).toBe(round2(5.357143 * 19))
    expect(result.protein).toBe(round2(0.03571429 * 19))
    expect(result.carbs).toBe(round2(0.5357143 * 19))
    expect(result.fat).toBe(round2(0.3214286 * 19))
    expect(result.fiber).toBe(round2(0.03571429 * 19))
    expect(result.sugar).toBe(round2(0.2 * 19))
    expect(result.sodium).toBe(round2(10 * 19))
    expect(result.saturatedFat).toBe(round2(0.1 * 19))
    expect(result.cholesterol).toBe(round2(0.5 * 19))
  })

  it('maps fields correctly', () => {
    const result = normalizeFoodLogEntry(makeEntry())
    expect(result.uniqueId).toBe('668')
    expect(result.foodId).toBe('164298')
    expect(result.mealName).toBe('Breakfast')
    expect(result.foodName).toBe('Pringles') // trimmed
    expect(result.servingSize).toBe(19)
    expect(result.servingName).toBe('Gr')
  })

  it('handles serving_size of 1 (no multiplication effect)', () => {
    const result = normalizeFoodLogEntry(makeEntry({ serving_size: '1' }))
    expect(result.calories).toBe(5.36) // round2(5.357143)
    expect(result.servingSize).toBe(1)
  })

  it('handles zero serving_size', () => {
    const result = normalizeFoodLogEntry(makeEntry({ serving_size: '0' }))
    expect(result.calories).toBe(0)
    expect(result.protein).toBe(0)
    expect(result.servingSize).toBe(0)
  })

  it('handles missing/empty nutrition fields gracefully', () => {
    const result = normalizeFoodLogEntry(
      makeEntry({ calories: '', protein: undefined as unknown as string }),
    )
    expect(result.calories).toBe(0)
    expect(result.protein).toBe(0)
  })
})

// ============================================================================
// normalizeFoodItem
// ============================================================================

describe('normalizeFoodItem', () => {
  const makeItem = (overrides?: Partial<ApiFoodItem>): ApiFoodItem => ({
    foodID: '164298',
    foodName: ' Pringles ',
    brand: ' Papitas ',
    servingName: 'Gr',
    servingSize: '1',
    calories: '5.357143',
    protein: '0.03571429',
    totalFat: '0.3214286',
    satFat: '0.1',
    monoFat: '0',
    polyFat: '0',
    cholesterol: '0.5',
    sodium: '10',
    carbs: '0.5357143',
    fiber: '0.03571429',
    sugar: '0.2',
    verified: false,
    userID: '-1',
    foodType: 'Snack',
    starred: true,
    occurenceCount: 5,
    ...overrides,
  })

  it('maps and rounds all nutrition fields', () => {
    const result = normalizeFoodItem(makeItem())
    expect(result.calories).toBe(5.36)
    expect(result.protein).toBe(0.04)
    expect(result.carbs).toBe(0.54)
    expect(result.fat).toBe(0.32)
    expect(result.fiber).toBe(0.04)
    expect(result.sugar).toBe(0.2)
    expect(result.sodium).toBe(10)
    expect(result.saturatedFat).toBe(0.1)
    expect(result.cholesterol).toBe(0.5)
  })

  it('trims names', () => {
    const result = normalizeFoodItem(makeItem())
    expect(result.foodName).toBe('Pringles')
    expect(result.brand).toBe('Papitas')
  })

  it('preserves boolean fields', () => {
    expect(normalizeFoodItem(makeItem({ starred: true })).starred).toBe(true)
    expect(normalizeFoodItem(makeItem({ starred: false })).starred).toBe(false)
  })

  it('derives isCustom from negative foodID', () => {
    expect(normalizeFoodItem(makeItem({ foodID: '-2288' })).isCustom).toBe(true)
    expect(normalizeFoodItem(makeItem({ foodID: '164298' })).isCustom).toBe(false)
  })

  it('strips userID, foodType, occurenceCount, monoFat, polyFat, verified', () => {
    const result = normalizeFoodItem(makeItem()) as Record<string, unknown>
    expect(result.userID).toBeUndefined()
    expect(result.foodType).toBeUndefined()
    expect(result.occurenceCount).toBeUndefined()
    expect(result.monoFat).toBeUndefined()
    expect(result.polyFat).toBeUndefined()
    expect(result.verified).toBeUndefined()
  })
})

// ============================================================================
// normalizeDailyMeals
// ============================================================================

describe('normalizeDailyMeals', () => {
  const makeResponse = (overrides?: Partial<DailyMealsApiResponse>): DailyMealsApiResponse => ({
    success: true,
    active_meals: [],
    nutri: {
      content: {
        Breakfast: [
          {
            food_id: '100',
            uniqueID: '1',
            meal_name: 'Breakfast',
            food_name: 'Eggs',
            serving_name: 'Large',
            serving_size: '2',
            calories: '70',
            total_fat: '5',
            carbs: '1',
            protein: '6',
            saturated_fat: '1.5',
            mono_fat: '0',
            poly_fat: '0',
            cholesterol: '186',
            fiber: '0',
            sugar: '0',
            sodium: '70',
          },
          {
            food_id: '200',
            uniqueID: '2',
            meal_name: 'Breakfast',
            food_name: 'Toast',
            serving_name: 'Slice',
            serving_size: '1',
            calories: '80',
            total_fat: '1',
            carbs: '15',
            protein: '3',
            saturated_fat: '0',
            mono_fat: '0',
            poly_fat: '0',
            cholesterol: '0',
            fiber: '2',
            sugar: '1',
            sodium: '130',
          },
        ],
        Lunch: [
          {
            food_id: '300',
            uniqueID: '3',
            meal_name: 'Lunch',
            food_name: 'Salad',
            serving_name: 'Bowl',
            serving_size: '1',
            calories: '150',
            total_fat: '8',
            carbs: '10',
            protein: '12',
            saturated_fat: '2',
            mono_fat: '0',
            poly_fat: '0',
            cholesterol: '30',
            fiber: '4',
            sugar: '3',
            sodium: '200',
          },
        ],
      },
      meal_order: ['Breakfast', 'Lunch'],
      all_dates: ['02-17-2026', '02-16-2026'],
      current_date: '02-17-2026',
    },
    notes: {
      '-1': 'Day note here',
      Breakfast: 'Light start',
      Lunch: '',
    },
    ...overrides,
  })

  it('converts API date to display format', () => {
    const result = normalizeDailyMeals(makeResponse(), '02-17-2026')
    expect(result.date).toBe('2026-02-17')
  })

  it('includes only meals in meal_order with entries', () => {
    const result = normalizeDailyMeals(makeResponse(), '02-17-2026')
    expect(result.meals).toHaveLength(2)
    expect(result.meals[0].name).toBe('Breakfast')
    expect(result.meals[1].name).toBe('Lunch')
  })

  it('skips meals in meal_order with no entries', () => {
    const resp = makeResponse()
    if (!resp.nutri) throw new Error('Expected nutrition data')
    resp.nutri.meal_order = ['Breakfast', 'Lunch', 'Dinner']
    const result = normalizeDailyMeals(resp, '02-17-2026')
    expect(result.meals).toHaveLength(2) // Dinner has no content
  })

  it('computes per-meal totals with multiplication', () => {
    const result = normalizeDailyMeals(makeResponse(), '02-17-2026')
    const breakfast = result.meals[0]
    // Eggs: 70*2=140, Toast: 80*1=80 → 220
    expect(breakfast.totals.calories).toBe(220)
    // Eggs protein: 6*2=12, Toast: 3*1=3 → 15
    expect(breakfast.totals.protein).toBe(15)
  })

  it('computes daily totals across all meals', () => {
    const result = normalizeDailyMeals(makeResponse(), '02-17-2026')
    // Breakfast: 220, Lunch: 150 → 370
    expect(result.dailyTotals.calories).toBe(370)
    // Breakfast protein: 15, Lunch: 12 → 27
    expect(result.dailyTotals.protein).toBe(27)
  })

  it('normalizes notes: renames -1 to day, strips empty notes', () => {
    const result = normalizeDailyMeals(makeResponse(), '02-17-2026')
    expect(result.notes).toEqual({
      day: 'Day note here',
      Breakfast: 'Light start',
      // Lunch note was empty string, should be stripped
    })
    expect(result.notes.Lunch).toBeUndefined()
  })

  it('strips all_dates from output', () => {
    const result = normalizeDailyMeals(makeResponse(), '02-17-2026') as Record<string, unknown>
    expect(result.all_dates).toBeUndefined()
  })

  it('handles empty day (no meals)', () => {
    const resp = makeResponse()
    if (!resp.nutri) throw new Error('Expected nutrition data')
    resp.nutri.content = {}
    resp.nutri.meal_order = []
    resp.notes = []
    const result = normalizeDailyMeals(resp, '03-01-2026')
    expect(result.meals).toHaveLength(0)
    expect(result.dailyTotals.calories).toBe(0)
    expect(result.notes).toEqual({})
  })

  it('handles missing nutri gracefully', () => {
    const result = normalizeDailyMeals({ success: true }, '02-17-2026')
    expect(result.meals).toHaveLength(0)
    expect(result.dailyTotals.calories).toBe(0)
  })
})

// ============================================================================
// normalizeSearchResults
// ============================================================================

describe('normalizeSearchResults', () => {
  const makeSearchResponse = (): FoodSearchApiResponse => ({
    success: true,
    food_results: [
      {
        title: 'Custom & Favs',
        food: [
          makeFoodItem('1', 'Food A'),
          makeFoodItem('2', 'Food B'),
          makeFoodItem('3', 'Food C'),
        ],
      },
      {
        title: 'Results',
        food: [makeFoodItem('10', 'Result 1'), makeFoodItem('11', 'Result 2')],
      },
    ],
  })

  function makeFoodItem(id: string, name: string): ApiFoodItem {
    return {
      foodID: id,
      foodName: name,
      brand: '',
      servingName: 'Serving',
      servingSize: '1',
      calories: '100',
      protein: '10',
      totalFat: '5',
      satFat: '1',
      monoFat: '0',
      polyFat: '0',
      cholesterol: '0',
      sodium: '0',
      carbs: '15',
      fiber: '2',
      sugar: '3',
      verified: false,
      userID: '-1',
      foodType: '',
      starred: false,
      occurenceCount: -1,
    }
  }

  it('preserves section titles and total counts', () => {
    const result = normalizeSearchResults(makeSearchResponse(), 25)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].title).toBe('Custom & Favs')
    expect(result.sections[0].count).toBe(3)
    expect(result.sections[1].title).toBe('Results')
    expect(result.sections[1].count).toBe(2)
  })

  it('limits results per section', () => {
    const result = normalizeSearchResults(makeSearchResponse(), 2)
    expect(result.sections[0].count).toBe(3) // total count preserved
    expect(result.sections[0].foods).toHaveLength(2) // limited
    expect(result.sections[0].foods[0].foodId).toBe('1')
    expect(result.sections[0].foods[1].foodId).toBe('2')
  })

  it('returns all results when limit is 0', () => {
    const result = normalizeSearchResults(makeSearchResponse(), 0)
    expect(result.sections[0].foods).toHaveLength(3)
    expect(result.sections[1].foods).toHaveLength(2)
  })

  it('handles empty response', () => {
    const result = normalizeSearchResults({ success: true }, 25)
    expect(result.sections).toHaveLength(0)
  })
})
