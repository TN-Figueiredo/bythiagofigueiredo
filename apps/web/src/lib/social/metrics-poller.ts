import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { decrypt, getMasterKey } from '@tn-figueiredo/social'
import type { Provider } from '@tn-figueiredo/social'
import * as Sentry from '@sentry/nextjs'

const SENTRY_TAG = { component: 'social-metrics-poller' }

// Polling windows
const POST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const STORY_MAX_AGE_MS = 48 * 60 * 60 * 1000 // 48 hours
const POST_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const STORY_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours

export interface PollCandidate {
  postId: string
  publishedAt: string
  lastPolledAt: string | null
  isStory: boolean
}

export interface PostMetricRow {
  post_id: string
  delivery_id: string
  provider: Provider
  impressions: number | null
  reach: number | null
  likes: number
  comments: number
  shares: number
  link_clicks: number | null
  polled_at: string
  raw: Record<string, unknown>
}

export function shouldPollPost(candidate: PollCandidate): boolean {
  const now = Date.now()
  const age = now - new Date(candidate.publishedAt).getTime()
  const maxAge = candidate.isStory ? STORY_MAX_AGE_MS : POST_MAX_AGE_MS
  const pollInterval = candidate.isStory
    ? STORY_POLL_INTERVAL_MS
    : POST_POLL_INTERVAL_MS

  // Too old — final snapshot already captured
  if (age > maxAge) return false

  // Never polled — poll now
  if (!candidate.lastPolledAt) return true

  // Polled recently — skip
  const sincePoll = now - new Date(candidate.lastPolledAt).getTime()
  return sincePoll >= pollInterval
}

export interface MetricsResult {
  likes: number
  comments: number
  shares: number
  impressions?: number
  reach?: number
  linkClicks?: number
  raw: Record<string, unknown>
}

export async function fetchFacebookMetrics(
  postId: string,
  pageToken: string,
): Promise<MetricsResult> {
  const url = `https://graph.facebook.com/v21.0/${postId}/insights?metric=post_reactions_by_type_total,post_impressions,post_engaged_users,post_clicks&access_token=${pageToken}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Facebook insights (${res.status})`)
  const json = (await res.json()) as {
    data?: Array<{ name: string; values: Array<{ value: unknown }> }>
  }
  const data = json.data ?? []

  const getValue = (name: string) => {
    const metric = data.find((d) => d.name === name)
    const val = metric?.values?.[0]?.value
    if (typeof val === 'number') return val
    if (typeof val === 'object' && val !== null) {
      return Object.values(val as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      )
    }
    return 0
  }

  return {
    likes: getValue('post_reactions_by_type_total'),
    comments: 0, // Not in insights — fetched via /{post-id}?fields=comments.summary(true)
    shares: 0,
    impressions: getValue('post_impressions'),
    linkClicks: getValue('post_clicks'),
    raw: { data },
  }
}

export async function fetchBlueskyMetrics(
  uri: string,
  service: string,
  accessJwt: string,
): Promise<MetricsResult> {
  const url = `${service}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessJwt}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Bluesky getPostThread (${res.status})`)
  const json = (await res.json()) as {
    thread?: {
      post?: {
        likeCount?: number
        repostCount?: number
        replyCount?: number
      }
    }
  }
  const post = json.thread?.post ?? {}

  return {
    likes: post.likeCount ?? 0,
    comments: post.replyCount ?? 0,
    shares: post.repostCount ?? 0,
    raw: { thread: json.thread },
  }
}

export async function fetchInstagramMetrics(
  mediaId: string,
  accessToken: string,
): Promise<MetricsResult> {
  const url = `https://graph.facebook.com/v21.0/${mediaId}/insights?metric=impressions,reach,replies&access_token=${accessToken}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Instagram insights (${res.status})`)
  const json = (await res.json()) as {
    data?: Array<{ name: string; values: Array<{ value: number }> }>
  }
  const data = json.data ?? []

  const getValue = (name: string) => {
    const metric = data.find((d) => d.name === name)
    return metric?.values?.[0]?.value ?? 0
  }

  return {
    likes: 0, // Fetched via /{media-id}?fields=like_count
    comments: getValue('replies'),
    shares: 0,
    impressions: getValue('impressions'),
    reach: getValue('reach'),
    raw: { data },
  }
}

export async function pollMetricsForDelivery(
  deliveryId: string,
  provider: Provider,
  platformPostId: string,
  connectionRow: Record<string, unknown>,
): Promise<PostMetricRow | null> {
  const key = getMasterKey()

  try {
    let result: MetricsResult

    switch (provider) {
      case 'facebook': {
        if (!connectionRow.page_token_enc) return null
        const pageToken = decrypt(connectionRow.page_token_enc as string, key)
        result = await fetchFacebookMetrics(platformPostId, pageToken)
        break
      }
      case 'bluesky': {
        const accessToken = decrypt(
          connectionRow.access_token_enc as string,
          key,
        )
        const metadata = connectionRow.metadata as Record<
          string,
          unknown
        > | null
        const service =
          (metadata?.service as string) ?? 'https://bsky.social'
        result = await fetchBlueskyMetrics(platformPostId, service, accessToken)
        break
      }
      case 'instagram': {
        if (!connectionRow.page_token_enc) return null
        const token = decrypt(connectionRow.page_token_enc as string, key)
        result = await fetchInstagramMetrics(platformPostId, token)
        break
      }
      case 'youtube': {
        // YouTube community post metrics are not available via Data API v3 in v1
        return null
      }
      default:
        return null
    }

    return {
      post_id: '', // Set by caller from delivery.post_id
      delivery_id: deliveryId,
      provider,
      impressions: result.impressions ?? null,
      reach: result.reach ?? null,
      likes: result.likes,
      comments: result.comments,
      shares: result.shares,
      link_clicks: result.linkClicks ?? null,
      polled_at: new Date().toISOString(),
      raw: result.raw,
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'pollMetrics', provider },
      extra: { deliveryId, platformPostId },
    })
    return null
  }
}
