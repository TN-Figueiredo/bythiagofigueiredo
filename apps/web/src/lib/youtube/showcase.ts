/**
 * Regra de transição do site público (multi-canal, Task 4).
 *
 * Enquanto o redesenho que lista todos os canais não chega, o site mostra um
 * canal por idioma: o mais antigo. Nada é gravado no banco, a vitrine é
 * derivada a cada leitura. Não existe "canal principal" — é só a regra
 * provisória que impede a mistura de vídeos de canais diferentes.
 * Puro, sem I/O.
 */

export interface ChannelOrderRow {
  id: string
  locale: string
  created_at?: string | null
}

function time(v: string | null | undefined): number {
  if (!v) return Number.POSITIVE_INFINITY
  const t = Date.parse(v)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Ordem de cadastro: created_at crescente (ausente ou inválido por último), depois id. Não muta a entrada. */
export function byRegistration<T extends ChannelOrderRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = time(a.created_at)
    const tb = time(b.created_at)
    if (ta !== tb) return ta < tb ? -1 : 1
    return cmp(a.id, b.id)
  })
}

/** O primeiro canal de cada idioma na ordem de cadastro, devolvidos em ordem de locale (en antes de pt). */
export function showcaseChannels<T extends ChannelOrderRow>(rows: readonly T[]): T[] {
  const first = new Map<string, T>()
  for (const r of byRegistration(rows)) {
    if (!first.has(r.locale)) first.set(r.locale, r)
  }
  return [...first.values()].sort((a, b) => cmp(a.locale, b.locale))
}

/** Id do canal da vitrine de um idioma do banco ('pt' | 'en'); null quando o site não tem canal nesse idioma. */
export function showcaseChannelId(rows: readonly ChannelOrderRow[], dbLocale: string): string | null {
  return showcaseChannels(rows).find((r) => r.locale === dbLocale)?.id ?? null
}
