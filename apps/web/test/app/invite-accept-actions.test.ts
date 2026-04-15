/**
 * Tests for /signup/invite/[token] server actions.
 *
 * All Supabase calls are mocked; no real network or DB needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── module mocks ─────────────────────────────────────────────────────────────

// Track calls so tests can assert on them
const rpcMock = vi.fn()
const getUserMock = vi.fn()
const signInMock = vi.fn()
const signOutMock = vi.fn()
const createUserMock = vi.fn()
const deleteUserMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
      set: () => {},
    }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
      signInWithPassword: signInMock,
      signOut: signOutMock,
    },
    rpc: rpcMock,
  }),
}))

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: rpcMock,
    auth: {
      admin: {
        createUser: createUserMock,
        deleteUser: deleteUserMock,
      },
    },
  }),
}))

// Import AFTER mocks are registered
import {
  acceptInviteForCurrentUser,
  acceptInviteWithPassword,
} from '../../src/app/signup/invite/[token]/actions'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Simulates a successful get_invitation_by_token response (SETOF → array) */
function mockValidInvitation() {
  rpcMock.mockImplementationOnce((fn: string) => {
    if (fn === 'get_invitation_by_token') {
      return Promise.resolve({
        data: [
          {
            email: 'alice@example.com',
            role: 'author',
            org_name: 'Acme',
            expires_at: new Date(Date.now() + 86400_000).toISOString(),
            expired: false,
          },
        ],
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: { message: 'unexpected rpc' } })
  })
}

// ─── acceptInviteForCurrentUser ───────────────────────────────────────────────

describe('acceptInviteForCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns not_authenticated when no user session', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const result = await acceptInviteForCurrentUser('tok-123')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('not_authenticated')
  })

  it('calls rpc with only p_token when user is authenticated', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'alice@example.com' } } })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-1' }, error: null })

    const result = await acceptInviteForCurrentUser('tok-123')

    expect(rpcMock).toHaveBeenCalledWith('accept_invitation_atomic', { p_token: 'tok-123' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.org_id).toBe('org-1')
  })

  it('returns rpc_failed when rpc returns a postgres error', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })

    const result = await acceptInviteForCurrentUser('tok-bad')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/rpc_failed/)
  })

  it('passes rpc error codes through (email_mismatch, expired, already_accepted)', async () => {
    for (const errorCode of ['email_mismatch', 'expired', 'already_accepted', 'revoked']) {
      vi.clearAllMocks()
      getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
      rpcMock.mockResolvedValueOnce({
        data: { ok: false, error: errorCode },
        error: null,
      })

      const result = await acceptInviteForCurrentUser('tok-x')

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBe(errorCode)
    }
  })
})

// ─── acceptInviteWithPassword ─────────────────────────────────────────────────

describe('acceptInviteWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOutMock.mockResolvedValue({})
  })

  it('returns invalid_or_expired when get_invitation_by_token finds nothing', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })

    const result = await acceptInviteWithPassword('tok-gone', 'Password1!')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_or_expired')
  })

  it('returns invalid_or_expired when invitation is expired', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          email: 'bob@example.com',
          role: 'editor',
          org_name: 'Acme',
          expires_at: new Date(Date.now() - 1000).toISOString(),
          expired: true,
        },
      ],
      error: null,
    })

    const result = await acceptInviteWithPassword('tok-old', 'Password1!')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_or_expired')
  })

  it('returns email_already_registered when createUser says already registered', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    })

    const result = await acceptInviteWithPassword('tok-dup', 'Password1!')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('email_already_registered')
  })

  it('returns signup_failed when createUser fails for other reasons', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'internal server error' },
    })

    const result = await acceptInviteWithPassword('tok-err', 'Password1!')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('signup_failed')
  })

  it('deletes newly created user and returns error when signIn fails', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: { message: 'bad credentials' } })

    const result = await acceptInviteWithPassword('tok-si', 'Password1!')

    expect(deleteUserMock).toHaveBeenCalledWith('new-uid')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('signin_after_signup_failed')
    // C6: signOut should be called to clear orphan cookies on failure
    expect(signOutMock).toHaveBeenCalled()
  })

  it('deletes newly created user and returns error when accept RPC fails', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-2' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    // accept_invitation_atomic called via userClient.rpc
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'expired' } })

    const result = await acceptInviteWithPassword('tok-ra', 'Password1!')

    expect(deleteUserMock).toHaveBeenCalledWith('new-uid-2')
    expect(result.ok).toBe(false)
  })

  it('deletes newly created user when RPC returns ok:false', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-3' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: { ok: false, error: 'email_mismatch' }, error: null })

    const result = await acceptInviteWithPassword('tok-mm', 'Password1!')

    expect(deleteUserMock).toHaveBeenCalledWith('new-uid-3')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('email_mismatch')
  })

  it('returns ok with redirectTo:/cms on full success', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-ok' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-happy' }, error: null })

    const result = await acceptInviteWithPassword('tok-ok', 'Password1!')

    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.redirectTo).toBe('/cms')
  })

  it('does NOT pass p_user_id to accept_invitation_atomic (single-param RPC)', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'uid-check' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-1' }, error: null })

    await acceptInviteWithPassword('tok-sig', 'Password1!')

    // The accept RPC call should only have p_token, not p_user_id
    const acceptCall = rpcMock.mock.calls.find((c) => c[0] === 'accept_invitation_atomic')
    expect(acceptCall).toBeDefined()
    expect(acceptCall![1]).toEqual({ p_token: 'tok-sig' })
    expect(acceptCall![1]).not.toHaveProperty('p_user_id')
  })
})
