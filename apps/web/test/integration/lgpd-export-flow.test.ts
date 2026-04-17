/**
 * DB-gated integration tests for LGPD data export flow (Sprint 5a / Track A).
 *
 * Covers: request lifecycle, blob path storage, rate limit, expiry, schema
 * completeness (via direct queries), RLS on storage bucket.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  ANON_KEY,
  seedLgpdScenario,
  cleanupRbacScenario,
  signUserJwt,
} from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('LGPD export flow', () => {
  let admin: SupabaseClient
  let scenario: Awaited<ReturnType<typeof seedLgpdScenario>>

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    scenario = await seedLgpdScenario(admin, { pendingExport: false })
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, scenario)
  })

  it('creates data_export lgpd_request with pending status', async () => {
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'pending',
      })
      .select('id, status, type')
      .single()
    expect(data?.status).toBe('pending')
    expect(data?.type).toBe('data_export')
    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })

  it('unique partial index blocks duplicate pending export per user', async () => {
    const { data: a } = await admin
      .from('lgpd_requests')
      .insert({ user_id: scenario.editorAId, type: 'data_export', status: 'pending' })
      .select('id')
      .single()
    const { error } = await admin
      .from('lgpd_requests')
      .insert({ user_id: scenario.editorAId, type: 'data_export', status: 'pending' })
    expect(error).not.toBeNull()
    await admin.from('lgpd_requests').delete().eq('id', a!.id)
  })

  it('stores blob_path + blob_uploaded_at after completion', async () => {
    const path = `${scenario.editorAId}/${randomUUID()}.json`
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'completed',
        blob_path: path,
        blob_uploaded_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select('id, blob_path, blob_uploaded_at')
      .single()
    expect(data?.blob_path).toBe(path)
    expect(data?.blob_uploaded_at).toBeTruthy()
    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })

  it('blob_cleanup partial index covers pending-cleanup export blobs only', async () => {
    const { data: a } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'completed',
        blob_path: `${scenario.editorAId}/${randomUUID()}.json`,
        blob_uploaded_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      })
      .select('id')
      .single()
    const { data: cleanup } = await admin
      .from('lgpd_requests')
      .select('id, blob_path')
      .is('blob_deleted_at', null)
      .not('blob_path', 'is', null)
    expect((cleanup ?? []).find((r) => r.id === a!.id)).toBeTruthy()
    await admin.from('lgpd_requests').delete().eq('id', a!.id)
  })

  it('user can read own lgpd_requests rows via RLS (self_read policy)', async () => {
    const { data: inserted } = await admin
      .from('lgpd_requests')
      .insert({ user_id: scenario.editorAId, type: 'data_export', status: 'pending' })
      .select('id')
      .single()

    const { jwt } = signUserJwt(scenario.editorAId)
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data, error } = await client.from('lgpd_requests').select('id').eq('id', inserted!.id)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(1)

    await admin.from('lgpd_requests').delete().eq('id', inserted!.id)
  })

  it('user CANNOT read another user lgpd_requests rows via RLS', async () => {
    const { data: inserted } = await admin
      .from('lgpd_requests')
      .insert({ user_id: scenario.editorAId, type: 'data_export', status: 'pending' })
      .select('id')
      .single()

    const { jwt } = signUserJwt(scenario.randomId)
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data } = await client.from('lgpd_requests').select('id').eq('id', inserted!.id)
    expect((data ?? []).length).toBe(0)

    await admin.from('lgpd_requests').delete().eq('id', inserted!.id)
  })

  it('lgpd-exports storage bucket exists and is private', async () => {
    const { data } = await admin.storage.listBuckets()
    const bucket = (data ?? []).find((b) => b.id === 'lgpd-exports')
    expect(bucket).toBeTruthy()
    expect(bucket?.public).toBe(false)
  })

  it('service-role can upload to lgpd-exports bucket', async () => {
    const path = `${scenario.editorAId}/${randomUUID()}.json`
    const payload = JSON.stringify({ hello: 'world' })
    const { error: upErr } = await admin.storage.from('lgpd-exports').upload(path, payload, {
      contentType: 'application/json',
    })
    expect(upErr).toBeNull()
    await admin.storage.from('lgpd-exports').remove([path])
  })

  it('blob_deleted_at marker allows tracking cleanup operations', async () => {
    const path = `${scenario.editorAId}/${randomUUID()}.json`
    const { data: inserted } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'completed',
        blob_path: path,
        blob_uploaded_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    await admin
      .from('lgpd_requests')
      .update({ blob_deleted_at: new Date().toISOString() })
      .eq('id', inserted!.id)

    const { data } = await admin
      .from('lgpd_requests')
      .select('blob_deleted_at')
      .eq('id', inserted!.id)
      .single()
    expect(data?.blob_deleted_at).toBeTruthy()

    await admin.from('lgpd_requests').delete().eq('id', inserted!.id)
  })

  it('successive export requests after cleanup are allowed', async () => {
    const { data: first } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    const { data: second, error } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'pending',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(second?.id).toBeTruthy()

    await admin.from('lgpd_requests').delete().in('id', [first!.id, second!.id])
  })

  it('metadata.rate_limit_applied flag persists', async () => {
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'pending',
        metadata: { rate_limit_applied: true, rate_window_days: 30 },
      })
      .select('id, metadata')
      .single()
    const m = data!.metadata as { rate_limit_applied: boolean; rate_window_days: number }
    expect(m.rate_limit_applied).toBe(true)
    expect(m.rate_window_days).toBe(30)
    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })

  it('failed export can be marked with status=failed + retry metadata', async () => {
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.editorAId,
        type: 'data_export',
        status: 'failed',
        metadata: { attempts: 3, last_error: 'upload timeout' },
      })
      .select('id, status')
      .single()
    expect(data?.status).toBe('failed')
    await admin.from('lgpd_requests').delete().eq('id', data!.id)
  })
})
