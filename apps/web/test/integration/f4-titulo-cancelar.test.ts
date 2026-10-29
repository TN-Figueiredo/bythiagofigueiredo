// @vitest-environment node
/**
 * F4 T7: pedidos `titulo-complementar` de dois vídeos nossos do mesmo nicho; cancelar um não apaga o outro (R2-Y1).
 * Banco: SÓ o `bythiago_int` (não sobe nem reinicia banco):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/f4-titulo-cancelar.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { apagarSites } from '../helpers/limpa-cena'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { cancelReading } from '@/lib/pipeline/services/forja-queue'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('F4 T7: cancelar titulo-complementar não apaga o pedido de outro vídeo (bythiago_int)', () => {
  let pg: Client
  let site = ''
  let canal = ''
  const nicho = 'f4t7-' + randomUUID().slice(0, 6)
  const sb = (): SupabaseClient => getSupabaseServiceClient() as unknown as SupabaseClient
  const ctx = (): ServiceContext => ({ siteId: site, permissions: ['read', 'intelligence'], keyId: '00000000-0000-4000-8000-00000000f0f0', supabase: sb(), source: 'api_key' } as ServiceContext)
  const q = async (sql: string, p: unknown[] = []) => (await pg.query(sql, p)).rows
  const video = async (): Promise<string> => String((await q(
    `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1,$2,$3,'t', now()) returning id`,
    [site, canal, 'y' + randomUUID().replace(/-/g, '').slice(0, 10)]))[0]!.id)
  const pedido = (v: string, sig: string) => sb().from('youtube_intelligence_tasks').insert({
    site_id: site, task_type: 'titulo-complementar', target_niche: nicho, target_own_video_id: v, target_signal_id: sig, target_fmt: null,
    trigger_type: 'manual', status: 'pending', sent: { pedido: {} },
  }).select('id').single()
  const restantes = async (): Promise<string[]> => (await q(`select target_own_video_id id from public.youtube_intelligence_tasks where site_id=$1 and task_type='titulo-complementar'`, [site])).map(r => String(r.id))

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    site = (await seedSite(getSupabaseServiceClient())).siteId
    await q(`insert into public.youtube_niches (site_id, slug, label, color_dark, color_light) values ($1,$2,'T','#AAB4C0','#4B5563')`, [site, nicho])
    const x = randomUUID().replace(/-/g, '')
    canal = String((await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1,$2,'pt',$3,'Teste',$4,$5,true) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)]))[0]!.id)
  })
  afterAll(async () => {
    try {
      if (site) {
        for (const t of ['youtube_intelligence_tasks', 'youtube_videos', 'youtube_channels']) await pg.query(`delete from public.${t} where site_id = $1`, [site])
        await apagarSites(pg, 'id = $1', [site])
      }
    } finally { await pg.end() }
  })

  it('dois vídeos do mesmo nicho e mesmo sinal: cancelar um mantém o outro', async () => {
    const sig = randomUUID()
    const [v1, v2] = [await video(), await video()]
    expect((await pedido(v1, sig)).error).toBeNull()
    expect((await pedido(v2, sig)).error).toBeNull()
    expect(await restantes()).toHaveLength(2)

    const r = await cancelReading(ctx(), { type: 'titulo-complementar', niche: nicho as never, ownVideoId: v1, signalId: sig })
    expect(r.data).toEqual({ cancelled: true })
    expect(await restantes()).toEqual([v2])

    // cancelar de novo o mesmo par não encontra nada e continua sem tocar no outro
    const de_novo = await cancelReading(ctx(), { type: 'titulo-complementar', niche: nicho as never, ownVideoId: v1, signalId: sig })
    expect(de_novo.data).toEqual({ cancelled: false })
    expect(await restantes()).toEqual([v2])
  })
})
