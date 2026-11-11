// @vitest-environment node
// A4 T3: `reacaoComEstado` (a regra de `reacao` com o estado de saída), sinalizadores de curtidas/comentários em `InfoDoVideo`
// e `lidoEmMaisAntigo` em `MedidasDoSite`.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { falsoPostgrest, type Linha } from './medidas-fixture'
import { engajamentoDoVideo, reacao, reacaoComEstado } from '@/lib/youtube/observatorio/medidas/engajamento'

vi.mock('server-only', () => ({}))

const H = 3_600_000
const D = 24 * H
const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const LAST = Date.UTC(2026, 9, 14, 10, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()
const canal = (id: string): Linha => ({ id, site_id: 's1', collection_paused_at: null, missing_since: null, subscribers_hidden: false, last_ok_synced_at: iso(LAST) })
const video = (id: string, c: string, extra: Linha = {}): Linha => ({ id, competitor_channel_id: c, video_id: 'yt' + id, published_at: iso(T0 - 10 * D), is_short: false, view_count: 1000, ...extra })
const obsDe = (ids: string[], last: number | null = LAST) => ({ channels: ids.map((id) => ({ id, own: false, sync: { last } })), videos: [] }) as never
const tabelas = (videos: Linha[]): Record<string, Linha[]> => ({ competitor_channels: [canal('a'), canal('b')], competitor_videos: videos, competitor_channel_snapshots: [], competitor_video_daily: [], competitor_video_early: [], competitor_video_marks: [], competitor_video_mark_misses: [] })

async function montar(t: Record<string, Linha[]>) {
  vi.resetModules()
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  const mod = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-site')
  const f = falsoPostgrest(t)
  const abrir = (canais: string[], agoraMs: number, last: number | null = LAST) => mod.carregarMedidasDoSite(f.sb, { siteId: 's1', obs: obsDe(['a', 'b'], last), canais, agoraMs })
  return { abrir, f }
}
beforeEach(() => { vi.resetModules() })

describe('A4 T3: reacaoComEstado', () => {
  it('zero com sinalizador nulo é não medido (sem_sinalizador); oculto é não medido (oculto)', () => {
    expect(reacaoComEstado(0, null)).toEqual({ x: null, estado: 'nao_medido', causa: 'sem_sinalizador' })
    expect(reacaoComEstado(12, true)).toEqual({ x: null, estado: 'nao_medido', causa: 'oculto' })
  })
  it('zero com sinalizador false é zero medido; 7 com false é medido', () => {
    expect(reacaoComEstado(0, false)).toEqual({ x: 0, estado: 'zero_medido' })
    expect(reacaoComEstado(7, false)).toEqual({ x: 7, estado: 'medido' })
    expect(reacaoComEstado(7, null)).toEqual({ x: 7, estado: 'medido' })
  })
  it('valor nulo ou não finito: não medido; `reacao` continua devolvendo number | null como antes', () => {
    expect(reacaoComEstado(null, false).estado).toBe('nao_medido')
    expect(reacaoComEstado(Number.NaN, false).estado).toBe('nao_medido')
    expect(reacao(0, null)).toBeNull(); expect(reacao(12, true)).toBeNull(); expect(reacao(0, false)).toBe(0); expect(reacao(7, false)).toBe(7)
  })
  it('engajamentoDoVideo não mudou: 0 curtidas com sinalizador nulo e comentários medidos = só comentários', () => {
    const r = engajamentoDoVideo({ agendadoOuNoAr: false, temMarca30: false, idadeDias: 5, views30: null, likes30: null, comments30: null, viewsHoje: 10_000, likesHoje: 0, commentsHoje: 30, likesHidden: null, commentsDisabled: false } as never)
    expect(r.estado).toBe('medido')
    expect(JSON.stringify(r)).toContain('so_comentarios')
  })
})

describe('A4 T3: InfoDoVideo e lidoEmMaisAntigo', () => {
  it('(b) likes_hidden e comments_disabled chegam em videos.get(id); nulo continua nulo', async () => {
    const { abrir } = await montar(tabelas([video('v1', 'a', { likes_hidden: true, comments_disabled: false }), video('v2', 'a')]))
    const r = await abrir(['a'], T0)
    expect(r.videos!.get('v1')).toMatchObject({ likesHidden: true, commentsDisabled: false })
    expect(r.videos!.get('v2')).toMatchObject({ likesHidden: null, commentsDisabled: null })
  })
  it('(c) o mais antigo dos lidoEm das entradas servidas', async () => {
    const { abrir } = await montar(tabelas([video('v1', 'a'), video('v2', 'b')]))
    await abrir(['b'], T0 - 5 * H)
    await abrir(['a'], T0 - 2 * H)
    const r = await abrir(['a', 'b'], T0)
    expect(r.lidoEmMaisAntigo).toBe(iso(T0 - 5 * H))
  })
  it('(c) leitura fria (sem last) = agoraMs', async () => {
    const { abrir } = await montar(tabelas([video('v1', 'a')]))
    const r = await abrir(['a'], T0, null)
    expect(r.lidoEmMaisAntigo).toBe(iso(T0))
  })
  it('(c) nenhum canal lido, ou nenhum pedido: null', async () => {
    const { abrir } = await montar({ ...tabelas([]), competitor_channels: [] })
    expect((await abrir(['a'], T0)).lidoEmMaisAntigo).toBeNull()
    expect((await abrir([], T0)).lidoEmMaisAntigo).toBeNull()
  })
  it('(c) leitura parcial = agoraMs, mesmo com a velha do outro canal mais antiga', async () => {
    const t = tabelas([video('v1', 'a'), video('v2', 'b')])
    const { abrir } = await montar({ ...t, competitor_video_marks: undefined as never }) // tabela ausente: a leitura de marcas volta não lida
    await abrir(['b'], T0 - 5 * H)
    const r = await abrir(['a', 'b'], T0)
    expect(r.lidoEmMaisAntigo).toBe(iso(T0))
  })
})
