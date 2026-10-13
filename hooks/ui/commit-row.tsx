import type { ElementTable } from 'claude-code'

import type { Commit, GraphRow, RefKind } from '../../types'
import { AUTHOR_WIDTH, DATE_WIDTH, HASH_WIDTH, LANE_WIDTH, ROW_HEIGHT } from '../constants'
import { formatDate, shortHash } from '../format'
import { rowSvg } from '../layout/row-svg'
import type { Actions } from './actions'

type DesktopUi = ElementTable<'desktop'>

const BADGE_COLORS: Record<RefKind, string> = {
  branch: 'suggestion',
  remote: 'permission',
  tag: 'warning',
  head: 'error',
}

export function isHeadCommit(commit: Commit): boolean {
  return commit.refs.some(ref => ref.isCurrent)
}

export function renderRow(ui: DesktopUi, commit: Commit, row: GraphRow, columns: number, actions: Actions) {
  const { Box, Button, Svg, Text } = ui
  const isDim = row.isMerge

  return (
    <Box key={`row-${commit.hash}`} flexDirection="row" alignItems="center">
      <Svg
        source={rowSvg(row, columns, isHeadCommit(commit))}
        width={columns * LANE_WIDTH}
        height={ROW_HEIGHT}
        alt={`Graph for ${shortHash(commit.hash)}`} />
      <Box flexGrow={1} overflow="hidden">
        <Button
          key={`commit-${commit.hash}`}
          plain
          dimColor={isDim}
          onPress={() => actions.toggleCommit(commit.hash)}
        >
          {commit.refs.map(ref => (
            <Text key={`badge-${ref.kind}-${ref.name}`} inverse color={BADGE_COLORS[ref.kind]}>{` ${ref.name} `}</Text>
          ))}
          <Text>{` ${commit.subject}`}</Text>
        </Button>
      </Box>
      <Box width={DATE_WIDTH}>
        <Text dimColor={isDim} wrap="truncate">{formatDate(commit.timestamp)}</Text>
      </Box>
      <Box width={AUTHOR_WIDTH}>
        <Text dimColor={isDim} wrap="truncate">{commit.author}</Text>
      </Box>
      <Box width={HASH_WIDTH}>
        <Text dimColor wrap="truncate">{shortHash(commit.hash)}</Text>
      </Box>
    </Box>
  )
}
