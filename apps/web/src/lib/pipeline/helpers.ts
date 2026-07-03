import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { authenticatePipeline, buildRateLimitHeaders, requirePermission, type PipelineAuth } from './auth'

export function pipelineError(
  code: string,
  message: string,
  status: number,
  auth?: PipelineAuth,
  details?: unknown,
) {
  const headers = auth ? buildRateLimitHeaders(auth) : undefined
  const error = details === undefined ? { code, message } : { code, message, details }
  return NextResponse.json({ error }, { status, headers: headers ?? {} })
}

export function pipelineSuccess<T>(data: T, status: number, auth: PipelineAuth, meta?: Record<string, unknown>) {
  const headers = buildRateLimitHeaders(auth)
  const body = meta ? { data, meta } : { data }
  return NextResponse.json(body, { status, headers: headers ?? {} })
}

export async function authenticateWrite(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | NextResponse
> {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  if (!requirePermission(authResult.auth, 'write')) return pipelineError('FORBIDDEN', 'Insufficient permissions', 403, authResult.auth)
  return { ok: true, auth: authResult.auth }
}

export async function authenticateRead(req: NextRequest): Promise<
  { ok: true; auth: PipelineAuth } | NextResponse
> {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return pipelineError('UNAUTHORIZED', authResult.error, authResult.status)
  return { ok: true, auth: authResult.auth }
}

/**
 * Read + optionally validate a JSON request body at the transport boundary.
 *
 * Backward compatible with the domain's existing contract: on failure it returns a
 * `NextResponse` (400) so callers keep the `if (body instanceof Response) return body`
 * guard; on success it returns the parsed value.
 *
 * - `parseBody(req)` — legacy behavior: returns `unknown` (raw JSON) or a 400 on bad JSON.
 * - `parseBody(req, schema)` — validates with Zod. Returns the typed, parsed data (`T`)
 *   or a 400 `NextResponse` whose body carries `{ error: { code, message, details } }`,
 *   where `details` is the per-field issue list. This lets a route drop the unchecked
 *   `body as T` cast and get a real, typed, validated payload.
 *
 * Deep per-item / preprocessing validation that already lives in the service layer is left
 * intact — boundary schemas here are the envelope/shape guard, not a duplicate of those.
 */
export async function parseBody(req: NextRequest): Promise<unknown | NextResponse>
export async function parseBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<z.output<S> | NextResponse>
export async function parseBody(
  req: NextRequest,
  schema?: z.ZodTypeAny,
): Promise<unknown | NextResponse> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return pipelineError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }
  if (!schema) return raw

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }))
    const message = parsed.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ')
    return pipelineError('VALIDATION_ERROR', message || 'Request body validation failed', 400, undefined, issues)
  }
  return parsed.data
}
