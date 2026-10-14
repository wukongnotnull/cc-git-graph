import type { UsageSnapshot } from '../types'

// The parts of `$.session.usage()` and of the `session.measure` event that the band shows.
export type UsageSource = {
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
  context: { percent?: number }
  cost?: { usd: number }
}

export type UsageItem = {
  key: string
  label: string
  percent: number
  // When the window resets, e.g. `周一 06:00 重置`; empty for the context window.
  reset: string
}

const WINDOW_LABELS: Record<string, string> = {
  five_hour: '会话',
  seven_day: '本周',
  spend_limit: '消费上限',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const WARN_PERCENT = 80
const DANGER_PERCENT = 95
// Okabe-Ito colours, apart for red-green colour blindness, and told apart by lightness too.
const NORMAL_COLOR = '#56b4e9'
const WARN_COLOR = '#e69f00'
const DANGER_COLOR = '#d55e00'

export function snapshotOf(source: UsageSource): UsageSnapshot {
  return {
    rateLimits: source.rateLimits.map(limit => ({ kind: limit.kind, percentUsed: limit.percentUsed, resetsAt: limit.resetsAt })),
    contextPercent: source.context.percent,
    costUsd: source.cost?.usd,
  }
}

const pad = (value: number): string => String(value).padStart(2, '0')

// `14:30 重置` when the reset is today, `周一 06:00 重置` otherwise; empty for a time that cannot be read.
export function formatReset(iso: string | undefined, nowMs: number): string {
  if (iso === undefined) {
    return ''
  }

  const at = new Date(iso)

  if (Number.isNaN(at.getTime())) {
    return ''
  }

  const now = new Date(nowMs)
  const isToday = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate()
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`

  return isToday ? `${time} 重置` : `周${WEEKDAYS[at.getDay()] ?? ''} ${time} 重置`
}

export function usageItems(usage: UsageSnapshot, nowMs: number): UsageItem[] {
  const limits = usage.rateLimits.map(
    (limit): UsageItem => ({
      key: `limit-${limit.kind}`,
      label: WINDOW_LABELS[limit.kind] ?? limit.kind,
      percent: limit.percentUsed,
      reset: formatReset(limit.resetsAt, nowMs),
    }),
  )
  const order = (item: UsageItem): number => Object.keys(WINDOW_LABELS).findIndex(kind => `limit-${kind}` === item.key)
  const sorted = [...limits].sort((a, b) => (order(a) === -1 ? 99 : order(a)) - (order(b) === -1 ? 99 : order(b)))

  return usage.contextPercent === undefined
    ? sorted
    : [...sorted, { key: 'context', label: '上下文', percent: usage.contextPercent, reset: '' }]
}

export function levelColor(percent: number): string {
  if (percent >= DANGER_PERCENT) {
    return DANGER_COLOR
  }

  return percent >= WARN_PERCENT ? WARN_COLOR : NORMAL_COLOR
}

export const formatCost = (usd: number): string => `$${usd.toFixed(2)}`
