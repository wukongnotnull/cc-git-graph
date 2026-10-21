import type { CommitDetail, FileChange } from '../../types'

const FIELD = '\x1f'
const META_FIELD_COUNT = 8

export const META_FORMAT = ['%H', '%P', '%an', '%ae', '%cn', '%ce', '%ai', '%B'].join('%x1f')

export function parseMeta(stdout: string): Omit<CommitDetail, 'files'> | null {
  const fields = stdout.split(FIELD)

  if (fields.length < META_FIELD_COUNT) {
    return null
  }

  const [hash, parents, author, authorEmail, committer, committerEmail, date] = fields

  if (
    hash === undefined ||
    parents === undefined ||
    author === undefined ||
    authorEmail === undefined ||
    committer === undefined ||
    committerEmail === undefined ||
    date === undefined
  ) {
    return null
  }

  return {
    hash,
    parents: parents.split(' ').filter(parent => parent !== ''),
    author,
    authorEmail,
    committer,
    committerEmail,
    date,
    message: fields.slice(META_FIELD_COUNT - 1).join(FIELD).trim(),
  }
}

export function parseNumstat(stdout: string): FileChange[] {
  const files: FileChange[] = []

  for (const line of stdout.split('\n')) {
    if (line.trim() === '') {
      continue
    }

    const [added, deleted, ...rest] = line.split('\t')
    const path = rest.join('\t')

    if (added === undefined || deleted === undefined || path === '') {
      continue
    }

    files.push({
      path,
      added: added === '-' ? null : Number(added),
      deleted: deleted === '-' ? null : Number(deleted),
    })
  }

  return files
}
