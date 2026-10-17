// A5 E5a, Tarefa 14a: carregarMedidasDoCanalInteiro (um canal, uma leitura; série, mudanças e horas em entradas próprias).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const cacheMem = vi.hoisted(() => new Map<string, unknown>())
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[]) => async (...a: unknown[]) => {
    const k = JSON.stringify([keyParts, a])
    if (cacheMem.has(k)) return cacheMem.get(k)
    const v = await fn(...a)
    cacheMem.set(k, v)
    return v
  },
  revalidateTag: () => undefined,
}))
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

import { carregarMedidasDoCanalInteiro, SERIE_MAX_BYTES_NO_CACHE, type PedidoDoCanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { IObservatorioDeMedidas } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { espiar, falsoPostgrest, type Linha } from './medidas-fixture'

const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const MIN = 60_000
const H = 3_600_000
const D = 86_400_000
const LAST = Date.UTC(2026, 9, 14, 10, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()

const canalRow = (id: string, site = 's1'): Linha => ({ id, site_id: site, collection_paused_at: null, missing_since: null, subscribers_hidden: false, last_ok_synced_at: iso(LAST) })
const videoRow = (id: string, canal: string, dias: number): Linha => ({ id, competitor_channel_id: canal, video_id: 'yt' + id, published_at: iso(T0 - dias * D), is_short: false, view_count: 1000 })
const diario = (video: string, dias: number, views: number): Linha => ({ video_id: video, snap_date: iso(T0 - dias * D).slice(0, 10), taken_at: iso(T0 - dias * D), views, likes: null, comments: null })
function tabelas(canais: string[], extra: Record<string, Linha[]> = {}): Record<string, Linha[]> {
  return {
    competitor_channels: canais.map((c) => canalRow(c)),
    competitor_videos: canais.flatMap((c) => [videoRow(c + 'v1', c, 10), videoRow(c + 'v2', c, 40)]),
    competitor_channel_snapshots: [],
    competitor_video_daily: [diario('av1', 9, 500), diario('av1', 3, 900), diario('av2', 30, 700)],
    competitor_video_early: [], competitor_video_marks: [], competitor_video_mark_misses: [],
    competitor_video_versions: [], competitor_field_versions: [],
    competitor_video_hourly: [], competitor_agenda_runs: [],
    ...extra,
  }
}
const obsDe = (canais: string[], own: string[] = [], last: number | null = LAST): IObservatorioDeMedidas => ({
  channels: [...canais.map((id) => ({ id, own: false, sync: { last } })), ...own.map((id) => ({ id, own: true, sync: { last } }))],
  videos: [],
})
const pedido = (o: Partial<PedidoDoCanalInteiro> = {}): PedidoDoCanalInteiro => ({
  siteId: 's1', obs: obsDe(['a']), channelId: 'a', agoraMs: T0, pedir: { serie: true, mudancas: true, horas: true }, ...o,
})
const n = (f: { consultas: ReadonlyArray<{ tabela: string }> }, tabela: string): number => f.consultas.filter((c) => c.tabela === tabela).length

beforeEach(() => { cacheMem.clear(); sentry.captureMessage.mockClear() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('E5a T14a: um canal inteiro, dado ausente', () => {
  it('canal próprio ou id que não está em obs.channels: canal_de_outro_site e zero consultas', async () => {
    const f = falsoPostgrest(tabelas(['a', 'meu']))
    for (const id of ['meu', 'zzz']) {
      const r = await carregarMedidasDoCanalInteiro(f.sb, pedido({ obs: obsDe(['a'], ['meu']), channelId: id }))
      expect(r.medidas).toEqual({ naoCarregou: 'canal_de_outro_site' })
    }
    expect(f.consultas.length).toBe(0)
  })
  it('série não lida: as medidas de 1, 7 e 30 dias saem pelas marcas e o resto do canal segue', async () => {
    const t = tabelas(['a']); delete (t as Partial<typeof t>).competitor_video_daily
    const f = falsoPostgrest(t)
    const r = await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(r.serie).toEqual({ lido: false, causa: 'schema_ausente' })
    expect(r.medidas && 'naoCarregou' in r.medidas).toBe(false)
    expect(r.videos.lido).toBe(true)
    expect(r.retratos.lido).toBe(true)
    expect(r.falhas).toContainEqual({ medida: 'serie', classe: 'schema_ausente' })
  })
  it('erro do banco na série não derruba canal, vídeos, marcas e retratos', async () => {
    const f = falsoPostgrest(tabelas(['a']), { erros: { competitor_video_daily: { code: 'XX000', message: 'x' } } })
    const r = await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(r.serie).toEqual({ lido: false, causa: 'erro_do_banco' })
    expect(r.videos.lido && r.retratos.lido).toBe(true)
    expect(r.medidas && 'naoCarregou' in r.medidas).toBe(false)
  })
  it('mudanças não lidas: só a parte das mudanças é não lida', async () => {
    const t = tabelas(['a']); delete (t as Partial<typeof t>).competitor_video_versions
    const r = await carregarMedidasDoCanalInteiro(falsoPostgrest(t).sb, pedido())
    expect(r.mudancas).toEqual({ lido: false, causa: 'schema_ausente' })
    expect(r.serie !== 'nao_pedida' && r.serie.lido).toBe(true)
  })
  it('tabela de horas ausente: schema_ausente só na parte das horas', async () => {
    const t = tabelas(['a']); delete (t as Partial<typeof t>).competitor_video_hourly
    const r = await carregarMedidasDoCanalInteiro(falsoPostgrest(t).sb, pedido())
    expect(r.horas).toEqual({ lido: false, causa: 'schema_ausente' })
    expect(r.serie !== 'nao_pedida' && r.serie.lido).toBe(true)
  })
  it('canal sem vídeo nos últimos 180 dias: zero consultas de série', async () => {
    const t = tabelas(['a']); t.competitor_videos = [videoRow('av1', 'a', 400)]
    const f = falsoPostgrest(t)
    const r = await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(n(f, 'competitor_video_daily')).toBe(0)
    expect(r.serie).toEqual({ lido: true, dados: new Map() })
  })
  it('o que não foi pedido não é consultado', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    const r = await carregarMedidasDoCanalInteiro(f.sb, pedido({ pedir: { serie: false, mudancas: false, horas: false } }))
    expect([r.serie, r.mudancas, r.horas]).toEqual(['nao_pedida', 'nao_pedida', 'nao_pedida'])
    expect(n(f, 'competitor_video_daily') + n(f, 'competitor_video_hourly') + n(f, 'competitor_video_versions')).toBe(0)
  })
  it('canal que não responde: as outras partes nascem com a mesma causa, sem mais consultas', async () => {
    const f = falsoPostgrest(tabelas(['a']), { erros: { competitor_channels: { code: 'XX000', message: 'x' } } })
    const r = await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(r.medidas).toEqual({ naoCarregou: 'erro_do_banco' })
    expect(r.serie).toEqual({ lido: false, causa: 'erro_do_banco' })
    expect(n(f, 'competitor_video_daily')).toBe(0)
  })
})

describe('E5a T14a: um canal inteiro, erro e cache', () => {
  it('erro inesperado dentro do carregador: devolve naoCarregou, não rejeita', async () => {
    const obs = { get channels(): never { throw new Error('bug') }, videos: [] } as unknown as IObservatorioDeMedidas
    const r = await carregarMedidasDoCanalInteiro(falsoPostgrest(tabelas(['a'])).sb, pedido({ obs }))
    expect(r.medidas).toEqual({ naoCarregou: 'erro_do_banco' })
    expect(r.falhas).toContainEqual({ medida: 'canal', classe: 'calculo_falhou' })
  })
  it('série não lida não é guardada: a segunda chamada consulta de novo', async () => {
    const f = falsoPostgrest(tabelas(['a']), { erros: { competitor_video_daily: { code: 'XX000', message: 'x' } } })
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const antes = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(n(f, 'competitor_video_daily')).toBe(antes * 2)
  })
  it('série lida é guardada: a segunda chamada faz zero consultas de série', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const antes = n(f, 'competitor_video_daily')
    expect(antes).toBeGreaterThan(0)
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(n(f, 'competitor_video_daily')).toBe(antes)
  })
  it('entrada de série de 16 minutos é lida de novo; de 10, usada', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const n0 = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ agoraMs: T0 + 10 * MIN }))
    expect(n(f, 'competitor_video_daily')).toBe(n0)
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ agoraMs: T0 + 16 * MIN }))
    expect(n(f, 'competitor_video_daily')).toBe(n0 * 2)
  })
  it('horas: entrada de 6 minutos é lida de novo; de 4, usada', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const n0 = n(f, 'competitor_agenda_runs')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ agoraMs: T0 + 4 * MIN }))
    expect(n(f, 'competitor_agenda_runs')).toBe(n0)
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ agoraMs: T0 + 6 * MIN }))
    expect(n(f, 'competitor_agenda_runs')).toBe(n0 * 2)
  })
  it('os quatro leitores baratos saem da entrada da Tarefa 2: a segunda chamada não consulta vídeos', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const v = n(f, 'competitor_videos')
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    expect(n(f, 'competitor_videos')).toBe(v)
  })
  it('prova por mutação: a chave do cache da série separa dois sites com o mesmo id de canal', async () => {
    const t = tabelas(['a'])
    const f = falsoPostgrest({ ...t, competitor_channels: [canalRow('a'), canalRow('a', 's2')] })
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const antes = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ siteId: 's2' }))
    expect(n(f, 'competitor_video_daily')).toBe(antes * 2)
  })
  it('sincronização nova muda a chave da série', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const antes = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ obs: obsDe(['a'], [], LAST + MIN) }))
    expect(n(f, 'competitor_video_daily')).toBe(antes * 2)
  })
  it('canal sem sincronização boa: a série fica fora do cache', async () => {
    const f = falsoPostgrest(tabelas(['a']))
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ obs: obsDe(['a'], [], null) }))
    const antes = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ obs: obsDe(['a'], [], null) }))
    expect(n(f, 'competitor_video_daily')).toBe(antes * 2)
  })
  it('prazo estourado na série: esgotou diz "serie" e as outras partes vêm', async () => {
    vi.useFakeTimers()
    const f = falsoPostgrest(tabelas(['a']))
    const preso = espiar(f.sb, (t, _e, seguir) => (t === 'competitor_video_daily' ? new Promise(() => undefined) : seguir()))
    const prom = carregarMedidasDoCanalInteiro(preso, pedido())
    await vi.advanceTimersByTimeAsync(12_001)
    const r = await prom
    expect(r.esgotou).toEqual(['serie'])
    expect(r.serie).toEqual({ lido: false, causa: 'tempo_esgotado' })
    expect(r.horas !== 'nao_pedida' && r.horas.lido).toBe(true)
    expect(r.medidas && 'naoCarregou' in r.medidas).toBe(false)
  })
  it('prazo estourado na base: esgotou diz "base"', async () => {
    vi.useFakeTimers()
    const f = falsoPostgrest(tabelas(['a']))
    const preso = espiar(f.sb, (t, _e, seguir) => (t === 'competitor_channels' ? new Promise(() => undefined) : seguir()))
    const prom = carregarMedidasDoCanalInteiro(preso, pedido())
    await vi.advanceTimersByTimeAsync(12_001)
    const r = await prom
    expect(r.esgotou).toEqual(['base'])
    expect(r.medidas).toEqual({ naoCarregou: 'tempo_esgotado' })
  })
  it('uma falha repetida vai ao Sentry uma vez só, agrupada', async () => {
    const f = falsoPostgrest(tabelas(['a']), { erros: { competitor_video_daily: { code: 'XX000', message: 'x' } } })
    await carregarMedidasDoCanalInteiro(f.sb, pedido())
    const dedos = sentry.captureMessage.mock.calls.map((c) => JSON.stringify((c[1] as { fingerprint: string[] }).fingerprint))
    expect(dedos.filter((d) => d === JSON.stringify(['medidas-telas', 'serie', 'erro_do_banco'])).length).toBe(1)
  })
})

describe('E5a T14a: o tamanho da entrada da série', () => {
  /** Um canal de `nv` vídeos, cada um com `ld` leituras diárias e `le` das primeiras horas. */
  function canalGrande(nv: number, ld: number, le: number): Record<string, Linha[]> {
    const videos: Linha[] = [], diarias: Linha[] = [], cedo: Linha[] = []
    for (let i = 0; i < nv; i++) {
      const id = 'g' + i
      videos.push(videoRow(id, 'a', 1 + (i % 170)))
      const pub = T0 - (1 + (i % 170)) * D
      for (let k = 0; k < ld; k++) diarias.push({ video_id: id, snap_date: iso(pub + k * D).slice(0, 10), taken_at: iso(pub + k * D), views: 1000 + k * 10, likes: 10 + k, comments: k })
      for (let k = 0; k < le; k++) cedo.push({ video_id: id, taken_at: iso(pub + k * H), views: 100 + k, likes: 5, comments: 1 })
    }
    return tabelas(['a'], { competitor_videos: videos, competitor_video_daily: diarias, competitor_video_early: cedo })
  }
  it('série acima do limiar: não é guardada, a segunda chamada consulta de novo, e o evento sai uma vez por chamada com a causa grande_demais', async () => {
    const f = falsoPostgrest(canalGrande(200, 90, 72))
    const r = await carregarMedidasDoCanalInteiro(f.sb, pedido({ pedir: { serie: true, mudancas: false, horas: false } }))
    expect(r.serie !== 'nao_pedida' && r.serie.lido).toBe(true)
    const json = JSON.stringify([...(r.serie as { dados: Map<string, unknown> }).dados])
    expect(json.length).toBeGreaterThan(SERIE_MAX_BYTES_NO_CACHE)
    const antes = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ pedir: { serie: true, mudancas: false, horas: false } }))
    expect(n(f, 'competitor_video_daily')).toBe(antes * 2)
    const grandes = sentry.captureMessage.mock.calls.filter((c) => JSON.stringify((c[1] as { fingerprint: string[] }).fingerprint) === JSON.stringify(['medidas-telas', 'serie', 'grande_demais']))
    expect(grandes.length).toBe(2)
    // medição para o relatório
    console.info('MEDICAO serie 200 videos: bytes=' + json.length + ' paginas=' + (n(f, 'competitor_video_daily') + n(f, 'competitor_video_early')) / 2)
  })
  it('série abaixo do limiar: guardada', async () => {
    const f = falsoPostgrest(canalGrande(20, 30, 10))
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ pedir: { serie: true, mudancas: false, horas: false } }))
    const antes = n(f, 'competitor_video_daily')
    await carregarMedidasDoCanalInteiro(f.sb, pedido({ pedir: { serie: true, mudancas: false, horas: false } }))
    expect(n(f, 'competitor_video_daily')).toBe(antes)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })
})
