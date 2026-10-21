// @vitest-environment node
/**
 * F1a-dado T13: tabelas `ab_native_observados` e `ab_native_obs_cursor` (CHECKs, unicidade, RLS, poda). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-native-observados.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 30_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const YT = 'abcdefghijk'

describe.skipIf(skipIfNoLocalDb())('F1a-dado T13: tabelas das trocas observadas', () => {
  let pg: Client
  let siteId: string

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(getSupabaseServiceClient())).siteId
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.ab_native_observados where site_id = $1', [siteId])
      await pg.query('delete from public.ab_native_obs_cursor where site_id = $1', [siteId])
      await pg.query('delete from public.sites where id = $1', [siteId])
    } finally { await pg.end() }
  })

  async function tx<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try { return await fn() } finally { await pg.query('rollback') }
  }
  async function erro(sql: string, params: unknown[] = []): Promise<string | null> {
    await pg.query('savepoint s')
    try { await pg.query(sql, params); await pg.query('release savepoint s'); return null } catch (e) {
      await pg.query('rollback to savepoint s'); return (e as { code?: string }).code ?? 'sem_codigo'
    }
  }
  const INS = `insert into public.ab_native_observados (site_id, youtube_video_id, campo, tipo_troca, veredito, versao_regra, trocas, n_versoes, ficou, ficou_estado, motivo, primeira_troca_em)
               values ($1, $2, $3, $4, 'troca_observada', 1, $5::jsonb, $6, '{"titulo":"x"}'::jsonb, $7, $8, now())`
  const ins = (o: { yt?: string; campo?: string; tipo?: string; trocas?: unknown[]; n?: number; estado?: string; motivo?: string | null } = {}): Promise<string | null> =>
    erro(INS, [siteId, o.yt ?? YT, o.campo ?? 'titulo', o.tipo ?? 'sequencial', JSON.stringify(o.trocas ?? [{ v: 0 }, { v: 1 }]), o.n ?? 2, o.estado ?? 'em_andamento', o.motivo ?? null])

  it('as duas tabelas e a poda existem; RLS ligada; a identidade do id é "generated always"', async () => {
    const r = await pg.query(`select relname, relrowsecurity from pg_class where oid = any(array['public.ab_native_observados'::regclass, 'public.ab_native_obs_cursor'::regclass])`)
    expect(r.rows.map(x => [x.relname, x.relrowsecurity]).sort()).toEqual([['ab_native_obs_cursor', true], ['ab_native_observados', true]])
    expect((await pg.query(`select attidentity from pg_attribute where attrelid = 'public.ab_native_observados'::regclass and attname = 'id'`)).rows[0].attidentity).toBe('a')
    expect(await pg.query(`select to_regprocedure('public.ab_native_obs_poda(timestamptz,integer)') as f`).then(x => x.rows[0].f)).not.toBeNull()
  })

  it('CHECKs: campo, tipo, n_versoes >= 2, até 20 corridas, sem_desfecho exige motivo, id do YouTube', async () => {
    await tx(async () => {
      expect(await ins()).toBeNull()
      await pg.query('delete from public.ab_native_observados where site_id = $1', [siteId])
      expect(await ins({ campo: 'descricao' })).toBe('23514')
      expect(await ins({ tipo: 'teste' })).toBe('23514')
      expect(await ins({ n: 1 })).toBe('23514')
      expect(await ins({ trocas: Array.from({ length: 21 }, (_, i) => ({ v: i })) })).toBe('23514')
      expect(await ins({ trocas: Array.from({ length: 20 }, (_, i) => ({ v: i })) })).toBeNull()
      await pg.query('delete from public.ab_native_observados where site_id = $1', [siteId])
      expect(await ins({ estado: 'sem_desfecho' })).toBe('23514')
      expect(await ins({ estado: 'sem_desfecho', motivo: 'janela' })).toBeNull()
      expect(await ins({ yt: 'curto', campo: 'miniatura' })).toBe('23514')
      expect(await ins({ estado: 'talvez' })).toBe('23514')
    })
  })

  it('um estado por campo: unique (site, vídeo, campo); título e miniatura convivem', async () => {
    await tx(async () => {
      expect(await ins({ campo: 'titulo' })).toBeNull()
      expect(await ins({ campo: 'miniatura' })).toBeNull()
      expect(await ins({ campo: 'titulo' })).toBe('23505')
    })
  })

  it('cursor: motivo só ok ou sem_publicacao; unique por alvo', async () => {
    await tx(async () => {
      const q = `insert into public.ab_native_obs_cursor (site_id, youtube_video_id, avaliado_ate_rodada, avaliado_em, avaliado_motivo) values ($1, $2, 10, now(), $3)`
      expect(await erro(q, [siteId, YT, 'ok'])).toBeNull()
      expect(await erro(q, [siteId, YT, 'sem_publicacao'])).toBe('23505')
      expect(await erro(q, [siteId, 'zyxwvutsrqp', 'falhou'])).toBe('23514')
      expect(await erro(q, [siteId, 'zyxwvutsrqp', 'sem_publicacao'])).toBeNull()
    })
  })

  it('RLS: anon e authenticated não escrevem nem leem (sem direito no site); service_role escreve', async () => {
    await tx(async () => {
      await ins()
      await pg.query(`set local role anon`)
      expect(await erro(`select 1 from public.ab_native_observados`)).toBe('42501')
      await pg.query(`reset role`)
      await pg.query(`set local role authenticated`)
      expect(await erro(INS, [siteId, 'bbbbbbbbbbb', 'titulo', 'sequencial', '[]', 2, 'em_andamento', null])).toBe('42501')
      expect(await erro(`delete from public.ab_native_observados`)).toBe('42501')
      expect((await pg.query(`select count(*)::int n from public.ab_native_observados`)).rows[0].n).toBe(0) // sem membership: a policy esconde
      await pg.query(`reset role`)
    })
  })

  it('poda: 365 d após ultima_atualizacao_em / avaliado_em, em lote; lote inválido recusa; só service_role executa', async () => {
    await tx(async () => {
      await ins({ yt: 'aaaaaaaaaaa' }); await ins({ yt: 'bbbbbbbbbbb' }); await ins({ yt: 'ccccccccccc' })
      await pg.query(`update public.ab_native_observados set ultima_atualizacao_em = now() - interval '366 days' where site_id = $1 and youtube_video_id in ('aaaaaaaaaaa','bbbbbbbbbbb')`, [siteId])
      await pg.query(`update public.ab_native_observados set ultima_atualizacao_em = now() - interval '364 days' where site_id = $1 and youtube_video_id = 'ccccccccccc'`, [siteId])
      await pg.query(`insert into public.ab_native_obs_cursor (site_id, youtube_video_id, avaliado_ate_rodada, avaliado_em, avaliado_motivo)
        values ($1, 'aaaaaaaaaaa', 1, now() - interval '400 days', 'ok'), ($1, 'ccccccccccc', 1, now(), 'ok')`, [siteId])
      const n1 = (await pg.query(`select public.ab_native_obs_poda(now(), 1) n`)).rows[0].n
      expect(n1).toBe(2) // 1 de cada tabela, lote 1
      const n2 = (await pg.query(`select public.ab_native_obs_poda(now(), 10) n`)).rows[0].n
      expect(n2).toBe(1)
      expect((await pg.query(`select youtube_video_id from public.ab_native_observados where site_id = $1`, [siteId])).rows.map(r => r.youtube_video_id)).toEqual(['ccccccccccc'])
      expect((await pg.query(`select youtube_video_id from public.ab_native_obs_cursor where site_id = $1`, [siteId])).rows.map(r => r.youtube_video_id)).toEqual(['ccccccccccc'])
      expect(await erro(`select public.ab_native_obs_poda(now(), 0)`)).toBe('22023')
      expect(await erro(`select public.ab_native_obs_poda(null, 5)`)).toBe('22023')
      expect((await pg.query(`select has_function_privilege('service_role', 'public.ab_native_obs_poda(timestamptz,integer)', 'execute') s, has_function_privilege('authenticated', 'public.ab_native_obs_poda(timestamptz,integer)', 'execute') a, has_function_privilege('anon', 'public.ab_native_obs_poda(timestamptz,integer)', 'execute') n`)).rows[0]).toEqual({ s: true, a: false, n: false })
    })
  })

  it('a migration reaplicada uma 2ª vez não dá erro e não apaga dado', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const dir = new URL('../../../../supabase/migrations/', import.meta.url)
    const arq = readdirSync(dir).filter(f => f.endsWith('_ab_native_observados.sql'))
    expect(arq).toHaveLength(1)
    const sql = readFileSync(new URL(arq[0]!, dir), 'utf8')
    await tx(async () => {
      await ins()
      await pg.query(sql)
      expect((await pg.query(`select count(*)::int n from public.ab_native_observados where site_id = $1`, [siteId])).rows[0].n).toBe(1)
    })
  })
})
