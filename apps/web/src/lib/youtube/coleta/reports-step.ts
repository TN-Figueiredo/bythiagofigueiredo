// Passo 1C (spec, seção 5) — recorte do lote L1a: só listar e baixar o bruto. A normalização é L2.
// O histórico inicial some em 30 dias: por isso a fila é pelo vencimento na origem (fila-relatorios.ts) e o
// download usa a URL gravada na listagem, renovando-a quando o Google a recusa.
import * as Sentry from '@sentry/nextjs'
import { channelNote, describeCronCause } from '@/lib/cron/failure-note'
import { classificarErro, criarReportingClient, MAX_GZ_BYTES, paraBytea, type PacoteCsv, type ReportingClient } from '@/lib/youtube/reporting/client'
import { ArquivoGrandeDemaisError, ReportingHttpError, SEM_NORMALIZADOR, type Report } from '@/lib/youtube/reporting/types'
import { obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa, scopeJob } from './attempts'
import { dormir, emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { DIA_MS, VALIDADE_DIAS, ordenarFila, perdaCobertaPorCriterios, venceEm, type ItemDaFila } from './fila-relatorios'
import { conferirBanco, pushUnico } from './schema'
import { descreverErro, HABILITADOS, statusHttp } from './token'
import type { ColetaChannel, StepCtx, StepResumo } from './types'

// Tetos da E12 (A5). Medida de produção, 09 a 12/10/2026: até 0,90 s por download (um por vez) e o maior relatório
// com 564 bytes comprimidos. 100 downloads + a listagem cabem em TETOS_MS.relatorios; reports-step.test.ts refaz a conta.
export const MAX_DOWNLOADS = 100
/** O limite da Reporting API é POR MINUTO (medido em 14/10: 37 downloads em ~30 s, 429 por ~30 s, e volta a passar). */
export const ESPERA_429_PADRAO_MS = 60_000
/** Teto da espera pedida por `Retry-After`: acima disto o passo para em vez de dormir. */
export const ESPERA_429_MAX_MS = 90_000
/** Depois de esperar tem de sobrar isto do prazo do passo (para baixar ao menos alguns e fechar). */
export const FOLGA_APOS_ESPERA_MS = 10_000
/** Acima disto o relatório vira `erro: grande_demais` e o bruto NÃO é guardado. O teto vale no cliente (Content-Length e
 *  leitura limitada) e há um segundo, do CSV descomprimido (MAX_CSV_BYTES): reporting/client.ts. Reexportado aqui. */
export { MAX_GZ_BYTES }
const MAX_PAGINAS = 50
/** O PostgREST devolve no máximo 1000 linhas por resposta (max-rows): a fila é lida em páginas, nunca com um `limit` só. */
const TAMANHO_PAGINA = 1000
/** Teto de páginas da fila (5000 relatórios; a fila real vai a ~660). Passar disto é leitura cortada, nunca "tudo lido". */
const MAX_PAGINAS_FILA = 5

export interface RelatoriosResumo extends StepResumo {
  /** Relatórios devolvidos pela listagem nesta execução (inclui os que já existiam). */
  vistos: number
  baixados: number
  vazios: number
  expirados: number
  erros_download: number
  bruto_apagado: number
  /** Maior corpo LIDO nesta execução, em bytes (inclui o recusado por tamanho). É a unidade do teto e do aviso de metade do teto;
   *  a coluna `bytes` do relatório é outra coisa (o gzip guardado). 0 = nenhum download. */
  maior_bytes: number
  /** Por tipo, o maior corpo lido e se ele era um .gz de verdade (`null` = não examinado: recusado pelo Content-Length ou pela
   *  leitura limitada). É a medida de D+3 do tamanho real dos tipos novos e do `Content-Encoding` que o servidor aplica. */
  maior_lido_por_tipo: Record<string, { bytes: number; gz: boolean | null }>
  /** Quantos corpos desta execução eram um .gz de verdade (os demais vieram como CSV puro, depois do gzip de transporte). */
  corpos_gz: number
  /** Dos `expirados`, quantos por tipo HABILITADO (informação do resumo; a nota é só dos de baixo). */
  expirados_por_tipo: Record<string, number>
  /** Dos de `expirados_por_tipo`, os que NENHUM critério persistente cobre: é o que vira a nota da execução em falhas[].
   *  Os cobertos já têm nota própria em criteria.ts (uma perda, uma nota por execução). */
  expirados_sem_cobertura_por_tipo: Record<string, number>
  /** Dias inteiros até vencer o primeiro relatório que ficou `listado`. null = nada ficou para trás (ou a leitura falhou: aí há nota em falhas[]). */
  vence_primeiro_em_dias: number | null
  ms_listar: number
  ms_baixar: number
  /** O laço de download parou por 429 (ou por não caber a espera): o resto fica `listado` para a próxima execução. */
  parou_por_limite: boolean
  /** Quantas vezes o passo esperou o minuto seguinte por causa de 429, e quanto tempo gastou nisso. */
  esperas_429: number
  ms_espera_429: number
  /** Itens do alvo desta execução que o laço não baixou por ter parado no limite (o item que levou o 429 não conta). */
  nao_tentados: number
}

/** 429 no download: o relatório não tem defeito. Nada é gravado nele; quem decide esperar ou parar é o laço. */
interface LimiteDeCota { limite: true; retryAfterMs: number | null }

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
  is_backfill: boolean
  /** MG13. Nulo/ausente = zero tentativas / sem registro de vencimento. */
  download_attempts?: number | null
  expired_at?: string | null
}

const instante = (s: string): number => new Date(s).getTime()
/** DD/MM em UTC. */
const diaMes = (ms: number): string => { const d = new Date(ms).toISOString(); return `${d.slice(8, 10)}/${d.slice(5, 7)}` }
/** Erro do zlib (bytes que o gzip não aceita): relatório inutilizável, não falha de rede. */
const ehGzipInvalido = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.startsWith('Z_')
}

/** Abort por sinal (AbortSignal.timeout ou controller): `TimeoutError`/`AbortError`. */
const ehAbort = (e: unknown): boolean => {
  const nome = (e as { name?: unknown } | null)?.name
  return nome === 'TimeoutError' || nome === 'AbortError'
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
        // Sem a data de criação do job não dá para separar histórico de corrente: vale o prazo curto (30 dias).
        // Ausência nunca alonga prazo: `false` aqui daria 60 dias a um arquivo que pode sumir aos 30.
        is_backfill: criadoEm === null || !(instante(r.startTime) >= criadoEm), // startTime ilegível (NaN) também cai no prazo curto
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

/** Relatório que venceu sem ser baixado: só o de tipo habilitado conta (o de tipo desligado ninguém ia baixar). */
function contarVencido(resumo: RelatoriosResumo, p: ItemDaFila, agora: number): void {
  const tipo = p.report_type_id
  if (!HABILITADOS.includes(tipo)) return
  resumo.expirados_por_tipo[tipo] = (resumo.expirados_por_tipo[tipo] ?? 0) + 1
  if (!perdaCobertaPorCriterios(p, agora)) resumo.expirados_sem_cobertura_por_tipo[tipo] = (resumo.expirados_sem_cobertura_por_tipo[tipo] ?? 0) + 1
}

/** Registra o corpo lido no resumo: maior por tipo (com a marca de .gz) e a contagem de .gz de verdade. */
function anotarLido(resumo: RelatoriosResumo, tipo: string, bytes: number, gz: boolean | null): void {
  resumo.maior_bytes = Math.max(resumo.maior_bytes, bytes)
  if (gz === true) resumo.corpos_gz++
  const atual = resumo.maior_lido_por_tipo[tipo]
  if (!atual || bytes > atual.bytes) resumo.maior_lido_por_tipo[tipo] = { bytes, gz }
}

/** Baixa um relatório pelo download_url gravado. Nunca lança. */
async function baixarUm(
  ctx: StepCtx,
  api: ReportingClient,
  p: Pendente,
  urls: Map<string, string>,
  renovados: Set<string>,
  resumo: RelatoriosResumo,
): Promise<'sem_tempo' | LimiteDeCota | void> {
  // Toda marcação de estado só vale para quem ainda está `listado`: com duas execuções sobrepostas, a que chega depois não
  // rebaixa (para `erro` ou `expirado_sem_baixar`) nem regrava um relatório que a outra acabou de baixar.
  const marcar = (campos: Record<string, unknown>) =>
    ctx.supabase.from('yt_reporting_reports').update(campos).eq('report_id', p.report_id).eq('status', 'listado')
  // MG13: a tentativa é somada a partir do valor lido na fila (o PostgREST não soma num update). Duas execuções
  // sobrepostas podem contar uma só: o `.eq('status', 'listado')` de `marcar` garante que nenhuma rebaixa a outra.
  const tentativa = (p.download_attempts ?? 0) + 1
  const falhou = () => ({ download_attempts: tentativa, last_error_at: new Date().toISOString() })
  // Recusa por tamanho: sem conserto automático, o bruto não é guardado. Fica vermelho na hora (aqui) e por 14 dias (critérios).
  const recusarPorTamanho = async (bytes: number, detalhe: string, extra: Record<string, unknown>, gz: boolean | null): Promise<void> => {
    anotarLido(resumo, p.report_type_id, bytes, gz)
    resumo.erros_download++
    // Canal e prazo: o dono precisa saber de quem é e até quando o arquivo existe na origem (é o prazo para subir o teto e
    // devolver o relatório à fila). create_time ilegível não vira data de 1970: o prazo é dito desconhecido.
    const nome = ctx.channels.find(c => c.id === p.channel_id)?.name ?? p.channel_id
    const prazo = Number.isNaN(instante(p.create_time)) ? 'prazo na origem desconhecido' : `vence na origem em ${diaMes(venceEm(p))} (UTC)`
    pushUnico(ctx.falhas, `relatórios: ${channelNote(nome, `${p.report_type_id} recusado por tamanho (${detalhe}): o bruto NÃO foi guardado; ${prazo}`)}`)
    conferirBanco(await marcar({ status: 'erro', error: 'grande_demais', bytes, ...extra, ...falhou() }), 'yt_reporting_reports', ctx.falhas)
  }
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

    // Limite de cota por minuto: não é erro do relatório (sem download_attempts, sem last_error_at, sem erro gravado).
    if (erro instanceof ReportingHttpError && erro.status === 429) return { limite: true, retryAfterMs: erro.retryAfterMs }

    // O prazo do passo acabou no meio do relatório: ele continua `listado`, intocado. O abort do prazo durante a LEITURA do
    // corpo chega como TimeoutError/AbortError (só o `fetch` é embrulhado em SemTempoError): sem prazo sobrando, é falta de tempo.
    if (erro instanceof SemTempoError) return 'sem_tempo'
    if (erro && ehAbort(erro) && restante(ctx.deadline) <= 0) return 'sem_tempo'

    if (erro instanceof ArquivoGrandeDemaisError) {
      // O cliente recusou antes de guardar (Content-Length, leitura limitada ou bomba de descompressão): mesmo caminho do
      // `grande_demais` abaixo. Terminal, nota visível com o tamanho; nunca `gzip_invalido` nem erro de rede (que tentam de novo).
      await recusarPorTamanho(erro.bytes, erro.detalhe, {}, erro.lado === 'descomprimido' ? true : null)
      return
    }

    if (erro || !pacote) {
      if (classificarErro(erro) === 'url_inesperada') {
        // URL fora do Google: nunca é tentada de novo nem leva token.
        conferirBanco(await marcar({ status: 'erro', error: 'url_inesperada', ...falhou() }), 'yt_reporting_reports', ctx.falhas)
        resumo.erros_download++
        return
      }
      if (erro instanceof ReportingHttpError && (erro.status === 404 || erro.status === 410)) {
        // MG13: a origem RESPONDEU 404/410, e só nesse caso o instante é gravado (vencido por idade não ganha expired_at).
        const quando = falhou()
        const gravou = conferirBanco(await marcar({ status: 'expirado_sem_baixar', error: `HTTP ${erro.status}`, expired_at: quando.last_error_at, ...quando }), 'yt_reporting_reports', ctx.falhas)
        resumo.expirados++
        // O critério persistente só cobre esta perda se `expired_at` ficou gravado: com a gravação falhando, a nota do passo
        // avisa hoje e amanhã o 404 se repete e grava (o relatório continua `listado`).
        contarVencido(resumo, gravou === 'ok' ? { ...p, expired_at: quando.last_error_at } : p, Date.now())
        return
      }
      // Erro passageiro: continua `listado` e tenta amanhã. Gzip que não abre entra aqui: um download cortado no meio
      // chega assim, e marcá-lo `erro` seria desistir de um relatório que ainda existe na origem.
      resumo.erros_download++
      conferirBanco(await marcar(falhou()), 'yt_reporting_reports', ctx.falhas)
      await registrarTentativa(ctx, {
        site_id: p.site_id, scope_type: 'job', scope_id: scopeJob(p.channel_id, p.report_type_id), kind: 'relatorio',
        outcome: 'erro_http', http_status: statusHttp(erro), error: ehGzipInvalido(erro) ? 'gzip_invalido' : descreverErro(erro), channel_id: p.channel_id,
      })
      return
    }

    // Rede de segurança: o cliente já recusa o que passa do teto de leitura. Cobre o gzip guardado (o que vai para o banco) e,
    // por via das dúvidas, o corpo lido, sempre na unidade do teto.
    if (pacote.gz.length > MAX_GZ_BYTES || pacote.lidos > MAX_GZ_BYTES) {
      const maior = Math.max(pacote.gz.length, pacote.lidos)
      await recusarPorTamanho(maior, `${maior} bytes lidos do corpo; teto ${MAX_GZ_BYTES}`, { sha256: pacote.sha256, row_count: pacote.rowCount }, pacote.eraGz)
      return
    }
    anotarLido(resumo, p.report_type_id, pacote.lidos, pacote.eraGz)

    const blob = await ctx.supabase
      .from('yt_reporting_report_blobs')
      .upsert({ report_id: p.report_id, site_id: p.site_id, csv_gz: paraBytea(pacote.gz) }, { onConflict: 'report_id' })
    // Falha ao gravar o bruto: o relatório fica `listado` (tenta amanhã), mas deixa rastro. Sem a tentativa o alerta de 3 dias
    // (criterioJobsEmErro) nunca dispararia, e a nota genérica de "erro de banco" não diz canal, tipo nem tamanho.
    // `outcome` só aceita os valores do check de yt_own_collection_attempts (sem migration): o motivo vai no texto de `error`.
    const falhasBlob: string[] = []
    const gravou = conferirBanco(blob, 'yt_reporting_report_blobs', falhasBlob)
    if (gravou === 'schema_ausente') {
      for (const f of falhasBlob) pushUnico(ctx.falhas, f)
      return
    }
    if (gravou === 'erro') {
      // Regra do módulo (schema.ts): a nota e a tentativa levam só o CÓDIGO do erro do banco, nunca o texto do Postgres (que pode
      // trazer nome de tabela, host ou trecho de dado). O texto inteiro vai para o Sentry.
      const motivo = blob.error?.code || 'sem código'
      Sentry.captureException(new Error(`gravação do bruto ${p.report_id} falhou: ${blob.error?.message ?? 'sem texto'}`), {
        tags: { cron: 'sync-analytics-metrics', passo: 'relatorios' }, extra: { report: p.report_id, tipo: p.report_type_id, codigo: blob.error?.code ?? null },
      })
      const nome = ctx.channels.find(c => c.id === p.channel_id)?.name ?? p.channel_id
      resumo.erros_download++
      conferirBanco(await marcar(falhou()), 'yt_reporting_reports', ctx.falhas)
      pushUnico(ctx.falhas, `relatórios: ${channelNote(nome, `a GRAVAÇÃO do bruto de ${p.report_type_id} falhou (${pacote.gz.length} bytes comprimidos; banco: ${motivo}); o relatório continua na fila`)}`)
      await registrarTentativa(ctx, {
        site_id: p.site_id, scope_type: 'job', scope_id: scopeJob(p.channel_id, p.report_type_id), kind: 'relatorio',
        outcome: 'erro_http', error: `erro_gravacao: ${p.report_type_id}, ${pacote.gz.length} bytes, ${motivo}`, channel_id: p.channel_id,
      })
      return
    }

    const vazio = pacote.rowCount === 0
    const fim = await marcar({
      status: vazio ? 'vazio' : 'baixado',
      error: null,
      row_count: pacote.rowCount,
      bytes: pacote.gz.length,
      sha256: pacote.sha256,
      downloaded_at: new Date().toISOString(),
      download_attempts: tentativa,
    })
    if (conferirBanco(fim, 'yt_reporting_reports', ctx.falhas) !== 'ok') return
    if (vazio) resumo.vazios++
    else resumo.baixados++
    resumo.gravados++
    // Mesma unidade da recusa (bytes lidos do corpo), senão o aviso nunca vem antes dela: com gzip de transporte o gzip guardado
    // é uma fração do CSV lido.
    if (pacote.lidos > MAX_GZ_BYTES / 2) {
      pushUnico(ctx.falhas, `relatórios: ${p.report_type_id} chegou a ${pacote.lidos} bytes lidos do corpo, mais da metade do teto de ${MAX_GZ_BYTES} bytes lidos`)
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'relatorios' }, extra: { report: p.report_id } })
    pushUnico(ctx.falhas, `relatórios: ${describeCronCause(e)}`)
  }
}

interface FilaLida {
  /** A resposta com erro (a primeira que falhou) ou a última lida: é o que `conferirBanco` examina. */
  resposta: { error?: { code?: string; message?: string } | null }
  linhas: Pendente[]
  /** Total real (count exato da primeira página). null = o banco não devolveu a contagem. */
  total: number | null
  /** true = há relatório `listado` que esta leitura não trouxe. Sem contagem e com o limite de páginas cheio, vale true. */
  cortada: boolean
}

/**
 * Lê TODOS os relatórios `listado` dos canais e dos tipos habilitados, em páginas de 1000 ordenadas por (create_time, report_id).
 * Um `limit(1000)` só cortaria por create_time, e create_time não é a ordem de vencimento (histórico vence em 30 dias, corrente
 * em 60): acima de 1000 pendentes deixaria de fora justamente um histórico recente que vence antes. Lida a fila inteira, a
 * ordem por vencimento (`ordenarFila`) vale. Falha em qualquer página = leitura falha (nunca fila parcial em silêncio).
 */
async function lerFilaPendente(ctx: StepCtx, idsDosCanais: string[]): Promise<FilaLida> {
  const linhas: Pendente[] = []
  let total: number | null = null
  let ultima: FilaLida['resposta'] = {}
  let cheia = false
  for (let p = 0; p < MAX_PAGINAS_FILA; p++) {
    const r = await ctx.supabase
      .from('yt_reporting_reports')
      .select('site_id, report_id, channel_id, report_type_id, job_id, download_url, create_time, is_backfill, download_attempts, expired_at', p === 0 ? { count: 'exact' } : undefined) // a contagem só na primeira página
      .eq('status', 'listado')
      .in('channel_id', idsDosCanais)
      .in('report_type_id', [...HABILITADOS]) // os `listado` de um tipo desligado ficam como estão (e não são pendência)
      .order('create_time', { ascending: true })
      .order('report_id', { ascending: true })
      .range(p * TAMANHO_PAGINA, (p + 1) * TAMANHO_PAGINA - 1)
    ultima = r
    if (r.error) return { resposta: r, linhas: [], total: null, cortada: false }
    if (p === 0) total = r.count ?? null
    const pagina = (r.data ?? []) as Pendente[]
    linhas.push(...pagina)
    cheia = pagina.length >= TAMANHO_PAGINA
    if (!cheia) break
  }
  // Com contagem: cortada se faltou linha. Sem contagem, ausência não é "tudo lido": a última página cheia conta como corte.
  const cortada = total === null ? cheia : linhas.length < total
  return { resposta: ultima, linhas, total, cortada }
}

/** Relatórios gravados por dia, média de 3 dias (janela de 3 dias + 6 h: o cron roda 1x/dia e os downloads de D-3 caem
 * minutos antes de `agora − 72 h`). null = leitura falhou (não vira zero). */
async function vazaoDiaria(ctx: StepCtx, idsDosCanais: string[]): Promise<number | null> {
  const r = await ctx.supabase
    .from('yt_reporting_reports')
    .select('report_id', { count: 'exact', head: true })
    .in('channel_id', idsDosCanais)
    .gte('downloaded_at', new Date(Date.now() - 3 * DIA_MS - 6 * 3_600_000).toISOString())
  if (r.error || r.count === null || r.count === undefined) return null
  return r.count / 3
}

export async function passoRelatorios(ctx: StepCtx): Promise<RelatoriosResumo> {
  const resumo: RelatoriosResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, vistos: 0, baixados: 0, vazios: 0, expirados: 0, erros_download: 0, bruto_apagado: 0,
    maior_bytes: 0, maior_lido_por_tipo: {}, corpos_gz: 0, expirados_por_tipo: {}, expirados_sem_cobertura_por_tipo: {}, vence_primeiro_em_dias: null, ms_listar: 0, ms_baixar: 0,
    parou_por_limite: false, esperas_429: 0, ms_espera_429: 0, nao_tentados: 0,
  }
  const fechar = (): RelatoriosResumo => {
    // Em toda saída do passo: o que venceu sem baixar nesta execução e nenhum critério persistente cobre vira nota, com a
    // contagem por tipo. O que os critérios cobrem (criteria.ts) tem a nota deles: uma perda, uma nota por execução.
    const vencidos = Object.entries(resumo.expirados_sem_cobertura_por_tipo)
    if (vencidos.length > 0) {
      const total = vencidos.reduce((soma, [, n]) => soma + n, 0)
      pushUnico(ctx.falhas, `relatórios: ${total} relatório(s) venceram sem baixar nesta execução (${vencidos.map(([t, n]) => `${t}: ${n}`).join(', ')})`)
    }
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

  const t0 = Date.now()
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

      const token = await obterToken(ctx, c, tCanal(c))
      if (token === null) continue
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

  resumo.ms_listar = Date.now() - t0
  // ── 2. Expirar por idade: 60 dias, ou 30 se for backfill ─────────────────
  const agora = Date.now()
  for (const [backfill, dias] of [[true, VALIDADE_DIAS.historico], [false, VALIDADE_DIAS.corrente]] as const) {
    const r = await ctx.supabase
      .from('yt_reporting_reports')
      .update({ status: 'expirado_sem_baixar', error: 'passou do prazo sem baixar' })
      .eq('status', 'listado')
      .eq('is_backfill', backfill)
      .lt('create_time', new Date(agora - dias * DIA_MS).toISOString())
      .select('report_id, report_type_id, create_time, is_backfill')
    const escrita = conferirBanco(r, 'yt_reporting_reports', ctx.falhas)
    if (escrita === 'schema_ausente') return fechar()
    if (escrita === 'ok') {
      const linhas = (r.data ?? []) as Array<ItemDaFila>
      resumo.expirados += linhas.length
      for (const l of linhas) contarVencido(resumo, l, agora)
    }
  }

  // ── 3. Baixar: pelo vencimento na origem (fila-relatorios.ts), no máximo MAX_DOWNLOADS ──
  const idsDosCanais = canais.map(c => c.id)
  const filaLida = await lerFilaPendente(ctx, idsDosCanais)
  if (conferirBanco(filaLida.resposta, 'yt_reporting_reports', ctx.falhas, 'ler') !== 'ok') return fechar()
  if (filaLida.cortada) {
    const fora = filaLida.total === null ? 'contagem indisponível: pode haver mais' : `ficaram de fora ${filaLida.total - filaLida.linhas.length}`
    pushUnico(ctx.falhas, `relatórios: fila de download cortada em ${filaLida.linhas.length} relatórios (${fora}); a ordem por vencimento não cobre o que ficou de fora`)
  }
  const fila = ordenarFila(filaLida.linhas.filter(p => clientes.has(p.channel_id)), agora)

  const urls = new Map<string, string>()
  const renovados = new Set<string>()
  const alvo = fila.slice(0, MAX_DOWNLOADS)
  const t1 = Date.now()
  for (let i = 0; i < alvo.length && !semTempo; i++) {
    const p = alvo[i]!
    // Um de cada vez: o buffer do relatório anterior já foi liberado.
    let item429 = false
    let r = restante(ctx.deadline) <= 0 ? 'sem_tempo' : await baixarUm(ctx, clientes.get(p.channel_id)!, p, urls, renovados, resumo)
    if (typeof r === 'object') {
      // 429: espera o próximo minuto (Retry-After, senão 60 s) e repete o MESMO item uma vez; se não couber no prazo, se o
      // Retry-After passar do teto ou se o segundo também for 429, para o laço. Os itens seguintes ficam intocados (`listado`,
      // sem tentativa somada). O 429 NÃO vai para yt_own_collection_attempts: a linha do dia é "última escrita vence" e
      // apagaria um erro real do mesmo job; a visibilidade fica em parou_por_limite/esperas_429/nao_tentados.
      item429 = true
      for (let volta = 0; volta < 1 && typeof r === 'object'; volta++) {
        if (r.retryAfterMs !== null && r.retryAfterMs > ESPERA_429_MAX_MS) break // pediu mais que o teto: não é limite por minuto
        const espera = r.retryAfterMs ?? ESPERA_429_PADRAO_MS
        if (restante(ctx.deadline) - espera < FOLGA_APOS_ESPERA_MS) break
        const t = Date.now()
        await dormir(espera)
        resumo.esperas_429++
        resumo.ms_espera_429 += Date.now() - t
        r = restante(ctx.deadline) <= 0 ? 'sem_tempo' : await baixarUm(ctx, clientes.get(p.channel_id)!, p, urls, renovados, resumo)
      }
      if (typeof r === 'object') {
        resumo.parou_por_limite = true
        resumo.nao_tentados = alvo.length - i - 1
        break
      }
    }
    if (r === 'sem_tempo' && resumo.esperas_429 > 0) {
      // O relógio acabou DEPOIS de uma espera de 429: a causa é a cota por minuto, não o orçamento do passo.
      // Não registra nao_alcancado_orcamento (o critério de orçamento pintaria o cron por um falso alarme).
      semTempo = true
      resumo.parou_por_limite = true
      resumo.nao_tentados = alvo.length - i - (item429 ? 1 : 0)
    } else if (r === 'sem_tempo') {
      semTempo = true
      // Só o relógio conta como nao_alcancado_orcamento; o teto de downloads e a fila não.
      const afetados = new Set(alvo.slice(i).map(x => x.channel_id))
      for (const c of canais) if (afetados.has(c.id)) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
    }
  }

  resumo.ms_baixar = Date.now() - t1
  // ── 4. Limpeza do bruto: desde a MG13 devolve 0 (a MG6 da E10 reabre só para lote confirmado no NAS) ──
  if (restante(ctx.deadline) > 0) {
    const purge = await ctx.supabase.rpc('yt_reporting_blobs_purge', { p_sem_normalizador: SEM_NORMALIZADOR })
    if (conferirBanco(purge, 'yt_reporting_blobs_purge', ctx.falhas) === 'ok' && typeof purge.data === 'number') {
      resumo.bruto_apagado = purge.data
      if (purge.data > 0) pushUnico(ctx.falhas, `relatórios: a limpeza apagou ${purge.data} bruto(s) nesta execução; desde a MG13 o esperado é 0 (a função foi recriada com o corpo antigo?)`)
    }
  }

  // ── 5. O que ficou para depois, e quando vence o primeiro ────────────────
  // A mesma leitura inteira (não só as 1000 primeiras): o primeiro a vencer pode estar em qualquer posição de create_time.
  const resta = await lerFilaPendente(ctx, idsDosCanais)
  if (conferirBanco(resta.resposta, 'yt_reporting_reports', ctx.falhas, 'ler') === 'ok') {
    // Contagem ausente não é zero: vale o número de linhas lidas. A nota de corte já saiu no passo 3, se foi o caso.
    resumo.pendentes += resta.total ?? resta.linhas.length
    if (resta.linhas.length > 0) {
      resumo.vence_primeiro_em_dias = Math.floor((Math.min(...resta.linhas.map(venceEm)) - Date.now()) / DIA_MS)
    }
    // 429 só vira vermelho quando ameaça o prazo: vence em até 7 dias, ou os dias para zerar a fila (pendentes / vazão média
    // de 3 dias) passam de (dias até vencer − 5); vazão 0 com pendentes ameaça. Fora disso é só o resumo (parou_por_limite).
    if (resumo.parou_por_limite && resumo.pendentes > 0) {
      const vence = resumo.vence_primeiro_em_dias
      const vazao = await vazaoDiaria(ctx, idsDosCanais)
      const vencePerto = vence !== null && vence <= 7
      if (vazao === null && !vencePerto) {
        pushUnico(ctx.falhas, 'relatórios: o limite de cota parou os downloads e a vazão não pôde ser lida; não avaliei se a fila alcança o vencimento')
      }
      const ameaca = vencePerto || (vazao !== null && (vazao === 0 || (vence !== null && resumo.pendentes / vazao > vence - 5)))
      if (resumo.esperas_429 > 0 && resumo.gravados === 0) {
        pushUnico(ctx.falhas, 'relatórios: o 429 persiste depois de esperar o minuto e nada foi baixado; não é o limite por minuto (teto diário ou bloqueio?)')
      }
      if (ameaca) {
        pushUnico(ctx.falhas, `relatórios: o limite de cota por minuto da Reporting API parou os downloads (${resumo.nao_tentados} sem tentar, ${resumo.pendentes} pendentes${resumo.vence_primeiro_em_dias !== null ? `, o primeiro vence em ${resumo.vence_primeiro_em_dias} dia(s)` : ''}${vazao !== null ? `, vazão de ~${Math.round(vazao)}/dia` : ''})`)
      }
    }
  }

  return fechar()
}
