import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { prepareBlogTranslationPatch, type BlogContentPatch } from './draft-to-blog'
import { VVS_PUBLISH_THRESHOLD } from './validation'

interface MaterializeInput {
  pipelineItemId: string
  targetStage: 'scheduled' | 'published'
  scheduledFor: string | null
  userId: string
  siteId: string
  vvsScore: number
  locales?: string[]
}

type MaterializeResult =
  | { ok: true; blogPostId: string }
  | { ok: false; code: string; message: string }

export async function materializeBlogPost(input: MaterializeInput): Promise<MaterializeResult> {
  if (input.vvsScore < VVS_PUBLISH_THRESHOLD) {
    return {
      ok: false,
      code: 'VVS_BELOW_THRESHOLD',
      message: `VVS score ${input.vvsScore} is below required ${VVS_PUBLISH_THRESHOLD}`,
    }
  }

  if (input.targetStage === 'scheduled' && !input.scheduledFor) {
    return { ok: false, code: 'SCHEDULE_DATE_REQUIRED', message: 'Scheduled date/time is required' }
  }

  const supabase = getSupabaseServiceClient()

  // Fetch pipeline item
  const { data: item, error: fetchError } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', input.pipelineItemId)
    .single()

  if (fetchError || !item) {
    return { ok: false, code: 'ITEM_NOT_FOUND', message: 'Pipeline item not found' }
  }

  // Auth guard: verify the pipeline item belongs to the caller's site
  // (getSupabaseServiceClient() bypasses RLS — this scope check is mandatory)
  if (item.site_id !== input.siteId) {
    return { ok: false, code: 'SITE_MISMATCH', message: 'Pipeline item does not belong to the requested site' }
  }

  // Determine active locales
  const activeLocales =
    input.locales ??
    (item.language === 'both' ? ['pt', 'en'] : [item.language === 'pt-br' ? 'pt' : 'en'])

  const patches: Array<{ locale: string; patch: BlogContentPatch }> = []

  for (const locale of activeLocales) {
    const patch = await prepareBlogTranslationPatch(
      item.sections as Record<string, unknown> | null | undefined,
      locale,
    )
    if (!patch) {
      return {
        ok: false,
        code: 'PATCH_FAILED',
        message: `Failed to prepare patch for locale ${locale}`,
      }
    }
    patches.push({ locale, patch })
  }

  // Prepare blog_posts data
  const blogPostStatus = input.targetStage === 'scheduled' ? 'scheduled' : 'published'
  const blogPostData = {
    site_id: input.siteId,
    author_id: input.userId,
    status: blogPostStatus,
    category: item.category as string | null,
    cover_image_url: item.cover_image_url as string | null,
    published_at: input.targetStage === 'published' ? new Date().toISOString() : null,
    scheduled_for: input.scheduledFor,
    slot_date: input.scheduledFor ? input.scheduledFor.split('T')[0] : null,
  }

  // UPSERT blog_posts
  let blogPostId = item.blog_post_id as string | null
  if (blogPostId) {
    const { error } = await supabase
      .from('blog_posts')
      .update(blogPostData)
      .eq('id', blogPostId)
    if (error) return { ok: false, code: 'BLOG_UPDATE_FAILED', message: error.message }
  } else {
    const { data: newPost, error } = await supabase
      .from('blog_posts')
      .upsert({ ...blogPostData, owner_user_id: input.userId })
      .select('id')
      .single()
    if (error || !newPost) {
      return {
        ok: false,
        code: 'BLOG_INSERT_FAILED',
        message: error?.message ?? 'Insert failed',
      }
    }
    blogPostId = (newPost as { id: string }).id
  }

  // UPSERT blog_translations per locale
  for (const { locale, patch } of patches) {
    const { error } = await supabase.from('blog_translations').upsert(
      {
        post_id: blogPostId,
        locale,
        title: '',
        slug: '',
        content_json: patch.content_json,
        content_html: patch.content_html,
        content_mdx: patch.content_mdx ?? '',
        content_compiled: patch.content_compiled,
        content_toc: patch.content_toc,
        reading_time_min: patch.reading_time_min,
      },
      { onConflict: 'post_id,locale' },
    )
    if (error) return { ok: false, code: 'TRANSLATION_UPSERT_FAILED', message: error.message }
  }

  // Stamp materialized_rev and update stage
  const revStamps: Record<string, unknown> = {
    stage: input.targetStage,
    blog_post_id: blogPostId,
  }

  for (const locale of activeLocales) {
    const langSuffix = locale === 'pt' || locale === 'pt-br' ? 'pt' : 'en'
    const sections = item.sections as Record<string, { rev?: number }> | null
    const draftKey = `draft_${langSuffix}`
    const draftRev = sections?.[draftKey]?.rev ?? 0
    revStamps[`materialized_rev_${langSuffix}`] = draftRev
  }

  const { error: stampError } = await supabase
    .from('content_pipeline')
    .update(revStamps)
    .eq('id', input.pipelineItemId)

  if (stampError) {
    return { ok: false, code: 'PIPELINE_STAMP_FAILED', message: `Failed to stamp pipeline item: ${stampError.message}` }
  }

  return { ok: true, blogPostId: blogPostId! }
}
