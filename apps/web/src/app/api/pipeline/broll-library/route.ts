import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { BRollAssetCreateSchema } from '@/lib/pipeline/broll-schemas'
import { sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams
  const limit = Math.max(1, Math.min(parseInt(params.get('limit') || '50') || 50, 200))
  const cursor = params.get('cursor') || undefined

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('broll_library')
    .select('id, asset_id, original_filename, renamed_to, sha256, file_size_bytes, type, source, source_type, category, subcategory, location, description, tags, codec, fps, resolution, width, height, duration_seconds, bitrate_kbps, has_audio, color_profile, storage_url, thumbnail_url, proxy_url, reusable, status, captured_at, metadata, version, created_at, updated_at', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const type = params.get('type')
  if (type && ['footage', 'photo', 'screen_recording', 'stock', 'graphic', 'animation'].includes(type)) query = query.eq('type', type)

  const status = params.get('status')
  if (status && ['available', 'pending', 'retired'].includes(status)) query = query.eq('status', status)

  const sourceType = params.get('source_type')
  if (sourceType && ['pessoal', 'generico'].includes(sourceType)) query = query.eq('source_type', sourceType)

  const category = params.get('category')
  if (category) query = query.eq('category', sanitizeForFilter(category))

  const resolution = params.get('resolution')
  if (resolution) query = query.eq('resolution', sanitizeForFilter(resolution))

  const tags = params.get('tags')
  if (tags) query = query.contains('tags', tags.split(',').map(t => sanitizeForFilter(t.trim())).filter(Boolean))

  const hasAudio = params.get('has_audio')
  if (hasAudio === 'true') query = query.eq('has_audio', true)
  else if (hasAudio === 'false') query = query.eq('has_audio', false)

  const reusable = params.get('reusable')
  if (reusable === 'true') query = query.eq('reusable', true)
  else if (reusable === 'false') query = query.eq('reusable', false)

  const location = params.get('location')
  if (location) query = query.ilike('location', `%${sanitizeForFilter(location)}%`)

  const q = params.get('q')
  if (q) {
    const safe = sanitizeForTsquery(q)
    if (safe) query = query.textSearch('search_vector', safe, { type: 'websearch', config: 'english' })
  }

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase.from('broll_library').select('created_at').eq('id', cursor).eq('site_id', auth.siteId).single()
    if (cursorItem) {
      const ts = cursorItem.created_at as string
      // Validate that the DB-returned timestamp is a safe ISO-8601 string before using it in
      // the PostgREST filter expression. cursor is already UUID-validated above; ts is fetched
      // from the DB via that UUID + site_id scope, but we guard the format to prevent any
      // unexpected value from being interpolated into the filter string.
      const ISO_TS_REGEX = /^\d{4}-\d{2}-\d{2}T[\d:.+Z-]+$/
      if (ISO_TS_REGEX.test(ts)) {
        query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${cursor})`)
      }
    }
  }

  const { data, error, count } = await query.limit(limit + 1)
  if (error) { pipelineLog('error', 'broll-library', 'GET failed', { error }); return pipelineError('DB_ERROR', 'Failed to load assets', 500, auth) }

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1] as { id: string } | undefined

  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: hasNext && lastItem ? lastItem.id : undefined, limit },
  }, { headers: buildRateLimitHeaders(auth) })
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = BRollAssetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('broll_library')
    .insert({ ...parsed.data, site_id: auth.siteId })
    .select('id, asset_id, original_filename, renamed_to, sha256, file_size_bytes, type, source, source_type, category, subcategory, location, description, tags, codec, fps, resolution, width, height, duration_seconds, bitrate_kbps, has_audio, color_profile, storage_url, thumbnail_url, proxy_url, reusable, status, captured_at, metadata, version, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return pipelineError('CONFLICT', 'Asset with this ID or SHA256 already exists', 409, auth)
    }
    pipelineLog('error', 'broll-library', 'POST failed', { error })
    return pipelineError('DB_ERROR', 'Failed to save asset', 500, auth)
  }

  return pipelineSuccess(data, 201, auth)
}
