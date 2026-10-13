import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { AUTHOR_WIDTH, CELL_WIDTH_PX, DATE_WIDTH, HASH_WIDTH, LANE_WIDTH } from '../constants'
import { columnCount } from '../layout/lanes'
import type { Actions } from './actions'
import { renderDetail } from './commit-detail'
import { renderRow } from './commit-row'
import { renderToolbar } from './toolbar'

type DesktopUi = ElementTable<'desktop'>

function renderHeader(ui: DesktopUi, columns: number) {
  const { Box, Text } = ui
  const graphCells = Math.ceil((columns * LANE_WIDTH) / CELL_WIDTH_PX)

  return (
    <Box flexDirection="row">
      <Box width={graphCells}>
        <Text bold>Graph</Text>
      </Box>
      <Box flexGrow={1}>
        <Text bold>Description</Text>
      </Box>
      <Box width={DATE_WIDTH}>
        <Text bold>Date</Text>
      </Box>
      <Box width={AUTHOR_WIDTH}>
        <Text bold>Author</Text>
      </Box>
      <Box width={HASH_WIDTH}>
        <Text bold>Commit</Text>
      </Box>
    </Box>
  )
}

function renderList(ui: DesktopUi, view: ViewState, actions: Actions) {
  const { Box, Button, Text } = ui
  const columns = columnCount(view.rows)
  const loaded = new Set(view.commits.map(commit => commit.hash))

  const items = view.commits.flatMap((commit, index) => {
    const row = view.rows[index]

    if (row === undefined) {
      return []
    }

    const parts = [renderRow(ui, commit, row, columns, actions)]

    if (view.expandedHash === commit.hash) {
      parts.push(renderDetail(ui, view, loaded, actions))
    }

    return parts
  })

  return (
    <Box flexDirection="column">
      {renderHeader(ui, columns)}
      {items}
      {view.errorMessage === '' ? null : <Text color="error">{view.errorMessage}</Text>}
      {view.hasMore ? <Button key="more" label="加载更多" onPress={() => actions.loadMore()} /> : null}
    </Box>
  )
}

function renderBody(ui: DesktopUi, view: ViewState, actions: Actions) {
  const { Text } = ui
  const isLoading = view.status === 'idle' || (view.status === 'loading' && view.commits.length === 0)

  if (isLoading) {
    return <Text dimColor>Loading…</Text>
  }

  if (view.status === 'no-repo') {
    return <Text>当前目录不是 Git 仓库。</Text>
  }

  if (view.status === 'error') {
    return <Text color="error">{`无法读取 Git 历史:${view.errorMessage}`}</Text>
  }

  if (view.commits.length === 0) {
    return <Text dimColor>这个仓库还没有提交。</Text>
  }

  return renderList(ui, view, actions)
}

export function renderPane(ui: DesktopUi, view: ViewState, actions: Actions) {
  const { Box } = ui

  return (
    <Box flexDirection="column" gap={1}>
      {renderToolbar(ui, view, actions)}
      {renderBody(ui, view, actions)}
    </Box>
  )
}
