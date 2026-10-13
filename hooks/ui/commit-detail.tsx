import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { shortHash } from '../format'
import type { Actions } from './actions'

type DesktopUi = ElementTable<'desktop'>

export function renderDetail(ui: DesktopUi, view: ViewState, loaded: ReadonlySet<string>, actions: Actions) {
  const { Box, Button, Text } = ui
  const detail = view.detail

  if (detail === null) {
    return (
      <Box key="detail" paddingX={1}>
        <Text dimColor={view.detailError === ''} color={view.detailError === '' ? undefined : 'error'}>
          {view.detailError === '' ? 'Loading…' : view.detailError}
        </Text>
      </Box>
    )
  }

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
              <Text dimColor>{shortHash(parent)}</Text>
            ),
          )}
        </Box>
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
          <Box gap={1}>
            <Text wrap="truncate-middle">{file.path}</Text>
            <Text color="diffAdded">{file.added === null ? '-' : `+${file.added}`}</Text>
            <Text color="diffRemoved">{file.deleted === null ? '-' : `-${file.deleted}`}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
