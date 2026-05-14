import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  createDefaultComposition,
  migrateLegacyQrConfig,
} from '@tn-figueiredo/links/qr'
import { buildShortUrl } from '@/lib/links/short-url'
import { loadQrCard, listQrTemplates } from './actions'
import { QrCardBuilderPage } from './client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function QrCardPage({ params }: Props) {
  const { id } = await params
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: link, error } = await supabase
    .from('tracked_links')
    .select('id, code, title, destination_url, qr_card_composition, qr_config')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !link) notFound()

  const shortUrl = buildShortUrl(link.code)

  let composition = createDefaultComposition()
  if (link.qr_card_composition) {
    const loaded = await loadQrCard(id)
    if (loaded.ok && loaded.composition) {
      composition = loaded.composition
    }
  } else if (link.qr_config) {
    composition = migrateLegacyQrConfig(link.qr_config as Record<string, string>)
  }

  const templatesResult = await listQrTemplates()
  const templates = templatesResult.ok ? templatesResult.templates : []

  return (
    <QrCardBuilderPage
      link={{ id: link.id as string, code: link.code as string, title: (link.title as string) ?? null }}
      shortUrl={shortUrl}
      initialComposition={composition}
      templates={templates}
    />
  )
}
