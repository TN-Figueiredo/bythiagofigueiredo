// Compatibility helper for newsletter click analytics.
//
// Sends created after the unified rewrite cutover write click events to
// `link_clicks` (unified table). Pre-cutover sends still have rows in
// `newsletter_click_events`. The DB view `newsletter_click_events_unified`
// unions both sources so analytics don't double-count or miss events.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ClickRow {
  url: string
  count: number
}

export interface CompatOptions {
  supabase: SupabaseClient
  sendIds: string[]
}

/**
 * Returns aggregated click counts per URL for a set of send IDs.
 *
 * Reads from `newsletter_click_events_unified` view (union of both tables).
 * Falls back to legacy `newsletter_click_events` if the view doesn't exist.
 */
export async function getNewsletterClickRows(opts: CompatOptions): Promise<ClickRow[]> {
  const { supabase, sendIds } = opts

  if (!sendIds.length) return []

  const { data: clicks, error } = await supabase
    .from('newsletter_click_events_unified' as never)
    .select('url')
    .in('send_id', sendIds)

  if (error) {
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
