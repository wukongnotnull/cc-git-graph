import type { GraphApi } from './graph-app'
export const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): boolean => Array.isArray(value) && value.every(item => typeof item === 'string')
const fields = (value: Record<string, unknown>, names: string[]): boolean => names.every(name => typeof value[name] === 'string')
const arrayOf = (value: unknown, check: (item: Record<string, unknown>) => boolean): boolean => Array.isArray(value) && value.every(item => object(item) && check(item))
function valid(operation: string, data: unknown): boolean {
  if (!object(data)) return false
  if (operation === 'branches') return typeof data.current === 'string' && arrayOf(data.branches, b => fields(b, ['ref', 'name']) && typeof b.remote === 'boolean')
  if (operation === 'commits') return typeof data.hasMore === 'boolean' && arrayOf(data.commits, c => fields(c, ['hash', 'author', 'subject']) && strings(c.parents) && typeof c.timestamp === 'number' && Number.isFinite(c.timestamp) && arrayOf(c.refs, r => fields(r, ['name']) && ['branch', 'remote', 'tag', 'head'].includes(String(r.kind)) && typeof r.isCurrent === 'boolean'))
  if (operation === 'detail') return fields(data, ['hash', 'author', 'authorEmail', 'committer', 'committerEmail', 'date', 'message']) && strings(data.parents) && arrayOf(data.files, f => typeof f.path === 'string' && ['added', 'deleted'].every(key => f[key] === null || typeof f[key] === 'number'))
  return operation === 'diff' && typeof data.text === 'string' && typeof data.isCut === 'boolean' && typeof data.isTooLarge === 'boolean'
}
export function graphApi(graphId: string, call: (name: string, args: Record<string, unknown>) => Promise<unknown>): GraphApi {
  return async <T>(path: string, query: Record<string, string> = {}): Promise<T> => {
    const operation = path.replace('/api/', '')
    if (!['branches', 'commits', 'detail', 'diff'].includes(operation)) throw new Error('Unknown graph operation.')
    const args: Record<string, unknown> = { graphId, operation }
    if (operation === 'commits') Object.assign(args, { branch: query.branch ?? '', remote: query.remote !== 'false', offset: Number(query.offset ?? 0) })
    if (operation === 'detail' || operation === 'diff') args.hash = query.hash
    if (operation === 'diff') args.path = query.path
    const response = await call('read_git_graph', args)
    if (!object(response) || !object(response.structuredContent) || !valid(operation, response.structuredContent.data)) throw new Error('Invalid Wukong Git Graph response.')
    return response.structuredContent.data as T
  }
}
