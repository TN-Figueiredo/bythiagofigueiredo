// apps/web/test/integration/manutencao-m10a-pausa.test.ts
// @vitest-environment node
/**
 * M10a recria competitor_series_health e tem de levar o remendo da E10 (competitor_channel_pause_covers); sem ele,
 * competitor_channel_pause recusa com E10:pausa_sem_remendo. Tudo em begin … rollback: depois da MG6+M2+E10+M10a a pausa funciona;
 * o mutante (M10a sem o remendo) tem de falhar.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg6, semearCena, escalar, tenta, codigoE10 } from '../helpers/mg6'
import { aplicarM2 } from '../helpers/m2'
import { M10A_SQL } from './video-antigo-m10a-caminho'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const LINHA_REMENDO = /^[ \t]*or public\.competitor_channel_pause_covers\(c\.id, p_now, interval '3 days'\)\n/m

describe.skipIf(skipIfNoLocalDb())('M10a leva o remendo da pausa da E10', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  async function emTx(fn: () => Promise<void>): Promise<void> {
    await pg.query('begin')
    try {
      await garantirMg6(pg)
      await aplicarM2(pg)
      await fn()
    } finally { await pg.query('rollback') }
  }

  it('o SQL da M10a contém o remendo uma vez, na prova da série', () => {
    const sql = readFileSync(M10A_SQL, 'utf8')
    expect(sql.match(new RegExp(LINHA_REMENDO.source, 'gm'))?.length).toBe(1)
  })

  it('depois de M2 + E10 + M10a a pausa de canal funciona e o remendo está na função', async () => {
    await emTx(async () => {
      await pg.query(readFileSync(M10A_SQL, 'utf8'))
      expect(await escalar<boolean>(pg, `select prosrc like '%competitor_channel_pause_covers%' from pg_proc where oid = 'public.competitor_series_health(uuid,timestamptz)'::regprocedure`)).toBe(true)
      expect(await escalar<boolean>(pg, `select prosrc like '%arquivados%' from pg_proc where oid = 'public.competitor_series_health(uuid,timestamptz)'::regprocedure`)).toBe(true)
      const c = await semearCena(pg)
      const t = await tenta(pg, `select public.competitor_channel_pause($1, $2, $3) ->> 'status'`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(true)
      expect(await escalar<string | null>(pg, `select collection_paused_at::text from public.competitor_channels where id = $1`, [c.canalA])).not.toBeNull()
    })
  })

  it('mutante: M10a sem o remendo é barrada pela própria guarda', async () => {
    await emTx(async () => {
      const mutante = readFileSync(M10A_SQL, 'utf8').replace(LINHA_REMENDO, '')
      expect(mutante).not.toContain("interval '3 days')\n            or coalesce")
      const t = await tenta(pg, mutante)
      expect(t.ok).toBe(false)
      if (!t.ok) expect(t.message).toContain('sem o remendo da E10')
    })
  })

  it('mutante: se a função sair sem o remendo, a pausa recusa com pausa_sem_remendo', async () => {
    await emTx(async () => {
      await pg.query(readFileSync(M10A_SQL, 'utf8'))
      const c = await semearCena(pg)
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.competitor_series_health(uuid,timestamptz)'::regprocedure)`)
      await pg.query(def.replace(LINHA_REMENDO, ''))
      const t = await tenta(pg, `select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) { expect(codigoE10(t.message)).toBe('pausa_sem_remendo'); expect(t.message).toContain('competitor_series_health') }
    })
  })
})
