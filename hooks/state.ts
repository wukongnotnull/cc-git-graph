import type { ViewState } from '../types'
import { ALL_BRANCHES } from './constants'
import { emptyLaneState } from './layout/lanes'

export const initialView: ViewState = {
  status: 'idle',
  errorMessage: '',
  commits: [],
  rows: [],
  laneState: emptyLaneState(),
  hasMore: false,
  branches: [],
  remoteBranches: [],
  branch: ALL_BRANCHES,
  isRemoteShown: true,
  expandedHash: null,
  detail: null,
  detailError: '',
  generation: 0,
  windowStart: 0,
  windowStack: [],
}
