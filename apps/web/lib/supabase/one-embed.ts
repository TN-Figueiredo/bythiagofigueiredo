/**
 * Normaliza um embed to-one do supabase-js.
 *
 * O supabase-js devolve OBJETO para uma FK to-one, mas o shape em runtime nao
 * e garantido pelo cast do TypeScript — so pela direcao da FK. Escrever
 * `(x as Array<T>)?.[0]` sobre um objeto produz undefined em silencio, que foi
 * exatamente o defeito que descartou 200 mudancas de competidor.
 */
export function oneEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}
