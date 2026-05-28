import { AsyncLocalStorage } from 'node:async_hooks'
import type { McpServiceContext } from './auth'

const mcpContextStore = new AsyncLocalStorage<McpServiceContext>()

export function getMcpContext(): McpServiceContext {
  const ctx = mcpContextStore.getStore()
  if (!ctx) {
    throw new Error('MCP context not available — auth did not resolve')
  }
  return ctx
}

export function runWithMcpContext<T>(ctx: McpServiceContext, fn: () => T): T {
  return mcpContextStore.run(ctx, fn)
}
