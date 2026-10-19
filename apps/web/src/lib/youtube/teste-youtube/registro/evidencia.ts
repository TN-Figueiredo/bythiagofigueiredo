import { normalizarTitulo } from '../normalizar-titulo'
import type { EscritaConhecida } from '../tipos'
import type { RodadaTitulo } from '../rodadas'
import { EVIDENCIA_TETO, JANELA_PROPAGACAO_MS } from './constantes'
import type { EvidenciaRodada, MedidaPropagacao } from './tipos'

/** Instantes (ms, ordem crescente) das escritas de título; instante inválido fica de fora. */
function escritasDeTituloMs(escritas: readonly EscritaConhecida[]): number[] {
  const out: number[] = []
  for (const e of escritas) {
    if (e.campo !== 'titulo') continue
    const ms = Date.parse(e.em)
    if (!Number.isNaN(ms)) out.push(ms)
  }
  return out.sort((a, b) => a - b)
}

/** Maior instante <= `ms` (busca binária sobre lista ordenada), ou null. */
function anteriorOuIgual(ordenado: readonly number[], ms: number): number | null {
  let lo = 0
  let hi = ordenado.length - 1
  let achado: number | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (ordenado[mid]! <= ms) { achado = ordenado[mid]!; lo = mid + 1 } else hi = mid - 1
  }
  return achado
}

/** Uma entrada por rodada com `de >= desdeMs`; votos pelo índice da variante ("x" = texto fora das variantes). */
export function evidenciaPorRodada(
  rodadas: readonly RodadaTitulo[],
  variantes: readonly string[],
  escritas: readonly EscritaConhecida[],
  desdeMs: number,
): EvidenciaRodada[] {
  const indice = new Map<string, number>()
  variantes.forEach((v, i) => { if (!indice.has(normalizarTitulo(v))) indice.set(normalizarTitulo(v), i) })
  const esc = escritasDeTituloMs(escritas)
  const out: EvidenciaRodada[] = []
  for (const r of rodadas) {
    const deMs = Date.parse(r.de)
    if (deMs < desdeMs) continue
    const porIndice = new Map<number, number>()
    let fora = 0
    for (const [texto, n] of Object.entries(r.votos)) {
      const i = indice.get(texto)
      if (i === undefined) fora += n
      else porIndice.set(i, (porIndice.get(i) ?? 0) + n)
    }
    const votos: Record<string, number> = {}
    for (const i of [...porIndice.keys()].sort((a, b) => a - b)) votos[String(i)] = porIndice.get(i)!
    if (fora > 0) votos['x'] = fora
    const ant = anteriorOuIgual(esc, deMs)
    const delta = ant === null ? null : deMs - ant
    out.push({ rodada: r.chave, de: r.de, ate: r.ate, votos, mista: r.mista, ms_desde_escrita: delta !== null && delta <= JANELA_PROPAGACAO_MS ? delta : null })
  }
  return out
}

/** União por `rodada` (a nova vence), ordem por `de`, corta para as `EVIDENCIA_TETO` mais recentes. */
export function juntarEvidencia(
  antiga: readonly EvidenciaRodada[],
  nova: readonly EvidenciaRodada[],
): { evidencia: EvidenciaRodada[]; cortada: boolean } {
  const mapa = new Map<string, EvidenciaRodada>()
  for (const e of antiga) mapa.set(e.rodada, e)
  for (const e of nova) mapa.set(e.rodada, e)
  const todas = [...mapa.values()].sort((a, b) => Date.parse(a.de) - Date.parse(b.de) || (a.rodada < b.rodada ? -1 : a.rodada > b.rodada ? 1 : 0))
  if (todas.length <= EVIDENCIA_TETO) return { evidencia: todas, cortada: false }
  return { evidencia: todas.slice(todas.length - EVIDENCIA_TETO), cortada: true }
}

/**
 * Medida da propagação (§6.3 peça 4) sobre as rodadas de 48 h. Considera as `misturada` (inclui as em quarentena).
 * `minDesdeEscrita`: minutos (para baixo) de cada uma até a escrita de título anterior mais próxima, só as a <= 6 h,
 * ordenados; `null` sem nenhuma escrita de título. `mistas48ForaQuarentena`: dessas, as que começaram depois da quarentena.
 */
export function medidaPropagacao(rodadas48: readonly RodadaTitulo[], escritas: readonly EscritaConhecida[], quarentenaMs: number): MedidaPropagacao {
  const esc = escritasDeTituloMs(escritas)
  if (esc.length === 0) return { mistas48ForaQuarentena: 0, minDesdeEscrita: null }
  const minutos: number[] = []
  let fora = 0
  for (const r of rodadas48) {
    if (!r.misturada) continue
    const deMs = Date.parse(r.de)
    const ant = anteriorOuIgual(esc, deMs)
    if (ant === null) continue
    const delta = deMs - ant
    if (delta > JANELA_PROPAGACAO_MS) continue
    minutos.push(Math.floor(delta / 60_000))
    if (delta > quarentenaMs) fora++
  }
  return { mistas48ForaQuarentena: fora, minDesdeEscrita: minutos.sort((a, b) => a - b) }
}
