import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { PANE_COLUMNS, PANE_ID, PLUGIN } from '../constants'
import { HASH, branchListing, forkHistoryLog, serveGit } from '../testing/fixtures'
import type { GitReply } from '../testing/fixtures'

const route = (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse' && args.includes('--abbrev-ref')) return { stdout: 'feat/ui-polish\n' }
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

const serve = (on: On, opens: string[], calls: string[][] = [], widths: (number | undefined)[] = []): void => {
  // Where the plugin passes, the engine draws its own band: nothing beneath the plugin does that in a test.
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('ui.open', (_$, e) => {
    opens.push(e.id)
    widths.push(e.columns)

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

  test('both ways of opening the pane ask for the same wide default width', async ($, on) => {
    const widths: (number | undefined)[] = []
    serve(on, [], [], widths)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })
    await $.command.run({ command: 'git-graph', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

    expect(widths).toEqual([PANE_COLUMNS, PANE_COLUMNS])
    expect(PANE_COLUMNS).toBeGreaterThanOrEqual(80)
    await band.unmount()
  })

  test('shows the branch the session is on beside the button', async ($, on) => {
    serve(on, [])
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })

    expect(await band.find({ type: 'Text', text: /⎇ feat\/ui-polish/ })).toBeDefined()
    await band.unmount()
  })

  test('shows nothing beside the button outside a repository', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    serveGit(on, () => ({ exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git' }))
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })

    expect(await band.find({ key: 'open-graph' })).toBeDefined()
    expect(await band.find({ key: 'current-branch' })).toBeUndefined()
    await band.unmount()
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
