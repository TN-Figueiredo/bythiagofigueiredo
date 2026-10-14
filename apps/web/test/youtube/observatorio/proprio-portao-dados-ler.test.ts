// @vitest-environment node
// Portão final de dados da A4 (13/10), I1: o teto de vídeos do diário nunca corta em silêncio. O leitor devolve QUAIS vídeos ficaram de fora
// (`foraDoTeto`) e os dados.ts avisam o Sentry uma vez por requisição. Banco falso, sem rede.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { leituraDe } from './leitura-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerDiario, TETO_VIDEOS_DIARIO } from '@/lib/youtube/observatorio/proprio/ler'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'

const captureMessage = vi.fn()
const requireSiteScope = vi.fn()
const getSupabaseServiceClient = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: (...a: unknown[]) => captureMessage(...a) }))

import { lerDadosDoCanal, lerDiarioDosCanais } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', C2 = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11'
const AGORA = Date.now(), HOJE = dayPt(new Date(AGORA))
const d = (n: number) => addDays(HOJE, -n)
const diario = (yt: string, dia: string, views: number | null, canal = C): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: canal, views })
const ids = (n: number) => Array.from({ length: n }, (_, k) => 'v' + k)
let pedido: { leitura: LeituraPrivadaDoSite | null; canalId: string; hoje: string }
beforeAll(async () => { requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } }); pedido = { leitura: await leituraDe(S), canalId: C, hoje: HOJE } })
beforeEach(() => { captureMessage.mockReset(); getSupabaseServiceClient.mockReset(); requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } }) })

describe('I1: lerDiario diz quais vídeos o teto deixou de fora', () => {
  it('50 longos: nenhum fica de fora', async () => {
    const lista = ids(50)
    const db = fakeSupabase({ yt_own_video_daily: lista.map(y => diario(y, d(3), 1)) })
    const r = await lerDiario(db.client, { ...pedido, ytIds: lista })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(TETO_VIDEOS_DIARIO).toBe(50)
    expect(r.dado.foraDoTeto).toEqual([])
    expect(new Set(r.dado.linhas.map(l => l.ytId)).size).toBe(50)
  })
  it('51 longos: o 51º (o mais antigo da lista) fica de fora e é dito', async () => {
    const lista = ids(51)
    const db = fakeSupabase({ yt_own_video_daily: lista.map(y => diario(y, d(3), 1)) })
    const r = await lerDiario(db.client, { ...pedido, ytIds: lista })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.foraDoTeto).toEqual(['v50'])
    expect(r.dado.linhas.some(l => l.ytId === 'v50')).toBe(false)
  })
  it('80 longos: os 30 últimos da lista ficam de fora, na ordem em que vieram', async () => {
    const lista = ids(80)
    const db = fakeSupabase({ yt_own_video_daily: lista.map(y => diario(y, d(3), 1)) })
    const r = await lerDiario(db.client, { ...pedido, ytIds: lista })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.foraDoTeto).toHaveLength(30)
    expect(r.dado.foraDoTeto[0]).toBe('v50'); expect(r.dado.foraDoTeto[29]).toBe('v79')
    expect(new Set(r.dado.linhas.map(l => l.ytId)).size).toBe(50)
  })
  it('lista vazia: nada fica de fora (lista vazia não é corte)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v0', d(3), 1)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: [] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.foraDoTeto).toEqual([])
  })
})

describe('I1: o aviso ao Sentry (uma vez por requisição)', () => {
  it('canal com 80 longos: UM aviso com o número de vídeos de fora; com 50, nenhum', async () => {
    const lista = ids(80)
    com(fakeSupabase({ yt_own_video_daily: lista.map(y => diario(y, d(3), 1)) }))
    await lerDadosDoCanal({ canalId: C, longosAcompanhados: lista, agora: AGORA, leitura: pedido.leitura })
    const avisos = captureMessage.mock.calls.filter(c => String(c[0]).includes('teto'))
    expect(avisos).toHaveLength(1)
    expect(avisos[0]![1]).toMatchObject({ level: 'warning', extra: { siteId: S, foraDoTeto: 30, teto: 50 } })
    captureMessage.mockReset()
    com(fakeSupabase({ yt_own_video_daily: ids(50).map(y => diario(y, d(3), 1)) }))
    await lerDadosDoCanal({ canalId: C, longosAcompanhados: ids(50), agora: AGORA, leitura: pedido.leitura })
    expect(captureMessage.mock.calls.filter(c => String(c[0]).includes('teto'))).toHaveLength(0)
  })
  it('vários canais: UM aviso com a soma', async () => {
    const todos = [...ids(60).map(y => diario(y, d(3), 1)), ...ids(70).map(y => diario(y, d(3), 1, C2))]
    com(fakeSupabase({ yt_own_video_daily: todos }))
    await lerDiarioDosCanais({ canais: [{ id: C, longosAcompanhados: ids(60) }, { id: C2, longosAcompanhados: ids(70) }], agora: AGORA, leitura: pedido.leitura })
    const avisos = captureMessage.mock.calls.filter(c => String(c[0]).includes('teto'))
    expect(avisos).toHaveLength(1)
    expect(avisos[0]![1]).toMatchObject({ extra: { siteId: S, foraDoTeto: 30 } })
  })
})

function com(db: ReturnType<typeof fakeSupabase>) { getSupabaseServiceClient.mockReturnValue(db.client) }
