import { describe, expect, test } from 'claude-code/testing'

import { parseMeta, parseNumstat } from './parse-detail'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)

describe('parseMeta', () => {
  test('parses people, date and the full message', () => {
    const stdout = [A, B, 'Ada', 'ada@x.com', 'Bob', 'bob@x.com', '2026-10-11 16:34:41 +0800', 'subject\n\nbody line\n'].join('\x1f')

    expect(parseMeta(stdout)).toEqual({
      hash: A,
      parents: [B],
      author: 'Ada',
      authorEmail: 'ada@x.com',
      committer: 'Bob',
      committerEmail: 'bob@x.com',
      date: '2026-10-11 16:34:41 +0800',
      message: 'subject\n\nbody line',
    })
  })

  test('returns null when fields are missing', () => {
    expect(parseMeta('only\x1ftwo')).toBeNull()
  })
})

describe('parseNumstat', () => {
  test('parses added and deleted counts per path', () => {
    expect(parseNumstat('5\t3\tCLAUDE.md\n10\t0\tdocs/a b.md\n')).toEqual([
      { path: 'CLAUDE.md', added: 5, deleted: 3 },
      { path: 'docs/a b.md', added: 10, deleted: 0 },
    ])
  })

  test('binary files have null counts', () => {
    expect(parseNumstat('-\t-\timage.png\n')).toEqual([{ path: 'image.png', added: null, deleted: null }])
  })

  test('empty output gives no files', () => {
    expect(parseNumstat('')).toEqual([])
  })
})
