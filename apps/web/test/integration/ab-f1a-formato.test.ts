// @vitest-environment node
/**
 * F1a-dado T7: RPC `ab_lab_formato_atual` e `lerFormatos` contra o banco. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-formato --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerFormatos } from '@/lib/youtube/teste-youtube/nativo/formato-borda'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const minutos = (n: number): string => new Date(Date.now() - n * 60_000).toISOString()

describe.skipIf(skipIfNoLocalDb())('F1a-dado T7: formato atual do vídeo (RPC)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let outroSite: string
  let canal: string
  const ytId = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    outroSite = (await seedSite(sb)).siteId
    const k = randomUUID().replace(/-/g, '')
    canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@f7' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'f1a7-' + k.slice(0, 8)])).rows[0].id)
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.yt_own_video_state_raw where site_id = $1', [siteId])
      await pg.query('delete from public.yt_own_video_meta_daily where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_videos where site_id = $1', [siteId])
      await pg.query('delete from public.youtube_channels where site_id = $1', [siteId])
      await apagarSites(pg, 'id = any($1::uuid[])', [[siteId, outroSite]])
    } finally {
      await pg.end()
    }
  })

  const video = async (duracao = 0): Promise<{ id: string; yt: string; ytId: string }> => {
    const yt = ytId()
    const id = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
      values ($1, $2, $3, 'T', now(), $4) returning id`, [siteId, canal, yt, duracao])).rows[0].id)
    return { id, yt, ytId: yt }
  }
  const bruto = (yt: string, raw: unknown, minAtras: number): Promise<unknown> =>
    pg.query(`insert into public.yt_own_video_state_raw (youtube_video_id, site_id, channel_id, state_sha256, raw, observed_at) values ($1, $2, $3, $4, $5::jsonb, $6)`,
      [yt, siteId, canal, randomUUID().replace(/-/g, ''), JSON.stringify(raw), minutos(minAtras)])
  const meta = (yt: string, dia: string, isShort: boolean | null): Promise<unknown> =>
    pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, is_short, captured_at) values ($1, $2::date, $3, $4, $5, now())`, [yt, dia, siteId, canal, isShort])

  it('3 versões do bruto por vídeo: só a mais nova é lida; is_short é o do dia mais recente', async () => {
    const v = await video()
    await bruto(v.yt, { status: { madeForKids: true } }, 300)
    await bruto(v.yt, { status: { madeForKids: true } }, 200)
    await bruto(v.yt, { status: { madeForKids: false }, snippet: { liveBroadcastContent: 'none' } }, 10)
    await meta(v.yt, '2026-10-01', true)
    await meta(v.yt, '2026-10-02', false)
    const m = await lerFormatos(sb, siteId, [v])
    expect(m.get(v.id)).toEqual({ isShort: false, kids: false, adulto: null, aoVivo: false })
  })

  it('vídeo sem meta nem bruto, duração 1200: isShort false pela duração; duração curta fica nula', async () => {
    const longo = await video(1200)
    const curto = await video(90)
    const m = await lerFormatos(sb, siteId, [longo, curto])
    expect(m.get(longo.id)).toEqual({ isShort: false, kids: null, adulto: null, aoVivo: null })
    expect(m.get(curto.id)).toEqual({ isShort: null, kids: null, adulto: null, aoVivo: null })
  })

  it('o RPC não enxerga o bruto de outro site (site_id do parâmetro)', async () => {
    const v = await video()
    await bruto(v.yt, { status: { madeForKids: true } }, 10)
    const r = await pg.query(`select * from public.ab_lab_formato_atual($1, array[$2]::text[])`, [outroSite, v.yt])
    expect(r.rows.every((x) => x.raw === null)).toBe(true)
  })

  it('privilégios: só service_role executa; security invoker; search_path vazio', async () => {
    const fn = 'public.ab_lab_formato_atual(uuid,text[])'
    for (const role of ['authenticated', 'anon', 'public']) expect((await pg.query(`select has_function_privilege($1, $2, 'execute') as x`, [role, fn])).rows[0].x, role).toBe(false)
    expect((await pg.query(`select has_function_privilege('service_role', $1, 'execute') as x`, [fn])).rows[0].x).toBe(true)
    const p = await pg.query(`select prosecdef, proconfig from pg_proc where oid = $1::regprocedure`, [fn])
    expect(p.rows[0].prosecdef).toBe(false)
    expect(String(p.rows[0].proconfig)).toContain('search_path=""')
  })
})
