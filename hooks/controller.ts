import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Commit, ViewState } from '../types'
import { visibleBranches } from './branches'
import { ALL_BRANCHES, PAGE_SIZE, PANE_ID } from './constants'
import { LOG_FORMAT, parseLog } from './git/parse-log'
import { parseBranches } from './git/parse-branches'
import { META_FORMAT, parseMeta, parseNumstat } from './git/parse-detail'
import { parseFileDiff } from './git/parse-diff'
import { isCommitHash, runGit } from './git/run-git'
import type { GitFailure } from './git/run-git'
import { describeError } from './errors'
import { emptyLaneState, layoutCommits } from './layout/lanes'
import { windowEnd } from './layout/window'
import { initialView } from './state'

// The hooks loader reads state references only when their plugin and key are string literals
// written in the same file as the read or update, so the atom is declared here, not imported.
export const viewAtom = atom({ plugin: 'cc-git-graph', key: 'view' } as const, initialView)

type Page = { commits: Commit[]; hasMore: boolean }
type PageResult = { ok: true; page: Page } | GitFailure
type BranchLists = { branches: string[]; remoteBranches: string[] }
type BranchResult = ({ ok: true } & BranchLists) | GitFailure

function buildRevs(view: ViewState): string[] | null {
  if (view.branch === ALL_BRANCHES) {
    return ['--branches', '--tags', ...(view.isRemoteShown ? ['--remotes'] : []), 'HEAD']
  }

  if (!visibleBranches(view).includes(view.branch)) {
    return null
  }

  // The full refname, so a branch named like a tag or a path cannot resolve to something else.
  return [view.remoteBranches.includes(view.branch) ? `refs/remotes/${view.branch}` : `refs/heads/${view.branch}`]
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

// A page may only extend the list it was fetched for; a sibling loadMore may have extended it already.
const isSamePage = (latest: ViewState, base: ViewState): boolean =>
  isCurrent(latest, base.generation) && latest.commits.length === base.commits.length

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

// Records a thrown error as the view's error. With a generation, a failure of a superseded load is dropped.
export async function recordFailure($: EngineInterface, error: unknown, generation?: number): Promise<void> {
  await update($, viewAtom, (latest): ViewState => {
    if (generation !== undefined && !isCurrent(latest, generation)) {
      return latest
    }

    return { ...latest, status: 'error', errorMessage: describeError(error) }
  })
}

export async function currentGeneration($: EngineInterface): Promise<number> {
  return (await read($, viewAtom)).generation
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

async function loadGeneration($: EngineInterface, current: ViewState, generation: number): Promise<void> {
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
      fileDiff: null,
      windowStart: 0,
      windowStack: [],
    }
  })
}

export async function loadFirst($: EngineInterface): Promise<void> {
  const current = await read($, viewAtom)
  const started = await update($, viewAtom, (view): ViewState => ({
    ...view,
    status: 'loading',
    errorMessage: '',
    generation: view.generation + 1,
  }))

  try {
    await loadGeneration($, current, started.generation)
  } catch (error) {
    await recordFailure($, error, started.generation)
  }
}

export async function loadMore($: EngineInterface): Promise<void> {
  const view = await read($, viewAtom)

  if (!view.hasMore || view.status !== 'ready') {
    return
  }

  const result = await fetchPage($, view, view.commits.length)

  if (!result.ok) {
    await update($, viewAtom, latest => (isSamePage(latest, view) ? { ...latest, errorMessage: result.message } : latest))

    return
  }

  const known = new Set(view.commits.map(commit => commit.hash))
  const fresh = result.page.commits.filter(commit => !known.has(commit.hash))
  const { rows, state } = layoutCommits(view.laneState, fresh)

  await update($, viewAtom, latest => {
    if (!isSamePage(latest, view)) {
      return latest
    }

    return {
      ...latest,
      errorMessage: '',
      commits: [...latest.commits, ...fresh],
      rows: [...latest.rows, ...rows],
      laneState: state,
      hasMore: fresh.length === 0 ? false : result.page.hasMore,
    }
  })
}

const clearedList = (view: ViewState): ViewState => ({
  ...view,
  status: 'loading',
  generation: view.generation + 1,
  commits: [],
  rows: [],
  laneState: emptyLaneState(),
  hasMore: false,
  expandedHash: null,
  detail: null,
  detailError: '',
  fileDiff: null,
  windowStart: 0,
  windowStack: [],
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

// Opening the board shows nothing from an earlier repository or session while it loads.
export async function openGraph($: EngineInterface): Promise<void> {
  await update($, viewAtom, latest => ({ ...clearedList(latest), errorMessage: '' }))
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
    await update($, viewAtom, latest => ({ ...latest, expandedHash: null, detail: null, detailError: '', fileDiff: null }))

    return
  }

  if (!isCommitHash(hash)) {
    return
  }

  await update($, viewAtom, latest => ({ ...latest, expandedHash: hash, detail: null, detailError: '', fileDiff: null }))

  const [meta, files] = await Promise.all([
    runGit($, ['show', '-s', '--no-ext-diff', '--no-textconv', `--format=${META_FORMAT}`, hash]),
    runGit($, ['show', '-m', '--first-parent', '--no-renames', '--numstat', '--no-ext-diff', '--no-textconv', '--format=', hash]),
  ])
  const parsed = meta.ok ? parseMeta(meta.stdout) : null
  const detail = parsed === null ? null : { ...parsed, files: files.ok ? parseNumstat(files.stdout) : [] }
  const detailError = describeDetailError(meta, parsed !== null, files)

  await update($, viewAtom, latest =>
    latest.expandedHash === hash && isCurrent(latest, generation) ? { ...latest, detail, detailError } : latest,
  )
}

// Scrolling to a row can fail (the pane was closed meanwhile); the window has moved either way.
async function scrollToRow($: EngineInterface, hash: string | undefined): Promise<void> {
  if (hash === undefined) {
    return
  }

  try {
    await $.ui.scroll({ in: PANE_ID, to: { key: `row-${hash}` } })
  } catch {
    // Nothing to do: the new window is drawn, only the scroll position is left where it was.
  }
}

// The button at the bottom of the list. While the window has room it grows by loading the next page; once the window
// is full it moves on to the older rows after it, loading them first if they are not here yet.
export async function showOlder($: EngineInterface): Promise<void> {
  const before = await read($, viewAtom)

  if (before.status !== 'ready') {
    return
  }

  if (windowEnd(before, before.windowStart) >= before.commits.length) {
    await loadMore($)

    const loaded = await read($, viewAtom)

    if (windowEnd(loaded, loaded.windowStart) > windowEnd(before, before.windowStart)) {
      return
    }
  }

  const latest = await read($, viewAtom)
  const end = windowEnd(latest, latest.windowStart)

  if (end >= latest.commits.length) {
    return
  }

  await update($, viewAtom, (view): ViewState =>
    view.generation === latest.generation && view.windowStart === latest.windowStart
      ? { ...view, windowStart: end, windowStack: [...view.windowStack, view.windowStart], expandedHash: null, detail: null, detailError: '', fileDiff: null }
      : view,
  )
  await fillWindow($)
  await scrollToRow($, latest.commits[end]?.hash)
}

const MAX_FILL_PAGES = 3

// A window that just moved on holds only the rows already loaded after it; load pages until it is full, so the next
// press does not have to finish the job.
async function fillWindow($: EngineInterface): Promise<void> {
  for (let page = 0; page < MAX_FILL_PAGES; page += 1) {
    const view = await read($, viewAtom)

    if (!view.hasMore || windowEnd(view, view.windowStart) < view.commits.length) {
      return
    }

    await loadMore($)
  }
}

// The button at the top of the list: back to the window that was left.
export async function showNewer($: EngineInterface): Promise<void> {
  const view = await read($, viewAtom)
  const previous = view.windowStack.at(-1)

  if (previous === undefined) {
    return
  }

  await update($, viewAtom, (latest): ViewState =>
    latest.generation === view.generation && latest.windowStart === view.windowStart
      ? { ...latest, windowStart: previous, windowStack: latest.windowStack.slice(0, -1), expandedHash: null, detail: null, detailError: '', fileDiff: null }
      : latest,
  )
  await scrollToRow($, view.commits[previous]?.hash)
}

const NO_DIFF = { text: '', isCut: false, isTooLarge: false }

// Opens the diff of one file of the open commit under the card, or closes it when it is already open. A rename is
// listed as a delete and an add (`--no-renames`), so every listed path is a plain pathspec.
export async function toggleFileDiff($: EngineInterface, path: string): Promise<void> {
  const view = await read($, viewAtom)
  const { detail, generation } = view

  if (detail === null || !isCommitHash(detail.hash)) {
    return
  }

  if (view.fileDiff?.path === path) {
    await update($, viewAtom, latest => ({ ...latest, fileDiff: null }))

    return
  }

  if (!detail.files.some(file => file.path === path)) {
    return
  }

  const loading = { path, ...NO_DIFF, error: '', isLoading: true }
  await update($, viewAtom, (latest): ViewState => ({ ...latest, fileDiff: loading }))

  const result = await runGit($, ['show', '-m', '--first-parent', '--no-renames', '--no-ext-diff', '--no-textconv', '--format=', '--unified=3', detail.hash, '--', path])
  const shown = { path, ...(result.ok ? parseFileDiff(result.stdout) : NO_DIFF), error: result.ok ? '' : result.message, isLoading: false }

  await update($, viewAtom, (latest): ViewState =>
    latest.detail?.hash === detail.hash && latest.fileDiff?.path === path && isCurrent(latest, generation)
      ? { ...latest, fileDiff: shown }
      : latest,
  )
}
