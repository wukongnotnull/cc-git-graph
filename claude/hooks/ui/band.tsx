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

// Every usage cell is this wide and its parts have fixed widths, so the cells of one row line up with the cells of
// the next when the band wraps. Widths are in cells.
const CELL_WIDTH = 27
const LABEL_WIDTH = 7
const PERCENT_WIDTH = 4
const COST_WIDTH = 10
// Where the ring sits in a cell; the cost cell, which has no ring, leaves the same space.
const RING_SLOT_WIDTH = 2

// The branch the session is on: the git-branch glyph and the name, plain and dimmed, with no outline or fill, so it
// does not read as a button. The glyph is an SVG in a mid grey; the name is a Text and follows the theme.
function renderBranch(ui: DesktopUi, branch: string) {
  const { Box, Svg, Text } = ui
  const icon = branchIconSvg(BRANCH_ICON_SIZE, BRANCH_ICON_COLOR)

  return (
    <Box key="current-branch" flexDirection="row" alignItems="center" gap={1}>
      <Svg source={icon.source} width={icon.width} height={icon.height} alt="Branch" />
      <Text dimColor>{ellipsize(branch, BRANCH_LABEL_MAX)}</Text>
    </Box>
  )
}

function renderMeter(ui: DesktopUi, item: UsageItem) {
  const { Box, Svg, Text } = ui
  const ring = usageRingSvg(item.percent, RING_SIZE, levelColor(item.percent))
  const percent = `${Math.round(item.percent)}%`

  return (
    <Box key={item.key} width={CELL_WIDTH} flexDirection="row" alignItems="center" gap={1}>
      <Box width={RING_SLOT_WIDTH} flexShrink={0}>
        <Svg source={ring.source} width={ring.width} height={ring.height} alt={`${item.label} ${percent}`} />
      </Box>
      <Box width={LABEL_WIDTH} flexShrink={0}>
        <Text dimColor>{item.label}</Text>
      </Box>
      <Box width={PERCENT_WIDTH} flexShrink={0}>
        <Text>{percent}</Text>
      </Box>
      {item.reset === '' ? null : <Text dimColor wrap="truncate">{`↻ ${item.reset}`}</Text>}
    </Box>
  )
}

function renderCost(ui: DesktopUi, costUsd: number) {
  const { Box, Text } = ui

  return (
    <Box key="cost" width={CELL_WIDTH} flexDirection="row" alignItems="center" gap={1}>
      <Box width={RING_SLOT_WIDTH} flexShrink={0} />
      <Box width={LABEL_WIDTH} flexShrink={0}>
        <Text dimColor>Cost</Text>
      </Box>
      <Box width={COST_WIDTH} flexShrink={0}>
        <Text>{formatCost(costUsd)}</Text>
      </Box>
    </Box>
  )
}

function renderUsage(ui: DesktopUi, usage: UsageSnapshot | undefined, nowMs: number) {
  const { Box } = ui

  if (usage === undefined) {
    return null
  }

  const items = usageItems(usage, nowMs)

  if (items.length === 0 && usage.costUsd === undefined) {
    return null
  }

  return (
    <Box key="usage" flexDirection="row" flexWrap="wrap" alignItems="center" rowGap={0}>
      {items.map(item => renderMeter(ui, item))}
      {usage.costUsd === undefined ? null : renderCost(ui, usage.costUsd)}
    </Box>
  )
}

// The button that opens the pane and the branch the session is on (nothing outside a repository) on the left;
// on the right the account's usage windows as rings, the context window and what the session has cost, in cells that
// line up when the band wraps.
export function renderBand(ui: DesktopUi, branch: string, usage: UsageSnapshot | undefined, nowMs: number, onOpen: () => void) {
  const { Box, Button } = ui

  return (
    <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" columnGap={2} rowGap={0}>
      <Box key="band-left" flexDirection="row" alignItems="center" gap={2}>
        <Button key="open-graph" label="Wukong Git Graph" onPress={onOpen} />
        {branch === '' ? null : renderBranch(ui, branch)}
      </Box>
      {renderUsage(ui, usage, nowMs)}
    </Box>
  )
}
