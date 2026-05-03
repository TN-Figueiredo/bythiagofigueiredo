import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase builder ──────────────────────────────────────────────────
// A thenable chain mock.  Every method returns `this` so arbitrary
// `.from().select().eq().single()` chains work.  The chain is also a thenable
// so `await supabase.from(...).update(...).eq(...)` resolves to `{ data, error }`.
// `.single()` sets a flag so the resolved shape is `{ data: <row>, error }`.

let mockSupabase: ReturnType<typeof createMockSupabase>

function createMockSupabase(statusToReturn: string, extra: Record<string, unknown> = {}) {
  const row = { id: 'ed-1', status: statusToReturn, newsletter_type_id: 'type-1', site_id: 'site-1', active: true, ...extra }

  // Each `.from()` call creates a fresh chain with its own `useSingle` state
  // so that a `.single()` on one query does not pollute subsequent queries.
  function makeChain() {
    let useSingle = false
    const chain: Record<string, unknown> = {}

    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'then') {
          const result = useSingle
            ? { data: row, error: null }
            : { data: [row], error: null, count: 5 }
          return (resolve?: (v: unknown) => void) => resolve?.(result)
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            useSingle = true
            return new Proxy(chain, handler)
          }
        }
        // `.from()` spawns a fresh chain (independent `useSingle`)
        if (prop === 'from') {
          return () => makeChain()
        }
        // All other methods (select, update, delete, eq, neq, gte, lte,
        // limit, in, insert, head) stay on the same chain.
        return (..._args: unknown[]) => new Proxy(chain, handler)
      },
    }
    return new Proxy(chain, handler)
  }

  const top = makeChain()
  // `.storage` for delete/upload paths (not tested here, avoids import-time errors)
  ;(top as Record<string, unknown>).storage = {
    from: () => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/img.jpg' } }),
    }),
  }
  return top
}

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1' }),
}))
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: () => Promise.resolve(),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => Promise.resolve({ ok: true }),
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
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }),
    },
  }),
}))
// Prevent actual email rendering / sending
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>test</html>'),
}))
vi.mock('@/emails/newsletter', () => ({
  Newsletter: vi.fn().mockReturnValue(null),
}))
vi.mock('@/lib/email/service', () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ ok: true }),
  }),
}))
vi.mock('@/lib/newsletter/email-sanitizer', () => ({
  sanitizeForEmail: vi.fn().mockReturnValue('<p>sanitized</p>'),
}))

import {
  createEdition,
  saveEdition,
  scheduleEdition,
  cancelEdition,
  sendNow,
  revertToDraft,
  sendTestEmail,
  moveEdition,
  swapSlotEdition,
} from '@/app/cms/(authed)/newsletters/actions'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Status transition matrix — actual server action behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── saveEdition ─────────────────────────────────────────────────────────
  describe('saveEdition', () => {
    it.each(['idea', 'draft', 'ready', 'scheduled'])(
      'succeeds for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await saveEdition('ed-1', { subject: 'Updated' })
        expect(result.ok).toBe(true)
      },
    )

    it.each(['sending', 'sent', 'failed', 'cancelled'])(
      'rejects for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await saveEdition('ed-1', { subject: 'Updated' })
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', 'edition_locked')
      },
    )
  })

  // ── scheduleEdition ─────────────────────────────────────────────────────
  describe('scheduleEdition', () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString()

    it.each(['idea', 'draft', 'ready', 'scheduled'])(
      'succeeds for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await scheduleEdition('ed-1', futureDate)
        expect(result.ok).toBe(true)
      },
    )

    it.each(['sending', 'sent', 'failed', 'cancelled'])(
      'rejects for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await scheduleEdition('ed-1', futureDate)
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', 'edition_not_schedulable')
      },
    )

    it('rejects an invalid date format', async () => {
      mockSupabase = createMockSupabase('draft')
      const result = await scheduleEdition('ed-1', 'not-a-date')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'invalid_date_format')
    })

    it('rejects a date in the past', async () => {
      mockSupabase = createMockSupabase('draft')
      const result = await scheduleEdition('ed-1', '2020-01-01T00:00:00Z')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'schedule_in_past')
    })
  })

  // ── cancelEdition ───────────────────────────────────────────────────────
  describe('cancelEdition', () => {
    it.each(['idea', 'draft', 'ready', 'scheduled', 'queued'])(
      'succeeds for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await cancelEdition('ed-1')
        expect(result.ok).toBe(true)
      },
    )

    it.each(['sending', 'sent', 'failed', 'cancelled'])(
      'rejects for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await cancelEdition('ed-1')
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', 'cannot_cancel')
      },
    )
  })

  // ── sendNow ─────────────────────────────────────────────────────────────
  describe('sendNow', () => {
    it.each(['idea', 'draft', 'ready', 'scheduled'])(
      'succeeds for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await sendNow('ed-1')
        expect(result.ok).toBe(true)
      },
    )

    it.each(['sending', 'sent', 'failed', 'cancelled'])(
      'rejects for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await sendNow('ed-1')
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', 'cannot_send')
      },
    )

    it('rejects when no newsletter type assigned', async () => {
      mockSupabase = createMockSupabase('draft', { newsletter_type_id: null })
      const result = await sendNow('ed-1')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'no_type_assigned')
    })
  })

  // ── revertToDraft ───────────────────────────────────────────────────────
  describe('revertToDraft', () => {
    it.each(['cancelled', 'failed'])(
      'succeeds for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await revertToDraft('ed-1')
        expect(result.ok).toBe(true)
      },
    )

    it.each(['idea', 'draft', 'ready', 'scheduled', 'sending', 'sent'])(
      'rejects for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status)
        const result = await revertToDraft('ed-1')
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', 'cannot_revert')
      },
    )
  })

  // ── sendTestEmail ───────────────────────────────────────────────────────
  describe('sendTestEmail', () => {
    it.each(['idea', 'draft', 'ready'])(
      'succeeds for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status, {
          subject: 'Test',
          content_html: '<p>hi</p>',
          content_mdx: null,
          test_sent_at: null,
        })
        const result = await sendTestEmail('ed-1')
        expect(result.ok).toBe(true)
      },
    )

    it.each(['scheduled', 'sending', 'sent', 'failed', 'cancelled'])(
      'rejects for %s status',
      async (status) => {
        mockSupabase = createMockSupabase(status, {
          subject: 'Test',
          content_html: '<p>hi</p>',
          content_mdx: null,
          test_sent_at: null,
        })
        const result = await sendTestEmail('ed-1')
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', 'edition_not_testable')
      },
    )
  })

  // ── createEdition — ephemeral payload ──────────────────────────────────
  describe('createEdition — ephemeral payload', () => {
    it('creates edition with subject only (no type)', async () => {
      mockSupabase = createMockSupabase('draft')
      const result = await createEdition({ subject: 'My Newsletter' })
      expect(result.ok).toBe(true)
      expect(result).toHaveProperty('editionId')
    })

    it('creates edition with full payload', async () => {
      mockSupabase = createMockSupabase('draft')
      const result = await createEdition({
        subject: 'Full Newsletter',
        preheader: 'A great preheader',
        newsletter_type_id: 'type-1',
        content_json: '{"type":"doc","content":[]}',
        content_html: '<p>Hello</p>',
        segment: 'all',
      })
      expect(result.ok).toBe(true)
      expect(result).toHaveProperty('editionId')
    })

    it('rejects empty subject', async () => {
      mockSupabase = createMockSupabase('draft')
      const result = await createEdition({ subject: '' })
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'subject_required')
    })
  })

  // ── sent is terminal ────────────────────────────────────────────────────
  describe('sent is terminal', () => {
    it('save/schedule/cancel/sendNow/revert/test all reject for sent', async () => {
      const futureDate = new Date(Date.now() + 86_400_000).toISOString()

      mockSupabase = createMockSupabase('sent', {
        subject: 'X',
        content_html: '<p>x</p>',
        content_mdx: null,
        test_sent_at: null,
      })
      const save = await saveEdition('ed-1', { subject: 'X' })

      mockSupabase = createMockSupabase('sent')
      const schedule = await scheduleEdition('ed-1', futureDate)

      mockSupabase = createMockSupabase('sent')
      const cancel = await cancelEdition('ed-1')

      mockSupabase = createMockSupabase('sent')
      const send = await sendNow('ed-1')

      mockSupabase = createMockSupabase('sent')
      const revert = await revertToDraft('ed-1')

      mockSupabase = createMockSupabase('sent', {
        subject: 'X',
        content_html: '<p>x</p>',
        content_mdx: null,
        test_sent_at: null,
      })
      const test = await sendTestEmail('ed-1')

      expect(save.ok).toBe(false)
      expect(schedule.ok).toBe(false)
      expect(cancel.ok).toBe(false)
      expect(send.ok).toBe(false)
      expect(revert.ok).toBe(false)
      expect(test.ok).toBe(false)
    })
  })

  // ── moveEdition type gate ────────────────────────────────────────────────
  describe('moveEdition type gate', () => {
    it('rejects move to ready without newsletter_type_id', async () => {
      mockSupabase = createMockSupabase('draft', { newsletter_type_id: null })
      const result = await moveEdition('ed-1', 'ready')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'type_required')
    })

    it('rejects move to scheduled without newsletter_type_id', async () => {
      mockSupabase = createMockSupabase('draft', { newsletter_type_id: null })
      const result = await moveEdition('ed-1', 'scheduled', new Date(Date.now() + 86_400_000).toISOString())
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'type_required')
    })

    it('allows move to ready with newsletter_type_id', async () => {
      mockSupabase = createMockSupabase('draft')
      const result = await moveEdition('ed-1', 'ready')
      expect(result.ok).toBe(true)
    })

    it('allows move to draft without newsletter_type_id', async () => {
      mockSupabase = createMockSupabase('idea', { newsletter_type_id: null })
      const result = await moveEdition('ed-1', 'draft')
      expect(result.ok).toBe(true)
    })
  })

  // ── swapSlotEdition ────────────────────────────────────────────────────
  describe('swapSlotEdition', () => {
    it('rejects invalid date format', async () => {
      mockSupabase = createMockSupabase('ready')
      const result = await swapSlotEdition('ed-new', 'bad-date', 'type-1')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'invalid_date_format')
    })

    it('rejects when slot is not occupied', async () => {
      mockSupabase = createMockSupabase('ready')
      // .single() returns null when no row matches
      const original = createMockSupabase
      mockSupabase = (() => {
        const row = { id: 'ed-new', status: 'ready', newsletter_type_id: 'type-1', site_id: 'site-1', active: true }
        function makeChain(returnNull = false) {
          let useSingle = false
          const handler: ProxyHandler<Record<string, unknown>> = {
            get(_target, prop: string) {
              if (prop === 'then') {
                if (useSingle && returnNull) return (resolve?: (v: unknown) => void) => resolve?.({ data: null, error: null })
                const result = useSingle ? { data: row, error: null } : { data: [row], error: null }
                return (resolve?: (v: unknown) => void) => resolve?.(result)
              }
              if (prop === 'single' || prop === 'maybeSingle') return () => { useSingle = true; return new Proxy({}, handler) }
              return () => new Proxy({}, handler)
            },
          }
          return new Proxy({}, handler)
        }
        let callCount = 0
        return { from: () => { callCount++; return makeChain(callCount === 1) } }
      })() as typeof mockSupabase
      const result = await swapSlotEdition('ed-new', '2026-06-01', 'type-1')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'slot_not_occupied')
    })

    it('rejects when occupant is sending', async () => {
      mockSupabase = createMockSupabase('sending')
      const result = await swapSlotEdition('ed-new', '2026-06-01', 'type-1')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'occupant_locked')
    })

    it('rejects when occupant is sent', async () => {
      mockSupabase = createMockSupabase('sent')
      const result = await swapSlotEdition('ed-new', '2026-06-01', 'type-1')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', 'occupant_locked')
    })
  })
})
