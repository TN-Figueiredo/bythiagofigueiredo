// Observatório A5 (E1): o que se guarda de cada resposta do YouTube além das contagens.
// Puro até a seção "gravação": nada aqui lê relógio nem rede.
import crypto from 'crypto'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = Record<string, unknown>
export const obj = (x: unknown): Obj | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Obj) : undefined)
export const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null)

/** A counter the API may omit (hidden likes/subscribers): null when absent or not numeric, never 0. */
export function optCount(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

/** JSON com as chaves em ordem alfabética em todos os níveis; a ordem das listas é a que veio (reordenar tags É mudança). */
export function canonicalJson(v: Json): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(v[k] as Json)).join(',') + '}'
}
export const sha256Hex = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')
/** O hash de um valor de campo: 16 caracteres, como hashValue de competitor-versions.ts. */
export const fieldHash = (v: Json): string => sha256Hex(canonicalJson(v)).slice(0, 16)

/** Acima disto a resposta de um item não é guardada (e a execução acusa): a maior descrição real tem 5 kB. */
export const RAW_MAX_BYTES = 100_000
export interface RawCapture { sha: string; raw: Json; bytes: number }
/** A resposta como veio, sem o que muda a cada leitura: statistics, etag e concurrentViewers. */
export function rawOf(item: unknown): RawCapture {
  const src = obj(item) ?? {}
  const out: Obj = {}
  for (const k of Object.keys(src)) {
    if (k === 'statistics' || k === 'etag') continue
    if (k === 'liveStreamingDetails') {
      const live = { ...(obj(src[k]) ?? {}) }
      delete live.concurrentViewers
      out[k] = live
      continue
    }
    out[k] = src[k]
  }
  const text = canonicalJson(out as Json)
  return { sha: sha256Hex(text), raw: JSON.parse(text) as Json, bytes: Buffer.byteLength(text) }
}
