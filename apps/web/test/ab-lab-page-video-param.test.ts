// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

const lerLinhas = vi.fn()
vi.mock('@/lib/youtube/teste-youtube/nativo/lista-borda', () => ({ lerLinhasDoCaminho: (...a: unknown[]) => lerLinhas(...a) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', () => ({
  getAbTestsForSite: async () => ({ active: [], completed: [], paused: [], draft: [] }),
  getAbSiteSettings: async () => ({}),
  getChannelLearnings: async () => null,
  getSuggestedVideos: async () => [],
  getEligibleVideosForPicker: async () => [],
  toCardView: (x: unknown) => x,
  toDraftList: () => [],
  computeDashboardStats: () => ({}),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard', () => ({ AbLabDashboard: () => null }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-servidor', () => ({ ListaCaminhoServidor: () => null }))

import AbLabPage from '@/app/cms/(authed)/youtube/ab-lab/page'
import { videoDaUrl } from '@/app/cms/(authed)/youtube/ab-lab/video-param'
import { ListaCaminhoServidor } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho-servidor'

beforeEach(() => lerLinhas.mockReset())

describe('videoDaUrl', () => {
  it.each([
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['abc_DEF-123', 'abc_DEF-123'],
    ['curto', null],
    ['dQw4w9WgXcQ1', null],
    ['dQw4w9WgXc!', null],
    ['', null],
    [undefined, null],
    [['dQw4w9WgXcQ', 'outro'], null],
  ])('%j -> %j', (entrada, saida) => {
    expect(videoDaUrl(entrada as string | string[] | undefined)).toBe(saida)
  })
})

function achar(no: ReactNode, tipo: unknown): ReactElement | null {
  if (!isValidElement(no)) return null
  const el = no as ReactElement<{ children?: ReactNode; [k: string]: unknown }>
  if (el.type === tipo) return el
  for (const v of Object.values(el.props)) {
    const lista = Array.isArray(v) ? v : [v]
    for (const f of lista) { const r = achar(f as ReactNode, tipo); if (r) return r }
  }
  return null
}

describe('page: ?video= e leitura da lista', () => {
  it('não lê a lista no corpo do page (a leitura é do filho assíncrono)', async () => {
    const el = await AbLabPage({ searchParams: Promise.resolve({ video: 'dQw4w9WgXcQ' }) })
    expect(lerLinhas).not.toHaveBeenCalled()
    const servidor = achar(el, ListaCaminhoServidor)
    expect(servidor).not.toBeNull()
    expect(servidor?.props).toMatchObject({ siteId: 'site-1', videoInicial: 'dQw4w9WgXcQ' })
  })
  it('id fora do formato vira null antes de qualquer consulta', async () => {
    const el = await AbLabPage({ searchParams: Promise.resolve({ video: "x'; drop" }) })
    expect(achar(el, ListaCaminhoServidor)?.props).toMatchObject({ videoInicial: null })
    expect(lerLinhas).not.toHaveBeenCalled()
  })
  it('sem o parâmetro: null', async () => {
    const el = await AbLabPage({ searchParams: Promise.resolve({}) })
    expect(achar(el, ListaCaminhoServidor)?.props).toMatchObject({ videoInicial: null })
  })
})
