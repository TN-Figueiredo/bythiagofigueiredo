import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ResearchTopicUpdateSchema } from '@/lib/pipeline/research-schemas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid topic ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResearchTopicUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('research_topics')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Topic not found' } }, { status: 404 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: updated }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid topic ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
