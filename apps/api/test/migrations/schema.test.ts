import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { PG_URL } from '../helpers/local-supabase'

describe.skipIf(skipIfNoLocalDb())('migration 0001 authors', () => {
  const client = new Client({ connectionString: PG_URL })
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

describe.skipIf(skipIfNoLocalDb())('migration 0002 blog_posts', () => {
  const client = new Client({ connectionString: PG_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('post_status enum exists with 4 values', async () => {
    const { rows } = await client.query(`
      select unnest(enum_range(null::post_status))::text as v order by 1
    `)
    expect(rows.map(r => r.v).sort()).toEqual(['archived','draft','published','scheduled'])
  })

  it('blog_posts table exists with expected columns and FK', async () => {
    const { rows } = await client.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='blog_posts'
    `)
    const names = rows.map(r => r.column_name)
    for (const c of ['id','site_id','author_id','status','published_at','scheduled_for',
      'cover_image_url','created_at','updated_at','created_by','updated_by']) {
      expect(names).toContain(c)
    }
  })

  it('cannot insert blog_post without author_id (NOT NULL)', async () => {
    await expect(client.query(
      `insert into public.blog_posts(status) values ('draft')`
    )).rejects.toThrow(/author_id/)
  })

  it('can insert blog_post with author', async () => {
    await client.query(
      `insert into public.authors(name, slug) values ('A','a') on conflict (slug) do nothing`
    )
    const { rows: [a] } = await client.query(`select id from public.authors where slug='a'`)
    const { rows } = await client.query(
      `insert into public.blog_posts(author_id, status) values ($1,'draft') returning id, status`,
      [a.id]
    )
    expect(rows[0].status).toBe('draft')
  })
})

describe.skipIf(skipIfNoLocalDb())('migration 0003 blog_translations', () => {
  const client = new Client({ connectionString: PG_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  it('blog_translations table has expected columns', async () => {
    const { rows } = await client.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='blog_translations'
    `)
    const names = rows.map(r => r.column_name)
    for (const c of ['id','post_id','locale','title','slug','excerpt','content_mdx',
      'cover_image_url','meta_title','meta_description','og_image_url',
      'created_at','updated_at']) {
      expect(names).toContain(c)
    }
  })

  it('unique (post_id, locale) is enforced', async () => {
    await client.query(`insert into public.authors(name,slug) values('B','b') on conflict do nothing`)
    const { rows: [a] } = await client.query(`select id from public.authors where slug='b'`)
    const { rows: [p] } = await client.query(
      `insert into public.blog_posts(author_id) values ($1) returning id`, [a.id]
    )
    await client.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_mdx)
       values ($1,'pt-BR','T','s1','c')`, [p.id]
    )
    await expect(client.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_mdx)
       values ($1,'pt-BR','T2','s2','c2')`, [p.id]
    )).rejects.toThrow()
  })

  it('cascades delete when post is removed', async () => {
    const { rows: [a] } = await client.query(`select id from public.authors where slug='b'`)
    const { rows: [p] } = await client.query(
      `insert into public.blog_posts(author_id) values ($1) returning id`, [a.id]
    )
    await client.query(
      `insert into public.blog_translations(post_id,locale,title,slug,content_mdx)
       values ($1,'en','T','en-slug','c')`, [p.id]
    )
    await client.query(`delete from public.blog_posts where id=$1`, [p.id])
    const { rows } = await client.query(
      `select 1 from public.blog_translations where post_id=$1`, [p.id]
    )
    expect(rows).toHaveLength(0)
  })
})
