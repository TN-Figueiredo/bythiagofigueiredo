// Parte pura do fingerprint de miniatura (sem sharp nem blob), para o motor do Observatório poder usá-la no cliente.
// Spike S1 (docs/superpowers/plans/2026-10-02-observatorio-spikes.md): 0 false flips in 13 min
// with DHASH_MAX_SAME = 6; the smallest real rotation distance observed was 10.
export const DHASH_MAX_SAME = 6

export function hamming(a: string, b: string): number {
  const len = Math.max(a.length, b.length)
  const pa = a.padStart(len, '0'), pb = b.padStart(len, '0')
  let n = 0
  for (let i = 0; i < len; i++) {
    let x = parseInt(pa[i]!, 16) ^ parseInt(pb[i]!, 16)
    while (x) { n += x & 1; x >>= 1 }
  }
  return n
}


const DHASH_RE = /^[0-9a-f]{16}$/i

/**
 * Mesma imagem? Igualdade exata, ou (quando as duas chaves são dHash de 16 hex) distância de Hamming <= DHASH_MAX_SAME:
 * o YouTube recomprime a miniatura ao iniciar um teste e o dHash muda 0-2 bits. Chave nula/ausente: só a igualdade exata.
 */
export function sameThumb(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false
  if (a === b) return true
  return DHASH_RE.test(a) && DHASH_RE.test(b) && hamming(a, b) <= DHASH_MAX_SAME
}

/**
 * Representante único de miniatura, com âncora: cada chave é comparada só com os REPRESENTANTES já abertos (na ordem de
 * chegada) e cai no primeiro que `sameThumb` reconhece; senão abre representante novo. Todo membro fica a no máximo
 * DHASH_MAX_SAME bits do seu representante, então elos não acumulam deriva: A'' a 10 bits de A (via A' a 5) é imagem
 * nova, porque o spike S1 mediu 10 bits como a menor distância entre imagens de fato diferentes. A recompressão do
 * YouTube (0-2 bits, repetida <= 4) continua caindo em A. Erro que sobra: um falso "não voltou", o lado seguro
 * (decisão de 18/10 entre Phil, que pediu a âncora, e Yannis, que aceitava a regra encadeada). Motor (changes.ts) e telas (letras, "N imagens") usam este mapa, para o selo
 * "Voltou à versão A" e a letra do cartão não se contradizerem.
 * Nota: sha256 truncado (dHash nulo) tem o formato de dHash; falso "mesma imagem" ~4,5e-12 por par, aceito.
 */
export function thumbRepresentatives(keys: readonly string[]): Map<string, string> {
  const rep = new Map<string, string>(), seen: string[] = []
  for (const k of keys) {
    if (rep.has(k)) continue
    const hit = seen.find(r => sameThumb(r, k))
    rep.set(k, hit ?? k)
    if (hit === undefined) seen.push(k)
  }
  return rep
}
