import { describe, expect, it } from 'vitest'
import {
  apiDateToDisplay,
  parseDate,
  resolveDate,
  toApiDate,
  toDisplayDate,
} from '../src/lib/date.js'

describe('parseDate', () => {
  it('parses "today"', () => {
    const result = parseDate('today')
    expect(result).toBeInstanceOf(Date)
    if (!result) throw new Error('Expected a date')
    const now = new Date()
    expect(result.getFullYear()).toBe(now.getFullYear())
    expect(result.getMonth()).toBe(now.getMonth())
    expect(result.getDate()).toBe(now.getDate())
  })

  it('parses "yesterday"', () => {
    const result = parseDate('yesterday')
    expect(result).toBeInstanceOf(Date)
    if (!result) throw new Error('Expected a date')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(result.getDate()).toBe(yesterday.getDate())
  })

  it('parses "tomorrow"', () => {
    const result = parseDate('tomorrow')
    expect(result).toBeInstanceOf(Date)
    if (!result) throw new Error('Expected a date')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(result.getDate()).toBe(tomorrow.getDate())
  })

  it('parses YYYY-MM-DD', () => {
    const result = parseDate('2026-02-17')
    expect(result).toBeInstanceOf(Date)
    if (!result) throw new Error('Expected a date')
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(1) // 0-indexed
    expect(result.getDate()).toBe(17)
  })

  it('returns null for invalid format', () => {
    expect(parseDate('02-17-2026')).toBeNull()
    expect(parseDate('not-a-date')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('2026-13-01')).toBeNull()
    expect(parseDate('2026-02-30')).toBeNull()
  })

  it('is case-insensitive for keywords', () => {
    expect(parseDate('Today')).toBeInstanceOf(Date)
    expect(parseDate('YESTERDAY')).toBeInstanceOf(Date)
  })
})

describe('toApiDate', () => {
  it('formats as MM-DD-YYYY', () => {
    const date = new Date(2026, 1, 17) // Feb 17
    expect(toApiDate(date)).toBe('02-17-2026')
  })

  it('pads single digits', () => {
    const date = new Date(2026, 0, 5) // Jan 5
    expect(toApiDate(date)).toBe('01-05-2026')
  })
})

describe('toDisplayDate', () => {
  it('formats as YYYY-MM-DD', () => {
    const date = new Date(2026, 1, 17)
    expect(toDisplayDate(date)).toBe('2026-02-17')
  })
})

describe('apiDateToDisplay', () => {
  it('converts MM-DD-YYYY to YYYY-MM-DD', () => {
    expect(apiDateToDisplay('02-17-2026')).toBe('2026-02-17')
  })

  it('passes through invalid formats unchanged', () => {
    expect(apiDateToDisplay('bad')).toBe('bad')
  })
})

describe('resolveDate', () => {
  it('returns api and display formats', () => {
    const result = resolveDate('2026-02-17')
    expect(result).toEqual({
      api: '02-17-2026',
      display: '2026-02-17',
    })
  })

  it('returns null for invalid input', () => {
    expect(resolveDate('garbage')).toBeNull()
  })
})
