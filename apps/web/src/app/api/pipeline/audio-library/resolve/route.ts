import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ResolveQuerySchema } from '@/lib/pipeline/audio-schemas'
import { resolveAudio } from '@/lib/pipeline/audio-resolver'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResolveQuerySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  let result
  try {
    result = await resolveAudio(supabase, auth.siteId, parsed.data)
  } catch (err) {
    console.error('[audio-resolve] error:', err)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }

  return NextResponse.json({ data: result }, { headers: buildRateLimitHeaders(auth) })
}
