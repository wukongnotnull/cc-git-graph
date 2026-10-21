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
function requestRepository(message: string): void {
  dispose()
  const view = ++generation
  app.innerHTML = `<header class="top"><h1>Wukong Git Graph <span class="readonly">Read only</span></h1></header>
    <p>${escapeHtml(message)}</p>
    <form id="repository-form" class="toolbar repository-picker">
      <label for="repository-path">Repository path</label>
      <input id="repository-path" name="repository" placeholder="/absolute/path/to/repository" required autocomplete="off" spellcheck="false">
      <button id="repository-open" type="submit">Open repository</button>
    </form><p id="repository-error" role="alert"></p>`
  const form = document.getElementById('repository-form')!
  const input = document.getElementById('repository-path') as HTMLInputElement
  const button = document.getElementById('repository-open') as HTMLButtonElement
  const error = document.getElementById('repository-error')!
  const submit = async (event: Event): Promise<void> => {
    event.preventDefault()
    if (button.disabled || !input.value) return
    button.disabled = true
    error.textContent = ''
    try {
      const result = await bridge.callTool('open_git_graph', { repository: input.value })
      if (view === generation) bridge.onToolResult(result)
    } catch (reason) {
      if (view === generation) error.textContent = reason instanceof Error ? reason.message : 'Could not open the repository.'
    } finally { if (view === generation) button.disabled = false }
  }
  form.addEventListener('submit', submit)
  dispose = () => form.removeEventListener('submit', submit)
}
bridge.onToolResult = result => {
  if (!object(result)) return
  if (result.isError) {
    requestRepository('Could not open the repository. Enter an explicit local repository path.')
    return
  }
  const identity = result.structuredContent
  if (object(identity) && identity.needsRepository === true) {
    requestRepository(typeof identity.message === 'string' ? identity.message : 'Enter a local repository path.')
    return
  }
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
