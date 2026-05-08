import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { resolveGeo, type GeoData } from '../../../lib/request/geo'
import { recordClick, type RecordClickInput, type RecordClickResult } from './click-recorder'
import { invalidateLink, invalidateList, invalidateAnalytics } from './cache'
import { resolveLink, type ResolvedLink } from './resolver'

export interface LinksResolver {
  resolveLink(siteId: string, code: string): Promise<ResolvedLink | null>
}

export interface LinksRecorder {
  recordClick(input: RecordClickInput): Promise<RecordClickResult>
}

export interface LinksCache {
  invalidateLink(siteId: string, code: string): void
  invalidateList(siteId: string): void
  invalidateAnalytics(linkId: string): void
}

export interface LinksGeo {
  resolve(headers: Headers): GeoData
}

export interface LinksContainer {
  resolver: LinksResolver
  recorder: LinksRecorder
  cache: LinksCache
  geo: LinksGeo
}

let memo: LinksContainer | null = null

export function createLinksContainer(): LinksContainer {
  if (memo) return memo

  memo = {
    resolver: { resolveLink },
    recorder: { recordClick },
    cache: { invalidateLink, invalidateList, invalidateAnalytics },
    geo: { resolve: resolveGeo },
  }

  return memo
}

/** Test helper — reset singleton between suites. */
export function __resetLinksContainerForTests(): void {
  memo = null
}
