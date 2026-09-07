// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  deriveHmacKey,
  signState,
  verifyState,
  SOCIAL_STATE_LABEL,
  INSTAGRAM_STATE_LABEL,
  STATE_TTL_SECONDS,
  type IOauthStatePayload,
} from '@/lib/oauth/state'

const MASTER = 'a'.repeat(64)
const KEY = deriveHmacKey(MASTER, SOCIAL_STATE_LABEL)
const IG_KEY = deriveHmacKey(MASTER, INSTAGRAM_STATE_LABEL)

const SITE = '11111111-2222-4333-8444-555555555555'
const USER = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const ACCOUNT = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0)

function base(overrides: Partial<IOauthStatePayload> = {}): IOauthStatePayload {
  return { typ: 'state', siteId: SITE, userId: USER, ...overrides }
}

/** Sign an arbitrary JSON string so malformed payloads can carry a VALID hmac. */
function signRaw(json: string, key: string = KEY): string {
  const hmac = createHmac('sha256', key).update(json).digest('hex')
  return `${Buffer.from(json).toString('base64')}.${hmac}`
}

afterEach(() => {
  vi.useRealTimers()
})

describe('deriveHmacKey', () => {
  it('returns 64 hex chars and differs per label', () => {
    expect(KEY).toMatch(/^[0-9a-f]{64}$/)
    expect(IG_KEY).toMatch(/^[0-9a-f]{64}$/)
    expect(KEY).not.toBe(IG_KEY)
  })
})

describe('verifyState — round trip', () => {
  it('returns the payload it signed', () => {
    const payload = base({ accountId: ACCOUNT, origin: 'https://example.com', nonce: 'deadbeef' })
    expect(verifyState(signState(payload, KEY), KEY)).toEqual(payload)
  })

  it('survives encodeURIComponent on the wire', () => {
    const signed = encodeURIComponent(signState(base(), KEY))
    expect(verifyState(signed, KEY)).toEqual(base())
  })
})

describe('verifyState — rejection', () => {
  it('rejects a tampered payload', () => {
    const signed = signState(base(), KEY)
    const [b64, hmac] = signed.split('.')
    const tampered = Buffer.from(
      JSON.stringify(base({ siteId: ACCOUNT })),
    ).toString('base64')
    expect(b64).not.toBe(tampered)
    expect(verifyState(`${tampered}.${hmac}`, KEY)).toBeNull()
  })

  it('rejects a signature signed with the other label', () => {
    expect(verifyState(signState(base(), IG_KEY), KEY)).toBeNull()
  })

  it('rejects garbage with no dot separator', () => {
    expect(verifyState('not-a-state', KEY)).toBeNull()
  })

  it('rejects a non-hex hmac without throwing', () => {
    const b64 = Buffer.from(JSON.stringify(base())).toString('base64')
    expect(verifyState(`${b64}.${'z'.repeat(64)}`, KEY)).toBeNull()
  })

  it('rejects a malformed percent-escape', () => {
    expect(verifyState('%E0%A4%A', KEY)).toBeNull()
  })

  it('rejects a validly signed payload that is not JSON', () => {
    expect(verifyState(signRaw('not json at all'), KEY)).toBeNull()
  })

  it.each([
    ['null siteId', '{"typ":"state","siteId":null}'],
    ['object siteId', '{"typ":"state","siteId":{}}'],
    ['array siteId', '{"typ":"state","siteId":[]}'],
    ['non-uuid siteId', '{"typ":"state","siteId":"not-a-uuid"}'],
    ['array root', '[]'],
    ['null root', 'null'],
    ['string root', '"nope"'],
  ])('rejects %s even with a valid hmac', (_label, json) => {
    expect(verifyState(signRaw(json), KEY)).toBeNull()
  })

  it('rejects a non-uuid userId', () => {
    expect(verifyState(signRaw(`{"typ":"state","siteId":"${SITE}","userId":"x"}`), KEY)).toBeNull()
  })

  it('rejects an empty-string nonce', () => {
    expect(verifyState(signRaw(`{"typ":"state","siteId":"${SITE}","nonce":""}`), KEY)).toBeNull()
  })

  it('rejects a payload with no typ at all', () => {
    expect(verifyState(signRaw(`{"siteId":"${SITE}","userId":"${USER}"}`), KEY)).toBeNull()
  })

  it('rejects an unknown typ', () => {
    expect(verifyState(signRaw(`{"typ":"bogus","siteId":"${SITE}"}`), KEY)).toBeNull()
  })

  it('rejects a typ different from opts.typ', () => {
    const signed = signState(base({ typ: 'rebind' }), KEY)
    expect(verifyState(signed, KEY, { typ: 'state' })).toBeNull()
    expect(verifyState(signed, KEY, { typ: 'rebind' })).not.toBeNull()
  })

  it('honours requireNonce', () => {
    const signed = signState(base(), KEY)
    expect(verifyState(signed, KEY, { requireNonce: true })).toBeNull()
    expect(verifyState(signState(base({ nonce: 'ab12' }), KEY), KEY, { requireNonce: true })).not.toBeNull()
  })

  it('honours requireExp when exp is absent', () => {
    expect(verifyState(signState(base(), KEY), KEY, { requireExp: true })).toBeNull()
  })
})

describe('verifyState — exp is compared against the clock', () => {
  it('accepts a state 29 minutes into its 30-minute window, payload intact', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const payload = base({ exp: Math.floor(NOW / 1000) + STATE_TTL_SECONDS })
    const signed = signState(payload, KEY)
    vi.setSystemTime(NOW + 29 * 60_000)
    expect(verifyState(signed, KEY, { typ: 'state', requireExp: true })).toEqual(payload)
  })

  it('rejects the same state at 31 minutes', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const signed = signState(base({ exp: Math.floor(NOW / 1000) + STATE_TTL_SECONDS }), KEY)
    vi.setSystemTime(NOW + 31 * 60_000)
    expect(verifyState(signed, KEY, { typ: 'state', requireExp: true })).toBeNull()
  })

  it('rejects exp one second in the past', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const signed = signState(base({ exp: Math.floor(NOW / 1000) - 1 }), KEY)
    expect(verifyState(signed, KEY, { typ: 'state', requireExp: true })).toBeNull()
  })

  it('rejects an expired exp even WITHOUT requireExp', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const signed = signState(base({ exp: Math.floor(NOW / 1000) - 1 }), KEY)
    expect(verifyState(signed, KEY)).toBeNull()
  })

  it.each<['state' | 'rebind' | 'mismatch']>([['state'], ['rebind'], ['mismatch']])(
    'rejects an expired exp for typ=%s',
    (typ) => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
      const signed = signState(base({ typ, exp: Math.floor(NOW / 1000) - 1 }), KEY)
      expect(verifyState(signed, KEY, { typ })).toBeNull()
      expect(verifyState(signed, KEY, { typ, requireExp: true })).toBeNull()
    },
  )

  it('rejects a non-finite exp', () => {
    expect(verifyState(signRaw(`{"typ":"state","siteId":"${SITE}","exp":"soon"}`), KEY)).toBeNull()
  })
})

describe('verifyState — never throws', () => {
  it.each(['', '.', '..', 'a.b', '%%%', 'AAAA.', '.AAAA', Buffer.from('{').toString('base64') + '.x'])(
    'returns null for %j',
    (input) => {
      expect(() => verifyState(input, KEY)).not.toThrow()
      expect(verifyState(input, KEY)).toBeNull()
    },
  )
})
