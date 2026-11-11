import { createMcpHandler } from 'mcp-handler'
import { resolveMcpAuth, McpAuthError, mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import { toMcpError } from '@/lib/pipeline/mcp/errors'
import { pipelineLog } from '@/lib/pipeline/logger'
import { registerTools } from '@/lib/pipeline/mcp/tools'
import { registerResources } from '@/lib/pipeline/mcp/resources'
import { registerPrompts } from '@/lib/pipeline/mcp/prompts'
import { runWithMcpContext } from '@/lib/pipeline/mcp/context'
import * as Sentry from '@sentry/nextjs'
import { ehDoPerfil, type ChaveLida } from '@/lib/pipeline/chave'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { comContextoDoObservatorio } from '@/lib/pipeline/mcp/observatorio/contexto'
import type { Responder } from '@/lib/pipeline/mcp/observatorio/executar'
import { INSTRUCOES, registrarServidorDoObservatorio } from '@/lib/pipeline/mcp/observatorio/servidor'
import { abrirPorta } from '@/lib/youtube/observatorio/acesso-ia/porta'
import { houveRecusaRecente, registrarRecusaDaPorta } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { FRASES } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { provarAcessoPrivadoDaChave } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { abridorDaChave } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave'
import type { McpServiceContext } from '@/lib/pipeline/mcp/auth'

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
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

// O segundo servidor (E17 degrau 2): uma ferramenta só de leitura, para a chave do perfil. `verboseLogs` desligado SEMPRE: o log verboso
// imprimiria a resposta (dado do Observatório).
const responderDaRota: Responder = (e, c, agora, prazo) => responder(e, abridorDaChave(c.prova, c.acesso), agora, prazo)
const handlerDoObservatorio = createMcpHandler(
  (server) => registrarServidorDoObservatorio(server, responderDaRota),
  { instructions: INSTRUCOES },
  { basePath: '/api', maxDuration: 60, verboseLogs: false },
)

const jsonRpcErro = (status: number, code: number, message: string): Response =>
  new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Erro, log e Sentry daqui levam só o passo e o código: nunca a mensagem, nunca o hash. */
function avisarDoRamo(passo: string, code: string): void {
  pipelineLog('error', 'mcp/route', 'Falha no ramo do perfil', { passo, code })
  Sentry.captureMessage('mcp/route: falha no ramo do perfil', { level: 'error', tags: { component: 'acesso-ia', step: passo, code } })
}
const codigoDe = (e: unknown): string => {
  const c = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  return typeof c === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(c) ? c : 'excecao'
}

/** O ramo da chave do perfil: a porta primeiro, o servidor do Observatório só depois. Tem o `catch` PRÓPRIO (o de baixo devolve `err.message`). */
async function ramoDoPerfil(req: Request, ctx: McpServiceContext, t0: number): Promise<Response> {
  let passo = 'porta'
  try {
    const chave: ChaveLida = { id: ctx.keyId, siteId: ctx.siteId, name: ctx.name, permissions: ctx.permissions, userId: ctx.userId, expiresAt: ctx.expiresAt }
    const porta = await abrirPorta(chave, ctx.vencida, t0)
    if (!porta.ok) {
      const { recusa } = porta
      if (recusa.registrar && recusa.desfecho && ctx.userId !== null) {
        passo = 'recusa-registro'
        try {
          const sb = getSupabaseServiceClient()
          const recente = await houveRecusaRecente(sb, ctx.keyId, t0)
          if (recente === 'nao_conferido') avisarDoRamo('recusa-leitura', 'nao_conferido')
          else if (recente === 'nao') {
            const r = await registrarRecusaDaPorta(sb, { siteId: ctx.siteId, userId: ctx.userId, keyId: ctx.keyId, desfecho: recusa.desfecho })
            if (!r.ok) avisarDoRamo('recusa-gravacao', r.code)
          }
        } catch (e) {
          avisarDoRamo('recusa-registro', codigoDe(e))
        }
      }
      return jsonRpcErro(recusa.status, -32600, recusa.frase)
    }
    passo = 'direito-privado'
    const acesso = await provarAcessoPrivadoDaChave(porta.prova)
    passo = 'servidor'
    return await comContextoDoObservatorio({ prova: porta.prova, acesso, t0 }, () => handlerDoObservatorio(req))
  } catch (e) {
    avisarDoRamo(passo, codigoDe(e))
    return jsonRpcErro(FRASES.nao_conferido.status, -32603, FRASES.nao_conferido.frase)
  }
}

async function authenticatedHandler(req: Request): Promise<Response> {
  const t0 = Date.now()
  try {
    const ctx = await resolveMcpAuth(req)

    // Chave do perfil (inclusive a mista, que a porta recusa): nunca cai no caminho do pipeline.
    if (ehDoPerfil(ctx.permissions)) return await ramoDoPerfil(req, ctx, t0)

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
