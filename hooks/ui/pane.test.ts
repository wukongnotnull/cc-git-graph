import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { PANE_ID, PLUGIN } from '../constants'
import { HASH, branchListing, forkHistoryLog, serveGit } from '../testing/fixtures'
import type { GitReply } from '../testing/fixtures'

const META = [HASH.m, `${HASH.a} ${HASH.b}`, 'Ada', 'ada@x.com', 'Bob', 'bob@x.com', '2026-10-11 16:34:41 +0800', 'Merge branch\n\nbody\n'].join('\x1f')

const route = (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse') return { stdout: 'true\n' }
  if (args[0] === 'for-each-ref') return { stdout: branchListing }
  if (args[0] === 'log') return { stdout: forkHistoryLog }
  if (args[0] === 'show' && args.includes('--numstat')) return { stdout: '5\t3\tCLAUDE.md\n' }
  if (args[0] === 'show') return { stdout: META }

  return undefined
}

const RUN = {
  command: 'git-graph',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 80 },
}

const PROPS = {
  title: 'Git Graph',
  isFocused: true,
  bodyColumns: 120,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

// `/git-graph` opens the pane; nothing beneath the plugin in a test places panes, so say it did.
const serve = (on: On, handler: Parameters<typeof serveGit>[1], calls?: string[][]): void => {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  serveGit(on, handler, calls)
}

const logCalls = (calls: readonly string[][]): string[][] => calls.filter(call => call[0] === 'log')

// The test `$` has no `state` noun, so these tests never read or write state directly:
// they load through the `/git-graph` command (the plugin's own hooks, which the engine's
// state serves) and assert on what the Pane draws.
describe('Pane on desktop', () => {
  test('draws the toolbar, a row per commit and a ref badge', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

    expect(await ui.find({ key: 'branch' })).toBeDefined()
    expect(await ui.find({ key: 'remote' })).toBeDefined()
    expect(await ui.find({ key: 'refresh' })).toBeDefined()

    for (const hash of [HASH.m, HASH.a, HASH.b, HASH.r]) {
      expect(await ui.find({ key: `commit-${hash}` })).toBeDefined()
    }

    expect(await ui.find({ type: 'Text', text: /feature\/x/ })).toBeDefined()
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    await ui.unmount()
  })

  test('pressing a commit expands its detail and pressing close collapses it', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ type: 'Text', text: /CLAUDE\.md/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /ada@x\.com/ })).toBeDefined()
    expect(await ui.find({ key: `parent-${HASH.a}` })).toBeDefined()

    await ui.press({ key: 'close-detail' })

    expect(await ui.find({ type: 'Text', text: /ada@x\.com/ })).toBeUndefined()
    await ui.unmount()
  })

  test('parents that are not loaded are plain text, not buttons', async ($, on) => {
    const onlyFirst = forkHistoryLog.split('\x1e\n').slice(0, 1).join('\x1e\n') + '\x1e\n'
    serve(on, args => (args[0] === 'log' ? { stdout: onlyFirst } : route(args)))
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ key: `parent-${HASH.a}` })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: new RegExp(HASH.a.slice(0, 8)) })).toBeDefined()
    await ui.unmount()
  })

  test('selecting a branch in the dropdown filters the graph', async ($, on) => {
    const calls: string[][] = []
    serve(on, route, calls)
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

    await ui.select({ key: 'branch', value: 'main' })
    const lastLog = logCalls(calls).at(-1) ?? []

    expect(lastLog).toContain('main')
    expect(lastLog).not.toContain('--branches')
    await ui.unmount()
  })

  test('the remote toggle and refresh buttons reload', async ($, on) => {
    const calls: string[][] = []
    serve(on, route, calls)
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })
    const before = logCalls(calls).length

    expect(String((await ui.find({ key: 'remote' }))?.props.label)).toContain('☑')

    await ui.press({ key: 'remote' })

    expect(String((await ui.find({ key: 'remote' }))?.props.label)).toContain('☐')
    expect(logCalls(calls).length).toBe(before + 1)
    expect(logCalls(calls).at(-1)).not.toContain('--remotes')

    await ui.press({ key: 'refresh' })

    expect(logCalls(calls).length).toBe(before + 2)
    await ui.unmount()
  })
})

describe('Pane messages', () => {
  test('shows a hint outside a git repository', async ($, on) => {
    serve(on, () => ({ exitCode: 128, stderr: 'fatal: not a git repository' }))
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

    expect(await ui.find({ type: 'Text', text: /不是 Git 仓库/ })).toBeDefined()
    await ui.unmount()
  })

  test('shows only a desktop-only hint on the terminal surface', async ($, on) => {
    serve(on, route)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE_ID, props: PROPS })

    expect(await ui.find({ type: 'Text', text: /仅支持桌面应用/ })).toBeDefined()
    expect(await ui.find({ key: 'branch' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('/git-graph command', () => {
  test('opens the pane and loads the graph', async ($, on) => {
    serve(on, route)
    const result = await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

    expect(result.text).toContain('Git Graph')
    expect(await ui.find({ key: `commit-${HASH.m}` })).toBeDefined()
    await ui.unmount()
  })
})
