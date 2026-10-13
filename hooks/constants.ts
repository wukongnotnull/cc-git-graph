export const PLUGIN = 'cc-git-graph'
export const PANE_ID = 'git-graph'
export const PAGE_SIZE = 50
// The engine draws a pane's tree only up to about 200,000 characters and drops the rest (measured: 100 rows came
// to 199,692 and the 101st never showed). The pane draws a window of rows within this budget, which leaves room
// for the toolbar, the header and an open commit's detail.
export const ROW_WINDOW_CHARS = 140_000
// What a row costs besides its SVGs and texts: its nodes, props and keys, measured at about 1,400.
export const ROW_OVERHEAD_CHARS = 1_400
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

// Measured against the pane: `13 Oct 2026 19:47` fills about 13.5 of these cells, an eight-character hash about 6.5,
// a five-character CJK name about 8. Each column keeps one or two cells of air and no more.
export const DATE_WIDTH = 15
export const AUTHOR_WIDTH = 10
export const HASH_WIDTH = 8
// The description is never squeezed below this many cells; the other columns give way first. The pane opens about
// 50 cells wide, and there only the graph and the description are drawn: the date needs about 57.
export const DESCRIPTION_MIN = 36
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
