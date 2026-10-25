/** Passos do assistente "Novo teste A/B", por nome (D-M6-2). */
export const PASSOS = ['tipo', 'variantes', 'revisar'] as const
export type Passo = (typeof PASSOS)[number]

export const ROTULO_DO_PASSO: Record<Passo, string> = {
  tipo: 'Tipo',
  variantes: 'Variantes',
  revisar: 'Revisar',
}

export function ehPasso(x: unknown): x is Passo {
  return typeof x === 'string' && (PASSOS as readonly string[]).includes(x)
}

export function indiceDoPasso(p: Passo): number {
  return PASSOS.indexOf(p)
}

export function proximoPasso(p: Passo): Passo {
  return PASSOS[Math.min(PASSOS.length - 1, indiceDoPasso(p) + 1)] ?? p
}

export function passoAnterior(p: Passo): Passo {
  return PASSOS[Math.max(0, indiceDoPasso(p) - 1)] ?? p
}
