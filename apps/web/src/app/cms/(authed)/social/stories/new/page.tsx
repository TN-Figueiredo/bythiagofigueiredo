import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { searchSourceContent } from '@/lib/social/actions/stories'
import { hasInstagramConnection } from '@/lib/social/actions/blog-story'
import { saveStoryDraft, publishStoryNow, scheduleStory } from '@/lib/social/actions/story-publish'
import {
  exportSlideToBlob,
  saveTemplate,
  removeTemplate,
  uploadImage,
  uploadVideo,
} from '../_actions/editor-actions'
import { StoryComposer } from './_components/story-composer'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ source?: string; id?: string }>
}

export default async function NewStoryPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const params = await searchParams

  // Fetch site brand data
  const supabase = getSupabaseServiceClient()
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

  // Check Instagram connection + fetch 9:16 templates in parallel
  const [hasIg, templatesResult] = await Promise.all([
    hasInstagramConnection(),
    listTemplates(ctx.siteId, '9:16'),
  ])
  const templates = templatesResult.ok ? templatesResult.data : []

  // Optionally resolve initial content from ?source=blog&id=xyz
  let initialContent = null
  if (params.source && params.id) {
    const validSources = ['blog', 'newsletter', 'campaign'] as const
    const isValid = (validSources as readonly string[]).includes(params.source)
    if (isValid) {
      const res = await searchSourceContent(ctx.siteId, params.source, '')
      if (res.ok) {
        initialContent = res.data.find((item) => item.id === params.id) ?? null
      }
    }
  }

  // postId is generated client-side by StoryComposer → StoryEditorShell and passed
  // as first arg to these server action wrappers. siteId is closed over from ctx.
  const handleSaveDraftWithId = async (
    postId: string,
    slides: unknown[],
    content?: { caption?: string },
  ) => {
    'use server'
    return saveStoryDraft(ctx.siteId, postId, slides, content)
  }

  const handlePublishNowWithId = async (
    postId: string,
    slides: unknown[],
    content?: { caption?: string },
  ) => {
    'use server'
    return publishStoryNow(ctx.siteId, postId, slides, content)
  }

  const handleScheduleWithId = async (
    postId: string,
    slides: unknown[],
    scheduledAt: string,
    content?: { caption?: string },
  ) => {
    'use server'
    return scheduleStory(ctx.siteId, postId, slides, scheduledAt, content)
  }

  return (
    <>
      <CmsTopbar title="Nova Story" />
      {!hasIg && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Nenhuma conta Instagram conectada.{' '}
          <a href="/cms/social/connections" className="underline hover:text-amber-100">
            Conectar agora
          </a>{' '}
          para publicar stories diretamente.
        </div>
      )}
      <StoryComposer
        siteId={ctx.siteId}
        brand={brand}
        templates={templates}
        initialContent={initialContent}
        onSearchContent={searchSourceContent}
        onExport={exportSlideToBlob}
        onSaveTemplate={saveTemplate}
        onDeleteTemplate={removeTemplate}
        onImageUpload={uploadImage}
        onVideoUpload={uploadVideo}
        onSaveDraft={handleSaveDraftWithId}
        onPublishNow={handlePublishNowWithId}
        onSchedule={handleScheduleWithId}
      />
    </>
  )
}
