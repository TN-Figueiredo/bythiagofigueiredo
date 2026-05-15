import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(linkId)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!researchItem) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Research item not found' } }, { status: 404 })

  const { error } = await supabase
    .from('research_links')
    .delete()
    .eq('id', linkId)
    .eq('research_id', id)

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
