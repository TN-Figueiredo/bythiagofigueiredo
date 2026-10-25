import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CorpoRecebido, RespostaRecebido } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { chamar } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'

export const dynamic = 'force-dynamic'

/** C6: o que o copiador releu do NAS. A resposta diz o resultado de cada item e os meses selados; nunca o valor esperado. */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoRecebido, a.auth)
  if (corpo instanceof Response) return corpo
  try {
    const r = await chamar(getSupabaseServiceClient(), 'obs_archive_receive', { p_site: a.auth.siteId, p_items: corpo.itens }, RespostaRecebido, a.auth)
    return r.ok ? pipelineSuccess(r.data, 200, a.auth) : r.res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/unit/received' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
