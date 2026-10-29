// @vitest-environment node
/**
 * F2b T4: o passo `medirD2` e as séries REAIS contra o banco de integração (funções da T2 reais, sem dublê de série).
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2b-passo.test.ts --no-file-parallelism
 * Cena (datas relativas a now(), que é o relógio das funções): V0 há 120 d; OUT2 (limpo) publicado há 55 d; OUT (mesma chave) há 45 d, logo
 * `pre_contaminado` por OUT2. 3 vídeos nossos (2 com a chave do sinal, 1 sem), 10 views/dia cada, cobertura `base` só.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarCanal, criarSite } from '../helpers/mg6'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarCanais, apagarSites } from '../helpers/limpa-cena'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn(), addBreadcrumb: vi.fn() }))

import { medirD2 } from '@/lib/youtube/observatorio/sinais/medida/passo'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const PT = `(now() at time zone 'America/Los_Angeles')::date`

describe.skipIf(skipIfNoLocalDb())('F2b T4: medirD2 contra o banco de integração', () => {
  let pg: Client
  let site = '', org = ''
  const out = randomUUID(), out2 = randomUUID(), velho = randomUUID()
  const sb = (): SupabaseClient => {
    const real = getSupabaseServiceClient() as unknown as SupabaseClient
    return new Proxy(real, {
      get: (t, p) => {
        if (p !== 'from') return Reflect.get(t, p, t)
        return (tabela: string) => {
          const q = t.from(tabela)
          if (tabela !== 'competitor_channels') return q
          return new Proxy(q, { get: (qt, qp) => (qp === 'select' ? (...a: Parameters<typeof qt.select>) => qt.select(...a).eq('site_id', site) : Reflect.get(qt, qp, qt)) })
        }
      },
    })
  }
  const rodar = () => medirD2({ sb: sb(), t0: Date.now(), agora: () => Date.now(), fimMs: 120_000 })
  const efeitos = async () => (await pg.query(
    `select outlier_video_id, papel, metrica, anos_atras, pre, pos, estado, motivo from public.niche_signal_efeitos where site_id = $1 order by outlier_video_id, papel, metrica, anos_atras`, [site])).rows

  beforeAll(async () => {
    process.env.OBS_SINAIS_NICHO = 'on'
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    const s = await criarSite(pg); site = s.site; org = s.org
    const comp = await criarCanal(pg, site)
    const ch = String((await pg.query(
      `insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
       values ($1, $2, 'pt', $3, 'canal f2b', 'UU1', $4) returning id`, [site, 'UC' + randomUUID().slice(0, 8), '@f' + randomUUID().slice(0, 6), 'f' + randomUUID().slice(0, 6)])).rows[0].id)
    const vids: Array<{ id: string; yt: string; chaves: string[] }> = []
    for (const [yt, chaves] of [['ytA' + randomUUID().slice(0, 6), ['pais:TH']], ['ytB' + randomUUID().slice(0, 6), ['pais:TH']], ['ytC' + randomUUID().slice(0, 6), ['pais:VN']]] as Array<[string, string[]]>) {
      const id = String((await pg.query(
        `insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1, $2, $3, 't', now() - interval '100 days') returning id`, [site, ch, yt])).rows[0].id)
      vids.push({ id, yt, chaves })
      await pg.query(`insert into public.video_lugares (video_id, site_id, origem, chaves, fonte, entrada_hash, semente_versao, computado_em) values ($1, $2, 'proprio', $3, 'texto', 'h', 1, now())`, [id, site, chaves])
      await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, privacy_status, captured_at) values ($1, ${PT} - 1, $2, $3, $4, 'public', now())`, [yt, site, id, ch])
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id) values ($1, 'base', ${PT} - 110, ${PT} - 1, $2, $3, $4)`, [yt, site, id, ch])
      await pg.query(
        `insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version)
         select $1, d::date, $2, $3, $4, 10, 'views_desde_2026-08-27' from generate_series(${PT} - 110, ${PT} - 1, interval '1 day') d`, [yt, site, id, ch])
    }
    const ev = { outliers: [], outliers_total: 0, canais: 2, proprios: vids.slice(0, 2).map(v => v.id) }
    await pg.query(
      `insert into public.niche_signals (site_id, kind, subject_key, rule_version, evidence, forca, acao, status, first_seen_at, computed_at, expires_at, motivo)
       values ($1, 'destino', 'pais:TH', 'sinais-v1', $2::jsonb, 10, 'video_novo', 'aberto', now() - interval '44 days', now(), now() + interval '10 days', 'm')`, [site, JSON.stringify(ev)])
    const visto = (id: string, pubDias: number, vistoDias: number, chaves: string[]) => pg.query(
      `insert into public.niche_outliers_vistos (site_id, video_id, canal_id, formato, published_at, n_canal, primeiro_visto_em, ultimo_visto_em, mult_max, vpd7_max, chaves)
       values ($1, $2, $3, 'long', now() - make_interval(days => $4), 10, now() - make_interval(days => $5), now(), 6, 100, $6)`, [site, id, comp, pubDias, vistoDias, chaves])
    await visto(velho, 130, 120, ['pais:VN'])   // V0 = há 120 d
    await visto(out2, 55, 44, ['pais:TH'])
    await visto(out, 45, 44, ['pais:TH'])
  })
  afterAll(async () => {
    delete process.env.OBS_SINAIS_NICHO
    try {
      for (const t of ['niche_signal_efeito_bracos', 'niche_signal_efeitos', 'niche_signals', 'niche_outliers_vistos', 'video_lugares', 'yt_own_video_daily', 'yt_own_video_coverage', 'yt_own_video_meta_daily', 'youtube_videos', 'youtube_channels'])
        await pg.query(`delete from public.${t} where site_id = $1`, [site])
      await apagarCanais(pg, 'site_id = $1', [site])
      await apagarSites(pg, 'id = $1', [site])
      await pg.query('delete from public.audit_log where org_id = $1', [org])
      await pg.query('delete from public.organizations where id = $1', [org])
    } finally { await pg.end() }
  })

  it('grava o par limpo (views_total medido, placebo sem cobertura) e o contaminado como uma linha `par`; a reexecução não grava nada', async () => {
    const r = await rodar()
    expect(r.motivo).toBeUndefined()
    const linhas = await efeitos()
    const par = linhas.filter(l => l.outlier_video_id === out)
    expect(par).toEqual([expect.objectContaining({ metrica: 'par', estado: 'nao_medido', motivo: 'pre_contaminado', papel: 'alvo', anos_atras: 0 })])
    const limpo = linhas.filter(l => l.outlier_video_id === out2)
    const v = (papel: string, anos = 0) => limpo.find(l => l.metrica === 'views_total' && l.papel === papel && l.anos_atras === anos)!
    expect(v('alvo')).toMatchObject({ estado: 'medido', motivo: null })
    expect([Number(v('alvo').pre), Number(v('alvo').pos)]).toEqual([560, 600])   // 2 vídeos x 10 views x 28 e 30 dias
    expect([Number(v('controle').pre), Number(v('controle').pos)]).toEqual([280, 300])
    expect(v('alvo', 1)).toMatchObject({ estado: 'nao_medido', motivo: 'cobertura' })
    expect(v('controle', 2)).toMatchObject({ estado: 'nao_medido', motivo: 'cobertura' })
    // as fontes de reporting/trafego ainda esperam (par com 55 d, sem cobertura da fonte): nada gravado por elas
    expect(limpo.some(l => l.metrica !== 'views_total')).toBe(false)
    const bracos = (await pg.query(`select papel, anos_atras, videos, chave from public.niche_signal_efeito_bracos where site_id = $1 and outlier_video_id = $2`, [site, out2])).rows
    expect(bracos).toHaveLength(6)
    expect(bracos.find(b => b.papel === 'alvo' && b.anos_atras === 0)!.videos).toHaveLength(2)
    expect(bracos.find(b => b.papel === 'controle' && b.anos_atras === 0)!.videos).toHaveLength(1)
    expect(r.detalhe).toMatchObject({ d2_fechados_hoje: 1, d2_nao_medidos_hoje: 1, d2_sem_entrada: 0 })

    const antes = linhas.length
    const r2 = await rodar()
    expect(r2.motivo).toBeUndefined()
    expect((await efeitos()).length).toBe(antes)
    expect(r2.detalhe.d2_fechados_hoje).toBe(0)
  })
})
