import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Shared HMAC-signed `state` for every OAuth flow in the app.
 *
 * Extracted in commit B from `api/social/oauth/[provider]/route.ts:32-40` and
 * `.../callback/route.ts:43-46,76-94`, which had two copies of `deriveHmacKey`,
 * a payload with no `typ` and no `exp`, and a `verifyState` that cast the
 * parsed JSON without validating its shape.
 */

export type OauthStateType = 'state' | 'rebind' | 'mismatch'

export interface IOauthStatePayload {
  /** Which flow signed this. A payload with no valid `typ` never verifies. */
  typ: OauthStateType
  siteId: string
  userId?: string
  accountId?: string
  origin?: string
  nonce?: string
  allowRebindTo?: string
  authorizedIgUserId?: string
  authorizedHandle?: string
  /**
   * Expiry in SECONDS since the epoch — the same unit as `payload.expires` of
   * a Meta `signed_request`. Sign it as `Math.floor(Date.now() / 1000) + N`.
   * `verifyState` compares it against the wall clock unconditionally.
   */
  exp?: number
}

export interface IVerifyStateOptions {
  /** Reject any payload whose `typ` differs from this one (absent included). */
  typ?: OauthStateType
  /** Reject a payload with no `nonce`. */
  requireNonce?: boolean
  /** Reject a payload with no `exp`. Expiry itself is always enforced. */
  requireExp?: boolean
}

/** HMAC label of the social publishing flow (`social_connections`). */
export const SOCIAL_STATE_LABEL = 'oauth-state-hmac'
/** HMAC label of the Instagram feed flow (`instagram_accounts`) — used from C3. */
export const INSTAGRAM_STATE_LABEL = 'instagram-oauth-state-hmac'
/** 30 minutes. The Meta `code` is valid for 1 h; the state closes earlier. */
export const STATE_TTL_SECONDS = 1800

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX64_RE = /^[0-9a-f]{64}$/i
const STATE_TYPES: readonly OauthStateType[] = ['state', 'rebind', 'mismatch']
const STRING_FIELDS = [
  'origin',
  'nonce',
  'allowRebindTo',
  'authorizedIgUserId',
  'authorizedHandle',
] as const

/** Derive a purpose-specific HMAC key so the master key is never used directly for signing. */
export function deriveHmacKey(masterKeyHex: string, label: string): string {
  return createHmac('sha256', masterKeyHex).update(label).digest('hex')
}

export function signState(payload: IOauthStatePayload, key: string): string {
  const json = JSON.stringify(payload)
  const hmac = createHmac('sha256', key).update(json).digest('hex')
  return `${Buffer.from(json).toString('base64')}.${hmac}`
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isOptionalUuid(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && UUID_RE.test(value))
}

/**
 * Verify + validate. Returns `null` on ANY deviation and MUST NOT throw — a
 * thrown value here would surface as a 500 in a popup the user is staring at.
 */
export function verifyState(
  signed: string,
  key: string,
  opts: IVerifyStateOptions = {},
): IOauthStatePayload | null {
  try {
    let decoded: string
    try {
      decoded = decodeURIComponent(signed)
    } catch {
      return null
    }

    const dotIdx = decoded.lastIndexOf('.')
    if (dotIdx === -1) return null
    const b64 = decoded.substring(0, dotIdx)
    const hmac = decoded.substring(dotIdx + 1)
    if (!b64 || !HEX64_RE.test(hmac)) return null

    const json = Buffer.from(b64, 'base64').toString('utf-8')
    const expected = createHmac('sha256', key).update(json).digest('hex')
    const hmacBuf = Buffer.from(hmac, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (hmacBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(hmacBuf, expectedBuf)) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return null
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const p = parsed as Record<string, unknown>

    if (!isNonEmptyString(p.siteId) || !UUID_RE.test(p.siteId)) return null
    if (!isOptionalUuid(p.userId)) return null
    if (!isOptionalUuid(p.accountId)) return null

    for (const field of STRING_FIELDS) {
      if (p[field] !== undefined && !isNonEmptyString(p[field])) return null
    }

    if (!isNonEmptyString(p.typ) || !STATE_TYPES.includes(p.typ as OauthStateType)) return null

    // Expiry is compared against the clock whenever `exp` is present. Presence
    // itself is `requireExp`'s job — a captured state must stop working, and
    // the cookie `Max-Age` that mirrors it is enforced by the CLIENT.
    if (p.exp !== undefined) {
      if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null
      if (p.exp * 1000 <= Date.now()) return null
    }

    if (opts.typ !== undefined && p.typ !== opts.typ) return null
    if (opts.requireNonce === true && !isNonEmptyString(p.nonce)) return null
    if (opts.requireExp === true && p.exp === undefined) return null

    return p as unknown as IOauthStatePayload
  } catch {
    return null
  }
}
