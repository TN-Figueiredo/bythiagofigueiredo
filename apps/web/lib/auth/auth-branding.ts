import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export interface SiteBrandingRow {
  site_name?: string
  primary_domain?: string
  logo_url?: string | null
  primary_color?: string | null
  default_locale?: string
}

/** `x-site-id` vem do middleware; sem ele, cai nos padrões do pacote. */
export async function loadBranding(): Promise<SiteBrandingRow | null> {
  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await client.rpc('get_site_branding', { p_site_id: siteId })
  return (data ?? null) as SiteBrandingRow | null
}
