import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { GraduateSchema } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = GraduateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const { target } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const title = item.title_pt || item.title_en
  if (!title) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Item must have a title to graduate' } }, { status: 422 })

  let entityId: string | null = null
  let fkField: string | null = null

  if (target === 'blog_post') {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        site_id: auth.siteId,
        author_id: item.created_by,
        status: 'draft',
        category: 'building',
        locale: item.language === 'en' ? 'en' : 'pt-br',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
    entityId = post.id
    fkField = 'blog_post_id'
  } else if (target === 'newsletter') {
    const { data: edition, error } = await supabase
      .from('newsletter_editions')
      .insert({
        site_id: auth.siteId,
        subject: title,
        status: 'draft',
        content: item.body_content || '',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
    entityId = edition.id
    fkField = 'newsletter_edition_id'
  } else if (target === 'campaign') {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        site_id: auth.siteId,
        name: title,
        slug: item.slug || item.code,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
    entityId = campaign.id
    fkField = 'campaign_id'
  }

  if (entityId && fkField) {
    await supabase.from('content_pipeline').update({ [fkField]: entityId }).eq('id', id)
    await supabase.from('content_pipeline_history').insert({
      pipeline_id: id,
      event_type: 'graduated',
      to_value: `${target}:${entityId}`,
    })
  }

  return NextResponse.json({ data: { graduated: true, target, entity_id: entityId } })
}
