import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../supabase/service'

export type AuthorizableTable = 'blog_posts' | 'campaigns'

/**
 * Authorization guard for write server actions on site-scoped rows.
 * Looks up the row's site_id, then verifies the current user can administer that site
 * via can_admin_site RPC (uses authenticated SSR client, not service role).
 *
 * Throws on failure: 'row_not_found', 'authz_check_failed', 'forbidden'.
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

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { data: allowed, error } = await userClient.rpc('can_admin_site', { p_site_id: row.site_id })
  if (error) throw new Error(`authz_check_failed: ${error.message}`)
  if (!allowed) throw new Error('forbidden')

  return { siteId: row.site_id as string }
}
