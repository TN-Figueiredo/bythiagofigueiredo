// % assistido do canal próprio, calculado do diário por vídeo (yt_own_video_daily). Puro, sem banco.
// UNIDADE: pontos (0 em diante; passar de 100 é válido) (a Analytics API entrega 51,5 para 51,5%; a coleta grava o número como veio; o leitor só descarta negativo ou acima de 999,99; passar de 100 é válido).
// Regra de ouro: "não medido" nunca vira zero. Dia sem linha, sem view, sem percentual ou fora da janela não entra na conta;
// sem nenhum dia que entre, o resultado é null com o MOTIVO.
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DiarioCanal, DiaYt, Privado } from './tipos'

export const JANELA_ASSISTIDO_DIAS = 28
/** Abaixo disto (views na base) o valor sai com a contagem ao lado e sem comparar com o normal. */
export const POUCAS_VIEWS = 10
/** A faixa de duração só tem "normal" com 5 ou mais vídeos com views. */
export const MIN_VIDEOS_FAIXA = 5
/** Decisão do dono: até 2 pontos (inteiros, depois de arredondar) para cima ou para baixo é "na média". */
export const NA_MEDIA_PONTOS = 2

export type MotivoSemAssistido = 'sem-acesso' | 'leitura-falhou' | 'sem-diario' | 'sem-views'

export interface AssistidoVideo {
  /** pontos de 0 em diante (pode passar de 100: trechos revistos); null = sem número (veja `motivo`) */
  pct: number | null
  /** views da base: a soma das views dos dias que entraram na média */
  n: number
  /** n abaixo de POUCAS_VIEWS (com n = 0 não há valor, então não é "pouco") */
  pouco: boolean
  /** dias que entraram na média */
  dias: number
  janela: { de: DiaYt; ate: DiaYt } | null
  motivo: MotivoSemAssistido | null
}

const SEM_NUMERO = { pct: null, n: 0, pouco: false, dias: 0, janela: null } as const

/**
 * Média do percentual de cada dia, pesada pelas views do dia, nos 28 dias que terminam no último dia gravado do canal.
 * Entra o dia com views > 0 E percentual medido; dia de 0 views, de views nulas ou de percentual nulo fica de fora.
 */
export function assistidoDoVideo(d: Privado<DiarioCanal>, ytId: string): AssistidoVideo {
  if (d.acesso === 'negado') return { ...SEM_NUMERO, motivo: 'sem-acesso' }
  if (d.acesso === 'erro') return { ...SEM_NUMERO, motivo: 'leitura-falhou' }
  const { ultimoDia } = d.dado
  if (ultimoDia == null) return { ...SEM_NUMERO, motivo: 'sem-diario' }
  const de = addDays(ultimoDia, -(JANELA_ASSISTIDO_DIAS - 1))
  const janela = { de, ate: ultimoDia }
  let soma = 0
  let n = 0
  let dias = 0
  for (const l of d.dado.linhas) {
    if (l.ytId !== ytId || l.dia < de || l.dia > ultimoDia) continue
    if (l.views == null || l.views <= 0 || l.pctAssistido == null) continue
    soma += l.pctAssistido * l.views
    n += l.views
    dias++
  }
  if (n === 0) return { ...SEM_NUMERO, janela, motivo: 'sem-views' }
  return { pct: soma / n, n, pouco: n < POUCAS_VIEWS, dias, janela, motivo: null }
}

export type FaixaId = 'ate-5' | '5-a-15' | 'acima-15'

/** As três faixas de duração do mockup aprovado; `ate` em segundos, inclusive. */
export const FAIXAS: ReadonlyArray<{ id: FaixaId; rotulo: string; ate: number }> = [
  { id: 'ate-5', rotulo: 'Até 5 min', ate: 300 },
  { id: '5-a-15', rotulo: '5 a 15 min', ate: 900 },
  { id: 'acima-15', rotulo: 'Acima de 15 min', ate: Number.POSITIVE_INFINITY },
]

/** A faixa de uma duração em segundos; sem duração (nula, negativa, NaN) não há faixa. */
export function faixaDaDuracao(durSeg: number | null): FaixaId | null {
  if (durSeg == null || !Number.isFinite(durSeg) || durSeg < 0) return null
  return FAIXAS.find(f => durSeg <= f.ate)!.id
}

/** Mediana; vazio é null (par: média dos dois do meio). */
export function medianaDe(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 === 1 ? (o[m] as number) : ((o[m - 1] as number) + (o[m] as number)) / 2
}

export interface NormalDaFaixa {
  faixa: FaixaId
  /** vídeos da faixa (com duração conhecida) */
  videos: number
  /** os que têm % assistido (tiveram views na janela) */
  comViews: number
  /** mediana do % assistido da faixa; null com menos de MIN_VIDEOS_FAIXA vídeos com views */
  normal: number | null
}

/** O normal de cada faixa de duração (sempre as três, na ordem). Vídeo sem duração não entra em nenhuma; pct nulo não conta como "com views". */
export function normalDaFaixa(videos: ReadonlyArray<{ dur: number | null; pct: number | null }>): NormalDaFaixa[] {
  return FAIXAS.map(f => {
    const dentro = videos.filter(v => faixaDaDuracao(v.dur) === f.id)
    const pcts = dentro.map(v => v.pct).filter((p): p is number => p != null)
    return { faixa: f.id, videos: dentro.length, comViews: pcts.length, normal: pcts.length >= MIN_VIDEOS_FAIXA ? medianaDe(pcts) : null }
  })
}

export interface NormalDoCanal {
  /** vídeos com % assistido (tiveram views na janela) */
  comViews: number
  /** mediana do % assistido; null com menos de MIN_VIDEOS_FAIXA vídeos com views */
  normal: number | null
}

/**
 * O normal do CANAL (tela do vídeo): a mediana do % assistido dos vídeos que o chamador passar (os OUTROS vídeos do canal, sem o próprio), sem faixa de
 * duração. Mesmo mínimo de `normalDaFaixa` (MIN_VIDEOS_FAIXA). % nulo (sem views) não conta como vídeo com views nem como zero.
 */
export function normalDoCanal(pcts: ReadonlyArray<number | null>): NormalDoCanal {
  const com = pcts.filter((p): p is number => p != null)
  return { comViews: com.length, normal: com.length >= MIN_VIDEOS_FAIXA ? medianaDe(com) : null }
}

export type LeituraContraNormal = 'acima' | 'na-media' | 'abaixo'

/**
 * UMA função só para a aba Retenção, a seção do vídeo e a régua. A diferença é arredondada em pontos INTEIROS (meio ponto vai
 * para longe do zero) e só depois comparada: |dif| <= 2 = na média (então a zona vai até 2,49 pontos: o dono aprovou "até 2" vendo números inteiros); >= 3 = acima/abaixo. Sem % ou sem normal: null.
 */
export function contraNormal(pct: number | null, normal: number | null): { dif: number; leitura: LeituraContraNormal } | null {
  if (pct == null || normal == null) return null
  const bruta = pct - normal
  const abs = Math.round(Math.round(Math.abs(bruta) * 1e9) / 1e9)
  const dif = abs === 0 ? 0 : bruta < 0 ? -abs : abs
  return { dif, leitura: abs <= NA_MEDIA_PONTOS ? 'na-media' : dif > 0 ? 'acima' : 'abaixo' }
}
