import type { OgScrapeResult } from './types'

const SCRAPE_TIMEOUT_MS = 10_000

export async function scrapeOg(
  url: string,
  pageToken: string,
): Promise<OgScrapeResult> {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://graph.facebook.com/?id=${encodeURIComponent(url)}&scrape=true`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${pageToken}` },
        signal: controller.signal,
      },
    )
    const data = (await res.json()) as { og_object?: Record<string, unknown> }
    const elapsed = Date.now() - start

    return {
      status: 'ok',
      tags: Object.keys(data.og_object ?? {}).length,
      latency_ms: elapsed,
      http_status: res.status,
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return {
      status: error.name === 'AbortError' ? 'timeout' : 'error',
      error: error.message,
    }
  } finally {
    clearTimeout(timeout)
  }
}
