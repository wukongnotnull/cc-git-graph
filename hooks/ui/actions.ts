import type { EngineInterface } from 'claude-code'

import { PANE_ID } from '../constants'
import { loadMore, refresh, selectBranch, toggleCommit, toggleRemote } from '../controller'

export type Actions = {
  selectBranch(value: string): void
  toggleRemote(): void
  refresh(): void
  loadMore(): void
  toggleCommit(hash: string): void
  scrollToCommit(hash: string): void
}

export function makeActions($: EngineInterface): Actions {
  const guard = (task: Promise<unknown>): void => {
    task.catch(error => {
      $.ui.toast(`git-graph: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  return {
    selectBranch: value => guard(selectBranch($, value)),
    toggleRemote: () => guard(toggleRemote($)),
    refresh: () => guard(refresh($)),
    loadMore: () => guard(loadMore($)),
    toggleCommit: hash => guard(toggleCommit($, hash)),
    scrollToCommit: hash => guard($.ui.scroll({ in: PANE_ID, to: { key: `row-${hash}` } })),
  }
}
