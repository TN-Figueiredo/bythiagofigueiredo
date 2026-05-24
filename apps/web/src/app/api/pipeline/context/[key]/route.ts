import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { ReferenceContentUpsertSchema } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .select('id, site_id, key, title, content_md, content_compact, ref_group, sort_order, created_at, updated_at')
    .eq('site_id', auth.siteId)
    .eq('key', key)
    .single()

  if (error || !data) return pipelineError('NOT_FOUND', `Reference "${key}" not found`, 404, auth)
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data }, { headers })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body
  const parsed = ReferenceContentUpsertSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)

  const upsertData: Record<string, unknown> = {
    site_id: auth.siteId,
    key,
    title: parsed.data.title,
    content_md: parsed.data.content_md ?? null,
    content_compact: parsed.data.content_compact ?? {},
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.ref_group !== undefined) upsertData.ref_group = parsed.data.ref_group
  if (parsed.data.sort_order !== undefined) upsertData.sort_order = parsed.data.sort_order

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .upsert(upsertData, { onConflict: 'site_id,key' })
    .select('id, site_id, key, title, content_md, content_compact, ref_group, sort_order, created_at, updated_at')
    .single()

  if (error) return pipelineError('VALIDATION_ERROR', 'Failed to save reference content', 400, auth)
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  await supabase.from('reference_content').delete().eq('site_id', auth.siteId).eq('key', key)
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
