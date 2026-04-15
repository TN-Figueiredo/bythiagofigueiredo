/**
 * DB-gated integration tests for `public.update_campaign_atomic`.
 *
 * Coverage:
 *   - Happy patch (interest)
 *   - Unknown patch key → raises
 *   - status in patch → raises (Sprint 3 round-3: status transitions go through
 *     dedicated server actions, not this RPC)
 *   - Non-staff user → `permission denied` (uses JWT-scoped anon client)
 *   - Translation upserts: insert new locale, update existing locale
 *
 * Auth model for "permission denied":
 *   The RPC calls `can_admin_site(site_id)` → `auth.uid()`. Service-role client
 *   has `auth.uid() = null` but also bypasses every policy; however the RPC
 *   itself is `security definer` + `can_admin_site()` is `stable` SQL, so the
 *   authz decision still runs. To exercise the "non-staff user" branch we call
 *   the RPC through a PostgREST request authenticated with a JWT whose `sub`
 *   has no `organization_members` row for the site's org — that yields
 *   `auth.uid() = <uid>` but `is_org_staff(org_id) = false`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  ANON_KEY,
  seedSite,
  seedCampaign,
  signUserJwt,
} from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('RPC update_campaign_atomic', () => {
  let db: SupabaseClient
  const campaignIdsToCleanup: string[] = []
  const siteIdsToCleanup: string[] = []
  const orgIdsToCleanup: string[] = []

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  })

  afterAll(async () => {
    if (campaignIdsToCleanup.length) {
      await db.from('campaigns').delete().in('id', campaignIdsToCleanup)
    }
    if (siteIdsToCleanup.length) {
      await db.from('sites').delete().in('id', siteIdsToCleanup)
    }
    if (orgIdsToCleanup.length) {
      await db.from('organizations').delete().in('id', orgIdsToCleanup)
    }
  })

  async function freshCampaign(siteId: string | null = null): Promise<string> {
    const { campaignId } = await seedCampaign(db, siteId)
    campaignIdsToCleanup.push(campaignId)
    return campaignId
  }

  it('happy patch: updates `interest` column in place', async () => {
    const campaignId = await freshCampaign(null)

    const { data, error } = await db.rpc('update_campaign_atomic', {
      p_campaign_id: campaignId,
      p_patch: { interest: 'fitness' },
      p_translations: null,
    })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    // RPC returns the updated campaigns row.
    const row = data as { id: string; interest: string }
    expect(row.interest).toBe('fitness')

    const { data: after } = await db
      .from('campaigns')
      .select('interest')
      .eq('id', campaignId)
      .single()
    expect(after?.interest).toBe('fitness')
  })

  it('unknown patch key: raises "unknown patch keys: <key>"', async () => {
    const campaignId = await freshCampaign(null)

    const { data, error } = await db.rpc('update_campaign_atomic', {
      p_campaign_id: campaignId,
      p_patch: { bogus_column: 'x' },
      p_translations: null,
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/unknown patch keys.*bogus_column/i)
  })

  it('status in patch: raises (Sprint 3 hardening — status transitions go elsewhere)', async () => {
    const campaignId = await freshCampaign(null)

    const { data, error } = await db.rpc('update_campaign_atomic', {
      p_campaign_id: campaignId,
      p_patch: { status: 'published' },
      p_translations: null,
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/unknown patch keys.*status/i)
  })

  it('non-staff user: "permission denied for campaign"', async () => {
    // Seed a real site + campaign (site_id NOT NULL so `can_admin_site` fires).
    const { siteId, orgId } = await seedSite(db)
    siteIdsToCleanup.push(siteId)
    orgIdsToCleanup.push(orgId)
    const campaignId = await freshCampaign(siteId)

    // Synthetic user — no membership in the site's org.
    const { jwt } = signUserJwt(randomUUID(), 'user')
    const jwtClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data, error } = await jwtClient.rpc('update_campaign_atomic', {
      p_campaign_id: campaignId,
      p_patch: { interest: 'style' },
      p_translations: null,
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/permission denied/i)

    // Row must be untouched.
    const { data: after } = await db
      .from('campaigns')
      .select('interest')
      .eq('id', campaignId)
      .single()
    expect(after?.interest).toBe('creator')
  })

  it('translations: insert new locale, then update existing locale', async () => {
    const campaignId = await freshCampaign(null)

    // Insert new pt-BR translation.
    const translationsPayload = [
      {
        locale: 'pt-BR',
        slug: `integration-${Date.now()}`,
        main_hook_md: '# Initial hook',
        context_tag: 'alpha',
        success_headline: 'sh1',
        success_headline_duplicate: 'shd1',
        success_subheadline: 'ssh1',
        success_subheadline_duplicate: 'sshd1',
        check_mail_text: 'check',
        download_button_label: 'download',
      },
    ]

    const ins = await db.rpc('update_campaign_atomic', {
      p_campaign_id: campaignId,
      p_patch: null,
      p_translations: translationsPayload,
    })
    expect(ins.error).toBeNull()

    const { data: initial } = await db
      .from('campaign_translations')
      .select('locale, context_tag, main_hook_md')
      .eq('campaign_id', campaignId)
    expect(initial?.length).toBe(1)
    expect(initial?.[0]?.locale).toBe('pt-BR')
    expect(initial?.[0]?.context_tag).toBe('alpha')

    // Second call: update the existing pt-BR row + insert a new `en` row.
    const upd = await db.rpc('update_campaign_atomic', {
      p_campaign_id: campaignId,
      p_patch: null,
      p_translations: [
        { locale: 'pt-BR', main_hook_md: '# Updated hook' },
        {
          locale: 'en',
          slug: `integration-en-${Date.now()}`,
          main_hook_md: '# English hook',
          context_tag: 'beta',
          success_headline: 'sh2',
          success_headline_duplicate: 'shd2',
          success_subheadline: 'ssh2',
          success_subheadline_duplicate: 'sshd2',
          check_mail_text: 'chk',
          download_button_label: 'dl',
        },
      ],
    })
    expect(upd.error).toBeNull()

    const { data: final } = await db
      .from('campaign_translations')
      .select('locale, context_tag, main_hook_md')
      .eq('campaign_id', campaignId)
      .order('locale', { ascending: true })

    expect(final?.length).toBe(2)
    const en = final?.find((r) => r.locale === 'en')
    const pt = final?.find((r) => r.locale === 'pt-BR')
    expect(en?.context_tag).toBe('beta')
    expect(en?.main_hook_md).toBe('# English hook')
    // pt-BR: main_hook_md updated, context_tag preserved.
    expect(pt?.main_hook_md).toBe('# Updated hook')
    expect(pt?.context_tag).toBe('alpha')
  })
})
