/**
 * A5 F0.5a: o gêmeo numérico de um número que o modelo da tela escreve como texto (o `x` do pacote da IA). Ruído de ponto flutuante fora
 * (`12.300000000000001` vira `12.3`); ausente ou não finito vira `null`, nunca `0`. Módulo puro: a tela e o gerador (lib/) dividem a mesma normalização.
 */
export const gemeo = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(12)))
