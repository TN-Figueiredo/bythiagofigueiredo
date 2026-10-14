import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-fingerprint'

export type Leitura = 'original' | 'teste' | 'outra' | 'sem_dado'
export interface Sonda { em: number; dhash: string | null; etag: string | null; leitura: Leitura; dOriginal: number | null; dTeste: number | null }

/** Pelo dHash, nunca pela URL (spec 3.4). */
export function classificar(dhash: string | null, ref: { original: string; teste: string }): Pick<Sonda, 'leitura' | 'dOriginal' | 'dTeste'> {
  if (!dhash) return { leitura: 'sem_dado', dOriginal: null, dTeste: null }
  const dOriginal = hamming(dhash, ref.original)
  const dTeste = hamming(dhash, ref.teste)
  if (dTeste <= DHASH_MAX_SAME && dTeste < dOriginal) return { leitura: 'teste', dOriginal, dTeste }
  if (dOriginal <= DHASH_MAX_SAME && dOriginal < dTeste) return { leitura: 'original', dOriginal, dTeste }
  return { leitura: 'outra', dOriginal, dTeste }
}

/** Índice da primeira de `n` leituras seguidas iguais a `alvo`; null se ainda não houve. */
export function primeiraEstavel(sondas: readonly Pick<Sonda, 'leitura'>[], alvo: Leitura, n: number): number | null {
  let seguidas = 0
  for (let i = 0; i < sondas.length; i++) {
    seguidas = sondas[i]!.leitura === alvo ? seguidas + 1 : 0
    if (seguidas === n) return i - n + 1
  }
  return null
}

/** Quantos vãos entre sondas passaram do dobro do intervalo (Mac dormindo, rede parada). */
export function lacunas(instantes: readonly number[], intervaloMs: number): number {
  let n = 0
  for (let i = 1; i < instantes.length; i++) if (instantes[i]! - instantes[i - 1]! > 2 * intervaloMs) n++
  return n
}

export const horas = (ms: number): number => Math.round(ms / 36_000) / 100
