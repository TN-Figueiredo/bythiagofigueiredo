// @vitest-environment node
/**
 * Real (unmocked) coverage for `parseBody`'s 400 envelope — every other test file that
 * touches pipeline routes mocks `@/lib/pipeline/helpers` wholesale, so this is the only
 * place the actual body-parse/validation failure path is exercised.
 *
 * Covers item 5 of the 2026-09-19 forja review: parseBody's 400 now carries rate-limit
 * headers when the caller passes `auth` (threaded through by the three intelligence
 * routes, which already have `auth` in scope by the time they call parseBody) — closing
 * the gap where the claim route sent `X-RateLimit-*` on its 204 but parseBody's 400
 * sent none. `details` (the per-field Zod issue list) was already part of the shape
 * and stays — the doc was updated to describe it instead of stripping it from the code.
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/pipeline/helpers'
import type { PipelineAuth } from '@/lib/pipeline/auth'

const Schema = z.object({ reason: z.string() })

function authOf(over: Partial<PipelineAuth> = {}): PipelineAuth {
  return { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'api_key', keyHash: 'hash-1', ...over }
}

describe('parseBody — 400 envelope', () => {
  it('carries {code, message, details} on schema validation failure', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({}) })
    const res = await parseBody(req, Schema)
    expect(res).toBeInstanceOf(Response)
    const body = await (res as Response).json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toEqual([{ path: 'reason', message: expect.any(String) }])
  })

  it('has no rate-limit headers when no auth is passed (backward compatible)', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({}) })
    const res = await parseBody(req, Schema) as Response
    expect(res.headers.get('X-RateLimit-Remaining')).toBeNull()
  })

  it('carries X-RateLimit-* headers on schema validation failure when auth is passed', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({}) })
    const res = await parseBody(req, Schema, authOf()) as Response
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
  })

  it('carries X-RateLimit-* headers on invalid-JSON failure when auth is passed (raw overload)', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'POST', body: 'not json' })
    const res = await parseBody(req, undefined, authOf()) as Response
    expect(res.status).toBe(400)
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
  })

  it('legacy parseBody(req) with no schema returns raw JSON untouched', async () => {
    const req = new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ a: 1 }) })
    const res = await parseBody(req)
    expect(res).toEqual({ a: 1 })
  })
})
