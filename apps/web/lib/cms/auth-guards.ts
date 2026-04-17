import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '../supabase/service'

export type AuthorizableTable = 'blog_posts' | 'campaigns'

/**
 * Authorization guard for write server actions on site-scoped rows.
 *
 * Looks up the row's `site_id` via the service-role client (so the guard
 * works even when RLS would otherwise hide the row), then delegates the
 * actual authorisation check to
 * `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` from
 * `@tn-figueiredo/auth-nextjs` (Track C). The helper exercises the
 * `can_edit_site` RPC introduced in Sprint 4.75 Track A — which reads
 * `site_memberships` with cascade-up to `organization_members`, replacing
 * the ad-hoc `can_admin_site` lookup this guard used to do inline.
 *
 * Throws on failure: 'row_not_found', 'unauthenticated', 'forbidden'.
 */
export async function requireSiteAdminForRow(
  table: AuthorizableTable,
  rowId: string,
): Promise<{ siteId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data: row, error: rowErr } = await supabase
    .from(table)
    .select('site_id')
    .eq('id', rowId)
    .maybeSingle()

  if (rowErr) throw new Error(`row_lookup_failed: ${rowErr.message}`)
  if (!row) throw new Error('row_not_found')

  const res = await requireSiteScope({
    area: 'cms',
    siteId: row.site_id as string,
    mode: 'edit',
  })
  if (!res.ok) {
    // Translate the richer `requireSiteScope` result into the coarse
    // 'forbidden' / 'unauthenticated' strings the existing callers (blog
    // actions, campaign actions) already recognise.
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }

  return { siteId: row.site_id as string }
}
