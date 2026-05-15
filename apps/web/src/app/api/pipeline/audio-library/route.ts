import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { AudioAssetCreateSchema } from '@/lib/pipeline/audio-schemas'
import { sanitizeForFilter } from '@/lib/pipeline/sanitize'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const cursor = params.get('cursor') || undefined

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('audio_assets')
    .select('*', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const type = params.get('type')
  if (type && ['music', 'sfx'].includes(type)) query = query.eq('type', type)

  const status = params.get('status')
  if (status && ['downloaded', 'pending', 'retired'].includes(status)) query = query.eq('status', status)

  const category = params.get('category')
  if (category) query = query.eq('category', sanitizeForFilter(category))

  const tags = params.get('tags')
  if (tags) query = query.contains('tags', tags.split(',').map(t => t.trim()))

  const mood = params.get('mood')
  if (mood) query = query.contains('mood', mood.split(',').map(m => m.trim()))

  const energyMin = params.get('energy_min')
  if (energyMin) query = query.gte('energy', parseInt(energyMin))

  const energyMax = params.get('energy_max')
  if (energyMax) query = query.lte('energy', parseInt(energyMax))

  const bpmMin = params.get('bpm_min')
  if (bpmMin) query = query.gte('bpm', parseInt(bpmMin))

  const bpmMax = params.get('bpm_max')
  if (bpmMax) query = query.lte('bpm', parseInt(bpmMax))

  const q = params.get('q')
  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' })

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase.from('audio_assets').select('created_at').eq('id', cursor).single()
    if (cursorItem) {
      const safeTs = sanitizeForFilter(String(cursorItem.created_at))
      query = query.or(`created_at.lt.${safeTs},and(created_at.eq.${safeTs},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })

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
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201, headers: buildRateLimitHeaders(auth) })
}
