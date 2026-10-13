import { describe, expect, test } from 'claude-code/testing'

import { AUTHOR_WIDTH, DATE_WIDTH, DESCRIPTION_MIN, HASH_WIDTH } from '../constants'
import { planColumns } from './columns'

const GRAPH = 8
const FULL = GRAPH + DESCRIPTION_MIN + DATE_WIDTH + HASH_WIDTH + AUTHOR_WIDTH

describe('planColumns', () => {
  test('a wide pane shows every column', () => {
    expect(planColumns(FULL, GRAPH)).toEqual({ isDateShown: true, isHashShown: true, isAuthorShown: true })
  })

  test('the author goes first', () => {
    expect(planColumns(FULL - 1, GRAPH)).toEqual({ isDateShown: true, isHashShown: true, isAuthorShown: false })
  })

  test('then the hash', () => {
    const width = GRAPH + DESCRIPTION_MIN + DATE_WIDTH

    expect(planColumns(width, GRAPH)).toEqual({ isDateShown: true, isHashShown: false, isAuthorShown: false })
  })

  test('then the date, leaving only the description', () => {
    expect(planColumns(GRAPH + DESCRIPTION_MIN, GRAPH)).toEqual({ isDateShown: false, isHashShown: false, isAuthorShown: false })
  })

  test('a wider graph takes room from the columns', () => {
    expect(planColumns(FULL, GRAPH + 1).isAuthorShown).toBe(false)
  })

  test('a pane narrower than the graph still plans no columns', () => {
    expect(planColumns(3, GRAPH)).toEqual({ isDateShown: false, isHashShown: false, isAuthorShown: false })
  })
})
