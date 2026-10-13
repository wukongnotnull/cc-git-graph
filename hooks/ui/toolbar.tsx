import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { visibleBranches } from '../branches'
import { ALL_BRANCHES } from '../constants'
import type { Actions } from './actions'

type DesktopUi = ElementTable<'desktop'>

export function renderToolbar(ui: DesktopUi, view: ViewState, actions: Actions) {
  const { Box, Button, Select } = ui
  const options = [
    { value: ALL_BRANCHES, label: 'Show All' },
    ...visibleBranches(view).map(name => ({ value: name, label: name })),
  ]

  return (
    <Box flexDirection="row" flexWrap="wrap" gap={2} alignItems="center" justifyContent="space-between">
      <Box flexDirection="row" flexWrap="wrap" gap={2} alignItems="center">
        <Select
          key="branch"
          label="Branches:"
          options={options}
          value={view.branch}
          onSelect={value => actions.selectBranch(value)}
        />
        <Button
          key="remote"
          label={`${view.isRemoteShown ? '☑' : '☐'} Show Remote Branches`}
          onPress={() => actions.toggleRemote()}
        />
      </Box>
      <Button key="refresh" label="↻ Refresh" onPress={() => actions.refresh()} />
    </Box>
  )
}
