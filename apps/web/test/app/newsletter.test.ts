/**
 * Tests for newsletter subscribe action, confirm page, and unsubscribe page.
 *
 * All Supabase calls, email, and site context are mocked.
 * No real network or DB required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Module mocks (must be before imports) ────────────────────────────────────

const fromMock = vi.fn()
const rpcMock = vi.fn()
const supabaseMock = {
  from: fromMock,
  rpc: rpcMock,
}

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => supabaseMock,
}))

vi.mock('../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn(),
}))

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ messageId: 'test-123', provider: 'ses' }),
}))
vi.mock('../../lib/email/service', () => ({
  getEmailService: () => ({ send: sendMock }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (key: string) => {
        if (key === 'x-forwarded-for') return null
        return null
      },
    }),
}))


// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { subscribeToNewsletter } from '../../src/app/newsletter/subscribe/actions'
import { unsubscribeViaToken } from '../../src/app/unsubscribe/[token]/actions'
import { verifyTurnstileToken } from '../../lib/turnstile'
import { getSiteContext } from '../../lib/cms/site-context'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v)
  }
  return fd
}

/** Build a chainable Supabase query mock that ends with maybeSingle() */
function makeSbChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  fromMock.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  // Ensure Turnstile is off for most tests (no site key)
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Re-apply default mock implementations after clearAllMocks
  vi.mocked(getSiteContext).mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  })
  sendMock.mockResolvedValue(undefined)
  vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
  // Default rate-check response: allowed. Individual tests can override via
  // mockResolvedValueOnce for the unsubscribe RPC path.
  rpcMock.mockResolvedValue({ data: true, error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
})

// ─── subscribeToNewsletter ────────────────────────────────────────────────────

describe('subscribeToNewsletter', () => {
  it('returns error:invalid_email for bad email', async () => {
    const fd = makeFormData({
      email: 'not-an-email',
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'invalid_email' })
  })

  it('returns error:consent_required when consent_processing missing', async () => {
    const fd = makeFormData({
      email: 'user@example.com',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'consent_required' })
  })

  it('returns error:consent_required when consent_marketing missing', async () => {
    const fd = makeFormData({
      email: 'user@example.com',
      consent_processing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'consent_required' })
  })

  it('returns error:turnstile_failed when Turnstile check fails', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'key-test'
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false)

    const fd = makeFormData({
      email: 'user@example.com',
      consent_processing: 'on',
      consent_marketing: 'on',
      turnstile_token: 'bad',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'turnstile_failed' })
  })

  it('happy path: inserts new subscription and returns ok', async () => {
    // from() is called twice: once for select (maybeSingle), once for insert
    fromMock
      // First call: select existing subscription → not found
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })
      // Second call: insert new subscription → success
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

    const fd = makeFormData({
      email: 'newuser@example.com',
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'ok' })
    expect(sendMock).toHaveBeenCalledOnce()
  })

  it('returns ok (no oracle) when confirmed subscription already exists', async () => {
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'sub-1', status: 'confirmed' },
        error: null,
      }),
    })

    const fd = makeFormData({
      email: 'existing@example.com',
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'ok' })
    // Must not leak the duplicate state by re-sending a confirm email.
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('re-sends confirm email for pending_confirmation existing subscription', async () => {
    // from() called twice: select (maybeSingle finds pending), then update chain
    fromMock
      // First: select existing — returns pending
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'sub-2', status: 'pending_confirmation' },
          error: null,
        }),
      })
      // Second: update → eq (chain) → resolves with no error
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

    const fd = makeFormData({
      email: 'pending@example.com',
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'ok' })
    expect(sendMock).toHaveBeenCalledOnce()
  })

  it('handles DB unique constraint race as ok (no oracle)', async () => {
    fromMock
      // First: select existing — not found
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })
      // Second: insert — unique violation
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
      })

    const fd = makeFormData({
      email: 'race@example.com',
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'ok' })
  })

  it('returns captcha_required when site key configured but token missing', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'key-test'
    const fd = makeFormData({
      email: 'user@example.com',
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)
    expect(result).toEqual({ status: 'error', code: 'captcha_required' })
  })

  it('re-subscribes a previously anonymized-unsubscribed email in-place (one row, raw email restored)', async () => {
    // Simulate: user subscribed before, unsubscribed via token → RPC anonymized
    // the row (email stored as sha256). User comes back and re-subscribes with
    // the SAME raw email. The select must match via the hashed-email branch
    // of the .or() filter; the update must restore the raw email + rotate
    // token + clear unsubscribed_at, without inserting a new row.
    const { createHash } = await import('node:crypto')
    const rawEmail = 'comeback@example.com'
    const emailHash = createHash('sha256').update(rawEmail).digest('hex')

    const updateMock = vi.fn().mockReturnThis()
    const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const insertMock = vi.fn()

    fromMock
      // First: select existing row — .or() match via hashed email
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'sub-unsub-1', status: 'unsubscribed', email: emailHash },
          error: null,
        }),
      })
      // Second: update in place (NOT insert)
      .mockReturnValueOnce({
        update: updateMock,
        eq: updateEqMock,
        insert: insertMock,
      })

    const fd = makeFormData({
      email: rawEmail,
      consent_processing: 'on',
      consent_marketing: 'on',
    })
    const result = await subscribeToNewsletter(fd)

    expect(result).toEqual({ status: 'ok' })
    // Exactly one row preserved: update called, insert never called.
    expect(updateMock).toHaveBeenCalledOnce()
    expect(insertMock).not.toHaveBeenCalled()
    // The update payload must restore the raw email + reset unsubscribed_at.
    const updatePayload = updateMock.mock.calls[0]![0] as Record<string, unknown>
    expect(updatePayload.email).toBe(rawEmail)
    expect(updatePayload.status).toBe('pending_confirmation')
    expect(updatePayload.unsubscribed_at).toBeNull()
    // New confirm email dispatched (double-opt-in re-required).
    expect(sendMock).toHaveBeenCalledOnce()
  })
})

// ─── unsubscribeViaToken ──────────────────────────────────────────────────────

describe('unsubscribeViaToken', () => {
  it('returns not_found for empty token', async () => {
    const result = await unsubscribeViaToken('')
    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns ok on successful unsubscribe', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    })
    const result = await unsubscribeViaToken('valid-token-64chars')
    expect(result).toEqual({ status: 'ok' })
    expect(rpcMock).toHaveBeenCalledWith('unsubscribe_via_token', {
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  })

  it('returns already when token was already used', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: true, already: true },
      error: null,
    })
    const result = await unsubscribeViaToken('already-used-token')
    expect(result).toEqual({ status: 'already' })
  })

  it('returns not_found when RPC returns ok:false, error:not_found', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, error: 'not_found' },
      error: null,
    })
    const result = await unsubscribeViaToken('ghost-token')
    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns error when RPC returns a Supabase error', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'db error' },
    })
    const result = await unsubscribeViaToken('any-token')
    expect(result).toEqual({ status: 'error' })
  })
})
