import type { EngineInterface } from 'claude-code'

import { GIT_TIMEOUT_MS } from '../constants'
import { describeError } from '../errors'
import { buildGitArgv } from './argv'
export { buildGitArgv, isCommitHash } from './argv'

// The failures below are told apart by git's messages, so git must not translate them.
const ENGLISH_MESSAGES = { LC_ALL: 'C' }

export type GitResult =
  | { ok: true; stdout: string }
  | {
      ok: false
      kind: 'not-a-repo' | 'no-commits' | 'truncated' | 'unavailable' | 'failed'
      message: string
    }

export type GitFailure = Extract<GitResult, { ok: false }>

// The engine rejects when git cannot start (most often it is not installed) or is still running at the timeout.
function describeUnavailable(reason: string): string {
  return /timed? ?out/i.test(reason)
    ? `git did not answer within ${GIT_TIMEOUT_MS / 1000} seconds.`
    : `Could not start git. Is it installed? (${reason})`
}

export async function runGit($: EngineInterface, args: readonly string[]): Promise<GitResult> {
  const argv = buildGitArgv(args)

  let result: Awaited<ReturnType<EngineInterface['process']['run']>>

  try {
    result = await $.process.run(argv, { env: ENGLISH_MESSAGES, timeoutMs: GIT_TIMEOUT_MS })
  } catch (error) {
    return { ok: false, kind: 'unavailable', message: describeUnavailable(describeError(error)) }
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
