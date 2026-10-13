import type { ElementTable } from 'claude-code'

type DesktopUi = ElementTable<'desktop'>

export function renderBand(ui: DesktopUi, onOpen: () => void) {
  const { Box, Button } = ui

  return (
    <Box>
      <Button key="open-graph" label="Git Graph" onPress={onOpen} />
    </Box>
  )
}
