export const PLUGIN = 'cc-git-graph'
export const PANE_ID = 'git-graph'
// The width the docked pane asks for: room for every column. A width the person has dragged it to wins.
export const PANE_COLUMNS = 200
export const PAGE_SIZE = 50
// A git call that has not returned by then is reported as a failure instead of leaving the pane on Loading.
export const GIT_TIMEOUT_MS = 10_000
export const ALL_BRANCHES = '*'

export const LANE_WIDTH = 14
export const ROW_HEIGHT = 18
export const NODE_RADIUS = 4
export const LINE_WIDTH = 2
// Measured in the desktop app: a Date column of 18 cells is 189 px.
export const CELL_WIDTH_PX = 10.5
// Enough cells for the "Graph" header label.
export const GRAPH_MIN_CELLS = 6

// A date such as `13 Oct 2026 19:47` is 17 characters; the cells over that keep it off the author column.
export const DATE_WIDTH = 21
export const AUTHOR_WIDTH = 16
export const HASH_WIDTH = 9
// The description is never squeezed below this many cells; the other columns give way first.
export const DESCRIPTION_MIN = 24
// A row draws at most this many ref chips, each name cut to this many characters.
export const MAX_CHIPS = 2
export const CHIP_LABEL_MAX = 22

// The Okabe-Ito palette, chosen to stay apart for red-green colour blindness: no red-green pair,
// and the blue, vermillion, green and orange also differ in lightness.
export const LANE_COLORS: readonly string[] = [
  '#0072b2',
  '#d55e00',
  '#009e73',
  '#e69f00',
  '#56b4e9',
  '#cc79a7',
  '#6e7681',
]
