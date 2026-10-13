export const PLUGIN = 'cc-git-graph'
export const PANE_ID = 'git-graph'
export const PAGE_SIZE = 50
export const ALL_BRANCHES = '*'

export const LANE_WIDTH = 14
export const ROW_HEIGHT = 18
export const NODE_RADIUS = 4
export const LINE_WIDTH = 2
// Measured in the desktop app: a Date column of 18 cells is 189 px.
export const CELL_WIDTH_PX = 10.5
// Enough cells for the "Graph" header label.
export const GRAPH_MIN_CELLS = 6

export const DATE_WIDTH = 18
export const AUTHOR_WIDTH = 16
export const HASH_WIDTH = 9

export const LANE_COLORS: readonly string[] = [
  '#4f8ef7',
  '#e6529b',
  '#3ccf6e',
  '#f5a524',
  '#9b6df2',
  '#17b8c9',
  '#e5534b',
  '#8b949e',
]
