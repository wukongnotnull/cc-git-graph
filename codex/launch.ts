import { createHash, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { readGit } from './repository'
import { startGraphServer } from './server'

type GraphService = { url: string; reused: boolean; close(): Promise<void> }
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const reused = (url: string): GraphService => ({ url, reused: true, close: async () => {} })

async function existingService(record: string, repository: string): Promise<GraphService | null> {
  try {
    if ((await stat(record)).size > 16_384) return null
    const data: unknown = JSON.parse(await readFile(record, 'utf8'))
    if (!isObject(data) || data.repository !== repository || typeof data.url !== 'string') return null
    // Never send a cached credential to an arbitrary host or accept a different local application.
    if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/#(?:[a-f0-9]{48})$/.test(data.url)) return null
    const url = new URL(data.url)
    const response = await fetch(new URL('/api/identity', url), {
      headers: { Authorization: `Bearer ${url.hash.slice(1)}` }, signal: AbortSignal.timeout(1_000), redirect: 'error',
    })
    if (!response.ok) return null
    const identity: unknown = await response.json()
    return isObject(identity) && identity.application === 'wukong-git-graph' && identity.protocol === 1 && identity.repository === repository
      ? reused(data.url) : null
  } catch { return null }
}

export async function ensureGraphService(directory: string, cacheDirectory = join(tmpdir(), `wukong-git-graph-${process.getuid?.() ?? 'user'}`)): Promise<GraphService> {
  const repository = await realpath((await readGit(directory, ['rev-parse', '--show-toplevel'])).replace(/\n$/, ''))
  await mkdir(cacheDirectory, { recursive: true, mode: 0o700 })
  await chmod(cacheDirectory, 0o700)
  const record = join(cacheDirectory, `${createHash('sha256').update(repository).digest('hex')}.json`)
  const existing = await existingService(record, repository)
  if (existing) return existing
  const lock = `${record}.lock`
  let locked = false
  for (let attempt = 0; attempt < 30 && !locked; attempt++) {
    try { await mkdir(lock); locked = true }
    catch (error) {
      if (!isObject(error) || error.code !== 'EEXIST') throw error
      const started = await existingService(record, repository)
      if (started) return started
      // An interrupted startup can leave a lock but never a reusable service record.
      try {
        if (Date.now() - (await stat(lock)).mtimeMs > 30_000) await rm(lock, { recursive: true, force: true })
      } catch (failure) {
        if (!isObject(failure) || failure.code !== 'ENOENT') throw failure
      }
      await delay(100)
    }
  }
  if (!locked) throw new Error('Another Wukong Git Graph is starting. Try again shortly.')
  try {
    const started = await existingService(record, repository)
    if (started) return started
    const service = await startGraphServer(repository)
    const temporary = `${record}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(temporary, JSON.stringify({ repository, url: service.url }), { mode: 0o600 })
      await rename(temporary, record)
    } catch (error) {
      await service.close()
      throw error
    } finally { await rm(temporary, { force: true }) }
    let closed = false
    return {
      url: service.url, reused: false,
      close: async () => { if (!closed) { closed = true; await service.close() } },
    }
  } finally { await rm(lock, { recursive: true, force: true }) }
}
