import type { Commit, CommitDetail } from '../claude/types'
import type { FileDiffText } from '../claude/hooks/git/parse-diff'

export type Branch = { ref: string; name: string; remote: boolean }
export type Branches = { branches: Branch[]; current: string }
export type Page = { commits: Commit[]; hasMore: boolean }
export type GraphState = Branches & Page & {
  branch: string
  remote: boolean
  start: number
  detail: CommitDetail | null
  diff: (FileDiffText & { path: string }) | null
  error: string
  busy: boolean
}
