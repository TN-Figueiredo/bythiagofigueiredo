import { RichText } from '@atproto/api'
import type { BskyAgent } from '@atproto/api'
import type { AppBskyFeedPost } from '@atproto/api'
import type { PlatformResult } from '../../core/types.js'

export function buildPostUrl(did: string, rkey: string): string {
  return `https://bsky.app/profile/${did}/post/${rkey}`
}

function extractRkey(uri: string): string {
  const parts = uri.split('/')
  const rkey = parts[parts.length - 1]
  if (!rkey) throw new Error(`Invalid AT URI: ${uri}`)
  return rkey
}

function extractDid(uri: string): string {
  const match = uri.match(/^at:\/\/(did:[^/]+)\//)
  if (!match?.[1]) throw new Error(`Cannot extract DID from AT URI: ${uri}`)
  return match[1]
}

export interface PostImageInput {
  data: Uint8Array
  mimeType: string
  alt?: string
}

export async function createPost(
  agent: BskyAgent,
  text: string,
  options?: {
    embed?: AppBskyFeedPost.Main['embed']
    images?: PostImageInput[]
  },
): Promise<PlatformResult> {
  const rt = new RichText({ text })
  await rt.detectFacets(agent)

  let embed = options?.embed

  if (!embed && options?.images?.length) {
    const imageBlobs = await Promise.all(
      options.images.slice(0, 4).map(async (img) => {
        const response = await agent.uploadBlob(img.data, {
          encoding: img.mimeType,
        })
        return {
          alt: img.alt ?? '',
          image: response.data.blob,
        }
      }),
    )

    embed = {
      $type: 'app.bsky.embed.images' as const,
      images: imageBlobs,
    }
  }

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    ...(embed ? { embed } : {}),
  })

  const did = extractDid(response.uri)
  const rkey = extractRkey(response.uri)

  return {
    id: response.uri,
    url: buildPostUrl(did, rkey),
  }
}

export async function deletePost(
  agent: BskyAgent,
  postUri: string,
): Promise<void> {
  await agent.deletePost(postUri)
}
