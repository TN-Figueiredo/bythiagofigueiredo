// Taxa de clique com intervalo de Wilson (95%) e o veredito contra a taxa do canal. Puro, sem banco.
// Regra de ouro: sem impressão não há taxa (null, nunca NaN nem 0%). Zero clique COM impressões é zero medido (taxa 0, com intervalo).
// Todas as taxas e limites são FRAÇÕES de 0 a 1 (0,048 = 4,8%); quem escreve a tela multiplica por 100.

/** z do intervalo de 95%. */
export const Z_95 = 1.96
/** Folga entre as faixas (vídeo e canal) abaixo da qual "as duas faixas quase se tocam": 0,4 ponto percentual, estrito. */
export const FOLGA_QUASE_SE_TOCAM = 0.004
/** Com referência: a faixa do vídeo é inconclusiva se for mais larga que 3x a do canal (estrito). */
export const FATOR_LARGURA_INCONCLUSIVA = 3
/** Sem referência: inconclusiva se a faixa for mais larga que 15 pontos (estrito). */
export const LARGURA_SEM_REFERENCIA = 0.15
/** No canal: faixa mais larga que 5 pontos acrescenta "Ainda não dá para dizer se é alta ou baixa." (estrito). */
export const LARGURA_CANAL_LARGO = 0.05

export interface IntervaloTaxa { lo: number; hi: number }

export interface TaxaComIntervalo {
  /** cliques estimados (impressões x taxa de cada dia, somados): pode ser fracionário */
  cliques: number
  imp: number
  taxa: number
  lo: number
  hi: number
  largura: number
}

export type Direcao = 'acima' | 'abaixo' | 'igual'

export interface Veredito {
  /** null = sem taxa do canal para comparar */
  direcao: Direcao | null
  quaseSeTocam: boolean
  inconclusivo: boolean
}

/** Compara decimais sem o ruído de ponto flutuante (0,056 - 0,052 não é exatamente 0,004): tudo em bilionésimos. */
const nano = (x: number): number => Math.round(x * 1e9)

/** Intervalo de Wilson de 95% para `k` sucessos em `n` tentativas. `n <= 0`, `k` fora de [0, n] ou não finito: null. */
export function wilson(k: number, n: number): IntervaloTaxa | null {
  if (!Number.isFinite(k) || !Number.isFinite(n) || n <= 0 || k < 0) return null
  // a soma de estimativas pode passar de n por um fio de ponto flutuante; mais que isso é dado impossível
  if (k > n + 1e-9 * Math.max(1, n)) return null
  const kk = Math.min(k, n)
  const p = kk / n
  const z2 = Z_95 * Z_95
  const denom = 1 + z2 / n
  const centro = p + z2 / (2 * n)
  const meia = Z_95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { lo: Math.max(0, (centro - meia) / denom), hi: Math.min(1, (centro + meia) / denom) }
}

/** Taxa de clique = cliques / impressões, com o intervalo. Sem impressão ou sem cliques (nulos): null. */
export function taxaComIntervalo(cliques: number | null, imp: number | null): TaxaComIntervalo | null {
  if (cliques == null || imp == null) return null
  const w = wilson(cliques, imp)
  if (w == null) return null
  const c = Math.min(cliques, imp)
  return { cliques: c, imp, taxa: c / imp, lo: w.lo, hi: w.hi, largura: w.hi - w.lo }
}

/**
 * O vídeo contra o canal. `acima`/`abaixo` só quando as faixas se SEPARAM (a do vídeo toda acima/abaixo da do canal; tocar não
 * é separar); senão `igual`. Sem taxa do canal (`canal` null) não há direção. `quaseSeTocam`: separadas por menos de 0,4 ponto.
 */
export function veredito(video: TaxaComIntervalo, canal: TaxaComIntervalo | null): Veredito {
  const larguraVideo = video.hi - video.lo
  if (canal == null) return { direcao: null, quaseSeTocam: false, inconclusivo: nano(larguraVideo) > nano(LARGURA_SEM_REFERENCIA) }
  const larguraCanal = canal.hi - canal.lo
  const inconclusivo = nano(larguraVideo) > nano(FATOR_LARGURA_INCONCLUSIVA * larguraCanal)
  if (nano(video.lo) > nano(canal.hi)) return { direcao: 'acima', quaseSeTocam: nano(video.lo - canal.hi) < nano(FOLGA_QUASE_SE_TOCAM), inconclusivo }
  if (nano(video.hi) < nano(canal.lo)) return { direcao: 'abaixo', quaseSeTocam: nano(canal.lo - video.hi) < nano(FOLGA_QUASE_SE_TOCAM), inconclusivo }
  return { direcao: 'igual', quaseSeTocam: false, inconclusivo }
}

/** A faixa do canal é larga demais para dizer "alta" ou "baixa" (mais de 5 pontos). */
export function canalLargo(t: TaxaComIntervalo): boolean {
  return nano(t.hi - t.lo) > nano(LARGURA_CANAL_LARGO)
}
