// Semente do A/B Lab (E18, parte 7, Tarefa 11): os títulos dos ciclos antigos viram versões "antes do início do registro".
// Puro: sem banco, sem `server-only`. Grava só título de ciclo (`title_set`), nunca o título original (desvio 8) nem thumbnail.

import { hashValue } from '@/lib/youtube/competitor-versions'
import { dayPt } from './day-pt'

export interface TesteSemente { id: string; videoId: string }
export interface CicloSemente {
  id: string
  testId: string
  variantId: string | null
  iniciadoEm: string
  encerradoEm: string | null
  /** applied_metadata ->> 'title_set' */
  tituloSet: string | null
}
export interface VideoSemente { id: string; ytId: string }

/** A linha que `yt_own_versions_seed_pre` recebe em `p_rows`. */
export interface LinhaSemente {
  youtube_video_id: string
  video_id: string
  value_text: string
  value_hash: string
  first_seen_at: string
  last_seen_at: string
  ab_event: 'rotacao'
  ab_test_id: string
  ab_variant_id: string | null
}

export type MotivoFora = 'sem_titulo' | 'depois_do_registro' | 'video_ausente' | 'atravessa_o_registro'

export interface SementeAb { linhas: LinhaSemente[]; fora: Array<{ ciclo: string; motivo: MotivoFora }> }

/**
 * Uma linha por ciclo com `title_set` e início anterior ao dia `registroDesde` (dia do Pacífico). O ciclo que começa antes e termina
 * no dia do início do registro ou depois, ou que não tem fim (`ended_at` nulo), fica em `fora` (`atravessa_o_registro`): o título dele já é a linha de base.
 */
export function montarSementeAb(
  testes: readonly TesteSemente[], ciclos: readonly CicloSemente[], videos: readonly VideoSemente[], registroDesde: string,
): SementeAb {
  const testePorId = new Map(testes.map(t => [t.id, t]))
  const videoPorId = new Map(videos.map(v => [v.id, v]))
  const out: SementeAb = { linhas: [], fora: [] }
  for (const c of ciclos) {
    const titulo = c.tituloSet
    if (titulo === null || titulo.trim() === '') { out.fora.push({ ciclo: c.id, motivo: 'sem_titulo' }); continue }
    const video = videoPorId.get(testePorId.get(c.testId)?.videoId ?? '')
    if (!video) { out.fora.push({ ciclo: c.id, motivo: 'video_ausente' }); continue }
    if (dayPt(new Date(c.iniciadoEm)) >= registroDesde) { out.fora.push({ ciclo: c.id, motivo: 'depois_do_registro' }); continue }
    // Ciclo sem fim (no ar ou nunca fechado): ninguém observou o título sair do ar, então não vira período falso (portão 14/10, Phil I-4).
    if (c.encerradoEm === null) { out.fora.push({ ciclo: c.id, motivo: 'atravessa_o_registro' }); continue }
    const fim = c.encerradoEm
    if (dayPt(new Date(fim)) >= registroDesde) { out.fora.push({ ciclo: c.id, motivo: 'atravessa_o_registro' }); continue }
    out.linhas.push({
      youtube_video_id: video.ytId, video_id: video.id, value_text: titulo, value_hash: hashValue(titulo),
      first_seen_at: c.iniciadoEm, last_seen_at: fim, ab_event: 'rotacao', ab_test_id: c.testId, ab_variant_id: c.variantId,
    })
  }
  return out
}
