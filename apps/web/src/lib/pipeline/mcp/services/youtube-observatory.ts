/**
 * MCP adapter for YouTube Observatory (competitor intelligence).
 *
 * Delegates to the competitors service layer — never issues direct
 * Supabase queries. This keeps column names and business logic in
 * a single source of truth.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getMcpContext } from '@/lib/pipeline/mcp/context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import * as competitors from '@/lib/pipeline/services/competitors'
import type { ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import * as nicheSignals from '@/lib/pipeline/services/niche-signals'
import { mcpRequirePermission } from '@/lib/pipeline/mcp/auth'
import * as Sentry from '@sentry/nextjs'
import { toMcpError, toMcpSuccess } from '../errors'

type Params = Record<string, unknown>

/** Os parâmetros que este adaptador lê: o anúncio (`YoutubeObservatoryShape`) tem de ter exatamente estes (teste nos dois sentidos). */
export const PARAMETROS_LIDOS = ['action', 'type', 'bookmarked', 'tier', 'limit', 'fmt', 'campos', 'signal_id', 'status', 'motivo'] as const

/**
 * Teto do `limit` de `get_changes` com `campos=todos`: com o pior valor de `tags` medido (561 bytes) o texto
 * de 17 itens cabe nos 60.000 caracteres que o cliente aceita; com 18 não cabe. O documento do Cowork cita o
 * mesmo número; o teste `youtube-observatory-parametros` mede.
 */
export const LIMITE_MUDANCAS_TEXTO = 17

/**
 * O limite do texto que o cliente da ferramenta aceita (P-14: 60.000 caracteres sem a resposta do dono). Constante operacional,
 * não regra de negócio. `list_channels` sai SEM indentação (medido na Tarefa 12: 15 canais passam do limite com a indentação de
 * `toMcpSuccess` e cabem sem ela) e avisa o Sentry acima de 80% do limite.
 */
export const LIMITE_DO_TEXTO_DA_FERRAMENTA = 60_000

/** O aviso nunca muda nem derruba a resposta; só o tamanho e o número de canais vão ao Sentry. */
function avisarSeGrande(caracteres: number, canais: number): void {
  try {
    if (caracteres > 0.8 * LIMITE_DO_TEXTO_DA_FERRAMENTA) Sentry.captureMessage('e7.resposta_da_ferramenta_grande', { extra: { caracteres, canais } })
  } catch {
    // o aviso falhou: a resposta segue
  }
}

/** Quantos outliers por sugestão o `get_signals` tenta levar, do mais cheio ao mais enxuto (a evidência guarda até 20). */
const DEGRAUS_DE_OUTLIERS = [20, 10, 5, 3, 2, 1, 0] as const

/**
 * 50 sugestões com a evidência no máximo (20 outliers cada) passam de 250.000 caracteres; o cliente aceita 60.000. Corta só a LISTA de outliers de
 * cada sugestão (a mais fraca primeiro). Se nem sem outliers couber, tira sugestões do fim (as mais fracas) e põe `aviso` com quantas ficaram de fora.
 * `n`, `motivoVazio` e `proprios_agora` seguem iguais aos da rota. `outliers_omitidos` diz quantos outliers ficaram de fora; `evidence.outliers_total`
 * continua o número verdadeiro. O resto do serviço não muda.
 */
export function cabeNoLimite(lista: ListaDeSinais, limite: number = LIMITE_DO_TEXTO_DA_FERRAMENTA): { texto: string; lista: ListaDeSinais } {
  let ultimo = { texto: JSON.stringify(lista), lista }
  if (ultimo.texto.length <= limite) return ultimo
  for (const k of DEGRAUS_DE_OUTLIERS) {
    const cortada: ListaDeSinais = {
      ...lista,
      itens: lista.itens.map((i) => ({ ...i, evidence: { ...i.evidence, outliers: i.evidence.outliers.slice(0, k), outliers_omitidos: Math.max(0, i.evidence.outliers.length - k) } })),
    }
    ultimo = { texto: JSON.stringify(cortada), lista: cortada }
    if (ultimo.texto.length <= limite) return ultimo
  }
  // Nem sem outliers coube: tira sugestões do fim (as mais fracas) e DIZ quantas, nunca devolve texto acima do teto. `n`, `motivoVazio` seguem os reais.
  const base = ultimo.lista
  for (let ficam = base.itens.length - 1; ficam >= 0; ficam--) {
    const omitidos = base.itens.length - ficam
    const enxuta: ListaDeSinais = { ...base, itens: base.itens.slice(0, ficam), aviso: `resposta cortada: ${omitidos} itens não couberam` }
    const texto = JSON.stringify(enxuta)
    if (texto.length <= limite) return { texto, lista: enxuta }
  }
  const minimo: ListaDeSinais = { ...base, itens: [], aviso: `resposta cortada: ${base.itens.length} itens não couberam` }
  return { texto: JSON.stringify(minimo), lista: minimo }
}

function buildCtx(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as ServiceContext['permissions'],
    keyHash: mcp.keyHash,
    keyId: mcp.keyId,
    supabase: getSupabaseServiceClient(),
    source: 'api_key',
  }
}

export async function youtubeObservatory(params: Params): Promise<CallToolResult> {
  const action = params.action as string | undefined

  try {
    switch (action) {
      case 'list_channels': {
        const result = await competitors.listCompetitorChannels(buildCtx())
        const text = JSON.stringify(result.data)
        avisarSeGrande(text.length, result.data.channels?.length ?? 0)
        return { content: [{ type: 'text', text }], isError: false }
      }

      case 'get_changes': {
        const result = await competitors.listCompetitorChanges(buildCtx(), {
          type: (params.type as string) || 'all',
          bookmarked: params.bookmarked as boolean | undefined,
          limit: params.campos === 'todos'
            ? Math.min((params.limit as number) || 25, LIMITE_MUDANCAS_TEXTO)
            : (params.limit as number) || 25,
          campos: params.campos === 'todos' ? 'todos' : undefined,
        })
        return toMcpSuccess(result.data)
      }

      case 'get_outliers': {
        const result = await competitors.listCompetitorOutliers(buildCtx(), {
          tier: (params.tier as string) || 'all',
          limit: (params.limit as number) || 25,
          fmt: params.fmt === 'short' ? 'short' : 'long',
        })
        return toMcpSuccess(result.data)
      }

      case 'get_insights': {
        const result = await competitors.getCompetitorInsights(buildCtx())
        return toMcpSuccess(result.data)
      }

      case 'get_signals': {
        // sem indentação, como list_channels; a evidência é cortada em degraus até caber nos 60.000 caracteres (`cabeNoLimite`)
        const result = await nicheSignals.listNicheSignals(buildCtx(), { limit: Math.min((params.limit as number) || 50, 50) })
        const { texto: text } = cabeNoLimite(result.data)
        avisarSeGrande(text.length, result.data.itens.length)
        return { content: [{ type: 'text', text }], isError: false }
      }

      case 'dismiss_signal': {
        if (!mcpRequirePermission(getMcpContext(), 'write')) return toMcpError({ code: 'FORBIDDEN', message: 'Write permission required' })
        if (typeof params.signal_id !== 'string') return toMcpError({ code: 'VALIDATION_ERROR', message: 'signal_id is required for dismiss_signal' })
        const result = await nicheSignals.dismissNicheSignal(buildCtx(), params.signal_id, { status: params.status, motivo: params.motivo })
        return toMcpSuccess(result.data)
      }

      default:
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: `Unknown action "${action ?? '(missing)'}". Supported: list_channels, get_changes, get_outliers, get_insights, get_signals, dismiss_signal`,
        })
    }
  } catch (error) {
    if (error instanceof PipelineServiceError) {
      return toMcpError({
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details,
      })
    }
    const message = error instanceof Error ? error.message : String(error)
    return toMcpError({ code: 'INTERNAL_ERROR', message })
  }
}
