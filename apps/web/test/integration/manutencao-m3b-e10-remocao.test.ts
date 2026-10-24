// @vitest-environment node
/**
 * Manutenção M3b, Yannis 3 (14/10): a E10 apaga canal com competitor_channel_remove_archived, que faz `delete` sem declarar.
 * Com o gatilho exigindo a declaração SEMPRE (Phil I1), ela quebraria no dia da migration; o rascunho a recria para declarar
 * ('guardar', 'e10_export', xid da transação). Tudo em begin … rollback; nada confirmado no banco.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirComT13, semearCena, exportarConferirConfirmar, escalar, q1, tenta } from '../helpers/mg6'
import { aplicarM2 } from '../helpers/m2'
import { readFileSync } from 'node:fs'
import { aplicarM3b, M3B_SQL, M3B_DESFAZER_CAMINHO } from '../helpers/m3b'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MD5_DO_11B = '428702cb04c1029a10a7aa3b53aac63e'

// SKIP 23/10/2026 (envio E0): este teste monta o banco com o corpo antigo (fixture MG6/E10 de 14/10) e a M2/M3b novas guardam por md5 o corpo da 0007 (M2:/M3b:competitor_channel_remove_archived_divergente). Religar na onda da M2 (11c) e M3b (md5 recomputado, yannis.md 3.3): `.skip` -> o `describe.skipIf(skipIfNoLocalDb())` original.
describe.skip('M3b e a E10: competitor_channel_remove_archived declara o destino do arquivo', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg.end() })
  async function emTx(fn: () => Promise<void>): Promise<void> {
    await pg.query('begin'); await pg.query('select pg_advisory_xact_lock(7339001)')   // TRAVA_DDL_TESTES na 1ª instrução (Yannis R3-1)
    try {
      await garantirComT13(pg)
      await aplicarM2(pg)
      for (let i = 1; i <= 3; i++) {
        await pg.query(`select obs_part.criar_particao(t::regclass, (obs_part.mes_corrente_sp() - make_interval(months => $1))::date)
          from unnest(array['public.competitor_video_daily','public.competitor_video_early','public.competitor_video_hourly']) t`, [i])
      }
      // sem a M10a: ela recria competitor_series_health sem o remendo da pausa e a E10 (competitor_channel_pause) passa a recusar com
      // E10:pausa_sem_remendo — conflito de ordem M10a × E10, da A5, anotado no aviso (aviso-a5-remove-archived-m3b.md)
      await fn()
    } finally { await pg.query('rollback') }
  }

  it('canal COM unidade e canal SEM unidade, removidos pela E10: cada um grava a remoção guardar/e10_export com o xid da transação', async () => {
    await emTx(async () => {
      const c = await semearCena(pg)
      await aplicarM3b(pg, 6)
      expect(await escalar<boolean>(pg, `select prosrc ~ 'pg_partition_tree' and prosrc ~ 'obs_archive_channel_removals' from pg_proc where oid = 'public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure`)).toBe(true)
      await pg.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, hash_conteudo, schema_fp, sha256_bytes, csv_sha256, file_bytes, received_at)
        values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 1, 5, md5('a') || md5('a'), md5('s') || md5('s'), md5('b') || md5('b'), md5('c') || md5('c'), 100, now())`, [c.site, c.canalA])
      for (const [canal, lote, unidades] of [[c.canalA, 'lote-a', 1], [c.canalB, 'lote-b', 0]] as const) {
        await exportarConferirConfirmar(pg, c, canal, lote)
        const r = await escalar<{ status: string }>(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, canal, c.admin])
        expect(r.status).toBe('removido')
        expect(await escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [canal])).toBe(0)
        expect(await q1(pg, `select archive_decision, removed_via, units_at_removal, decided_by = $3::uuid as por_ele, declared_xid = pg_current_xact_id() as xid_desta
                               from public.obs_archive_channel_removals where site_id = $1 and channel_ref = $2`, [c.site, canal, c.admin]))
          .toEqual({ archive_decision: 'guardar', removed_via: 'e10_export', units_at_removal: unidades, por_ele: true, xid_desta: true })
      }
    })
  })

  it('sem a declaração o gatilho recusaria: a recusa da E10 não deixa o canal meio removido (a transação desfaz)', async () => {
    await emTx(async () => {
      const c = await semearCena(pg)
      await aplicarM3b(pg, 6)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-a')
      await pg.query('savepoint s')
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.comum])   // sem direito: nada declarado, nada apagado
      expect(t.ok).toBe(false)
      await pg.query('rollback to savepoint s')
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [c.canalA])).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_removals where site_id = $1`, [c.site])).toBe(0)
    })
  })

  it('o bloco é idempotente e mantém a guarda por folhas (regra 71): segunda aplicação não muda o corpo', async () => {
    await emTx(async () => {
      await semearCena(pg)
      await aplicarM3b(pg, 6)
      const f = `select md5(prosrc) from pg_proc where oid = 'public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure`
      const a = await escalar<string>(pg, f)
      await aplicarM3b(pg, 6)
      expect(await escalar<string>(pg, f)).toBe(a)
      expect(await escalar<boolean>(pg, `select prosrc ~ 'pg_partition_tree' and prosrc ~ 'not c.relispartition' from pg_proc where oid = 'public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure`)).toBe(true)
    })
  })

  it('corpo instalado diferente do conhecido: a M3b recusa em vez de trocar às cegas; o md5 conhecido é o do 11b da M2', async () => {
    await emTx(async () => {
      expect(await escalar<string>(pg, `select md5(prosrc) from pg_proc where oid = 'public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure`)).toBe(MD5_DO_11B)
      expect(M3B_SQL()).toContain(MD5_DO_11B)
      await pg.query(`create or replace function public.competitor_channel_remove_archived(p_site uuid, p_channel uuid, p_actor uuid) returns jsonb language plpgsql security definer set search_path = ''
        as $$ begin /* pg_partition_tree */ delete from public.competitor_channels where id = p_channel; return '{}'::jsonb; end $$`)
      await pg.query('savepoint s')
      const t = await tenta(pg, M3B_SQL())
      expect(t.ok).toBe(false)
      if (!t.ok) expect(t.message).toMatch(/M3b:competitor_channel_remove_archived_divergente/)
      await pg.query('rollback to savepoint s')
    })
  })

  it('o desfazer devolve o corpo do 11b (md5 conhecido), não o remendado (Yannis N5)', async () => {
    await emTx(async () => {
      await semearCena(pg)
      await aplicarM3b(pg, 6)
      const f = `select md5(prosrc) from pg_proc where oid = 'public.competitor_channel_remove_archived(uuid,uuid,uuid)'::regprocedure`
      expect(await escalar<string>(pg, f)).not.toBe(MD5_DO_11B)
      // o arquivo traz begin/commit próprios; dentro da transação do teste só o corpo conta
      await pg.query(readFileSync(M3B_DESFAZER_CAMINHO, 'utf8').replace(/^begin;$/m, '').replace(/^commit;$/m, ''))
      expect(await escalar<string>(pg, f)).toBe(MD5_DO_11B)
      expect(await escalar<boolean>(pg, `select to_regclass('public.obs_archive_channel_removals') is null`)).toBe(true)
    })
  })
})
