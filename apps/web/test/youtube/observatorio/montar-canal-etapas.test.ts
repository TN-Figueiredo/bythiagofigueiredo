// @vitest-environment node
// Dívida T4 C1: o ramo concorrente do montarCanal mede 'pagina' e 'admin'; fora de uma medição não lança nem grava.
import { describe, it, expect, vi } from 'vitest'
import { comMedicao, novaMedicao } from '@/lib/youtube/observatorio/medicao-abertura'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => true }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openChannelPage: async () => ({ obs: { channel: () => null, SYNC: { last: null } }, siteId: 's1', now: 0, leitura: null, ownYtIds: [], canEdit: false, owns: { itens: [] } }),
  openObservatoryPage: async () => ({ obs: {}, siteId: 's1' }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/view-model', () => ({
  buildCanalView: () => ({ state: { tab: 'videos' }, header: {} }),
}))

describe('C1: etapas do montarCanal concorrente', () => {
  it('registra etapas.pagina e etapas.admin dentro de uma medição', async () => {
    const { montarCanal } = await import('@/app/cms/(authed)/youtube/competitors/_canal/montar')
    const m = novaMedicao('canal')
    const r = await comMedicao(m, () => montarCanal('c1', {}))
    expect(r.tipo).toBe('concorrente')
    expect(Object.keys(m.etapas)).toEqual(expect.arrayContaining(['pagina', 'admin']))
  })
  it('sem medição não lança', async () => {
    const { montarCanal } = await import('@/app/cms/(authed)/youtube/competitors/_canal/montar')
    await expect(montarCanal('c1', {})).resolves.toMatchObject({ tipo: 'concorrente' })
  })
})
