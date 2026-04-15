import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { getLocalJwtSecret, skipIfNoLocalDb } from '../helpers/db-skip'
import { PG_URL } from '../helpers/local-supabase'

// Referenced to satisfy import usage in environments needing the JWT secret.
void getLocalJwtSecret

async function withJwtClaim(client: Client, claims: object, fn: () => Promise<void>) {
  await client.query('begin')
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
  try { await fn() } finally { await client.query('rollback') }
}

describe.skipIf(skipIfNoLocalDb())('migration 0004 rls helpers', () => {
  const client = new Client({ connectionString: PG_URL })
  beforeAll(async () => { await client.connect() })
  afterAll(async () => { await client.end() })

  // Helpers live in `public` schema (see migration 0004 header for rationale).
  it('user_role() returns role from app_metadata', async () => {
    await withJwtClaim(client, { app_metadata: { role: 'super_admin' } }, async () => {
      const { rows } = await client.query(`select public.user_role() as r`)
      expect(rows[0].r).toBe('super_admin')
    })
  })

  it('user_role() returns anon when no claim', async () => {
    await client.query('begin')
    await client.query(`select set_config('request.jwt.claims', '', true)`)
    const { rows } = await client.query(`select public.user_role() as r`)
    expect(rows[0].r).toBe('anon')
    await client.query('rollback')
  })

  it('is_staff() is true for editor/admin/super_admin', async () => {
    for (const role of ['editor','admin','super_admin']) {
      await withJwtClaim(client, { app_metadata: { role } }, async () => {
        const { rows } = await client.query(`select public.is_staff() as s`)
        expect(rows[0].s).toBe(true)
      })
    }
  })

  it('is_admin() is true only for admin/super_admin', async () => {
    await withJwtClaim(client, { app_metadata: { role: 'editor' } }, async () => {
      const { rows } = await client.query(`select public.is_admin() as a`)
      expect(rows[0].a).toBe(false)
    })
    await withJwtClaim(client, { app_metadata: { role: 'admin' } }, async () => {
      const { rows } = await client.query(`select public.is_admin() as a`)
      expect(rows[0].a).toBe(true)
    })
  })
})
