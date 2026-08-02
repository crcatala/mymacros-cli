# DailyMeals.html — API Response Schemas

All endpoints: `POST`, form-encoded, require `session_id` param.

---

## 1. `DM.php` — Load Daily Meals (13KB for today)

**Request:** `date=MM-DD-YYYY&session_id=...`

**Response:**
```json
{
  "success": true,
  "paid": true,
  "active_meals": [                    // 6 meal slots (always present)
    {
      "mealID": "0",                   // string "0"-"5"
      "mealName": "Breakfast",         // customizable name
      "mealOrder": "0",
      "foodLogs": []                   // always empty here (?)
    }
  ],
  "active_goals": [],                  // applied goal profiles
  "nutri": {
    "body_weight": [],
    "success": true,
    "current_date": "02-17-2026",
    "content": {                       // actual food data, keyed by meal name
      "Breakfast": [
        {
          "food_id": "164298",         // positive = DB food, negative = custom
          "uniqueID": "668",           // unique log entry ID
          "meal_name": "Breakfast",
          "food_name": "Pringles ",
          "serving_name": "Gr",
          "serving_size": "19",        // user's chosen serving qty
          "calories": "5.357143",      // per-unit values (multiply by serving_size)
          "total_fat": "0.3214286",
          "carbs": "0.5357143",
          "protein": "0.03571429",
          "saturated_fat": "0",
          "mono_fat": "0",
          "poly_fat": "0",
          "cholesterol": "0",
          "fiber": "0.03571429",
          "sugar": "0",
          "sodium": "0"
        }
      ]
    },
    "meal_order": ["Breakfast"],       // only meals with food logged
    "all_dates": ["02-17-2026", ...],  // ALL dates with any data (904 entries!)
    "nutri_goals": []
  },
  "notes": []                          // day/meal notes
}
```

**Key observations:**
- `nutri.content` is the real food data — `active_meals` always has empty `foodLogs`
- Nutrition values are **per-unit** — multiply by `serving_size` for actual intake
- `all_dates` returns every date the user has ever logged (can be huge)
- `meal_order` only lists meals that have food entries for that date

---

## 2. `Searching/FoodSearch.php` — Search Foods (347KB for "chicken breast")

**Request:** `session_id=...&keyword=chicken+breast`

**Response:**
```json
{
  "success": true,
  "food_results": [
    {
      "title": "Custom & Favs",        // user's own foods matching query
      "food": [ /* FoodItem[] */ ]      // 15 items
    },
    {
      "title": "Results",               // database-wide results
      "food": [ /* FoodItem[] */ ]      // 877 items (!)
    }
  ]
}
```

Results are grouped into sections. Can be very large.

---

## 3. `Searching/GetFoodItem.php` — Single Food Detail (~900 bytes)

**Request:** `food_id=164298&session_id=...` (optional: `food_user_id=...`)

**Response:**
```json
{
  "success": true,
  "food_item": { /* FoodItem */ },
  "your_food": true,                   // whether user owns/created this food
  "paid": true,
  "meals": [ /* active_meals array */ ],
  "selected_meal_id": "0"             // last/default meal selection
}
```

---

## 4. `FoodCategoryFetch.php` — Browse Food Categories

### Step 1: Get sub-categories (`action=parent_menu`)

**Request:** `menu_id=N&session_id=...&action=parent_menu`

| menu_id | Name | Response |
|---------|------|----------|
| 1 | Custom & Favs | Error 231 (needs `action=food` directly) |
| 2 | Recent | Error 231 (needs `action=food` directly) |
| 3 | Frequent | `["All Meals", "Breakfast"]` |
| 4 | Recipes | Error 231 (needs `action=food` directly) |
| 5 | By Type | 130+ category names |
| 6 | By Brand | 6,709 brand names |

### Step 2: Get foods in category (`action=food`)

**Request:** `menu_id=N&session_id=...&cat_name=CategoryName&action=food`

**Response:**
```json
{
  "success": true,
  "error": "",
  "food": [ /* FoodItem[] */ ]
}
```

**Sizes observed:**
| Category | Items | Size |
|----------|-------|------|
| Custom & Favs (all) | 1,194 | 451KB |
| Recent | 90 | 35KB |
| Frequent / All Meals | 20 | 7KB |
| By Type / Chicken | 263 | 109KB |
| By Brand / Costco | 29 | 11KB |
| Recipes | 0 | 26 bytes |

---

## 5. `notes.php` — Day/Meal Notes

**Request:** `session_id=...&meal_name=Breakfast&note=text&date=MM-DD-YYYY`

---

## Common: FoodItem Schema

Every food item (search results, category browsing, food detail) uses the same shape:

```json
{
  "calories": "190",           // string, per serving_size=1
  "protein": "14",
  "totalFat": "7",
  "satFat": "2",
  "monoFat": "0",
  "polyFat": "0",
  "cholesterol": "20",
  "sodium": "120",
  "carbs": "21",
  "fiber": "7",
  "sugar": "5",
  "verified": false,           // boolean
  "userID": "10001",           // example user ID if custom, "-1" if DB food
  "foodID": "-2288",           // negative = custom, positive = database
  "foodName": "Chocolate Mint Crisp",
  "servingName": "bar",
  "servingSize": "1",
  "foodType": "",              // category like "Chicken", "Dairy", etc.
  "brand": "Oatmega",
  "starred": false,            // boolean, user favorited
  "occurenceCount": -1         // usage frequency (-1 = not tracked here)
}
```

**Note:** In `DM.php` response (`nutri.content`), the field names differ slightly:
- `total_fat` vs `totalFat`
- `saturated_fat` vs `satFat`
- `mono_fat` vs `monoFat`
- `poly_fat` vs `polyFat`
- Has extra fields: `uniqueID`, `meal_name`, `food_name` (vs `foodName`)

---

## Captured Files Index

`captures/` contains deterministic synthetic fixtures generated by `scripts/generate-fixtures.mjs`. They preserve representative response shapes without using real account data.
| File | Endpoint | Size |
|------|----------|------|
| `DM_response.json` | DM.php (02-17-2026) | 13KB |
| `Settings_fetch.json` | Settings.php (fetch) | 689B |
| `FoodSearch_chicken.json` | FoodSearch.php | compact representative fixture |
| `GetFoodItem_164298.json` | GetFoodItem.php (Pringles) | 864B |
| `GetFoodItem_custom.json` | GetFoodItem.php (Double Espresso) | 918B |
| `CategoryMenu_1-6.json` | FoodCategoryFetch.php (parent_menu) | varies |
| `Category_Frequent_AllMeals.json` | FoodCategoryFetch.php (food) | 7KB |
| `Category_ByType_Chicken.json` | FoodCategoryFetch.php (food) | 109KB |
| `Category_ByBrand_Costco.json` | FoodCategoryFetch.php (food) | 11KB |
| `Category_CustomFavs.json` | FoodCategoryFetch.php (food) | compact representative fixture |
| `Category_Recent.json` | FoodCategoryFetch.php (food) | 35KB |
| `Category_Recipes.json` | FoodCategoryFetch.php (food) | 26B |
| `Weight_retrieve.json` | Weight.php (retrieve) | 28B |
