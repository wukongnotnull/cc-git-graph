import { mountGraph } from './graph-app'
const token = location.hash.slice(1)
// Responses come only from this bundled local server; the server validates all request parameters.
async function api<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const response = await fetch(`${path}?${new URLSearchParams(query)}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45_000),
  })
  const data: unknown = await response.json()
  if (!response.ok) {
    throw new Error(typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
      ? data.error : 'Could not read the Git history.')
  }
  return data as T
}


mountGraph(api, document.getElementById('app')!)
