// @vitest-environment node
/**
 * A5 · E18 (MG12): forma das duas tabelas de versões do vídeo próprio e das três funções, contra o banco local.
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e18-schema.test.ts --no-file-parallelism
 * Função sem EXECUTE nunca é CHAMADA como anon/authenticated (derruba este Postgres): privilégio por `has_function_privilege`.
 * O roteiro completo (S1 a S18, duas aplicações, mutações) está em `.superpowers/sdd/a5-e18/sql/prova.sql`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['yt_own_video_versions', 'yt_own_versions_state'] as const
const FUNCOES = [
  'yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb)',
  'yt_own_versions_seed_pre(uuid, uuid, jsonb)',
  'yt_own_versions_prova(uuid, date)',
] as const

/** Hoje no Pacífico, menos `n` dias (a função recusa dia não fechado). */
function diaPt(n: number): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
  const d = new Date(`${hoje}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

describe.skipIf(skipIfNoLocalDb())('A5 E18 (MG12): tabelas e funções de versões do vídeo próprio (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        for (const t of ['yt_own_video_versions', 'yt_own_versions_state', 'yt_own_video_meta_daily', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
    }
  })

  interface Cenario { site: string; outroSite: string; canal: string; yt: string; video: string; dia: string; abertura: Record<string, unknown>[] }

  /** Um canal, um vídeo e a linha diária de `dia` (5 dias atrás); `abertura` = as três linhas de base montadas dela. */
  async function cenario(): Promise<Cenario> {
    const site = (await seedSite(sb)).siteId; sites.push(site)
    const outroSite = (await seedSite(sb)).siteId; sites.push(outroSite)
    const x = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])).rows[0].id)
    const yt = 'v' + x.slice(0, 10)
    const video = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'T', now() - interval '90 days') returning id`, [site, canal, yt])).rows[0].id)
    const dia = diaPt(5)
    await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, title_at_capture, description_text,
        description_sha256, thumbnail_dhash, thumbnail_sha256_at_capture, thumbnail_blob_url, privacy_status, captured_at)
      values ($1, $2, $3, $4, $5, 'Titulo A', 'Descricao A', md5('d'), '0f0f0f0f0f0f0f0f', md5('t'), 'https://blob.example/a', 'public', now())`, [yt, dia, site, video, canal])
    const comum = { youtube_video_id: yt, video_id: video, first_seen_at: new Date().toISOString(), seen_at: new Date().toISOString(), window_precision: 'first', origin: 'linha_de_base' }
    const abertura = [
      { ...comum, field: 'title', value_text: 'Titulo A', value_hash: 'a'.repeat(32) },
      { ...comum, field: 'thumb', value_hash: '0f0f0f0f0f0f0f0f', thumb_dhash: '0f0f0f0f0f0f0f0f', thumb_anchor_dhash: '0f0f0f0f0f0f0f0f', thumb_sha256: createMd5('t'), thumb_blob_url: 'https://blob.example/a', thumb_similar: false },
      { ...comum, field: 'desc', value_text: 'Descricao A', value_hash: createMd5('d') },
    ]
    return { site, outroSite, canal, yt, video, dia, abertura }
  }
  function createMd5(s: string): string { return createHash('md5').update(s).digest('hex') }

  const aplicar = (c: Cenario, over: { site?: string; dia?: string; touch?: unknown[]; open?: unknown[] } = {}) =>
    pg.query('select public.yt_own_versions_apply_day($1, $2, $3, $4::jsonb, $5::jsonb) as r',
      [c.canal, over.site ?? c.site, over.dia ?? c.dia, JSON.stringify(over.touch ?? []), JSON.stringify(over.open ?? c.abertura)])

  it('catálogo: RLS ligada, uma policy de leitura em cada, 6 índices, 9 restrições yovv_, chaves restrict ao canal', async () => {
    const rls = await pg.query(`select relname, relrowsecurity from pg_class where oid = any($1::regclass[]) order by 1`, [TABELAS.map(t => 'public.' + t)])
    expect(rls.rows.map(r => [r.relname, r.relrowsecurity])).toEqual([...TABELAS].sort().map(t => [t, true]))
    const pol = await pg.query(`select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = any($1) order by 1`, [TABELAS])
    expect(pol.rows.map(r => [r.tablename, r.policyname, r.cmd])).toEqual([...TABELAS].sort().map(t => [t, t + '_select', 'SELECT']))
    for (const p of pol.rows) expect(String(p.qual)).toMatch(/can_edit_site\(site_id\)|can_view_private_site\(site_id\)/)
    const idx = await pg.query(`select count(*)::int as n from pg_indexes where schemaname = 'public' and indexname in
      ('idx_yovv_one_current','idx_yovv_dia','idx_yovv_pre','idx_yovv_canal','idx_yovv_canal_corrente','idx_yovv_site')`)
    expect(idx.rows[0].n).toBe(6)
    const ck = await pg.query(`select count(*)::int as n from pg_constraint where conrelid = 'public.yt_own_video_versions'::regclass and contype = 'c' and conname like 'yovv_%'`)
    expect(ck.rows[0].n).toBe(9)
    const fk = await pg.query(`select count(*)::int as n from pg_constraint k where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass
      and k.confdeltype = 'r' and cardinality(k.conkey) = 1 and k.conrelid = any($1::regclass[])`, [TABELAS.map(t => 'public.' + t)])
    expect(fk.rows[0].n).toBe(2)
  })

  it('privilégios: anon sem nada; authenticated só SELECT; as três funções só para service_role', async () => {
    for (const t of TABELAS) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const r = await pg.query(`select has_table_privilege('anon', $1, $2) as a, has_table_privilege('authenticated', $1, $2) as u`, ['public.' + t, priv])
        expect(r.rows[0].a, `anon ${priv} em ${t}`).toBe(false)
        expect(r.rows[0].u, `authenticated ${priv} em ${t}`).toBe(priv === 'SELECT')
      }
    }
    for (const f of FUNCOES) {
      const r = await pg.query(`select has_function_privilege('anon', $1::regprocedure, 'execute') as a, has_function_privilege('authenticated', $1::regprocedure, 'execute') as u,
        has_function_privilege('service_role', $1::regprocedure, 'execute') as s`, ['public.' + f])
      expect(r.rows[0], f).toEqual({ a: false, u: false, s: true })
    }
  })

  it('apply_day: primeiro dia abre 3 linhas de base e fixa o estado; repetir o dia devolve ja_derivado sem mexer', async () => {
    const c = await cenario()
    const r = (await aplicar(c)).rows[0].r
    expect(r).toMatchObject({ resultado: 'ok', abertas: 3, confirmadas: 0 })
    const st = (await pg.query('select tracking_since::text as a, derived_through::text as b from public.yt_own_versions_state where channel_id = $1', [c.canal])).rows[0]
    expect(st).toEqual({ a: c.dia, b: c.dia })
    const antes = (await pg.query(`select count(*)::int as n, md5(string_agg(to_jsonb(v)::text, '|' order by id)) as h from public.yt_own_video_versions v where channel_id = $1`, [c.canal])).rows[0]
    expect((await aplicar(c)).rows[0].r.resultado).toBe('ja_derivado')
    expect((await aplicar(c, { dia: diaPt(6), open: [] })).rows[0].r.resultado).toBe('ja_derivado')
    const depois = (await pg.query(`select count(*)::int as n, md5(string_agg(to_jsonb(v)::text, '|' order by id)) as h from public.yt_own_video_versions v where channel_id = $1`, [c.canal])).rows[0]
    expect(depois).toEqual(antes)
  })

  it('apply_day recusa: canal fora do site (mutação de site), vídeo de outro canal (mutação de canal), dia não fechado, abertura que não casa', async () => {
    const c = await cenario()
    await expect(aplicar(c, { site: c.outroSite })).rejects.toThrow(/canal_fora_do_site/)
    await expect(aplicar(c, { dia: diaPt(0) })).rejects.toThrow(/dia_nao_fechado/)
    const outro = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'en', $3, 'Outro', $4, $5) returning id`, [c.site, 'UCo' + randomUUID().replace(/-/g, '').slice(0, 20), '@o' + randomUUID().slice(0, 8), 'UUo' + randomUUID().replace(/-/g, '').slice(0, 20), 'outro-' + randomUUID().slice(0, 8)])).rows[0].id)
    // o vídeo tem a linha diária do canal original: aplicar pelo OUTRO canal deve falhar por sem_linha_do_dia
    await expect(pg.query('select public.yt_own_versions_apply_day($1, $2, $3, $4::jsonb, $5::jsonb)', [outro, c.site, c.dia, '[]', JSON.stringify(c.abertura)])).rejects.toThrow(/sem_linha_do_dia/)
    const semBlob = c.abertura.map(a => (a.field === 'thumb' ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'thumb_blob_url')) : a))
    await expect(aplicar(c, { open: semBlob })).rejects.toThrow(/abertura_invalida/)
    const semVideo = c.abertura.map(a => Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'video_id')))
    await expect(aplicar(c, { open: semVideo })).rejects.toThrow(/abertura_invalida/)
    expect((await pg.query('select count(*)::int as n from public.yt_own_video_versions where channel_id in ($1, $2)', [c.canal, outro])).rows[0].n).toBe(0)
    expect((await pg.query('select count(*)::int as n from public.yt_own_versions_state where channel_id in ($1, $2)', [c.canal, outro])).rows[0].n).toBe(0)
  })

  it('apply_day: confirmação com id inexistente é recusada e o dia não avança; abertura inválida no meio não deixa nada', async () => {
    const c = await cenario()
    await aplicar(c)
    await expect(aplicar(c, { dia: diaPt(4), touch: [{ id: randomUUID(), seen_at: new Date().toISOString() }], open: [] })).rejects.toThrow(/touch_recusado/)
    expect((await pg.query('select derived_through::text as d from public.yt_own_versions_state where channel_id = $1', [c.canal])).rows[0].d).toBe(c.dia)
    const c2 = await cenario()
    const ruim = c2.abertura.map((a, i) => (i === 1 ? { ...a, field: 'x' } : a))
    await expect(aplicar(c2, { open: ruim })).rejects.toThrow()
    expect((await pg.query('select count(*)::int as n from public.yt_own_video_versions where channel_id = $1', [c2.canal])).rows[0].n).toBe(0)
  })

  it('remoção (item 201): a função de impacto soma as linhas das duas tabelas em serie_coletada', async () => {
    const c = await cenario()
    const antes = (await pg.query('select public.youtube_channel_removal_impact($1, $2) as r', [c.site, c.canal])).rows[0].r
    await aplicar(c)
    const depois = (await pg.query('select public.youtube_channel_removal_impact($1, $2) as r', [c.site, c.canal])).rows[0].r
    // 3 versões + 1 estado (a linha diária já estava em `antes`)
    expect(Number(depois.serie_coletada) - Number(antes.serie_coletada)).toBe(4)
  })
})
