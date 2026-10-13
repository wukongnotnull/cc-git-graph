import type { ElementTable } from 'claude-code'

import type { Commit, GraphRow } from '../../types'
import { AUTHOR_WIDTH, DATE_WIDTH, HASH_WIDTH, LANE_COLORS, ROW_HEIGHT } from '../constants'
import { formatDate, shortHash } from '../format'
import { graphWidthPx } from '../layout/graph-width'
import { rowSvg } from '../layout/row-svg'
import type { Actions } from './actions'
import { chipsOf } from './chips'
import type { Chip } from './chips'
import type { ColumnPlan } from './columns'

type DesktopUi = ElementTable<'desktop'>

const TAG_COLOR = '#c98a1b'
const REMOTE_COLOR = '#6e7681'

export function isHeadCommit(commit: Commit): boolean {
  return commit.refs.some(ref => ref.isCurrent)
}

// A chip takes the colour of the lane its commit sits on; a remote branch with no local twin is grey, a tag amber.
function chipColor(chip: Chip, lane: number): string {
  if (chip.kind === 'tag') {
    return TAG_COLOR
  }

  return chip.kind === 'remote' ? REMOTE_COLOR : (LANE_COLORS[lane % LANE_COLORS.length] ?? REMOTE_COLOR)
}

// Sibling Texts, not a wrapping one: the Button lays them out inline, as it did the bracketed names.
function renderChip(ui: DesktopUi, chip: Chip, lane: number) {
  const { Text } = ui
  const color = chipColor(chip, lane)
  const prefix = chip.kind === 'tag' ? '◆ ' : ''
  const key = `chip-${chip.kind}-${chip.label}`

  return [
    <Text key={key} color={color} inverse bold underline={chip.isCurrent}>{` ${prefix}${chip.label} `}</Text>,
    chip.remotes.length === 0 ? null : (
      <Text key={`${key}-remotes`} color={color} inverse italic>{`${chip.remotes.join(' ')} `}</Text>
    ),
    <Text key={`${key}-gap`}>{' '}</Text>,
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
      <Box flexGrow={1} overflow="hidden">
        <Button
          key={`commit-${commit.hash}`}
          plain
          dimColor={isDim}
          onPress={() => actions.toggleCommit(commit.hash)}
        >
          {chipsOf(commit.refs).flatMap(chip => renderChip(ui, chip, row.color))}
          <Text>{` ${commit.subject}`}</Text>
        </Button>
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
