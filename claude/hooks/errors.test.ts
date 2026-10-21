import { describe, expect, test } from 'claude-code/testing'

import { describeError } from './errors'

describe('describeError', () => {
  test('takes the message of an Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  test('turns anything else into text', () => {
    expect(describeError('plain')).toBe('plain')
    expect(describeError(42)).toBe('42')
  })
})
