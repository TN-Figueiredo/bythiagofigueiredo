export const LARGURA_ALTA = 1280

/** Baixa = largura ausente, 0, não numérica ou < 1280 (D1). */
export function publicaBaixa(largura: number | null | undefined): boolean {
  return !Number.isFinite(largura) || (largura as number) < LARGURA_ALTA
}

/** `dimensions` é TEXT "LxA"; nulo, 0 ou ilegível devolve null. */
export function dimensoesDeTexto(d: string | null | undefined): { largura: number; altura: number } | null {
  const m = /^(\d+)x(\d+)$/.exec(d ?? '')
  if (!m) return null
  const largura = Number(m[1]); const altura = Number(m[2])
  return largura > 0 && altura > 0 ? { largura, altura } : null
}
