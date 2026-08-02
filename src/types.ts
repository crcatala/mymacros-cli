// ============================================================================
// API Response Types (raw from the server)
// ============================================================================

export interface ApiResponse {
  success: boolean
  reason?: string
  code?: number
  no_session?: boolean
}

export interface LoginResponse extends ApiResponse {
  session_id?: string
  email?: string
  uname?: string
}

export interface DailyMealsApiResponse extends ApiResponse {
  active_meals?: ApiMeal[]
  nutri?: {
    content: Record<string, ApiFoodLogEntry[]>
    meal_order: string[]
    all_dates: string[]
    current_date: string
  }
  notes?: Record<string, string>
}

export interface ApiMeal {
  mealID: string
  mealName: string
  mealOrder: string
}

export interface ApiFoodLogEntry {
  food_id: string
  uniqueID: string
  meal_name: string
  food_name: string
  serving_name: string
  serving_size: string
  calories: string
  total_fat: string
  carbs: string
  protein: string
  saturated_fat: string
  mono_fat: string
  poly_fat: string
  cholesterol: string
  fiber: string
  sugar: string
  sodium: string
}

export interface FoodSearchApiResponse extends ApiResponse {
  food_results?: {
    title: string
    food: ApiFoodItem[]
  }[]
}

export interface GetFoodItemApiResponse extends ApiResponse {
  food_item?: ApiFoodItem
  your_food?: boolean
  meals?: ApiMeal[]
  selected_meal_id?: string
}

export interface BrowseCategoryApiResponse extends ApiResponse {
  error?: string
  food?: ApiFoodItem[]
  // parent_menu returns string[] directly (not wrapped)
}

export interface ApiFoodItem {
  foodID: string
  foodName: string
  brand: string
  servingName: string
  servingSize: string
  calories: string
  protein: string
  totalFat: string
  satFat: string
  monoFat: string
  polyFat: string
  cholesterol: string
  sodium: string
  carbs: string
  fiber: string
  sugar: string
  verified: boolean
  userID: string
  foodType: string
  starred: boolean
  occurenceCount: number
}

// ============================================================================
// Normalized Output Types (what commands return to the user)
// ============================================================================

export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  saturatedFat: number
  cholesterol: number
}

export interface NormalizedFoodEntry {
  uniqueId: string
  foodId: string
  mealName: string
  foodName: string
  servingSize: number
  servingName: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  saturatedFat: number
  cholesterol: number
}

export interface MealSummary {
  name: string
  entries: NormalizedFoodEntry[]
  totals: Macros
}

export interface NormalizedDailyMeals {
  date: string
  meals: MealSummary[]
  dailyTotals: Macros
  notes: Record<string, string>
}

export interface NormalizedFoodItem {
  foodId: string
  foodName: string
  brand: string
  servingName: string
  servingSize: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  saturatedFat: number
  cholesterol: number
  starred: boolean
  isCustom: boolean
}

export interface NormalizedSearchResults {
  sections: {
    title: string
    count: number
    foods: NormalizedFoodItem[]
  }[]
}

// ============================================================================
// Command Parameter Types
// ============================================================================

export interface AddFoodParams {
  foodId: string
  mealName: string
  mealId: string
  mealOrder: string
  servingSize: number
  servingName: string
  foodUserId: string
  date: string // MM-DD-YYYY
}

export interface QuickAddParams {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  mealName: string
  mealId: string
  mealOrder: string
  date: string
}

export interface RemoveFoodParams {
  uniqueId: string
  foodId: string
  mealName: string
  date: string
}

export interface UpdateFoodParams {
  foodId: string
  preUniqueId: string
  preMealName: string
  preServingName: string
  newMealName: string
  newServingSize: number
  date: string
}

export interface CopyMealParams {
  fromDate: string
  toDate: string
  fromMealName: string
  newMealId: string
  newMealOrder: string
  newMealName: string
  copiedUniqueIds: string[]
}

export interface NoteParams {
  mealName: string // "--1" for day-level
  note: string
  date: string
}

// ============================================================================
// Session
// ============================================================================

export interface SessionData {
  sessionId: string
  timestamp: number
  username?: string
}
