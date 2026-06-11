/**
 * Subscriber lifecycle pinning tests: subscribe → confirm → unsubscribe edges.
 *
 * Pins the contract of the public subscription flow:
 *  - subscribe writes pending_confirmation with HASHED token + expiry + LGPD
 *    consent fields + UTM/referrer attribution (commit 5a4316c3)
 *  - duplicate subscribe re-issues the token on the SAME row (no dup rows)
 *  - already-confirmed subscribe is a polite no-op (no status regression)
 *  - suppressed (bounced/complained) emails are NEVER silently re-activated
 *  - confirm action maps RPC results (success/already/expired/not_found/error)
 *  - the raw confirmation token never reaches a DB write payload
 *
 * All Supabase/email/site-context calls mocked — no network, no DB.
 * DB-side semantics of the RPCs themselves are pinned by the DB-gated suites
 * in test/integration/rpc-confirm-newsletter.test.ts / rpc-unsubscribe.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ─── Hoisted fixtures ─────────────────────────────────────────────────────────

const {
  RAW_TOKEN,
  sendConfirmMock,
  fromMock,
  rpcMock,
  headersMock,
  verifyTurnstileMock,
  getClientIpMock,
  isValidInetMock,
  getSiteContextMock,
} = vi.hoisted(() => ({
  // Deterministic 64-hex "raw" token so hashed-at-rest assertions are exact.
  RAW_TOKEN: 'deadbeef'.repeat(8),
  sendConfirmMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  headersMock: vi.fn(),
  verifyTurnstileMock: vi.fn(),
  getClientIpMock: vi.fn(),
  isValidInetMock: vi.fn(),
  getSiteContextMock: vi.fn(),
}))

const RAW_TOKEN_SHA256 = createHash('sha256').update(RAW_TOKEN).digest('hex')

// ─── Module mocks (before SUT imports) ────────────────────────────────────────

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock, rpc: rpcMock }),
}))

vi.mock('../../lib/turnstile', () => ({
  verifyTurnstileToken: verifyTurnstileMock,
}))

vi.mock('../../lib/request-ip', () => ({
  getClientIp: getClientIpMock,
  isValidInet: isValidInetMock,
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: getSiteContextMock,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  getClient: () => undefined,
}))

vi.mock('next/headers', () => ({
  headers: headersMock,
}))

// Partial mock: keep the REAL hashConfirmToken (sha256) so hashed-at-rest
// assertions exercise production hashing; pin generateConfirmToken to a known
// raw value and stub the email send.
vi.mock('../../lib/newsletter/confirm-email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/newsletter/confirm-email')>()
  return {
    ...actual,
    generateConfirmToken: () => RAW_TOKEN,
    sendNewsletterConfirmEmail: sendConfirmMock,
  }
})

vi.mock('@/lib/newsletter/suggestions', () => ({
  getFilteredSuggestionsForSubscriber: vi.fn().mockResolvedValue([]),
}))

// ─── SUT imports (after mocks) ────────────────────────────────────────────────

import { subscribeToNewsletter } from '../../src/app/newsletter/subscribe/actions'
import { subscribeToNewsletters } from '../../src/app/(public)/actions/subscribe-newsletters'
import { confirmSubscription } from '../../src/app/newsletter/confirm/[token]/actions'
import { NEWSLETTER_CONSENT_VERSION } from '../../src/app/newsletter/consent'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

function validSubscribeForm(extra: Record<string, string> = {}): FormData {
  return makeFormData({
    email: 'lifecycle@example.com',
    consent_processing: 'on',
    consent_marketing: 'on',
    ...extra,
  })
}

/** select(...).eq(...)…maybeSingle() chain resolving to the given row. */
function selectChain(row: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  }
}

/** newsletter_types lookup chain (fetched before sending the confirm email). */
function newsletterTypesChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [{ id: 'main-pt', name: 'Main' }], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Main' }, error: null }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  // Re-apply default implementations (clearAllMocks wipes calls; keep defaults
  // explicit per-test-run, mirroring test/app/newsletter.test.ts).
  headersMock.mockResolvedValue(
    new Headers({
      'user-agent': 'LifecycleTest/1.0',
      referer: 'https://www.youtube.com/watch?v=abc123',
      'x-forwarded-for': '203.0.113.42',
    }),
  )
  verifyTurnstileMock.mockResolvedValue(true)
  getClientIpMock.mockReturnValue('203.0.113.42')
  isValidInetMock.mockReturnValue(true)
  getSiteContextMock.mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  })
  // rate check allowed by default
  rpcMock.mockResolvedValue({ data: true, error: null })
  sendConfirmMock.mockResolvedValue(true)
})

// ─── 1. Subscribe: insert payload (token at rest, consent, attribution) ──────

describe('subscribe — pending_confirmation insert payload', () => {
  function mockNewSubscriberFlow() {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
    fromMock
      .mockReturnValueOnce(selectChain(null)) // lookup by raw email → none
      .mockReturnValueOnce(selectChain(null)) // lookup by email hash → none
      .mockReturnValueOnce({ insert: insertMock }) // insert new row
      .mockReturnValueOnce(newsletterTypesChain()) // name fetch for email copy
    return insertMock
  }

  it('creates pending_confirmation with hashed token, 24h expiry and LGPD consent fields', async () => {
    const insertMock = mockNewSubscriberFlow()
    const before = Date.now()

    const result = await subscribeToNewsletter(validSubscribeForm())
    expect(result).toEqual({ status: 'ok' })

    expect(insertMock).toHaveBeenCalledOnce()
    const payload = insertMock.mock.calls[0]![0] as Record<string, unknown>

    expect(payload.status).toBe('pending_confirmation')
    expect(payload.email).toBe('lifecycle@example.com')
    // Token at rest = sha256(raw), never the raw token itself.
    expect(payload.confirmation_token_hash).toBe(RAW_TOKEN_SHA256)
    expect(payload.confirmation_token_hash).not.toBe(RAW_TOKEN)
    // Expiry ≈ now + 24h (allow 5 min of slack).
    const expiresAt = Date.parse(payload.confirmation_expires_at as string)
    expect(expiresAt).toBeGreaterThan(before + 24 * 60 * 60 * 1000 - 5 * 60 * 1000)
    expect(expiresAt).toBeLessThan(before + 24 * 60 * 60 * 1000 + 5 * 60 * 1000)
    // LGPD consent capture: server-side version + ip + user_agent.
    expect(payload.consent_text_version).toBe(NEWSLETTER_CONSENT_VERSION)
    expect(payload.ip).toBe('203.0.113.42')
    expect(payload.user_agent).toBe('LifecycleTest/1.0')
  })

  it('captures UTM attribution from the form and referrer from the request header (5a4316c3)', async () => {
    const insertMock = mockNewSubscriberFlow()

    await subscribeToNewsletter(
      validSubscribeForm({
        utm_source: 'youtube',
        utm_medium: 'video',
        utm_campaign: 'launch-2026',
        utm_content: 'pinned-comment',
        utm_term: 'newsletter',
      }),
    )

    const payload = insertMock.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.utm_source).toBe('youtube')
    expect(payload.utm_medium).toBe('video')
    expect(payload.utm_campaign).toBe('launch-2026')
    expect(payload.utm_content).toBe('pinned-comment')
    expect(payload.utm_term).toBe('newsletter')
    expect(payload.referrer).toBe('https://www.youtube.com/watch?v=abc123')
  })

  it('stores null attribution when no UTM params / referrer are present', async () => {
    const insertMock = mockNewSubscriberFlow()
    headersMock.mockResolvedValue(new Headers({ 'user-agent': 'LifecycleTest/1.0' }))

    await subscribeToNewsletter(validSubscribeForm())

    const payload = insertMock.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.utm_source).toBeNull()
    expect(payload.utm_medium).toBeNull()
    expect(payload.utm_campaign).toBeNull()
    expect(payload.utm_content).toBeNull()
    expect(payload.utm_term).toBeNull()
    expect(payload.referrer).toBeNull()
  })

  it('never writes the raw confirmation token to the DB; the email gets the raw token', async () => {
    const insertMock = mockNewSubscriberFlow()

    await subscribeToNewsletter(validSubscribeForm())

    // No DB write payload may contain the plaintext token.
    const serialized = JSON.stringify(insertMock.mock.calls)
    expect(serialized).not.toContain(RAW_TOKEN)
    expect(serialized).toContain(RAW_TOKEN_SHA256)
    // The confirm email is the ONLY place the raw token goes.
    expect(sendConfirmMock).toHaveBeenCalledOnce()
    expect(sendConfirmMock.mock.calls[0]![0]).toMatchObject({
      to: 'lifecycle@example.com',
      rawToken: RAW_TOKEN,
    })
  })
})

// ─── 2. Duplicate subscribe: pending re-issue / confirmed no-op ───────────────

describe('subscribe — duplicate handling', () => {
  it('re-issues the token on the SAME row for an existing pending email (no second row)', async () => {
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: updateEq })
    const insertMock = vi.fn()

    fromMock
      .mockReturnValueOnce(
        selectChain({ id: 'sub-pending', status: 'pending_confirmation', email: 'lifecycle@example.com' }),
      )
      .mockReturnValueOnce({ update: updateMock, insert: insertMock })
      .mockReturnValueOnce(newsletterTypesChain())

    const result = await subscribeToNewsletter(validSubscribeForm())
    expect(result).toEqual({ status: 'ok' })

    // One row: update in place, never insert.
    expect(updateMock).toHaveBeenCalledOnce()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateEq).toHaveBeenCalledWith('id', 'sub-pending')

    const payload = updateMock.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.status).toBe('pending_confirmation')
    expect(payload.confirmation_token_hash).toBe(RAW_TOKEN_SHA256) // fresh hashed token
    expect(payload.consent_text_version).toBe(NEWSLETTER_CONSENT_VERSION)
    expect(payload.unsubscribed_at).toBeNull()
    expect(JSON.stringify(payload)).not.toContain(RAW_TOKEN)
    // Fresh confirmation email re-sent.
    expect(sendConfirmMock).toHaveBeenCalledOnce()
  })

  it('already-confirmed email is a polite no-op: ok, no insert/update, no email, no regression', async () => {
    fromMock.mockReturnValueOnce(
      selectChain({ id: 'sub-confirmed', status: 'confirmed', email: 'lifecycle@example.com' }),
    )

    const result = await subscribeToNewsletter(validSubscribeForm())
    expect(result).toEqual({ status: 'ok' })

    // Only the lookup hit the DB — no write of any kind (status stays confirmed).
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(sendConfirmMock).not.toHaveBeenCalled()
  })
})

// ─── 3. Suppressed (bounced/complained) emails ────────────────────────────────

describe('subscribe — suppressed (bounced/complained) emails', () => {
  it.each(['bounced', 'complained'] as const)(
    '%s subscriber: silent ok with NO reactivation, NO write, NO email',
    async (status) => {
      fromMock.mockReturnValueOnce(
        selectChain({ id: 'sub-suppressed', status, email: 'lifecycle@example.com' }),
      )

      const result = await subscribeToNewsletter(validSubscribeForm())
      // No-oracle response: looks identical to success from the outside…
      expect(result).toEqual({ status: 'ok' })
      // …but nothing is re-activated: the lookup is the only DB touch.
      expect(fromMock).toHaveBeenCalledTimes(1)
      expect(sendConfirmMock).not.toHaveBeenCalled()
    },
  )

  it('multi-action: bounced subscriber is reported in subscribedIds but never re-activated or emailed', async () => {
    const insertMock = vi.fn()
    const updateMock = vi.fn()
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'sub-bounced', status: 'bounced' },
            error: null,
          }),
        }),
      }),
      insert: insertMock,
      update: updateMock,
    })

    const result = await subscribeToNewsletters('lifecycle@example.com', ['nl-1'], 'en')

    // Pin actual behavior: reports success (no suppression oracle)…
    expect(result.success).toBe(true)
    expect(result.subscribedIds).toEqual(['nl-1'])
    expect(result.needsConfirmation).toBe(false)
    // …without resurrecting the bounced address (reputation-safe).
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(sendConfirmMock).not.toHaveBeenCalled()
  })
})

// ─── 4. Confirm action (token → confirmed) ────────────────────────────────────

describe('confirm — confirmSubscription action', () => {
  it('hashes the raw token (sha256) before calling the confirm RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, site_id: 'site-1', email: 'lifecycle@example.com', confirmed_count: 1 },
      error: null,
    })

    const result = await confirmSubscription(RAW_TOKEN)

    expect(rpcMock).toHaveBeenCalledWith('confirm_newsletter_subscription', {
      p_token_hash: RAW_TOKEN_SHA256,
    })
    // Raw token never sent to the DB layer.
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain(`"${RAW_TOKEN}"`)
    expect(result).toEqual({
      state: 'success',
      siteId: 'site-1',
      email: 'lifecycle@example.com',
    })
  })

  it('maps already-confirmed (idempotent re-confirm) to state already', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, already: true, site_id: 'site-1', email: 'lifecycle@example.com' },
      error: null,
    })
    const result = await confirmSubscription(RAW_TOKEN)
    expect(result).toEqual({
      state: 'already',
      siteId: 'site-1',
      email: 'lifecycle@example.com',
    })
  })

  it('rejects an expired token (state expired, never confirmed)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, error: 'expired' },
      error: null,
    })
    const result = await confirmSubscription(RAW_TOKEN)
    expect(result).toEqual({ state: 'expired' })
  })

  it('rejects an invalid/reused token (state not_found — RPC nulls the hash after success)', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, error: 'not_found' },
      error: null,
    })
    const result = await confirmSubscription('0'.repeat(64))
    expect(result).toEqual({ state: 'not_found' })
  })

  it('FIX: ok with confirmed_count=0 (row no longer pending) maps to not_found — never a false success', async () => {
    // The RPC returns ok even when the matched row is not pending_confirmation
    // anymore (e.g. unsubscribed between email and click) — the UPDATE flips 0
    // rows. Reporting 'success' would tell the user they're subscribed while
    // nothing was confirmed; map it to the friendly not_found state instead.
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, site_id: 'site-1', email: 'lifecycle@example.com', confirmed_count: 0 },
      error: null,
    })
    const result = await confirmSubscription(RAW_TOKEN)
    expect(result).toEqual({ state: 'not_found' })
  })

  it('maps invalid_state and RPC errors to state error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, error: 'invalid_state' },
      error: null,
    })
    expect(await confirmSubscription(RAW_TOKEN)).toEqual({ state: 'error' })

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
    expect(await confirmSubscription(RAW_TOKEN)).toEqual({ state: 'error' })
  })
})

// ─── 5. Re-subscribe after unsubscribe (multi-newsletter action) ─────────────

describe('re-subscribe after unsubscribe — subscribeToNewsletters', () => {
  it('unsubscribed (anonymized) email gets a FRESH pending row — new double opt-in, no auto-reactivation', async () => {
    // After one-click unsubscribe, the RPC flips status AND hashes the email in
    // place, so the raw email no longer matches any row → the multi action
    // inserts a brand-new pending_confirmation row (full double opt-in again).
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [{ id: 'nl-1', name: 'Main' }], error: null }),
      }),
      insert: insertMock,
    }))

    const result = await subscribeToNewsletters('comeback@example.com', ['nl-1'], 'en')

    expect(result).toEqual({ success: true, subscribedIds: ['nl-1'], needsConfirmation: true })
    expect(insertMock).toHaveBeenCalledOnce()
    const payload = insertMock.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.status).toBe('pending_confirmation')
    expect(payload.confirmation_token_hash).toBe(RAW_TOKEN_SHA256)
    expect(sendConfirmMock).toHaveBeenCalledOnce()
  })

  /**
   * Builds the post-insert from() mock for the 23505-race fallback:
   * update(...).eq×3.neq×3.select('id') resolving to `updatedRows`.
   */
  function mockRaceFallbackFlow(updatedRows: Array<{ id: string }>) {
    const fallbackChain = {
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: updatedRows, error: null }),
    }
    const fallbackUpdateMock = vi.fn().mockReturnValue(fallbackChain)
    const insertMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })
    let insertDone = false
    fromMock.mockImplementation(() => {
      if (insertDone) {
        return {
          update: fallbackUpdateMock,
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'nl-1', name: 'Main' }], error: null }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: (...args: unknown[]) => {
          insertDone = true
          return insertMock(...args)
        },
      }
    })
    return { fallbackUpdateMock, fallbackChain, insertMock }
  }

  it('FIX: 23505-race fallback reactivates the row — status back to pending_confirmation, unsubscribed_at cleared', async () => {
    // If a row with the same raw email exists but is status='unsubscribed'
    // (e.g. manual CMS unsubscribe / legacy raw-email rows), the select
    // excludes it (.neq), insert hits the unique constraint, and the fallback
    // update must FULLY reactivate the row (same shape as the in-place
    // reactivation path): status='pending_confirmation' + unsubscribed_at
    // cleared + fresh hashed token. Otherwise the confirm RPC (which only
    // flips status='pending_confirmation' rows) updates 0 rows while
    // reporting ok and the subscriber stays unsubscribed forever.
    const { fallbackUpdateMock, fallbackChain } = mockRaceFallbackFlow([{ id: 'sub-ghost' }])

    const result = await subscribeToNewsletters('ghost@example.com', ['nl-1'], 'en')

    expect(result).toEqual({ success: true, subscribedIds: ['nl-1'], needsConfirmation: true })
    expect(fallbackUpdateMock).toHaveBeenCalledOnce()
    const payload = fallbackUpdateMock.mock.calls[0]![0] as Record<string, unknown>
    // Token rotated (hashed at rest)…
    expect(payload.confirmation_token_hash).toBe(RAW_TOKEN_SHA256)
    expect(payload.consent_text_version).toBe(NEWSLETTER_CONSENT_VERSION)
    // …AND the row is moved back to pending + un-unsubscribed (the fix).
    expect(payload.status).toBe('pending_confirmation')
    expect(payload.unsubscribed_at).toBeNull()
    // Guard pinned at the query level: suppressed rows (and concurrently
    // confirmed rows) are excluded from the reactivation update.
    expect(fallbackChain.neq).toHaveBeenCalledWith('status', 'bounced')
    expect(fallbackChain.neq).toHaveBeenCalledWith('status', 'complained')
    expect(fallbackChain.neq).toHaveBeenCalledWith('status', 'confirmed')
    // Fresh double opt-in: confirm email goes out.
    expect(sendConfirmMock).toHaveBeenCalledOnce()
  })

  it('23505-race fallback never resurrects suppressed rows: 0 rows updated → silent ok, NO confirm email', async () => {
    // A bounced/complained row hit via the race path matches 0 rows in the
    // guarded update (.neq bounced/complained). Behavior mirrors the in-place
    // suppressed branch: report success (no suppression oracle) but send no
    // email and reactivate nothing.
    const { fallbackUpdateMock } = mockRaceFallbackFlow([])

    const result = await subscribeToNewsletters('bounced-ghost@example.com', ['nl-1'], 'en')

    expect(result).toEqual({ success: true, subscribedIds: ['nl-1'], needsConfirmation: false })
    expect(fallbackUpdateMock).toHaveBeenCalledOnce()
    expect(sendConfirmMock).not.toHaveBeenCalled()
  })
})
