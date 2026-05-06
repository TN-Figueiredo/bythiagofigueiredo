// Compatibility helper for newsletter click analytics.
//
// When LINKS_NEWSLETTER_REWRITE_ENABLED=true, sends created after the cutover
// write click events to `link_clicks` (unified table). Pre-cutover sends still
// have rows in `newsletter_click_events`. The DB view
// `newsletter_click_events_unified` unions both sources so analytics don't
// double-count or miss events.
//
// When the flag is false (default), only `newsletter_click_events` is read —
// identical to the Sprint 5e behaviour.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ClickRow {
  url: string
  count: number
}

export interface CompatOptions {
  supabase: SupabaseClient
  /** IDs of newsletter_sends rows for the edition being analysed */
  sendIds: string[]
  /** Defaults to process.env.LINKS_NEWSLETTER_REWRITE_ENABLED === 'true' */
  rewriteEnabled?: boolean
}

/**
 * Returns aggregated click counts per URL for a set of send IDs.
 *
 * Source table selection:
 *  - rewriteEnabled=true  -> `newsletter_click_events_unified` view (union of
 *    both tables). Falls back to legacy if the view doesn't exist.
 *  - rewriteEnabled=false -> `newsletter_click_events` (legacy only).
 *
 * Caller is responsible for top-k slicing.
 */
export async function getNewsletterClickRows(opts: CompatOptions): Promise<ClickRow[]> {
  const {
    supabase,
    sendIds,
    rewriteEnabled = process.env.LINKS_NEWSLETTER_REWRITE_ENABLED === 'true',
  } = opts

  if (!sendIds.length) return []

  const table = rewriteEnabled
    ? 'newsletter_click_events_unified'
    : 'newsletter_click_events'

  const { data: clicks, error } = await supabase
    .from(table as never)
    .select('url')
    .in('send_id', sendIds)

  // If the unified view doesn't exist yet (migration not applied), fall back
  // to the legacy table gracefully so the page doesn't break mid-deploy.
  if (error && rewriteEnabled) {
    const { data: legacy } = await supabase
      .from('newsletter_click_events')
      .select('url')
      .in('send_id', sendIds)

    return aggregateUrls((legacy as { url: string }[] | null) ?? [])
  }

  return aggregateUrls((clicks as { url: string }[] | null) ?? [])
}

function aggregateUrls(rows: { url: string }[]): ClickRow[] {
  const clickMap = new Map<string, number>()
  for (const c of rows) {
    clickMap.set(c.url, (clickMap.get(c.url) ?? 0) + 1)
  }
  return [...clickMap.entries()].map(([url, count]) => ({ url, count }))
}
