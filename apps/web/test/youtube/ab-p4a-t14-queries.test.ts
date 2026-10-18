// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const cadeia: Record<string, unknown> = {}
for (const m of ['select', 'eq', 'neq', 'not', 'is', 'in', 'gte', 'lt', 'order', 'limit', 'from']) cadeia[m] = vi.fn().mockReturnValue(cadeia)
cadeia.single = vi.fn().mockResolvedValue({ data: null, error: null })
cadeia.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => cadeia }))

import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { faixaDaPagina } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-da-pagina'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { AbTestResults, AbTestCycleRow, VariantStats } from '@/lib/youtube/ab-types'

function stats(id: string, label: string, orig: boolean): VariantStats {
  return { variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig, total_impressions: 100, total_clicks: 5, avg_ctr: 0.05, cycles_completed: 1 }
}
function ciclo(n: number, variantId: string, inicio: string, fim: string | null): AbTestCycleRow {
  return { id: `c${n}`, test_id: 't', variant_id: variantId, cycle_number: n, started_at: inicio, ended_at: fim, impressions: 1, clicks: 1, ctr: 1, estimated_impressions: null, estimated_clicks: null, estimated_ctr: null, backfill_status: 'confirmed', backfill_attempts: 0, applied_metadata: null, created_at: inicio }
}
const RS = { title: { estado: 'ok', destino: 'original', em: '2026-10-12T08:02:00Z', forcado: false, escreveu: true, erro: null, attempts: 1 } }

const FK_UUID = '0b4c5f1e-9a7d-4e22-8c3b-1f6a2d9e7b10'
const YT_ID = '6jL-jeux_1Y'

function resultados(restore: unknown, status: 'paused' | 'completed' = 'paused', youtubeId: string | null = YT_ID): AbTestResults {
  return {
    test: makeTestRow({ status, youtube_video_id: FK_UUID, restore_status: restore }),
    variants: [stats('v-a', 'original', true), stats('v-b', 'B', false), stats('v-c', 'C', false)],
    confidence: 0.5, is_significant: false, suggested_winner_id: null,
    timeline: [ciclo(0, 'v-a', '2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z'), ciclo(1, 'v-c', '2026-10-07T08:00:00Z', '2026-10-08T08:00:00Z'), ciclo(2, 'v-b', '2026-10-09T08:00:00Z', null)],
    data_freshness: new Date().toISOString(),
    youtubeId,
  } as AbTestResults
}

describe('T14 ligação: o detalhe passa os campos da faixa', () => {
  it('restore_status legível, id do YouTube e variantes com rótulo (o id mapeia para a letra)', async () => {
    const v = await toDetailView(resultados(RS))
    expect(v.restoreStatus).toEqual({ title: { ...RS.title, escreveu: true, motivo: undefined } })
    expect(v.youtubeVideoId).toBe(YT_ID)
    expect(v.youtubeVideoId).not.toBe(FK_UUID)
    expect(v.variantDb.map(x => [x.id, x.label])).toEqual([['v-a', 'A'], ['v-b', 'B'], ['v-c', 'C']])
  })
  it('nulo continua nulo; ilegível também vira nulo na view (a página distingue pelo jsonb cru)', async () => {
    expect((await toDetailView(resultados(null))).restoreStatus).toBeNull()
    expect((await toDetailView(resultados({ title: { estado: 'lixo' } }))).restoreStatus).toBeNull()
  })
  it('noArAntes: variante e início do último ciclo FECHADO, não do aberto', async () => {
    const v = await toDetailView(resultados(RS))
    expect(v.noArAntes).toEqual({ label: 'C', desde: '2026-10-07T08:00:00Z' })
  })
  it('sem ciclo fechado, noArAntes é nulo', async () => {
    const r = resultados(RS); r.timeline = [ciclo(0, 'v-a', '2026-10-01T10:00:00Z', null)]
    expect((await toDetailView(r)).noArAntes).toBeNull()
  })
  it('o link do Studio usa o id do YouTube, não a FK uuid', async () => {
    const v = await toDetailView(resultados({ title: { ...RS.title, estado: 'falhou', erro: 'x' } }))
    const f = faixaDaPagina(v, { title: { ...RS.title, estado: 'falhou', erro: 'x' } }, new Date()).faixa
    expect(f?.linkStudio).toBe(`https://studio.youtube.com/video/${YT_ID}/edit`)
    expect(f?.linkStudio).not.toContain(FK_UUID)
  })
  it('vídeo não achado: youtubeVideoId nulo e a faixa sem link (ilegível também)', async () => {
    const v = await toDetailView(resultados({ title: { estado: 'lixo' } }, 'paused', null))
    expect(v.youtubeVideoId).toBeNull()
    const f = faixaDaPagina(v, { title: { estado: 'lixo' } }, new Date())
    expect(f.ilegivel).toBe(true)
    expect(f.faixa?.linkStudio).toBeNull()
    expect(f.faixa?.linkRotulo).toBeNull()
  })
})
