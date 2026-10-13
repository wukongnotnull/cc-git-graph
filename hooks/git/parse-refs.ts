import type { Ref } from '../../types'

const HEAD_ARROW = 'HEAD -> '
const TAG_PREFIX = 'tag: '

export function parseRefs(raw: string, remoteNames: ReadonlySet<string>): Ref[] {
  const text = raw.trim()

  if (text === '') {
    return []
  }

  return text.split(', ').map((part): Ref => {
    const item = part.trim()

    if (item.startsWith(HEAD_ARROW)) {
      return { name: item.slice(HEAD_ARROW.length), kind: 'branch', isCurrent: true }
    }

    if (item === 'HEAD') {
      return { name: 'HEAD', kind: 'head', isCurrent: true }
    }

    if (item.startsWith(TAG_PREFIX)) {
      return { name: item.slice(TAG_PREFIX.length), kind: 'tag', isCurrent: false }
    }

    const isRemote = remoteNames.has(item) || item.endsWith('/HEAD')

    return { name: item, kind: isRemote ? 'remote' : 'branch', isCurrent: false }
  })
}
