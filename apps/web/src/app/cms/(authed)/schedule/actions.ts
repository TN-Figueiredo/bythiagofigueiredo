'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

type ActionResult = { ok: true } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

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

const tableEnum = z.enum(['blog_posts', 'newsletter_editions'])

const scheduleItemSchema = z.object({
  id: z.string().uuid(),
  table: tableEnum,
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const unslotItemSchema = z.object({
  id: z.string().uuid(),
  table: tableEnum,
})

const publishNowSchema = z.object({
  id: z.string().uuid(),
  table: tableEnum,
})

const reorderBacklogSchema = z.object({
  table: tableEnum,
  orderedIds: z.array(z.string().uuid()).min(1),
})

export async function scheduleItem(input: {
  id: string
  table: string
  slotDate: string
}): Promise<ActionResult> {
  const parsed = scheduleItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from(parsed.data.table)
    .update({ slot_date: parsed.data.slotDate, status: 'queued' })
    .eq('id', parsed.data.id)
    .eq('site_id', siteId)
    .in('status', ['ready', 'queued'])
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Item not found or status precondition not met (must be ready or queued)',
    }
  }

  revalidatePath('/cms/schedule')
  return { ok: true }
}

export async function unslotItem(input: {
  id: string
  table: string
}): Promise<ActionResult> {
  const parsed = unslotItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from(parsed.data.table)
    .update({ slot_date: null, status: 'ready' })
    .eq('id', parsed.data.id)
    .eq('site_id', siteId)
    .in('status', ['queued'])
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Item not found or status precondition not met (must be queued)',
    }
  }

  revalidatePath('/cms/schedule')
  return { ok: true }
}

export async function publishNow(input: {
  id: string
  table: string
}): Promise<ActionResult> {
  const parsed = publishNowSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from(parsed.data.table)
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('site_id', siteId)
    .in('status', ['ready', 'queued'])
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Item not found or status precondition not met (must be ready or queued)',
    }
  }

  revalidatePath('/cms/schedule')
  return { ok: true }
}

export async function reorderBacklog(input: {
  table: string
  orderedIds: string[]
}): Promise<ActionResult> {
  const parsed = reorderBacklogSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  for (let i = 0; i < parsed.data.orderedIds.length; i++) {
    const { error } = await supabase
      .from(parsed.data.table)
      .update({ queue_position: i })
      .eq('id', parsed.data.orderedIds[i])
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/cms/schedule')
  return { ok: true }
}
