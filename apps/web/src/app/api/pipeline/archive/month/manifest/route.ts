import { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CLASSES, CorpoManifesto, MES_RE } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { caminhoDoManifesto, idDoManifesto } from '@/lib/youtube/observatorio/arquivo-mensal/caminho'
import { chamar, erroDoRpc } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import { montarManifesto } from '@/lib/youtube/observatorio/arquivo-mensal/manifesto-mensal'

export const dynamic = 'force-dynamic'

const Linhas = z.object({
  classe: z.enum(CLASSES), mes: z.string().regex(MES_RE), versao: z.number().int().min(1), gerado_em: z.string().min(1),
  arquivos: z.array(z.object({
    arquivo_id: z.string().min(1), tipo: z.enum(['unidade', 'parte', 'resumo']), caminho: z.string().nullable(), canal: z.string().nullable(), tabela: z.string().nullable(),
    linhas: z.union([z.number(), z.string()]).nullable(), soma: z.string().nullable(), sha256: z.string().nullable(), csv_sha256: z.string().nullable(),
    estado: z.enum(['normal', 'vazia', 'perdida', 'expurgada']),
  }).strict()),
  contagens: z.object({ unidades_canal_removido: z.number(), unidades_perdidas: z.number(), unidades_expurgadas: z.number() }).strict(),
}).strict()

const sha = (d: Uint8Array): string => createHash('sha256').update(d).digest('hex')

/** C5: o manifesto mensal de uma classe (`.json` e `.sha256`). */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoManifesto, a.auth)
  if (corpo instanceof Response) return corpo
  const sb = getSupabaseServiceClient()
  try {
    const lin = await chamar(sb, 'obs_archive_manifest_rows', { p_site: a.auth.siteId, p_class: corpo.classe, p_month: `${corpo.mes}-01` }, Linhas, a.auth)
    if (!lin.ok) return lin.res
    const rows = lin.data
    const m = montarManifesto(rows, a.auth.siteId)
    const gr = await sb.rpc('obs_archive_record_manifest', {
      p_site: a.auth.siteId, p_class: corpo.classe, p_month: `${corpo.mes}-01`, p_versao: rows.versao,
      p_json_sha256: sha(m.json), p_json_bytes: m.json.length, p_list_sha256: sha(m.lista), p_list_bytes: m.lista.length,
    })
    if (gr.error) return erroDoRpc(gr.error, a.auth)
    const arq = (papel: 'json' | 'sha256', b: Buffer) => ({
      arquivo_id: idDoManifesto(corpo.classe, corpo.mes, rows.versao, papel), tipo: 'manifesto' as const,
      caminho: caminhoDoManifesto({ classe: corpo.classe, mes: corpo.mes, versao: rows.versao, papel }),
      sha256: sha(b), bytes: b.length, conteudo_base64: b.toString('base64'),
    })
    return pipelineSuccess({ versao: rows.versao, arquivos: [arq('json', m.json), arq('sha256', m.lista)] }, 200, a.auth)
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/month/manifest' } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
