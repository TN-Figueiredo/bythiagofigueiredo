import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CorpoAtestar, RespostaAtestarB2, RespostaAtestarNas } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { chamar } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'

export const dynamic = 'force-dynamic'

/** C7: `fonte: 'nas'` exige `archive_copy`, `fonte: 'b2'` exige `archive_b2` (a outra recebe 403). `prefixo_ausente` (M9) cai no Zod: 400. */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy', 'archive_b2'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoAtestar, a.auth)
  if (corpo instanceof Response) return corpo
  if ((corpo.fonte === 'nas') !== (a.permissao === 'archive_copy')) return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, a.auth)
  try {
    const sb = getSupabaseServiceClient()
    const args = { p_site: a.auth.siteId, p_body: corpo }
    const r = corpo.fonte === 'nas'
      ? await chamar(sb, 'obs_archive_attest_nas', args, RespostaAtestarNas, a.auth)
      : await chamar(sb, 'obs_archive_attest_b2', args, RespostaAtestarB2, a.auth)
    return r.ok ? pipelineSuccess(r.data, 200, a.auth) : r.res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/attest' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
