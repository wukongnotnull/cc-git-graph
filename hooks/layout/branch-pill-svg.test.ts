import { describe, expect, test } from 'claude-code/testing'

import { branchPillSvg } from './branch-pill-svg'

describe('branchPillSvg', () => {
  test('is a rounded outline with the glyph and the name', () => {
    const pill = branchPillSvg('feat/usage-band')

    expect(pill.height).toBe(20)
    expect(pill.source).toContain('rx="9.5"')
    expect(pill.source).toContain('>feat/usage-band</text>')
    expect(pill.source).toContain('<circle')
  })

  test('a longer name makes a wider pill', () => {
    expect(branchPillSvg('docs/private-board-reads-spec').width).toBeGreaterThan(branchPillSvg('main').width)
  })

  test('puts the glyph inside the pill, vertically centred', () => {
    expect(branchPillSvg('main').source).toContain('<svg x="8" y="4" ')
  })

  test('escapes markup in the name', () => {
    const pill = branchPillSvg('a<b&c')

    expect(pill.source).toContain('a&lt;b&amp;c')
    expect(pill.source).not.toContain('a<b')
  })
})
