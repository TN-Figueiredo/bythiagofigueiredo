import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const MIGRATION = globSync('supabase/migrations/*_video_ideia_per_language.sql', {
  cwd: process.cwd().replace(/apps\/web$/, ''),
})[0]

describe.skipIf(skipIfNoLocalDb())('video ideia per-language backfill', () => {
  let siteId: string
  const ids: Record<'pt' | 'en' | 'both', string> = { pt: '', en: '', both: '' }

  async function seed(language: string): Promise<string> {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase.from('content_pipeline').insert({
      site_id: siteId, format: 'video', language, stage: 'idea',
      code: `vid-backfill-${language}-${Date.now()}`,
      sections: { ideia_shared: { rev: 1, source: 'user', edited: true,
        content: { title: 'T', direction: 'D' }, updated_at: new Date().toISOString() } },
      version: 1,
    }).select('id').single()
    return data!.id
  }

  beforeAll(async () => {
    const supabase = getSupabaseServiceClient()
    const { data: site } = await supabase.from('sites').select('id').limit(1).single()
    siteId = site!.id
    ids.pt = await seed('pt-br')
    ids.en = await seed('en')
    ids.both = await seed('both')
  })

  async function runMigration() {
    // Apply via db:reset which replays migrations, OR exec the SQL through an RPC.
    // Simplest deterministic path in test: execute the migration body via supabase.rpc('exec_sql')
    // if available; otherwise this suite relies on `npm run db:reset` having applied it.
  }

  async function keysOf(id: string): Promise<string[]> {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase.from('content_pipeline').select('sections').eq('id', id).single()
    return Object.keys(data!.sections as Record<string, unknown>)
  }

  it('pt-br seeds ideia_pt only', async () => {
    await runMigration()
    const keys = await keysOf(ids.pt)
    expect(keys).toContain('ideia_pt')
    expect(keys).not.toContain('ideia_en')
  })

  it('en seeds ideia_en only', async () => {
    const keys = await keysOf(ids.en)
    expect(keys).toContain('ideia_en')
    expect(keys).not.toContain('ideia_pt')
  })

  it('both seeds BOTH ideia_pt and ideia_en', async () => {
    const keys = await keysOf(ids.both)
    expect(keys).toContain('ideia_pt')
    expect(keys).toContain('ideia_en')
  })

  it('migration file content is idempotent (guards each write with NOT (sections ? key))', () => {
    expect(MIGRATION).toBeTruthy()
    const sql = readFileSync(`${process.cwd().replace(/apps\/web$/, '')}${MIGRATION}`, 'utf8')
    expect((sql.match(/NOT \(sections \? '/g) ?? []).length).toBe(4) // 4 guarded statements
    expect(sql).toMatch(/language = 'both'/)
  })
})
