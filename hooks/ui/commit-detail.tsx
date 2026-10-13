import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { DETAIL_LABEL_WIDTH, DETAIL_WIDE_MIN } from '../constants'
import { shortHash } from '../format'
import type { Actions } from './actions'
import { chipTitle, chipsOf, visibleRefs } from './chips'

type DesktopUi = ElementTable<'desktop'>

// A label of fixed width and a value that takes the rest and wraps, so the values line up and a long one
// (a 64-character hash, an e-mail address) breaks inside its own column instead of under the label.
function field(ui: DesktopUi, label: string, value: string) {
  const { Box, Text } = ui

  return (
    <Box key={`field-${label}`} flexDirection="row" gap={1}>
      <Box width={DETAIL_LABEL_WIDTH} flexShrink={0}>
        <Text bold>{label}</Text>
      </Box>
      <Box flexGrow={1} flexShrink={1} width={0}>
        <Text wrap="wrap">{value}</Text>
      </Box>
    </Box>
  )
}

export function renderDetail(ui: DesktopUi, view: ViewState, loaded: ReadonlySet<string>, actions: Actions, bodyColumns: number) {
  const { Box, Button, Text } = ui
  const detail = view.detail

  if (detail === null) {
    const hash = view.expandedHash ?? ''
    const isFailed = view.detailError !== ''

    return (
      <Box key="detail" flexDirection="row" gap={2} paddingX={1}>
        <Text dimColor={!isFailed} color={isFailed ? 'error' : undefined}>
          {isFailed ? view.detailError : 'Loading…'}
        </Text>
        <Button key="close-detail" label="✕ Close" onPress={() => actions.toggleCommit(hash)} />
      </Box>
    )
  }

  // Chips in the row cut long names and hide extra refs; here every one is spelled out.
  const refs = chipsOf(visibleRefs(view.commits.find(commit => commit.hash === detail.hash)?.refs ?? [], view.isRemoteShown)).map(chipTitle)

  const isWide = bodyColumns >= DETAIL_WIDE_MIN
  const close = <Button key="close-detail" label="✕ Close" onPress={() => actions.toggleCommit(detail.hash)} />

  return (
    <Box key="detail" flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 2 : 1} borderStyle="round" paddingX={1}>
      <Box key="detail-fields" flexDirection="column" flexGrow={1} flexShrink={1} width={isWide ? 0 : undefined}>
        {isWide ? null : <Box justifyContent="flex-end">{close}</Box>}
        {field(ui, 'Commit:', detail.hash)}
        <Box flexDirection="row" gap={1}>
          <Box width={DETAIL_LABEL_WIDTH} flexShrink={0}>
            <Text bold>Parents:</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1} width={0} flexDirection="row" flexWrap="wrap" gap={1}>
            {detail.parents.map(parent =>
              loaded.has(parent) ? (
                <Button key={`parent-${parent}`} label={shortHash(parent)} onPress={() => actions.scrollToCommit(parent)} />
              ) : (
                <Text key={`parent-text-${parent}`} dimColor>{shortHash(parent)}</Text>
              ),
            )}
          </Box>
        </Box>
        {refs.length === 0 ? null : <Box key="detail-refs">{field(ui, 'Refs:', refs.join('   '))}</Box>}
        {field(ui, 'Author:', `${detail.author} <${detail.authorEmail}>`)}
        {field(ui, 'Committer:', `${detail.committer} <${detail.committerEmail}>`)}
        {field(ui, 'Date:', detail.date)}
        <Box marginTop={1}>
          <Text wrap="wrap">{detail.message}</Text>
        </Box>
        {view.detailError === '' ? null : <Text color="error">{view.detailError}</Text>}
      </Box>
      <Box key="detail-files" flexDirection="column" flexGrow={1} flexShrink={1} width={isWide ? 0 : undefined}>
        {isWide ? <Box justifyContent="flex-end">{close}</Box> : null}
        {detail.files.map(file => (
          <Box key={`file-${file.path}`} flexDirection="row" gap={1}>
            <Box flexGrow={1} flexShrink={1} width={0}>
              <Text wrap="truncate-middle">{file.path}</Text>
            </Box>
            <Text color="diffAdded">{file.added === null ? '-' : `+${file.added}`}</Text>
            <Text color="diffRemoved">{file.deleted === null ? '-' : `-${file.deleted}`}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
