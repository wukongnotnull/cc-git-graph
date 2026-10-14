import { describe, expect, test } from 'claude-code/testing'

import { branchOptions, visibleBranches } from './branches'
import { ALL_BRANCHES, MAX_SELECT_OPTIONS } from './constants'

const BASE = {
  branches: ['main', 'feature/x', 'origin/main'],
  remoteBranches: ['origin/main'],
}

describe('visibleBranches', () => {
  test('includes remote branches when the toggle is on', () => {
    expect(visibleBranches({ ...BASE, isRemoteShown: true })).toEqual(['main', 'feature/x', 'origin/main'])
  })

  test('drops remote branches when the toggle is off', () => {
    expect(visibleBranches({ ...BASE, isRemoteShown: false })).toEqual(['main', 'feature/x'])
  })

  test('keeps a local branch whose name contains a slash', () => {
    expect(visibleBranches({ ...BASE, isRemoteShown: false })).toContain('feature/x')
  })
})

const many = (count: number): string[] => Array.from({ length: count }, (_, index) => `origin/b${index}`)
const viewOf = (branches: string[], branch: string) => ({ branches, remoteBranches: [], isRemoteShown: true, branch })

describe('branchOptions', () => {
  test('lists Show All and every branch while they fit', () => {
    const options = branchOptions(viewOf(['main', 'dev'], ALL_BRANCHES))

    expect(options.map(option => option.value)).toEqual([ALL_BRANCHES, 'main', 'dev'])
  })

  test('never lists more options than a Select takes, and says how many are left out', () => {
    const options = branchOptions(viewOf(many(300), ALL_BRANCHES))
    const last = options.at(-1)

    expect(options).toHaveLength(MAX_SELECT_OPTIONS)
    expect(last?.label).toBe(`… ${300 - (MAX_SELECT_OPTIONS - 2)} more (turn off remote branches)`)
    expect(last?.value).toBe('')
  })

  test('keeps the selected branch when it is past the cut', () => {
    const names = many(300)
    const options = branchOptions(viewOf(names, names[250] ?? ''))

    expect(options).toHaveLength(MAX_SELECT_OPTIONS)
    expect(options.some(option => option.value === names[250])).toBe(true)
  })
})
