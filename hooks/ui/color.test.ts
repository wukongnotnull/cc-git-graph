import { describe, expect, test } from 'claude-code/testing'

import { darken, lighten, readableOn } from './color'

describe('darken', () => {
  test('mixes with black', () => {
    expect(darken('#ffffff', 0.5)).toBe('#808080')
    expect(darken('#4f8ef7', 0)).toBe('#4f8ef7')
    expect(darken('#4f8ef7', 1)).toBe('#000000')
  })

  test('leaves a colour that is not #rrggbb as it was', () => {
    expect(darken('suggestion', 0.3)).toBe('suggestion')
    expect(darken('#fff', 0.3)).toBe('#fff')
  })
})

describe('readableOn', () => {
  test('white text on a dark background, near-black on a light one', () => {
    expect(readableOn('#0072b2')).toBe('#ffffff')
    expect(readableOn('#56b4e9')).toBe('#1f2328')
    expect(readableOn('#e69f00')).toBe('#1f2328')
    expect(readableOn('#000000')).toBe('#ffffff')
    expect(readableOn('#ffffff')).toBe('#1f2328')
  })
})

describe('lighten', () => {
  test('mixes with white', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080')
    expect(lighten('#0072b2', 0)).toBe('#0072b2')
    expect(lighten('#0072b2', 1)).toBe('#ffffff')
  })

  test('leaves a colour that is not #rrggbb as it was', () => {
    expect(lighten('suggestion', 0.5)).toBe('suggestion')
  })
})
