import { CELL_WIDTH_PX, GRAPH_MIN_CELLS, LANE_WIDTH } from '../constants'

// The graph column in whole terminal cells, so the header and every row agree.
export function graphCells(columns: number): number {
  return Math.max(GRAPH_MIN_CELLS, Math.ceil((columns * LANE_WIDTH) / CELL_WIDTH_PX))
}

export const graphWidthPx = (columns: number): number => graphCells(columns) * CELL_WIDTH_PX
