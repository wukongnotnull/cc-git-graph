export const DETACHED_LABEL = 'HEAD (detached)'

// The output of `git rev-parse --abbrev-ref HEAD`: the branch name, or the word HEAD when it points at a commit.
export function parseCurrentBranch(stdout: string): string {
  const name = stdout.trim()

  return name === 'HEAD' ? DETACHED_LABEL : name
}
