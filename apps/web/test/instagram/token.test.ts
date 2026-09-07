// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

vi.mock('@/lib/ops/ntfy', async (orig) => ({
  ...(await orig<typeof import('@/lib/ops/ntfy')>()),
  sendNtfyAlert: vi.fn(),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  NO_SITE_ADMINS_ERROR: 'no site admins to email',
  fanOutToSiteAdminsDetailed: vi.fn(),
}))

import { encrypt } from '@tn-figueiredo/social/vault'
import {
  VaultUnavailableError,
  classifyInstagramError,
  getVaultKeyOrNull,
  readAccessToken,
  writeAccessToken,
  MarkTokenInvalidError,
  evaluateTransientStreak,
  markTokenInvalid,
  deliverTokenAlert,
  identityKeyOf,
  sweepTokenAlerts,
  type ITokenAlertRow,
} from '@/lib/instagram/token'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

const KEY_HEX = '0'.repeat(64)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SOCIAL_MASTER_KEY', KEY_HEX)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getVaultKeyOrNull', () => {
  it('devolve Buffer de 32 bytes com 64 hex minúsculos', () => {
    const key = getVaultKeyOrNull()
    expect(Buffer.isBuffer(key)).toBe(true)
    expect(key!.length).toBe(32)
  })

  it('aceita hex MAIÚSCULO', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', 'A'.repeat(64))
    expect(getVaultKeyOrNull()!.length).toBe(32)
  })

  it('devolve null com 64 caracteres NÃO-hex (o regex roda antes do Buffer.from)', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', 'z'.repeat(64))
    expect(getVaultKeyOrNull()).toBeNull()
  })

  it('devolve null com comprimento errado e com a env ausente', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '0'.repeat(63))
    expect(getVaultKeyOrNull()).toBeNull()
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    expect(getVaultKeyOrNull()).toBeNull()
  })
})

describe('readAccessToken', () => {
  it('nunca lança: v1: corrompido devolve { token: null }', () => {
    expect(() => readAccessToken({ access_token: 'v1:not-base64-at-all' })).not.toThrow()
    expect(readAccessToken({ access_token: 'v1:AAAA' }).token).toBeNull()
  })

  it('decifra um valor v1: válido', () => {
    const stored = `v1:${encrypt('IGAAplain', Buffer.from(KEY_HEX, 'hex'))}`
    expect(readAccessToken({ access_token: stored })).toEqual({ token: 'IGAAplain', legacy: false })
  })

  it('devolve o texto puro com legacy:true quando não há prefixo v1:', () => {
    expect(readAccessToken({ access_token: 'IGAAlegacy' })).toEqual({ token: 'IGAAlegacy', legacy: true })
  })

  it('access_token nulo => { token: null, legacy: false } (o chamador chama isso de "not connected")', () => {
    expect(readAccessToken({ access_token: null })).toEqual({ token: null, legacy: false })
  })

  it('sem chave, um valor v1: devolve token null e não lança', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    expect(readAccessToken({ access_token: 'v1:whatever' }).token).toBeNull()
  })
})

describe('writeAccessToken', () => {
  it('cifra com prefixo v1: e faz round-trip', () => {
    const stored = writeAccessToken('IGAAsecret')
    expect(stored.startsWith('v1:')).toBe(true)
    expect(readAccessToken({ access_token: stored }).token).toBe('IGAAsecret')
  })

  it('LANÇA VaultUnavailableError sem chave', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    expect(() => writeAccessToken('x')).toThrow(VaultUnavailableError)
  })
})

describe('classifyInstagramError — sequência ordenada de §3.2', () => {
  it('(1) infra: 23505', () => {
    expect(classifyInstagramError({ code: '23505', message: 'duplicate key value violates unique constraint' }))
      .toBe('infra')
  })

  it('(1) infra: erro do PostgREST/Supabase', () => {
    expect(classifyInstagramError({ code: 'PGRST202', message: 'Could not find the function', details: null, hint: null }))
      .toBe('infra')
    expect(classifyInstagramError({ code: '42703', message: 'column does not exist', details: null, hint: null }))
      .toBe('infra')
  })

  it('(1) infra vence permanent: code 100 com "Tried accessing nonexisting field"', () => {
    expect(classifyInstagramError({
      code: 100, type: 'OAuthException', httpStatus: 400,
      message: '(#100) Tried accessing nonexisting field (foo) on node type (User)',
    })).toBe('infra')
  })

  it('(2) transient: códigos 1, 2, 4, 17, 32, 341, 613', () => {
    for (const code of [1, 2, 4, 17, 32, 341, 613]) {
      expect(classifyInstagramError({ code, message: 'x' }), String(code)).toBe('transient')
    }
  })

  it('(2) transient: is_transient === true', () => {
    expect(classifyInstagramError({ code: 999, is_transient: true, message: 'x' })).toBe('transient')
  })

  it('(2) transient vence OAuthException: 429, 500 e 503', () => {
    expect(classifyInstagramError({ httpStatus: 429, type: 'OAuthException', message: 'rate limited' })).toBe('transient')
    expect(classifyInstagramError({ httpStatus: 500, type: 'OAuthException', message: 'oops' })).toBe('transient')
    expect(classifyInstagramError({ httpStatus: 503, type: 'OAuthException', message: 'oops' })).toBe('transient')
  })

  it('(2) transient: 429 sem type', () => {
    expect(classifyInstagramError({ code: 429, httpStatus: 429, type: 'HttpError', message: 'Instagram API 429' }))
      .toBe('transient')
  })

  it('(2) transient: frases de janela e limite', () => {
    expect(classifyInstagramError({ message: 'The token is less than 24 hours old' })).toBe('transient')
    expect(classifyInstagramError({ message: 'Application request limit reached: too many calls' })).toBe('transient')
  })

  it('(2) transient: rede e timeout', () => {
    expect(classifyInstagramError(new TypeError('fetch failed'))).toBe('transient')
    const abort = new Error('The operation was aborted'); abort.name = 'TimeoutError'
    expect(classifyInstagramError(abort)).toBe('transient')
  })

  it('(3) permanent: 400 COM OAuthException', () => {
    expect(classifyInstagramError({ httpStatus: 400, type: 'OAuthException', code: 190, message: 'Invalid OAuth access token' }))
      .toBe('permanent')
  })

  it('(3) permanent: httpStatus 403 e 401', () => {
    expect(classifyInstagramError({ httpStatus: 403, type: 'HttpError', code: 403, message: 'Instagram API 403' }))
      .toBe('permanent')
    expect(classifyInstagramError({ httpStatus: 401, type: 'HttpError', code: 401, message: 'Instagram API 401' }))
      .toBe('permanent')
  })

  it('(3) permanent: 190 e a faixa 200..299', () => {
    expect(classifyInstagramError({ code: 190, message: 'x' })).toBe('permanent')
    expect(classifyInstagramError({ code: 200, message: 'x' })).toBe('permanent')
    expect(classifyInstagramError({ code: 299, message: 'x' })).toBe('permanent')
  })

  it('(3) permanent: decrypt_failed e as mensagens de conta desconectada (sentinelas exatas, sem exigir vendor)', () => {
    expect(classifyInstagramError(new Error('decrypt_failed'))).toBe('permanent')
    expect(classifyInstagramError(new Error('No Instagram user ID'))).toBe('permanent')
    expect(classifyInstagramError(new Error('No access token'))).toBe('permanent')
  })

  // Achado 1 (fix round C2): "the session has been invalidated…" É uma frase
  // GENÉRICA (não uma sentinela exata nossa) — só conta como permanent
  // quando o erro já tem evidência de vendor (aqui, `type: 'OAuthException'`,
  // exatamente como instagramErrorFromResponse monta a partir do corpo JSON
  // da Meta). Como bare Error, sem evidência nenhuma, ela não pode mais
  // desconectar a frota sozinha.
  it('"session invalidated" só é permanent COM evidência de vendor; como bare Error, não é', () => {
    // httpStatus presente (mesmo que não seja 401/403) já é evidência de
    // vendor nesta base de código — só InstagramApiError usa esse nome de
    // campo — e é o que autoriza a cláusula de texto genérica a rodar.
    expect(classifyInstagramError({
      httpStatus: 400,
      message: 'The session has been invalidated because the user changed their password',
    })).toBe('permanent')
    // O MESMO texto, como bare Error (sem type/code/httpStatus), não tem
    // evidência nenhuma de vendor — não pode mais desconectar a frota sozinho.
    expect(classifyInstagramError(
      new Error('The session has been invalidated because the user changed their password'),
    )).not.toBe('permanent')
  })

  it('(4) default: 400 SEM type => transient', () => {
    expect(classifyInstagramError({ httpStatus: 400, type: 'HttpError', code: 400, message: 'Instagram API 400' }))
      .toBe('transient')
  })

  // Achado 1 (fix round C2): a cláusula de texto genérica (expired/invalidated/
  // revoked/invalid…token) só pode valer `permanent` quando o erro já carrega
  // evidência de vir do VENDOR (numericCode/httpStatus/type). Um `Error` puro
  // — sem nenhum desses campos — nunca deve passar, mesmo que a mensagem
  // contenha uma dessas palavras.
  it('Error("JWT expired") do client do banco NÃO é permanent (bare Error, sem evidência de vendor)', () => {
    expect(classifyInstagramError(new Error('JWT expired'))).toBe('transient')
  })

  it('Error("fetch failed") NÃO é permanent (é transient via isNetworkFailure)', () => {
    expect(classifyInstagramError(new Error('fetch failed'))).toBe('transient')
  })

  it('objeto de erro do client do banco (sem code numérico/httpStatus/type) NÃO é permanent', () => {
    // Forma plausível de um erro de auth/client do Supabase quando a
    // service-role key é rotacionada: tem `message` e `code`/`status` em
    // formatos que NÃO são os do vendor (code é string, e o campo de status
    // HTTP chama-se `status`, não `httpStatus` — só InstagramApiError usa
    // esse nome).
    const dbError = { name: 'PostgrestError', message: 'JWT expired', code: '401' }
    expect(classifyInstagramError(dbError)).not.toBe('permanent')
  })
})

const ACC = { id: 'acc-1', site_id: 'site-1' }

function rpcClient(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }))
  const eqSite = vi.fn(() => Promise.resolve({ error: null }))
  const eqId = vi.fn(() => ({ eq: eqSite }))
  const update = vi.fn(() => ({ eq: eqId }))
  const from = vi.fn(() => ({ update }))
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, update, from }
}

describe('markTokenInvalid', () => {
  it('encaminha os 6 parâmetros da RPC, com p_mode', async () => {
    const { client, rpc } = rpcClient({ data: [{ out_token_error_at: '2026-09-06T11:00:00Z' }] })
    await markTokenInvalid(client, ACC, 'transient', { fatal: false, mode: 'token_refresh' })
    expect(rpc).toHaveBeenCalledWith('instagram_mark_token_invalid', {
      p_account: 'acc-1', p_site: 'site-1', p_reason: 'transient',
      p_fatal: false, p_force_reason: false, p_mode: 'token_refresh',
    })
  })

  it('REDIGE o motivo antes de mandar ao banco', async () => {
    const { client, rpc } = rpcClient({ data: [] })
    await markTokenInvalid(client, ACC, `failed: access_token=${'a'.repeat(64)}`, { fatal: true })
    const reason = String((rpc.mock.calls[0]![1] as Record<string, unknown>).p_reason)
    expect(reason).not.toContain('a'.repeat(64))
    expect(reason).toContain('[REDACTED]')
  })

  it('trunca o motivo em 500 caracteres', async () => {
    const { client, rpc } = rpcClient({ data: [] })
    await markTokenInvalid(client, ACC, 'x'.repeat(900), { fatal: true })
    expect(String((rpc.mock.calls[0]![1] as Record<string, unknown>).p_reason)).toHaveLength(500)
  })

  it('forceReason:true é repassado', async () => {
    const { client, rpc } = rpcClient({ data: [] })
    await markTokenInvalid(client, ACC, 'deauthorized', { fatal: true, forceReason: true })
    expect((rpc.mock.calls[0]![1] as Record<string, unknown>).p_force_reason).toBe(true)
  })

  it('RPC com error => captureException, throw, e a linha NÃO É TOCADA (Achado 2, fix round C2)', async () => {
    const { client, from } = rpcClient({ error: { message: 'PGRST202 not found' } })
    await expect(markTokenInvalid(client, ACC, 'expired', { fatal: true }))
      .rejects.toBeInstanceOf(MarkTokenInvalidError)
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
    // O fallback antigo fazia um update direto sem reproduzir as guardas da
    // RPC — provamos AUSÊNCIA de efeito (from nunca chamado), não só que uma
    // chamada específica não ocorreu.
    expect(from).not.toHaveBeenCalled()
  })

  it('chamada NÃO-FATAL durante um episódio FATAL aberto, com a RPC falhando, não sobrescreve reason nem started_at (Achado 2)', async () => {
    // Cenário do achado: um `evaluateTransientStreak('daily')` dispara uma
    // marcação NÃO-FATAL enquanto a conta já tem um episódio FATAL aberto
    // (token_error/token_error_at != null de um 'expired'/'revoked'
    // anterior). Se a RPC em si falhar (permissão, coluna faltando, rede),
    // o fallback antigo escreveria `token_error: null` e `token_error_at:
    // now()` incondicionalmente, apagando o motivo e o início do episódio
    // fatal registrado e rebaixando-o para transitório. O fallback correto é
    // não escrever nada.
    const { client, from } = rpcClient({ error: { message: 'network down' } })
    await expect(markTokenInvalid(client, ACC, 'transient', { fatal: false, mode: 'daily' }))
      .rejects.toBeInstanceOf(MarkTokenInvalidError)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('evaluateTransientStreak — POR MODO', () => {
  const DAY = 86_400_000
  function logClient(rows: Array<{ started_at: string; mode: string; status: string; error_message: string | null }>) {
    const rpc = vi.fn(() => Promise.resolve({ data: [], error: null }))
    const gt = vi.fn(() => Promise.resolve({ data: rows, error: null }))
    const inStatus = vi.fn(() => ({ gt }))
    const inMode = vi.fn(() => ({ in: inStatus }))
    const eq = vi.fn(() => ({ in: inMode }))
    const select = vi.fn(() => ({ eq }))
    const eqSite = vi.fn(() => Promise.resolve({ error: null }))
    const eqId = vi.fn(() => ({ eq: eqSite }))
    const update = vi.fn(() => ({ eq: eqId }))
    const from = vi.fn(() => ({ select, update }))
    return { client: { rpc, from } as unknown as SupabaseClient, rpc }
  }
  function fail(daysAgo: number, mode: string, hour = 11) {
    const d = new Date(Date.now() - daysAgo * DAY)
    d.setUTCHours(hour, 0, 5, 0)
    return { started_at: d.toISOString(), mode, status: 'failed', error_message: 'transient: 429' }
  }
  function done(daysAgo: number, mode: string, hour = 13) {
    const d = new Date(Date.now() - daysAgo * DAY)
    d.setUTCHours(hour, 0, 5, 0)
    return { started_at: d.toISOString(), mode, status: 'completed', error_message: null }
  }

  it('3 dias UTC de token_refresh falhando + daily completed diário => ABRE com mode token_refresh', async () => {
    const { client, rpc } = logClient([
      fail(2, 'token_refresh'), fail(1, 'token_refresh'), fail(0, 'token_refresh'),
      done(2, 'daily'), done(1, 'daily'), done(0, 'daily'),
    ])
    expect(await evaluateTransientStreak(client, ACC, 'token_refresh')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('instagram_mark_token_invalid', expect.objectContaining({
      p_fatal: false, p_mode: 'token_refresh',
    }))
  })

  it('2 falhas no MESMO dia UTC + 1 em outro => nada (2 dias distintos)', async () => {
    const { client, rpc } = logClient([
      fail(1, 'token_refresh', 11), fail(1, 'token_refresh', 13), fail(0, 'token_refresh'),
    ])
    expect(await evaluateTransientStreak(client, ACC, 'token_refresh')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('dias 1/3/5 => nada (fora da janela de 4 dias)', async () => {
    const { client, rpc } = logClient([fail(5, 'daily'), fail(3, 'daily'), fail(1, 'daily')])
    // a query já filtra > now - 4 days; aqui o retorno simula só o que passou
    const filtered = logClient([fail(3, 'daily'), fail(1, 'daily')])
    expect(await evaluateTransientStreak(filtered.client, ACC, 'daily')).toBe(false)
    expect(filtered.rpc).not.toHaveBeenCalled()
    void client; void rpc
  })

  it('completed DO MESMO MODO mais novo que a falha mais antiga => nada', async () => {
    const { client, rpc } = logClient([
      fail(2, 'daily'), fail(1, 'daily'), fail(0, 'daily'), done(1, 'daily', 20),
    ])
    expect(await evaluateTransientStreak(client, ACC, 'daily')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('linhas timeout / never_connected / infra: / permanent: / detail: são ignoradas', async () => {
    const { client, rpc } = logClient([
      { ...fail(2, 'daily'), error_message: 'timeout' },
      { ...fail(1, 'daily'), error_message: 'never_connected' },
      { ...fail(0, 'daily'), error_message: 'infra: duplicate key value' },
      { ...fail(0, 'daily'), error_message: 'permanent: expired' },
      { ...fail(0, 'daily'), error_message: 'detail: recovered' },
    ])
    expect(await evaluateTransientStreak(client, ACC, 'daily')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})

// ── sweepTokenAlerts / deliverTokenAlert (Tarefa 10) ────────────────────────

const mockNtfy = vi.mocked(sendNtfyAlert)
const mockFanOut = vi.mocked(fanOutToSiteAdminsDetailed)
const HOUR = 3_600_000

function alertRow(over: Partial<ITokenAlertRow> = {}): ITokenAlertRow {
  return {
    id: 'r-pt', site_id: 'site-1', handle: 'thiago.figueiredo',
    ig_user_id: '17841400000000000', ig_user_id_source: 'oauth',
    token_error: 'expired',
    token_error_at: new Date(Date.now() - 2 * HOUR).toISOString(),
    token_error_mode: null, token_alert_sent_at: null, token_alert_attempt_at: null,
    ...over,
  }
}

/** Supabase mock que serve o select largo de contas + slugs + os updates de marca-passo. */
function sweepClient(rows: ITokenAlertRow[]) {
  const updates: Array<Record<string, unknown>> = []
  const client = {
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
    from: vi.fn((table: string) => {
      if (table === 'sites') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 'site-1', slug: 'bythiagofigueiredo' }], error: null }) }) }
      }
      // `.not(...)` deve ser tanto "then-ável" (o caminho sem `filter.siteId`
      // faz `await base` direto) quanto encadeável com `.eq(...)` (o caminho
      // COM `filter.siteId` chama `base.eq(...)` antes do await).
      const notResult = {
        eq: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        then: (resolve: (v: { data: ITokenAlertRow[]; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      }
      return {
        select: vi.fn(() => ({ not: vi.fn(() => notResult) })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updates.push(patch)
          return { in: vi.fn(() => Promise.resolve({ error: null })) }
        }),
      }
    }),
  }
  return { client: client as unknown as SupabaseClient, updates }
}

beforeEach(() => {
  mockNtfy.mockReset()
  mockFanOut.mockReset()
  mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  mockNtfy.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://bythiagofigueiredo.com')
})

describe('identityKeyOf', () => {
  it('oauth com ig_user_id => "o:<id>"', () => {
    expect(identityKeyOf({ ig_user_id_source: 'oauth', ig_user_id: '12345', handle: 'X' })).toBe('o:12345')
  })
  it('legacy => "h:<handle minúsculo>"', () => {
    expect(identityKeyOf({ ig_user_id_source: 'legacy', ig_user_id: '12345', handle: 'Foo.Bar' })).toBe('h:foo.bar')
  })
  it('handle "12345" e id "12345" produzem chaves DIFERENTES', () => {
    expect(identityKeyOf({ ig_user_id_source: 'legacy', ig_user_id: null, handle: '12345' }))
      .not.toBe(identityKeyOf({ ig_user_id_source: 'oauth', ig_user_id: '12345', handle: 'x' }))
  })
})

describe('deliverTokenAlert — REGRA-PII-NTFY e forma do payload', () => {
  const group = {
    siteId: 'site-1', identityKey: 'o:17841400000000000', handle: 'thiago.figueiredo',
    slug: 'bythiagofigueiredo', subject: 'auto-renewal' as const,
    rows: [alertRow(), alertRow({ id: 'r-en' })],
  }

  it('o título entregue a CMS/e-mail mantém "· @handle"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const arg = mockFanOut.mock.calls[0]![0]
    expect(arg.title).toBe('Instagram token expired · @thiago.figueiredo')
  })

  it('o push usa ntfyTitle com o SLUG e nunca "@"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const push = mockNtfy.mock.calls[0]![0]
    expect(push.title).toBe('Instagram token expired · bythiagofigueiredo')
    expect(push.title).not.toContain('@')
  })

  it('body é fixo: "<N> account(s) · open since <dia>. Open the CMS for the reason."', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockNtfy.mock.calls[0]![0].body)
      .toBe('2 account(s) · open since 2026-09-04. Open the CMS for the reason.')
  })

  it('nem title nem body do push carregam handle, ids ou token_error', async () => {
    const { client } = sweepClient([])
    const dirty = { ...group, rows: [alertRow({
      token_error: 'The session has been invalidated because the user changed their password' })] }
    await deliverTokenAlert(client, dirty, 'invalid', '2026-09-04', { reminder: false, longOpen: false })
    const { title, body } = mockNtfy.mock.calls[0]![0]
    expect(`${title} ${body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${title} ${body}`).not.toMatch(/[0-9]{6,}/)
    expect(`${title} ${body}`).not.toContain('invalidated')
  })

  it('priority default (nunca high) com tag rotating_light e Click', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const push = mockNtfy.mock.calls[0]![0]
    expect(push.priority).toBe('default')
    expect(push.tags).toEqual(['rotating_light'])
    expect(push.click).toBe('https://bythiagofigueiredo.com/cms/settings/instagram')
  })

  it('message termina em "— <RECONNECT_CTA> at <APP_URL>/cms/settings/instagram"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].message)
      .toMatch(/— paste a new token at https:\/\/bythiagofigueiredo\.com\/cms\/settings\/instagram$/)
  })

  it('message escapa & < > " \' (adapters/email.ts:30 interpola cru)', async () => {
    const { client } = sweepClient([])
    const xss = { ...group, rows: [alertRow({ token_error: '<img src=x onerror=1>' })] }
    await deliverTokenAlert(client, xss, 'invalid', '2026-09-04', { reminder: false, longOpen: false })
    const msg = mockFanOut.mock.calls[0]![0].message
    expect(msg).toContain('&lt;img src=x onerror=1&gt;')
    expect(msg).not.toContain('<img')
  })

  it('sempre defaultChannels:["email"], nunca channels', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const arg = mockFanOut.mock.calls[0]![0] as Record<string, unknown>
    expect(arg.defaultChannels).toEqual(['email'])
    expect(arg).not.toHaveProperty('channels')
  })

  it('nunca lança, mesmo com o ntfy explodindo', async () => {
    mockNtfy.mockRejectedValue(new Error('boom'))
    const { client } = sweepClient([])
    await expect(deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false }))
      .resolves.toBeTruthy()
  })
})

describe('deliverTokenAlert — títulos por kind e precedência longOpen > reminder > primeiro', () => {
  const g = (subject: 'feed sync' | 'auto-renewal' | 'sync') => ({
    siteId: 'site-1', identityKey: 'o:1', handle: 'h', slug: 's', subject, rows: [alertRow()],
  })
  it.each([
    ['transient', { reminder: false, longOpen: false }, 'Instagram auto-renewal failing · @h'],
    ['transient', { reminder: true, longOpen: false }, 'Instagram auto-renewal still retrying · @h'],
    ['transient', { reminder: false, longOpen: true }, 'Instagram auto-renewal still failing · @h'],
    ['transient', { reminder: true, longOpen: true }, 'Instagram auto-renewal still failing · @h'],
    ['expired', { reminder: false, longOpen: false }, 'Instagram token expired · @h'],
    ['revoked', { reminder: false, longOpen: false }, 'Instagram access revoked · @h'],
    ['invalid', { reminder: false, longOpen: false }, 'Instagram token invalid · @h'],
    ['expired', { reminder: true, longOpen: false }, 'Instagram still disconnected · @h'],
    ['revoked', { reminder: true, longOpen: false }, 'Instagram still disconnected · @h'],
    ['invalid', { reminder: true, longOpen: false }, 'Instagram still disconnected · @h'],
  ])('%s %o => %s', async (kind, opts, expected) => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, g('auto-renewal'), kind as never, '2026-09-04', opts as never)
    expect(mockFanOut.mock.calls[0]![0].title).toBe(expected)
  })

  it('subject "feed sync" quando o modo é daily', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, g('feed sync'), 'transient', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].title).toBe('Instagram feed sync failing · @h')
  })

  it('subject "sync" em grupo misto', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, g('sync'), 'transient', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].title).toBe('Instagram sync failing · @h')
  })
})

describe('deliverTokenAlert — desfecho do ntfy e marca-passo', () => {
  const group = {
    siteId: 'site-1', identityKey: 'o:1', handle: 'h', slug: 's', subject: 'auto-renewal' as const,
    rows: [alertRow()],
  }

  it('aceito => ntfy "sent" e sent_at gravado', async () => {
    const { client, updates } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('sent')
    expect(updates.some((u) => 'token_alert_attempt_at' in u)).toBe(true)
    expect(updates.some((u) => 'token_alert_sent_at' in u)).toBe(true)
  })

  it('429 => failed_transient e sent_at NÃO gravado (attempt_at sim)', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 429 })
    const { client, updates } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('failed_transient')
    expect(updates.some((u) => 'token_alert_sent_at' in u)).toBe(false)
    expect(updates.some((u) => 'token_alert_attempt_at' in u)).toBe(true)
  })

  it('403 => failed_terminal e e-mail de fallback "Instagram alert channel down"', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 403 })
    const { client } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('failed_terminal')
    expect(mockFanOut).toHaveBeenCalledTimes(2)
    expect(mockFanOut.mock.calls[1]![0]).toMatchObject({
      type: 'system.cron_failure',
      title: 'Instagram alert channel down',
      defaultChannels: ['email'],
    })
    expect(String(mockFanOut.mock.calls[1]![0].dedupKey)).toMatch(/^instagram-alert-channel-down:\d{4}-\d{2}-\d{2}$/)
  })

  it('NTFY_URL ausente => "skipped" (o e-mail sai assim mesmo)', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, reason: 'NTFY_URL unset' })
    const { client } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('skipped')
    expect(mockFanOut).toHaveBeenCalledTimes(1)
  })

  it('ntfy aceito mas fan-out não alcança nenhum admin => sent_at NÃO gravado', async () => {
    mockFanOut.mockResolvedValue({ total: 0, sent: 0, suppressed: 0, errors: [] })
    const { client, updates } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('sent')
    expect(r.notifications).toBe(0)
    expect(updates.some((u) => 'token_alert_sent_at' in u)).toBe(false)
    expect(updates.some((u) => 'token_alert_attempt_at' in u)).toBe(true)
  })
})

describe('sweepTokenAlerts — agrupamento, cadência e teto', () => {
  it('3 linhas pt/en/all da mesma identidade => 1 push, 1 fan-out, attempt_at nas 3', async () => {
    const rows = [alertRow({ id: 'pt' }), alertRow({ id: 'en' }), alertRow({ id: 'all' })]
    const { client, updates } = sweepClient(rows)
    const out = await sweepTokenAlerts(client)
    expect(out).toHaveLength(1)
    expect(mockNtfy).toHaveBeenCalledTimes(1)
    expect(mockFanOut).toHaveBeenCalledTimes(1)
    expect(updates.filter((u) => 'token_alert_attempt_at' in u)).toHaveLength(1) // um update .in([3 ids])
  })

  it('mesma conta em oauth X e legacy X => 2 grupos', async () => {
    const rows = [
      alertRow({ id: 'a', ig_user_id_source: 'oauth', ig_user_id: '999' }),
      alertRow({ id: 'b', ig_user_id_source: 'legacy', ig_user_id: '999' }),
    ]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(2)
  })

  it('attempt_at de 11:00 com sent_at null => cadência 1 h, entrega às 13:00', async () => {
    const rows = [alertRow({
      token_alert_attempt_at: new Date(Date.now() - 2 * HOUR).toISOString(),
      token_alert_sent_at: null,
    })]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(1)
  })

  it('sent_at presente e episódio de 2 dias => cadência 23 h (1×/dia)', async () => {
    const rows = [alertRow({
      token_error_at: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
      token_alert_sent_at: new Date(Date.now() - 2 * HOUR).toISOString(),
      token_alert_attempt_at: new Date(Date.now() - 2 * HOUR).toISOString(),
    })]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(0)
  })

  it('episódio de 15 dias => cadência semanal (6 d 23 h): 2 dias depois NÃO entrega', async () => {
    const rows = [alertRow({
      token_error_at: new Date(Date.now() - 15 * 24 * HOUR).toISOString(),
      token_alert_sent_at: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
      token_alert_attempt_at: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
    })]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(0)
  })

  it('teto verificado no FIM do grupo e relativo a sweepStart, nunca a runStart', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    // grupo iniciado aos 14 s: 14_000 + 12_000 > 25_000 => NÃO inicia
    const rows = [alertRow({ id: 'a', ig_user_id: '1' }), alertRow({ id: 'b', ig_user_id: '2' })]
    mockFanOut.mockImplementation(async () => {
      vi.advanceTimersByTime(14_000)
      return { total: 1, sent: 1, suppressed: 0, errors: [] }
    })
    const { client } = sweepClient(rows)
    const out = await sweepTokenAlerts(client)
    expect(out).toHaveLength(1) // o segundo grupo não inicia
    vi.useRealTimers()
  })

  it('filtro por identityKey só processa aquele grupo', async () => {
    const rows = [
      alertRow({ id: 'a', ig_user_id: '111' }),
      alertRow({ id: 'b', ig_user_id: '222' }),
    ]
    const { client } = sweepClient(rows)
    const out = await sweepTokenAlerts(client, { identityKey: 'o:222' })
    expect(out).toHaveLength(1)
    expect(out[0]!.identityKey).toBe('o:222')
  })

  it('longOpen: transitório aberto há 70 h => título "still failing"', async () => {
    const rows = [alertRow({
      token_error: null,
      token_error_at: new Date(Date.now() - 70 * HOUR).toISOString(),
      token_error_mode: 'token_refresh',
    })]
    const { client } = sweepClient(rows)
    await sweepTokenAlerts(client)
    expect(mockFanOut.mock.calls[0]![0].title).toContain('still failing')
  })
})

describe('dedupKey — aritmética das 6 varreduras (§3.2)', () => {
  it('ntfy nunca aceito em 6 varreduras (3 dias UTC) => 6 pushes, 4 chaves distintas', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 429 })
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })

    const state = alertRow({ token_error_at: '2026-09-06T10:00:00Z' })
    const keys: string[] = []
    mockFanOut.mockImplementation(async (o) => {
      keys.push(o.dedupKey)
      return { total: 1, sent: 1, suppressed: 0, errors: [] }
    })

    for (const [dayOffset, hour] of [[0, 11], [0, 13], [1, 11], [1, 13], [2, 11], [2, 13]] as const) {
      vi.setSystemTime(new Date(Date.UTC(2026, 8, 6 + dayOffset, hour, 0, 0)))
      const { client } = sweepClient([{ ...state }])
      await sweepTokenAlerts(client)
      // depois da 1ª entrega o attempt_at existe e o sent_at continua nulo
      state.token_alert_attempt_at = new Date().toISOString()
    }

    expect(mockNtfy).toHaveBeenCalledTimes(6)
    expect(new Set(keys).size).toBe(4)
    const base = keys[0]!
    expect(base).not.toMatch(/:d\d{4}-\d{2}-\d{2}$/)
    expect(keys[1]).toBe(`${base}:d2026-09-06`)
    expect(keys[2]).toBe(`${base}:d2026-09-07`)
    expect(keys[4]).toBe(`${base}:d2026-09-08`)
    vi.useRealTimers()
  })
})
