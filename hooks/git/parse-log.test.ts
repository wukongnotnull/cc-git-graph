import { describe, expect, test } from 'claude-code/testing'

import { parseLog } from './parse-log'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c'.repeat(40)

const record = (...fields: string[]): string => `${fields.join('\x1f')}\x1e\n`

describe('parseLog', () => {
  test('parses hash, parents, author, time, refs and subject', () => {
    const stdout = record(A, `${B} ${C}`, 'Ada', '1760000000', 'HEAD -> main, origin/main', 'feat: add | pipe')

    expect(parseLog(stdout, new Set(['origin/main']))).toEqual([
      {
        hash: A,
        parents: [B, C],
        author: 'Ada',
        timestamp: 1760000000,
        subject: 'feat: add | pipe',
        refs: [
          { name: 'main', kind: 'branch', isCurrent: true },
          { name: 'origin/main', kind: 'remote', isCurrent: false },
        ],
      },
    ])
  })

  test('a root commit has no parents', () => {
    const [commit] = parseLog(record(A, '', 'Ada', '1', '', 'init'), new Set())

    expect(commit?.parents).toEqual([])
  })

  test('keeps non-ASCII subjects intact', () => {
    const [commit] = parseLog(record(A, B, '悟空', '1', '', 'docs: 添加 PRD'), new Set())

    expect(commit?.author).toBe('悟空')
    expect(commit?.subject).toBe('docs: 添加 PRD')
  })

  test('parses several records in order', () => {
    const stdout = record(A, B, 'x', '2', '', 's1') + record(B, '', 'x', '1', '', 's2')

    expect(parseLog(stdout, new Set()).map(commit => commit.hash)).toEqual([A, B])
  })

  test('empty output gives no commits', () => {
    expect(parseLog('', new Set())).toEqual([])
    expect(parseLog('\n', new Set())).toEqual([])
  })
})
