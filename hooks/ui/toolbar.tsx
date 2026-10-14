import type { ElementTable } from 'claude-code'

import type { ViewState } from '../../types'
import { branchOptions } from '../branches'
import type { Actions } from './actions'

type DesktopUi = ElementTable<'desktop'>

export function renderToolbar(ui: DesktopUi, view: ViewState, actions: Actions) {
  const { Box, Button, Select } = ui
  const options = branchOptions(view)

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
