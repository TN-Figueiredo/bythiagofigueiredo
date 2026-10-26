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
  horas: { primeiraHoraDoSiteMs: sp('2027-05-01'), comecouRealMs: sp('2026-10-05'), ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: sp('2027-05-01') },
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
    expect(b).toMatchObject({ tipo: 'no_arquivo', forma: 'arquivo', frase: 'As 72 primeiras horas deste vídeo estão no arquivo (a leitura por hora online começa em 01/05/2027). A curva e o resumo "metade das views em N horas" não aparecem porque não dá para calcular sem as horas.' })
    const s = html(<Horas72 bloco={b} />)
    expect(s).toContain('online começa em 01/05/2027')
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
    expect(antes[0]!.motivo).toBe('03/10 a 30/04/2027 no arquivo')
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
  const horas = { primeiraHoraDoSiteMs: sp('2027-05-01'), comecouRealMs: sp('2026-10-05'), ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: sp('2027-05-01'), porVideo } as unknown as HorasLidas
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
function viewDe(od: OnlineDesde | undefined, o: { added?: number; pub?: number } = {}) {
  const ds = rowsToDataset(rowsVazias({
    settings: { series_started_at: '2026-10-03T09:00:00-03:00', channel_limit: 75 },
    channels: [o.added === undefined ? canalRow : { ...canalRow, added_at: iso(o.added) }],
    videos: [o.pub === undefined ? videoRow : { ...videoRow, published_at: iso(o.pub) }], daily: diasOnline,
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

describe('conserto r2 do gráfico por dia (Phil I1 a I3, Yannis M-2 e mutantes)', () => {
  it('I1/M-2: canal adicionado depois: a faixa "no arquivo" começa na coleta do canal, não no começo da série do site', () => {
    const added = sp('2027-03-15')
    const v = viewDe(od(sp('2027-05-01')), { added })
    const a = v.chart!.arquivo!
    expect(a.fromH).toBeCloseTo((added - PUB) / H, 5)
    expect(a.estado).toMatchObject({ k: 'no_arquivo', de: added })
  })
  it('I2: a linha da fonte diz o online desde, não o começo da coleta, e não cita 03/10', () => {
    const t = viewDe(od(sp('2027-05-01'))).chart!.src.text
    expect(t).toContain('desde 01/05')
    expect(t).not.toContain('03/10')
  })
  it('mutante: canal adicionado DEPOIS do online desde (coleta >= online desde): nada no arquivo, a média desde a publicação fica', () => {
    const v = viewDe(od(sp('2027-05-01')), { added: sp('2027-05-01') })
    expect(v.chart?.arquivo ?? null).toBeNull()
    expect(v.chart?.bins.some((b) => b.from0)).toBe(true)
  })
  it('I3: online desde NÃO lido e vídeo mais velho que 181 dias: sem média interpolada, trecho em estado não medido', () => {
    const hoje = viewDe(undefined)
    const v = viewDe({ lido: false, porque: 'erro_do_banco' })
    expect(hoje.chart?.bins.some((b) => b.from0)).toBe(true)
    expect(v.chart?.bins.some((b) => b.from0)).toBe(false)
    expect(v.chart?.arquivo).toMatchObject({ estado: { k: 'nao_medido' } })
  })
  it('I3: online desde NÃO lido e vídeo recente (dentro dos 181 dias garantidos): o gráfico de hoje', () => {
    const rec = { pub: sp('2027-04-20') }
    expect(viewDe({ lido: false, porque: 'erro_do_banco' }, rec).chart).toEqual(viewDe(undefined, rec).chart)
  })
})

describe('conserto r2 das 72 horas do vídeo (Phil C1, I4; Logan C1)', () => {
  // a leitura por hora começou em 14/10/2026 de verdade; o mês saiu e o que está online começa em 01/05/2027
  const real = sp('2026-10-14')
  const h = (o: Partial<NonNullable<EntradaDeHoras['horas']>> = {}) => ({ primeiraHoraDoSiteMs: sp('2027-05-01'), comecouRealMs: real, ultimoOkDaTarefaMs: AGORA - H, primeiraExecucaoDaTarefaMs: real, ...o })
  it('C1: vídeo publicado entre a coleta diária e o começo real da horária: a frase de hoje, nunca "no arquivo"; "começou em" diz 14/10', () => {
    const e = horasEnt({ publicadoEmMs: sp('2026-10-05') + 12 * H, horas: h(), arquivo: arq() })
    const b = blocoDeHoras(e)
    expect(b.tipo).toBe('nao_medido')
    expect(b).toEqual(blocoDeHoras({ ...e, arquivo: undefined }))
    if (b.tipo === 'nao_medido') expect(b.frase).toContain('14/10')
    expect(blocoDeHoras({ ...e, publicadoEmMs: real + 12 * H, arquivo: arq() }).tipo).toBe('no_arquivo')
  })
  it('a linha de estado diz o começo REAL, não o min(hour_slot) atual', () => {
    const b = blocoDeHoras(horasEnt({ horas: h() }))
    expect(b.estado).toEqual({ tipo: 'comecou', texto: 'começou em 14/10' })
    expect(blocoDeHoras(horasEnt({ horas: h({ comecouRealMs: undefined }) })).estado).toEqual({ tipo: 'comecou', texto: 'começou em 01/05' })
  })
  it('precisão de mês: o dia exato não existe mais, a linha diz o mês', () => {
    expect(blocoDeHoras(horasEnt({ horas: h({ comecouRealMs: sp('2026-10-01'), comecouRealPrecisao: 'mes' }) })).estado).toEqual({ tipo: 'comecou', texto: 'começou em 10/2026' })
  })
  it('I4: janela de 72 h só em parte no arquivo: "Parte das 72 primeiras horas", sem curva (com ou sem leituras)', () => {
    const pub = sp('2027-05-01') - 24 * H
    for (const leituras of [[], [{ horaMs: sp('2027-05-01'), lidaEmMs: sp('2027-05-01') + 600_000, views: 900, likes: null, comments: null }]]) {
      const b = blocoDeHoras(horasEnt({ publicadoEmMs: pub, descobertoEmMs: pub + 20 * 60_000, horas: h(), leituras, arquivo: arq() }))
      expect(b).toMatchObject({ tipo: 'no_arquivo', forma: 'arquivo' })
      if (b.tipo === 'no_arquivo') expect(b.frase).toMatch(/^Parte das 72 primeiras horas deste vídeo está no arquivo/)
    }
  })
  it('I4: sem arquivo (nada saiu) a janela parcial não existe: o bloco é o de hoje', () => {
    const pub = sp('2027-05-01') - 24 * H
    const e = horasEnt({ publicadoEmMs: pub, descobertoEmMs: pub + 20 * 60_000, horas: h() })
    expect(blocoDeHoras({ ...e, arquivo: arq({ horasDesde: null }) })).toEqual(blocoDeHoras(e))
  })
  it('sem comecouRealMs (função antiga, cache antigo) cai no min(hour_slot): sem prova do começo real, nada vira "no arquivo"', () => {
    const e = horasEnt({ horas: h({ comecouRealMs: undefined }), arquivo: arq() })
    expect(blocoDeHoras(e)).toEqual(blocoDeHoras({ ...e, arquivo: undefined }))
  })
})

describe('conserto r2 do normal do canal (Yannis I-2, I-3; Logan C1, M2)', () => {
  const real = sp('2026-10-14')
  const novos4 = [sp('2027-05-05'), sp('2027-05-08'), sp('2027-05-12'), sp('2027-05-15')]
  const antigos = [sp('2024-05-01'), sp('2024-06-01')]
  const ar = { horasDesde: sp('2027-05-01'), lido: true }
  const comReal = (e: EntradaDe72Horas): EntradaDe72Horas => ({ ...e, horas: { ...e.horas!, comecouRealMs: real } })
  it('I-2: vídeos de antes da leitura por hora nunca foram lidos: não entram em "estão no arquivo"', () => {
    const m = horasDoCanal(comReal(canalEnt([...antigos, ...novos4], { arquivo: ar })))
    expect(m.tipo).toBe('medido')
    expect(m).not.toHaveProperty('nota')
  })
  it('I-2: só os publicados DEPOIS do começo real contam: 3 de 5 sem horas', () => {
    const m = horasDoCanal(comReal(canalEnt([...antigos, sp('2026-11-01'), sp('2026-12-01'), sp('2027-01-01'), ...novos4], { arquivo: ar })))
    expect(m).toMatchObject({ tipo: 'medido', nota: 'Calculado com 4 vídeos; 3 estão no arquivo.' })
  })
  it('I-2: abaixo do mínimo só com vídeos pré-leitura: a frase de hoje, sem "no arquivo"', () => {
    const m = horasDoCanal(comReal(canalEnt([...antigos, ...novos4.slice(0, 2)], { arquivo: ar })))
    expect(m.tipo).toBe('nao_medido')
    if (m.tipo === 'nao_medido') expect(m.motivo).not.toContain('desde 01/05/2027')
  })
  it('Logan M2: nenhum vídeo com as 72 horas online: não diz "só há 0 vídeos"', () => {
    const m = horasDoCanal(comReal(canalEnt([sp('2026-11-01'), sp('2026-12-01'), sp('2027-01-01')], { arquivo: ar })))
    expect(m).toMatchObject({ tipo: 'nao_medido', motivo: 'Não medido: desde 01/05/2027 não há nenhum vídeo com as 72 horas online.' })
  })
  it('I-3 (mutante): online desde não lido, poucos vídeos novos e vários antigos sem hora: "não foi possível ler"', () => {
    const m = horasDoCanal(comReal(canalEnt([sp('2026-11-01'), sp('2026-12-01'), sp('2027-01-01'), ...novos4.slice(0, 2)], { arquivo: { horasDesde: null, lido: false } })))
    expect(m).toEqual({ tipo: 'nao_medido', motivo: 'Não foi possível ler desde quando há dado online.' })
  })
})
