import type { SupabaseClient } from '@supabase/supabase-js'
import { redactSecrets } from '@/lib/redact-secrets'
import type { InstagramAccountRow, InstagramSyncMode, SyncResult } from './types'

/**
 * Escrita de `instagram_sync_log` (spec §3.2, commit A2).
 *
 * Hoje isso está inline em `api/cron/instagram-sync/route.ts:48-53,63-72,76-82`
 * e em `api/cron/instagram-token-refresh/route.ts:39-46,58-63,69-75`. C2 troca
 * as duas rotas por estes helpers; A já os entrega porque `triggerInstagramSync`
 * (A2) passa a abrir e fechar a própria linha.
 *
 * `instagram_sync_log` não tem coluna de detalhe (`20260507190000:70-89`), então
 * `openSyncRow` usa `error_message` com o prefixo `'detail: '`, que NÃO contamina
 * a janela de `evaluateTransientStreak` (ela só conta prefixo `transient:`).
 *
 * Nenhuma das duas funções lança: `logId === null` é o sinal de falha e o
 * chamador é quem registra (crons: `step_errors++` + `captureException`;
 * callback: `captureMessage`).
 */

const MAX_MESSAGE = 500

export async function openSyncRow(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  mode: InstagramSyncMode,
  opts?: { detail?: string },
): Promise<string | null> {
  const detail = opts?.detail
  const errorMessage = detail
    ? `detail: ${redactSecrets(detail).slice(0, MAX_MESSAGE)}`
    : null

  try {
    const { data, error } = await supabase
      .from('instagram_sync_log')
      .insert({
        site_id: account.site_id,
        account_id: account.id,
        mode,
        status: 'started',
        error_message: errorMessage,
      })
      .select('id')
      .single()

    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

export async function closeSyncRow(
  supabase: SupabaseClient,
  logId: string | null,
  result: SyncResult | null,
  errorMessage?: string,
): Promise<void> {
  if (logId === null) return

  const completedAt = new Date().toISOString()

  try {
    if (result) {
      // `completed` PRESERVA o `detail:` escrito por `openSyncRow` e só acrescenta
      // sufixos — Decisão de §3.2: nenhuma coluna nova.
      const { data: existing } = await supabase
        .from('instagram_sync_log')
        .select('error_message')
        .eq('id', logId)
        .single()

      const base = (existing as { error_message: string | null } | null)?.error_message ?? ''

      // Suffixes are contract data (C2 parses `' mediaFailed:'` out of this
      // column) — they must never be the thing a length cap drops. Truncate
      // the BASE to make room, never the suffixes. `Math.max(0, …)` guards
      // the degenerate case (suffixes alone ≥ MAX_MESSAGE): base is dropped
      // entirely rather than producing a negative slice.
      let suffix = ''
      if (result.partial) suffix += ' partial'
      if (result.mediaFailed > 0) suffix += ` mediaFailed:${result.mediaFailed}`

      const baseBudget = Math.max(0, MAX_MESSAGE - suffix.length)
      const message = base.slice(0, baseBudget) + suffix

      await supabase
        .from('instagram_sync_log')
        .update({
          status: 'completed',
          posts_found: result.postsFound,
          posts_inserted: result.postsInserted,
          posts_updated: result.postsUpdated,
          media_cached: result.mediaCached,
          error_message: message === '' ? null : message,
          completed_at: completedAt,
        })
        .eq('id', logId)
      return
    }

    await supabase
      .from('instagram_sync_log')
      .update({
        status: 'failed',
        error_message: errorMessage
          ? redactSecrets(errorMessage).slice(0, MAX_MESSAGE)
          : null,
        completed_at: completedAt,
      })
      .eq('id', logId)
  } catch {
    // Nunca lança: a trilha é best-effort e não pode derrubar o run.
  }
}
