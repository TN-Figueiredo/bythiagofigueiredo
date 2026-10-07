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

/**
 * Simulates a successful get_invitation_by_token response.
 * Contrato real (banco local): `(p_token_hash text) RETURNS jsonb` — UM objeto,
 * ou null quando o convite não existe / foi aceito / revogado / expirou.
 */
function mockValidInvitation() {
  rpcMock.mockImplementationOnce((fn: string, args: Record<string, unknown>) => {
    if (fn === 'get_invitation_by_token' && typeof args?.p_token_hash === 'string') {
      return Promise.resolve({
        data: {
          email: 'alice@example.com',
          role: 'org_admin',
          role_scope: 'org',
          org_name: 'Acme',
          expires_at: new Date(Date.now() + 86400_000).toISOString(),
        },
        error: null,
      })
    }
    // Qualquer outro nome de parâmetro é o PGRST202 que o PostgREST devolve.
    return Promise.resolve({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    })
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

  const alice = { data: { user: { id: 'u1', email: 'Alice@Example.com' } } }

  it('redirects to ?error=unauthenticated when no user session', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(url).toBe('/signup/invite/tok-123?error=unauthenticated')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('aceita pela sobrecarga de dois argumentos (a que respeita convite de site) e vai para /cms', async () => {
    getUserMock.mockResolvedValueOnce(alice)
    mockValidInvitation()
    rpcMock.mockResolvedValueOnce({
      data: { role: 'editor', role_scope: 'site', site_id: 's1', redirect_url: 'https://x/cms/login' },
      error: null,
    })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(url).toBe('/cms')
    expect(rpcMock).toHaveBeenCalledWith('accept_invitation_atomic', {
      p_token_hash: 'tok-123',
      p_user_id: 'u1',
    })
    // a sobrecarga antiga (só p_token) estoura em convites de site
    expect(rpcMock).not.toHaveBeenCalledWith('accept_invitation_atomic', { p_token: 'tok-123' })
  })

  it('convite inexistente/expirado/revogado: not_found e nada é aceito', async () => {
    getUserMock.mockResolvedValueOnce(alice)
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-dead'))
    expect(url).toBe('/signup/invite/tok-dead?error=not_found')
    expect(rpcMock.mock.calls.some((c) => c[0] === 'accept_invitation_atomic')).toBe(false)
  })

  it('logado com OUTRO e-mail: email_mismatch e nada é aceito (a ação não confia na página)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u2', email: 'mallory@example.com' } } })
    mockValidInvitation()

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(url).toBe('/signup/invite/tok-123?error=email_mismatch')
    expect(rpcMock.mock.calls.some((c) => c[0] === 'accept_invitation_atomic')).toBe(false)
  })

  it('sessão sem e-mail: email_mismatch (falha fechado)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u3' } } })
    mockValidInvitation()

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-123'))
    expect(url).toBe('/signup/invite/tok-123?error=email_mismatch')
    expect(rpcMock.mock.calls.some((c) => c[0] === 'accept_invitation_atomic')).toBe(false)
  })

  it('redirects to ?error=rpc_failed when the accept rpc returns a postgres error', async () => {
    getUserMock.mockResolvedValueOnce(alice)
    mockValidInvitation()
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'invitation_invalid' } })

    const url = await captureRedirect(() => acceptInviteForCurrentUser('tok-bad'))
    expect(url).toBe('/signup/invite/tok-bad?error=rpc_failed')
  })
})

describe('acceptInviteWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOutMock.mockResolvedValue({})
  })

  it('redirects to ?error=not_found when get_invitation_by_token finds nothing (null)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-gone', 'Password1!'))
    expect(url).toBe('/signup/invite/tok-gone?error=not_found')
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('looks the invitation up with p_token_hash (the real parameter name), passing the raw token', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await captureRedirect(() => acceptInviteWithPassword('tok-param', 'Password1!'))
    expect(rpcMock).toHaveBeenCalledWith('get_invitation_by_token', { p_token_hash: 'tok-param' })
  })

  it('redirects to ?error=not_found and creates no user when the lookup RPC errors', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    })

    const url = await captureRedirect(() => acceptInviteWithPassword('tok-rpc', 'Password1!'))
    expect(url).toBe('/signup/invite/tok-rpc?error=not_found')
    expect(createUserMock).not.toHaveBeenCalled()
  })

  it('creates the account for the e-mail of the invitation', async () => {
    mockValidInvitation()
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'internal server error' },
    })

    await captureRedirect(() => acceptInviteWithPassword('tok-mail', 'Password1!'))
    expect(createUserMock).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'Password1!',
      email_confirm: true,
    })
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
