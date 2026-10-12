/**
 * Formato da lista de Canais (spec 15.3): "Todos | Longos | Shorts". Puro.
 * Na URL o valor é sempre escrito (`?fmt=todos|longos|shorts`); os links antigos (`short`, `long`) continuam abrindo.
 */
export type CanaisFmt = 'todos' | 'longos' | 'shorts'
export const FMT_PADRAO: CanaisFmt = 'longos'
/** Chave de `localStorage` que lembra o formato quando a URL não o traz. */
export const FMT_LEMBRADO = 'obs:canais-fmt'

/** 'short' → 'shorts' e 'long' → 'longos' (links antigos); ausente, vazio ou lixo → null (quem chama aplica o padrão). */
export function parseCanaisFmt(raw: string | undefined): CanaisFmt | null {
  switch (raw) {
    case 'todos': return 'todos'
    case 'longos': case 'long': return 'longos'
    case 'shorts': case 'short': return 'shorts'
    default: return null
  }
}

/** O formato que ordena e posiciona: Shorts só no filtro Shorts; "Todos" ordena pelos longos. */
export function fmtDaOrdem(f: CanaisFmt): 'long' | 'short' {
  return f === 'shorts' ? 'short' : 'long'
}

/** A frase que o status anuncia quando a pessoa troca o formato (spec 15.3: "a mudança é anunciada"). */
export function anuncioFmt(f: CanaisFmt): string {
  switch (f) {
    case 'todos': return 'Formato: Todos, longos e Shorts lado a lado, ordem pelos longos.'
    case 'longos': return 'Formato: Longos.'
    case 'shorts': return 'Formato: Shorts.'
    default: { const nunca: never = f; return nunca }
  }
}
