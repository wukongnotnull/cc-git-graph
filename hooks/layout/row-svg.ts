import type { Edge, GraphRow } from '../../types'
import { LANE_COLORS, LANE_WIDTH, LINE_WIDTH, NODE_RADIUS, ROW_HEIGHT } from '../constants'

const MID = ROW_HEIGHT / 2
const FALLBACK_COLOR = '#8b949e'

const laneX = (lane: number): number => lane * LANE_WIDTH + LANE_WIDTH / 2

const colorOf = (index: number): string => LANE_COLORS[index % LANE_COLORS.length] ?? FALLBACK_COLOR

const stroke = (color: number): string =>
  `fill="none" stroke="${colorOf(color)}" stroke-width="${LINE_WIDTH}" stroke-linecap="round"`

function throughLine(edge: Edge): string {
  const x = laneX(edge.from)

  return `<line x1="${x}" y1="0" x2="${x}" y2="${ROW_HEIGHT}" ${stroke(edge.color)}/>`
}

function incomingLine(edge: Edge, nodeLane: number): string {
  const from = laneX(edge.from)
  const to = laneX(nodeLane)

  if (from === to) {
    return `<line x1="${from}" y1="0" x2="${to}" y2="${MID}" ${stroke(edge.color)}/>`
  }

  return `<path d="M${from} 0 C${from} ${MID} ${to} 0 ${to} ${MID}" ${stroke(edge.color)}/>`
}

function outgoingLine(edge: Edge, nodeLane: number): string {
  const from = laneX(nodeLane)
  const to = laneX(edge.to)

  if (from === to) {
    return `<line x1="${from}" y1="${MID}" x2="${to}" y2="${ROW_HEIGHT}" ${stroke(edge.color)}/>`
  }

  return `<path d="M${from} ${MID} C${from} ${ROW_HEIGHT} ${to} ${MID} ${to} ${ROW_HEIGHT}" ${stroke(edge.color)}/>`
}

function node(row: GraphRow, isHead: boolean): string {
  const x = laneX(row.lane)
  const color = colorOf(row.color)

  if (isHead) {
    return `<circle cx="${x}" cy="${MID}" r="${NODE_RADIUS}" fill="none" stroke="${color}" stroke-width="${LINE_WIDTH}"/>`
  }

  return `<circle cx="${x}" cy="${MID}" r="${NODE_RADIUS}" fill="${color}"/>`
}

// `widthPx` widens the drawing past its lanes; the lanes stay left-aligned inside it.
export function rowSvg(row: GraphRow, columns: number, isHead: boolean, widthPx?: number): string {
  const width = widthPx ?? Math.max(columns, 1) * LANE_WIDTH

  const parts = [
    ...row.through.map(throughLine),
    ...row.incoming.map(edge => incomingLine(edge, row.lane)),
    ...row.outgoing.map(edge => outgoingLine(edge, row.lane)),
    node(row, isHead),
  ]

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ROW_HEIGHT}" ` +
    `viewBox="0 0 ${width} ${ROW_HEIGHT}">${parts.join('')}</svg>`
  )
}
