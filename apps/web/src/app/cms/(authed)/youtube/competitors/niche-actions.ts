'use server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { denyUnlessSiteAdmin } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { isNicheSlug, parseNiche, type Niche, type NicheScope } from '@/lib/youtube/observatorio/niche'
import { readNicheDefs } from '@/lib/youtube/observatorio/niches-db'

/**
 * O nicho existe neste site? Lido de youtube_niches DEPOIS do guard de quem chama. Tabela ausente (a migration ainda não
 * chegou a este banco) → valem os dois de fábrica. Qualquer outro erro de leitura recusa: nunca "qualquer nicho serve".
 */
async function nicheExists(sb: SupabaseClient, siteId: string, niche: Niche): Promise<boolean> {
  try { return (await readNicheDefs(sb, siteId)).some(d => d.id === niche) } catch { return false }
}

export async function getUserNiche(): Promise<NicheScope> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return 'todos'
  // Read error falls back to 'todos' on purpose; it is only a preference. Only the FORM is checked here: the page that
  // has the engine applies obs.scopeOf, so a saved niche that no longer exists opens in Todos.
  const { data } = await getSupabaseServiceClient().from('competitor_user_prefs').select('niche').eq('user_id', res.user.id).eq('site_id', siteId).maybeSingle()
  return parseNiche(data?.niche) ?? 'todos'
}
/** Saves 'todos' or a niche that exists in the site. */
export async function setUserNiche(niche: NicheScope): Promise<{ ok: boolean }> {
  if (!parseNiche(niche)) return { ok: false }
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return { ok: false }
  const sb = getSupabaseServiceClient()
  if (niche !== 'todos' && !(await nicheExists(sb, siteId, niche))) return { ok: false }
  const { error } = await sb.from('competitor_user_prefs').upsert({ user_id: res.user.id, site_id: siteId, niche, updated_at: new Date().toISOString() }, { onConflict: 'user_id,site_id' })
  return { ok: !error }
}
/** Shared by the two niche writes: form, guard, existence in the site, then the update filtered by id and site. */
async function setNicheOf(table: 'competitor_channels' | 'youtube_channels', channelRowId: string, niche: Niche | null): Promise<{ ok: boolean }> {
  if (niche !== null && !isNicheSlug(niche)) return { ok: false }
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false }
  const sb = getSupabaseServiceClient()
  if (niche !== null && !(await nicheExists(sb, siteId, niche))) return { ok: false }
  const { error, data } = await sb.from(table).update({ niche }).eq('id', channelRowId).eq('site_id', siteId).select('id')
  if (!error && (data?.length ?? 0) > 0) {
    revalidatePath('/cms/youtube/competitors', 'layout')
    return { ok: true }
  }
  return { ok: false }
}
export async function setChannelNiche(channelRowId: string, niche: Niche | null): Promise<{ ok: boolean }> {
  return setNicheOf('competitor_channels', channelRowId, niche)
}

/**
 * Own channel: the niche is part of the channel's identity (same field as updateYouTubeChannelIdentity), so it takes
 * the "administrar o site" step — asked first, before any service client, failing closed. A competitor's niche does not.
 */
export async function setOwnChannelNiche(channelRowId: string, niche: Niche | null): Promise<{ ok: boolean; error?: string }> {
  const denied = await denyUnlessSiteAdmin((await getSiteContext()).siteId, 'mudar o nicho de um canal próprio')
  if (denied) return denied
  return setNicheOf('youtube_channels', channelRowId, niche)
}
