// @vitest-environment node
/**
 * A5 · E10 (Tarefa 1): a MG6 (registro de lotes de export, pausa de coleta, sinal de tamanho do banco), função por função,
 * contra Postgres de verdade. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e10-migration.test.ts --no-file-parallelism
 *
 * A MG6 NÃO está aplicada de vez (a migration ainda não existe em `supabase/migrations/`; é do controlador). Cada teste abre uma
 * transação, aplica o ensaio (`test/fixtures/sql/a5-e10-mg6.sql`, helper `garantirMg6`), semeia o SEU site, os SEUS canais e os
 * SEUS usuários e termina em `rollback`: nada fica gravado e nenhum teste supõe a MG6 aplicada (pende aplicação do controlador
 * só o que exige a MG6 permanente: nada aqui). Cada teste só olha para as linhas que ele mesmo criou.
 * Os cenários `aplica duas vezes`, `recusa sem as funções de que depende` e `âncora ausente faz a migration recusar` ficam no
 * roteiro psql (Apêndice B do plano: `.superpowers/sdd/a5-e10/mg6-prova.sql`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { TABELAS_COM_IDENTIDADE } from '@/lib/youtube/observatorio/arquivo/cli'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  MG6_FIXTURE, emTransacao, tenta, codigoE10, q1, escalar, semearCena, criarSite, criarUsuario, criarCanal, criarVideo,
  semearDadosDoVideo, tabelasComIdentidade, pausarEEnvelhecer, registrar, exportarConferirConfirmar, provasDasQuatro, contagemPorTabela, manifestoDoCanal,
  type Cena,
} from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** As tabelas do registro que podem não existir no banco (MG4 e MG18 de outras etapas). */
const DE_OUTRAS_ETAPAS = ['competitor_video_marks', 'competitor_video_mark_misses', 'competitor_missing_baseline']

const FUNCOES_17 = [
  'obs_db_size_record', 'obs_archive_is_site_admin', 'competitor_channel_pause_covers', 'competitor_channel_pause', 'competitor_channel_unpause',
  'obs_archive_registry', 'obs_archive_excluded', 'obs_archive_uncovered', 'obs_archive_channel_counts', 'obs_archive_diff',
  'obs_archive_register', 'obs_archive_guard', 'obs_archive_verify', 'obs_archive_confirm_nas', 'competitor_channel_remove_archived',
  'obs_archive_blobs_done', 'competitor_archive_suggestions',
]

describe.skipIf(skipIfNoLocalDb())('A5 E10 Tarefa 1: a MG6, função por função (banco local, ensaio dentro de transação desfeita)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* sem transação aberta */ }
    await pg.end()
  })

  const dentro = <T>(fn: () => Promise<T>): Promise<T> => emTransacao(pg, fn)
  /** Chama algo que tem de ser recusado pela regra da E10 e devolve o código `E10:<codigo>`. */
  async function recusa(sql: string, params: unknown[] = []): Promise<string> {
    const t = await tenta(pg, sql, params)
    if (t.ok) throw new Error(`devia recusar: ${sql.slice(0, 90)}`)
    return codigoE10(t.message) ?? `fora-da-E10:${t.code}:${t.message.slice(0, 80)}`
  }
  const total = (canal: string): Promise<number> => escalar<number>(pg, `select coalesce(sum(row_count), 0)::int from public.obs_archive_channel_counts($1)`, [canal])
  const existe = (canal: string): Promise<number> => escalar<number>(pg, `select count(*)::int from public.competitor_channels where id = $1`, [canal])

  // ───────────────────────── aplicação ─────────────────────────

  it('aplicada: V1 e V2', async () => {
    await dentro(async () => {
      const v1 = await q1(pg, `select
        (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('obs_archive_batches','competitor_collection_pauses','obs_db_size_daily'))::int as tabelas_rls,
        (select count(*) from pg_policies where schemaname = 'public' and tablename in ('obs_archive_batches','competitor_collection_pauses','obs_db_size_daily') and cmd = 'SELECT')::int as policies,
        (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_channels' and column_name in ('collection_paused_at','collection_paused_by'))::int as colunas,
        (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1::text[])
            and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))::int as so_service_role,
        (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
            and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health') and p.prosrc like '%competitor_channel_pause_covers%')::int as remendadas,
        (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
            and p.proname in ('competitor_series_health','competitor_hourly_health','competitor_comment_due','competitor_comment_health')
            and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))::int as remendadas_com_grant,
        (select p.prosrc !~* 'delete' from pg_proc p where p.oid = 'public.yt_reporting_blobs_purge(text[])'::regprocedure) as bruto_sem_delete,
        (has_table_privilege('anon', 'public.obs_db_size_daily', 'select') or has_table_privilege('authenticated', 'public.obs_archive_batches', 'insert')
          or has_table_privilege('authenticated', 'public.competitor_collection_pauses', 'delete')) as privilegio_indevido`, [FUNCOES_17])
      expect([v1.tabelas_rls, v1.policies, v1.colunas, v1.so_service_role, v1.remendadas, v1.remendadas_com_grant, v1.bruto_sem_delete, v1.privilegio_indevido])
        .toEqual([3, 3, 2, 17, 4, 4, true, false])
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_registry()`)).toBe(22)
      const ausentes = await pg.query(`select r.table_name from public.obs_archive_registry() r where to_regclass('public.' || r.table_name) is null`)
      for (const l of ausentes.rows as { table_name: string }[]) expect(DE_OUTRAS_ETAPAS).toContain(l.table_name)
    })
  })

  // ───────────────────────── tamanho do banco ─────────────────────────

  it('tamanho: grava uma linha por dia e regrava no mesmo dia', async () => {
    await dentro(async () => {
      const agora = new Date(Date.now() - 400 * 86_400_000).toISOString()
      await pg.query(`select public.obs_db_size_record($1::timestamptz)`, [agora])
      await pg.query(`select public.obs_db_size_record($1::timestamptz)`, [agora])
      const l = await pg.query(`select db_bytes, competitor_bytes, own_bytes, jsonb_typeof(top_relations) as tipo from public.obs_db_size_daily where measured_at = $1::timestamptz`, [agora])
      expect(l.rows).toHaveLength(1)
      const r = l.rows[0] as { db_bytes: string; competitor_bytes: string; own_bytes: string; tipo: string }
      expect(Number(r.db_bytes)).toBeGreaterThan(0)
      expect(Number(r.db_bytes)).toBeGreaterThanOrEqual(Number(r.competitor_bytes) + Number(r.own_bytes))
      expect(r.tipo).toBe('object')
    })
  })

  it('tamanho: dois dias, duas linhas, com os dias de São Paulo certos', async () => {
    await dentro(async () => {
      // 05:10 de São Paulo = 08:10 UTC: o dia de São Paulo é o do próprio instante UTC
      const d0 = '2025-03-10T08:10:00Z'
      const d1 = '2025-03-11T08:10:00Z'
      await pg.query(`select public.obs_db_size_record($1::timestamptz)`, [d0])
      await pg.query(`select public.obs_db_size_record($1::timestamptz)`, [d1])
      const r = await pg.query(`select day::text from public.obs_db_size_daily where day in ('2025-03-10', '2025-03-11') order by 1`)
      expect(r.rows.map((x: { day: string }) => x.day)).toEqual(['2025-03-10', '2025-03-11'])
      // 01:00 UTC ainda é o dia anterior em São Paulo (UTC-3)
      await pg.query(`select public.obs_db_size_record('2025-03-12T01:00:00Z'::timestamptz)`)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_db_size_daily where day = '2025-03-11' and measured_at = '2025-03-12T01:00:00Z'`)).toBe(1)
    })
  })

  it('tamanho: p_now nulo lança 22023 e não grava', async () => {
    await dentro(async () => {
      const antes = await escalar<number>(pg, `select count(*)::int from public.obs_db_size_daily`)
      const t = await tenta(pg, `select public.obs_db_size_record(null)`)
      expect(t.ok).toBe(false)
      if (!t.ok) { expect(t.code).toBe('22023'); expect(codigoE10(t.message)).toBe('parametro_nulo') }
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_db_size_daily`)).toBe(antes)
    })
  })

  // ───────────────────────── pausa ─────────────────────────

  it('pausar: quem não administra não pausa', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      expect(await recusa(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.comum])).toBe('sem_direito')
      expect(await escalar<string | null>(pg, `select collection_paused_at::text from public.competitor_channels where id = $1`, [c.canalA])).toBeNull()
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where competitor_channel_id = $1`, [c.canalA])).toBe(0)
    })
  })

  it('pausar: canal de outro site não é pausado', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const x = await criarSite(pg)
      const adminX = await criarUsuario(pg)
      await pg.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [x.org, adminX])
      expect(await recusa(`select public.competitor_channel_pause($1, $2, $3)`, [x.site, c.canalA, adminX])).toBe('canal_nao_encontrado')
      expect(await escalar<string | null>(pg, `select collection_paused_at::text from public.competitor_channels where id = $1`, [c.canalA])).toBeNull()
    })
  })

  it('pausar duas vezes: pausado e depois ja_pausado, uma pausa aberta', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const um = await escalar<string>(pg, `select public.competitor_channel_pause($1, $2, $3) ->> 'status'`, [c.site, c.canalA, c.admin])
      const dois = await escalar<string>(pg, `select public.competitor_channel_pause($1, $2, $3) ->> 'status'`, [c.site, c.canalA, c.admin])
      expect([um, dois]).toEqual(['pausado', 'ja_pausado'])
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where competitor_channel_id = $1 and resumed_at is null`, [c.canalA])).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where competitor_channel_id = $1`, [c.canalA])).toBe(1)
    })
  })

  it('pausar recusa quando uma função perdeu o remendo (pausa_sem_remendo)', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      // recria competitor_hourly_health sem a chamada da pausa (tudo dentro da transação, que termina em rollback)
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.competitor_hourly_health(uuid,timestamptz,integer,integer)'::regprocedure)`)
      const sem = def.replace(/and not public\.competitor_channel_pause_covers\(c\.id, p_now, interval '26 hours'\)/, '')
      expect(sem).not.toContain('competitor_channel_pause_covers')
      await pg.query(sem)
      const t = await tenta(pg, `select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) { expect(codigoE10(t.message)).toBe('pausa_sem_remendo'); expect(t.message).toContain('competitor_hourly_health') }
      expect(await escalar<string | null>(pg, `select collection_paused_at::text from public.competitor_channels where id = $1`, [c.canalA])).toBeNull()
    })
  })

  it('pausa tira o canal das quatro funções (e o canal B não é afetado)', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const antesA = await provasDasQuatro(pg, c, c.canalA)
      const antesB = await provasDasQuatro(pg, c, c.canalB)
      expect(antesA.lista).toBeGreaterThanOrEqual(2) // vídeo de A e vídeo de B, no mesmo site
      expect(antesA.due).toBe(1)
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const depoisA = await provasDasQuatro(pg, c, c.canalA)
      const depoisB = await provasDasQuatro(pg, c, c.canalB)
      expect(antesA.lista - depoisA.lista).toBe(1) // o vídeo de A saiu da lista horária
      expect(depoisA.due).toBe(0) // a fila de comentários não devolve vídeo de A
      expect(antesA.atrasados - depoisA.atrasados).toBe(1) // retratos atrasados caem
      expect(depoisA.fora - antesA.fora).toBe(2) // os dois vídeos de A passam a "fora da prova"
      // canal B: o mesmo, lendo B, não muda (due é do canal pedido)
      expect(depoisB.due).toBe(antesB.due)
    })
  })

  it('despausar: a fila de comentários volta, as provas esperam a cauda; 8 dias depois tudo volta', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const antes = await provasDasQuatro(pg, c, c.canalA)
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      await pg.query(`select public.competitor_channel_unpause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const agora = await provasDasQuatro(pg, c, c.canalA)
      expect(agora.due).toBe(antes.due) // cauda de comentários é zero: a fila volta na hora
      expect(agora.lista).toBe(antes.lista - 1) // a leitura horária ainda o deixa fora (cauda de 26 horas)
      expect(agora.fora).toBeGreaterThan(antes.fora) // a série ainda o deixa fora (cauda de 3 dias)
      const depois = await provasDasQuatro(pg, c, c.canalA, 'daqui_a_8_dias')
      const base = await q1(pg, `select (public.competitor_series_health($1, clock_timestamp() + interval '8 days') ->> 'fora_da_prova')::int as fora`, [c.site])
      expect(Number(base.fora)).toBe(depois.fora)
      // com a pausa encerrada há 8 dias (cauda de 7 dias) a pausa já não cobre
      expect(await escalar<boolean>(pg, `select public.competitor_channel_pause_covers($1, clock_timestamp() + interval '8 days', interval '7 days')`, [c.canalA])).toBe(false)
      expect(await escalar<boolean>(pg, `select public.competitor_channel_pause_covers($1, clock_timestamp(), interval '3 days')`, [c.canalA])).toBe(true)
      expect(await escalar<boolean>(pg, `select public.competitor_channel_pause_covers($1, clock_timestamp(), interval '0')`, [c.canalA])).toBe(false)
    })
  })

  it('despausar invalida a conferência e encerra o lote com o motivo "despausado"', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const reg = await registrar(pg, c, c.canalA, 'lote-um')
      await pg.query(`select public.obs_archive_verify($1, 'lote-um', $2)`, [c.site, c.canalA])
      const n = Number(reg.arquivos)
      const r = await q1(pg, `select public.competitor_channel_unpause($1, $2, $3) as r`, [c.site, c.canalA, c.admin])
      expect((r.r as { arquivos_invalidados: number }).arquivos_invalidados).toBe(n)
      const l = await q1(pg, `select count(*)::int as n, count(verified_at)::int as conferidos, count(closed_at)::int as encerrados,
        count(*) filter (where closed_reason = 'despausado')::int as despausados from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      expect([l.n, l.conferidos, l.encerrados, l.despausados]).toEqual([n, 0, n, n])
      // um lote que nunca foi conferido também é encerrado, mas arquivos_invalidados conta só os que tinham conferência
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1 and resumed_at is null`, [c.canalA])
      await registrar(pg, c, c.canalA, 'lote-dois')
      const r2 = await q1(pg, `select public.competitor_channel_unpause($1, $2, $3) as r`, [c.site, c.canalA, c.admin])
      expect((r2.r as { arquivos_invalidados: number }).arquivos_invalidados).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where batch = 'lote-dois' and closed_reason = 'despausado'`)).toBe(n)
      // reexportar com o mesmo nome regrava o lote com closed_at nulo
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1 and resumed_at is null`, [c.canalA])
      await registrar(pg, c, c.canalA, 'lote-dois')
      expect(await escalar<number>(pg, `select count(closed_at)::int from public.obs_archive_batches where batch = 'lote-dois'`)).toBe(0)
    })
  })

  // ───────────────────────── registro ─────────────────────────

  it('registro: recusa não pausado, pausa recente e sincronizando', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const j = await manifestoDoCanal(pg, c.canalA)
      const reg = (): Promise<string> => recusa(`select public.obs_archive_register($1, 'lote-x', $2, $3::jsonb)`, [c.site, c.canalA, j])
      expect(await reg()).toBe('nao_pausado')
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(await reg()).toBe('pausa_recente')
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1`, [c.canalA])
      await pg.query(`update public.competitor_channels set sync_status = 'syncing', sync_started_at = now() - interval '1 minute' where id = $1`, [c.canalA])
      expect(await reg()).toBe('sincronizando')
      await pg.query(`update public.competitor_channels set sync_status = 'idle', sync_started_at = null where id = $1`, [c.canalA])
      // o manifesto novo: a pausa acabou de criar uma linha em competitor_collection_pauses, que o arquivo também tem de ter
      const ok = await q1(pg, `select public.obs_archive_register($1, 'lote-x', $2, $3::jsonb) as r`, [c.site, c.canalA, await manifestoDoCanal(pg, c.canalA)])
      expect((ok.r as { status: string }).status).toBe('exportado')
    })
  })

  it('registro: recusa arquivo que não bate e não grava nada', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      const lista = JSON.parse(await manifestoDoCanal(pg, c.canalA)) as { row_count: number }[]
      lista[0]!.row_count = 999
      expect(await recusa(`select public.obs_archive_register($1, 'lote-x', $2, $3::jsonb)`, [c.site, c.canalA, JSON.stringify(lista)])).toBe('banco_difere_do_manifesto')
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])).toBe(0)
    })
  })

  it('registro: reexportar zera a conferência e a confirmação', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      expect(await escalar<number>(pg, `select count(nas_confirmed_at)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])).toBeGreaterThan(0)
      await registrar(pg, c, c.canalA, 'lote-x')
      const l = await q1(pg, `select count(*)::int as n, count(verified_at)::int as conferidos, count(nas_confirmed_at)::int as confirmados from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      expect([l.conferidos, l.confirmados]).toEqual([0, 0])
      expect(Number(l.n)).toBeGreaterThan(0)
    })
  })

  it('registro: recusa com tarefa da forja em execução e registra depois que ela termina', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      await pg.query(`insert into public.youtube_niches (site_id, slug, label, color_dark, color_light) values ($1, 'sintetico', 'Sintético', '#AAB4C0', '#4B5563')`, [c.site])
      const tarefa = (await q1(pg,
        `insert into public.youtube_intelligence_tasks (site_id, task_type, target_niche, target_video_id, trigger_type, status)
         values ($1, 'leitura-video', 'sintetico', $2, 'manual', 'running') returning id`, [c.site, c.videoA])).id
      const j = await manifestoDoCanal(pg, c.canalA)
      expect(await recusa(`select public.obs_archive_register($1, 'lote-x', $2, $3::jsonb)`, [c.site, c.canalA, j])).toBe('forja_em_andamento')
      await pg.query(`update public.youtube_intelligence_tasks set status = 'completed' where id = $1`, [tarefa])
      const j2 = await manifestoDoCanal(pg, c.canalA)
      const ok = await q1(pg, `select public.obs_archive_register($1, 'lote-x', $2, $3::jsonb) as r`, [c.site, c.canalA, j2])
      expect((ok.r as { status: string }).status).toBe('exportado')
    })
  })

  it('ordem dos passos: confirmar e remover antes de conferir, remover antes de confirmar', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      await registrar(pg, c, c.canalA, 'lote-x')
      const antes = await total(c.canalA)
      expect(await recusa(`select public.obs_archive_confirm_nas($1, 'lote-x', $2, $3)`, [c.site, c.canalA, c.admin])).toBe('lote_nao_conferido')
      expect(await recusa(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])).toBe('lote_nao_conferido')
      await pg.query(`select public.obs_archive_verify($1, 'lote-x', $2)`, [c.site, c.canalA])
      expect(await recusa(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])).toBe('lote_nao_confirmado')
      expect(await existe(c.canalA)).toBe(1)
      expect(await total(c.canalA)).toBe(antes)
    })
  })

  it('confirmar: quem não administra não confirma', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      await registrar(pg, c, c.canalA, 'lote-x')
      await pg.query(`select public.obs_archive_verify($1, 'lote-x', $2)`, [c.site, c.canalA])
      expect(await recusa(`select public.obs_archive_confirm_nas($1, 'lote-x', $2, $3)`, [c.site, c.canalA, c.comum])).toBe('sem_direito')
      expect(await escalar<number>(pg, `select count(nas_confirmed_at)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])).toBe(0)
    })
  })

  // ───────────────────────── remoção ─────────────────────────

  it('remoção recusa com linha nova depois do export', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      const antes = await contagemPorTabela(pg, c.canalA)
      await pg.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date + 400, 5, now())`, [c.videoA])
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) { expect(codigoE10(t.message)).toBe('banco_difere_do_manifesto'); expect(t.message).toContain('competitor_video_daily') }
      expect(await existe(c.canalA)).toBe(1)
      const depois = await contagemPorTabela(pg, c.canalA)
      expect(depois.competitor_video_daily).toBe(antes.competitor_video_daily! + 1)
      expect({ ...depois, competitor_video_daily: 0 }).toEqual({ ...antes, competitor_video_daily: 0 })
    })
  })

  it('remoção recusa com o canal despausado e pausado de novo', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      await pg.query(`select public.competitor_channel_unpause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(await recusa(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])).toBe('despausado_depois_do_export')
      expect(await recusa(`select public.obs_archive_verify($1, 'lote-x', $2)`, [c.site, c.canalA])).toBe('despausado_depois_do_export')
      expect(await existe(c.canalA)).toBe(1)
    })
  })

  it('remoção recusa com tabela nova em cascata (tabela_sem_export)', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      await pg.query(`create table public.zz_e10_cascata (id bigint generated always as identity primary key, video_id uuid not null references public.competitor_videos(id) on delete cascade)`)
      await pg.query(`insert into public.zz_e10_cascata (video_id) values ($1)`, [c.videoA])
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual(['zz_e10_cascata'])
      const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(t.ok).toBe(false)
      if (!t.ok) { expect(codigoE10(t.message)).toBe('tabela_sem_export'); expect(t.message).toContain('zz_e10_cascata') }
      expect(await existe(c.canalA)).toBe(1)
      expect(await escalar<number>(pg, `select count(*)::int from public.zz_e10_cascata`)).toBe(1)
    })
  })

  // (revisão Phil 14/10, I-2) A remoção se conferia só com o registro que ela mesma usa: um filtro errado dava verde nas três conferências.
  // A guarda independente conta, pelo próprio Postgres (pg_stat_xact_user_tables), quantas linhas cada tabela do fecho perdeu na
  // transação e exige igual ao que o lote arquivou. Aqui o registro é QUEBRADO de propósito (filtro que devolve zero linha), o lote
  // nasce sem aquela tabela, as três conferências do registro passam, e só a guarda sabe.
  it('a guarda independente: filtro quebrado em QUALQUER entrada do registro faz a remoção parar com apagou_alem_do_arquivo, e nada é apagado', async () => {
    const nomes = (await pg.query(`select table_name from (values ${[
      'competitor_channels', 'competitor_collection_pauses', 'competitor_channel_snapshots', 'competitor_channel_hour_map', 'competitor_videos',
      'competitor_field_versions', 'competitor_raw', 'competitor_video_versions', 'competitor_changes', 'competitor_video_tier_spans', 'competitor_video_daily',
      'competitor_video_early', 'competitor_video_hourly', 'competitor_hour_fold_log', 'competitor_video_comment_snaps', 'competitor_video_comments',
      'competitor_video_comment_marks', 'competitor_readings', 'youtube_intelligence_tasks'].map(n => `('${n}')`).join(', ')}) v(table_name)`)).rows.map((r: { table_name: string }) => r.table_name)
    expect(nomes).toHaveLength(19)
    const falhas: string[] = []
    for (const tabela of nomes) {
      await dentro(async () => {
        const c = await semearCena(pg)
        const def = await escalar<string>(pg, `select pg_get_functiondef('public.obs_archive_registry()'::regprocedure)`)
        const quebrado = def.replace(new RegExp(`\\('${tabela}',(\\s*)'([^']*)'`), (_m, esp: string, filtro: string) => `('${tabela}',${esp}'(${filtro}) and $1 is null'`)
        expect(quebrado, `o registro de ${tabela} não foi encontrado para quebrar`).not.toBe(def)
        await pg.query(quebrado)
        await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x') // as três conferências do registro passam: o lote simplesmente não tem a tabela
        const antes = await existe(c.canalA)
        const t = await tenta(pg, `select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
        const codigo = t.ok ? 'removeu' : (codigoE10(t.message) ?? `fora-da-E10:${t.code}`)
        if (codigo !== 'apagou_alem_do_arquivo') falhas.push(`${tabela}: ${codigo}`)
        else {
          expect(t.ok ? '' : t.message, tabela).toContain(tabela)
          expect(await existe(c.canalA)).toBe(antes) // a transação da função desfez: o canal continua
          expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where channel_ref = $1 and deleted_at is not null`, [c.canalA])).toBe(0)
        }
      })
    }
    expect(falhas).toEqual([])
  })

  it('a guarda independente não atrapalha a remoção correta, e a exclusão declarada (autores) não conta', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { status: string }
      expect(r.status).toBe('removido')
      expect(await existe(c.canalA)).toBe(0)
    })
  })

  it('remoção com lote confirmado: apaga A, marca os arquivos, audita uma vez e o registro continua', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      const linhas = await total(c.canalA)
      const arquivos = await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as
        { status: string; batch: string; arquivos: number; linhas: number; blob_urls: string[] }
      expect(r.status).toBe('removido')
      expect([r.batch, r.arquivos, Number(r.linhas)]).toEqual(['lote-x', arquivos, linhas])
      expect(r.blob_urls).toHaveLength(2)
      expect(await existe(c.canalA)).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_counts($1)`, [c.canalA])).toBe(0)
      const l = await q1(pg, `select count(*)::int as n, count(*) filter (where deleted_at is not null and rows_deleted = row_count)::int as marcados, sum(rows_deleted)::int as soma
        from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      expect([l.n, l.marcados, l.soma]).toEqual([arquivos, arquivos, linhas])
      const aud = await pg.query(`select actor_user_id from public.audit_log where action = 'observatorio_canal_removido_com_arquivo' and resource_id = $1`, [c.canalA])
      expect(aud.rows).toHaveLength(1)
      expect(aud.rows[0]!.actor_user_id).toBe(c.admin)
      // as miniaturas pendentes ficam na linha do canal; o registro do lote continua online
      expect(await escalar<number>(pg, `select cardinality(blob_urls_pending)::int from public.obs_archive_batches where channel_ref = $1 and table_name = 'competitor_channels'`, [c.canalA])).toBe(2)
    })
  })

  it('remoção não toca o canal B (exceto o destaque de comentário de B que apontava para A)', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const tabelas = (await pg.query(`select table_name, filter_sql from public.obs_archive_registry() where to_regclass('public.' || table_name) is not null`)).rows as { table_name: string; filter_sql: string }[]
      const foto = async (): Promise<Record<string, { n: number; md5: string }>> => {
        const out: Record<string, { n: number; md5: string }> = {}
        for (const t of tabelas) {
          const r = await q1(pg, `select count(*)::int as n, coalesce(md5(string_agg(t::text, '|' order by t::text)), '') as md5 from public.${t.table_name} t where ${t.filter_sql}`, [c.canalB])
          out[t.table_name] = { n: Number(r.n), md5: String(r.md5) }
        }
        return out
      }
      const antes = await foto()
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { featured_refs_cleared: number }
      expect(r.featured_refs_cleared).toBe(1)
      const depois = await foto()
      for (const t of tabelas) {
        expect(depois[t.table_name]!.n, `linhas de B em ${t.table_name}`).toBe(antes[t.table_name]!.n)
        if (t.table_name !== 'competitor_video_comments') expect(depois[t.table_name]!.md5, `conteúdo de B em ${t.table_name}`).toBe(antes[t.table_name]!.md5)
      }
      expect(depois.competitor_video_comments!.md5).not.toBe(antes.competitor_video_comments!.md5)
      expect(await escalar<string | null>(pg, `select featured_channel_id::text from public.competitor_video_comments where id = $1`, [c.comentarioDeBQueApontaParaA])).toBeNull()
    })
  })

  it('remoção com o site errado: canal_nao_encontrado e nada apagado', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      const x = await criarSite(pg)
      const adminX = await criarUsuario(pg)
      const antes = await total(c.canalA)
      expect(await recusa(`select public.competitor_channel_remove_archived($1, $2, $3)`, [x.site, c.canalA, adminX])).toBe('canal_nao_encontrado')
      expect(await existe(c.canalA)).toBe(1)
      expect(await total(c.canalA)).toBe(antes)
    })
  })

  it('dois canais no mesmo nome de lote: remover A só marca os arquivos de A', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-comum')
      await exportarConferirConfirmar(pg, c, c.canalB, 'lote-comum')
      await pg.query(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const a = await q1(pg, `select count(*)::int as n, count(deleted_at)::int as apagados from public.obs_archive_batches where channel_ref = $1`, [c.canalA])
      const b = await q1(pg, `select count(*)::int as n, count(deleted_at)::int as apagados from public.obs_archive_batches where channel_ref = $1`, [c.canalB])
      expect(a.apagados).toBe(a.n)
      expect(b.apagados).toBe(0)
      const v = await q1(pg, `select public.obs_archive_verify($1, 'lote-comum', $2) as r`, [c.site, c.canalB])
      expect((v.r as { status: string }).status).toBe('conferido')
    })
  })

  it('blobs_done tira só o que foi apagado do Blob', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      // a semente do vídeo já deixa 2 miniaturas em A; mais uma no segundo vídeo faz 3
      await pg.query(`insert into public.competitor_video_versions (video_id, field, value_hash, precision, first_seen_at, last_seen_at, thumb_blob_url, is_current)
        values ($1, 'thumb', 'h3', '1d', now() - interval '5 days', now() - interval '4 days', 'https://blob.example.test/terceira.jpg', true)`, [c.videoA2])
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { blob_urls: string[] }
      expect(r.blob_urls).toHaveLength(3)
      const restam = await escalar<number>(pg, `select public.obs_archive_blobs_done($1, 'lote-x', $2, $3::text[])`, [c.site, c.canalA.toString(), r.blob_urls.slice(0, 2)])
      expect(restam).toBe(1)
      const pend = await escalar<string[]>(pg, `select blob_urls_pending from public.obs_archive_batches where channel_ref = $1 and table_name = 'competitor_channels'`, [c.canalA])
      expect(pend).toEqual([r.blob_urls[2]])
    })
  })

  // ───────────────────────── sugestões ─────────────────────────

  async function siteComTresCanais(): Promise<{ site: string; parado: string; ativo: string; vazio: string }> {
    const { site } = await criarSite(pg)
    const parado = await criarCanal(pg, site, 'Parado')
    const ativo = await criarCanal(pg, site, 'Ativo')
    const vazio = await criarCanal(pg, site, 'Sem vídeo')
    await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, 'p1', now() - interval '13 months'), ($2, 'a1', now() - interval '1 day')`, [parado, ativo])
    return { site, parado, ativo, vazio }
  }

  it('sugestões: canal parado aparece, canal ativo não, canal sem vídeo é contado à parte', async () => {
    await dentro(async () => {
      const s = await siteComTresCanais()
      const r = (await q1(pg, `select public.competitor_archive_suggestions($1, now(), 12) as r`, [s.site])).r as
        { canais_avaliados: number; canais_sem_video: number; sugestoes: { channel_row_id: string; videos: number }[] }
      expect(r.canais_avaliados).toBe(3)
      expect(r.canais_sem_video).toBe(1)
      expect(r.sugestoes.map(x => x.channel_row_id)).toEqual([s.parado])
      expect(r.sugestoes[0]!.videos).toBe(1)
    })
  })

  it('sugestões: fronteira de 12 meses (um dia a menos fica fora, um dia a mais entra)', async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      const canal = await criarCanal(pg, site)
      const ids = async (): Promise<string[]> => {
        const r = (await q1(pg, `select public.competitor_archive_suggestions($1, now(), 12) as r`, [site])).r as { sugestoes: { channel_row_id: string }[] }
        return r.sugestoes.map(x => x.channel_row_id)
      }
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, 'f1', now() - interval '12 months' + interval '1 day')`, [canal])
      expect(await ids()).toEqual([])
      await pg.query(`update public.competitor_videos set published_at = now() - interval '12 months' - interval '1 day' where competitor_channel_id = $1`, [canal])
      expect(await ids()).toEqual([canal])
    })
  })

  it('sugestões: parâmetro nulo ou meses menor que 1 devolve nulo, não lista vazia', async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      expect(await escalar<unknown>(pg, `select public.competitor_archive_suggestions(null, now(), 12)`)).toBeNull()
      expect(await escalar<unknown>(pg, `select public.competitor_archive_suggestions($1, null, 12)`, [site])).toBeNull()
      expect(await escalar<unknown>(pg, `select public.competitor_archive_suggestions($1, now(), 0)`, [site])).toBeNull()
      expect(await escalar<unknown>(pg, `select public.competitor_archive_suggestions($1, now(), null)`, [site])).toBeNull()
    })
  })

  it('sugestões não mudam nada e trazem a última leitura boa (last_ok_synced_at nulo ou datado)', async () => {
    await dentro(async () => {
      const s = await siteComTresCanais()
      // outro canal parado com leitura de ontem
      const outro = await criarCanal(pg, s.site, 'Parado com leitura')
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, 'p2', now() - interval '14 months')`, [outro])
      await pg.query(`update public.competitor_channels set last_ok_synced_at = now() - interval '1 day' where id = $1`, [outro])
      const tabelas = (await pg.query(`select table_name, filter_sql from public.obs_archive_registry() where to_regclass('public.' || table_name) is not null`)).rows as { table_name: string; filter_sql: string }[]
      const contar = async (): Promise<number[]> => {
        const out: number[] = []
        for (const t of tabelas) out.push(Number((await q1(pg, `select count(*)::int as n from public.${t.table_name} t where ${t.filter_sql}`, [s.parado])).n))
        return out
      }
      const antes = await contar()
      const r = (await q1(pg, `select public.competitor_archive_suggestions($1, now(), 12) as r`, [s.site])).r as { sugestoes: { channel_row_id: string; last_ok_synced_at: string | null }[] }
      const por = Object.fromEntries(r.sugestoes.map(x => [x.channel_row_id, x.last_ok_synced_at]))
      expect(por[s.parado]).toBeNull()
      expect(por[outro]).not.toBeNull()
      expect(await contar()).toEqual(antes)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where site_id = $1`, [s.site])).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where site_id = $1`, [s.site])).toBe(0)
    })
  })

  // ───────────────────────── limpeza do bruto, registro e catálogo ─────────────────────────

  it('limpeza do bruto não apaga nada (a MG6 não a toca: devolve 0)', async () => {
    await dentro(async () => {
      const { site } = await criarSite(pg)
      const n = randomUUID().replace(/-/g, '')
      const canal = (await q1(pg, `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
        values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + n.slice(0, 20), '@t' + n.slice(0, 8), 'UU' + n.slice(0, 20), 'teste-' + n.slice(0, 8)])).id
      const relatorio = async (id: string, normalizado: boolean): Promise<void> => {
        await pg.query(`insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, downloaded_at, normalized_at)
          values ($1, $2, 'job', $3, 'tipo', now() - interval '401 days', now() - interval '400 days', now() - interval '400 days', 'https://example.test/x', 'baixado', now() - interval '400 days', $4)`,
          [id, site, canal, normalizado ? new Date(Date.now() - 400 * 86_400_000).toISOString() : null])
        await pg.query(`insert into public.yt_reporting_report_blobs (report_id, site_id, csv_gz) values ($1, $2, '\\x00')`, [id, site])
      }
      // um bruto normalizado há 400 dias e outro, sem normalizador, baixado há 400 dias
      await relatorio('e10-' + randomUUID(), true)
      await relatorio('e10-' + randomUUID(), false)
      expect(await escalar<number>(pg, `select public.yt_reporting_blobs_purge(array['x'])`)).toBe(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.yt_reporting_report_blobs where site_id = $1`, [site])).toBe(2)
    })
  })

  it('colunas de mês do registro são not null', async () => {
    await dentro(async () => {
      const reg = (await pg.query(`select table_name, period_sql from public.obs_archive_registry() where period_sql is not null and to_regclass('public.' || table_name) is not null`)).rows as { table_name: string; period_sql: string }[]
      expect(reg.length).toBeGreaterThan(5)
      for (const r of reg) {
        const colunas = [...r.period_sql.matchAll(/\bt\.([a-z_]+)/g)].map(m => m[1]!)
        expect(colunas.length, r.table_name).toBeGreaterThan(0)
        for (const col of colunas) {
          const nul = await pg.query(`select is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`, [r.table_name, col])
          expect(nul.rows, `${r.table_name}.${col} existe`).toHaveLength(1)
          expect(nul.rows[0]!.is_nullable, `${r.table_name}.${col} é not null`).toBe('NO')
        }
      }
    })
  })

  it('o registro e o catálogo concordam: nada sem export, e cada consulta montada roda', async () => {
    await dentro(async () => {
      expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      const reg = (await pg.query(`select * from public.obs_archive_registry() where to_regclass('public.' || table_name) is not null`)).rows as
        { table_name: string; filter_sql: string; period_sql: string | null; sum_sql: string | null; order_sql: string }[]
      const canal = randomUUID()
      for (const r of reg) {
        const t = await tenta(pg, `select ${r.period_sql ?? 'null'}, ${r.sum_sql ?? 'null'} from public.${r.table_name} t where ${r.filter_sql} order by ${r.order_sql} limit 1`, [canal])
        expect(t.ok, `${r.table_name}: ${t.ok ? '' : t.message}`).toBe(true)
      }
    })
  })

  it('a cascata não apaga nada fora do arquivo (a única prova que conta a tabela inteira, num retrato só)', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      // fecho de cascata tirado do CATÁLOGO (não do registro): todas as tabelas que somem com o canal
      const fecho = (await pg.query(`
        with recursive alvo (rel) as (
          select 'public.competitor_channels'::regclass::oid
          union
          select k.conrelid from pg_constraint k join alvo a on k.confrelid = a.rel where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid)
        select c.relname::text as nome from alvo a join pg_class c on c.oid = a.rel join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' order by 1`)).rows as { nome: string }[]
      const totais = async (): Promise<Record<string, number>> => {
        const out: Record<string, number> = {}
        for (const t of fecho) out[t.nome] = Number((await q1(pg, `select count(*)::int as n from public.${t.nome}`)).n)
        return out
      }
      const doLote = Object.fromEntries((await pg.query(`select table_name, sum(row_count)::int as n from public.obs_archive_batches where channel_ref = $1 group by 1`, [c.canalA])).rows
        .map((x: { table_name: string; n: number }) => [x.table_name, Number(x.n)]))
      const autoresDeA = await escalar<number>(pg, `select count(*)::int from public.competitor_video_comment_authors a join public.competitor_video_comments k on k.id = a.comment_id where k.competitor_channel_id = $1 or k.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)`, [c.canalA])
      expect(autoresDeA).toBe(1)
      const antes = await totais()
      // (revisão Phil 14/10, I-1) o teste não pode passar vazio: toda tabela do fecho tem linha antes de remover (contava 0 com 0 em dez tabelas).
      // Só as da MG4 e da MG18, que ainda não existem neste banco, ficam sem semente.
      const semSemente = ['competitor_video_marks', 'competitor_video_mark_misses', 'competitor_missing_baseline']
      for (const t of fecho) if (!semSemente.includes(t.nome)) expect(antes[t.nome], `tabela ${t.nome}: a semente tem de pôr linha do canal A`).toBeGreaterThan(0)
      for (const t of fecho) if (!semSemente.includes(t.nome)) expect(doLote[t.nome] ?? (t.nome === 'competitor_video_comment_authors' ? autoresDeA : 0), `tabela ${t.nome}: o lote tem de ter linha`).toBeGreaterThan(0)
      await pg.query(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      const depois = await totais()
      for (const t of fecho) {
        const apagadas = antes[t.nome]! - depois[t.nome]!
        const esperado = t.nome === 'competitor_video_comment_authors' ? autoresDeA : (doLote[t.nome] ?? 0)
        expect(apagadas, `tabela ${t.nome}: apagadas pela cascata x linhas do lote`).toBe(esperado)
      }
    }, 'repeatable read') // as duas contagens da tabela inteira saem do MESMO retrato: linha de outro agente não entra
  })

  // (revisão Phil 14/10, I-3) A recarga imprime um `\\copy` por arquivo do manifesto, na ordem do registro. Com `youtube_intelligence_tasks` DEPOIS de
  // `competitor_readings`, toda leitura ligada a uma tarefa quebrava a chave estrangeira na hora do `\\copy`: o arquivo existia e o caminho de volta não fechava.
  it('a ordem do registro respeita as chaves estrangeiras entre as tabelas dele: pai antes de filho', async () => {
    await dentro(async () => {
      const ordem = (await pg.query(`select table_name from public.obs_archive_registry()`)).rows.map((r: { table_name: string }) => r.table_name)
      const idx = new Map(ordem.map((n, i) => [n, i]))
      const fks = (await pg.query(
        `select pc.relname::text as filho, pf.relname::text as pai
           from pg_constraint k join pg_class pc on pc.oid = k.conrelid join pg_class pf on pf.oid = k.confrelid
           join pg_namespace n on n.oid = pc.relnamespace
          where k.contype = 'f' and n.nspname = 'public' and k.conrelid <> k.confrelid and pc.relname = any($1) and pf.relname = any($1)`, [ordem])).rows as { filho: string; pai: string }[]
      expect(fks.length).toBeGreaterThan(10)
      const quebradas = fks.filter(f => idx.get(f.pai)! > idx.get(f.filho)!).map(f => `${f.pai} (pai) vem depois de ${f.filho} (filho)`)
      expect([...new Set(quebradas)]).toEqual([])
    })
  })

  it('a lista fixa de tabelas com identidade do comando de recarga bate com o catálogo', async () => {
    await dentro(async () => {
      expect(await tabelasComIdentidade(pg)).toEqual([...TABELAS_COM_IDENTIDADE].sort())
    })
  })

  it('tabela do registro que ainda não existe não quebra nada; criada no teste, entra na contagem e na remoção', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      const jaExiste = (await escalar<string | null>(pg, `select to_regclass('public.competitor_video_marks')::text`)) !== null
      if (!jaExiste) {
        expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_channel_counts($1) where table_name = 'competitor_video_marks'`, [c.canalA])).toBe(0)
        expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
        // DDL do spec da MG4, só dentro desta transação (nunca `drop`: outros agentes ensaiam a MG4 neste banco)
        await pg.query(`create table public.competitor_video_marks (video_id uuid not null references public.competitor_videos(id) on delete cascade, age_days integer not null, primary key (video_id, age_days))`)
        await pg.query(`insert into public.competitor_video_marks (video_id, age_days) values ($1, 1), ($1, 2)`, [c.videoA])
        expect(await escalar<number>(pg, `select coalesce(sum(row_count), 0)::int from public.obs_archive_channel_counts($1) where table_name = 'competitor_video_marks'`, [c.canalA])).toBe(2)
      } else {
        const t = await tenta(pg, `insert into public.competitor_video_marks (video_id, age_days) values ($1, 1), ($1, 2)`, [c.videoA])
        if (!t.ok) expect(await escalar<string[]>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      }
      await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
      await pg.query(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin])
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_video_marks where video_id = $1`, [c.videoA])).toBe(0)
    })
  })

  // ───────────────────────── lotes encerrados ─────────────────────────

  it('closed_at e closed_reason andam juntos (e só três motivos existem)', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      await pausarEEnvelhecer(pg, c, c.canalA)
      await registrar(pg, c, c.canalA, 'lote-x')
      const um = `(select id from public.obs_archive_batches where channel_ref = $1 order by id limit 1)`
      const so1 = await tenta(pg, `update public.obs_archive_batches set closed_at = now() where id = ${um}`, [c.canalA])
      const so2 = await tenta(pg, `update public.obs_archive_batches set closed_reason = 'despausado' where id = ${um}`, [c.canalA])
      const fora = await tenta(pg, `update public.obs_archive_batches set closed_at = now(), closed_reason = 'qualquer' where id = ${um}`, [c.canalA])
      expect([so1.ok, so2.ok, fora.ok]).toEqual([false, false, false])
      for (const t of [so1, so2, fora]) if (!t.ok) expect(t.code).toBe('23514')
      for (const motivo of ['despausado', 'substituido', 'canal_apagado']) {
        const ok = await tenta(pg, `update public.obs_archive_batches set closed_at = now(), closed_reason = $2 where id = ${um}`, [c.canalA, motivo])
        expect(ok.ok, motivo).toBe(true)
      }
    })
  })

  it('a remoção encerra os lotes anteriores do canal (despausado e substituido)', async () => {
    await dentro(async () => {
      const c = await semearCena(pg)
      // 1ª pausa: lote antigo, encerrado ao despausar
      await pausarEEnvelhecer(pg, c, c.canalA)
      await registrar(pg, c, c.canalA, 'lote-antigo')
      await pg.query(`select public.competitor_channel_unpause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      // 2ª pausa: um lote aberto e, depois, o lote que o dono confirma (o mais recente é quem manda)
      await pausarEEnvelhecer(pg, c, c.canalA)
      await registrar(pg, c, c.canalA, 'lote-aberto')
      await registrar(pg, c, c.canalA, 'lote-novo')
      await pg.query(`select public.obs_archive_verify($1, 'lote-novo', $2)`, [c.site, c.canalA])
      await pg.query(`select public.obs_archive_confirm_nas($1, 'lote-novo', $2, $3)`, [c.site, c.canalA, c.admin])
      const r = (await q1(pg, `select public.competitor_channel_remove_archived($1, $2, $3) as r`, [c.site, c.canalA, c.admin])).r as { batch: string }
      expect(r.batch).toBe('lote-novo')
      const motivo = async (batch: string): Promise<(string | null)[]> =>
        [...new Set((await pg.query(`select closed_reason, deleted_at is not null as apagado from public.obs_archive_batches where channel_ref = $1 and batch = $2`, [c.canalA, batch])).rows
          .map((x: { closed_reason: string | null; apagado: boolean }) => (x.apagado ? 'apagado' : x.closed_reason)))]
      expect(await motivo('lote-novo')).toEqual(['apagado'])
      expect(await motivo('lote-aberto')).toEqual(['substituido'])
      expect(await motivo('lote-antigo')).toEqual(['despausado'])
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where channel_ref = $1 and deleted_at is null and closed_at is null`, [c.canalA])).toBe(0)
    })
  })

  // ───────────────────────── o banco e o código dizem o mesmo ─────────────────────────

  it('os 6 minutos do banco aparecem uma vez no corpo de obs_archive_register', async () => {
    await dentro(async () => {
      const def = await escalar<string>(pg, `select pg_get_functiondef('public.obs_archive_register(uuid,text,uuid,jsonb)'::regprocedure)`)
      expect(def.split(`interval '6 minutes'`).length - 1).toBe(1)
    })
  })

  it('a migration, quando existir em supabase/migrations, é idêntica ao ensaio versionado', () => {
    const pasta = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
    const arquivos = existsSync(pasta) ? readdirSync(pasta).filter(f => f.endsWith('observatorio_a5_e10_export_pausa_e_limite.sql')) : []
    if (arquivos.length === 0) return // pende aplicação do controlador: a migration ainda não foi criada (`db:new`)
    expect(arquivos).toHaveLength(1)
    expect(readFileSync(pasta + arquivos[0], 'utf8')).toBe(readFileSync(MG6_FIXTURE, 'utf8'))
  })
})

// ───────────────────────── medida (não é prova): só roda com E10_MEDIR=1 ─────────────────────────

describe.skipIf(skipIfNoLocalDb() || process.env.E10_MEDIR !== '1')('A5 E10 Tarefa 1: tempo da remoção com um ano de dado (medida)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  it('200 vídeos, 365 dias de série por vídeo, 14 dias de leitura horária, 2.000 comentários: grava os tempos', async () => {
    await emTransacao(pg, async () => {
      const c = await semearCena(pg)
      const ms = async <T>(f: () => Promise<T>): Promise<[T, number]> => { const t0 = Date.now(); const r = await f(); return [r, Date.now() - t0] }
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, discovered_at, view_count)
        select $1, 'med' || g, 'sintético', now() - make_interval(days => 30 + g), now() - make_interval(days => 30 + g), 10 from generate_series(1, 200) g`, [c.canalA])
      await pg.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at)
        select v.id, current_date - d, 100 + d, now() - make_interval(days => d) from public.competitor_videos v, generate_series(0, 364) d where v.competitor_channel_id = $1 and v.video_id like 'med%'`, [c.canalA])
      await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views)
        select v.id, date_trunc('hour', now()) - make_interval(hours => h), date_trunc('hour', now()) - make_interval(hours => h) + interval '10 minutes', $2, 100
          from public.competitor_videos v, generate_series(0, 14 * 24 - 1) h where v.competitor_channel_id = $1 and v.video_id like 'med%'`, [c.canalA, c.site])
      await pg.query(`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, is_creator, published_at, first_seen_at, last_seen_at)
        select $2, $1, v.id, 'medc' || v.video_id || '-' || g, 'x', false, now() - interval '3 days', now() - interval '3 days', now()
          from public.competitor_videos v, generate_series(1, 10) g where v.competitor_channel_id = $1 and v.video_id like 'med%'`, [c.canalA, c.site])
      await pg.query(`select public.competitor_channel_pause($1, $2, $3)`, [c.site, c.canalA, c.admin])
      await pg.query(`update public.competitor_channels set collection_paused_at = collection_paused_at - interval '10 minutes' where id = $1`, [c.canalA])
      await pg.query(`update public.competitor_collection_pauses set paused_at = paused_at - interval '10 minutes' where competitor_channel_id = $1`, [c.canalA])
      const j = await manifestoDoCanal(pg, c.canalA)
      const [, tReg] = await ms(() => pg.query(`select public.obs_archive_register($1, 'lote-med', $2, $3::jsonb)`, [c.site, c.canalA, j]))
      const [, tVer] = await ms(() => pg.query(`select public.obs_archive_verify($1, 'lote-med', $2)`, [c.site, c.canalA]))
      await pg.query(`select public.obs_archive_confirm_nas($1, 'lote-med', $2, $3)`, [c.site, c.canalA, c.admin])
      const [, tSug] = await ms(() => pg.query(`select public.competitor_archive_suggestions($1, now() + interval '2 years', 12)`, [c.site]))
      const [, tRem] = await ms(() => pg.query(`select public.competitor_channel_remove_archived($1, $2, $3)`, [c.site, c.canalA, c.admin]))
      console.log(`E10_MEDIDA register=${tReg}ms verify=${tVer}ms sugestoes=${tSug}ms remover=${tRem}ms`)
      expect(tRem).toBeLessThan(10 * 60_000)
    })
  }, 11 * 60_000)
})
