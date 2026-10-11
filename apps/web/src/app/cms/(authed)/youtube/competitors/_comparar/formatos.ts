/**
 * Formatos do par da comparação (os de `comparar.js`: `fx`, `quanto`, `haDias`, `juntar`). Puro e sem dependência: roda no
 * navegador. Vírgula decimal, "×", "+N%", "há N dias". Nunca recebe zero nem valor não finito: quem chama checa antes
 * (a razão com zero não existe, ver `par-model.ts`).
 */

/** Tolerância contra o erro de ponto flutuante nas bordas exatas (110÷100 e 3,3÷3 têm de dar "exatamente 10%"). */
export const TOL = 1e-9

/** Número com `casas` casas decimais e vírgula (sem separador de milhar: aqui só entram razões e contagens pequenas). */
export function dec(n: number, casas: number): string {
  return n.toFixed(casas).replace('.', ',')
}

/** "5,0×", "2,0×", "12×": uma casa decimal até 10, nenhuma a partir de 10 (o valor já arredondado decide, "9,96" vira "10×"). */
export function fx(q: number): string {
  return `${dec(q, Number(q.toFixed(1)) >= 10 ? 0 : 1)}×`
}

/** A razão maior÷menor (sempre >= 1) em palavras curtas: "×" a partir de 2×, abaixo disso "+N%" sobre o menor. */
export function quanto(q: number): string {
  return q >= 2 - TOL ? fx(q) : `+${dec(Math.round((q - 1) * 100), 0)}%`
}

/** "hoje" | "há 1 dia" | "há 5 dias". */
export function haDias(n: number): string {
  return n === 0 ? 'hoje' : `há ${n} ${n === 1 ? 'dia' : 'dias'}`
}

/** "a", "a e b", "a, b e c". */
export function juntar(xs: readonly string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

/** "14º". */
export const ordinal = (n: number): string => `${n}º`

/** "1 número" | "3 números". */
export const numeros = (n: number): string => `${n} ${n === 1 ? 'número' : 'números'}`

/** Primeira letra minúscula ("Longos + Shorts por semana" → "longos + Shorts por semana"), para o nome de uma linha no meio de uma frase. */
export const minuscula = (t: string): string => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t)
