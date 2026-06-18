/**
 * DB-gated tests for the Fase-2 LGPD rights path (access + erasure) that gates
 * WAITLIST_ACCEPT_PUBLIC_SIGNUPS. Proves: the per-email erase RPC anonymizes + audit-logs +
 * is idempotent + site-scoped; the rights-request endpoint is no-oracle (identical response,
 * Turnstile + rate-limit fail-neutral, email only to a REGISTERED address); the DSAR access
 * endpoint returns a valid token's data, excludes anonymized rows, and is neutral for
 * bad/EXPIRED/USED tokens.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-dsar-rights.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('../../lib/turnstile', () => ({ verifyTurnstileToken: vi.fn().mockResolvedValue(true) }))

const sendSpy = vi.fn().mockResolvedValue({ messageId: 'test', provider: 'ses' })
vi.mock('../../lib/email/service', () => ({ getEmailService: () => ({ send: sendSpy, sendTemplate: vi.fn() }) }))

let mockSiteId: string | null = null
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: (k: string) => (k === 'x-site-id' ? mockSiteId : null) }),
}))

vi.mock('../../lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { POST as rightsPOST } from '../../src/app/api/waitlists/rights/route'
import { GET as dsarGET } from '../../src/app/api/waitlists/dsar/[token]/route'
import { generateWaitlistDsarToken } from '../../lib/waitlists/dsar-token'
import { verifyTurnstileToken } from '../../lib/turnstile'
import { getSupabaseServiceClient } from '../../lib/supabase/service'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const DAY = 24 * 60 * 60 * 1000

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
    process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-dsar-secret'
    process.env.TURNSTILE_SECRET_KEY = 'test-turnstile-secret' // route enforces Turnstile when set
    siteId = (await seedSite(db)).siteId
  })
  afterAll(async () => {
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET
    delete process.env.TURNSTILE_SECRET_KEY
    if (cleanup.length) await db.from('waitlists').delete().in('id', cleanup)
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    mockSiteId = siteId
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db)
  })

  function rightsReq(body: Record<string, unknown>) {
    return new Request('http://localhost/api/waitlists/rights', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ turnstile_token: 'tok', ...body }),
    })
  }
  const dsarCtx = (token: string) => ({ params: Promise.resolve({ token }) })

  it('erase RPC anonymizes + writes an audit_log row; idempotent + site-scoped', async () => {
    const email = `erase-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))

    const r1 = await db.rpc('waitlist_erase_by_email', { p_site_id: siteId, p_email: email, p_ip: '198.51.100.5', p_user_agent: 'agent/9' })
    expect(r1.data).toBe(1)
    const { data: row } = await db
      .from('waitlist_signups').select('email, ip, user_agent, locale, anonymized_at, consent_text_version')
      .eq('site_id', siteId).not('anonymized_at', 'is', null).order('anonymized_at', { ascending: false }).limit(1).single()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)
    expect(row!.ip).toBeNull()
    expect(row!.user_agent).toBeNull()
    expect(row!.locale).toBeNull()
    expect(row!.consent_text_version).toBe('v1') // proof-of-consent retained

    // C: an audit_log row records the erasure (count + reason), without the plaintext email.
    const { data: audit } = await db
      .from('audit_log').select('action, site_id, after_data')
      .eq('action', 'waitlist_erasure').eq('site_id', siteId).order('created_at', { ascending: false }).limit(1).single()
    expect(audit!.action).toBe('waitlist_erasure')
    expect((audit!.after_data as { rows_affected: number }).rows_affected).toBe(1)
    expect((audit!.after_data as { reason: string }).reason).toBe('data_subject_request')

    const r2 = await db.rpc('waitlist_erase_by_email', { p_site_id: siteId, p_email: email, p_ip: null, p_user_agent: null })
    expect(r2.data).toBe(0) // idempotent — already anonymized
    const r3 = await db.rpc('waitlist_erase_by_email', { p_site_id: randomUUID(), p_email: email, p_ip: null, p_user_agent: null })
    expect(r3.data).toBe(0) // cross-site never matches
  })

  it('rights request is no-oracle: registered → token+email; unregistered → neither; same response', async () => {
    const email = `reg-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))

    const res1 = await rightsPOST(rightsReq({ email, locale: 'en' }))
    expect(res1.status).toBe(200)
    expect(await res1.json()).toEqual({ ok: true })
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const { hash } = generateWaitlistDsarToken(siteId, email)
    const { data: tok } = await db.from('waitlist_dsar_tokens').select('email').eq('token_hash', hash).maybeSingle()
    expect(tok?.email).toBe(email)

    vi.clearAllMocks(); vi.mocked(verifyTurnstileToken).mockResolvedValue(true); vi.mocked(getSupabaseServiceClient).mockReturnValue(db)
    const unregistered = `nope-${Date.now()}@example.com`
    const res2 = await rightsPOST(rightsReq({ email: unregistered, locale: 'en' }))
    expect(res2.status).toBe(200)
    expect(await res2.json()).toEqual({ ok: true }) // identical response (no oracle)
    expect(sendSpy).not.toHaveBeenCalled()
    const { hash: h2 } = generateWaitlistDsarToken(siteId, unregistered)
    expect((await db.from('waitlist_dsar_tokens').select('email').eq('token_hash', h2).maybeSingle()).data).toBeNull()
  })

  it('rights request fails NEUTRAL on a bad Turnstile token (no email, same 200)', async () => {
    const email = `ts-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false)
    const res = await rightsPOST(rightsReq({ email, locale: 'en' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(sendSpy).not.toHaveBeenCalled() // Turnstile blocked the email-emission
  })

  it('DSAR access returns the token holder data; neutral for bad/short tokens; excludes anonymized', async () => {
    const email = `access-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, email))
    await rightsPOST(rightsReq({ email, locale: 'en' }))
    const { raw } = generateWaitlistDsarToken(siteId, email)

    const ok = await dsarGET(new Request('http://localhost'), dsarCtx(raw))
    const okJson = await ok.json() as { data: Array<Record<string, unknown>> }
    expect(ok.status).toBe(200)
    expect(okJson.data.length).toBe(1)
    expect(okJson.data[0]!.email).toBe(email)
    expect(okJson.data[0]).not.toHaveProperty('ip')
    expect(okJson.data[0]).not.toHaveProperty('user_agent')

    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx('short'))).json()).data).toEqual([])
    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx('f'.repeat(64)))).json()).data).toEqual([])

    await db.rpc('waitlist_erase_by_email', { p_site_id: siteId, p_email: email, p_ip: null, p_user_agent: null })
    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx(raw))).json()).data).toEqual([])
  })

  it('DSAR access is neutral for an EXPIRED (>7d) or USED token — even with live data (G + replay)', async () => {
    const emailOld = `old-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, emailOld))
    const oldTok = generateWaitlistDsarToken(siteId, emailOld)
    // Directly seed an 8-day-old token (bypassing the rights route, which would refresh created_at).
    await db.from('waitlist_dsar_tokens').upsert(
      { token_hash: oldTok.hash, site_id: siteId, email: emailOld, used_at: null, created_at: new Date(Date.now() - 8 * DAY).toISOString() },
      { onConflict: 'site_id,email' },
    )
    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx(oldTok.raw))).json()).data).toEqual([]) // expired

    const emailUsed = `used-${Date.now()}@example.com`
    cleanup.push(await seedSignup(siteId, emailUsed))
    const usedTok = generateWaitlistDsarToken(siteId, emailUsed)
    await db.from('waitlist_dsar_tokens').upsert(
      { token_hash: usedTok.hash, site_id: siteId, email: emailUsed, used_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { onConflict: 'site_id,email' },
    )
    expect((await (await dsarGET(new Request('http://localhost'), dsarCtx(usedTok.raw))).json()).data).toEqual([]) // burned

    // Sanity: a FRESH request re-arms the same (site,email) → access works again.
    await rightsPOST(rightsReq({ email: emailUsed, locale: 'en' }))
    const after = await dsarGET(new Request('http://localhost'), dsarCtx(usedTok.raw))
    expect((await after.json() as { data: unknown[] }).data.length).toBe(1)
  })
})
