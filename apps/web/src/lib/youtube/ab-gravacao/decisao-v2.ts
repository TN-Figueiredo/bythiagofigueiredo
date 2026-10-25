import { addDays, boundsAnalytics, dayPt, ontemPt, type DiaPt } from '../coleta/day-pt'
import type { AbCycle, AbTest } from '../coleta/ab-seconds'
import { getVariantForCycle } from '../ab-rotation'
import { diasDoTeste } from './atribuicao'

export const ATRASO_ALCANCE = 3
export const V_MAXIMO_V2 = 3 // 4 variantes: recusar (padrão do plano); suportar = 4
export const pisoDeDias = (V: number): number => 4 * V // 8 com 2, 12 com 3
export const tetoMinimo = (V: number): number => pisoDeDias(V) + 1 + ATRASO_ALCANCE
export const tetoPadrao = (V: number): number => Math.max(15, tetoMinimo(V) + 1) // ◆folga, dono 24/10: 15/17

export interface CicloComNumero extends AbCycle { cycle_number: number }

/** Parte da `ultima_avaliacao` de `ResultadoV2` que o relógio lê (o tipo completo vem na T5). */
export interface UltimaAvaliacaoV2 { em: string; acao: 'seguir' | 'encerrar_adiado'; dias_relogio: number }
export interface ResultadoV2Relogio { ultima_avaliacao?: UltimaAvaliacaoV2 | null }

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
export function estadoV2DoTeste(teste: AbTest, ciclos: CicloComNumero[], v2: ResultadoV2Relogio | null, agora: Date, teto: number): EstadoV2 {
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
