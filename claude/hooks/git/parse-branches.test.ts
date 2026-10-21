import { describe, expect, test } from 'claude-code/testing'

import { parseBranches } from './parse-branches'

describe('parseBranches', () => {
  test('splits local and remote branches and strips the ref prefix', () => {
    const stdout = 'refs/heads/main\nrefs/heads/feature/x\nrefs/remotes/origin/main\nrefs/remotes/origin/HEAD\n'

    expect(parseBranches(stdout)).toEqual({
      locals: ['main', 'feature/x'],
      remotes: ['origin/main', 'origin/HEAD'],
    })
  })

  test('empty output gives empty lists', () => {
    expect(parseBranches('')).toEqual({ locals: [], remotes: [] })
  })
})
