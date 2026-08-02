# GetMyMacros API Inventory

> **Unofficial interoperability notes.** This documentation records observed behavior of undocumented web endpoints. It is not official API documentation, may become inaccurate without notice, and does not grant permission to use the service outside its terms.

## Pages & Features

### 1. Daily Meals (`DailyMeals.html`)
The primary page. Shows meals for a selected date with macro/calorie breakdowns.

**Features:**
- View meals by date (prev/next day, calendar picker)
- Food search (keyword search across database)
- Browse food by category (Custom & Favs, Recent, Frequent, Recipes, By Type, By Brand)
- "Fast Track" quick-add (enter macros directly without searching)
- Add food to a meal (Breakfast, etc.)
- Edit food serving size / move between meals
- Remove food from a meal
- Star/favorite foods
- Add custom food (links to CustomFood.html)
- Copy meal to another date
- Remember a meal (save as template)
- Delete entire meal
- Reorder meals
- Day notes (journal entries per day)
- Meal notes (per-meal notes)
- Export day / Email day
- Set active nutritional goal
- Recipes: view, add to meal, create new, delete

### 2. Body Weight (`BodyWeight.html`)
Weight tracking with graph visualization.

**Features:**
- Log weight (lbs or kg) for a date
- View weight history (graph via Flot.js)
- Navigate dates (yesterday/today/tomorrow)

### 3. Settings (`Settings.html`)
User profile and app configuration.

**Features:**
- Edit profile (username, email, first name, last name, gender)
- Edit meal names (rename the 6 meal slots)
- Set nutritional goals (CRUD goal profiles with macro targets)
- Apply/delete goal profiles
- Cancel subscription
- View terms/privacy/refund

### 4. Custom Food (`CustomFood.html`)
Create user-defined food items.

**Features:**
- Enter food name, brand, serving size, serving name
- Enter full nutrition info (11 fields: calories, fat, sat fat, mono fat, poly fat, carbs, fiber, sugar, protein, sodium, cholesterol)
- Select food type/category from ~80+ options
- Save food

---

## PHP API Endpoints

All endpoints use `POST` with form data. Auth via `session_id` parameter (stored in `localStorage["session"]`).

### Daily Meals / Core
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/DM.php` | **Load daily meals** | `date`, `session_id` |
| `assets/script/notes.php` | **Save day/meal notes** | `session_id`, `meal_name`, `note`, `date` |

### Food Search & Browse
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Searching/FoodSearch.php` | **Search food database** | `session_id`, `keyword` |
| `assets/script/Searching/GetFoodItem.php` | **Get food item details** | `food_id`, `session_id` (optional: `food_user_id`) |
| `assets/script/Searching/GetRecipeItem.php` | **Get recipe details** | `session_id`, `meal_id`, `meal_user_id` |
| `assets/script/FoodCategoryFetch.php` | **Browse food categories** | `menu_id`, `session_id`, `action` ("parent_menu" or "food"), optional `cat_name` |

### Food Tracking (CRUD)
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Tracking/Food/SaveFood.php` | **Add food to meal** | `session_id`, `meal_id`, `meal_order`, `meal_name`, `food_user_id`, `food_id`, `serving_size`, `date` |
| `assets/script/Tracking/Food/SaveFood.php` | **Fast Track add** | Same + `fast_track:true`, `total_fat`, `total_protein`, etc. |
| `assets/script/Tracking/Food/UpdateFoodLog.php` | **Update food entry** | `session_id`, `date`, `food_id`, `pre_meal_name`, `pre_serving_name`, `pre_unique_id`, `new_meal_name`, `new_serving_size` |
| `assets/script/Tracking/Food/RemoveFromMeal.php` | **Remove food from meal** | `session_id`, `date`, `meal_name`, `food_id`, `unique_id` |
| `assets/script/Tracking/Food/alternateStarred.php` | **Star/unstar food** | `session_id`, `food_id`, `action` ("add" or "remove") |

### Meal Actions
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Tracking/Food/DeleteMeal.php` | **Delete entire meal** | `session_id`, `meal`, `date` |
| `assets/script/Tracking/Food/CopyMeal.php` | **Copy meal to another date** | `session_id`, `from_date`, `to_date`, `from_meal_name`, `new_meal_id`, `new_meal_order` |
| `assets/script/Tracking/Food/ReorderMeals.php` | **Reorder meals** | `session_id`, `meal_order` (JSON), `date` |

### Recipes
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Tracking/Food/SaveRecipe.php` | **Add recipe to meal** | `session_id`, `meal_id`, `meal_name`, `recipe_id`, `serving_size`, `date` |
| `assets/script/Tracking/Food/DeleteRecipe.php` | **Delete recipe** | `session_id`, `recipe` |

### Custom Food
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/CreateCustomFood.php` | **Create custom food** | (form fields from CustomFood.html) |
| `assets/script/DeleteFood.php` | **Delete custom food** | (from editFood.js) |

### Body Weight
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Weight.php` | **Weight CRUD** | `session_id`, `action` ("retrieve" or "push"), `unit`, `value`, `date` |

### Settings
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Settings/Settings.php` | **Fetch settings** | `session_id`, `action:"fetch"` |
| `assets/script/Settings/Settings.php` | **Update profile** | `session_id`, `action:"update"`, `username`, `email`, `first_name`, `last_name`, `gender` |
| `assets/script/Settings/Settings.php` | **Update meal names** | `session_id`, `action:"meal_names"`, `meals` (JSON) |
| `assets/script/Settings/Settings.php` | **Add/update goal** | `session_id`, `action:"goal"`, `goal_action` ("add"/"update"), `goal` (JSON) |
| `assets/script/Settings/Settings.php` | **Delete goal** | `session_id`, `action:"goal_delete"`, `goal_name` |

### Goals
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Goals/NutriGoals.php` | **Apply goal to date** | `session_id`, `date`, `action:"apply"`, `goal` (JSON) |

### Payment
| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `assets/script/Payment/CancelSubscription.php` | **Cancel subscription** | `session_id`, `sub_id` |

---

## Architecture Notes

- **Auth**: Session ID stored in `localStorage["session"]`, passed as form data in every POST
- **All requests**: jQuery `$.post()` with form-encoded data
- **All responses**: JSON with `{ success: true/false, ... }` pattern
- **Date format**: `MM-DD-YYYY` (e.g., "02-17-2026")
- **No REST conventions**: Single endpoints with `action` parameter for multiplexing (Settings.php, Weight.php)
- **Food IDs**: Negative IDs appear to indicate user-created/custom foods (e.g., `-28204`)
- **Meal identification**: By name string ("Breakfast", etc.), not numeric ID
