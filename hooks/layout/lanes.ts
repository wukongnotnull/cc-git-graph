import type { Edge, GraphRow, LaneState } from '../../types'

export type LayoutInput = { hash: string; parents: readonly string[] }

export function emptyLaneState(): LaneState {
  return { lanes: [], colors: [], nextColor: 0 }
}

function firstFree(lanes: readonly (string | null)[]): number {
  const free = lanes.indexOf(null)

  return free === -1 ? lanes.length : free
}

function colorAt(colors: readonly number[], lane: number): number {
  return colors[lane] ?? 0
}

function trim(lanes: (string | null)[], colors: number[]): void {
  while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
    lanes.pop()
    colors.pop()
  }
}

type Placement = { lane: number; color: number; nextColor: number; waiting: number[] }

function placeNode(lanes: readonly (string | null)[], colors: readonly number[], hash: string, nextColor: number): Placement {
  const waiting: number[] = []

  lanes.forEach((waitingHash, index) => {
    if (waitingHash === hash) {
      waiting.push(index)
    }
  })

  if (waiting.length > 0) {
    const lane = Math.min(...waiting)

    return { lane, color: colorAt(colors, lane), nextColor, waiting }
  }

  return { lane: firstFree(lanes), color: nextColor, nextColor: nextColor + 1, waiting }
}

/** Mutates the given lane/color arrays (callers pass local copies); returns the edges and the new color counter. */
function placeParents(
  parents: readonly string[],
  node: { lane: number; color: number },
  lanes: (string | null)[],
  colors: number[],
  startColor: number,
): { outgoing: Edge[]; nextColor: number } {
  const outgoing: Edge[] = []
  let nextColor = startColor

  parents.forEach((parent, order) => {
    const existing = lanes.indexOf(parent)

    if (existing !== -1) {
      outgoing.push({ from: node.lane, to: existing, color: colorAt(colors, existing) })
    } else if (order === 0) {
      lanes[node.lane] = parent
      colors[node.lane] = node.color
      outgoing.push({ from: node.lane, to: node.lane, color: node.color })
    } else {
      const slot = firstFree(lanes)

      lanes[slot] = parent
      colors[slot] = nextColor
      outgoing.push({ from: node.lane, to: slot, color: nextColor })
      nextColor += 1
    }
  })

  return { outgoing, nextColor }
}

function layoutOne(commit: LayoutInput, lanes: (string | null)[], colors: number[], startColor: number): { row: GraphRow; nextColor: number } {
  const colorsBefore = [...colors]
  const placement = placeNode(lanes, colors, commit.hash, startColor)
  const { lane, color, waiting } = placement

  const incoming: Edge[] = waiting.map(from => ({ from, to: lane, color: colorAt(colorsBefore, from) }))
  const through: Edge[] = []

  lanes.forEach((hash, index) => {
    if (hash !== null && !waiting.includes(index)) {
      through.push({ from: index, to: index, color: colorAt(colorsBefore, index) })
    }
  })

  for (const index of waiting) {
    lanes[index] = null
  }

  const { outgoing, nextColor } = placeParents(commit.parents, { lane, color }, lanes, colors, placement.nextColor)

  trim(lanes, colors)

  const row: GraphRow = { hash: commit.hash, lane, color, isMerge: commit.parents.length > 1, through, incoming, outgoing }

  return { row, nextColor }
}

export function layoutCommits(
  prev: LaneState,
  commits: readonly LayoutInput[],
): { rows: GraphRow[]; state: LaneState } {
  const lanes = [...prev.lanes]
  const colors = [...prev.colors]
  let nextColor = prev.nextColor
  const rows: GraphRow[] = []

  for (const commit of commits) {
    const result = layoutOne(commit, lanes, colors, nextColor)

    rows.push(result.row)
    nextColor = result.nextColor
  }

  return { rows, state: { lanes, colors, nextColor } }
}

export function columnCount(rows: readonly GraphRow[]): number {
  let widest = 1

  for (const row of rows) {
    widest = Math.max(widest, row.lane + 1)

    for (const edge of [...row.through, ...row.incoming, ...row.outgoing]) {
      widest = Math.max(widest, edge.from + 1, edge.to + 1)
    }
  }

  return widest
}
