import type { LeituraObs, ThumbObs } from '@/lib/youtube/teste-youtube/observados/inferir'

export const PUB = new Date('2026-10-01T00:00:00.000Z')
export const H = 3_600_000
/** Instante relativo à publicação, em horas. */
export const aposPub = (h: number): string => new Date(PUB.getTime() + h * H).toISOString()
export const agoraEm = (h: number): number => PUB.getTime() + h * H

export const DH_A = '0000000000000000'
export const DH_B = 'ffffffffffffffff' // distância 64 de A
export const DH_C = '00000000000000ff' // distância 8 de A (indeterminada)
export const DH_A2 = '0000000000000003' // distância 2 de A (mesma imagem)
export const DH_D = '0f0f0f0f0f0f0f0f'

let seq = 0
export function leitura(h: number, o: Partial<LeituraObs> = {}): LeituraObs {
  return {
    id: ++seq, rodadaId: `r${seq}`, lidaEm: aposPub(h), http: 200, erro: null, jogadorBloqueado: false, idioma: 'pt',
    tituloExibido: 'Titulo A', miniaturaId: null, ...o,
  }
}
export function thumb(id: number, dhash: string | null, o: Partial<ThumbObs> = {}): ThumbObs {
  return { id, variante: 'maxresdefault', http: 200, dhash, largura: 1280, altura: 720, ...o }
}
/** Sequência de leituras a cada 6 h a partir de `h0`, com o rótulo dado por posição. */
export function sequencia(h0: number, rotulos: readonly string[], f: (r: string, h: number) => Partial<LeituraObs>): LeituraObs[] {
  return rotulos.map((r, i) => leitura(h0 + i * 6, f(r, h0 + i * 6)))
}

/**
 * Rodadas de 3 passadas (5 min entre elas) a cada 6 h a partir de `h0`: cada item é uma rodada, uma letra por passada ('AAB' = A, A, B).
 * Cada rodada tem o seu `rodada_id`. `f` traduz a letra em campos da leitura.
 */
export function rodadas(h0: number, itens: readonly string[], f: (letra: string) => Partial<LeituraObs>): LeituraObs[] {
  return itens.flatMap((passadas, r) => [...passadas].map((letra, k) => leitura(h0 + r * 6 + k * (5 / 60), { rodadaId: `rod${h0}-${r}`, ...f(letra) })))
}
