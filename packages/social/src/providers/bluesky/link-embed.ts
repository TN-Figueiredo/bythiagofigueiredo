import type { BskyAgent } from '@atproto/api'
import type { BlobRef } from '@atproto/lexicon'
import type { PlatformResult } from '../../core/types.js'
import { createPost } from './post.js'

const FETCH_TIMEOUT_MS = 10_000

export interface OGTags {
  title: string
  description: string
  imageUrl?: string
}

function extractMetaContent(html: string, property: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']` +
    `|<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    'i',
  )
  const match = html.match(pattern)
  return match?.[1] ?? match?.[2] ?? undefined
}

export async function fetchOGTags(url: string): Promise<OGTags> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BlueSkyBot/1.0 (link-card-preview)',
      Accept: 'text/html',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    return { title: url, description: '' }
  }

  const html = await response.text()

  const title =
    extractMetaContent(html, 'og:title') ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
    url

  const description = extractMetaContent(html, 'og:description') ?? ''
  const imageUrl = extractMetaContent(html, 'og:image') ?? undefined

  return { title, description, imageUrl }
}

export interface ExternalEmbed {
  $type: 'app.bsky.embed.external'
  external: {
    uri: string
    title: string
    description: string
    thumb?: BlobRef
  }
}

export async function buildExternalEmbed(
  agent: BskyAgent,
  url: string,
): Promise<ExternalEmbed> {
  const og = await fetchOGTags(url)

  let thumb: BlobRef | undefined

  if (og.imageUrl) {
    try {
      const imgResponse = await fetch(og.imageUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (imgResponse.ok) {
        const contentType = imgResponse.headers.get('content-type') ?? 'image/jpeg'
        const arrayBuffer = await imgResponse.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)

        const uploadResult = await agent.uploadBlob(data, {
          encoding: contentType,
        })
        thumb = uploadResult.data.blob
      }
    } catch {
      // OG image download failed — post without thumbnail
    }
  }

  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri: url,
      title: og.title,
      description: og.description,
      ...(thumb ? { thumb } : {}),
    },
  }
}

export async function createPostWithLinkCard(
  agent: BskyAgent,
  text: string,
  url: string,
): Promise<PlatformResult> {
  const embed = await buildExternalEmbed(agent, url)
  return createPost(agent, text, { embed })
}
