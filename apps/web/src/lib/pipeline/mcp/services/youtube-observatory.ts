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
import * as Sentry from '@sentry/nextjs'
import { toMcpError, toMcpSuccess } from '../errors'

type Params = Record<string, unknown>

/** Os parâmetros que este adaptador lê: o anúncio (`YoutubeObservatoryShape`) tem de ter exatamente estes (teste nos dois sentidos). */
export const PARAMETROS_LIDOS = ['action', 'type', 'bookmarked', 'tier', 'limit', 'fmt', 'campos'] as const

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

function buildCtx(): ServiceContext {
  const mcp = getMcpContext()
  return {
    siteId: mcp.siteId,
    permissions: mcp.permissions as ServiceContext['permissions'],
    keyHash: mcp.keyHash,
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

      default:
        return toMcpError({
          code: 'VALIDATION_ERROR',
          message: `Unknown action "${action ?? '(missing)'}". Supported: list_channels, get_changes, get_outliers, get_insights`,
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
