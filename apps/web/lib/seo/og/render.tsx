import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { BlogOgTemplate, CampaignOgTemplate, GenericOgTemplate, NewsletterOgTemplate } from './template'

let fontCache: ArrayBuffer | null = null

async function loadInterBoldSubset(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache
  const p = path.join(process.cwd(), 'apps/web/lib/seo/og/fonts/Inter-Bold.subset.ttf')
  const buf = await readFile(p)
  fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return fontCache
}

const OG_RESPONSE_INIT = {
  width: 1200,
  height: 630,
  headers: {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  },
} as const

export async function renderBlogOgImage(
  props: Parameters<typeof BlogOgTemplate>[0],
): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<BlogOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export async function renderCampaignOgImage(
  props: Parameters<typeof CampaignOgTemplate>[0],
): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<CampaignOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export async function renderGenericOgImage(
  props: Parameters<typeof GenericOgTemplate>[0],
): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<GenericOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export async function renderNewsletterOgImage(
  props: Parameters<typeof NewsletterOgTemplate>[0],
): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<NewsletterOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export function notFoundOgFallback(): Response {
  return new Response(null, { status: 302, headers: { Location: '/og-default.png' } })
}

/**
 * Internal: exposed for tests that want to reset the in-process font cache
 * between mocked-fs scenarios.
 */
export function __resetOgFontCache(): void {
  fontCache = null
}
