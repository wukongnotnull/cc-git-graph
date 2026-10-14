import type { ElementTable } from 'claude-code'

import type { UsageSnapshot } from '../../types'
import { ellipsize } from '../format'
import { branchIconSvg } from '../layout/branch-icon-svg'
import { usageRingSvg } from '../layout/usage-ring-svg'
import { formatCost, levelColor, usageItems } from '../usage'
import type { UsageItem } from '../usage'

type DesktopUi = ElementTable<'desktop'>

const BRANCH_LABEL_MAX = 40
const RING_SIZE = 16
const BRANCH_ICON_SIZE = 14
const BRANCH_ICON_COLOR = '#6e7781'

// The branch the session is on: a rounded outline, the git-branch glyph and the name, as the Git Graph pane's own
// toolbar draws a branch. The border comes from the Box; the name is a Text, so it follows the theme.
function renderBranch(ui: DesktopUi, branch: string) {
  const { Box, Svg, Text } = ui
  const icon = branchIconSvg(BRANCH_ICON_SIZE, BRANCH_ICON_COLOR)

  return (
    <Box key="current-branch" flexDirection="row" alignItems="center" gap={1} borderStyle="round" paddingX={1}>
      <Svg source={icon.source} width={icon.width} height={icon.height} alt="Branch" />
      <Text>{ellipsize(branch, BRANCH_LABEL_MAX)}</Text>
    </Box>
  )
}

function renderMeter(ui: DesktopUi, item: UsageItem) {
  const { Box, Svg, Text } = ui
  const ring = usageRingSvg(item.percent, RING_SIZE, levelColor(item.percent))
  const percent = `${Math.round(item.percent)}%`

  return (
    <Box key={item.key} flexDirection="row" alignItems="center" gap={1}>
      <Svg source={ring.source} width={ring.width} height={ring.height} alt={`${item.label} ${percent}`} />
      <Text dimColor>{item.label}</Text>
      <Text>{percent}</Text>
      {item.reset === '' ? null : <Text dimColor>{`↻ ${item.reset}`}</Text>}
    </Box>
  )
}

function renderUsage(ui: DesktopUi, usage: UsageSnapshot | undefined, nowMs: number) {
  const { Box, Text } = ui

  if (usage === undefined) {
    return null
  }

  const items = usageItems(usage, nowMs)

  if (items.length === 0 && usage.costUsd === undefined) {
    return null
  }

  return (
    <Box key="usage" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={0}>
      {items.map(item => renderMeter(ui, item))}
      {usage.costUsd === undefined ? null : <Text key="cost" dimColor>{`Cost ${formatCost(usage.costUsd)}`}</Text>}
    </Box>
  )
}

// The button that opens the pane and the branch the session is on (nothing outside a repository) on the left;
// on the right the account's usage windows as rings, the context window and what the session has cost.
export function renderBand(ui: DesktopUi, branch: string, usage: UsageSnapshot | undefined, nowMs: number, onOpen: () => void) {
  const { Box, Button } = ui

  return (
    <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" columnGap={2} rowGap={0}>
      <Box key="band-left" flexDirection="row" alignItems="center" gap={2}>
        <Button key="open-graph" label="Git Graph" onPress={onOpen} />
        {branch === '' ? null : renderBranch(ui, branch)}
      </Box>
      {renderUsage(ui, usage, nowMs)}
    </Box>
  )
}
