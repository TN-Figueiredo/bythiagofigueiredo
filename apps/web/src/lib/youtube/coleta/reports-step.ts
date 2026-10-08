// Passo 1C (spec, seção 5) — recorte do lote L1a: só listar e baixar o bruto. A normalização é L2.
// O histórico inicial some em 30 dias: por isso a fila é por prioridade (alcance primeiro) e o
// download usa a URL gravada na listagem, renovando-a quando o Google a recusa.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { classificarErro, criarReportingClient, paraBytea, type PacoteCsv, type ReportingClient } from '@/lib/youtube/reporting/client'
import { ReportingHttpError, SEM_NORMALIZADOR, type Report } from '@/lib/youtube/reporting/types'
import { contarPorResultado, registrarTentativa, scopeJob } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { conferirBanco, pushUnico } from './schema'
import { descreverErro, HABILITADOS, registrarSemConexao, statusHttp } from './token'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

export const MAX_DOWNLOADS = 40
export const MAX_GZ_BYTES = 2 * 1024 * 1024
const DIA_MS = 86_400_000
const MAX_PAGINAS = 50

export interface RelatoriosResumo extends StepResumo {
  /** Relatórios devolvidos pela listagem nesta execução (inclui os que já existiam). */
  vistos: number
  baixados: number
  vazios: number
  expirados: number
  erros_download: number
  bruto_apagado: number
}

interface JobRow {
  site_id: string
  channel_id: string
  report_type_id: string
  job_id: string | null
  job_create_time: string | null
  last_create_time: string | null
}

interface Pendente {
  site_id: string
  report_id: string
  channel_id: string
  report_type_id: string
  job_id: string
  download_url: string
  create_time: string
}

const instante = (s: string): number => new Date(s).getTime()
/** Erro do zlib (bytes que o gzip não aceita): relatório inutilizável, não falha de rede. */
const ehGzipInvalido = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.startsWith('Z_')
}

/** Todas as páginas de `reports.list` de um job. */
async function listarTudo(api: ReportingClient, jobId: string, createdAfter?: string): Promise<{ reports: Report[]; truncado: boolean }> {
  const todos: Report[] = []
  let pageToken: string | undefined
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const p = await api.reportsList(jobId, { createdAfter, pageToken })
    todos.push(...p.reports)
    if (!p.nextPageToken) return { reports: todos, truncado: false }
    pageToken = p.nextPageToken
  }
  // Chegou ao teto de páginas com mais por vir: quem chama decide; nada é descartado em silêncio.
  return { reports: todos, truncado: true }
}

/** Lista um job e insere os relatórios novos como `listado`. Nunca lança. */
async function listarJob(ctx: StepCtx, c: ColetaChannel, api: ReportingClient, j: JobRow, resumo: RelatoriosResumo): Promise<'sem_tempo' | void> {
  const tJob = { site_id: c.site_id, scope_type: 'job' as const, scope_id: scopeJob(c.id, j.report_type_id), kind: 'relatorio' as const, channel_id: c.id }
  const noJob = () => ctx.supabase.from('yt_reporting_jobs')
  try {
    const createdAfter = j.last_create_time ? new Date(instante(j.last_create_time) - DIA_MS).toISOString() : undefined
    const { reports: vistos, truncado } = await listarTudo(api, j.job_id!, createdAfter)
    resumo.vistos += vistos.length

    if (vistos.length > 0) {
      const criadoEm = j.job_create_time ? instante(j.job_create_time) : null
      const linhas = vistos.map(r => ({
        site_id: c.site_id,
        report_id: r.id,
        job_id: j.job_id,
        channel_id: c.id,
        report_type_id: j.report_type_id,
        start_time: r.startTime,
        end_time: r.endTime,
        create_time: r.createTime,
        job_expire_time: r.jobExpireTime ?? null,
        download_url: r.downloadUrl,
        is_backfill: criadoEm !== null && instante(r.startTime) < criadoEm,
        status: 'listado',
      }))
      // ignoreDuplicates: a listagem nunca altera uma linha que já existe.
      const ins = await ctx.supabase.from('yt_reporting_reports').upsert(linhas, { onConflict: 'report_id', ignoreDuplicates: true })
      const escrita = conferirBanco(ins, 'yt_reporting_reports', ctx.falhas)
      if (escrita !== 'ok') {
        await registrarTentativa(ctx, { ...tJob, outcome: escrita === 'schema_ausente' ? 'schema_ausente' : 'erro_http', error: 'erro de banco' })
        return
      }
    }

    // O maior createTime já listado, comparado como instante (o Google mistura frações de segundo).
    let maior = j.last_create_time
    if (truncado) {
      // Listagem incompleta: a marca não avança, para a próxima execução listar de novo a partir dela.
      pushUnico(ctx.falhas, `relatórios: listagem truncada em ${MAX_PAGINAS} páginas (${channelNote(c.name, j.report_type_id)})`)
    } else {
      for (const r of vistos) if (!maior || instante(r.createTime) > instante(maior)) maior = r.createTime
    }
    const upd = await noJob()
      .update({ last_listed_at: new Date().toISOString(), last_create_time: maior })
      .eq('channel_id', c.id)
      .eq('report_type_id', j.report_type_id)
    conferirBanco(upd, 'yt_reporting_jobs', ctx.falhas)
    await registrarTentativa(ctx, truncado ? { ...tJob, outcome: 'erro_http', error: 'listagem_truncada' } : { ...tJob, outcome: 'ok' })
  } catch (e) {
    // O prazo do passo acabou no meio da listagem: não é erro do job; nada é alterado.
    if (e instanceof SemTempoError) return 'sem_tempo'
    const classe = classificarErro(e)
    const novo =
      classe === 'nao_encontrado' ? { status: 'erro', error: 'job_removido' }
      : classe === 'api_nao_ativada' || classe === 'sem_acesso' ? { status: classe, error: descreverErro(e) }
      : null
    if (novo) {
      const upd = await noJob().update(novo).eq('channel_id', c.id).eq('report_type_id', j.report_type_id)
      conferirBanco(upd, 'yt_reporting_jobs', ctx.falhas)
    }
    await registrarTentativa(ctx, { ...tJob, outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
  }
}

/** Baixa um relatório pelo download_url gravado. Nunca lança. */
async function baixarUm(
  ctx: StepCtx,
  api: ReportingClient,
  p: Pendente,
  urls: Map<string, string>,
  renovados: Set<string>,
  resumo: RelatoriosResumo,
): Promise<'sem_tempo' | void> {
  const marcar = (campos: Record<string, unknown>) =>
    ctx.supabase.from('yt_reporting_reports').update(campos).eq('report_id', p.report_id)
  try {
    let pacote: PacoteCsv | null = null
    let erro: unknown = null
    try {
      pacote = await api.download(urls.get(p.report_id) ?? p.download_url)
    } catch (e) {
      erro = e
    }

    // URL vencida: renova as URLs do job uma vez por execução e tenta de novo.
    if (erro instanceof ReportingHttpError && (erro.status === 401 || erro.status === 403) && !renovados.has(p.job_id)) {
      renovados.add(p.job_id)
      try {
        // Só os `listado` deste job recebem URL nova; um já baixado nunca é tocado.
        const abertos = await ctx.supabase.from('yt_reporting_reports').select('report_id').eq('job_id', p.job_id).eq('status', 'listado')
        const ids = new Set(((abertos.data ?? []) as Array<{ report_id: string }>).map(x => x.report_id))
        if (conferirBanco(abertos, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') ids.clear()
        for (const r of (await listarTudo(api, p.job_id)).reports) {
          if (restante(ctx.deadline) <= 0) throw new SemTempoError()
          if (!ids.has(r.id)) continue
          urls.set(r.id, r.downloadUrl)
          const u = await ctx.supabase
            .from('yt_reporting_reports')
            .update({ download_url: r.downloadUrl })
            .eq('report_id', r.id)
            .eq('status', 'listado')
          conferirBanco(u, 'yt_reporting_reports', ctx.falhas)
        }
        const nova = urls.get(p.report_id)
        if (nova) {
          pacote = await api.download(nova)
          erro = null
        }
      } catch (e) {
        erro = e
      }
    }

    // O prazo do passo acabou no meio do relatório: ele continua `listado`, intocado.
    if (erro instanceof SemTempoError) return 'sem_tempo'

    if (erro || !pacote) {
      if (classificarErro(erro) === 'url_inesperada') {
        // URL fora do Google: nunca é tentada de novo nem leva token.
        conferirBanco(await marcar({ status: 'erro', error: 'url_inesperada' }), 'yt_reporting_reports', ctx.falhas)
        resumo.erros_download++
        return
      }
      if (ehGzipInvalido(erro)) {
        conferirBanco(await marcar({ status: 'erro', error: 'gzip_invalido' }), 'yt_reporting_reports', ctx.falhas)
        resumo.erros_download++
        return
      }
      if (erro instanceof ReportingHttpError && (erro.status === 404 || erro.status === 410)) {
        conferirBanco(await marcar({ status: 'expirado_sem_baixar', error: `HTTP ${erro.status}` }), 'yt_reporting_reports', ctx.falhas)
        resumo.expirados++
        return
      }
      // Erro passageiro: continua `listado` e tenta amanhã.
      resumo.erros_download++
      await registrarTentativa(ctx, {
        site_id: p.site_id, scope_type: 'job', scope_id: scopeJob(p.channel_id, p.report_type_id), kind: 'relatorio',
        outcome: 'erro_http', http_status: statusHttp(erro), error: descreverErro(erro), channel_id: p.channel_id,
      })
      return
    }

    if (pacote.gz.length > MAX_GZ_BYTES) {
      resumo.erros_download++
      conferirBanco(
        await marcar({ status: 'erro', error: 'grande_demais', bytes: pacote.gz.length, sha256: pacote.sha256, row_count: pacote.rowCount }),
        'yt_reporting_reports', ctx.falhas,
      )
      return
    }

    const blob = await ctx.supabase
      .from('yt_reporting_report_blobs')
      .upsert({ report_id: p.report_id, site_id: p.site_id, csv_gz: paraBytea(pacote.gz) }, { onConflict: 'report_id' })
    if (conferirBanco(blob, 'yt_reporting_report_blobs', ctx.falhas) !== 'ok') return

    const vazio = pacote.rowCount === 0
    const fim = await marcar({
      status: vazio ? 'vazio' : 'baixado',
      error: null,
      row_count: pacote.rowCount,
      bytes: pacote.gz.length,
      sha256: pacote.sha256,
      downloaded_at: new Date().toISOString(),
    })
    if (conferirBanco(fim, 'yt_reporting_reports', ctx.falhas) !== 'ok') return
    if (vazio) resumo.vazios++
    else resumo.baixados++
    resumo.gravados++
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'relatorios' }, extra: { report: p.report_id } })
    pushUnico(ctx.falhas, `relatórios: ${describeCronCause(e)}`)
  }
}

export async function passoRelatorios(ctx: StepCtx): Promise<RelatoriosResumo> {
  const resumo: RelatoriosResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, vistos: 0, baixados: 0, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0,
  }
  const fechar = (): RelatoriosResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['relatorio'])
    return resumo
  }
  const canais = ctx.channels.filter(c => c.sync_enabled)
  if (canais.length === 0) return fechar()
  const tCanal = (c: ColetaChannel) =>
    ({ site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'relatorio' as const, channel_id: c.id })

  if (restante(ctx.deadline) <= 0) {
    for (const c of canais) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
    resumo.pendentes = canais.length
    return fechar()
  }

  const f = fetchComPrazo(ctx.deadline)
  const clientes = new Map<string, ReportingClient>()

  // ── 1. Listar ────────────────────────────────────────────────────────────
  // Só o relógio conta como `nao_alcancado_orcamento`: quando acaba, o canal em curso e os seguintes
  // ficam pendentes e os downloads são pulados (os `listado` esperam a próxima execução).
  let semTempo = false
  for (let i = 0; i < canais.length && !semTempo; i++) {
    const c = canais[i]!
    try {
      if (restante(ctx.deadline) <= 0) throw new SemTempoError()
      const lidos = await ctx.supabase
        .from('yt_reporting_jobs')
        .select('site_id, channel_id, report_type_id, job_id, job_create_time, last_create_time')
        .eq('channel_id', c.id)
        .eq('status', 'ativo')
        // Só os tipos habilitados: tirar um tipo de REPORT_TYPES_ENABLED desliga a listagem e o download dele,
        // mesmo antes de o passo de jobs marcar a linha como `desativado`.
        .in('report_type_id', [...HABILITADOS])
      const leitura = conferirBanco(lidos, 'yt_reporting_jobs', ctx.falhas, 'ler')
      if (leitura === 'schema_ausente') {
        await registrarTentativa(ctx, { ...tCanal(c), outcome: 'schema_ausente' })
        return fechar()
      }
      if (leitura !== 'ok') {
        await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: 'erro de banco' })
        continue
      }
      const jobs = ((lidos.data ?? []) as JobRow[]).filter(j => !!j.job_id)
      if (jobs.length === 0) continue

      let token: string
      try {
        token = (await ensureFreshToken(c.site_id, 'youtube', c.channel_id)).accessToken
      } catch (e) {
        // Simplificação declarada de L1a: canal revogado ou sem conexão é só pulado.
        if (await registrarSemConexao(ctx, tCanal(c), e)) continue
        throw e
      }
      const api = criarReportingClient(token, f)
      clientes.set(c.id, api)
      const feitos = await emParalelo(jobs, PARALELO, j => listarJob(ctx, c, api, j, resumo))
      if (feitos.includes('sem_tempo')) throw new SemTempoError()
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'ok' })
    } catch (e) {
      if (e instanceof SemTempoError) {
        semTempo = true
        for (const resto of canais.slice(i)) await registrarTentativa(ctx, { ...tCanal(resto), outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes += canais.length - i
        continue
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'relatorios' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `relatórios: ${channelNote(c.name, describeCronCause(e))}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: describeCronCause(e) })
    }
  }

  // ── 2. Expirar por idade: 60 dias, ou 30 se for backfill ─────────────────
  const agora = Date.now()
  for (const [backfill, dias] of [[true, 30], [false, 60]] as const) {
    const r = await ctx.supabase
      .from('yt_reporting_reports')
      .update({ status: 'expirado_sem_baixar', error: 'passou do prazo sem baixar' })
      .eq('status', 'listado')
      .eq('is_backfill', backfill)
      .lt('create_time', new Date(agora - dias * DIA_MS).toISOString())
      .select('report_id')
    const escrita = conferirBanco(r, 'yt_reporting_reports', ctx.falhas)
    if (escrita === 'schema_ausente') return fechar()
    if (escrita === 'ok') resumo.expirados += ((r.data ?? []) as unknown[]).length
  }

  // ── 3. Baixar: por prioridade de tipo e create_time crescente, no máximo 40 ──
  const idsDosCanais = canais.map(c => c.id)
  const filaLida = await ctx.supabase
    .from('yt_reporting_reports')
    .select('site_id, report_id, channel_id, report_type_id, job_id, download_url, create_time')
    .eq('status', 'listado')
    .in('channel_id', idsDosCanais)
    .in('report_type_id', [...HABILITADOS]) // os `listado` de um tipo desligado ficam como estão
    .order('create_time', { ascending: true })
    .limit(1000)
  if (conferirBanco(filaLida, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return fechar()
  const prioridade = (tipo: string): number => {
    const i = HABILITADOS.indexOf(tipo)
    return i === -1 ? HABILITADOS.length : i
  }
  const fila = ((filaLida.data ?? []) as Pendente[])
    .filter(p => clientes.has(p.channel_id))
    .sort((a, b) => prioridade(a.report_type_id) - prioridade(b.report_type_id) || instante(a.create_time) - instante(b.create_time))

  const urls = new Map<string, string>()
  const renovados = new Set<string>()
  const alvo = fila.slice(0, MAX_DOWNLOADS)
  for (let i = 0; i < alvo.length && !semTempo; i++) {
    const p = alvo[i]!
    // Um de cada vez: o buffer do relatório anterior já foi liberado.
    const r = restante(ctx.deadline) <= 0 ? 'sem_tempo' : await baixarUm(ctx, clientes.get(p.channel_id)!, p, urls, renovados, resumo)
    if (r === 'sem_tempo') {
      semTempo = true
      // Só o relógio conta como nao_alcancado_orcamento; o teto de 40 e a fila não.
      const afetados = new Set(alvo.slice(i).map(x => x.channel_id))
      for (const c of canais) if (afetados.has(c.id)) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
    }
  }

  // ── 4. Limpar o bruto ────────────────────────────────────────────────────
  if (restante(ctx.deadline) > 0) {
    const purge = await ctx.supabase.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: SEM_NORMALIZADOR })
    if (conferirBanco(purge, 'yt_reporting_blobs_purge', ctx.falhas) === 'ok' && typeof purge.data === 'number') {
      resumo.bruto_apagado = purge.data
    }
  }

  // ── 5. O que ficou para depois ───────────────────────────────────────────
  const resta = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .eq('status', 'listado')
    .in('channel_id', idsDosCanais)
    .in('report_type_id', [...HABILITADOS]) // o que nunca será baixado não é pendência
  if (conferirBanco(resta, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') resumo.pendentes += resta.count ?? 0

  return fechar()
}
