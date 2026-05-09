import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { ChecklistToggleSchema } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = ChecklistToggleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const { index, done } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, production_checklist, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const checklist = [...(item.production_checklist as any[] || [])]
  if (index >= checklist.length) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Index out of bounds' } }, { status: 400 })

  checklist[index] = { ...checklist[index], done, toggled_at: new Date().toISOString() }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ production_checklist: checklist })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}
