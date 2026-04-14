import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('migration 0001 authors', () => {
  const client = new Client({ connectionString: DB_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('authors table exists with expected columns', async () => {
    const { rows } = await client.query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema='public' and table_name='authors'
      order by column_name
    `)
    const cols = Object.fromEntries(rows.map(r => [r.column_name, r]))
    expect(cols.id).toBeDefined()
    expect(cols.user_id).toBeDefined()
    expect(cols.name.is_nullable).toBe('NO')
    expect(cols.slug.is_nullable).toBe('NO')
    expect(cols.bio_md).toBeDefined()
    expect(cols.avatar_url).toBeDefined()
    expect(cols.created_at.is_nullable).toBe('NO')
    expect(cols.updated_at.is_nullable).toBe('NO')
  })

  it('can insert + select an author', async () => {
    await client.query(`delete from public.authors where slug='test-author'`)
    await client.query(
      `insert into public.authors(name, slug) values ($1,$2)`,
      ['Test Author', 'test-author']
    )
    const { rows } = await client.query(
      `select name, slug from public.authors where slug='test-author'`
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Test Author')
  })

  it('tg_set_updated_at bumps updated_at on update', async () => {
    await client.query(
      `insert into public.authors(name, slug) values ($1,$2)
       on conflict (slug) do update set name=excluded.name`,
      ['Updater', 'test-updater']
    )
    const r1 = await client.query(`select updated_at from public.authors where slug='test-updater'`)
    await new Promise(r => setTimeout(r, 20))
    await client.query(`update public.authors set name='Updater 2' where slug='test-updater'`)
    const r2 = await client.query(`select updated_at from public.authors where slug='test-updater'`)
    expect(new Date(r2.rows[0].updated_at).getTime())
      .toBeGreaterThan(new Date(r1.rows[0].updated_at).getTime())
  })
})
