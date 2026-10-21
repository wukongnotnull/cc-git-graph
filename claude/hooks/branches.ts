import type { ViewState } from '../types'
import { ALL_BRANCHES, MAX_SELECT_OPTIONS } from './constants'

type BranchView = Pick<ViewState, 'branches' | 'remoteBranches' | 'isRemoteShown'>

export function visibleBranches(view: BranchView): string[] {
  if (view.isRemoteShown) {
    return [...view.branches]
  }

  const remotes = new Set(view.remoteBranches)

  return view.branches.filter(name => !remotes.has(name))
}

export type BranchOption = { value: string; label: string }

// What the branch Select lists: Show All, then the branches, locals first. A Select takes at most
// MAX_SELECT_OPTIONS, so a longer list keeps the selected branch and ends in a line that says how many are left
// out; its empty value is not a branch, so choosing it changes nothing.
export function branchOptions(view: BranchView & Pick<ViewState, 'branch'>): BranchOption[] {
  const names = visibleBranches(view)
  const all = { value: ALL_BRANCHES, label: 'Show All' }

  if (names.length + 1 <= MAX_SELECT_OPTIONS) {
    return [all, ...names.map(name => ({ value: name, label: name }))]
  }

  const room = MAX_SELECT_OPTIONS - 2
  const head = names.slice(0, room)
  const shown = head.includes(view.branch) || !names.includes(view.branch) ? head : [...head.slice(0, -1), view.branch]
  const more = { value: '', label: `… ${names.length - shown.length} more (turn off remote branches)` }

  return [all, ...shown.map(name => ({ value: name, label: name })), more]
}
