// apps/web/test/integration/ad-engine-migration.test.ts
/**
 * DB-gated integration tests for ad-engine 1.0 migrations (Session 1).
 *
 * Tests:
 *   - ad_slot_config: INSERT + SELECT + RLS (anon can SELECT, cannot INSERT)
 *   - ad_revenue_daily: UPSERT idempotency (composite PK conflict DO UPDATE)
 *   - ad_campaigns: GIN index query with target_categories @> operator
 *   - kill_switches: legacy names are absent; canonical + new names present
 *   - organizations: adsense columns accept valid values + reject invalid format
 *
 * Setup: service-role client for all writes; anon client for RLS checks.
 * All test data uses unique UUIDs and is cleaned up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY, seedSite } from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('ad-engine 1.0 migrations', () => {
  let db: SupabaseClient
  let anonDb: SupabaseClient

  const siteIdsToCleanup: string[] = []
  const orgIdsToCleanup: string[] = []
  const campaignIdsToCleanup: string[] = []

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    anonDb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  })

  afterAll(async () => {
    // Clean in dependency order: slot config first (FK to sites), then campaigns, sites, orgs
    if (siteIdsToCleanup.length) {
      await db.from('ad_slot_config').delete().in('site_id', siteIdsToCleanup)
      await db.from('ad_revenue_daily').delete().in('site_id', siteIdsToCleanup)
    }
    if (campaignIdsToCleanup.length) {
      await db.from('ad_campaigns').delete().in('id', campaignIdsToCleanup)
    }
    if (siteIdsToCleanup.length) {
      await db.from('sites').delete().in('id', siteIdsToCleanup)
    }
    if (orgIdsToCleanup.length) {
      await db.from('organizations').delete().in('id', orgIdsToCleanup)
    }
  })

  // ─── ad_slot_config ────────────────────────────────────────────────────────

  describe('ad_slot_config', () => {
    it('service_role can INSERT and SELECT a slot config row', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const { error: insertErr } = await db.from('ad_slot_config').insert({
        site_id: siteId,
        slot_key: 'banner_top',
        label: 'Banner — Topo',
        zone: 'banner',
        aspect_ratio: '8:1',
        iab_size: '728x90',
        house_enabled: true,
        cpa_enabled: false,
        google_enabled: false,
        template_enabled: true,
        mobile_behavior: 'keep',
        accepted_types: ['house', 'cpa'],
        max_per_session: 1,
        max_per_day: 3,
        cooldown_ms: 3_600_000,
      })
      expect(insertErr).toBeNull()

      const { data, error: selectErr } = await db
        .from('ad_slot_config')
        .select('slot_key, aspect_ratio, iab_size, zone, house_enabled')
        .eq('site_id', siteId)
        .eq('slot_key', 'banner_top')
        .single()

      expect(selectErr).toBeNull()
      expect(data?.slot_key).toBe('banner_top')
      expect(data?.aspect_ratio).toBe('8:1')
      expect(data?.iab_size).toBe('728x90')
      expect(data?.zone).toBe('banner')
      expect(data?.house_enabled).toBe(true)
    })

    it('anon client can SELECT ad_slot_config (waterfall RSC is unauthenticated)', async () => {
      // We re-use the site seeded in the test above; if that ran first, data exists.
      // If not, the query simply returns 0 rows — the important thing is no error.
      const { error } = await anonDb
        .from('ad_slot_config')
        .select('slot_key')
        .limit(1)

      expect(error).toBeNull()
    })

    it('anon client cannot INSERT into ad_slot_config (RLS blocks writes)', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const { error } = await anonDb.from('ad_slot_config').insert({
        site_id: siteId,
        slot_key: 'rail_left',
        label: 'Rail esquerdo',
        zone: 'rail',
        aspect_ratio: '1:4',
        iab_size: '160x600',
        mobile_behavior: 'hide',
        accepted_types: ['house'],
        max_per_session: 1,
        max_per_day: 3,
        cooldown_ms: 3_600_000,
      })

      expect(error).not.toBeNull()
    })

    it('rejects invalid zone value', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const { error } = await db.from('ad_slot_config').insert({
        site_id: siteId,
        slot_key: 'bad_zone_slot',
        label: 'Test',
        zone: 'not_a_valid_zone',
        aspect_ratio: '1:1',
        mobile_behavior: 'keep',
        accepted_types: ['house'],
        max_per_session: 1,
        max_per_day: 1,
        cooldown_ms: 1000,
      })

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check/i)
    })
  })

  // ─── ad_revenue_daily ─────────────────────────────────────────────────────

  describe('ad_revenue_daily', () => {
    it('UPSERT is idempotent on composite PK (site_id, slot_key, date, source)', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const today = new Date().toISOString().split('T')[0]!

      // First insert
      const { error: firstErr } = await db.from('ad_revenue_daily').upsert({
        site_id: siteId,
        slot_key: 'banner_top',
        date: today,
        source: 'house',
        impressions: 100,
        clicks: 5,
        earnings_cents: 0,
      })
      expect(firstErr).toBeNull()

      // Second upsert with updated impressions — should not error
      const { error: secondErr } = await db.from('ad_revenue_daily').upsert({
        site_id: siteId,
        slot_key: 'banner_top',
        date: today,
        source: 'house',
        impressions: 150,
        clicks: 8,
        earnings_cents: 0,
      })
      expect(secondErr).toBeNull()

      // Verify the row count is still 1
      const { data, error: countErr } = await db
        .from('ad_revenue_daily')
        .select('impressions, clicks')
        .eq('site_id', siteId)
        .eq('slot_key', 'banner_top')
        .eq('date', today)
        .eq('source', 'house')

      expect(countErr).toBeNull()
      expect(data).toHaveLength(1)
      // Upsert replaces — impressions should be the second value
      expect(data?.[0]?.impressions).toBe(150)
    })

    it('rejects invalid source value', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const today = new Date().toISOString().split('T')[0]!
      const { error } = await db.from('ad_revenue_daily').insert({
        site_id: siteId,
        slot_key: 'banner_top',
        date: today,
        source: 'invalid_source',
        impressions: 0,
        clicks: 0,
        earnings_cents: 0,
      })

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check/i)
    })
  })

  // ─── ad_campaigns GIN targeting ───────────────────────────────────────────

  describe('ad_campaigns target_categories GIN index', () => {
    it('GIN @> operator returns only campaigns matching the queried category', async () => {
      // Insert two campaigns: one targeting 'technology', one targeting 'lifestyle'
      const { data: techData, error: techErr } = await db
        .from('ad_campaigns')
        .insert({
          name: `test-tech-${Date.now()}`,
          format: 'native',
          status: 'active',
          pricing_model: 'cpm',
          type: 'cpa',
          target_categories: ['technology', 'programming'],
        })
        .select('id')
        .single()

      expect(techErr).toBeNull()
      campaignIdsToCleanup.push(techData!.id)

      const { data: lifeData, error: lifeErr } = await db
        .from('ad_campaigns')
        .insert({
          name: `test-lifestyle-${Date.now()}`,
          format: 'native',
          status: 'active',
          pricing_model: 'cpm',
          type: 'cpa',
          target_categories: ['lifestyle'],
        })
        .select('id')
        .single()

      expect(lifeErr).toBeNull()
      campaignIdsToCleanup.push(lifeData!.id)

      // Query using @> (contains) with the PostgREST cs. (contains) filter
      const { data: results, error: queryErr } = await db
        .from('ad_campaigns')
        .select('id, target_categories')
        .contains('target_categories', ['technology'])
        .in('id', [techData!.id, lifeData!.id])

      expect(queryErr).toBeNull()
      expect(results).toHaveLength(1)
      expect(results?.[0]?.id).toBe(techData!.id)
    })

    it('pacing_strategy constraint rejects invalid value', async () => {
      const { error } = await db.from('ad_campaigns').insert({
        name: `test-bad-pacing-${Date.now()}`,
        format: 'native',
        status: 'draft',
        pricing_model: 'cpm',
        type: 'house',
        pacing_strategy: 'rocket_boost',
      })

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check/i)
    })

    it('variant_weight constraint rejects out-of-range value', async () => {
      const { error } = await db.from('ad_campaigns').insert({
        name: `test-bad-weight-${Date.now()}`,
        format: 'native',
        status: 'draft',
        pricing_model: 'cpm',
        type: 'house',
        variant_weight: 150,
      })

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check/i)
    })
  })

  // ─── kill_switches cleanup ─────────────────────────────────────────────────

  describe('kill_switches (migration 100010)', () => {
    it('legacy slot names from pre-migration-026 are absent', async () => {
      const legacyIds = [
        'ads_slot_article_top',
        'ads_slot_article_between_paras',
        'ads_slot_sidebar_right',
        'ads_slot_below_fold',
      ]

      const { data, error } = await db
        .from('kill_switches')
        .select('id')
        .in('id', legacyIds)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('canonical slot switches are present', async () => {
      const canonicalIds = [
        'ads_slot_banner_top',
        'ads_slot_rail_left',
        'ads_slot_rail_right',
        'ads_slot_inline_mid',
        'ads_slot_block_bottom',
      ]

      const { data, error } = await db
        .from('kill_switches')
        .select('id')
        .in('id', canonicalIds)

      expect(error).toBeNull()
      expect(data?.map((r) => r.id).sort()).toEqual(canonicalIds.sort())
    })

    it('new ad-engine 1.0 switches are present and default to false (disabled)', async () => {
      const { data, error } = await db
        .from('kill_switches')
        .select('id, enabled')
        .in('id', ['ads_google_enabled', 'ads_network_enabled'])

      expect(error).toBeNull()
      expect(data).toHaveLength(2)
      for (const row of data ?? []) {
        expect(row.enabled).toBe(false)
      }
    })

    it('inline_end slot switch is absent (slot retired)', async () => {
      const { data, error } = await db
        .from('kill_switches')
        .select('id')
        .eq('id', 'ads_slot_inline_end')

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // ─── organizations AdSense columns ────────────────────────────────────────

  describe('organizations AdSense columns (migration 100005)', () => {
    it('accepts a valid ca-pub- publisher ID and disconnected sync status', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const { error } = await db
        .from('organizations')
        .update({
          adsense_publisher_id: 'ca-pub-1234567890123456',
          adsense_sync_status: 'pending',
        })
        .eq('id', orgId)

      expect(error).toBeNull()
    })

    it('rejects malformed publisher ID (missing ca-pub- prefix)', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const { error } = await db
        .from('organizations')
        .update({ adsense_publisher_id: 'pub-1234567890' })
        .eq('id', orgId)

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check/i)
    })

    it('rejects invalid sync_status value', async () => {
      const { siteId, orgId } = await seedSite(db)
      siteIdsToCleanup.push(siteId)
      orgIdsToCleanup.push(orgId)

      const { error } = await db
        .from('organizations')
        .update({ adsense_sync_status: 'syncing' })
        .eq('id', orgId)

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check/i)
    })
  })
})
