import type { EngineInterface, On } from 'claude-code'

export type GitReply = {
  stdout?: string
  stderr?: string
  exitCode?: number
  isStdoutTruncated?: boolean
}

type Route = (args: readonly string[]) => GitReply | undefined | Promise<GitReply | undefined>

type ProcessRunResult = Awaited<ReturnType<EngineInterface['process']['run']>>

export type GitEngine = (engine: unknown) => EngineInterface

// git, -c, core.quotepath=false precede the sub-command in every argv.
const PREFIX_LENGTH = 3

// Answers every `git` call from `route`. Calls made by a plugin's hooks reach
// the registered `process.run` hook; calls made straight from a test body go
// through the returned adapter, because a test's `$` has no `process` noun.
export function serveGit(on: On, route: Route, calls: string[][] = []): GitEngine {
  const respond = async (argv: readonly string[]): Promise<ProcessRunResult> => {
    const args = argv.slice(PREFIX_LENGTH)
    calls.push([...args])
    const reply = (await route(args)) ?? { exitCode: 1, stderr: `unexpected git ${args.join(' ')}` }

    return {
      exitCode: reply.exitCode ?? 0,
      stdout: reply.stdout ?? '',
      stderr: reply.stderr ?? '',
      isStdoutTruncated: reply.isStdoutTruncated ?? false,
      isStderrTruncated: false,
    }
  }

  on('process.run', async (_$, e) => ({ value: await respond(e.argv) }))

  const state = memoryState()

  return (engine) =>
    ({
      ...(engine as object),
      process: { run: (argv: readonly string[]) => respond(argv) },
      state,
    }) as unknown as EngineInterface
}

type StateRef = { plugin: string; key: string; id?: string }
type StoredValue = { value: unknown; version: number }

// A test's `$` has no `state` noun either; this keeps values and versions in memory.
function memoryState() {
  const stored = new Map<string, StoredValue>()
  const addressOf = (ref: StateRef): string => `${ref.plugin}/${ref.key}/${ref.id ?? ''}`

  return {
    get: async (ref: StateRef) => ({ ...(stored.get(addressOf(ref)) ?? { value: undefined, version: 0 }) }),
    set: async (ref: StateRef, value: unknown, options?: { ifVersion?: number }) => {
      const current = stored.get(addressOf(ref)) ?? { value: undefined, version: 0 }

      if (options?.ifVersion !== undefined && options.ifVersion !== current.version) {
        return { isSet: false as const, version: current.version }
      }

      stored.set(addressOf(ref), { value, version: current.version + 1 })

      return { isSet: true as const, version: current.version + 1 }
    },
  }
}

export const HASH = {
  m: 'a'.repeat(40),
  a: 'b'.repeat(40),
  b: 'c'.repeat(40),
  r: 'd'.repeat(40),
} as const

export function recordOf(
  hash: string,
  parents: readonly string[],
  author: string,
  timestamp: number,
  refs: string,
  subject: string,
): string {
  return `${[hash, parents.join(' '), author, String(timestamp), refs, subject].join('\x1f')}\x1e\n`
}

// M merges A and B, both children of R; the topological order is M, A, B, R.
export const forkHistoryLog =
  recordOf(HASH.m, [HASH.a, HASH.b], 'Ada', 1760000400, 'HEAD -> main, origin/main', 'Merge branch') +
  recordOf(HASH.a, [HASH.r], 'Ada', 1760000300, '', 'feat: a') +
  recordOf(HASH.b, [HASH.r], 'Bob', 1760000200, 'feature/x', 'feat: b') +
  recordOf(HASH.r, [], 'Ada', 1760000100, '', 'chore: root')

export const branchListing = 'refs/heads/main\nrefs/heads/feature/x\nrefs/remotes/origin/main\nrefs/remotes/origin/HEAD\n'

const hashOf = (index: number): string => index.toString(16).padStart(40, '0')

// Newest first; commit i has commit i+1 as its only parent.
export function linearLog(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    recordOf(
      hashOf(index + 1),
      index + 1 < count ? [hashOf(index + 2)] : [],
      'Ada',
      1760000000 - index,
      '',
      `commit ${index}`,
    ),
  )
}
