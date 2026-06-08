import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY, SUPABASE_URL } from '../helpers/db-seed'
import { createClient } from '@supabase/supabase-js'
import { batchUpdateSections } from '@/lib/pipeline/services/items'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('video batch write resolves ideia_pt (not ideia_shared)', () => {
  let itemId: string
  let siteId: string

  beforeAll(async () => {
    const { data: site } = await supabase.from('sites').select('id').limit(1).single()
    siteId = site!.id
    const { data } = await supabase
      .from('content_pipeline')
      .insert({
        site_id: siteId,
        format: 'video',
        language: 'pt-br',
        stage: 'idea',
        title_pt: 'Teste vídeo PT',
        code: 'vid-test-section-key',
        sections: {},
        version: 1,
      })
      .select('id')
      .single()
    itemId = data!.id
  })

  afterAll(async () => {
    if (itemId) {
      await supabase.from('content_pipeline').delete().eq('id', itemId)
    }
  })

  it('writes ideia_pt for a video cowork batch update, never ideia_shared', async () => {
    const ctx = {
      siteId,
      permissions: ['write' as const],
      supabase,
    }
    await batchUpdateSections(ctx, {
      updates: [
        {
          item_id: itemId,
          section: 'ideia',
          lang: 'pt',
          format: 'video' as const,
          content: { title: 'X' },
          source: 'cowork',
        },
      ],
    })
    const { data } = await supabase
      .from('content_pipeline')
      .select('sections')
      .eq('id', itemId)
      .single()
    const sections = data!.sections as Record<string, unknown>
    expect(Object.keys(sections)).toContain('ideia_pt')
    expect(Object.keys(sections)).not.toContain('ideia_shared')
  })
})
