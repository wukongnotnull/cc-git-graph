import type { EngineInterface } from 'claude-code'

import { PANE_ID } from '../constants'
import {
  currentGeneration,
  loadMore,
  recordFailure,
  refresh,
  selectBranch,
  showNewer,
  showOlder,
  toggleCommit,
  toggleFileDiff,
  toggleRemote,
} from '../controller'

export type Actions = {
  selectBranch(value: string): void
  toggleRemote(): void
  refresh(): void
  loadMore(): void
  showOlder(): void
  showNewer(): void
  toggleCommit(hash: string): void
  toggleFileDiff(path: string): void
  scrollToCommit(hash: string): void
}

export function makeActions($: EngineInterface): Actions {
  // A throw is shown as a toast and recorded in the view, unless a newer load has taken over meanwhile.
  const guard = (task: () => Promise<unknown>): void => {
    const run = async (): Promise<void> => {
      const generation = await currentGeneration($)

      try {
        await task()
      } catch (error) {
        $.ui.toast(`git-graph: ${error instanceof Error ? error.message : String(error)}`)
        await recordFailure($, error, generation)
      }
    }

    run().catch(error => {
      $.ui.toast(`git-graph: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  return {
    selectBranch: value => guard(() => selectBranch($, value)),
    toggleRemote: () => guard(() => toggleRemote($)),
    refresh: () => guard(() => refresh($)),
    loadMore: () => guard(() => loadMore($)),
    showOlder: () => guard(() => showOlder($)),
    showNewer: () => guard(() => showNewer($)),
    toggleCommit: hash => guard(() => toggleCommit($, hash)),
    toggleFileDiff: path => guard(() => toggleFileDiff($, path)),
    scrollToCommit: hash => {
      $.ui.scroll({ in: PANE_ID, to: { key: `row-${hash}` } }).catch(error => {
        $.ui.toast(`git-graph: ${error instanceof Error ? error.message : String(error)}`)
      })
    },
  }
}
