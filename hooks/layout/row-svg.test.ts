import { describe, expect, test } from 'claude-code/testing'

import type { GraphRow } from '../../types'
import { LANE_COLORS, LANE_WIDTH, ROW_HEIGHT } from '../constants'
import { rowSvg } from './row-svg'

const ROW: GraphRow = {
  hash: 'h',
  lane: 0,
  color: 0,
  isMerge: false,
  through: [],
  incoming: [],
  outgoing: [],
}

const count = (text: string, needle: string): number => text.split(needle).length - 1

describe('rowSvg', () => {
  test('sizes the drawing to the column count and row height', () => {
    const svg = rowSvg(ROW, 3, false)

    expect(svg).toContain(`width="${3 * LANE_WIDTH}"`)
    expect(svg).toContain(`height="${ROW_HEIGHT}"`)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  test('draws a filled node, or a hollow one for the head commit', () => {
    const circlesOf = (svg: string): string[] => svg.match(/<circle[^>]*\/>/g) ?? []
    const [filled] = circlesOf(rowSvg(ROW, 1, false))
    const [hollow] = circlesOf(rowSvg(ROW, 1, true))

    expect(circlesOf(rowSvg(ROW, 1, false))).toHaveLength(1)
    expect(filled).toMatch(/fill="#[0-9a-f]{6}"/)
    expect(filled).not.toContain('fill="none"')
    expect(filled).not.toContain('stroke')
    expect(circlesOf(rowSvg(ROW, 1, true))).toHaveLength(1)
    expect(hollow).toContain('fill="none"')
    expect(hollow).toMatch(/stroke="#[0-9a-f]{6}"/)
  })

  test('draws a straight line for a same-lane edge and a curve for a cross-lane edge', () => {
    const straight = rowSvg({ ...ROW, outgoing: [{ from: 0, to: 0, color: 0 }] }, 2, false)
    const curved = rowSvg({ ...ROW, outgoing: [{ from: 0, to: 1, color: 1 }] }, 2, false)

    expect(count(straight, '<line')).toBe(1)
    expect(count(straight, '<path')).toBe(0)
    expect(count(curved, '<path')).toBe(1)
  })

  test('draws one full-height line per through edge', () => {
    const svg = rowSvg({ ...ROW, through: [{ from: 1, to: 1, color: 2 }, { from: 2, to: 2, color: 3 }] }, 3, false)

    expect(count(svg, '<line')).toBe(2)
  })

  test('cycles lane colors past the palette length', () => {
    expect(rowSvg({ ...ROW, color: LANE_COLORS.length }, 1, false)).toBe(rowSvg({ ...ROW, color: 0 }, 1, false))
  })

  test('stays far below the SVG size limit even for a wide row', () => {
    const edges = Array.from({ length: 40 }, (_, index) => ({ from: index, to: index, color: index }))

    expect(rowSvg({ ...ROW, through: edges }, 40, false).length).toBeLessThan(131072)
  })
})

describe('rowSvg width override', () => {
  test('a wider drawing keeps the lanes left-aligned', () => {
    const svg = rowSvg(ROW, 1, false, 63)

    expect(svg).toContain('width="63"')
    expect(svg).toContain('viewBox="0 0 63 ')
    expect(svg).toContain(`cx="${LANE_WIDTH / 2}"`)
  })
})
