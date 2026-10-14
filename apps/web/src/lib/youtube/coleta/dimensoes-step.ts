// Passo `dimensoes` (A5 E11, Tarefa 7): origem de tráfego, aparelho e sistema, país e inscrito ou não, por vídeo, pela
// Analytics API. A gravação é SÓ pelas funções do banco (MG7): este arquivo nunca escreve direto na tabela.
//  - Vídeo sem view na janela não gera chamada: `yt_own_dim_cover_idle` estende a cobertura dele no banco.
//  - Famílias `com_dia`: uma consulta e uma gravação por vídeo e família, com a janela inteira.
//  - Família `por_dia` (país): uma consulta por DIA COM VIEW, e UMA gravação com a janela inteira. O primeiro dia que
//    não for respondido encerra o vídeo naquela família, e a cobertura vai só até o dia anterior a ele: assim os dias sem
//    view ficam cobertos, a cobertura é contígua e nenhum dia sem resposta passa por "zero medido".
//  - Resposta com lista vazia é dado legítimo (a gravação cobre o dia como LIDO), diferente de "não li" (sem gravação).
//  - Nenhum texto de exceção, do banco ou do Google vai a coluna ou a nota: só código de catálogo (`motivo.ts`).
import * as Sentry from '@sentry/nextjs'
import { channelNote } from '@/lib/cron/failure-note'
import {
  AnalyticsDimensaoError, dimensaoDoVideo, MODO_DA_FAMILIA, UsoInvalidoDimensoesError,
  type Familia, type LinhaDim, type RespostaDimensao,
} from './analytics-dimensoes'
import { AnalyticsApiError } from './analytics-diario'
import { marcarAutorizado, marcarReautorizar, obterToken } from './autorizacao'
import { contarPorResultado, registrarTentativa } from './attempts'
import { comPrazo, emParalelo, fetchComPrazo, PARALELO, restante, SemTempoError } from './clock'
import { addDays, dayPt } from './day-pt'
import {
  configE11, FOLGA_PARA_COMECAR_MS, janelaDoConjunto, JANELA_DIAS, MAX_CONSULTAS_DIMENSOES, schemaE11, type ConfigE11,
} from './e11-config'
import { ehPerdaDeAutorizacao } from './google-erro'
import { metricVersion } from './metric-version'
import { motivoDoErro, textoDoMotivo } from './motivo'
import { passoDesligado } from './passos-desligados'
import { lerPaginado } from './paginar'
import { conferirBanco, pushUnico, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx, StepResumo, Tentativa } from './types'

const TETO_DE_LEITURA = 20_000

export interface DimensoesResumo extends StepResumo {
  /** "Hoje" no Pacífico: o fim da janela. */
  ate: string
  /** A data de partida da coleta (`e11.desde`). */
  desde: string
  /** Chamadas à Analytics API gastas nesta execução (cada tentativa sem `engagedViews` conta). */
  consultas: number
  /** Consultas que não começaram porque o teto de `MAX_CONSULTAS_DIMENSOES` por execução foi atingido. */
  consultas_cortadas: number
  videos_com_view: number
  /** Conjuntos (vídeo × família) que a função do banco cobriu sem chamar a API: vídeos sem view na janela. */
  conjuntos_cobertos_sem_api: number
  dias_mantidos: number
  dias_em_revisao: number
  fora_do_teto: number
  valores_invalidos: number
  estendidas_recusadas: number
  /** O menor `base_ate` entre os sites (nulo se a prova não respondeu ou não há base). */
  base_ate: string | null
  /** Presente (e `true`) só quando `YT_OWN_STEPS_OFF` lista `dimensoes`: o passo não rodou. Nunca "ok". */
  desligado?: true
}

export type DimensoesCtx = StepCtx & {
  e11: ConfigE11
  /** Só para ensaio: o dia (Pacífico) de "hoje". Padrão: `dayPt(new Date())`. */
  hoje?: string
  /** Injeção do ensaio: quando vem, o passo NÃO chama `obterToken` (que renova e grava o token em produção). */
  token?: (c: ColetaChannel) => Promise<string | null>
}

const SET_DA_FAMILIA: Readonly<Record<Familia, SetCob>> = {
  traffic_source: 'trafego',
  device_os: 'dispositivo',
  country: 'pais',
  subscribed_status: 'inscrito',
}
const ROTULO: Readonly<Record<Familia, string>> = {
  traffic_source: 'origem de tráfego',
  device_os: 'aparelho e sistema',
  country: 'país',
  subscribed_status: 'inscrito',
}
const TODAS = Object.keys(MODO_DA_FAMILIA) as Familia[]
const COM_DIA = TODAS.filter(f => MODO_DA_FAMILIA[f] === 'com_dia')
const POR_DIA = TODAS.filter(f => MODO_DA_FAMILIA[f] === 'por_dia')

type SetCob = 'trafego' | 'dispositivo' | 'pais' | 'inscrito'
const SETS: readonly SetCob[] = ['trafego', 'dispositivo', 'pais', 'inscrito']

interface LinhaCobertura {
  youtube_video_id: string
  metric_set: string
  covered_from: string
  covered_to: string
  site_id: string
  video_id: string | null
}
interface LinhaDiario {
  youtube_video_id: string
  day_pt: string
}

interface VideoCob {
  yt: string
  site: string
  vid: string | null
  baseAte: string
  ultimo: Record<SetCob, string | null>
}

interface Ativa {
  de: string
  ate: string
  /** Dias com view dentro da janela da família, em ordem crescente. */
  dias: string[]
}

interface Estado {
  v: VideoCob
  ativas: Partial<Record<Familia, Ativa>>
  erro: { motivo: string; http?: number } | null
  negado: boolean
  negadoHttp: number | null
  schema: boolean
  pendente: boolean
  /** Famílias respondidas (a API respondeu e o banco aceitou). */
  respondeu: number
  comLinhas: boolean
}

const CAMPOS_APPLY = ['gravadas', 'apagadas', 'fora_do_teto', 'dias_mantidos', 'dias_em_revisao'] as const

type RespApply =
  | { tipo: 'gravado'; fora_do_teto: number; dias_mantidos: number; dias_em_revisao: number; gravadas: number }
  | { tipo: 'sem_base'; fora_do_teto: number }

/** Lê a resposta de `yt_own_dim_apply`; forma que não é a do contrato nunca vira "ok com zero". */
function lerApply(x: unknown): RespApply | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  const n: Record<(typeof CAMPOS_APPLY)[number], number> = { gravadas: 0, apagadas: 0, fora_do_teto: 0, dias_mantidos: 0, dias_em_revisao: 0 }
  for (const k of CAMPOS_APPLY) {
    const v = o[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
    n[k] = v
  }
  if (o.status === 'gravado') {
    return { tipo: 'gravado', fora_do_teto: n.fora_do_teto, dias_mantidos: n.dias_mantidos, dias_em_revisao: n.dias_em_revisao, gravadas: n.gravadas }
  }
  if (o.status === 'base_sem_cobertura') return { tipo: 'sem_base', fora_do_teto: n.fora_do_teto }
  return null
}

function lerCoverIdle(x: unknown): { conjuntos_cobertos: number } | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  for (const k of ['videos_com_base', 'conjuntos_cobertos', 'videos_com_view']) {
    const v = o[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
  }
  return { conjuntos_cobertos: o.conjuntos_cobertos as number }
}

/**
 * O código de catálogo de um erro da API. Resposta 200 com forma errada (cabeçalho ou coluna ausente) não é "HTTP 200":
 * é `forma_inesperada`.
 */
function motivoDe(e: unknown): string {
  if (e instanceof AnalyticsApiError && e.status === 200 && e.reason !== 'corpo_invalido') return 'forma_inesperada'
  return motivoDoErro(e)
}

const ehCota = (status: number, motivo: string): boolean =>
  status === 429 || (status === 403 && /_(quotaExceeded|rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded)$/.test(motivo))

function linhaApply(l: LinhaDim) {
  return {
    day_pt: l.day,
    dim_value: l.valor,
    views: l.views,
    engaged_views: l.engaged_views,
    watch_time_minutes: l.watch_time_minutes,
    metric_version: metricVersion(l.day),
  }
}

export async function passoDimensoes(ctx: DimensoesCtx): Promise<DimensoesResumo> {
  const hoje = ctx.hoje ?? dayPt(new Date())
  const resumo: DimensoesResumo = {
    gravados: 0, tentativas: {}, pendentes: 0, ate: hoje, desde: ctx.e11?.desde ?? '', consultas: 0, consultas_cortadas: 0,
    videos_com_view: 0, conjuntos_cobertos_sem_api: 0, dias_mantidos: 0, dias_em_revisao: 0, fora_do_teto: 0,
    valores_invalidos: 0, estendidas_recusadas: 0, base_ate: null,
  }
  const fechar = (): DimensoesResumo => {
    resumo.tentativas = contarPorResultado(ctx.tentativas, ['dimensoes'])
    return resumo
  }

  // ── Interruptor e configuração ───────────────────────────────────────────
  if (passoDesligado('dimensoes')) {
    resumo.desligado = true
    return resumo
  }
  const cfg = configE11(ctx.e11)
  if (!cfg.ok) {
    pushUnico(ctx.falhas, 'dimensões: data de partida inválida (e11-config.ts)')
    return fechar()
  }
  const desde = cfg.desde
  resumo.desde = desde

  const canais = ctx.channels.filter(c => c.sync_enabled)
  if (canais.length === 0) return fechar()
  const tCanal = (c: ColetaChannel): Omit<Tentativa, 'outcome' | 'http_status' | 'error'> =>
    ({ site_id: c.site_id, scope_type: 'canal', scope_id: c.id, kind: 'dimensoes', channel_id: c.id })

  // Sem folga para começar: nada é chamado (nem a prova); cada canal entra primeiro na execução seguinte.
  if (restante(ctx.deadline) < FOLGA_PARA_COMECAR_MS) {
    for (const c of canais) {
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
      resumo.pendentes++
    }
    return fechar()
  }

  // ── Guarda de schema, uma vez por site ───────────────────────────────────
  const sitesOk = new Set<string>()
  const sitesRuins = new Map<string, Omit<Tentativa, 'scope_type' | 'scope_id' | 'kind' | 'site_id' | 'channel_id'>>()
  for (const site of [...new Set(canais.map(c => c.site_id))]) {
    const g = await schemaE11(ctx.supabase, { site, hoje, desde }, ctx.deadline)
    if (g.ok) {
      sitesOk.add(site)
      if (g.prova.base_ate !== null && (resumo.base_ate === null || g.prova.base_ate < resumo.base_ate)) resumo.base_ate = g.prova.base_ate
      continue
    }
    pushUnico(ctx.falhas, g.nota)
    if (g.nota.startsWith('schema_ausente')) sitesRuins.set(site, { outcome: 'schema_ausente' })
    else if (g.nota.includes('não respondeu a tempo')) sitesRuins.set(site, { outcome: 'nao_alcancado_orcamento' })
    else if (g.nota.includes('prova de cobertura veio')) sitesRuins.set(site, { outcome: 'erro_http', error: 'forma_inesperada' })
    else sitesRuins.set(site, { outcome: 'erro_http', error: 'erro_de_banco' })
  }
  for (const c of canais) {
    const ruim = sitesRuins.get(c.site_id)
    if (!ruim) continue
    await registrarTentativa(ctx, { ...tCanal(c), ...ruim })
    if (ruim.outcome === 'nao_alcancado_orcamento') resumo.pendentes++
  }
  if (sitesOk.size === 0) return fechar()

  const f = fetchComPrazo(ctx.deadline)
  let consultas = 0

  for (let i = 0; i < canais.length; i++) {
    const c = canais[i]!
    if (!sitesOk.has(c.site_id)) continue

    // ── Prazo e vídeos parados (a cobertura avança no banco, sem API) ──────
    if (restante(ctx.deadline) < FOLGA_PARA_COMECAR_MS) {
      for (const resto of canais.slice(i).filter(k => sitesOk.has(k.site_id))) {
        await registrarTentativa(ctx, { ...tCanal(resto), outcome: 'nao_alcancado_orcamento' })
        resumo.pendentes++
      }
      break
    }
    let idle: { data: unknown; error: ErroBanco | null } | null
    try {
      idle = await comPrazo(
        Promise.resolve(ctx.supabase.rpc('yt_own_dim_cover_idle', {
          p_channel: c.id, p_inicio: desde, p_janela: addDays(hoje, -JANELA_DIAS), p_to: hoje,
        })),
        ctx.deadline,
      )
    } catch {
      idle = { data: null, error: { code: null, message: 'rpc lançou' } }
    }
    if (idle === null) {
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'nao_alcancado_orcamento' })
      resumo.pendentes++
      continue
    }
    const escIdle = conferirBanco(idle, 'yt_own_dim_cover_idle', ctx.falhas)
    if (escIdle !== 'ok') {
      await registrarTentativa(ctx, escIdle === 'schema_ausente'
        ? { ...tCanal(c), outcome: 'schema_ausente' }
        : { ...tCanal(c), outcome: 'erro_http', error: 'erro_de_banco' })
      continue
    }
    const lidoIdle = lerCoverIdle(idle.data)
    if (!lidoIdle) {
      pushUnico(ctx.falhas, `dimensões: ${channelNote(c.name, 'a cobertura dos vídeos parados voltou em forma inesperada')}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: 'forma_inesperada' })
      continue
    }
    resumo.conjuntos_cobertos_sem_api += lidoIdle.conjuntos_cobertos

    // ── Cobertura dos cinco conjuntos ──────────────────────────────────────
    const cob = await lerPaginado<LinhaCobertura>(
      (de, ate) => ctx.supabase
        .from('yt_own_video_coverage')
        .select('youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id')
        .eq('channel_id', c.id)
        .in('metric_set', ['base', ...SETS])
        .order('youtube_video_id', { ascending: true })
        .order('metric_set', { ascending: true })
        .order('covered_from', { ascending: true })
        .range(de, ate),
      TETO_DE_LEITURA,
    )
    if (!cob.ok) {
      pushUnico(
        ctx.falhas,
        cob.motivo === 'passou_do_teto'
          ? `dimensões: ${channelNote(c.name, `a leitura da cobertura passou do teto de ${TETO_DE_LEITURA} linhas (${cob.lidas} lidas)`)}`
          : 'erro de banco ao ler yt_own_video_coverage',
      )
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: cob.motivo === 'passou_do_teto' ? 'forma_inesperada' : 'erro_de_banco' })
      continue
    }
    const videos = new Map<string, VideoCob>()
    const baseDe = new Map<string, LinhaCobertura>()
    for (const l of cob.linhas) {
      if (l.metric_set !== 'base') continue
      const atual = baseDe.get(l.youtube_video_id)
      if (!atual || l.covered_to > atual.covered_to) baseDe.set(l.youtube_video_id, l)
    }
    for (const [yt, b] of baseDe) {
      videos.set(yt, { yt, site: b.site_id, vid: b.video_id ?? null, baseAte: b.covered_to, ultimo: { trafego: null, dispositivo: null, pais: null, inscrito: null } })
    }
    for (const l of cob.linhas) {
      const v = videos.get(l.youtube_video_id)
      if (!v || l.metric_set === 'base') continue
      const s = l.metric_set as SetCob
      if (!SETS.includes(s)) continue
      if (v.ultimo[s] === null || l.covered_to > v.ultimo[s]!) v.ultimo[s] = l.covered_to
    }

    // ── Janelas e dias com view ────────────────────────────────────────────
    const janelas = new Map<string, Partial<Record<Familia, { de: string; ate: string }>>>()
    let menorDe: string | null = null
    for (const v of videos.values()) {
      const por: Partial<Record<Familia, { de: string; ate: string }>> = {}
      for (const fam of TODAS) {
        const w = janelaDoConjunto({ desde, hoje, ultimoCoberto: v.ultimo[SET_DA_FAMILIA[fam]], baseAte: v.baseAte })
        if (!w) continue
        por[fam] = w
        if (menorDe === null || w.de < menorDe) menorDe = w.de
      }
      janelas.set(v.yt, por)
    }

    const diasComView = new Map<string, string[]>()
    if (menorDe !== null) {
      // Do menor começo de janela (em regime, hoje − 10), nunca desde a data de partida: a leitura inteira crescia para sempre.
      const piso: string = menorDe
      const dia = await lerPaginado<LinhaDiario>(
        (de, ate) => ctx.supabase
          .from('yt_own_video_daily')
          .select('youtube_video_id, day_pt')
          .eq('channel_id', c.id)
          .gt('views', 0)
          .gte('day_pt', piso)
          .order('youtube_video_id', { ascending: true })
          .order('day_pt', { ascending: true })
          .range(de, ate),
        TETO_DE_LEITURA,
      )
      if (!dia.ok) {
        pushUnico(
          ctx.falhas,
          dia.motivo === 'passou_do_teto'
            ? `dimensões: ${channelNote(c.name, `a leitura do diário passou do teto de ${TETO_DE_LEITURA} linhas (${dia.lidas} lidas)`)}`
            : 'erro de banco ao ler yt_own_video_daily',
        )
        await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: dia.motivo === 'passou_do_teto' ? 'forma_inesperada' : 'erro_de_banco' })
        continue
      }
      for (const l of dia.linhas) {
        if (!videos.has(l.youtube_video_id)) continue
        const lista = diasComView.get(l.youtube_video_id) ?? []
        lista.push(l.day_pt)
        diasComView.set(l.youtube_video_id, lista)
      }
      for (const lista of diasComView.values()) lista.sort()
    }

    const fila: Estado[] = []
    for (const v of videos.values()) {
      const dias = diasComView.get(v.yt) ?? []
      const ativas: Partial<Record<Familia, Ativa>> = {}
      for (const fam of TODAS) {
        const w = janelas.get(v.yt)?.[fam]
        if (!w) continue
        const dentro = dias.filter(d => d >= w.de && d <= w.ate)
        if (dentro.length > 0) ativas[fam] = { de: w.de, ate: w.ate, dias: dentro }
      }
      if (Object.keys(ativas).length === 0) continue
      fila.push({ v, ativas, erro: null, negado: false, negadoHttp: null, schema: false, pendente: false, respondeu: 0, comLinhas: false })
    }
    resumo.videos_com_view += fila.length
    // Quem nunca foi coberto primeiro; depois a cobertura mais antiga.
    const chaveDaFila = (e: Estado): string => {
      const ult = SETS.map(s => e.v.ultimo[s])
      return ult.some(u => u === null) ? '' : ult.reduce<string>((m, u) => (u! < m ? u! : m), '9999-99-99')
    }
    fila.sort((a, b) => {
      const ka = chaveDaFila(a), kb = chaveDaFila(b)
      return ka < kb ? -1 : ka > kb ? 1 : a.v.yt < b.v.yt ? -1 : a.v.yt > b.v.yt ? 1 : 0
    })

    if (fila.length === 0) {
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'ok' })
      continue
    }

    // ── Token ──────────────────────────────────────────────────────────────
    let token: string | null
    try {
      token = ctx.token ? await ctx.token(c) : await obterToken(ctx, c, tCanal(c))
      if (ctx.token && token === null) await registrarTentativa(ctx, { ...tCanal(c), outcome: 'sem_conexao' })
    } catch (e) {
      if (e instanceof SemTempoError) {
        for (const resto of canais.slice(i).filter(k => sitesOk.has(k.site_id))) {
          await registrarTentativa(ctx, { ...tCanal(resto), outcome: 'nao_alcancado_orcamento' })
          resumo.pendentes++
        }
        break
      }
      Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
      const m = motivoDoErro(e)
      pushUnico(ctx.falhas, `dimensões: ${channelNote(c.name, textoDoMotivo(m))}`)
      await registrarTentativa(ctx, { ...tCanal(c), outcome: 'erro_http', error: m })
      continue
    }
    if (token === null) continue
    const tk: string = token

    // ── Estado do canal ────────────────────────────────────────────────────
    // `as`: a atribuição acontece dentro de funções; sem ele o TS estreita `parada` para `null` fora delas.
    let parada = null as { tipo: 'negado' | 'cota' | 'schema'; http?: number; motivo?: string } | null
    const recusadasDoCanal = new Set<Familia>()
    let cotaDoCanal = false
    let estendidasDoCanal = 0
    let invalidasDoCanal = 0
    let autorizadoP: Promise<void> | null = null
    let reautorizarP: Promise<void> | null = null

    const aplicarParada = (est: Estado): void => {
      if (!parada) return
      if (parada.tipo === 'negado') est.negado = true
      else if (parada.tipo === 'schema') est.schema = true
      else est.erro ??= { motivo: parada.motivo ?? 'http_429', http: parada.http }
    }
    /** Todas as famílias ativas do vídeo foram respondidas e gravadas, sem pendência nem erro. */
    const terminou = (est: Estado): boolean =>
      !est.pendente && !est.erro && !est.negado && !est.schema && est.respondeu >= Object.keys(est.ativas).length
    type Portao = 'ok' | 'sem_tempo' | 'sem_consulta'
    // Reserva 2 chamadas (a segunda é a repetição sem `engagedViews`): o teto nunca é passado, e a sobra é devolvida.
    const portao = (): Portao =>
      restante(ctx.deadline) < FOLGA_PARA_COMECAR_MS ? 'sem_tempo' : consultas + 2 > MAX_CONSULTAS_DIMENSOES ? 'sem_consulta' : 'ok'

    /** Uma consulta à API. `null` = não houve resposta (o estado do vídeo já diz por quê). */
    const consultar = async (est: Estado, familia: Familia, inicio: string, fim: string): Promise<RespostaDimensao | null> => {
      if (parada) {
        aplicarParada(est)
        return null
      }
      const p = portao()
      if (p !== 'ok') {
        est.pendente = true
        if (p === 'sem_consulta') resumo.consultas_cortadas++
        return null
      }
      consultas += 2
      let gastas = 1
      try {
        const r = await dimensaoDoVideo({ token: tk, canalUc: c.channel_id, videoId: est.v.yt, familia, inicio, fim, f })
        gastas = r.chamadas
        autorizadoP ??= marcarAutorizado(ctx, c)
        await autorizadoP
        if (r.estendidas === 'recusadas') estendidasDoCanal++
        invalidasDoCanal += r.invalidas
        return r
      } catch (e) {
        const g = (e as { chamadas?: unknown } | null)?.chamadas
        gastas = e instanceof SemTempoError ? 0 : typeof g === 'number' && Number.isFinite(g) && g >= 0 ? Math.min(g, 2) : 1
        if (e instanceof SemTempoError) {
          est.pendente = true
        } else if (e instanceof AnalyticsApiError && ehPerdaDeAutorizacao(e.status, e.reason)) {
          parada ??= { tipo: 'negado', http: e.status }
          est.negado = true
          reautorizarP ??= marcarReautorizar(ctx, c)
          await reautorizarP
          est.negadoHttp = e.status
        } else if (e instanceof AnalyticsApiError) {
          const m = motivoDe(e)
          if (ehCota(e.status, m)) {
            cotaDoCanal = true
            parada ??= { tipo: 'cota', http: e.status, motivo: m }
          } else if (e.status === 400) {
            recusadasDoCanal.add(familia)
          }
          est.erro ??= { motivo: m, http: e.status }
        } else {
          if (!(e instanceof UsoInvalidoDimensoesError)) {
            Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
          } else {
            Sentry.captureMessage('dimensões: uso inválido do cliente de dimensões', { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
          }
          est.erro ??= { motivo: motivoDoErro(e) }
        }
        return null
      } finally {
        consultas -= 2 - gastas
      }
    }
    /** Uma gravação, pela função do banco. Devolve `true` quando o banco aceitou. */
    const gravar = async (est: Estado, familia: Familia, de: string, ate: string, linhas: LinhaDim[]): Promise<boolean> => {
      if (parada?.tipo === 'schema') {
        aplicarParada(est)
        return false
      }
      let res: { data: unknown; error: ErroBanco | null } | null
      try {
        res = await comPrazo(
          Promise.resolve(ctx.supabase.rpc('yt_own_dim_apply', {
            p_video: est.v.yt, p_kind: familia, p_from: de, p_to: ate, p_rows: linhas.map(linhaApply),
            p_site: est.v.site, p_video_id: est.v.vid, p_channel: c.id,
          })),
          ctx.deadline,
        )
      } catch {
        res = { data: null, error: { code: null, message: 'rpc lançou' } }
      }
      if (res === null) {
        est.pendente = true
        return false
      }
      const esc = conferirBanco(res, 'yt_own_dim_apply', ctx.falhas)
      if (esc === 'schema_ausente') {
        parada ??= { tipo: 'schema' }
        est.schema = true
        return false
      }
      if (esc === 'erro') {
        est.erro ??= { motivo: 'erro_de_banco' }
        return false
      }
      const lido = lerApply(res.data)
      if (!lido) {
        est.erro ??= { motivo: 'forma_inesperada' }
        return false
      }
      resumo.fora_do_teto += lido.fora_do_teto
      if (lido.tipo === 'sem_base') {
        // Nada foi gravado nem coberto: a base do vídeo não alcança o começo da janela. Fica para amanhã.
        est.pendente = true
        return false
      }
      resumo.gravados += lido.gravadas
      resumo.dias_mantidos += lido.dias_mantidos
      resumo.dias_em_revisao += lido.dias_em_revisao
      est.respondeu++
      if (linhas.length > 0) est.comLinhas = true
      return true
    }

    // ── Fase A: famílias `com_dia` (a janela inteira numa consulta) ─────────
    await emParalelo(fila, PARALELO, async (est) => {
      try {
        for (const fam of COM_DIA) {
          const a = est.ativas[fam]
          if (!a) continue
          if (parada) {
            aplicarParada(est)
            break
          }
          const r = await consultar(est, fam, a.de, a.ate)
          if (!r) {
            // Sem tempo, teto ou parada do canal: o vídeo não começa mais nada. Erro só desta família: segue.
            if (est.pendente || parada) break
            continue
          }
          await gravar(est, fam, a.de, a.ate, r.linhas)
          if (est.schema) break
        }
      } catch (e) {
        Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
        est.erro ??= { motivo: 'excecao' }
      }
    })

    // ── Fase B: famílias `por_dia` (uma consulta por dia com view, UMA gravação) ──
    await emParalelo(fila, PARALELO, async (est) => {
      try {
        for (const fam of POR_DIA) {
          const a = est.ativas[fam]
          if (!a) continue
          if (parada) {
            aplicarParada(est)
            break
          }
          const juntas: LinhaDim[] = []
          let ateFeito = a.ate
          for (const dia of a.dias) {
            const r = await consultar(est, fam, dia, dia)
            if (!r) {
              // O primeiro dia sem resposta encerra a família: a cobertura vai só até o dia anterior a ele.
              ateFeito = addDays(dia, -1)
              break
            }
            for (const l of r.linhas) juntas.push(l)
          }
          if (ateFeito >= a.de) await gravar(est, fam, a.de, ateFeito, juntas)
          if (est.schema || parada) break
        }
      } catch (e) {
        Sentry.captureException(e, { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
        est.erro ??= { motivo: 'excecao' }
      }
    })

    // ── Tentativa de cada vídeo ────────────────────────────────────────────
    let comErro = 0
    let primeiraCausa = ''
    let pendentesDoCanal = 0
    for (const est of fila) {
      // Quem já terminou todas as famílias e gravou não é remarcado pela parada de OUTRO vídeo.
      if (!terminou(est)) aplicarParada(est)
      const base = { site_id: est.v.site, scope_type: 'video' as const, scope_id: est.v.yt, kind: 'dimensoes' as const, channel_id: c.id }
      if (est.pendente) {
        resumo.pendentes++
        pendentesDoCanal++
      }
      if (est.negado) {
        await registrarTentativa(ctx, { ...base, outcome: 'sem_autorizacao', http_status: est.negadoHttp ?? parada?.http ?? 401 })
      } else if (est.schema) {
        await registrarTentativa(ctx, { ...base, outcome: 'schema_ausente' })
      } else if (est.erro) {
        comErro++
        primeiraCausa ||= est.erro.motivo
        await registrarTentativa(ctx, { ...base, outcome: 'erro_http', http_status: est.erro.http ?? null, error: est.erro.motivo })
      } else if (est.pendente) {
        await registrarTentativa(ctx, { ...base, outcome: 'nao_alcancado_orcamento' })
      } else if (est.respondeu > 0 && !est.comLinhas) {
        await registrarTentativa(ctx, { ...base, outcome: 'sem_dado_na_janela' })
      } else {
        await registrarTentativa(ctx, { ...base, outcome: 'ok' })
      }
    }

    // ── Notas do canal ─────────────────────────────────────────────────────
    resumo.estendidas_recusadas += estendidasDoCanal
    resumo.valores_invalidos += invalidasDoCanal
    for (const fam of recusadasDoCanal) {
      pushUnico(ctx.falhas, `dimensões: a API recusou a consulta de ${ROTULO[fam]} (HTTP 400)`)
      Sentry.captureMessage(`dimensões: a API recusou a consulta de ${ROTULO[fam]}`, { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
    }
    if (cotaDoCanal) pushUnico(ctx.falhas, 'dimensões: cota da Analytics API esgotada')
    if (comErro > 0 && parada?.tipo !== 'negado') {
      pushUnico(ctx.falhas, `dimensões: ${channelNote(c.name, `${comErro} de ${fila.length} vídeos com erro (${textoDoMotivo(primeiraCausa)})`)}`)
    }
    if (invalidasDoCanal > 0) {
      pushUnico(ctx.falhas, `dimensões: ${channelNote(c.name, `${invalidasDoCanal} valor(es) de dimensão em formato inesperado`)}`)
    }
    if (estendidasDoCanal > 0) {
      pushUnico(ctx.falhas, `dimensões: ${channelNote(c.name, 'a Analytics API recusou as métricas estendidas')}`)
      Sentry.captureMessage('dimensões: a Analytics API recusou as métricas estendidas', { tags: { cron: 'sync-analytics-metrics', passo: 'dimensoes' }, extra: { canal: c.channel_id } })
    }
    if (resumo.consultas_cortadas > 0) {
      pushUnico(ctx.falhas, `dimensões: teto de ${MAX_CONSULTAS_DIMENSOES} consultas por execução atingido (${resumo.consultas_cortadas} cortada(s))`)
    }

    const pt = parada
    await registrarTentativa(
      ctx,
      pt?.tipo === 'negado' ? { ...tCanal(c), outcome: 'sem_autorizacao' }
        : pt?.tipo === 'schema' ? { ...tCanal(c), outcome: 'schema_ausente' }
        : comErro > 0 ? { ...tCanal(c), outcome: 'erro_http', error: primeiraCausa }
        : pendentesDoCanal > 0 ? { ...tCanal(c), outcome: 'nao_alcancado_orcamento' }
        : { ...tCanal(c), outcome: 'ok' },
    )

    if (pt?.tipo === 'schema') {
      // A migration sumiu no meio: os canais seguintes não chamam mais a API.
      for (const k of canais.slice(i + 1).filter(x => sitesOk.has(x.site_id))) {
        await registrarTentativa(ctx, { ...tCanal(k), outcome: 'schema_ausente' })
      }
      break
    }
  }

  resumo.consultas = consultas
  return fechar()
}
