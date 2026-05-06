import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { QrComposer } from '@tn-figueiredo/links-admin/client'
import type { LinkSummary, QrConfig } from '@tn-figueiredo/links-admin'
import { generateQr } from '../../actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function QrComposerPage({ params }: Props) {
  const { id } = await params
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: link, error } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !link) notFound()

  const linkSummary: LinkSummary = {
    id: link.id as string,
    code: link.code as string,
    slug: (link.slug as string) ?? null,
    title: (link.title as string) ?? null,
    destination_url: link.destination_url as string,
    source_type: link.source_type as string,
    tags: (link.tags as string[]) ?? [],
    active: link.active as boolean,
    redirect_type: (link.redirect_type as number) ?? 302,
    expires_at: (link.expires_at as string) ?? null,
    total_clicks: (link.total_clicks as number) ?? 0,
    unique_visitors: (link.unique_visitors as number) ?? 0,
    last_clicked_at: (link.last_clicked_at as string) ?? null,
    created_at: link.created_at as string,
    updated_at: link.updated_at as string,
  }

  async function handleGenerate(config: QrConfig) {
    'use server'
    const result = await generateQr(id, {
      size: config.size,
      foreground: config.foregroundColor,
      background: config.backgroundColor,
      logo: !!config.logoDataUrl,
    })
    if (!result.ok) {
      return { svgContent: '' }
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
    const shortUrl = `${appUrl}/go/${linkSummary.code}`
    const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
    const safeBg = HEX_COLOR.test(config.backgroundColor ?? '') ? config.backgroundColor : '#FFFFFF'
    const safeFg = HEX_COLOR.test(config.foregroundColor ?? '') ? config.foregroundColor : '#000000'
    return {
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" width="${config.size}" height="${config.size}"><rect fill="${safeBg}" width="100%" height="100%"/><text x="50%" y="50%" fill="${safeFg}" text-anchor="middle" font-size="10">${shortUrl}</text></svg>`,
    }
  }

  async function handleDownload(_config: QrConfig) {
    'use server'
    // Download handled client-side
  }

  return (
    <QrComposer
      link={linkSummary}
      onGenerate={handleGenerate}
      onDownload={handleDownload}
    />
  )
}
