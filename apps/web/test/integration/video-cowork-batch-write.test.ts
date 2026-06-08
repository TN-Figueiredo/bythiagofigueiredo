import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY, SUPABASE_URL } from '../helpers/db-seed'
import { BatchSectionUpdateSchema } from '@/lib/pipeline/sections'
import { batchUpdateSections } from '@/lib/pipeline/services/items'

// NOTE: The task spec references `applyBatchSectionUpdate(admin, siteId, input)` — that
// function does not exist in items.ts. The real export is `batchUpdateSections(ctx, body)`
// which is what the existing video-section-key-write integration test uses. Adapted here.

describe.skipIf(skipIfNoLocalDb())('Cowork batch write is format-aware for video', () => {
  let admin: SupabaseClient
  let siteId: string
  let pipeId: string

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Use an existing site from the local DB seed
    const { data: site } = await admin.from('sites').select('id').limit(1).single()
    siteId = site!.id

    pipeId = randomUUID()
    await admin.from('content_pipeline').insert({
      id: pipeId,
      site_id: siteId,
      format: 'video',
      stage: 'idea',
      language: 'pt-br',
      code: `VID-CW-${pipeId.slice(0, 8)}`,
      title_pt: 'X',
      version: 1,
      sections: {},
    })
  })

  it('a cowork ideia/pt update on a video item writes key ideia_pt (NOT ideia_shared)', async () => {
    // BatchSectionUpdateSchema shape: { updates: [{ item_id, section, lang, format, content, source }] }
    const input = BatchSectionUpdateSchema.parse({
      updates: [
        {
          item_id: pipeId,
          section: 'ideia',
          lang: 'pt',
          format: 'video',
          content: { direction: 'Direção gerada' },
          source: 'cowork',
        },
      ],
    })

    const ctx = {
      siteId,
      permissions: ['write' as const],
      supabase: admin,
    }

    const res = await batchUpdateSections(ctx, input)
    // The service returns { data: { results, summary } } — check summary
    expect(res.data?.summary.succeeded).toBe(1)
    expect(res.data?.summary.failed).toBe(0)

    const { data } = await admin
      .from('content_pipeline')
      .select('sections')
      .eq('id', pipeId)
      .single()

    const sections = data!.sections as Record<string, unknown>
    // §3.3.2 / §10(1) batch-path guard: video cowork writes land on ideia_<lang>, never ideia_shared
    expect(sections).toHaveProperty('ideia_pt')
    expect(sections).not.toHaveProperty('ideia_shared')
  })
})
