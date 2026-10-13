// @vitest-environment node
// A5 · E8 · Tarefa 12b: o leitor da retenção contra o Postgres LOCAL (PostgREST de verdade: jsonb, bigint, date, timestamptz, range).
// Banco: só o `bythiago_int`. Rodar com:
//   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
//   npx vitest run test/youtube/observatorio/proprio-ler-retencao-db.test.ts
// Semeia o seu site, o seu canal e os seus vídeos, e limpa o que semeou.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite, seedYoutubeChannelAndVideo } from '../../helpers/db-seed'
import { edicaoDe } from './edicao-teste'
import { lerRetencao, TETO_LEITURAS, TETO_TENTATIVAS } from '@/lib/youtube/observatorio/proprio/ler-retencao'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

describe.skipIf(skipIfNoLocalDb())('leitor da retenção (banco local)', () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  const HOJE = dayPt(new Date())
  const d = (n: number) => addDays(HOJE, -n)
  const sites: string[] = []
  const canais: string[] = []
  let siteId = '', canalId = '', outroSite = '', outroCanal = ''
  // ids de 11 caracteres, únicos desta execução (a chave primária da curva é global: video, janela, segmento, fim)
  const sufixo = Math.random().toString(36).slice(2, 6)
  const V = 'rt' + sufixo + '00001'
  const V_VAZIO = 'rt' + sufixo + '00002'
  const V_MUITAS = 'rt' + sufixo + '00003'
  const V_TENT = 'rt' + sufixo + '00004'

  const pontos = (n: number) => Array.from({ length: n }, (_, k) => ({ t: (k + 1) / n, ratio: 1 - k / (2 * n), relative: k % 2 === 0 ? 0.5 : null, segment_impressions: 100 + k }))
  const linha = (yt: string, kind: string, fim: string, site: string, canal: string, over: Record<string, unknown> = {}) => ({
    youtube_video_id: yt, window_kind: kind, segment: 'organico', window_start: d(500), window_end: fim, requested_end: fim,
    site_id: site, channel_id: canal, points: pontos(100), point_count: 100, metrics_returned: ['elapsedVideoTimeRatio', 'audienceWatchRatio', 'relativeRetentionPerformance'],
    views_at_read: 9_876_543_210, collected_at: fim + 'T10:00:00Z', metric_version: 'teste-12b', ...over,
  })
  const tentativa = (yt: string, dia: string, outcome: string, site: string, canal: string, over: Record<string, unknown> = {}) => ({
    scope_type: 'video', scope_id: yt, kind: 'retencao_vida', attempt_day: dia, site_id: site, channel_id: canal, outcome, ...over,
  })
  const inserir = async (tabela: string, linhas: Record<string, unknown>[]) => {
    for (let i = 0; i < linhas.length; i += 100) {
      const { error } = await sb.from(tabela).insert(linhas.slice(i, i + 100))
      if (error) throw new Error(tabela + ': ' + error.message)
    }
  }
  const ok = async (yt: string, canal = canalId, site = siteId) => {
    const r = await lerRetencao(sb, { edicao: await edicaoDe(site), canalId: canal, hoje: HOJE, ytId: yt })
    if (r.acesso !== 'ok') throw new Error('esperava ok, veio ' + r.acesso)
    return r.dado
  }

  beforeAll(async () => {
    siteId = (await seedSite(sb)).siteId; sites.push(siteId)
    outroSite = (await seedSite(sb)).siteId; sites.push(outroSite)
    canalId = (await seedYoutubeChannelAndVideo(sb, siteId)).channelId; canais.push(canalId)
    outroCanal = (await seedYoutubeChannelAndVideo(sb, outroSite)).channelId; canais.push(outroCanal)
    await inserir('yt_own_video_retention', [
      linha(V, 'vida', d(10), siteId, canalId),
      linha(V, 'vida', d(3), siteId, canalId, { points: pontos(37), point_count: 37, views_at_read: null }),
      linha(V, 'primeiros_7_dias', d(20), siteId, canalId),
      // o MESMO id de vídeo em OUTRO site e OUTRO canal, com o fim mais novo: ganharia de todas se o filtro faltasse
      linha(V, 'vida', d(1), outroSite, outroCanal, { points: pontos(10), point_count: 10 }),
      linha(V, 'primeiros_30_dias', d(2), outroSite, outroCanal),
      // 201 leituras de vida para o teto de 200 (pontos pequenos)
      ...Array.from({ length: TETO_LEITURAS + 1 }, (_, k) => linha(V_MUITAS, 'vida', d(k + 1), siteId, canalId, { points: pontos(1), point_count: 1 })),
    ])
    await inserir('yt_own_collection_attempts', [
      tentativa(V, d(1), 'erro_http', siteId, canalId, { http_status: 500, error: 'conteudo que nao importa' }),
      tentativa(V, d(8), 'sem_dado_na_janela', siteId, canalId),
      tentativa(V, d(0), 'ok', outroSite, outroCanal),
      tentativa(V, d(2), 'ok', siteId, canalId, { kind: 'diario' }),
      // 30 falhas recentes e uma resposta antiga: a busca à parte
      ...Array.from({ length: TETO_TENTATIVAS }, (_, k) => tentativa(V_TENT, d(k + 1), 'erro_http', siteId, canalId, { http_status: 500 })),
      tentativa(V_TENT, d(300), 'ok', siteId, canalId),
    ])
  }, 90_000)

  afterAll(async () => {
    for (const s of sites) for (const t of ['yt_own_video_retention', 'yt_own_collection_attempts']) await sb.from(t).delete().eq('site_id', s)
    for (const c of canais) { await sb.from('youtube_videos').delete().eq('channel_id', c); await sb.from('youtube_channels').delete().eq('id', c) }
    for (const s of sites) await sb.from('sites').delete().eq('id', s)
  }, 60_000)

  it('points volta como lista de objetos com números; bigint, date e timestamptz chegam nos tipos que a tela espera', async () => {
    const r = await ok(V)
    const vida = r.curvas.vida!
    // a mais nova do SEU site é d(3), com 37 pontos e views_at_read nulo
    expect(vida.windowEnd).toBe(d(3))
    expect(vida.pontos).toHaveLength(37)
    for (const p of vida.pontos) {
      expect(typeof p.t).toBe('number')
      expect(typeof p.ratio).toBe('number')
      expect(p.relative === null || typeof p.relative === 'number').toBe(true)
      expect(Object.keys(p).sort()).toEqual(['ratio', 'relative', 't'])
    }
    expect(vida.pontos[0]).toEqual({ t: 1 / 37, ratio: 1, relative: 0.5 })
    expect(vida.pontos[1]!.relative).toBeNull()
    expect(vida.viewsAtRead).toBeNull()
    expect(vida.windowStart).toBe(d(500))
    expect(vida.coletadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(vida.metricas).toEqual(['elapsedVideoTimeRatio', 'audienceWatchRatio', 'relativeRetentionPerformance'])
    expect(r.curvas.primeiros_7_dias?.viewsAtRead).toBe(9_876_543_210)
    expect(typeof r.curvas.primeiros_7_dias?.viewsAtRead).toBe('number')
    expect(r.descartados).toBe(0)
  })

  it('linha de OUTRO site/canal com o mesmo id de vídeo não vaza (curvas, lista e tentativas)', async () => {
    const r = await ok(V)
    expect(r.curvas.primeiros_30_dias).toBeUndefined()
    expect(r.leituras.map(l => `${l.janela}@${l.windowEnd}`)).toEqual([`vida@${d(3)}`, `vida@${d(10)}`, `primeiros_7_dias@${d(20)}`])
    // a tentativa de hoje é do outro site; a do diário é de outro kind
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'erro_http' })
    expect(r.ultimaResposta).toEqual({ dia: d(8), resultado: 'sem_dado_na_janela' })
    // e do lado de lá, a prova do outro site vê só o dele
    const lado = await ok(V, outroCanal, outroSite)
    expect(lado.curvas.vida?.windowEnd).toBe(d(1))
    expect(lado.curvas.vida?.pontos).toHaveLength(10)
    expect(lado.curvas.primeiros_7_dias).toBeUndefined()
    expect(lado.curvas.primeiros_30_dias?.windowEnd).toBe(d(2))
  })

  it('a prova do site A com o canal do site B: nada do B aparece', async () => {
    const r = await ok(V, outroCanal, siteId)
    expect(r.curvas).toEqual({})
    expect(r.leituras).toEqual([])
    expect(r.ultimaTentativa).toBeNull()
  })

  it('vídeo sem nenhuma linha: vazio verdadeiro, sem curva e sem tentativa', async () => {
    expect(await ok(V_VAZIO)).toEqual({ ytId: V_VAZIO, curvas: {}, leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente: false, janelasIlegiveis: [] })
  })

  it('201 leituras: 200 na lista e leiturasCortadas (range de verdade)', async () => {
    const r = await ok(V_MUITAS)
    expect(r.leituras).toHaveLength(TETO_LEITURAS)
    expect(r.leiturasCortadas).toBe(true)
    expect(r.leituras[0]!.windowEnd).toBe(d(1))
    expect(r.curvas.vida?.windowEnd).toBe(d(1))
    // curva de um ponto só (uma leitura de 1 ponto) continua válida como dado
    expect(r.curvas.vida?.pontos).toEqual([{ t: 1, ratio: 1, relative: 0.5 }])
  })

  it('30 falhas recentes e uma resposta de 300 dias atrás: a última resposta é achada pela busca à parte', async () => {
    const r = await ok(V_TENT)
    expect(r.ultimaTentativa).toEqual({ dia: d(1), resultado: 'erro_http' })
    expect(r.ultimaResposta).toEqual({ dia: d(300), resultado: 'ok' })
  })

  it('sem prova ou canal que não é uuid: negado (o Postgres nem é consultado)', async () => {
    expect(await lerRetencao(sb, { edicao: null, canalId, hoje: HOJE, ytId: V })).toEqual({ acesso: 'negado' })
    expect(await lerRetencao(sb, { edicao: await edicaoDe(siteId), canalId: 'x', hoje: HOJE, ytId: V })).toEqual({ acesso: 'negado' })
  })
})
