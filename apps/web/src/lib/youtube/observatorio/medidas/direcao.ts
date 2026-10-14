import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { cruzaMudancaDeContagem } from './contagem'
import { medido, naoMedido, type Formato, type Medida, type Nota } from './tipos'
import type { ValorM1 } from './m1'

/** M3: direção do canal (inteiro e vídeos novos). Puro: datas de São Paulo `AAAA-MM-DD` entram por parâmetro. */
export interface RetratoDoCanal { dia: string; views: number | null }
export type Direcao = 'subindo' | 'igual' | 'descendo'

/** Soma `n` dias a uma data `AAAA-MM-DD` (calendário, sem fuso). */
export function somaDias(dia: string, n: number): string {
  const t = Date.parse(dia + 'T00:00:00Z')
  if (!Number.isFinite(t)) throw new Error('dia_malformado')
  return new Date(t + n * DAY).toISOString().slice(0, 10)
}

/** `>= +0,10` sobe, `<= −0,10` desce. Arredonda a 9 casas: `110/100 − 1` e `90/100 − 1` não podem falhar por ponto flutuante. */
export function direcaoDe(variacao: number): Direcao {
  const v = Math.round(variacao * 1e9) / 1e9
  const lim = MEASURE_RULES.equalPct
  return v >= lim ? 'subindo' : v <= -lim ? 'descendo' : 'igual'
}

export interface ValorDirecaoCanal { variacao: number; direcao: Direcao; ganhoRecente: number; ganhoAnterior: number }

interface Bordas { d: string; views: Map<string, number>; primeiro: string }

/** O retrato mais recente com views, o mapa dia → views e o primeiro dia da série (com ou sem views). */
function bordas(retratos: readonly RetratoDoCanal[]): Bordas | null {
  const views = new Map<string, number>()
  let d: string | null = null
  let primeiro: string | null = null
  for (const r of retratos) {
    if (primeiro === null || r.dia < primeiro) primeiro = r.dia
    if (typeof r.views === 'number' && Number.isFinite(r.views)) {
      views.set(r.dia, r.views)
      if (d === null || r.dia > d) d = r.dia
    }
  }
  return d === null || primeiro === null ? null : { d, views, primeiro }
}

type Falha = { motivo: 'sem_registro_recente' | 'pouco_registro' | 'sem_registro_na_borda'; desde?: string }

/** Acha os `k + 1` retratos D, D−28, ..., D−28k, ou diz por que não dá. */
function pontos(retratos: readonly RetratoDoCanal[], hojeSP: string, k: number): { d: string; v: number[] } | Falha {
  const b = bordas(retratos)
  if (!b || b.d < somaDias(hojeSP, -MEASURE_RULES.direction.staleDays)) return { motivo: 'sem_registro_recente' }
  const passo = MEASURE_RULES.direction.windowDays
  if (b.primeiro > somaDias(b.d, -passo * k)) return { motivo: 'pouco_registro' }
  const v: number[] = []
  for (let j = 0; j <= k; j++) {
    const dia = somaDias(b.d, -passo * j)
    const x = b.views.get(dia)
    if (x === undefined) return { motivo: 'sem_registro_na_borda', desde: dia }
    v.push(x)
  }
  return { d: b.d, v }
}

const ehFalha = (x: { d: string; v: number[] } | Falha): x is Falha => 'motivo' in x

export function direcaoDoCanalInteiro(retratos: readonly RetratoDoCanal[], hojeSP: string): Medida<ValorDirecaoCanal> {
  const p = pontos(retratos, hojeSP, 2)
  if (ehFalha(p)) return naoMedido(p.motivo, p.desde ? { desde: p.desde } : {})
  const [v0, v1, v2] = p.v as [number, number, number]
  const ganhoRecente = v0 - v1, ganhoAnterior = v1 - v2
  if (ganhoRecente < 0 || ganhoAnterior < 0) return naoMedido('contagem_recuou')
  if (ganhoAnterior === 0) return naoMedido('base_zero')
  const de = somaDias(p.d, -2 * MEASURE_RULES.direction.windowDays)
  const variacao = ganhoRecente / ganhoAnterior - 1
  const notas: Nota[] = cruzaMudancaDeContagem(de, p.d) ? [{ tipo: 'mudanca_de_contagem' }] : []
  return medido({ variacao, direcao: direcaoDe(variacao), ganhoRecente, ganhoAnterior }, 3, { de, ate: p.d, dias: 2 * MEASURE_RULES.direction.windowDays }, notas)
}

/** Ganhos de cada janela de 28 dias, da mais recente à mais antiga, para o estado do canal. Usa o mesmo critério de M3 a. */
export function variacoesDoCanal(retratos: readonly RetratoDoCanal[], hojeSP: string, janelas: number): Medida<{ variacoes: number[] }> {
  const passo = MEASURE_RULES.direction.windowDays
  const k = janelas + 1
  const p = pontos(retratos, hojeSP, k)
  if (ehFalha(p)) return naoMedido(p.motivo, p.desde ? { desde: p.desde } : {})
  const de = somaDias(p.d, -passo * k)
  if (cruzaMudancaDeContagem(de, p.d)) return naoMedido('janela_cruza_mudanca_de_contagem')
  const ganhos = p.v.slice(0, -1).map((x, j) => x - p.v[j + 1]!)
  if (ganhos.some(g => g < 0)) return naoMedido('contagem_recuou')
  const variacoes: number[] = []
  for (let j = 0; j < janelas; j++) {
    if (ganhos[j + 1] === 0) return naoMedido('base_zero')
    variacoes.push(ganhos[j]! / ganhos[j + 1]! - 1)
  }
  return medido({ variacoes }, k + 1, { de, ate: p.d, dias: passo * k })
}

export interface VideoParaDirecao {
  formato: Formato | null
  publicadoEm: number
  wasLive: boolean | null
  agendadoOuNoAr: boolean
  viewsHidden: boolean | null
  viewsHoje: number | null
  /** V30 do vídeo (M1); só lido quando `base` é `'v30'`. */
  v30: Medida<ValorM1> | null
}

export interface ValorDirecaoVideos { variacao: number; direcao: Direcao; medianaRecente: number; medianaAnterior: number }

/** M3 b e c: mediana dos longos de até 90 dias ÷ a dos de 91 a 180 dias, menos 1. */
export function direcaoDosVideosNovos(
  videos: readonly VideoParaDirecao[],
  o: { agoraMs: number; base: 'views_de_hoje' | 'v30' },
): Medida<ValorDirecaoVideos> {
  const janela = MEASURE_RULES.channelWindowDays
  const longos = videos.filter(v => v.formato === 'long')
  const agendados = longos.filter(v => v.agendadoOuNoAr).length
  const aoVivo = longos.filter(v => !v.agendadoOuNoAr && v.wasLive === true).length
  const notas: Nota[] = []
  if (agendados) notas.push({ tipo: 'agendado_fora', n: agendados })
  if (aoVivo) notas.push({ tipo: 'ao_vivo_fora', n: aoVivo })
  const recente: number[] = [], anterior: number[] = []
  for (const v of longos) {
    if (v.agendadoOuNoAr || v.wasLive === true || v.viewsHidden === true) continue
    const x = o.base === 'v30' ? (v.v30 && v.v30.estado === 'medido' ? v.v30.valor.views : null) : v.viewsHoje
    if (x === null || !Number.isFinite(x)) continue
    const idade = (o.agoraMs - v.publicadoEm) / DAY
    if (idade < 0) continue
    if (idade <= janela) recente.push(x)
    else if (idade <= 2 * janela) anterior.push(x)
  }
  const minimo = RULES.weakBase
  if (recente.length < minimo || anterior.length < minimo) {
    return naoMedido('poucos_videos', { n: Math.min(recente.length, anterior.length), minimo, notas })
  }
  const mr = median(recente), ma = median(anterior)
  if (mr === null || ma === null) return naoMedido('poucos_videos', { n: 0, minimo, notas })
  if (ma === 0) return naoMedido('base_zero', { notas })
  const variacao = mr / ma - 1
  return medido(
    { variacao, direcao: direcaoDe(variacao), medianaRecente: mr, medianaAnterior: ma },
    recente.length + anterior.length,
    { de: spDateOf(o.agoraMs - 2 * janela * DAY), ate: spDateOf(o.agoraMs), dias: 2 * janela },
    notas,
  )
}
