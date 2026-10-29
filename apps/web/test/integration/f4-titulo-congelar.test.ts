// @vitest-environment node
/**
 * F4 T7 (C-P3, C-Y4): o caminho do GET do `titulo-complementar` no PostgREST REAL: o CAS `sent->numbers IS NULL` congela o pacote no
 * 1º `readSent`, o 2º devolve a MESMA cópia sem remontar, e dois `askTitulo` do mesmo par terminam com uma linha e um "já há um pedido".
 * Banco: SÓ o `bythiago_int` (não sobe nem reinicia banco):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/f4-titulo-congelar.test.ts
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
import { askReading, readSent } from '@/lib/pipeline/services/forja-queue'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const KEY = '00000000-0000-4000-8000-00000000f0f0'

describe.skipIf(skipIfNoLocalDb())('F4 T7: congelar o pacote do titulo-complementar e a corrida do pedido (bythiago_int)', () => {
  let pg: Client
  let site = ''
  let canalProprio = ''
  let canalTerc = ''
  let ownVideo = ''
  let terc1 = ''
  let sinal = ''
  const sb = (): SupabaseClient => getSupabaseServiceClient() as unknown as SupabaseClient
  const ctx = (): ServiceContext => ({ siteId: site, permissions: ['read', 'intelligence'], keyId: KEY, supabase: sb(), source: 'api_key' } as ServiceContext)
  const q = async (sql: string, p: unknown[] = []) => (await pg.query(sql, p)).rows
  const x = (n: number) => randomUUID().replace(/-/g, '').slice(0, n)

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    site = (await seedSite(getSupabaseServiceClient())).siteId
    canalProprio = String((await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1,$2,'pt',$3,'Eu',$4,$5,true) returning id`, [site, 'UC' + x(22), '@e' + x(8), 'UU' + x(22), 'eu-' + x(8)]))[0]!.id)
    ownVideo = String((await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, description, published_at)
      values ($1,$2,$3,'Vietnã em 3 dias','Roteiro completo', now() - interval '10 days') returning id`, [site, canalProprio, 'y' + x(10)]))[0]!.id)
    canalTerc = String((await q(`insert into public.competitor_channels (site_id, channel_id, channel_name, niche) values ($1,$2,'Canal Terc','viagem') returning id`, [site, 'UCt' + x(21)]))[0]!.id)
    terc1 = String((await q(`insert into public.competitor_videos (competitor_channel_id, video_id, title, view_count, published_at, is_short)
      values ($1,$2,'Da Nang: 10 praias',90000, now() - interval '3 days', false) returning id`, [canalTerc, 'v' + x(10)]))[0]!.id)
    const evidence = { outliers: [{ video_id: terc1, canal_id: canalTerc, published_at: new Date().toISOString(), mult_vpd7: 9, mult_tela: 9, vpd7: 1500, formato: 'long' }], outliers_total: 1, canais: 1, proprios: [] }
    sinal = String((await q(`insert into public.niche_signals (site_id, kind, subject_key, rule_version, evidence, forca, acao, status, first_seen_at, computed_at, expires_at, motivo)
      values ($1,'destino','pais:VN','sinais-v1',$2,10,'titulo_complementar','aberto', now(), now(), now() + interval '20 days','teste') returning id`, [site, JSON.stringify(evidence)]))[0]!.id)
    await q(`insert into public.forja_heartbeat (site_id, last_poll_at, capabilities) values ($1, now(), '{titulo-complementar}')`, [site])
  })
  afterAll(async () => {
    try {
      if (site) {
        for (const t of ['competitor_readings', 'youtube_intelligence_tasks', 'niche_signals', 'forja_heartbeat', 'youtube_videos', 'youtube_channels', 'audit_log']) await pg.query(`delete from public.${t} where site_id = $1`, [site])
        await apagarSites(pg, 'id = $1', [site])
      }
    } finally { await pg.end() }
  })

  it('dois askTitulo do mesmo par em paralelo: uma linha gravada e um "já há um pedido" (índice parcial + 23505)', async () => {
    const pedir = () => askReading(ctx(), { type: 'titulo-complementar', scope: 'todos', ownVideoId: ownVideo, signalId: sinal, userId: randomUUID() } as never, Date.now())
    const [a, b] = await Promise.all([pedir(), pedir()])
    const oks = [a, b].filter(r => r.data.ok)
    expect(oks, JSON.stringify([a.data, b.data])).toHaveLength(1)
    const recusado = [a, b].find(r => !r.data.ok)!
    expect(recusado.data.reason).toMatch(/já há um pedido/)
    const linhas = await q(`select id, status, sent from public.youtube_intelligence_tasks where site_id=$1 and task_type='titulo-complementar'`, [site])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]!.sent.pedido.outliers).toHaveLength(1)
    expect(linhas[0]!.sent.numbers).toBeUndefined()
  })

  it('readSent: 1º GET congela por sent->numbers (grava no banco); o 2º devolve a MESMA cópia; as duas leituras concorrentes concordam', async () => {
    const [t] = await q(`select id from public.youtube_intelligence_tasks where site_id=$1 and task_type='titulo-complementar'`, [site])
    const id = String(t!.id)
    await q(`update public.youtube_intelligence_tasks set status='running', started_at=now(), result_summary='{"claimed_by":"${KEY}"}'::jsonb where id=$1`, [id])

    const pedidoOriginal = (await q('select sent from public.youtube_intelligence_tasks where id=$1', [id]))[0]!.sent
    const r1 = await readSent(ctx(), id, Date.now())
    expect(Array.isArray(r1.data.sent.numbers)).toBe(true)
    expect(r1.data.sent.titulo_complementar).toBeTruthy()
    const [gravado] = await q(`select sent from public.youtube_intelligence_tasks where id=$1`, [id])
    expect(Array.isArray(gravado!.sent.numbers)).toBe(true)
    expect(gravado!.sent).toEqual(r1.data.sent)

    // muda o mundo: o 2º GET não pode remontar (o título do vídeo mudou, a cópia congelada não)
    await q(`update public.youtube_videos set title='Outro título agora' where id=$1`, [ownVideo])
    const r2 = await readSent(ctx(), id, Date.now())
    expect(r2.data.sent).toEqual(r1.data.sent)

    // corrida: dois GETs numa tarefa recém-tornada "não congelada" terminam com a mesma cópia
    await q(`update public.youtube_intelligence_tasks set sent = $2::jsonb where id=$1`, [id, JSON.stringify(pedidoOriginal)])
    const [c, d] = await Promise.all([readSent(ctx(), id, Date.now()), readSent(ctx(), id, Date.now())])
    expect(c.data.sent).toEqual(d.data.sent)
  })
  // vídeo nosso apagado: o FK apaga a tarefa junto (nada a ler); o ramo 422 do alvo ausente é coberto em test/youtube/forja-queue-titulo.test.ts
})
