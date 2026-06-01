// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase builder ──────────────────────────────────────────────────

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const row = { id: 'ed-1', subject: 'Test Edition', status: 'draft', site_id: 'site-1', ...overrides }

  function makeChain() {
    let useSingle = false
    const chain: Record<string, unknown> = {}

    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'then') {
          const result = useSingle
            ? { data: row, error: null }
            : { data: [row], error: null, count: 1 }
          return (resolve?: (v: unknown) => void) => resolve?.(result)
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            useSingle = true
            return new Proxy(chain, handler)
          }
        }
        if (prop === 'from') {
          return () => makeChain()
        }
        return (..._args: unknown[]) => new Proxy(chain, handler)
      },
    }
    return new Proxy(chain, handler)
  }

  return makeChain()
}

let mockSupabase = createMockSupabase()

// ─── Module mocks (infrastructure only — rendering is REAL) ─────────────────

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: () => Promise.resolve(),
}))

let mockAuthResult: { ok: boolean; user?: { id: string }; reason?: string } = { ok: true, user: { id: 'user-1' } }

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: () => Promise.resolve(mockAuthResult),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
}))

let mockUserEmail: string | null = 'admin@test.com'
let mockUserId: string | null = 'user-1'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: mockUserId
              ? { id: mockUserId, email: mockUserEmail }
              : null,
          },
        }),
    },
  }),
}))

const mockSend = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/lib/email/service', () => ({
  getEmailService: () => ({ send: mockSend }),
}))

vi.mock('@/lib/media/track-usage', () => ({
  trackMediaUsage: vi.fn(),
}))

vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateNewsletterTypeSeo: vi.fn(),
}))

vi.mock('@/lib/newsletter/cadence-slots', () => ({
  generateCadenceSlots: vi.fn().mockReturnValue([]),
  describePattern: vi.fn().mockReturnValue(''),
  computeScheduledAt: vi.fn().mockReturnValue('2026-01-01T09:00:00Z'),
}))

vi.mock('@/lib/cms/format-site-datetime', () => ({
  todayInSiteTz: vi.fn().mockReturnValue('2026-01-01'),
}))

vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (s: Record<string, unknown>) => void) =>
    cb({ setTag: vi.fn(), setExtra: vi.fn() }),
  ),
}))

// ─── Import actions under test ─────────────────────────────────────────────

import {
  renderTestTemplate,
  sendTestTemplate,
  _resetRateLimits,
} from '../../../src/app/cms/(authed)/newsletters/actions-test-center'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Test Center Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({ ok: true })
    mockUserEmail = 'admin@test.com'
    mockUserId = 'user-1'
    mockAuthResult = { ok: true, user: { id: 'user-1' } }
    mockSupabase = createMockSupabase()
    _resetRateLimits()
  })

  // ── renderTestTemplate ─────────────────────────────────────────────────

  describe('renderTestTemplate', () => {
    it('renders confirm template for pt-BR', async () => {
      const result = await renderTestTemplate('confirm', 'pt-BR')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('<html')
      expect(result.sizeBytes).toBeGreaterThan(1024)
    })

    it('renders welcome template for en', async () => {
      const result = await renderTestTemplate('welcome', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('<html')
      expect(result.sizeBytes).toBeGreaterThan(1024)
    })

    it('delegates edition template to renderEmailPreview', async () => {
      mockSupabase = createMockSupabase({
        content_html: '<p>Hello</p>',
        newsletter_type_id: 'type-1',
      })

      const result = await renderTestTemplate('edition', 'pt-BR', { editionId: 'ed-1' })
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('<html')
    })

    it('renders mock edition when no editionId provided', async () => {
      const result = await renderTestTemplate('edition', 'pt-BR')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('<html')
      expect(result.sizeBytes).toBeGreaterThan(1024)
    })

    it('renders mock edition in en locale when no editionId provided', async () => {
      const result = await renderTestTemplate('edition', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('<html')
      expect(result.sizeBytes).toBeGreaterThan(1024)
    })

    it('returns invalid_template for unknown template', async () => {
      const result = await renderTestTemplate('invalid' as 'confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('invalid_template')
    })

    it('returns unauthenticated when user is not logged in', async () => {
      mockAuthResult = { ok: false, reason: 'unauthenticated' }
      const result = await renderTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('unauthenticated')
      }
    })

    it('returns forbidden when user lacks edit scope', async () => {
      mockAuthResult = { ok: false, reason: 'forbidden' }
      const result = await renderTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('forbidden')
      }
    })
  })

  // ── sendTestTemplate ───────────────────────────────────────────────────

  describe('sendTestTemplate', () => {
    it('sends confirm template successfully with [TEST] subject', async () => {
      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(true)
      expect(mockSend).toHaveBeenCalledOnce()

      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.subject).toBe('[TEST] Confirme sua inscrição')
      expect(callArgs.to).toBe('admin@test.com')
      expect(callArgs.html).toContain('<html')
    })

    it('sends welcome template with English subject', async () => {
      const result = await sendTestTemplate('welcome', 'en')
      expect(result.ok).toBe(true)
      expect(mockSend).toHaveBeenCalledOnce()

      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.subject).toBe('[TEST] Welcome to the newsletters')
    })

    it('sends to custom email when toEmail provided', async () => {
      const result = await sendTestTemplate('confirm', 'pt-BR', { toEmail: 'custom@example.com' })
      expect(result.ok).toBe(true)
      expect(mockSend).toHaveBeenCalledOnce()
      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.to).toBe('custom@example.com')
    })

    it('sends edition with default subject when no editionId', async () => {
      const result = await sendTestTemplate('edition', 'pt-BR')
      expect(result.ok).toBe(true)
      expect(mockSend).toHaveBeenCalledOnce()
      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.subject).toBe('[TEST] Newsletter')
    })

    it('rejects invalid email format', async () => {
      const result = await sendTestTemplate('confirm', 'pt-BR', { toEmail: 'not-an-email' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('invalid_email')
      }
    })

    it('falls back to user email when toEmail is empty', async () => {
      const result = await sendTestTemplate('confirm', 'pt-BR', { toEmail: '' })
      expect(result.ok).toBe(true)
      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.to).toBe('admin@test.com')
    })

    it('rate limits rapid second call within 60s', async () => {
      const first = await sendTestTemplate('confirm', 'pt-BR')
      expect(first.ok).toBe(true)

      const second = await sendTestTemplate('confirm', 'pt-BR')
      expect(second.ok).toBe(false)
      if (second.ok) return
      expect(second.error).toBe('rate_limited')
    })

    it('returns no_user_email when user has no email', async () => {
      mockUserEmail = null

      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('no_user_email')
    })

    it('returns no_user_email when user is null', async () => {
      mockUserId = null

      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('no_user_email')
    })

    it('returns generic error code when email service throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('SMTP connection refused'))

      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('email_send_failed')
    })

    it('returns invalid_template error for unknown template', async () => {
      const result = await sendTestTemplate('nonexistent' as 'confirm', 'en')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('invalid_template')
    })

    it('enforces hourly cap of 10 sends', async () => {
      let clock = Date.now()
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock)

      for (let i = 0; i < 10; i++) {
        clock += 61_000
        const r = await sendTestTemplate('confirm', 'pt-BR')
        expect(r.ok).toBe(true)
      }

      clock += 61_000
      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('hourly_limit_exceeded')
      }

      spy.mockRestore()
    })

    it('resets hourly window after 1 hour', async () => {
      let clock = Date.now()
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock)

      for (let i = 0; i < 10; i++) {
        clock += 61_000
        await sendTestTemplate('confirm', 'pt-BR')
      }

      clock += 3_600_000 + 61_000

      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(true)

      spy.mockRestore()
    })
  })

  // ── Real rendering integration ─────────────────────────────────────────

  describe('Real rendering integration', { timeout: 15_000 }, () => {
    it('confirm pt-BR has locale-specific heading', async () => {
      const result = await renderTestTemplate('confirm', 'pt-BR')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Confirme sua inscrição')
      expect(result.html).toContain('Confirmar Inscrição')
    })

    it('confirm en has English heading, not Portuguese', async () => {
      const result = await renderTestTemplate('confirm', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Confirm your subscription')
      expect(result.html).not.toContain('Confirme sua')
    })

    it('welcome pt-BR has newsletter names and pt-BR footer', async () => {
      const result = await renderTestTemplate('welcome', 'pt-BR')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Weekly Digest')
      expect(result.html).toContain('Dev Notes')
      expect(result.html).toContain('Cancelar inscrição')
    })

    it('welcome en has English footer with unsubscribe link', async () => {
      const result = await renderTestTemplate('welcome', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Unsubscribe')
      expect(result.html).toContain('mock-token-test')
    })

    it('edition mock pt-BR has mock content and structure', async () => {
      const result = await renderTestTemplate('edition', 'pt-BR')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Título da Edição de Exemplo')
      expect(result.html).toContain('❦')
    })

    it('edition mock en has English mock content', async () => {
      const result = await renderTestTemplate('edition', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Sample Edition Title')
      expect(result.html).toContain('The best way to predict the future')
    })

    it('all real templates produce >1KB output', async () => {
      const confirm = await renderTestTemplate('confirm', 'pt-BR')
      const welcome = await renderTestTemplate('welcome', 'en')
      const edition = await renderTestTemplate('edition', 'pt-BR')

      expect(confirm, 'confirm render').toMatchObject({ ok: true })
      expect(welcome, 'welcome render').toMatchObject({ ok: true })
      expect(edition, 'edition render').toMatchObject({ ok: true })

      if (confirm.ok) expect(confirm.sizeBytes, 'confirm size').toBeGreaterThan(1024)
      if (welcome.ok) expect(welcome.sizeBytes, 'welcome size').toBeGreaterThan(1024)
      if (edition.ok) expect(edition.sizeBytes, 'edition size').toBeGreaterThan(1024)
    })

    it('templates produce valid HTML documents', async () => {
      const result = await renderTestTemplate('confirm', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('<!DOCTYPE')
      expect(result.html).toContain('<html')
      expect(result.html).toContain('</html>')
    })

    it('EmailShell meta tags are present', async () => {
      const result = await renderTestTemplate('confirm', 'en')
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('x-apple-disable-message-reformatting')
    })

    it('edition via editionId strips XSS', async () => {
      mockSupabase = createMockSupabase({
        content_html: '<p>Safe content</p><script>alert("xss")</script>',
        newsletter_type_id: 'type-1',
      })
      const result = await renderTestTemplate('edition', 'pt-BR', { editionId: 'ed-1' })
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('Safe content')
      expect(result.html).not.toContain('<script')
      expect(result.html).not.toContain('alert')
    })

    it('edition via editionId inlines CSS', async () => {
      mockSupabase = createMockSupabase({
        content_html: '<p>Styled paragraph</p>',
        newsletter_type_id: 'type-1',
      })
      const result = await renderTestTemplate('edition', 'pt-BR', { editionId: 'ed-1' })
      expect(result, `render failed: ${!result.ok ? result.error : ''}`).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.html).toContain('style="')
      expect(result.html).toContain('font-size')
    })

    it('edition via editionId with empty content returns error', async () => {
      mockSupabase = createMockSupabase({
        content_html: '',
        newsletter_type_id: 'type-1',
      })
      const result = await renderTestTemplate('edition', 'pt-BR', { editionId: 'ed-1' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('no_content')
      }
    })

    it('send edition with editionId uses DB subject', async () => {
      mockSupabase = createMockSupabase({
        subject: 'My Custom Edition',
        content_html: '<p>Content</p>',
        newsletter_type_id: 'type-1',
      })
      const result = await sendTestTemplate('edition', 'pt-BR', { editionId: 'ed-1' })
      expect(result.ok).toBe(true)
      expect(mockSend).toHaveBeenCalledOnce()
      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.subject).toBe('[TEST] My Custom Edition')
    })
  })
})
