import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getIdentityProfile, type PersonProfile, type OrgProfile } from './identity-profiles'

/**
 * Per-site SEO configuration assembled from `sites` row + identity profile.
 * Consumed by builders, page-metadata factories, and OG renderers.
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

async function assembleConfig(siteId: string, host: string): Promise<SiteSeoConfig> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('sites')
    .select(
      'id, name, slug, primary_domain, default_locale, supported_locales, identity_type, primary_color, logo_url, twitter_handle, seo_default_og_image',
    )
    .eq('id', siteId)
    .single()
  if (error || !data) {
    throw new Error(`getSiteSeoConfig: site ${siteId} not found: ${error?.message}`)
  }

  const row = data as Record<string, unknown>
  const bareDomain =
    typeof row.primary_domain === 'string'
      ? row.primary_domain.replace(/^https?:\/\//, '')
      : host
  const identityType = ((row.identity_type as string | null | undefined) ?? 'person') as
    | 'person'
    | 'organization'
  const profile = getIdentityProfile((row.slug as string) ?? '')

  return {
    siteId: row.id as string,
    siteName: row.name as string,
    siteUrl: `https://${bareDomain}`,
    defaultLocale: (row.default_locale as string | null) ?? 'en',
    supportedLocales: (row.supported_locales as string[] | null) ?? ['en'],
    identityType,
    primaryColor: (row.primary_color as string | null) ?? '#0F172A',
    logoUrl: (row.logo_url as string | null) ?? null,
    twitterHandle: (row.twitter_handle as string | null) ?? null,
    defaultOgImageUrl: (row.seo_default_og_image as string | null) ?? null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: profile?.type === 'person' ? profile : null,
    orgIdentity: profile?.type === 'organization' ? profile : null,
  }
}

export const getSiteSeoConfig = unstable_cache(
  assembleConfig,
  ['seo-config-v1'],
  { revalidate: 3600, tags: ['seo-config'] },
)
