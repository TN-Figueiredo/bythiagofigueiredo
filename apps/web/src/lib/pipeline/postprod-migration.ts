import type { PostProdSection, Beat, BeatAssets } from './postprod-schemas'

/**
 * Legacy scene structure from postprod_scenes section data
 */
interface LegacyScene {
  number: number
  label?: string
  beat_ref?: string
  timestamps?: string
  timeline?: string
  duration?: string
  status?: string
  difficulty?: string
  narrative?: string
  edit_notes?: string[]
  music?: {
    track_name?: string
    artist?: string
    bpm?: number
    energy?: number
    entry_style?: string
    role?: string
    asset_id?: string
  }
  sfx?: Array<{
    label?: string
    description?: string
    type?: string
    timecode?: string
  }>
  overlays?: Array<{
    timestamp?: string
    instruction?: string
  }>
  mix_params?: Array<{
    parameter?: string
    value?: string
  }>
  transition?: {
    type?: string
    reasoning?: string
  }
}

interface LegacyScenesContent {
  scenes?: LegacyScene[]
  summary?: string
  music_hero?: unknown
}

interface LegacyCrossRefContent {
  rows?: Array<{
    beat: string
    srt_timestamp?: string
    duration?: string
    script_estimate?: string
    script_est?: string
    status?: string
  }>
  beats?: Array<{
    beat: string
    srt_timestamp?: string
    duration?: string
    script_estimate?: string
    script_est?: string
    status?: string
  }>
  divergences?: string[]
  key_divergences?: string[]
  source?: string
  summary?: string
}

interface LegacySpeedRampContent {
  rows?: Array<{
    section: string
    srt_range?: string
    timeline?: string
    speed: string
    rationale?: string
  }>
  ramps?: Array<{
    section: string
    srt_range?: string
    timeline?: string
    speed: string
    rationale?: string
  }>
  segments?: Array<{
    section: string
    srt_range?: string
    timeline?: string
    speed: string
    rationale?: string
  }>
  source?: string
  est_final?: string
  edit_style?: string
  base_acceleration?: string
  summary?: string
}

export interface MigrationInput {
  scenes?: unknown
  crossref?: unknown
  speedramps?: unknown
}

export interface MigrationResult {
  data: PostProdSection
  warnings: string[]
}

function parseTimecodes(timestamps?: string): { timecode_in?: string; timecode_out?: string } {
  if (!timestamps) return {}
  const parts = timestamps.split(/[-–]/).map(s => s.trim())
  return {
    timecode_in: parts[0] || undefined,
    timecode_out: parts[1] || undefined,
  }
}

function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined
  const match = duration.match(/(\d+(?:\.\d+)?)/)
  if (!match) return undefined
  const val = parseFloat(match[1]!)
  if (duration.toLowerCase().includes('min')) return val * 60
  return val
}

function normalizeStatus(status?: string): Beat['status'] {
  if (!status) return 'pending'
  const s = status.toLowerCase()
  if (s === 'done' || s === 'complete' || s === 'completed') return 'done'
  if (s === 'in_progress' || s === 'in progress' || s === 'editing') return 'in_progress'
  if (s === 'review' || s === 'reviewing') return 'review'
  return 'pending'
}

function normalizeDifficulty(d?: string): Beat['difficulty'] {
  if (!d) return undefined
  const lower = d.toLowerCase()
  if (lower === 'easy' || lower === 'simple') return 'easy'
  if (lower === 'medium' || lower === 'moderate') return 'medium'
  if (lower === 'hard' || lower === 'difficult') return 'hard'
  if (lower === 'complex' || lower === 'very hard') return 'complex'
  return undefined
}

function normalizeCrossRefStatus(status?: string): 'match' | 'diverge' | 'missing' | 'extra' {
  if (!status) return 'match'
  const s = status.toLowerCase()
  if (s === 'match' || s === 'ok' || s === 'aligned') return 'match'
  if (s === 'diverge' || s === 'diverged' || s === 'mismatch') return 'diverge'
  if (s === 'missing') return 'missing'
  if (s === 'extra' || s === 'added') return 'extra'
  return 'match'
}

export function migrateToPostProdV2(input: MigrationInput): MigrationResult {
  const warnings: string[] = []
  const beats: Beat[] = []
  const assets: Record<number, BeatAssets> = {}

  // ── Migrate scenes ──
  const scenesRaw = input.scenes
  let scenes: LegacyScene[] = []

  if (scenesRaw && typeof scenesRaw === 'object' && !Array.isArray(scenesRaw)) {
    const obj = scenesRaw as LegacyScenesContent
    scenes = obj.scenes ?? []
  } else if (Array.isArray(scenesRaw)) {
    scenes = scenesRaw as LegacyScene[]
  }

  for (const scene of scenes) {
    const tc = parseTimecodes(scene.timestamps ?? scene.timeline)
    const beat: Beat = {
      index: scene.number - 1,
      label: scene.label ?? `Scene ${scene.number}`,
      beat_ref: scene.beat_ref,
      timecode_in: tc.timecode_in,
      timecode_out: tc.timecode_out,
      duration_sec: parseDuration(scene.duration),
      status: normalizeStatus(scene.status),
      difficulty: normalizeDifficulty(scene.difficulty),
      narrative: scene.narrative,
      edit_notes: scene.edit_notes ?? [],
      transition_in: scene.transition ? { type: scene.transition.type ?? 'cut', reasoning: scene.transition.reasoning } : undefined,
    }
    beats.push(beat)

    // Build assets for this beat
    const beatAssets: BeatAssets = {
      music: [],
      sfx: [],
      visual: [],
      ambience: [],
      soundDesign: [],
    }

    if (scene.music) {
      beatAssets.music.push({
        asset_id: scene.music.asset_id,
        track_name: scene.music.track_name,
        artist: scene.music.artist,
        bpm: scene.music.bpm,
        energy: scene.music.energy,
        entry_style: scene.music.entry_style,
        role: (scene.music.role as 'primary' | 'secondary' | 'accent') ?? 'primary',
      })
    }

    if (scene.sfx) {
      for (const sfx of scene.sfx) {
        beatAssets.sfx.push({
          label: sfx.label ?? sfx.description ?? 'SFX',
          timecode: sfx.timecode,
          type: (sfx.type as 'whoosh' | 'impact' | 'riser' | 'ambient' | 'foley' | 'ui' | 'other') ?? 'other',
        })
      }
    }

    const hasContent = beatAssets.music.length > 0 || beatAssets.sfx.length > 0
    if (hasContent) {
      assets[beat.index] = beatAssets
    }
  }

  // ── Migrate crossref ──
  const crossrefRaw = input.crossref
  let crossref: PostProdSection['crossref'] = { summary: '', beats: [], divergences: [], source: '' }

  if (crossrefRaw && typeof crossrefRaw === 'object' && !Array.isArray(crossrefRaw)) {
    const obj = crossrefRaw as LegacyCrossRefContent
    const rows = obj.rows ?? obj.beats ?? []

    crossref = {
      summary: obj.summary ?? '',
      beats: rows.map(r => ({
        beat: r.beat,
        srt_timestamp: r.srt_timestamp,
        duration: r.duration,
        script_estimate: r.script_estimate ?? r.script_est,
        status: normalizeCrossRefStatus(r.status),
      })),
      divergences: obj.divergences ?? obj.key_divergences ?? [],
      source: obj.source ?? '',
    }
  }

  // ── Migrate speedramps ──
  const speedrampsRaw = input.speedramps
  let speedramps: PostProdSection['speedramps'] = { summary: '', base: '', est_final: '', edit_style: '', sections: [], source: '' }

  if (speedrampsRaw && typeof speedrampsRaw === 'object' && !Array.isArray(speedrampsRaw)) {
    const obj = speedrampsRaw as LegacySpeedRampContent
    const rows = obj.rows ?? obj.ramps ?? obj.segments ?? []

    speedramps = {
      summary: obj.summary ?? '',
      base: obj.base_acceleration ?? '',
      est_final: obj.est_final ?? '',
      edit_style: obj.edit_style ?? '',
      sections: rows.map(r => ({
        section: r.section,
        srt_range: r.srt_range,
        timeline: r.timeline,
        speed: r.speed,
        rationale: r.rationale,
      })),
      source: obj.source ?? '',
    }
  }

  // ── Build result ──
  const totalDuration = beats.reduce((sum, b) => sum + (b.duration_sec ?? 0), 0)

  if (scenes.length === 0 && Object.keys(crossrefRaw ?? {}).length === 0 && Object.keys(speedrampsRaw ?? {}).length === 0) {
    warnings.push('No legacy data found to migrate — creating empty v2.0 structure')
  }

  const result: PostProdSection = {
    schema_version: '2.0',
    timeline: {
      tracks: [],
      beats,
      total_duration_sec: totalDuration,
      fps: 30,
    },
    assets,
    crossref,
    speedramps,
  }

  return { data: result, warnings }
}
