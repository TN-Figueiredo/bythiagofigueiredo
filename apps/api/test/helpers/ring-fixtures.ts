import type { SupabaseClient } from '@supabase/supabase-js'

export async function makeOrg(
  admin: SupabaseClient,
  tracker: string[],
  opts: { name?: string; slug?: string; parentOrgId?: string | null } = {},
): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data, error } = await admin.from('organizations').insert({
    name: opts.name ?? `Org ${suffix}`,
    slug: opts.slug ?? `org-${suffix}`,
    parent_org_id: opts.parentOrgId ?? null,
  }).select('id').single()
  if (error || !data) throw error ?? new Error('org insert failed')
  tracker.push(data.id)
  return data.id
}

export async function makeSite(
  admin: SupabaseClient,
  tracker: string[],
  orgId: string,
  opts: { name?: string; slug?: string; domains?: string[]; defaultLocale?: string; supportedLocales?: string[] } = {},
): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data, error } = await admin.from('sites').insert({
    org_id: orgId,
    name: opts.name ?? `Site ${suffix}`,
    slug: opts.slug ?? `site-${suffix}`,
    domains: opts.domains ?? [],
    default_locale: opts.defaultLocale ?? 'pt-BR',
    supported_locales: opts.supportedLocales ?? ['pt-BR'],
  }).select('id').single()
  if (error || !data) throw error ?? new Error('site insert failed')
  tracker.push(data.id)
  return data.id
}

export async function makeMembership(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'editor' | 'author',
): Promise<void> {
  const { error } = await admin.from('organization_members').insert({
    org_id: orgId,
    user_id: userId,
    role,
  })
  if (error) throw error
}
