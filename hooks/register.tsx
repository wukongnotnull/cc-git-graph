import type { ElementTable, Register } from 'claude-code'

const PANE = 'git-graph'
const HEIGHTS = [18, 20, 22, 24] as const
const ROWS = 300

const lineSvg = (height: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="${height}" viewBox="0 0 14 ${height}">` +
  `<line x1="7" y1="0" x2="7" y2="${height}" stroke="#4f8ef7" stroke-width="2"/>` +
  `<circle cx="7" cy="${height / 2}" r="4" fill="#4f8ef7"/></svg>`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'git-graph', description: 'Probe: Git graph board' })

    return next(e)
  })

  on('command.run', { command: 'git-graph' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Git Graph probe' })

    return { text: 'probe opened' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e) as ElementTable<'desktop'>
    const { Box, Button, Svg, Text } = ui
    const rows = Array.from({ length: ROWS }, (_, i) => i)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Button
            key="to-250"
            label="Scroll to row 250"
            onPress={() => {
              void $.ui.scroll({ in: PANE, to: { key: 'row-250' } })
            }}
          />
          <Button
            key="to-0"
            label="Scroll to row 0"
            onPress={() => {
              void $.ui.scroll({ in: PANE, to: { key: 'row-0' } })
            }}
          />
        </Box>
        {rows.map(i => (
          <Box key={`row-${i}`} flexDirection="row" alignItems="center">
            {HEIGHTS.map(height => (
              <Svg source={lineSvg(height)} alt={`probe ${height}px`} />
            ))}
            <Box flexGrow={1} overflow="hidden">
              <Button key={`commit-${i}`} plain onPress={() => $.ui.toast(`pressed ${i}`)}>
                <Text>{`row ${i} - click target`}</Text>
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}
