import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { PANE_ID, PLUGIN } from '../constants'
import { HASH, branchListing, forkHistoryLog, serveGit } from '../testing/fixtures'
import type { GitReply } from '../testing/fixtures'

const route = (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse') return { stdout: 'true\n' }
  if (args[0] === 'for-each-ref') return { stdout: branchListing }
  if (args[0] === 'log') return { stdout: forkHistoryLog }

  return undefined
}

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 6,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 6 },
  view: {},
}

const PANE = {
  title: 'Git Graph',
  isFocused: true,
  bodyColumns: 120,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

const serve = (on: On, opens: string[], calls: string[][] = []): void => {
  // Where the plugin passes, the engine draws its own band: nothing beneath the plugin does that in a test.
  on('ui.render', () => ({ value: { type: 'engine' as const, ref: 0 } }))
  on('ui.open', (_$, e) => {
    opens.push(e.id)

    return { value: { isPlaced: true as const } }
  })
  serveGit(on, route, calls)
}

describe('AbovePrompt band', () => {
  test('desktop draws a button that opens the pane and loads the graph', async ($, on) => {
    const opens: string[] = []
    const calls: string[][] = []
    serve(on, opens, calls)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })

    expect(opens).toEqual([PANE_ID])
    expect(calls.some(call => call[0] === 'log')).toBe(true)
    await band.unmount()

    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PANE })

    expect(await pane.find({ key: `commit-${HASH.m}` })).toBeDefined()
    await pane.unmount()
  })

  test('draws nothing while a survey holds the band', async ($, on) => {
    serve(on, [])
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } })

    expect(await band.find({ key: 'open-graph' })).toBeUndefined()
    await band.unmount()
  })

  test('the terminal gets no button', async ($, on) => {
    serve(on, [])
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })

    expect(await band.find({ key: 'open-graph' })).toBeUndefined()
    await band.unmount()
  })
})
