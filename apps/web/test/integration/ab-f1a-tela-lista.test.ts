// @vitest-environment node
/**
 * F1a-tela-1 T3: RPC `ab_lab_volume` e `lerLinhasDoCaminho` contra o banco. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/ab-f1a-tela-lista --no-file-parallelism
 * O banco é compartilhado e sujo: toda asserção filtra pelo site semeado aqui.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerLinhasDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import { lerVolumes } from '@/lib/youtube/teste-youtube/nativo/volume'

vi.setConfig({ testTimeout: 90_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TIPO = 'channel_reach_basic_a1'

describe.skipIf(skipIfNoLocalDb())('F1a-tela-1 T3: volume por vídeo (RPC) e linhas da lista', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId: string
  let outroSite: string
  let canal: string
  let canalSemRelatorio: string
  let outroCanal: string
  const sites: string[] = []

  const novoCanal = async (site: string): Promise<string> => {
    const k = randomUUID().replace(/-/g, '')
    return String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + k.slice(0, 20), '@t3' + k.slice(0, 8), 'UU' + k.slice(0, 20), 't3-' + k.slice(0, 8)])).rows[0].id)
  }
  const yt = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
  const video = async (site: string, canalId: string, diasAtras: number): Promise<{ id: string; yt: string }> => {
    const y = yt()
    const id = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
      values ($1, $2, $3, 'Título ' || $3, now() - make_interval(days => $4::int), 600) returning id`, [site, canalId, y, diasAtras])).rows[0].id)
    return { id, yt: y }
  }
  /** Relatório normalizado de alcance para os `dias` mais recentes (dia = hoje_PT − i). */
  const relatorios = async (site: string, canalId: string, dias: number[], status = 'baixado'): Promise<void> => {
    for (const i of dias) {
      await pg.query(`insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, normalized_at)
        select $1, $2, 'job', $3, $4, d::timestamp at time zone 'UTC', d::timestamp at time zone 'UTC' + interval '1 day', now(), 'u', $6, now()
          from (select (now() at time zone 'America/Sao_Paulo')::date - $5::int as d) x`, ['r' + randomUUID(), site, canalId, TIPO, i, status])
    }
  }
  const alcance = async (site: string, canalId: string, v: { id: string; yt: string }, dia: number, impressoes: number): Promise<void> => {
    await pg.query(`insert into public.yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
      values ($1, (now() at time zone 'America/Sao_Paulo')::date - $5::int, $2, $3, $4, $6, 'r', now(), 'views_desde_2026-08-27')`, [v.yt, site, v.id, canalId, dia, impressoes])
  }
  const meta = (site: string, canalId: string, v: { yt: string }, privacidade: string, isShort: boolean | null): Promise<unknown> =>
    pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, is_short, privacy_status, captured_at)
      values ($1, (now() at time zone 'America/Sao_Paulo')::date, $2, $3, $4, $5, now())`, [v.yt, site, canalId, isShort, privacidade])

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    outroSite = (await seedSite(sb)).siteId
    sites.push(siteId, outroSite)
    canal = await novoCanal(siteId)
    canalSemRelatorio = await novoCanal(siteId)
    outroCanal = await novoCanal(outroSite)
  })
  afterAll(async () => {
    try {
      for (const t of ['ab_native_fichas', 'ab_native_tests', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_state_raw', 'yt_reporting_reports', 'youtube_videos', 'youtube_channels']) {
        await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
      }
      await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  describe('RPC ab_lab_volume', () => {
    it('o cliente de serviço recebe soma e dias_cobertos (nunca vazio por falta de auth.uid()); 3 linhas de 200 em 14 dias = 600', async () => {
      const v = await video(siteId, canal, 60)
      await relatorios(siteId, canal, Array.from({ length: 14 }, (_, i) => i + 1))
      for (const d of [2, 5, 9]) await alcance(siteId, canal, v, d, 200)
      const m = await lerVolumes(sb, siteId, [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 600, diasCobertos: 14 })
    })

    it('vídeo sem relatório (canal sem cobertura) vem com dias_cobertos = 0, nunca ausente', async () => {
      const v = await video(siteId, canalSemRelatorio, 60)
      const m = await lerVolumes(sb, siteId, [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 0, diasCobertos: 0 })
    })

    it('cobertura é por canal: o canal coberto não empresta dias ao canal sem relatório', async () => {
      const a = await video(siteId, canal, 60)
      const b = await video(siteId, canalSemRelatorio, 60)
      const m = await lerVolumes(sb, siteId, [a.id, b.id])
      expect(m.get(a.id)?.diasCobertos).toBe(14)
      expect(m.get(b.id)?.diasCobertos).toBe(0)
    })

    it('vídeo de outro site em p_videos não aparece', async () => {
      const meu = await video(siteId, canal, 60)
      const alheio = await video(outroSite, outroCanal, 60)
      const m = await lerVolumes(sb, siteId, [meu.id, alheio.id])
      expect(m.has(meu.id)).toBe(true)
      expect(m.has(alheio.id)).toBe(false)
    })

    it('28 dias cobertos e 3 linhas de 200 só fora dos 14 mais recentes: soma 0, 14 dias (a janela corta)', async () => {
      const c = await novoCanal(siteId)
      const v = await video(siteId, c, 60)
      await relatorios(siteId, c, Array.from({ length: 28 }, (_, i) => i + 1))
      for (const d of [20, 22, 25]) await alcance(siteId, c, v, d, 200)
      const m = await lerVolumes(sb, siteId, [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 0, diasCobertos: 14 })
    })

    it('relatório vazio conta como dia coberto (zero medido); dia sem relatório não entra', async () => {
      const c = await novoCanal(siteId)
      const v = await video(siteId, c, 60)
      await relatorios(siteId, c, [1, 2, 3, 4], 'vazio')
      await relatorios(siteId, c, [10]) // dias 5..9 sem relatório
      await alcance(siteId, c, v, 1, 50)
      const m = await lerVolumes(sb, siteId, [v.id])
      expect(m.get(v.id)).toMatchObject({ soma: 50, diasCobertos: 5 })
    })

    it('a janela começa em publicado + 1: dias anteriores à publicação não cobrem', async () => {
      const c = await novoCanal(siteId)
      const v = await video(siteId, c, 3) // publicado há 3 dias (PT): contam os dias 2 e 1 atrás e hoje não há relatório
      await relatorios(siteId, c, [1, 2, 3, 4, 5, 6])
      const m = await lerVolumes(sb, siteId, [v.id])
      expect(m.get(v.id)?.diasCobertos).toBeLessThanOrEqual(3)
      expect(m.get(v.id)?.diasCobertos).toBeGreaterThanOrEqual(2)
    })

    it('anon e authenticated NÃO têm EXECUTE (conferido por has_function_privilege, sem chamar a função)', async () => {
      const r = await pg.query(`select has_function_privilege('anon', 'public.ab_lab_volume(uuid, uuid[])', 'execute') as anon,
        has_function_privilege('authenticated', 'public.ab_lab_volume(uuid, uuid[])', 'execute') as auth,
        has_function_privilege('service_role', 'public.ab_lab_volume(uuid, uuid[])', 'execute') as svc`)
      expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true })
    })

    it('40 vídeos × 28 dias de alcance (mais de 1000 linhas): nenhum perde volume', async () => {
      const c = await novoCanal(siteId)
      await relatorios(siteId, c, Array.from({ length: 28 }, (_, i) => i + 1))
      const vs = await Promise.all(Array.from({ length: 40 }, () => video(siteId, c, 90)))
      await pg.query(`insert into public.yt_own_video_reach_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
        select v.yt, (now() at time zone 'America/Sao_Paulo')::date - g, $1, v.id, $2, 400, 'r', now(), 'views_desde_2026-08-27'
          from jsonb_to_recordset($3::jsonb) as v(id uuid, yt text), generate_series(1, 28) g`, [siteId, c, JSON.stringify(vs)])
      const m = await lerVolumes(sb, siteId, vs.map((v) => v.id))
      expect(m.size).toBe(40)
      for (const v of vs) expect(m.get(v.id)).toMatchObject({ soma: 400 * 14, diasCobertos: 14 })
    })
  })

  describe('lerLinhasDoCaminho', () => {
    it('25 vídeos (um privado), 1 ficha aberta num antigo, 1 registro em_andamento: 22 linhas, ≤ 7 consultas, nada de outro site', async () => {
      const s = (await seedSite(sb)).siteId
      const o = (await seedSite(sb)).siteId
      sites.push(s, o)
      const c = await novoCanal(s)
      const co = await novoCanal(o)
      await relatorios(s, c, Array.from({ length: 14 }, (_, i) => i + 1))
      const vs: { id: string; yt: string }[] = []
      for (let i = 1; i <= 25; i++) vs.push(await video(s, c, 30 + i))
      // vs[i] publicado há 31+i dias: vs[0] é o mais novo. O privado é o 3º; a ficha vai no 24º e o registro no 25º.
      for (let i = 0; i < 25; i++) await meta(s, c, vs[i]!, i === 2 ? 'private' : 'public', i === 23 ? null : false)
      const alheio = await video(o, co, 1)
      await meta(o, co, alheio, 'public', false)
      await pg.query(`insert into public.ab_native_fichas (site_id, video_id, campos, variantes) values ($1, $2, '{titulo}', $3::jsonb)`,
        [s, vs[23]!.id, JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B' }])])
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra)
        values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', '["A","B"]'::jsonb, now() - interval '2 days', 1)`, [s, vs[24]!.id, vs[24]!.yt])

      let consultas = 0
      const espiao = new Proxy(sb as SupabaseClient, {
        get(alvo, prop, recv) {
          const real = Reflect.get(alvo, prop, recv) as unknown
          if ((prop === 'from' || prop === 'rpc') && typeof real === 'function') {
            return (...a: unknown[]) => { consultas++; return (real as (...x: unknown[]) => unknown).apply(alvo, a) }
          }
          return real
        },
      })
      const linhas = await lerLinhasDoCaminho(espiao, s, new Date())
      expect(linhas).toHaveLength(22)
      expect(consultas).toBeLessThanOrEqual(7)
      const ids = new Set(linhas.map((l) => l.videoId))
      expect(ids.has(vs[2]!.id)).toBe(false) // privado fora
      expect(ids.has(vs[23]!.id)).toBe(true) // ficha
      expect(ids.has(vs[24]!.id)).toBe(true) // registro
      expect(ids.has(alheio.id)).toBe(false)
      expect(linhas.find((l) => l.videoId === vs[24]!.id)?.estado).toBe('em_teste_studio')
      expect(linhas.find((l) => l.videoId === vs[23]!.id)?.estado).toBe('em_preparo')
      expect(linhas.find((l) => l.videoId === vs[23]!.id)?.fichaId).not.toBeNull()
    })

    it('volume por dia chega à linha; vídeo de canal sem relatório fica com impressoesPorDia nulo', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const c2 = await novoCanal(s)
      await relatorios(s, c, Array.from({ length: 14 }, (_, i) => i + 1))
      const a = await video(s, c, 40)
      const b = await video(s, c2, 41)
      for (let d = 1; d <= 14; d++) await alcance(s, c, a, d, 300)
      for (const v of [a, b]) await meta(s, v === a ? c : c2, v, 'public', false)
      // O bruto diz que não é para crianças: sem ele o roteador cai, com razão, em "formato não confirmado".
      await pg.query(`insert into public.yt_own_video_state_raw (youtube_video_id, site_id, channel_id, state_sha256, raw, observed_at)
        values ($1, $2, $3, $4, '{"status":{"madeForKids":false}}'::jsonb, now())`, [a.yt, s, c, randomUUID().replace(/-/g, '')])
      const linhas = await lerLinhasDoCaminho(sb, s, new Date())
      expect(linhas.find((l) => l.videoId === a.id)?.impressoesPorDia).toBe(300)
      expect(linhas.find((l) => l.videoId === a.id)?.estado).toBe('sugerido_youtube')
      expect(linhas.find((l) => l.videoId === b.id)?.impressoesPorDia).toBeNull()
      expect(linhas.find((l) => l.videoId === b.id)?.estado).toBe('formato_nao_confirmado')
    })

    it('registro.variantes: ficha já vinculada (2 versões) vem preenchida; origem derivada vem nula', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const a = await video(s, c, 20)
      const b = await video(s, c, 21)
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, confirmado_em, primeira_vista, variantes, variantes_titulo, versao_regra)
        values ($1, $2, $3, 'confirmado', '{titulo}', 'em_andamento', now() - interval '15 days', now() - interval '15 days', $4::jsonb, null, 1)`,
        [s, a.id, a.yt, JSON.stringify([{ n: 1, tipo: 'titulo', titulo: 'A' }, { n: 2, tipo: 'titulo', titulo: 'B', imagem: { url: 'https://x/y.png' } }])])
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, primeira_vista, variantes_titulo, versao_regra)
        values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', now() - interval '3 days', '["A","B"]'::jsonb, 1)`, [s, b.id, b.yt])
      const linhas = await lerLinhasDoCaminho(sb, s, new Date())
      const la = linhas.find((l) => l.videoId === a.id)!
      const lb = linhas.find((l) => l.videoId === b.id)!
      expect(la.estado).toBe('resultado_pronto')
      expect(la.registro?.variantes).toEqual([{ n: 1, titulo: 'A', imagem: null }, { n: 2, titulo: 'B', imagem: { url: 'https://x/y.png' } }])
      expect(lb.registro?.variantes).toBeNull()
      expect(lb.registro?.variantesTitulo).toEqual(['A', 'B'])
      expect(lb.estado).toBe('em_teste_studio')
    })

    it('nosso teste pausado com registro aberto: labPausadoAte é o instante início + 16 d', async () => {
      const s = (await seedSite(sb)).siteId
      sites.push(s)
      const c = await novoCanal(s)
      const a = await video(s, c, 20)
      const ini = new Date(Date.now() - 3 * 86_400_000)
      await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, primeira_vista, variantes_titulo, versao_regra)
        values ($1, $2, $3, 'detectado', '{titulo}', 'em_andamento', $4, '["A","B"]'::jsonb, 1)`, [s, a.id, a.yt, ini.toISOString()])
      await pg.query(`insert into public.ab_tests (site_id, youtube_video_id, name, status, original_thumbnail_url, started_at, paused_at)
        values ($1, $2, 'n', 'paused', 'https://x/t.png', now() - interval '2 days', now())`, [s, a.id])
      const l = (await lerLinhasDoCaminho(sb, s, new Date())).find((x) => x.videoId === a.id)!
      expect(l.nosso?.status).toBe('paused')
      expect(l.labPausadoAte).toBe(new Date(ini.getTime() + 16 * 86_400_000).toISOString())
    })
  })
})
