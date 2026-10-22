// @vitest-environment node
/**
 * F2 T6: o índice de lugar lido do banco com mais de uma página (1.050 aliases), conferido contra count exact. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-lugares-borda --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerIndiceDeLugar } from '@/lib/youtube/observatorio/sinais/lugares-do-site'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const PREFIXO = 'zzteste-f2t6-'

describe.skipIf(skipIfNoLocalDb())('F2 T6: índice de lugar no banco (1.050 aliases)', () => {
  let pg: Client
  let base = 0
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    await pg.query(`delete from public.lugar_aliases where alias_norm like $1`, [PREFIXO + '%'])
    base = Number((await pg.query(`select count(*) from public.lugar_aliases`)).rows[0].count)
    await pg.query(
      `insert into public.lugar_aliases (alias_norm, slug, ambiguo, semente_versao)
       select $1 || lpad(g::text, 5, '0'), 'pais:TR', false, 1 from generate_series(1, 1050) g`, [PREFIXO])
  })
  afterAll(async () => {
    await pg.query(`delete from public.lugar_aliases where alias_norm like $1`, [PREFIXO + '%'])
    await pg.end()
  })

  it('lê todas as páginas: o índice tem a semente real mais os 1.050 sintéticos', async () => {
    const sb = getSupabaseServiceClient() as unknown as SupabaseClient
    const ind = await lerIndiceDeLugar(sb)
    expect(base + 1050).toBeGreaterThan(1000)
    expect(ind.porAlias.size).toBe(base + 1050)
    expect(ind.porAlias.get(PREFIXO + '01050')).toMatchObject({ slug: 'pais:TR', pais: 'TR' })
    expect(ind.versao).toBeGreaterThanOrEqual(1)
  })
})
