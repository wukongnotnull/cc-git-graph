// A diff over this many characters is cut, because the engine draws a pane's tree only up to a size.
export const DIFF_MAX_CHARS = 30_000

export type FileDiffText = {
  // Unified-diff hunks only: git's `diff --git`, `index` and `---`/`+++` lines are dropped.
  text: string
  // True when later hunks were left out to stay inside the limit.
  isCut: boolean
  // True when even the first hunk is over the limit, so nothing is shown.
  isTooLarge: boolean
}

const HUNK_START = '\n@@ '

// The output of `git show --format= <hash> -- <path>`, reduced to what the diff view takes. A diff cut in the
// middle of a hunk does not parse, so a long one is cut at the start of a hunk.
export function parseFileDiff(stdout: string, max: number = DIFF_MAX_CHARS): FileDiffText {
  const first = stdout.startsWith('@@ ') ? 0 : stdout.indexOf(HUNK_START) + 1

  if (first === 0 && !stdout.startsWith('@@ ')) {
    return { text: '', isCut: false, isTooLarge: false }
  }

  const body = stdout.slice(first).trimEnd()

  if (body.length <= max) {
    return { text: `${body}\n`, isCut: false, isTooLarge: false }
  }

  const lastHunk = body.lastIndexOf(HUNK_START, max)

  if (lastHunk <= 0) {
    return { text: '', isCut: false, isTooLarge: true }
  }

  return { text: `${body.slice(0, lastHunk)}\n`, isCut: true, isTooLarge: false }
}
