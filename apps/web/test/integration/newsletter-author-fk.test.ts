import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe.skipIf(skipIfNoLocalDb())('newsletter_author_fk migration', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })
  })

  it('default author exists for bythiagofigueiredo site', async () => {
    const { data: site } = await db
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single()

    expect(site).toBeTruthy()

    const { data: author, error } = await db
      .from('authors')
      .select('id, name, display_name, slug, bio, avatar_url, is_default')
      .eq('site_id', site!.id)
      .eq('is_default', true)
      .single()

    expect(error).toBeNull()
    expect(author).toBeTruthy()
    expect(author!.name).toBe('Thiago Figueiredo')
    expect(author!.slug).toBe('thiago')
    expect(author!.bio).toContain('built software')
    expect(author!.avatar_url).toBe('/identity/thiago.jpg')
    expect(author!.is_default).toBe(true)
  })

  it('newsletter_types.author_id column exists', async () => {
    const { data, error } = await db
      .from('newsletter_types')
      .select('author_id')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  it('backfill linked newsletter_types to default author', async () => {
    const { data: site } = await db
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single()

    if (!site) return // skip if no site

    const { data: types } = await db
      .from('newsletter_types')
      .select('id, author_id')
      .eq('site_id', site.id)

    if (!types || types.length === 0) return // skip if no types seeded

    // All types for this site should have author_id set (backfill ran)
    for (const t of types) {
      expect(t.author_id).toBeTruthy()
    }
  })

  it('ON DELETE SET NULL works — removing author nullifies FK', async () => {
    const { data: site } = await db
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single()

    if (!site) return

    // Create a temporary test author
    const { data: testAuthor, error: insertErr } = await db
      .from('authors')
      .insert({
        site_id: site.id,
        name: 'Test Delete Author',
        display_name: 'Test Delete Author',
        slug: 'test-delete-author-fk',
        bio: 'Temporary',
        is_default: false,
      })
      .select('id')
      .single()

    expect(insertErr).toBeNull()
    expect(testAuthor).toBeTruthy()

    // Create a temporary newsletter type pointing to this author
    const { data: testType, error: typeErr } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-fk-cascade-type',
        locale: 'en',
        name: 'Test FK Cascade',
        color: '#000000',
        site_id: site.id,
        slug: 'test-fk-cascade',
        author_id: testAuthor!.id,
      })
      .select('id, author_id')
      .single()

    expect(typeErr).toBeNull()
    expect(testType!.author_id).toBe(testAuthor!.id)

    // Delete the author
    const { error: delErr } = await db
      .from('authors')
      .delete()
      .eq('id', testAuthor!.id)

    expect(delErr).toBeNull()

    // Verify newsletter type still exists but author_id is NULL
    const { data: updatedType } = await db
      .from('newsletter_types')
      .select('id, author_id')
      .eq('id', 'test-fk-cascade-type')
      .single()

    expect(updatedType).toBeTruthy()
    expect(updatedType!.author_id).toBeNull()

    // Cleanup
    await db.from('newsletter_types').delete().eq('id', 'test-fk-cascade-type')
  })
})
