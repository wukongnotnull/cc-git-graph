import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ensureGraphService } from './launch'
import { startGraphServer } from './server'

test('reuses an authenticated service for the same repository, including subdirectories', async t => {
  const base = await mkdtemp(join(tmpdir(), 'graph-launch-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const repo = join(base, 'repo with spaces')
  const cache = join(base, 'cache')
  await mkdir(join(repo, 'sub'), { recursive: true })
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
  const first = await ensureGraphService(repo, cache)
  t.after(() => first.close())
  assert.equal(first.reused, false)
  const second = await ensureGraphService(join(repo, 'sub'), cache)
  assert.equal(second.reused, true)
  assert.equal(second.url, first.url)
  const url = new URL(first.url)
  const response = await fetch(new URL('/api/identity', url), { headers: { Authorization: `Bearer ${url.hash.slice(1)}` } })
  assert.equal(response.status, 200)
  const identity = await response.json() as { application: string; repository: string }
  assert.equal(identity.application, 'wukong-git-graph')
  assert.equal(identity.repository, await import('node:fs/promises').then(fs => fs.realpath(repo)))
  const record = (await readdir(cache)).find(name => name.endsWith('.json'))!
  assert.equal((await stat(join(cache, record))).mode & 0o077, 0)
  await first.close()
  const reopened = await ensureGraphService(repo, cache)
  t.after(() => reopened.close())
  assert.equal(reopened.reused, false)
  assert.notEqual(reopened.url, first.url)
})

test('refuses to reuse a descriptor pointing at another repository or invalid URL', async t => {
  const base = await mkdtemp(join(tmpdir(), 'graph-wrong-repo-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const repo = join(base, 'requested')
  const other = join(base, 'other')
  const cache = join(base, 'cache')
  for (const directory of [repo, other]) {
    await mkdir(directory)
    execFileSync('git', ['init', '-b', 'main'], { cwd: directory })
  }
  const first = await ensureGraphService(repo, cache)
  await first.close()
  const recordName = (await readdir(cache)).find(name => name.endsWith('.json'))!
  const recordPath = join(cache, recordName)
  const record = JSON.parse(await readFile(recordPath, 'utf8')) as Record<string, unknown>
  const wrong = await startGraphServer(other)
  t.after(() => wrong.close())
  await writeFile(recordPath, JSON.stringify({ ...record, url: wrong.url }))
  const correct = await ensureGraphService(repo, cache)
  t.after(() => correct.close())
  assert.equal(correct.reused, false)
  assert.notEqual(correct.url, wrong.url)
  await correct.close()
  await writeFile(recordPath, JSON.stringify({ ...record, url: 'https://example.invalid/#bad' }))
  const recovered = await ensureGraphService(repo, cache)
  t.after(() => recovered.close())
  assert.equal(recovered.reused, false)
})

test('requires a repository and recovers from a corrupt service descriptor', async t => {
  const base = await mkdtemp(join(tmpdir(), 'graph-corrupt-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  const cache = join(base, 'cache')
  await assert.rejects(ensureGraphService(base, cache), /not a git repository/)
  execFileSync('git', ['init', '-b', 'main'], { cwd: base })
  const first = await ensureGraphService(base, cache)
  await first.close()
  const recordName = (await readdir(cache)).find(name => name.endsWith('.json'))!
  await writeFile(join(cache, recordName), '{broken')
  const recovered = await ensureGraphService(base, cache)
  t.after(() => recovered.close())
  assert.equal(recovered.reused, false)
})

test('concurrent invocations start only one service', async t => {
  const base = await mkdtemp(join(tmpdir(), 'graph-concurrent-'))
  t.after(() => rm(base, { recursive: true, force: true }))
  execFileSync('git', ['init', '-b', 'main'], { cwd: base })
  const services = await Promise.all([
    ensureGraphService(base, join(base, 'cache')),
    ensureGraphService(base, join(base, 'cache')),
  ])
  t.after(async () => { for (const service of services) await service.close() })
  assert.equal(services[0]!.url, services[1]!.url)
  assert.equal(services.filter(service => !service.reused).length, 1)
})
