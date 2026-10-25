import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { RespostaPlano, RespostaPlanoB2 } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { chamar } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'

export const dynamic = 'force-dynamic'

/** C1 (copiador) e C2 (`?fonte=b2`, conferir-b2). Grava `last_poll_at` do trabalhador; o site decide sozinho se a execução é completa. */
export async function GET(req: NextRequest) {
  const b2 = req.nextUrl.searchParams.get('fonte') === 'b2'
  const a = await authenticateArchive(req, [b2 ? 'archive_b2' : 'archive_copy'] as const)
  if (a instanceof Response) return a
  const cursor = req.nextUrl.searchParams.get('cursor')
  if (cursor !== null && (cursor.length === 0 || cursor.length > 200)) return pipelineError('VALIDATION_ERROR', 'cursor fora do limite', 400, a.auth)
  const completo = req.nextUrl.searchParams.get('completo') === '1'
  try {
    const args = { p_site: a.auth.siteId, p_completo: completo, p_cursor: cursor }
    const r = b2
      ? await chamar(getSupabaseServiceClient(), 'obs_archive_b2_plan', args, RespostaPlanoB2, a.auth)
      : await chamar(getSupabaseServiceClient(), 'obs_archive_plan', args, RespostaPlano, a.auth)
    return r.ok ? pipelineSuccess(r.data, 200, a.auth) : r.res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/plan' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
