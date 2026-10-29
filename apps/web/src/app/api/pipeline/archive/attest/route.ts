import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CorpoAtestar, RespostaAtestarB2, RespostaAtestarNas, RespostaAtestarPrefixos } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { chamar } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'

export const dynamic = 'force-dynamic'

/**
 * C7: `fonte: 'nas'` exige `archive_copy`, `fonte: 'b2'` exige `archive_b2` (a outra recebe 403).
 * M9 (C4, resolve C10): `prefixos` (opcional) é a prova de ausência por prefixo; não vazio, vai a `obs_archive_attest_prefixos` DEPOIS do attest
 * existente (que não os vê) e a resposta ganha `prefixos`. Sem `prefixos` ou com lista vazia a resposta é a da M3b, sem a chave.
 */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy', 'archive_b2'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoAtestar, a.auth)
  if (corpo instanceof Response) return corpo
  if ((corpo.fonte === 'nas') !== (a.permissao === 'archive_copy')) return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, a.auth)
  try {
    const sb = getSupabaseServiceClient()
    const { prefixos, ...corpoDoAttest } = corpo
    const args = { p_site: a.auth.siteId, p_body: corpoDoAttest }
    const r = corpo.fonte === 'nas'
      ? await chamar(sb, 'obs_archive_attest_nas', args, RespostaAtestarNas, a.auth)
      : await chamar(sb, 'obs_archive_attest_b2', args, RespostaAtestarB2, a.auth)
    if (!r.ok) return r.res
    if (prefixos === undefined || prefixos.length === 0) return pipelineSuccess(r.data, 200, a.auth)
    const p = await chamar(sb, 'obs_archive_attest_prefixos', {
      p_site: a.auth.siteId, p_fonte: corpo.fonte, p_execucao: corpo.fonte === 'b2' ? corpo.execucao_id : null,
      p_filhos: corpo.fonte === 'nas' ? corpo.filhos : {}, p_prefixos: prefixos,
    }, RespostaAtestarPrefixos, a.auth)
    return p.ok ? pipelineSuccess({ ...r.data, prefixos: p.data.prefixos }, 200, a.auth) : p.res
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/attest' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
