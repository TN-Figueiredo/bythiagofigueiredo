import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSectionKey, BatchSectionUpdateSchema } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

interface BatchResult {
  item_id: string
  section_key: string
  ok: boolean
  data?: SectionData
  meta?: { item_version: number }
  error?: { code: string; message: string }
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = BatchSectionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  const results: BatchResult[] = []

  const itemGroups = new Map<string, typeof parsed.data.updates>()
  for (const update of parsed.data.updates) {
    const group = itemGroups.get(update.item_id) ?? []
    group.push(update)
    itemGroups.set(update.item_id, group)
  }

  for (const [itemId, updates] of itemGroups) {
    const { data: item, error: fetchError } = await supabase
      .from('content_pipeline')
      .select('id, version, sections')
      .eq('id', itemId)
      .eq('site_id', auth.siteId)
      .single()

    if (fetchError || !item) {
      for (const u of updates) {
        results.push({ item_id: itemId, section_key: getSectionKey(u.section, u.lang), ok: false, error: { code: 'NOT_FOUND', message: 'Item not found' } })
      }
      continue
    }

    let currentVersion = item.version
    let currentSections = (item.sections ?? {}) as Record<string, SectionData>

    for (const update of updates) {
      const sectionKey = getSectionKey(update.section, update.lang)
      const existing = currentSections[sectionKey]
      const newRev = (existing?.rev ?? 0) + 1

      const updatedSection: SectionData = {
        rev: newRev,
        cowork_rev: existing?.cowork_rev ?? null,
        source: update.source,
        edited: update.source === 'user' || existing?.edited === true,
        content: update.content,
        updated_at: new Date().toISOString(),
        modified_by: update.modified_by ?? null,
      }

      currentSections = { ...currentSections, [sectionKey]: updatedSection }
      results.push({
        item_id: itemId,
        section_key: sectionKey,
        ok: true,
        data: updatedSection,
        meta: { item_version: 0 },
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('content_pipeline')
      .update({
        sections: currentSections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('version', currentVersion)
      .select('version')
      .single()

    if (updateError || !updated) {
      for (const r of results) {
        if (r.item_id === itemId && r.ok) {
          r.ok = false
          r.data = undefined
          r.meta = undefined
          r.error = { code: 'CONFLICT', message: 'Concurrent update detected, retry' }
        }
      }
    } else {
      for (const r of results) {
        if (r.item_id === itemId && r.ok && r.meta) {
          r.meta.item_version = updated.version
        }
      }
    }
  }

  const succeeded = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    results,
    summary: { total: results.length, succeeded, failed },
  }, { headers })
}
