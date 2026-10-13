import type { ElementTable } from 'claude-code'

import { ellipsize } from '../format'

type DesktopUi = ElementTable<'desktop'>

const BRANCH_LABEL_MAX = 40

// The button that opens the pane, and beside it the branch the session is on (nothing outside a repository).
export function renderBand(ui: DesktopUi, branch: string, onOpen: () => void) {
  const { Box, Button, Text } = ui

  return (
    <Box flexDirection="row" alignItems="center" gap={2}>
      <Button key="open-graph" label="Git Graph" onPress={onOpen} />
      {branch === '' ? null : <Text key="current-branch" dimColor>{`⎇ ${ellipsize(branch, BRANCH_LABEL_MAX)}`}</Text>}
    </Box>
  )
}
