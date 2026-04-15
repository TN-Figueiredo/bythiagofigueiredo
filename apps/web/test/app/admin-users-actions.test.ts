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

// redirect throws a special NEXT_REDIRECT error internally — vi.fn() lets us inspect calls
const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

// ── Supabase service client fluent-chain mock ─────────────────────────────
// These variables are mutated in beforeEach to set per-test return values.

let nextInsertSingleResult: { data: unknown; error: { message: string; code?: string } | null } = {
  data: { id: 'inv-1', expires_at: '2026-04-23T00:00:00Z' },
  error: null,
}
let nextMaybySingleResult: { data: unknown; error: unknown } = {
  data: { org_id: 'org-1' },
  error: null,
}
let capturedUpdateArg: unknown = null
const serviceRpcMock = vi.fn()
const getUserByIdMock = vi.fn()

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: serviceRpcMock,
    auth: {
      admin: {
        getUserById: getUserByIdMock,
      },
    },
    from: (_table: string) => ({
      insert: (_values: unknown) => ({
        select: (_cols: string) => ({
          single: () => Promise.resolve(nextInsertSingleResult),
        }),
      }),
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: () => Promise.resolve(nextMaybySingleResult),
          single: () => Promise.resolve({ data: { name: 'My Org' }, error: null }),
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

/** Helper: run action and capture redirect URL (action always redirects on success/failure) */
async function captureRedirect(fn: () => Promise<void>): Promise<string> {
  try {
    await fn()
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('NEXT_REDIRECT:')) return msg.slice('NEXT_REDIRECT:'.length)
    throw e
  }
  throw new Error('Expected action to redirect but it did not throw')
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
    nextMaybySingleResult = { data: { org_id: 'org-1' }, error: null }
    sendTemplateMock.mockResolvedValue({ messageId: 'msg-1' })
    serviceRpcMock.mockResolvedValue({ data: null, error: null })
    getUserByIdMock.mockResolvedValue({ data: { user: null } })
    mockAuthorizedUser()
  })

  it('redirects to ?notice=invite_created on happy path', async () => {
    const url = await captureRedirect(() =>
      createInvitation({ email: 'bob@example.com', role: 'author' }),
    )
    expect(url).toBe('/admin/users?notice=invite_created')
  })

  it('calls revalidatePath on success', async () => {
    await captureRedirect(() => createInvitation({ email: 'bob@example.com', role: 'author' }))
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
  })

  it('redirects to ?notice=invite_rate_limited when rate_limit_exceeded trigger fires', async () => {
    nextInsertSingleResult = {
      data: null,
      error: {
        message: 'rate_limit_exceeded: max 20 invitations per hour per admin',
        code: 'P0001',
      },
    }
    const url = await captureRedirect(() =>
      createInvitation({ email: 'bob@example.com', role: 'author' }),
    )
    expect(url).toBe('/admin/users?notice=invite_rate_limited')
  })

  it('redirects to ?notice=invite_duplicate on duplicate pending invite (23505)', async () => {
    nextInsertSingleResult = {
      data: null,
      error: { message: 'duplicate key value', code: '23505' },
    }
    const url = await captureRedirect(() =>
      createInvitation({ email: 'bob@example.com', role: 'editor' }),
    )
    expect(url).toBe('/admin/users?notice=invite_duplicate')
  })

  it('redirects to ?notice=invite_failed for other DB errors', async () => {
    nextInsertSingleResult = {
      data: null,
      error: { message: 'some other db error', code: '42P01' },
    }
    const url = await captureRedirect(() =>
      createInvitation({ email: 'bob@example.com', role: 'author' }),
    )
    expect(url).toBe('/admin/users?notice=invite_failed')
  })

  it('redirects to ?notice=invite_failed for FK violation (23503)', async () => {
    nextInsertSingleResult = {
      data: null,
      error: { message: 'foreign key violation', code: '23503' },
    }
    const url = await captureRedirect(() =>
      createInvitation({ email: 'bob@example.com', role: 'author' }),
    )
    expect(url).toBe('/admin/users?notice=invite_failed')
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

  it('still redirects to invite_created even when email send throws', async () => {
    sendTemplateMock.mockRejectedValueOnce(new Error('Brevo error'))
    const url = await captureRedirect(() =>
      createInvitation({ email: 'bob@example.com', role: 'author' }),
    )
    // Email failure is caught + logged; invitation still succeeds
    expect(url).toBe('/admin/users?notice=invite_created')
  })
})

// ── revokeInvitation ──────────────────────────────────────────────────────

describe('revokeInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdateArg = null
    nextMaybySingleResult = { data: { org_id: 'org-1' }, error: null }
    serviceRpcMock.mockResolvedValue({ data: null, error: null })
    getUserByIdMock.mockResolvedValue({ data: { user: null } })
    mockAuthorizedUser()
  })

  it('calls update with revoked_at and revoked_by_user_id', async () => {
    await captureRedirect(() => revokeInvitation('inv-1'))
    expect(capturedUpdateArg).toMatchObject({
      revoked_at: expect.any(String),
      revoked_by_user_id: 'user-1',
    })
  })

  it('redirects to ?notice=invitation_revoked on success', async () => {
    const url = await captureRedirect(() => revokeInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=invitation_revoked')
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
    await captureRedirect(() => revokeInvitation('inv-1'))
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
        invited_by: 'inviter-uid',
        organization: { name: 'My Org' },
      },
      error: null,
    }
    sendTemplateMock.mockResolvedValue({ messageId: 'msg-2' })
    // I4: RPC mock for atomic resend_count increment — returns true (cooldown not active)
    serviceRpcMock.mockResolvedValue({ data: true, error: null })
    // I12: inviter user mock
    getUserByIdMock.mockResolvedValue({
      data: { user: { id: 'inviter-uid', email: 'inviter@example.com', user_metadata: { full_name: 'Alice Admin' } } },
    })
    mockAuthorizedUser()
  })

  it('calls sendTemplate', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    expect(sendTemplateMock).toHaveBeenCalledOnce()
  })

  it('redirects to ?notice=resend_sent on success', async () => {
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_sent')
  })

  it('uses inviter full_name from user_metadata (I12)', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    const data = sendTemplateMock.mock.calls[0]![3] as Record<string, unknown>
    expect(data.inviterName).toBe('Alice Admin')
  })

  it('falls back to email local-part when no full_name in metadata (I12)', async () => {
    getUserByIdMock.mockResolvedValueOnce({
      data: { user: { id: 'inviter-uid', email: 'boss@acme.com', user_metadata: {} } },
    })
    await captureRedirect(() => resendInvitation('inv-1'))
    const data = sendTemplateMock.mock.calls[0]![3] as Record<string, unknown>
    expect(data.inviterName).toBe('boss')
  })

  it('calls increment_invitation_resend RPC instead of direct update (I13)', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    expect(serviceRpcMock).toHaveBeenCalledWith('increment_invitation_resend', { p_id: 'inv-1' })
    // No direct update to resend_count
    expect(capturedUpdateArg).toBeNull()
  })

  it('I4: redirects to ?notice=resend_too_soon when RPC returns false (30s cooldown active)', async () => {
    serviceRpcMock.mockResolvedValueOnce({ data: false, error: null })
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_too_soon')
    // Email should NOT be sent when rate-limited
    expect(sendTemplateMock).not.toHaveBeenCalled()
  })

  it('throws not_found when invitation does not exist', async () => {
    nextMaybySingleResult = { data: null, error: null }
    await expect(resendInvitation('missing')).rejects.toThrow(/not_found/)
  })

  it('calls revalidatePath after resend', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
  })
})
