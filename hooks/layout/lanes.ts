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

export function layoutCommits(
  prev: LaneState,
  commits: readonly LayoutInput[],
): { rows: GraphRow[]; state: LaneState } {
  const lanes = [...prev.lanes]
  const colors = [...prev.colors]
  let nextColor = prev.nextColor
  const rows: GraphRow[] = []

  for (const commit of commits) {
    const before = [...lanes]
    const colorsBefore = [...colors]
    const waiting: number[] = []

    before.forEach((hash, index) => {
      if (hash === commit.hash) {
        waiting.push(index)
      }
    })

    let lane: number
    let color: number

    if (waiting.length > 0) {
      lane = Math.min(...waiting)
      color = colorAt(colorsBefore, lane)
    } else {
      lane = firstFree(lanes)
      color = nextColor
      nextColor += 1
    }

    const incoming: Edge[] = waiting.map(from => ({ from, to: lane, color: colorAt(colorsBefore, from) }))
    const through: Edge[] = []

    before.forEach((hash, index) => {
      if (hash !== null && !waiting.includes(index)) {
        through.push({ from: index, to: index, color: colorAt(colorsBefore, index) })
      }
    })

    for (const index of waiting) {
      lanes[index] = null
    }

    const outgoing: Edge[] = []

    commit.parents.forEach((parent, order) => {
      const existing = lanes.indexOf(parent)

      if (existing !== -1) {
        outgoing.push({ from: lane, to: existing, color: colorAt(colors, existing) })
      } else if (order === 0) {
        lanes[lane] = parent
        colors[lane] = color
        outgoing.push({ from: lane, to: lane, color })
      } else {
        const slot = firstFree(lanes)
        const slotColor = nextColor
        nextColor += 1
        lanes[slot] = parent
        colors[slot] = slotColor
        outgoing.push({ from: lane, to: slot, color: slotColor })
      }
    })

    trim(lanes, colors)

    rows.push({
      hash: commit.hash,
      lane,
      color,
      isMerge: commit.parents.length > 1,
      through,
      incoming,
      outgoing,
    })
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
