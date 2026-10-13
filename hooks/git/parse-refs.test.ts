import { describe, expect, test } from 'claude-code/testing'

import { parseRefs } from './parse-refs'

const REMOTES = new Set(['origin/main'])

describe('parseRefs', () => {
  test('returns nothing for an empty string', () => {
    expect(parseRefs('', REMOTES)).toEqual([])
  })

  test('marks the branch after "HEAD ->" as current', () => {
    expect(parseRefs('HEAD -> main', REMOTES)).toEqual([{ name: 'main', kind: 'branch', isCurrent: true }])
  })

  test('classifies remotes by the remote name set and tags by prefix', () => {
    expect(parseRefs('origin/main, tag: v1.0, feature/x', REMOTES)).toEqual([
      { name: 'origin/main', kind: 'remote', isCurrent: false },
      { name: 'v1.0', kind: 'tag', isCurrent: false },
      { name: 'feature/x', kind: 'branch', isCurrent: false },
    ])
  })

  test('treats origin/HEAD as a remote', () => {
    expect(parseRefs('origin/HEAD', REMOTES)).toEqual([{ name: 'origin/HEAD', kind: 'remote', isCurrent: false }])
  })

  test('keeps a detached HEAD', () => {
    expect(parseRefs('HEAD', REMOTES)).toEqual([{ name: 'HEAD', kind: 'head', isCurrent: true }])
  })
})
