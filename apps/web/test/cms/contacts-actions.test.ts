import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

/* ------------------------------------------------------------------ */
/*  Supabase mock                                                     */
/* ------------------------------------------------------------------ */

const mockRpc = vi.fn()
const mockSingle = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.is = vi.fn().mockReturnValue(chain)
  chain.not = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.range = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.single = mockSingle.mockResolvedValue({
    data: { email: 'user@example.com', name: 'Test User', anonymized_at: null },
    error: null,
  })
  chain.update = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockResolvedValue({ error: null })
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
    rpc: mockRpc.mockResolvedValue({ error: null }),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('@/lib/sentry-wrap', () => ({
  captureServerActionError: vi.fn(),
}))

const mockSend = vi.fn().mockResolvedValue({ messageId: 'msg-1' })

vi.mock('@/lib/email/service', () => ({
  getEmailService: vi.fn(() => ({
    send: mockSend,
    sendTemplate: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
  })),
}))

vi.mock('@/lib/email/sender', () => ({
  getEmailSender: vi.fn().mockResolvedValue({
    email: 'noreply@example.com',
    name: 'Test Site',
    brandName: 'Test Site',
    primaryColor: '#0070f3',
  }),
}))

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('markReplied', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok on valid id', async () => {
    const { markReplied } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await markReplied('sub-1')
    expect(result.ok).toBe(true)
  })

  it('returns error on empty id', async () => {
    const { markReplied } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await markReplied('')
    expect(result.ok).toBe(false)
  })
})

describe('undoMarkReplied', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok on valid id', async () => {
    const { undoMarkReplied } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await undoMarkReplied('sub-1')
    expect(result.ok).toBe(true)
  })

  it('returns error on empty id', async () => {
    const { undoMarkReplied } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await undoMarkReplied('')
    expect(result.ok).toBe(false)
  })
})

describe('anonymizeSubmission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls anonymize_contact_submission RPC', async () => {
    const { anonymizeSubmission } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await anonymizeSubmission('sub-1')
    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('anonymize_contact_submission', {
      p_id: 'sub-1',
    })
  })

  it('returns error when RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({
      error: { message: 'forbidden', code: 'P0001' },
    })
    const { anonymizeSubmission } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await anonymizeSubmission('sub-1')
    expect(result.ok).toBe(false)
  })

  it('returns error on empty id', async () => {
    const { anonymizeSubmission } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await anonymizeSubmission('')
    expect(result.ok).toBe(false)
  })
})

describe('bulkAnonymize', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls RPC for each id', async () => {
    const { bulkAnonymize } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await bulkAnonymize(['sub-1', 'sub-2'])
    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it('returns error on empty array', async () => {
    const { bulkAnonymize } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await bulkAnonymize([])
    expect(result.ok).toBe(false)
  })

  it('reports partial failures', async () => {
    mockRpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { message: 'not_found', code: 'P0001' },
      })
    const { bulkAnonymize } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await bulkAnonymize(['sub-1', 'sub-2'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('1')
    }
  })
})

describe('sendReply', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates subject is required', async () => {
    const { sendReply } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await sendReply('sub-1', { subject: '', body: 'hello' })
    expect(result.ok).toBe(false)
  })

  it('validates body is required', async () => {
    const { sendReply } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await sendReply('sub-1', { subject: 'Re:', body: '' })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid input', async () => {
    const { sendReply } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await sendReply('sub-1', {
      subject: 'Re: your message',
      body: 'Thank you for reaching out.',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects reply to anonymized submission', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        email: 'user@example.com',
        name: 'Test',
        anonymized_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })
    const { sendReply } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await sendReply('sub-1', {
      subject: 'Re: your message',
      body: 'Test body',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('anonymized')
    }
  })

  it('returns error on empty id', async () => {
    const { sendReply } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await sendReply('', { subject: 'Re:', body: 'test' })
    expect(result.ok).toBe(false)
  })
})

describe('exportContacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates period enum', async () => {
    const { exportContacts } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await exportContacts('invalid', 'all')
    expect(result.ok).toBe(false)
  })

  it('validates status enum', async () => {
    const { exportContacts } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await exportContacts('30d', 'invalid')
    expect(result.ok).toBe(false)
  })

  it('returns csv on valid input', async () => {
    const { exportContacts } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    const result = await exportContacts('30d', 'all')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.csv).toContain('Name,Email')
      expect(result.filename).toMatch(/^contacts-\d{4}-\d{2}-\d{2}\.csv$/)
    }
  })
})

describe('RBAC enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws forbidden when requireSiteScope denies access', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    const { markReplied } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    await expect(markReplied('sub-1')).rejects.toThrow('forbidden')
  })

  it('throws unauthenticated when no session', async () => {
    const { requireSiteScope } = await import(
      '@tn-figueiredo/auth-nextjs/server'
    )
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    const { anonymizeSubmission } = await import(
      '@/app/cms/(authed)/contacts/actions'
    )
    await expect(anonymizeSubmission('sub-1')).rejects.toThrow(
      'unauthenticated',
    )
  })
})
