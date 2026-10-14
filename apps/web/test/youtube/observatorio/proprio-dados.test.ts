// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { a3World } from './a3-fixture'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'
import { TIPO_ALCANCE } from '@/lib/youtube/observatorio/proprio/ler'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const requireSiteScope = vi.fn()
const getSupabaseServiceClient = vi.fn()
const captureMessage = vi.fn()
const captureException = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))

import { podeVerPrivado, acessoPrivado, lerDadosDoCanal, lerDadosDoVideo, lerDiarioDosCanais, longosAcompanhadosDe } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'

const S = 'site-1'
const BOM = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', RUIM = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11', TERC = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a12'
const AGORA = Date.now(), HOJE = dayPt(new Date(AGORA))
const d = (n: number) => addDays(HOJE, -n)
const diario = (yt: string, dia: string, views: number | null, canal = BOM, site = S): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: site, channel_id: canal, views })
const alcance = (yt: string, dia: string, imp: number | null, ctr: number | null, canal = BOM): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: canal, thumbnail_impressions: imp, thumbnail_ctr: ctr })
const relatorio = (dia: string, canal = BOM): Row => ({ report_id: 'r-' + dia + canal, site_id: S, channel_id: canal, report_type_id: TIPO_ALCANCE, status: 'baixado', start_time: dia + 'T07:00:00+00:00', normalized_at: dia + 'T12:00:00+00:00' })

function com(db: ReturnType<typeof fakeSupabase>) { getSupabaseServiceClient.mockReturnValue(db.client) }
async function token(): Promise<LeituraPrivadaDoSite> {
  requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
  const t = await podeVerPrivado(S)
  if (!t) throw new Error('esperava o token')
  return t
}

beforeEach(() => { requireSiteScope.mockReset(); getSupabaseServiceClient.mockReset(); captureMessage.mockReset(); captureException.mockReset() })

describe('podeVerPrivado', () => {
  it('true só quando requireSiteScope({ mode: "edit" }) devolve ok; exceção vira null (negado), nunca lança', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect(await podeVerPrivado(S)).not.toBeNull()
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: S, mode: 'edit' })
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    expect(await podeVerPrivado(S)).toBeNull()
    requireSiteScope.mockRejectedValue(new Error('sem sessão'))
    expect(await podeVerPrivado(S)).toBeNull()
  })
})

describe('acessoPrivado e o direito de ler (E17 passo 0)', () => {
  const SITE_UUID = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a77'
  const soLe = (rpcData: unknown) => {
    requireSiteScope.mockImplementation(async (o: { mode: string }) => (o.mode === 'edit' ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: 'u2' } }))
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] })
    getSupabaseServiceClient.mockReturnValue({ ...db.client, rpc: async () => ({ data: rpcData, error: null }) })
    return db
  }
  it('podeVerPrivado devolve exatamente a leitura de acessoPrivado', async () => {
    soLe(true)
    const a = await acessoPrivado(SITE_UUID)
    expect(a).toMatchObject({ edita: false, negativa: null })
    expect(a.leitura!.siteId).toBe(SITE_UUID)
    soLe(true)
    expect((await podeVerPrivado(SITE_UUID))!.siteId).toBe(SITE_UUID)
    soLe(false)
    expect(await podeVerPrivado(SITE_UUID)).toBeNull()
  })
  it('quem só tem o direito: os carregadores leem (acesso ok), com o site da leitura', async () => {
    soLe(true)
    const leitura = await podeVerPrivado(SITE_UUID)
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, leitura })
    expect(r.alcance.acesso).toBe('ok')
    expect(r.diario.acesso).toBe('ok')
  })
})

describe('lerDadosDoCanal', () => {
  it('sem permissão: as duas respostas são negado, o cliente de serviço não é criado e o pacote não carrega nada privado', async () => {
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, leitura: null })
    expect(r).toEqual({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(JSON.stringify(r)).toBe('{"alcance":{"acesso":"negado"},"diario":{"acesso":"negado"}}')
  })
  it('token forjado (objeto de fora): negado e nenhum cliente criado', async () => {
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, leitura: forjado })
    expect(r).toEqual({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('com permissão: lê as duas tabelas do site do token e do canal pedido, e só deles', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [relatorio(d(3)), relatorio(d(3), RUIM)],
      yt_own_video_reach_daily: [alcance('v1', d(3), 100, 0.05), alcance('v9', d(3), 7, 0.5, RUIM)],
      yt_own_video_daily: [diario('v1', d(3), 4), diario('v1', d(3), 99, BOM, 'outro-site'), diario('v9', d(3), 5, RUIM)],
    })
    com(db)
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })
    if (r.alcance.acesso !== 'ok' || r.diario.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.alcance.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 100, ctr: 0.05 }])
    expect(r.diario.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 4, pctAssistido: null, duracaoMediaSeg: null }])
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('erro de banco: lança (a página mostra a tela de erro, nunca um canal vazio)', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' }))
    await expect(lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })).rejects.toThrow()
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] }, { failOn: 'yt_own_video_reach_daily' }))
    await expect(lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })).rejects.toThrow()
  })
  it('canal parado e sem longo acompanhado: ultimoDia é o real (a frase "parou em dd/mm" funciona), com zero linhas na série', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [diario('curto', d(60), 4)] }))
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: [], agora: AGORA, leitura: await token() })
    expect(r.diario).toEqual({ acesso: 'ok', dado: { canalId: BOM, ultimoDia: d(60), linhas: [], foraDoTeto: [], descartados: 0 } })
  })
  it('linhas descartadas (CTR fora de 0 a 1, número negativo): UM aviso ao Sentry para a requisição, com a soma das duas leituras', async () => {
    com(fakeSupabase({
      yt_reporting_reports: [relatorio(d(3))],
      yt_own_video_reach_daily: [alcance('v1', d(3), 100, 7), alcance('v2', d(3), -4, 0.1)],
      yt_own_video_daily: [diario('v1', d(3), -1), diario('v1', d(4), 3), diario('v2', d(3), -9)],
    }))
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1', 'v2'], agora: AGORA, leitura: await token() })
    expect(r.alcance.acesso).toBe('ok'); expect(r.diario.acesso).toBe('ok')
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, descartados: 4 } })
  })
})

describe('lerDadosDoVideo (a leitura da tela do vídeo próprio)', () => {
  const SENTINELA_PCT = 73.4
  const comPct = (yt: string, dia: string, views: number, canal = BOM): Row => ({ ...diario(yt, dia, views, canal), avg_view_percentage: SENTINELA_PCT, avg_view_duration_seconds: 123 })
  const mundo = () => fakeSupabase({
    yt_reporting_reports: [relatorio(d(3))],
    yt_own_video_reach_daily: [alcance('v1', d(3), 100, 0.05)],
    yt_own_video_daily: [comPct('v1', d(3), 9)],
  })
  it('sem permissão: negado, nenhum cliente de serviço criado e nenhum dígito privado no que sai', async () => {
    com(mundo())
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: null })
    expect(r).toEqual({ acesso: 'negado' })
    expect(JSON.stringify(r)).toBe('{"acesso":"negado"}')
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('token forjado (objeto de fora): negado e nenhum cliente criado', async () => {
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    expect(await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: forjado })).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('usuário só de leitura (requireSiteScope recusa a edição): podeVerPrivado dá null e o leitor entrega negado, sem tocar o banco', async () => {
    const db = mundo()
    com(db)
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    const leitura = await podeVerPrivado(S)
    expect(leitura).toBeNull()
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura })
    expect(r).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('com permissão: ok, com o alcance e o diário (inclusive % assistido e duração) do canal do token', async () => {
    com(mundo())
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.alcance.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 100, ctr: 0.05 }])
    expect(r.dado.diario.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 9, pctAssistido: SENTINELA_PCT, duracaoMediaSeg: 123 }])
  })
  it('lê só o site do token e só o canal pedido', async () => {
    com(fakeSupabase({
      yt_reporting_reports: [], yt_own_video_reach_daily: [alcance('v9', d(3), 7, 0.5, RUIM)],
      yt_own_video_daily: [comPct('v1', d(3), 9), { ...comPct('v1', d(4), 99), site_id: 'outro-site' }, comPct('v9', d(3), 5, RUIM)],
    }))
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas.map(l => l.ytId + l.dia)).toEqual(['v1' + d(3)])
    expect(r.dado.alcance.linhas).toEqual([])
  })
  it('o vídeo da tela entra no pedido mesmo fora da lista de longos acompanhados, e sem duplicar quando já está nela', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [comPct('fora', d(3), 4), comPct('v1', d(3), 2)] }))
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'fora', longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas.map(l => l.ytId).sort()).toEqual(['fora', 'v1'])
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [comPct('v1', d(3), 2)] }))
    const r2 = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1', 'v1'], agora: AGORA, leitura: await token() })
    if (r2.acesso !== 'ok') throw new Error('esperava ok')
    expect(r2.dado.diario.linhas).toHaveLength(1)
  })
  it('o vídeo da tela vai na FRENTE: com 50 longos na lista e o teto de 50, ele não é o que o teto corta', async () => {
    const longos = Array.from({ length: 50 }, (_, k) => 'l' + String(k).padStart(2, '0'))
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [comPct('fora', d(3), 4), comPct('l49', d(3), 1)] }))
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'fora', longosAcompanhados: longos, agora: AGORA, leitura: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas.map(l => l.ytId)).toEqual(['fora'])
  })
  it('erro de banco: lança (a página mostra a tela de erro, nunca um vídeo "sem dados")', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' }))
    await expect(lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })).rejects.toThrow()
  })
  it('valores ruins (% acima do teto ou negativo, CTR fora de 0 a 1): UM aviso ao Sentry com a soma', async () => {
    com(fakeSupabase({
      yt_reporting_reports: [relatorio(d(3))],
      yt_own_video_reach_daily: [alcance('v1', d(3), 100, 7)],
      yt_own_video_daily: [{ ...diario('v1', d(3), 5), avg_view_percentage: 1000 }, diario('v1', d(4), -1)],
    }))
    await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, descartados: 3 } })
  })
  it('tudo bem: nenhum aviso', async () => {
    com(mundo())
    await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, leitura: await token() })
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

describe('lerDadosDoVideo: a retenção do vídeo (A5 E8, Tarefa 13)', () => {
  const YT = 'vid00000001'
  const ponto = (k: number) => ({ t: (k + 1) / 100, ratio: 1 - k / 200, relative: 0.5, segment_impressions: 10 })
  const linhaCurva = (over: Row = {}): Row => ({
    youtube_video_id: YT, window_kind: 'vida', segment: 'organico', window_start: d(60), window_end: d(2), requested_end: d(2), site_id: S, channel_id: BOM,
    points: Array.from({ length: 100 }, (_, k) => ponto(k)), point_count: 100, metrics_returned: ['audienceWatchRatio'], views_at_read: 10, collected_at: d(1) + 'T10:00:00Z', ...over,
  })
  const tentativa = (dia: string, outcome: string): Row => ({ scope_type: 'video', scope_id: YT, kind: 'retencao_vida', attempt_day: dia, site_id: S, channel_id: BOM, outcome, last_attempt_at: dia + 'T10:00:00Z' })
  const base = (extra: Record<string, Row[]> = {}) => fakeSupabase({
    yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [diario(YT, d(3), 9)], yt_own_video_retention: [], yt_own_collection_attempts: [], ...extra,
  })
  const ler = async (db: ReturnType<typeof fakeSupabase>, leitura?: LeituraPrivadaDoSite | null) => {
    com(db)
    return lerDadosDoVideo({ canalId: BOM, ytId: YT, longosAcompanhados: [YT], agora: AGORA, leitura: leitura === undefined ? await token() : leitura })
  }

  it('com permissão: a retenção vem na mesma leitura, com a curva do site e do canal do token e só dele', async () => {
    const r = await ler(base({
      yt_own_video_retention: [linhaCurva(), linhaCurva({ points: [ponto(0)], point_count: 1, site_id: 'outro-site' }), linhaCurva({ channel_id: RUIM }), linhaCurva({ youtube_video_id: 'vid00000002' })],
      yt_own_collection_attempts: [tentativa(d(1), 'ok')],
    }))
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas).toHaveLength(1)
    const ret = r.dado.retencao
    if (ret?.acesso !== 'ok') throw new Error('esperava a retenção ok')
    expect(ret.dado.ytId).toBe(YT)
    expect(ret.dado.curvas.vida?.pontos).toHaveLength(100)
    expect(ret.dado.ultimaResposta).toEqual({ dia: d(1), resultado: 'ok' })
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('sem curva e sem tentativa: ok e vazio (a tela diz "ainda não coletamos"), nenhum aviso', async () => {
    const r = await ler(base())
    if (r.acesso !== 'ok' || r.dado.retencao?.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.retencao.dado.curvas).toEqual({})
    expect(r.dado.retencao.dado.ultimaResposta).toBeNull()
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('a leitura da retenção falha: vira { acesso: "erro" } SÓ nela, as outras duas ficam ok, e UM aviso ao Sentry sem conteúdo do banco', async () => {
    const r = await ler(fakeSupabase({
      yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [diario(YT, d(3), 9)], yt_own_video_retention: [], yt_own_collection_attempts: [],
    }, { failOn: 'yt_own_video_retention' }))
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.retencao).toEqual({ acesso: 'erro' })
    expect(r.dado.alcance.linhas).toEqual([])
    expect(r.dado.diario.linhas).toHaveLength(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S } })
    expect(JSON.stringify(captureMessage.mock.calls[0])).not.toContain(YT)
  })
  it('erro no alcance ou no diário continua LANÇANDO (D5), mesmo com a retenção boa', async () => {
    await expect(ler(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [], yt_own_video_retention: [], yt_own_collection_attempts: [] }, { failOn: 'yt_own_video_daily' }))).rejects.toThrow()
  })
  it('curva com valor ruim (ponto fora de ordem): a curva é descartada, vira ilegível e UM aviso com a contagem', async () => {
    const ruim = [{ t: 0.5, ratio: 1, relative: null }, { t: 0.2, ratio: 0.9, relative: null }]
    const r = await ler(base({ yt_own_video_retention: [linhaCurva({ points: ruim, point_count: 2 })], yt_own_collection_attempts: [tentativa(d(1), 'ok')] }))
    if (r.acesso !== 'ok' || r.dado.retencao?.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.retencao.dado.janelasIlegiveis).toEqual(['vida'])
    expect(r.dado.retencao.dado.curvas).toEqual({})
    const avisos = captureMessage.mock.calls.filter(c => String(c[0]).includes('retenção'))
    expect(avisos).toHaveLength(1)
    expect(avisos[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, descartados: 1 } })
  })
  it('tabela da curva ausente (migration não aplicada): ok e vazio, com o aviso do leitor (uma vez)', async () => {
    const db = base()
    com(db)
    const aus = { ...db.client, from: (t: string) => {
      if (t !== 'yt_own_video_retention') return db.client.from(t)
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'neq', 'is', 'gte', 'lte']) q[m] = () => q
      q.range = async () => ({ data: null, error: { code: '42P01', message: 'x' } })
      return q
    } }
    getSupabaseServiceClient.mockReturnValue(aus)
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: YT, longosAcompanhados: [YT], agora: AGORA, leitura: await token() })
    if (r.acesso !== 'ok' || r.dado.retencao?.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.retencao.dado.tabelaAusente).toBe(true)
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
  it('sem permissão: negado, o leitor da retenção NÃO é consultado e nenhum cliente de serviço é criado', async () => {
    const db = base({ yt_own_video_retention: [linhaCurva()] })
    const r = await ler(db, null)
    expect(r).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(JSON.stringify(r)).toBe('{"acesso":"negado"}')
  })
  it('as consultas da retenção são paralelas às do canal e nenhuma pede select *', async () => {
    const db = base({ yt_own_video_retention: [linhaCurva()], yt_own_collection_attempts: [tentativa(d(1), 'ok')] })
    await ler(db)
    const dela = db.selects.filter(x => x.table === 'yt_own_video_retention' || x.table === 'yt_own_collection_attempts')
    expect(dela.length).toBeGreaterThan(0)
    for (const x of dela) expect(x.cols).not.toContain('*')
  })
})

describe('lerDiarioDosCanais', () => {
  it('um canal que falha vira erro, os outros vêm ok, e avisar é chamado UMA vez com a contagem', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4), diario('v2', d(3), 5, RUIM)] }, { failIf: (_t, eqs) => eqs.channel_id === RUIM })
    com(db)
    const avisar = vi.fn()
    const m = await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: ['v2'] }], agora: AGORA, leitura: await token() }, avisar)
    expect(m.get(BOM)!.acesso).toBe('ok'); expect(m.get(RUIM)).toEqual({ acesso: 'erro' })
    expect(avisar).toHaveBeenCalledTimes(1); expect(avisar.mock.calls[0]![1]).toBe(1)
  })
  it('vários canais que falham: ainda UM aviso, com a contagem total; o aviso padrão é do Sentry e leva o site', async () => {
    com(fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] }, { failIf: (_t, eqs) => eqs.channel_id !== BOM }))
    const m = await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: ['v2'] }, { id: TERC, longosAcompanhados: ['v3'] }], agora: AGORA, leitura: await token() })
    expect([...m.values()].map(x => x.acesso)).toEqual(['ok', 'erro', 'erro'])
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, falhas: 2 } })
  })
  it('descartados em vários canais: UM aviso com a soma', async () => {
    com(fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), -1), diario('v2', d(3), -1, RUIM), diario('v2', d(4), 2, RUIM)] }))
    await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: ['v2'] }], agora: AGORA, leitura: await token() })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ extra: { siteId: S, descartados: 2 } })
  })
  it('tudo bem: nenhum aviso', async () => {
    com(fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] }))
    await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }], agora: AGORA, leitura: await token() })
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('sem canal próprio: mapa vazio e nenhuma consulta (nem cliente)', async () => {
    const m = await lerDiarioDosCanais({ canais: [], agora: AGORA, leitura: await token() })
    expect(m.size).toBe(0)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('sem permissão: todo canal negado, nenhuma consulta e nenhum aviso', async () => {
    const m = await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: [] }], agora: AGORA, leitura: null })
    expect([...m.entries()]).toEqual([[BOM, { acesso: 'negado' }], [RUIM, { acesso: 'negado' }]])
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

describe('longosAcompanhadosDe', () => {
  it('só tracked e fmt long, do canal pedido, do mais novo ao mais antigo; canal sem vídeo dá []', () => {
    const { obs, owns } = a3World()
    const canal = owns[0]!
    const ids = longosAcompanhadosDe(obs, canal)
    const esperado = obs.videos.filter(v => v.ch === canal && v.tracked && v.fmt === 'long').sort((a, b) => b.pub - a.pub).map(v => v.ytId)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toEqual(esperado)
    expect(longosAcompanhadosDe(obs, 'nao-existe')).toEqual([])
  })
  it('um curto e um vídeo fora do acompanhamento ficam de fora', () => {
    const { obs, owns } = a3World()
    const canal = owns[0]!
    const antes = longosAcompanhadosDe(obs, canal)
    expect(antes.length).toBeGreaterThan(2)
    const fora: string[] = []
    const { obs: mut } = a3World(x => {
      const longos = x.videos.filter(v => v.ch === canal && v.tracked && v.fmt === 'long')
      longos[0]!.fmt = 'short'; longos[1]!.tracked = false
      fora.push(longos[0]!.ytId, longos[1]!.ytId)
    })
    const depois = longosAcompanhadosDe(mut, canal)
    expect(depois).toHaveLength(antes.length - 2)
    for (const y of fora) expect(depois).not.toContain(y)
  })
})
