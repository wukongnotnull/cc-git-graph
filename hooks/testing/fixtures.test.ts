import { describe, expect, test } from 'claude-code/testing'

import { serveGit } from './fixtures'

describe('serveGit', () => {
  test('answers a process.run made by a plugin hook', {
    plugins: [
      {
        name: 'exp',
        register: (on) => {
          on('command.run', { command: 'exp-run' }, async ($) => {
            const r = await $.process.run(['git', '--version'])

            return { text: r.stdout }
          })
        },
      },
    ],
  }, async ($, on) => {
    serveGit(on, () => ({ stdout: 'FAKE' }))
    const result = await $.command.run({ command: 'exp-run', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

    expect(result).toEqual({ text: 'FAKE' })
  })

  test('keeps the engine nouns reachable through the adapter', async ($, on) => {
    const engine = serveGit(on, () => ({ stdout: '' }))

    expect(typeof engine($).command.run).toBe('function')
  })
})
