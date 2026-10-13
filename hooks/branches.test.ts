import { describe, expect, test } from 'claude-code/testing'

import { visibleBranches } from './branches'

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
