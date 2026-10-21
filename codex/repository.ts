import { execFile } from 'node:child_process'
import { GIT_TIMEOUT_MS, PAGE_SIZE } from '../claude/hooks/constants'
import { buildGitArgv, isCommitHash } from '../claude/hooks/git/argv'
import { LOG_FORMAT, parseLog } from '../claude/hooks/git/parse-log'
import { parseBranches } from '../claude/hooks/git/parse-branches'
import { META_FORMAT, parseMeta } from '../claude/hooks/git/parse-detail'
import { parseFileDiff } from '../claude/hooks/git/parse-diff'
import { visibleRefs } from '../claude/hooks/ui/chips'
import type { CommitDetail, FileChange } from '../claude/types'
import type { Branches, Page } from './protocol'

export class RequestError extends Error {
  constructor(message: string, public readonly status = 400) { super(message) }
}

// No shell, caller-selected commands or repository switching. Paths are literal even when they contain glob syntax.
export function readGit(directory: string, args: readonly string[]): Promise<string> {
  const argv = buildGitArgv(args)
  return new Promise((resolve, reject) => {
    execFile(argv[0]!, ['--literal-pathspecs', ...argv.slice(1)], {
      cwd: directory, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, killSignal: 'SIGKILL',
      maxBuffer: 8 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' },
    }, (error, stdout, stderr) => {
      if (!error) { resolve(stdout); return }
      const message = error.killed ? 'git did not answer within 10 seconds.'
        : error.code === 'ENOENT' ? 'Could not start git. Is it installed?'
          : error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'Git output was too large to read.'
            : stderr.trim().split('\n')[0] || error.message
      reject(new RequestError(message, 422))
    })
  })
}

export async function readBranches(directory: string): Promise<Branches> {
  await readGit(directory, ['rev-parse', '--is-inside-work-tree'])
  const listed = await readGit(directory, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'])
  const { locals, remotes } = parseBranches(listed)
  let current = ''
  try { current = (await readGit(directory, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim() }
  catch (error) {
    if (!(error instanceof Error) || !/unknown revision|ambiguous argument 'HEAD'/.test(error.message)) throw error
  }
  return {
    current: current === 'HEAD' ? 'HEAD (detached)' : current,
    branches: [
      ...locals.map(name => ({ ref: `refs/heads/${name}`, name, remote: false })),
      ...remotes.filter(name => !name.endsWith('/HEAD')).map(name => ({ ref: `refs/remotes/${name}`, name, remote: true })),
    ],
  }
}

export async function readPage(directory: string, query: URLSearchParams): Promise<Page> {
  const offset = query.get('offset') ?? '0'
  if (!/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) throw new RequestError('Invalid page offset.')
  const remote = query.get('remote') !== 'false'
  const branch = query.get('branch') ?? ''
  const { branches } = await readBranches(directory)
  if (branch && !branches.some(item => item.ref === branch && (remote || !item.remote))) {
    throw new RequestError('That branch no longer exists or is hidden.')
  }
  const revs = branch ? [branch] : ['--branches', '--tags', ...(remote ? ['--remotes'] : [])]
  if (!branch) {
    try { revs.push((await readGit(directory, ['rev-parse', '--verify', 'HEAD'])).trim()) }
    catch (error) {
      if (!(error instanceof Error) || !/Needed a single revision|unknown revision|ambiguous argument/.test(error.message)) throw error
    }
  }
  // Git messages may contain the old field/record separators. NUL framing prevents them from creating rows.
  const text = await readGit(directory, [
    'log', '-z', '--topo-order', '--decorate=short', `--skip=${offset}`, '-n', String(PAGE_SIZE + 1),
    `--format=${LOG_FORMAT.replaceAll('%x1f', '%x00').replace('%x1e', '')}`, ...revs, '--',
  ])
  const fields = text === '' ? [] : text.split('\0').slice(0, -1)
  if (fields.length % 6 !== 0) throw new RequestError('Could not parse the Git history.', 422)
  const records: string[] = []
  for (let index = 0; index < fields.length; index += 6) {
    // Reuse the shared parser after neutralizing its separators inside each already-framed field.
    records.push(fields.slice(index, index + 6).map(field => field.replace(/[\x1e\x1f]/g, '�')).join('\x1f') + '\x1e')
  }
  const commits = parseLog(records.join(''), new Set(branches.filter(item => item.remote).map(item => item.name)))
  if (commits.some(commit => !isCommitHash(commit.hash) || !commit.parents.every(isCommitHash) || !Number.isFinite(commit.timestamp))) {
    throw new RequestError('Could not parse the Git history.', 422)
  }
  return {
    commits: commits.slice(0, PAGE_SIZE).map(commit => ({ ...commit, refs: visibleRefs(commit.refs, remote) })),
    hasMore: commits.length > PAGE_SIZE,
  }
}

function requireHash(hash: string): void {
  if (!isCommitHash(hash)) throw new RequestError('Invalid commit hash.')
}

// NUL records preserve filenames containing tabs, newlines and quotes without Git's display quoting.
function parseFiles(text: string): FileChange[] {
  return text.split('\0').filter(Boolean).map(record => {
    const first = record.indexOf('\t')
    const second = record.indexOf('\t', first + 1)
    if (first < 0 || second < 0) throw new RequestError('Could not read the file list.', 422)
    const added = record.slice(0, first)
    const deleted = record.slice(first + 1, second)
    return { path: record.slice(second + 1), added: added === '-' ? null : Number(added), deleted: deleted === '-' ? null : Number(deleted) }
  })
}

export async function readDetail(directory: string, hash: string): Promise<CommitDetail> {
  requireHash(hash)
  const [meta, files] = await Promise.all([
    readGit(directory, ['show', '-s', '--no-ext-diff', '--no-textconv', `--format=${META_FORMAT}`, hash]),
    readGit(directory, ['show', '-m', '--first-parent', '--no-renames', '--numstat', '-z', '--no-ext-diff', '--no-textconv', '--format=', hash]),
  ])
  const detail = parseMeta(meta)
  if (!detail) throw new RequestError('Could not read the commit details.', 422)
  return { ...detail, files: parseFiles(files) }
}

export async function readDiff(directory: string, hash: string, path: string) {
  const detail = await readDetail(directory, hash)
  if (!detail.files.some(file => file.path === path)) throw new RequestError('That file is not part of this commit.')
  // Numstat paths are repository-relative even when the service starts in a subdirectory.
  const root = (await readGit(directory, ['rev-parse', '--show-toplevel'])).replace(/\n$/, '')
  return parseFileDiff(await readGit(root, [
    'show', '-m', '--first-parent', '--no-renames', '--no-ext-diff', '--no-textconv', '--format=', '--unified=3', hash, '--', path,
  ]))
}
