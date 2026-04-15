import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock factories — all defined before any import ─────────────────────────

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () =>
    Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../lib/cms/repositories', () => ({
  ringContext: () => ({
    getSite: vi.fn().mockResolvedValue({
      id: 'site-1',
      name: 'My Site',
      domains: ['example.com'],
    }),
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const sendTemplateMock = vi.fn().mockResolvedValue({ messageId: 'msg-1' })

vi.mock('../../lib/email/service', () => ({
  getEmailService: () => ({ sendTemplate: sendTemplateMock }),
}))

vi.mock('../../lib/email/sender', () => ({
  getEmailSender: () =>
    Promise.resolve({
      email: 'noreply@example.com',
      name: 'My Site',
      brandName: 'My Site',
      primaryColor: '#0070f3',
    }),
}))

vi.mock('@tn-figueiredo/email', () => ({
  inviteTemplate: { name: 'invite', render: vi.fn() },
  BrevoEmailAdapter: vi.fn(),
}))

const rpcMock = vi.fn()
const getUserMock = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}))

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: () => {},
    }),
}))

// ── Supabase service client fluent-chain mock ─────────────────────────────
// These variables are mutated in beforeEach to set per-test return values.

let nextInsertSingleResult: { data: unknown; error: { message: string; code?: string } | null } = {
  data: { id: 'inv-1', expires_at: '2026-04-23T00:00:00Z' },
  error: null,
}
let nextSelectSingleResult: { data: unknown; error: unknown } = {
  data: { resend_count: 0 },
  error: null,
}
let nextMaybySingleResult: { data: unknown; error: unknown } = {
  data: { org_id: 'org-1' },
  error: null,
}
let capturedUpdateArg: unknown = null

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (_table: string) => ({
      insert: (_values: unknown) => ({
        select: (_cols: string) => ({
          single: () => Promise.resolve(nextInsertSingleResult),
        }),
      }),
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: () => Promise.resolve(nextMaybySingleResult),
          single: () => Promise.resolve(nextSelectSingleResult),
          is: (_c: string, _v: unknown) => ({
            is: (_c2: string, _v2: unknown) => Promise.resolve({ data: [], error: null }),
          }),
        }),
        is: (_c: string, _v: unknown) => ({
          is: (_c2: string, _v2: unknown) => Promise.resolve({ data: [], error: null }),
        }),
      }),
      update: (values: unknown) => {
        capturedUpdateArg = values
        return {
          eq: (_col: string, _val: unknown) => Promise.resolve({ data: null, error: null }),
        }
      },
    }),
  }),
}))

// ── Import actions after all mocks ────────────────────────────────────────
import {
  createInvitation,
  revokeInvitation,
  resendInvitation,
} from '../../src/app/admin/users/actions'

// ── Helpers ───────────────────────────────────────────────────────────────

function mockAuthorizedUser() {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'admin@example.com' } },
  })
  rpcMock.mockResolvedValue({ data: 'admin', error: null })
}

// ── createInvitation ──────────────────────────────────────────────────────

describe('createInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdateArg = null
    nextInsertSingleResult = {
      data: { id: 'inv-1', expires_at: '2026-04-23T00:00:00Z' },
      error: null,
    }
    nextSelectSingleResult = { data: { name: 'My Org' }, error: null }
    nextMaybySingleResult = { data: { org_id: 'org-1' }, error: null }
    sendTemplateMock.mockResolvedValue({ messageId: 'msg-1' })
    mockAuthorizedUser()
  })

  it('returns ok=true on happy path', async () => {
    const result = await createInvitation({ email: 'bob@example.com', role: 'author' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.invitationId).toBe('inv-1')
    }
  })

  it('calls revalidatePath on success', async () => {
    await createInvitation({ email: 'bob@example.com', role: 'author' })
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
  })

  it('returns ok=false when rate_limit_exceeded trigger fires', async () => {
    nextInsertSingleResult = {
      data: null,
      error: {
        message: 'rate_limit_exceeded: max 20 invitations per hour per admin',
        code: 'P0001',
      },
    }
    const result = await createInvitation({ email: 'bob@example.com', role: 'author' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/20 convites/)
    }
  })

  it('returns ok=false on duplicate pending invite (23505)', async () => {
    nextInsertSingleResult = {
      data: null,
      error: { message: 'duplicate key value', code: '23505' },
    }
    const result = await createInvitation({ email: 'bob@example.com', role: 'editor' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/pendente/)
    }
  })

  it('returns ok=false with db_error prefix for other DB errors', async () => {
    nextInsertSingleResult = {
      data: null,
      error: { message: 'some other db error', code: '42P01' },
    }
    const result = await createInvitation({ email: 'bob@example.com', role: 'author' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/db_error/)
    }
  })

  it('throws forbidden when caller has author role', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'author', error: null })
    await expect(createInvitation({ email: 'x@x.com', role: 'editor' })).rejects.toThrow(
      /forbidden/,
    )
  })

  it('throws not_authenticated when no session', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    await expect(createInvitation({ email: 'x@x.com', role: 'editor' })).rejects.toThrow(
      /not_authenticated/,
    )
  })

  it('does not fail invitation even when email send throws', async () => {
    sendTemplateMock.mockRejectedValueOnce(new Error('Brevo error'))
    const result = await createInvitation({ email: 'bob@example.com', role: 'author' })
    // Email failure is caught + logged; invitation still returns ok
    expect(result.ok).toBe(true)
  })
})

// ── revokeInvitation ──────────────────────────────────────────────────────

describe('revokeInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdateArg = null
    nextMaybySingleResult = { data: { org_id: 'org-1' }, error: null }
    mockAuthorizedUser()
  })

  it('calls update with revoked_at and revoked_by_user_id', async () => {
    await revokeInvitation('inv-1')
    expect(capturedUpdateArg).toMatchObject({
      revoked_at: expect.any(String),
      revoked_by_user_id: 'user-1',
    })
  })

  it('throws not_found when invitation does not exist', async () => {
    nextMaybySingleResult = { data: null, error: null }
    await expect(revokeInvitation('missing-inv')).rejects.toThrow(/not_found/)
  })

  it('throws forbidden when caller has editor role', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'editor', error: null })
    await expect(revokeInvitation('inv-1')).rejects.toThrow(/forbidden/)
  })

  it('calls revalidatePath after revoke', async () => {
    await revokeInvitation('inv-1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
  })
})

// ── resendInvitation ──────────────────────────────────────────────────────

describe('resendInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdateArg = null
    nextMaybySingleResult = {
      data: {
        id: 'inv-1',
        email: 'bob@example.com',
        role: 'editor',
        org_id: 'org-1',
        token: 'abc123',
        expires_at: '2026-04-23T00:00:00Z',
        organization: { name: 'My Org' },
      },
      error: null,
    }
    nextSelectSingleResult = { data: { resend_count: 2 }, error: null }
    sendTemplateMock.mockResolvedValue({ messageId: 'msg-2' })
    mockAuthorizedUser()
  })

  it('calls sendTemplate', async () => {
    await resendInvitation('inv-1')
    expect(sendTemplateMock).toHaveBeenCalledOnce()
  })

  it('increments resend_count by 1', async () => {
    await resendInvitation('inv-1')
    expect(capturedUpdateArg).toMatchObject({ resend_count: 3, last_sent_at: expect.any(String) })
  })

  it('throws not_found when invitation does not exist', async () => {
    nextMaybySingleResult = { data: null, error: null }
    await expect(resendInvitation('missing')).rejects.toThrow(/not_found/)
  })

  it('calls revalidatePath after resend', async () => {
    await resendInvitation('inv-1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
  })
})
