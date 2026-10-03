/** Port of dados.js:109-110. */
export function median(a: number[]): number | null {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
export function quant(a: number[], q: number): number | null {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p)
  return s[lo]! + (s[hi]! - s[lo]!) * (p - lo)
}
