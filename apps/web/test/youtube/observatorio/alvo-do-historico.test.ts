// @vitest-environment node
/**
 * Trem 7 (CM, Yannis m1): `alvoDoHistorico` direto, sem mockar o módulo: os 4 estados de quem ganha o bloco do Histórico do vídeo
 * (a regra única da página e do pacote da IA). Só a leitura do cliente de serviço é isolada.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))

import { alvoDoHistorico } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/ler-do-video'
import type { HistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

// uma data bem antes de a leitura "Estourou e parou" existir: a leitura síncrona fica pronta, sem consulta
const ANTES = Date.UTC(2020, 0, 1)
const view = (o: Partial<HistoricoView> & { notFound?: boolean }) => ({ notFound: false, untracked: null, video: { id: 'v1' }, ...o }) as unknown as HistoricoView
const noMotor = { id: 'v1', ch: 'c1' }
const obsDe = (videos: Array<{ id: string; ch: string }>) => ({
  videos,
  video: (id: string) => (id === 'v1' ? { id: 'v1', ch: 'c1', ageDays: 3, pub: ANTES - 3 * 86_400_000 } : undefined),
  channel: (id: string) => (id === 'c1' ? { id: 'c1', name: 'Canal', own: false } : undefined),
}) as unknown as Parameters<typeof alvoDoHistorico>[1]

describe('alvoDoHistorico', () => {
  it('não encontrado: nem motor nem leitura', () => {
    expect(alvoDoHistorico(view({ notFound: true, video: null }), obsDe([noMotor]), ANTES)).toEqual({ doMotor: undefined, sincrona: null })
  })
  it('untracked com o id em obs.videos: não ganha o bloco do motor nem a leitura', () => {
    const r = alvoDoHistorico(view({ untracked: { notice: 'x', href: '/y' } }), obsDe([noMotor]), ANTES)
    expect(r).toEqual({ doMotor: undefined, sincrona: null })
  })
  it('acompanhado em obs.videos: o vídeo do motor e a leitura pronta', () => {
    const r = alvoDoHistorico(view({}), obsDe([noMotor]), ANTES)
    expect(r.doMotor).toBe(noMotor)
    expect((r.sincrona as { tipo: string }).tipo).toBe('ainda_nao_existe')
  })
  it('acompanhado fora de obs.videos com cartão antes da data: sem motor, com a leitura pronta (o elo do M-3)', () => {
    const r = alvoDoHistorico(view({}), obsDe([]), ANTES)
    expect(r.doMotor).toBeUndefined()
    expect((r.sincrona as { tipo: string }).tipo).toBe('ainda_nao_existe')
  })
})
