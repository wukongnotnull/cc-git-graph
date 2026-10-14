import { describe, expect, test } from 'claude-code/testing'

import { formatCost, formatReset, levelColor, snapshotOf, usageItems } from './usage'

// 2026-10-14 is a Wednesday, 2026-10-19 a Monday; the dates are built in local time, as the formatter reads them.
const NOW = new Date(2026, 9, 14, 1, 0).getTime()
const at = (day: number, hour: number, minute: number): string => new Date(2026, 9, day, hour, minute).toISOString()

describe('formatReset', () => {
  test('a reset later today shows the time only', () => {
    expect(formatReset(at(14, 6, 0), NOW)).toBe('06:00 重置')
  })

  test('a reset on another day names the weekday', () => {
    expect(formatReset(at(19, 6, 5), NOW)).toBe('周一 06:05 重置')
  })

  test('a missing or unreadable time gives nothing', () => {
    expect(formatReset(undefined, NOW)).toBe('')
    expect(formatReset('not a date', NOW)).toBe('')
  })
})

describe('snapshotOf', () => {
  test('keeps the windows, the context percent and the cost', () => {
    const snapshot = snapshotOf({
      rateLimits: [{ kind: 'five_hour', percentUsed: 12.4, resetsAt: at(14, 5, 0) }],
      context: { percent: 23 },
      cost: { usd: 0.42 },
    })

    expect(snapshot).toEqual({
      rateLimits: [{ kind: 'five_hour', percentUsed: 12.4, resetsAt: at(14, 5, 0) }],
      contextPercent: 23,
      costUsd: 0.42,
    })
  })

  test('leaves out what the engine does not have', () => {
    expect(snapshotOf({ rateLimits: [], context: {} })).toEqual({ rateLimits: [], contextPercent: undefined, costUsd: undefined })
  })
})

describe('usageItems', () => {
  test('lists the five-hour window, then the week, then the context window', () => {
    const items = usageItems(
      {
        rateLimits: [
          { kind: 'seven_day', percentUsed: 34, resetsAt: at(19, 6, 0) },
          { kind: 'five_hour', percentUsed: 0 },
        ],
        contextPercent: 23,
      },
      NOW,
    )

    expect(items.map(item => item.label)).toEqual(['会话', '本周', '上下文'])
    expect(items[1]?.reset).toBe('周一 06:00 重置')
    expect(items[2]?.reset).toBe('')
  })

  test('a window of an unknown kind keeps its own name and goes after the known ones', () => {
    const items = usageItems({ rateLimits: [{ kind: 'extra', percentUsed: 1 }, { kind: 'five_hour', percentUsed: 2 }] }, NOW)

    expect(items.map(item => item.label)).toEqual(['会话', 'extra'])
  })

  test('shows nothing for a context window with no reading yet', () => {
    expect(usageItems({ rateLimits: [] }, NOW)).toEqual([])
  })
})

describe('levelColor and formatCost', () => {
  test('warns from 80 percent and flags danger from 95', () => {
    expect(levelColor(10)).toBe('#56b4e9')
    expect(levelColor(80)).toBe('#e69f00')
    expect(levelColor(95)).toBe('#d55e00')
  })

  test('the cost has two decimals and a dollar sign', () => {
    expect(formatCost(0.4)).toBe('$0.40')
    expect(formatCost(12)).toBe('$12.00')
  })
})
