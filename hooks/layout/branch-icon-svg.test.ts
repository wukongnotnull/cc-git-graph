import { describe, expect, test } from 'claude-code/testing'

import { branchIconSvg } from './branch-icon-svg'

describe('branchIconSvg', () => {
  test('is a square of the given size in the given colour', () => {
    const icon = branchIconSvg(16, '#6e7781')

    expect(icon.width).toBe(16)
    expect(icon.height).toBe(16)
    expect(icon.source).toContain('viewBox="0 0 16 16"')
    expect(icon.source).toContain('stroke="#6e7781"')
  })

  test('draws three dots and the two lines that join them', () => {
    const source = branchIconSvg(16, '#6e7781').source

    expect(source.split('<circle').length - 1).toBe(3)
    expect(source.split('<path').length - 1).toBe(2)
  })

  test('scales with the size', () => {
    expect(branchIconSvg(32, '#6e7781').source).toContain('viewBox="0 0 32 32"')
    expect(branchIconSvg(32, '#6e7781').source).toContain('r="3.4"')
  })
})
