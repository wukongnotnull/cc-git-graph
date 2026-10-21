import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ListRootsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { createGraphMcpServer } from './mcp-server'
import type { Branches, Page } from './protocol'
import type { CommitDetail } from '../claude/types'
import type { FileDiffText } from '../claude/hooks/git/parse-diff'

const uri = 'ui://wukong-git-graph/panel-v1.html'
const html = '<!doctype html><html><body>Wukong Git Graph<script>/* bundled */</script></body></html>'
type OpenGraph = Branches & Page & {graphId: string; repository: string}

async function repository(t: TestContext, commits = 1) {
  const directory = await mkdtemp(join(tmpdir(), 'cc-mcp-'))
  t.after(() => rm(directory, {recursive: true, force: true}))
  const git = (...args: string[]) => execFileSync('git', args, {cwd: directory, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim()
  git('init', '-b', 'main')
  git('config', 'user.name', 'MCP Test')
  git('config', 'user.email', 'mcp@example.test')
  if (commits) {
    await mkdir(join(directory, 'sub'))
    await writeFile(join(directory, 'sub/literal[1].txt'), 'literal content\n')
    git('add', '.')
    git('commit', '-m', 'First commit')
    for (let i = 1; i < commits; i++) git('commit', '--allow-empty', '-m', `Commit ${i}`)
  }
  return {directory, git}
}

async function connect(t: TestContext, options: Parameters<typeof createGraphMcpServer>[0] = {}, roots?: string[]) {
  const server = createGraphMcpServer({readPanel: async () => html, ...options})
  const client = new Client({name: 'graph-check', version: '1'}, {capabilities: roots ? {roots: {}} : {}})
  if (roots) client.setRequestHandler(ListRootsRequestSchema, async () => ({roots: roots.map(path => ({uri: pathToFileURL(path).href}))}))
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  t.after(async () => { await client.close(); await server.close() })
  return client
}

async function invoke(client: Client, name: string, args: Record<string, unknown> = {}) {
  return await client.callTool({name, arguments: args}) as CallToolResult
}
async function open(client: Client, args: Record<string, unknown> = {}): Promise<OpenGraph> {
  const result = await invoke(client, 'open_git_graph', args)
  assert.notEqual(result.isError, true, JSON.stringify(result.content))
  return { ...result.structuredContent, ...(result._meta?.graph as Branches & Page) } as OpenGraph
}
async function read<T>(client: Client, graphId: string, operation: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await invoke(client, 'read_git_graph', {graphId, operation, ...args})
  assert.notEqual(result.isError, true, JSON.stringify(result.content))
  return result.structuredContent!.data as T
}
async function fails(client: Client, name: string, args: Record<string, unknown>, pattern: RegExp) {
  const result = await invoke(client, name, args)
  assert.equal(result.isError, true, JSON.stringify(result))
  assert.match(JSON.stringify(result.content), pattern)
}

test('MCP open keeps initial history and branches out of model-readable results', async t => {
  const {directory, git} = await repository(t)
  git('branch', 'private-branch-name')
  const client = await connect(t, {defaultRepository: directory})
  const result = await invoke(client, 'open_git_graph')
  assert.notEqual(result.isError, true, JSON.stringify(result.content))
  assert.deepEqual(Object.keys(result.structuredContent!).sort(), ['graphId', 'repository'])
  const modelReadable = JSON.stringify({content: result.content, structuredContent: result.structuredContent})
  assert.doesNotMatch(modelReadable, /First commit|private-branch-name|MCP Test|mcp@example\.test/)
  const graph = result._meta?.graph as Branches & Page
  assert.equal(graph.current, 'main')
  assert.ok(graph.branches.some(branch => branch.name === 'private-branch-name'))
  assert.equal(graph.commits[0]?.subject, 'First commit')
  assert.equal(graph.hasMore, false)
})

test('MCP open and app-only reads expose real history, filters, paging, detail and literal diff without writes', async t => {
  const {directory, git} = await repository(t, 52)
  const root = git('rev-list', '--max-parents=0', 'HEAD')
  git('branch', 'side', root)
  git('update-ref', 'refs/remotes/origin/side', root)
  const before = git('status', '--porcelain=v1', '--untracked-files=all')
  const refsBefore = git('show-ref')
  const client = await connect(t, {defaultRepository: directory})
  const graph = await open(client)
  assert.equal(graph.repository, await realpath(directory))
  assert.match(graph.graphId, /^[a-f0-9]{48}$/)
  assert.equal(graph.current, 'main')
  assert.equal(graph.commits.length, 50)
  assert.equal(graph.hasMore, true)
  const older = await read<Page>(client, graph.graphId, 'commits', {offset: 50})
  assert.equal(older.commits.length, 2)
  assert.equal(older.commits[1]?.hash, root)
  assert.equal(older.hasMore, false)
  const side = await read<Page>(client, graph.graphId, 'commits', {branch: 'refs/heads/side'})
  assert.equal(side.commits.length, 1)
  assert.equal(side.commits[0]?.hash, root)
  const local = await read<Page>(client, graph.graphId, 'commits', {remote: false, offset: 50})
  assert.ok(local.commits.every(commit => commit.refs.every(ref => ref.kind !== 'remote')))
  const branches = await read<Branches>(client, graph.graphId, 'branches')
  assert.ok(branches.branches.some(branch => branch.remote))
  const detail = await read<CommitDetail>(client, graph.graphId, 'detail', {hash: root})
  assert.equal(detail.message, 'First commit')
  assert.equal(detail.files[0]?.path, 'sub/literal[1].txt')
  const diff = await read<FileDiffText>(client, graph.graphId, 'diff', {hash: root, path: 'sub/literal[1].txt'})
  assert.match(diff.text, /\+literal content/)
  assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), before)
  assert.equal(git('show-ref'), refsBefore)
})

test('MCP tools and resource declare thread entrypoint, app visibility and self-contained fullscreen HTML', async t => {
  const client = await connect(t)
  const {tools} = await client.listTools()
  assert.deepEqual(tools.map(tool => tool.name), ['open_git_graph', 'read_git_graph'])
  const [entry, reader] = tools
  assert.equal(entry?.annotations?.readOnlyHint, true)
  assert.equal(reader?.annotations?.readOnlyHint, true)
  assert.deepEqual(entry?._meta?.ui, {resourceUri: uri})
  assert.deepEqual(entry?._meta?.['openai/ui'], {entrypoints: [{type: 'thread'}]})
  assert.deepEqual(reader?._meta?.ui, {visibility: ['app']})
  const {resources} = await client.listResources()
  assert.equal(resources[0]?.uri, uri)
  assert.equal(resources[0]?.mimeType, 'text/html;profile=mcp-app')
  const resource = (await client.readResource({uri})).contents[0]!
  assert.equal(resource.mimeType, 'text/html;profile=mcp-app')
  assert.ok('text' in resource)
  assert.equal(resource.text, html)
  assert.deepEqual(resource._meta?.['openai/ui'], {preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen']})
  assert.deepEqual(resource._meta?.ui, {prefersBorder: true, csp: {connectDomains: [], resourceDomains: []}})
  await assert.rejects(client.readResource({uri: 'ui://wukong-git-graph/missing'}), /Unknown.*resource/i)
})

test('MCP canonicalizes subdirectories and worktrees and keeps independent handles fixed', async t => {
  const a = await repository(t)
  const b = await repository(t)
  const worktree = join(a.directory, 'linked')
  a.git('worktree', 'add', '-b', 'linked', worktree)
  const client = await connect(t)
  const first = await open(client, {repository: join(a.directory, 'sub')})
  const second = await open(client, {repository: b.directory})
  const third = await open(client, {repository: join(worktree, 'sub')})
  assert.equal(first.repository, await realpath(a.directory))
  assert.equal(second.repository, await realpath(b.directory))
  assert.equal(third.repository, await realpath(worktree))
  assert.notEqual(first.graphId, second.graphId)
  assert.notEqual(first.graphId, third.graphId)
  assert.equal((await read<Branches>(client, third.graphId, 'branches')).current, 'linked')
  assert.equal((await read<Branches>(client, first.graphId, 'branches')).current, 'main')
  const otherClient = await connect(t)
  await fails(otherClient, 'read_git_graph', {graphId: first.graphId, operation: 'branches'}, /Unknown graph/)
})

test('MCP resolves one client root and rejects ambiguous roots and missing package defaults', async t => {
  const a = await repository(t)
  const b = await repository(t)
  const fromRoot = await connect(t, {}, [join(a.directory, 'sub')])
  assert.equal((await open(fromRoot)).repository, await realpath(a.directory))
  const packageRoot = await connect(t, {}, [__dirname])
  await fails(packageRoot, 'open_git_graph', {}, /plugin package/)
  assert.equal((await open(packageRoot, {repository: a.directory})).repository, await realpath(a.directory))
  const ambiguous = await connect(t, {}, [a.directory, b.directory])
  await fails(ambiguous, 'open_git_graph', {}, /multiple.*roots|more than one.*root/i)
  assert.equal((await open(ambiguous, {repository: a.directory})).repository, await realpath(a.directory))
  const noRoots = await connect(t, {}, [])
  await fails(noRoots, 'open_git_graph', {}, /repository.*explicit|specify.*repository/i)
  const noDefault = await connect(t)
  await fails(noDefault, 'open_git_graph', {}, /repository.*explicit|specify.*repository/i)
  const saved = process.cwd()
  try {
    process.chdir(join(a.directory, 'sub'))
    assert.equal((await open(noDefault)).repository, await realpath(a.directory))
  } finally { process.chdir(saved) }
})

test('MCP rejects invalid handles, operations, arguments, hashes, paths and unknown tools clearly', async t => {
  const {directory, git} = await repository(t)
  const client = await connect(t, {defaultRepository: directory})
  const graph = await open(client)
  const hash = git('rev-parse', 'HEAD')
  await fails(client, 'read_git_graph', {graphId: 'missing', operation: 'branches'}, /Unknown graph/)
  await fails(client, 'read_git_graph', {graphId: graph.graphId, operation: 'checkout'}, /operation/)
  for (const args of [{offset: -1}, {offset: 0.5}, {offset: '0'}, {remote: 'false'}, {branch: '--all'}, {repository: directory}]) {
    await fails(client, 'read_git_graph', {graphId: graph.graphId, operation: 'commits', ...args}, /offset|remote|branch|argument|repository/)
  }
  await fails(client, 'read_git_graph', {graphId: graph.graphId, operation: 'detail', hash: 'HEAD'}, /hash/)
  await fails(client, 'read_git_graph', {graphId: graph.graphId, operation: 'detail'}, /hash/)
  await fails(client, 'read_git_graph', {graphId: graph.graphId, operation: 'detail', hash: 'f'.repeat(40)}, /bad object|unknown revision|ambiguous argument/i)
  for (const path of ['missing', '../sub/literal[1].txt', 'sub/literal1.txt', '']) {
    await fails(client, 'read_git_graph', {graphId: graph.graphId, operation: 'diff', hash, path}, /file|path/)
  }
  await fails(client, 'open_git_graph', {repository: 42}, /repository/)
  await fails(client, 'open_git_graph', {repository: ''}, /repository/)
  await fails(client, 'open_git_graph', {repository: directory, ignored: true}, /argument|ignored/)
  await fails(client, 'unknown_graph', {}, /Unknown tool/)
})

test('MCP reports nonrepositories and missing targets and supports empty repositories', async t => {
  const {directory} = await repository(t, 0)
  const client = await connect(t)
  const empty = await open(client, {repository: directory})
  assert.deepEqual(empty.commits, [])
  assert.equal(empty.hasMore, false)
  assert.deepEqual(await read<Page>(client, empty.graphId, 'commits'), {commits: [], hasMore: false})
  const nonrepo = await mkdtemp(join(tmpdir(), 'cc-mcp-nonrepo-'))
  t.after(() => rm(nonrepo, {recursive: true, force: true}))
  await fails(client, 'open_git_graph', {repository: nonrepo}, /not a git repository/)
  await fails(client, 'open_git_graph', {repository: join(nonrepo, 'missing')}, /ENOENT|no such file/i)
})

test('MCP stdio bundle is relocatable, uses an external working directory and refuses its own package', async t => {
  const {directory} = await repository(t)
  const packageDirectory = await mkdtemp(join(tmpdir(), 'cc-mcp-package-'))
  t.after(() => rm(packageDirectory, {recursive: true, force: true}))
  const entry = join(packageDirectory, 'mcp.cjs')
  await copyFile(join(__dirname, 'mcp.cjs'), entry)
  for (const cwd of [directory, packageDirectory]) {
    const client = new Client({name: 'stdio-check', version: '1'})
    const transport = new StdioClientTransport({command: process.execPath, args: [entry], cwd, stderr: 'pipe'})
    let stderr = ''
    transport.stderr?.on('data', chunk => { stderr += String(chunk) })
    await client.connect(transport)
    try {
      if (cwd === directory) assert.equal((await open(client)).repository, await realpath(directory))
      else await fails(client, 'open_git_graph', {}, /plugin package/)
      assert.equal(stderr, '')
    } finally { await client.close() }
  }
})
