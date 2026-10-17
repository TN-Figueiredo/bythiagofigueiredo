// A5 E5a, Tarefa 14b: as datas das duas páginas (canal e vídeo). Puro. Nenhum número de dias mora aqui: saem de `MEASURE_RULES`.
// A data de "começou em" da leitura por hora NÃO é daqui: é `primeiraHoraDoSiteMs` de `HorasDoCanal`, lida do banco.
import { MEASURE_RULES } from '../medidas/regras'
import { somaDias } from './calendario'

/**
 * Uma subida (M5) precisa do trecho inteiro: 7 dias antes, o dia e 7 depois. `diasDeContagem` conta o dia de hoje; a subida
 * fecha no dia em que o trecho completa. O 15 sai da regra de M5 da E4 (`rise.days`), nunca escrito.
 */
export function subidaFechaEm(diasDeContagem: number, hojeSP: string): string {
  const total = 2 * MEASURE_RULES.rise.days + 1
  const faltam = Math.max(0, total - Math.max(0, Math.floor(diasDeContagem)))
  return somaDias(hojeSP, faltam)
}

/** A data da mudança de contagem (`MEASURE_RULES.countChange`), se estiver dentro de `de`..`ate` (inclusive); senão nulo. */
export function linhaDeCorteNaJanela(de: string, ate: string): string | null {
  const corte = MEASURE_RULES.countChange
  return de <= corte && corte <= ate ? corte : null
}
