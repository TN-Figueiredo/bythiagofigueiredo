/**
 * DB-gated integration tests for `public.cron_try_lock(text)` /
 * `public.cron_unlock(text)`.
 *
 * These wrap `pg_try_advisory_lock` / `pg_advisory_unlock` on
 * `hashtextextended(p_job, 0)`. Session-scoped: a lock held on one connection
 * is invisible to another connection's `pg_try_advisory_lock`, which is
 * precisely the serialization the cron routes rely on.
 *
 * We use two independent `pg` clients to simulate two concurrent cron
 * invocations. Supabase-js shares a single REST connection pool, so calling
 * `rpc('cron_try_lock')` twice via the same client would release the lock
 * between calls — not representative of the production race.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('RPC cron_try_lock / cron_unlock', () => {
  let conn1: Client
  let conn2: Client

  beforeAll(async () => {
    conn1 = new Client({ connectionString: PG_URL })
    conn2 = new Client({ connectionString: PG_URL })
    await conn1.connect()
    await conn2.connect()
  })

  afterAll(async () => {
    // Defensive: release anything still held on these sessions.
    await conn1.query(`select public.cron_unlock($1)`, ['test-job-a']).catch(() => {})
    await conn1.query(`select public.cron_unlock($1)`, ['test-job-b']).catch(() => {})
    await conn2.query(`select public.cron_unlock($1)`, ['test-job-a']).catch(() => {})
    await conn2.query(`select public.cron_unlock($1)`, ['test-job-b']).catch(() => {})
    await conn1.end()
    await conn2.end()
  })

  it('first call acquires; concurrent call on another session is denied', async () => {
    const jobName = `test-lock-${Date.now()}`

    const first = await conn1.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobName],
    )
    expect(first.rows[0]?.cron_try_lock).toBe(true)

    const second = await conn2.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobName],
    )
    expect(second.rows[0]?.cron_try_lock).toBe(false)

    // Release on the original session.
    const unlock = await conn1.query<{ cron_unlock: boolean }>(
      `select public.cron_unlock($1) as cron_unlock`,
      [jobName],
    )
    expect(unlock.rows[0]?.cron_unlock).toBe(true)
  })

  it('unlock releases: subsequent try_lock succeeds on a different session', async () => {
    const jobName = `test-release-${Date.now()}`

    const a = await conn1.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobName],
    )
    expect(a.rows[0]?.cron_try_lock).toBe(true)

    await conn1.query(`select public.cron_unlock($1)`, [jobName])

    const b = await conn2.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobName],
    )
    expect(b.rows[0]?.cron_try_lock).toBe(true)

    // Cleanup.
    await conn2.query(`select public.cron_unlock($1)`, [jobName])
  })

  it('different job names do not interfere', async () => {
    const jobA = `test-job-a-${Date.now()}`
    const jobB = `test-job-b-${Date.now()}`

    const a = await conn1.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobA],
    )
    expect(a.rows[0]?.cron_try_lock).toBe(true)

    const b = await conn2.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobB],
    )
    expect(b.rows[0]?.cron_try_lock).toBe(true)

    // And confirm jobA is still locked vs conn2.
    const contendA = await conn2.query<{ cron_try_lock: boolean }>(
      `select public.cron_try_lock($1) as cron_try_lock`,
      [jobA],
    )
    expect(contendA.rows[0]?.cron_try_lock).toBe(false)

    await conn1.query(`select public.cron_unlock($1)`, [jobA])
    await conn2.query(`select public.cron_unlock($1)`, [jobB])
  })
})
