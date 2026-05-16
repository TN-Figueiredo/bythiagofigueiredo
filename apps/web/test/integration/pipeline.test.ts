import { describe, it, expect, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY, SUPABASE_URL, seedSite } from '../helpers/db-seed'
import { createClient } from '@supabase/supabase-js'
import { Client } from 'pg'

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const db = createClient(SUPABASE_URL, SERVICE_KEY)

const createdItemIds: string[] = []
const createdSiteIds: string[] = []

describe.skipIf(skipIfNoLocalDb())('content_pipeline integration', () => {
  let siteId: string

  afterAll(async () => {
    if (createdItemIds.length) {
      await db.from('content_pipeline').delete().in('id', createdItemIds)
    }
    if (createdSiteIds.length) {
      await db.from('sites').delete().in('id', createdSiteIds)
    }
  })

  async function setup() {
    const { siteId: sid } = await seedSite(db)
    siteId = sid
    createdSiteIds.push(siteId)
  }

  function item(overrides: Record<string, unknown> = {}) {
    const suffix = crypto.randomUUID().slice(0, 8)
    return {
      site_id: siteId,
      code: `test-${suffix}`,
      format: 'blog_post',
      stage: 'idea',
      language: 'pt-br',
      ...overrides,
    }
  }

  it('CRUD lifecycle — create, read, update, archive, restore', async () => {
    await setup()

    const { data: created, error: insertErr } = await db
      .from('content_pipeline')
      .insert(item({ title_pt: 'CRUD Test', priority: 1 }))
      .select()
      .single()

    expect(insertErr).toBeNull()
    expect(created).not.toBeNull()
    createdItemIds.push(created!.id)

    const { data: read } = await db
      .from('content_pipeline')
      .select('id, title_pt, stage, version, is_archived')
      .eq('id', created!.id)
      .single()

    expect(read!.title_pt).toBe('CRUD Test')
    expect(read!.stage).toBe('idea')
    expect(read!.version).toBe(1)
    expect(read!.is_archived).toBe(false)

    const { data: updated, error: updateErr } = await db
      .from('content_pipeline')
      .update({ title_pt: 'CRUD Updated', priority: 2 })
      .eq('id', created!.id)
      .eq('version', 1)
      .select()
      .single()

    expect(updateErr).toBeNull()
    expect(updated!.title_pt).toBe('CRUD Updated')
    expect(updated!.version).toBe(2)

    await db
      .from('content_pipeline')
      .update({ is_archived: true })
      .eq('id', created!.id)

    const { data: archived } = await db
      .from('content_pipeline')
      .select('is_archived')
      .eq('id', created!.id)
      .single()

    expect(archived!.is_archived).toBe(true)

    const { data: restored, error: restoreErr } = await db
      .from('content_pipeline')
      .update({ is_archived: false })
      .eq('id', created!.id)
      .select('is_archived')
      .single()

    expect(restoreErr).toBeNull()
    expect(restored!.is_archived).toBe(false)
  })

  it('stage advancement — version increments on each stage change', async () => {
    const { data: created } = await db
      .from('content_pipeline')
      .insert(item({ title_pt: 'Stage Test' }))
      .select()
      .single()

    createdItemIds.push(created!.id)
    expect(created!.stage).toBe('idea')
    expect(created!.version).toBe(1)

    const { data: advanced, error } = await db
      .from('content_pipeline')
      .update({ stage: 'draft' })
      .eq('id', created!.id)
      .eq('version', 1)
      .select('stage, version')
      .single()

    expect(error).toBeNull()
    expect(advanced!.stage).toBe('draft')
    expect(advanced!.version).toBe(2)
  })

  it('optimistic locking — stale version update returns no rows', async () => {
    const { data: created } = await db
      .from('content_pipeline')
      .insert(item({ title_pt: 'Lock Test' }))
      .select()
      .single()

    createdItemIds.push(created!.id)

    // First update — succeeds and bumps version to 2
    await db
      .from('content_pipeline')
      .update({ title_pt: 'First' })
      .eq('id', created!.id)
      .eq('version', 1)

    // Second update with stale version=1 should match 0 rows
    const { data: stale, error } = await db
      .from('content_pipeline')
      .update({ title_pt: 'Conflict' })
      .eq('id', created!.id)
      .eq('version', 1)
      .select()
      .single()

    expect(error).not.toBeNull()
    expect(stale).toBeNull()
  })

  it('stale days filtering — items older than cutoff appear in results', async () => {
    const { data: pi } = await db
      .from('content_pipeline')
      .insert(item({ title_pt: 'Stale Item' }))
      .select()
      .single()

    createdItemIds.push(pi!.id)

    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    try {
      const staleDate = new Date(Date.now() - 30 * 86400000).toISOString()
      await pg.query(
        'UPDATE content_pipeline SET updated_at = $1 WHERE id = $2',
        [staleDate, pi!.id],
      )
    } finally {
      await pg.end()
    }

    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data: results } = await db
      .from('content_pipeline')
      .select('id, updated_at')
      .eq('site_id', siteId)
      .lt('updated_at', cutoff)

    const found = results?.some((r) => r.id === pi!.id)
    expect(found).toBe(true)
  })

  it('search vector — text search finds item by title', async () => {
    const { data: pi, error: insertErr } = await db
      .from('content_pipeline')
      .insert(item({ title_pt: 'Fotografia urbana noturna', title_en: null }))
      .select()
      .single()

    expect(insertErr).toBeNull()
    createdItemIds.push(pi!.id)

    const { data: results, error: searchErr } = await db
      .from('content_pipeline')
      .select('id, title_pt')
      .eq('site_id', siteId)
      .textSearch('search_vector', 'fotografia', { type: 'plain' })

    expect(searchErr).toBeNull()
    const found = results?.some((r) => r.id === pi!.id)
    expect(found).toBe(true)
  })
})
