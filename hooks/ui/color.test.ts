import { describe, expect, test } from 'claude-code/testing'

import { darken } from './color'

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
