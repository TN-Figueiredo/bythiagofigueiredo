// @vitest-environment node
// Envio B2: a ação get_observed do youtube_observatory chama a MESMA função da rota (lerLeituraDosConcorrentes), com o serviço REAL sobre um cliente sintético.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSb, type Consulta, type Resposta } from '../youtube/observatorio/sinais/fake-sb'

const SITE = '11111111-1111-4111-8111-111111111111'
const AGORA = Date.parse('2026-10-23T12:00:00.000Z')
const H = 3_600_000
const iso = (h: number): string => new Date(AGORA + h * H).toISOString()
const mundo = vi.hoisted(() => ({ sb: null as unknown }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: SITE, permissions: ['read'], keyHash: 'h', keyId: 'k' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mundo.sb }))

import { youtubeObservatory, LIMITE_DO_TEXTO_DA_FERRAMENTA } from '@/lib/pipeline/mcp/services/youtube-observatory'
import { lerLeituraDosConcorrentes } from '@/lib/pipeline/services/leitura-concorrentes'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
function montar(n: number): void {
  const alvos: Row[] = [], cursores: Row[] = [], linhas: Row[] = [], videos: Row[] = []
  for (let i = 0; i < n; i++) {
    const id = `vid${String(i).padStart(4, '0')}`
    alvos.push({ id: `a${i}`, site_id: SITE, tipo: 'concorrente', youtube_video_id: id, rodadas: 40, ultima_rodada_em: iso(-2), saiu_em: null, saiu_por: null })
    videos.push({ video_id: id, title: `Video ${id}`, published_at: iso(-480), competitor_channel_id: 'ch1' })
    cursores.push({ site_id: SITE, youtube_video_id: id, avaliado_ate_rodada: 39, avaliado_em: iso(-1), avaliado_motivo: 'ok', validas_titulo: 8, validas_miniatura: 8 })
    const comum = { site_id: SITE, youtube_video_id: id, tipo_troca: 'sequencial', versao_regra: 2, motivo: null, ultima_atualizacao_em: iso(-1), veredito: 'troca_observada', ficou_estado: 'estavel' }
    linhas.push({ ...comum, campo: 'titulo', trocas: [{ v: 1, ref: 'Titulo A', ultima_vista: iso(-30) }, { v: 2, ref: 'Titulo B', ultima_vista: iso(-1) }],
      ficou: { titulo: 'Titulo B', sumindo: false, janela_teste: null, transicao: { antes: 'Titulo A', de: iso(-30), ate: iso(-24) }, versoes: [{ v: 2, rodadas_em_w: 8, ultima_vista: iso(-1) }] } })
    linhas.push({ ...comum, campo: 'miniatura', trocas: [{ v: 1, ref: 'x', ultima_vista: iso(-30) }, { v: 2, ref: 'y', ultima_vista: iso(-1) }],
      ficou: { dhash: 'ffffffffffffffff', transicao: { antes: '0000000000000000', de: iso(-30), ate: iso(-24) } } })
  }
  const canais: Row[] = [{ id: 'ch1', site_id: SITE, channel_name: 'Canal Um', removal_requested_at: null }]
  const tabelas: Record<string, Row[]> = { yt_watch_alvos: alvos, ab_native_obs_cursor: cursores, ab_native_observados: linhas, competitor_channels: canais, competitor_videos: videos }
  mundo.sb = fakeSb((c: Consulta): Resposta => {
    const base = tabelas[c.tabela] ?? []
    const rows = base.filter(r => c.filtros.every(f => (f.op === 'eq' ? r[f.col] === f.val : f.op === 'in' ? (f.val as unknown[]).includes(r[f.col]) : true)))
    return c.faixa && c.faixa[0] > 0 ? { data: [], count: rows.length } : { data: rows, count: rows.length }
  }).sb
}
const texto = (r: { content: Array<{ type: string; text?: string }> }): string => r.content[0]!.text ?? ''

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA) })
afterEach(() => { vi.useRealTimers(); delete process.env.OBS_TROCAS_CONCORRENTE })

describe('get_observed', () => {
  it('flag off (variável apagada): ligada false', async () => {
    delete process.env.OBS_TROCAS_CONCORRENTE
    montar(2)
    const r = await youtubeObservatory({ action: 'get_observed' })
    expect(r.isError).toBeFalsy()
    expect(JSON.parse(texto(r))).toMatchObject({ ligada: false, motivo: 'flag_off', resumo: 'Leitura de concorrentes desligada' })
  })

  it('flag on: o mesmo JSON que a função da rota devolve', async () => {
    process.env.OBS_TROCAS_CONCORRENTE = 'on'
    montar(3)
    const viaMcp = JSON.parse(texto(await youtubeObservatory({ action: 'get_observed' }))) as unknown
    const direto = await lerLeituraDosConcorrentes({ siteId: SITE, permissions: ['read'], supabase: mundo.sb as SupabaseClient }, { agoraMs: AGORA })
    expect(viaMcp).toEqual(JSON.parse(JSON.stringify(direto.data)))
  })

  it('150 vídeos: texto dentro do limite, itens_omitidos > 0 e contagem igual à da função', async () => {
    process.env.OBS_TROCAS_CONCORRENTE = 'on'
    montar(150)
    const t = texto(await youtubeObservatory({ action: 'get_observed' }))
    expect(t.length).toBeLessThanOrEqual(LIMITE_DO_TEXTO_DA_FERRAMENTA)
    const d = JSON.parse(t) as { itens: unknown[]; itens_omitidos: number; contagem: unknown }
    const direto = await lerLeituraDosConcorrentes({ siteId: SITE, permissions: ['read'], supabase: mundo.sb as SupabaseClient }, { agoraMs: AGORA })
    if (!direto.data.ligada) throw new Error('esperava ligada')
    expect(d.itens_omitidos).toBeGreaterThan(0)
    expect(d.itens.length + d.itens_omitidos).toBe(direto.data.itens.length)
    expect(d.contagem).toEqual(JSON.parse(JSON.stringify(direto.data.contagem)))
  })

  it('ação desconhecida cita get_observed', async () => {
    const r = await youtubeObservatory({ action: 'nao_existe' })
    expect(r.isError).toBe(true)
    expect(texto(r)).toContain('get_observed')
  })
})
