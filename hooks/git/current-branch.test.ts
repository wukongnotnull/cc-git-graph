import { describe, expect, test } from 'claude-code/testing'

import { DETACHED_LABEL, parseCurrentBranch } from './current-branch'

describe('parseCurrentBranch', () => {
  test('returns the branch name without the line break', () => {
    expect(parseCurrentBranch('feat/ui-polish\n')).toBe('feat/ui-polish')
  })

  test('says detached when git answers HEAD', () => {
    expect(parseCurrentBranch('HEAD\n')).toBe(DETACHED_LABEL)
  })

  test('an empty answer stays empty', () => {
    expect(parseCurrentBranch('')).toBe('')
  })
})
