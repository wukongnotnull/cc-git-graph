import type { Ref, RefKind } from '../../types'

export type Chip = {
  label: string
  // Remotes that carry the same branch (`origin` for `origin/main`), drawn inside the local branch's chip.
  remotes: string[]
  kind: RefKind
  isCurrent: boolean
}

const remoteOf = (name: string): string => name.slice(0, Math.max(name.indexOf('/'), 0))
const branchOf = (name: string): string => name.slice(name.indexOf('/') + 1)

// One chip per local branch, tag or HEAD; a remote branch joins the local branch of the same name
// when that branch sits on the same commit, and stands alone otherwise.
export function chipsOf(refs: readonly Ref[]): Chip[] {
  const locals = new Set(refs.filter(ref => ref.kind === 'branch').map(ref => ref.name))
  const joined = (ref: Ref): boolean => ref.kind === 'remote' && !ref.name.endsWith('/HEAD') && locals.has(branchOf(ref.name))

  return refs
    .filter(ref => !joined(ref))
    .map((ref): Chip => ({
      label: ref.name,
      remotes:
        ref.kind === 'branch'
          ? refs.filter(other => joined(other) && branchOf(other.name) === ref.name).map(other => remoteOf(other.name))
          : [],
      kind: ref.kind,
      isCurrent: ref.isCurrent,
    }))
}

// The chips a row has room for; the rest are counted, not drawn.
export function limitChips(chips: readonly Chip[], max: number): { shown: Chip[]; hidden: Chip[] } {
  return { shown: chips.slice(0, max), hidden: chips.slice(max) }
}

// The full name of a chip, remotes included: `main (origin)`.
export const chipTitle = (chip: Chip): string =>
  chip.remotes.length === 0 ? chip.label : `${chip.label} (${chip.remotes.join(', ')})`

// git decorates a commit with its remote branches whether or not `--remotes` was asked for, so the
// "Show Remote Branches" switch has to drop them from what is drawn too.
export const visibleRefs = (refs: readonly Ref[], isRemoteShown: boolean): Ref[] =>
  isRemoteShown ? [...refs] : refs.filter(ref => ref.kind !== 'remote')
