import type { EngineInterface } from 'claude-code'

const READ_ONLY = new Set(['log', 'show', 'for-each-ref', 'rev-parse'])
const HASH_PATTERN = /^[0-9a-f]{40,64}$/
const FIXED_OPTIONS = ['-c', 'core.quotepath=false']

export type GitResult =
  | { ok: true; stdout: string }
  | {
      ok: false
      kind: 'not-a-repo' | 'no-commits' | 'truncated' | 'unavailable' | 'failed'
      message: string
    }

export type GitFailure = Extract<GitResult, { ok: false }>

export function buildGitArgv(args: readonly string[]): string[] {
  const [sub] = args

  if (sub === undefined || !READ_ONLY.has(sub)) {
    throw new Error(`git ${sub ?? ''} is not an allowed read-only command`)
  }

  return ['git', ...FIXED_OPTIONS, ...args]
}

export function isCommitHash(value: string): boolean {
  return HASH_PATTERN.test(value)
}

export async function runGit($: EngineInterface, args: readonly string[]): Promise<GitResult> {
  const argv = buildGitArgv(args)

  let result: Awaited<ReturnType<EngineInterface['process']['run']>>

  try {
    result = await $.process.run(argv)
  } catch (error) {
    return { ok: false, kind: 'unavailable', message: error instanceof Error ? error.message : String(error) }
  }

  if (result.isStdoutTruncated) {
    return { ok: false, kind: 'truncated', message: 'Git output was too large to read in one page.' }
  }

  if (result.exitCode === 0) {
    return { ok: true, stdout: result.stdout }
  }

  if (/not a git repository/i.test(result.stderr)) {
    return { ok: false, kind: 'not-a-repo', message: 'Not a git repository.' }
  }

  if (/does not have any commits yet|ambiguous argument 'HEAD'|unknown revision.*\bHEAD\b/i.test(result.stderr)) {
    return { ok: false, kind: 'no-commits', message: 'The repository has no commits yet.' }
  }

  const firstLine = result.stderr.split('\n')[0]?.trim() ?? ''

  return { ok: false, kind: 'failed', message: firstLine === '' ? `git exited with ${result.exitCode}` : firstLine }
}
