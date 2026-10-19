// @vitest-environment node
// Conserto do ritmo (revisão de Phil e Yannis, 19/10): a ligação inteira (ler → do-canal → ritmo, e load → cadence) e a paridade
// da tela com a API. Cada teste daqui mata um dos 9 mutantes descritos no parecer do Yannis (I-5).
import { describe, it, expect } from 'vitest'
import { medidasDoCanal, type Insumos } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { CanalLido, VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { ritmo, baseDoRitmo } from '@/lib/youtube/observatorio/medidas/ritmo'
import { fraseDaNota, FRASES } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { AGORA_CHEIA, insumosCheios } from './medidas-fixture'

const DAY = 864e5, H = 36e5
const iso = (ms: number) => new Date(ms).toISOString()

// ───── a API: medidasDoCanal com a base lida do canal ─────
const semDado = (i: Insumos, canal: CanalLido, videos: VideoLido[]): Insumos => ({
  ...i, canal: { lido: true, dados: canal }, videos: { lido: true, dados: videos },
  marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } }, retratos: { lido: true, dados: [] },
  series: { lido: true, dados: { series: new Map(), foraDoCanal: 0 } }, mudancas: { lido: true, dados: { mudancas: new Map(), foraDoCanal: 0 } },
  multiplos: new Map(), comentarios: { lido: true, dados: { coletaDesdeMs: null, porVideo: new Map() } },
})
const videoLido = (id: string, idadeDias: number): VideoLido => ({
  id, videoId: 'yt' + id, publishedAt: iso(AGORA_CHEIA - idadeDias * DAY), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false, isShort: false,
  durationSeconds: 600, viewCount: 100, likeCount: 4, commentCount: 1, likesHidden: false, commentsDisabled: false, viewsHidden: false, discoveredAt: null,
  missingSince: null, seriesTier: 'diaria', lastCheckedAt: null,
})
const canalLido = (o: Partial<CanalLido>): CanalLido => ({
  id: 'c1', siteId: 's1', collectionPausedAt: null, missingSince: null, criadoEmMs: null, totalNoYoutube: null, limiteDeVideos: null, ...o,
})
const m6De = (canal: Partial<CanalLido>, idades: number[]) => {
  const vs = idades.map((a, k) => videoLido('x' + k, a))
  return medidasDoCanal(semDado(insumosCheios(), canalLido(canal), vs), { agoraMs: AGORA_CHEIA }).porFormato.long.m6
}

describe('medidasDoCanal liga a base do ritmo (mata os mutantes de do-canal)', () => {
  it('criação do canal a 81 dias: nota canal_mais_novo_que_a_janela e porSemana sobre 81/7 semanas', () => {
    const m = m6De({ criadoEmMs: AGORA_CHEIA - 81 * DAY }, Array.from({ length: 11 }, (_, j) => 1 + j * 6))
    expect(m.estado).toBe('medido')
    if (m.estado !== 'medido') return
    expect(m.notas).toEqual([{ tipo: 'canal_mais_novo_que_a_janela', dias: 81, desde: spDateOf(AGORA_CHEIA - 81 * DAY) }])
    expect(m.valor.porSemana).toBeCloseTo(11 / (81 / 7), 6)
    expect(m.valor.semanas).toBe(12)
  })
  it('lista cortada (51 guardados de 3355, limite 50): nota cobertura_curta desde o mais antigo; porSemana sobre a cobertura', () => {
    const idades = Array.from({ length: 11 }, (_, j) => 1 + j * 6) // 1..61 dias; guardados 11 de 3355
    const m = m6De({ totalNoYoutube: 3355, limiteDeVideos: 50 }, idades)
    expect(m.estado === 'medido' && m.notas).toEqual([{ tipo: 'cobertura_curta', dias: 61, desde: spDateOf(AGORA_CHEIA - 61 * DAY) }])
    expect(m.estado === 'medido' && m.valor.porSemana).toBeCloseTo(11 / (61 / 7), 6)
  })
  it('lista completa (total igual ao guardado): sem nota, n / 13', () => {
    const idades = Array.from({ length: 11 }, (_, j) => 1 + j * 6)
    const m = m6De({ totalNoYoutube: 11, limiteDeVideos: 50 }, idades)
    expect(m.estado === 'medido' && m.notas).toEqual([])
    expect(m.estado === 'medido' && m.valor.porSemana).toBeCloseTo(11 / 13, 6)
  })
  it('vídeo fixado antigo não estraga a cobertura: 50 vídeos em 60 dias + 1 a 80 dias, limite 50 → 60 dias, não 80', () => {
    const idades = [...Array.from({ length: 50 }, (_, j) => 1 + j * 1.2), 80]
    const m = m6De({ totalNoYoutube: 3355, limiteDeVideos: 50 }, idades)
    expect(m.estado === 'medido' && m.notas).toMatchObject([{ tipo: 'cobertura_curta', dias: 60 }])
  })
  it('limite cru do banco acima do máximo (300 → 200): 250 guardados de 400 é lista cortada, como na tela', () => {
    const idades = Array.from({ length: 250 }, (_, j) => 1 + j * 0.3) // 1..75,7 dias
    const m = m6De({ totalNoYoutube: null, limiteDeVideos: 300 }, idades)
    expect(m.estado === 'medido' && m.notas.map((n) => n.tipo)).toEqual(['cobertura_curta'])
  })
  it('canal criado há 20 dias: canal_novo; cobertura de 20 dias: ritmo_parcial', () => {
    expect(m6De({ criadoEmMs: AGORA_CHEIA - 20 * DAY }, [1, 5, 9, 13, 17])).toMatchObject({ estado: 'nao_medido', motivo: 'canal_novo' })
    expect(m6De({ totalNoYoutube: 900, limiteDeVideos: 5 }, [1, 5, 9, 13, 17])).toMatchObject({ estado: 'nao_medido', motivo: 'ritmo_parcial' })
  })
  it('criação posterior ao vídeo mais antigo: o vídeo não sai da conta', () => {
    const m = m6De({ criadoEmMs: AGORA_CHEIA - 30 * DAY }, [40, 45, 50, 55, 60])
    expect(m.estado === 'medido' && m.n).toBe(5)
  })
  it('sem criação nem total (tudo nulo): janela de 91 dias, sem nota', () => {
    const m = m6De({}, [1, 8, 15, 22, 29])
    expect(m.estado === 'medido' && m.notas).toEqual([])
  })
})

// ───── a tela: load → cadence, em paridade com a API ─────
const NOW = Date.parse('2026-10-24T15:02:00-03:00')
const chRow = (o: Partial<ChannelRow>): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 50, youtube_video_count: null,
  sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H), full_sync_completed_at: null,
  added_at: iso(NOW - 200 * DAY), published_at: null, ...o,
})
const vRow = (k: number, idade: number): VideoRow => ({
  id: 'v' + k, competitor_channel_id: 'ch1', video_id: 'yt' + k, title: 'T' + k, view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(NOW - idade * DAY), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null,
})
const obsDe = (c: Partial<ChannelRow>, idades: number[]) => {
  const rows: ObservatoryRows = {
    settings: { series_started_at: iso(NOW - 150 * DAY), channel_limit: 75 }, channels: [chRow(c)], ownChannels: [], videos: idades.map((a, k) => vRow(k, a)), ownVideos: [],
    versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null,
  }
  return createObservatory(rowsToDataset(rows, NOW))
}

describe('load e cadence (mata os mutantes da tela)', () => {
  const idades = Array.from({ length: 11 }, (_, j) => 1 + j * 6)
  it('rowsToDataset lê published_at do canal em ms', () => {
    const o = obsDe({ published_at: iso(NOW - 81 * DAY) }, idades)
    expect(o.channel('ch1')!.createdMs).toBe(NOW - 81 * DAY)
    expect(obsDe({ published_at: null }, idades).channel('ch1')!.createdMs).toBeNull()
  })
  it('canal criado há 81 dias: pw sobre a base (11 / 11,57 = 1,0; sobre 13 daria 0,8) e a base real exposta', () => {
    const k = obsDe({ published_at: iso(NOW - 81 * DAY), youtube_video_count: 11 }, idades).cadence('ch1', 'long')
    expect(k.pw).toBe(1)
    expect(k).toMatchObject({ corte: 'criacao', diasBase: 81, semanas: 11.57, n: 11 })
  })
  it('semanas antes da criação não contam como zero: n nulo', () => {
    const k = obsDe({ published_at: iso(NOW - 81 * DAY), youtube_video_count: 11 }, idades).cadence('ch1', 'long')
    expect(k.weeks[0]!.n).toBeNull() // 91 a 84 dias atrás: inteira antes da criação (81)
    expect(k.weeks.slice(1).every((w) => typeof w.n === 'number')).toBe(true) // a semana que cruza a criação é lida
  })
  it('lista cortada: o vídeo mais antigo que a cobertura fica fora (filtro do início) e pw usa a cobertura', () => {
    // limite 10, 11 guardados de 3355: a cobertura é o 10º mais novo (50 dias); o de 55 dias não entra
    const ages = Array.from({ length: 11 }, (_, j) => 5 + j * 5)
    const k = obsDe({ video_limit: 10, youtube_video_count: 3355 }, ages).cadence('ch1', 'long')
    expect(k).toMatchObject({ corte: 'cobertura', diasBase: 50, n: 10 })
    expect(k.pw).toBe(1.4)
  })
  it('canal criado há 20 dias: sem número (pw nulo), igual à API (canal_novo)', () => {
    const ages = [1, 5, 9, 13, 17]
    const o = obsDe({ published_at: iso(NOW - 20 * DAY), youtube_video_count: 5 }, ages)
    expect(o.cadence('ch1', 'long').pw).toBeNull()
    const b = baseDoRitmo({ publicacoesMs: ages.map((a) => NOW - a * DAY), criadoEmMs: NOW - 20 * DAY, guardados: 5, totalNoYoutube: 5, limiteDeVideos: 50 })
    expect(ritmo(ages.map((a) => NOW - a * DAY), { agoraMs: NOW, ...b })).toMatchObject({ estado: 'nao_medido', motivo: 'canal_novo' })
  })
  it('paridade: a mesma base na tela e na API dá o mesmo porSemana (1 casa) e o mesmo "não medido"', () => {
    for (const c of [{ published_at: iso(NOW - 81 * DAY), youtube_video_count: 11 }, { video_limit: 10, youtube_video_count: 3355 }, { youtube_video_count: 11 }, {}]) {
      const ages = Array.from({ length: 11 }, (_, j) => 5 + j * 5)
      const o = obsDe(c, ages), ch = o.channel('ch1')!
      const b = baseDoRitmo({
        publicacoesMs: ch.videos.map((v) => v.pub), criadoEmMs: ch.createdMs ?? null, guardados: ch.videos.length,
        totalNoYoutube: ch.youtubeVideoCount ?? null, limiteDeVideos: ch.video_limit,
      })
      const r = ritmo(ch.videos.filter((v) => v.fmt === 'long').map((v) => v.pub), { agoraMs: NOW, ...b })
      const k = o.cadence('ch1', 'long')
      expect(r.estado === 'medido' ? Math.round(r.valor.porSemana * 10) / 10 : null).toBe(k.pw)
    }
  })
  it('canal próprio não cai em lista cortada, mesmo com 200 vídeos e total desconhecido', () => {
    const rows: ObservatoryRows = {
      settings: { series_started_at: iso(NOW - 150 * DAY), channel_limit: 75 }, channels: [chRow({})], ownChannels: [],
      videos: Array.from({ length: 200 }, (_, k) => vRow(k, 0.3 + k * 0.15)), ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null,
    }
    const ds = rowsToDataset(rows, NOW)
    const proprio = createObservatory({ ...ds, channels: ds.channels.map((c) => ({ ...c, own: true, video_limit: 200, youtubeVideoCount: null })) })
    expect(proprio.cadence('ch1', 'long').corte).toBeNull()
    const concorrente = createObservatory({ ...ds, channels: ds.channels.map((c) => ({ ...c, video_limit: 200, youtubeVideoCount: null })) })
    expect(concorrente.cadence('ch1', 'long').corte).toBe('cobertura')
  })
})

// ───── frases: canal_novo e ritmo_parcial dizem cada um a sua verdade ─────
describe('frases do ritmo curto', () => {
  it('canal_novo fala do canal; ritmo_parcial fala dos vídeos guardados', () => {
    expect(FRASES.canal_novo({}).longa).toMatch(/o canal tem menos de quatro semanas/)
    expect(FRASES.ritmo_parcial({}).longa).not.toMatch(/o canal tem/)
    expect(FRASES.ritmo_parcial({}).longa).toMatch(/guardados/)
    expect(FRASES.canal_novo({}).curta).not.toBe(FRASES.ritmo_parcial({}).curta)
  })
  it('as notas trazem a data do início', () => {
    expect(fraseDaNota({ tipo: 'canal_mais_novo_que_a_janela', dias: 81, desde: '2026-07-30' })).toBe('Canal mais novo que a janela: o ritmo conta desde a criação, em 30/07 (81 d).')
    expect(fraseDaNota({ tipo: 'cobertura_curta', dias: 73, desde: '2026-08-07' })).toContain('07/08')
  })
})
