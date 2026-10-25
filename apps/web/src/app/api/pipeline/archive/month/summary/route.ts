import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CorpoResumo, RespostaRecordResumo, STATUS_DO_CODIGO } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { caminhoDoResumo } from '@/lib/youtube/observatorio/arquivo-mensal/caminho'
import { chamar } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import { serializarResumo } from '@/lib/youtube/observatorio/arquivo-mensal/resumo'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Unidades = z.array(z.string().regex(/^u:[0-9a-f-]{36}$/))
const Rehash = z.object({ igual: z.boolean(), pulada: z.boolean().optional() }).strict()
const Linha = z.array(z.string().nullable())
const Linhas = z.object({
  versao: z.number().int().min(1), vazio: z.boolean(), unit_hashes: z.record(z.string(), z.string()),
  colunas_canal: z.array(z.string()), colunas_video: z.array(z.string()), canal: z.array(Linha), video: z.array(Linha),
}).passthrough()

/** C4: o resumo mensal de um canal. Recalcula o hash de cada unidade (uma chamada por unidade) antes de calcular o resumo. */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoResumo, a.auth)
  if (corpo instanceof Response) return corpo
  const sb = getSupabaseServiceClient()
  const mesData = `${corpo.mes}-01`
  try {
    const un = await chamar(sb, 'obs_archive_channel_units', { p_site: a.auth.siteId, p_class: corpo.classe, p_channel: corpo.canal, p_month: mesData }, Unidades, a.auth)
    if (!un.ok) return un.res
    for (const id of un.data) {
      const h = await chamar(sb, 'obs_archive_unit_rehash', { p_unit: id.slice(2) }, Rehash, a.auth)
      if (!h.ok) return h.res
      if (!h.data.igual) return pipelineError('conteudo_mudou', 'conteudo mudou', STATUS_DO_CODIGO.conteudo_mudou, a.auth)
    }
    const lin = await chamar(sb, 'obs_archive_summary_rows', { p_site: a.auth.siteId, p_class: corpo.classe, p_channel: corpo.canal, p_month: mesData }, Linhas, a.auth)
    if (!lin.ok) return lin.res
    const s = serializarResumo(lin.data)
    const por = (p: 'canal' | 'video') => s.arquivos.find(x => x.papel === p)
    const g = await chamar(sb, 'obs_archive_record', {
      p_site: a.auth.siteId, p_kind: 'resumo', p_payload: {
        classe: corpo.classe, canal: corpo.canal, mes: mesData, vazio: s.vazio, unit_hashes: s.unit_hashes,
        canal_sha256: por('canal')?.sha256 ?? null, canal_bytes: por('canal')?.bytes ?? null, canal_rows: por('canal')?.linhas ?? null,
        video_sha256: por('video')?.sha256 ?? null, video_bytes: por('video')?.bytes ?? null, video_rows: por('video')?.linhas ?? null,
      },
    }, RespostaRecordResumo, a.auth)
    if (!g.ok) return g.res
    const r = g.data
    if ((r.status !== 'nova' && r.status !== 'mesma') || r.arquivo_id === undefined || r.versao === undefined) {
      const status = (STATUS_DO_CODIGO as Record<string, number>)[r.status] ?? 409
      return pipelineError(r.status, r.status.replaceAll('_', ' '), status, a.auth)
    }
    const versao = r.versao
    return pipelineSuccess({
      arquivo_base: r.arquivo_id, versao, vazio: s.vazio,
      arquivos: s.arquivos.map(x => ({
        arquivo_id: `${r.arquivo_id}:${x.papel}`, tipo: 'resumo' as const, papel: x.papel,
        caminho: caminhoDoResumo({ classe: corpo.classe, canal: corpo.canal, mes: corpo.mes, versao, papel: x.papel }),
        sha256: x.sha256, bytes: x.bytes, linhas: x.linhas, conteudo_base64: x.gz.toString('base64'),
      })),
    }, 200, a.auth)
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/month/summary' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
