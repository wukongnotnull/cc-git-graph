import type { EngineInterface, On } from 'claude-code'

export type GitReply = {
  stdout?: string
  stderr?: string
  exitCode?: number
  isStdoutTruncated?: boolean
}

type Route = (args: readonly string[]) => GitReply | undefined

type ProcessRunResult = Awaited<ReturnType<EngineInterface['process']['run']>>

export type GitEngine = (engine: unknown) => EngineInterface

// git, -c, core.quotepath=false precede the sub-command in every argv.
const PREFIX_LENGTH = 3

// Answers every `git` call from `route`. Calls made by a plugin's hooks reach
// the registered `process.run` hook; calls made straight from a test body go
// through the returned adapter, because a test's `$` has no `process` noun.
export function serveGit(on: On, route: Route, calls: string[][] = []): GitEngine {
  const respond = (argv: readonly string[]): ProcessRunResult => {
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

  on('process.run', async (_$, e) => ({ value: respond(e.argv) }))

  return (engine) =>
    ({
      ...(engine as object),
      process: { run: async (argv: readonly string[]) => respond(argv) },
    }) as unknown as EngineInterface
}
