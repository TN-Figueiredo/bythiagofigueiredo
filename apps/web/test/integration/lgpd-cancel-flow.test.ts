/**
 * DB-gated integration tests for LGPD cancellation flow (Sprint 5a / Track A).
 *
 * Cancel happens during phase 1 → phase 3 grace window. App layer handles
 * unban + email — DB layer just flips status + audit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedLgpdScenario,
  cleanupRbacScenario,
} from '../helpers/db-seed'

function tokenHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

describe.skipIf(skipIfNoLocalDb())('LGPD cancel flow', () => {
  let admin: SupabaseClient
  let scenario: Awaited<ReturnType<typeof seedLgpdScenario>>

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    scenario = await seedLgpdScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, scenario)
  })

  async function seedProcessingRequest(opts: { raw: string; scheduledPurgeAt: Date; userId?: string }): Promise<string> {
    const hash = tokenHash(opts.raw)
    const { data } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: opts.userId ?? scenario.reporterAId,
        type: 'account_deletion',
        status: 'processing',
        phase: 1,
        confirmation_token_hash: hash,
        scheduled_purge_at: opts.scheduledPurgeAt.toISOString(),
      })
      .select('id')
      .single()
    return data!.id
  }

  it('cancel during grace flips status to cancelled + records cancelled_at', async () => {
    const raw = `cancel-${randomUUID()}`
    const id = await seedProcessingRequest({ raw, scheduledPurgeAt: new Date(Date.now() + 10 * 86400e3) })
    const { data } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: tokenHash(raw) })
    expect((data as { cancelled: boolean }).cancelled).toBe(true)
    const { data: row } = await admin.from('lgpd_requests').select('status, cancelled_at').eq('id', id).single()
    expect(row?.status).toBe('cancelled')
    expect(row?.cancelled_at).toBeTruthy()
    await admin.from('lgpd_requests').delete().eq('id', id)
  })

  it('cancel after scheduled_purge_at has passed fails', async () => {
    const raw = `expired-${randomUUID()}`
    const id = await seedProcessingRequest({ raw, scheduledPurgeAt: new Date(Date.now() - 86400e3) })
    const { data } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: tokenHash(raw) })
    expect((data as { cancelled: boolean }).cancelled).toBe(false)
    await admin.from('lgpd_requests').delete().eq('id', id)
  })

  it('cancel with wrong token returns cancelled=false', async () => {
    const { data } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: 'bogus-token' })
    expect((data as { cancelled: boolean }).cancelled).toBe(false)
  })

  it('cancel on already-cancelled request returns cancelled=false (idempotent noop)', async () => {
    const raw = `already-${randomUUID()}`
    const hash = tokenHash(raw)
    const { data: inserted } = await admin
      .from('lgpd_requests')
      .insert({
        user_id: scenario.reporterAId,
        type: 'account_deletion',
        status: 'cancelled',
        phase: 1,
        confirmation_token_hash: hash,
        cancelled_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    const { data } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: hash })
    expect((data as { cancelled: boolean }).cancelled).toBe(false)
    await admin.from('lgpd_requests').delete().eq('id', inserted!.id)
  })

  it('cancel response includes user_id for unban callback', async () => {
    const raw = `unban-${randomUUID()}`
    const id = await seedProcessingRequest({ raw, scheduledPurgeAt: new Date(Date.now() + 5 * 86400e3) })
    const { data } = await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: tokenHash(raw) })
    const parsed = data as { cancelled: boolean; user_id: string }
    expect(parsed.user_id).toBe(scenario.reporterAId)
    await admin.from('lgpd_requests').delete().eq('id', id)
  })

  it('cancel does NOT revert anonymized content (caveat: cancellation restores login only)', async () => {
    // Phase 1 cleanup runs on confirmation. If user cancels, content stays redacted.
    // Assert by checking that a separately-cleaned authors row does NOT get user_id back.
    const userId = scenario.editorAId
    await admin.rpc('lgpd_phase1_cleanup', { p_user_id: userId, p_pre_capture: {} })

    const raw = `caveat-${randomUUID()}`
    const id = await seedProcessingRequest({
      raw,
      scheduledPurgeAt: new Date(Date.now() + 5 * 86400e3),
      userId,
    })
    await admin.rpc('cancel_account_deletion_in_grace', { p_token_hash: tokenHash(raw) })

    const { data: authors } = await admin.from('authors').select('user_id').eq('user_id', userId)
    expect((authors ?? []).length).toBe(0) // Authors.user_id stays NULL — cleanup is irreversible.

    await admin.from('lgpd_requests').delete().eq('id', id)
  })
})
