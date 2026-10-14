import { describe, expect, test } from 'claude-code/testing'

import { usageRingSvg } from './usage-ring-svg'

const dashOf = (source: string): number => Number(/stroke-dasharray="([\d.]+) /.exec(source)?.[1])
const circumference = 2 * Math.PI * ((16 - 3) / 2)
const isNear = (actual: number, expected: number): boolean => Math.abs(actual - expected) < 0.05

describe('usageRingSvg', () => {
  test('is a square of the given size', () => {
    const ring = usageRingSvg(50, 16, '#56b4e9')

    expect(ring.width).toBe(16)
    expect(ring.height).toBe(16)
    expect(ring.source).toContain('viewBox="0 0 16 16"')
  })

  test('draws the used share of the circumference from the top', () => {
    const ring = usageRingSvg(25, 16, '#56b4e9')

    expect(ring.source).toContain('transform="rotate(-90 8 8)"')
    expect(isNear(dashOf(ring.source), circumference / 4)).toBe(true)
  })

  test('an empty ring is the track alone', () => {
    expect(usageRingSvg(0, 16, '#56b4e9').source).not.toContain('#56b4e9')
  })

  test('a full ring draws the whole circumference', () => {
    expect(isNear(dashOf(usageRingSvg(100, 16, '#56b4e9').source), circumference)).toBe(true)
  })

  test('clamps a value over 100 and one below 0, and treats one that is not a number as empty', () => {
    expect(isNear(dashOf(usageRingSvg(250, 16, '#d55e00').source), circumference)).toBe(true)
    expect(usageRingSvg(-5, 16, '#d55e00').source).not.toContain('#d55e00')
    expect(usageRingSvg(Number.NaN, 16, '#d55e00').source).not.toContain('#d55e00')
  })
})
