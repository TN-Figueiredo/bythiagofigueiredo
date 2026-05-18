import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { listTemplates } from '@/lib/social/actions/templates'
import { searchSourceContent } from '@/lib/social/actions/stories'
import {
  createTemplate,
  deleteTemplate,
} from '@/lib/social/actions/templates'
import { uploadMediaAction } from '@/app/cms/(authed)/media/actions'
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

  // Fetch 9:16 templates
  const templatesResult = await listTemplates(ctx.siteId, '9:16')
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

  // ---------------------------------------------------------------------------
  // Server action wrappers — passed as props to avoid direct client imports
  // ---------------------------------------------------------------------------

  const handleExport = async (
    blob: Blob,
    metadata: { format: 'png'; scale: number; width: number; height: number },
  ) => {
    'use server'
    try {
      const { put } = await import('@vercel/blob')
      const filename = `stories/${Date.now()}-slide.${metadata.format}`
      const result = await put(filename, blob, {
        access: 'public',
        contentType: `image/${metadata.format}`,
      })
      return { url: result.url }
    } catch {
      return null
    }
  }

  const handleSaveTemplate = async (
    name: string,
    composition: import('@tn-figueiredo/links/qr').CardComposition,
    thumbnail: Blob,
  ) => {
    'use server'
    const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer())
    const thumbnailBase64 = `data:image/png;base64,${thumbnailBuffer.toString('base64')}`
    await createTemplate({
      name,
      aspectRatio: '9:16',
      composition,
      thumbnailBase64,
    })
  }

  const handleDeleteTemplate = async (id: string) => {
    'use server'
    await deleteTemplate(id)
  }

  const handleImageUpload = async (file: File) => {
    'use server'
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'general')
    const result = await uploadMediaAction(formData)
    if (!result.ok) throw new Error(result.error)
    return result.asset.blobUrl
  }

  return (
    <>
      <CmsTopbar title="Nova Story" />
      <StoryComposer
        siteId={ctx.siteId}
        brand={brand}
        templates={templates}
        initialContent={initialContent}
        onSearchContent={searchSourceContent}
        onExport={handleExport}
        onSaveTemplate={handleSaveTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onImageUpload={handleImageUpload}
      />
    </>
  )
}
