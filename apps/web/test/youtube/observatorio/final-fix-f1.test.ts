// @vitest-environment node
/**
 * Revisão final F1: vídeo de canal PRÓPRIO nunca oferece "Pedir leitura à forja" e o pedido nunca chega ao insert
 * (youtube_intelligence_tasks.target_video_id referencia competitor_videos, não youtube_videos). Dados no formato de
 * produção: canal próprio com nicho 'viagem', vídeo próprio com uuid, forja anunciando leitura-video.
 */
import { describe, it, expect, vi } from 'vitest'
import { loadOracleOwns, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { buildForjaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const OWN_VIDEO = '55555555-5555-4555-8555-555555555555'
function prodLikeDataset(): Dataset {
  const ds = datasetFromOracle(loadOracleOwns('2'))
  const own = ds.channels.find(c => c.own)!
  own.niche = 'viagem'
  const v = ds.videos.find(x => x.ch === own.id && x.tracked)!
  v.id = OWN_VIDEO; v.niche = 'viagem'
  ds.queue = { ...ds.queue, capabilities: [...new Set([...ds.queue.capabilities, 'leitura-video'])] }
  return ds
}
const competitorVideo = (ds: Dataset) => ds.videos.find(v => !ds.channels.find(c => c.id === v.ch)!.own && v.tracked)!

describe('F1: vídeo próprio não pede leitura à forja', () => {
  it('Histórico do vídeo próprio: sem botão nem cartão da forja', () => {
    const obs = createObservatory(prodLikeDataset())
    const view = buildHistoricoView(obs, OWN_VIDEO, {})
    expect(view.state).not.toBe('not-found')
    expect(view.forja).toBeNull()
    expect(view.forjaCard).toBeNull()
  })
  it('a sessão recusa o pedido de um vídeo próprio', () => {
    const obs = createObservatory(prodLikeDataset())
    const r = obs.forja.session.ask(null, { type: 'leitura-video', video: OWN_VIDEO })
    expect(r.ok).toBe(false)
    expect(r.results.every(x => !x.ok)).toBe(true)
  })
  it('buildForjaView de um vídeo próprio não oferece pedido', () => {
    const obs = createObservatory(prodLikeDataset())
    const f = buildForjaView(obs, { screen: 'historico', type: 'leitura-video', niche: 'viagem', videoId: OWN_VIDEO })
    expect(f.ask).toBeNull()
    expect(f.button.mode).toBe('disabled')
  })
  it('controle: vídeo de concorrente continua com botão', () => {
    const ds = prodLikeDataset()
    const obs = createObservatory(ds)
    const view = buildHistoricoView(obs, competitorVideo(ds).id, {})
    expect(view.forja).not.toBeNull()
  })
  it('o serviço recusa o id de um vídeo próprio sem tocar no banco', async () => {
    vi.resetModules()
    const ds = prodLikeDataset()
    vi.doMock('@/lib/youtube/observatorio/load', async () => ({
      ...(await vi.importActual<typeof import('@/lib/youtube/observatorio/load')>('@/lib/youtube/observatorio/load')),
      loadDataset: async () => ds,
    }))
    const { askReading } = await import('@/lib/pipeline/services/forja-queue')
    const writes: string[] = []
    const builder: object = new Proxy({}, { get: (_t, p) => {
      if (p === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
      return () => { if (p === 'insert' || p === 'update' || p === 'upsert' || p === 'delete') writes.push(String(p)); return builder }
    } })
    const supabase = { from: () => builder }
    const ctx = { siteId: 's1', permissions: ['read', 'intelligence'], supabase, source: 'session' } as never
    const res = await askReading(ctx, { type: 'leitura-video', scope: 'viagem', videoId: OWN_VIDEO, userId: '00000000-0000-4000-8000-0000000000aa' }, ds.now)
    expect(res.data.ok).toBe(false)
    expect(res.data.results.every(r => !r.ok)).toBe(true)
    expect(writes).toEqual([])
  })
})
