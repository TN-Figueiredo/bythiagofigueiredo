/**
 * A5 · E9, Tarefa 7 (obrigação D-11): a sincronização de concorrentes consulta `competitor_removed_items` antes de inserir um
 * vídeo novo, e a ação de adicionar canal consulta antes de inserir o canal. Vídeo ou canal que o dono apagou NÃO volta a ser
 * coletado sem ele decidir. Nenhuma função daqui lança: erro do banco volta como `{ erro }` e quem chama NÃO insere (na dúvida
 * não se coleta; "tabela ausente" é erro, nunca "nenhum apagado").
 *
 * Só leitura de tabela existente desde a MG1 e um carimbo (`returned_seen_at`); nada aqui apaga linha.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ApagadosDaPagina { pular: Set<string>; vistosAgora: number }
export interface CanalApagado { apagadoEm: string; itemId: number }

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Dos ids de vídeo NOVOS desta página (devolvidos por `videos.list` e ainda sem linha), quais o dono apagou. `pular` = os que têm
 * `return_decision` diferente de 'voltar' (nulo ou 'ignorar'). Os sem resposta e ainda não vistos ganham `returned_seen_at`
 * (é isso que põe o item na seção "voltou ao ar" da fila).
 */
export async function apagadosDaPagina(
  sb: SupabaseClient, o: { siteId: string; videoIds: readonly string[]; nowIso: string },
): Promise<ApagadosDaPagina | { erro: string }> {
  if (o.videoIds.length === 0) return { pular: new Set(), vistosAgora: 0 }
  const ids = [...o.videoIds]
  try {
    const { data, error } = await sb.from('competitor_removed_items')
      .select('youtube_id, return_decision, returned_seen_at')
      .eq('site_id', o.siteId).eq('kind', 'video').in('youtube_id', ids)
    if (error) return { erro: error.message }
    if (!Array.isArray(data)) return { erro: 'resposta do banco fora da forma esperada' }
    const pular = new Set<string>()
    const aCarimbar: string[] = []
    for (const l of data as unknown[]) {
      if (!ehObjeto(l) || typeof l.youtube_id !== 'string') return { erro: 'linha do banco fora da forma esperada' }
      if (l.return_decision === 'voltar') continue
      pular.add(l.youtube_id)
      if (l.returned_seen_at == null && l.return_decision == null) aCarimbar.push(l.youtube_id)
    }
    if (aCarimbar.length > 0) {
      const up = await sb.from('competitor_removed_items')
        .update({ returned_seen_at: o.nowIso })
        .eq('site_id', o.siteId).eq('kind', 'video').in('youtube_id', aCarimbar)
        .is('returned_seen_at', null).is('return_decision', null)
      if (up.error) return { erro: up.error.message }
    }
    return { pular, vistosAgora: aCarimbar.length }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }
}

/** O dono apagou este canal (id do YouTube) deste site? `null` = nunca. */
export async function canalApagado(sb: SupabaseClient, siteId: string, youtubeChannelId: string): Promise<CanalApagado | null | { erro: string }> {
  try {
    const { data, error } = await sb.from('competitor_removed_items')
      .select('id, decided_at')
      .eq('site_id', siteId).eq('kind', 'canal').eq('youtube_id', youtubeChannelId).limit(1)
    if (error) return { erro: error.message }
    if (!Array.isArray(data)) return { erro: 'resposta do banco fora da forma esperada' }
    if (data.length === 0) return null
    const l: unknown = data[0]
    if (!ehObjeto(l) || typeof l.id !== 'number' || typeof l.decided_at !== 'string') return { erro: 'linha do banco fora da forma esperada' }
    return { apagadoEm: l.decided_at, itemId: l.id }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) }
  }
}

/** Marca a volta de um canal apagado que o dono readicionou (depois do `insert` bem-sucedido). Devolve a mensagem de falha, ou null. */
export async function registrarVoltaDoCanal(sb: SupabaseClient, siteId: string, itemId: number, nowIso: string): Promise<string | null> {
  try {
    const { data: atual, error: e1 } = await sb.from('competitor_removed_items')
      .select('returned_seen_at').eq('id', itemId).eq('site_id', siteId).limit(1)
    if (e1) return e1.message
    const visto = Array.isArray(atual) && ehObjeto(atual[0]) ? atual[0].returned_seen_at : null
    const { error } = await sb.from('competitor_removed_items')
      .update({ returned_seen_at: visto ?? nowIso, return_decision: 'voltar', return_decided_at: nowIso })
      .eq('id', itemId).eq('site_id', siteId)
    return error ? error.message : null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
