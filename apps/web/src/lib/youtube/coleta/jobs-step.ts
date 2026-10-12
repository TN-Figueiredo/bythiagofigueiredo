// Passo 1A (spec, seção 4): sondagem dos tipos de relatório e criação dos jobs da Reporting API.
// Erro da Reporting API afeta só os passos 1A e 1C; nunca para a parte da Analytics API.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { classificarErro, criarReportingClient, PaginacaoExcedidaError, type ReportingClient } from '@/lib/youtube/reporting/client'
import { ReportingHttpError, type Job } from '@/lib/youtube/reporting/types'
import { avisarEntrada, avisarSaida } from './alerts'
import { obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa, scopeJob } from './attempts'
import { emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { conferirBanco, pushUnico } from './schema'
import { descreverErro, HABILITADOS, statusHttp } from './token'
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
  campos: { status: JobStatus; error?: string | null; job?: Job; religado?: boolean },
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
    // Linha que volta a `ativo` (era `desativado`, `erro`, `tipo_indisponivel`...) mantém o `created_at` antigo, e sem esta
    // data o critério dos 6 dias contaria a idade da linha, não a do job, e alarmaria no primeiro dia. Se a API não
    // informou `createTime`, o job nasceu agora. Job que já estava ativo e vem sem `createTime` NÃO recebe a coluna no upsert
    // (só as colunas enviadas mudam): a data gravada fica, porque ausência nunca sobrescreve valor presente e o relógio do
    // alarme não reinicia. Só o `createTime` da API (valor presente) corrige uma data gravada.
    const criadoEm = campos.job.createTime ?? (campos.religado ? new Date().toISOString() : undefined)
    if (criadoEm !== undefined) linha.job_create_time = criadoEm
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
    // O job de um tipo com data de descontinuação é criado mesmo assim (o bruto vale enquanto vier), mas o dono fica
    // sabendo: quando o YouTube desligar o tipo, os relatórios param e a versão nova precisa entrar na lista.
    for (const t of tipos) {
      if (t.deprecateTime && HABILITADOS.includes(t.id)) {
        const passou = Date.parse(t.deprecateTime) < Date.now() // data ilegível (NaN): nunca "passou", a nota sai com o texto cru
        pushUnico(resumo.acao_do_dono, `${c.name}: ${t.id} tem data de descontinuação no YouTube (${t.deprecateTime})${passou ? ', que já passou' : ''}`)
      }
    }
    jobs = existentes
  } catch (e) {
    if (e instanceof SemTempoError) throw e
    // Se a listagem falhar, grava-se uma linha por tipo habilitado com o estado.
    const estado = estadoDoErro(e)
    const tipos = estado === 'erro' ? HABILITADOS.filter(t => status.get(t) !== 'ativo') : HABILITADOS
    // Os tipos que já estavam `ativo` continuam ativos (um erro transitório não os rebaixa): ficam no resumo.
    for (const t of HABILITADOS) if (!tipos.includes(t) && status.get(t) === 'ativo') estados[t] = 'ativo'
    for (const tipo of tipos) {
      estados[tipo] = estado
      await gravarJob(ctx, c, tipo, { status: estado, error: descreverErro(e) })
      await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
    }
    await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: statusHttp(e), error: descreverErro(e) })
    // Lista cortada em 20 páginas não é erro passageiro: a falha aparece na hora (não só depois de 3 dias de `erro`).
    if (e instanceof PaginacaoExcedidaError) pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, e.message)}`)
    if (estado === 'api_nao_ativada' || estado === 'sem_acesso') {
      pushUnico(resumo.acao_do_dono, `${c.name}: ${estado}`)
      await avisarEntrada(ctx, c, estado)
    }
    return
  }

  // Lista vazia (ou sem nenhum tipo habilitado) é "o dado não existe", não "o YouTube não oferece nada": marcar cada tipo
  // como `tipo_indisponivel` carimbaria por 3650 dias um aviso por tipo, todos falsos, sem aviso de saída. Não se grava
  // linha nem aviso; é UMA falha do passo e a próxima execução tenta de novo. Tipo isolado ausente de uma lista com
  // algum habilitado continua sendo `tipo_indisponivel` (abaixo).
  if (!HABILITADOS.some(t => oferecidos.has(t))) {
    const texto = 'o YouTube não devolveu a lista de tipos de relatório'
    pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, texto)}`)
    await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: null, error: texto })
    return
  }

  const porTipo = new Map(jobs.map(j => [j.reportTypeId, j]))

  let semTempo = false
  let primeiroErro: { status: number | null; texto: string } | null = null
  const falhou = (e: unknown) => { primeiroErro ??= { status: statusHttp(e), texto: descreverErro(e) } }
  await emParalelo(HABILITADOS, PARALELO, async (tipo) => {
    try {
      if (!oferecidos.has(tipo) && status.get(tipo) === 'ativo') {
        // Job que já funcionava e cujo tipo sumiu da lista: uma lista PARCIAL da API e um tipo de fato descontinuado são
        // indistinguíveis numa execução só. Rebaixar aqui carimbaria por 3650 dias um aviso falso e pararia a listagem do
        // tipo. Nada é gravado: o job fica `ativo` e a falha aparece a cada sondagem. NUNCA se rebaixa sozinho: não há
        // evidência persistente sem coluna nova (a sondagem nem roda com o canal completo), então quem decide é o dono.
        // Um tipo realmente descontinuado também aparece pelo critério dos 6 dias sem relatório novo.
        estados[tipo] = 'ativo'
        pushUnico(ctx.falhas, `jobs: ${channelNote(c.name, `o tipo ${tipo} sumiu da lista do YouTube; se repetir, foi descontinuado`)}`)
        return
      }
      if (!oferecidos.has(tipo)) {
        estados[tipo] = 'tipo_indisponivel'
        await gravarJob(ctx, c, tipo, { status: 'tipo_indisponivel' })
        await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'ok' })
        pushUnico(resumo.tipo_indisponivel, `${c.name}: ${tipo}`)
        await avisarEntrada(ctx, c, 'tipo_indisponivel', tipo)
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
        if (await gravarJob(ctx, c, tipo, { status: 'ativo', job, religado: status.get(tipo) !== 'ativo' })) resumo.gravados++
        await registrarTentativa(ctx, { ...tJob(tipo), outcome: 'ok' })
        return
      }
      const estado = estadoDoErro(erro)
      estados[tipo] = estado
      falhou(erro)
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

  // Saída só depois de todos os creates: se algum tipo ainda esbarra em api_nao_ativada/sem_acesso, o aviso de
  // entrada vale e mandar "voltou ao normal" faria o par entrada/saída se repetir a cada execução.
  if (!HABILITADOS.some(t => estados[t] === 'api_nao_ativada' || estados[t] === 'sem_acesso')) await avisarSaida(ctx, c)

  // Tipo que a lista devolve e não está habilitado: linha `desativado`, sem chamada.
  for (const tipo of oferecidos) {
    if (HABILITADOS.includes(tipo)) continue
    estados[tipo] = 'desativado'
    if (status.get(tipo) !== 'desativado') await gravarJob(ctx, c, tipo, { status: 'desativado' })
  }

  // Canal em que algum tipo terminou em erro não é "ok": a tentativa carrega o primeiro erro.
  const ruim = HABILITADOS.some(t => estados[t] === 'erro' || estados[t] === 'api_nao_ativada' || estados[t] === 'sem_acesso')
  const pe = primeiroErro as { status: number | null; texto: string } | null
  if (ruim) await registrarTentativa(ctx, { ...tCanal, outcome: 'erro_http', http_status: pe?.status ?? null, error: pe?.texto ?? 'erro ao criar o job' })
  else await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
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
      // Tipo tirado de REPORT_TYPES_ENABLED: a linha vira `desativado` aqui, só no banco (sem token e sem chamada
      // ao Google; o job continua existindo do lado de lá). Vale para qualquer estado, não só `ativo`: um tipo
      // desligado que ficasse em `api_nao_ativada` pediria ação do dono para sempre.
      const desligados: string[] = []
      for (const [tipo, st] of [...status]) {
        if (HABILITADOS.includes(tipo) || st === 'desativado') continue
        if (await gravarJob(ctx, c, tipo, { status: 'desativado' })) {
          status.set(tipo, 'desativado')
          desligados.push(tipo)
        }
      }
      // Completo = um job `ativo` para cada tipo habilitado E nenhuma linha `ativo` de tipo fora da lista
      // (só sobra uma se a escrita acima foi recusada: aí a sondagem roda e tenta de novo).
      const sobraAtivo = [...status].some(([tipo, st]) => st === 'ativo' && !HABILITADOS.includes(tipo))
      if (!sobraAtivo && HABILITADOS.every(t => status.get(t) === 'ativo')) {
        resumo.estados[c.id] = {
          ...Object.fromEntries(HABILITADOS.map(t => [t, 'ativo' as JobStatus])),
          ...Object.fromEntries(desligados.map(t => [t, 'desativado' as JobStatus])),
        }
        await registrarTentativa(ctx, { ...tCanal, outcome: 'ok' })
        continue
      }

      // Canal que perdeu a autorização ou nunca foi conectado: pulado, com a tentativa registrada por obterToken.
      const token = await obterToken(ctx, c, tCanal)
      if (token === null) continue

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
