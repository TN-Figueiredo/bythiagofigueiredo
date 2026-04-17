import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { postRepo } from '@/lib/cms/repositories'
import { renderBlogOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

/**
 * Sprint 5b PR-B Phase 3 — dynamic OG image for blog posts.
 *
 * Node runtime (next/og + node:fs font load). Revalidates hourly. Falls back
 * to /og-default.png for: kill-switch, unknown host, missing post, or any
 * thrown error (Sentry captures the exception).
 */
export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ locale: string; slug: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') {
    return notFoundOgFallback()
  }
  const { locale, slug } = await ctx.params
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const post = await postRepo().getBySlug({ siteId: site.id, locale, slug })
    if (!post) return notFoundOgFallback()
    // Post.translations is an array — pick the one matching the requested
    // locale (always present given getBySlug filtered by locale + slug, but
    // we still guard for the type-narrowing path).
    const translation =
      post.translations.find((t) => t.locale === locale) ?? post.translations[0]
    if (!translation) return notFoundOgFallback()
    return await renderBlogOgImage({
      title: translation.title,
      author: config.personIdentity?.name ?? config.siteName,
      locale,
      brandColor: config.primaryColor,
      logoUrl: config.logoUrl,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'blog', slug, locale },
    })
    return notFoundOgFallback()
  }
}
