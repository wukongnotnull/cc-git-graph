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

const NOW_RESET = new Date(2099, 0, 1, 6, 0).toISOString()

// What `$.session.usage()` answers in these tests: the account's two windows, the context window and the cost.
const USAGE = {
  startedAt: 0,
  context: { window: 1_000_000, percent: 23 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 12.4, resetsAt: NOW_RESET },
    { kind: 'seven_day', percentUsed: 34, resetsAt: NOW_RESET },
  ],
  cost: { usd: 0.42 },
}

const serve = (on: On, opens: string[], calls: string[][] = [], widths: (number | undefined)[] = [], usage: unknown = USAGE): void => {
  on('session.usage', () => ({ value: usage as never }))
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

    const branch = await band.find({ key: 'current-branch' })

    expect(branch?.props.borderStyle).toBeUndefined()
    expect(branch?.props.backgroundColor).toBeUndefined()
    expect(await band.find({ type: 'Text', text: 'feat/ui-polish' })).toBeDefined()
    expect((await band.find({ type: 'Text', text: 'feat/ui-polish' }))?.props.dimColor).toBe(true)
    expect(await band.find({ type: 'Button', text: /feat\/ui-polish/ })).toBeUndefined()
    await band.unmount()
  })

  test('shows the usage windows, the context window and the cost on the right', async ($, on) => {
    serve(on, [])
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })
    const meters = (await band.findAll({ type: 'Svg' })).map(svg => svg.props.alt)

    expect(meters).toEqual(['Branch', 'Session 12%', 'Week 34%', 'Context 23%'])
    expect(await band.find({ type: 'Text', text: '$0.42' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: 'Cost' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /↻/ })).toBeDefined()
    expect(String((await band.findAll({ type: 'Svg' })).at(1)?.props.source)).toContain('<circle')
    await band.unmount()
  })

  test('shows no meters where the engine has no usage figures', async ($, on) => {
    serve(on, [], [], [], { startedAt: 0, context: { window: 200_000 }, rateLimits: [] })
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })

    expect((await band.findAll({ type: 'Svg' })).map(svg => svg.props.alt)).toEqual(['Branch'])
    expect(await band.find({ type: 'Text', text: /Cost/ })).toBeUndefined()
    expect(await band.find({ key: 'open-graph' })).toBeDefined()
    await band.unmount()
  })

  test('shows nothing beside the button outside a repository', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    serveGit(on, () => ({ exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git' }))
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND })

    await band.press({ key: 'open-graph' })

    expect(await band.find({ key: 'open-graph' })).toBeDefined()
    expect((await band.findAll({ type: 'Svg' })).length).toBe(0)
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
