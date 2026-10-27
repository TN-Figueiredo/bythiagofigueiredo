// Tipos das versões do vídeo próprio (E18, seção 4.7 do plano) e das linhas de banco, escritas à mão (MG12).
// Sem import de banco nem de `server-only`.

import type { DiaYt } from '../proprio/tipos'

export type { DiaYt }

export type CampoVersao = 'title' | 'thumb' | 'desc'
/** 'cms' é só de leitura, reservado: nenhuma escrita o produz. */
export type OrigemVersao = 'linha_de_base' | 'ab_lab' | 'fora_do_sistema' | 'nao_se_sabe' | 'cms'
export type OrigemGravavel = Exclude<OrigemVersao, 'cms'>
export type EventoAb = 'rotacao' | 'vencedor' | 'restauro' | 'escolha'
export type PrecisaoJanela = 'first' | 'min' | '1d' | 'lacuna'

export interface VersaoPropria {
  id: string
  ytId: string
  campo: CampoVersao
  /** título ou descrição; null na thumbnail (e na descrição sem texto guardado) */
  texto: string | null
  hash: string
  thumb: { dhash: string; sha256: string | null; blobUrl: string | null; imagemExata: boolean; retoque: boolean } | null
  primeiroDia: DiaYt
  ultimoDia: DiaYt
  /** ISO */
  vistaDesde: string
  vistaAte: string
  /** null só na linha de base */
  janela: { de: string; ate: string } | null
  precisao: PrecisaoJanela
  origem: OrigemVersao
  eventoAb: EventoAb | null
  abTestId: string | null
  abVariantId: string | null
  preRegistro: boolean
  corrente: boolean
}

export type EstadoRegistro =
  | { estado: 'schema_ausente' }
  | { estado: 'sem_estado' }
  | { estado: 'registrando'; desde: DiaYt; conferidoAte: DiaYt; atrasoDias: number }

export type RegistroDoCampo = { estado: 'sem_versao' | 'so_linha_de_base' | 'com_trocas'; conferidoAte: DiaYt | null }

export interface VersoesDoVideo {
  ytId: string
  registro: Record<CampoVersao, RegistroDoCampo>
  versoes: VersaoPropria[]
}

export interface VersoesCanal {
  canalId: string
  estado: EstadoRegistro
  videos: VersoesDoVideo[]
}

/** Linha de `public.yt_own_video_versions` (MG12), colunas em snake_case como o banco devolve. */
export interface LinhaVersaoDb {
  id: string
  youtube_video_id: string
  site_id: string
  video_id: string | null
  channel_id: string
  field: CampoVersao
  value_text: string | null
  value_hash: string
  thumb_dhash: string | null
  thumb_anchor_dhash: string | null
  thumb_sha256: string | null
  thumb_blob_url: string | null
  thumb_similar: boolean
  first_day_pt: string
  last_day_pt: string
  first_seen_at: string
  last_seen_at: string
  window_start: string | null
  window_end: string | null
  window_precision: PrecisaoJanela
  origin: OrigemVersao
  ab_event: EventoAb | null
  ab_test_id: string | null
  ab_variant_id: string | null
  pre_registro: boolean
  is_current: boolean
  created_at: string
}

/** Linha de `public.yt_own_versions_state` (MG12). */
export interface LinhaEstadoDb {
  channel_id: string
  site_id: string
  tracking_since: string
  derived_through: string
  updated_at: string
}
