#!/usr/bin/env node
/**
 * Generate deterministic, fully synthetic API-response fixtures.
 *
 * No values in captures/ are copied from a GetMyMacros account. Keep this
 * generator as the single source of truth; run `npm run fixtures:generate`
 * after intentionally changing a fixture shape.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const captureDir = join(root, 'captures')
const json = (value) => `${JSON.stringify(value, null, 2)}\n`

const meals = () =>
  ['Breakfast', 'Lunch', 'Dinner'].map((mealName, index) => ({
    mealID: String(index),
    mealName,
    mealOrder: String(index),
    foodLogs: [],
  }))

const food = (id, name, overrides = {}) => ({
  calories: '120',
  protein: '18',
  totalFat: '4',
  satFat: '1',
  monoFat: '1.5',
  polyFat: '0.5',
  cholesterol: '25',
  sodium: '340',
  carbs: '6',
  fiber: '2',
  sugar: '2',
  verified: true,
  userID: '-1',
  foodID: String(id),
  foodName: name,
  servingName: 'serving',
  servingSize: '1',
  foodType: 'Protein',
  brand: 'Example Foods',
  starred: false,
  occurenceCount: 0,
  ...overrides,
})

const entry = (id, uniqueID, name, mealName, overrides = {}) => ({
  food_id: String(id),
  uniqueID: String(uniqueID),
  meal_name: mealName,
  food_name: name,
  serving_name: 'serving',
  serving_size: '1',
  calories: '120',
  total_fat: '4',
  carbs: '6',
  protein: '18',
  saturated_fat: '1',
  mono_fat: '1.5',
  poly_fat: '0.5',
  cholesterol: '25',
  fiber: '2',
  sugar: '2',
  sodium: '340',
  ...overrides,
})

const daily = (date, content) => ({
  success: true,
  paid: false,
  active_meals: meals(),
  active_goals: [],
  nutri: {
    body_weight: [],
    success: true,
    current_date: date,
    content,
    meal_order: Object.keys(content),
    all_dates: [date],
    nutri_goals: [],
  },
  notes: [],
})

const baseDaily = (date = '01-15-2024') =>
  daily(date, { Breakfast: [entry(10001, 20001, 'Example Oat Bowl', 'Breakfast')] })

const files = {
  'CategoryMenu_1.json': { success: true, reason: 'Menu loaded' },
  'CategoryMenu_2.json': { success: true, reason: 'Menu loaded' },
  'CategoryMenu_3.json': { success: true, error: '', results: ['Protein', 'Vegetables'] },
  'CategoryMenu_4.json': { success: true, reason: 'Menu loaded' },
  'CategoryMenu_5.json': { success: true, error: '', results: ['Example Foods'] },
  'CategoryMenu_6.json': { success: true, error: '', results: ['Breakfast'] },
  'Category_ByBrand_Costco.json': {
    success: true,
    food: [food(10002, 'Example Protein Bites', { brand: 'Example Warehouse' })],
  },
  'Category_ByType_Chicken.json': {
    success: true,
    food: [food(10003, 'Example Chicken Bowl', { foodType: 'Chicken' })],
  },
  'Category_CustomFavs.json': {
    success: true,
    food: [food(-10004, 'Example Custom Smoothie', { userID: '424242', starred: true })],
  },
  'Category_Frequent_AllMeals.json': {
    success: true,
    food: [food(10005, 'Example Breakfast Wrap')],
  },
  'Category_Recent.json': { success: true, food: [food(10006, 'Example Grain Bowl')] },
  'Category_Recipes.json': { success: true, food: [] },
  'DM_04-18-2023.json': daily('04-18-2023', {
    Lunch: [entry(10007, 20007, 'Example Lentil Soup', 'Lunch')],
  }),
  'DM_05-30-2018.json': daily('05-30-2018', {
    Lunch: [entry(10008, 20008, 'Example Vegetable Plate', 'Lunch')],
  }),
  'DM_08-01-2016.json': daily('08-01-2016', {
    Breakfast: [entry(10009, 20009, 'Example Yogurt Bowl', 'Breakfast')],
    Lunch: [entry(10010, 20010, 'Example Bean Wrap', 'Lunch')],
    Dinner: [entry(10011, 20011, 'Example Pasta Bowl', 'Dinner')],
  }),
  'DM_response.json': baseDaily(),
  'FoodSearch_chicken.json': {
    success: true,
    food_results: [
      {
        title: 'Custom & Favs',
        food: [
          food(-10012, 'Example Custom Chicken Soup', {
            userID: '424242',
            starred: true,
            foodType: 'Chicken',
          }),
        ],
      },
      { title: 'Results', food: [food(10013, 'Example Chicken Bowl', { foodType: 'Chicken' })] },
    ],
  },
  'GetFoodItem_164298.json': {
    success: true,
    food_item: food(10014, 'Example Food Item'),
    your_food: false,
    paid: false,
    meals: meals(),
    selected_meal_id: '0',
  },
  'GetFoodItem_custom.json': {
    success: true,
    food_item: food(-10015, 'Example Custom Food', { userID: '424242' }),
    your_food: true,
    paid: false,
    meals: meals(),
    selected_meal_id: '0',
  },
  'NutriGoals.json': {},
  'Settings_fetch.json': {
    success: true,
    settings: {
      user: {
        userID: '424242',
        username: 'example_user',
        email: 'example@example.invalid',
        firstName: 'Example',
        lastName: 'User',
        gender: 'X',
      },
      active_meals: meals(),
      subscription: { duration: 'none', expiration: '', sub_id: null, cancelled: '0', title: '' },
      active_goals: [],
    },
  },
  'Weight_retrieve.json': { success: true, weight: [] },
  'login_response.json': {
    success: true,
    reason: 'Login successful',
    is_coach: false,
    session_id: 'synthetic-session-id-not-valid',
    email: 'example@example.invalid',
    fname: 'Example',
    uname: 'example_user',
    profile: {
      fname: 'Example',
      lname: 'User',
      uname: 'example_user',
      email: 'example@example.invalid',
    },
  },
}

for (const name of [
  'write_test_01_baseline.json',
  'write_test_03_after_update.json',
  'write_test_10_after_save.json',
]) {
  files[name] = baseDaily()
}
files['write_test_07_after_move.json'] = daily('01-15-2024', {
  Breakfast: [entry(10001, 20001, 'Example Oat Bowl', 'Breakfast')],
  Lunch: [entry(10016, 20016, 'Example Lunch Bowl', 'Lunch')],
})
for (const name of [
  'write_test_02_update_pringles_25.json',
  'write_test_04_revert_pringles.json',
  'write_test_05_remove_dup.json',
  'write_test_06_move_to_lunch.json',
  'write_test_08_move_back.json',
  'write_test_11_save_avocado_retry.json',
  'write_test_12_remove_avocado.json',
  'write_test_13_fast_track.json',
  'write_test_14_save_note.json',
  'write_test_15_star.json',
  'write_test_17_copy_meal_retry.json',
  'write_test_18_delete_meal.json',
]) {
  files[name] = { success: true }
}
files['write_test_09_save_avocado.json'] = { success: true, reason: 'Food saved' }
files['write_test_16_copy_meal.json'] = { success: true, reason: 'Meal copied' }
files['write_test_19_reorder.json'] = { success: true, reason: 'Meals reordered' }

const check = process.argv.includes('--check')
let mismatch = false
for (const [name, value] of Object.entries(files)) {
  const path = join(captureDir, name)
  const expected = json(value)
  if (check) {
    try {
      if (readFileSync(path, 'utf8') !== expected) {
        console.error(`Fixture is not generated or is out of date: captures/${name}`)
        mismatch = true
      }
    } catch {
      console.error(`Missing fixture: captures/${name}`)
      mismatch = true
    }
  } else {
    mkdirSync(captureDir, { recursive: true })
    writeFileSync(path, expected)
  }
}

if (check && mismatch) process.exitCode = 1
