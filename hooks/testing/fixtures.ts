import type { EngineInterface, On } from 'claude-code'

export type GitReply = {
  stdout?: string
  stderr?: string
  exitCode?: number
  isStdoutTruncated?: boolean
}

type Route = (args: readonly string[]) => GitReply | undefined

type ProcessRunResult = Awaited<ReturnType<EngineInterface['process']['run']>>

// git, -c, core.quotepath=false precede the sub-command in every argv.
const PREFIX_LENGTH = 3

// The test engine's `$` carries no `process` noun (`process.run` is an event a
// hook handles, not a call a test can raise), so the stand-in engine built by
// `asEngine` answers `$.process.run` from the route most recently set here.
let activeServe: ((argv: readonly string[]) => ProcessRunResult) | undefined

// Adapts a test's `$` to the interface production code holds. Only `process`
// is provided; every other noun passes through from the test engine.
export function asEngine(engine: unknown): EngineInterface {
  const process = {
    run: async (argv: readonly string[]): Promise<ProcessRunResult> => {
      if (activeServe === undefined) {
        throw new Error('serveGit was not called before $.process.run')
      }

      return activeServe(argv)
    },
  }

  return { ...(engine as object), process } as unknown as EngineInterface
}

// `on` is accepted for the test-body shape `serveGit(on, route)` but unused:
// the test engine cannot raise `process.run`, so `asEngine` answers it instead.
export function serveGit(_on: On, route: Route, calls: string[][] = []): void {
  activeServe = (argv) => {
    const args = argv.slice(PREFIX_LENGTH)
    calls.push([...args])
    const reply = route(args) ?? { exitCode: 1, stderr: `unexpected git ${args.join(' ')}` }

    return {
      exitCode: reply.exitCode ?? 0,
      stdout: reply.stdout ?? '',
      stderr: reply.stderr ?? '',
      isStdoutTruncated: reply.isStdoutTruncated ?? false,
      isStderrTruncated: false,
    }
  }
}
