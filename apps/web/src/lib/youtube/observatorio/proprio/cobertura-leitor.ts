// A5 · E6 · Tarefa 5: o leitor tolera os dois estados do diário do canal próprio.
// Antes da dieta o diário tinha uma linha por (vídeo, dia), com `views: 0` nos dias sem atividade. Depois dela só há linha nos dias com
// atividade, e quem diz "este dia foi coletado" é a cobertura (`yt_own_video_coverage`, conjunto `base`). Dia sem linha DENTRO de um
// intervalo coberto = zero medido; FORA de todo intervalo = não medido. Aqui o zero apagado é devolvido à forma de sempre, para que
// nenhum modelo de tela precise saber que a dieta existe. Puro: sem banco, sem relógio, sem `server-only`.
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DiarioLinha, DiaYt } from './tipos'

/** Um intervalo de dias coletados de um vídeo (inclusive nas duas pontas), como a cobertura o guarda. */
export interface IntervaloCoberto { ytId: string; de: DiaYt; ate: DiaYt }

/** Teto de sanidade: 50 vídeos (`TETO_VIDEOS_DIARIO`) x 60 dias de zeros devolvidos. Passou disso, a conta está errada e o leitor falha. */
export const TETO_ZEROS_MATERIALIZADOS = 50 * 60

/**
 * Devolve as linhas recebidas MAIS uma `{ ytId, dia, views: 0, pctAssistido: null, duracaoMediaSeg: null }` para cada dia de cada
 * intervalo, dentro da janela, que não tenha linha daquele vídeo. Linha existente nunca é trocada (coluna nula numa linha continua
 * "não medido"). Ordem: por dia, depois por vídeo. Sem nada a acrescentar devolve as mesmas linhas, na mesma ordem.
 */
export function materializarZeros(
  linhas: readonly DiarioLinha[],
  intervalos: ReadonlyArray<IntervaloCoberto>,
  janela: { desde: DiaYt; ate: DiaYt },
): DiarioLinha[] {
  const existentes = new Set<string>()
  for (const l of linhas) existentes.add(l.ytId + '|' + l.dia)
  const novas: DiarioLinha[] = []
  for (const iv of intervalos) {
    const de = iv.de > janela.desde ? iv.de : janela.desde
    const ate = iv.ate < janela.ate ? iv.ate : janela.ate
    for (let dia = de; dia <= ate; dia = addDays(dia, 1)) {
      const chave = iv.ytId + '|' + dia
      if (existentes.has(chave)) continue
      existentes.add(chave)
      novas.push({ ytId: iv.ytId, dia, views: 0, pctAssistido: null, duracaoMediaSeg: null })
      if (novas.length > TETO_ZEROS_MATERIALIZADOS) {
        throw new Error(`cobertura: mais de ${TETO_ZEROS_MATERIALIZADOS} dias sem linha dentro da janela (teto de sanidade)`)
      }
    }
  }
  if (novas.length === 0) return [...linhas]
  return [...linhas, ...novas].sort((a, b) => (a.dia === b.dia ? (a.ytId < b.ytId ? -1 : a.ytId > b.ytId ? 1 : 0) : a.dia < b.dia ? -1 : 1))
}
