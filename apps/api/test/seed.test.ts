import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipIfNoLocalDb } from './helpers/db-skip'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('seed dev.sql', () => {
  const db = new Client({ connectionString: DB_URL })
  beforeAll(async () => {
    await db.connect()
    const sql = readFileSync(resolve(__dirname, '../../../supabase/seeds/dev.sql'), 'utf8')
    await db.query(sql)
  })
  afterAll(async () => { await db.end() })

  it('seeds thiago super_admin user', async () => {
    const { rows } = await db.query(
      `select raw_app_meta_data->>'role' as role from auth.users where email='thiago@bythiagofigueiredo.com'`
    )
    expect(rows[0]?.role).toBe('super_admin')
  })

  it('seeds author linked to user', async () => {
    const { rows } = await db.query(`select slug from public.authors where slug='thiago'`)
    expect(rows).toHaveLength(1)
  })

  it('seeds 3 blog posts with at least one published', async () => {
    const { rows: posts } = await db.query(`select status from public.blog_posts`)
    expect(posts.length).toBeGreaterThanOrEqual(3)
    expect(posts.some(p => p.status === 'published')).toBe(true)
  })

  it('seeds pt-BR + en translations for at least one post', async () => {
    const { rows } = await db.query(`
      select post_id, count(*)::int as n
      from public.blog_translations group by post_id having count(*) >= 2
    `)
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
})
