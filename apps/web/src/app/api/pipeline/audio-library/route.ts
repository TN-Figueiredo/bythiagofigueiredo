import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { AudioAssetCreateSchema } from '@/lib/pipeline/audio-schemas'
import { sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
import { pipelineLog } from '@/lib/pipeline/logger'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const rawLimit = Number(params.get('limit') || '50')
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.round(rawLimit) : 50, 200))
  const cursor = params.get('cursor') || undefined

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('audio_assets')
    .select('*', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const type = params.get('type')
  if (type && ['music', 'sfx'].includes(type)) query = query.eq('type', type)

  const status = params.get('status')
  if (status && ['downloaded', 'pending', 'retired'].includes(status)) query = query.eq('status', status)

  const category = params.get('category')
  if (category) query = query.eq('category', sanitizeForFilter(category))

  const tags = params.get('tags')
  if (tags) query = query.overlaps('tags', tags.split(',').map(t => sanitizeForFilter(t.trim())).filter(Boolean))

  const mood = params.get('mood')
  if (mood) query = query.overlaps('mood', mood.split(',').map(m => sanitizeForFilter(m.trim())).filter(Boolean))

  const safeInt = (v: string) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null }

  const energyMin = params.get('energy_min')
  if (energyMin) { const n = safeInt(energyMin); if (n !== null) query = query.gte('energy', n) }

  const energyMax = params.get('energy_max')
  if (energyMax) { const n = safeInt(energyMax); if (n !== null) query = query.lte('energy', n) }

  const bpmMin = params.get('bpm_min')
  if (bpmMin) { const n = safeInt(bpmMin); if (n !== null) query = query.gte('bpm', n) }

  const bpmMax = params.get('bpm_max')
  if (bpmMax) { const n = safeInt(bpmMax); if (n !== null) query = query.lte('bpm', n) }

  const subcategory = params.get('subcategory')
  if (subcategory) query = query.eq('subcategory', sanitizeForFilter(subcategory))

  const genre = params.get('genre')
  if (genre) query = query.eq('genre', sanitizeForFilter(genre))

  const source = params.get('source')
  if (source) query = query.eq('source', sanitizeForFilter(source))

  const reusable = params.get('reusable')
  if (reusable === 'true') query = query.eq('reusable', true)
  else if (reusable === 'false') query = query.eq('reusable', false)

  const q = params.get('q')
  if (q) {
    const safe = sanitizeForTsquery(q)
    if (safe) query = query.textSearch('search_vector', safe, { type: 'websearch', config: 'english' })
  }

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase.from('audio_assets').select('created_at').eq('id', cursor).eq('site_id', auth.siteId).single()
    if (cursorItem) {
      query = query.or(`created_at.lt.${cursorItem.created_at},and(created_at.eq.${cursorItem.created_at},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query.limit(limit + 1)
  if (error) { pipelineLog('error', 'audio-library', 'GET failed', { error }); return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 }) }

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1] as { id: string } | undefined

  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: hasNext && lastItem ? lastItem.id : undefined, limit },
  }, { headers: buildRateLimitHeaders(auth) })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = AudioAssetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('audio_assets')
    .insert({ ...parsed.data, site_id: auth.siteId })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Asset with this ID or SHA256 already exists' } }, { status: 409 })
    }
    pipelineLog('error', 'audio-library', 'POST failed', { error })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201, headers: buildRateLimitHeaders(auth) })
}
