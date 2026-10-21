import type { Commit } from '../../types'
import { parseRefs } from './parse-refs'

const FIELD = '\x1f'
const RECORD = '\x1e'

export const LOG_FORMAT = ['%H', '%P', '%an', '%at', '%D', '%s'].join('%x1f') + '%x1e'

export function parseLog(stdout: string, remoteNames: ReadonlySet<string>): Commit[] {
  const commits: Commit[] = []

  for (const record of stdout.split(RECORD)) {
    const body = record.replace(/^\n+/, '')

    if (body.trim() === '') {
      continue
    }

    const [hash, parents, author, timestamp, refs, subject] = body.split(FIELD)

    if (
      hash === undefined ||
      parents === undefined ||
      author === undefined ||
      timestamp === undefined ||
      refs === undefined ||
      subject === undefined
    ) {
      continue
    }

    commits.push({
      hash,
      parents: parents.split(' ').filter(parent => parent !== ''),
      author,
      timestamp: Number(timestamp),
      subject,
      refs: parseRefs(refs, remoteNames),
    })
  }

  return commits
}
