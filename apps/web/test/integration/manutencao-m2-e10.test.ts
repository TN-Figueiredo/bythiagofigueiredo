// apps/web/test/integration/manutencao-m2-e10.test.ts
// @vitest-environment node
/**
 * Manutenção M2, itens 13 e 14 (pedidos 1 e 3): com as três séries particionadas, obs_archive_uncovered() continua vazia
 * (partições, tabela _antiga guardada e tabela destacada _saida), o export de canal funciona, e o registro de tamanho soma
 * as partições de obs_part sob o nome da mãe. Roda sobre a fixture da MG6 (a E10 ainda não é migration), em begin … rollback.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg6, semearCena, exportarConferirConfirmar, contagemPorTabela, escalar, tenta } from '../helpers/mg6'
import { aplicarM2, M2_SQL } from '../helpers/m2'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M2 e a E10: uncovered vazio e tamanho somando partições', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  async function emTx(fn: () => Promise<void>): Promise<void> {
    await pg.query('begin')
    try {
      // a MG6 ANTES da M2: enquanto a fixture estiver sem o conserto, quem põe a cláusula é o bloco 11 da M2 (o caminho que
      // recria fica testado); depois que a E10 consertar, o bloco 11 sai sem fazer nada e o teste continua valendo
      await garantirMg6(pg)
      await aplicarM2(pg)
      for (let i = 1; i <= 3; i++) {
        await pg.query(`select obs_part.criar_particao(t::regclass, (obs_part.mes_corrente_sp() - make_interval(months => $1))::date)
          from unnest(array['public.competitor_video_daily','public.competitor_video_early','public.competitor_video_hourly']) t`, [i])
      }
      await fn()
    } finally { await pg.query('rollback') }
  }

  it('item 13: vazio com as três particionadas, com a _antiga guardada e com uma tabela destacada _saida; o export de canal conta a série', async () => {
    await emTx(async () => {
      expect(await escalar<boolean>(pg, `select prosrc ~ 'relispartition' from pg_proc where oid = 'public.obs_archive_uncovered()'::regprocedure`)).toBe(true)
      expect(await escalar<boolean>(pg, `select prosrc ~ 'relispartition' from pg_proc where oid = 'public.obs_db_size_record(timestamp with time zone)'::regprocedure`)).toBe(true)
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      // uma tabela destacada como a M3b fará: detach, sem FK, sufixo _saida
      const nome = await escalar<string>(pg, `select obs_part.nome_da_particao('competitor_video_hourly', (obs_part.mes_corrente_sp() + interval '12 months')::date)`)
      await pg.query(`alter table public.competitor_video_hourly detach partition obs_part.${nome}`)
      for (const r of (await pg.query(`select conname from pg_constraint where conrelid = 'obs_part.${nome}'::regclass and contype = 'f'`)).rows as { conname: string }[]) {
        await pg.query(`alter table obs_part.${nome} drop constraint ${r.conname}`)
      }
      await pg.query(`alter table obs_part.${nome} rename to ${nome}_saida`)
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      const cena = await semearCena(pg)
      await exportarConferirConfirmar(pg, cena, cena.canalA, 'lote-m2')
      expect((await contagemPorTabela(pg, cena.canalA)).competitor_video_daily).toBeGreaterThan(0)
    })
  })

  it('item 14: o tamanho soma as partições de obs_part sob a mãe; nenhuma chave obs_part.* no top', async () => {
    await emTx(async () => {
      await semearCena(pg)
      await pg.query(`select public.obs_db_size_record(now())`)
      const top = await escalar<Record<string, number>>(pg, `select top_relations from public.obs_db_size_daily where day = (now() at time zone 'America/Sao_Paulo')::date`)
      expect(Object.keys(top).some(k => k.startsWith('obs_part.'))).toBe(false)
      const daily = await escalar<number>(pg, `select coalesce(sum(pg_total_relation_size(i.inhrelid)), 0)::bigint from pg_inherits i where i.inhparent = 'public.competitor_video_daily'::regclass`)
      expect(Number(daily)).toBeGreaterThan(0)
      const comp = await escalar<string>(pg, `select competitor_bytes::text from public.obs_db_size_daily where day = (now() at time zone 'America/Sao_Paulo')::date`)
      expect(Number(comp)).toBeGreaterThanOrEqual(Number(daily))
    })
  })

  it('bloco 11: corpo instalado diferente do conhecido e sem a cláusula recusa com M2:obs_archive_uncovered_divergente, ANTES da conversão', async () => {
    await pg.query('begin')
    try {
      await garantirMg6(pg)
      const antes = await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass`)
      await pg.query(`create or replace function public.obs_archive_uncovered() returns text[] language sql stable security definer set search_path = '' as $$ select '{}'::text[] $$`)
      await pg.query('savepoint s')
      const r = await tenta(pg, M2_SQL)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:obs_archive_uncovered_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass`)).toBe(antes)
    } finally { await pg.query('rollback') }
  })

  it('bloco 11b: com a M2 aplicada, a remoção correta de um canal com séries particionadas passa', async () => {
    await emTx(async () => {
      expect(await escalar<boolean>(pg, `select prosrc ~ 'pg_partition_tree' from pg_proc where oid = 'public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure`)).toBe(true)
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-m2')
      const cont = await contagemPorTabela(pg, c.canalA)
      expect(cont.competitor_video_daily).toBeGreaterThan(0)
      // as três séries entram na soma das folhas (Phil M-3): a cena já grava early e hourly
      expect(cont.competitor_video_early).toBeGreaterThan(0)
      expect(cont.competitor_video_hourly).toBeGreaterThan(0)
      const r = await escalar<{ status: string }>(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(r.status).toBe('removido')
    })
  })

  it('bloco 11b: a guarda continua mordendo com a M2 aplicada (filtro quebrado do registro na série particionada: apagou_alem_do_arquivo)', async () => {
    await emTx(async () => {
      const c = await semearCena(pg)
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.obs_archive_registry()'::regprocedure)`)
      const quebrado = def.replace(/\('competitor_video_daily',(\s*)'([^']*)'/, (_m, esp: string, filtro: string) => `('competitor_video_daily',${esp}'(${filtro}) and $1 is null'`)
      expect(quebrado).not.toBe(def)
      await pg.query(quebrado)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-m2')
      await pg.query('savepoint s')
      const r = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/E10:apagou_alem_do_arquivo: competitor_video_daily/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canalA])).toBe(1)
    })
  })

  it('bloco 11b: corpo instalado diferente do conhecido e sem a guarda por folhas recusa com M2:competitor_channel_remove_archived_divergente', async () => {
    await pg.query('begin')
    try {
      await garantirMg6(pg)
      const antes = await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass`)
      await pg.query(`create or replace function public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid) returns jsonb language sql security definer set search_path = '' as $$ select '{}'::jsonb $$`)
      await pg.query('savepoint s')
      const r = await tenta(pg, M2_SQL)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toMatch(/M2:competitor_channel_remove_archived_divergente/)
      await pg.query('rollback to savepoint s')
      expect(await escalar<string>(pg, `select relkind::text from pg_class where oid = 'public.competitor_video_daily'::regclass`)).toBe(antes)
    } finally { await pg.query('rollback') }
  })
})
