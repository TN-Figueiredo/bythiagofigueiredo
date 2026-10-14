// @vitest-environment node
// A4 Tarefa 14: `lerAlcanceDosCanais` (o alcance de TODOS os canais próprios do site, para o cartão da comparação) e `carregarProprioDaComparacao`
// (a página da comparação). A mesma regra de `lerDiarioDosCanais`: sem token nada é consultado e o cliente de serviço nem é criado; um canal que falha
// vira 'erro' (a tela não cai) e UM aviso por requisição; no máximo 4 canais em voo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'
import { TIPO_ALCANCE } from '@/lib/youtube/observatorio/proprio/ler'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { mundoSemProprio, proprioWorld } from './proprio-fixture'

const requireSiteScope = vi.fn()
const getSupabaseServiceClient = vi.fn()
const captureMessage = vi.fn()
const captureException = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => captureMessage(...a), captureException: (...a: unknown[]) => captureException(...a) }))

import { lerAlcanceDosCanais, podeVerPrivado } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { carregarProprioDaComparacao } from '@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras'

const S = 'site-1'
const UUIDS = ['3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a01', '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a02', '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a03', '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a04', '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a05', '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a06']
const [A, B] = UUIDS as [string, string]
const AGORA = Date.now(), HOJE = dayPt(new Date(AGORA))
const d = (n: number) => addDays(HOJE, -n)
const relatorio = (dia: string, canal: string): Row => ({ report_id: 'r-' + dia + canal, site_id: S, channel_id: canal, report_type_id: TIPO_ALCANCE, status: 'baixado', start_time: dia + 'T07:00:00+00:00', normalized_at: dia + 'T12:00:00+00:00' })
const linha = (yt: string, dia: string, imp: number, canal: string): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: canal, thumbnail_impressions: imp, thumbnail_ctr: 0.1 })

async function token(): Promise<LeituraPrivadaDoSite> {
  requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
  const t = await podeVerPrivado(S)
  if (!t) throw new Error('esperava o token')
  return t
}
beforeEach(() => { requireSiteScope.mockReset(); getSupabaseServiceClient.mockReset(); captureMessage.mockReset(); captureException.mockReset() })

describe('lerAlcanceDosCanais', () => {
  it('sem token: todos "negado", o cliente de serviço nem é criado e nada privado no resultado', async () => {
    const r = await lerAlcanceDosCanais({ canalIds: [A, B], agora: AGORA, leitura: null })
    expect([...r.entries()]).toEqual([[A, { acesso: 'negado' }], [B, { acesso: 'negado' }]])
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('token forjado: negado e nenhum cliente criado', async () => {
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    const r = await lerAlcanceDosCanais({ canalIds: [A], agora: AGORA, leitura: forjado })
    expect(r.get(A)).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('sem canais: mapa vazio e nenhuma consulta', async () => {
    const r = await lerAlcanceDosCanais({ canalIds: [], agora: AGORA, leitura: await token() })
    expect(r.size).toBe(0)
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('com token: cada canal lê o SEU alcance (nunca o do vizinho)', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [relatorio(d(3), A), relatorio(d(4), A), relatorio(d(3), B)],
      yt_own_video_reach_daily: [linha('v1', d(3), 100, A), linha('v2', d(3), 7, B)],
    })
    getSupabaseServiceClient.mockReturnValue(db.client)
    const r = await lerAlcanceDosCanais({ canalIds: [A, B], agora: AGORA, leitura: await token() })
    const a = r.get(A)!, b = r.get(B)!
    if (a.acesso !== 'ok' || b.acesso !== 'ok') throw new Error('esperava ok')
    expect(a.dado.linhas.map(l => [l.ytId, l.imp])).toEqual([['v1', 100]])
    expect(b.dado.linhas.map(l => [l.ytId, l.imp])).toEqual([['v2', 7]])
    expect(a.dado.relatorios).toHaveLength(2)
    expect(b.dado.relatorios).toHaveLength(1)
  })
  it('um canal que falha vira "erro" (os outros seguem) e UM aviso para a requisição, com a contagem', async () => {
    const db = fakeSupabase(
      { yt_reporting_reports: [relatorio(d(3), A)], yt_own_video_reach_daily: [linha('v1', d(3), 100, A)] },
      { failIf: (t, eqs) => t === 'yt_own_video_reach_daily' && String(eqs['channel_id']) !== A },
    )
    getSupabaseServiceClient.mockReturnValue(db.client)
    const r = await lerAlcanceDosCanais({ canalIds: [A, B, UUIDS[2]!], agora: AGORA, leitura: await token() })
    expect(r.get(A)!.acesso).toBe('ok')
    expect(r.get(B)).toEqual({ acesso: 'erro' })
    expect(r.get(UUIDS[2]!)).toEqual({ acesso: 'erro' })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning', extra: expect.objectContaining({ siteId: S, falhas: 2 }) })
  })
  it('o aviso pode ser trocado por quem chama (os testes de página não falam com o Sentry)', async () => {
    const db = fakeSupabase({}, { failIf: () => true })
    getSupabaseServiceClient.mockReturnValue(db.client)
    const avisar = vi.fn()
    await lerAlcanceDosCanais({ canalIds: [A], agora: AGORA, leitura: await token() }, avisar)
    expect(avisar).toHaveBeenCalledTimes(1)
    expect(avisar.mock.calls[0]![1]).toBe(1)
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('no máximo 4 canais em voo', async () => {
    let voo = 0, pico = 0
    const db = fakeSupabase({}, {
      failIf: (t) => { if (t === 'yt_reporting_reports') { voo++; pico = Math.max(pico, voo); queueMicrotask(() => { voo-- }) } return false },
    })
    getSupabaseServiceClient.mockReturnValue(db.client)
    await lerAlcanceDosCanais({ canalIds: UUIDS, agora: AGORA, leitura: await token() })
    expect(pico).toBeLessThanOrEqual(4 * 3) // três consultas de relatório por canal, no máximo 4 canais ao mesmo tempo
  })
})

describe('carregarProprioDaComparacao', () => {
  const W = proprioWorld({
    mut: ds => {
      const novos = new Map(ds.channels.filter(c => c.own).map((c, i) => [c.id, UUIDS[i]!]))
      for (const c of ds.channels) { const n = novos.get(c.id); if (n) c.id = n }
      for (const v of ds.videos) { const n = novos.get(v.ch); if (n) v.ch = n }
    },
  })
  const AG = W.obs.NOW

  it('sem canal próprio no site: extras undefined, nada no cartão e nenhuma consulta (nem a guarda de edição)', async () => {
    const r = await carregarProprioDaComparacao(mundoSemProprio(), S, AG)
    expect(r).toEqual({ extras: undefined, soSeuCanal: {} })
    expect(requireSiteScope).not.toHaveBeenCalled()
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('sem permissão: uma entrada "negado" por canal próprio, SEM view, e nenhum cliente de serviço', async () => {
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    const r = await carregarProprioDaComparacao(W.obs, S, AG)
    expect(Object.keys(r.soSeuCanal).sort()).toEqual([UUIDS[0]!, UUIDS[1]!].sort())
    for (const v of Object.values(r.soSeuCanal)) expect(v).toEqual({ acesso: 'negado', view: null })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(requireSiteScope).toHaveBeenCalledTimes(1)
  })
  it('com permissão: a guarda roda UMA vez e as views por dia (extras) continuam vindo do diário', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const db = fakeSupabase({})
    getSupabaseServiceClient.mockReturnValue(db.client)
    const r = await carregarProprioDaComparacao(W.obs, S, AG)
    expect(requireSiteScope).toHaveBeenCalledTimes(1)
    expect(r.extras?.vpd.size).toBe(2)
    // tabelas vazias: sem relatório lido, a View diz "Não medido" (nunca zero)
    const v = r.soSeuCanal[UUIDS[0]!]!
    expect(v.acesso).toBe('ok')
    expect(v.view?.naoMedido).toBe(true)
  })
})
