import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { prepareBlogTranslationPatch } from './draft-to-blog'

export interface MaterializeInput {
  pipelineItemId: string
  targetStage: 'scheduled' | 'published'
  scheduledFor: string | null
  userId: string
  siteId: string
  vvsScore: number
  locales?: string[]
}

export type MaterializeResult =
  | { ok: true; blogPostId: string }
  | { ok: false; code: string; message: string }

const VVS_THRESHOLD = 80

function resolveLocales(language: string | null | undefined): string[] {
  if (language === 'both') return ['pt', 'en']
  if (language === 'en') return ['en']
  // Default: 'pt-br' or anything else → PT only
  return ['pt']
}

function getSectionRev(
  sections: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!sections || typeof sections !== 'object') return null
  const section = sections[key] as { rev?: unknown } | undefined
  const rev = section?.rev
  return typeof rev === 'number' ? rev : null
}

export async function materializeBlogPost(input: MaterializeInput): Promise<MaterializeResult> {
  const { pipelineItemId, targetStage, scheduledFor, userId, siteId, vvsScore, locales } = input

  // 1. Validate VVS score
  if (vvsScore < VVS_THRESHOLD) {
    return {
      ok: false,
      code: 'VVS_BELOW_THRESHOLD',
      message: `VVS score ${vvsScore} is below the required threshold of ${VVS_THRESHOLD}`,
    }
  }

  // 2. Require scheduledFor when targetStage is 'scheduled'
  if (targetStage === 'scheduled' && !scheduledFor) {
    return {
      ok: false,
      code: 'SCHEDULE_DATE_REQUIRED',
      message: 'scheduledFor is required when targetStage is scheduled',
    }
  }

  const svc = getSupabaseServiceClient()

  // 3. Fetch pipeline item (with blog_post_id and sections)
  const { data: item, error: fetchErr } = await svc
    .from('content_pipeline')
    .select('id, blog_post_id, language, sections, site_id, cover_image_url')
    .eq('id', pipelineItemId)
    .eq('site_id', siteId)
    .single()

  if (fetchErr || !item) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Pipeline item not found',
    }
  }

  // 4. Determine active locales
  const activeLocales =
    locales && locales.length > 0 ? locales : resolveLocales(item.language as string | null)

  const sections = item.sections as Record<string, unknown> | null | undefined

  // 5. Prepare translation patches for each locale
  const patches = await Promise.all(
    activeLocales.map(async (locale) => {
      const patch = await prepareBlogTranslationPatch(sections, locale)
      return { locale, patch }
    }),
  )

  // At least one locale must have content
  const validPatches = patches.filter((p) => p.patch !== null)
  if (validPatches.length === 0) {
    return {
      ok: false,
      code: 'NO_CONTENT',
      message: 'No draft content found for the active locales',
    }
  }

  // 6. Upsert blog_posts (create if no blog_post_id, update if exists)
  let blogPostId = item.blog_post_id as string | null

  const postStatus = targetStage === 'published' ? 'published' : 'scheduled'
  const scheduledAt = scheduledFor ?? null

  if (!blogPostId) {
    const { data: newPost, error: insertErr } = await svc
      .from('blog_posts')
      .insert({
        site_id: siteId,
        author_id: userId,
        status: postStatus,
        scheduled_for: scheduledAt,
        cover_image_url: item.cover_image_url ?? null,
      })
      .select('id')
      .single()

    if (insertErr || !newPost) {
      return {
        ok: false,
        code: 'INSERT_FAILED',
        message: insertErr?.message ?? 'Failed to create blog post',
      }
    }

    blogPostId = newPost.id as string
  } else {
    const { error: updateErr } = await svc
      .from('blog_posts')
      .update({
        status: postStatus,
        scheduled_for: scheduledAt,
        cover_image_url: item.cover_image_url ?? null,
      })
      .eq('id', blogPostId)
      .eq('site_id', siteId)

    if (updateErr) {
      return {
        ok: false,
        code: 'UPDATE_FAILED',
        message: updateErr.message,
      }
    }
  }

  // 7. Upsert blog_translations per locale
  for (const { locale, patch } of validPatches) {
    if (!patch) continue

    const { error: transErr } = await svc.from('blog_translations').upsert(
      {
        post_id: blogPostId,
        locale,
        title: patch.title,
        slug: patch.slug,
        excerpt: patch.excerpt,
        content_json: patch.content_json,
        content_html: patch.content_html,
        content_mdx: patch.content_mdx,
        content_compiled: patch.content_compiled,
        content_toc: patch.content_toc,
        reading_time_min: patch.reading_time_min,
        meta_title: patch.meta_title,
        meta_description: patch.meta_description,
        og_image_url: patch.og_image_url,
        key_points: patch.key_points,
        pull_quote: patch.pull_quote,
        notes: patch.notes,
        colophon: patch.colophon,
        tag_id: patch.tag_id,
        cover_image_url: patch.cover_image_url,
      },
      { onConflict: 'post_id,locale' },
    )

    if (transErr) {
      return {
        ok: false,
        code: 'TRANSLATION_UPSERT_FAILED',
        message: transErr.message,
      }
    }
  }

  // 8. Update content_pipeline: stage, blog_post_id, materialized_rev_pt/en
  const revPt = getSectionRev(sections, 'draft_pt')
  const revEn = getSectionRev(sections, 'draft_en')

  const pipelineUpdate: Record<string, unknown> = {
    stage: targetStage,
    blog_post_id: blogPostId,
  }

  if (activeLocales.includes('pt') && revPt !== null) {
    pipelineUpdate.materialized_rev_pt = revPt
  }
  if (activeLocales.includes('en') && revEn !== null) {
    pipelineUpdate.materialized_rev_en = revEn
  }

  const { error: pipelineErr } = await svc
    .from('content_pipeline')
    .update(pipelineUpdate)
    .eq('id', pipelineItemId)
    .eq('site_id', siteId)

  if (pipelineErr) {
    return {
      ok: false,
      code: 'PIPELINE_UPDATE_FAILED',
      message: pipelineErr.message,
    }
  }

  // 9. Return success
  return { ok: true, blogPostId }
}
