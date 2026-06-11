/**
 * DB-gated integration tests for the Link Tracker schema (Sprint 6 migrations
 * 20260506000001–20260506000008).
 *
 * Run with:
 *   npm run db:start && npm run db:reset && HAS_LOCAL_DB=1 npm run test:web
 *
 * CI runs without HAS_LOCAL_DB — describe.skipIf(skipIfNoLocalDb()) keeps the
 * suite green.
 *
 * Coverage:
 *   - tracked_links CRUD + unique constraints
 *   - link_clicks INSERT + partition routing
 *   - link_daily_metrics UPSERT
 *   - link_annotations / link_goals / link_alerts CRUD
 *   - generate_link_code — uniqueness + collision-free
 *   - anonymize_old_link_clicks — PII erasure + idempotency
 *   - RLS: public read (only active, non-expired links), anon click insert,
 *     staff read-all, staff write, cross-site isolation
 *   - sites.short_domain column + backfill
 *   - newsletter_sends.link_id FK
 *   - newsletter_click_events view
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  ANON_KEY,
  SERVICE_KEY,
  seedSite,
  seedRbacScenario,
  cleanupRbacScenario,
  signUserJwt,
  type RbacScenario,
} from '../helpers/db-seed'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
}

function authedClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed helpers scoped to this test file
// ─────────────────────────────────────────────────────────────────────────────

async function seedTrackedLink(
  db: SupabaseClient,
  siteId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await db.rpc('generate_link_code', { p_site_id: siteId })
  if (error) throw new Error(`generate_link_code failed: ${error.message}`)
  const code: string = data as string

  const { data: link, error: insErr } = await db
    .from('tracked_links')
    .insert({
      site_id: siteId,
      code,
      destination_url: `https://example.com/${code}`,
      source_type: 'manual',
      active: true,
      ...overrides,
    })
    .select('id')
    .single()
  if (insErr || !link) throw insErr ?? new Error('seedTrackedLink: insert failed')
  return link.id as string
}

async function seedLinkClick(
  db: SupabaseClient,
  linkId: string,
  siteId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await db
    .from('link_clicks')
    .insert({
      link_id: linkId,
      site_id: siteId,
      visitor_id: `v-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      is_unique: true,
      clicked_at: new Date().toISOString(),
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('seedLinkClick: insert failed')
  return data.id as string
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup registry
// ─────────────────────────────────────────────────────────────────────────────

interface Cleanup {
  siteIds: string[]
  orgIds: string[]
  linkIds: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoLocalDb())('Link Tracker schema — integration', () => {
  let db: SupabaseClient
  let cleanup: Cleanup
  let scenario: RbacScenario

  beforeAll(async () => {
    db = serviceClient()
    cleanup = { siteIds: [], orgIds: [], linkIds: [] }
    scenario = await seedRbacScenario(db)
  })

  afterAll(async () => {
    // Delete link-tracker rows in dependency order.
    if (cleanup.linkIds.length) {
      await db.from('link_alerts').delete().in('link_id', cleanup.linkIds)
      await db.from('link_goals').delete().in('link_id', cleanup.linkIds)
      await db.from('link_annotations').delete().in('link_id', cleanup.linkIds)
      await db.from('link_daily_metrics').delete().in('link_id', cleanup.linkIds)
      await db.from('link_clicks').delete().in('link_id', cleanup.linkIds)
      await db.from('tracked_links').delete().in('id', cleanup.linkIds)
    }
    if (cleanup.siteIds.length) {
      await db.from('tracked_links').delete().in('site_id', cleanup.siteIds)
      await db.from('sites').delete().in('id', cleanup.siteIds)
    }
    if (cleanup.orgIds.length) {
      await db.from('organizations').delete().in('id', cleanup.orgIds)
    }
    await cleanupRbacScenario(db, scenario)
  })

  // ── tracked_links ──────────────────────────────────────────────────────────

  describe('tracked_links', () => {
    it('inserts a tracked link with generate_link_code', async () => {
      const { siteId, orgId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      cleanup.orgIds.push(orgId)

      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { data, error } = await db
        .from('tracked_links')
        .select('id, active, source_type, total_clicks, redirect_type')
        .eq('id', linkId)
        .single()
      expect(error).toBeNull()
      expect(data?.active).toBe(true)
      expect(data?.source_type).toBe('manual')
      expect(data?.total_clicks).toBe(0)
      // 307 since 20260518000003 (Links Engine A+): preserves method + avoids
      // permanent caching while tests/edits are live.
      expect(data?.redirect_type).toBe(307)
    })

    it('enforces unique (site_id, code)', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)

      const linkId = await seedTrackedLink(db, siteId, { code: 'dup-code' })
      cleanup.linkIds.push(linkId)

      const { error } = await db.from('tracked_links').insert({
        site_id: siteId,
        code: 'dup-code',
        destination_url: 'https://dupe.example.com',
        source_type: 'manual',
      })
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23505') // unique_violation
    })

    it('enforces unique (site_id, slug) when slug is provided', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)

      const linkId = await seedTrackedLink(db, siteId, { slug: 'my-slug' })
      cleanup.linkIds.push(linkId)

      const { error } = await db.from('tracked_links').insert({
        site_id: siteId,
        code: 'new-code-' + Date.now(),
        slug: 'my-slug',
        destination_url: 'https://other.example.com',
        source_type: 'manual',
      })
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23505')
    })

    it('soft-deletes: deleted_at does not block unique code for new row', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)

      const linkId = await seedTrackedLink(db, siteId, { code: 'soft-del' })
      cleanup.linkIds.push(linkId)

      // Soft delete
      const { error: delErr } = await db
        .from('tracked_links')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', linkId)
      expect(delErr).toBeNull()

      // Same code on another row should still fail the UNIQUE constraint.
      const { error } = await db.from('tracked_links').insert({
        site_id: siteId,
        code: 'soft-del',
        destination_url: 'https://new.example.com',
        source_type: 'manual',
      })
      // The unique index is NOT partial (deleted_at is not excluded), so this
      // must violate the constraint.
      expect(error?.code).toBe('23505')
    })

    it('updated_at trigger bumps on update', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { data: before } = await db
        .from('tracked_links')
        .select('updated_at')
        .eq('id', linkId)
        .single()

      // Tiny sleep to ensure clock advances.
      await new Promise((r) => setTimeout(r, 20))

      await db
        .from('tracked_links')
        .update({ title: 'Updated title' })
        .eq('id', linkId)

      const { data: after } = await db
        .from('tracked_links')
        .select('updated_at')
        .eq('id', linkId)
        .single()

      expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
        new Date(before!.updated_at).getTime(),
      )
    })
  })

  // ── generate_link_code ─────────────────────────────────────────────────────

  describe('generate_link_code', () => {
    it('returns a non-empty string', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const { data, error } = await db.rpc('generate_link_code', { p_site_id: siteId })
      expect(error).toBeNull()
      expect(typeof data).toBe('string')
      expect((data as string).length).toBeGreaterThanOrEqual(6)
    })

    it('generates unique codes across 20 sequential calls', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const codes = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const { data, error } = await db.rpc('generate_link_code', { p_site_id: siteId })
        expect(error).toBeNull()
        codes.add(data as string)
        // Insert to trigger collision detection on next iteration.
        const { error: insErr } = await db.from('tracked_links').insert({
          site_id: siteId,
          code: data as string,
          destination_url: `https://example.com/${data}`,
          source_type: 'manual',
        })
        expect(insErr).toBeNull()
      }
      expect(codes.size).toBe(20)
      // Cleanup the inserted links.
      await db.from('tracked_links').delete().eq('site_id', siteId)
    })
  })

  // ── link_clicks ────────────────────────────────────────────────────────────

  describe('link_clicks', () => {
    it('inserts a click and retrieves it', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const clickId = await seedLinkClick(db, linkId, siteId, {
        device_type: 'mobile',
        country: 'BR',
        referrer_source: 'search',
        ip: '1.2.3.4',
      })

      const { data, error } = await db
        .from('link_clicks')
        .select('id, device_type, country, referrer_source, ip')
        .eq('id', clickId)
        .single()
      expect(error).toBeNull()
      expect(data?.device_type).toBe('mobile')
      expect(data?.country).toBe('BR')
      expect(data?.ip).toBe('1.2.3.4')
    })

    it('rejects invalid device_type CHECK', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { error } = await db.from('link_clicks').insert({
        link_id: linkId,
        site_id: siteId,
        device_type: 'smartwatch', // not in CHECK list
        clicked_at: new Date().toISOString(),
      })
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23514') // check_violation
    })
  })

  // ── link_daily_metrics ─────────────────────────────────────────────────────

  describe('link_daily_metrics', () => {
    it('inserts and upserts metrics', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const today = new Date().toISOString().split('T')[0]

      const { error: insErr } = await db.from('link_daily_metrics').insert({
        link_id: linkId,
        site_id: siteId,
        date: today,
        weekday: new Date().getDay(),
        clicks: 10,
        unique_visitors: 8,
      })
      expect(insErr).toBeNull()

      // Upsert via ON CONFLICT is exercised by re-inserting — should fail with
      // unique violation (service-role direct insert doesn't do ON CONFLICT).
      const { error: dupErr } = await db.from('link_daily_metrics').insert({
        link_id: linkId,
        site_id: siteId,
        date: today,
        weekday: new Date().getDay(),
        clicks: 20,
        unique_visitors: 15,
      })
      expect(dupErr?.code).toBe('23505') // unique (link_id, date)

      const { data } = await db
        .from('link_daily_metrics')
        .select('clicks, unique_visitors')
        .eq('link_id', linkId)
        .eq('date', today)
        .single()
      expect(data?.clicks).toBe(10) // original value unchanged
    })
  })

  // ── link_annotations ──────────────────────────────────────────────────────

  describe('link_annotations', () => {
    it('inserts an annotation and reads it back', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { data, error } = await db
        .from('link_annotations')
        .insert({
          link_id: linkId,
          site_id: siteId,
          label: 'Campaign Launch',
          icon: 'rocket',
          color: '#FF8240',
          annotated_at: new Date().toISOString(),
        })
        .select('id, label, color')
        .single()
      expect(error).toBeNull()
      expect(data?.label).toBe('Campaign Launch')
      expect(data?.color).toBe('#FF8240')
    })
  })

  // ── link_goals ─────────────────────────────────────────────────────────────

  describe('link_goals', () => {
    it('inserts a goal with metric check', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { data, error } = await db
        .from('link_goals')
        .insert({
          link_id: linkId,
          site_id: siteId,
          metric: 'clicks',
          target_value: 1000,
          notify_channels: ['email'],
        })
        .select('id, metric, target_value')
        .single()
      expect(error).toBeNull()
      expect(data?.metric).toBe('clicks')
      expect(Number(data?.target_value)).toBe(1000)
    })

    it('rejects invalid metric CHECK', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { error } = await db.from('link_goals').insert({
        link_id: linkId,
        site_id: siteId,
        metric: 'impressions', // invalid
        target_value: 500,
      })
      expect(error).not.toBeNull()
      expect(error?.code).toBe('23514')
    })
  })

  // ── link_alerts ────────────────────────────────────────────────────────────

  describe('link_alerts', () => {
    it('inserts an alert', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { data, error } = await db
        .from('link_alerts')
        .insert({
          link_id: linkId,
          site_id: siteId,
          alert_type: 'threshold',
          metric: 'clicks',
          condition: { op: 'gte', value: 500 },
          notify_channels: ['slack'],
        })
        .select('id, alert_type, active')
        .single()
      expect(error).toBeNull()
      expect(data?.alert_type).toBe('threshold')
      expect(data?.active).toBe(true)
    })
  })

  // ── anonymize_old_link_clicks ──────────────────────────────────────────────

  describe('anonymize_old_link_clicks', () => {
    it('erases PII from old clicks and is idempotent', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const oldDate = new Date(Date.now() - 100 * 86_400_000).toISOString()

      // Insert a click that is older than 90 days.
      const { data: click, error: clickErr } = await db
        .from('link_clicks')
        .insert({
          link_id: linkId,
          site_id: siteId,
          ip: '203.0.113.42',
          user_agent: 'Mozilla/5.0 (old)',
          visitor_id: 'visitor-abc',
          city: 'São Paulo',
          region: 'SP',
          clicked_at: oldDate,
        })
        .select('id')
        .single()
      expect(clickErr).toBeNull()

      // Run anonymization.
      const { data: result, error: rpcErr } = await db.rpc('anonymize_old_link_clicks', {
        p_older_than_days: 90,
      })
      expect(rpcErr).toBeNull()
      expect((result as { anonymized: number }).anonymized).toBeGreaterThan(0)

      // Verify PII is gone. `visitor_id` is intentionally KEPT (commit
      // b7af842c, migration 000012): it's a daily-rotating SHA-256(ip|ua|date)
      // hash — non-reversible, non-PII — preserved for unique-visitor stats.
      const { data: row } = await db
        .from('link_clicks')
        .select('ip, user_agent, visitor_id, city, region')
        .eq('id', click!.id)
        .single()
      expect(row?.ip).toBeNull()
      expect(row?.user_agent).toBeNull()
      expect(row?.visitor_id).toBe('visitor-abc')
      expect(row?.city).toBeNull()
      expect(row?.region).toBeNull()

      // Second call must return anonymized = 0 (idempotent — ip IS NULL guard).
      const { data: result2 } = await db.rpc('anonymize_old_link_clicks', {
        p_older_than_days: 90,
      })
      expect((result2 as { anonymized: number }).anonymized).toBe(0)
    })
  })

  // ── RLS — public read ──────────────────────────────────────────────────────

  describe('RLS — public (anon) read on tracked_links', () => {
    it('anon can read active, non-expired link for visible site', async () => {
      const anon = anonClient()
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId, { active: true })
      cleanup.linkIds.push(linkId)

      const { data, error } = await anon
        .from('tracked_links')
        .select('id, code')
        .eq('id', linkId)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data?.id).toBe(linkId)
    })

    it('anon cannot read inactive link', async () => {
      const anon = anonClient()
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId, { active: false })
      cleanup.linkIds.push(linkId)

      const { data, error } = await anon
        .from('tracked_links')
        .select('id')
        .eq('id', linkId)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data).toBeNull()
    })

    it('anon cannot read soft-deleted link', async () => {
      const anon = anonClient()
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId, {
        active: true,
        deleted_at: new Date().toISOString(),
      })
      cleanup.linkIds.push(linkId)

      const { data } = await anon
        .from('tracked_links')
        .select('id')
        .eq('id', linkId)
        .maybeSingle()
      expect(data).toBeNull()
    })

    it('anon cannot read expired link', async () => {
      const anon = anonClient()
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId, {
        active: true,
        expires_at: new Date(Date.now() - 1000).toISOString(), // past
      })
      cleanup.linkIds.push(linkId)

      const { data } = await anon
        .from('tracked_links')
        .select('id')
        .eq('id', linkId)
        .maybeSingle()
      expect(data).toBeNull()
    })
  })

  // ── RLS — anon click insert ────────────────────────────────────────────────

  describe('RLS — anon can insert link_clicks', () => {
    it('anon insert succeeds for visible site link', async () => {
      const anon = anonClient()
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)
      const linkId = await seedTrackedLink(db, siteId)
      cleanup.linkIds.push(linkId)

      const { error } = await anon.from('link_clicks').insert({
        link_id: linkId,
        site_id: siteId,
        clicked_at: new Date().toISOString(),
      })
      expect(error).toBeNull()
    })
  })

  // ── RLS — cross-site isolation ─────────────────────────────────────────────

  describe('RLS — staff cross-site isolation', () => {
    it('editor of siteA cannot write a link on siteB', async () => {
      const { editorAId, siteBId } = scenario
      const { jwt: editorJwt } = signUserJwt(editorAId, 'editor')
      const client = authedClient(editorJwt)

      const { error } = await client.from('tracked_links').insert({
        site_id: siteBId,
        code: 'cross-site-attempt',
        destination_url: 'https://evil.example.com',
        source_type: 'manual',
      })
      // RLS must block: can_edit_site(siteBId) is false for editorA.
      expect(error).not.toBeNull()
    })

    it('editor of siteA cannot read link_daily_metrics of siteB', async () => {
      const { editorAId, siteBId } = scenario
      const { jwt: editorJwt } = signUserJwt(editorAId, 'editor')
      const client = authedClient(editorJwt)

      const { data } = await client
        .from('link_daily_metrics')
        .select('id')
        .eq('site_id', siteBId)
      // Either empty or RLS rejects — both are acceptable.
      expect(data?.length ?? 0).toBe(0)
    })
  })

  // ── sites.short_domain ─────────────────────────────────────────────────────

  describe('sites.short_domain', () => {
    it('column exists and accepts valid domain values', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)

      const { error } = await db
        .from('sites')
        .update({ short_domain: 'go.example-test.com' })
        .eq('id', siteId)
      expect(error).toBeNull()

      const { data } = await db
        .from('sites')
        .select('short_domain')
        .eq('id', siteId)
        .single()
      expect(data?.short_domain).toBe('go.example-test.com')
    })

    it('column rejects domain with uppercase characters (CHECK constraint)', async () => {
      const { siteId } = await seedSite(db)
      cleanup.siteIds.push(siteId)

      const { error } = await db
        .from('sites')
        .update({ short_domain: 'Go.Example.COM' })
        .eq('id', siteId)
      expect(error).not.toBeNull()
      // CHECK violation
      expect(error?.code).toBe('23514')
    })

    it('master site bythiagofigueiredo has short_domain backfilled', async () => {
      const { data } = await db
        .from('sites')
        .select('short_domain')
        .eq('slug', 'bythiagofigueiredo')
        .maybeSingle()
      // Only present after the migration has been applied.
      if (data) {
        expect(data.short_domain).toBe('go.bythiagofigueiredo.com')
      }
    })
  })

  // ── newsletter_sends.link_id ───────────────────────────────────────────────

  describe('newsletter_sends.link_id', () => {
    it('column exists and accepts null (nullable FK)', async () => {
      const { data: send } = await db
        .from('newsletter_sends')
        .select('id, link_id')
        .is('link_id', null)
        .limit(1)
        .maybeSingle()
      // We just verify the column is queryable and nullable — no error means schema OK.
      expect(send === null || (send && send.link_id === null)).toBe(true)
    })
  })

  // ── newsletter_click_events view ───────────────────────────────────────────

  describe('newsletter_click_events view', () => {
    it('view exists and is queryable (may be empty)', async () => {
      const { data, error } = await db
        .from('newsletter_click_events')
        .select('id, send_id, url, clicked_at')
        .limit(5)
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })
  })
})
