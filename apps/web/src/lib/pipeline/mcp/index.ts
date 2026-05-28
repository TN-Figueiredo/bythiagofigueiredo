import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from './tools'
import { registerResources } from './resources'
import { registerPrompts } from './prompts'

export function createPipelineMcpServer(): McpServer {
  const server = new McpServer({
    name: 'bythiagofigueiredo-pipeline',
    version: '1.0.0',
  })
  registerTools(server)
  registerResources(server)
  registerPrompts(server)
  return server
}

export { resolveMcpAuth } from './auth'
export { toMcpError, toMcpSuccess } from './errors'
export { generateConfirmationToken, validateConfirmationToken, checkRateGovernor } from './safety'
