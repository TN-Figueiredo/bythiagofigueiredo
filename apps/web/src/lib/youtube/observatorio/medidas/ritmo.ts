import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Medida, type Nota } from './tipos'

/** M6: ritmo de publicação (chamada por formato). Puro. `semanas` é o período realmente contado (13 quando nada corta a janela). */
export interface ValorRitmo { porSemana: number; intervaloMedianoDias: number; semanasComPublicacao: number; semanas: number; maiorBuracoDias: number }

/** Piso (parecer Phil 19/10): taxa por semana com menos de 4 semanas de base é ruído. */
export const PISO_RITMO_DIAS = 28

export interface InicioDoRitmo { inicioMs: number; dias: number; semanas: number; corte: 'criacao' | 'cobertura' | null }

/**
 * Início efetivo da janela do ritmo: `max(agora − semanasDaRegra, criação do canal, mais antigo guardado de lista cortada)`.
 * Nulo não encurta nada (ausência não inventa corte). Compartilhada com `cadence()` da tela, para tela e API não divergirem.
 */
export function inicioDoRitmo(o: { agoraMs: number; semanasDaRegra?: number; criadoEmMs?: number | null; coberturaDesdeMs?: number | null }): InicioDoRitmo {
  const regraMs = o.agoraMs - (o.semanasDaRegra ?? MEASURE_RULES.rhythm.weeks) * 7 * DAY
  const criado = o.criadoEmMs != null && Number.isFinite(o.criadoEmMs) ? o.criadoEmMs : -Infinity
  const cobre = o.coberturaDesdeMs != null && Number.isFinite(o.coberturaDesdeMs) ? o.coberturaDesdeMs : -Infinity
  const inicioMs = Math.max(regraMs, criado, cobre)
  // empate: a criação explica melhor que a cobertura
  const corte = inicioMs === regraMs ? null : criado >= cobre ? 'criacao' : 'cobertura'
  const dias = (o.agoraMs - inicioMs) / DAY
  return { inicioMs, dias, semanas: dias / 7, corte }
}

/** Lista cortada: há mais vídeos no YouTube do que guardamos e o limite foi atingido. Total desconhecido + limite atingido = cortada (ausência não vira "completo"). */
export function listaCortada(o: { guardados: number; totalNoYoutube: number | null | undefined; limiteDeVideos: number | null | undefined }): boolean {
  if (o.limiteDeVideos == null || o.guardados < o.limiteDeVideos) return false
  return o.totalNoYoutube == null || o.guardados < o.totalNoYoutube
}

export function ritmo(publicacoesMs: readonly number[], o: { agoraMs: number; criadoEmMs?: number | null; coberturaDesdeMs?: number | null }): Medida<ValorRitmo> {
  const semanasDaRegra = MEASURE_RULES.rhythm.weeks
  const sem = (n: number) => n * 7 * DAY
  const ini = inicioDoRitmo({ agoraMs: o.agoraMs, semanasDaRegra, criadoEmMs: o.criadoEmMs ?? null, coberturaDesdeMs: o.coberturaDesdeMs ?? null })
  const validas = publicacoesMs.filter(t => Number.isFinite(t) && t <= o.agoraMs).sort((a, b) => a - b)
  const naJanela = validas.filter(t => t >= ini.inicioMs)
  if (ini.dias < PISO_RITMO_DIAS) return naoMedido('ritmo_parcial')
  const minimo = MEASURE_RULES.rhythm.minPosts
  if (naJanela.length < minimo) return naoMedido('poucas_publicacoes', { n: naJanela.length, minimo })
  const intervalos = naJanela.slice(1).map((t, i) => (t - naJanela[i]!) / DAY)
  const semanasCom = new Set(naJanela.map(t => Math.min(Math.ceil(ini.semanas) - 1, Math.floor((o.agoraMs - t) / sem(1))))).size
  const nasLargas = validas.filter(t => o.agoraMs - t <= sem(MEASURE_RULES.rhythm.gapWeeks))
  const folgas = nasLargas.slice(1).map((t, i) => (t - nasLargas[i]!) / DAY)
  const ultima = nasLargas[nasLargas.length - 1]!
  const maiorBuracoDias = Math.max(0, ...folgas, (o.agoraMs - ultima) / DAY)
  const dias = Math.round(ini.dias)
  const notas: Nota[] = ini.corte === 'criacao' ? [{ tipo: 'canal_mais_novo_que_a_janela', dias }]
    : ini.corte === 'cobertura' ? [{ tipo: 'cobertura_curta', dias }] : []
  return medido(
    { porSemana: naJanela.length / ini.semanas, intervaloMedianoDias: median(intervalos) ?? 0, semanasComPublicacao: semanasCom, semanas: ini.corte === null ? semanasDaRegra : ini.semanas, maiorBuracoDias },
    naJanela.length,
    { de: spDateOf(ini.inicioMs), ate: spDateOf(o.agoraMs), dias: ini.corte === null ? semanasDaRegra * 7 : dias },
    notas,
  )
}
