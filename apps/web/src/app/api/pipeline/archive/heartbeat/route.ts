import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive, TRABALHADOR } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CorpoBatimento, RespostaBatimento } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { chamar } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'

export const dynamic = 'force-dynamic'

/** C8: o trabalhador vem da permissão da chave, nunca do corpo (o corpo é `.strict()`). */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy', 'archive_b2', 'archive_read'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoBatimento, a.auth)
  if (corpo instanceof Response) return corpo
  try {
    const r = await chamar(getSupabaseServiceClient(), 'obs_archive_heartbeat_write',
      { p_site: a.auth.siteId, p_worker: TRABALHADOR[a.permissao], p_body: corpo }, RespostaBatimento, a.auth)
    return r.ok ? pipelineSuccess(r.data, 200, a.auth) : r.res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/heartbeat' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
