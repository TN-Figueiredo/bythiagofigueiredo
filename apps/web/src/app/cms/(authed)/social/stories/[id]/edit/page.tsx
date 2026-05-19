import { notFound } from 'next/navigation'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { listTemplates } from '@/lib/social/actions/templates'
import { saveStoryDraft, publishStoryNow, scheduleStory } from '@/lib/social/actions/story-publish'
import {
  exportSlideToBlob,
  saveTemplate,
  removeTemplate,
  uploadImage,
} from '../../_actions/editor-actions'
import { StoryEditorShell } from '../../_components/story-editor-shell'
import type { CardComposition } from '@tn-figueiredo/links/qr'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StoryEditPage({ params }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('social_posts')
    .select(
      'id, story_slides, status, content, source_content_type, site_id',
    )
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .not('story_slides', 'is', null)
    .single()

  if (error || !data) notFound()

  const post = data as {
    id: string
    story_slides: CardComposition[]
    status: string
    content: Record<string, unknown>
    source_content_type: string | null
    site_id: string
  }

  // Only allow editing drafts (non-draft posts are read-only)
  if (post.status !== 'draft') {
    notFound()
  }

  const initialSlides = (post.story_slides ?? []) as CardComposition[]
  const caption = (post.content?.description as string | undefined) ?? undefined

  // Site brand
  const { data: site } = await supabase
    .from('sites')
    .select('logo_url, primary_color, default_locale, supported_locales')
    .eq('id', ctx.siteId)
    .single()

  const brand = {
    logoUrl: (site?.logo_url as string | null) ?? null,
    primaryColor: (site?.primary_color as string | null) ?? '#3b82f6',
    defaultLocale: (site?.default_locale as string | null) ?? ctx.defaultLocale ?? 'pt-BR',
    supportedLocales: (site?.supported_locales as string[] | null) ?? [ctx.defaultLocale ?? 'pt-BR'],
  }

  // Templates (9:16)
  const templatesResult = await listTemplates(ctx.siteId, '9:16')
  const templates = templatesResult.ok ? templatesResult.data : []

  // Edit page: postId is the closed-over `id` — ignore the arg from the shell
  const handleSaveDraft = async (
    _postId: string,
    slides: unknown[],
    content?: { caption?: string },
  ) => {
    'use server'
    return saveStoryDraft(ctx.siteId, id, slides, content)
  }

  const handlePublishNow = async (
    _postId: string,
    slides: unknown[],
    content?: { caption?: string },
  ) => {
    'use server'
    return publishStoryNow(ctx.siteId, id, slides, content)
  }

  const handleSchedule = async (
    _postId: string,
    slides: unknown[],
    scheduledAt: string,
    content?: { caption?: string },
  ) => {
    'use server'
    return scheduleStory(ctx.siteId, id, slides, scheduledAt, content)
  }

  return (
    <>
      <CmsTopbar title="Editar Story" />
      <StoryEditorShell
        siteId={ctx.siteId}
        postId={id}
        initialSlides={initialSlides}
        initialCaption={caption}
        brand={brand}
        templates={templates}
        sourceContentType={post.source_content_type}
        onExport={exportSlideToBlob}
        onSaveTemplate={saveTemplate}
        onDeleteTemplate={removeTemplate}
        onImageUpload={uploadImage}
        onSaveDraft={handleSaveDraft}
        onPublishNow={handlePublishNow}
        onSchedule={handleSchedule}
      />
    </>
  )
}
