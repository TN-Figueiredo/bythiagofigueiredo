import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLinkinBioEntries } from '@/lib/social/link-in-bio'
import { LinkInBio } from './_components/link-in-bio'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Links',
  robots: 'noindex',
}

async function resolveSiteFromHost(host: string): Promise<string | null> {
  const hostname = host.split(':')[0] ?? ''
  const domain = hostname.startsWith('go.') ? hostname.slice(3) : hostname
  const resolvedDomain =
    (domain === 'localhost' || domain === '127.0.0.1') &&
    process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      ? process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      : domain

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [resolvedDomain])
    .maybeSingle()

  return data?.id ?? null
}

export default async function LinkInBioPage() {
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const siteId = await resolveSiteFromHost(host)

  if (!siteId) {
    notFound()
  }

  const supabase = getSupabaseServiceClient()

  // Fetch site info
  const { data: site } = await supabase
    .from('sites')
    .select('name, tagline, logo_url, brand_color')
    .eq('id', siteId)
    .single()

  if (!site) {
    notFound()
  }

  const entries = await getLinkinBioEntries(siteId)

  return (
    <LinkInBio
      site={{
        displayName: (site.name as string) ?? 'My Site',
        bio: (site.tagline as string) ?? '',
        avatarUrl: (site.logo_url as string) ?? null,
        brandColor: (site.brand_color as string) ?? '#7c3aed',
      }}
      entries={entries}
    />
  )
}
