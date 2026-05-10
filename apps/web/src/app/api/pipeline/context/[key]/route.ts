import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ReferenceContentUpsertSchema } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .select('*')
    .eq('site_id', authResult.auth.siteId)
    .eq('key', key)
    .single()

  if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: `Reference "${key}" not found` } }, { status: 404 })
  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ data }, { headers })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }
  const parsed = ReferenceContentUpsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .upsert({
      site_id: authResult.auth.siteId,
      key,
      title: parsed.data.title,
      content_md: parsed.data.content_md ?? null,
      content_compact: parsed.data.content_compact ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site_id,key' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ data }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  await supabase.from('reference_content').delete().eq('site_id', authResult.auth.siteId).eq('key', key)
  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
