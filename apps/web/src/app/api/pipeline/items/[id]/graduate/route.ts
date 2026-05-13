import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { GraduateSchema } from '@/lib/pipeline/schemas'
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }
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

  const fkMap = { blog_post: 'blog_post_id', newsletter: 'newsletter_edition_id', campaign: 'campaign_id' } as const
  if (item[fkMap[target]]) {
    return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: `Already graduated to ${target}` } }, { status: 409 })
  }

  let entityId: string | null = null
  let fkField: string | null = null

  if (target === 'blog_post') {
    if (!item.created_by) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Item has no creator — cannot resolve author' } }, { status: 422 })
    const { data: author } = await supabase
      .from('authors')
      .select('id')
      .eq('user_id', item.created_by)
      .single()
    if (!author) return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'No author profile found for this user' } }, { status: 422 })

    const primaryLocale = item.language === 'en' ? 'en' : 'pt-br'
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        site_id: auth.siteId,
        author_id: author.id,
        status: 'draft',
        category: 'building',
        locale: primaryLocale,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

    const makeSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200)
    const sections = item.sections as Record<string, unknown> | null
    const excerptField = item.hook ? { excerpt: item.hook } : {}

    const locales: Array<{ locale: string; title: string }> = []
    if (item.language === 'both') {
      if (item.title_pt) locales.push({ locale: 'pt-br', title: item.title_pt })
      if (item.title_en) locales.push({ locale: 'en', title: item.title_en })
    } else {
      locales.push({ locale: primaryLocale, title })
    }

    const translations = await Promise.all(locales.map(async ({ locale, title: txTitle }) => {
      try {
        const patch = await prepareBlogTranslationPatch(sections, locale)
        if (patch) return { post_id: post.id, locale, title: txTitle, slug: makeSlug(txTitle), ...excerptField, ...patch }
      } catch {
        // Best-effort: fall back to empty content
      }
      return { post_id: post.id, locale, title: txTitle, slug: makeSlug(txTitle), content_mdx: '', ...excerptField }
    }))

    if (translations.length > 0) {
      await supabase.from('blog_translations').insert(translations)
    }

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
        slug: item.code || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200),
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

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { graduated: true, target, entity_id: entityId } }, { headers })
}
