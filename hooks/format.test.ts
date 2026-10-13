import { describe, expect, test } from 'claude-code/testing'

import { ellipsize, formatDate, shortHash } from './format'

describe('format', () => {
  test('shortHash keeps the first 8 characters', () => {
    expect(shortHash('0123456789abcdef')).toBe('01234567')
  })

  test('formatDate renders day, month, year and time in local time', () => {
    const seconds = new Date(2026, 9, 13, 11, 25).getTime() / 1000

    expect(formatDate(seconds)).toBe('13 Oct 2026 11:25')
  })

  test('formatDate pads single-digit days and minutes', () => {
    const seconds = new Date(2026, 0, 4, 9, 5).getTime() / 1000

    expect(formatDate(seconds)).toBe('04 Jan 2026 09:05')
  })

  test('ellipsize leaves a short text alone and cuts a long one to the limit', () => {
    expect(ellipsize('main', 10)).toBe('main')
    expect(ellipsize('abcdefghij', 10)).toBe('abcdefghij')
    expect(ellipsize('abcdefghijk', 10)).toBe('abcdefghi…')
  })
})
