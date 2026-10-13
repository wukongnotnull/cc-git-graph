import type { ElementTable } from 'claude-code'

import type { Commit, GraphRow } from '../../types'
import { AUTHOR_WIDTH, CHIP_LABEL_MAX, DATE_WIDTH, HASH_WIDTH, LANE_COLORS, MAX_CHIPS, ROW_HEIGHT } from '../constants'
import { ellipsize, formatDate, shortHash } from '../format'
import { chipSvg } from '../layout/chip-svg'
import type { ChipSvg } from '../layout/chip-svg'
import { graphWidthPx } from '../layout/graph-width'
import { rowSvg } from '../layout/row-svg'
import type { Actions } from './actions'
import { chipTitle, chipsOf, limitChips, visibleRefs } from './chips'
import type { Chip } from './chips'
import { darken, lighten, readableOn } from './color'
import type { ColumnPlan } from './columns'

type DesktopUi = ElementTable<'desktop'>

const TAG_COLOR = '#c98a1b'
const REMOTE_COLOR = '#6e7681'
// A remote branch with no local twin is a quiet chip: its lane colour mixed this far with white, dark text, no bold.
const REMOTE_ONLY_TINT = 0.78

export function isHeadCommit(commit: Commit): boolean {
  return commit.refs.some(ref => ref.isCurrent)
}

const WHITE = '#ffffff'
const LOCAL_SHADE = 0.12
const REMOTE_SHADE = 0.4
const MORE_COLOR = '#8b949e'

// A chip takes the colour of the lane its commit sits on, a tag is amber.
function chipColor(chip: Chip, lane: number): string {
  return chip.kind === 'tag' ? TAG_COLOR : (LANE_COLORS[lane % LANE_COLORS.length] ?? REMOTE_COLOR)
}

// Not `isInteractive`: that puts the SVG in a sandboxed frame, which reloads each time the pane redraws (every
// scroll step) and flickers. The full names of a cut chip are in the commit's detail instead.
function drawChip(ui: DesktopUi, key: string, chip: ChipSvg, alt: string) {
  const { Svg } = ui

  return <Svg key={key} source={chip.source} width={chip.width} height={chip.height} alt={alt} />
}

// An SVG pill, drawn beside the Button: the Button flattens its children to plain text, and a Text can only
// fill a rectangle. The `alt` and the <title> hold the full name.
// The remote names sit in a darker part of the same pill, so the branch reads as one chip with two parts.
function renderChip(ui: DesktopUi, chip: Chip, lane: number) {
  const { Text } = ui
  const color = chipColor(chip, lane)
  const key = `chip-${chip.kind}-${chip.label}`
  const title = chipTitle(chip)
  const marker = chip.isCurrent ? '● ' : chip.kind === 'tag' ? '◆ ' : ''
  const isRemoteOnly = chip.kind === 'remote'

  const local = isRemoteOnly ? lighten(color, REMOTE_ONLY_TINT) : darken(color, LOCAL_SHADE)
  const remote = darken(color, REMOTE_SHADE)

  const svg = chipSvg({
    label: `${marker}${ellipsize(chip.label, CHIP_LABEL_MAX)}`,
    remote: chip.remotes.length === 0 ? undefined : chip.remotes.join(' '),
    color: local,
    remoteColor: remote,
    textColor: readableOn(local),
    remoteTextColor: readableOn(remote),
    isBold: !isRemoteOnly,
    title,
  })

  return [drawChip(ui, key, svg, title), <Text key={`${key}-gap`}>{' '}</Text>]
}

function renderChips(ui: DesktopUi, commit: Commit, lane: number, isRemoteShown: boolean) {
  const { Text } = ui
  const { shown, hidden } = limitChips(chipsOf(visibleRefs(commit.refs, isRemoteShown)), MAX_CHIPS)
  const titles = hidden.map(chipTitle).join('\n')

  const more = chipSvg({ label: `+${hidden.length}`, color: MORE_COLOR, remoteColor: MORE_COLOR, textColor: WHITE, isBold: false, title: titles })

  return [
    ...shown.flatMap(chip => renderChip(ui, chip, lane)),
    hidden.length === 0 ? null : drawChip(ui, 'chips-more', more, titles),
    hidden.length === 0 ? null : <Text key="chips-more-gap">{' '}</Text>,
  ]
}

// The description starts from zero width and takes whatever the fixed columns leave, the same in every row and in
// the header; sized by its content it would be wider in a row with chips and push that row's date column along.
export function renderRow(ui: DesktopUi, commit: Commit, row: GraphRow, columns: number, plan: ColumnPlan, isRemoteShown: boolean, actions: Actions) {
  const { Box, Button, Svg, Text } = ui
  const isDim = row.isMerge

  return (
    <Box key={`row-${commit.hash}`} flexDirection="row" alignItems="center">
      <Svg
        source={rowSvg(row, columns, isHeadCommit(commit), graphWidthPx(columns))}
        width={graphWidthPx(columns)}
        height={ROW_HEIGHT}
        alt={`Graph for ${shortHash(commit.hash)}`} />
      <Box key={`description-${commit.hash}`} flexGrow={1} flexShrink={1} width={0} minWidth={0} flexDirection="row" overflow="hidden">
        <Box flexShrink={0} flexDirection="row" alignItems="center">
          {renderChips(ui, commit, row.color, isRemoteShown)}
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
