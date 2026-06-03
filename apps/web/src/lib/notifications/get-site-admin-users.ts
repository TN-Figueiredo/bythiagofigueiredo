import { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Returns user IDs of all admins for a given site.
 *
 * Admin = org_admin of the site's org + super_admins (org_admins of root orgs).
 * Uses service role client — bypasses RLS.
 */
export async function getSiteAdminUserIds(siteId: string): Promise<string[]> {
  const supabase = getSupabaseServiceClient()

  // 1. Resolve the site's org_id
  const { data: site } = await supabase
    .from('sites')
    .select('org_id')
    .eq('id', siteId)
    .single()

  if (!site) return []

  // 2+3. Parallel: org_admins for this org + root orgs for super_admins
  const [{ data: orgAdmins }, { data: rootOrgs }] = await Promise.all([
    supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', site.org_id)
      .eq('role', 'org_admin'),
    supabase
      .from('organizations')
      .select('id')
      .is('parent_org_id', null),
  ])

  const rootOrgIds = (rootOrgs ?? []).map(o => o.id as string)

  let superAdminIds: string[] = []
  if (rootOrgIds.length > 0) {
    const { data: superAdmins } = await supabase
      .from('organization_members')
      .select('user_id')
      .in('org_id', rootOrgIds)
      .eq('role', 'org_admin')

    superAdminIds = (superAdmins ?? []).map(r => r.user_id as string)
  }

  // 4. Merge and deduplicate
  const allIds = new Set<string>([
    ...(orgAdmins ?? []).map(r => r.user_id as string),
    ...superAdminIds,
  ])

  return [...allIds]
}
