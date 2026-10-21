import { describe, expect, test } from 'claude-code/testing'

import { ROW_OVERHEAD_CHARS, ROW_WINDOW_CHARS } from '../constants'
import { linearLog } from '../testing/fixtures'
import { parseLog } from '../git/parse-log'
import { emptyLaneState, layoutCommits } from './lanes'
import { windowEnd } from './window'

const viewOf = (count: number, refs = '') => {
  const commits = parseLog(linearLog(count).join('').replaceAll('\x1f\x1f', `\x1f${refs}\x1f`), new Set())
  const { rows } = layoutCommits(emptyLaneState(), commits)

  return { commits, rows, isRemoteShown: true }
}

describe('windowEnd', () => {
  test('a short history fits whole', () => {
    const view = viewOf(10)

    expect(windowEnd(view, 0)).toBe(10)
  })

  test('a long history is cut inside the budget', () => {
    const view = viewOf(500)
    const end = windowEnd(view, 0)

    expect(end).toBeGreaterThan(20)
    expect(end).toBeLessThan(500)
    expect(end * ROW_OVERHEAD_CHARS).toBeLessThan(ROW_WINDOW_CHARS + ROW_OVERHEAD_CHARS * 2)
  })

  test('starts where it is told and always takes at least one row', () => {
    const view = viewOf(500)
    const end = windowEnd(view, 100)

    expect(end).toBeGreaterThan(100)
    expect(windowEnd(view, 499)).toBe(500)
  })

  test('chips make a row dearer, so a window of ref-heavy rows is shorter', () => {
    const plain = windowEnd(viewOf(500), 0)
    const decorated = windowEnd(viewOf(500, 'HEAD -> main, origin/main'), 0)

    expect(decorated).toBeLessThan(plain)
  })

  test('an empty history, or a start past the end, has an empty window', () => {
    expect(windowEnd(viewOf(0), 0)).toBe(0)
    expect(windowEnd(viewOf(5), 7)).toBe(7)
  })
})
