import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { AUTHOR_WIDTH, DATE_WIDTH, HASH_WIDTH } from '../constants'
import { graphCells } from '../layout/graph-width'
import { columnCount } from '../layout/lanes'
import { windowEnd } from '../layout/window'
import { planColumns } from './columns'
import type { ColumnPlan } from './columns'
import type { Actions } from './actions'
import { renderDetail } from './commit-detail'
import { renderRow } from './commit-row'
import { renderToolbar } from './toolbar'

type DesktopUi = ElementTable<'desktop'>

function renderHeader(ui: DesktopUi, columns: number, plan: ColumnPlan) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row">
      <Box width={graphCells(columns)}>
        <Text bold>Graph</Text>
      </Box>
      <Box key="description-header" flexGrow={1} flexShrink={1} width={0} minWidth={0}>
        <Text bold>Description</Text>
      </Box>
      {plan.isDateShown ? (
        <Box width={DATE_WIDTH}>
          <Text bold>Date</Text>
        </Box>
      ) : null}
      {plan.isAuthorShown ? (
        <Box width={AUTHOR_WIDTH}>
          <Text bold>Author</Text>
        </Box>
      ) : null}
      {plan.isHashShown ? (
        <Box width={HASH_WIDTH}>
          <Text bold>Commit</Text>
        </Box>
      ) : null}
    </Box>
  )
}

const describeFailure = (view: ViewState): string =>
  view.status === 'error' ? `无法读取 Git 历史:${view.errorMessage}` : view.errorMessage

function renderList(ui: DesktopUi, view: ViewState, actions: Actions, bodyColumns: number) {
  const { Box, Button, Text } = ui
  const columns = columnCount(view.rows)
  const plan = planColumns(bodyColumns, graphCells(columns))
  const end = windowEnd(view, view.windowStart)
  const shown = view.commits.slice(view.windowStart, end)
  const drawn = new Set(shown.map(commit => commit.hash))

  const items = shown.flatMap((commit, index) => {
    const row = view.rows[view.windowStart + index]

    if (row === undefined) {
      return []
    }

    const parts = [renderRow(ui, commit, row, columns, plan, view.isRemoteShown, actions)]

    if (view.expandedHash === commit.hash) {
      parts.push(renderDetail(ui, view, drawn, actions, bodyColumns))
    }

    return parts
  })

  const hasNewer = view.windowStart > 0
  const hasOlder = end < view.commits.length || view.hasMore

  return (
    <Box flexDirection="column">
      {renderHeader(ui, columns, plan)}
      {hasNewer ? <Button key="newer" label="↑ 较新的提交" onPress={() => actions.showNewer()} /> : null}
      {items}
      {view.errorMessage === '' ? null : <Text color="error">{describeFailure(view)}</Text>}
      {hasOlder ? <Button key="more" label="加载更多" onPress={() => actions.showOlder()} /> : null}
    </Box>
  )
}

function renderBody(ui: DesktopUi, view: ViewState, actions: Actions, bodyColumns: number) {
  const { Text } = ui
  const isLoading = view.status === 'idle' || (view.status === 'loading' && view.commits.length === 0)

  if (isLoading) {
    return <Text dimColor>Loading…</Text>
  }

  if (view.status === 'no-repo') {
    return <Text>当前目录不是 Git 仓库。</Text>
  }

  if (view.status === 'error' && view.commits.length === 0) {
    return <Text color="error">{describeFailure(view)}</Text>
  }

  if (view.commits.length === 0) {
    return <Text dimColor>这个仓库还没有提交。</Text>
  }

  return renderList(ui, view, actions, bodyColumns)
}

export function renderPane(ui: DesktopUi, view: ViewState, actions: Actions, bodyColumns: number) {
  const { Box } = ui

  return (
    <Box flexDirection="column" gap={1}>
      {renderToolbar(ui, view, actions)}
      {renderBody(ui, view, actions, bodyColumns)}
    </Box>
  )
}
