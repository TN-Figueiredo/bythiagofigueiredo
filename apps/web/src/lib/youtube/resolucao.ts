// Regra única do "original em alta": largura mínima de 1280 px (o plano do M1 reaproveita este arquivo).
export const LARGURA_MINIMA_ORIGINAL = 1280

export type NivelResolucao = 'ok' | 'baixa' | 'nao_medida'

/** `null` = não medida (nunca "baixa" nem "ok" por palpite). */
export function nivelDeResolucao(m: { largura: number; altura: number } | null): NivelResolucao {
  if (!m) return 'nao_medida'
  return m.largura >= LARGURA_MINIMA_ORIGINAL ? 'ok' : 'baixa'
}
