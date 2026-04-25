'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

type ActionResult = { ok: true; affected: number } | { ok: false; error: string }

const idsSchema = z.array(z.string().uuid()).min(1)

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return siteId
}

/**
 * Bulk publish campaigns. CAS: only transitions draft -> published.
 * Sets published_at = now() for campaigns that were in draft status.
 */
export async function bulkPublishCampaigns(
  ids: string[],
): Promise<ActionResult> {
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { ok: false, error: 'Invalid campaign IDs' }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('site_id', siteId)
    .eq('status', 'draft')
    .in('id', parsed.data)
    .select('id')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/cms/campaigns')
  return { ok: true, affected: data?.length ?? 0 }
}

/**
 * Bulk archive campaigns. CAS: only transitions draft|published -> archived.
 */
export async function bulkArchiveCampaigns(
  ids: string[],
): Promise<ActionResult> {
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { ok: false, error: 'Invalid campaign IDs' }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'archived' })
    .eq('site_id', siteId)
    .in('status', ['draft', 'published'])
    .in('id', parsed.data)
    .select('id')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/cms/campaigns')
  return { ok: true, affected: data?.length ?? 0 }
}

/**
 * Bulk delete campaigns. Only deletes draft or archived campaigns.
 */
export async function bulkDeleteCampaigns(
  ids: string[],
): Promise<ActionResult> {
  const parsed = idsSchema.safeParse(ids)
  if (!parsed.success) return { ok: false, error: 'Invalid campaign IDs' }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('campaigns')
    .delete()
    .eq('site_id', siteId)
    .in('status', ['draft', 'archived'])
    .in('id', parsed.data)
    .select('id')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/cms/campaigns')
  return { ok: true, affected: data?.length ?? 0 }
}
