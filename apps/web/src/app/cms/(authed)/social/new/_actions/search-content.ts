'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export interface ContentItem {
  id: string
  type: 'blog' | 'newsletter' | 'campaign' | 'video'
  title: string
  thumbnail: string | null
  status: string
  updatedAt: string
}

interface SearchResult {
  items: ContentItem[]
  counts: { all: number; blog: number; newsletter: number; campaign: number; video: number }
}

export async function searchContent(params: {
  query?: string
  type?: 'blog' | 'newsletter' | 'campaign' | 'video'
  limit?: number
}): Promise<SearchResult> {
  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error('forbidden')

  const supabase = getSupabaseServiceClient()
  const limit = params.limit ?? 20
  const items: ContentItem[] = []

  const counts = { all: 0, blog: 0, newsletter: 0, campaign: 0, video: 0 }

  // Blog posts
  if (!params.type || params.type === 'blog') {
    let q = supabase
      .from('blog_posts')
      .select('id, status, cover_image_url, updated_at, blog_translations!inner(title)')
      .eq('site_id', ctx.siteId)
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (params.query) {
      q = q.ilike('blog_translations.title', `%${params.query}%`)
    }

    const { data: blogs } = await q
    for (const b of blogs ?? []) {
      const record = b as unknown as Record<string, unknown>
      const translations = record.blog_translations as Array<{ title: string }> | undefined
      const tx = translations?.[0]
      if (!tx) continue
      items.push({
        id: b.id as string,
        type: 'blog',
        title: tx.title,
        thumbnail: b.cover_image_url as string | null,
        status: b.status as string,
        updatedAt: b.updated_at as string,
      })
    }
    counts.blog = (blogs ?? []).length
  }

  // Newsletter editions
  if (!params.type || params.type === 'newsletter') {
    let q = supabase
      .from('newsletter_editions')
      .select('id, subject, status, updated_at')
      .eq('site_id', ctx.siteId)
      .in('status', ['sent', 'scheduled'])
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (params.query) {
      q = q.ilike('subject', `%${params.query}%`)
    }

    const { data: editions } = await q
    for (const e of editions ?? []) {
      items.push({
        id: e.id as string,
        type: 'newsletter',
        title: e.subject as string,
        thumbnail: null,
        status: e.status as string,
        updatedAt: e.updated_at as string,
      })
    }
    counts.newsletter = (editions ?? []).length
  }

  // Campaigns
  if (!params.type || params.type === 'campaign') {
    let q = supabase
      .from('campaigns')
      .select('id, status, updated_at, campaign_translations!inner(meta_title, og_image_url)')
      .eq('site_id', ctx.siteId)
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (params.query) {
      q = q.ilike('campaign_translations.meta_title', `%${params.query}%`)
    }

    const { data: campaigns } = await q
    for (const c of campaigns ?? []) {
      const record = c as unknown as Record<string, unknown>
      const translations = record.campaign_translations as Array<{ meta_title: string; og_image_url: string | null }> | undefined
      const tx = translations?.[0]
      if (!tx) continue
      items.push({
        id: c.id as string,
        type: 'campaign',
        title: tx.meta_title,
        thumbnail: tx.og_image_url,
        status: c.status as string,
        updatedAt: c.updated_at as string,
      })
    }
    counts.campaign = (campaigns ?? []).length
  }

  // Sort by updatedAt desc
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  counts.all = items.length

  return { items: items.slice(0, limit), counts }
}
