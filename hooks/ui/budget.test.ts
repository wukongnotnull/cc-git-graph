import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { PAGE_SIZE, PANE_ID, PLUGIN } from '../constants'
import { linearLog, serveGit } from '../testing/fixtures'
import type { GitReply } from '../testing/fixtures'

// The engine draws a pane's text only up to a limit and drops what comes after, so a pane that drew everything
// still has its last element, the Load more button.
const COMMITS = 400
const FILES = 2_000
const REMOTE_BRANCHES = 3_000

const hashOf = (index: number): string => index.toString(16).padStart(40, '0')
const firstHash = hashOf(1)

const meta = [firstHash, hashOf(2), 'Ada', 'ada@x.com', 'Bob', 'bob@x.com', '2026-10-11 16:34:41 +0800', `subject\n\n${'a long body line\n'.repeat(5_000)}`].join('\x1f')
const numstat = Array.from({ length: FILES }, (_, index) => `1\t1\tsrc/feature-${index}/component-${index}/index.ts`).join('\n') + '\n'
const diff = `@@ -1,1 +1,1 @@\n${'+an added line of code in the file\n'.repeat(5_000)}`
const branches = ['refs/heads/main', ...Array.from({ length: REMOTE_BRANCHES }, (_, index) => `refs/remotes/origin/feature/branch-number-${index}`)].join('\n') + '\n'
const records = linearLog(COMMITS)

const route = (args: readonly string[]): GitReply | undefined => {
  if (args[0] === 'rev-parse') return { stdout: 'true\n' }
  if (args[0] === 'for-each-ref') return { stdout: branches }
  if (args[0] === 'log') {
    const skip = Number((args.find(arg => arg.startsWith('--skip=')) ?? '--skip=0').slice(7))

    return { stdout: records.slice(skip, skip + PAGE_SIZE + 1).join('') }
  }
  if (args[0] === 'show' && args.includes('--numstat')) return { stdout: numstat }
  if (args[0] === 'show' && args.includes('--unified=3')) return { stdout: diff }
  if (args[0] === 'show') return { stdout: meta }

  return undefined
}

const RUN = { command: 'git-graph', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } }
const PROPS = { title: 'Git Graph', isFocused: true, bodyColumns: 120, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }

type TestEngine = Parameters<TestBody>[0]

const serve = (on: On): void => {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  serveGit(on, route)
}

const mount = ($: TestEngine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE_ID, props: PROPS })

type Ui = Awaited<ReturnType<typeof mount>>

const rowCount = async (ui: Ui): Promise<number> =>
  (await ui.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('commit-')).length

// Grows the first window until it is full: the press that finds it full moves on, and Newer leads back to it.
async function fillFirstWindow(ui: Ui): Promise<void> {
  for (let press = 0; press < 20; press += 1) {
    await ui.press({ key: 'more' })

    if ((await ui.find({ key: 'newer' })) !== undefined) {
      await ui.press({ key: 'newer' })

      return
    }
  }
}

describe('pane size', () => {
  test('a full window with a huge commit, its diff and thousands of branches stays under the engine limit', async ($, on) => {
    serve(on)
    await $.command.run(RUN)
    const ui = await mount($)

    await fillFirstWindow(ui)
    const rows = await rowCount(ui)
    await ui.press({ key: `commit-${firstHash}` })
    await ui.press({ key: 'file-diff-src/feature-0/component-0/index.ts' })

    expect(rows).toBeGreaterThan(PAGE_SIZE)
    expect(await ui.find({ key: 'more' })).toBeDefined()
    await ui.press({ key: 'close-detail' })
    await ui.unmount()
  })

  test('says how many files of a commit are not listed', async ($, on) => {
    serve(on)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${firstHash}` })
    const listed = (await ui.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('file-diff-')).length

    expect(listed).toBeLessThan(FILES)
    expect(await ui.find({ type: 'Text', text: `… and ${FILES - listed} more files` })).toBeDefined()
    await ui.press({ key: 'close-detail' })
    await ui.unmount()
  })

  test('shortens a very long commit message and says so', async ($, on) => {
    serve(on)
    await $.command.run(RUN)
    const ui = await mount($)

    await ui.press({ key: `commit-${firstHash}` })
    const message = await ui.find({ key: 'detail-message' })

    expect(message?.text.length).toBeLessThan(meta.length)
    expect(await ui.find({ type: 'Text', text: /message is long; only the first part is shown/ })).toBeDefined()
    await ui.press({ key: 'close-detail' })
    await ui.unmount()
  })

  test('keeps the selected branch among the options it lists', async ($, on) => {
    serve(on)
    await $.command.run(RUN)
    const ui = await mount($)
    const options = (await ui.find({ key: 'branch' }))?.props.options as { value: string }[]

    expect(options.length).toBeLessThan(REMOTE_BRANCHES)
    expect(options.some(option => option.value === 'main')).toBe(true)
    await ui.unmount()
  })
})
