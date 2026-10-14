import { describe, expect, test } from 'claude-code/testing'

import { usageBarSvg } from './usage-bar-svg'

describe('usageBarSvg', () => {
  test('fills the share of the width that is used', () => {
    const bar = usageBarSvg(50, 100, '#56b4e9')

    expect(bar.source).toContain('width="50" height="8" rx="4" fill="#56b4e9"')
    expect(bar.width).toBe(100)
    expect(bar.height).toBe(8)
  })

  test('an empty bar is the track alone', () => {
    expect(usageBarSvg(0, 100, '#56b4e9').source).not.toContain('#56b4e9')
  })

  test('a small share still shows a rounded dot, as wide as the bar is tall', () => {
    expect(usageBarSvg(1, 100, '#56b4e9').source).toContain('width="8" height="8"')
  })

  test('clamps a value over 100 and one below 0', () => {
    expect(usageBarSvg(250, 100, '#d55e00').source).toContain('width="100" height="8" rx="4" fill="#d55e00"')
    expect(usageBarSvg(-5, 100, '#d55e00').source).not.toContain('#d55e00')
  })

  test('treats a value that is not a number as empty', () => {
    expect(usageBarSvg(Number.NaN, 100, '#d55e00').source).not.toContain('#d55e00')
  })
})
