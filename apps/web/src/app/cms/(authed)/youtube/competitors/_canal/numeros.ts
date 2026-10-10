/** Views por dia (spec 19.3): zero medido é "0"; abaixo de 10, uma casa; de 10 a 999, inteiro; milhar depois. */
export function vpdText(v: number | null, num: (n: number) => string): string | null {
  if (v == null || v < 0) return null
  if (v === 0) return '0'
  if (v < 0.05) return 'menos de 0,1'
  const r1 = Math.round(v * 10) / 10
  if (r1 < 10) return r1.toFixed(1).replace('.', ',')
  return v < 1000 ? String(Math.round(v)) : num(v)
}
