import type { CommitDetail } from '../types'
import { PAGE_SIZE } from '../hooks/constants'
import type { FileDiffText } from '../hooks/git/parse-diff'
import type { Branches, GraphState, Page } from './protocol'
import { renderGraph } from './render'


export type GraphApi = <T>(path: string, query?: Record<string, string>) => Promise<T>
export function mountGraph(api: GraphApi, app: HTMLElement): () => void {
const state: GraphState = {
  branches: [], current: '', branch: '', remote: true, commits: [], hasMore: false,
  start: 0, detail: null, diff: null, busy: false, error: '',
}

let disposed = false
function render(): void { if (!disposed) app.innerHTML = renderGraph(state) }

async function run(action: () => Promise<void>): Promise<void> {
  if (disposed || state.busy) return
  state.busy = true
  state.error = ''
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.id : ''
  render()
  try { await action() }
  catch (error) { state.error = error instanceof Error ? error.message : 'Could not read the Git history.' }
  finally {
    state.busy = false
    render()
    if (!disposed && focused) document.getElementById(focused)?.focus()
  }
}

async function loadPage(offset: number): Promise<Page> {
  return api<Page>('/api/commits', { branch: state.branch, remote: String(state.remote), offset: String(offset) })
}

async function refresh(): Promise<void> {
  state.detail = null
  state.diff = null
  state.start = 0
  state.commits = []
  state.hasMore = false
  const branches = await api<Branches>('/api/branches')
  Object.assign(state, branches)
  if (!state.branches.some(branch => branch.ref === state.branch && (state.remote || !branch.remote))) state.branch = ''
  Object.assign(state, await loadPage(0))
}

const change = (event: Event): void => {
  const target = event.target
  if (target instanceof HTMLSelectElement && target.id === 'branch') {
    void run(async () => { state.branch = target.value; await refresh() })
  } else if (target instanceof HTMLInputElement && target.id === 'remote') {
    void run(async () => { state.remote = target.checked; await refresh() })
  }
}

const click = (event: Event): void => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-action]') : null
  if (!button || state.busy) return
  const { action, hash, path } = button.dataset
  void run(async () => {
    if (action === 'refresh') await refresh()
    else if (action === 'older') {
      if (state.start + PAGE_SIZE >= state.commits.length && state.hasMore) {
        const page = await loadPage(state.commits.length)
        const known = new Set(state.commits.map(commit => commit.hash))
        const fresh = page.commits.filter(commit => !known.has(commit.hash))
        state.commits.push(...fresh)
        state.hasMore = page.hasMore && fresh.length > 0
      }
      if (state.start + PAGE_SIZE < state.commits.length) state.start += PAGE_SIZE
      state.detail = null; state.diff = null
      window.scrollTo({ top: 0 })
    } else if (action === 'newer') {
      state.start = Math.max(0, state.start - PAGE_SIZE)
      state.detail = null; state.diff = null
      window.scrollTo({ top: 0 })
    } else if (action === 'commit' && hash) {
      const closing = state.detail?.hash === hash
      state.detail = null; state.diff = null
      if (!closing) state.detail = await api<CommitDetail>('/api/detail', { hash })
    } else if (action === 'file' && path && state.detail) {
      if (state.diff?.path === path) state.diff = null
      else state.diff = { ...await api<FileDiffText>('/api/diff', { hash: state.detail.hash, path }), path }
    } else if (action === 'close-detail') { state.detail = null; state.diff = null }
    else if (action === 'close-diff') state.diff = null
  })
}

app.addEventListener('change', change)
app.addEventListener('click', click)
void run(refresh)
return () => { disposed = true; app.removeEventListener('change', change); app.removeEventListener('click', click) }

}
