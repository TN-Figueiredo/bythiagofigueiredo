import type { Provider } from '@tn-figueiredo/social'

export interface PlatformPrepareResult {
  status: 'ok' | 'noop' | 'error' | 'timeout'
  tags?: number
  latency_ms?: number
  reason?: string
  error?: string
}

export async function platformPrepare(
  platform: Provider,
  url: string,
  pageToken?: string,
): Promise<PlatformPrepareResult> {
  switch (platform) {
    case 'facebook': {
      if (!pageToken) {
        return { status: 'noop', reason: 'no page token available for Facebook OG warm' }
      }
      const { scrapeOg } = await import('@/lib/social/og-scraper')
      return scrapeOg(url, pageToken)
    }

    case 'bluesky':
      return { status: 'noop', reason: 'bluesky prepares OG inline at publish time' }

    case 'instagram':
      return { status: 'noop', reason: 'instagram does not use OG link cards' }

    case 'youtube':
      return { status: 'noop', reason: 'youtube community posts do not use OG cards' }
  }
}
