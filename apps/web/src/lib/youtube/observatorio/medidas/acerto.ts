import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Formato, type Medida, type Nota } from './tipos'

/** M4: taxa de acerto e de fracasso por formato. Puro. O múltiplo vem do motor (`multiplierAt`), calculado por quem chama. */
export interface VideoParaAcerto {
  formato: Formato | null
  idadeDias: number
  multiplo: number | null
  baseFraca: boolean
  agendadoOuNoAr: boolean
}
export interface ValorAcerto { acertos: number; fracassos: number; total: number; pctAcerto: number | null; pctFracasso: number | null }

export function taxaDeAcerto(videos: readonly VideoParaAcerto[], o: { formato: Formato }): Medida<ValorAcerto> {
  const doFormato = videos.filter(v => v.formato === o.formato && v.idadeDias >= MEASURE_RULES.hit.minAgeDays && v.idadeDias <= MEASURE_RULES.tail.minAgeDays)
  const agendados = doFormato.filter(v => v.agendadoOuNoAr).length
  const notas: Nota[] = agendados ? [{ tipo: 'agendado_fora', n: agendados }] : []
  const candidatos = doFormato.filter(v => !v.agendadoOuNoAr)
  const comMultiplo = candidatos.filter(v => v.multiplo !== null && Number.isFinite(v.multiplo))
  if (candidatos.length > 0 && comMultiplo.length === 0) return naoMedido('sem_multiplo', { notas })
  const elegiveis = comMultiplo.filter(v => !v.baseFraca)
  const minimo = RULES.medianMinN
  if (elegiveis.length < minimo) return naoMedido('poucos_videos', { n: elegiveis.length, minimo, notas })
  const acertos = elegiveis.filter(v => (v.multiplo as number) >= RULES.outlierMin).length
  const fracassos = elegiveis.filter(v => (v.multiplo as number) <= MEASURE_RULES.hit.miss).length
  const total = elegiveis.length
  const comPct = total >= MEASURE_RULES.hit.pctFromN
  return medido(
    { acertos, fracassos, total, pctAcerto: comPct ? acertos / total : null, pctFracasso: comPct ? fracassos / total : null },
    total,
    { de: null, ate: null, dias: MEASURE_RULES.tail.minAgeDays },
    notas,
  )
}
