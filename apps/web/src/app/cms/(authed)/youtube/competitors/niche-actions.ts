'use server'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'

export async function getUserNiche(): Promise<NicheScope> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return 'todos'
  // Read error falls back to 'todos' on purpose; it is only a preference.
  const { data } = await getSupabaseServiceClient().from('competitor_user_prefs').select('niche').eq('user_id', res.user.id).eq('site_id', siteId).maybeSingle()
  return parseNiche(data?.niche) ?? 'todos'
}
export async function setUserNiche(niche: NicheScope): Promise<{ ok: boolean }> {
  if (!parseNiche(niche)) return { ok: false }
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return { ok: false }
  const { error } = await getSupabaseServiceClient().from('competitor_user_prefs').upsert({ user_id: res.user.id, site_id: siteId, niche, updated_at: new Date().toISOString() }, { onConflict: 'user_id,site_id' })
  return { ok: !error }
}
export async function setChannelNiche(channelRowId: string, niche: 'viagem' | 'ia' | null): Promise<{ ok: boolean }> {
  if (niche !== null && niche !== 'viagem' && niche !== 'ia') return { ok: false }
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false }
  const { error, data } = await getSupabaseServiceClient().from('competitor_channels').update({ niche }).eq('id', channelRowId).eq('site_id', siteId).select('id')
  if (!error && (data?.length ?? 0) > 0) {
    revalidatePath('/cms/youtube/competitors', 'layout')
    return { ok: true }
  }
  return { ok: false }
}

export async function setOwnChannelNiche(channelRowId: string, niche: 'viagem' | 'ia' | null): Promise<{ ok: boolean }> {
  if (niche !== null && niche !== 'viagem' && niche !== 'ia') return { ok: false }
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false }
  const { error, data } = await getSupabaseServiceClient().from('youtube_channels').update({ niche }).eq('id', channelRowId).eq('site_id', siteId).select('id')
  if (!error && (data?.length ?? 0) > 0) {
    revalidatePath('/cms/youtube/competitors', 'layout')
    return { ok: true }
  }
  return { ok: false }
}
