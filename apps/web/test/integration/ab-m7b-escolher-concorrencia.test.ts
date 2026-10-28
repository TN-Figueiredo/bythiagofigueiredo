// @vitest-environment node
/**
 * M7b T5: duas escolhas com o mesmo seq reivindicam uma só vez (ab_settle_claim e o UPDATE do "Manter"), contra o banco local.
 * Banco: SÓ o bythiago_int:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-m7b-escolher-concorrencia.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearTesteAb } from '../helpers/db-seed'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M7b T5: concorrência da escolha', () => {
  let pg: Client, pg2: Client
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); pg2 = new Client({ connectionString: PG_URL })
    await pg.connect(); await pg2.connect()
  })
  afterAll(async () => { await pg.end(); await pg2.end() })

  const claim = (c: Client, testId: string, seq: number) => c.query(
    `select * from public.ab_settle_claim($1::uuid, $2::int, array['completed'], 'completed', null, '{"title":{"estado":"em_andamento","destino":"x","em":"2026-10-27T00:00:00Z","forcado":false,"escreveu":null,"erro":null,"attempts":0,"iniciativa":"dono"}}'::jsonb, '{}'::jsonb)`,
    [testId, seq])

  it('dois ab_settle_claim com o mesmo p_seq: o 2º devolve zero linhas', async () => {
    const t = await semearTesteAb({ status: 'completed' })
    const [a, b] = await Promise.all([claim(pg, t.testId, 0), claim(pg2, t.testId, 0)])
    expect(a.rowCount! + b.rowCount!).toBe(1)
    const { rows } = await pg.query('select restore_seq, status from public.ab_tests where id = $1', [t.testId])
    expect(rows[0]).toMatchObject({ restore_seq: 1, status: 'completed' })
  })

  it('dois UPDATEs do "Manter" com o mesmo seq: só um altera a linha', async () => {
    const t = await semearTesteAb({ status: 'completed' })
    const upd = (c: Client) => c.query(
      `update public.ab_tests set escolha_variant_id = $2, escolha_em = now(), escolha_por = null, updated_at = now(), restore_seq = restore_seq + 1
        where id = $1 and status = 'completed' and restore_seq = 0 returning id`, [t.testId, t.varA])
    const [a, b] = await Promise.all([upd(pg), upd(pg2)])
    expect(a.rowCount! + b.rowCount!).toBe(1)
    const { rows } = await pg.query('select restore_seq, escolha_variant_id from public.ab_tests where id = $1', [t.testId])
    expect(rows[0]).toMatchObject({ restore_seq: 1, escolha_variant_id: t.varA })
  })
})
