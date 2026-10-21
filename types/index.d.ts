export type RefKind = 'branch' | 'remote' | 'tag' | 'head'

export type Ref = {
  name: string
  kind: RefKind
  isCurrent: boolean
}

export type Commit = {
  hash: string
  parents: string[]
  author: string
  timestamp: number
  subject: string
  refs: Ref[]
}

export type Edge = { from: number; to: number; color: number }

export type GraphRow = {
  hash: string
  lane: number
  color: number
  isMerge: boolean
  through: Edge[]
  incoming: Edge[]
  outgoing: Edge[]
}

export type LaneState = {
  lanes: (string | null)[]
  colors: number[]
  nextColor: number
}

export type FileChange = {
  path: string
  added: number | null
  deleted: number | null
}

// The diff of one file of the open commit, shown under the detail card.
export type FileDiff = {
  path: string
  text: string
  isCut: boolean
  isTooLarge: boolean
  error: string
  isLoading: boolean
}

export type CommitDetail = {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  committer: string
  committerEmail: string
  date: string
  message: string
  files: FileChange[]
}

// What the band above the prompt shows of the account's usage and the session's context and cost.
export type UsageSnapshot = {
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  contextPercent?: number
  costUsd?: number
}

export type ViewStatus = 'idle' | 'loading' | 'ready' | 'no-repo' | 'error'

export type ViewState = {
  status: ViewStatus
  errorMessage: string
  commits: Commit[]
  rows: GraphRow[]
  laneState: LaneState
  hasMore: boolean
  branches: string[]
  remoteBranches: string[]
  branch: string
  isRemoteShown: boolean
  expandedHash: string | null
  detail: CommitDetail | null
  detailError: string
  fileDiff: FileDiff | null
  generation: number
  // The pane draws the rows from `windowStart` on, as many as fit; `windowStack` holds the starts it left behind.
  windowStart: number
  windowStack: number[]
}

declare module 'claude-code' {
  interface PluginState {
    'wukong-git-graph': { view: ViewState; branch: string; usage: UsageSnapshot }
  }
}
