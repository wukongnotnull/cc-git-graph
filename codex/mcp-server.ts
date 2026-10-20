import { randomBytes } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema,
  type CallToolResult, type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { readBranches, readDetail, readDiff, readGit, readPage } from './repository'
import { isCommitHash } from '../hooks/git/argv'

const PANEL_URI = 'ui://cc-git-graph/panel-v1.html'
const PANEL_MIME = 'text/html;profile=mcp-app'
const resourceMeta = {
  ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } },
  'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] },
}
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
const tools: Tool[] = [
  {
    name: 'open_git_graph', title: 'Git Graph',
    description: 'Open a read-only Git graph for a local repository. Specify repository when the current project is unavailable or ambiguous.',
    inputSchema: {
      type: 'object', properties: { repository: { type: 'string', minLength: 1 } }, additionalProperties: false,
    },
    annotations,
    _meta: { ui: { resourceUri: PANEL_URI }, 'openai/ui': { entrypoints: [{ type: 'thread' }] } },
  },
  {
    name: 'read_git_graph', title: 'Read Git Graph', description: 'Read history for an already opened Git Graph view.',
    inputSchema: {
      type: 'object', properties: {
        graphId: { type: 'string', minLength: 1 }, operation: { type: 'string', enum: ['branches', 'commits', 'detail', 'diff'] },
        branch: { type: 'string' }, remote: { type: 'boolean' },
        offset: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        hash: { type: 'string', pattern: '^[a-f0-9]{40,64}$' }, path: { type: 'string', minLength: 1 },
      }, required: ['graphId', 'operation'], additionalProperties: false,
    },
    annotations, _meta: { ui: { visibility: ['app'] } },
  },
]

type Options = { defaultRepository?: string; readPanel?: () => Promise<string> }

function onlyArguments(args: Record<string, unknown>, allowed: readonly string[]): void {
  const extra = Object.keys(args).find(key => !allowed.includes(key))
  if (extra) throw new Error(`Unknown argument: ${extra}.`)
}

function stringArgument(args: Record<string, unknown>, name: string): string {
  const value = args[name]
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) throw new Error(`Invalid ${name}.`)
  return value
}

function within(directory: string, root: string): boolean {
  const path = relative(root, directory)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
}

export function createGraphMcpServer(options: Options = {}): Server {
  const server = new Server({ name: 'cc-git-graph', version: '0.1.0' }, { capabilities: { tools: {}, resources: {} } })
  // Every view retains its own repository. Opening another graph never changes existing capabilities.
  const graphs = new Map<string, string>()
  const readPanel = options.readPanel ?? (() => readFile(join(__dirname, 'panel.html'), 'utf8'))

  async function targetRepository(args: Record<string, unknown>): Promise<string> {
    let target: string
    if (args.repository !== undefined) target = stringArgument(args, 'repository')
    else if (options.defaultRepository !== undefined) target = stringArgument({ repository: options.defaultRepository }, 'repository')
    else if (server.getClientCapabilities()?.roots) {
      const { roots } = await server.listRoots()
      if (roots.length > 1) throw new Error('The client has multiple project roots. Specify repository explicitly.')
      if (roots.length !== 1) throw new Error('Specify repository explicitly; the client has no project root.')
      const root = new URL(roots[0]!.uri)
      if (root.protocol !== 'file:') throw new Error('Specify repository explicitly; the project root must be a file URL.')
      target = fileURLToPath(root)
    } else {
      target = await realpath(process.cwd())
      const packageDirectory = await realpath(__dirname)
      // Development bundles live under codex/dist; the installed bundle lives directly at its package root.
      const developmentDirectory = basename(packageDirectory) === 'dist' ? dirname(packageDirectory) : packageDirectory
      if (within(target, developmentDirectory)) throw new Error('Specify repository explicitly; the plugin package is not a project target.')
    }
    const directory = await realpath(target)
    const top = (await readGit(directory, ['rev-parse', '--show-toplevel'])).replace(/\n$/, '')
    return realpath(top)
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{
    uri: PANEL_URI, name: 'Git Graph', description: 'Read-only local Git history panel', mimeType: PANEL_MIME, _meta: resourceMeta,
  }] }))
  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    if (request.params.uri !== PANEL_URI) throw new Error('Unknown Git Graph resource.')
    return { contents: [{ uri: PANEL_URI, mimeType: PANEL_MIME, text: await readPanel(), _meta: resourceMeta }] }
  })
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const args = request.params.arguments ?? {}
      if (request.params.name === 'open_git_graph') {
        onlyArguments(args, ['repository'])
        const repository = await targetRepository(args)
        const [branches, page] = await Promise.all([readBranches(repository), readPage(repository, new URLSearchParams())])
        const graphId = randomBytes(24).toString('hex')
        graphs.set(graphId, repository)
        return {
          content: [{ type: 'text', text: 'Git Graph opened.' }],
          structuredContent: { graphId, repository, ...branches, ...page },
        } satisfies CallToolResult
      }
      if (request.params.name !== 'read_git_graph') throw new Error('Unknown tool.')
      const graphId = stringArgument(args, 'graphId')
      const repository = graphs.get(graphId)
      if (!repository) throw new Error('Unknown graph. Open Git Graph again.')
      const operation = stringArgument(args, 'operation')
      let data: unknown
      if (operation === 'branches') {
        onlyArguments(args, ['graphId', 'operation'])
        data = await readBranches(repository)
      } else if (operation === 'commits') {
        onlyArguments(args, ['graphId', 'operation', 'branch', 'remote', 'offset'])
        if (args.branch !== undefined && typeof args.branch !== 'string') throw new Error('Invalid branch.')
        if (args.remote !== undefined && typeof args.remote !== 'boolean') throw new Error('Invalid remote flag.')
        if (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || (args.offset as number) < 0)) throw new Error('Invalid page offset.')
        const query = new URLSearchParams()
        for (const key of ['branch', 'remote', 'offset']) if (args[key] !== undefined) query.set(key, String(args[key]))
        data = await readPage(repository, query)
      } else if (operation === 'detail' || operation === 'diff') {
        onlyArguments(args, ['graphId', 'operation', 'hash', ...(operation === 'diff' ? ['path'] : [])])
        const hash = stringArgument(args, 'hash')
        if (!isCommitHash(hash)) throw new Error('Invalid commit hash.')
        data = operation === 'detail' ? await readDetail(repository, hash)
          : await readDiff(repository, hash, stringArgument(args, 'path'))
      } else throw new Error('Unknown Git Graph operation.')
      return { content: [], structuredContent: { data } } satisfies CallToolResult
    } catch (error) {
      return { content: [{ type: 'text', text: error instanceof Error ? error.message : 'Could not read the Git history.' }], isError: true }
    }
  })
  return server
}
