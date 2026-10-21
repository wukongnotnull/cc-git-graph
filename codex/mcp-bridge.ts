import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps'
import type { Transport } from '@modelcontextprotocol/client'

/** The official SDK owns message validation, source checks and request correlation. */
export class McpBridge {
  private readonly app = new App({ name: 'cc-git-graph', version: '0.1.0' }, {}, { autoResize: false })
  private connection?: Promise<void>
  constructor(readonly options: { transport?: Transport; timeout?: number } = {}) {
    this.app.ontoolresult = result => this.onToolResult(result)
    this.app.onhostcontextchanged = context => this.onHostContext(context)
  }
  onToolResult: (result: unknown) => void = () => {}
  onHostContext: (context: unknown) => void = () => {}
  connect(): Promise<void> {
    return this.connection ??= this.app.connect(this.options.transport ?? new PostMessageTransport(window.parent, window.parent), { timeout: this.options.timeout ?? 15_000 })
      .then(() => { this.onHostContext(this.app.getHostContext()) })
      .catch(async error => { await this.app.close(); throw error })
  }
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.connect()
    const result = await this.app.callServerTool({ name, arguments: args }, { timeout: this.options.timeout ?? 45_000 })
    if (result.isError) throw new Error(result.content?.filter(block => block.type === 'text').map(block => block.text).join('\n') || 'Could not read Git history.')
    return result
  }
  async close(): Promise<void> { await this.app.close() }
}
