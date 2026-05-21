import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase builder ──────────────────────────────────────────────────

let mockSupabaseData: Record<string, unknown> = {}

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const row = { id: 'ed-1', subject: 'Test Edition', status: 'draft', site_id: 'site-1', ...overrides }
  mockSupabaseData = row

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

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: () => Promise.resolve(),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => Promise.resolve({ ok: true, user: { id: 'user-1' } }),
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

// Default: user with email
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

// Mock @react-email/render
const mockRender = vi.fn().mockResolvedValue('<html><body>rendered email</body></html>')
vi.mock('@react-email/render', () => ({
  render: (...args: unknown[]) => mockRender(...args),
}))

// Mock email templates
vi.mock('@/emails/confirm', () => ({
  ConfirmEmail: vi.fn().mockReturnValue('confirm-element'),
}))

vi.mock('@/emails/welcome', () => ({
  WelcomeEmail: vi.fn().mockReturnValue('welcome-element'),
}))

// Mock email service
const mockSend = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/lib/email/service', () => ({
  getEmailService: () => ({ send: mockSend }),
}))

// Mock newsletter email-sanitizer (pulled in by renderEmailPreview)
vi.mock('@/lib/newsletter/email-sanitizer', () => ({
  sanitizeForEmail: vi.fn().mockReturnValue('<p>sanitized</p>'),
}))

// Mock the newsletter template (used by renderEmailPreview)
vi.mock('@/emails/newsletter', () => ({
  Newsletter: vi.fn().mockReturnValue('newsletter-element'),
}))

// Mock media tracker (pulled by actions.ts)
vi.mock('@/lib/media/track-usage', () => ({
  trackMediaUsage: vi.fn(),
}))

// Mock SEO cache invalidation (pulled by actions.ts)
vi.mock('@/lib/seo/cache-invalidation', () => ({
  revalidateNewsletterTypeSeo: vi.fn(),
}))

// Mock cadence slots (pulled by actions.ts)
vi.mock('@/lib/newsletter/cadence-slots', () => ({
  generateCadenceSlots: vi.fn().mockReturnValue([]),
  describePattern: vi.fn().mockReturnValue(''),
  computeScheduledAt: vi.fn().mockReturnValue('2026-01-01T09:00:00Z'),
}))

// Mock cms/format-site-datetime (pulled by actions.ts)
vi.mock('@/lib/cms/format-site-datetime', () => ({
  todayInSiteTz: vi.fn().mockReturnValue('2026-01-01'),
}))

// Mock social create-from-content (pulled by actions.ts sendNow)
vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: vi.fn(),
}))

// ─── Import actions under test ─────────────────────────────────────────────

import {
  renderTestTemplate,
  sendTestTemplate,
  _resetRateLimits,
} from '@/app/cms/(authed)/newsletters/actions-test-center'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Test Center Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRender.mockResolvedValue('<html><body>rendered email</body></html>')
    mockSend.mockResolvedValue({ ok: true })
    mockUserEmail = 'admin@test.com'
    mockUserId = 'user-1'
    mockSupabase = createMockSupabase()
    _resetRateLimits()
  })

  // ── renderTestTemplate ─────────────────────────────────────────────────

  describe('renderTestTemplate', () => {
    it('renders confirm template for pt-BR', async () => {
      const result = await renderTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toContain('rendered email')
      expect(result.sizeBytes).toBeGreaterThan(0)
    })

    it('renders welcome template for en', async () => {
      const result = await renderTestTemplate('welcome', 'en')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toContain('rendered email')
      expect(result.sizeBytes).toBeGreaterThan(0)
    })

    it('delegates edition template to renderEmailPreview', async () => {
      mockSupabase = createMockSupabase({
        content_html: '<p>Hello</p>',
        newsletter_type_id: 'type-1',
      })

      const result = await renderTestTemplate('edition', 'pt-BR', { editionId: 'ed-1' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.html).toBeDefined()
    })

    it('returns edition_id_required when edition template has no editionId', async () => {
      const result = await renderTestTemplate('edition', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('edition_id_required')
    })

    it('returns invalid_template for unknown template', async () => {
      const result = await renderTestTemplate('invalid', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('invalid_template')
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
      expect(callArgs.html).toContain('rendered email')
    })

    it('sends welcome template with English subject', async () => {
      const result = await sendTestTemplate('welcome', 'en')
      expect(result.ok).toBe(true)
      expect(mockSend).toHaveBeenCalledOnce()

      const callArgs = mockSend.mock.calls[0]![0]
      expect(callArgs.subject).toBe('[TEST] Welcome to the newsletters')
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

    it('returns error when email service throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('SMTP connection refused'))

      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('SMTP connection refused')
    })

    it('returns invalid_template error for unknown template', async () => {
      const result = await sendTestTemplate('nonexistent', 'en')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('invalid_template')
    })

    it('enforces hourly cap of 10 sends', async () => {
      let clock = Date.now()
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock)

      for (let i = 0; i < 10; i++) {
        clock += 61_000 // advance past 60s cooldown each time
        const r = await sendTestTemplate('confirm', 'pt-BR')
        expect(r.ok).toBe(true)
      }

      // 11th send within the same hour should fail
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

      // Fill up to hourly cap
      for (let i = 0; i < 10; i++) {
        clock += 61_000
        await sendTestTemplate('confirm', 'pt-BR')
      }

      // Advance past 1 hour from first send
      clock += 3_600_000 + 61_000

      const result = await sendTestTemplate('confirm', 'pt-BR')
      expect(result.ok).toBe(true)

      spy.mockRestore()
    })
  })
})
