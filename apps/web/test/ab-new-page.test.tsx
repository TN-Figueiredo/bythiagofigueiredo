// @vitest-environment node
// Costura da page de ab-lab/new (Yannis M5, Phil M-5): ordem guarda → leitura da referência, tipoInicial, vídeo fora dos 100.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  settings: vi.fn(), eligible: vi.fn(), draft: vi.fn(), foraDosCem: vi.fn(), cliente: vi.fn(), props: [] as Array<Record<string, unknown>>,
  maybeSingle: vi.fn(),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', () => ({ getAbSiteSettings: m.settings, getEligibleVideosForPicker: m.eligible, getAbDraftById: m.draft }))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/queries', () => ({ getAbSiteSettings: m.settings, getEligibleVideosForPicker: m.eligible, getAbDraftById: m.draft }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { m.cliente(); return cadeia } }))
const redir = vi.hoisted(() => vi.fn((u: string) => { throw new Error('NEXT_REDIRECT:' + u) }))
vi.mock('next/navigation', () => ({ redirect: redir }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/new/client', () => ({ NewTestClient: (p: Record<string, unknown>) => { m.props.push(p); return null } }))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/new/video-fora', () => ({ lerVideoForaDosCem: m.foraDosCem }))

const cadeia: Record<string, unknown> = {}
for (const k of ['from', 'select', 'eq', 'or', 'limit']) cadeia[k] = () => cadeia
cadeia.maybeSingle = () => m.maybeSingle()

import NewAbTestPage from '../src/app/cms/(authed)/youtube/ab-lab/new/page'

const U = '0b4c1e6a-1111-4222-8333-444455556666'
const R = '21e80fef-6acf-56e1-8fb0-a495876a2a8c'
const roda = async (sp: Record<string, string>) => { m.props.length = 0; const el = await NewAbTestPage({ searchParams: Promise.resolve(sp) }); (el as unknown as { type: (p: unknown) => unknown }).type((el as unknown as { props: unknown }).props); return (el as unknown as { props: Record<string, unknown> }).props }

beforeEach(() => {
  for (const f of [m.settings, m.eligible, m.draft, m.foraDosCem, m.cliente, m.maybeSingle]) f.mockReset()
  m.settings.mockResolvedValue({}); m.eligible.mockResolvedValue([{ id: 'v1' }]); m.draft.mockResolvedValue(null); m.foraDosCem.mockResolvedValue(null)
  m.maybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('page ab-lab/new', () => {
  it('(a) guarda que rejeita: a referência nem é lida no banco', async () => {
    m.settings.mockRejectedValue(new Error('negado'))
    await expect(roda({ ref: 'competitor', changeType: 'title', competitorTitle: 'X', refVideoId: R })).rejects.toThrow('negado')
    expect(m.cliente).not.toHaveBeenCalled()
  })
  it('reporter (forbidden) vai para /cms (a lista também exige edição) em vez de cair no error.tsx', async () => {
    m.settings.mockRejectedValue(new Error('forbidden'))
    await expect(roda({})).rejects.toThrow('NEXT_REDIRECT:/cms')
    expect(redir).toHaveBeenCalledWith('/cms')
  })
  it('(b) changeType sem ref: tipoInicial chega e não há competitorContext', async () => {
    const p = await roda({ videoId: 'v1', changeType: 'title' })
    expect(p.tipoInicial).toBe('title')
    expect(p.competitorContext).toBeUndefined()
  })
  it('(c) uuid fora dos 100 entra em eligibleVideos', async () => {
    m.foraDosCem.mockResolvedValue({ id: U })
    m.maybeSingle.mockResolvedValue({ data: { id: U }, error: null })
    const p = await roda({ videoId: U })
    expect((p.eligibleVideos as Array<{ id: string }>).map(v => v.id)).toContain(U)
    expect(p.initialVideoId).toBe(U)
  })
  it('referência sem refVideoId: sem título nem imagem de terceiro (Phil M-5)', async () => {
    const p = await roda({ ref: 'competitor', changeType: 'title', competitorTitle: 'X qualquer' })
    expect(p.competitorContext).toMatchObject({ titulo: null, thumb: null, canal: null, hrefOrigem: null })
  })
  it('referência com refVideoId que não resolve no site: também sem título', async () => {
    const p = await roda({ ref: 'competitor', changeType: 'title', competitorTitle: 'X qualquer', refVideoId: R })
    expect(p.competitorContext).toMatchObject({ titulo: null, thumb: null })
  })
})
