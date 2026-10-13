import type { ViewState } from '../types'

type BranchView = Pick<ViewState, 'branches' | 'remoteBranches' | 'isRemoteShown'>

export function visibleBranches(view: BranchView): string[] {
  if (view.isRemoteShown) {
    return [...view.branches]
  }

  const remotes = new Set(view.remoteBranches)

  return view.branches.filter(name => !remotes.has(name))
}
