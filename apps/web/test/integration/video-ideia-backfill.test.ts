import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// readdirSync + filter instead of fs.globSync — globSync only exists on Node ≥22
// and the CI Integration job runs Node 20.
const REPO_ROOT = process.cwd().replace(/apps\/web$/, '')
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase/migrations')
const MIGRATION = join(
  'supabase/migrations',
  readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith('_video_ideia_per_language.sql')) ?? '',
)

// Direct postgres URL — matches supabase start local defaults (same as db-seed).
const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

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
    // The migration is a one-time data backfill that already ran during
    // `db reset` — BEFORE these rows existed. Re-execute its (idempotent) SQL
    // so the backfill applies to the freshly seeded rows.
    await runMigration()
  })

  afterAll(async () => {
    const supabase = getSupabaseServiceClient()
    const seeded = Object.values(ids).filter(Boolean)
    if (seeded.length) await supabase.from('content_pipeline').delete().in('id', seeded)
  })

  async function runMigration() {
    const root = process.cwd().replace(/apps\/web$/, '')
    const sql = readFileSync(`${root}${MIGRATION}`, 'utf8')
    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    try {
      await pg.query(sql)
    } finally {
      await pg.end()
    }
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
