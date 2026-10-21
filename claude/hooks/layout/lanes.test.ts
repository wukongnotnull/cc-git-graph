import { describe, expect, test } from 'claude-code/testing'

import { columnCount, emptyLaneState, layoutCommits } from './lanes'

const lanesOf = (rows: readonly { lane: number }[]): number[] => rows.map(row => row.lane)

describe('layoutCommits', () => {
  test('a linear history stays on lane 0', () => {
    const { rows, state } = layoutCommits(emptyLaneState(), [
      { hash: 'c3', parents: ['c2'] },
      { hash: 'c2', parents: ['c1'] },
      { hash: 'c1', parents: [] },
    ])

    expect(lanesOf(rows)).toEqual([0, 0, 0])
    expect(rows[0]?.incoming).toEqual([])
    expect(rows[0]?.outgoing).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(rows[1]?.incoming).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(rows[2]?.outgoing).toEqual([])
    expect(state.lanes).toEqual([])
  })

  test('a fork and merge uses a second lane and converges again', () => {
    const { rows } = layoutCommits(emptyLaneState(), [
      { hash: 'M', parents: ['A', 'B'] },
      { hash: 'A', parents: ['R'] },
      { hash: 'B', parents: ['R'] },
      { hash: 'R', parents: [] },
    ])

    expect(lanesOf(rows)).toEqual([0, 0, 1, 0])
    expect(rows[0]?.isMerge).toBe(true)
    expect(rows[0]?.outgoing).toEqual([
      { from: 0, to: 0, color: 0 },
      { from: 0, to: 1, color: 1 },
    ])
    expect(rows[1]?.through).toEqual([{ from: 1, to: 1, color: 1 }])
    expect(rows[2]?.through).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(rows[2]?.outgoing).toEqual([{ from: 1, to: 0, color: 0 }])
    expect(rows[3]?.incoming).toEqual([{ from: 0, to: 0, color: 0 }])
  })

  test('an octopus merge opens one lane per extra parent', () => {
    const { rows } = layoutCommits(emptyLaneState(), [{ hash: 'M', parents: ['A', 'B', 'C'] }])

    expect(rows[0]?.outgoing.map(edge => edge.to)).toEqual([0, 1, 2])
  })

  test('a second child of an already-awaited parent connects to the existing lane instead of opening one', () => {
    const { rows } = layoutCommits(emptyLaneState(), [
      { hash: 'X', parents: ['R'] },
      { hash: 'Y', parents: ['R'] },
      { hash: 'R', parents: [] },
    ])

    expect(lanesOf(rows)).toEqual([0, 1, 0])
    expect(rows[2]?.incoming.map(edge => edge.from)).toEqual([0])
    expect(rows[1]?.outgoing).toEqual([{ from: 1, to: 0, color: 0 }])
  })

  test('laying out in two pages gives the same rows as one pass', () => {
    const commits = [
      { hash: 'M', parents: ['A', 'B'] },
      { hash: 'A', parents: ['R'] },
      { hash: 'B', parents: ['R'] },
      { hash: 'R', parents: [] },
    ]
    const whole = layoutCommits(emptyLaneState(), commits)
    const first = layoutCommits(emptyLaneState(), commits.slice(0, 2))
    const second = layoutCommits(first.state, commits.slice(2))

    expect([...first.rows, ...second.rows]).toEqual(whole.rows)
    expect(second.state).toEqual(whole.state)
  })

  test('several roots each take a lane', () => {
    const { rows } = layoutCommits(emptyLaneState(), [
      { hash: 'a', parents: [] },
      { hash: 'b', parents: [] },
    ])

    expect(lanesOf(rows)).toEqual([0, 0])
  })
})

describe('layoutCommits details', () => {
  const forkMerge = [
    { hash: 'M', parents: ['A', 'B'] },
    { hash: 'A', parents: ['R'] },
    { hash: 'B', parents: ['R'] },
    { hash: 'R', parents: [] },
  ]

  test('marks merges and assigns node and edge colors in a fork and merge', () => {
    const { rows } = layoutCommits(emptyLaneState(), forkMerge)

    expect(rows.map(row => row.isMerge)).toEqual([true, false, false, false])
    expect(rows.map(row => row.color)).toEqual([0, 0, 1, 0])
    expect(rows[1]?.incoming).toEqual([{ from: 0, to: 0, color: 0 }])
    expect(rows[2]?.incoming).toEqual([{ from: 1, to: 1, color: 1 }])
    expect(rows[2]?.through).toEqual([{ from: 0, to: 0, color: 0 }])
  })

  test('reuses a freed middle lane with a fresh color', () => {
    const { rows, state } = layoutCommits(emptyLaneState(), [
      { hash: 'M', parents: ['A', 'B', 'C'] },
      { hash: 'B', parents: [] },
      { hash: 'N', parents: ['Z'] },
    ])

    expect(rows[1]?.lane).toBe(1)
    expect(rows[2]?.lane).toBe(1)
    expect(rows[2]?.color).toBe(3)
    expect(state.lanes).toEqual(['A', 'Z', 'C'])
    expect(state.colors).toEqual([0, 3, 2])
  })

  test('keeps colors the same length as lanes with live lanes and after trimming', () => {
    const live = layoutCommits(emptyLaneState(), forkMerge.slice(0, 2))
    const done = layoutCommits(emptyLaneState(), forkMerge)

    expect(live.state.lanes.length).toBeGreaterThan(0)
    expect(live.state.colors.length).toBe(live.state.lanes.length)
    expect(done.state.lanes).toEqual([])
    expect(done.state.colors).toEqual([])
  })

  test('does not modify the passed-in state', () => {
    const first = layoutCommits(emptyLaneState(), forkMerge.slice(0, 2))
    const snapshot = JSON.parse(JSON.stringify(first.state))

    layoutCommits(first.state, forkMerge.slice(2))
    layoutCommits(first.state, [{ hash: 'X', parents: ['Y', 'W'] }])

    expect(first.state).toEqual(snapshot)
  })
})

describe('columnCount', () => {
  test('is at least one for an empty list', () => {
    expect(columnCount([])).toBe(1)
  })

  test('counts the widest lane used by any row', () => {
    const { rows } = layoutCommits(emptyLaneState(), [{ hash: 'M', parents: ['A', 'B', 'C'] }])

    expect(columnCount(rows)).toBe(3)
  })
})
