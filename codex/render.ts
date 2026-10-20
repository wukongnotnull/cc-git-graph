import { columnCount, emptyLaneState, layoutCommits } from '../hooks/layout/lanes'
import { rowSvg } from '../hooks/layout/row-svg'
import { chipTitle, chipsOf } from '../hooks/ui/chips'
import { formatDate, shortHash } from '../hooks/format'
import { MAX_DETAIL_FILES, MAX_MESSAGE_CHARS, PAGE_SIZE } from '../hooks/constants'
import type { GraphState } from './protocol'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const e = escapeHtml

function detailHtml(state: GraphState): string {
  const detail = state.detail
  if (!detail) return ''
  const field = (label: string, value: string) => `<dt>${label}</dt><dd>${e(value)}</dd>`
  const refs = state.commits.find(commit => commit.hash === detail.hash)?.refs.map(ref => ref.name).join(', ') ?? ''
  const diff = state.diff
  return `<section class="detail" aria-label="Commit details">
    <header><strong>Commit details</strong><button data-action="close-detail">Close details</button></header>
    <dl>${field('Commit', detail.hash)}${field('Parents', detail.parents.join(', ') || 'Root commit')}${field('Refs', refs || '—')}
    ${field('Author', `${detail.author} <${detail.authorEmail}>`)}${field('Committer', `${detail.committer} <${detail.committerEmail}>`)}${field('Date', detail.date)}</dl>
    <pre class="message">${e(detail.message.slice(0, MAX_MESSAGE_CHARS))}${detail.message.length > MAX_MESSAGE_CHARS ? '\n… Message truncated' : ''}</pre>
    <h2>Changed files <span>${detail.files.length}</span></h2><div class="files">${detail.files.slice(0, MAX_DETAIL_FILES).map(file =>
      `<button class="file" data-action="file" data-path="${e(file.path)}" aria-expanded="${diff?.path === file.path}"><span>${e(file.path)}</span><span class="stats">${file.added === null ? 'Binary' : `+${file.added} −${file.deleted}`}</span></button>`).join('')}</div>
    ${detail.files.length > MAX_DETAIL_FILES ? `<p>… and ${detail.files.length - MAX_DETAIL_FILES} more files</p>` : ''}
    ${diff ? `<section class="diff" aria-label="File diff"><header><strong>${e(diff.path)}</strong><button data-action="close-diff">Close diff</button></header>
      ${diff.isTooLarge ? '<p>This diff is too large to display.</p>' : diff.text ? `<pre>${diff.text.split('\n').map(line => `<span class="${line.startsWith('+') ? 'added' : line.startsWith('-') ? 'deleted' : line.startsWith('@@') ? 'hunk' : ''}">${e(line)}\n</span>`).join('')}</pre>` : '<p>No text changes to display.</p>'}
      ${diff.isCut ? '<p>Diff truncated at 30,000 characters.</p>' : ''}</section>` : ''}
  </section>`
}

export function renderGraph(state: GraphState): string {
  const { rows } = layoutCommits(emptyLaneState(), state.commits)
  const shown = rows.slice(state.start, state.start + PAGE_SIZE)
  const columns = columnCount(shown)
  const branches = state.branches.filter(branch => state.remote || !branch.remote)
  const disabled = state.busy ? ' disabled' : ''
  return `<header class="top"><div><span class="eyebrow">LOCAL REPOSITORY</span><h1>Git Graph <span class="readonly">Read only</span></h1></div><span class="current">⑂ ${e(state.current || 'No current branch')}</span></header>
    <div class="toolbar"><label>Branch <select id="branch"${disabled}><option value="">Show All</option>${branches.map(branch => `<option value="${e(branch.ref)}"${state.branch === branch.ref ? ' selected' : ''}>${e(branch.name)}${branch.remote ? ' (remote)' : ''}</option>`).join('')}</select></label>
      <label class="remote"><input id="remote" type="checkbox"${state.remote ? ' checked' : ''}${disabled}> Show Remote Branches</label><button data-action="refresh"${disabled}>↻ Refresh</button></div>
    <div role="status" aria-live="polite" class="status">${state.busy ? 'Loading…' : `${state.commits.length} commits loaded${state.hasMore ? ' · More history available' : ''}`}</div>
    ${state.error ? `<p class="error" role="alert">${e(state.error)}</p>` : ''}
    ${state.start > 0 ? `<button class="paging" data-action="newer"${disabled}>↑ Newer commits</button>` : ''}
    <div class="history"><table><thead><tr><th>Graph</th><th>Description</th><th class="date">Date</th><th class="author">Author</th><th class="hash">Commit</th></tr></thead><tbody>
    ${shown.map((row, index) => {
      const commit = state.commits[state.start + index]!
      const expanded = state.detail?.hash === commit.hash
      const chips = chipsOf(commit.refs)
      return `<tr id="commit-${e(commit.hash)}" class="${row.isMerge ? 'merge ' : ''}${expanded ? 'selected' : ''}"><td class="graph">${rowSvg(row, columns, commit.refs.some(ref => ref.isCurrent)).replace('height="18"', 'height="36" preserveAspectRatio="none"')}</td>
        <td class="description"><div class="subject-line">${chips.slice(0, 2).map(chip => `<span class="chip ${e(chip.kind)}" title="${e(chipTitle(chip))}">${chip.isCurrent ? '● ' : chip.kind === 'tag' ? '◆ ' : ''}${e(chipTitle(chip))}</span>`).join('')}${chips.length > 2 ? `<span class="chip">+${chips.length - 2}</span>` : ''}<button data-action="commit" data-hash="${e(commit.hash)}" title="${e(commit.subject)}" aria-expanded="${expanded}"${disabled}>${e(commit.subject || '(No subject)')}</button></div></td>
        <td class="date">${e(formatDate(commit.timestamp))}</td><td class="author" title="${e(commit.author)}">${e(commit.author)}</td><td class="hash">${e(shortHash(commit.hash))}</td></tr>
        ${expanded ? `<tr><td colspan="5" class="detail-cell">${detailHtml(state)}</td></tr>` : ''}`
    }).join('')}</tbody></table></div>
    ${!shown.length && !state.busy && !state.error ? '<p class="empty">No commits in this repository yet.</p>' : ''}
    ${state.hasMore || state.start + PAGE_SIZE < state.commits.length ? `<button class="paging" data-action="older"${disabled}>Load more ↓</button>` : ''}
    <footer>Read-only Git history · Refresh to see repository changes</footer>`
}
