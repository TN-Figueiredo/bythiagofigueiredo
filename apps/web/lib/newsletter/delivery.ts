import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Edition delivery visibility — aggregates `newsletter_sends` rows so the CMS
 * can answer "did everyone get it?" per edition.
 *
 * Status semantics are cumulative/progressive (queued → sent → delivered →
 * opened/clicked, or bounced/complained), and webhook events also stamp
 * `delivered_at`/`opened_at`/`clicked_at`. A row whose status is still
 * `sent`/`queued` with no event timestamps is "aguardando eventos" — honest
 * state for editions sent before (or while) the SES→SNS webhook catches up.
 */

export interface SendStatusRow {
  status: string
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
}

export interface SendDetailRow extends SendStatusRow {
  subscriber_email: string
  bounce_type: string | null
}

export interface DeliverySummary {
  /** Total send rows for the edition (enviados). */
  total: number
  /** Cumulative: delivered, opened or clicked (entregues). */
  delivered: number
  /** Cumulative: opened or clicked (abertos). */
  opened: number
  /** Clicked (cliques). */
  clicked: number
  /** Hard/soft bounces (bounces). */
  bounced: number
  /** Spam complaints (reclamações). */
  complained: number
  /** Still queued/sent with no events — webhook hasn't reported yet. */
  awaitingEvents: number
  /** True when there are sends but zero events of any kind. */
  noEventsYet: boolean
}

const DELIVERED_STATUSES = new Set(['delivered', 'opened', 'clicked'])
const OPENED_STATUSES = new Set(['opened', 'clicked'])
const PENDING_STATUSES = new Set(['queued', 'sent'])

export function aggregateDeliverySummary(rows: SendStatusRow[]): DeliverySummary {
  let delivered = 0
  let opened = 0
  let clicked = 0
  let bounced = 0
  let complained = 0
  let awaitingEvents = 0

  for (const row of rows) {
    const hasEvent = row.delivered_at !== null || row.opened_at !== null || row.clicked_at !== null
    if (hasEvent || DELIVERED_STATUSES.has(row.status)) delivered++
    if (row.opened_at !== null || OPENED_STATUSES.has(row.status)) opened++
    if (row.clicked_at !== null || row.status === 'clicked') clicked++
    if (row.status === 'bounced') bounced++
    if (row.status === 'complained') complained++
    if (PENDING_STATUSES.has(row.status) && !hasEvent) awaitingEvents++
  }

  return {
    total: rows.length,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    awaitingEvents,
    noEventsYet: rows.length > 0 && delivered === 0 && bounced === 0 && complained === 0,
  }
}

const PAGE_SIZE = 1000

/**
 * Server-side aggregate: one grouped pass over the edition's send rows
 * (paged at 1000 to respect PostgREST's row cap, columns kept minimal).
 */
export async function getEditionDeliverySummary(
  supabase: SupabaseClient,
  editionId: string,
): Promise<DeliverySummary> {
  const rows: SendStatusRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await supabase
      .from('newsletter_sends')
      .select('status, delivered_at, opened_at, clicked_at')
      .eq('edition_id', editionId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    const page = (data ?? []) as SendStatusRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return aggregateDeliverySummary(rows)
}

/** Sort weight: problems first, then awaiting, then happy path. */
const STATUS_RANK: Record<string, number> = {
  bounced: 0,
  complained: 1,
  queued: 2,
  sent: 3,
  delivered: 4,
  opened: 5,
  clicked: 6,
}

export function sortSendRows(rows: SendDetailRow[]): SendDetailRow[] {
  return [...rows].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
    if (rank !== 0) return rank
    return a.subscriber_email.localeCompare(b.subscriber_email)
  })
}

export const SEND_ROWS_LIMIT = 500

/** Per-subscriber drill-down rows, problems sorted first. */
export async function getEditionSendRows(
  supabase: SupabaseClient,
  editionId: string,
  limit: number = SEND_ROWS_LIMIT,
): Promise<SendDetailRow[]> {
  const { data } = await supabase
    .from('newsletter_sends')
    .select('subscriber_email, status, delivered_at, opened_at, clicked_at, bounce_type')
    .eq('edition_id', editionId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return sortSendRows((data ?? []) as SendDetailRow[])
}
