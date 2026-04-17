import type { PersonProfile, OrgProfile } from './identity-profiles'

/**
 * Per-site SEO configuration assembled from `sites` row + identity profile.
 * Consumed by builders, page-metadata factories, and OG renderers.
 *
 * NOTE: Sprint 5b PR-B Phase 1 — only the type lives here. The
 * `getSiteSeoConfig` factory (cached `assembleConfig` via `unstable_cache`)
 * is added in Task B.12 (PR-B Phase 2). Builders / fixtures only need the
 * type to compile.
 */
export interface SiteSeoConfig {
  siteId: string
  siteName: string
  siteUrl: string
  defaultLocale: string
  supportedLocales: string[]
  identityType: 'person' | 'organization'
  primaryColor: string
  logoUrl: string | null
  twitterHandle: string | null
  defaultOgImageUrl: string | null
  contentPaths: { blog: string; campaigns: string }
  personIdentity: PersonProfile | null
  orgIdentity: OrgProfile | null
}
