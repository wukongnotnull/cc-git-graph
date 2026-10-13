import { describe, expect, test } from 'claude-code/testing'

import { asEngine, serveGit } from '../testing/fixtures'
import { buildGitArgv, isCommitHash, runGit } from './run-git'

const throws = (fn: () => unknown): boolean => {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

describe('buildGitArgv', () => {
  test('rejects every command that can change the repository', () => {
    const writes = ['commit', 'checkout', 'switch', 'push', 'pull', 'fetch', 'reset', 'merge', 'rebase', 'branch', 'tag', 'config', 'add', 'rm', 'clean', 'stash']

    for (const sub of writes) {
      expect(throws(() => buildGitArgv([sub]))).toBe(true)
    }
  })

  test('rejects an empty argument list', () => {
    expect(throws(() => buildGitArgv([]))).toBe(true)
  })

  test('accepts the read-only commands and prefixes the fixed options', () => {
    for (const sub of ['log', 'show', 'for-each-ref', 'rev-parse']) {
      expect(buildGitArgv([sub, 'x'])).toEqual(['git', '-c', 'core.quotepath=false', sub, 'x'])
    }
  })
})

describe('isCommitHash', () => {
  test('accepts 40 and 64 hex characters and rejects everything else', () => {
    expect(isCommitHash('a'.repeat(40))).toBe(true)
    expect(isCommitHash('a'.repeat(64))).toBe(true)
    expect(isCommitHash('a'.repeat(39))).toBe(false)
    expect(isCommitHash('A'.repeat(40))).toBe(false)
    expect(isCommitHash('--output=x')).toBe(false)
  })
})

describe('runGit', () => {
  test('returns stdout on success', async ($, on) => {
    serveGit(on, () => ({ stdout: 'ok\n' }))

    expect(await runGit(asEngine($), ['log'])).toEqual({ ok: true, stdout: 'ok\n' })
  })

  test('reports a missing repository', async ($, on) => {
    serveGit(on, () => ({ exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git' }))
    const result = await runGit(asEngine($), ['rev-parse', '--is-inside-work-tree'])

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.kind).toBe('not-a-repo')
  })

  test('reports an empty repository as no commits', async ($, on) => {
    serveGit(on, () => ({ exitCode: 128, stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree." }))
    const result = await runGit(asEngine($), ['log'])

    expect(result.ok === false && result.kind).toBe('no-commits')
  })

  test('reports truncated output instead of returning partial data', async ($, on) => {
    serveGit(on, () => ({ stdout: 'partial', isStdoutTruncated: true }))
    const result = await runGit(asEngine($), ['log'])

    expect(result.ok === false && result.kind).toBe('truncated')
  })

  test('reports the first stderr line for other failures', async ($, on) => {
    serveGit(on, () => ({ exitCode: 1, stderr: 'fatal: bad object\nmore detail' }))
    const result = await runGit(asEngine($), ['show', 'x'])

    expect(result).toEqual({ ok: false, kind: 'failed', message: 'fatal: bad object' })
  })

  test('hands the sub-command and arguments to the route without the fixed prefix', async ($, on) => {
    const calls: string[][] = []
    serveGit(on, () => ({ stdout: '' }), calls)
    await runGit(asEngine($), ['log', '--topo-order'])

    expect(calls).toEqual([['log', '--topo-order']])
  })
})
