import { McpBridge } from './mcp-bridge'
import { mountGraph } from './graph-app'
import { escapeHtml } from './render'
import { graphApi, object } from './panel-data'

const bridge = new McpBridge()
const app = document.getElementById('app')!
let dispose = () => {}
let generation = 0
bridge.onHostContext = context => {
  if (object(context) && (context.theme === 'dark' || context.theme === 'light')) document.documentElement.dataset.theme = context.theme
}
bridge.onToolResult = result => {
  if (!object(result)) return
  if (result.isError) {
    dispose(); generation++
    app.innerHTML = '<p role="alert" class="error">Could not open the repository. Invoke Wukong Git Graph with an explicit local repository path.</p>'
    return
  }
  const identity = result.structuredContent
  if (!object(identity) || typeof identity.graphId !== 'string' || !/^[a-f0-9]{48}$/.test(identity.graphId) || typeof identity.repository !== 'string') return
  dispose()
  const view = ++generation
  const graphId = identity.graphId
  app.innerHTML = `<p class="repository" aria-label="Repository">${escapeHtml(identity.repository)}</p><div id="graph"></div>`
  const target = document.getElementById('graph')!
  const api = graphApi(graphId, (name, args) => bridge.callTool(name, args))
  dispose = mountGraph(async <T>(path: string, query?: Record<string, string>): Promise<T> => {
    const data = await api<T>(path, query)
    if (view !== generation) throw new Error('This graph view has been replaced.')
    return data
  }, target)
}
void bridge.connect().catch(error => { app.innerHTML = `<p role="alert" class="error">${escapeHtml(error instanceof Error ? error.message : 'Could not connect to Wukong Git Graph.')}</p>` })
window.addEventListener('pagehide', () => { generation++; dispose(); void bridge.close() }, { once: true })
