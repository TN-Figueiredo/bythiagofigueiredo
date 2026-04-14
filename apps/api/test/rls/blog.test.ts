import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { skipIfNoLocalDb, getLocalJwtSecret } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

function adminJwt(): string {
  return jwt.sign(
    {
      role: 'authenticated',
      sub: '00000000-0000-0000-0000-000000000001',
      app_metadata: { role: 'super_admin' },
    },
    getLocalJwtSecret(),
    { expiresIn: '1h' }
  )
}

describe.skipIf(skipIfNoLocalDb())('RLS: blog_posts + blog_translations + authors', () => {
  const service = createClient(SUPABASE_URL, SERVICE_KEY)
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const admin = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminJwt()}` } },
  })

  let authorId: string
  let publishedId: string
  let draftId: string

  beforeAll(async () => {
    await service.from('blog_translations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('blog_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('authors').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { data: a } = await service.from('authors')
      .insert({ name: 'RLS Author', slug: 'rls-author' }).select('id').single()
    authorId = a!.id

    const { data: pub } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'published', published_at: new Date().toISOString(),
    }).select('id').single()
    publishedId = pub!.id

    const { data: draft } = await service.from('blog_posts').insert({
      author_id: authorId, status: 'draft',
    }).select('id').single()
    draftId = draft!.id
  })

  it('anon sees only published posts', async () => {
    const { data, error } = await anon.from('blog_posts').select('id,status')
    expect(error).toBeNull()
    const ids = (data ?? []).map(r => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).not.toContain(draftId)
  })

  it('anon cannot insert blog_posts', async () => {
    const { error } = await anon.from('blog_posts').insert({ author_id: authorId, status: 'draft' })
    expect(error).not.toBeNull()
  })

  it('super_admin sees all posts', async () => {
    const { data, error } = await admin.from('blog_posts').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map(r => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).toContain(draftId)
  })

  it('super_admin can insert/update/delete', async () => {
    const { data: ins, error: ie } = await admin.from('blog_posts')
      .insert({ author_id: authorId, status: 'draft' }).select('id').single()
    expect(ie).toBeNull()
    const { error: ue } = await admin.from('blog_posts')
      .update({ status: 'archived' }).eq('id', ins!.id)
    expect(ue).toBeNull()
    const { error: de } = await admin.from('blog_posts').delete().eq('id', ins!.id)
    expect(de).toBeNull()
  })

  it('anon can read authors', async () => {
    const { data, error } = await anon.from('authors').select('id')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('anon cannot insert authors', async () => {
    const { error } = await anon.from('authors').insert({ name: 'x', slug: 'x' })
    expect(error).not.toBeNull()
  })
})
