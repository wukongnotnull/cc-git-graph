import { AUTHOR_WIDTH, DATE_WIDTH, DESCRIPTION_MIN, HASH_WIDTH } from '../constants'

export type ColumnPlan = {
  isDateShown: boolean
  isAuthorShown: boolean
  isHashShown: boolean
}

// What is left of the pane after the graph goes to the description first. The author column goes
// first when it gets tight, then the hash, then the date.
export function planColumns(bodyColumns: number, graphCells: number): ColumnPlan {
  const room = bodyColumns - graphCells - DESCRIPTION_MIN

  return {
    isDateShown: room >= DATE_WIDTH,
    isHashShown: room >= DATE_WIDTH + HASH_WIDTH,
    isAuthorShown: room >= DATE_WIDTH + HASH_WIDTH + AUTHOR_WIDTH,
  }
}
