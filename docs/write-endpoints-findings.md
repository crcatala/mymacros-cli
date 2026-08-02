# Write Endpoints — Findings & Response Schemas

All tested 02-17-2026. Every write endpoint returns `{"success":true}` on success
or `{"success":false,"reason":"...","code":NNN}` on failure.

---

## 1. `Tracking/Food/UpdateFoodLog.php` — Update a food entry

**Updates serving size and/or moves food between meals.**

```
POST assets/script/Tracking/Food/UpdateFoodLog.php
  session_id, date,
  food_id,               # the food's ID
  pre_meal_name,         # current meal name (e.g., "Breakfast")
  pre_serving_name,      # current serving unit name (e.g., "Gr")
  pre_unique_id,         # current uniqueID of the log entry
  new_meal_name,         # target meal name
  new_serving_size       # new quantity
```

**Response:** `{"success":true}`

### ⚠️ Key Finding: uniqueID Changes on Every Update
- Updates are **delete + re-insert** under the hood
- The `uniqueID` changes every time (668 → 1968 → 2412 → 2797)
- If you use the OLD uniqueID after an update, it creates a **duplicate entry** instead of updating
- **You must re-read DM.php after every update** to get the new uniqueID

### Moving Between Meals
- Setting `new_meal_name` different from `pre_meal_name` moves the food
- Same delete+re-insert behavior, new uniqueID assigned

---

## 2. `Tracking/Food/SaveFood.php` — Add food to a meal

### Standard Add (existing food from search/browse)
```
POST assets/script/Tracking/Food/SaveFood.php
  session_id,
  meal_id,               # numeric meal slot (0-5)
  meal_order,            # same as meal_id typically
  meal_name,             # meal name string
  food_user_id,          # "-1" for DB food, user's ID for custom
  food_id,               # the food's ID
  serving_size,          # quantity
  serving_name,          # unit name (REQUIRED — omitting causes Code 541)
  date                   # MM-DD-YYYY
```

### Fast Track (quick macro entry, no food lookup)
```
POST assets/script/Tracking/Food/SaveFood.php
  session_id,
  meal_id, meal_order, meal_name,
  fast_track=true,
  food_id=0,             # always 0 for fast track
  food_name,             # user-entered name
  calories, protein, carbs, total_fat,
  serving_size="1",
  serving_name="Serving",
  date
```

**Response:** `{"success":true}`

### ⚠️ Key Finding: Fast Track Creates Persistent Custom Foods
- Fast track creates a **new custom food** in the database (gets a negative foodID like -28206)
- This food persists even after removing it from the meal
- It shows up in Custom & Favs thereafter
- `DeleteFood.php` can be called to remove it, though the food may still be retrievable via GetFoodItem after deletion (possible soft delete)

---

## 3. `Tracking/Food/RemoveFromMeal.php` — Remove food entry

```
POST assets/script/Tracking/Food/RemoveFromMeal.php
  session_id, date,
  meal_name,             # meal to remove from
  food_id,               # food's ID
  unique_id              # the specific log entry's uniqueID
```

**Response:** `{"success":true}`

- Only removes the food log entry, not the food definition itself
- The uniqueID is critical for targeting the right entry (same food can appear multiple times)

---

## 4. `Tracking/Food/CopyMeal.php` — Copy foods between dates/meals

```
POST assets/script/Tracking/Food/CopyMeal.php
  session_id,
  from_date,             # source date
  to_date,               # target date
  from_meal_name,        # source meal name
  new_meal_id,           # target meal slot ID
  new_meal_order,        # target meal order
  new_meal_name,         # target meal name
  copied_unique_ids      # JSON array of uniqueIDs to copy (REQUIRED)
```

**Response:** `{"success":true}`

### ⚠️ Key Finding: copied_unique_ids is Required
- Without `copied_unique_ids`, fails with Code 541
- Must be a JSON-encoded array of uniqueID strings: `["1583","2797"]`
- Allows selective copying (user can uncheck individual foods in the UI)

---

## 5. `Tracking/Food/DeleteMeal.php` — Delete all foods from a meal

```
POST assets/script/Tracking/Food/DeleteMeal.php
  session_id,
  meal,                  # meal name to delete (e.g., "Lunch")
  date
```

**Response:** `{"success":true}`

- Removes all food entries for that meal on that date
- Does not delete the meal slot itself (it's still available for adding food)

---

## 6. `notes.php` — Save day/meal notes

```
POST assets/script/notes.php
  session_id,
  meal_name,             # meal name, or "--1" for day-level note
  note,                  # the text content (empty string to "clear")
  date
```

**Response:** `{"success":true}`

### Notes in DM.php Response
```json
"notes": {
  "-1": "Day level note text",        // key is "-1" (not "--1")
  "Breakfast": "Meal-specific note"
}
```

- Day note: send `meal_name=--1`, stored as key `"-1"` in response
- Clearing a note sends empty string; the key persists with `""` value (not removed)

---

## 7. `Tracking/Food/alternateStarred.php` — Star/unstar food

```
POST assets/script/Tracking/Food/alternateStarred.php
  session_id,
  food_id,
  action                 # "add" or "remove"
```

**Response:** `{"success":true}`

- Clean toggle, perfectly reversible
- Starred foods appear in Custom & Favs browse

---

## 8. `DeleteFood.php` — Delete a custom food definition

```
POST assets/script/DeleteFood.php
  session_id,
  food_id                # must be a custom food (negative ID, owned by user)
```

**Response:** `{"success":true}`

- ⚠️ May be a soft delete — GetFoodItem still returns the food after deletion
- Only works on foods where `userID` matches the logged-in user

---

## 9. `Tracking/Food/ReorderMeals.php` — Reorder meal display

```
POST assets/script/Tracking/Food/ReorderMeals.php
  session_id,
  meal_order,            # JSON array of meal names in desired order
  date
```

- Only operates on meals that have food entries for that date
- Returned Code 919 when trying to reorder all 6 meals (only 1 had food)
- Not fully tested due to this constraint

---

## Summary of Critical Behaviors

| Behavior | Impact |
|----------|--------|
| **uniqueID changes on update** | Must re-read DM.php after any mutation to get current IDs |
| **Fast track creates persistent foods** | Side effect: grows Custom & Favs list over time |
| **serving_name required on SaveFood** | Omitting causes silent Code 541 failure |
| **copied_unique_ids required on CopyMeal** | Must provide JSON array, not just meal name |
| **Notes "clear" leaves empty strings** | Key persists in response with `""` value |
| **DM.php nutri.content vs active_meals** | Real data is in `nutri.content`, `active_meals.foodLogs` is always empty |
| **Delete+re-insert pattern** | The API doesn't do in-place updates; it replaces entries |

---

## Historical DM.php Response Variations

Tested dates: 04-18-2023, 05-30-2018, 08-01-2016

| Date | Meals with data | Total items | Notes |
|------|----------------|-------------|-------|
| 02-17-2026 | Breakfast(2) | 2 | Current day, test data |
| 04-18-2023 | Lunch(9) | 9 | Heavy single-meal day |
| 05-30-2018 | Lunch(8) | 8 | All custom foods (negative IDs) |
| 08-01-2016 | Breakfast(1), Lunch(3), Dinner(4) | 8 | Multi-meal day, mix of DB + custom |

The response structure is identical across all dates. `all_dates` array (904 entries) is returned every time regardless of which date is queried — a significant payload overhead.
