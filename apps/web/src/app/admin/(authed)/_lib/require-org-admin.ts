import { redirect } from 'next/navigation'

/**
 * Guards org-admin area pages. RBAC v3 only has 'org_admin' — legacy
 * 'owner'/'admin' strings were removed in migration 20260420000060.
 */
export function requireOrgAdmin(role: string | null | undefined): asserts role is 'org_admin' {
  if (role !== 'org_admin') redirect('/cms')
}
