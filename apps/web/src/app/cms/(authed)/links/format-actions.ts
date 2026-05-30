'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

const NameSchema = z.string().min(1).max(100).trim()
const DimSchema = z.number().int().min(200).max(4096)

export interface FormatPreset {
  id: string
  name: string
  width: number
  height: number
}

export async function listFormatPresets(context = 'qr-card'): Promise<ActionResult<{ presets: FormatPreset[] }>> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) throw new Error('forbidden')

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('canvas_format_presets')
    .select('id, name, width, height')
    .eq('site_id', siteId)
    .eq('context', context)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    presets: (data ?? []).map(r => ({
      id: r.id as string,
      name: r.name as string,
      width: r.width as number,
      height: r.height as number,
    })),
  }
}

export async function createFormatPreset(
  name: string,
  width: number,
  height: number,
  context = 'qr-card',
): Promise<ActionResult<{ id: string }>> {
  const parsed = NameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: 'invalid_name' }
  const wParsed = DimSchema.safeParse(width)
  const hParsed = DimSchema.safeParse(height)
  if (!wParsed.success || !hParsed.success) return { ok: false, error: 'invalid_dimensions' }

  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error('forbidden')

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('canvas_format_presets')
    .insert({
      site_id: siteId,
      context,
      name: parsed.data,
      width: wParsed.data,
      height: hParsed.data,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidateTag('canvas-formats')
  return { ok: true, id: data.id as string }
}

export async function deleteFormatPreset(presetId: string): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error('forbidden')

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('canvas_format_presets')
    .delete()
    .eq('id', presetId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('canvas-formats')
  return { ok: true }
}
