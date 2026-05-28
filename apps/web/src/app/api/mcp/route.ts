import { createMcpHandler } from 'mcp-handler'
import { resolveMcpAuth, McpAuthError, mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { toMcpError } from '@/lib/pipeline/mcp/errors'
import { pipelineLog } from '@/lib/pipeline/logger'
import { registerTools } from '@/lib/pipeline/mcp/tools'
import { registerResources } from '@/lib/pipeline/mcp/resources'
import { registerPrompts } from '@/lib/pipeline/mcp/prompts'
import { runWithMcpContext } from '@/lib/pipeline/mcp/context'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

const handler = createMcpHandler(
  (server) => {
    registerTools(server)
    registerResources(server)
    registerPrompts(server)
    pipelineLog('info', 'mcp/server', 'MCP server setup complete')
  },
  {},
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

async function authenticatedHandler(req: Request): Promise<Response> {
  const accept = req.headers.get('Accept') ?? ''
  if (accept.includes('text/event-stream')) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'SSE transport not supported. Use Streamable HTTP.' },
        id: null,
      }),
      { status: 406, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const ctx = await resolveMcpAuth(req)

    if (!mcpRequirePermission(ctx, 'read')) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Insufficient permissions' },
          id: null,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return await runWithMcpContext(ctx, () => handler(req))
  } catch (err) {
    if (err instanceof McpAuthError) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: err.message },
          id: null,
        }),
        { status: err.statusCode, headers: { 'Content-Type': 'application/json' } },
      )
    }

    pipelineLog('error', 'mcp/route', 'Unexpected error in MCP handler', {
      error: err instanceof Error ? err.message : String(err),
    })

    const mcpError = toMcpError({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' })

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: mcpError.content[0]?.text ?? 'Internal error' },
        id: null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export { authenticatedHandler as GET, authenticatedHandler as POST }
