import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Medida } from './tipos'

/** M6: ritmo de publicação (chamada por formato). Puro. */
export interface ValorRitmo { porSemana: number; intervaloMedianoDias: number; semanasComPublicacao: number; semanas: 13; maiorBuracoDias: number }

export function ritmo(publicacoesMs: readonly number[], o: { agoraMs: number; parcial: boolean }): Medida<ValorRitmo> {
  const semanas = MEASURE_RULES.rhythm.weeks
  const sem = (n: number) => n * 7 * DAY
  const validas = publicacoesMs.filter(t => Number.isFinite(t) && t <= o.agoraMs).sort((a, b) => a - b)
  const naJanela = validas.filter(t => o.agoraMs - t <= sem(semanas))
  if (o.parcial) return naoMedido('ritmo_parcial')
  const minimo = MEASURE_RULES.rhythm.minPosts
  if (naJanela.length < minimo) return naoMedido('poucas_publicacoes', { n: naJanela.length, minimo })
  const intervalos = naJanela.slice(1).map((t, i) => (t - naJanela[i]!) / DAY)
  const semanasCom = new Set(naJanela.map(t => Math.min(semanas - 1, Math.floor((o.agoraMs - t) / sem(1))))).size
  const nasLargas = validas.filter(t => o.agoraMs - t <= sem(MEASURE_RULES.rhythm.gapWeeks))
  const folgas = nasLargas.slice(1).map((t, i) => (t - nasLargas[i]!) / DAY)
  const ultima = nasLargas[nasLargas.length - 1]!
  const maiorBuracoDias = Math.max(0, ...folgas, (o.agoraMs - ultima) / DAY)
  return medido(
    { porSemana: naJanela.length / semanas, intervaloMedianoDias: median(intervalos) ?? 0, semanasComPublicacao: semanasCom, semanas: 13 as const, maiorBuracoDias },
    naJanela.length,
    { de: spDateOf(o.agoraMs - sem(semanas)), ate: spDateOf(o.agoraMs), dias: semanas * 7 },
  )
}
