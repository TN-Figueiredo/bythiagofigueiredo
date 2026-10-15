// A5 · E5b · Tarefa 9: as contas das leituras da origem em trechos de data e lotes de vídeos. Puro: sem banco, sem relógio, sem server-only.
// Os leitores aceitam no máximo JANELA_MAX_DIAS dias e TETO_VIDEOS_DIMENSOES vídeos por chamada; quem precisa de mais chama várias vezes
// (no máximo MAX_CHAMADAS por leitura, 2 em voo) e junta o resultado aqui, sem dia repetido nem dia faltando.
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { ConjuntoLido, VideoLido } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'

export const TRECHO_MAX_DIAS = 120
export const LOTE_MAX_VIDEOS = 50
/** Chamadas ao leitor por leitura (trechos x lotes): acima disto lança. */
export const MAX_CHAMADAS = 12
export const CHAMADAS_EM_VOO = 2

/** Divide [de, ate] em trechos consecutivos de até 120 dias, do mais antigo ao mais novo. `de > ate` lança RangeError. */
export function trechosDe(de: DiaYt, ate: DiaYt): Array<{ de: DiaYt; ate: DiaYt }> {
  if (de > ate) throw new RangeError('trechosDe: início depois do fim')
  const out: Array<{ de: DiaYt; ate: DiaYt }> = []
  for (let ini = de; ini <= ate; ini = addDays(ini, TRECHO_MAX_DIAS)) {
    const fim = addDays(ini, TRECHO_MAX_DIAS - 1)
    out.push({ de: ini, ate: fim < ate ? fim : ate })
  }
  return out
}

/** Vídeos sem repetição, em lotes de até 50. Lista vazia: um lote vazio (o leitor devolve os conjuntos sem vídeos e o estado vale assim mesmo). */
export function lotesDe(ytIds: readonly string[]): string[][] {
  const ids = [...new Set(ytIds)]
  if (ids.length === 0) return [[]]
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += LOTE_MAX_VIDEOS) out.push(ids.slice(i, i + LOTE_MAX_VIDEOS))
  return out
}

export interface Chamada { trecho: number; lote: number; de: DiaYt; ate: DiaYt; ytIds: string[] }

/** Todas as chamadas da leitura, na ordem (trecho, lote). Mais de MAX_CHAMADAS lança RangeError ANTES de chamar. */
export function chamadasDe(ytIds: readonly string[], de: DiaYt, ate: DiaYt): Chamada[] {
  const trechos = trechosDe(de, ate), lotes = lotesDe(ytIds)
  if (trechos.length * lotes.length > MAX_CHAMADAS) throw new RangeError(`leitura da origem: ${trechos.length * lotes.length} chamadas, o máximo é ${MAX_CHAMADAS}`)
  return trechos.flatMap((t, i) => lotes.map((l, j): Chamada => ({ trecho: i, lote: j, de: t.de, ate: t.ate, ytIds: l })))
}

/**
 * Junta o mesmo conjunto lido em vários trechos e lotes: um vídeo com os dias dos trechos em ordem; o estado é o do trecho mais recente
 * (o primeiro lote dele). `partes` vem com `trecho` e `lote` de cada chamada.
 */
export function juntarConjunto<L extends LinhaBasica>(partes: ReadonlyArray<{ trecho: number; lote: number; conjunto: ConjuntoLido<L> }>): ConjuntoLido<L> {
  const ordenadas = [...partes].sort((a, b) => a.trecho - b.trecho || a.lote - b.lote)
  const ultimoTrecho = ordenadas[ordenadas.length - 1]!.trecho
  const maisRecente = ordenadas.find(p => p.trecho === ultimoTrecho)!
  const porVideo = new Map<string, VideoLido<L>>()
  for (const p of ordenadas) {
    for (const v of p.conjunto.videos) {
      const j = porVideo.get(v.ytId)
      if (j) j.dias.push(...v.dias)
      else porVideo.set(v.ytId, { ytId: v.ytId, dias: [...v.dias] })
    }
  }
  return { conjunto: maisRecente.conjunto.conjunto, estado: maisRecente.conjunto.estado, videos: [...porVideo.values()] }
}

/** Junta os lotes de vídeos do mesmo diário (mesmo período): linhas, vídeos de fora, descartados e a cobertura somam. */
export function juntarDiarios(partes: readonly DiarioDoPeriodo[]): DiarioDoPeriodo {
  const primeira = partes[0]!
  const intervalos = new Map<string, DiarioDoPeriodo['cobertura']['intervalos'] extends ReadonlyMap<string, infer V> ? V : never>()
  const publicacoes = new Map<string, DiaYt | null>()
  let primeiroDiaLido: DiaYt | null = null
  for (const p of partes) {
    for (const [k, v] of p.cobertura.intervalos) intervalos.set(k, v)
    for (const [k, v] of p.cobertura.publicacoes) publicacoes.set(k, v)
    if (p.cobertura.primeiroDiaLido !== null && (primeiroDiaLido === null || p.cobertura.primeiroDiaLido < primeiroDiaLido)) primeiroDiaLido = p.cobertura.primeiroDiaLido
  }
  return {
    canalId: primeira.canalId, de: primeira.de, ate: primeira.ate,
    linhas: partes.flatMap(p => p.linhas), foraDoTeto: partes.flatMap(p => p.foraDoTeto), descartados: partes.reduce((s, p) => s + p.descartados, 0),
    cobertura: {
      conhecida: partes.every(p => p.cobertura.conhecida),
      videosCompletos: partes.reduce((s, p) => s + p.cobertura.videosCompletos, 0),
      videosIncompletos: partes.reduce((s, p) => s + p.cobertura.videosIncompletos, 0),
      primeiroDiaLido, intervalos, ytIds: partes.flatMap(p => p.cobertura.ytIds), publicacoes,
    },
  }
}
