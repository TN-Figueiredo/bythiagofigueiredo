// @vitest-environment node
// A5 · E7, Tarefa 6a: o anúncio da ferramenta `youtube_observatory` diz exatamente os parâmetros que o adaptador lê
// (type, bookmarked e tier eram lidos e não anunciados; channel_id era anunciado e ignorado).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const servico = vi.hoisted(() => ({
  listCompetitorChannels: vi.fn(async () => ({ data: { channels: [], count: 0 } })),
  listCompetitorChanges: vi.fn(async () => ({ data: { changes: [], count: 0 } })),
  listCompetitorOutliers: vi.fn(async () => ({ data: { outliers: [], count: 0 } })),
  getCompetitorInsights: vi.fn(async () => ({ data: {} })),
}))
vi.mock('@/lib/pipeline/services/competitors', () => servico)
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: 'site-sintetico', permissions: ['read'], keyHash: 'h' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))

import { YoutubeObservatoryShape } from '@/lib/pipeline/mcp/tools'
import { youtubeObservatory, PARAMETROS_LIDOS } from '@/lib/pipeline/mcp/services/youtube-observatory'

const shape = z.object(YoutubeObservatoryShape)
beforeEach(() => Object.values(servico).forEach(f => f.mockClear()))

describe('o anúncio e o adaptador', () => {
  it('falam dos mesmos parâmetros', () => {
    expect(new Set(Object.keys(YoutubeObservatoryShape))).toEqual(new Set(PARAMETROS_LIDOS))
  })

  it('todo params.<nome> lido no arquivo do adaptador está em PARAMETROS_LIDOS', () => {
    const t = readFileSync(join(process.cwd(), 'src/lib/pipeline/mcp/services/youtube-observatory.ts'), 'utf8')
    const lidos = new Set([...t.matchAll(/params\.(\w+)/g)].map(m => m[1]!))
    expect(lidos.size).toBeGreaterThan(3)
    for (const nome of lidos) expect(PARAMETROS_LIDOS as readonly string[], nome).toContain(nome)
  })

  it('type, bookmarked e tier são anunciados; channel_id não', () => {
    expect(Object.keys(YoutubeObservatoryShape)).toEqual(expect.arrayContaining(['type', 'bookmarked', 'tier']))
    expect(Object.keys(YoutubeObservatoryShape)).not.toContain('channel_id')
  })

  it('os valores de type são os de change_type do banco, mais all', () => {
    expect(shape.safeParse({ action: 'get_changes', type: 'title' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'thumbnail' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'description' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'all' }).success).toBe(true)
    expect(shape.safeParse({ action: 'get_changes', type: 'tags' }).success).toBe(false)
    expect(shape.safeParse({ action: 'get_outliers', tier: 'banana' }).success).toBe(false)
    expect(shape.safeParse({ action: 'get_outliers', tier: 'top' }).success).toBe(true)
  })

  it('a descrição de get_outliers diz o que ele faz, não "mudanças marcadas"', () => {
    const d = YoutubeObservatoryShape.action.description ?? ''
    expect(d).toContain('videos with a multiplier of 2x or more vs the channel')
    expect(d).not.toContain('bookmarked notable changes')
  })

  it('chamada antiga com channel_id continua aceita, e a chave some do resultado', () => {
    const r = shape.safeParse({ action: 'get_changes', channel_id: '00000000-0000-4000-8000-000000000001' })
    expect(r.success).toBe(true)
    if (r.success) expect(Object.keys(r.data)).not.toContain('channel_id')
  })
})

describe('o adaptador repassa o que lê', () => {
  it('get_changes repassa type e bookmarked', async () => {
    await youtubeObservatory({ action: 'get_changes', type: 'title', bookmarked: true, limit: 10 })
    expect(servico.listCompetitorChanges).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'title', bookmarked: true, limit: 10 }))
  })

  it('list_channels, get_outliers e get_insights seguem como antes', async () => {
    await youtubeObservatory({ action: 'list_channels' })
    expect(servico.listCompetitorChannels).toHaveBeenCalledTimes(1)
    await youtubeObservatory({ action: 'get_outliers', tier: 'high', limit: 7, fmt: 'short' })
    expect(servico.listCompetitorOutliers).toHaveBeenCalledWith(expect.anything(), { tier: 'high', limit: 7, fmt: 'short' })
    await youtubeObservatory({ action: 'get_outliers' })
    expect(servico.listCompetitorOutliers).toHaveBeenLastCalledWith(expect.anything(), { tier: 'all', limit: 25, fmt: 'long' })
    await youtubeObservatory({ action: 'get_insights' })
    expect(servico.getCompetitorInsights).toHaveBeenCalledTimes(1)
  })
})
