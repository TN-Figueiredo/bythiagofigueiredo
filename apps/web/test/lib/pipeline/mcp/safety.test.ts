/**
 * Regression coverage for the WP-I fix (F20): MCP confirmation tokens must be
 * signed with a secret that is NEVER sent over the wire. Before this fix,
 * safety.ts signed tokens with PIPELINE_COWORK_KEY — the exact value every
 * pipeline/MCP request carries in X-Pipeline-Key — so anyone holding that key
 * could forge their own dry-run confirmation and skip the destructive-action
 * gate entirely. The dedicated secret is PIPELINE_MCP_HMAC_SECRET.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateConfirmationToken,
  validateConfirmationToken,
} from '@/lib/pipeline/mcp/safety'

const ACTION = 'delete_item'
const PARAMS = { id: '11111111-1111-1111-1111-111111111111' }

describe('mcp/safety — HMAC secret is dedicated, not the pipeline API key', () => {
  beforeEach(() => {
    // Simulate the real deployment shape: a leaked/known PIPELINE_COWORK_KEY
    // (attacker has this — it rides on every request) plus the dedicated,
    // never-transmitted PIPELINE_MCP_HMAC_SECRET.
    vi.stubEnv('PIPELINE_COWORK_KEY', 'leaked-pipeline-api-key')
    vi.stubEnv('PIPELINE_MCP_HMAC_SECRET', 'dedicated-hmac-secret-value')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('generates a token that validates against the same action/params', () => {
    const token = generateConfirmationToken(ACTION, PARAMS)
    expect(validateConfirmationToken(token, ACTION, PARAMS)).toBe(true)
  })

  it('throws when PIPELINE_MCP_HMAC_SECRET is not set, even if PIPELINE_COWORK_KEY is', () => {
    vi.stubEnv('PIPELINE_MCP_HMAC_SECRET', '')
    expect(() => generateConfirmationToken(ACTION, PARAMS)).toThrow(
      /PIPELINE_MCP_HMAC_SECRET/,
    )
  })

  it('rejects a token forged with PIPELINE_COWORK_KEY (the value attackers actually have)', () => {
    const token = generateConfirmationToken(ACTION, PARAMS)

    // Attacker only knows PIPELINE_COWORK_KEY (it's on every request). If they
    // sign a token with it instead of the real secret, it must not validate —
    // this is the exact hole F20 closes.
    vi.stubEnv('PIPELINE_MCP_HMAC_SECRET', 'leaked-pipeline-api-key')
    const forgedToken = generateConfirmationToken(ACTION, PARAMS)

    // Restore the real secret and confirm the forged token is rejected.
    vi.stubEnv('PIPELINE_MCP_HMAC_SECRET', 'dedicated-hmac-secret-value')
    expect(validateConfirmationToken(forgedToken, ACTION, PARAMS)).toBe(false)
    // Sanity: the legitimately-signed token still validates.
    expect(validateConfirmationToken(token, ACTION, PARAMS)).toBe(true)
  })

  it('rejects a token whose params were tampered with after signing', () => {
    const token = generateConfirmationToken(ACTION, PARAMS)
    const tamperedParams = { id: '22222222-2222-2222-2222-222222222222' }
    expect(validateConfirmationToken(token, ACTION, tamperedParams)).toBe(false)
  })

  it('rejects an expired token (TTL is 5 minutes)', () => {
    const now = Date.now()
    vi.useFakeTimers({ now, toFake: ['Date'] })
    const token = generateConfirmationToken(ACTION, PARAMS)

    vi.setSystemTime(now + 5 * 60 * 1000 + 1)
    expect(validateConfirmationToken(token, ACTION, PARAMS)).toBe(false)

    vi.useRealTimers()
  })
})
