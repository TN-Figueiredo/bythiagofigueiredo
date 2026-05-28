/**
 * MCP Safety layer tests — verifies confirmation tokens, rate governing,
 * dry-run patterns, and destructive operation guards.
 *
 * These tests exercise the safety primitives that protect against
 * accidental data mutation via MCP tools.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash, randomUUID } from 'crypto'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createTestMcpPair, extractToolResultJson, MOCK_ITEM_ID, MOCK_PLAYLIST_ID, type McpTestPair } from './helpers'

// ---------------------------------------------------------------------------
// Confirmation token primitives
// ---------------------------------------------------------------------------

const TOKEN_SECRET = 'test-mcp-confirmation-secret-key'
const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Generates a confirmation token for a destructive action.
 * The token encodes the action, target, timestamp, and a HMAC signature.
 */
function generateConfirmationToken(action: string, targetId: string, now?: number): string {
  const timestamp = now ?? Date.now()
  const payload = `${action}:${targetId}:${timestamp}`
  const signature = createHash('sha256').update(`${payload}:${TOKEN_SECRET}`).digest('hex').slice(0, 16)
  return Buffer.from(JSON.stringify({ action, targetId, timestamp, sig: signature })).toString('base64url')
}

/**
 * Validates a confirmation token. Returns the decoded payload on success,
 * or throws with a descriptive error on failure.
 */
function validateConfirmationToken(
  token: string,
  expectedAction: string,
  expectedTargetId: string,
  now?: number,
): { action: string; targetId: string; timestamp: number } {
  const currentTime = now ?? Date.now()

  let decoded: { action: string; targetId: string; timestamp: number; sig: string }
  try {
    decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
  } catch {
    throw new Error('INVALID_TOKEN: malformed token')
  }

  // Verify signature
  const payload = `${decoded.action}:${decoded.targetId}:${decoded.timestamp}`
  const expectedSig = createHash('sha256').update(`${payload}:${TOKEN_SECRET}`).digest('hex').slice(0, 16)
  if (decoded.sig !== expectedSig) {
    throw new Error('INVALID_TOKEN: signature mismatch')
  }

  // Verify action and target
  if (decoded.action !== expectedAction) {
    throw new Error('INVALID_TOKEN: action mismatch')
  }
  if (decoded.targetId !== expectedTargetId) {
    throw new Error('INVALID_TOKEN: target mismatch')
  }

  // Check expiry
  if (currentTime - decoded.timestamp > TOKEN_TTL_MS) {
    throw new Error('EXPIRED_TOKEN: token has expired')
  }

  return { action: decoded.action, targetId: decoded.targetId, timestamp: decoded.timestamp }
}

// ---------------------------------------------------------------------------
// Rate governor
// ---------------------------------------------------------------------------

interface RateGovernor {
  check(key: string): { allowed: boolean; remaining: number; resetMs: number }
  reset(key: string): void
}

function createRateGovernor(limit: number, windowMs: number): RateGovernor {
  const buckets = new Map<string, { count: number; windowStart: number }>()

  return {
    check(key: string) {
      const now = Date.now()
      const bucket = buckets.get(key)

      if (!bucket || now - bucket.windowStart > windowMs) {
        buckets.set(key, { count: 1, windowStart: now })
        return { allowed: true, remaining: limit - 1, resetMs: windowMs }
      }

      if (bucket.count >= limit) {
        const resetMs = bucket.windowStart + windowMs - now
        return { allowed: false, remaining: 0, resetMs }
      }

      bucket.count++
      return {
        allowed: true,
        remaining: limit - bucket.count,
        resetMs: bucket.windowStart + windowMs - now,
      }
    },

    reset(key: string) {
      buckets.delete(key)
    },
  }
}

// ---------------------------------------------------------------------------
// Tests: Confirmation tokens
// ---------------------------------------------------------------------------

describe('Safety — generateConfirmationToken + validateConfirmationToken round-trip', () => {
  it('generates and validates a token successfully', () => {
    const now = Date.now()
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID, now)

    const result = validateConfirmationToken(token, 'delete_item', MOCK_ITEM_ID, now)
    expect(result.action).toBe('delete_item')
    expect(result.targetId).toBe(MOCK_ITEM_ID)
    expect(result.timestamp).toBe(now)
  })

  it('token is a valid base64url string', () => {
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID)
    // base64url only contains [A-Za-z0-9_-]
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('validates token within TTL window', () => {
    const createdAt = Date.now()
    const token = generateConfirmationToken('delete_playlist', MOCK_PLAYLIST_ID, createdAt)

    // Validate 2 minutes later — within the 5-minute TTL
    const twoMinutesLater = createdAt + 2 * 60 * 1000
    const result = validateConfirmationToken(token, 'delete_playlist', MOCK_PLAYLIST_ID, twoMinutesLater)
    expect(result.action).toBe('delete_playlist')
  })
})

describe('Safety — expired token rejected', () => {
  it('rejects token that has exceeded TTL', () => {
    const createdAt = Date.now()
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID, createdAt)

    // Validate 6 minutes later — exceeds the 5-minute TTL
    const sixMinutesLater = createdAt + 6 * 60 * 1000

    expect(() =>
      validateConfirmationToken(token, 'delete_item', MOCK_ITEM_ID, sixMinutesLater),
    ).toThrow('EXPIRED_TOKEN')
  })

  it('rejects token exactly at TTL boundary + 1ms', () => {
    const createdAt = Date.now()
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID, createdAt)

    const atBoundary = createdAt + TOKEN_TTL_MS + 1

    expect(() =>
      validateConfirmationToken(token, 'delete_item', MOCK_ITEM_ID, atBoundary),
    ).toThrow('EXPIRED_TOKEN')
  })
})

describe('Safety — tampered token rejected', () => {
  it('rejects token with modified action', () => {
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID)

    // Try to validate with a different action
    expect(() =>
      validateConfirmationToken(token, 'advance_item', MOCK_ITEM_ID),
    ).toThrow('INVALID_TOKEN: action mismatch')
  })

  it('rejects token with modified target ID', () => {
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID)

    const differentId = '99999999-9999-9999-9999-999999999999'
    expect(() =>
      validateConfirmationToken(token, 'delete_item', differentId),
    ).toThrow('INVALID_TOKEN: target mismatch')
  })

  it('rejects token with corrupted signature', () => {
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID)

    // Decode, tamper with sig, re-encode
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
    decoded.sig = 'tampered_signature'
    const tamperedToken = Buffer.from(JSON.stringify(decoded)).toString('base64url')

    expect(() =>
      validateConfirmationToken(tamperedToken, 'delete_item', MOCK_ITEM_ID),
    ).toThrow('INVALID_TOKEN: signature mismatch')
  })

  it('rejects completely malformed token', () => {
    expect(() =>
      validateConfirmationToken('not-a-valid-token!!!', 'delete_item', MOCK_ITEM_ID),
    ).toThrow('INVALID_TOKEN: malformed token')
  })

  it('rejects token with modified timestamp (signature breaks)', () => {
    const token = generateConfirmationToken('delete_item', MOCK_ITEM_ID)

    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
    decoded.timestamp = decoded.timestamp - 100000
    const tamperedToken = Buffer.from(JSON.stringify(decoded)).toString('base64url')

    expect(() =>
      validateConfirmationToken(tamperedToken, 'delete_item', MOCK_ITEM_ID),
    ).toThrow('INVALID_TOKEN: signature mismatch')
  })
})

// ---------------------------------------------------------------------------
// Tests: Rate governor
// ---------------------------------------------------------------------------

describe('Safety — rate governor allows within limits', () => {
  it('allows requests up to the limit', () => {
    const governor = createRateGovernor(5, 60_000)

    for (let i = 0; i < 5; i++) {
      const result = governor.check('test-key')
      expect(result.allowed).toBe(true)
    }
  })

  it('tracks remaining count correctly', () => {
    const governor = createRateGovernor(3, 60_000)

    const r1 = governor.check('key')
    expect(r1.remaining).toBe(2)

    const r2 = governor.check('key')
    expect(r2.remaining).toBe(1)

    const r3 = governor.check('key')
    expect(r3.remaining).toBe(0)
  })

  it('tracks separate keys independently', () => {
    const governor = createRateGovernor(2, 60_000)

    governor.check('key-a')
    governor.check('key-a')

    const resultA = governor.check('key-a')
    expect(resultA.allowed).toBe(false)

    const resultB = governor.check('key-b')
    expect(resultB.allowed).toBe(true)
  })
})

describe('Safety — rate governor blocks after limit', () => {
  it('rejects request at limit + 1', () => {
    const governor = createRateGovernor(3, 60_000)

    governor.check('key')
    governor.check('key')
    governor.check('key')

    const result = governor.check('key')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('provides positive resetMs when blocked', () => {
    const governor = createRateGovernor(1, 60_000)

    governor.check('key')
    const result = governor.check('key')

    expect(result.allowed).toBe(false)
    expect(result.resetMs).toBeGreaterThan(0)
  })
})

describe('Safety — rate governor resets after window', () => {
  it('allows requests again after manual reset', () => {
    const governor = createRateGovernor(2, 60_000)

    governor.check('key')
    governor.check('key')
    const blocked = governor.check('key')
    expect(blocked.allowed).toBe(false)

    governor.reset('key')

    const afterReset = governor.check('key')
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(1)
  })

  // Time-based window reset is tested by manipulating the internal state
  // via a fresh governor check after the window expires
  it('resets when window expires', () => {
    // We test with a very short window
    const governor = createRateGovernor(1, 1) // 1ms window

    governor.check('key')
    const blocked = governor.check('key')
    expect(blocked.allowed).toBe(false)

    // Wait for window to expire (the next check after 1ms will reset)
    // Since Date.now() advances naturally, even 1ms should suffice
    // Use a small delay to ensure window passes
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = governor.check('key')
        expect(result.allowed).toBe(true)
        resolve()
      }, 5)
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: Destructive tool dry_run pattern via MCP
// ---------------------------------------------------------------------------

describe('Safety — destructive tool without confirm returns plan', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('delete tool returns plan with confirmation_required', async () => {
    pair = await createTestMcpPair({
      setupServer: (server) => {
        server.tool(
          'delete_resource',
          'Delete a resource (requires confirmation)',
          {
            id: z.string().uuid(),
            confirm: z.boolean().default(false),
          },
          async (args) => {
            if (!args.confirm) {
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    confirmation_required: true,
                    action: 'delete_resource',
                    target_id: args.id,
                    impact: 'Resource and all linked data will be archived.',
                  }),
                }],
              }
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true }) }] }
          },
        )
      },
    })

    const result = await pair.client.callTool({
      name: 'delete_resource',
      arguments: { id: MOCK_ITEM_ID },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      confirmation_required: boolean
      action: string
    }
    expect(data.confirmation_required).toBe(true)
    expect(data.action).toBe('delete_resource')
  })

  it('confirmed destructive tool executes the action', async () => {
    pair = await createTestMcpPair({
      setupServer: (server) => {
        server.tool(
          'delete_resource',
          'Delete a resource',
          {
            id: z.string().uuid(),
            confirm: z.boolean().default(false),
          },
          async (args) => {
            if (!args.confirm) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ confirmation_required: true }) }] }
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: args.id }) }] }
          },
        )
      },
    })

    const result = await pair.client.callTool({
      name: 'delete_resource',
      arguments: { id: MOCK_ITEM_ID, confirm: true },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      deleted: boolean
      id: string
    }
    expect(data.deleted).toBe(true)
    expect(data.id).toBe(MOCK_ITEM_ID)
  })
})

describe('Safety — bulk operation returns per-item plan in dry_run', () => {
  let pair: McpTestPair

  afterEach(async () => {
    if (pair) await pair.cleanup()
  })

  it('returns individual plans for each item in bulk dry_run', async () => {
    const items = [
      { id: '11111111-1111-1111-1111-111111111111', op: 'advance' },
      { id: '22222222-2222-2222-2222-222222222222', op: 'archive' },
      { id: '33333333-3333-3333-3333-333333333333', op: 'advance' },
    ]

    pair = await createTestMcpPair({
      setupServer: (server) => {
        server.tool(
          'bulk_operations',
          'Execute batch operations on multiple items',
          {
            operations: z.array(z.object({
              op: z.enum(['advance', 'retreat', 'archive', 'restore']),
              id: z.string().uuid(),
            })).min(1).max(50),
            dry_run: z.boolean().default(false),
          },
          async (args) => {
            if (args.dry_run) {
              const plans = args.operations.map((op: { op: string; id: string }) => ({
                id: op.id,
                operation: op.op,
                would_change: op.op === 'advance' ? { from_stage: 'idea', to_stage: 'roteiro' } : { archived: true },
                can_proceed: true,
              }))
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    dry_run: true,
                    plans,
                    total: plans.length,
                    would_persist: false,
                  }),
                }],
              }
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify({ executed: true }) }] }
          },
        )
      },
    })

    const result = await pair.client.callTool({
      name: 'bulk_operations',
      arguments: {
        operations: items,
        dry_run: true,
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      dry_run: boolean
      plans: Array<{ id: string; operation: string; can_proceed: boolean }>
      total: number
      would_persist: boolean
    }
    expect(data.dry_run).toBe(true)
    expect(data.plans).toHaveLength(3)
    expect(data.total).toBe(3)
    expect(data.would_persist).toBe(false)

    // Each item gets its own plan
    for (let i = 0; i < items.length; i++) {
      expect(data.plans[i].id).toBe(items[i].id)
      expect(data.plans[i].operation).toBe(items[i].op)
      expect(data.plans[i].can_proceed).toBe(true)
    }
  })

  it('bulk dry_run reports items that cannot proceed', async () => {
    pair = await createTestMcpPair({
      setupServer: (server) => {
        server.tool(
          'bulk_operations',
          'Batch operations',
          {
            operations: z.array(z.object({
              op: z.enum(['advance', 'retreat', 'archive', 'restore']),
              id: z.string().uuid(),
            })).min(1).max(50),
            dry_run: z.boolean().default(false),
          },
          async (args) => {
            const plans = args.operations.map((op: { op: string; id: string }, idx: number) => ({
              id: op.id,
              operation: op.op,
              can_proceed: idx !== 1, // second item blocked
              reason: idx === 1 ? 'Item is already at final stage' : undefined,
            }))
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({ dry_run: true, plans, would_persist: false }),
              }],
            }
          },
        )
      },
    })

    const result = await pair.client.callTool({
      name: 'bulk_operations',
      arguments: {
        operations: [
          { op: 'advance', id: '11111111-1111-1111-1111-111111111111' },
          { op: 'advance', id: '22222222-2222-2222-2222-222222222222' },
        ],
        dry_run: true,
      },
    })

    const data = extractToolResultJson(result as { content: Array<{ type: string; text: string }> }) as {
      plans: Array<{ can_proceed: boolean; reason?: string }>
    }
    expect(data.plans[0].can_proceed).toBe(true)
    expect(data.plans[1].can_proceed).toBe(false)
    expect(data.plans[1].reason).toContain('final stage')
  })
})
