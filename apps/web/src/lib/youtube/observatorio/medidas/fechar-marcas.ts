import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import { MEASURE_RULES } from './regras'
import { FALTAS_DE_MARCA, type FaltaDeMarca } from './tipos'
import {
  decidirMarca, marcaPerdida, perdaAvisa,
  type IdadeDeMarca, type Leitura, type MarcaParaGravar, type PendenteDeMarca,
} from './m1'

/**
 * New (A5, E4, Tarefa 10): o escritor das marcas. Duas idas ao banco: `competitor_marks_pending` (lê o que falta decidir)
 * e `competitor_marks_apply` (grava marcas e motivos, e devolve a prova). A decisão de cada par é `decidirMarca` (pura).
 * Nunca lança e nunca devolve texto de exceção: só código de catálogo e número.
 */
export const MOTIVOS_DAS_MARCAS = [
  'schema_ausente', 'banco_nao_respondeu', 'leitura_falhou', 'gravacao_falhou', 'resposta_invalida', 'marca_recusada',
  'prova_inconsistente', 'marcas_perdidas', 'marcas_atrasadas', 'sobrou',
] as const
export type MotivoDasMarcas = typeof MOTIVOS_DAS_MARCAS[number]

export interface ResultadoFecharMarcas {
  status: 'ok' | 'parcial' | 'erro'
  feitos: number
  ficaram: number | null
  motivo?: MotivoDasMarcas
  numeros: Record<string, number>
}

const SCHEMA_AUSENTE = new Set(['PGRST202', '42883', '42P01'])
const IDADES: readonly number[] = MEASURE_RULES.ages

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const ehNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numOuNulo = (v: unknown): number | null => (ehNum(v) ? v : null)
const boolOuNulo = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const msOuNulo = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

type Falha = 'schema_ausente' | 'banco_nao_respondeu' | 'com_codigo'

/** Traduz o que veio no `error` (ou foi lançado) em categoria. Nenhum texto sai daqui. */
function classificar(err: unknown): { falha: Falha; codigo: string } {
  if (!ehObj(err)) return { falha: 'banco_nao_respondeu', codigo: 'transporte' }
  const nome = typeof err.name === 'string' ? err.name : ''
  const msg = typeof err.message === 'string' ? err.message : ''
  if (nome === 'AbortError' || nome === 'TimeoutError' || msg.startsWith('AbortError:') || msg.startsWith('TimeoutError:')) {
    return { falha: 'banco_nao_respondeu', codigo: 'tempo_esgotado' }
  }
  const code = err.code
  if (typeof code === 'string' && SCHEMA_AUSENTE.has(code)) return { falha: 'schema_ausente', codigo: code.toLowerCase() }
  if (typeof code === 'string' && (/^PGRST\d{3}$/.test(code) || /^[A-Za-z0-9]{5}$/.test(code))) return { falha: 'com_codigo', codigo: code.toLowerCase() }
  return { falha: 'banco_nao_respondeu', codigo: 'transporte' }
}

function relatar(passo: string, codigo: string): void {
  Sentry.captureMessage('marcas_de_idade: ' + passo + ': ' + codigo, {
    level: 'error', tags: { component: 'sync-youtube', mode: 'marcas_de_idade', codigo },
  })
}

type Ida = { ok: true; data: unknown } | { ok: false; falha: Falha; codigo: string }

async function ida(sb: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Ida> {
  try {
    const r = await sb.rpc(fn, args).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (r.error !== null && r.error !== undefined) return { ok: false, ...classificar(r.error) }
    return { ok: true, data: r.data }
  } catch (err) {
    return { ok: false, ...classificar(err) }
  }
}

interface Lido { pendente: PendenteDeMarca; leiturasIgnoradas: number }

/** Forma de um item de `competitor_marks_pending`; `null` quando fora da forma. */
function lerItem(x: unknown): Lido | null {
  if (!ehObj(x)) return null
  if (typeof x.video_id !== 'string' || typeof x.site_id !== 'string') return null
  const idade = x.age_days
  if (!ehNum(idade) || !IDADES.includes(idade)) return null
  if (typeof x.base_at !== 'string' || typeof x.target_at !== 'string') return null
  const baseAt = Date.parse(x.base_at), alvoAt = Date.parse(x.target_at)
  if (Number.isNaN(baseAt) || Number.isNaN(alvoAt)) return null
  for (const k of ['missing_since', 'series_tier', 'prev_reason', 'gap_crossed_pause']) if (!(k in x)) return null
  if (typeof x.gap_crossed_pause !== 'boolean') return null
  const tier = x.series_tier
  if (tier !== null && tier !== 'diaria' && tier !== 'semanal') return null
  const prev = x.prev_reason
  let motivoAnterior: FaltaDeMarca | null = null
  if (prev !== null) {
    const achado = FALTAS_DE_MARCA.find((f) => f === prev)
    if (achado === undefined) return null
    motivoAnterior = achado
  }
  if (!Array.isArray(x.readings)) return null
  const leituras: Leitura[] = []
  let ignoradas = 0
  for (const r of x.readings) {
    const t = ehObj(r) ? msOuNulo(r.t) : null
    if (!ehObj(r) || t === null || !ehNum(r.views)) { ignoradas++; continue }
    leituras.push({ t, views: r.views, likes: numOuNulo(r.likes), comments: numOuNulo(r.comments) })
  }
  // Todas as leituras de um par inválidas: a resposta está estragada, não é "sem leitura".
  if (x.readings.length > 0 && leituras.length === 0) return null
  return {
    leiturasIgnoradas: ignoradas,
    pendente: {
      videoId: x.video_id, siteId: x.site_id, idadeDias: idade as IdadeDeMarca, baseAt, baseAtIso: x.base_at,
      seriesTier: tier, motivoAnterior, alvoAt,
      discoveredAt: msOuNulo(x.discovered_at), missingSince: msOuNulo(x.missing_since),
      viewsHidden: boolOuNulo(x.views_hidden), likesHidden: boolOuNulo(x.likes_hidden), commentsDisabled: boolOuNulo(x.comments_disabled),
      primeiraLeituraAt: msOuNulo(x.first_reading_at), ultimaLeituraAt: msOuNulo(x.last_reading_at),
      cruzouPausa: x.gap_crossed_pause, leituras,
    },
  }
}

interface FaltaParaGravar { video_id: string; age_days: IdadeDeMarca; base_at: string; reason: FaltaDeMarca; since_at: string | null }

const NOMES_FALTA: Record<FaltaDeMarca, string> = {
  sem_leitura: 'faltas_sem_leitura', views_ocultas: 'faltas_views_ocultas', leitura_comecou_depois: 'faltas_comecou_depois',
  descoberto_tarde: 'faltas_descoberto_tarde', leitura_parou_antes: 'faltas_parou_antes', leituras_distantes: 'faltas_distantes',
}

const CHAVES_DA_PROVA = ['atrasadas', 'em_duas_tabelas', 'site_divergente', 'base_divergente'] as const

export async function runFecharMarcas(o: { sb: SupabaseClient; now: () => number }): Promise<ResultadoFecharMarcas> {
  const erro = (motivo: MotivoDasMarcas, feitos = 0, numeros: Record<string, number> = {}, ficaram: number | null = null): ResultadoFecharMarcas =>
    ({ status: 'erro', feitos, ficaram, motivo, numeros })
  try {
    const agoraMs = o.now()
    const pNow = new Date(agoraMs).toISOString()
    const comum = { p_rule_version: MEASURE_RULES.ruleVersion, p_gap_hours_day1: MEASURE_RULES.maxGapHoursDay1, p_gap_hours: MEASURE_RULES.maxGapHours }

    // 1. Lê o que falta decidir.
    const l = await ida(o.sb, 'competitor_marks_pending', { p_now: pNow, p_limit: MEASURE_RULES.batch, ...comum })
    if (!l.ok) {
      if (l.falha === 'schema_ausente') return erro('schema_ausente')
      if (l.falha !== 'banco_nao_respondeu') relatar('leitura', l.codigo)
      return erro(l.falha === 'banco_nao_respondeu' ? 'banco_nao_respondeu' : 'leitura_falhou')
    }
    // 2. Forma.
    const d = l.data
    if (!ehObj(d) || !Array.isArray(d.itens) || !ehNum(d.total_pendentes) || !ehNum(d.pares_em_pausa)) return erro('resposta_invalida')
    const lidos: Lido[] = []
    for (const x of d.itens) {
      const li = lerItem(x)
      if (li === null) return erro('resposta_invalida')
      lidos.push(li)
    }

    // 3. Decide cada par.
    const marcas: MarcaParaGravar[] = []
    const faltas: FaltaParaGravar[] = []
    const n = {
      aguardando: 0, leituras_ignoradas: 0, perdidas_1: 0, perdidas_7: 0, perdidas_30: 0, perdidas_ja_avisadas: 0, perdidas_30_semanal: 0, pausadas: 0,
      faltas_sem_leitura: 0, faltas_views_ocultas: 0, faltas_comecou_depois: 0, faltas_descoberto_tarde: 0, faltas_parou_antes: 0, faltas_distantes: 0,
    }
    let alarmam = 0
    for (const { pendente: p, leiturasIgnoradas } of lidos) {
      n.leituras_ignoradas += leiturasIgnoradas
      const dec = decidirMarca(p, agoraMs)
      if (dec.tipo === 'aguardar') { n.aguardando++; continue }
      if (dec.tipo === 'marca') { marcas.push(dec.linha); continue }
      faltas.push({
        video_id: p.videoId, age_days: p.idadeDias, base_at: p.baseAtIso, reason: dec.reason,
        since_at: dec.sinceAt === null ? null : new Date(dec.sinceAt).toISOString(),
      })
      n[NOMES_FALTA[dec.reason] as keyof typeof n]++
      if (marcaPerdida(p, dec.reason)) {
        if (p.idadeDias === 1) n.perdidas_1++
        else if (p.idadeDias === 7) n.perdidas_7++
        else n.perdidas_30++
        if (perdaAvisa(p)) alarmam++
        else if (p.idadeDias === 30) n.perdidas_30_semanal++
      } else if (p.cruzouPausa && marcaPerdida({ ...p, cruzouPausa: false }, dec.reason)) {
        n.pausadas++
      } else if (
        (dec.reason === 'leituras_distantes' || dec.reason === 'leitura_parou_antes') &&
        (p.motivoAnterior === 'leituras_distantes' || p.motivoAnterior === 'leitura_parou_antes') &&
        p.primeiraLeituraAt !== null && p.primeiraLeituraAt < p.alvoAt && p.missingSince === null && !p.cruzouPausa
      ) {
        n.perdidas_ja_avisadas++
      }
    }
    const perdidas = n.perdidas_1 + n.perdidas_7 + n.perdidas_30

    // 4. Grava (mesmo p_now) e lê a prova.
    const g = await ida(o.sb, 'competitor_marks_apply', { p_marks: marcas, p_misses: faltas, p_now: pNow, ...comum })
    if (!g.ok) {
      if (g.falha === 'schema_ausente') return erro('schema_ausente')
      if (g.falha !== 'banco_nao_respondeu') relatar('gravacao', g.codigo)
      return erro(g.falha === 'banco_nao_respondeu' ? 'banco_nao_respondeu' : 'gravacao_falhou')
    }
    const a = g.data
    if (!ehObj(a) || !ehObj(a.saude)) return erro('resposta_invalida')
    for (const k of ['marcas', 'marcas_recusadas', 'faltas', 'faltas_recusadas', 'refeitas_por_base']) if (!ehNum(a[k])) return erro('resposta_invalida')
    for (const k of CHAVES_DA_PROVA) if (!ehNum(a.saude[k])) return erro('resposta_invalida')
    const saude = a.saude as Record<(typeof CHAVES_DA_PROVA)[number], number>
    const gravadas = a.marcas as number
    const gravadasFaltas = a.faltas as number

    const feitos = gravadas + gravadasFaltas
    const ficaram = Math.max(0, d.total_pendentes - feitos - n.aguardando)
    const numeros: Record<string, number> = {
      pendentes: d.total_pendentes, marcas: gravadas, faltas: gravadasFaltas, aguardando: n.aguardando,
      recusadas: a.marcas_recusadas as number, faltas_recusadas: a.faltas_recusadas as number,
      refeitas_por_base: a.refeitas_por_base as number, leituras_ignoradas: n.leituras_ignoradas,
      atrasadas: saude.atrasadas, em_duas_tabelas: saude.em_duas_tabelas, site_divergente: saude.site_divergente,
      base_divergente: saude.base_divergente, perdidas,
      perdidas_1: n.perdidas_1, perdidas_7: n.perdidas_7, perdidas_30: n.perdidas_30,
      perdidas_ja_avisadas: n.perdidas_ja_avisadas, perdidas_30_semanal: n.perdidas_30_semanal,
      pares_em_pausa: d.pares_em_pausa, pausadas: n.pausadas,
      faltas_sem_leitura: n.faltas_sem_leitura, faltas_views_ocultas: n.faltas_views_ocultas, faltas_comecou_depois: n.faltas_comecou_depois,
      faltas_descoberto_tarde: n.faltas_descoberto_tarde, faltas_parou_antes: n.faltas_parou_antes, faltas_distantes: n.faltas_distantes,
    }

    // 5. O veredito, na precedência de 6.1.
    const fim = (motivo: MotivoDasMarcas, status: 'erro' | 'parcial'): ResultadoFecharMarcas => ({ status, feitos, ficaram, motivo, numeros })
    if ((a.marcas_recusadas as number) > 0 || (a.faltas_recusadas as number) > 0) return fim('marca_recusada', 'erro')
    if (saude.em_duas_tabelas > 0 || saude.site_divergente > 0 || saude.base_divergente > 0) return fim('prova_inconsistente', 'erro')
    if (alarmam > 0) return fim('marcas_perdidas', 'erro')
    if (saude.atrasadas > 0 && ficaram === 0) return fim('marcas_atrasadas', 'erro')
    if (ficaram > 0) return fim('sobrou', 'parcial')
    return { status: 'ok', feitos, ficaram, numeros }
  } catch {
    return erro('leitura_falhou')
  }
}
