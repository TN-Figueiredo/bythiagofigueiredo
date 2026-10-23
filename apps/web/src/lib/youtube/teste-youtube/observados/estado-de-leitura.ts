import { VALIDAS_MIN_MEDIDO, type CampoObs } from './inferir'

/** Os três estados por campo que a F2 lê (§5.8, "Quando o dado não existe"). A ausência de linha nunca vira "0 versões" nem "não testou". */
export type EstadoDeLeitura = 'com_troca' | 'sem_troca_vista' | 'nao_medido'

export const RODADAS_MIN_MEDIDO = 8

export interface AlvoLido { rodadas: number; ultimaRodadaEm: string | null }
/** `validas*`: rodadas distintas com leitura válida do campo na última avaliação (0 = o campo nunca foi lido). */
export interface CursorLido { avaliadoAteRodada: number; avaliadoEm: string; motivo: string; validasTitulo: number; validasMiniatura: number }
export interface EntradaEstado {
  /** `OBS_TROCAS_CONCORRENTE` ligada. Desligada, nada é lido como "sem troca vista" (cursor antigo de quando esteve ligada não vale). */
  flagLigada: boolean
  alvo: AlvoLido | null
  cursor: CursorLido | null
  /** Campos que têm linha em `ab_native_observados`. */
  camposComLinha: ReadonlySet<CampoObs>
  agoraMs: number
  /** Frescor da prova diária (`yt_watch_prova`), em ms: última rodada e avaliação precisam estar dentro dele. */
  frescorMs: number
}

export function estadoDeLeitura(e: EntradaEstado, campo: CampoObs): EstadoDeLeitura {
  if (e.camposComLinha.has(campo)) return 'com_troca'
  if (!e.flagLigada) return 'nao_medido'
  const { alvo, cursor } = e
  if (!alvo || alvo.rodadas < RODADAS_MIN_MEDIDO || alvo.ultimaRodadaEm === null) return 'nao_medido'
  if (e.agoraMs - Date.parse(alvo.ultimaRodadaEm) > e.frescorMs) return 'nao_medido'
  if (!cursor || cursor.motivo !== 'ok') return 'nao_medido'
  // falha em verde: cursor `ok` com a sonda cega (bloqueio, erro) NÃO é "sem troca vista"; o campo precisa ter sido lido em rodadas suficientes
  if ((campo === 'titulo' ? cursor.validasTitulo : cursor.validasMiniatura) < VALIDAS_MIN_MEDIDO) return 'nao_medido'
  const emDia = cursor.avaliadoAteRodada >= alvo.rodadas - 1 || e.agoraMs - Date.parse(cursor.avaliadoEm) <= e.frescorMs
  return emDia ? 'sem_troca_vista' : 'nao_medido'
}

export function estadosDeLeitura(e: EntradaEstado): Record<CampoObs, EstadoDeLeitura> {
  return { titulo: estadoDeLeitura(e, 'titulo'), miniatura: estadoDeLeitura(e, 'miniatura') }
}

/** Consulta injetada (a F2 liga ao banco): devolve o que for do par (site, vídeo). */
export type ConsultaEstado = (siteId: string, ytId: string) => Promise<{ alvo: AlvoLido | null; cursor: CursorLido | null; camposComLinha: ReadonlySet<CampoObs> }>

export async function lerEstadosDeLeitura(consulta: ConsultaEstado, siteId: string, ytId: string, o: { flagLigada: boolean; agoraMs: number; frescorMs: number }): Promise<Record<CampoObs, EstadoDeLeitura>> {
  const dado = await consulta(siteId, ytId)
  return estadosDeLeitura({ ...dado, ...o })
}
