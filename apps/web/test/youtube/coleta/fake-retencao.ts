// Manipulador em memória de `public.yt_own_retention_facts` (MG5, apêndice B do plano E6/E8) e a chave única da tabela
// `yt_own_video_retention`, para os testes do passo da retenção. A PROVA da função é a Tarefa 9b, contra o banco; aqui
// ela só devolve os fatos que o teste semeou. Importa de `fake-supabase` SÓ TIPOS (sem ciclo de módulo).
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { FatoRetencao } from '@/lib/youtube/coleta/retencao-regra'
import type { FakeDb, Row } from './fake-supabase'

/** A PK de `yt_own_video_retention`, a mesma do `onConflict` do passo. */
export const CHAVE_RETENCAO = ['youtube_video_id', 'window_kind', 'segment', 'window_end']

const DIA = /^\d{4}-\d{2}-\d{2}$/

/** `fatos`: uma lista (vale para qualquer canal) ou um mapa `youtube_channels.id` → lista. */
export function comRetencao(db: FakeDb, fatos: readonly unknown[] | Record<string, readonly unknown[]>): FakeDb {
  // Cópia: `fakeSupabase()` entrega por padrão o objeto compartilhado de chaves e ele não pode ser alterado.
  db.uniqueKeys = { ...db.uniqueKeys, yt_own_video_retention: [CHAVE_RETENCAO] }
  db.rpcHandlers.yt_own_retention_facts = (a: Row) => {
    if (typeof a.p_channel_id !== 'string' || a.p_channel_id === '') {
      return { data: null, error: { code: '22023', message: 'yt_own_retention_facts: p_channel_id vazio' } }
    }
    // `p_hoje_utc` nulo = `current_date` no banco; quando vem, tem de ser uma data.
    if (a.p_hoje_utc != null && !(typeof a.p_hoje_utc === 'string' && DIA.test(a.p_hoje_utc))) {
      return { data: null, error: { code: '22007', message: 'yt_own_retention_facts: p_hoje_utc não é data' } }
    }
    const lista = Array.isArray(fatos) ? fatos : ((fatos as Record<string, readonly unknown[]>)[a.p_channel_id] ?? [])
    return { data: structuredClone(lista), error: null }
  }
  return db
}

/**
 * Um item de `yt_own_retention_facts` com TODOS os campos do apêndice B, escrito à mão. Padrão: vídeo de 30 dias, com
 * diário em dia, nunca tentado, sem view recente (cai na leva) e com as janelas de 7 e 30 dias já guardadas.
 */
export function fatoDe(n: number, hojePt: string, o: Partial<FatoRetencao> = {}): FatoRetencao {
  return {
    youtube_video_id: idDoVideo(n),
    video_id: `uuid-vid-${n}`,
    site_id: 'site-1',
    duration_seconds: 600,
    publicado_dia_pt: addDays(hojePt, -30),
    fonte_ate: addDays(hojePt, -1),
    views_total: 1000,
    ultimo_dia_com_view: addDays(hojePt, -30),
    views_7d: 100,
    views_30d: 900,
    vida_window_end: null,
    vida_collected_at: null,
    vida_views_at_read: null,
    tem_7d: true,
    tem_30d: true,
    primeira_tent_dia: null,
    leva_ancora_dia: null,
    diario_tent_dia: null,
    diario_tent_resultado: null,
    diario_falhas_4d: 0,
    vida_tent_dia: null,
    vida_tent_resultado: null,
    vida_resposta_dia: null,
    d7_tent_dia: null,
    d7_tent_resultado: null,
    d7_resposta_dia: null,
    d30_tent_dia: null,
    d30_tent_resultado: null,
    d30_resposta_dia: null,
    ...o,
  }
}

/** O id do YouTube tem 11 caracteres (a consulta recusa outra forma). */
export function idDoVideo(n: number): string {
  return `vid${String(n).padStart(8, '0')}`
}
