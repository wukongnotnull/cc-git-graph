import type { ElementTable } from 'claude-code'

import type { Commit, GraphRow } from '../../types'
import { AUTHOR_WIDTH, CHIP_LABEL_MAX, DATE_WIDTH, HASH_WIDTH, LANE_COLORS, MAX_CHIPS, ROW_HEIGHT } from '../constants'
import { ellipsize, formatDate, shortHash } from '../format'
import { chipSvg } from '../layout/chip-svg'
import type { ChipSvg } from '../layout/chip-svg'
import { graphWidthPx } from '../layout/graph-width'
import { rowSvg } from '../layout/row-svg'
import type { Actions } from './actions'
import { chipTitle, chipsOf, limitChips } from './chips'
import type { Chip } from './chips'
import { darken, readableOn } from './color'
import type { ColumnPlan } from './columns'

type DesktopUi = ElementTable<'desktop'>

const TAG_COLOR = '#c98a1b'
const REMOTE_COLOR = '#6e7681'
// A remote branch with no local twin is a quiet outline of a chip: pale, dark text, no bold.
const REMOTE_ONLY_BACKGROUND = '#d0d7de'
const REMOTE_ONLY_TEXT = '#24292f'

export function isHeadCommit(commit: Commit): boolean {
  return commit.refs.some(ref => ref.isCurrent)
}

const WHITE = '#ffffff'
const LOCAL_SHADE = 0.12
const REMOTE_SHADE = 0.4
const MORE_COLOR = '#8b949e'

// A chip takes the colour of the lane its commit sits on; a remote branch with no local twin is grey, a tag amber.
function chipColor(chip: Chip, lane: number): string {
  if (chip.kind === 'tag') {
    return TAG_COLOR
  }

  return chip.kind === 'remote' ? REMOTE_COLOR : (LANE_COLORS[lane % LANE_COLORS.length] ?? REMOTE_COLOR)
}

// `isInteractive` puts the SVG in a sandboxed frame, which is what makes its <title> show on hover; a frame costs
// more than an image, so only a chip with something to reveal gets one.
function drawChip(ui: DesktopUi, key: string, chip: ChipSvg, alt: string, hasHiddenText: boolean) {
  const { Svg } = ui

  return <Svg key={key} source={chip.source} width={chip.width} height={chip.height} alt={alt} isInteractive={hasHiddenText} />
}

// An SVG pill, drawn beside the Button: the Button flattens its children to plain text, and a Text can only
// fill a rectangle. The pill's <title> is the full name, shown by the browser on hover, so a cut name can be read.
// The remote names sit in a darker part of the same pill, so the branch reads as one chip with two parts.
function renderChip(ui: DesktopUi, chip: Chip, lane: number) {
  const { Text } = ui
  const color = chipColor(chip, lane)
  const key = `chip-${chip.kind}-${chip.label}`
  const title = chipTitle(chip)
  const marker = chip.isCurrent ? '● ' : chip.kind === 'tag' ? '◆ ' : ''
  const isRemoteOnly = chip.kind === 'remote'

  const local = isRemoteOnly ? REMOTE_ONLY_BACKGROUND : darken(color, LOCAL_SHADE)
  const remote = darken(color, REMOTE_SHADE)

  const svg = chipSvg({
    label: `${marker}${ellipsize(chip.label, CHIP_LABEL_MAX)}`,
    remote: chip.remotes.length === 0 ? undefined : chip.remotes.join(' '),
    color: local,
    remoteColor: remote,
    textColor: isRemoteOnly ? REMOTE_ONLY_TEXT : readableOn(local),
    remoteTextColor: readableOn(remote),
    isBold: !isRemoteOnly,
    title,
  })

  return [drawChip(ui, key, svg, title, chip.label.length > CHIP_LABEL_MAX), <Text key={`${key}-gap`}>{' '}</Text>]
}

function renderChips(ui: DesktopUi, commit: Commit, lane: number) {
  const { Text } = ui
  const { shown, hidden } = limitChips(chipsOf(commit.refs), MAX_CHIPS)
  const titles = hidden.map(chipTitle).join('\n')

  const more = chipSvg({ label: `+${hidden.length}`, color: MORE_COLOR, remoteColor: MORE_COLOR, textColor: WHITE, isBold: false, title: titles })

  return [
    ...shown.flatMap(chip => renderChip(ui, chip, lane)),
    hidden.length === 0 ? null : drawChip(ui, 'chips-more', more, titles, true),
    hidden.length === 0 ? null : <Text key="chips-more-gap">{' '}</Text>,
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
        <Box flexShrink={0} flexDirection="row" alignItems="center">
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
