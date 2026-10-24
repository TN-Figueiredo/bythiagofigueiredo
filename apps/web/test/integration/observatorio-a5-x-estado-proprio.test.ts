// @vitest-environment node
/**
 * A5 · X1/X2/X5: série de estado do vídeo e do canal próprios e contador público diário, contra Postgres de verdade.
 * A migration real é aplicada DUAS vezes (idempotência). Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-x-estado-proprio.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MIG = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261016000003_observatorio_a5_x1_x2_x5_estado_proprio.sql', import.meta.url)), 'utf8')

describe.skipIf(skipIfNoLocalDb())('A5 X1/X2/X5: estado do vídeo e do canal próprios (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let site = '', canal = ''
  const vid = 'x1' + randomUUID().replace(/-/g, '').slice(0, 9)

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    await pg.query(MIG)
    await pg.query(MIG)
    site = (await seedSite(sb, { siteSlug: 'x1-' + randomUUID(), siteName: 'X1 teste' })).siteId
    const x = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.youtube_channels where site_id = $1', [site])
      await apagarSites(pg, 'id = $1', [site])
    } finally { await pg.end() }
  })

  const linha = (sha: string, raw: unknown = { s: sha }) => ({ youtube_video_id: vid, site_id: site, channel_id: canal, state_sha256: sha, raw })

  it('vídeo: A, A, B, A são três linhas (a troca de volta conta), e a função devolve quantas gravou', async () => {
    const rec = async (sha: string) => (await sb.rpc('yt_own_video_state_record', { p_rows: [linha(sha)] })).data
    expect(await rec('A')).toBe(1)
    expect(await rec('A')).toBe(0)
    expect(await rec('B')).toBe(1)
    expect(await rec('A')).toBe(1)
    const r = await pg.query('select state_sha256 from public.yt_own_video_state_raw where youtube_video_id = $1 order by id', [vid])
    expect(r.rows.map(x => x.state_sha256)).toEqual(['A', 'B', 'A'])
  })

  it('vídeo: o mesmo vídeo duas vezes no lote conta uma linha só (a última do lote vale)', async () => {
    const v2 = 'x2' + randomUUID().replace(/-/g, '').slice(0, 9)
    const l = (sha: string) => ({ ...linha(sha), youtube_video_id: v2 })
    expect((await sb.rpc('yt_own_video_state_record', { p_rows: [l('D1'), l('D1')] })).data).toBe(1)
    expect((await pg.query('select count(*)::int n from public.yt_own_video_state_raw where youtube_video_id = $1', [v2])).rows[0].n).toBe(1)
  })

  it('corrida (portão I-1): duas conexões com o mesmo estado novo gravam UMA linha, no vídeo e no canal', async () => {
    const outra = new Client({ connectionString: PG_URL }); await outra.connect()
    const v3 = 'x3' + randomUUID().replace(/-/g, '').slice(0, 9)
    const pv = JSON.stringify([{ ...linha('R1'), youtube_video_id: v3 }])
    const pc = JSON.stringify([{ channel_id: canal, site_id: site, state_sha256: 'corrida-canal', raw: {} }])
    try {
      await pg.query('begin')
      await pg.query('select public.yt_own_video_state_record($1::jsonb), public.yt_own_channel_state_record($2::jsonb)', [pv, pc])
      // a segunda conexão pede o mesmo estado ANTES de a primeira commitar: tem de esperar o lock e depois ver a linha
      const segunda = outra.query('select public.yt_own_video_state_record($1::jsonb) v, public.yt_own_channel_state_record($2::jsonb) c', [pv, pc])
      await new Promise(r => setTimeout(r, 1500))
      await pg.query('commit')
      const res = await segunda
      expect(res.rows[0]).toEqual({ v: 0, c: 0 })
      expect((await pg.query('select count(*)::int n from public.yt_own_video_state_raw where youtube_video_id = $1', [v3])).rows[0].n).toBe(1)
      expect((await pg.query(`select count(*)::int n from public.yt_own_channel_state_raw where state_sha256 = 'corrida-canal'`)).rows[0].n).toBe(1)
    } finally {
      try { await pg.query('rollback') } catch { /* já commitado */ }
      await outra.end()
    }
  })

  it('canal: grava só na mudança', async () => {
    const rec = async (sha: string) => (await sb.rpc('yt_own_channel_state_record', { p_rows: [{ channel_id: canal, site_id: site, state_sha256: sha, raw: { k: sha } }] })).data
    expect(await rec('c1')).toBe(1)
    expect(await rec('c1')).toBe(0)
    expect(await rec('c2')).toBe(1)
  })

  it('contador diário: ignoreDuplicates mantém o primeiro do dia; os três nulos são recusados pelo check', async () => {
    const op = { onConflict: 'youtube_video_id,day_pt', ignoreDuplicates: true } as const
    const base = { youtube_video_id: vid, day_pt: '2026-10-17', site_id: site, channel_id: canal }
    expect((await sb.from('yt_own_video_public_daily').upsert({ ...base, view_count: 10, like_count: null, comment_count: 0 }, op)).error).toBeNull()
    expect((await sb.from('yt_own_video_public_daily').upsert({ ...base, view_count: 99 }, op)).error).toBeNull()
    const r = await pg.query('select view_count, like_count, comment_count from public.yt_own_video_public_daily where youtube_video_id = $1', [vid])
    expect(r.rows).toEqual([{ view_count: '10', like_count: null, comment_count: '0' }])
    const vazio = await sb.from('yt_own_video_public_daily').insert({ ...base, day_pt: '2026-10-18' })
    expect(vazio.error?.code).toBe('23514')
  })

  it('privilégios: anon e authenticated não gravam nem chamam as funções; a RLS está ligada nas três', async () => {
    for (const t of ['yt_own_video_state_raw', 'yt_own_channel_state_raw', 'yt_own_video_public_daily']) {
      const rls = await pg.query('select relrowsecurity from pg_class where oid = $1::regclass', ['public.' + t])
      expect(rls.rows[0].relrowsecurity, t).toBe(true)
      for (const papel of ['anon', 'authenticated']) {
        const p = await pg.query('select has_table_privilege($1, $2, \'insert\') i, has_table_privilege($1, $2, \'update\') u, has_table_privilege($1, $2, \'delete\') d', [papel, 'public.' + t])
        expect(p.rows[0], `${papel} ${t}`).toEqual({ i: false, u: false, d: false })
      }
    }
    for (const fn of ['yt_own_video_state_record(jsonb)', 'yt_own_channel_state_record(jsonb)']) {
      for (const papel of ['anon', 'authenticated']) {
        const p = await pg.query('select has_function_privilege($1, $2, \'execute\') e', [papel, 'public.' + fn])
        expect(p.rows[0].e, `${papel} ${fn}`).toBe(false)
      }
    }
  })

  it('apagar o canal apaga o estado e o contador (cascade)', async () => {
    await pg.query('delete from public.youtube_channels where id = $1', [canal])
    for (const t of ['yt_own_video_state_raw', 'yt_own_video_public_daily']) {
      expect((await pg.query(`select 1 from public.${t} where youtube_video_id = $1`, [vid])).rowCount, t).toBe(0)
    }
    expect((await pg.query('select 1 from public.yt_own_channel_state_raw where channel_id = $1', [canal])).rowCount).toBe(0)
  })
})
