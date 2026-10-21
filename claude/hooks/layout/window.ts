import type { Commit, GraphRow, ViewState } from '../../types'
import { MAX_CHIPS, ROW_OVERHEAD_CHARS, ROW_WINDOW_CHARS } from '../constants'
import { chipsOf, limitChips, visibleRefs } from '../ui/chips'
import { rowSvg } from './row-svg'
import { columnCount } from './lanes'

// One chip is an SVG of about this many characters (a rounded pill, one or two parts, the title).
const CHIP_CHARS = 900

// What a row adds to the pane's tree, in the characters the engine counts: the graph SVG, the chips, the texts
// and the nodes and props around them. The first of those is measured per row, the rest are averages.
export function rowCost(commit: Commit, row: GraphRow, columns: number, isRemoteShown: boolean): number {
  const { shown, hidden } = limitChips(chipsOf(visibleRefs(commit.refs, isRemoteShown)), MAX_CHIPS)
  const chips = shown.length + (hidden.length === 0 ? 0 : 1)

  return ROW_OVERHEAD_CHARS + rowSvg(row, columns, false).length + commit.subject.length + chips * CHIP_CHARS
}

// The index after the last row that fits in the window starting at `start`: the engine draws a tree only up to a
// size, and drops what comes after, so the pane shows a window of the loaded rows, never all of them. At least one
// row, so a window always moves forward.
export function windowEnd(view: Pick<ViewState, 'commits' | 'rows' | 'isRemoteShown'>, start: number): number {
  const columns = columnCount(view.rows)
  let cost = 0
  let end = start

  while (end < view.commits.length) {
    const commit = view.commits[end]
    const row = view.rows[end]

    if (commit === undefined || row === undefined) {
      break
    }

    cost += rowCost(commit, row, columns, view.isRemoteShown)

    if (cost > ROW_WINDOW_CHARS && end > start) {
      break
    }

    end += 1
  }

  return end
}
