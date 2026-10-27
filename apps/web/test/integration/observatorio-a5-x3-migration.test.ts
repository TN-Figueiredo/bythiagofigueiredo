// @vitest-environment node
/**
 * A5 · X3 (Tarefa 1): a migration de playlists e seções, contra Postgres de verdade (SÓ o `bythiago_int`), tudo dentro de
 * `begin … rollback` via `garantirX3` (a migration NÃO fica aplicada no banco compartilhado). Rodar com a trava
 * /tmp/claude-501/int-db.lock:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-x3-migration.test.ts --no-file-parallelism
 * Funções sem EXECUTE nunca são chamadas como anon/authenticated (SIGSEGV): `has_function_privilege`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearCena, tenta, escalar, q1, lerSqlDaMg6, MG6_FIXTURE, type Cena } from '../helpers/mg6'
import { emTransacaoComX3, lerSqlDaX3, garantirX3 } from '../helpers/x3'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CINCO = ['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions', 'competitor_playlist_items', 'competitor_channel_sections']
const FUNCOES = [
  'competitor_x3_guard(uuid, uuid)',
  'competitor_x3_playlists_record(uuid, uuid, timestamptz, jsonb, boolean)',
  'competitor_x3_items_record(uuid, uuid, uuid, timestamptz, jsonb, boolean, text, text)',
  'competitor_x3_sections_record(uuid, uuid, timestamptz, text, jsonb)',
  'competitor_x3_visit_close(uuid, uuid, timestamptz, text, text, integer, integer, boolean, boolean, boolean)',
]

/** Dia 10 de março de 2026, em UTC; o dia de São Paulo (UTC-3) é o mesmo entre 03:00Z e 23:59Z. */
const T = (dia: number, hora = 10, min = 0): string => `2026-03-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`

const pl = (id: string, title = `Título ${id}`, itemCount: number | null = 3) => ({
  playlist_id: id, title, published_at: '2025-01-01T00:00:00Z', item_count: itemCount, privacy: 'public',
  state_sha256: 'sha-' + title, raw: { id, snippet: { title } },
})
const vid = (n: number): string => 'v' + String(n).padStart(10, '0')
const item = (n: number, extra: Record<string, unknown> = {}) => ({
  item_id: 'item' + n, youtube_video_id: vid(n), position: n, added_at: '2026-01-01T00:00:00Z',
  video_published_at: '2025-12-01T00:00:00Z', video_owner_channel_id: 'UCdono', privacy: 'public', note: null, ...extra,
})
const itens = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => item(de + i))

describe.skipIf(skipIfNoLocalDb())('A5 X3 Tarefa 1: migration de playlists e seções (banco local, aplicada 2× dentro de rollback)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  async function plRec(c: Cena, canal: string, now: string, rows: unknown[], complete: boolean): Promise<Record<string, unknown>> {
    return (await q1(pg, `select public.competitor_x3_playlists_record($1, $2, $3::timestamptz, $4::jsonb, $5) as r`,
      [c.site, canal, now, JSON.stringify(rows), complete])).r as Record<string, unknown>
  }
  async function itRec(c: Cena, canal: string, playlist: string, now: string, rows: unknown[], complete: boolean, status = complete ? 'ok' : 'parcial', reason: string | null = null): Promise<Record<string, unknown>> {
    return (await q1(pg, `select public.competitor_x3_items_record($1, $2, $3, $4::timestamptz, $5::jsonb, $6, $7, $8) as r`,
      [c.site, canal, playlist, now, JSON.stringify(rows), complete, status, reason])).r as Record<string, unknown>
  }
  async function fecha(c: Cena, canal: string, now: string, status: string, o: { reason?: string | null; units?: number; left?: number | null; lista?: boolean | null; secoes?: boolean | null; ciclo?: boolean } = {}): Promise<void> {
    await pg.query(`select public.competitor_x3_visit_close($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10)`,
      [c.site, canal, now, status, o.reason ?? null, o.units ?? 5, o.left === undefined ? 0 : o.left, o.lista ?? null, o.secoes ?? null, o.ciclo ?? false])
  }
  const idsDe = (r: Record<string, unknown>): Record<string, string> => r.ids as Record<string, string>
  const n = (sql: string, p: unknown[] = []) => escalar<number>(pg, sql, p)

  /** Cena + uma playlist `PLaaa` no canal A com `itens(1, k)` lidos completos em t1. */
  async function comPlaylist(k = 3) {
    const c = await semearCena(pg, { semX3: true })
    const r = await plRec(c, c.canalA, T(10), [pl('PLaaa')], true)
    const ref = idsDe(r)['PLaaa']!
    if (k > 0) await itRec(c, c.canalA, ref, T(10, 11), itens(1, k), true)
    return { c, ref }
  }

  it('as cinco tabelas existem com RLS; anon sem select; authenticated sem escrita; as funções só do service_role', async () => {
    await emTransacaoComX3(pg, async () => {
      for (const t of CINCO) {
        expect(await escalar<boolean>(pg, `select relrowsecurity from pg_class where oid = to_regclass('public.${t}')`), `${t} RLS`).toBe(true)
        expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.${t}', 'select')`), `${t} anon`).toBe(false)
        for (const p of ['insert', 'update', 'delete']) {
          expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', 'public.${t}', '${p}')`), `${t} ${p}`).toBe(false)
        }
      }
      for (const f of FUNCOES) {
        const r = await q1(pg, `select has_function_privilege('anon', $1::regprocedure, 'execute') as anon,
                                       has_function_privilege('authenticated', $1::regprocedure, 'execute') as auth,
                                       has_function_privilege('service_role', $1::regprocedure, 'execute') as srv`, [`public.${f}`])
        expect([f, r.anon, r.auth, r.srv]).toEqual([f, false, false, true])
      }
    })
  })

  it('playlist de envios, curtidos e favoritos (UU, LL, FL) é recusada pelo banco (23514)', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      for (const id of ['UUabcdefg', 'UULFabcdefg', 'LLabcdefg', 'FLabcdefg']) {
        const r = await tenta(pg, `insert into public.competitor_playlists (site_id, competitor_channel_id, playlist_id, state_sha256, first_seen_at, last_seen_at)
                                   values ($1, $2, $3, 'h', now(), now())`, [c.site, c.canalA, id])
        expect(r.ok, id).toBe(false)
        if (!r.ok) expect(r.code, id).toBe('23514')
      }
      const via = await tenta(pg, `select public.competitor_x3_playlists_record($1, $2, $3::timestamptz, $4::jsonb, true)`, [c.site, c.canalA, T(10), JSON.stringify([pl('UUxyz1234')])])
      expect(via.ok).toBe(false)
      if (!via.ok) expect(via.code).toBe('23514')
    })
  })

  it('playlists_record: versão só quando o hash muda; missing_since só com lista completa; volta limpa', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      const r1 = await plRec(c, c.canalA, T(10), [pl('PLa'), pl('PLb')], true)
      expect(await n(`select count(*)::int from public.competitor_playlists where competitor_channel_id = $1`, [c.canalA])).toBe(2)
      expect(await n(`select count(*)::int from public.competitor_playlist_versions where site_id = $1`, [c.site])).toBe(2)
      await plRec(c, c.canalA, T(11), [pl('PLa'), pl('PLb')], true)
      expect(await n(`select count(*)::int from public.competitor_playlist_versions where site_id = $1`, [c.site])).toBe(2)
      const r3 = await plRec(c, c.canalA, T(12), [pl('PLa', 'Outro título'), pl('PLb')], true)
      expect(r3.versoes).toBe(1)
      expect(await n(`select count(*)::int from public.competitor_playlist_versions where site_id = $1`, [c.site])).toBe(3)
      // prev_seen_at da versão nova = last_seen_at anterior (T(11))
      const prev = await q1(pg, `select prev_seen_at from public.competitor_playlist_versions where playlist_ref = $1 order by observed_at desc, id desc limit 1`, [idsDe(r1)['PLa']])
      expect(new Date(prev.prev_seen_at as string).toISOString()).toBe('2026-03-11T10:00:00.000Z')
      // lista incompleta: nada some
      await plRec(c, c.canalA, T(13), [pl('PLa', 'Outro título')], false)
      expect(await n(`select count(*)::int from public.competitor_playlists where competitor_channel_id = $1 and missing_since is not null`, [c.canalA])).toBe(0)
      // completa com uma só: a outra some
      await plRec(c, c.canalA, T(14), [pl('PLa', 'Outro título')], true)
      expect(await escalar<string>(pg, `select missing_since::text from public.competitor_playlists where playlist_id = 'PLb' and competitor_channel_id = $1`, [c.canalA])).toBe('2026-03-14')
      // ela volta
      await plRec(c, c.canalA, T(15), [pl('PLa', 'Outro título'), pl('PLb')], true)
      expect(await escalar<string | null>(pg, `select missing_since::text from public.competitor_playlists where playlist_id = 'PLb' and competitor_channel_id = $1`, [c.canalA])).toBeNull()
    })
  })

  it('lista com ocultas: a saída só vale na segunda leitura em outro dia; a playlist que volta zera absent_day; visit_close grava list_total/list_read', async () => {
    await emTransacaoComX3(pg, async () => {
      const sqlNovo = readFileSync(new URL('../../../../supabase/migrations/20261027000001_observatorio_a5_x3_lista_com_ocultas.sql', import.meta.url), 'utf8')
      await pg.query(sqlNovo)
      await pg.query(sqlNovo)   // idempotência
      const c = await semearCena(pg, { semX3: true })
      const oc = async (now: string, rows: unknown[], complete = false, ocultas = true) => (await q1(pg,
        `select public.competitor_x3_playlists_record($1, $2, $3::timestamptz, $4::jsonb, $5, $6) as r`, [c.site, c.canalA, now, JSON.stringify(rows), complete, ocultas])).r as Record<string, unknown>
      const est = (id: string) => q1(pg, `select absent_day::text as a, missing_since::text as m from public.competitor_playlists where playlist_id = $1 and competitor_channel_id = $2`, [id, c.canalA])
      await oc(T(10), [pl('PLa'), pl('PLb')], true, false)
      const r1 = await oc(T(11), [pl('PLa')])
      expect(r1.a_confirmar).toBe(1)
      expect(await est('PLb')).toMatchObject({ a: '2026-03-11', m: null })
      const mesmoDia = await oc(T(11, 20), [pl('PLa')])
      expect(mesmoDia.sumidas).toBe(0)
      expect(await est('PLb')).toMatchObject({ a: '2026-03-11', m: null })
      const r2 = await oc(T(12), [pl('PLa')])
      expect(r2.sumidas).toBe(1)
      expect(await est('PLb')).toMatchObject({ a: null, m: '2026-03-11' }) // a data da 1ª ausência, não a da confirmação
      // volta: zera
      await oc(T(13), [pl('PLa'), pl('PLb')])
      expect(await est('PLb')).toMatchObject({ a: null, m: null })
      await oc(T(14), [pl('PLa')])
      await oc(T(15), [pl('PLa'), pl('PLb')])
      expect(await est('PLb')).toMatchObject({ a: null, m: null })
      await expect(oc(T(16), [pl('PLa')], true, true)).rejects.toThrow(/parametro_invalido/)
    })
  })

  it('visit_close grava list_total_results e list_read_n (nulos quando não passados)', async () => {
    await emTransacaoComX3(pg, async () => {
      await pg.query(readFileSync(new URL('../../../../supabase/migrations/20261027000001_observatorio_a5_x3_lista_com_ocultas.sql', import.meta.url), 'utf8'))
      const c = await semearCena(pg, { semX3: true })
      await pg.query(`select public.competitor_x3_visit_close($1, $2, $3::timestamptz, 'parcial', 'lista_com_ocultas', 5, 0, false, false, true, 5, 3)`, [c.site, c.canalA, T(10)])
      expect(await q1(pg, `select list_total_results as t, list_read_n as r from public.competitor_playlist_reads where competitor_channel_id = $1`, [c.canalA])).toMatchObject({ t: 5, r: 3 })
      await pg.query(`select public.competitor_x3_visit_close($1, $2, $3::timestamptz, 'ok', null, 5, 0, false, false, true)`, [c.site, c.canalA, T(11)])
      expect(await q1(pg, `select list_total_results as t, list_read_n as r from public.competitor_playlist_reads where competitor_channel_id = $1`, [c.canalA])).toMatchObject({ t: null, r: null })
    })
  })

  it('distinct on: a mesma playlist duplicada em p_rows gera uma versão só', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      await plRec(c, c.canalA, T(10), [pl('PLa'), pl('PLa')], true)
      expect(await n(`select count(*)::int from public.competitor_playlist_versions where site_id = $1`, [c.site])).toBe(1)
    })
  })

  it('"último" das versões por observed_at desc, id desc: mesmo hash do último não grava; hash antigo que volta grava', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      await plRec(c, c.canalA, T(10), [pl('PLa', 'A')], true)
      await plRec(c, c.canalA, T(11), [pl('PLa', 'B')], true)
      expect((await plRec(c, c.canalA, T(12), [pl('PLa', 'B')], true)).versoes).toBe(0)
      expect((await plRec(c, c.canalA, T(13), [pl('PLa', 'A')], true)).versoes).toBe(1)
    })
  })

  it('items_record: completo grava; parcial não marca saída; completo sem o item marca; o item volta e limpa; id curto recusa; playlist alheia recusa', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(3)
      expect(await n(`select count(*)::int from public.competitor_playlist_items where playlist_ref = $1`, [ref])).toBe(3)
      await itRec(c, c.canalA, ref, T(11), itens(1, 2), false)
      expect(await n(`select count(*)::int from public.competitor_playlist_items where playlist_ref = $1 and removed_since is not null`, [ref])).toBe(0)
      const r = await itRec(c, c.canalA, ref, T(12), itens(1, 2), true)
      expect(r.saidos).toBe(1)
      expect(await escalar<string>(pg, `select removed_since::text from public.competitor_playlist_items where playlist_ref = $1 and item_id = 'item3'`, [ref])).toBe('2026-03-12')
      await itRec(c, c.canalA, ref, T(13), itens(1, 3), true)
      const l = await q1(pg, `select removed_since, removed_after from public.competitor_playlist_items where playlist_ref = $1 and item_id = 'item3'`, [ref])
      expect(l.removed_since).toBeNull()
      expect(l.removed_after).toBeNull()
      const curto = await tenta(pg, `select public.competitor_x3_items_record($1, $2, $3, $4::timestamptz, $5::jsonb, true, 'ok', null)`,
        [c.site, c.canalA, ref, T(14), JSON.stringify([item(1, { youtube_video_id: 'abc1234567' })])])
      expect(curto.ok).toBe(false)
      // playlist do canal B com p_channel A
      const rb = await plRec(c, c.canalB, T(10), [pl('PLbbb')], true)
      const alheia = await tenta(pg, `select public.competitor_x3_items_record($1, $2, $3, $4::timestamptz, '[]'::jsonb, false, 'parcial', null)`, [c.site, c.canalA, idsDe(rb)['PLbbb']!, T(14)])
      expect(alheia.ok).toBe(false)
      if (!alheia.ok) expect(alheia.message).toContain('X3:playlist_de_outro_canal')
    })
  })

  it('note é gravada e atualizada', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(0)
      await itRec(c, c.canalA, ref, T(10, 11), [item(1, { note: 'primeira' })], true)
      expect(await escalar<string>(pg, `select note from public.competitor_playlist_items where playlist_ref = $1`, [ref])).toBe('primeira')
      await itRec(c, c.canalA, ref, T(11), [item(1, { note: 'segunda' })], true)
      expect(await escalar<string>(pg, `select note from public.competitor_playlist_items where playlist_ref = $1`, [ref])).toBe('segunda')
    })
  })

  it('seções: mesmo hash duas vezes = 1 linha; hash novo = 2; prev_seen_at = last_visit_at anterior do canal', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      const sec = (now: string, sha: string) => q1(pg, `select public.competitor_x3_sections_record($1, $2, $3::timestamptz, $4, '{"items":[]}'::jsonb) as k`, [c.site, c.canalA, now, sha])
      expect((await sec(T(10), 'h1')).k).toBe(1)
      await fecha(c, c.canalA, T(10, 12), 'ok')
      expect((await sec(T(11), 'h1')).k).toBe(0)
      expect((await sec(T(12), 'h2')).k).toBe(1)
      expect(await n(`select count(*)::int from public.competitor_channel_sections where competitor_channel_id = $1`, [c.canalA])).toBe(2)
      const prev = await escalar<string>(pg, `select prev_seen_at::text from public.competitor_channel_sections where competitor_channel_id = $1 order by id desc limit 1`, [c.canalA])
      expect(new Date(prev).toISOString()).toBe('2026-03-10T12:00:00.000Z')
      // hash antigo volta = versão nova
      expect((await sec(T(13), 'h1')).k).toBe(1)
    })
  })

  it('visit_close: ok carimba last_complete_at e last_cycle_at; parcial só com p_ciclo; tri-state; first_visit_at nunca muda', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      const ler = () => q1(pg, `select * from public.competitor_playlist_reads where competitor_channel_id = $1`, [c.canalA])
      const iso = (v: unknown) => (v === null ? null : new Date(v as string).toISOString())
      await fecha(c, c.canalA, T(10), 'parcial', { reason: 'lista_vazia_a_confirmar', lista: true })
      let l = await ler()
      expect(l.empty_streak).toBe(1)
      expect(l.last_complete_at).toBeNull()
      expect(l.last_cycle_at).toBeNull()
      expect(iso(l.first_visit_at)).toBe('2026-03-10T10:00:00.000Z')
      await fecha(c, c.canalA, T(11), 'parcial', { reason: 'lista_cortada' }) // nulo preserva
      l = await ler()
      expect(l.empty_streak).toBe(1)
      await fecha(c, c.canalA, T(12), 'parcial', { reason: 'teto_itens', ciclo: true, lista: true })
      l = await ler()
      expect(l.empty_streak).toBe(2)
      expect(iso(l.last_cycle_at)).toBe('2026-03-12T10:00:00.000Z')
      expect(l.last_complete_at).toBeNull()
      await fecha(c, c.canalA, T(13), 'ok', { lista: false, secoes: false })
      l = await ler()
      expect(l.empty_streak).toBe(0)
      expect(iso(l.last_complete_at)).toBe('2026-03-13T10:00:00.000Z')
      expect(iso(l.last_cycle_at)).toBe('2026-03-13T10:00:00.000Z')
      expect(iso(l.first_visit_at)).toBe('2026-03-10T10:00:00.000Z')
      // seções: nulo preserva, true soma, false zera
      await fecha(c, c.canalA, T(14), 'parcial', { secoes: true })
      expect((await ler()).sections_empty_streak).toBe(1)
      await fecha(c, c.canalA, T(15), 'parcial', {})
      expect((await ler()).sections_empty_streak).toBe(1)
      await fecha(c, c.canalA, T(16), 'parcial', { secoes: false })
      expect((await ler()).sections_empty_streak).toBe(0)
    })
  })

  it('monotônico: visit_close atrasado não sobrescreve; items_record e playlists_record atrasados devolvem atrasada e não tocam em nada', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      await fecha(c, c.canalA, T(10, 10, 20), 'ok')
      await fecha(c, c.canalA, T(10, 10, 0), 'parcial', { reason: 'lista_cortada' })
      const l = await q1(pg, `select last_status, last_visit_at from public.competitor_playlist_reads where competitor_channel_id = $1`, [c.canalA])
      expect(l.last_status).toBe('ok')
      expect(new Date(l.last_visit_at as string).toISOString()).toBe('2026-03-10T10:20:00.000Z')

      const { c: c2, ref } = await comPlaylist(3)
      const nova = await itRec(c2, c2.canalA, ref, T(12), itens(1, 3), true)
      expect(nova.atrasada).toBe(false)
      const velha = await itRec(c2, c2.canalA, ref, T(11), itens(1, 2), true)
      expect(velha.atrasada).toBe(true)
      expect(await n(`select count(*)::int from public.competitor_playlist_items where playlist_ref = $1 and removed_since is not null`, [ref])).toBe(0)
      expect(new Date(await escalar<string>(pg, `select items_read_at::text from public.competitor_playlists where id = $1`, [ref])).toISOString()).toBe('2026-03-12T10:00:00.000Z')

      const atrasada = await plRec(c2, c2.canalA, T(9), [pl('PLzzz')], true)
      expect(atrasada.atrasada).toBe(true)
      expect(await n(`select count(*)::int from public.competitor_playlists where competitor_channel_id = $1 and missing_since is not null`, [c2.canalA])).toBe(0)
      expect(await n(`select count(*)::int from public.competitor_playlists where competitor_channel_id = $1 and playlist_id = 'PLzzz'`, [c2.canalA])).toBe(0)
    })
  })

  it('items_complete_at e removed_after: a janela da saída é entre duas leituras completas', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(3) // completa em T(10, 11)
      const ra = (id: string) => escalar<string | null>(pg, `select removed_after::text from public.competitor_playlist_items where playlist_ref = $1 and item_id = $2`, [ref, id])
      const iso = (s: string | null) => (s === null ? null : new Date(s).toISOString())
      await itRec(c, c.canalA, ref, T(11), itens(1, 3), false) // parcial entre duas completas: não move items_complete_at
      await itRec(c, c.canalA, ref, T(12), itens(1, 2), true)
      expect(iso(await ra('item3'))).toBe('2026-03-10T11:00:00.000Z')
      // saída em massa no dia 14 e confirmada no 15: removed_after = a última completa ANTES do dia 14 (T(12))
      const grande = await comPlaylist(30)
      await itRec(grande.c, grande.c.canalA, grande.ref, T(14), itens(1, 10), true)
      const sem = await escalar<number>(pg, `select count(*)::int from public.competitor_playlist_items where playlist_ref = $1 and removed_since is not null`, [grande.ref])
      expect(sem).toBe(0)
      await itRec(grande.c, grande.c.canalA, grande.ref, T(15), itens(1, 10), true)
      const l = await q1(pg, `select count(*)::int as k, min(removed_after)::text as ra from public.competitor_playlist_items where playlist_ref = $1 and removed_since is not null`, [grande.ref])
      expect(l.k).toBe(20)
      expect(iso(l.ra as string)).toBe('2026-03-10T11:00:00.000Z')
      // playlist sem leitura completa anterior: removed_after nulo
      const s = await semearCena(pg, { semX3: true })
      const r = await plRec(s, s.canalA, T(10), [pl('PLsem')], true)
      const ref2 = idsDe(r)['PLsem']!
      await itRec(s, s.canalA, ref2, T(10, 11), itens(1, 2), false) // só parcial
      await itRec(s, s.canalA, ref2, T(11), itens(1, 1), true)
      expect(await escalar<string | null>(pg, `select removed_after::text from public.competitor_playlist_items where playlist_ref = $1 and item_id = 'item2'`, [ref2])).toBeNull()
      // reaparecer limpa os dois
      await itRec(s, s.canalA, ref2, T(12), itens(1, 2), true)
      const lim = await q1(pg, `select removed_since, removed_after from public.competitor_playlist_items where playlist_ref = $1 and item_id = 'item2'`, [ref2])
      expect([lim.removed_since, lim.removed_after]).toEqual([null, null])
    })
  })

  it('saída em massa: 30 presentes, a leitura traz 10 -> nada marcado e a confirmar; outro dia marca 20; mesmo dia continua sem marcar', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(30)
      const marcados = () => n(`select count(*)::int from public.competitor_playlist_items where playlist_ref = $1 and removed_since is not null`, [ref])
      const estado = () => q1(pg, `select items_reason, items_status, mass_exit_day::text as dia from public.competitor_playlists where id = $1`, [ref])
      const r1 = await itRec(c, c.canalA, ref, T(12), itens(1, 10), true)
      expect(r1.saida_em_massa_a_confirmar).toBe(true)
      expect(await marcados()).toBe(0)
      let e = await estado()
      expect([e.items_reason, e.items_status, e.dia]).toEqual(['saida_em_massa_a_confirmar', 'parcial', '2026-03-12'])
      const mesmoDia = await itRec(c, c.canalA, ref, T(12, 15), itens(1, 10), true)
      expect(mesmoDia.saida_em_massa_a_confirmar).toBe(true)
      expect(await marcados()).toBe(0)
      const r2 = await itRec(c, c.canalA, ref, T(13), itens(1, 10), true)
      expect(r2.saidos).toBe(20)
      expect(await marcados()).toBe(20)
      e = await estado()
      expect([e.items_status, e.dia]).toEqual(['ok', null])
    })
  })

  it('Phil M-2: item gravado sem data e depois com data fica com a data (video_published_at e added_at)', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(0)
      await itRec(c, c.canalA, ref, T(12), [item(1, { video_published_at: null, added_at: null })], true)
      const antes = await q1(pg, `select video_published_at, added_at from public.competitor_playlist_items where playlist_ref = $1`, [ref])
      expect([antes.video_published_at, antes.added_at]).toEqual([null, null])
      await itRec(c, c.canalA, ref, T(13), [item(1)], true)
      const depois = await q1(pg, `select video_published_at::text as v, added_at::text as a from public.competitor_playlist_items where playlist_ref = $1`, [ref])
      expect(new Date(depois.v as string).toISOString()).toBe('2025-12-01T00:00:00.000Z')
      expect(new Date(depois.a as string).toISOString()).toBe('2026-01-01T00:00:00.000Z')
      // e uma leitura sem a data depois não a apaga
      await itRec(c, c.canalA, ref, T(14), [item(1, { video_published_at: null, added_at: null })], true)
      expect(await n(`select count(*)::int from public.competitor_playlist_items where playlist_ref = $1 and video_published_at is not null and added_at is not null`, [ref])).toBe(1)
    })
  })

  it('Phil M-3: saída em massa pendente no dia 1, leitura parcial no dia 2 e completa no dia 3 marca removed_since', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(30)
      const dia = () => escalar<string | null>(pg, `select mass_exit_day::text from public.competitor_playlists where id = $1`, [ref])
      expect((await itRec(c, c.canalA, ref, T(12), itens(1, 10), true)).saida_em_massa_a_confirmar).toBe(true)
      expect(await dia()).toBe('2026-03-12')
      await itRec(c, c.canalA, ref, T(13), itens(1, 5), false, 'parcial', 'itens_cortados')
      expect(await dia()).toBe('2026-03-12')
      const r3 = await itRec(c, c.canalA, ref, T(14), itens(1, 10), true)
      expect(r3.saidos).toBe(20)
      expect(await n(`select count(*)::int from public.competitor_playlist_items where playlist_ref = $1 and removed_since is not null`, [ref])).toBe(20)
    })
  })

  it('Phil M-4: sections_record atrasado (p_now anterior à última versão) devolve 0 e não grava versão velha', async () => {
    await emTransacaoComX3(pg, async () => {
      const c = await semearCena(pg, { semX3: true })
      const sec = (now: string, sha: string) => q1(pg, `select public.competitor_x3_sections_record($1, $2, $3::timestamptz, $4, '{"items":[]}'::jsonb) as k`, [c.site, c.canalA, now, sha])
      expect((await sec(T(12), 'B')).k).toBe(1)
      expect((await sec(T(11), 'A')).k).toBe(0)
      expect(await n(`select count(*)::int from public.competitor_channel_sections where competitor_channel_id = $1`, [c.canalA])).toBe(1)
    })
  })

  it('canal pausado, ausente ou de outro site: as funções recusam X3:canal_indisponivel', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(0)
      const chamadas = (canal: string, site: string) => [
        `select public.competitor_x3_playlists_record('${site}', '${canal}', '${T(20)}', '[]', false)`,
        `select public.competitor_x3_items_record('${site}', '${canal}', '${ref}', '${T(20)}', '[]', false, 'parcial', null)`,
        `select public.competitor_x3_sections_record('${site}', '${canal}', '${T(20)}', 'h', '{}')`,
        `select public.competitor_x3_visit_close('${site}', '${canal}', '${T(20)}', 'ok', null, 1, 0, null, null, false)`,
      ]
      const confere = async (sqls: string[], quem: string) => {
        for (const s of sqls) {
          const r = await tenta(pg, s)
          expect(r.ok, `${quem}: ${s.slice(0, 60)}`).toBe(false)
          if (!r.ok) expect(r.message, quem).toContain('X3:canal_indisponivel')
        }
      }
      const pausa = await escalar<string>(pg, `select public.competitor_channel_pause($1, $2, $3) ->> 'status'`, [c.site, c.canalA, c.admin])
      expect(pausa).toBe('pausado')
      await confere(chamadas(c.canalA, c.site), 'pausado')
      await pg.query(`update public.competitor_channels set missing_since = current_date where id = $1`, [c.canalB])
      await confere(chamadas(c.canalB, c.site), 'ausente')
      const outro = await semearCena(pg, { semX3: true })
      await confere(chamadas(outro.canalA, c.site), 'outro site')
    })
  })

  it('o registro do export tem 30 linhas (a F1 acrescenta as 3 da watch), as 22 primeiras iguais às da MG6, depois as 5 da X3 e as 3 da F1, e obs_archive_uncovered() é vazio', async () => {
    await emTransacaoComX3(pg, async () => {
      expect(await n(`select count(*)::int from public.obs_archive_registry()`)).toBe(30)
      expect(await escalar<unknown>(pg, `select public.obs_archive_uncovered()`)).toEqual([])
      const ordem = `select table_name, filter_sql, period_sql, sum_sql, order_sql from public.obs_archive_registry()`
      const x3 = (await pg.query(ordem)).rows as Array<Record<string, unknown>>
      await pg.query('rollback')
      // só o texto da MG6 (22 linhas), sem o conserto do `garantirMg6` que, com a X3 já aplicada no banco (CI: o `supabase start`
      // aplica todas as migrations) ou com `E10_COM_X3=1`, devolveria o registro a 27: a base de comparação é sempre a das 22.
      await pg.query('begin')
      await pg.query(lerSqlDaMg6())
      const mg6 = (await pg.query(ordem)).rows as Array<Record<string, unknown>>
      expect(mg6).toHaveLength(22)
      expect(x3.slice(0, 22)).toEqual(mg6)
      expect(x3.slice(22).map(r => r.table_name)).toEqual([...CINCO, 'yt_watch_alvos', 'yt_watch_thumbs', 'yt_watch_readings'])
      // o helper termina com rollback; reabre para o finally não falhar
      await pg.query('rollback')
      await pg.query('begin')
    })
  })

  it('o bloco de guarda recusa um registro instalado com nome a mais que não é da X3', async () => {
    await emTransacaoComX3(pg, async () => {
      const atual = (await pg.query(`select table_name, filter_sql, period_sql, sum_sql, order_sql from public.obs_archive_registry()`)).rows as Array<{ table_name: string; filter_sql: string; period_sql: string | null; sum_sql: string | null; order_sql: string }>
      const q = (s: string | null): string => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`)
      const valores = [...atual, { table_name: 'competitor_estranha', filter_sql: 't.id = $1', period_sql: null, sum_sql: null, order_sql: 't.id' }]
        .map(r => `(${q(r.table_name)}, ${q(r.filter_sql)}, ${q(r.period_sql)}, ${q(r.sum_sql)}, ${q(r.order_sql)})`).join(',\n')
      await pg.query(`create or replace function public.obs_archive_registry() returns table (table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
                      language sql stable set search_path = '' as $f$ values ${valores} $f$`)
      const r = await tenta(pg, lerSqlDaX3())
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message).toContain('X3: registro instalado inesperado')
    })
  })

  it('competitor_cascade_counts do canal traz as cinco chaves com as contagens semeadas', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, ref } = await comPlaylist(3)
      await plRec(c, c.canalA, T(11), [pl('PLaaa'), pl('PLbbb')], true)
      await q1(pg, `select public.competitor_x3_sections_record($1, $2, $3::timestamptz, 'h', '{}'::jsonb) as k`, [c.site, c.canalA, T(11)])
      await fecha(c, c.canalA, T(11), 'ok')
      const j = await escalar<Record<string, number>>(pg, `select public.competitor_cascade_counts('canal', $1)`, [c.canalA])
      expect(ref).toBeTruthy()
      for (const t of CINCO) expect(Object.keys(j), t).toContain(t)
      expect([j.competitor_playlist_reads, j.competitor_playlists, j.competitor_playlist_items, j.competitor_channel_sections]).toEqual([1, 2, 3, 1])
      expect(j.competitor_playlist_versions).toBe(2)
    })
  })

  it('a MG6 do ensaio é a da migration em produção (a fixture é a fonte do registro de 22)', () => {
    // o teste da X3 compara o registro contra a fixture: se a fixture mudar, a cópia byte a byte na migration tem de mudar junto
    const fixture = readFileSync(MG6_FIXTURE, 'utf8')
    const linhas = lerSqlDaX3().split('\n').filter(l => l.trim().startsWith("('competitor_") || l.trim().startsWith("('youtube_intelligence_tasks'"))
    for (const l of linhas.slice(0, 30)) {
      if (CINCO.some(t => l.includes(`('${t}'`))) continue
      expect(fixture.includes(l), l.slice(0, 70)).toBe(true)
    }
  })

  it('idempotência: aplicar de novo não falha nem muda o registro', async () => {
    await emTransacaoComX3(pg, async () => {
      await garantirX3(pg)
      expect(await n(`select count(*)::int from public.obs_archive_registry()`)).toBe(30)
    })
  })
})
