// @vitest-environment node
// acessoir-15: a página do canal pedida pelo id do YouTube (UC...) segue com o uuid RESOLVIDO pelo carregador (cache, leituras e vistas usam só ele).
import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ ds: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('@/lib/youtube/observatorio/load-page', () => ({ loadChannelDataset: vi.fn(async () => h.ds), loadPageRows: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/own-menu', () => ({ loadOwnMenuRows: vi.fn(async () => []) }))

import { carregarCanal } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import { rowsToDataset } from '@/lib/youtube/observatorio/load'

const NOW = Date.UTC(2026, 10, 15, 15, 0, 0)
const acesso = { edita: false, leitura: null, negativa: 'sem_direito' as const }
const UUID = '117b666d-7845-4f6c-92da-e4510b294395'
const UC = 'UCm2XfYsEgbAQPyMA8QRjYew'

describe('acessoir-15: carregarCanal com o UC do YouTube', () => {
  it('o canal vem pelo uuid resolvido: canalId é o uuid, não o UC pedido', async () => {
    const base = rowsToDataset({ settings: null, channels: [], ownChannels: [{ id: UUID, channel_id: UC, name: 'Thiago Figueiredo', handle: '@bythiagofigueiredo', subscriber_count: 3, last_synced_at: null }], videos: [], ownVideos: [], versions: [], daily: [], snapshots: [], spans: [], legacyChanges: [], readings: [], tasks: [], heartbeat: null, niches: [], ownSnapshots: [], onlineDesde: null } as never, NOW)
    h.ds = base
    const p = await carregarCanal({ siteId: 's', now: NOW, channelId: UC, acesso, meuCanalLembrado: null })
    expect(p.canalId).toBe(UUID)
    expect(p.obs?.channel(UUID)?.own).toBe(true)
  })
  it('canal não encontrado: sem canalId', async () => {
    h.ds = null
    const p = await carregarCanal({ siteId: 's', now: NOW, channelId: UC, acesso, meuCanalLembrado: null })
    expect(p.obs).toBeNull()
    expect(p.canalId).toBeUndefined()
  })
})
