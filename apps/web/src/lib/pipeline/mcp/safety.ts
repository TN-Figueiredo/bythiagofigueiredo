import { createHmac, timingSafeEqual } from 'crypto'
import type { McpToolResult } from './errors'
import { toMcpSuccess } from './errors'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PlannedChange {
  entity: string
  id: string
  field: string
  from: unknown
  to: unknown
}

interface RateWindow {
  timestamps: number[]
}

type OperationType = 'single' | 'bulk' | 'destructive'

/* ------------------------------------------------------------------ */
/*  HMAC confirmation tokens                                           */
/* ------------------------------------------------------------------ */

const HMAC_SECRET_ENV = 'PIPELINE_COWORK_KEY'
const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getHmacSecret(): string {
  const secret = process.env[HMAC_SECRET_ENV]
  if (!secret) {
    throw new Error(`${HMAC_SECRET_ENV} environment variable is required for MCP safety tokens`)
  }
  return secret
}

/**
 * Canonical payload for HMAC signing.
 * Deterministic: sorts keys to guarantee stable output.
 */
function canonicalize(action: string, params: Record<string, unknown>, timestamp: number): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = params[key]
      return acc
    }, {})
  return JSON.stringify({ action, params: sorted, t: timestamp })
}

/**
 * Generates an HMAC-SHA256 confirmation token for a destructive or
 * high-impact action. The token embeds a timestamp for TTL validation.
 *
 * Flow:
 *  1. Tool returns dry-run result + token
 *  2. LLM confirms by calling tool again with the token
 *  3. Server validates token before executing
 */
export function generateConfirmationToken(action: string, params: Record<string, unknown>): string {
  const timestamp = Date.now()
  const payload = canonicalize(action, params, timestamp)
  const hmac = createHmac('sha256', getHmacSecret()).update(payload).digest('hex')
  // Format: timestamp.hmac (easy to parse, no base64 issues)
  return `${timestamp}.${hmac}`
}

/**
 * Validates a confirmation token against the expected action + params.
 *
 * Returns false if:
 *  - Token format is invalid
 *  - Token has expired (> 5 min)
 *  - HMAC does not match (params changed, tampered)
 */
export function validateConfirmationToken(
  token: string,
  action: string,
  params: Record<string, unknown>,
): boolean {
  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return false

  const timestampStr = token.slice(0, dotIndex)
  const providedHmac = token.slice(dotIndex + 1)

  const timestamp = Number(timestampStr)
  if (!Number.isFinite(timestamp)) return false

  // TTL check
  if (Date.now() - timestamp > TOKEN_TTL_MS) return false

  // Recompute expected HMAC
  const payload = canonicalize(action, params, timestamp)
  const expectedHmac = createHmac('sha256', getHmacSecret()).update(payload).digest('hex')

  // Timing-safe comparison
  if (providedHmac.length !== expectedHmac.length) return false
  return timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
}

/* ------------------------------------------------------------------ */
/*  Rate-of-change governor                                            */
/* ------------------------------------------------------------------ */

/**
 * Per-key sliding window rate governor.
 *
 * Separate from the existing pipeline rate limiter (which limits total
 * requests). This governor limits the *rate of mutations* to prevent
 * runaway LLM loops from making too many changes too fast.
 *
 * In-memory Map is acceptable for v1 single-instance on Vercel.
 * Each serverless invocation starts fresh, which is actually safer
 * (natural reset on cold start).
 */
const governorMap = new Map<string, RateWindow>()

const GOVERNOR_LIMITS: Record<OperationType, { maxOps: number; windowMs: number }> = {
  single:      { maxOps: 30, windowMs: 60_000 },   // 30 single writes/min
  bulk:        { maxOps: 5,  windowMs: 60_000 },    // 5 bulk operations/min
  destructive: { maxOps: 2,  windowMs: 300_000 },   // 2 destructive ops/5min
}

/**
 * Prune stale windows when map grows too large (>500 keys).
 */
function pruneGovernorMap(): void {
  if (governorMap.size <= 500) return
  const now = Date.now()
  const maxWindow = Math.max(...Object.values(GOVERNOR_LIMITS).map((l) => l.windowMs))
  for (const [key, window] of governorMap) {
    const newest = window.timestamps[window.timestamps.length - 1]
    if (newest === undefined || now - newest > maxWindow) {
      governorMap.delete(key)
    }
  }
}

/**
 * Checks whether the given key is allowed to perform the operation.
 *
 * @returns `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }`.
 */
export function checkRateGovernor(
  keyHash: string,
  operationType: OperationType,
): { allowed: boolean; retryAfterSeconds?: number } {
  pruneGovernorMap()

  const limits = GOVERNOR_LIMITS[operationType]
  const mapKey = `${keyHash}:${operationType}`
  const now = Date.now()

  const window = governorMap.get(mapKey)
  if (!window) {
    governorMap.set(mapKey, { timestamps: [now] })
    return { allowed: true }
  }

  // Slide window: keep only timestamps within the window
  const cutoff = now - limits.windowMs
  window.timestamps = window.timestamps.filter((t) => t > cutoff)

  if (window.timestamps.length >= limits.maxOps) {
    const oldest = window.timestamps[0]!
    const retryAfterMs = oldest + limits.windowMs - now
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(Math.max(0, retryAfterMs) / 1000),
    }
  }

  window.timestamps.push(now)
  return { allowed: true }
}

/* ------------------------------------------------------------------ */
/*  Dry-run formatter                                                  */
/* ------------------------------------------------------------------ */

/**
 * Formats a list of planned changes into an MCP tool result for
 * dry-run mode. Includes a confirmation token so the caller can
 * confirm execution in a follow-up call.
 */
export function formatDryRunResult(
  action: string,
  params: Record<string, unknown>,
  changes: PlannedChange[],
): McpToolResult {
  const token = generateConfirmationToken(action, params)

  const result = toMcpSuccess({
    dry_run: true,
    confirmation_token: token,
    planned_changes: changes.map((c) => ({
      entity: c.entity,
      id: c.id,
      field: c.field,
      from: c.from,
      to: c.to,
    })),
    instructions: 'Review the planned changes above. To execute, call this tool again with the same parameters and add confirmation_token to the input.',
  }, {
    dry_run: true,
    change_count: changes.length,
  })

  return result
}

/* ------------------------------------------------------------------ */
/*  Test helpers (exported for unit tests only)                        */
/* ------------------------------------------------------------------ */

/** @internal */
export function _resetGovernorMap(): void {
  governorMap.clear()
}
