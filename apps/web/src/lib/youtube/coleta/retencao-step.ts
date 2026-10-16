// Passo `retencao` (A5 E8, Tarefa 9): a curva de retenção por vídeo da Analytics API. Quem é lido hoje vem de
// `yt_own_retention_facts` (uma ida ao banco por canal) e da regra pura `decidirRetencao`; aqui só se executa.
//  - Lista vazia: nem token se pede. Fatos ilegíveis ou função ausente NUNCA viram "nada a fazer": viram falha.
//  - Curva vazia (`pontos: []`) é leitura FEITA ("li e não há curva"): tentativa `sem_dado_na_janela`, nenhuma linha.
//    Erro, falta de tempo e escrita recusada NÃO são resposta: nenhuma dessas tentativas conta como leitura.
//  - Perda de autorização (`ehPerdaDeAutorizacao`) é pega ANTES do erro genérico: marca `reautorizar` uma vez e os
//    vídeos restantes do canal ficam `sem_autorizacao`. O 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` entra aqui.
//  - As chamadas à API são contadas embrulhando o `fetch` de cada leitura: um `fetch` que lança no meio não perde a conta.
//  - Nenhum texto de exceção, do banco ou do Google vai a coluna ou a nota: só código de catálogo (`motivo.ts`).
//    O Sentry recebe a exceção e só o id do vídeo (nunca pontos nem corpo de resposta).
import * as Sentry from '@sentry/nextjs'
import { channelNote } from '@/lib/cron/failure-note'
import { AnalyticsApiError } from './analytics-diario'
import { retencaoDoVideo, type RespostaRetencao } from './analytics-retencao'
import { marcarAutorizado, marcarReautorizar, obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa } from './attempts'
import { emParalelo, FETCH_TIMEOUT_RETENCAO_MS, fetchComPrazo, PARALELO_RETENCAO, restante, SemTempoError } from './clock'
import { addDays, dayPt, utcDay } from './day-pt'
import { ehPerdaDeAutorizacao } from './google-erro'
import { metricVersion } from './metric-version'
import { motivoDoErro, textoDoMotivo } from './motivo'
import { passoDesligado } from './passos-desligados'
import { decidirRetencao, lerFatos, type Decisao, type FatoRetencao, type Leitura, type OpcoesDaRegra } from './retencao-regra'
import { conferirBanco, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx, StepResumo, Tentativa } from './types'

/** A PK de `yt_own_video_retention`: a mesma chave deixa a regravação da mesma janela idempotente. */
const CHAVE_DA_CURVA = 'youtube_video_id,window_kind,segment,window_end'
const MAX_IDS_NA_NOTA = 5
/** Dias seguidos com `demorou` (hoje incluído) a partir dos quais o vídeo deixa de ser nota e vira falha. */
const DIAS_DEMOROU_PARA_FALHA = 3

export interface RetencaoResumo extends StepResumo {
  /** "Hoje" no Pacífico: o fim da janela da vida inteira. */
  ate: string
  /** Leituras com resposta e sem curva (`pontos: []`). */
  vazios: number
  /** Chamadas à Analytics API gastas nesta execução (uma leitura gasta de 1 a 3; as que lançaram contam). */
  chamadas: number
  adiados_pela_leva: number
  sem_diario_em_dia: number
  /** As notas prontas para `acao_do_dono`, uma por canal, com até 5 ids. Não vão para `falhas`. */
  sem_resposta_do_youtube: string[]
  novos: number
  /** Presente (e `true`) só quando `YT_OWN_STEPS_OFF` lista `retencao`: o passo não rodou. Nunca "ok". */
  desligado?: true
}

export interface DepsRetencao {
  /** Injeção do ensaio: quando vem, o passo NÃO chama `obterToken` (que renova e grava o token no banco do ambiente). */
  token?: (c: ColetaChannel) => Promise<string | null>
  /** Dias da leva dos vídeos nunca tentados. Padrão: `RETENCAO.levaDias` (7), aplicado pela regra. */
  levaDias?: number
}

type TentativaBase = Omit<Tentativa, 'outcome' | 'http_status' | 'error'>

/** Cota ou limite de taxa da API (a mesma regra do passo `dimensoes`): o motivo do catálogo termina com o `reason` do Google. */
const ehCota = (status: number, motivo: string): boolean =>
  status === 429 || (status === 403 && /_(quotaExceeded|rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded)$/.test(motivo))

/** O limite POR CHAMADA estourou com tempo sobrando no passo (o `fetchComPrazo` só repassa o `TimeoutError` nesse caso). */
const ehDemora = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'TimeoutError'

const ids = (l: readonly string[]): string => l.slice(0, MAX_IDS_NA_NOTA).join(', ')

/** `demorou` nos dois dias UTC anteriores (a tentativa do dia é uma linha por chave): com o de hoje, o 3º seguido. Falha ao ler = não seguido. */
async function demorouNosDiasAnteriores(ctx: StepCtx, ytId: string, kind: string, hojeUtc: string): Promise<boolean> {
  const dias = [addDays(hojeUtc, -1), addDays(hojeUtc, -2)]
  try {
    const { data, error } = await ctx.supabase.from('yt_own_collection_attempts').select('attempt_day,outcome,error')
      .eq('scope_type', 'video').eq('scope_id', ytId).eq('kind', kind).in('attempt_day', dias)
    if (error || !Array.isArray(data)) return false
    const lidos = data as Array<{ attempt_day: string; outcome: string; error: string | null }>
    return dias.every(d => lidos.some(r => r.attempt_day === d && r.outcome === 'erro_http' && r.error === 'demorou'))
  } catch {
    return false
  }
}

export async function passoRetencao(ctx: StepCtx, deps: DepsRetencao = {}): Promise<RetencaoResumo> {
  const agora = new Date()
  const hojePt = dayPt(agora)
  const hojeUtc = utcDay(agora)
  const resumo: RetencaoResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, ate: hojePt, vazios: 0, chamadas: 0,
    adiados_pela_leva: 0, sem_diario_em_dia: 0, sem_resposta_do_youtube: [], novos: 0,
  }
  const fechar = (): RetencaoResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['retencao_vida', 'retencao_7d', 'retencao_30d'])
    return resumo
  }

  if (passoDesligado('retencao')) {
    resumo.desligado = true
    return resumo
  }

  // Canal em `reautorizar` não é servido e não gera nota deste passo (já há o e-mail próprio).
  const canais = ctx.channels.filter(c => c.sync_enabled && c.collection_status === 'ok')
  if (canais.length === 0) return fechar()
  const tCanal = (c: ColetaChannel): TentativaBase =>
    ({ site_id: c.site_id, scope_type: 'canal', scope_id: c.id, kind: 'retencao_vida', channel_id: c.id })
  const pegarToken = deps.token ?? ((c: ColetaChannel) => obterToken(ctx, c, tCanal(c)))
  const opcoes: OpcoesDaRegra = deps.levaDias === undefined ? { hojePt, hojeUtc } : { hojePt, hojeUtc, levaDias: deps.levaDias }

  const semTempoDe = async (restantes: readonly ColetaChannel[]): Promise<void> => {
    for (const k of restantes) await registrarTentativa(ctx, { ...tCanal(k), outcome: 'nao_alcancado_orcamento' })
  }
  const schemaAusenteDe = async (restantes: readonly ColetaChannel[]): Promise<void> => {
    for (const k of restantes) await registrarTentativa(ctx, { ...tCanal(k), outcome: 'schema_ausente' })
  }

  // Duas fases: A lê os fatos de TODOS os canais (só banco, barato) e fecha já quem não tem nada a ler; B serve da API
  // primeiro o canal mais barato (menos leituras). Ordem: o caro (fila de vídeos antigos) não deixa o outro sem vez.
  const fila: Array<{ c: ColetaChannel; d: Decisao }> = []

  for (let i = 0; i < canais.length; i++) {
    const c = canais[i]!

    // 1. Sem tempo: este canal e os seguintes ficam para a próxima execução.
    if (restante(ctx.deadline) <= 0) {
      await semTempoDe(canais.slice(i))
      break
    }

    // 2. Os fatos do canal (uma ida ao banco).
    let res: { data: unknown; error: ErroBanco | null }
    try {
      res = await ctx.supabase.rpc('yt_own_retention_facts', { p_channel_id: c.id, p_hoje_utc: hojeUtc })
    } catch {
      res = { data: null, error: { code: null, message: 'rpc lançou' } }
    }
    const lida = conferirBanco(res, 'yt_own_retention_facts', ctx.falhas, 'ler')
    if (lida === 'schema_ausente') {
      await schemaAusenteDe(canais.slice(i))
      return fechar()
    }
    if (lida === 'erro') {
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: 'erro_de_banco' })
      continue
    }
    let fatos: FatoRetencao[]
    try {
      fatos = lerFatos(res.data)
    } catch {
      // Fila ilegível não é "nada a fazer": o canal fica vermelho e o próximo segue.
      pushUnico(ctx.falhas, `retenção: ${channelNote(c.name, 'fatos em forma inesperada')}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: 'forma_inesperada' })
      continue
    }

    // 3. A decisão e as notas que dela saem (valem mesmo sem nada a ler).
    const d: Decisao = decidirRetencao(fatos, opcoes)
    resumo.adiados_pela_leva += d.adiadosPelaLeva
    resumo.sem_diario_em_dia += d.semDiarioEmDia.length
    resumo.novos += d.novos.length
    if (d.semDiarioEmDia.length > 0) {
      const pane = d.pane ? '; metade ou mais do canal: é pane da coleta' : ''
      pushUnico(
        ctx.falhas,
        `retenção: ${channelNote(c.name, `${d.semDiarioEmDia.length} vídeo(s) sem diário em dia; a curva espera o diário (${ids(d.semDiarioEmDia)})${pane}`)}`,
      )
    }
    if (d.semRespostaDoYoutube.length > 0) {
      resumo.sem_resposta_do_youtube.push(
        `retenção: ${channelNote(c.name, `${d.semRespostaDoYoutube.length} vídeo(s) que o YouTube não devolve mais (${ids(d.semRespostaDoYoutube)}); a curva não é lida`)}`,
      )
    }
    if (d.ler.length === 0) {
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'ok' })
      continue
    }
    fila.push({ c, d })
  }

  // Estável: empate de custo mantém a ordem de entrada.
  fila.sort((a, b) => a.d.ler.length - b.d.ler.length)
  const canaisB = fila.map(f => f.c)

  for (let j = 0; j < fila.length; j++) {
    const { c, d } = fila[j]!

    if (restante(ctx.deadline) <= 0) {
      await semTempoDe(canaisB.slice(j))
      break
    }

    // 4. O token (só agora: lista vazia nunca chega aqui).
    let token: string | null
    try {
      token = await pegarToken(c)
    } catch (e) {
      if (e instanceof SemTempoError) {
        await semTempoDe(canaisB.slice(j))
        break
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'retencao' }, extra: { canal: c.channel_id } })
      const motivo = motivoDoErro(e)
      pushUnico(ctx.falhas, `retenção: ${channelNote(c.name, textoDoMotivo(motivo))}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: motivo })
      continue
    }
    if (token === null) continue

    // 5. As leituras, 2 em paralelo (a vitalícia de vídeo antigo demora; 30 s por chamada).
    let negado = false
    // Cota estourada: quem ainda não começou não chama a API (quem está em voo termina).
    let cota = false
    let schemaAusenteNaEscrita = false
    let comErro = 0
    let primeiraCausa = ''
    const demoraram: string[] = []
    const demoraramHa3Dias: string[] = []
    // Uma promessa por canal: quatro vídeos em paralelo não disparam quatro gravações.
    let autorizadoP: Promise<void> | null = null
    let reautorizarP: Promise<void> | null = null

    await emParalelo(d.ler, PARALELO_RETENCAO, async (l: Leitura) => {
      const base: TentativaBase = { site_id: l.siteId, scope_type: 'video', scope_id: l.ytId, kind: l.kind, channel_id: c.id }
      if (schemaAusenteNaEscrita) return
      if (negado) {
        await registrarTentativa(ctx, { ...base, outcome: 'sem_autorizacao' })
        return
      }
      if (cota || restante(ctx.deadline) <= 0) {
        await registrarTentativa(ctx, { ...base, outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes++
        return
      }
      const falhou = (motivo: string): void => {
        comErro++
        primeiraCausa ||= motivo
      }
      // O `fetch` por baixo do prazo: só chamada que chegou a sair conta.
      const gasto = { n: 0 }
      const contado: typeof fetch = (input, init) => {
        gasto.n++
        return fetch(input, init)
      }
      try {
        let r: RespostaRetencao
        try {
          r = await retencaoDoVideo({
            token, canalUc: c.channel_id, videoId: l.ytId, inicio: l.inicio, fim: l.fim, f: fetchComPrazo(ctx.deadline, contado, FETCH_TIMEOUT_RETENCAO_MS),
          })
        } finally {
          resumo.chamadas += gasto.n
        }
        autorizadoP ??= marcarAutorizado(ctx, c)
        await autorizadoP

        if (r.pontos.length === 0) {
          // Li e não há curva: leitura feita, sem linha.
          resumo.vazios++
          await registrarTentativa(ctx, { ...base, outcome: 'sem_dado_na_janela' })
          return
        }

        let up: { error: ErroBanco | null }
        try {
          up = await ctx.supabase.from('yt_own_video_retention').upsert(
            {
              youtube_video_id: l.ytId,
              window_kind: l.janela,
              segment: 'organico',
              window_end: l.windowEnd,
              window_start: l.inicio,
              requested_end: l.fim,
              site_id: l.siteId,
              video_id: l.videoId,
              channel_id: c.id,
              points: r.pontos,
              point_count: r.pontos.length,
              metrics_returned: r.metricas,
              views_at_read: l.viewsAtRead,
              source: 'analytics_api',
              collected_at: new Date().toISOString(),
              metric_version: metricVersion(l.windowEnd),
            },
            { onConflict: CHAVE_DA_CURVA },
          )
        } catch {
          up = { error: { code: null, message: 'upsert lançou' } }
        }
        const escrita = conferirBanco(up, 'yt_own_video_retention', ctx.falhas)
        if (escrita === 'schema_ausente') {
          schemaAusenteNaEscrita = true
          await registrarTentativa(ctx, { ...base, outcome: 'schema_ausente' })
          return
        }
        if (escrita === 'erro') {
          // Erro nosso, sem texto do banco: a leitura não foi gravada, então não conta como leitura.
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: 'erro_de_banco' })
          falhou('erro_de_banco')
          return
        }
        resumo.gravados++
        await registrarTentativa(ctx, { ...base, outcome: 'ok' })
      } catch (e) {
        if (e instanceof SemTempoError || (ehDemora(e) && restante(ctx.deadline) <= 0)) {
          await registrarTentativa(ctx, { ...base, outcome: 'nao_alcancado_orcamento' })
          resumo.pendentes++
        } else if (ehDemora(e)) {
          // Cortado pelo limite da chamada com tempo sobrando: pendente para amanhã, nota em vez de vermelho; no 3º dia seguido, falha.
          const seguido = await demorouNosDiasAnteriores(ctx, l.ytId, l.kind, hojeUtc)
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: 'demorou' })
          resumo.pendentes++
          if (seguido) {
            demoraramHa3Dias.push(l.ytId)
          } else {
            demoraram.push(l.ytId)
          }
        } else if (e instanceof AnalyticsApiError && ehPerdaDeAutorizacao(e.status, e.reason)) {
          negado = true
          reautorizarP ??= marcarReautorizar(ctx, c)
          await reautorizarP
          await registrarTentativa(ctx, { ...base, outcome: 'sem_autorizacao', http_status: e.status })
        } else if (e instanceof AnalyticsApiError) {
          const motivo = motivoDoErro(e)
          if (ehCota(e.status, motivo)) cota = true
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', http_status: e.status, error: motivo })
          falhou(motivo)
        } else {
          Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'retencao' }, extra: { video: l.ytId } })
          const motivo = motivoDoErro(e)
          await registrarTentativa(ctx, { ...base, outcome: 'erro_http', error: motivo })
          falhou(motivo)
        }
      }
    })

    if (schemaAusenteNaEscrita) {
      // A migration sumiu no meio: o canal em curso e os seguintes não chamam mais a API.
      await schemaAusenteDe(canaisB.slice(j))
      return fechar()
    }

    // 6 e 7. A nota do canal e a tentativa de canal.
    if (demoraram.length > 0) {
      resumo.sem_resposta_do_youtube.push(
        `retenção: ${channelNote(c.name, `${demoraram.length} vídeo(s) em que o YouTube demorou mais de 30 s (${ids(demoraram)}); tenta de novo amanhã`)}`,
      )
    }
    if (demoraramHa3Dias.length > 0) {
      pushUnico(ctx.falhas, `retenção: ${channelNote(c.name, `${demoraramHa3Dias.length} vídeo(s) em que o YouTube demora mais de 30 s há ${DIAS_DEMOROU_PARA_FALHA} dias seguidos (${ids(demoraramHa3Dias)})`)}`)
    }
    if (comErro > 0) {
      pushUnico(ctx.falhas, `retenção: ${channelNote(c.name, `${comErro} de ${d.ler.length} leituras com erro (${textoDoMotivo(primeiraCausa)})`)}`)
    }
    // Canal alcançado (o passo chegou nele, mesmo que o prazo vença antes do 1º vídeo) é 'ok' mesmo com vídeos antigos pendentes: eles giram, e a fome
    // de vídeo é vigiada pelas tentativas de escopo 'video'. 'nao_alcancado_orcamento' do canal é só para quem o
    // prazo nem alcançou (semTempoDe). Sem isto o teto de 45 s deixava o canal "faltou" todo dia.
    await registrarTentativa(ctx, {
      ...tCanal(c),
      outcome: negado ? 'sem_autorizacao' : 'ok',
    })
  }

  return fechar()
}
