import type { ElementTable } from 'claude-code'

import type { UsageSnapshot } from '../../types'
import { ellipsize } from '../format'
import { usageBarSvg } from '../layout/usage-bar-svg'
import { formatCost, levelColor, usageItems } from '../usage'
import type { UsageItem } from '../usage'

type DesktopUi = ElementTable<'desktop'>

const BRANCH_LABEL_MAX = 40
const BAR_WIDTH = 64

function renderMeter(ui: DesktopUi, item: UsageItem) {
  const { Box, Svg, Text } = ui
  const bar = usageBarSvg(item.percent, BAR_WIDTH, levelColor(item.percent))
  const percent = `${Math.round(item.percent)}%`

  return (
    <Box key={item.key} flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor>{item.label}</Text>
      <Svg source={bar.source} width={bar.width} height={bar.height} alt={`${item.label} ${percent}`} />
      <Text>{percent}</Text>
      {item.reset === '' ? null : <Text dimColor>{item.reset}</Text>}
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
    <Box key="usage" flexDirection="row" flexWrap="wrap" alignItems="center" gap={3}>
      {items.map(item => renderMeter(ui, item))}
      {usage.costUsd === undefined ? null : <Text key="cost" dimColor>{`本会话 ${formatCost(usage.costUsd)}`}</Text>}
    </Box>
  )
}

// The button that opens the pane and the branch the session is on (nothing outside a repository) on the left;
// on the right the account's usage windows, the context window and what the session has cost.
export function renderBand(ui: DesktopUi, branch: string, usage: UsageSnapshot | undefined, nowMs: number, onOpen: () => void) {
  const { Box, Button, Text } = ui

  return (
    <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={2}>
      <Box key="band-left" flexDirection="row" alignItems="center" gap={2}>
        <Button key="open-graph" label="Git Graph" onPress={onOpen} />
        {branch === '' ? null : <Text key="current-branch" dimColor>{`⎇ ${ellipsize(branch, BRANCH_LABEL_MAX)}`}</Text>}
      </Box>
      {renderUsage(ui, usage, nowMs)}
    </Box>
  )
}
