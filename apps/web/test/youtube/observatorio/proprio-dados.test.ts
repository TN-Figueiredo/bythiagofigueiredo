// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { a3World } from './a3-fixture'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'
import { TIPO_ALCANCE } from '@/lib/youtube/observatorio/proprio/ler'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'

const requireSiteScope = vi.fn()
const getSupabaseServiceClient = vi.fn()
const captureMessage = vi.fn()
const captureException = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))

import { podeVerPrivado, lerDadosDoCanal, lerDadosDoVideo, lerDiarioDosCanais, longosAcompanhadosDe } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'

const S = 'site-1'
const BOM = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', RUIM = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11', TERC = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a12'
const AGORA = Date.now(), HOJE = dayPt(new Date(AGORA))
const d = (n: number) => addDays(HOJE, -n)
const diario = (yt: string, dia: string, views: number | null, canal = BOM, site = S): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: site, channel_id: canal, views })
const alcance = (yt: string, dia: string, imp: number | null, ctr: number | null, canal = BOM): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: canal, thumbnail_impressions: imp, thumbnail_ctr: ctr })
const relatorio = (dia: string, canal = BOM): Row => ({ report_id: 'r-' + dia + canal, site_id: S, channel_id: canal, report_type_id: TIPO_ALCANCE, status: 'baixado', start_time: dia + 'T07:00:00+00:00', normalized_at: dia + 'T12:00:00+00:00' })

function com(db: ReturnType<typeof fakeSupabase>) { getSupabaseServiceClient.mockReturnValue(db.client) }
async function token(): Promise<EdicaoDoSite> {
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

describe('lerDadosDoCanal', () => {
  it('sem permissão: as duas respostas são negado, o cliente de serviço não é criado e o pacote não carrega nada privado', async () => {
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, edicao: null })
    expect(r).toEqual({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(JSON.stringify(r)).toBe('{"alcance":{"acesso":"negado"},"diario":{"acesso":"negado"}}')
  })
  it('token forjado (objeto de fora): negado e nenhum cliente criado', async () => {
    // @ts-expect-error literal não é um EdicaoDoSite
    const forjado: EdicaoDoSite = { siteId: S }
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, edicao: forjado })
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
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })
    if (r.alcance.acesso !== 'ok' || r.diario.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.alcance.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 100, ctr: 0.05 }])
    expect(r.diario.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 4, pctAssistido: null, duracaoMediaSeg: null }])
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('erro de banco: lança (a página mostra a tela de erro, nunca um canal vazio)', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' }))
    await expect(lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })).rejects.toThrow()
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] }, { failOn: 'yt_own_video_reach_daily' }))
    await expect(lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })).rejects.toThrow()
  })
  it('canal parado e sem longo acompanhado: ultimoDia é o real (a frase "parou em dd/mm" funciona), com zero linhas na série', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [diario('curto', d(60), 4)] }))
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: [], agora: AGORA, edicao: await token() })
    expect(r.diario).toEqual({ acesso: 'ok', dado: { canalId: BOM, ultimoDia: d(60), linhas: [], descartados: 0 } })
  })
  it('linhas descartadas (CTR fora de 0 a 1, número negativo): UM aviso ao Sentry para a requisição, com a soma das duas leituras', async () => {
    com(fakeSupabase({
      yt_reporting_reports: [relatorio(d(3))],
      yt_own_video_reach_daily: [alcance('v1', d(3), 100, 7), alcance('v2', d(3), -4, 0.1)],
      yt_own_video_daily: [diario('v1', d(3), -1), diario('v1', d(4), 3), diario('v2', d(3), -9)],
    }))
    const r = await lerDadosDoCanal({ canalId: BOM, longosAcompanhados: ['v1', 'v2'], agora: AGORA, edicao: await token() })
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
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: null })
    expect(r).toEqual({ acesso: 'negado' })
    expect(JSON.stringify(r)).toBe('{"acesso":"negado"}')
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('token forjado (objeto de fora): negado e nenhum cliente criado', async () => {
    // @ts-expect-error literal não é um EdicaoDoSite
    const forjado: EdicaoDoSite = { siteId: S }
    expect(await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: forjado })).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('usuário só de leitura (requireSiteScope recusa a edição): podeVerPrivado dá null e o leitor entrega negado, sem tocar o banco', async () => {
    const db = mundo()
    com(db)
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    const edicao = await podeVerPrivado(S)
    expect(edicao).toBeNull()
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao })
    expect(r).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('com permissão: ok, com o alcance e o diário (inclusive % assistido e duração) do canal do token', async () => {
    com(mundo())
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.alcance.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 100, ctr: 0.05 }])
    expect(r.dado.diario.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 9, pctAssistido: SENTINELA_PCT, duracaoMediaSeg: 123 }])
  })
  it('lê só o site do token e só o canal pedido', async () => {
    com(fakeSupabase({
      yt_reporting_reports: [], yt_own_video_reach_daily: [alcance('v9', d(3), 7, 0.5, RUIM)],
      yt_own_video_daily: [comPct('v1', d(3), 9), { ...comPct('v1', d(4), 99), site_id: 'outro-site' }, comPct('v9', d(3), 5, RUIM)],
    }))
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas.map(l => l.ytId + l.dia)).toEqual(['v1' + d(3)])
    expect(r.dado.alcance.linhas).toEqual([])
  })
  it('o vídeo da tela entra no pedido mesmo fora da lista de longos acompanhados, e sem duplicar quando já está nela', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [comPct('fora', d(3), 4), comPct('v1', d(3), 2)] }))
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'fora', longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas.map(l => l.ytId).sort()).toEqual(['fora', 'v1'])
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [comPct('v1', d(3), 2)] }))
    const r2 = await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1', 'v1'], agora: AGORA, edicao: await token() })
    if (r2.acesso !== 'ok') throw new Error('esperava ok')
    expect(r2.dado.diario.linhas).toHaveLength(1)
  })
  it('o vídeo da tela vai na FRENTE: com 50 longos na lista e o teto de 50, ele não é o que o teto corta', async () => {
    const longos = Array.from({ length: 50 }, (_, k) => 'l' + String(k).padStart(2, '0'))
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [comPct('fora', d(3), 4), comPct('l49', d(3), 1)] }))
    const r = await lerDadosDoVideo({ canalId: BOM, ytId: 'fora', longosAcompanhados: longos, agora: AGORA, edicao: await token() })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.diario.linhas.map(l => l.ytId)).toEqual(['fora'])
  })
  it('erro de banco: lança (a página mostra a tela de erro, nunca um vídeo "sem dados")', async () => {
    com(fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' }))
    await expect(lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })).rejects.toThrow()
  })
  it('valores ruins (% acima do teto ou negativo, CTR fora de 0 a 1): UM aviso ao Sentry com a soma', async () => {
    com(fakeSupabase({
      yt_reporting_reports: [relatorio(d(3))],
      yt_own_video_reach_daily: [alcance('v1', d(3), 100, 7)],
      yt_own_video_daily: [{ ...diario('v1', d(3), 5), avg_view_percentage: 1000 }, diario('v1', d(4), -1)],
    }))
    await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, descartados: 3 } })
  })
  it('tudo bem: nenhum aviso', async () => {
    com(mundo())
    await lerDadosDoVideo({ canalId: BOM, ytId: 'v1', longosAcompanhados: ['v1'], agora: AGORA, edicao: await token() })
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

describe('lerDiarioDosCanais', () => {
  it('um canal que falha vira erro, os outros vêm ok, e avisar é chamado UMA vez com a contagem', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4), diario('v2', d(3), 5, RUIM)] }, { failIf: (_t, eqs) => eqs.channel_id === RUIM })
    com(db)
    const avisar = vi.fn()
    const m = await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: ['v2'] }], agora: AGORA, edicao: await token() }, avisar)
    expect(m.get(BOM)!.acesso).toBe('ok'); expect(m.get(RUIM)).toEqual({ acesso: 'erro' })
    expect(avisar).toHaveBeenCalledTimes(1); expect(avisar.mock.calls[0]![1]).toBe(1)
  })
  it('vários canais que falham: ainda UM aviso, com a contagem total; o aviso padrão é do Sentry e leva o site', async () => {
    com(fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] }, { failIf: (_t, eqs) => eqs.channel_id !== BOM }))
    const m = await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: ['v2'] }, { id: TERC, longosAcompanhados: ['v3'] }], agora: AGORA, edicao: await token() })
    expect([...m.values()].map(x => x.acesso)).toEqual(['ok', 'erro', 'erro'])
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, falhas: 2 } })
  })
  it('descartados em vários canais: UM aviso com a soma', async () => {
    com(fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), -1), diario('v2', d(3), -1, RUIM), diario('v2', d(4), 2, RUIM)] }))
    await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: ['v2'] }], agora: AGORA, edicao: await token() })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ extra: { siteId: S, descartados: 2 } })
  })
  it('tudo bem: nenhum aviso', async () => {
    com(fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] }))
    await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }], agora: AGORA, edicao: await token() })
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('sem canal próprio: mapa vazio e nenhuma consulta (nem cliente)', async () => {
    const m = await lerDiarioDosCanais({ canais: [], agora: AGORA, edicao: await token() })
    expect(m.size).toBe(0)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('sem permissão: todo canal negado, nenhuma consulta e nenhum aviso', async () => {
    const m = await lerDiarioDosCanais({ canais: [{ id: BOM, longosAcompanhados: ['v1'] }, { id: RUIM, longosAcompanhados: [] }], agora: AGORA, edicao: null })
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
