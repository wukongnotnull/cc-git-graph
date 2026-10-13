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
}

declare module 'claude-code' {
  interface PluginState {
    'cc-git-graph': { view: ViewState }
  }
}
