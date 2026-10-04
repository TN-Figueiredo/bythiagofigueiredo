// @vitest-environment node
// Fumaça (Task 9, plano multi-canal): um terceiro canal, dois no mesmo idioma, não quebra o pipeline de vídeo.
// O pipeline deduz o canal do idioma (FU-21: tratar depois); aqui só se prova que nada lança nem duplica.
import { describe, it, expect } from 'vitest'
import { calculateTodayActions } from '../../src/lib/pipeline/calculate-today-actions'
import { suggestForSlot } from '../../src/lib/pipeline/suggest-for-slots'
import { generateWeekSlots } from '../../src/lib/pipeline/generate-week-slots'
import { channelByLang, CHANNELS } from '../../src/lib/pipeline/channels'
import type {
  PipelineItemWithSlot,
  SlotCandidate,
  SyncScheduleWithChannel,
} from '../../src/lib/pipeline/up-next-types'

const TZ = 'America/Sao_Paulo'

function sched(channel_id: string, channel_name: string, locale: 'pt' | 'en', day: SyncScheduleWithChannel['schedule']['day'], hour: number): SyncScheduleWithChannel {
  return { channel_id, channel_name, locale, schedule: { day, hour, tz: TZ, label: `${day} ${hour}h` } }
}

// Três canais: dois pt (viagem e cortes de viagem) e um en, cada um com horário.
const SCHEDULES: SyncScheduleWithChannel[] = [
  sched('ch-pt-1', 'tnFigueiredo', 'pt', 'friday', 18),
  sched('ch-pt-2', 'Cortes do tnFigueiredo', 'pt', 'friday', 18),
  sched('ch-en', 'Thiago Figueiredo', 'en', 'saturday', 10),
]

function item(id: string, language: PipelineItemWithSlot['language']): PipelineItemWithSlot {
  return {
    id, title: `Video ${id}`, stage: 'roteiro', priority: 5, format: 'video', language,
    duration_target: null, scheduled_at: null, youtube_channel_id: null,
    playlist_id: null, playlist_name: null, playlist_position: null, playlist_total: null, channel_label: null,
  }
}

const ITEMS = [item('i-pt', 'pt-br'), item('i-en', 'en'), item('i-both', 'both')]
const NOW = new Date('2026-06-01T12:00:00Z') // segunda-feira; entrada fixa, a função não lê o relógio
const BASE = { blogCadence: null, newsletterEditions: [], siteTimezone: TZ, now: NOW, maxCards: 10, doneToday: 0 }

describe('pipeline de vídeo com três canais, dois no mesmo idioma', () => {
  it('calculateTodayActions: não lança, lista finita, nenhum item em dois horários', () => {
    const r = calculateTodayActions({ ...BASE, pipelineItems: ITEMS, syncSchedules: SCHEDULES })
    expect(Number.isFinite(r.actions.length)).toBe(true)
    expect(r.actions.length).toBeGreaterThan(0) // não vale verde por lista vazia
    expect(r.actions.length).toBeLessThanOrEqual(ITEMS.length)
    const ids = r.actions.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('calculateTodayActions: zero canais devolve lista vazia', () => {
    const r = calculateTodayActions({ ...BASE, pipelineItems: ITEMS, syncSchedules: [] })
    expect(r.actions).toEqual([])
  })

  it('suggestForSlot: não lança com dois slots pt de canais diferentes e sugere para ambos', () => {
    const slots = generateWeekSlots({ syncSchedules: SCHEDULES, blogCadence: null, newsletterEditions: [], weekStart: '2026-06-01', siteTimezone: TZ, today: '2026-06-01' })
    const ptSlots = slots.filter((s) => s.format === 'video' && s.channelLocale === 'pt')
    expect(ptSlots).toHaveLength(2)
    const candidates: SlotCandidate[] = ITEMS.map(({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }) => ({ id, title, stage, format, language, playlist_id, playlist_name, playlist_position, playlist_total }))
    for (const s of ptSlots) {
      const out = suggestForSlot(s, candidates, slots)
      expect(out.map((x) => x.candidate.id).sort()).toEqual(['i-both', 'i-pt'])
    }
  })

  it('suggestForSlot: zero candidatos devolve lista vazia', () => {
    const slots = generateWeekSlots({ syncSchedules: SCHEDULES, blogCadence: null, newsletterEditions: [], weekStart: '2026-06-01', siteTimezone: TZ, today: '2026-06-01' })
    expect(suggestForSlot(slots.find((s) => s.format === 'video')!, [], slots)).toEqual([])
  })

  it('generateWeekSlots (montador do Up Next): um slot por canal e dia; os dois canais pt ficam separados', () => {
    const slots = generateWeekSlots({ syncSchedules: SCHEDULES, blogCadence: null, newsletterEditions: [], weekStart: '2026-06-01', siteTimezone: TZ, today: '2026-06-01' })
    // os dias de descanso entram como slots de vídeo sem canal; só contam os que têm canal
    const video = slots.filter((s) => s.format === 'video' && s.channelId !== null)
    expect(video).toHaveLength(3)
    const pt = video.filter((s) => s.channelLocale === 'pt')
    expect(pt.map((s) => s.channelId).sort()).toEqual(['ch-pt-1', 'ch-pt-2'])
    const keys = video.map((s) => `${s.channelId}|${s.day}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('generateWeekSlots: zero canais não gera slot de vídeo', () => {
    const slots = generateWeekSlots({ syncSchedules: [], blogCadence: null, newsletterEditions: [], weekStart: '2026-06-01', siteTimezone: TZ, today: '2026-06-01' })
    expect(slots.filter((s) => s.format === 'video' && s.channelId !== null)).toEqual([])
  })

  it('channelByLang continua devolvendo a entrada fixa (o editor de vídeo não depende do banco)', () => {
    expect(channelByLang('pt')).toEqual({ lang: 'pt', name: 'tnFigueiredo', flag: '🇧🇷', label: 'PT-BR' })
    expect(channelByLang('en')?.label).toBe('EN')
    expect(CHANNELS).toHaveLength(2)
  })
})
