import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { GraduateSchema } from '@/lib/pipeline/schemas'
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = GraduateSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)

  const { target } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  const title = item.title_pt || item.title_en
  if (!title) return pipelineError('INVALID_OPERATION', 'Item must have a title to graduate', 422, auth)

  const fkMap = { blog_post: 'blog_post_id', newsletter: 'newsletter_edition_id', campaign: 'campaign_id' } as const
  if (item[fkMap[target]]) {
    return pipelineError('INVALID_OPERATION', `Already graduated to ${target}`, 409, auth)
  }

  let entityId: string | null = null
  let fkField: string | null = null

  if (target === 'blog_post') {
    if (!item.created_by) return pipelineError('INVALID_OPERATION', 'Item has no creator — cannot resolve author', 422, auth)
    const { data: author } = await supabase
      .from('authors')
      .select('id')
      .eq('user_id', item.created_by)
      .single()
    if (!author) return pipelineError('INVALID_OPERATION', 'No author profile found for this user', 422, auth)

    const primaryLocale = item.language === 'en' ? 'en' : 'pt-br'
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        site_id: auth.siteId,
        author_id: author.id,
        status: 'draft',
        category: item.category ?? 'building',
        cover_image_url: item.cover_image_url ?? null,
        locale: primaryLocale,
      })
      .select('id')
      .single()
    if (error) return pipelineError('DB_ERROR', 'Failed to create blog post', 400, auth)

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
        if (patch) return { post_id: post.id, locale, ...excerptField, ...patch, title: txTitle, slug: makeSlug(txTitle) }
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
    if (error) return pipelineError('DB_ERROR', 'Failed to create newsletter edition', 400, auth)
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
    if (error) return pipelineError('DB_ERROR', 'Failed to create campaign', 400, auth)
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

  return pipelineSuccess({ graduated: true, target, entity_id: entityId }, 200, auth)
}
