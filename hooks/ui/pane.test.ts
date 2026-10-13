import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { CELL_WIDTH_PX, GRAPH_MIN_CELLS, LANE_COLORS, PAGE_SIZE, PANE_ID, PLUGIN } from '../constants'
import { lighten } from './color'
import { viewAtom } from '../controller'
import { HASH, branchListing, forkHistoryLog, linearLog, recordOf, serveGit } from '../testing/fixtures'
import type { GitReply } from '../testing/fixtures'

const META = [HASH.m, `${HASH.a} ${HASH.b}`, 'Ada', 'ada@x.com', 'Bob', 'bob@x.com', '2026-10-11 16:34:41 +0800', 'Merge branch\n\nbody\n'].join('\x1f')

const DIFF = 'diff --git a/CLAUDE.md b/CLAUDE.md\nindex 1..2 100644\n--- a/CLAUDE.md\n+++ b/CLAUDE.md\n@@ -1,2 +1,2 @@\n-old line\n+new line\n same\n'

const route = (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse') return { stdout: 'true\n' }
  if (args[0] === 'for-each-ref') return { stdout: branchListing }
  if (args[0] === 'log') return { stdout: forkHistoryLog }
  if (args[0] === 'show' && args.includes('--numstat')) return { stdout: '5\t3\tCLAUDE.md\n' }
  if (args[0] === 'show' && args.includes('--unified=3')) return { stdout: DIFF }
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

    expect(await chipNamed(ui, 'feature/x')).toBeDefined()
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

    expect(lastLog).toContain('refs/heads/main')
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

type TestEngine = Parameters<TestBody>[0]

const mount = ($: TestEngine) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

// A chip is an Svg whose alt is its full name; a leaf element carries no key a query could match.
const chipNamed = async (ui: { findAll: (query: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }, name: string) =>
  (await ui.findAll({ type: 'Svg' })).find(svg => svg.props.alt === name)

const pagedRoute = (records: readonly string[]) => (args: readonly string[]): GitReply | undefined => {
  if (args[0] !== 'log') return route(args)
  const skip = Number((args.find(arg => arg.startsWith('--skip=')) ?? '--skip=0').slice(7))

  return { stdout: records.slice(skip, skip + PAGE_SIZE + 1).join('') }
}

describe('paging', () => {
  test('the load-more button appends the rest and then disappears', async ($, on) => {
    serve(on, pagedRoute(linearLog(PAGE_SIZE + 5)))
    await $.command.run(RUN)
    const ui = await mount($)

    expect(await ui.find({ key: 'more' })).toBeDefined()

    await ui.press({ key: 'more' })

    expect(await ui.find({ key: 'more' })).toBeUndefined()
    expect(await ui.find({ key: `commit-${(PAGE_SIZE + 5).toString(16).padStart(40, '0')}` })).toBeDefined()
    await ui.unmount()
  })

  test('a long history is drawn in windows: the pane never holds every row, and newer leads back', async ($, on) => {
    const total = 400
    serve(on, pagedRoute(linearLog(total)))
    await $.command.run(RUN)
    const ui = await mount($)
    const hashOf = (index: number): string => index.toString(16).padStart(40, '0')

    expect(await ui.find({ key: 'newer' })).toBeUndefined()

    for (let press = 0; press < 30 && (await ui.find({ key: 'more' })) !== undefined; press += 1) {
      await ui.press({ key: 'more' })
    }

    expect(await ui.find({ key: 'newer' })).toBeDefined()
    expect(await ui.find({ key: `commit-${hashOf(1)}` })).toBeUndefined()
    expect(await ui.find({ key: `commit-${hashOf(total)}` })).toBeDefined()
    expect(await ui.find({ key: 'more' })).toBeUndefined()
    expect((await ui.findAll({ type: 'Button' })).length).toBeLessThan(total)

    for (let press = 0; press < 30 && (await ui.find({ key: 'newer' })) !== undefined; press += 1) {
      await ui.press({ key: 'newer' })
    }

    expect(await ui.find({ key: 'newer' })).toBeUndefined()
    expect(await ui.find({ key: `commit-${hashOf(1)}` })).toBeDefined()
    await ui.unmount()
  })

  test('there is no load-more button when everything fits on one page', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)

    expect(await ui.find({ key: 'more' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('Pane states', () => {
  test('an empty repository says it has no commits', async ($, on) => {
    serve(on, args => (args[0] === 'log' ? { exitCode: 128, stderr: 'fatal: your current branch does not have any commits yet' } : route(args)))
    await $.command.run(RUN)
    const ui = await mount($)

    expect(await ui.find({ type: 'Text', text: /这个仓库还没有提交/ })).toBeDefined()
    await ui.unmount()
  })

  test('a merge commit is dimmed and a normal one is not', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)

    expect((await ui.find({ key: `commit-${HASH.m}` }))?.props.dimColor).toBe(true)
    expect((await ui.find({ key: `commit-${HASH.a}` }))?.props.dimColor).toBeFalsy()
    await ui.unmount()
  })

  test('a git failure shows the error, and a failed refresh keeps the loaded list', async ($, on) => {
    let isFailing = false
    serve(on, args => (isFailing && args[0] === 'log' ? { exitCode: 1, stderr: 'fatal: broken' } : route(args)))
    await $.command.run(RUN)
    const ui = await mount($)
    isFailing = true
    await ui.press({ key: 'refresh' })

    expect(await ui.find({ type: 'Text', text: /无法读取 Git 历史:fatal: broken/ })).toBeDefined()
    expect(await ui.find({ key: `commit-${HASH.m}` })).toBeDefined()
    await ui.unmount()
  })

  test('a failure while opening shows the error instead of Loading', async ($, on) => {
    serve(on, args => (args[0] === 'for-each-ref' ? { exitCode: 1, stderr: 'fatal: boom' } : route(args)))
    await $.command.run(RUN)
    const ui = await mount($)

    expect(await ui.find({ type: 'Text', text: /无法读取 Git 历史/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Loading/ })).toBeUndefined()
    await ui.unmount()
  })

  test('reopening clears the old list while the new one loads', async ($, on) => {
    let release: () => void = () => undefined
    let hold: Promise<void> | null = null
    serve(on, async args => {
      if (args[0] === 'log' && hold !== null) await hold

      return route(args)
    })
    await $.command.run(RUN)
    hold = new Promise<void>(resolve => {
      release = resolve
    })
    const reopening = $.command.run(RUN)
    const ui = await mount($)

    expect(await ui.find({ key: `commit-${HASH.m}` })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Loading/ })).toBeDefined()

    release()
    await reopening

    expect(await ui.find({ key: `commit-${HASH.m}` })).toBeDefined()
    await ui.unmount()
  })
})

describe('state key', () => {
  test('the controller atom and the plugin name agree with what the Pane reads', async () => {
    expect(viewAtom.ref).toEqual({ plugin: PLUGIN, key: 'view' })
    expect(PLUGIN).toBe('cc-git-graph')
  })
})

describe('graph column and badges', () => {
  test('the header cell width matches the row drawing width, at least the minimum', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)
    const svg = await ui.find({ type: 'Svg' })
    const header = await ui.find({ type: 'Text', text: /^Graph$/ })

    expect(Number(svg?.props.width) / CELL_WIDTH_PX).toBeGreaterThanOrEqual(GRAPH_MIN_CELLS)
    expect(header).toBeDefined()
    await ui.unmount()
  })

  test('ref badges are chips, and a remote branch joins the local branch of the same name', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)
    const main = String((await chipNamed(ui, 'main (origin)'))?.props.source)

    expect(main).toContain('>● main</text>')
    expect(main).toContain('>origin</text>')
    expect(await chipNamed(ui, 'feature/x')).toBeDefined()
    expect(await chipNamed(ui, 'origin/main')).toBeUndefined()
    await ui.unmount()
  })

  test('a chip is a rounded pill whose hover title is the full, uncut name', async ($, on) => {
    const longName = 'feat/' + 'very-long-branch-name-'.repeat(2)
    const log = recordOf(HASH.m, [HASH.a], 'Ada', 1760000400, `HEAD -> ${longName}`, 'Merge') + recordOf(HASH.a, [], 'Ada', 1760000300, 'main', 'root')
    serve(on, args => (args[0] === 'log' ? { stdout: log } : route(args)))
    await $.command.run(RUN)
    const ui = await mount($)
    const chip = await chipNamed(ui, longName)
    const source = String(chip?.props.source)

    expect(source).toContain('rx="8"')
    expect(source).toContain(`<title>${longName}</title>`)
    expect(source).not.toContain(`>${longName}</text>`)
    expect(chip?.props.isInteractive).toBeFalsy()
    await ui.unmount()
  })

  test('the detail of a commit spells out every ref in full', async ($, on) => {
    const longName = 'feat/' + 'very-long-branch-name-'.repeat(2)
    const log = recordOf(HASH.m, [], 'Ada', 1760000400, `HEAD -> ${longName}, tag: v1`, 'Merge')
    serve(on, args => (args[0] === 'log' ? { stdout: log } : route(args)))
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ type: 'Text', text: longName })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /v1/ })).toBeDefined()
    await ui.unmount()
  })

  test('every row and the header give the description the same width basis, so the columns line up', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)
    const header = await ui.find({ key: 'description-header' })
    const withChips = await ui.find({ key: `description-${HASH.m}` })
    const withoutChips = await ui.find({ key: `description-${HASH.a}` })

    for (const box of [header, withChips, withoutChips]) {
      expect(box?.props.width).toBe(0)
      expect(box?.props.flexGrow).toBe(1)
    }

    await ui.unmount()
  })

  test('turning the remote toggle back on asks git for the remote branches again', async ($, on) => {
    const calls: string[][] = []
    serve(on, route, calls)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: 'remote' })
    await ui.press({ key: 'remote' })

    expect(logCalls(calls).at(-1)).toContain('--remotes')
    expect(String((await ui.find({ key: 'remote' }))?.props.label)).toContain('☑')
    await ui.unmount()
  })

  test('switching the remote branches off also takes the remote part off the chips, and back on restores it', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)

    expect(await chipNamed(ui, 'main (origin)')).toBeDefined()

    await ui.press({ key: 'remote' })

    expect(await chipNamed(ui, 'main (origin)')).toBeUndefined()
    expect(String((await chipNamed(ui, 'main'))?.props.source)).not.toContain('>origin</text>')

    await ui.press({ key: 'remote' })

    expect(await chipNamed(ui, 'main (origin)')).toBeDefined()
    await ui.unmount()
  })

  test('a remote branch without a local twin is a pale tint of its lane colour', async ($, on) => {
    const log = recordOf(HASH.m, [], 'Ada', 1760000400, 'origin/main', 'Merge')
    serve(on, args => (args[0] === 'log' ? { stdout: log } : route(args)))
    await $.command.run(RUN)
    const ui = await mount($)
    const source = String((await chipNamed(ui, 'origin/main'))?.props.source)

    expect(source).toContain(`fill="${lighten(LANE_COLORS[0] ?? '', 0.78)}"`)
    expect(source).toContain('fill="#1f2328"')
    await ui.unmount()
  })

  test('a pane of the default width draws only the graph and the description', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'desktop',
      component: 'Pane',
      requestId: PANE_ID,
      props: { ...PROPS, bodyColumns: 50 },
    })

    expect(await ui.find({ type: 'Text', text: 'Description' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Date' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Author' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Commit' })).toBeUndefined()
    expect(await ui.find({ key: `commit-${HASH.m}` })).toBeDefined()
    await ui.unmount()
  })

  test('the detail card puts its files beside the fields in a wide pane and under them in a narrow one', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)

    for (const [bodyColumns, direction] of [[140, 'row'], [60, 'column']] as const) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: { ...PROPS, bodyColumns } })

      await ui.press({ key: `commit-${HASH.m}` })

      expect((await ui.find({ key: 'detail-body' }))?.props.flexDirection).toBe(direction)
      expect(await ui.find({ key: 'close-detail' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /CLAUDE\.md/ })).toBeDefined()

      // The open commit is state, not part of the mount: close it so the next width opens it afresh.
      await ui.press({ key: 'close-detail' })
      await ui.unmount()
    }
  })

  test('pressing a file of the open commit shows its diff, pressing it again hides it', async ($, on) => {
    const calls: string[][] = []
    serve(on, route, calls)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ type: 'Code' })).toBeUndefined()

    await ui.press({ key: 'file-diff-CLAUDE.md' })
    const code = await ui.find({ type: 'Code' })

    expect(code?.props.format).toBe('diff')
    expect(String(code?.props.source)).toContain('+new line')
    expect(String(code?.props.source)).not.toContain('diff --git')

    const shows = calls.filter(call => call[0] === 'show' && call.includes('--unified=3'))

    expect(shows).toHaveLength(1)
    expect(shows[0]?.slice(-3)).toEqual([HASH.m, '--', 'CLAUDE.md'])

    await ui.press({ key: 'file-diff-CLAUDE.md' })

    expect(await ui.find({ type: 'Code' })).toBeUndefined()
    await ui.unmount()
  })

  test('the diff has its own close button, which leaves the commit detail open', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ key: 'close-file-diff' })).toBeUndefined()

    await ui.press({ key: 'file-diff-CLAUDE.md' })

    expect(await ui.find({ key: 'close-file-diff' })).toBeDefined()
    expect(await ui.find({ type: 'Code' })).toBeDefined()

    await ui.press({ key: 'close-file-diff' })

    expect(await ui.find({ type: 'Code' })).toBeUndefined()
    expect(await ui.find({ key: 'close-file-diff' })).toBeUndefined()
    expect(await ui.find({ key: 'close-detail' })).toBeDefined()
    await ui.press({ key: 'close-detail' })
    await ui.unmount()
  })

  test('closing the commit also closes its file diff', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${HASH.m}` })
    await ui.press({ key: 'file-diff-CLAUDE.md' })
    await ui.press({ key: 'close-detail' })
    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ type: 'Code' })).toBeUndefined()
    await ui.press({ key: 'close-detail' })
    await ui.unmount()
  })

  test('the Refs line of the detail is a field of its own, not wrapped in a row that would squeeze its value', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${HASH.m}` })

    expect(await ui.find({ key: 'field-Refs:' })).toBeDefined()
    expect(await ui.find({ key: 'detail-refs' })).toBeUndefined()
    expect((await ui.find({ key: 'field-Refs:' }))?.props.flexDirection).toBe('row')
    await ui.press({ key: 'close-detail' })
    await ui.unmount()
  })

  test('a narrower pane drops the author and hash columns before the date', async ($, on) => {
    serve(on, route)
    await $.command.run(RUN)
    const wide = await mount($)

    expect(await wide.find({ type: 'Text', text: 'Author' })).toBeDefined()
    expect(await wide.find({ type: 'Text', text: 'Commit' })).toBeDefined()
    await wide.unmount()

    const narrow = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'desktop',
      component: 'Pane',
      requestId: PANE_ID,
      props: { ...PROPS, bodyColumns: 60 },
    })

    expect(await narrow.find({ type: 'Text', text: 'Date' })).toBeDefined()
    expect(await narrow.find({ type: 'Text', text: 'Author' })).toBeUndefined()
    expect(await narrow.find({ type: 'Text', text: 'Commit' })).toBeUndefined()
    expect(await narrow.find({ key: `commit-${HASH.m}` })).toBeDefined()
    await narrow.unmount()
  })
})
