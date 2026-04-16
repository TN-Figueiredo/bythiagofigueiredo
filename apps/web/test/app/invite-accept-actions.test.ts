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

  it('Track G: deletes orphan user and redirects to rpc_failed on partial failure (accept RPC errors)', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-2' } }, error: null })
    // accept_invitation_atomic called via service.rpc — RPC failure
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'invitation_invalid' } })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-ra', 'Password1!'))

    // Track G partial-failure cleanup: delete the orphan user since the
    // RPC exception means the invitation row was NOT mutated.
    expect(deleteUserMock).toHaveBeenCalledWith('new-uid-2')
    expect(url).toBe('/signup/invite/tok-ra?error=rpc_failed')
  })

  it('Track G: cross-domain redirects to primary_domain /cms/login on site-scope success', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-ok' } }, error: null })
    // RBAC v3 RPC returns { redirect_url, role_scope, role, org_id, site_id }
    rpcMock.mockResolvedValueOnce({
      data: {
        redirect_url: 'https://site-a.example.com/cms/login',
        role_scope: 'site',
        role: 'editor',
        org_id: 'org-1',
        site_id: 'site-1',
      },
      error: null,
    })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-ok', 'Password1!'))

    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(url).toBe('https://site-a.example.com/cms/login')
  })

  it('Track G: redirects to master-ring /cms/login on org-scope success', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'new-uid-org' } }, error: null })
    rpcMock.mockResolvedValueOnce({
      data: {
        redirect_url: 'https://bythiagofigueiredo.com/cms/login',
        role_scope: 'org',
        role: 'org_admin',
        org_id: 'org-1',
      },
      error: null,
    })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-org', 'Password1!'))

    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(url).toBe('https://bythiagofigueiredo.com/cms/login')
  })

  it('Track G: passes p_token_hash + p_user_id to the two-arg accept_invitation_atomic RPC', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({ data: { user: { id: 'uid-check' } }, error: null })
    rpcMock.mockResolvedValueOnce({
      data: {
        redirect_url: 'https://bythiagofigueiredo.com/cms/login',
        role_scope: 'org',
      },
      error: null,
    })

    await captureRedirect(() => acceptInviteWithPassword('tok-sig', 'Password1!'))

    const acceptCall = rpcMock.mock.calls.find((c) => c[0] === 'accept_invitation_atomic')
    expect(acceptCall).toBeDefined()
    expect(acceptCall![1]).toEqual({ p_token_hash: 'tok-sig', p_user_id: 'uid-check' })
  })
})
