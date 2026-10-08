// Passo 1A (spec, seção 4): sondagem dos tipos de relatório e criação dos jobs da Reporting API.
// Erro da Reporting API afeta só os passos 1A e 1C; nunca para a parte da Analytics API.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { classificarErro, criarReportingClient, type ReportingClient } from '@/lib/youtube/reporting/client'
import { ReportingHttpError, type Job } from '@/lib/youtube/reporting/types'
import { avisarEntrada, avisarSaida } from './alerts'
import { contarPorResultado, registrarTentativa, scopeJob } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { conferirBanco, pushUnico } from './schema'
import { descreverErro, HABILITADOS, registrarSemConexao, statusHttp } from './token'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

export type JobStatus = 'ativo' | 'desativado' | 'sem_acesso' | 'api_nao_ativada' | 'tipo_indisponivel' | 'erro'

export interface JobsResumo extends StepResumo {
  /** `<canal>: api_nao_ativada` / `<canal>: sem_acesso` — só o dono resolve; não entra em falhas[]. */
  acao_do_dono: string[]
  /** `<canal>: <report_type_id>` */
  tipo_indisponivel: string[]
  /** Por `youtube_channels.id`, o estado de cada tipo depois desta execução. */
  estados: Record<string, Record<string, JobStatus>>
}

function estadoDoErro(e: unknown): JobStatus {
  const classe = classificarErro(e)
  return classe === 'api_nao_ativada' ? 'api_nao_ativada' : classe === 'sem_acesso' ? 'sem_acesso' : 'erro'
}

/** Só as colunas enviadas são alteradas: job_id e job_create_time sobrevivem a uma mudança de estado. */
async function gravarJob(
  ctx: StepCtx,
  c: ColetaChannel,
  tipo: string,
  campos: { status: JobStatus; error?: string | null; job?: Job },
): Promise<boolean> {
  const linha: Record<string, unknown> = {
    site_id: c.site_id,
    channel_id: c.id,
    report_type_id: tipo,
    status: campos.status,
    error: campos.error ?? null,
  }
  if (campos.job) {
    linha.job_id = campos.job.id
    linha.job_create_time = campos.job.createTime ?? null
  }
  const r = await ctx.supabase.from('yt_reporting_jobs').upsert(linha, { onConflict: 'channel_id,report_type_id' })
  return conferirBanco(r, 'yt_reporting_jobs', ctx.falhas) === 'ok'
}

async function sondarCanal(
  ctx: StepCtx,
  c: ColetaChannel,
  api: ReportingClient,
  status: Map<string, JobStatus>,
  resumo: JobsResumo,
): Promise<void> {
  const tCanal = { site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'sondagem' as const, channel_id: c.id }
  const tJob = (tipo: string) => ({ ...tCanal, scope_type: 'job' as const, scope_id: scopeJob(c.id, tipo) })
  const estados: Record<string, JobStatus> = {}
  resumo.estados[c.id] = estados

  let oferecidos: Set<string>
  let jobs: Job[]
  try {
    const [tipos, existentes] = await Promise.all([api.reportTypesList(), api.jobsList()])
    oferecidos = new Set(tipos.map(t => t.id))
    jobs = existentes
  } catch (e) {
    if (e instanceof SemTempoError) throw e
    // Se a listagem falhar, grava-se uma linha por tipo habilitado com o estado.
    const estado = estadoDoErro(e)
    const tipos = estado === 'erro' ? HABILITADOS.filter(t => status.get(t) !== 'ativo') : HABILITADOS
    for (const tipo of tipos) {
      estados[tipo] = estado
      await gravarJob(ctx, c, tipo, { status: estado, error: descreverErro(e) })
      await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
    }
    await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
    if (estado === 'api_nao_ativada' || estado === 'sem_acesso') {
      pushUnico(resumo.acao_do_dono, `${c.name}: ${estado}`)
      await avisarEntrada(ctx, c, estado)
    }
    return
  }

  // A chamada passou: os estados de "ação do dono" saem sozinhos.
  await avisarSaida(ctx, c)
  const porTipo = new Map(jobs.map(j => [j.reportTypeId, j]))

  let semTempo = false
  await emParalelo(HABILITADOS, PARALELO, async (tipo) => {
    try {
      if (!oferecidos.has(tipo)) {
        estados[tipo] = 'tipo_indisponivel'
        await gravarJob(ctx, c, tipo, { status: 'tipo_indisponivel' })
        await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'ok' })
        pushUnico(resumo.tipo_indisponivel, `${c.name}: ${tipo}`)
        await avisarEntrada(ctx, c, 'tipo_indisponivel')
        return
      }
      let job: Job | null = porTipo.get(tipo) ?? null
      let erro: unknown = null
      if (!job) {
        try {
          job = await api.jobsCreate({ reportTypeId: tipo, name: `bythiagofigueiredo ${tipo}` })
        } catch (e) {
          if (e instanceof SemTempoError) throw e
          erro = e
          if (e instanceof ReportingHttpError && e.status === 409) {
            // Já existe do lado do Google: lista de novo e adota.
            try {
              job = (await api.jobsList()).find(j => j.reportTypeId === tipo) ?? null
            } catch (e2) {
              if (e2 instanceof SemTempoError) throw e2
              erro = e2
            }
          }
        }
      }
      // Resposta sem id não é job: gravar `ativo` assim esconderia que nada foi criado.
      if (job && !job.id) {
        job = null
        erro = new Error('jobs.create answered without a job id')
      }
      if (job) {
        estados[tipo] = 'ativo'
        if (await gravarJob(ctx, c, tipo, { status: 'ativo', job })) resumo.gravados++
        await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'ok' })
        return
      }
      const estado = estadoDoErro(erro)
      estados[tipo] = estado
      await gravarJob(ctx, c, tipo, { status: estado, error: descreverErro(erro) })
      await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'erro_http', http_status: statusHttp(erro), error: descreverErro(erro) })
      if (estado === 'api_nao_ativada' || estado === 'sem_acesso') {
        pushUnico(resumo.acao_do_dono, `${c.name}: ${estado}`)
        await avisarEntrada(ctx, c, estado)
      }
    } catch (e) {
      if (e instanceof SemTempoError) {
        semTempo = true
        delete estados[tipo]
        return
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'jobs' }, extra: { canal: c.channel_id, tipo } })
      pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, describeCronCause(e))}`)
    }
  })

  if (semTempo) throw new SemTempoError()

  // Tipo que a lista devolve e não está habilitado: linha `desativado`, sem chamada.
  for (const tipo of oferecidos) {
    if (HABILITADOS.includes(tipo)) continue
    estados[tipo] = 'desativado'
    if (status.get(tipo) !== 'desativado') await gravarJob(ctx, c, tipo, { status: 'desativado' })
  }

  await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
}

export async function passoJobs(ctx: StepCtx): Promise<JobsResumo> {
  const resumo: JobsResumo = { gravados: 0, tentativas: {}, pendentes: 0, acao_do_dono: [], tipo_indisponivel: [], estados: {} }

  const canais = ctx.channels.filter(x => x.sync_enabled)
  for (let i = 0; i < canais.length; i++) {
    const c = canais[i]!
    const tCanal = { site_id: c.site_id, scope_type: 'canal' as const, scope_id: c.id, kind: 'sondagem' as const, channel_id: c.id }
    try {
      if (restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...tCanal, outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes++
        continue
      }

      const atuais = await ctx.supabase.from('yt_reporting_jobs').select('report_type_id, status').eq('channel_id', c.id)
      const leitura = conferirBanco(atuais, 'yt_reporting_jobs', ctx.falhas, 'ler')
      if (leitura !== 'ok') {
        await registrarTentativa(ctx, { ...tCanal, outcome: leitura === 'schema_ausente' ? 'schema_ausente' : 'erro_http', error: 'erro de banco' })
        if (leitura === 'schema_ausente') break
        continue
      }
      const status = new Map(
        ((atuais.data ?? []) as Array<{ report_type_id: string; status: JobStatus }>).map(r => [r.report_type_id, r.status]),
      )
      if (HABILITADOS.every(t => status.get(t) === 'ativo')) {
        resumo.estados[c.id] = Object.fromEntries(HABILITADOS.map(t => [t, 'ativo' as JobStatus]))
        await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
        continue
      }

      let token: string
      try {
        token = (await ensureFreshToken(c.site_id, 'youtube', c.channel_id)).accessToken
      } catch (e) {
        // Simplificação declarada de L1a: sem `collection_status`, canal revogado ou sem conexão é só pulado.
        if (await registrarSemConexao(ctx, tCanal, e)) continue
        throw e
      }

      await sondarCanal(ctx, c, criarReportingClient(token, fetchComPrazo(ctx.deadline)), status, resumo)
    } catch (e) {
      if (e instanceof SemTempoError) {
        // O prazo do passo acabou no meio do canal: não é erro de HTTP. Este canal e os seguintes ficam pendentes.
        for (const resto of canais.slice(i)) {
          await registrarTentativa(ctx, { site_id: resto.site_id, scope_type: 'canal', scope_id: resto.id, kind: 'sondagem', channel_id: resto.id, outcome: 'nao_alcancado_orcamento' })
          resumo.pendentes++
        }
        break
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'jobs' }, extra: { canal: c.channel_id } })
      pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, describeCronCause(e))}`)
      await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', error: describeCronCause(e) })
    }
  }

  resumo.tentativas = contarPorResultado(ctx.tentativas, ['sondagem'])
  return resumo
}