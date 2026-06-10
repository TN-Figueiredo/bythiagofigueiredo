'use server'

import { requireSiteAdminForRow } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPipelineItemForPost } from '@/lib/pipeline/blog-link'

export interface SwapDirectionResult {
  ok: boolean
  direction?: string
  directionAlts?: string[]
  error?: string
}

interface SectionEnvelope {
  rev?: number
  source?: string
  edited?: boolean
  updated_at?: string
  modified_by?: string
  content?: Record<string, unknown>
}

/**
 * Promove uma direção alternativa a direção atual no ideia_shared do item
 * linkado: a escolhida sai de `siblings`, o `angle` atual entra em `siblings`.
 * Preserva o envelope de seção (rev/source/edited) pra não quebrar a detecção
 * de conflito do Cowork, e usa CAS real no `version` do item (padrão blog-sync).
 */
export async function swapBlogDirection(
  postId: string,
  chosen: string,
): Promise<SwapDirectionResult> {
  await requireSiteAdminForRow('blog_posts', postId)
  const item = await getPipelineItemForPost(postId)
  if (!item) return { ok: false, error: 'no_pipeline_item' }

  const svc = getSupabaseServiceClient()
  const { data, error } = await svc
    .from('content_pipeline')
    .select('sections, version, stage')
    .eq('id', item.id)
    .single()
  if (error || !data) return { ok: false, error: 'load_failed' }
  // Mesma política do service layer: ideia é read-only após publicar.
  if (data.stage === 'published') return { ok: false, error: 'published_readonly' }

  const sections = (data.sections ?? {}) as Record<string, SectionEnvelope>
  const ideia: SectionEnvelope = sections['ideia_shared'] ?? {}
  const content = { ...(ideia.content ?? {}) }
  const currentAngle = typeof content.angle === 'string' ? content.angle : ''
  const siblings = (Array.isArray(content.siblings) ? content.siblings : [])
    .filter((s): s is string => typeof s === 'string')

  if (!siblings.includes(chosen)) return { ok: false, error: 'stale_alternative' }

  const nextSiblings = siblings.filter((s) => s !== chosen)
  if (currentAngle.trim()) nextSiblings.unshift(currentAngle)
  content.angle = chosen
  content.siblings = nextSiblings.slice(0, 8)

  const nextEnvelope: SectionEnvelope = {
    ...ideia,
    content,
    rev: (typeof ideia.rev === 'number' ? ideia.rev : 0) + 1,
    source: 'user',
    edited: true,
    updated_at: new Date().toISOString(),
    // modified_by é string livre nullable — o patchSection real faz pass-through
    // do payload (callers usam 'cowork-claude' ou o user id). 'cms-editor'
    // identifica esta origem (swap manual na UI) nos diffs de seção.
    modified_by: 'cms-editor',
  }

  // CAS: .eq('version') sem match retorna error:null + 0 rows — por isso o
  // .select('id') + checagem de vazio (mesmo padrão de lib/pipeline/blog-sync.ts).
  const { data: updated, error: writeError } = await svc
    .from('content_pipeline')
    .update({ sections: { ...sections, ideia_shared: nextEnvelope } })
    .eq('id', item.id)
    .eq('version', data.version)
    .select('id')
    .maybeSingle()
  if (writeError) return { ok: false, error: 'write_failed' }
  if (!updated) return { ok: false, error: 'version_conflict' } // Cowork escreveu no meio — recarregar

  return { ok: true, direction: chosen, directionAlts: content.siblings as string[] }
}

/** True quando o draft_{lang} do item linkado tem body não-vazio. */
export async function hasPipelineDraft(
  postId: string,
  lang: 'pt' | 'en',
): Promise<boolean> {
  await requireSiteAdminForRow('blog_posts', postId)
  const item = await getPipelineItemForPost(postId)
  if (!item) return false
  const svc = getSupabaseServiceClient()
  const { data } = await svc
    .from('content_pipeline')
    .select('sections')
    .eq('id', item.id)
    .single()
  const sections = data?.sections as Record<string, { content?: { body?: unknown } }> | null
  const body = sections?.[`draft_${lang}`]?.content?.body
  return typeof body === 'string' && body.trim().length > 0
}
