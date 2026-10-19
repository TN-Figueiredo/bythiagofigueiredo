import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { MEASURE_RULES } from './regras'
import { RULES } from '../rules'
import { medido, naoMedido, type Medida, type Nota } from './tipos'

/**
 * M6: ritmo de publicação (chamada por formato). Puro.
 * `semanas` = casas semanais inteiras do período contado (13 quando nada corta a janela); `semanasComPublicacao` nunca passa dele.
 * `semanasContadas` = o denominador real de `porSemana` (fracionário, 2 casas). `dias` = o período contado, em dias inteiros.
 */
export interface ValorRitmo { porSemana: number; intervaloMedianoDias: number; semanasComPublicacao: number; semanas: number; semanasContadas: number; dias: number; maiorBuracoDias: number }

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

/** O limite de vídeos guardados, lido do mesmo jeito na tela e na API: o limitado pela regra (`load.ts` já limita; o valor cru do banco pode passar). */
export function limiteEfetivo(limiteDeVideos: number | null | undefined): number | null {
  return limiteDeVideos == null || !Number.isFinite(limiteDeVideos) ? null : Math.min(limiteDeVideos, RULES.videoLimitMax)
}

/**
 * Lista cortada: o YouTube tem mais vídeos do que guardamos. Com o total conhecido vale `guardados < total` (cobre primeira busca e lista podada);
 * sem o total, só o limite atingido indica corte (ausência não vira "completo").
 */
export function listaCortada(o: { guardados: number; totalNoYoutube: number | null | undefined; limiteDeVideos: number | null | undefined }): boolean {
  if (o.totalNoYoutube != null) return o.guardados < o.totalNoYoutube
  const limite = limiteEfetivo(o.limiteDeVideos)
  return limite != null && o.guardados >= limite
}

/**
 * Onde a cobertura da lista começa: a publicação na posição `limite` (da mais recente para a mais antiga), a mesma regra de `trackedVideoIds`.
 * Vídeo fixado antigo fica fora da conta (ele existe justamente para ficar guardado depois de sair do limite).
 */
export function coberturaDaLista(publicacoesMs: readonly number[], limiteDeVideos: number | null | undefined): number | null {
  const v = publicacoesMs.filter(Number.isFinite).sort((a, b) => b - a)
  if (!v.length) return null
  const limite = limiteEfetivo(limiteDeVideos)
  return v[Math.min(limite ?? v.length, v.length) - 1]!
}

/**
 * A base do ritmo de um canal, igual na tela e na API. `publicacoesMs` são TODAS as publicações guardadas (qualquer formato).
 * A criação posterior ao vídeo mais antigo guardado perde para ele (conta migrada/mesclada). Canal próprio nunca é lista cortada.
 */
export function baseDoRitmo(o: {
  publicacoesMs: readonly number[]; criadoEmMs: number | null; guardados: number
  totalNoYoutube: number | null | undefined; limiteDeVideos: number | null | undefined; proprio?: boolean
}): { criadoEmMs: number | null; coberturaDesdeMs: number | null } {
  const validas = o.publicacoesMs.filter(Number.isFinite)
  const maisAntigo = validas.length ? Math.min(...validas) : null
  const criado = o.criadoEmMs != null && Number.isFinite(o.criadoEmMs) ? o.criadoEmMs : null
  const criadoEmMs = criado !== null && maisAntigo !== null ? Math.min(criado, maisAntigo) : criado
  const cortada = o.proprio !== true && listaCortada({ guardados: o.guardados, totalNoYoutube: o.totalNoYoutube, limiteDeVideos: o.limiteDeVideos })
  return { criadoEmMs, coberturaDesdeMs: cortada ? coberturaDaLista(validas, o.limiteDeVideos) : null }
}

export function ritmo(publicacoesMs: readonly number[], o: { agoraMs: number; criadoEmMs: number | null; coberturaDesdeMs: number | null }): Medida<ValorRitmo> {
  const semanasDaRegra = MEASURE_RULES.rhythm.weeks
  const sem = (n: number) => n * 7 * DAY
  const ini = inicioDoRitmo({ agoraMs: o.agoraMs, semanasDaRegra, criadoEmMs: o.criadoEmMs, coberturaDesdeMs: o.coberturaDesdeMs })
  const validas = publicacoesMs.filter(t => Number.isFinite(t) && t <= o.agoraMs).sort((a, b) => a - b)
  const naJanela = validas.filter(t => t >= ini.inicioMs)
  // os dias da base viajam na nota (a tela os escreve: "O canal tem 20 dias de vida"); o número continua nulo
  if (ini.dias < PISO_RITMO_DIAS) {
    const dias = Math.round(ini.dias), desde = spDateOf(ini.inicioMs)
    return naoMedido(ini.corte === 'criacao' ? 'canal_novo' : 'ritmo_parcial', { notas: [ini.corte === 'criacao' ? { tipo: 'canal_mais_novo_que_a_janela', dias, desde } : { tipo: 'cobertura_curta', dias, desde }] })
  }
  const minimo = MEASURE_RULES.rhythm.minPosts
  if (naJanela.length < minimo) return naoMedido('poucas_publicacoes', { n: naJanela.length, minimo })
  const intervalos = naJanela.slice(1).map((t, i) => (t - naJanela[i]!) / DAY)
  const casas = Math.ceil(ini.semanas - 1e-9)
  const semanasCom = new Set(naJanela.map(t => Math.min(casas - 1, Math.floor((o.agoraMs - t) / sem(1))))).size
  const nasLargas = validas.filter(t => o.agoraMs - t <= sem(MEASURE_RULES.rhythm.gapWeeks))
  const folgas = nasLargas.slice(1).map((t, i) => (t - nasLargas[i]!) / DAY)
  const ultima = nasLargas[nasLargas.length - 1]!
  const maiorBuracoDias = Math.max(0, ...folgas, (o.agoraMs - ultima) / DAY)
  const dias = Math.round(ini.dias)
  const desde = spDateOf(ini.inicioMs)
  const notas: Nota[] = ini.corte === 'criacao' ? [{ tipo: 'canal_mais_novo_que_a_janela', dias, desde }]
    : ini.corte === 'cobertura' ? [{ tipo: 'cobertura_curta', dias, desde }] : []
  return medido(
    {
      porSemana: naJanela.length / ini.semanas, intervaloMedianoDias: median(intervalos) ?? 0, semanasComPublicacao: semanasCom,
      semanas: casas, semanasContadas: Math.round(ini.semanas * 100) / 100, dias, maiorBuracoDias,
    },
    naJanela.length,
    { de: desde, ate: spDateOf(o.agoraMs), dias: ini.corte === null ? semanasDaRegra * 7 : dias },
    notas,
  )
}
