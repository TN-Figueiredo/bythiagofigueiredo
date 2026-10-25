import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CorpoExportar, COLUNA_DE_CONTROLE, parDaPolitica, RespostaParteInfo, RespostaRecord, TETO_LINHAS_DA_UNIDADE } from '@/lib/youtube/observatorio/arquivo-mensal/contrato'
import { caminhoDaUnidade, caminhoDaParte, idDaParte } from '@/lib/youtube/observatorio/arquivo-mensal/caminho'
import { lerUnidadeInteira, lerFaixa, dividirEmPartes, MudouDuranteALeitura, GrandeDemais, erroDoRpc, erroDoBancoDe } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import { exportarUnidade } from '@/lib/youtube/observatorio/arquivo/exportar'

const ContentHash = z.array(z.object({ row_count: z.union([z.number().int().min(0), z.string().regex(/^\d+$/).transform(Number)]) }).passthrough()).length(1)

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** C3: serializa UMA unidade (ou uma parte) em `.csv.gz`; os valores vão em cabeçalhos, nunca o valor esperado no corpo. */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_copy'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoExportar, a.auth)
  if (corpo instanceof Response) return corpo
  // C0, ordem 5: o par fora da política é 422, nunca o 400 do Zod (Yannis I7)
  if (!parDaPolitica(corpo)) return pipelineError('classe_tabela_invalida', 'classe e tabela fora da política', 422, a.auth)
  const sb = getSupabaseServiceClient()
  const u = { site: a.auth.siteId, classe: corpo.classe, tabela: corpo.tabela, canal: corpo.canal, mes: corpo.mes }
  const mesData = `${corpo.mes}-01`
  try {
    if (corpo.parte !== undefined) {
      const info = await sb.rpc('obs_archive_unit_part_info', { p_site: u.site, p_class: u.classe, p_table: u.tabela, p_channel: u.canal, p_month: mesData, p_part: corpo.parte })
      if (info.error) return erroDoRpc(info.error, a.auth)
      const st = RespostaRecord.safeParse(info.data)
      if (st.success && st.data.status !== 'ok') return pipelineError(st.data.status, st.data.status, 409, a.auth)   // nao_devida, canal_removido, mes_fora_do_banco
      const lidoInfo = RespostaParteInfo.safeParse(info.data)
      if (!lidoInfo.success) { Sentry.captureMessage('archive part_info fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
      const p = lidoInfo.data
      let faixa: Awaited<ReturnType<typeof lerFaixa>>
      try { faixa = await lerFaixa(sb, u, p.de, p.ate - p.de) } catch (e) {
        if (!(e instanceof MudouDuranteALeitura)) throw e
        // a unidade já existe (p.unidade_id): sem o motivo gravado, o plano não manda reexportar (Phil I2)
        const m = await sb.rpc('obs_archive_mark_redo', { p_unit: p.unidade_id, p_reason: 'mudou_durante_a_leitura' })
        if (m.error) return erroDoRpc(m.error, a.auth)
        return pipelineError('mudou_durante_a_leitura', 'mudou durante a leitura', 409, a.auth)
      }
      const s = await exportarUnidade({ ler: async () => faixa }, null, { tabela: u.tabela, canal: u.canal, de: mesData, ate: mesData, rotulo: caminhoDaParte({ ...u, versao: p.versao, parte: corpo.parte }) })
      if (s.sha256 !== p.sha256) {
        const m = await sb.rpc('obs_archive_mark_redo', { p_unit: p.unidade_id, p_reason: 'parte_mudou' })
        if (m.error) return erroDoRpc(m.error, a.auth)   // sem a marca gravada, o 409 mentiria (Phil I1)
        return pipelineError('parte_mudou', 'parte mudou', 409, a.auth)
      }
      // X-Arquivo-Linhas é o da parte; X-Arquivo-Soma vazio em toda parte (C3, Pedido 13)
      return bytes(s, { id: idDaParte(p.unidade_id, corpo.parte), versao: p.versao, partes: p.partes, parte: corpo.parte, coluna: COLUNA_DE_CONTROLE[u.tabela] ?? null }, a.auth)
    }
    // D25: a contagem antes de qualquer página; acima do teto, 413 sem ler (Yannis I9)
    const h = await sb.rpc('obs_archive_content_hash', { p_site: u.site, p_class: u.classe, p_table: u.tabela, p_channel: u.canal, p_month: mesData })
    if (h.error) return erroDoRpc(h.error, a.auth)
    const ch = ContentHash.safeParse(h.data)
    const contagem = ch.success ? ch.data[0]!.row_count : null
    if (contagem === null) { Sentry.captureMessage('archive content_hash fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
    if (contagem > TETO_LINHAS_DA_UNIDADE) return pipelineError('grande_demais', 'grande demais', 413, a.auth)
    const lido = await lerUnidadeInteira(sb, u)
    const base = { classe: u.classe, tabela: u.tabela, canal: u.canal, mes: mesData, hash_conteudo: lido.hash, schema_fp: lido.schemaFp, row_count: lido.contagem, control_sum: lido.soma }
    if (lido.contagem === 0) {
      const r = await sb.rpc('obs_archive_record', { p_site: u.site, p_kind: 'unidade', p_payload: base })
      if (r.error) return erroDoRpc(r.error, a.auth)
      const gl = RespostaRecord.safeParse(r.data)
      if (!gl.success) { Sentry.captureMessage('archive record fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
      const g = gl.data
      if (g.status !== 'nova' && g.status !== 'mesma') return pipelineError(g.status, g.status, 409, a.auth)
      return pipelineSuccess({ arquivo_id: g.arquivo_id, versao: g.versao, vazia: true, linhas: 0 }, 200, a.auth)
    }
    const partes = dividirEmPartes(lido.colunas, lido.linhas)
    const series = await Promise.all(partes.map(p => exportarUnidade({ ler: async () => ({ colunas: lido.colunas, linhas: p.linhas, contagem: p.linhas.length, soma: null }) }, null,
      { tabela: u.tabela, canal: u.canal, de: mesData, ate: mesData, rotulo: '' })))
    const inteira = partes.length === 1 ? series[0]! : null
    const r = await sb.rpc('obs_archive_record', { p_site: u.site, p_kind: 'unidade', p_payload: {
      // sha256_bytes: o check do SQL exige um valor; em unidade de várias partes vale o da parte 1, e o sha de cada parte está em `parts`
      ...base, sha256_bytes: inteira?.sha256 ?? series[0]!.sha256, csv_sha256: inteira?.csvSha256 ?? null, file_bytes: series.reduce((t, s) => t + s.bytes, 0),
      partes: partes.length, min_key: series[0]!.menorChave, max_key: series[series.length - 1]!.maiorChave,
      parts: partes.length === 1 ? [] : partes.map((p, i) => ({ parte: p.parte, sha256_bytes: series[i]!.sha256, csv_sha256: series[i]!.csvSha256, file_bytes: series[i]!.bytes,
        row_count: p.linhas.length, control_sum: null, row_offset: p.rowOffset, min_key: series[i]!.menorChave, max_key: series[i]!.maiorChave })),
    } })
    if (r.error) return erroDoRpc(r.error, a.auth)
    const gl = RespostaRecord.safeParse(r.data)
    if (!gl.success) { Sentry.captureMessage('archive record fora do esquema', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
    const g = gl.data
    if (g.status !== 'nova' && g.status !== 'mesma') return pipelineError(g.status, g.status, 409, a.auth)
    if (g.arquivo_id === undefined || g.versao === undefined) { Sentry.captureMessage('archive record sem arquivo_id', 'error'); return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth) }
    const id = g.arquivo_id.slice(2)
    const primeira = series[0]!
    const caminho = partes.length === 1 ? caminhoDaUnidade({ ...u, versao: g.versao }) : caminhoDaParte({ ...u, versao: g.versao, parte: 1 })
    return bytes({ ...primeira, caminho }, { id: partes.length === 1 ? g.arquivo_id : idDaParte(id, 1), versao: g.versao, partes: partes.length, parte: 1, coluna: COLUNA_DE_CONTROLE[u.tabela] ?? null }, a.auth,
      partes.length === 1 ? lido.soma : null)
  } catch (e) {
    if (e instanceof MudouDuranteALeitura) return pipelineError('mudou_durante_a_leitura', 'mudou durante a leitura', 409, a.auth)
    if (e instanceof GrandeDemais) return pipelineError('grande_demais', 'grande demais', 413, a.auth)
    const doBanco = erroDoBancoDe(e)
    if (doBanco) return erroDoRpc(doBanco, a.auth)
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/unit/export' } })   // Yannis I12: nunca 500 sem causa
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}

function bytes(s: { gz: Uint8Array; caminho: string; linhas: number; sha256: string; csvSha256: string; bytes: number }, h: { id: string; versao: number; partes: number; parte: number; coluna: string | null },
  auth: Parameters<typeof buildRateLimitHeaders>[0], soma: string | null = null): NextResponse {
  return new NextResponse(Buffer.from(s.gz), { status: 200, headers: {
    ...(buildRateLimitHeaders(auth) ?? {}), 'Content-Type': 'application/gzip',
    'X-Arquivo-Id': h.id, 'X-Arquivo-Versao': String(h.versao), 'X-Arquivo-Caminho': s.caminho, 'X-Arquivo-Linhas': String(s.linhas),
    'X-Arquivo-Soma': soma ?? '', 'X-Arquivo-Sha256': s.sha256, 'X-Arquivo-Csv-Sha256': s.csvSha256, 'X-Arquivo-Bytes': String(s.bytes),
    'X-Arquivo-Partes': String(h.partes), 'X-Arquivo-Parte': String(h.parte), 'X-Arquivo-Coluna-Controle': h.coluna ?? '',
  } })
}
