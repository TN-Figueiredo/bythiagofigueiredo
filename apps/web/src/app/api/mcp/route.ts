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
import { houveRecusaRecente, registrarRecusaDaPorta, type DesfechoDaRecusa } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import { FRASES } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { provarAcessoPrivadoDaChave } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { abridorDaChave } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave'
import { oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { conviteOAuth, credencialDe, resolverTokenDeAcesso } from '@/lib/youtube/observatorio/acesso-ia/oauth/resolver'

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

const jsonRpcErro = (status: number, code: number, message: string, convite = false): Response =>
  new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
    status,
    headers: convite ? { 'Content-Type': 'application/json', 'WWW-Authenticate': conviteOAuth() } : { 'Content-Type': 'application/json' },
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

/** Uma linha `recusado` por hora por chave (a dúvida na leitura não grava). Nunca lança. */
async function registrarRecusaComLimite(chave: ChaveLida, userId: string, desfecho: DesfechoDaRecusa, t0: number): Promise<void> {
  try {
    const sb = getSupabaseServiceClient()
    const recente = await houveRecusaRecente(sb, chave.id, t0)
    if (recente === 'nao_conferido') avisarDoRamo('recusa-leitura', 'nao_conferido')
    else if (recente === 'nao') {
      const r = await registrarRecusaDaPorta(sb, { siteId: chave.siteId, userId, keyId: chave.id, desfecho })
      if (!r.ok) avisarDoRamo('recusa-gravacao', r.code)
    }
  } catch (e) {
    avisarDoRamo('recusa-registro', codigoDe(e))
  }
}

/** O ramo da chave do perfil: a porta primeiro, o servidor do Observatório só depois. Tem o `catch` PRÓPRIO (o de baixo devolve `err.message`). `oauth`: 401 de vencida/sem_pessoa leva o convite. */
async function ramoDoPerfil(req: Request, chave: ChaveLida, vencida: boolean, t0: number, oauth = false): Promise<Response> {
  let passo = 'porta'
  try {
    const porta = await abrirPorta(chave, vencida, t0)
    if (!porta.ok) {
      const { recusa } = porta
      if (recusa.registrar && recusa.desfecho && chave.userId !== null) {
        passo = 'recusa-registro'
        await registrarRecusaComLimite(chave, chave.userId, recusa.desfecho, t0)
      }
      const convite = oauth && recusa.status === 401 && (recusa.motivo === 'vencida' || recusa.motivo === 'sem_pessoa')
      return jsonRpcErro(recusa.status, -32600, recusa.frase, convite)
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

/** Decisão por prefixo (C1 F2). `null` = segue o caminho de hoje. Nunca chama `resolveMcpAuth` nem o contexto do pipeline para `oat_`/`ort_`. */
async function ramoOAuth(req: Request, t0: number): Promise<Response | null> {
  const cred = credencialDe(req)
  // O caminho antigo grava 8 caracteres do hash em `pipelineLog`: `oat_` fora do Bearer e `ort_` não passam por ele.
  if (cred.tipo === 'oat_em_pipeline_key' || cred.tipo === 'ort') return jsonRpcErro(401, -32600, 'Invalid or revoked API key')
  const ligado = oauthLigado()
  if (cred.tipo === 'oat') {
    // Infra (client que não nasce) = 503: com a trava aberta `nao_conferido`, com a fechada `temporarily_unavailable`, nunca o 500 do catch geral.
    let sb: ReturnType<typeof getSupabaseServiceClient> | null = null
    try { sb = getSupabaseServiceClient() } catch (e) { avisarDoRamo('oauth-cliente', codigoDe(e)) }
    if (!sb) {
      return ligado
        ? jsonRpcErro(FRASES.nao_conferido.status, -32603, FRASES.nao_conferido.frase)
        : jsonRpcErro(503, -32600, 'temporarily_unavailable')
    }
    const resolvido = await resolverTokenDeAcesso(sb, cred.token, t0)
    if (!ligado) {
      // Trava fechada: o token só é resolvido para registrar a recusa; não resolveu = sem registro.
      if (resolvido.estado === 'erro') avisarDoRamo('oauth-leitura', codigoDe({ code: resolvido.code }))
      else if ((resolvido.estado === 'ativa' || resolvido.estado === 'vencida') && resolvido.chave.userId !== null) {
        await registrarRecusaComLimite(resolvido.chave, resolvido.chave.userId, 'desligado', t0)
      }
      return jsonRpcErro(503, -32600, 'temporarily_unavailable')
    }
    if (resolvido.estado === 'erro') {
      avisarDoRamo('oauth-token', codigoDe({ code: resolvido.code }))
      return jsonRpcErro(FRASES.nao_conferido.status, -32603, FRASES.nao_conferido.frase)
    }
    if (resolvido.estado !== 'ativa') return jsonRpcErro(401, -32600, 'Invalid or revoked API key', true)
    return await ramoDoPerfil(req, resolvido.chave, false, t0, true)
  }
  if (cred.tipo === 'nenhuma' && ligado) return jsonRpcErro(401, -32600, 'API key required. Send via Authorization: Bearer <key> or X-Pipeline-Key header.', true)
  return null
}

async function authenticatedHandler(req: Request): Promise<Response> {
  const t0 = Date.now()
  try {
    const doOAuth = await ramoOAuth(req, t0)
    if (doOAuth) return doOAuth

    const ctx = await resolveMcpAuth(req)

    // Chave do perfil (inclusive a mista, que a porta recusa): nunca cai no caminho do pipeline.
    if (ehDoPerfil(ctx.permissions)) {
      const chave: ChaveLida = { id: ctx.keyId, siteId: ctx.siteId, name: ctx.name, permissions: ctx.permissions, userId: ctx.userId, expiresAt: ctx.expiresAt }
      return await ramoDoPerfil(req, chave, ctx.vencida, t0)
    }

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
