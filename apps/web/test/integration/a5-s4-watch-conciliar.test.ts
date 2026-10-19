// @vitest-environment node
/**
 * A5 · S4 (T10, B6): yt_watch_conciliar (e o `conciliar` do código) contra Postgres de verdade, com ab_tests, youtube_videos e competitor_videos.
 * `conciliar` lê o banco inteiro; por isso cada caso começa limpando yt_watch_* e as afirmações olham só os vídeos do próprio caso.
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-s4-watch-conciliar.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { travarS4, destravarS4 } from '../helpers/a5-s4-trava'
import { seedSite, seedYoutubeChannelAndVideo } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { conciliar, montarCandidatos, type Candidato } from '@/lib/youtube/watch/alvos'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HORA = 3_600_000
const DIA = 24 * HORA

interface Resumo { inseridos: number; atualizados: number; removidos: number; alvos_ativos: number }
interface AlvoLinha {
  id: string; tipo: string; motivo_ate: string; coleta_ate: Date; rodadas_por_dia: number; proxima_rodada_em: Date; ativo_desde: Date
  saiu_em: Date | null; saiu_por: string | null; rodadas: number; indisponivel_seguidas: number
}

describe.skipIf(skipIfNoLocalDb())('A5 S4 B6: yt_watch_conciliar (banco local)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let site = ''
  const sites: string[] = []
  const iso = (ms: number): string => new Date(ms).toISOString()

  async function comRepeticao(sql: string, args: unknown[]): Promise<void> {
    for (let i = 0; ; i++) {
      try { await pg.query(sql, args); return } catch (e) {
        if ((e as { code?: string }).code !== '40P01' || i >= 8) throw e
        await new Promise(r => setTimeout(r, 150 * (i + 1) + Math.random() * 200))
      }
    }
  }
  async function limpar(): Promise<void> {
    await comRepeticao('delete from public.yt_watch_readings', [])
    await comRepeticao('delete from public.yt_watch_thumbs', [])
    await comRepeticao('delete from public.yt_watch_alvos', [])
    await comRepeticao(`delete from public.competitor_agenda_runs where task = 'leitura_watch'`, [])
    // `conciliar` lê o banco inteiro e o RPC é atômico: um video_id fora do formato (sobra de outras suítes, nunca vem do YouTube) derruba o lote todo com 23514
    await comRepeticao(`delete from public.competitor_videos where video_id !~ '^[A-Za-z0-9_-]{11}$'`, [])
  }

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    await travarS4(pg)
  })
  beforeEach(async () => {
    await limpar()
    site = (await seedSite(sb, { siteSlug: 's4c-' + randomUUID(), siteName: 'S4 conciliar' })).siteId; sites.push(site)
  })
  afterAll(async () => {
    try {
      await limpar()
      await comRepeticao('delete from public.ab_tests where site_id = any($1::uuid[])', [sites])
      await comRepeticao('delete from public.youtube_videos where site_id = any($1::uuid[])', [sites])
      await comRepeticao('delete from public.youtube_channels where site_id = any($1::uuid[])', [sites])
      await comRepeticao('delete from public.competitor_channels where site_id = any($1::uuid[])', [sites])
      await comRepeticao('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally { await destravarS4(pg); await pg.end() }
  })

  const ytId = (i: number): string => 'c' + String(i).padStart(10, '0')
  function payload(c: readonly Candidato[], hora = 100): object[] {
    return c.map(x => ({ site_id: x.siteId, youtube_video_id: x.ytId, tipo: x.tipo, motivo_ate: x.motivoAte, coleta_ate: x.coletaAte, hora_base_min: hora, rodadas_por_dia: x.rodadasPorDia }))
  }
  async function rpc(agora: number, cands: object[]): Promise<Resumo> {
    return (await pg.query('select public.yt_watch_conciliar($1, $2::jsonb) as r', [iso(agora), JSON.stringify(cands)])).rows[0].r as Resumo
  }
  async function alvoDe(yt: string): Promise<AlvoLinha | undefined> {
    return (await pg.query('select * from public.yt_watch_alvos where site_id = $1 and youtube_video_id = $2', [site, yt])).rows[0] as AlvoLinha | undefined
  }
  async function inserirAlvo(yt: string, o: { saiuHa?: number; saiuPor?: string; rodadas?: number; indisponiveis?: number; tipo?: string; motivo?: string; porDia?: number; ativoDesde?: number; proxima?: number } = {}): Promise<void> {
    const agora = Date.now()
    await pg.query(
      `insert into public.yt_watch_alvos (site_id, youtube_video_id, tipo, motivo_ate, coleta_ate, hora_base_min, proxima_rodada_em, rodadas_por_dia, saiu_em, saiu_por, rodadas, indisponivel_seguidas, ativo_desde)
       values ($1, $2, $3, $4, $5, 100, $6, $7, $8, $9, $10, $11, $12)`,
      [site, yt, o.tipo ?? 'proprio', o.motivo ?? 'janela_propria', iso(agora + DIA), iso(o.proxima ?? agora + HORA), o.porDia ?? 4,
        o.saiuHa === undefined ? null : iso(agora - o.saiuHa * DIA), o.saiuHa === undefined ? null : o.saiuPor ?? 'janela',
        o.rodadas ?? 0, o.indisponiveis ?? 0, iso(o.ativoDesde ?? agora - 5 * DIA)])
  }
  /** Um vídeo próprio (publicado há 60 d, portanto só candidato D2) e, se pedido, um teste. */
  async function videoProprio(status?: 'draft' | 'active', o: { criadoHa?: number } = {}): Promise<string> {
    const v = await seedYoutubeChannelAndVideo(sb, site)
    await pg.query(`update public.youtube_videos set published_at = now() - interval '60 days' where id = $1`, [v.videoId])
    if (status !== undefined) {
      const quando = iso(Date.now() - (o.criadoHa ?? 0) * DIA)
      await pg.query(`insert into public.ab_tests (site_id, youtube_video_id, name, status, test_type, created_at, updated_at, original_thumbnail_url) values ($1, $2, 'S4', $3, 'thumbnail', $4, $4, 'https://exemplo.test/a.jpg')`, [site, v.videoId, status, quando])
    }
    return v.youtubeVideoId
  }
  async function conciliarReal(): Promise<{ inseridos: number; removidos: number; alvosAtivos: number }> {
    const r = await conciliar(sb, Date.now())
    if (!('valor' in r)) throw new Error('conciliar falhou: ' + JSON.stringify(r))
    return r.valor
  }
  async function execucoes(deHoras: number, ateHoras: number): Promise<void> {
    for (let h = deHoras; h >= ateHoras; h--) {
      await pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, started_at) values ('leitura_watch', $1, 'ok', $2)`, ['p' + h, iso(Date.now() - h * HORA)])
    }
  }
  async function motivoRodadasFaltando(): Promise<boolean | null> {
    const r = (await pg.query('select public.yt_watch_prova($1, true, null) as r', [iso(Date.now())])).rows[0].r as { motivos: { rodadas_faltando: boolean | null } }
    return r.motivos.rodadas_faltando
  }

  describe('RPC com o payload montado por montarCandidatos', () => {
    it('Phil I6: a 2ª conciliação contra um alvo existente não dá erro e traz atualizados 1', async () => {
      const agora = Date.now()
      const cands = montarCandidatos([], [{ id: 'x', ytId: ytId(1), canalId: '', siteId: site, publishedAt: iso(agora - 2 * DIA), createdAt: iso(agora - 2 * DIA) }], [], null, agora)
      expect(cands).toHaveLength(1)
      expect(await rpc(agora, payload(cands))).toMatchObject({ inseridos: 1, atualizados: 0 })
      expect(await rpc(agora + HORA, payload(cands))).toMatchObject({ inseridos: 0, atualizados: 1 })
      expect((await alvoDe(ytId(1)))?.rodadas).toBe(0)
    })

    it('Phil M5: teste_nosso e janela_propria do mesmo vídeo no mesmo lote: o teste vence o motivo e o coleta_ate é o máximo', async () => {
      const agora = Date.now()
      const longo = iso(agora + 10 * DIA); const curto = iso(agora + DIA)
      await rpc(agora, [
        { site_id: site, youtube_video_id: ytId(1), tipo: 'proprio', motivo_ate: 'janela_propria', coleta_ate: longo, hora_base_min: 100, rodadas_por_dia: 4 },
        { site_id: site, youtube_video_id: ytId(1), tipo: 'proprio', motivo_ate: 'teste_nosso', coleta_ate: curto, hora_base_min: 100, rodadas_por_dia: 4 },
      ])
      const a = await alvoDe(ytId(1))
      expect(a?.motivo_ate).toBe('teste_nosso')
      expect(a?.coleta_ate.getTime()).toBe(new Date(longo).getTime())
    })

    it('Phil M6: alvo reativado ganha ativo_desde novo e a prova seguinte não acende rodadas_faltando', async () => {
      await inserirAlvo(ytId(1), { saiuHa: 10, ativoDesde: Date.now() - 20 * DIA, proxima: Date.now() - 10 * DIA })
      await execucoes(30, 1)
      const agora = Date.now()
      const r = await rpc(agora, [{ site_id: site, youtube_video_id: ytId(1), tipo: 'proprio', motivo_ate: 'teste_nosso', coleta_ate: iso(agora + DIA), hora_base_min: 100, rodadas_por_dia: 4 }])
      expect(r).toMatchObject({ atualizados: 1 })
      const a = (await alvoDe(ytId(1)))!
      expect(a.saiu_em).toBeNull()
      expect(Math.abs(a.ativo_desde.getTime() - agora)).toBeLessThan(1000)
      expect(Math.abs(a.proxima_rodada_em.getTime() - agora)).toBeLessThan(1000)
      expect(await motivoRodadasFaltando()).toBe(false)
    })

    it('Phil N1: alvo 1/dia com 1 leitura em 24 h que vira 4/dia: ativo_desde = p_agora e a prova não acende rodadas_faltando', async () => {
      await inserirAlvo(ytId(1), { porDia: 1, ativoDesde: Date.now() - 3 * DIA, proxima: Date.now() + 14 * HORA })
      await pg.query(`insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, idioma, titulo_oficial, titulo_oficial_fonte, titulo_exibido, renderers_presentes)
        values ($1, $2, now() - interval '10 hours', $3, 'vercel', 1, 200, 'pt-BR', 'T', 'videoDetails', 'T', 7)`, [site, ytId(1), randomUUID()])
      await execucoes(30, 1)
      expect(await motivoRodadasFaltando()).toBe(false) // a 1/dia, 1 leitura em 26 h basta
      const agora = Date.now()
      await rpc(agora, [{ site_id: site, youtube_video_id: ytId(1), tipo: 'proprio', motivo_ate: 'janela_propria', coleta_ate: iso(agora + DIA), hora_base_min: 100, rodadas_por_dia: 4 }])
      const a = (await alvoDe(ytId(1)))!
      expect(a.rodadas_por_dia).toBe(4)
      expect(Math.abs(a.ativo_desde.getTime() - agora)).toBeLessThan(1000)
      expect(await motivoRodadasFaltando()).toBe(false)
    })

    it('D2 = sim: próprio antigo com teste vai a 4/dia; quando o teste acaba, volta a 1/dia', async () => {
      const agora = Date.now()
      const antigo = [{ id: 'x', ytId: ytId(1), canalId: '', siteId: site, publishedAt: iso(agora - 60 * DIA), createdAt: iso(agora - 60 * DIA) }]
      const comTeste = montarCandidatos([], [], [{ siteId: site, ytId: ytId(1) }], antigo, agora)
      expect(comTeste[0]?.rodadasPorDia).toBe(4)
      await rpc(agora, payload(comTeste))
      expect((await alvoDe(ytId(1)))?.rodadas_por_dia).toBe(4)
      const semTeste = montarCandidatos([], [], [], antigo, agora + HORA)
      expect(semTeste[0]?.rodadasPorDia).toBe(1)
      await rpc(agora + HORA, payload(semTeste))
      expect((await alvoDe(ytId(1)))?.rodadas_por_dia).toBe(1)
    })
  })

  describe('conciliar do código, com ab_tests, youtube_videos e competitor_videos semeados', () => {
    it('um teste draft recente cria o alvo com o id de 11 caracteres do vídeo, a 4/dia, motivo teste_nosso', async () => {
      const yt = await videoProprio('draft')
      expect(yt).toHaveLength(11)
      const r = await conciliarReal()
      expect(r.inseridos).toBeGreaterThanOrEqual(1)
      const a = await alvoDe(yt)
      expect(a).toMatchObject({ motivo_ate: 'teste_nosso', rodadas_por_dia: 4, tipo: 'proprio', saiu_em: null })
    })

    it('draft com 6 leituras indisponivel continua ativo', async () => {
      const yt = await videoProprio('draft')
      await conciliarReal()
      for (let i = 0; i < 6; i++) {
        await pg.query(`insert into public.yt_watch_readings (site_id, youtube_video_id, lida_em, rodada_id, origem_rede, versao_leitor, http, erro)
          values ($1, $2, now() - ($3 || ' hours')::interval, $4, 'vercel', 1, 404, 'indisponivel')`, [site, yt, String(i + 1), randomUUID()])
      }
      await conciliarReal()
      expect((await alvoDe(yt))?.saiu_em).toBeNull()
    })

    it('alvo saído há 10 d com teste novo: fica ativo e devido', async () => {
      const yt = await videoProprio('active')
      await inserirAlvo(yt, { saiuHa: 10, saiuPor: 'janela', proxima: Date.now() + 5 * DIA })
      await conciliarReal()
      const a = (await alvoDe(yt))!
      expect(a.saiu_em).toBeNull()
      expect(a.saiu_por).toBeNull()
      expect(a.proxima_rodada_em.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('draft com mais de 30 d fica fora: o vídeo só entra como próprio antigo, a 1/dia', async () => {
      const yt = await videoProprio('draft', { criadoHa: 31 })
      await conciliarReal()
      const a = await alvoDe(yt)
      expect(a?.motivo_ate).toBe('proprio_antigo')
      expect(a?.rodadas_por_dia).toBe(1)
    })

    it('indisponivel dentro dos 30 d, com 3 conciliações seguidas: continua saído e rodadas e indisponivel_seguidas não mudam; com teste novo, reativa', async () => {
      const yt = await videoProprio()
      await inserirAlvo(yt, { saiuHa: 5, saiuPor: 'indisponivel', rodadas: 7, indisponiveis: 3 })
      for (let i = 0; i < 3; i++) await conciliarReal()
      const a = (await alvoDe(yt))!
      expect(a.saiu_por).toBe('indisponivel')
      expect(a.saiu_em).not.toBeNull()
      expect([a.rodadas, a.indisponivel_seguidas]).toEqual([7, 3])
      const v = (await pg.query('select id from public.youtube_videos where site_id = $1 and youtube_video_id = $2', [site, yt])).rows[0].id
      await pg.query(`insert into public.ab_tests (site_id, youtube_video_id, name, status, test_type, original_thumbnail_url) values ($1, $2, 'S4', 'draft', 'thumbnail', 'https://exemplo.test/a.jpg')`, [site, v])
      await conciliarReal()
      expect((await alvoDe(yt))?.saiu_em).toBeNull()
    })

    it('removido cujo vídeo voltou a competitor_videos: reativa', async () => {
      const yt = ytId(9)
      await inserirAlvo(yt, { saiuHa: 1, saiuPor: 'removido', tipo: 'concorrente', motivo: 'janela_concorrente' })
      await conciliarReal()
      expect((await alvoDe(yt))?.saiu_por).toBe('removido') // sem o vídeo na lista, nada reativa
      const canal = (await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'S4') returning id`, [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 20)])).rows[0].id
      await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at, discovered_at) values ($1, $2, now() - interval '2 days', now())`, [canal, yt])
      await conciliarReal()
      const a = (await alvoDe(yt))!
      expect(a.saiu_em).toBeNull()
      expect(a.motivo_ate).toBe('janela_concorrente')
    })
  })
})
