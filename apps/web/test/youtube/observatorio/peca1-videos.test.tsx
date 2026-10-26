// @vitest-environment node
// Manutenção M5, T5b: a peça 1 nas 72 horas do vídeo, nas barras por dia do Histórico e no normal do canal.
// Dois lados em cada tela: com `onlineDesde` nulo e lido (produção hoje) a saída é IDÊNTICA; com um mês fora do banco, a frase da peça 1.
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { _esquecerAvisos } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'
import { blocoDeHoras, primeiraHoraCheia, type EntradaDeHoras } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-model'
import { Horas72 } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-72'
import { barrasPorDia } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/dias-model'
import { horasDoCanal, type EntradaDe72Horas } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos-model'
import { HorasDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/horas-do-canal'
import { arquivoDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/ler-do-video'
import type { Leitura } from '@/lib/youtube/observatorio/medidas/m1'
import type { LeituraPorHora, HorasDoCanal as HorasLidas } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'

const H = 3_600_000, D = 86_400_000
const sp = (d: string) => Date.parse(d + 'T03:00:00Z')
const html = (el: ReactElement): string => renderToStaticMarkup(el)
beforeEach(() => _esquecerAvisos())

// ───── 72 horas do vídeo ─────
const PUB = sp('2026-10-10') + 12 * H
const AGORA = sp('2027-06-10')
const horasEnt = (o: Partial<EntradaDeHoras> = {}): EntradaDeHoras => ({
  agoraMs: AGORA, publicadoEmMs: PUB, descobertoEmMs: PUB + 20 * 60_000, aoVivo: false, viewsAgora: 8000,
  // a leitura por hora, hoje, começa no que está online (o mês saiu): o vídeo é anterior a ela
  horas: { primeiraHoraDoSiteMs: sp('2027-05-01'), ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: sp('2027-05-01') },
  leituras: [], toleranciaH: 3, normal: null, contagemPorDiaDesde: '2026-10-11', ...o,
})
const arq = (o: Partial<{ horasDesde: number | null; lido: boolean; coleta: number }> = {}) => ({ horasDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), ...o })

describe('peça 1 nas 72 horas do vídeo', () => {
  it('nada saiu (online desde nulo e lido): bloco e HTML IDÊNTICOS aos de hoje', () => {
    const hoje = blocoDeHoras(horasEnt())
    const b = blocoDeHoras(horasEnt({ arquivo: arq({ horasDesde: null }) }))
    expect(b).toEqual(hoje)
    expect(html(<Horas72 bloco={b} />)).toBe(html(<Horas72 bloco={hoje} />))
    expect(hoje.tipo).toBe('nao_medido')
  })
  it('um mês fora do banco: as 72 horas dizem "no arquivo desde dd/mm/aaaa", sem curva', () => {
    const b = blocoDeHoras(horasEnt({ arquivo: arq() }))
    expect(b).toMatchObject({ tipo: 'no_arquivo', forma: 'arquivo', frase: 'As 72 primeiras horas deste vídeo estão no arquivo desde 01/05/2027. Não dá para calcular sem as horas.' })
    const s = html(<Horas72 bloco={b} />)
    expect(s).toContain('no arquivo desde 01/05/2027')
    expect(s).toContain('obs-fa-arquivo')
    expect(s).not.toContain('publicado antes')
  })
  it('vídeo publicado antes da coleta: o texto de hoje fica (não vira "no arquivo")', () => {
    expect(blocoDeHoras(horasEnt({ arquivo: arq({ coleta: sp('2027-03-15') }) }))).toEqual(blocoDeHoras(horasEnt()))
  })
  it('vídeo com as 72 horas online (depois do online desde): o bloco de hoje', () => {
    expect(blocoDeHoras(horasEnt({ publicadoEmMs: sp('2027-05-10'), arquivo: arq() }))).toEqual(blocoDeHoras(horasEnt({ publicadoEmMs: sp('2027-05-10') })))
  })
  it('online desde não lido: só o vídeo mais velho que a garantia (89 dias) vira "não foi possível ler"; o recente fica como hoje', () => {
    const b = blocoDeHoras(horasEnt({ arquivo: arq({ horasDesde: null, lido: false }) }))
    expect(b).toMatchObject({ tipo: 'no_arquivo', forma: 'hachura', frase: 'Não foi possível ler desde quando há dado online.' })
    const recente = horasEnt({ publicadoEmMs: AGORA - 20 * D, arquivo: arq({ horasDesde: null, lido: false, coleta: sp('2026-10-03') }) })
    expect(blocoDeHoras(recente)).toEqual(blocoDeHoras({ ...recente, arquivo: undefined }))
  })
  it('arquivoDoVideo leva o online desde da série horária', () => {
    const canal = (id: string) => (id === 'c1' ? { id, name: 'c', own: false, sync: { added: null } } : undefined)
    const od = { lido: true as const, porTabela: { competitor_video_daily: sp('2027-05-01'), competitor_video_early: null, competitor_video_hourly: sp('2027-04-01') } }
    expect(arquivoDoVideo({ channel: canal, SERIES_START: sp('2026-10-03'), ONLINE_DESDE: od }, 'c1').arquivo).toMatchObject({ horasDesde: sp('2027-04-01') })
    expect(arquivoDoVideo({ channel: canal, SERIES_START: sp('2026-10-03'), ONLINE_DESDE: { lido: false, porque: 'erro_do_banco' } }, 'c1').arquivo).toMatchObject({ horasDesde: null, lido: false })
  })
})

// ───── barras por dia ─────
const lei = (dia: string, views: number): Leitura => ({ t: sp(dia) + 9 * H, views } as Leitura)
describe('peça 1 nas barras por dia', () => {
  // publicado 10/10/2026; a série por dia está online só desde 01/05/2027
  const base = { publicadoEmMs: PUB, agoraMs: sp('2027-05-06') + 5 * H, saiuEm: null as string | null }
  const leituras = [lei('2027-05-01', 5000), lei('2027-05-02', 5100), lei('2027-05-03', 5150), lei('2027-05-04', 5200), lei('2027-05-05', 5300)]
  const a = (o: Partial<{ onlineDesde: number | null; lido: boolean; coleta: number }> = {}) => ({ onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), ...o })
  it('nada saiu: as barras são IDÊNTICAS às de hoje', () => {
    expect(barrasPorDia({ ...base, leituras, arquivo: a({ onlineDesde: null }) })).toEqual(barrasPorDia({ ...base, leituras }))
  })
  it('um mês fora do banco: os dias do trecho dizem "no arquivo", sem "junto" nem número', () => {
    const dias = barrasPorDia({ ...base, leituras, arquivo: a() })
    const antes = dias.filter((d) => d.tipo === 'nm' && d.dia < '2027-05-01')
    expect(antes.length).toBeGreaterThan(100)
    expect(antes.every((d) => d.peca1?.forma === 'arquivo' && d.junto === null && d.ganho === null)).toBe(true)
    expect(antes[0]!.motivo).toBe('01/10 a 30/04/2027 no arquivo')
    expect(antes[0]!.fala).toContain('no arquivo')
    expect(dias.find((d) => d.dia === '2027-05-02')!.tipo).toBe('com')
  })
  it('antes da coleta do vídeo: o texto de hoje', () => {
    const h = barrasPorDia({ ...base, leituras })
    const c = barrasPorDia({ ...base, leituras, arquivo: a({ coleta: sp('2027-04-01') }) })
    expect(c.filter((d) => d.dia < '2027-04-01')).toEqual(h.filter((d) => d.dia < '2027-04-01'))
  })
  it('não lido: só o trecho mais velho que 181 dias vira "não foi possível ler"', () => {
    const dias = barrasPorDia({ ...base, leituras, arquivo: a({ onlineDesde: null, lido: false }) })
    const velho = dias.find((d) => d.dia === '2026-10-20')!
    expect(velho.peca1?.forma).toBe('hachura')
    expect(velho.motivo).toBe('Não foi possível ler desde quando há dado online.')
    const recente = dias.find((d) => d.dia === '2027-04-20')!
    expect(recente).toEqual(barrasPorDia({ ...base, leituras }).find((d) => d.dia === '2027-04-20'))
  })
})

// ───── normal do canal (72 horas) ─────
const vid = (id: string, pub: number): VideoLido => ({
  id, publishedAt: new Date(pub).toISOString(), isShort: false, wasLive: false, liveBroadcastContent: 'none', discoveredAt: new Date(pub + 20 * 60_000).toISOString(),
  viewCount: 1000, missingSince: null, seriesTier: 'diaria', actualStartTime: null, scheduledStartTime: null,
} as unknown as VideoLido)
const leitH = (pub: number, k: number): LeituraPorHora[] => Array.from({ length: 73 }, (_, i) => ({ horaMs: primeiraHoraCheia(pub) + i * H, lidaEmMs: primeiraHoraCheia(pub) + i * H, views: 100 + i * (k + 1) * 10, likes: null, comments: null }))
const fmt = { fmt: 'long' as const, doisFormatos: false, soShorts: false }
function canalEnt(pubs: number[], o: Partial<EntradaDe72Horas> = {}): EntradaDe72Horas {
  const videos = pubs.map((p, i) => vid('v' + i, p))
  const porVideo = new Map<string, LeituraPorHora[]>(pubs.flatMap((p, i) => (p >= sp('2027-05-01') ? [['v' + i, leitH(p, i)] as [string, LeituraPorHora[]]] : [])))
  const horas = { primeiraHoraDoSiteMs: sp('2027-05-01'), ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: sp('2027-05-01'), porVideo } as unknown as HorasLidas
  return { videos, horas, formato: fmt as unknown as EntradaDe72Horas['formato'], agoraMs: AGORA, ...o }
}
describe('peça 1 no normal do canal (72 horas)', () => {
  const novos = [sp('2027-05-05'), sp('2027-05-08'), sp('2027-05-12'), sp('2027-05-15')]
  const velhos = [sp('2026-11-01'), sp('2026-12-01'), sp('2027-01-01')]
  it('nada saiu: o modelo e o HTML são IDÊNTICOS aos de hoje (poucos vídeos e medido)', () => {
    for (const pubs of [novos.slice(0, 2), [...velhos, ...novos]]) {
      const hoje = horasDoCanal(canalEnt(pubs))
      const com = horasDoCanal(canalEnt(pubs, { arquivo: { horasDesde: null, lido: true } }))
      expect(com).toEqual(hoje)
      expect(html(<HorasDoCanal modelo={com} />)).toBe(html(<HorasDoCanal modelo={hoje} />))
    }
  })
  it('abaixo do mínimo, com vídeos no arquivo: "Não medido: desde dd/mm/aaaa só há N vídeos com as 72 horas online."', () => {
    const m = horasDoCanal(canalEnt([...velhos, ...novos.slice(0, 2)], { arquivo: { horasDesde: sp('2027-05-01'), lido: true } }))
    expect(m).toMatchObject({ tipo: 'nao_medido', motivo: 'Não medido: desde 01/05/2027 só há 2 vídeos com as 72 horas online.' })
  })
  it('medido, com vídeos no arquivo: a nota "Calculado com N vídeos; K estão no arquivo."', () => {
    const m = horasDoCanal(canalEnt([...velhos, ...novos], { arquivo: { horasDesde: sp('2027-05-01'), lido: true } }))
    expect(m.tipo).toBe('medido')
    if (m.tipo !== 'medido') return
    expect(m.nota).toBe('Calculado com 4 vídeos; 3 estão no arquivo.')
    expect(html(<HorasDoCanal modelo={m} />)).toContain('Calculado com 4 vídeos; 3 estão no arquivo.')
  })
  it('online desde não lido: só vira "não foi possível ler" quando faltam vídeos antigos; com vídeos suficientes é o de hoje', () => {
    const pubs = [...velhos, ...novos]
    expect(horasDoCanal(canalEnt(pubs, { arquivo: { horasDesde: null, lido: false } }))).toEqual(horasDoCanal(canalEnt(pubs)))
  })
})

// ───── o gráfico "Views por dia" do Histórico (view-model) ─────
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type DailyRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { OnlineDesde } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'

const NOW = sp('2027-06-10') + 15 * H
const iso = (ms: number) => new Date(ms).toISOString()
const rowsVazias = (o: Partial<ObservatoryRows>): ObservatoryRows => ({ settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o })
const canalRow: ChannelRow = {
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 10, youtube_video_count: 30, sync_status: 'idle', sync_error: null,
  sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H), full_sync_completed_at: null, added_at: iso(sp('2026-10-03')),
}
const videoRow: VideoRow = {
  id: 'v1', competitor_channel_id: 'ch1', video_id: 'yt1', title: 'Um título', view_count: 9000, like_count: 10, comment_count: 1, duration_seconds: 600, published_at: iso(PUB), is_short: false,
  last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null,
}
const dRow = (snap_date: string, views: number): DailyRow => ({ video_id: 'v1', snap_date, views, likes: null, comments: null, taken_at: snap_date + 'T15:00:00Z' })
const diasOnline = ['2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04', '2027-05-05'].map((d, i) => dRow(d, 5000 + i * 100))
function viewDe(od: OnlineDesde | undefined) {
  const ds = rowsToDataset(rowsVazias({
    settings: { series_started_at: '2026-10-03T09:00:00-03:00', channel_limit: 75 }, channels: [canalRow], videos: [videoRow], daily: diasOnline,
    heartbeat: { last_poll_at: iso(NOW - 60_000), capabilities: ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] },
  }), NOW)
  return buildHistoricoView(createObservatory(od ? { ...ds, onlineDesde: od } : ds), 'v1', { range: 'tudo' })
}
const od = (daily: number | null): OnlineDesde => ({ lido: true, porTabela: { competitor_video_daily: daily, competitor_video_early: null, competitor_video_hourly: null } })

describe('peça 1 no gráfico por dia do Histórico', () => {
  it('nada saiu (online desde nulo e lido): o gráfico é IDÊNTICO ao de hoje', () => {
    const hoje = viewDe(undefined)
    const com = viewDe(od(null))
    expect(com.chart).toEqual(hoje.chart)
    expect(com.chart?.arquivo ?? null).toBeNull()
  })
  it('um mês fora do banco: sem média interpolada desde a publicação, e o trecho diz "no arquivo"', () => {
    const hoje = viewDe(undefined)
    const v = viewDe(od(sp('2027-05-01')))
    expect(hoje.chart?.bins.some((b) => b.from0)).toBe(true)
    expect(v.chart?.bins.some((b) => b.from0)).toBe(false)
    expect(v.chart?.arquivo).toMatchObject({ estado: { k: 'no_arquivo' } })
    expect(v.chart!.arquivo!.toH).toBeGreaterThan(v.chart!.arquivo!.fromH)
  })
})
