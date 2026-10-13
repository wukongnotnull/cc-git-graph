import { read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Commit, ViewState } from '../types'
import { visibleBranches } from './branches'
import { ALL_BRANCHES, PAGE_SIZE } from './constants'
import { LOG_FORMAT, parseLog } from './git/parse-log'
import { parseBranches } from './git/parse-branches'
import { META_FORMAT, parseMeta, parseNumstat } from './git/parse-detail'
import { isCommitHash, runGit } from './git/run-git'
import type { GitFailure } from './git/run-git'
import { emptyLaneState, layoutCommits } from './layout/lanes'
import { viewAtom } from './state'

type Page = { commits: Commit[]; hasMore: boolean }
type PageResult = { ok: true; page: Page } | GitFailure
type BranchLists = { branches: string[]; remoteBranches: string[] }
type BranchResult = ({ ok: true } & BranchLists) | GitFailure

function buildRevs(view: ViewState): string[] | null {
  if (view.branch === ALL_BRANCHES) {
    return ['--branches', '--tags', ...(view.isRemoteShown ? ['--remotes'] : []), 'HEAD']
  }

  return visibleBranches(view).includes(view.branch) ? [view.branch] : null
}

async function fetchPage($: EngineInterface, view: ViewState, offset: number): Promise<PageResult> {
  const revs = buildRevs(view)

  if (revs === null) {
    return { ok: false, kind: 'failed', message: 'That branch no longer exists.' }
  }

  const result = await runGit($, [
    'log',
    '--topo-order',
    `--skip=${offset}`,
    '-n',
    String(PAGE_SIZE + 1),
    `--format=${LOG_FORMAT}`,
    ...revs,
    '--',
  ])

  if (!result.ok) {
    return result.kind === 'no-commits' ? { ok: true, page: { commits: [], hasMore: false } } : result
  }

  const parsed = parseLog(result.stdout, new Set(view.remoteBranches))

  return { ok: true, page: { commits: parsed.slice(0, PAGE_SIZE), hasMore: parsed.length > PAGE_SIZE } }
}

const isCurrent = (view: ViewState, generation: number): boolean => view.generation === generation

async function fail($: EngineInterface, failure: GitFailure, generation: number): Promise<void> {
  await update($, viewAtom, (latest): ViewState => {
    if (!isCurrent(latest, generation)) {
      return latest
    }

    return {
      ...latest,
      status: failure.kind === 'not-a-repo' ? 'no-repo' : 'error',
      errorMessage: failure.message,
    }
  })
}

async function fetchBranches($: EngineInterface): Promise<BranchResult> {
  const inside = await runGit($, ['rev-parse', '--is-inside-work-tree'])

  if (!inside.ok) {
    return inside
  }

  const listed = await runGit($, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'])

  if (!listed.ok) {
    return listed
  }

  const { locals, remotes } = parseBranches(listed.stdout)
  const remoteBranches = remotes.filter(name => !name.endsWith('/HEAD'))

  return { ok: true, branches: [...locals, ...remoteBranches], remoteBranches }
}

export async function loadFirst($: EngineInterface): Promise<void> {
  const current = await read($, viewAtom)
  const started = await update($, viewAtom, (view): ViewState => ({
    ...view,
    status: 'loading',
    errorMessage: '',
    generation: view.generation + 1,
  }))
  const generation = started.generation

  const lists = await fetchBranches($)

  if (!lists.ok) {
    return fail($, lists, generation)
  }

  const { branches, remoteBranches } = lists
  const probe: ViewState = { ...current, branches, remoteBranches }
  const branch =
    current.branch === ALL_BRANCHES || visibleBranches(probe).includes(current.branch) ? current.branch : ALL_BRANCHES

  const result = await fetchPage($, { ...probe, branch }, 0)

  if (!result.ok) {
    return fail($, result, generation)
  }

  const { rows, state } = layoutCommits(emptyLaneState(), result.page.commits)

  await update($, viewAtom, (latest): ViewState => {
    if (!isCurrent(latest, generation)) {
      return latest
    }

    return {
      ...latest,
      status: 'ready',
      errorMessage: '',
      branches,
      remoteBranches,
      branch,
      commits: result.page.commits,
      rows,
      laneState: state,
      hasMore: result.page.hasMore,
      expandedHash: null,
      detail: null,
      detailError: '',
    }
  })
}

export async function loadMore($: EngineInterface): Promise<void> {
  const view = await read($, viewAtom)

  if (!view.hasMore || view.status !== 'ready') {
    return
  }

  const result = await fetchPage($, view, view.commits.length)

  if (!result.ok) {
    await update($, viewAtom, latest => (isCurrent(latest, view.generation) ? { ...latest, errorMessage: result.message } : latest))

    return
  }

  const known = new Set(view.commits.map(commit => commit.hash))
  const fresh = result.page.commits.filter(commit => !known.has(commit.hash))
  const { rows, state } = layoutCommits(view.laneState, fresh)

  await update($, viewAtom, latest => {
    if (!isCurrent(latest, view.generation)) {
      return latest
    }

    return {
      ...latest,
      errorMessage: '',
      commits: [...latest.commits, ...fresh],
      rows: [...latest.rows, ...rows],
      laneState: state,
      hasMore: result.page.hasMore,
    }
  })
}

const clearedList = (view: ViewState): ViewState => ({
  ...view,
  status: 'loading',
  commits: [],
  rows: [],
  laneState: emptyLaneState(),
  hasMore: false,
  expandedHash: null,
  detail: null,
  detailError: '',
})

export async function selectBranch($: EngineInterface, value: string): Promise<void> {
  const view = await read($, viewAtom)

  if (value !== ALL_BRANCHES && !visibleBranches(view).includes(value)) {
    return
  }

  await update($, viewAtom, latest => ({ ...clearedList(latest), branch: value }))
  await loadFirst($)
}

export async function toggleRemote($: EngineInterface): Promise<void> {
  const view = await read($, viewAtom)
  const isRemoteShown = !view.isRemoteShown
  const isSelectionHidden = !isRemoteShown && view.remoteBranches.includes(view.branch)

  await update($, viewAtom, latest => ({
    ...clearedList(latest),
    isRemoteShown,
    branch: isSelectionHidden ? ALL_BRANCHES : latest.branch,
  }))
  await loadFirst($)
}

export async function refresh($: EngineInterface): Promise<void> {
  await loadFirst($)
}

type GitOutcome = { ok: true } | GitFailure

function describeDetailError(meta: GitOutcome, isParsed: boolean, files: GitOutcome): string {
  if (!meta.ok) {
    return meta.message
  }

  if (!isParsed) {
    return 'Could not read the commit details.'
  }

  return files.ok ? '' : `Could not read the file list: ${files.message}`
}

export async function toggleCommit($: EngineInterface, hash: string): Promise<void> {
  const view = await read($, viewAtom)
  const { generation } = view

  if (view.expandedHash === hash) {
    await update($, viewAtom, latest => ({ ...latest, expandedHash: null, detail: null, detailError: '' }))

    return
  }

  if (!isCommitHash(hash)) {
    return
  }

  await update($, viewAtom, latest => ({ ...latest, expandedHash: hash, detail: null, detailError: '' }))

  const meta = await runGit($, ['show', '-s', `--format=${META_FORMAT}`, hash])
  const files = await runGit($, ['show', '-m', '--first-parent', '--numstat', '--format=', hash])
  const parsed = meta.ok ? parseMeta(meta.stdout) : null
  const detail = parsed === null ? null : { ...parsed, files: files.ok ? parseNumstat(files.stdout) : [] }
  const detailError = describeDetailError(meta, parsed !== null, files)

  await update($, viewAtom, latest =>
    latest.expandedHash === hash && isCurrent(latest, generation) ? { ...latest, detail, detailError } : latest,
  )
}
