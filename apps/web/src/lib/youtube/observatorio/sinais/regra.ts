// Parâmetros versionados dos sinais do nicho (F2 T5). Mudar um valor exige subir `versao`.
import { RULES } from '../rules'
import { LUGAR_REGRA_VERSAO } from '../lugar/casar'

export const REGRA_SINAIS = {
  versao: 1,
  janelaDias: 14,
  minOutliers: 2,
  minCanais: 2,
  /** PROVISÓRIO (fixo em 8 pela medida da T1): vídeos `tracked` com `vpd7` no formato (conjunto de `median7`). */
  nMinimo: 8,
  /** PROVISÓRIO: recalibrar 21/12, n ≥ 30 por formato. Reaproveita `rules.ts`, sem constante paralela. */
  multSozinho: RULES.tiers.high,
  /** `vpd7 × 7` do próprio vídeo do terceiro. */
  pisoViews: 2000,
  validadeDias: 30,
  carenciaDispensaDias: 30,
  topParecidos: 3,
  /** PROVISÓRIO, sem medida (0 de 10 pares com sentido em 22/10). */
  jaccardMin: 0.3,
  parecidoNotificaIndividual: false,
  /** Destino formado só pelo ramo "1 outlier com mult ≥ multSozinho" nasce 'resumo' (Phil, 22/10). */
  sozinhoNotificaIndividual: false,
  tetoNotificacoesDia: 5,
  tetoTentativas: 3,
  tetoEvidenciaOutliers: 20,
} as const

/** `rule_version` gravado em `niche_signals`: versão da regra + regra de lugar + semente de lugares. */
export function ruleVersionDe(semente: number): string {
  return `sinais-v${REGRA_SINAIS.versao}+lugar-v${LUGAR_REGRA_VERSAO}+semente-${semente}`
}
