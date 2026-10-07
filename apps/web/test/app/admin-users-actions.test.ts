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

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }))

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
  headers: () => Promise.resolve(new Headers({ 'user-agent': 'vitest' })),
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
let capturedInsertArg: unknown = null
let nextInsertManyResult: { data: unknown; error: { message: string; code?: string } | null } = {
  data: [],
  error: null,
}
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
      insert: (values: unknown) => {
        if (_table === 'sent_emails') return Promise.resolve({ data: null, error: null })
        capturedInsertArg = values
        return {
          // `.select()` é aguardado direto (várias linhas, createInvitationAction)
          // ou seguido de `.single()` (uma linha, createInvitation legado).
          select: (_cols: string) =>
            Object.assign(Promise.resolve(nextInsertManyResult), {
              single: () => Promise.resolve(nextInsertSingleResult),
            }),
        }
      },
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
  createInvitationAction,
  revokeInvitation,
  resendInvitation,
} from '../../src/app/admin/(authed)/users/actions'

// ── Helpers ───────────────────────────────────────────────────────────────

function mockAuthorizedUser() {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'admin@example.com' } },
  })
  // is_org_admin devolve boolean (não o papel): true = pode gerir convites.
  // increment_invitation_resend devolve VOID: sucesso é { data: null, error: null }
  // e o intervalo de 30 s chega como exceção 'resend_cooldown' (ver
  // test/integration/invite-flow-contract.test.ts para o contrato real).
  rpcMock.mockImplementation((fn: string) =>
    Promise.resolve(
      fn === 'is_org_admin' ? { data: true, error: null } : { data: null, error: null },
    ),
  )
}

/** Faz a próxima chamada de `fn` pelo client do usuário falhar com `error`. */
function failUserRpc(fn: string, error: { message: string; code?: string; hint?: string }) {
  rpcMock.mockImplementation((name: string) =>
    Promise.resolve(
      name === fn
        ? { data: null, error }
        : name === 'is_org_admin'
          ? { data: true, error: null }
          : { data: null, error: null },
    ),
  )
}

const inAWeek = () => new Date(Date.now() + 7 * 864e5).toISOString()
const yesterday = () => new Date(Date.now() - 864e5).toISOString()

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

  it('throws forbidden when caller is not an org admin', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    await expect(createInvitation({ email: 'x@x.com', role: 'editor' })).rejects.toThrow(
      /forbidden/,
    )
  })

  it('authorizes through is_org_admin (SECURITY DEFINER), never org_role', async () => {
    // org_role roda como o usuário e recursa na policy de organization_members
    // (54001 "stack depth limit exceeded") — negava até o super_admin.
    await captureRedirect(() => createInvitation({ email: 'bob@example.com', role: 'editor' }))
    expect(rpcMock).toHaveBeenCalledWith('is_org_admin', { p_org_id: 'org-1' })
    expect(rpcMock.mock.calls.some((c) => c[0] === 'org_role')).toBe(false)
  })

  it('throws forbidden (fail closed) when the authz RPC errors', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '54001', message: 'stack depth limit exceeded' },
    })
    await expect(createInvitation({ email: 'x@x.com', role: 'editor' })).rejects.toThrow(
      /forbidden/,
    )
  })

  it('a legacy role string is not a grant: only boolean true authorizes', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'admin', error: null })
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
    sendTemplateMock.mockRejectedValueOnce(new Error('SES error'))
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

  it('throws forbidden when caller is not an org admin', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
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
        expires_at: inAWeek(),
        accepted_at: null,
        revoked_at: null,
        invited_by: 'inviter-uid',
        organization: { name: 'My Org' },
      },
      error: null,
    }
    sendTemplateMock.mockResolvedValue({ messageId: 'msg-2' })
    // O service client NÃO autoriza a função (auth.uid() nulo): se a ação voltar
    // a chamá-la por ele, este mock devolve a recusa que o banco devolve.
    serviceRpcMock.mockResolvedValue({
      data: null,
      error: { message: 'insufficient_access', code: 'P0001' },
    })
    // I12: inviter user mock
    getUserByIdMock.mockResolvedValue({
      data: { user: { id: 'inviter-uid', email: 'inviter@example.com', user_metadata: { full_name: 'Alice Admin' } } },
    })
    mockAuthorizedUser()
  })

  it('reenvia: a RPC devolve void (data null, sem erro) e isso é sucesso, não "aguarde 30 s"', async () => {
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_sent')
    expect(sendTemplateMock).toHaveBeenCalledOnce()
  })

  it('incrementa pelo client do USUÁRIO (a função autoriza por auth.uid()), nunca pelo service client', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    expect(rpcMock).toHaveBeenCalledWith('increment_invitation_resend', { p_id: 'inv-1' })
    expect(serviceRpcMock).not.toHaveBeenCalled()
    // No direct update to resend_count
    expect(capturedUpdateArg).toBeNull()
  })

  it('respeita o intervalo: exceção resend_cooldown vira "aguarde 30 s" e nenhum e-mail sai', async () => {
    failUserRpc('increment_invitation_resend', {
      message: 'resend_cooldown',
      code: 'P0001',
      hint: 'cooldown',
    })
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_too_soon')
    expect(sendTemplateMock).not.toHaveBeenCalled()
  })

  it('outro erro da RPC não se disfarça de intervalo: vira resend_failed e nenhum e-mail sai', async () => {
    failUserRpc('increment_invitation_resend', { message: 'insufficient_access', code: 'P0001' })
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_failed')
    expect(sendTemplateMock).not.toHaveBeenCalled()
  })

  it('falha do provedor de e-mail vira aviso honesto (resend_email_failed), não "Convite reenviado"', async () => {
    sendTemplateMock.mockRejectedValueOnce(new Error('SES error'))
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_email_failed')
  })

  it.each([
    ['expirado', () => ({ expires_at: yesterday() })],
    ['já aceito', () => ({ accepted_at: yesterday() })],
    ['revogado', () => ({ revoked_at: yesterday() })],
  ])('convite %s não é reenviado (o link estaria morto)', async (_label, patch) => {
    nextMaybySingleResult = {
      data: { ...(nextMaybySingleResult.data as Record<string, unknown>), ...patch() },
      error: null,
    }
    const url = await captureRedirect(() => resendInvitation('inv-1'))
    expect(url).toBe('/admin/users?notice=resend_expired')
    expect(rpcMock).not.toHaveBeenCalledWith('increment_invitation_resend', expect.anything())
    expect(sendTemplateMock).not.toHaveBeenCalled()
  })

  it('manda o link de aceite com o token do convite e o papel no vocabulário do template', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    const data = sendTemplateMock.mock.calls[0]![3] as Record<string, unknown>
    expect(String(data.acceptUrl)).toMatch(/\/signup\/invite\/abc123$/)
    expect(data.role).toBe('editor')
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

  it('throws not_found when invitation does not exist', async () => {
    nextMaybySingleResult = { data: null, error: null }
    await expect(resendInvitation('missing')).rejects.toThrow(/not_found/)
  })

  it('throws forbidden when caller is not an org admin (nada é incrementado nem enviado)', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    await expect(resendInvitation('inv-1')).rejects.toThrow(/forbidden/)
    expect(rpcMock).not.toHaveBeenCalledWith('increment_invitation_resend', expect.anything())
    expect(sendTemplateMock).not.toHaveBeenCalled()
  })

  it('calls revalidatePath after resend', async () => {
    await captureRedirect(() => resendInvitation('inv-1'))
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
  })
})

// ── createInvitationAction (escopo org/site) ──────────────────────────────

describe('createInvitationAction', () => {
  const SITE = '22222222-2222-4222-8222-222222222222'
  const editorInvite = {
    email: 'irma@example.com',
    scope: 'site' as const,
    role: 'editor' as const,
    site_ids: [SITE],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    capturedInsertArg = null
    nextInsertManyResult = {
      data: [{ id: 'inv-9', token: 'f'.repeat(64), expires_at: inAWeek(), site_id: SITE }],
      error: null,
    }
    sendTemplateMock.mockResolvedValue({ messageId: 'msg-9' })
    mockAuthorizedUser()
  })

  it('convite de editora de site: grava escopo site + papel editor e diz "criado e enviado" quando o e-mail saiu', async () => {
    const url = await captureRedirect(() => createInvitationAction(editorInvite))
    expect(url).toBe('/admin/users?notice=invite_created')
    expect(capturedInsertArg).toEqual([
      expect.objectContaining({
        email: 'irma@example.com',
        org_id: 'org-1',
        site_id: SITE,
        role_scope: 'site',
        role: 'editor',
        invited_by: 'user-1',
      }),
    ])
    const data = sendTemplateMock.mock.calls[0]![3] as Record<string, unknown>
    expect(String(data.acceptUrl)).toMatch(new RegExp(`/signup/invite/${'f'.repeat(64)}$`))
  })

  it('e-mail que não saiu NÃO vira "criado e enviado": aviso invite_created_email_failed', async () => {
    sendTemplateMock.mockRejectedValueOnce(new Error('SES: The security token included in the request is invalid'))
    const url = await captureRedirect(() => createInvitationAction(editorInvite))
    expect(url).toBe('/admin/users?notice=invite_created_email_failed')
  })

  it('vários sites: basta um envio falhar para o aviso ser o de falha', async () => {
    nextInsertManyResult = {
      data: [
        { id: 'inv-a', token: 'a'.repeat(64), expires_at: inAWeek(), site_id: SITE },
        { id: 'inv-b', token: 'b'.repeat(64), expires_at: inAWeek(), site_id: SITE },
      ],
      error: null,
    }
    sendTemplateMock.mockResolvedValueOnce({ messageId: 'ok' }).mockRejectedValueOnce(new Error('SES'))
    const url = await captureRedirect(() =>
      createInvitationAction({ ...editorInvite, site_ids: [SITE, SITE] }),
    )
    expect(url).toBe('/admin/users?notice=invite_created_email_failed')
    expect(sendTemplateMock).toHaveBeenCalledTimes(2)
  })

  it('escopo site com papel org_admin é recusado antes de gravar', async () => {
    const url = await captureRedirect(() =>
      createInvitationAction({ ...editorInvite, role: 'org_admin' }),
    )
    expect(url).toBe('/admin/users?notice=invite_failed')
    expect(capturedInsertArg).toBeNull()
  })

  it('quem não é org_admin não cria convite', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    await expect(createInvitationAction(editorInvite)).rejects.toThrow(/forbidden/)
    expect(capturedInsertArg).toBeNull()
  })
})
