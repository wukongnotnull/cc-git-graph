const READ_ONLY = new Set(['log', 'show', 'for-each-ref', 'rev-parse'])
const HASH_PATTERN = /^[0-9a-f]{40,64}$/
const FIXED_OPTIONS = ['-c', 'core.quotepath=false']

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
