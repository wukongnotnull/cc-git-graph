import { read } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { PAGE_SIZE } from './constants'
import { loadFirst, loadMore, openGraph, recordFailure, refresh, selectBranch, showNewer, showOlder, toggleCommit, toggleRemote, viewAtom } from './controller'
import { windowEnd } from './layout/window'
import { HASH, branchListing, forkHistoryLog, linearLog, serveGit } from './testing/fixtures'
import type { GitReply } from './testing/fixtures'

const NUMSTAT = '5\t3\tCLAUDE.md\n-\t-\timage.png\n'

const META = [HASH.m, `${HASH.a} ${HASH.b}`, 'Ada', 'ada@x.com', 'Bob', 'bob@x.com', '2026-10-11 16:34:41 +0800', 'Merge branch\n\nbody\n'].join('\x1f')

const forkRoute = (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse') return { stdout: 'true\n' }
  if (args[0] === 'for-each-ref') return { stdout: branchListing }
  if (args[0] === 'log') return { stdout: forkHistoryLog }
  if (args[0] === 'show' && args.includes('--numstat')) return { stdout: NUMSTAT }
  if (args[0] === 'show') return { stdout: META }

  return undefined
}

const skipOf = (args: readonly string[]): number => Number(args.find(arg => arg.startsWith('--skip='))?.slice(7) ?? '0')
const takeOf = (args: readonly string[]): number => Number(args[args.indexOf('-n') + 1])

describe('loadFirst', () => {
  test('loads branches, commits and lane rows', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    const view = await read(engine($), viewAtom)

    expect(view.status).toBe('ready')
    expect(view.commits.map(commit => commit.hash)).toEqual([HASH.m, HASH.a, HASH.b, HASH.r])
    expect(view.rows.map(row => row.lane)).toEqual([0, 0, 1, 0])
    expect(view.branches).toEqual(['main', 'feature/x', 'origin/main'])
    expect(view.remoteBranches).toEqual(['origin/main'])
    expect(view.hasMore).toBe(false)
  })

  test('reports a directory that is not a repository', async ($, on) => {
    const engine = serveGit(on, () => ({ exitCode: 128, stderr: 'fatal: not a git repository' }))
    await loadFirst(engine($))

    expect((await read(engine($), viewAtom)).status).toBe('no-repo')
  })

  test('treats an empty repository as an empty list, not an error', async ($, on) => {
    const engine = serveGit(on, args => {
      if (args[0] === 'rev-parse') return { stdout: 'true\n' }
      if (args[0] === 'for-each-ref') return { stdout: '' }

      return { exitCode: 128, stderr: "fatal: ambiguous argument 'HEAD': unknown revision" }
    })
    await loadFirst(engine($))
    const view = await read(engine($), viewAtom)

    expect(view.status).toBe('ready')
    expect(view.commits).toEqual([])
  })

  test('recordFailure records a thrown error, but drops one from a superseded load', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    const generation = (await read(engine($), viewAtom)).generation
    await recordFailure(engine($), new Error('stale'), generation - 1)

    expect((await read(engine($), viewAtom)).status).toBe('ready')

    await recordFailure(engine($), new Error('current'), generation)

    expect((await read(engine($), viewAtom)).errorMessage).toBe('current')
  })

  test('surfaces truncated output as an error', async ($, on) => {
    const engine = serveGit(on, args => (args[0] === 'log' ? { stdout: 'x', isStdoutTruncated: true } : forkRoute(args)))
    await loadFirst(engine($))
    const view = await read(engine($), viewAtom)

    expect(view.status).toBe('error')
    expect(view.errorMessage).toContain('too large')
  })

  test('only issues read-only git commands', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))

    for (const call of calls) {
      expect(['log', 'show', 'for-each-ref', 'rev-parse']).toContain(call[0])
    }
  })
})

describe('paging', () => {
  test('loads one page, then appends the rest without breaking lanes', async ($, on) => {
    const all = linearLog(PAGE_SIZE + 5)
    const engine = serveGit(on, args => {
      if (args[0] === 'rev-parse') return { stdout: 'true\n' }
      if (args[0] === 'for-each-ref') return { stdout: branchListing }
      if (args[0] === 'log') return { stdout: all.slice(skipOf(args), skipOf(args) + takeOf(args)).join('') }

      return undefined
    })
    await loadFirst(engine($))
    const first = await read(engine($), viewAtom)

    expect(first.commits).toHaveLength(PAGE_SIZE)
    expect(first.hasMore).toBe(true)

    await loadMore(engine($))
    const second = await read(engine($), viewAtom)

    expect(second.commits).toHaveLength(PAGE_SIZE + 5)
    expect(second.hasMore).toBe(false)
    expect(second.rows).toHaveLength(PAGE_SIZE + 5)
    expect(second.rows.every(row => row.lane === 0)).toBe(true)
  })

  test('loadMore does nothing when there is no next page', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))
    const before = calls.length
    await loadMore(engine($))

    expect(calls.length).toBe(before)
  })
})

describe('filters', () => {
  test('selecting a branch reloads with that branch only', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))
    await selectBranch(engine($), 'feature/x')
    const lastLog = [...calls].reverse().find(call => call[0] === 'log') ?? []

    expect((await read(engine($), viewAtom)).branch).toBe('feature/x')
    expect(lastLog).toContain('refs/heads/feature/x')
    expect(lastLog).not.toContain('--branches')
  })

  test('a remote branch is addressed by its full remote refname', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))
    await selectBranch(engine($), 'origin/main')
    const lastLog = [...calls].reverse().find(call => call[0] === 'log') ?? []

    expect(lastLog).toContain('refs/remotes/origin/main')
  })

  test('both show calls refuse external diff and textconv programs', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))
    await toggleCommit(engine($), HASH.m)
    const shows = calls.filter(call => call[0] === 'show')

    expect(shows.length).toBe(2)
    for (const call of shows) {
      expect(call).toContain('--no-ext-diff')
      expect(call).toContain('--no-textconv')
    }
  })

  test('a failed load is recorded in state, and reopening clears the old list at once', async ($, on) => {
    let isBroken = false
    const engine = serveGit(on, args => {
      if (isBroken && args[0] === 'rev-parse') throw new Error('boom')

      return forkRoute(args)
    })
    await loadFirst(engine($))
    isBroken = true
    await openGraph(engine($))
    const view = await read(engine($), viewAtom)

    expect(view.status).toBe('error')
    expect(view.errorMessage).toContain('boom')
    expect(view.commits).toEqual([])
  })

  test('a loadMore page with nothing new stops offering more', async ($, on) => {
    const records = linearLog(PAGE_SIZE + 1)
    const engine = serveGit(on, args => {
      if (args[0] !== 'log') return forkRoute(args)
      const skip = Number((args.find(arg => arg.startsWith('--skip=')) ?? '--skip=0').slice(7))

      return { stdout: (skip === 0 ? records : records.slice(0, 2)).join('') }
    })
    await loadFirst(engine($))
    await loadMore(engine($))

    expect((await read(engine($), viewAtom)).hasMore).toBe(false)
  })

  test('ignores a branch that is not in the list', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    await selectBranch(engine($), '--output=/tmp/x')

    expect((await read(engine($), viewAtom)).branch).toBe('*')
  })

  test('Show All asks for branches and tags, plus remotes only when shown', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))
    const withRemotes = calls.find(call => call[0] === 'log') ?? []

    expect(withRemotes).toContain('--remotes')

    await toggleRemote(engine($))
    const lastLog = [...calls].reverse().find(call => call[0] === 'log') ?? []

    expect(lastLog).not.toContain('--remotes')
    expect(lastLog).toContain('--branches')
  })

  test('hiding remotes while a remote branch is selected falls back to Show All', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    await selectBranch(engine($), 'origin/main')
    await toggleRemote(engine($))
    const view = await read(engine($), viewAtom)

    expect(view.isRemoteShown).toBe(false)
    expect(view.branch).toBe('*')
  })

  test('refresh keeps the current filters', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    await selectBranch(engine($), 'main')
    await refresh(engine($))

    expect((await read(engine($), viewAtom)).branch).toBe('main')
  })
})

describe('toggleCommit', () => {
  test('loads the detail for a commit and collapses on a second press', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    await toggleCommit(engine($), HASH.m)
    const open = await read(engine($), viewAtom)

    expect(open.expandedHash).toBe(HASH.m)
    expect(open.detail?.author).toBe('Ada')
    expect(open.detail?.message).toBe('Merge branch\n\nbody')
    expect(open.detail?.files).toEqual([
      { path: 'CLAUDE.md', added: 5, deleted: 3 },
      { path: 'image.png', added: null, deleted: null },
    ])

    await toggleCommit(engine($), HASH.m)

    expect((await read(engine($), viewAtom)).expandedHash).toBeNull()
  })

  test('refuses a value that is not a commit hash', async ($, on) => {
    const calls: string[][] = []
    const engine = serveGit(on, forkRoute, calls)
    await loadFirst(engine($))
    const before = calls.length
    await toggleCommit(engine($), '--output=x')

    expect(calls.length).toBe(before)
  })

  test('keeps the list when the detail cannot be read', async ($, on) => {
    const engine = serveGit(on, args => (args[0] === 'show' ? { exitCode: 1, stderr: 'fatal: bad object' } : forkRoute(args)))
    await loadFirst(engine($))
    await toggleCommit(engine($), HASH.m)
    const view = await read(engine($), viewAtom)

    expect(view.commits).toHaveLength(4)
    expect(view.detail).toBeNull()
    expect(view.detailError).toBe('fatal: bad object')
  })
})

const MICROTASK_TURNS = 50

// Lets every already-resolvable promise chain run, without timers.
async function settle(): Promise<void> {
  for (let turn = 0; turn < MICROTASK_TURNS; turn += 1) {
    await Promise.resolve()
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>(done => {
    resolve = done
  })

  return { promise, resolve }
}

const pagedRoute = (all: string[]) => (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse') return { stdout: 'true\n' }
  if (args[0] === 'for-each-ref') return { stdout: branchListing }
  if (args[0] === 'log') return { stdout: all.slice(skipOf(args), skipOf(args) + takeOf(args)).join('') }

  return undefined
}

describe('superseded results', () => {
  test('a stale loadFirst that succeeds late is discarded', async ($, on) => {
    const gate = deferred<GitReply>()
    let logCalls = 0
    const engine = serveGit(on, args => {
      if (args[0] === 'log' && (logCalls += 1) === 2) return gate.promise

      return forkRoute(args)
    })
    await loadFirst(engine($))
    const stale = refresh(engine($))
    await settle()
    await selectBranch(engine($), 'feature/x')
    gate.resolve({ stdout: linearLog(1).join('') })
    await stale
    const view = await read(engine($), viewAtom)

    expect(view.branch).toBe('feature/x')
    expect(view.commits.map(commit => commit.hash)).toEqual([HASH.m, HASH.a, HASH.b, HASH.r])
  })

  test('a stale loadFirst that fails late does not mark the newer state as an error', async ($, on) => {
    const gate = deferred<GitReply>()
    let logCalls = 0
    const engine = serveGit(on, args => {
      if (args[0] === 'log' && (logCalls += 1) === 2) return gate.promise

      return forkRoute(args)
    })
    await loadFirst(engine($))
    const stale = refresh(engine($))
    await settle()
    await refresh(engine($))
    gate.resolve({ exitCode: 1, stderr: 'fatal: boom' })
    await stale
    const view = await read(engine($), viewAtom)

    expect(view.status).toBe('ready')
    expect(view.errorMessage).toBe('')
  })

  test('selecting a branch shows loading, never an empty ready list', async ($, on) => {
    const gate = deferred<GitReply>()
    let logCalls = 0
    const engine = serveGit(on, args => {
      if (args[0] === 'log' && (logCalls += 1) === 2) return gate.promise

      return forkRoute(args)
    })
    await loadFirst(engine($))
    const pending = selectBranch(engine($), 'main')
    await settle()
    const during = await read(engine($), viewAtom)
    gate.resolve({ stdout: forkHistoryLog })
    await pending

    expect(during.status).toBe('loading')
    expect(during.commits).toEqual([])
  })

  for (const [name, action] of [
    ['refresh', refresh],
    ['toggleRemote', toggleRemote],
  ] as const) {
    test(`a slow loadMore finishing after ${name} is discarded`, async ($, on) => {
    const all = linearLog(PAGE_SIZE + 5)
    const gate = deferred<GitReply>()
    let logCalls = 0
    const route = pagedRoute(all)
    const engine = serveGit(on, args => {
      if (args[0] === 'log' && (logCalls += 1) === 2) return gate.promise

      return route(args)
    })
    await loadFirst(engine($))
    const slow = loadMore(engine($))
    await settle()
    await action(engine($))
    gate.resolve({ stdout: all.slice(PAGE_SIZE).join('') })
    await slow
    const view = await read(engine($), viewAtom)

    expect(view.commits).toHaveLength(PAGE_SIZE)
    expect(view.rows).toHaveLength(PAGE_SIZE)
    expect(view.laneState.lanes.filter(lane => lane !== null)).toHaveLength(1)
  })
  }

  test('a loadMore failure on a stale generation does not overwrite errorMessage', async ($, on) => {
    const all = linearLog(PAGE_SIZE + 5)
    const gate = deferred<GitReply>()
    let logCalls = 0
    const route = pagedRoute(all)
    const engine = serveGit(on, args => {
      if (args[0] === 'log' && (logCalls += 1) === 2) return gate.promise

      return route(args)
    })
    await loadFirst(engine($))
    const slow = loadMore(engine($))
    await settle()
    await refresh(engine($))
    gate.resolve({ exitCode: 1, stderr: 'fatal: late failure' })
    await slow

    expect((await read(engine($), viewAtom)).errorMessage).toBe('')
  })
})

describe('overlapping actions', () => {
  test('two concurrent loadMore calls append the next page once', async ($, on) => {
    const all = linearLog(PAGE_SIZE + 5)
    const engine = serveGit(on, pagedRoute(all))
    await loadFirst(engine($))
    await Promise.all([loadMore(engine($)), loadMore(engine($))])
    const view = await read(engine($), viewAtom)

    expect(view.commits).toHaveLength(PAGE_SIZE + 5)
    expect(view.rows).toHaveLength(PAGE_SIZE + 5)
    expect(view.rows.every(row => row.lane === 0)).toBe(true)
    expect(view.hasMore).toBe(false)
  })

  test('a held refresh finishing after selectBranch leaves no old-branch commits', async ($, on) => {
    const gate = deferred<GitReply>()
    let logCalls = 0
    const engine = serveGit(on, args => {
      if (args[0] === 'log' && (logCalls += 1) === 2) return gate.promise
      if (args[0] === 'log' && args.includes('refs/heads/feature/x')) return { stdout: linearLog(2).join('') }

      return forkRoute(args)
    })
    await loadFirst(engine($))
    const held = refresh(engine($))
    await settle()
    await selectBranch(engine($), 'feature/x')
    gate.resolve({ stdout: forkHistoryLog })
    await held
    const view = await read(engine($), viewAtom)

    expect(view.branch).toBe('feature/x')
    expect(view.commits).toHaveLength(2)
  })
})

describe('detail errors and serialization', () => {
  test('keeps the detail and reports a file-list failure', async ($, on) => {
    const engine = serveGit(on, args =>
      args[0] === 'show' && args.includes('--numstat') ? { exitCode: 1, stderr: 'fatal: no numstat' } : forkRoute(args),
    )
    await loadFirst(engine($))
    await toggleCommit(engine($), HASH.m)
    const view = await read(engine($), viewAtom)

    expect(view.detail?.author).toBe('Ada')
    expect(view.detail?.files).toEqual([])
    expect(view.detailError).toBe('Could not read the file list: fatal: no numstat')
  })

  test('the view state is JSON-serializable', async ($, on) => {
    const engine = serveGit(on, forkRoute)
    await loadFirst(engine($))
    await toggleCommit(engine($), HASH.m)
    const view = await read(engine($), viewAtom)

    expect(JSON.parse(JSON.stringify(view))).toEqual(view)
  })
})

describe('windows', () => {
  const longRoute = (all: readonly string[]) => (args: readonly string[]): GitReply | undefined => {
    if (args[0] === 'rev-parse') return { stdout: 'true\n' }
    if (args[0] === 'for-each-ref') return { stdout: branchListing }
    if (args[0] === 'log') return { stdout: all.slice(skipOf(args), skipOf(args) + takeOf(args)).join('') }

    return undefined
  }

  test('older grows the window, then moves it on once it is full, and newer comes back', async ($, on) => {
    const engine = serveGit(on, longRoute(linearLog(400)))
    await loadFirst(engine($))
    const starts: number[] = []

    for (let step = 0; step < 30; step += 1) {
      await showOlder(engine($))
      starts.push((await read(engine($), viewAtom)).windowStart)
    }

    const moved = await read(engine($), viewAtom)

    expect(moved.windowStart).toBeGreaterThan(0)
    expect(moved.windowStack.length).toBeGreaterThan(0)
    expect(moved.commits.length).toBe(400)
    expect(windowEnd(moved, moved.windowStart)).toBe(400)

    for (let step = 0; step < 10; step += 1) {
      await showNewer(engine($))
    }

    const back = await read(engine($), viewAtom)

    expect(back.windowStart).toBe(0)
    expect(back.windowStack).toEqual([])
    expect(starts[0]).toBe(0)
  })

  test('the window never grows past the budget however many pages are loaded', async ($, on) => {
    const engine = serveGit(on, longRoute(linearLog(400)))
    await loadFirst(engine($))

    for (let step = 0; step < 4; step += 1) {
      await showOlder(engine($))
    }

    const view = await read(engine($), viewAtom)
    const end = windowEnd(view, view.windowStart)

    expect(end - view.windowStart).toBeLessThan(view.commits.length)
    expect(end - view.windowStart).toBeLessThan(200)
  })

  test('refreshing or switching the branch starts again from the first window', async ($, on) => {
    const engine = serveGit(on, longRoute(linearLog(400)))
    await loadFirst(engine($))

    for (let step = 0; step < 6; step += 1) {
      await showOlder(engine($))
    }

    expect((await read(engine($), viewAtom)).windowStart).toBeGreaterThan(0)

    await refresh(engine($))
    const view = await read(engine($), viewAtom)

    expect(view.windowStart).toBe(0)
    expect(view.windowStack).toEqual([])
  })

  test('newer does nothing in the first window', async ($, on) => {
    const engine = serveGit(on, longRoute(linearLog(10)))
    await loadFirst(engine($))
    await showNewer(engine($))

    expect((await read(engine($), viewAtom)).windowStart).toBe(0)
  })
})
