// @vitest-environment node
/**
 * F4 T6: migration do tipo 'titulo-complementar' da fila da forja. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f4-forja-tipo.test.ts --no-file-parallelism
 * A migration é aplicada pelo próprio teste (idempotente) e reaplicada; o caso "dois vídeos passam" roda antes e depois.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
const ARQ = readdirSync(DIR).find(f => f.endsWith('_f4_forja_titulo_complementar.sql'))!
// só a parte executável: o caminho de volta está em comentário
const SQL = readFileSync(DIR + ARQ, 'utf8')

describe.skipIf(skipIfNoLocalDb())('F4 T6: fila da forja, titulo-complementar (bythiago_int)', () => {
  let pg: Client
  let site = ''
  let canal = ''
  const nicho = 'f4t6-' + randomUUID().slice(0, 6)

  const q = async (sql: string, p: unknown[] = []) => (await pg.query(sql, p)).rows
  async function video(): Promise<string> {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    return String((await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1,$2,$3,'t', now()) returning id`, [site, canal, yt]))[0]!.id)
  }
  async function pedido(c: Partial<Record<string, unknown>>) {
    const v = { task_type: 'titulo-complementar', target_niche: nicho, target_own_video_id: null, target_signal_id: null, target_video_id: null, ...c }
    return pg.query(`insert into public.youtube_intelligence_tasks (site_id, trigger_type, task_type, target_niche, target_own_video_id, target_signal_id, target_video_id)
      values ($1,'manual',$2,$3,$4,$5,$6) returning id`, [site, v.task_type, v.target_niche, v.target_own_video_id, v.target_signal_id, v.target_video_id])
  }
  const falha = async (p: Promise<unknown>): Promise<string> => {
    try { await p; return 'ok' } catch (e) { const x = e as { code?: string; constraint?: string }; return `${x.code ?? 'erro'}:${x.constraint ?? ''}` }
  }
  const TARGET = '23514:youtube_intelligence_tasks_target_check'
  const ALVO = '23514:competitor_readings_alvo_titulo_check'
  const limpa = () => q(`delete from public.youtube_intelligence_tasks where site_id=$1`, [site])

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    // estado de producao: indice antigo, para provar a TROCA (T6-P4/Y3)
    await pg.query(`drop index if exists idx_yt_intel_obs_active;
      create unique index idx_yt_intel_obs_active on youtube_intelligence_tasks (site_id, task_type, target_niche)
      where status in ('pending','running') and task_type <> 'diagnostico'`)
    await pg.query(SQL)
    expect((await q(`select pg_get_indexdef('idx_yt_intel_obs_active'::regclass) d`))[0]!.d).toContain('titulo-complementar')
    site = (await seedSite(getSupabaseServiceClient())).siteId
    await q(`insert into public.youtube_niches (site_id, slug, label, color_dark, color_light) values ($1,$2,'T','#AAB4C0','#4B5563')`, [site, nicho])
    const x = randomUUID().replace(/-/g, '')
    canal = String((await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1,$2,'pt',$3,'Teste',$4,$5,true) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)]))[0]!.id)
  })
  afterAll(async () => {
    try {
      if (site) {
        for (const t of ['competitor_readings', 'youtube_intelligence_tasks', 'niche_signals', 'youtube_videos', 'youtube_channels'])
          await pg.query(`delete from public.${t} where site_id = $1`, [site])
        await apagarSites(pg, 'id = $1', [site])
      }
    } finally { await pg.end() }
  })

  async function bateria(emTx = false) {
    await limpa()
    const sig = randomUUID()
    const [v1, v2] = [await video(), await video()]
    // dois vídeos nossos diferentes do mesmo nicho passam
    await pedido({ target_own_video_id: v1, target_signal_id: sig })
    await pedido({ target_own_video_id: v2, target_signal_id: sig })
    // o mesmo vídeo × sinal duas vezes: 23505
    if (emTx) await pg.query('savepoint dup')
    expect(await falha(pedido({ target_own_video_id: v1, target_signal_id: sig }))).toBe('23505:idx_yt_intel_titulo_active')
    if (emTx) await pg.query('rollback to savepoint dup')
    await limpa()
  }

  it('dois vídeos nossos do mesmo nicho passam; o mesmo vídeo × sinal dá 23505', () => bateria())

  it('CHECKs: target_video_id preenchido, tipo inválido, sinal nulo, sem nicho', async () => {
    const [v, sig] = [await video(), randomUUID()]
    const cc = String((await q(`insert into public.competitor_channels (site_id, channel_id, niche) values ($1,$2,$3) returning id`, [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 22), nicho]))[0]!.id)
    const terceiro = String((await q(`insert into public.competitor_videos (competitor_channel_id, video_id) values ($1,$2) returning id`, [cc, 'v' + randomUUID().slice(0, 10)]))[0]!.id)
    expect(await falha(pedido({ target_own_video_id: v, target_signal_id: sig, target_video_id: terceiro }))).toBe(TARGET)
    expect(await falha(pedido({ task_type: 'xyz' }))).toBe('23514:youtube_intelligence_tasks_task_type_check')
    expect(await falha(pedido({ target_own_video_id: v, target_signal_id: null }))).toBe(TARGET)
    expect(await falha(pedido({ target_own_video_id: v, target_signal_id: sig, target_niche: null }))).toBe(TARGET)
    expect(await falha(pedido({ target_own_video_id: null, target_signal_id: sig }))).toBe(TARGET)
    // tipos legados nao carregam o alvo novo (T6-P1/Y1)
    expect(await falha(pedido({ task_type: 'temas', target_own_video_id: v }))).toBe(TARGET)
    expect(await falha(pedido({ task_type: 'temas', target_signal_id: randomUUID() }))).toBe(TARGET)
    expect(await falha(q(`insert into public.youtube_intelligence_tasks (site_id, trigger_type, task_type, channel_id, target_own_video_id)
      values ($1,'manual','diagnostico',$2,$3)`, [site, canal, v]))).toBe(TARGET)
  })

  it('apagar o niche_signals referenciado não falha nem altera a linha (sem FK)', async () => {
    const v = await video()
    const sig = String((await q(`insert into public.niche_signals (site_id, kind, subject_key, rule_version, evidence, forca, acao, first_seen_at, computed_at, expires_at, motivo)
      values ($1,'destino','k','v1','{}',1,'titulo_complementar',now(),now(),now()+interval '1 day','m') returning id`, [site]))[0]!.id)
    const id = String((await pedido({ target_own_video_id: v, target_signal_id: sig })).rows[0]!.id)
    await q(`delete from public.niche_signals where id=$1`, [sig])
    const r = await q(`select target_signal_id from public.youtube_intelligence_tasks where id=$1`, [id])
    expect(r[0]!.target_signal_id).toBe(sig)
    await limpa()
  })

  it('o índice antigo foi trocado: tipos legados seguem únicos por nicho, o novo não entra nele', async () => {
    await pedido({ task_type: 'temas' })
    expect(await falha(pedido({ task_type: 'temas' }))).toBe('23505:idx_yt_intel_obs_active')
    await limpa()
  })

  it('competitor_readings aceita own_video_id e signal_id sem FK de sinal', async () => {
    const v = await video()
    await q(`insert into public.competitor_readings (site_id, task_type, niche, model, generated_at, sent, text, own_video_id, signal_id)
      values ($1,'titulo-complementar',$2,'m',now(),'{}','{}',$3,$4)`, [site, nicho, v, randomUUID()])
    const ix = await q(`select 1 from pg_indexes where tablename='competitor_readings' and indexdef ilike '%own_video_id%'`)
    expect(ix.length).toBe(1)
  })

  it('competitor_readings: tipo e alvo andam juntos (T6-P2/Y2)', async () => {
    const v = await video()
    const ins = (tipo: string, own: string | null, sig: string | null) => q(`insert into public.competitor_readings (site_id, task_type, niche, model, generated_at, sent, text, own_video_id, signal_id)
      values ($1,$2,$3,'m',now(),'{}','{}',$4,$5)`, [site, tipo, nicho, own, sig])
    expect(await falha(ins('titulo-complementar', null, null))).toBe(ALVO)
    expect(await falha(ins('titulo-complementar', null, randomUUID()))).toBe(ALVO)
    expect(await falha(ins('titulo-complementar', v, null))).toBe(ALVO)
    expect(await falha(ins('temas', v, randomUUID()))).toBe(ALVO)
    expect(await falha(ins('temas', null, null))).toBe('ok')
  })

  it('reaplicar a migration não falha e os dois vídeos seguem passando', async () => {
    await pg.query(SQL)
    await bateria()
  })

  it('caminho de volta: apaga o tipo novo, recria o estado antigo e o estado novo volta a aplicar', async () => {
    const v = await video()
    await pedido({ target_own_video_id: v, target_signal_id: randomUUID() })
    const volta = SQL.split('\n').filter(l => l.startsWith('--   ')).map(l => l.slice(5)).join('\n')
    expect(volta).toContain('delete from youtube_intelligence_tasks')
    try {
      await pg.query('begin')
      await pg.query(volta)
      const def = async (n: string) => String((await q(`select pg_get_constraintdef(oid) d from pg_constraint where conname=$1`, [n]))[0]!.d)
      expect(await def('youtube_intelligence_tasks_target_check')).not.toContain('titulo-complementar')
      expect(await def('youtube_intelligence_tasks_task_type_check')).not.toContain('titulo-complementar')
      expect((await q(`select 1 from pg_constraint where conname='competitor_readings_alvo_titulo_check'`)).length).toBe(0)
      const idx = String((await q(`select pg_get_indexdef('idx_yt_intel_obs_active'::regclass) d`))[0]!.d)
      expect(idx).toContain(`<> 'diagnostico'`)
      expect(idx).not.toContain('titulo-complementar')
      expect(Number((await q(`select count(*)::int n from information_schema.columns where table_schema='public'
        and table_name in ('youtube_intelligence_tasks','competitor_readings')
        and column_name in ('target_own_video_id','target_signal_id','own_video_id','signal_id')`))[0]!.n)).toBe(0)
      // com as colunas antigas, o tipo novo e barrado pelo CHECK antigo (23514, nao 42703)
      expect(await falha(pg.query(`insert into public.youtube_intelligence_tasks (site_id, trigger_type, task_type, target_niche)
        values ($1,'manual','titulo-complementar',$2)`, [site, nicho]))).toMatch(/^23514:/)
      await pg.query('rollback')
      // "volta a aplicar": a volta desfeita, o SQL reaplica e a bateria passa
      await pg.query('begin')
      await pg.query(volta)
      await pg.query(SQL)
      await bateria(true)
      await pg.query('rollback') // a volta e testada e desfeita: o banco fica no estado novo
    } finally { await pg.query('rollback').catch(() => undefined) }
    await limpa()
    await bateria()
  })
})
