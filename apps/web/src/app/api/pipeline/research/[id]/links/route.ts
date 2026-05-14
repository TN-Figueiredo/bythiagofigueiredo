import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ResearchLinkSchema } from '@/lib/pipeline/research-schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid research item ID' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResearchLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!researchItem) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Research item not found' } }, { status: 404 })

  const { data: link, error } = await supabase
    .from('research_links')
    .insert({
      research_id: id,
      pipeline_item_id: parsed.data.pipeline_item_id,
      note: parsed.data.note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Link already exists' } }, { status: 409 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: link }, { status: 201, headers })
}
