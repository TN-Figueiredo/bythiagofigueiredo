// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

import { encrypt } from '@tn-figueiredo/social/vault'
import {
  VaultUnavailableError,
  classifyInstagramError,
  getVaultKeyOrNull,
  readAccessToken,
  writeAccessToken,
} from '@/lib/instagram/token'

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

  it('(3) permanent: decrypt_failed e as mensagens de conta desconectada', () => {
    expect(classifyInstagramError(new Error('decrypt_failed'))).toBe('permanent')
    expect(classifyInstagramError(new Error('The session has been invalidated because the user changed their password')))
      .toBe('permanent')
  })

  it('(4) default: 400 SEM type => transient', () => {
    expect(classifyInstagramError({ httpStatus: 400, type: 'HttpError', code: 400, message: 'Instagram API 400' }))
      .toBe('transient')
  })
})
