/** Constantes nomeadas do registro do teste nativo (S7 fase 1). A soma de frescor vive em frescor.ts (depende da S4). */
export const PERIODO_DISPARO_MS = 20 * 60_000
export const DISPAROS_DE_ATRASO = 2
export const MARGEM_FRESCOR_MS = 40 * 60_000
export const JANELA_V14_MS = 14 * 86_400_000
export const JANELA_V48_MS = 48 * 3_600_000
export const RETENCAO_S4_MS = 30 * 86_400_000
export const JANELA_REPRODUCAO_MS = RETENCAO_S4_MS + JANELA_V14_MS
export const INTERVALO_SEM_RODADA_MS = 6 * 3_600_000
export const RETENTATIVA_ERRO_MS = 55 * 60_000
export const JANELA_PROPAGACAO_MS = 6 * 3_600_000
export const EVIDENCIA_TETO = 1000
export const RETENCAO_PEDIDA_MS = 365 * 86_400_000
export const PODA_AVALIACOES_MS = 180 * 86_400_000
export const NOVO_TESTE_APOS_MS = 7 * 86_400_000
