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

/**
 * Idempotent upsert of a shared test org + two test sites with stable UUIDs.
 * Used by RLS tests that need SITE_A + SITE_B existing across independent suites.
 * Safe for concurrent execution: all calls write identical content to the same rows.
 * Clean up via `await admin.from('organizations').delete().eq('id', SHARED_ORG_ID)`
 * when you explicitly want to reset state — otherwise rows persist across runs.
 */
export const SHARED_RING_ORG_ID = '00000000-0000-0000-0000-0000000000aa'
export const SHARED_SITE_A_ID = '11111111-1111-1111-1111-111111111111'
export const SHARED_SITE_B_ID = '22222222-2222-2222-2222-222222222222'

export async function ensureSharedSites(admin: SupabaseClient): Promise<void> {
  // Idempotent: if the org+sites exist with identical content, upsert is a no-op.
  const { error: orgErr } = await admin.from('organizations').upsert({
    id: SHARED_RING_ORG_ID,
    name: 'Shared Test Ring',
    slug: 'shared-test-ring',
    parent_org_id: null,
  }, { onConflict: 'id' })
  if (orgErr) throw orgErr

  const { error: siteAErr } = await admin.from('sites').upsert({
    id: SHARED_SITE_A_ID,
    org_id: SHARED_RING_ORG_ID,
    name: 'Shared Test Site A',
    slug: 'shared-test-site-a',
    domains: [],
    default_locale: 'pt-BR',
    supported_locales: ['pt-BR'],
  }, { onConflict: 'id' })
  if (siteAErr) throw siteAErr

  const { error: siteBErr } = await admin.from('sites').upsert({
    id: SHARED_SITE_B_ID,
    org_id: SHARED_RING_ORG_ID,
    name: 'Shared Test Site B',
    slug: 'shared-test-site-b',
    domains: [],
    default_locale: 'pt-BR',
    supported_locales: ['pt-BR'],
  }, { onConflict: 'id' })
  if (siteBErr) throw siteBErr
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
