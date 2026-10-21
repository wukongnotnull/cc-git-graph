/// <reference lib="dom" />
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { McpBridge } from './mcp-bridge'

type Message = { jsonrpc: '2.0'; id?: number | string; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { code: number; message: string } }
function endpoint() {
  const listeners = new Set<(event: { source: unknown; data: unknown }) => void>()
  const sent: Message[] = [], pending: ((message: Message) => void)[] = []
  const parent = { postMessage(message: Message) { const waiting = pending.shift(); if (waiting) waiting(message); else sent.push(message) } }
  const hostWindow = { parent, addEventListener(_name: string, handler: (event: { source: unknown; data: unknown }) => void) { listeners.add(handler) }, removeEventListener(_name: string, handler: (event: { source: unknown; data: unknown }) => void) { listeners.delete(handler) } }
  return {
    window: hostWindow, parent, listeners, sent,
    next: (): Promise<Message> => sent.length ? Promise.resolve(sent.shift()!) : new Promise(resolve => pending.push(resolve)),
    receive(message: Message, source: unknown = parent) { for (const listener of listeners) listener({ source, data: message }) },
    reply(request: Message, result: unknown, source: unknown = parent) { this.receive({ jsonrpc: '2.0', id: request.id, result }, source) },
  }
}
function setup(t: TestContext, timeout = 1000) {
  const wire = endpoint()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: wire.window })
  t.after(async () => { await bridge.close(); delete (globalThis as { window?: unknown }).window })
  const bridge = new McpBridge({ timeout })
  t.after(() => bridge.close())
  return { wire, bridge }
}
const hostResult = (request: Message) => ({ protocolVersion: request.params!.protocolVersion, hostInfo: { name: 'host', version: '1' }, hostCapabilities: { serverTools: {} }, hostContext: { theme: 'light' } })
async function initialize(wire: ReturnType<typeof endpoint>, bridge: McpBridge) {
  const connecting = bridge.connect()
  void connecting.catch(() => {})
  const request = await wire.next()
  assert.equal(request.method, 'ui/initialize')
  wire.reply(request, hostResult(request))
  assert.equal((await wire.next()).method, 'ui/notifications/initialized')
  await connecting
}

test('bridge sends initialize before tools and accepts only parent messages', async t => {
  const { wire, bridge } = setup(t)
  const contexts: unknown[] = [], results: unknown[] = []
  bridge.onHostContext = context => contexts.push(context)
  bridge.onToolResult = result => results.push(result)
  const connecting = bridge.connect()
  void connecting.catch(() => {})
  const reading = bridge.callTool('read_git_graph', { graphId: 'a', operation: 'branches' })
  const request = await wire.next()
  assert.equal(request.method, 'ui/initialize')
  wire.reply(request, hostResult(request), {})
  await Promise.resolve()
  assert.equal(wire.sent.length, 0)
  wire.reply(request, hostResult(request))
  assert.equal((await wire.next()).method, 'ui/notifications/initialized')
  await connecting
  const call = await wire.next()
  assert.equal(call.method, 'tools/call')
  assert.deepEqual({ name: call.params?.name, arguments: call.params?.arguments }, { name: 'read_git_graph', arguments: { graphId: 'a', operation: 'branches' } })
  wire.reply(call, { content: [], structuredContent: { data: 'wrong' } }, {})
  wire.receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent: { graphId: 'bad' } } }, {})
  wire.reply(call, { content: [], structuredContent: { data: 'right' } })
  assert.deepEqual(await reading, { content: [], structuredContent: { data: 'right' } })
  wire.receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent: { graphId: 'a' } } })
  await Promise.resolve()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(results.length, 1)
  assert.deepEqual(contexts, [{ theme: 'light' }])
  await bridge.close()
  assert.equal(wire.listeners.size, 0)
})

test('bridge correlates concurrent calls and rejects protocol and tool errors', async t => {
  const { wire, bridge } = setup(t)
  await initialize(wire, bridge)
  const one = bridge.callTool('read_git_graph', { graphId: 'one' }), two = bridge.callTool('read_git_graph', { graphId: 'two' })
  const first = await wire.next(), second = await wire.next()
  assert.notEqual(first.id, second.id)
  wire.reply(second, { content: [], structuredContent: { data: 2 } })
  wire.reply(first, { content: [], structuredContent: { data: 1 } })
  assert.deepEqual(await two, { content: [], structuredContent: { data: 2 } })
  assert.deepEqual(await one, { content: [], structuredContent: { data: 1 } })
  const rejected = assert.rejects(bridge.callTool('read_git_graph', {}), /host rejected/)
  wire.receive({ jsonrpc: '2.0', id: (await wire.next()).id, error: { code: -32000, message: 'host rejected' } })
  await rejected
  const toolRejected = assert.rejects(bridge.callTool('read_git_graph', {}), /Unknown graph/)
  wire.reply(await wire.next(), { isError: true, content: [{ type: 'text', text: 'Unknown graph' }] })
  await toolRejected
})

test('bridge times out unanswered initialization', async t => {
  const { wire, bridge } = setup(t, 10)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const rejected = assert.rejects(bridge.connect(), /timed out/i)
  await wire.next()
  t.mock.timers.tick(11)
  await rejected
  assert.equal(wire.listeners.size, 0)
})

test('panel API binds every operation to its own graph and validates returned shapes', async () => {
  const { graphApi } = await import('./panel-data')
  const calls: Record<string, unknown>[] = []
  const api = graphApi('first', async (_name, args) => {
    calls.push(args)
    const data = args.operation === 'branches' ? { branches: [], current: 'main' } : args.operation === 'commits' ? { commits: [], hasMore: false } : args.operation === 'diff' ? { text: '', isCut: false, isTooLarge: false } : {}
    return { structuredContent: { data } }
  })
  await api('/api/branches')
  await api('/api/commits', { branch: 'refs/heads/main', remote: 'false', offset: '50' })
  await api('/api/diff', { hash: 'a'.repeat(40), path: '<file>' })
  assert.deepEqual(calls, [
    { graphId: 'first', operation: 'branches' },
    { graphId: 'first', operation: 'commits', branch: 'refs/heads/main', remote: false, offset: 50 },
    { graphId: 'first', operation: 'diff', hash: 'a'.repeat(40), path: '<file>' },
  ])
  await assert.rejects(api('/api/detail', { hash: 'a'.repeat(40) }), /Invalid/)
  await assert.rejects(api('/api/unknown'), /Unknown/)
  const invalid = graphApi('other', async () => ({ structuredContent: { data: { branches: ['bad'], current: 3 } } }))
  await assert.rejects(invalid('/api/branches'), /Invalid/)
})
