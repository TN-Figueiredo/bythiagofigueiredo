import type { McpServiceContext } from './auth'

let _requestContext: McpServiceContext | null = null

export function getMcpContext(): McpServiceContext {
  if (!_requestContext) {
    throw new Error('MCP context not available — auth did not resolve')
  }
  return _requestContext
}

export function setMcpContext(ctx: McpServiceContext | null): void {
  _requestContext = ctx
}
