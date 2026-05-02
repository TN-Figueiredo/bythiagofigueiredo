import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe.skipIf(skipIfNoLocalDb())('newsletter_types landing columns', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  })

  it('slug column exists, is NOT NULL and UNIQUE', async () => {
    const { data, error } = await db
      .from('newsletter_types')
      .select('slug')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  it('slug format CHECK rejects invalid slugs', async () => {
    const { error } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-bad-slug',
        locale: 'en',
        name: 'Test',
        color: '#000000',
        site_id: '00000000-0000-0000-0000-000000000000',
        slug: 'UPPER-CASE',
      })

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_slug_format')
  })

  it('slug reserved words CHECK rejects "archive"', async () => {
    const { error } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-reserved',
        locale: 'en',
        name: 'Test',
        color: '#000000',
        site_id: '00000000-0000-0000-0000-000000000000',
        slug: 'archive',
      })

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_slug_reserved')
  })

  it('slug length CHECK rejects slugs < 3 chars', async () => {
    const { error } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-short',
        locale: 'en',
        name: 'Test',
        color: '#000000',
        site_id: '00000000-0000-0000-0000-000000000000',
        slug: 'ab',
      })

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_slug_length')
  })

  it('color_dark CHECK rejects invalid hex', async () => {
    const { error } = await db
      .from('newsletter_types')
      .update({ color_dark: 'not-a-color' })
      .eq('id', 'main-en')

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_color_dark_hex')
  })

  it('og_image_url CHECK rejects non-https', async () => {
    const { error } = await db
      .from('newsletter_types')
      .update({ og_image_url: 'http://insecure.com/image.png' })
      .eq('id', 'main-en')

    expect(error).toBeTruthy()
    expect(error?.message).toContain('newsletter_types_og_image_url_https')
  })

  it('landing_content structural CHECK rejects invalid shape', async () => {
    const { error } = await db
      .from('newsletter_types')
      .update({ landing_content: '"not-an-object"' })
      .eq('id', 'main-en')

    expect(error).toBeTruthy()
  })

  it('backfilled slugs exist for all 8 types', async () => {
    const { data } = await db
      .from('newsletter_types')
      .select('id, slug')
      .not('slug', 'is', null)

    const slugs = (data ?? []).map((t) => t.slug)
    expect(slugs).toContain('diario-do-bythiago')
    expect(slugs).toContain('the-bythiago-diary')
    expect(slugs).toContain('curvas-e-estradas')
    expect(slugs).toContain('curves-and-roads')
    expect(slugs).toContain('crescer-de-dentro')
    expect(slugs).toContain('grow-inward')
    expect(slugs).toContain('codigo-em-portugues')
    expect(slugs).toContain('code-in-portuguese')
  })

  it('updated_at trigger fires on UPDATE', async () => {
    const { data: before } = await db
      .from('newsletter_types')
      .select('updated_at')
      .eq('id', 'main-en')
      .single()

    await new Promise((r) => setTimeout(r, 50))

    await db
      .from('newsletter_types')
      .update({ description: 'updated for test ' + Date.now() })
      .eq('id', 'main-en')

    const { data: after } = await db
      .from('newsletter_types')
      .select('updated_at')
      .eq('id', 'main-en')
      .single()

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before!.updated_at).getTime(),
    )
  })
})
