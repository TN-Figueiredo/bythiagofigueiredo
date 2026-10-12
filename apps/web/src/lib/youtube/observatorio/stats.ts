/** Só o que é número de verdade entra na conta: NaN e infinito não ordenam e escreveriam "NaN%" na tela. */
const finitos = (a: readonly number[]): number[] => a.filter(Number.isFinite)

/** Port of dados.js:109-110. Valores não finitos são ignorados; sem nenhum finito, null. */
export function median(a: number[]): number | null {
  const f = finitos(a)
  if (!f.length) return null
  const s = f.sort((x, y) => x - y), m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
export function quant(a: number[], q: number): number | null {
  const f = finitos(a)
  if (!f.length) return null
  const s = f.sort((x, y) => x - y), p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p)
  return s[lo]! + (s[hi]! - s[lo]!) * (p - lo)
}
