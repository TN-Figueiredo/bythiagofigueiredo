import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { BRollAssetUpdateSchema } from '@/lib/pipeline/broll-schemas'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: asset, error } = await supabase
    .from('broll_library')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error) {
    pipelineLog('error', 'broll-library', 'GET by id failed', { error })
    if (error.code === 'PGRST116') return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
  if (!asset) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })

  const { data: usage } = await supabase
    .from('broll_library_usage')
    .select('id, pipeline_item_id, beat_index, timecode_in, timecode_out, usage_type, notes, content_pipeline(code, title_pt, format)')
    .eq('broll_asset_id', id)
    .eq('site_id', auth.siteId)

  return NextResponse.json({ data: { ...asset, usage: usage ?? [] } }, { headers: buildRateLimitHeaders(auth) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = BRollAssetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const { version, ...updates } = parsed.data
  const supabase = getSupabaseServiceClient()

  // Atomic OCC: the version check is part of the UPDATE's WHERE clause.
  // A single round-trip either succeeds (row returned) or affects 0 rows (version mismatch or row absent).
  // Use select().maybeSingle() instead of .single() so that 0 rows does not raise PGRST116 —
  // we differentiate 404 vs 409 with one additional point-lookup only on the failure path.
  const { data, error } = await supabase
    .from('broll_library')
    .update({ ...updates, version: version + 1 })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .eq('version', version)
    .select('*')
    .maybeSingle()

  if (error) {
    pipelineLog('error', 'broll-library', 'PATCH failed', { error })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }

  if (!data) {
    // 0 rows updated: determine whether the record is missing (404) or version-mismatched (409).
    const { data: exists } = await supabase.from('broll_library').select('id, version').eq('id', id).eq('site_id', auth.siteId).maybeSingle()
    if (!exists) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })
    return NextResponse.json({ error: { code: 'CONFLICT', message: `Version mismatch: expected ${version}, current ${exists.version}` } }, { status: 409 })
  }

  return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('broll_library')
    .update({ status: 'retired' })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('id, status')
    .single()

  if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })

  return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
}
