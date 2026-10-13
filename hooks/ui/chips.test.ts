import { describe, expect, test } from 'claude-code/testing'

import type { Ref } from '../../types'
import { chipTitle, chipsOf, hasCutChips, limitChips } from './chips'

const branch = (name: string, isCurrent = false): Ref => ({ name, kind: 'branch', isCurrent })
const remote = (name: string): Ref => ({ name, kind: 'remote', isCurrent: false })
const tag = (name: string): Ref => ({ name, kind: 'tag', isCurrent: false })

describe('chipsOf', () => {
  test('a remote branch joins the local branch of the same name', () => {
    expect(chipsOf([branch('main', true), remote('origin/main')])).toEqual([
      { label: 'main', remotes: ['origin'], kind: 'branch', isCurrent: true },
    ])
  })

  test('several remotes of one branch all join its chip', () => {
    const chips = chipsOf([branch('main'), remote('origin/main'), remote('upstream/main')])

    expect(chips).toHaveLength(1)
    expect(chips[0]?.remotes).toEqual(['origin', 'upstream'])
  })

  test('a remote branch without a local branch on the commit stands alone', () => {
    expect(chipsOf([remote('origin/feat/x')])).toEqual([
      { label: 'origin/feat/x', remotes: [], kind: 'remote', isCurrent: false },
    ])
  })

  test('a remote HEAD never joins a branch, even one named HEAD-like', () => {
    const chips = chipsOf([branch('main'), remote('origin/HEAD')])

    expect(chips.map(chip => chip.label)).toEqual(['main', 'origin/HEAD'])
    expect(chips[0]?.remotes).toEqual([])
  })

  test('tags keep their own chip and the order of the refs', () => {
    expect(chipsOf([tag('v1'), branch('main'), remote('origin/main')]).map(chip => chip.label)).toEqual(['v1', 'main'])
  })

  test('a branch name with slashes matches the remote after the first slash', () => {
    expect(chipsOf([branch('feat/x'), remote('origin/feat/x')])).toEqual([
      { label: 'feat/x', remotes: ['origin'], kind: 'branch', isCurrent: false },
    ])
  })

  test('no refs, no chips', () => {
    expect(chipsOf([])).toEqual([])
  })
})

describe('limitChips', () => {
  const chips = chipsOf([branch('a'), branch('b'), branch('c')])

  test('keeps the first chips and counts the rest', () => {
    const { shown, hiddenCount } = limitChips(chips, 2)

    expect(shown.map(chip => chip.label)).toEqual(['a', 'b'])
    expect(hiddenCount).toBe(1)
  })

  test('hides nothing when everything fits', () => {
    expect(limitChips(chips, 3)).toEqual({ shown: chips, hiddenCount: 0 })
  })
})

describe('chipTitle and hasCutChips', () => {
  test('the title spells the remotes out', () => {
    expect(chipTitle({ label: 'main', remotes: ['origin', 'upstream'], kind: 'branch', isCurrent: false })).toBe('main (origin, upstream)')
    expect(chipTitle({ label: 'v1', remotes: [], kind: 'tag', isCurrent: false })).toBe('v1')
  })

  test('nothing is cut when the chips and names fit', () => {
    expect(hasCutChips(chipsOf([branch('main')]), 2, 22)).toBe(false)
  })

  test('a long name or a third chip counts as cut', () => {
    expect(hasCutChips(chipsOf([branch('a'.repeat(23))]), 2, 22)).toBe(true)
    expect(hasCutChips(chipsOf([branch('a'), branch('b'), branch('c')]), 2, 22)).toBe(true)
  })
})
