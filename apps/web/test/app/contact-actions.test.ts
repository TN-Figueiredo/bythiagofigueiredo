import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks must be defined before any imports ─────────────────────────────────

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () =>
    Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('../../lib/email/service', () => ({
  getEmailService: vi.fn(),
}))

vi.mock('../../lib/email/sender', () => ({
  getEmailSender: vi.fn(),
}))

vi.mock('../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@tn-figueiredo/email', () => ({
  contactReceivedTemplate: { name: 'contact-received' },
  contactAdminAlertTemplate: { name: 'contact-admin-alert' },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (key: string) => {
        if (key === 'x-forwarded-for') return '1.2.3.4'
        if (key === 'user-agent') return 'test-agent'
        if (key === 'x-site-id') return 'site-1'
        if (key === 'x-org-id') return 'org-1'
        if (key === 'x-default-locale') return 'pt-BR'
        return null
      },
    }),
}))

// ── Dynamic mock state ───────────────────────────────────────────────────────

let insertResult: { data: unknown; error: unknown } = {
  data: { id: 'sub-1' },
  error: null,
}

let rateCheckResult: { data: unknown; error: unknown } = { data: true, error: null }

const sendTemplateMock = vi.fn().mockResolvedValue({ messageId: 'msg-1' })

function buildSupabaseMock() {
  return {
    rpc: (name: string, _args: unknown) => {
      if (name === 'contact_rate_check') return Promise.resolve(rateCheckResult)
      return Promise.resolve({ data: null, error: null })
    },
    from: (table: string) => {
      if (table === 'contact_submissions') {
        return {
          insert: (_values: unknown) => ({
            select: (_cols: string) => ({
              single: () => Promise.resolve(insertResult),
            }),
          }),
        }
      }
      if (table === 'sent_emails') {
        return {
          insert: (_values: unknown) => Promise.resolve({ data: null, error: null }),
        }
      }
      if (table === 'sites') {
        return {
          select: (_cols: string) => ({
            eq: (_c: string, _v: unknown) => ({
              single: () =>
                Promise.resolve({ data: { contact_notification_email: 'admin@example.com' }, error: null }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }
    },
  }
}

// ── Import after mocks ───────────────────────────────────────────────────────

import { submitContact } from '../../src/app/contact/actions'
import { getSupabaseServiceClient } from '../../lib/supabase/service'
import { getEmailService } from '../../lib/email/service'
import { getEmailSender } from '../../lib/email/sender'
import { verifyTurnstileToken } from '../../lib/turnstile'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'João Silva')
  fd.set('email', 'joao@example.com')
  fd.set('message', 'Olá! Tenho uma dúvida sobre seus serviços.')
  fd.set('consent_processing', 'on')
  fd.set('consent_marketing', 'false')
  fd.set('turnstile_token', 'valid-token-123')
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('submitContact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertResult = { data: { id: 'sub-1' }, error: null }
    rateCheckResult = { data: true, error: null }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(buildSupabaseMock() as ReturnType<typeof getSupabaseServiceClient>)
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    vi.mocked(getEmailService).mockReturnValue({
      sendTemplate: sendTemplateMock,
    } as ReturnType<typeof getEmailService>)
    vi.mocked(getEmailSender).mockResolvedValue({
      email: 'noreply@example.com',
      name: 'My Site',
      brandName: 'My Site',
      primaryColor: '#0070f3',
    })
  })

  it('happy path: returns status:ok', async () => {
    const result = await submitContact(makeFormData())
    expect(result).toEqual({ status: 'ok' })
  })

  it('Turnstile fail: returns captcha_failed', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false)
    const result = await submitContact(makeFormData())
    expect(result).toEqual({ status: 'captcha_failed' })
  })

  it('validation fail (name too short): returns validation', async () => {
    const result = await submitContact(makeFormData({ name: 'X' }))
    expect(result).toEqual({ status: 'validation' })
  })

  it('validation fail (consent_processing missing): returns validation', async () => {
    const fd = makeFormData()
    fd.delete('consent_processing')
    const result = await submitContact(fd)
    expect(result).toEqual({ status: 'validation' })
  })

  it('DB insert error: returns error', async () => {
    insertResult = { data: null, error: { message: 'db error', code: '42P01' } }
    const result = await submitContact(makeFormData())
    expect(result).toEqual({ status: 'error' })
  })

  it('rate limit hit: returns rate_limited', async () => {
    rateCheckResult = { data: false, error: null }
    const result = await submitContact(makeFormData())
    expect(result).toEqual({ status: 'rate_limited' })
  })

  it('sends admin alert and auto-reply', async () => {
    const result = await submitContact(makeFormData())
    expect(result).toEqual({ status: 'ok' })
    // L4: replace flaky 50ms sleep with vi.waitFor — emails are sent in a
    // fire-and-forget background task, so we poll for the two template sends.
    await vi.waitFor(() => {
      const names = sendTemplateMock.mock.calls.map(
        (c) => (c[0] as { name: string }).name,
      )
      expect(names).toContain('contact-received')
      expect(names).toContain('contact-admin-alert')
    })
  })

  it('email failure does not affect ok result (best-effort)', async () => {
    sendTemplateMock.mockRejectedValue(new Error('Brevo down'))
    const result = await submitContact(makeFormData())
    expect(result).toEqual({ status: 'ok' })
  })
})
