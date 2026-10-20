import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createGraphMcpServer } from './mcp-server'
createGraphMcpServer().connect(new StdioServerTransport()).catch(error => {
  console.error(error instanceof Error ? error.message : 'Could not start Git Graph.')
  process.exitCode = 1
})
