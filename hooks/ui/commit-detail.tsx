import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { shortHash } from '../format'
import type { Actions } from './actions'
import { chipTitle, chipsOf } from './chips'

type DesktopUi = ElementTable<'desktop'>

export function renderDetail(ui: DesktopUi, view: ViewState, loaded: ReadonlySet<string>, actions: Actions) {
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
  const refs = chipsOf(view.commits.find(commit => commit.hash === detail.hash)?.refs ?? []).map(chipTitle)

  return (
    <Box key="detail" flexDirection="row" gap={2} borderStyle="round" paddingX={1}>
      <Box flexDirection="column" flexGrow={1}>
        <Box>
          <Text bold>Commit: </Text>
          <Text>{detail.hash}</Text>
        </Box>
        <Box gap={1}>
          <Text bold>Parents:</Text>
          {detail.parents.map(parent =>
            loaded.has(parent) ? (
              <Button key={`parent-${parent}`} label={shortHash(parent)} onPress={() => actions.scrollToCommit(parent)} />
            ) : (
              <Text key={`parent-text-${parent}`} dimColor>{shortHash(parent)}</Text>
            ),
          )}
        </Box>
        {refs.length === 0 ? null : (
          <Box key="detail-refs">
            <Text bold>Refs: </Text>
            <Text wrap="wrap">{refs.join('   ')}</Text>
          </Box>
        )}
        <Box>
          <Text bold>Author: </Text>
          <Text>{`${detail.author} <${detail.authorEmail}>`}</Text>
        </Box>
        <Box>
          <Text bold>Committer: </Text>
          <Text>{`${detail.committer} <${detail.committerEmail}>`}</Text>
        </Box>
        <Box>
          <Text bold>Date: </Text>
          <Text>{detail.date}</Text>
        </Box>
        <Box marginTop={1}>
          <Text wrap="wrap">{detail.message}</Text>
        </Box>
        {view.detailError === '' ? null : <Text color="error">{view.detailError}</Text>}
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <Box justifyContent="flex-end">
          <Button key="close-detail" label="✕ Close" onPress={() => actions.toggleCommit(detail.hash)} />
        </Box>
        {detail.files.map(file => (
          <Box key={`file-${file.path}`} gap={1}>
            <Text wrap="truncate-middle">{file.path}</Text>
            <Text color="diffAdded">{file.added === null ? '-' : `+${file.added}`}</Text>
            <Text color="diffRemoved">{file.deleted === null ? '-' : `-${file.deleted}`}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
