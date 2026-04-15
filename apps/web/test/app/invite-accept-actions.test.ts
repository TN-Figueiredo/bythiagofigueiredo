/**
 * Tests for /signup/invite/[token] server actions.
 *
 * All Supabase calls are mocked; no real network or DB needed.
 * Actions now redirect() instead of returning result objects.
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

// redirect throws a special NEXT_REDIRECT error internally — vi.fn() lets us inspect calls
const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url)
    // Simulate Next's redirect by throwing so the action stops
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
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

/** Helper: run action and capture redirect URL (action always redirects) */
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

// ─── acceptInviteForCurrentUser ───────────────────────────────────────────────

describe('acceptInviteForCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to ?error=unauthenticated when no user session', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(url).toBe('/signup/invite/tok-123?error=unauthenticated')
  })

  it('redirects to /cms on success', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'alice@example.com' } } })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-1' }, error: null })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(url).toBe('/cms')
  })

  it('calls rpc with only p_token when user is authenticated', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'alice@example.com' } } })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-1' }, error: null })

    await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(rpcMock).toHaveBeenCalledWith('accept_invitation_atomic', { p_token: 'tok-123' })
  })

  it('redirects to ?error=rpc_failed when rpc returns a postgres error', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-bad'))
    expect(url).toBe('/signup/invite/tok-bad?error=rpc_failed')
  })

  it('redirects to ?error=<code> when RPC returns ok:false with error codes', async () => {
    for (const errorCode of ['email_mismatch', 'expired', 'already_accepted', 'revoked']) {
      vi.clearAllMocks()
      getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
      rpcMock.mockResolvedValueOnce({
        data: { ok: false, error: errorCode },
        error: null,
      })

      const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-x'))
      expect(url).toBe(`/signup/invite/tok-x?error=${encodeURIComponent(errorCode)}`)
    }
  })
})

// ─── acceptInviteWithPassword ─────────────────────────────────────────────────

describe('acceptInviteWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOutMock.mockResolvedValue({})
  })

  it('redirects to ?error=not_found when get_invitation_by_token finds nothing', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-gone', 'Password1!'))
    expect(url).toBe('/signup/invite/tok-gone?error=not_found')
  })

  it('redirects to ?error=expired when invitation is expired', async () => {
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

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-old', 'Password1!'))
    expect(url).toBe('/signup/invite/tok-old?error=expired')
  })

  it('redirects to ?error=email_already_registered when createUser says already registered', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-dup', 'Password1!'))
    expect(url).toBe('/signup/invite/tok-dup?error=email_already_registered')
  })

  it('redirects to ?error=signup_failed when createUser fails for other reasons', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'internal server error' },
    })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-err', 'Password1!'))
    expect(url).toBe('/signup/invite/tok-err?error=signup_failed')
  })

  it('deletes newly created user and redirects to ?error=signup_failed when signIn fails', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: { message: 'bad credentials' } })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-si', 'Password1!'))

    expect(deleteUserMock).toHaveBeenCalledWith('new-uid')
    expect(url).toBe('/signup/invite/tok-si?error=signup_failed')
    // C6: signOut should be called to clear orphan cookies on failure
    expect(signOutMock).toHaveBeenCalled()
  })

  it('C2: does NOT delete user and calls signOut when accept RPC errors (network/timeout)', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-2' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    // accept_invitation_atomic called via userClient.rpc — network error / RPC failure
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'expired' } })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-ra', 'Password1!'))

    // C2: must NOT delete — RPC may have committed even if response was lost
    expect(deleteUserMock).not.toHaveBeenCalled()
    // C2: must sign out to clear cookies
    expect(signOutMock).toHaveBeenCalled()
    expect(url).toBe('/signup/invite/tok-ra?error=rpc_failed')
  })

  it('C2: does NOT delete user and calls signOut when RPC returns ok:false', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-3' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: { ok: false, error: 'email_mismatch' }, error: null })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-mm', 'Password1!'))

    // C2: must NOT delete — RPC was reachable, user account is created, preserve it
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(signOutMock).toHaveBeenCalled()
    expect(url).toBe('/signup/invite/tok-mm?error=rpc_failed')
  })

  it('redirects to /cms on full success', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-ok' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-happy' }, error: null })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-ok', 'Password1!'))

    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(url).toBe('/cms')
  })

  it('does NOT pass p_user_id to accept_invitation_atomic (single-param RPC)', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'uid-check' } }, error: null })
    signInMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: { ok: true, org_id: 'org-1' }, error: null })

    await captureRedirect(() => acceptInviteWithPassword('tok-sig', 'Password1!'))

    // The accept RPC call should only have p_token, not p_user_id
    const acceptCall = rpcMock.mock.calls.find((c) => c[0] === 'accept_invitation_atomic')
    expect(acceptCall).toBeDefined()
    expect(acceptCall![1]).toEqual({ p_token: 'tok-sig' })
    expect(acceptCall![1]).not.toHaveProperty('p_user_id')
  })
})
