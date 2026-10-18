import { DHASH_MAX_SAME, hamming } from '../thumb-hamming'

export type LeituraEstado = 'bate' | 'nenhuma_bate' | 'sem_referencia' | 'ambigua' | 'falhou'

export interface Classificacao {
  leitura_estado: Exclude<LeituraEstado, 'falhou'>
  variante_vista: string | null
  variantes_sem_referencia: number
}

/**
 * Compara só as variantes COM referência. Exatamente uma a distância <= DHASH_MAX_SAME é `bate`, mesmo que outra
 * variante não tenha referência (o número delas vai em `variantes_sem_referencia`); duas ou mais, `ambigua`.
 * Nenhuma e alguma sem referência: `sem_referencia` (não dá para dizer "nenhuma").
 */
export function classificarLeitura(dhashLido: string, referencias: Array<{ variant_id: string; dhash: string | null }>): Classificacao {
  let semReferencia = 0
  const iguais: string[] = []
  for (const r of referencias) {
    if (r.dhash === null) { semReferencia++; continue }
    if (hamming(dhashLido, r.dhash) <= DHASH_MAX_SAME) iguais.push(r.variant_id)
  }
  if (iguais.length === 1) return { leitura_estado: 'bate', variante_vista: iguais[0]!, variantes_sem_referencia: semReferencia }
  if (iguais.length > 1) return { leitura_estado: 'ambigua', variante_vista: null, variantes_sem_referencia: semReferencia }
  return { leitura_estado: semReferencia > 0 ? 'sem_referencia' : 'nenhuma_bate', variante_vista: null, variantes_sem_referencia: semReferencia }
}

const FALHA_DO_SHARP = /unsupported image format|input buffer|input file|vips|corrupt|premature end|bad seek|invalid (jpeg|image)/i

/** `timeout`, `http_<n>`, `imagem_invalida` (falha do sharp) ou `rede` (qualquer outro rejeite). */
export function erroDaSonda(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as { name?: unknown; message?: unknown; status?: unknown }
    if (o.name === 'TimeoutError' || o.name === 'AbortError') return 'timeout'
    if (typeof o.status === 'number' && Number.isFinite(o.status)) return `http_${o.status}`
    if (typeof o.message === 'string' && FALHA_DO_SHARP.test(o.message)) return 'imagem_invalida'
  }
  return 'rede'
}

const tirarAspas = (v: string) => v.replace(/^W\//, '').replace(/^"|"$/g, '')

/** Mesma regra de `usableEtag` (thumb-fingerprint.ts): tira `W/` e aspas; "0" não informa nada. */
export function etagUtil(raw: string | null): string | null {
  if (raw === null) return null
  const v = tirarAspas(raw)
  return v === '0' ? null : v
}

/** Mesma regra de `uploadInstant` (não exportada, arquivo da A5): ETag numérico = epoch em segundos. ISO ou nulo. */
export function enviadaEmDoEtag(etag: string | null): string | null {
  if (etag === null) return null
  const v = tirarAspas(etag)
  if (/^\d{9,11}$/.test(v) && Number(v) > 0) return new Date(Number(v) * 1000).toISOString()
  return null
}

/** Início da hora UTC, em ISO. */
export function horaDe(lidaEm: Date): string {
  const t = new Date(lidaEm.getTime())
  t.setUTCMinutes(0, 0, 0)
  return t.toISOString()
}
