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
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false }
  const { error } = await getSupabaseServiceClient().from('competitor_channels').update({ niche }).eq('id', channelRowId).eq('site_id', siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: !error }
}
