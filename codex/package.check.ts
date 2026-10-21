import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const builtPackage = join(__dirname, 'plugin')
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

async function files(directory: string, prefix = ''): Promise<string[]> {
  const result: string[] = []
  for (const name of await readdir(directory)) {
    const path = join(directory, name)
    const entry = await lstat(path)
    assert.equal(entry.isSymbolicLink(), false, `Package symlink: ${path}`)
    if (entry.isDirectory()) result.push(...await files(path, `${prefix}${name}/`))
    else result.push(`${prefix}${name}`)
  }
  return result.sort()
}

test('built plugin has synchronized portable and Codex manifests and the local marketplace targets it', async () => {
  const codexEnvironment = await readFile(resolve(__dirname, '../../.codex/environments/environment.toml'), 'utf8')
  assert.deepEqual([...codexEnvironment.matchAll(/^name = "([^"]+)"$/gm)].map(([, name]) => name), ['Wukong Git Graph', 'Wukong Git Graph'])
  assert.match(codexEnvironment, /command = 'npm --prefix codex ci && npm --prefix codex run build && npm --prefix codex start -- --repo "\$PWD"'/)
  assert.deepEqual(await files(builtPackage), [
    '.codex-plugin/plugin.json', '.mcp.json', 'mcp.cjs', 'mcp.json', 'panel.html', 'plugin.json',
    'skills/git-graph/SKILL.md', 'skills/git-graph/agents/openai.yaml',
  ])
  const portable = await readJson(join(builtPackage, 'plugin.json'))
  const compatibility = await readJson(join(builtPackage, '.codex-plugin/plugin.json'))
  assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
  assert.equal(portable.name, 'wukong-git-graph')
  assert.equal(portable.version, '0.2.0')
  assert.equal(compatibility.name, portable.name)
  assert.equal(compatibility.version, portable.version)
  assert.equal(compatibility.description, portable.description)
  assert.deepEqual(compatibility.interface, portable.extensions['com.openai'].interface)
  assert.equal(compatibility.interface.displayName, 'Wukong Git Graph')
  assert.ok(compatibility.interface.shortDescription.length <= 30)
  assert.deepEqual(compatibility.interface.capabilities, ['Interactive', 'Read'])
  for (const field of ['skills', 'mcpServers', 'apps', 'interface']) assert.equal(field in portable, false)
  assert.equal(compatibility.skills, './skills/')
  assert.equal(compatibility.mcpServers, './.mcp.json')
  const mcp = await readJson(join(builtPackage, 'mcp.json'))
  const legacyMcp = await readJson(join(builtPackage, '.mcp.json'))
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json')
  assert.deepEqual(legacyMcp.mcpServers, mcp.mcpServers)
  assert.deepEqual(mcp.mcpServers, {'git-graph': {type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/mcp.cjs']}})
  const marketplace = await readJson(resolve(__dirname, '../../.agents/plugins/marketplace.json'))
  assert.equal(marketplace.name, 'wukong-git-graph-local')
  const entry = marketplace.plugins.find((plugin: {name: string}) => plugin.name === portable.name)
  assert.deepEqual(entry.source, {source: 'local', path: './codex/dist/plugin'})
  assert.equal(resolve(__dirname, '../..', entry.source.path), builtPackage)

  const claudePlugin = await readJson(resolve(__dirname, '../../claude/.claude-plugin/plugin.json'))
  const claudeMarketplace = await readJson(resolve(__dirname, '../../.claude-plugin/marketplace.json'))
  assert.equal(claudePlugin.name, 'wukong-git-graph')
  assert.equal(claudePlugin.version, '0.3.0')
  assert.equal(claudeMarketplace.name, 'wukong-git-graph')
  assert.equal(claudeMarketplace.plugins[0].name, claudePlugin.name)
  assert.equal(claudeMarketplace.plugins[0].version, claudePlugin.version)
  assert.equal(claudeMarketplace.plugins[0].source, './claude')
})

test('isolated plugin package starts from either manifest and serves its HTML and explicit real repository', async t => {
  const sandbox = await mkdtemp(join(tmpdir(), 'wukong-graph-relocated-'))
  t.after(() => rm(sandbox, {recursive: true, force: true}))
  const relocated = join(sandbox, 'wukong-git-graph')
  await cp(builtPackage, relocated, {recursive: true})
  assert.deepEqual(await readdir(sandbox), ['wukong-git-graph'])
  assert.deepEqual(await files(relocated), await files(builtPackage))
  const repository = await mkdtemp(join(tmpdir(), 'cc-graph-package-repo-'))
  t.after(() => rm(repository, {recursive: true, force: true}))
  const git = (...args: string[]) => execFileSync('git', args, {cwd: repository, encoding: 'utf8', stdio: 'pipe'}).trim()
  git('init', '-b', 'main')
  git('-c', 'user.name=Package Check', '-c', 'user.email=package@example.test', 'commit', '--allow-empty', '-m', 'Relocated history')
  for (const filename of ['mcp.json', '.mcp.json']) {
    const config = (await readJson(join(relocated, filename))).mcpServers['git-graph']
    assert.equal('cwd' in config, false)
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args.map((value: string) => value.replaceAll('${PLUGIN_ROOT}', relocated)),
      cwd: sandbox, stderr: 'pipe',
    })
    let stderr = ''
    transport.stderr?.on('data', chunk => { stderr += String(chunk) })
    const client = new Client({name: 'relocation-check', version: '1'})
    try {
      await client.connect(transport)
      assert.ok((await client.listTools()).tools.some(tool => tool.name === 'open_git_graph'))
      assert.equal(client.getServerVersion()?.name, 'wukong-git-graph')
      const resource = (await client.readResource({uri: 'ui://wukong-git-graph/panel-v1.html'})).contents[0]!
      assert.equal(resource.mimeType, 'text/html;profile=mcp-app')
      assert.ok('text' in resource)
      assert.equal(resource.text, await readFile(join(relocated, 'panel.html'), 'utf8'))
      assert.match(resource.text, /<title>Wukong Git Graph<\/title>/)
      assert.doesNotMatch(resource.text, /<script[^>]+src=|<link[^>]+href=/i)
      const result = await client.callTool({name: 'open_git_graph', arguments: {repository}}) as CallToolResult
      assert.notEqual(result.isError, true, JSON.stringify(result.content))
      assert.equal(result.structuredContent?.repository, await realpath(repository))
      assert.match(JSON.stringify(result._meta?.graph), /Relocated history/)
      assert.equal(stderr, '')
    } finally { await client.close() }
  }
})
