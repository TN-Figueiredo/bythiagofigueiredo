// @vitest-environment node
/**
 * F4 T2 (R2-P1): o `detail` vazio da origem "vídeos sugeridos" passa pelo PostgREST real. `lerDetalheDiario` com `details: [id]` devolve só a linha do
 * terceiro; com `semOrigem: true` devolve a de `detail = ''`; com `details: []` a de `detail = ''` ainda volta (nunca `''` dentro de `in`). E a
 * contagem do código 32 (`contarOrigem`) conta sem olhar o `detail`. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/f4-detalhe-vazio.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID, createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { apagarSites } from '../helpers/limpa-cena'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { contarOrigem, lerDetalheDiario, type AlvoConsulta } from '@/lib/youtube/observatorio/proprio/consultas'
import { ORIGEM_SUGERIDOS } from '@/lib/youtube/reporting/codigos'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const sha = (s: string): string => createHash('sha256').update(s).digest('hex')
const TERCEIRO = 'TERC0000001'

describe.skipIf(skipIfNoLocalDb())('F4 T2: detail vazio pelo PostgREST real', () => {
  let pg: Client
  let site = ''
  let canal = ''
  const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
  const sb = (): SupabaseClient => getSupabaseServiceClient() as unknown as SupabaseClient
  const alvo = (): AlvoConsulta => ({ siteId: site, canalId: null, ytIds: [yt], de: '2026-10-01', ate: '2026-10-28', teto: 1000 })

  async function grava(dia: string, tipo: string, detail: string, views: number): Promise<void> {
    await pg.query(
      `insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'rep-f4', now(), 'views_desde_2026-08-27')`,
      [yt, dia, tipo, detail, sha(detail), site, canal, views])
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    site = (await seedSite(getSupabaseServiceClient())).siteId
    const x = randomUUID().replace(/-/g, '')
    const c = await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5, true) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'f4-' + x.slice(0, 8)])
    canal = String(c.rows[0].id)
    await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1, $2, $3, 'Teste', now() - interval '60 days')`, [site, canal, yt])
    await grava('2026-10-10', ORIGEM_SUGERIDOS, '', 7)
    await grava('2026-10-11', ORIGEM_SUGERIDOS, TERCEIRO, 3)
    await grava('2026-10-12', '32', 'qualquer', 1)
  })
  afterAll(async () => {
    try {
      if (site) {
        for (const t of ['yt_own_video_traffic_detail_daily', 'youtube_videos', 'youtube_channels']) await pg.query(`delete from public.${t} where site_id = $1`, [site])
        await apagarSites(pg, 'id = $1', [site])
      }
    } finally { await pg.end() }
  })

  const lido = async (filtro: Parameters<typeof lerDetalheDiario>[2]) => {
    const r = await lerDetalheDiario(sb(), alvo(), filtro)
    if (r.ausente) throw new Error('tabela ausente')
    return r.linhas
  }

  it('details: [id] devolve só a linha do terceiro', async () => {
    const l = await lido({ sourceType: ORIGEM_SUGERIDOS, details: [TERCEIRO] })
    expect(l.map((r) => r.detail)).toEqual([TERCEIRO])
  })
  it('semOrigem: true devolve só a de detail vazio (dia e vídeo)', async () => {
    const l = await lido({ sourceType: ORIGEM_SUGERIDOS, details: [], semOrigem: true })
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ youtube_video_id: yt, day_pt: '2026-10-10' })
  })
  it('details: [] com semOrigem: a de detail vazio ainda volta', async () => {
    expect((await lido({ sourceType: ORIGEM_SUGERIDOS, details: [], semOrigem: true })).length).toBe(1)
  })
  it('contarOrigem do 32 conta sem filtrar detail; do sugerido conta as duas', async () => {
    const c32 = await contarOrigem(sb(), site, [canal], '32', '2026-10-01', '2026-10-28')
    expect(c32).toEqual({ ausente: false, linhas: [1] })
    const c7 = await contarOrigem(sb(), site, [canal], ORIGEM_SUGERIDOS, '2026-10-01', '2026-10-28')
    expect(c7).toEqual({ ausente: false, linhas: [2] })
    expect(await contarOrigem(sb(), site, [], '32', '2026-10-01', '2026-10-28')).toEqual({ ausente: false, linhas: [0] })
  })
})
