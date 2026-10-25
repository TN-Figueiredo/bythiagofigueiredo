import { addDays, boundsAnalytics, dayPt, ontemPt, type DiaPt } from '../coleta/day-pt'
import type { AbCycle, AbTest } from '../coleta/ab-seconds'
import { getVariantForCycle } from '../ab-rotation'
import { diasDoTeste } from './atribuicao'
import { estadoDoAlcance, type LinhaAlcance, type RelatorioDoDia } from './estado'
import { diaComAlcanceValido, diaValido } from './placar'
import type { EstadoAlcance, MetaDoDia } from './tipos'
import type { DesfechoV2, ResultadoV2 } from '../ab-types'

export type { DesfechoV2 }

export const ATRASO_ALCANCE = 3
export const V_MAXIMO_V2 = 3 // 4 variantes: recusar (padrão do plano); suportar = 4
export const pisoDeDias = (V: number): number => 4 * V // 8 com 2, 12 com 3
export const tetoMinimo = (V: number): number => pisoDeDias(V) + 1 + ATRASO_ALCANCE
export const tetoPadrao = (V: number): number => Math.max(15, tetoMinimo(V) + 1) // ◆folga, dono 24/10: 15/17

/**
 * Fonte única do teto (dias) de um teste v2: decisão, rede, projeção do Cowork e aviso de volume chamam esta função.
 * `max_duration_days` positivo vale; ausente ou inválido cai em `tetoPadrao(V)` (V limitado a 2..V_MAXIMO_V2).
 * `soExplicito`: no rascunho o config pode trazer o 14 do wizard v1, que só vale com `teto_explicito === true`.
 */
export function tetoDoTesteV2(config: unknown, V: number, opcoes: { soExplicito?: boolean } = {}): number {
  const c = config && typeof config === 'object' ? (config as { max_duration_days?: unknown; teto_explicito?: unknown }) : {}
  const vale = !opcoes.soExplicito || c.teto_explicito === true
  if (vale && typeof c.max_duration_days === 'number' && c.max_duration_days > 0) return c.max_duration_days
  return tetoPadrao(Math.min(Math.max(V, 2), V_MAXIMO_V2))
}

export interface CicloComNumero extends AbCycle { cycle_number: number }

export type UltimaAvaliacaoV2 = NonNullable<ResultadoV2['ultima_avaliacao']>

/** Dias fechados com ciclo no ar, sem a janela de 40 dias do retrato (nunca hoje, PT). */
export function relogioV2(ciclos: CicloComNumero[], teste: AbTest, agora: Date): DiaPt[] {
  const inicios = ciclos.map(c => Date.parse(c.started_at)).filter(Number.isFinite)
  if (inicios.length === 0) return []
  const desde = dayPt(new Date(Math.min(...inicios)))
  return diasDoTeste(ciclos, teste, ontemPt(agora), desde)
}

/** Ciclo com maior sobreposição no dia; empate: o da variante do dia, depois o de maior cycle_number; null se nenhum. */
export function cicloDoDia(day: DiaPt, ciclos: readonly CicloComNumero[], variantDoDia?: string | null): CicloComNumero | null {
  const b = boundsAnalytics(day)
  let melhor: { c: CicloComNumero; s: number } | null = null
  for (const c of ciclos) {
    const ini = Date.parse(c.started_at)
    if (!Number.isFinite(ini)) continue
    const fim = c.ended_at ? Date.parse(c.ended_at) : Number.POSITIVE_INFINITY
    const s = Math.min(fim, b.end) - Math.max(ini, b.start)
    if (!(s > 0)) continue
    if (!melhor || s > melhor.s) { melhor = { c, s }; continue }
    if (s < melhor.s) continue
    const daVar = (x: CicloComNumero) => (variantDoDia != null && x.variant_id === variantDoDia ? 1 : 0)
    if (daVar(c) > daVar(melhor.c) || (daVar(c) === daVar(melhor.c) && c.cycle_number > melhor.c.cycle_number)) melhor = { c, s }
  }
  return melhor ? melhor.c : null
}

export function blocoDoDia(cycleNumber: number, V: number): number {
  return Math.floor(cycleNumber / (2 * V))
}

/**
 * FOLGA por variante no teto T: dias válidos menos o piso de 4. Um ciclo por dia; o dia 0 (parcial) e os
 * ATRASO_ALCANCE últimos dias (aguardando alcance) ficam fora; a variante do ciclo n vem de getVariantForCycle.
 */
export function folgaPorVariante(V: number, T: number): number[] {
  const dias = new Array<number>(V).fill(0)
  for (let n = 1; n <= T - 1 - ATRASO_ALCANCE; n++) dias[getVariantForCycle(V, n)] = (dias[getVariantForCycle(V, n)] ?? 0) + 1
  return dias.map(d => d - 4)
}

export interface EstadoV2 {
  dia: number
  teto: number
  ultima_avaliacao: UltimaAvaliacaoV2 | null
  idade_horas: number | null
  estado: 'ativo' | 'pausado'
}

/** Fonte única do "dia X de T": tela e Cowork chamam esta função. `teto` vem da config do teste (ou tetoPadrao). */
export function estadoV2DoTeste(teste: AbTest, ciclos: CicloComNumero[], v2: ResultadoV2 | null, agora: Date, teto: number): EstadoV2 {
  const pausado = teste.status === 'paused'
  const ua = v2?.ultima_avaliacao ?? null
  const em = ua ? Date.parse(ua.em) : NaN
  return {
    dia: relogioV2(ciclos, teste, agora).length,
    teto,
    ultima_avaliacao: ua,
    idade_horas: !pausado && ua && Number.isFinite(em) ? (agora.getTime() - em) / 3_600_000 : null,
    estado: pausado ? 'pausado' : 'ativo',
  }
}

export const K_POR_V: Record<2 | 3, number> = { 2: 7.85, 3: 9.5 } // V = 4 (k = 10.47) só se o dono escolher suportar

/** N por variante para detectar +20% relativo; lança para V fora de {2,3} (nunca NaN). */
export function volumeMinimo(p1: number, V: number): number {
  if (V !== 2 && V !== 3) throw new Error(`volumeMinimo: V=${V} fora de {2,3}`)
  if (!Number.isFinite(p1) || p1 <= 0 || p1 >= 1) throw new Error(`volumeMinimo: p1=${p1} inválido`)
  const p2 = 1.2 * p1
  return Math.ceil(K_POR_V[V] * (p1 * (1 - p1) + p2 * (1 - p2)) / ((p2 - p1) ** 2))
}

export interface BaseDoVideo { p1: number; dias: number; impressoes: number; p1_dias_sem_meta: number; base_estimada: boolean }

const P1_PADRAO = 0.04

/** p1 do vídeo na janela [ate − 14, ate): só dias com alcance válido e fora de outro teste. */
export function baseDoVideo(e: {
  alcancePorVideoDia: Map<string, LinhaAlcance>; relatoriosPorCanalDia: Map<string, RelatorioDoDia[]>; metaPorVideoDia: Map<string, MetaDoDia>
}, video: { youtube_id: string; channel_id: string }, testId: string | null, ate: DiaPt, agora: Date): BaseDoVideo {
  const ontem = ontemPt(agora)
  let dias = 0, impressoes = 0, cliques = 0, semMeta = 0
  for (let i = 14; i >= 1; i--) {
    const day = addDays(ate, -i)
    const meta = e.metaPorVideoDia.get(`${video.youtube_id}|${day}`) ?? null
    if (meta && meta.ab_test_id !== null && meta.ab_test_id !== testId) continue
    const linha = e.alcancePorVideoDia.get(`${video.youtube_id}|${day}`) ?? null
    const alcance_estado = estadoDoAlcance({ day, ontem, relatorios: e.relatoriosPorCanalDia.get(`${video.channel_id}|${day}`) ?? [], linha })
    const imp = linha?.thumbnail_impressions ?? null
    const ctr = linha?.thumbnail_ctr ?? null
    if (!diaComAlcanceValido({ alcance_estado, impressoes: imp, ctr })) continue
    if (!meta) semMeta++
    dias++
    impressoes += imp as number
    cliques += Math.round((imp as number) * (ctr as number))
  }
  const medido = impressoes > 0 ? cliques / impressoes : 0
  const ok = dias >= 7 && impressoes >= 2000 && Number.isFinite(medido) && medido > 0 && medido < 0.5
  return { p1: ok ? medido : P1_PADRAO, dias, impressoes, p1_dias_sem_meta: semMeta, base_estimada: !ok }
}

// ---------------------------------------------------------------------------------------------
// Estatística v2 (pura): z de duas proporções ajustado por superdispersão, p pela t de Student.
// ---------------------------------------------------------------------------------------------

export interface DiaDaDecisao {
  day_pt: DiaPt; variant_id: string | null; alcance_estado: EstadoAlcance
  impressoes: number | null; ctr: number | null; final: boolean; bloco: number | null
}

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const cj of c) ser += cj / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

function betacf(a: number, b: number, x: number): number {
  const TINY = 1e-300
  let c = 1
  let d = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1))
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-14) break
  }
  return h
}

/** Beta incompleta regularizada I_x(a, b). */
function betaIncompleta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** CDF da t de Student com `gl` graus de liberdade inteiros >= 1. */
export function tCdf(t: number, gl: number): number {
  if (!Number.isInteger(gl) || gl < 1) throw new Error(`tCdf: gl=${gl} inválido`)
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0
  const cauda = 0.5 * betaIncompleta(gl / (gl + t * t), gl / 2, 0.5) // P(T > |t|)
  return t > 0 ? 1 - cauda : cauda
}

export type EstatisticaV2 =
  | { estado: 'sem_dado'; motivo: 'gl_menor_que_2' | 'variante_sem_ctr' | 'p_extremo' }
  | {
      estado: 'calculada'; phi: number; gl: number
      por_variante: Array<{ variant_id: string; alfa: number; z: number; z_adj: number; p_adj: number; sinais_por_bloco: Array<-1 | 0 | 1>; passa: boolean; lift: number }>
    }

const SEM = (motivo: 'gl_menor_que_2' | 'variante_sem_ctr' | 'p_extremo'): EstatisticaV2 => ({ estado: 'sem_dado', motivo })
const SINAL_BLOCO_SEM = -1_000_000 // bloco nulo: nunca participa do sinal

interface Celula { imp: number; cliques: number; dias: Array<{ imp: number; cliques: number }> }

/**
 * `variantes` lista todas as variantes do teste (a original inclusive): V = variantes.length define α
 * (0,05 com 2; 0,025 por comparação com 3). Compara cada não-original contra a original.
 */
export function estatisticaV2(dias: readonly DiaDaDecisao[], originalId: string, variantes: readonly string[]): EstatisticaV2 {
  const V = variantes.length
  const alfa = V <= 2 ? 0.05 : 0.025
  const validos = dias.filter(d => diaValido(d) && d.variant_id !== null && variantes.includes(d.variant_id))
  const total = new Map<string, { imp: number; cliques: number }>()
  const celulas = new Map<string, Celula>() // `${variante}|${bloco}`
  for (const d of validos) {
    const imp = d.impressoes as number
    const cliques = Math.round(imp * (d.ctr as number))
    const v = d.variant_id as string
    const t = total.get(v) ?? { imp: 0, cliques: 0 }
    t.imp += imp; t.cliques += cliques; total.set(v, t)
    const chave = `${v}|${d.bloco ?? SINAL_BLOCO_SEM}`
    const c = celulas.get(chave) ?? { imp: 0, cliques: 0, dias: [] }
    c.imp += imp; c.cliques += cliques; c.dias.push({ imp, cliques }); celulas.set(chave, c)
  }
  for (const v of variantes) if (!((total.get(v)?.imp ?? 0) > 0)) return SEM('variante_sem_ctr')

  const gl = validos.length - celulas.size
  if (gl < 2) return SEM('gl_menor_que_2')

  let soma = 0
  for (const c of celulas.values()) {
    const p = c.cliques / c.imp
    if (!(p > 0 && p < 1)) continue
    for (const d of c.dias) soma += (d.cliques - d.imp * p) ** 2 / (d.imp * p * (1 - p))
  }
  const phi = soma / gl
  if (!Number.isFinite(phi)) return SEM('p_extremo')

  const orig = total.get(originalId)
  if (!orig) return SEM('variante_sem_ctr')
  const ctrO = orig.cliques / orig.imp
  const blocos = [...new Set(validos.map(d => d.bloco).filter((b): b is number => b !== null))].sort((a, b) => a - b)

  const por_variante: Array<{ variant_id: string; alfa: number; z: number; z_adj: number; p_adj: number; sinais_por_bloco: Array<-1 | 0 | 1>; passa: boolean; lift: number }> = []
  for (const v of variantes) {
    if (v === originalId) continue
    const tv = total.get(v) as { imp: number; cliques: number }
    const ctrV = tv.cliques / tv.imp
    const pool = (tv.cliques + orig.cliques) / (tv.imp + orig.imp)
    if (!(pool > 0 && pool < 1) || !(ctrO > 0)) return SEM('p_extremo')
    const se = Math.sqrt(pool * (1 - pool) * (1 / tv.imp + 1 / orig.imp))
    const z = (ctrV - ctrO) / se
    const z_adj = z / Math.sqrt(Math.max(1, phi))
    const p_adj = 2 * (1 - tCdf(Math.abs(z_adj), gl))
    const lift = ctrV / ctrO - 1
    if (![z, z_adj, p_adj, lift].every(Number.isFinite)) return SEM('p_extremo')

    const sinais: Array<-1 | 0 | 1> = []
    for (const b of blocos) {
      const cv = celulas.get(`${v}|${b}`), co = celulas.get(`${originalId}|${b}`)
      if (!cv || !co) continue // bloco incompleto (parcial no fim) não entra no sinal
      const dif = cv.cliques / cv.imp - co.cliques / co.imp
      sinais.push(dif > 0 ? 1 : dif < 0 ? -1 : 0)
    }
    const sinalZ = z > 0 ? 1 : z < 0 ? -1 : 0
    const consistente = sinais.length > 0 && sinalZ !== 0 && sinais.every(s => s === sinalZ)
    por_variante.push({ variant_id: v, alfa, z, z_adj, p_adj, sinais_por_bloco: sinais, passa: p_adj < alfa && consistente, lift })
  }
  return { estado: 'calculada', phi, gl, por_variante }
}

// ---------------------------------------------------------------------------------------------
// Pisos, desfecho e dia de encerramento (puras).
// ---------------------------------------------------------------------------------------------

export interface Pisos {
  dias_validos: Record<string, number>; blocos_completos: number; piso_dias: boolean
  volume: Record<string, number | null>; piso_volume: boolean; fechavel_por_aguardando: boolean
}

const PISO_DIAS_POR_VARIANTE = 4

export function pisos(dias: readonly DiaDaDecisao[], variantes: readonly string[], n: number): Pisos {
  const dias_validos: Record<string, number> = {}
  const aguardando: Record<string, number> = {}
  const impressoes: Record<string, number> = {}
  const blocosPorVariante = new Map<string, Set<number>>()
  for (const v of variantes) { dias_validos[v] = 0; aguardando[v] = 0; impressoes[v] = 0; blocosPorVariante.set(v, new Set()) }
  for (const d of dias) {
    const v = d.variant_id
    if (v === null || !(v in dias_validos)) continue
    if (diaValido(d)) {
      dias_validos[v] = (dias_validos[v] ?? 0) + 1
      impressoes[v] = (impressoes[v] ?? 0) + (d.impressoes as number)
      if (d.bloco !== null) blocosPorVariante.get(v)?.add(d.bloco)
    } else if (d.alcance_estado === 'aguardando') aguardando[v] = (aguardando[v] ?? 0) + 1
  }
  const todos = [...new Set([...blocosPorVariante.values()].flatMap(s => [...s]))]
  const blocos_completos = todos.filter(b => variantes.every(v => blocosPorVariante.get(v)?.has(b))).length
  const volume: Record<string, number | null> = {}
  for (const v of variantes) volume[v] = (dias_validos[v] ?? 0) > 0 ? (impressoes[v] as number) : null
  return {
    dias_validos, blocos_completos,
    piso_dias: variantes.every(v => (dias_validos[v] ?? 0) >= PISO_DIAS_POR_VARIANTE),
    volume,
    piso_volume: variantes.every(v => (volume[v] ?? 0) >= n),
    fechavel_por_aguardando: variantes.every(v => (dias_validos[v] ?? 0) + (aguardando[v] ?? 0) >= PISO_DIAS_POR_VARIANTE),
  }
}

/** ◆3: false = "segue até o teto" (padrão sem resposta); true = "encerra quando os pisos fecham". */
export const ENCERRA_AO_FECHAR_PISOS = false

export type DecisaoV2 = { acao: 'seguir' } | { acao: 'encerrar'; desfecho: DesfechoV2; vencedor_sugerido: string | null }

export function decidirV2(i: { relogio: number; teto: number; pisos: Pisos; estatistica: EstatisticaV2; encerraAoFecharPisos?: boolean }): DecisaoV2 {
  const noTeto = i.relogio >= i.teto
  const { pisos: p } = i
  if (p.piso_dias && p.piso_volume) {
    if (!noTeto && !(i.encerraAoFecharPisos ?? ENCERRA_AO_FECHAR_PISOS)) return { acao: 'seguir' }
    if (i.estatistica.estado === 'calculada') {
      const melhor = i.estatistica.por_variante.filter(x => x.passa).sort((a, b) => a.p_adj - b.p_adj)[0]
      if (melhor) return { acao: 'encerrar', desfecho: 'vencedor_provavel', vencedor_sugerido: melhor.variant_id }
    }
    return { acao: 'encerrar', desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null }
  }
  if (!noTeto) return { acao: 'seguir' }
  const desfecho: DesfechoV2 = !p.piso_dias
    ? (p.fechavel_por_aguardando ? 'aguardando_alcance' : !p.piso_volume ? 'inconclusivo_por_volume' : 'inconclusivo_por_dado')
    : 'inconclusivo_por_volume'
  return { acao: 'encerrar', desfecho, vencedor_sugerido: null }
}

/** Desfecho do teste recém-encerrado, só com dias <= encerradoEmDia; é "provisório" enquanto algum desses não é final. */
export function desfechoProvisorio(i: { dias: readonly DiaDaDecisao[]; encerradoEmDia: DiaPt; variantes: readonly string[]; originalId: string; n: number }): {
  desfecho: DesfechoV2; vencedor_sugerido: string | null; provisorio: boolean; estatistica: EstatisticaV2
} {
  const dias = i.dias.filter(d => d.day_pt <= i.encerradoEmDia)
  const estatistica = estatisticaV2(dias, i.originalId, i.variantes)
  const d = decidirV2({ relogio: Number.POSITIVE_INFINITY, teto: 0, pisos: pisos(dias, i.variantes, i.n), estatistica })
  const provisorio = dias.some(x => !x.final)
  return d.acao === 'encerrar'
    ? { desfecho: d.desfecho, vencedor_sugerido: d.vencedor_sugerido, provisorio, estatistica }
    : { desfecho: 'inconclusivo_por_dado', vencedor_sugerido: null, provisorio, estatistica }
}

/** Último dia PT fechado antes de completed_at. */
export function encerradoEmDia(completedAt: string): DiaPt {
  return addDays(dayPt(new Date(completedAt)), -1)
}
