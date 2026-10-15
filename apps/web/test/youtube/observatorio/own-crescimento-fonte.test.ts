// @vitest-environment node
// Phil I-1 / Yannis I2 (2ª leva): o Crescimento do canal próprio sai de UMA fonte, os retratos MG20 que o motor recebe (load.ts);
// lista, cabeçalho do canal, Comparar e o motor escrevem o mesmo percentual. Fixture sintética.
import { describe, it, expect, beforeEach } from 'vitest'
import { rowsToDataset, type ObservatoryRows, type OwnChannelRow, type OwnVideoRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { numerosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { celulaCrescimento30, makeCell } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { retratoVelho } from '@/lib/youtube/observatorio/inscritos-28d'
import type { RetratosProprios } from '@/lib/youtube/observatorio/retratos-proprios'

beforeEach(() => { expect.hasAssertions() })

const DAY = 864e5, H = 36e5
const NOW = Date.parse('2026-10-24T15:02:00-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const own: OwnChannelRow = { id: 'own1', channel_id: 'UCown', name: 'Meu Canal', handle: '@meu', subscriber_count: 52_000, last_synced_at: iso(NOW - H) }
const ov: OwnVideoRow = { id: 'o1', channel_id: 'own1', youtube_video_id: 'yo1', title: 'Meu vídeo', view_count: 500, like_count: 5, comment_count: 1, duration_seconds: 700, published_at: iso(NOW - 10 * DAY), updated_at: iso(NOW - H), tags: [] }
const retratos = [{ t: NOW - 30 * DAY, date: '', subs: 50_000, views: 1 }, { t: NOW, date: '', subs: 52_000, views: 2 }]
const rows = (ownSnapshots?: ObservatoryRows['ownSnapshots']): ObservatoryRows => ({
  settings: null, channels: [], ownChannels: [own], videos: [], ownVideos: [ov], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null,
  ...(ownSnapshots ? { ownSnapshots } : {}),
})
const mundo = (ownSnapshots?: ObservatoryRows['ownSnapshots']) => createObservatory(rowsToDataset(rows(ownSnapshots), NOW))

describe('Crescimento do canal próprio: uma fonte (retratos MG20 no motor)', () => {
  it('motor, lista, cabeçalho e Comparar escrevem o mesmo percentual', () => {
    const mg20: Record<string, RetratosProprios> = { own1: { oculto: false, retratos } }
    const obs = mundo(mg20)
    expect(obs.channels.find(c => c.id === 'own1')!.snapshots).toHaveLength(2)
    const g = obs.channelStats('own1', 'long').growth30
    expect(g.pct).toBeCloseTo(0.04)
    const lista = buildCanaisView(obs, { niche: 'todos', limit: 75, sort: 'growth', retratosProprios: new Map(Object.entries(mg20)) })
    const linha = [...lista.list.ranked, ...lista.list.unranked].find(r => r.id === 'own1')!
    expect(linha.cells.growth).toMatchObject({ kind: 'ok', big: '+4,0%' })
    expect(celulaCrescimento30(obs, obs.channels.find(c => c.id === 'own1')!, g, makeCell(false, 0)).value).toBe('+4,0%')
    expect(numerosDoCanal(obs, 'own1').inscritos30).toMatchObject({ texto: '+4,0%', motivo: null })
  })
  it('sem retrato (ausente), oculto ou leitura com erro: "sem contagem" no motor e no Comparar, nunca um número', () => {
    for (const s of [undefined, 'erro' as const, { own1: { oculto: true, retratos } }]) {
      const obs = mundo(s)
      expect(obs.channels.find(c => c.id === 'own1')!.snapshots).toEqual([])
      expect(obs.channelStats('own1', 'long').growth30.pending).toBe('sem contagem')
      const n = numerosDoCanal(obs, 'own1').inscritos30
      expect(n.x).toBeNull(); expect(n.texto).toBeNull()
    }
  })
})

describe('Phil M-1: a régua de retrato velho é uma só (lista e seção Inscritos)', () => {
  const meioDia = (dia: number) => Date.parse(`2026-10-${String(dia).padStart(2, '0')}T12:00:00-03:00`)
  it('retrato de D−2 com agora D 13:00 não é velho; D−3 é', () => {
    const agora = Date.parse('2026-10-24T13:00:00-03:00')
    expect(retratoVelho(agora, meioDia(22))).toBe(false)
    expect(retratoVelho(agora, meioDia(21))).toBe(true)
  })
})
