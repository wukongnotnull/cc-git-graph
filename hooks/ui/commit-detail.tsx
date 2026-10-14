import type { ElementTable } from 'claude-code'

import type { FileDiff, ViewState } from '../../types'
import { DETAIL_LABEL_WIDTH, DETAIL_WIDE_MIN } from '../constants'
import { shortHash } from '../format'
import type { Actions } from './actions'
import { chipTitle, chipsOf, visibleRefs } from './chips'

type DesktopUi = ElementTable<'desktop'>

// A label of fixed width and a value that takes the rest and wraps, so the values line up and a long one
// (a 64-character hash, an e-mail address) breaks inside its own column instead of under the label.
// Put it straight in a column, never in a row Box of its own: a row sizes it to its content, and the value, which
// starts from zero width, collapses to a word per line.
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

// The diff of the chosen file, drawn by the engine's own diff view (line numbers, markers, add and remove colours).
function renderFileDiff(ui: DesktopUi, diff: FileDiff | null, actions: Actions) {
  const { Box, Button, Code, Text } = ui

  if (diff === null) {
    return null
  }

  const note = (text: string, color?: string) => <Text key="file-diff-note" dimColor={color === undefined} color={color}>{text}</Text>
  let body

  if (diff.isLoading) {
    body = note('Loading…')
  } else if (diff.error !== '') {
    body = note(`Could not read this file's changes: ${diff.error}`, 'error')
  } else if (diff.isTooLarge) {
    body = note('The changes to this file are too large to show.')
  } else if (diff.text === '') {
    body = note('No text changes to show (a binary file, or only the file mode changed).')
  } else {
    body = <Code key="file-diff-code" source={diff.text} path={diff.path} format="diff" />
  }

  return (
    <Box key="file-diff" flexDirection="column">
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box flexGrow={1} flexShrink={1} width={0}>
          <Text bold wrap="truncate-middle">{diff.path}</Text>
        </Box>
        <Button key="close-file-diff" label="✕ Close diff" onPress={() => actions.toggleFileDiff(diff.path)} />
      </Box>
      {body}
      {diff.isCut ? note('The changes are long; only the first part is shown.') : null}
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
    <Box key="detail" flexDirection="column" gap={1} borderStyle="round" paddingX={1}>
      <Box key="detail-body" flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 2 : 1}>
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
          {refs.length === 0 ? null : field(ui, 'Refs:', refs.join('   '))}
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
                <Button key={`file-diff-${file.path}`} plain onPress={() => actions.toggleFileDiff(file.path)}>
                  <Text wrap="truncate-middle" bold={view.fileDiff?.path === file.path}>{`${view.fileDiff?.path === file.path ? '▾ ' : ''}${file.path}`}</Text>
                </Button>
              </Box>
              <Text color="diffAdded">{file.added === null ? '-' : `+${file.added}`}</Text>
              <Text color="diffRemoved">{file.deleted === null ? '-' : `-${file.deleted}`}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      {renderFileDiff(ui, view.fileDiff, actions)}
    </Box>
  )
}
