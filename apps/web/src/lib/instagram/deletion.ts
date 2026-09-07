// Efeitos (d)–(h) de §3.1 passo 7, extraídos para que o cron das 11:00 possa
// RETOMAR um pedido cuja rota morreu (§3.3 passo 3) e para que a rota
// POST /api/instagram/data-deletion (C3) use exatamente o mesmo código.
// TODA etapa é idempotente: um `del` de blob já apagado é no-op, os `delete`
// são por account_id e a anonimização escreve valores fixos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { del, list } from '@vercel/blob'
import { revalidateTag } from 'next/cache'

export const DELETION_BLOB_BUDGET_MS = 45_000

export async function runDeletionEffects(
  supabase: SupabaseClient,
  request: { id: string; ig_user_id: string },
  deadlineAt: number,
): Promise<void> {
  // Alcance (MUST): (ig_user_id = X OU ig_professional_id = X) E source = 'oauth'.
  // Linhas `legacy` NUNCA casam — o id delas veio do /me de outro app.
  // A string de filtro é segura: o chamador já validou ^[0-9]{1,32}$.
  const { data: accountsData } = await supabase
    .from('instagram_accounts')
    .select('id, site_id')
    .or(`ig_user_id.eq.${request.ig_user_id},ig_professional_id.eq.${request.ig_user_id}`)
    .eq('ig_user_id_source', 'oauth')

  const accounts = (accountsData ?? []) as Array<{ id: string; site_id: string }>
  const ids = accounts.map((a) => a.id)

  if (ids.length > 0) {
    // (d) slots, posts e blobs
    await supabase.from('instagram_feed_slots').delete().in('account_id', ids)
    await supabase.from('instagram_posts').delete().in('account_id', ids)

    for (const account of accounts) {
      let cursor: string | undefined
      for (;;) {
        if (Date.now() >= deadlineAt) {
          // Corte controlado: `completed_at` fica NULL de propósito e o run
          // seguinte (replay da Meta ou o cron das 11:00) retoma daqui.
          return
        }
        const page = await list({ prefix: `instagram/${account.id}/`, cursor, limit: 1000 })
        if (page.blobs.length > 0) await del(page.blobs.map((b) => b.url))
        if (!page.hasMore) break
        cursor = page.cursor
      }
    }

    // (e) anonimizar a identidade (o handle fica — é configuração do site)
    await supabase
      .from('instagram_accounts')
      .update({ ig_user_id: null, ig_professional_id: null, ig_user_id_source: 'legacy' })
      .in('id', ids)

    // (f) trilha
    await supabase.from('instagram_sync_log').delete().in('account_id', ids)
    for (const account of accounts) {
      await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: 'data_deletion',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }
  }

  // (g) invalidação real do feed público (unstable_cache tag)
  revalidateTag('instagram-feed', { expire: 0 })

  // (h) ÚLTIMA escrita — `completed_at` é O sinal de "terminou". Nenhum caminho
  // o escreve antes, e nenhum responde afirmando conclusão enquanto for null.
  await supabase
    .from('instagram_deletion_requests')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', request.id)
}

/**
 * UM pedido por run — para não transformar a limpeza numa etapa sem teto.
 * Sem isto, um pedido cuja rota morreu depende inteiramente de a Meta
 * re-tentar, e a obrigação legal fica pendurada num evento que não controlamos.
 */
export async function resumeStuckDeletionRequest(
  supabase: SupabaseClient,
  deadlineAt: number,
): Promise<boolean> {
  const { data } = await supabase
    .from('instagram_deletion_requests')
    .select('id, ig_user_id')
    .is('completed_at', null)
    .lt('requested_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('requested_at', { ascending: true })
    .limit(1)

  const pending = (data ?? []) as Array<{ id: string; ig_user_id: string }>
  const first = pending[0]
  if (!first) return false

  await runDeletionEffects(supabase, first, deadlineAt)
  return true
}
