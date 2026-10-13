import { describe, expect, test } from 'claude-code/testing'

import { CELL_WIDTH_PX, GRAPH_MIN_CELLS } from '../constants'
import { graphCells, graphWidthPx } from './graph-width'

describe('graphCells', () => {
  test('a single lane still fits the Graph label', () => {
    expect(graphCells(1)).toBe(GRAPH_MIN_CELLS)
  })

  test('a wide graph gets more cells, in whole cells', () => {
    expect(graphCells(20)).toBeGreaterThan(GRAPH_MIN_CELLS)
    expect(Number.isInteger(graphCells(20))).toBe(true)
  })

  test('the pixel width is the cell count times the cell width', () => {
    expect(graphWidthPx(20)).toBe(graphCells(20) * CELL_WIDTH_PX)
  })
})
