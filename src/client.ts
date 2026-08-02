import {
  defaultSessionStore,
  isSessionFresh,
  type SessionStorage,
  type SessionStore,
} from './credentials.js'
import type {
  AddFoodParams,
  ApiFoodItem,
  ApiFoodLogEntry,
  ApiMeal,
  ApiResponse,
  BrowseCategoryApiResponse,
  CopyMealParams,
  DailyMealsApiResponse,
  FoodSearchApiResponse,
  GetFoodItemApiResponse,
  LoginResponse,
  Macros,
  MealSummary,
  NormalizedDailyMeals,
  NormalizedFoodEntry,
  NormalizedFoodItem,
  NormalizedSearchResults,
  NoteParams,
  QuickAddParams,
  RemoveFoodParams,
  SessionData,
  UpdateFoodParams,
} from './types.js'

const BASE_URL = 'https://getmymacros.com/assets/script'
// Session considered stale after 50 minutes (server expires ~1 hour)

export type ClientOptions = {
  fetch?: typeof fetch
  debug?: boolean
  sessionStorage?: SessionStorage
  sessionStore?: SessionStore
  withProgress?: <T>(label: string, operation: () => Promise<T>) => Promise<T>
  onDebug?: (message: string) => void
}

export class MyMacrosClient {
  private sessionId: string | null = null
  public lastSessionStorage: SessionStorage | null = null
  private fetchImpl: typeof fetch
  private debugMode: boolean
  private sessionStore: SessionStore

  constructor(
    private env: Record<string, string | undefined>,
    private options?: ClientOptions,
  ) {
    this.fetchImpl = options?.fetch ?? globalThis.fetch.bind(globalThis)
    this.debugMode = options?.debug ?? false
    this.sessionStore = options?.sessionStore ?? defaultSessionStore
  }

  // ============================================================================
  // Auth
  // ============================================================================

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.rawRequest<LoginResponse>('login.php', {
      username,
      password,
      action: 'login',
    })

    if (!response.success || !response.session_id) {
      const reason = response.reason ?? 'Login failed'
      throw new Error(reason)
    }

    this.sessionId = response.session_id
    await this.saveSession(response.session_id)
    return response
  }

  /**
   * Ensure we have a valid session. Tries in order:
   * 1. Cached session from disk
   * 2. Login from env vars
   * Throws if neither works.
   */
  async ensureSession(): Promise<void> {
    if (this.sessionId) return

    // Try cached session first
    const cached = await this.loadSession()
    if (cached) {
      this.sessionId = cached.sessionId
      return
    }

    // Try env vars
    const user = this.env.MYMACROS_USER
    const pass = this.env.MYMACROS_PASSWORD
    if (user && pass) {
      await this.login(user, pass)
      return
    }

    throw new Error(
      'No valid session. Run "mymacros auth login" or set MYMACROS_USER and MYMACROS_PASSWORD env vars.',
    )
  }

  private async loadSession(): Promise<SessionData | null> {
    const data = await this.sessionStore.load()
    if (!data) return null

    const age = Date.now() - data.timestamp
    if (!isSessionFresh(data.timestamp)) {
      this.debug('Cached session expired (age: %dmin)', Math.round(age / 60000))
      return null
    }
    this.debug('Using cached session (age: %dmin)', Math.round(age / 60000))
    return data
  }

  private async saveSession(sessionId: string): Promise<void> {
    this.lastSessionStorage = await this.sessionStore.save(sessionId, this.options?.sessionStorage)
  }

  private async clearSession(): Promise<void> {
    this.sessionId = null
    await this.sessionStore.clear()
  }

  // ============================================================================
  // HTTP Layer
  // ============================================================================

  /**
   * Low-level POST request. Does NOT inject session_id or handle re-auth.
   */
  private async rawRequest<T extends ApiResponse>(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = `${BASE_URL}/${endpoint}`
    const body = new URLSearchParams(params).toString()
    const debugParams = new URLSearchParams(params)
    for (const key of ['password', 'session_id']) {
      if (debugParams.has(key)) debugParams.set(key, '[REDACTED]')
    }

    this.debug('POST %s', url)
    this.debug('Body: %s', debugParams.toString())

    const response = await (this.options?.withProgress?.(`Contacting GetMyMacros…`, () =>
      this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }),
    ) ??
      this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }))

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const json = (await response.json()) as T
    this.debug('Response: %o', redactSecrets(json))
    return json
  }

  /**
   * Authenticated request. Injects session_id, handles re-auth on expiry.
   */
  async request<T extends ApiResponse>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    await this.ensureSession()

    const makeRequest = async (): Promise<T> => {
      return this.rawRequest<T>(endpoint, {
        ...params,
        session_id: this.getSessionId(),
      })
    }

    const result = await makeRequest()

    // Handle session expiry — re-auth once and retry
    if (result.no_session) {
      this.debug('Session expired (Code 821), re-authenticating...')
      await this.clearSession()
      const user = this.env.MYMACROS_USER
      const pass = this.env.MYMACROS_PASSWORD
      if (!user || !pass) {
        throw new Error(
          'Session expired. Set MYMACROS_USER and MYMACROS_PASSWORD or run "mymacros auth login".',
        )
      }
      await this.login(user, pass)
      return makeRequest()
    }

    if (!result.success) {
      const reason = result.reason ?? 'Request failed'
      const code = result.code ? ` (Code ${result.code})` : ''
      throw new Error(`${reason}${code}`)
    }

    return result
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  async getDailyMeals(apiDate: string): Promise<NormalizedDailyMeals> {
    const raw = await this.request<DailyMealsApiResponse>('DM.php', { date: apiDate })
    return normalizeDailyMeals(raw, apiDate)
  }

  async searchFood(keyword: string, limit = 25): Promise<NormalizedSearchResults> {
    const raw = await this.request<FoodSearchApiResponse>('Searching/FoodSearch.php', { keyword })
    return normalizeSearchResults(raw, limit)
  }

  async getFoodItem(
    foodId: string,
  ): Promise<{ food: NormalizedFoodItem; meals: { id: string; name: string }[] }> {
    const raw = await this.getRawFoodItem(foodId)
    if (!raw.food_item) throw new Error('Food item not found')
    return {
      food: normalizeFoodItem(raw.food_item),
      meals: (raw.meals ?? []).map((m) => ({ id: m.mealID, name: m.mealName })),
    }
  }

  async getRawFoodItem(foodId: string): Promise<GetFoodItemApiResponse> {
    return this.request<GetFoodItemApiResponse>('Searching/GetFoodItem.php', {
      food_id: foodId,
    })
  }

  async browseCategories(menuId: number): Promise<string[]> {
    const raw = await this.request<ApiResponse & Record<string, unknown>>('FoodCategoryFetch.php', {
      menu_id: String(menuId),
      action: 'parent_menu',
    })
    // Response has results array for parent_menu
    const results = (raw as Record<string, unknown>).results
    if (Array.isArray(results)) return (results as string[]).map((s) => s.trim())
    // Some menu_ids return error 231 — means use action=food directly
    return []
  }

  async browseFoods(menuId: number, catName?: string, limit = 25): Promise<NormalizedFoodItem[]> {
    const params: Record<string, string> = {
      menu_id: String(menuId),
      action: 'food',
    }
    if (catName) params.cat_name = catName
    const raw = await this.request<BrowseCategoryApiResponse>('FoodCategoryFetch.php', params)
    const allFoods = (raw.food ?? []).map(normalizeFoodItem)
    return limit > 0 ? allFoods.slice(0, limit) : allFoods
  }

  async getActiveMeals(apiDate: string): Promise<ApiMeal[]> {
    const raw = await this.request<DailyMealsApiResponse>('DM.php', { date: apiDate })
    return raw.active_meals ?? []
  }

  async getDates(): Promise<string[]> {
    // Fetch today's DM to get all_dates
    const { api } = await import('./lib/date.js').then((m) => m.todayDate())
    const raw = await this.request<DailyMealsApiResponse>('DM.php', { date: api })
    return (raw.nutri?.all_dates ?? []).map((d) => {
      // Convert MM-DD-YYYY to YYYY-MM-DD
      const parts = d.split('-')
      return parts.length === 3 ? `${parts[2]}-${parts[0]}-${parts[1]}` : d
    })
  }

  // ============================================================================
  // Write Operations
  // ============================================================================

  async addFood(params: AddFoodParams): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/SaveFood.php', {
      meal_id: params.mealId,
      meal_order: params.mealOrder,
      meal_name: params.mealName,
      food_user_id: params.foodUserId,
      food_id: params.foodId,
      serving_size: String(params.servingSize),
      serving_name: params.servingName,
      date: params.date,
    })
  }

  async addQuickFood(params: QuickAddParams): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/SaveFood.php', {
      meal_id: params.mealId,
      meal_order: params.mealOrder,
      meal_name: params.mealName,
      fast_track: 'true',
      food_id: '0',
      food_name: params.name,
      calories: String(params.calories),
      total_protein: String(params.protein),
      total_carbs: String(params.carbs),
      total_fat: String(params.fat),
      serving_size: '1',
      serving_name: 'Serving',
      date: params.date,
    })
  }

  async removeFood(params: RemoveFoodParams): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/RemoveFromMeal.php', {
      date: params.date,
      meal_name: params.mealName,
      food_id: params.foodId,
      unique_id: params.uniqueId,
    })
  }

  async updateFood(params: UpdateFoodParams): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/UpdateFoodLog.php', {
      date: params.date,
      food_id: params.foodId,
      pre_meal_name: params.preMealName,
      pre_serving_name: params.preServingName,
      pre_unique_id: params.preUniqueId,
      new_meal_name: params.newMealName,
      new_serving_size: String(params.newServingSize),
    })
  }

  async copyMeal(params: CopyMealParams): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/CopyMeal.php', {
      from_date: params.fromDate,
      to_date: params.toDate,
      from_meal_name: params.fromMealName,
      new_meal_id: params.newMealId,
      new_meal_order: params.newMealOrder,
      new_meal_name: params.newMealName,
      copied_unique_ids: JSON.stringify(params.copiedUniqueIds),
    })
  }

  async deleteMeal(mealName: string, date: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/DeleteMeal.php', {
      meal: mealName,
      date,
    })
  }

  async saveNote(params: NoteParams): Promise<ApiResponse> {
    return this.request<ApiResponse>('notes.php', {
      meal_name: params.mealName,
      note: params.note,
      date: params.date,
    })
  }

  async toggleStar(foodId: string, action: 'add' | 'remove'): Promise<ApiResponse> {
    return this.request<ApiResponse>('Tracking/Food/alternateStarred.php', {
      food_id: foodId,
      action,
    })
  }

  private getSessionId(): string {
    if (!this.sessionId) throw new Error('No active session.')
    return this.sessionId
  }

  // ============================================================================
  // Debug
  // ============================================================================

  private debug(msg: string, ..._args: unknown[]): void {
    if (!this.debugMode) return
    // Simple debug logging — format %s, %d, %o manually
    let formatted = msg
    for (const arg of _args) {
      const replacement = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      formatted = formatted.replace(/%[sdo]/, replacement)
    }
    if (this.options?.onDebug) {
      this.options.onDebug(formatted)
    } else {
      process.stderr.write(`[debug] ${formatted}\n`)
    }
  }
}

// ============================================================================
// Normalization Helpers (exported for testing)
// ============================================================================

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      ['password', 'session_id', 'sessionId'].includes(key) ? '[REDACTED]' : redactSecrets(entry),
    ]),
  )
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function num(s: string | undefined): number {
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

export function normalizeFoodLogEntry(entry: ApiFoodLogEntry): NormalizedFoodEntry {
  const size = num(entry.serving_size)
  return {
    uniqueId: entry.uniqueID,
    foodId: entry.food_id,
    mealName: entry.meal_name,
    foodName: entry.food_name.trim(),
    servingSize: size,
    servingName: entry.serving_name,
    calories: round2(num(entry.calories) * size),
    protein: round2(num(entry.protein) * size),
    carbs: round2(num(entry.carbs) * size),
    fat: round2(num(entry.total_fat) * size),
    fiber: round2(num(entry.fiber) * size),
    sugar: round2(num(entry.sugar) * size),
    sodium: round2(num(entry.sodium) * size),
    saturatedFat: round2(num(entry.saturated_fat) * size),
    cholesterol: round2(num(entry.cholesterol) * size),
  }
}

function emptyMacros(): Macros {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    saturatedFat: 0,
    cholesterol: 0,
  }
}

function sumMacros(entries: NormalizedFoodEntry[]): Macros {
  const totals = emptyMacros()
  for (const e of entries) {
    totals.calories += e.calories
    totals.protein += e.protein
    totals.carbs += e.carbs
    totals.fat += e.fat
    totals.fiber += e.fiber
    totals.sugar += e.sugar
    totals.sodium += e.sodium
    totals.saturatedFat += e.saturatedFat
    totals.cholesterol += e.cholesterol
  }
  // Round all
  for (const key of Object.keys(totals) as (keyof Macros)[]) {
    totals[key] = round2(totals[key])
  }
  return totals
}

export function normalizeDailyMeals(
  raw: DailyMealsApiResponse,
  apiDate: string,
): NormalizedDailyMeals {
  const content = raw.nutri?.content ?? {}
  const mealOrder = raw.nutri?.meal_order ?? []

  const meals: MealSummary[] = []

  // Include meals that have entries (from meal_order)
  for (const mealName of mealOrder) {
    const rawEntries = content[mealName] ?? []
    if (rawEntries.length === 0) continue
    const entries = rawEntries.map(normalizeFoodLogEntry)
    meals.push({
      name: mealName,
      entries,
      totals: sumMacros(entries),
    })
  }

  // Build notes (strip internal key naming)
  const notes: Record<string, string> = {}
  if (raw.notes && typeof raw.notes === 'object') {
    for (const [key, value] of Object.entries(raw.notes)) {
      if (value?.trim()) {
        notes[key === '-1' ? 'day' : key] = value
      }
    }
  }

  // Convert API date MM-DD-YYYY to display YYYY-MM-DD
  const parts = apiDate.split('-')
  const displayDate = parts.length === 3 ? `${parts[2]}-${parts[0]}-${parts[1]}` : apiDate

  return {
    date: displayDate,
    meals,
    dailyTotals: sumMacros(meals.flatMap((m) => m.entries)),
    notes,
  }
}

export function normalizeFoodItem(item: ApiFoodItem): NormalizedFoodItem {
  return {
    foodId: item.foodID,
    foodName: item.foodName?.trim() ?? '',
    brand: item.brand?.trim() ?? '',
    servingName: item.servingName ?? '',
    servingSize: round2(num(item.servingSize)),
    calories: round2(num(item.calories)),
    protein: round2(num(item.protein)),
    carbs: round2(num(item.carbs)),
    fat: round2(num(item.totalFat)),
    fiber: round2(num(item.fiber)),
    sugar: round2(num(item.sugar)),
    sodium: round2(num(item.sodium)),
    saturatedFat: round2(num(item.satFat)),
    cholesterol: round2(num(item.cholesterol)),
    starred: item.starred ?? false,
    isCustom: Number(item.foodID) < 0,
  }
}

export function normalizeSearchResults(
  raw: FoodSearchApiResponse,
  limit: number,
): NormalizedSearchResults {
  const sections = (raw.food_results ?? []).map((section) => {
    const allFoods = section.food.map(normalizeFoodItem)
    return {
      title: section.title,
      count: allFoods.length,
      foods: limit > 0 ? allFoods.slice(0, limit) : allFoods,
    }
  })
  return { sections }
}
