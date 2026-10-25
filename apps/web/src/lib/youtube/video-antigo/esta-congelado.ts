// O vídeo antigo (02 §10.8): o predicado ÚNICO da marca. Todo código que decide se lê, grava ou mostra um vídeo de
// concorrente pergunta aqui; nenhum outro lugar compara archive_frozen_at.
export interface LinhaComMarca { archive_frozen_at?: string | null; archive_dropped_at?: string | null }
export type EstadoDoVideo = 'ativo' | 'leitura_mensal' | 'no_arquivo'

/** Fora da coleta: em leitura mensal OU já no arquivo. */
export function estaCongelado(v: LinhaComMarca): boolean { return v.archive_frozen_at != null }
/** As linhas dele nas 8 tabelas da classe já saíram do online. */
export function estaNoArquivo(v: LinhaComMarca): boolean { return v.archive_dropped_at != null }
export function estadoDoVideo(v: LinhaComMarca): EstadoDoVideo {
  return estaNoArquivo(v) ? 'no_arquivo' : estaCongelado(v) ? 'leitura_mensal' : 'ativo'
}
/** A marca já em tipo estreito (nulo = ativo), para quem monta `ObsVideo.arquivo` sem `!` nem `as` (Yannis Y8). */
export function marcaDoArquivo(v: LinhaComMarca): { estado: 'leitura_mensal' | 'no_arquivo'; desde: string } | null {
  const desde = v.archive_frozen_at
  if (desde == null) return null
  return { estado: estaNoArquivo(v) ? 'no_arquivo' : 'leitura_mensal', desde }
}
/** As colunas que todo select de competitor_videos que decide algo tem de pedir (um teste confere cada um). */
export const COLUNAS_DA_MARCA = 'archive_frozen_at, archive_dropped_at' as const
