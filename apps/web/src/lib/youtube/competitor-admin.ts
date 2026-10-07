import { requireSiteAdminScope } from '@/lib/cms/auth-guards'

/**
 * "+25 vagas" is for admins only. Thin boolean over the single "administrar o site" guard
 * (`requireSiteAdminScope` → can_admin_site_users() through the SESSION client). Fails closed on any error.
 */
export async function canAdminSiteUsers(siteId: string): Promise<boolean> {
  return (await requireSiteAdminScope(siteId)).ok
}
