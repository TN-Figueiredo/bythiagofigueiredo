// @vitest-environment node
// M10a (Tarefa 5): as quatro funções SQL dos pontos 4, 5, 7 e 8. Com zero vídeo marcado devolvem o que devolviam
// (comparação com o TEXTO antigo, lido das migrations anteriores), mais as chaves novas valendo 0.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))
const MIG = path.resolve(__dirname, '../../../../supabase/migrations')

/** Corpo antigo de uma função: do `create or replace function public.<nome>(` ao `$$;` que fecha o corpo. Falha se não achar. */
function funcaoAntiga(arquivo: string, nome: string, assinaturaAntiga?: string): string {
  const txt = readFileSync(path.join(MIG, arquivo), 'utf8')
  const ini = txt.indexOf(`create or replace function public.${nome}(`)
  if (ini < 0) throw new Error(`função ${nome} não encontrada em ${arquivo}`)
  const abre = txt.indexOf('$$', ini)
  const fim = txt.indexOf('$$;', abre + 2) + 3
  let corpo = txt.slice(ini, fim)
  corpo = corpo.replace(`public.${nome}(`, `pg_temp.${nome}_antes(`)
  void assinaturaAntiga
  return corpo
}

type Err = (Error & { code?: string }) | null
describe.skipIf(pular)('M10a: funções SQL dos pontos 4, 5, 7 e 8 (pula até a Tarefa 5b se o rascunho não foi aplicado)', () => {
  let c: pg.Client
  beforeAll(async () => {
    c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
    await c.connect()
    await c.query(funcaoAntiga('20261012000004_observatorio_a5_e1_e2_provas_corretiva.sql', 'competitor_series_health'))
    await c.query(funcaoAntiga('20261013000002_observatorio_a5_e15_leitura_horaria.sql', 'competitor_channel_removal_impact'))
    await c.query(funcaoAntiga('20261012000003_observatorio_a5_e2_serie_faixas.sql', 'apply_competitor_tier_plan'))
    await c.query(funcaoAntiga('20261007000002_observatorio_fixar_video_teto.sql', 'pin_competitor_video'))
  })
  afterAll(async () => { await c.end() })

  async function emTransacao(fn: () => Promise<void>) {
    await c.query('begin')
    try { await fn() } finally { await c.query('rollback') }
  }
  const um = async (sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0]
  async function tenta(sql: string, p: unknown[] = []): Promise<Err> {
    await c.query('savepoint t')
    try { await c.query(sql, p); await c.query('release savepoint t'); return null } catch (e) { await c.query('rollback to savepoint t'); return e as Err }
  }

  /** Site com um canal e `n` vídeos semanais atrasados (faixa semanal aberta há 20 dias, sem ponto de série). */
  async function semear(n: number): Promise<{ siteId: string; canal: string; videos: string[] }> {
    const slug = 'm10a-f-' + Math.random().toString(36).slice(2, 10)
    const org = await um(`insert into public.organizations (name, slug, parent_org_id) values ($1, $1, (select id from public.organizations order by created_at limit 1)) returning id`, [slug])
    const site = await um(`insert into public.sites (org_id, name, slug, primary_domain) values ($1, $2, $2, $3) returning id`, [org.id, slug, slug + '.invalid'])
    const ch = await um(`insert into public.competitor_channels (site_id, channel_id, channel_name, video_limit) values ($1, $2, $2, 50) returning id`, [site.id, 'UC' + slug])
    const vs = await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at, series_tier, series_tier_since)
      select $1, $2 || g, 'v', now() - interval '30 days', 'semanal', current_date - 20 from generate_series(1, $3::int) g returning id`, [ch.id, 'v' + slug, n])
    const videos = vs.rows.map(r => r.id as string)
    await c.query(`insert into public.competitor_video_tier_spans (video_id, from_date, tier, site_id) select unnest($1::uuid[]), current_date - 20, 'semanal', $2`, [videos, site.id])
    return { siteId: site.id, canal: ch.id, videos }
  }
  const congela = (id: string) => c.query(`update public.competitor_videos set archive_frozen_at = now() where id = $1`, [id])
  const saude = async (siteId: string) => (await um(`select public.competitor_series_health($1, now()) j`, [siteId])).j as Record<string, number>

  it('zero marcado: prova da série, remoção de canal e fechamento de faixa devolvem o de antes (mais chaves em 0)', async () => {
    await emTransacao(async () => {
      await semear(3)
      const sites = (await c.query(`select id from public.sites order by id limit 40`)).rows
      for (const s of sites) {
        const r = await um(`select public.competitor_series_health($1, $2::timestamptz) novo, pg_temp.competitor_series_health_antes($1, $2::timestamptz) antes`, [s.id, '2026-10-14T15:00:00Z'])
        const { arquivados, ...resto } = r.novo
        expect(arquivados).toBe(0)
        expect(JSON.stringify(resto)).toBe(JSON.stringify(r.antes)) // a ordem das chaves do jsonb é a do tamanho/nome: igual dos dois lados
      }
      const canais = (await c.query(`select id, site_id from public.competitor_channels order by id limit 80`)).rows
      for (const ch of canais) {
        const r = await um(`select public.competitor_channel_removal_impact($1, $2) novo, pg_temp.competitor_channel_removal_impact_antes($1, $2) antes`, [ch.site_id, ch.id])
        const { videos_leitura_mensal, videos_no_arquivo, ...resto } = r.novo
        expect(videos_leitura_mensal).toBe(0)
        expect(videos_no_arquivo).toBe(0)
        expect(JSON.stringify(resto)).toBe(JSON.stringify(r.antes))
      }
    })
    // apply_competitor_tier_plan: mesmo estado final e mesmo retorno (menos a chave nova), com ativos
    await emTransacao(async () => {
      const { siteId, canal, videos } = await semear(3)
      const plano = JSON.stringify([{ video_id: videos[0], tier: 'diaria' }, { video_id: videos[1], tier: 'semanal' }, { video_id: videos[2], tier: 'diaria' }])
      const estado = async () => JSON.stringify((await c.query(`select v.id, v.series_tier, v.series_tier_since, (select jsonb_agg(s order by s.from_date, s.tier) from public.competitor_video_tier_spans s where s.video_id = v.id) spans
        from public.competitor_videos v where v.competitor_channel_id = $1 order by v.id`, [canal])).rows)
      await c.query('savepoint a')
      const antes = (await um(`select pg_temp.apply_competitor_tier_plan_antes($1, $2, $3::jsonb, current_date) j`, [siteId, canal, plano])).j
      const estadoAntes = await estado()
      await c.query('rollback to savepoint a')
      const novo = (await um(`select public.apply_competitor_tier_plan($1, $2, $3::jsonb, current_date) j`, [siteId, canal, plano])).j
      expect(novo.ignorados_congelados).toBe(0)
      const { ignorados_congelados, ...resto } = novo
      void ignorados_congelados
      expect(resto).toEqual(antes)
      expect(await estado()).toBe(estadoAntes)
    })
  })

  it('V5: congelados saem de semanal_atrasados e de fora_da_prova, e aparecem em arquivados', async () => {
    await emTransacao(async () => {
      const { siteId, videos } = await semear(5) // 5 semanais atrasados
      await c.query(`update public.competitor_videos set views_hidden = true where id = any($1::uuid[])`, [[videos[3], videos[4]]]) // 1 ativo e 1 que será congelado: fora da prova
      const antes = await saude(siteId)
      expect(antes).toMatchObject({ semanal_atrasados: 3, fora_da_prova: 2, arquivados: 0 })
      await congela(videos[4]!) // fora da prova e congelado
      await congela(videos[0]!)
      const depois = await saude(siteId)
      expect(depois).toMatchObject({ semanal_atrasados: 2, arquivados: 2, fora_da_prova: 1 })
      expect(depois.semanal_total).toBe(2)
    })
  })

  it('ponto 4 (M-3): o mesmo congelado citado duas vezes no plano conta uma vez', async () => {
    await emTransacao(async () => {
      const { siteId, canal, videos } = await semear(1)
      await congela(videos[0]!)
      const plano = JSON.stringify([{ video_id: videos[0], tier: 'diaria' }, { video_id: videos[0], tier: 'semanal' }])
      const r = (await um(`select public.apply_competitor_tier_plan($1, $2, $3::jsonb, current_date) j`, [siteId, canal, plano])).j
      expect(r).toEqual({ changed: 0, ignorados_congelados: 1 })
    })
  })

  it('ponto 4: o plano que pede faixa para um congelado não o toca, não cai na guarda e é contado', async () => {
    await emTransacao(async () => {
      const { siteId, canal, videos } = await semear(2)
      await c.query(`update public.competitor_videos set series_tier = null, series_tier_since = null where id = $1`, [videos[0]]) // ativo sem faixa
      await congela(videos[1]!)
      const plano = JSON.stringify([{ video_id: videos[0], tier: 'diaria' }, { video_id: videos[1], tier: 'diaria' }])
      const r = (await um(`select public.apply_competitor_tier_plan($1, $2, $3::jsonb, current_date) j`, [siteId, canal, plano])).j
      expect(r).toEqual({ changed: 1, ignorados_congelados: 1 })
      const a = await um(`select series_tier, (select count(*)::int from public.competitor_video_tier_spans where video_id = $1 and to_date is null and tier = 'diaria') abertos from public.competitor_videos where id = $1`, [videos[0]])
      expect(a).toEqual({ series_tier: 'diaria', abertos: 1 })
      const z = await um(`select series_tier, (select count(*)::int from public.competitor_video_tier_spans where video_id = $1) n from public.competitor_videos where id = $1`, [videos[1]])
      expect(z).toEqual({ series_tier: 'semanal', n: 1 })
    })
  })

  it('ponto 8: o toco conta em videos; leitura mensal e no arquivo têm chave própria', async () => {
    await emTransacao(async () => {
      const { siteId, canal, videos } = await semear(5)
      for (const v of videos.slice(0, 3)) await congela(v)
      await c.query(`update public.competitor_videos set archive_dropped_at = now() where id = $1`, [videos[0]])
      const r = (await um(`select public.competitor_channel_removal_impact($1, $2) j`, [siteId, canal])).j
      expect(r).toMatchObject({ status: 'ok', videos: 5, videos_leitura_mensal: 2, videos_no_arquivo: 1 })
      expect((await um(`select public.competitor_channel_removal_impact($1, $2) j`, [siteId, videos[0]])).j).toEqual({ status: 'not_found' })
    })
  })

  it('ponto 7: fixar congelado exige p_pode_descongelar; com ele descongela e zera o toco e a faixa; no arquivo recusa', async () => {
    await emTransacao(async () => {
      const { siteId, videos } = await semear(4)
      const [ativo, mensal, arquivo] = [videos[0]!, videos[1]!, videos[2]!]
      await c.query(`update public.competitor_videos set archive_frozen_at = now(), archive_view_count = 5, archive_like_count = 2, archive_comment_count = 1, archive_stats_at = now() where id = $1`, [mensal])
      await congela(arquivo)
      await c.query(`update public.competitor_videos set archive_dropped_at = now() where id = $1`, [arquivo])
      const pin = async (v: string, pode?: boolean) => (await um(pode === undefined
        ? `select public.pin_competitor_video($1, $2, null, 5) j` : `select public.pin_competitor_video($1, $2, null, 5, $3) j`, pode === undefined ? [siteId, v] : [siteId, v, pode])).j
      expect(await pin(mensal)).toEqual({ status: 'precisa_admin' })
      expect(await pin(mensal, false)).toEqual({ status: 'precisa_admin' })
      const intacto = await um(`select pinned_at, archive_frozen_at is not null f, archive_view_count v, series_tier from public.competitor_videos where id = $1`, [mensal])
      expect(intacto).toEqual({ pinned_at: null, f: true, v: '5', series_tier: 'semanal' })
      expect(await pin(mensal, true)).toEqual({ status: 'ok', already: false, descongelado: true })
      const livre = await um(`select pinned_at is not null p, archive_frozen_at, archive_view_count, archive_like_count, archive_comment_count, archive_stats_at, series_tier, series_tier_since from public.competitor_videos where id = $1`, [mensal])
      expect(livre).toEqual({ p: true, archive_frozen_at: null, archive_view_count: null, archive_like_count: null, archive_comment_count: null, archive_stats_at: null, series_tier: null, series_tier_since: null })
      expect(await pin(arquivo, true)).toEqual({ status: 'ja_no_arquivo' })
      expect((await um(`select pinned_at from public.competitor_videos where id = $1`, [arquivo])).pinned_at).toBeNull()
      // ativo: idêntico ao de antes, nas duas formas de chamar
      await c.query('savepoint p')
      const antes = (await um(`select pg_temp.pin_competitor_video_antes($1, $2, null, 5) j`, [siteId, ativo])).j
      await c.query('rollback to savepoint p')
      expect(await pin(ativo, true)).toEqual(antes)
      expect(await pin(ativo)).toEqual({ status: 'ok', already: true })
      // limite e vídeo de outro site
      expect(await pin(videos[3]!, true)).toMatchObject({ status: 'ok' })
      const cap = (await um(`select public.pin_competitor_video($1, $2, null, 1) j`, [siteId, videos[3]!])).j
      expect(cap).toEqual({ status: 'ok', already: true })
      expect((await um(`select public.pin_competitor_video($1, $2, null, 5) j`, [siteId, '00000000-0000-4000-8000-0000000000aa'])).j).toEqual({ status: 'not_found' })
      // código antigo: só os quatro argumentos nomeados
      const nomeado = await um(`select public.pin_competitor_video(p_site_id => $1, p_video_id => $2, p_user_id => null, p_limit => 5) j`, [siteId, ativo])
      expect(nomeado.j).toEqual({ status: 'ok', already: true })
      expect((await um(`select count(*)::int n from pg_proc where proname = 'pin_competitor_video' and pronamespace = 'public'::regnamespace`)).n).toBe(1)
      expect(await tenta(`select public.pin_competitor_video($1, $2, null, -1)`, [siteId, ativo])).toMatchObject({ message: expect.stringContaining('p_limit') })
    })
  })

  it('descongelar reabre a faixa: um span aberto e sem_faixa volta ao de antes do congelamento', async () => {
    await emTransacao(async () => {
      const { siteId, canal, videos } = await semear(1)
      const v = videos[0]!
      const antes = (await saude(siteId)).sem_faixa
      // o congelamento da M10b: fecha o span aberto e marca
      await c.query(`update public.competitor_video_tier_spans set to_date = current_date - 1 where video_id = $1 and to_date is null`, [v])
      await congela(v)
      const pin = (await um(`select public.pin_competitor_video($1, $2, null, 5, true) j`, [siteId, v])).j
      expect(pin.descongelado).toBe(true)
      await c.query(`update public.competitor_channels set last_seen_at = now(), last_ok_synced_at = now() where id = $1`, [canal]) // canal_em_dia: sem faixa vira sem_faixa
      expect((await saude(siteId)).sem_faixa).toBe(1)
      await c.query(`select public.apply_competitor_tier_plan($1, $2, $3::jsonb, current_date)`, [siteId, canal, JSON.stringify([{ video_id: v, tier: 'semanal' }])])
      const abertos = (await um(`select count(*)::int n from public.competitor_video_tier_spans where video_id = $1 and to_date is null`, [v])).n
      expect(abertos).toBe(1)
      expect((await saude(siteId)).sem_faixa).toBe(antes)
    })
  })

  it('privilégios das quatro funções: só service_role executa', async () => {
    const r = await c.query(`select p.oid::regprocedure::text f, has_function_privilege('anon', p.oid, 'execute') an, has_function_privilege('authenticated', p.oid, 'execute') au, has_function_privilege('service_role', p.oid, 'execute') sr
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('competitor_series_health','competitor_channel_removal_impact','apply_competitor_tier_plan','pin_competitor_video')`)
    expect(r.rowCount).toBe(4)
    for (const x of r.rows) expect({ f: x.f, an: x.an, au: x.au, sr: x.sr }).toEqual({ f: x.f, an: false, au: false, sr: true })
  })
})
