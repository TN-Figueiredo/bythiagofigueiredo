/**
 * DB-gated tests for the Fase-2 LGPD rights path (access + erasure) that gates
 * WAITLIST_ACCEPT_PUBLIC_SIGNUPS. Proves: the per-email erase RPC anonymizes correctly +
 * idempotently + site-scoped; the rights-request endpoint is no-oracle (identical response
 * + only issues a token/email for a REGISTERED address); the DSAR access endpoint returns a
 * valid token's data, excludes anonymized rows, and stays neutral for bad tokens.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-dsar-rights.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))

// Capture SES sends without hitting the network.
const sendSpy = vi.fn().mockResolvedValue({ messageId: 'test', provider: 'ses' })
vi.mock('../../lib/email/service', () => ({ getEmailService: () => ({ send: sendSpy, sendTemplate: vi.fn() }) }))

let mockSiteId: string | null = null
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: (k: string) => (k === 'x-site-id' ? mockSiteId : null) }),
}))

vi.mock('../../lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { POST as rightsPOST } from '../../src/app/api/waitlists/rights/route'
import { GET as dsarGET } from '../../src/app/api/waitlists/dsar/[token]/route'
import { generateWaitlistDsarToken, hashWaitlistDsarToken } from '../../lib/waitlists/dsar-token'
import { getSupabaseServiceClient } from '../../lib/supabase/service'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function seedSignup(siteId: string, email: string) {
  const { data: wl } = await db
    .from('waitlists')
    .insert({ site_id: siteId, slug: `dsar-${randomUUID().slice(0, 6)}`, name: 'D', status: 'open' })
    .select('id')
    .single()
  await db.from('waitlist_signups').insert({
    waitlist_id: wl!.id, site_id: siteId, email,
    consent_launch_notification: true, consent_text_version: 'v1', status: 'pending',
    source_surface: 'landing', ip: '203.0.113.9', user_agent: 'ua/1', locale: 'en',
  })
  return wl!.id
}

describe.skipIf(skipIfNoLocalDb())('waitlist DSAR rights (Fase 2)', () => {
  let siteId: string
  const cleanup: string[] = []

  beforeAll(async () => {
    // Token helper falls back to getServerEnv() (full schema validation, needs SES keys) when
    // no token secret is set; set one so token gen works in the test env, matching the routes.
    process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-dsar-secret'
    siteId = (await seedSite(db)).siteId
  })
  afterAll(async () => {
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET
    if (cleanup.length) await db.from('waitlists').delete().in('id', cleanup)
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mockSiteId = siteId
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db)
  })

  function rightsReq(body: Record<string, unknown>) {
    return new Request('http://localhost/api/waitlists/rights', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  }
  const dsarCtx = (token: string) => ({ params: Promise.resolve({ token }) })

  it('token generation is deterministic and hash = sha256(raw)', () => {
    const a = generateWaitlistDsarToken(siteId, 'Foo@Bar.com')
    const b = generateWaitlistDsarToken(siteId, 'foo@bar.com') // case-normalized
    expect(a.raw).toBe(b.raw)
    expect(a.hash).toBe(hashWaitlistDsarToken(a.raw))
  })

  it('erase RPC anonymizes (hash email, null ip/ua/locale, stamp), idempotent + site-scoped', async () => {
    const email = `erase-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))

    const r1 = await db.rpc('waitlist_erase_by_email', { p_site_id: siteId, p_email: email })
    expect(r1.data).toBe(1)
    const { data: row } = await db
      .from('waitlist_signups').select('email, ip, user_agent, locale, anonymized_at, consent_text_version')
      .eq('site_id', siteId).not('anonymized_at', 'is', null).order('anonymized_at', { ascending: false }).limit(1).single()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)
    expect(row!.ip).toBeNull()
    expect(row!.user_agent).toBeNull()
    expect(row!.locale).toBeNull()
    expect(row!.anonymized_at).toBeTruthy()
    expect(row!.consent_text_version).toBe('v1') // proof-of-consent retained

    const r2 = await db.rpc('waitlist_erase_by_email', { p_site_id: siteId, p_email: email })
    expect(r2.data).toBe(0) // idempotent — already anonymized

    // A different site never matches this email.
    const r3 = await db.rpc('waitlist_erase_by_email', { p_site_id: randomUUID(), p_email: email })
    expect(r3.data).toBe(0)
  })

  it('rights request is no-oracle: registered → token+email; unregistered → neither; same response', async () => {
    const email = `reg-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))

    const res1 = await rightsPOST(rightsReq({ email, locale: 'en' }))
    const j1 = await res1.json()
    expect(res1.status).toBe(200)
    expect(j1).toEqual({ ok: true })
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const { hash } = generateWaitlistDsarToken(siteId, email)
    const { data: tok } = await db.from('waitlist_dsar_tokens').select('email').eq('token_hash', hash).maybeSingle()
    expect(tok?.email).toBe(email)

    vi.clearAllMocks()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db)
    const unregistered = `nope-${Date.now()}@example.com`
    const res2 = await rightsPOST(rightsReq({ email: unregistered, locale: 'en' }))
    const j2 = await res2.json()
    expect(res2.status).toBe(200)
    expect(j2).toEqual({ ok: true }) // identical response (no oracle)
    expect(sendSpy).not.toHaveBeenCalled() // no email for an unregistered address
    const { hash: h2 } = generateWaitlistDsarToken(siteId, unregistered)
    const { data: tok2 } = await db.from('waitlist_dsar_tokens').select('email').eq('token_hash', h2).maybeSingle()
    expect(tok2).toBeNull()
  })

  it('DSAR access returns the token holder data; neutral for bad/short tokens; excludes anonymized', async () => {
    const email = `access-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))
    // issue a token via the rights endpoint
    await rightsPOST(rightsReq({ email, locale: 'en' }))
    const { raw } = generateWaitlistDsarToken(siteId, email)

    const ok = await dsarGET(new Request('http://localhost'), dsarCtx(raw))
    const okJson = await ok.json() as { data: Array<Record<string, unknown>> }
    expect(ok.status).toBe(200)
    expect(okJson.data.length).toBe(1)
    expect(okJson.data[0]!.email).toBe(email)
    expect(okJson.data[0]).not.toHaveProperty('ip') // narrowed projection
    expect(okJson.data[0]).not.toHaveProperty('user_agent')

    // short + random tokens → neutral empty (no oracle)
    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx('short'))).json()).data).toEqual([])
    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx('f'.repeat(64)))).json()).data).toEqual([])

    // after erasure, the same valid token returns nothing (rows anonymized)
    await db.rpc('waitlist_erase_by_email', { p_site_id: siteId, p_email: email })
    const after = await dsarGET(new Request('http://localhost'), dsarCtx(raw))
    expect((await after.json()).data).toEqual([])
  })
})
