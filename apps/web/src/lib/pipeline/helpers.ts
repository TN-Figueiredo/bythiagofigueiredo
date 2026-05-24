import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, buildRateLimitHeaders, requirePermission, type PipelineAuth } from './auth'

export function pipelineError(code: string, message: string, status: number, auth?: PipelineAuth) {
  const headers = auth ? buildRateLimitHeaders(auth) : undefined
  return NextResponse.json({ error: { code, message } }, { status, headers: headers ?? {} })
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

export async function parseBody(req: NextRequest): Promise<unknown | NextResponse> {
  try {
    return await req.json()
  } catch {
    return pipelineError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }
}
