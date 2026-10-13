import type { ElementTable } from 'claude-code'

import type { Commit, GraphRow } from '../../types'
import { AUTHOR_WIDTH, CHIP_LABEL_MAX, DATE_WIDTH, HASH_WIDTH, LANE_COLORS, MAX_CHIPS, ROW_HEIGHT } from '../constants'
import { ellipsize, formatDate, shortHash } from '../format'
import { graphWidthPx } from '../layout/graph-width'
import { rowSvg } from '../layout/row-svg'
import type { Actions } from './actions'
import { chipsOf, limitChips } from './chips'
import type { Chip } from './chips'
import { darken } from './color'
import type { ColumnPlan } from './columns'

type DesktopUi = ElementTable<'desktop'>

const TAG_COLOR = '#c98a1b'
const REMOTE_COLOR = '#6e7681'

export function isHeadCommit(commit: Commit): boolean {
  return commit.refs.some(ref => ref.isCurrent)
}

const CHIP_TEXT = '#ffffff'
const LOCAL_SHADE = 0.12
const REMOTE_SHADE = 0.4

// A chip takes the colour of the lane its commit sits on; a remote branch with no local twin is grey, a tag amber.
function chipColor(chip: Chip, lane: number): string {
  if (chip.kind === 'tag') {
    return TAG_COLOR
  }

  return chip.kind === 'remote' ? REMOTE_COLOR : (LANE_COLORS[lane % LANE_COLORS.length] ?? REMOTE_COLOR)
}

// Drawn beside the Button, never inside it: a Button flattens its children to plain text and drops their styles.
// The remote names sit in a darker block of the same colour, so the branch reads as one chip with two parts.
function renderChip(ui: DesktopUi, chip: Chip, lane: number) {
  const { Text } = ui
  const color = chipColor(chip, lane)
  const marker = chip.isCurrent ? '● ' : chip.kind === 'tag' ? '◆ ' : ''
  const key = `chip-${chip.kind}-${chip.label}`

  return [
    <Text key={key} backgroundColor={darken(color, LOCAL_SHADE)} color={CHIP_TEXT} bold>{` ${marker}${ellipsize(chip.label, CHIP_LABEL_MAX)} `}</Text>,
    chip.remotes.length === 0 ? null : (
      <Text key={`${key}-remotes`} backgroundColor={darken(color, REMOTE_SHADE)} color={CHIP_TEXT}>{` ${chip.remotes.join(' ')} `}</Text>
    ),
    <Text key={`${key}-gap`}>{' '}</Text>,
  ]
}

function renderChips(ui: DesktopUi, commit: Commit, lane: number) {
  const { Text } = ui
  const { shown, hiddenCount } = limitChips(chipsOf(commit.refs), MAX_CHIPS)

  return [
    ...shown.flatMap(chip => renderChip(ui, chip, lane)),
    hiddenCount === 0 ? null : <Text key="chips-more" dimColor>{`+${hiddenCount} `}</Text>,
  ]
}

export function renderRow(ui: DesktopUi, commit: Commit, row: GraphRow, columns: number, plan: ColumnPlan, actions: Actions) {
  const { Box, Button, Svg, Text } = ui
  const isDim = row.isMerge

  return (
    <Box key={`row-${commit.hash}`} flexDirection="row" alignItems="center">
      <Svg
        source={rowSvg(row, columns, isHeadCommit(commit), graphWidthPx(columns))}
        width={graphWidthPx(columns)}
        height={ROW_HEIGHT}
        alt={`Graph for ${shortHash(commit.hash)}`} />
      <Box flexGrow={1} flexDirection="row" overflow="hidden">
        <Box flexShrink={0} flexDirection="row">
          {renderChips(ui, commit, row.color)}
        </Box>
        <Box flexGrow={1} flexShrink={1} overflow="hidden">
          <Button
            key={`commit-${commit.hash}`}
            plain
            dimColor={isDim}
            onPress={() => actions.toggleCommit(commit.hash)}
          >
            <Text>{commit.subject}</Text>
          </Button>
        </Box>
      </Box>
      {plan.isDateShown ? (
        <Box width={DATE_WIDTH}>
          <Text dimColor={isDim} wrap="truncate">{formatDate(commit.timestamp)}</Text>
        </Box>
      ) : null}
      {plan.isAuthorShown ? (
        <Box width={AUTHOR_WIDTH}>
          <Text dimColor={isDim} wrap="truncate">{commit.author}</Text>
        </Box>
      ) : null}
      {plan.isHashShown ? (
        <Box width={HASH_WIDTH}>
          <Text dimColor wrap="truncate">{shortHash(commit.hash)}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
