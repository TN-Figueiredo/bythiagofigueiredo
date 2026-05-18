import { z } from 'zod'

// ─── Track Configuration ─────────────────────────────────────
export const TrackConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['video', 'audio', 'music', 'sfx', 'graphics', 'text']),
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  visible: z.boolean().default(true),
})

// ─── Beat (timeline segment) ─────────────────────────────────
export const BeatSchema = z.object({
  index: z.number().int().nonnegative(),
  label: z.string().min(1),
  beat_ref: z.string().optional(),
  timecode_in: z.string().optional(),
  timecode_out: z.string().optional(),
  duration_sec: z.number().nonnegative().optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'review']).default('pending'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'complex']).optional(),
  narrative: z.string().optional(),
  edit_notes: z.array(z.string()).default([]),
  transition_in: z.object({
    type: z.string(),
    reasoning: z.string().optional(),
  }).optional(),
  transition_out: z.object({
    type: z.string(),
    reasoning: z.string().optional(),
  }).optional(),
})

// ─── Timeline ────────────────────────────────────────────────
export const TimelineSchema = z.object({
  tracks: z.array(TrackConfigSchema).default([]),
  beats: z.array(BeatSchema).default([]),
  total_duration_sec: z.number().nonnegative().default(0),
  fps: z.number().int().min(1).max(240).default(30),
})

// ─── Music asset reference ───────────────────────────────────
export const MusicAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  track_name: z.string().optional(),
  artist: z.string().optional(),
  bpm: z.number().int().positive().optional(),
  energy: z.number().int().min(1).max(5).optional(),
  entry_style: z.string().optional(),
  role: z.enum(['primary', 'secondary', 'accent']).default('primary'),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── SFX asset reference ─────────────────────────────────────
export const SFXAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  timecode: z.string().optional(),
  type: z.enum(['whoosh', 'impact', 'riser', 'ambient', 'foley', 'ui', 'other']).default('other'),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── Visual asset reference (b-roll in timeline) ─────────────
export const VisualAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  type: z.enum(['broll', 'screen_recording', 'graphic', 'animation', 'photo', 'stock']).default('broll'),
  timecode_in: z.string().optional(),
  timecode_out: z.string().optional(),
  speed: z.string().optional(),
  effect: z.string().optional(),
  notes: z.string().optional(),
})

// ─── Ambience reference ──────────────────────────────────────
export const AmbienceAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  environment: z.string().optional(),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── Sound design reference ──────────────────────────────────
export const SoundDesignAssetRefSchema = z.object({
  asset_id: z.string().optional(),
  label: z.string().min(1),
  category: z.string().optional(),
  volume_db: z.number().optional(),
  notes: z.string().optional(),
})

// ─── Beat assets (all assets for a given beat) ───────────────
export const BeatAssetsSchema = z.object({
  music: z.array(MusicAssetRefSchema).default([]),
  sfx: z.array(SFXAssetRefSchema).default([]),
  visual: z.array(VisualAssetRefSchema).default([]),
  ambience: z.array(AmbienceAssetRefSchema).default([]),
  soundDesign: z.array(SoundDesignAssetRefSchema).default([]),
})

// ─── Cross-reference beat ────────────────────────────────────
export const CrossRefBeatSchema = z.object({
  beat: z.string().min(1),
  srt_timestamp: z.string().optional(),
  duration: z.string().optional(),
  script_estimate: z.string().optional(),
  status: z.enum(['match', 'diverge', 'missing', 'extra']).default('match'),
})

// ─── Cross-reference section ─────────────────────────────────
export const CrossRefSchema = z.object({
  summary: z.string().default(''),
  beats: z.array(CrossRefBeatSchema).default([]),
  divergences: z.array(z.string()).default([]),
  source: z.string().default(''),
})

// ─── Speed ramp section ──────────────────────────────────────
export const SpeedRampSectionSchema = z.object({
  section: z.string().min(1),
  srt_range: z.string().optional(),
  timeline: z.string().optional(),
  speed: z.string().min(1),
  rationale: z.string().optional(),
})

export const SpeedRampsSchema = z.object({
  summary: z.string().default(''),
  base: z.string().default(''),
  est_final: z.string().default(''),
  edit_style: z.string().default(''),
  sections: z.array(SpeedRampSectionSchema).default([]),
  source: z.string().default(''),
})

// ─── Unified PostProd section schema ─────────────────────────
export const PostProdSectionSchema = z.object({
  schema_version: z.literal('2.0'),
  timeline: TimelineSchema.default({
    tracks: [],
    beats: [],
    total_duration_sec: 0,
    fps: 30,
  }),
  assets: z.record(
    z.coerce.number().int().nonnegative(),
    BeatAssetsSchema,
  ).default({}),
  crossref: CrossRefSchema.default({
    summary: '',
    beats: [],
    divergences: [],
    source: '',
  }),
  speedramps: SpeedRampsSchema.default({
    summary: '',
    base: '',
    est_final: '',
    edit_style: '',
    sections: [],
    source: '',
  }),
})

export type TrackConfig = z.infer<typeof TrackConfigSchema>
export type Beat = z.infer<typeof BeatSchema>
export type Timeline = z.infer<typeof TimelineSchema>
export type MusicAssetRef = z.infer<typeof MusicAssetRefSchema>
export type SFXAssetRef = z.infer<typeof SFXAssetRefSchema>
export type VisualAssetRef = z.infer<typeof VisualAssetRefSchema>
export type AmbienceAssetRef = z.infer<typeof AmbienceAssetRefSchema>
export type SoundDesignAssetRef = z.infer<typeof SoundDesignAssetRefSchema>
export type BeatAssets = z.infer<typeof BeatAssetsSchema>
export type CrossRefBeat = z.infer<typeof CrossRefBeatSchema>
export type CrossRef = z.infer<typeof CrossRefSchema>
export type SpeedRampSection = z.infer<typeof SpeedRampSectionSchema>
export type SpeedRamps = z.infer<typeof SpeedRampsSchema>
export type PostProdSection = z.infer<typeof PostProdSectionSchema>
