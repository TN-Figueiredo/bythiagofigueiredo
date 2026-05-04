import { headers } from 'next/headers'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { localePath } from '@/lib/i18n/locale-path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return new Response('<rss version="2.0"><channel><title>Not Found</title></channel></rss>', {
      status: 404,
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    })
  }

  const h = await headers()
  const host = h.get('host') ?? ctx.primaryDomain ?? 'bythiagofigueiredo.com'
  const locale = h.get('x-locale') ?? 'en'
  const siteUrl = `https://${host}`
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: posts } = await supabase
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt,
      blog_posts!inner(id, published_at, status, site_id, category)
    `)
    .eq('blog_posts.site_id', ctx.siteId)
    .eq('blog_posts.status', 'published')
    .eq('locale', locale)
    .lte('blog_posts.published_at', now)
    .not('blog_posts.published_at', 'is', null)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(50)

  const items = (posts ?? []).map((row) => {
    const post = (row as Record<string, unknown>)['blog_posts'] as Record<string, unknown>
    const pubDate = new Date(post['published_at'] as string).toUTCString()
    const link = `${siteUrl}${localePath(`/blog/${row.slug}`, row.locale)}`
    return `    <item>
      <title><![CDATA[${escapeXml(row.title)}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${escapeXml(row.excerpt ?? '')}]]></description>
      ${post['category'] ? `<category>${escapeXml(post['category'] as string)}</category>` : ''}
    </item>`
  })

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Thiago Figueiredo</title>
    <link>${siteUrl}</link>
    <description>Build in public. Learn out loud.</description>
    <language>${locale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
