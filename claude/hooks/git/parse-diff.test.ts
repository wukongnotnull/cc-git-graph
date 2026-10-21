import { describe, expect, test } from 'claude-code/testing'

import { parseFileDiff } from './parse-diff'

const HEADER = 'diff --git a/x.ts b/x.ts\nindex 111..222 100644\n--- a/x.ts\n+++ b/x.ts\n'
const HUNK_A = '@@ -1,2 +1,2 @@\n-old\n+new\n same\n'
const HUNK_B = '@@ -10,1 +10,2 @@\n keep\n+added\n'

describe('parseFileDiff', () => {
  test('drops git\'s header lines and keeps the hunks', () => {
    expect(parseFileDiff(HEADER + HUNK_A + HUNK_B)).toEqual({ text: HUNK_A + HUNK_B, isCut: false, isTooLarge: false })
  })

  test('a diff that starts at a hunk is kept whole', () => {
    expect(parseFileDiff(HUNK_A).text).toBe(HUNK_A)
  })

  test('a binary file or a mode change has no hunks and no text', () => {
    expect(parseFileDiff('diff --git a/a.png b/a.png\nBinary files a/a.png and b/a.png differ\n')).toEqual({ text: '', isCut: false, isTooLarge: false })
    expect(parseFileDiff('')).toEqual({ text: '', isCut: false, isTooLarge: false })
  })

  test('a long diff is cut at the start of a hunk, never inside one', () => {
    const result = parseFileDiff(HEADER + HUNK_A + HUNK_B, HUNK_A.length + 5)

    expect(result).toEqual({ text: HUNK_A, isCut: true, isTooLarge: false })
  })

  test('when even the first hunk is over the limit nothing is shown', () => {
    expect(parseFileDiff(HEADER + HUNK_A, 10)).toEqual({ text: '', isCut: false, isTooLarge: true })
  })
})
