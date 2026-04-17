import * as Sentry from '@sentry/nextjs'
import { ringContext } from '@/lib/cms/repositories'

export interface ResolvedSite {
  id: string
  slug: string
  primary_domain: string
}

export function isPreviewOrDevHost(host: string): boolean {
  if (!host) return true
  if (host === 'dev.bythiagofigueiredo.com') return true
  if (host === 'dev.localhost') return true
  if (host.endsWith('.vercel.app')) return true
  if (host === 'localhost' || host.startsWith('localhost:')) return true
  if (host === '127.0.0.1' || host.startsWith('127.0.0.1:')) return true
  return false
}

export async function resolveSiteByHost(host: string): Promise<ResolvedSite | null> {
  try {
    const ring = ringContext()
    const site = (await ring.getSiteByDomain(host)) as ResolvedSite | null
    return site
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'seo-host-resolve', host } })
    return null
  }
}
