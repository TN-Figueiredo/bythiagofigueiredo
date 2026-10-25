import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticatePipeline, type PipelineAuth } from './auth'
import { pipelineError, pipelineSuccess } from './helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { erroDoRpc } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'

export type PermissaoArquivo = 'archive_copy' | 'archive_b2' | 'archive_read' | 'archive_owner'   // archive_owner: só GET pending e GET pode-desligar (C13, C11)
export const TRABALHADOR = { archive_copy: 'copiador', archive_b2: 'conferir_b2', archive_read: 'respondedor' } as const satisfies Record<Exclude<PermissaoArquivo, 'archive_owner'>, string>

/** Só o valor `on` liga: ausente, vazio ou outro valor desliga (teste que apaga a variável). */
export function arquivoLigado(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OBS_ARQUIVO === 'on'
}

/** Ordem do C0: chave (401/403/429) → permissão exata (403) → OBS_ARQUIVO (503). Só chave de API. */
export async function authenticateArchive<P extends PermissaoArquivo>(req: NextRequest, aceitas: readonly P[]):
  Promise<{ ok: true; auth: PipelineAuth; permissao: P } | NextResponse> {
  const r = await authenticatePipeline(req)
  if (!r.ok) return pipelineError(r.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', r.error, r.status)
  if (r.auth.source !== 'api_key') return pipelineError('FORBIDDEN', 'API key required', 403, r.auth)
  const permissao = aceitas.find(p => r.auth.permissions.includes(p))
  if (!permissao) return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, r.auth)
  if (!arquivoLigado()) return pipelineError('arquivo_desligado', 'arquivo desligado', 503, r.auth)
  return { ok: true, auth: r.auth, permissao }
}

/**
 * As duas leituras do Mac do dono (C13 `pending`, C11 `pode-desligar`): mesmo molde. `GET` sem parâmetro, chave `archive_owner`,
 * uma chamada de função do banco com o site da chave, dado lido pelo leitor puro (fora da forma = 500, nunca 200), `no-store`.
 */
export async function leituraDoDono(req: NextRequest, o: {
  rota: string; funcao: string; ler: (bruto: unknown) => { ok: boolean }
}): Promise<NextResponse> {
  const a = await authenticateArchive(req, ['archive_owner'])
  if (a instanceof Response) return a
  if (req.nextUrl.searchParams.size > 0) return pipelineError('VALIDATION_ERROR', 'a rota não aceita parâmetros', 400, a.auth)
  try {
    const { data, error } = await getSupabaseServiceClient().rpc(o.funcao, { p_site: a.auth.siteId })
    if (error) return erroDoRpc(error, a.auth)
    if (!o.ler(data).ok) {
      Sentry.captureMessage(`archive ${o.rota} fora do esquema`, 'error')
      return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
    }
    // o pipelineSuccess não aceita cabeçalho extra; sem o no-store uma camada de cache serviria lista velha, lida como "nada pendente"
    const res = pipelineSuccess(data, 200, a.auth)
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: `pipeline/archive/${o.rota}` } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
