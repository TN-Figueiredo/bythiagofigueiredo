'use server'

import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string }

export interface WorkingTodayPin {
  itemId: string
  title: string
  stage: string
  format: string
  priority: number
  pinnedAt: string
}

async function requireEditAccess() {
  const { siteId, timezone } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, timezone, userId: res.user.id }
}

export async function pinWorkingToday(itemId: string): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase.rpc('pin_working_today', {
    p_item_id: itemId,
    p_max: 3,
  })

  if (error) return { ok: false, error: error.message }

  const result = data as { status: string; current?: number; max?: number }
  if (result.status === 'cap_reached') {
    return { ok: false, error: `Pin limit reached (${result.current}/${result.max})` }
  }

  revalidateTag('working-today')
  return { ok: true, data: result }
}

export async function unpinWorkingToday(itemId: string): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase.rpc('unpin_working_today', {
    p_item_id: itemId,
  })

  if (error) return { ok: false, error: error.message }

  revalidateTag('working-today')
  return { ok: true }
}

export async function getWorkingTodayPins(): Promise<WorkingTodayPin[]> {
  const { userId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('working_today')
    .select(`
      pipeline_item_id,
      pinned_at,
      content_pipeline(id, title_pt, title_en, stage, format, priority)
    `)
    .eq('user_id', userId)
    .order('pinned_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: Record<string, unknown>) => {
    const item = row.content_pipeline as Record<string, unknown>
    return {
      itemId: item.id as string,
      title: (item.title_pt as string || item.title_en as string) ?? 'Untitled',
      stage: item.stage as string,
      format: item.format as string,
      priority: (item.priority as number) ?? 0,
      pinnedAt: row.pinned_at as string,
    }
  })
}
