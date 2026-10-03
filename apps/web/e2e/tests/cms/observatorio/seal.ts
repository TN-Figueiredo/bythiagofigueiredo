/**
 * R57: the forja reading seal is typed on purpose ("forja · <modelo> · <tipo>, <janela> · DD/MM HH:MM (SP)"); the
 * Mudanças, Outliers and Histórico mockups still print the raw "forja · Gemma 12B · gerada DD/MM HH:MM (SP)". Only that
 * seal line is masked, on both sides; the status lines get no allowance at all.
 */
export const SEAL_R57 = [/forja · Gemma 12B · (?:gerada |(?:trocas|fórmulas(?: dos Shorts)?|temas|vídeo)(?:, (?:\d+ dias|\d+ meses))? · )\d\d\/\d\d \d\d:\d\d \(SP\)/]
