'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
}

interface Hashtag {
  id: string
  name: string
  slug: string
}

export async function searchHashtags(
  siteId: string,
  query: string,
): Promise<{ ok: true; hashtags: Hashtag[] } | { ok: false; error: string }> {
  const ctx = await getSiteContext()
  if (ctx.siteId !== siteId) return { ok: false, error: 'site_mismatch' }
  await requireEditScope(siteId)

  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('hashtags')
    .select('id, name, slug')
    .eq('site_id', siteId)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20)

  if (error) return { ok: false, error: error.message }
  return { ok: true, hashtags: data ?? [] }
}

export async function createHashtag(
  siteId: string,
  name: string,
): Promise<{ ok: true; hashtag: Hashtag } | { ok: false; error: string }> {
  const ctx = await getSiteContext()
  if (ctx.siteId !== siteId) return { ok: false, error: 'site_mismatch' }
  await requireEditScope(siteId)

  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('hashtags')
    .upsert({ site_id: siteId, name: name.trim(), slug }, { onConflict: 'site_id,slug' })
    .select('id, name, slug')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, hashtag: data }
}

export async function getPostHashtags(postId: string): Promise<Hashtag[]> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('post_hashtags')
    .select('hashtag_id, hashtags(id, name, slug)')
    .eq('post_id', postId)

  if (error || !data) return []
  return (data as unknown as Array<{ hashtag_id: string; hashtags: Hashtag | null }>)
    .map(row => row.hashtags)
    .filter((h): h is Hashtag => h !== null)
}
