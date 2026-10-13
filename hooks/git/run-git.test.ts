import { describe, expect, test } from 'claude-code/testing'

import type { EngineInterface } from 'claude-code'

import { GIT_TIMEOUT_MS } from '../constants'
import { serveGit } from '../testing/fixtures'
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
    const engine = serveGit(on, () => ({ stdout: 'ok\n' }))

    expect(await runGit(engine($), ['log'])).toEqual({ ok: true, stdout: 'ok\n' })
  })

  test('reports a missing repository', async ($, on) => {
    const engine = serveGit(on, () => ({ exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git' }))
    const result = await runGit(engine($), ['rev-parse', '--is-inside-work-tree'])

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.kind).toBe('not-a-repo')
  })

  test('reports a missing commit as a failure, not as an empty repository', async ($, on) => {
    const engine = serveGit(on, () => ({ exitCode: 128, stderr: "fatal: bad object / unknown revision or path not in the working tree." }))
    const result = await runGit(engine($), ['show', 'f'.repeat(40)])

    expect(result.ok === false && result.kind).toBe('failed')
  })

  test('reports an empty repository as no commits', async ($, on) => {
    const engine = serveGit(on, () => ({ exitCode: 128, stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree." }))
    const result = await runGit(engine($), ['log'])

    expect(result.ok === false && result.kind).toBe('no-commits')
  })

  test('reports truncated output instead of returning partial data', async ($, on) => {
    const engine = serveGit(on, () => ({ stdout: 'partial', isStdoutTruncated: true }))
    const result = await runGit(engine($), ['log'])

    expect(result.ok === false && result.kind).toBe('truncated')
  })

  test('reports the first stderr line for other failures', async ($, on) => {
    const engine = serveGit(on, () => ({ exitCode: 1, stderr: 'fatal: bad object\nmore detail' }))
    const result = await runGit(engine($), ['show', 'x'])

    expect(result).toEqual({ ok: false, kind: 'failed', message: 'fatal: bad object' })
  })

  test('hands the sub-command and arguments to the route without the fixed prefix', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, () => ({ stdout: '' }), calls)
    await runGit(engine($), ['log', '--topo-order'])

    expect(calls).toEqual([['log', '--topo-order']])
  })

  test('reports unavailable when the process cannot run', async () => {
    const broken = { process: { run: async () => { throw new Error('spawn failed') } } } as unknown as EngineInterface
    const result = await runGit(broken, ['log'])

    expect(result).toEqual({ ok: false, kind: 'unavailable', message: 'spawn failed' })
  })

  test('bounds every git call with a timeout', async () => {
    const inits: unknown[] = []
    const engine = {
      process: {
        run: async (_argv: readonly string[], init?: unknown) => {
          inits.push(init)

          return { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
        },
      },
    } as unknown as EngineInterface
    await runGit(engine, ['log'])

    expect(inits).toEqual([{ timeoutMs: GIT_TIMEOUT_MS }])
  })

  test('reports a call that timed out as unavailable instead of waiting forever', async () => {
    const hung = { process: { run: async () => { throw new Error('timed out after 10000 ms') } } } as unknown as EngineInterface
    const result = await runGit(hung, ['log'])

    expect(result).toEqual({ ok: false, kind: 'unavailable', message: 'timed out after 10000 ms' })
  })

  test('throws for a non-allowed sub-command without calling the route', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, () => ({ stdout: '' }), calls)
    let thrown = false

    try {
      await runGit(engine($), ['commit', '-m', 'x'])
    } catch {
      thrown = true
    }

    expect(thrown).toBe(true)
    expect(calls).toEqual([])
  })
})
