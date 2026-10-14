// % assistido por período (plano E5b, Tarefa 14). Puro, sem banco e sem relógio: o último dia entra por parâmetro.
// Regra de ouro: "não medido" nunca vira zero; abaixo do corte de views o resultado é "sem número" COM o motivo.
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { contraNormal, faixaDaDuracao, FAIXAS, medianaDe, MIN_VIDEOS_FAIXA, type FaixaId, type LeituraContraNormal } from './assistido'
import type { DiarioLinha, DiaYt } from './tipos'

/** Abaixo disto (views somadas entre os vídeos que entraram) o período não tem número. */
export const MIN_VIEWS_PERIODO = 1000

export type PeriodoAssistido = 'inteiro' | '90' | '28'
export type MotivoSemPeriodo = 'poucas-views' | 'cobertura-parcial' | 'sem-diario' | 'sem-acesso' | 'leitura-falhou'

export interface NormalDoPeriodo {
  periodo: PeriodoAssistido
  /** o primeiro e o último dia da janela (no inteiro, o primeiro e o último dia que entraram); nulos sem leitura */
  de: DiaYt | null
  ate: DiaYt | null
  pct: number | null
  /** o número que a tela escreve; a comparação é feita sobre ele */
  pctArredondado: number | null
  /** soma das views do período entre os vídeos que entraram */
  views: number
  /** vídeos que entraram (tiveram view e percentual medido no período) */
  videos: number
  motivo: MotivoSemPeriodo | null
}

const DIAS_DO_PERIODO: Record<'28' | '90', number> = { '28': 28, '90': 90 }

/** Período sem leitura (negado ou erro de banco): nenhum número, só o motivo. */
export function normalSemLeitura(periodo: PeriodoAssistido, motivo: 'sem-acesso' | 'leitura-falhou' | 'sem-diario'): NormalDoPeriodo {
  return { periodo, de: null, ate: null, pct: null, pctArredondado: null, views: 0, videos: 0, motivo }
}

const entra = (l: DiarioLinha): boolean => l.views != null && l.views > 0 && l.pctAssistido != null

/** Média diária pesada pelas views, como `assistidoDoVideo`, no intervalo dado (nulo = sem limite). Sem nenhum dia que entre: pct nulo, nunca 0. */
export function pctDoVideoNoPeriodo(linhas: readonly DiarioLinha[], ytId: string, de: DiaYt | null, ate: DiaYt | null): { pct: number | null; views: number } {
  let soma = 0
  let n = 0
  for (const l of linhas) {
    if (l.ytId !== ytId || (de != null && l.dia < de) || (ate != null && l.dia > ate) || !entra(l)) continue
    soma += (l.pctAssistido as number) * (l.views as number)
    n += l.views as number
  }
  return n === 0 ? { pct: null, views: 0 } : { pct: soma / n, views: n }
}

function janelaDe(periodo: PeriodoAssistido, ultimoDia: DiaYt): { de: DiaYt | null; ate: DiaYt } {
  return periodo === 'inteiro' ? { de: null, ate: ultimoDia } : { de: addDays(ultimoDia, -(DIAS_DO_PERIODO[periodo] - 1)), ate: ultimoDia }
}

function calcular(
  linhas: readonly DiarioLinha[], ytIds: readonly string[], periodo: PeriodoAssistido, ultimoDia: DiaYt | null, comBuraco: number | null, minVideos: number,
): NormalDoPeriodo {
  if (ultimoDia == null || linhas.length === 0) return normalSemLeitura(periodo, 'sem-diario')
  const { de, ate } = janelaDe(periodo, ultimoDia)
  const pcts: number[] = []
  let views = 0
  let primeiro: DiaYt | null = null
  let ultimo: DiaYt | null = null
  const conjunto = new Set(ytIds)
  for (const id of conjunto) {
    const r = pctDoVideoNoPeriodo(linhas, id, de, ate)
    if (r.pct == null) continue
    pcts.push(r.pct)
    views += r.views
  }
  for (const l of linhas) {
    if (!conjunto.has(l.ytId) || (de != null && l.dia < de) || l.dia > ate || !entra(l)) continue
    if (primeiro == null || l.dia < primeiro) primeiro = l.dia
    if (ultimo == null || l.dia > ultimo) ultimo = l.dia
  }
  const janela = periodo === 'inteiro' ? { de: primeiro, ate: ultimo } : { de, ate }
  const base = { periodo, de: janela.de, ate: janela.ate, views, videos: pcts.length }
  if (views < MIN_VIEWS_PERIODO) {
    // "poucas views" só se afirma com a cobertura inteira: a soma pode estar baixa por falta de coleta
    const motivo = comBuraco === 0 ? 'poucas-views' : 'cobertura-parcial'
    return { ...base, pct: null, pctArredondado: null, motivo }
  }
  if (pcts.length < minVideos) return { ...base, pct: null, pctArredondado: null, motivo: null }
  const pct = medianaDe(pcts)
  return { ...base, pct, pctArredondado: pct == null ? null : Math.round(pct), motivo: null }
}

/**
 * O normal de um período: a MEDIANA por vídeo do % assistido (cada vídeo pela média diária pesada pelas views), entre os vídeos que
 * tiveram view no período. `comBuraco`: vídeos com dia sem cobertura base no período, ou null quando a cobertura não é conhecida.
 */
export function normalDoPeriodo(
  linhas: readonly DiarioLinha[], ytIds: readonly string[], periodo: PeriodoAssistido, ultimoDia: DiaYt | null, comBuraco: number | null,
): NormalDoPeriodo {
  return calcular(linhas, ytIds, periodo, ultimoDia, comBuraco, 1)
}

/**
 * O normal de cada faixa de duração no período (sempre as três, na ordem). Mesma regra das views e da cobertura. Faixa com menos de
 * MIN_VIDEOS_FAIXA vídeos que entraram: sem número e sem motivo (quem lê vê `videos`). Vídeo sem duração não entra em nenhuma faixa.
 */
export function normalDaFaixaNoPeriodo(
  linhas: readonly DiarioLinha[], videos: ReadonlyArray<{ ytId: string; dur: number | null }>, periodo: PeriodoAssistido, ultimoDia: DiaYt | null, comBuraco: number | null,
): Array<{ faixa: FaixaId; normal: NormalDoPeriodo }> {
  return FAIXAS.map(f => ({
    faixa: f.id,
    normal: calcular(linhas, videos.filter(v => faixaDaDuracao(v.dur) === f.id).map(v => v.ytId), periodo, ultimoDia, comBuraco, MIN_VIDEOS_FAIXA),
  }))
}

/** A diferença do período contra o canal inteiro, sobre os arredondados; na média = até 2 pontos. Sem número de um dos lados: nulo. */
export function contraInteiro(periodo: NormalDoPeriodo, inteiro: NormalDoPeriodo): { dif: number; leitura: LeituraContraNormal } | null {
  return contraNormal(periodo.pctArredondado, inteiro.pctArredondado)
}
