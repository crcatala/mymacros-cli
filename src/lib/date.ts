/**
 * Date parsing and formatting utilities.
 *
 * User input: YYYY-MM-DD, "today", "yesterday", "tomorrow"
 * API format: MM-DD-YYYY
 */

/**
 * Parse a user-provided date string into a Date object.
 * Accepts: YYYY-MM-DD, "today", "yesterday", "tomorrow"
 * Returns null if invalid.
 */
export function parseDate(input: string): Date | null {
  const lower = input.trim().toLowerCase()

  const now = new Date()
  // Use local date components to avoid timezone issues
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (lower === 'today') return today
  if (lower === 'yesterday') {
    today.setDate(today.getDate() - 1)
    return today
  }
  if (lower === 'tomorrow') {
    today.setDate(today.getDate() + 1)
    return today
  }

  // YYYY-MM-DD
  const match = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)

  // Basic range validation
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  // Verify the date didn't roll over (e.g., Feb 30 → Mar 2)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return date
}

/**
 * Format a Date to API format: MM-DD-YYYY
 */
export function toApiDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${mm}-${dd}-${yyyy}`
}

/**
 * Format a Date to display format: YYYY-MM-DD
 */
export function toDisplayDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Convert API date (MM-DD-YYYY) to display date (YYYY-MM-DD)
 */
export function apiDateToDisplay(apiDate: string): string {
  const parts = apiDate.split('-')
  if (parts.length !== 3) return apiDate
  return `${parts[2]}-${parts[0]}-${parts[1]}`
}

/**
 * Parse user input and return API-formatted date string.
 * Returns null if invalid.
 */
export function resolveDate(input: string): { api: string; display: string } | null {
  const date = parseDate(input)
  if (!date) return null
  return { api: toApiDate(date), display: toDisplayDate(date) }
}

/**
 * Get today's date in both formats.
 */
export function todayDate(): { api: string; display: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return { api: toApiDate(today), display: toDisplayDate(today) }
}
