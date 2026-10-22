// Normalização de texto para o casamento de lugar (F2 T3): mesma função na semente e na extração.

const DOBRAS: ReadonlyArray<readonly [RegExp, string]> = [
  [/đ/g, 'd'],
  [/ł/g, 'l'],
  [/ø/g, 'o'],
  [/ı/g, 'i'],
  [/æ/g, 'ae'],
  [/œ/g, 'oe'],
  [/ß/g, 'ss'],
]

/** NFD sem marcas + dobras (đ ł ø ı æ œ ß), minúsculas, pontuação vira espaço, espaços colapsados. */
export function normalizarLugar(s: string): string {
  let t = s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  for (const [re, por] of DOBRAS) t = t.replace(re, por)
  return t.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
