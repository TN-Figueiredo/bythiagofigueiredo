'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { LinktreeConfigSchema } from '@/app/go/linktree/_lib/types'

type ActionResult = { ok: true } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'validation_failed'
}

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

export async function saveLinktreeConfig(
  input: z.input<typeof LinktreeConfigSchema>,
): Promise<ActionResult> {
  const parsed = LinktreeConfigSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('sites')
    .update({
      linktree_config: parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)

  if (error) {
    console.error('[linktree] save failed:', error.message)
    return { ok: false, error: 'Erro ao salvar configuração. Tente novamente.' }
  }

  revalidateTag('linktree-config')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/link-in-bio')
  revalidatePath('/go/linktree')

  return { ok: true }
}

export async function loadLinktreeConfig(): Promise<
  { ok: true; config: z.infer<typeof LinktreeConfigSchema> } | { ok: false; error: string }
> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return { ok: false, error: 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('sites')
    .select('linktree_config')
    .eq('id', siteId)
    .single()

  if (error) {
    console.error('[linktree] load failed:', error.message)
    return { ok: false, error: 'Erro ao carregar configuração.' }
  }

  const config = LinktreeConfigSchema.parse(data?.linktree_config ?? {})
  return { ok: true, config }
}
