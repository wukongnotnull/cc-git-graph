import { describe, expect, test } from 'claude-code/testing'

import { chipSvg, textWidthPx } from './chip-svg'

const base = { color: '#4f8ef7', remoteColor: '#2f5597', textColor: '#ffffff', isBold: true }

describe('chipSvg', () => {
  test('draws a rounded pill carrying the label and the full title', () => {
    const chip = chipSvg({ ...base, label: 'main', title: 'main (origin)' })

    expect(chip.source).toContain('rx="8"')
    expect(chip.source).toContain('>main</text>')
    expect(chip.source).toContain('<title>main (origin)</title>')
    expect(chip.height).toBe(16)
  })

  test('a longer label makes a wider pill', () => {
    expect(chipSvg({ ...base, label: 'feature/long', title: 'x' }).width).toBeGreaterThan(chipSvg({ ...base, label: 'a', title: 'x' }).width)
  })

  test('remote names add a second, darker part and widen the pill', () => {
    const plain = chipSvg({ ...base, label: 'main', title: 'x' })
    const joined = chipSvg({ ...base, label: 'main', remote: 'origin', title: 'x' })

    expect(joined.width).toBeGreaterThan(plain.width)
    expect(joined.source).toContain('#2f5597')
    expect(joined.source).toContain('>origin</text>')
    expect(plain.source).not.toContain('#2f5597')
  })

  test('escapes markup in names', () => {
    const chip = chipSvg({ ...base, label: 'a<b&c', title: 'a<b&c "x"' })

    expect(chip.source).toContain('a&lt;b&amp;c')
    expect(chip.source).toContain('&quot;x&quot;')
    expect(chip.source).not.toContain('a<b')
  })

  test('wide characters count wider than ascii', () => {
    expect(textWidthPx('悟空')).toBeGreaterThan(textWidthPx('ab'))
  })
})
