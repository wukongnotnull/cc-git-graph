import type { ElementTable, EngineInterface, Register } from 'claude-code'

import type { ViewState } from '../types'
import { PANE_ID } from './constants'
import { openGraph } from './controller'
import { initialView } from './state'
import { makeActions } from './ui/actions'
import { renderBand } from './ui/band'
import { renderPane } from './ui/pane'

const OPENED_TEXT = 'Git Graph opened.'
const VIEW_REF = { plugin: 'cc-git-graph', key: 'view' } as const

// The hooks loader follows `$` only into functions declared in this file, never across an
// import, and refuses `$` being spread or returned. It also wants every state reference
// spelled out as literals. The controller and the actions live in their own modules, so
// they get an object that forwards just the calls they make, each spelled `$.noun.event(...)`
// here. The plugin keeps a single state value (the view), so the state calls ignore the
// reference they are given. The cast is the same one the test adapter makes.
function engineOf($: EngineInterface): EngineInterface {
  const nouns = {
    process: {
      run: (argv: readonly string[]) => $.process.run(argv),
    },
    state: {
      get: () => $.state.get(VIEW_REF),
      set: (_ref: unknown, value: ViewState, options?: { ifVersion?: number }) =>
        $.state.set(VIEW_REF, value, options),
    },
    ui: {
      toast: (message: string) => $.ui.toast(message),
      scroll: (args: Parameters<EngineInterface['ui']['scroll']>[0]) => $.ui.scroll(args),
    },
  }

  return nouns as unknown as EngineInterface
}

// Opens the pane and loads the graph. Both the command and the band's button come here;
// `$` has to stay a plain parameter so the hooks loader can follow it.
async function openBoard($: EngineInterface): Promise<string> {
  const opened = await $.ui.open({ id: PANE_ID, title: 'Git Graph' })

  if (!opened.isPlaced) {
    return 'Git Graph: this surface cannot show the panel.'
  }

  try {
    await openGraph(engineOf($))
  } catch (error) {
    // openGraph records load failures itself; this catches a failure of the state calls.
    return `Git Graph: ${error instanceof Error ? error.message : String(error)}`
  }

  return OPENED_TEXT
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'git-graph', description: 'Open the Git graph board' })

    return next(e)
  })

  on('command.run', { command: 'git-graph' }, async $ => {
    return { text: await openBoard($) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }

    const ui = $.ui.resolve(e) as ElementTable<'desktop'>

    return renderBand(ui, () => {
      openBoard($).then(text => {
        if (text !== OPENED_TEXT) {
          $.ui.toast(text)
        }
      })
    })
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    if (e.surface !== 'desktop') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box>
          <Text dimColor>Git Graph 仅支持桌面应用。</Text>
        </Box>
      )
    }

    const ui = $.ui.resolve(e) as ElementTable<'desktop'>
    const { value: view = initialView } = await $.state.get(VIEW_REF)

    return renderPane(ui, view, makeActions(engineOf($)))
  })
}
