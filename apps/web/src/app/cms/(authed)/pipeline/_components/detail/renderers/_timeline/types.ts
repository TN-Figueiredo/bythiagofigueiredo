// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/types.ts

/* ── Track definitions ─────────────────────────────── */

export interface TrackDef {
  id: string
  name: string
  color: string
  fn: string
}

export interface TrackGroup {
  video: TrackDef[]
  audio: TrackDef[]
}

/* ── Clip ──────────────────────────────────────────── */

export interface TimelineClipData {
  s: number
  e: number
  label: string
}

/* ── Beat (a single timeline section) ──────────────── */

export interface BeatData {
  idx: number
  label: string
  name: string
  duration: number
  absStart: number
  status: string
  difficulty: string
  clips: Record<string, TimelineClipData[]>
  script?: ScriptItem[]
}

/* ── ScriptPanel item types ────────────────────────── */

export type ScriptItemType = 'note' | 'line' | 'pause' | 'ref'

export interface ScriptItemNote {
  type: 'note'
  tag: string
  tagColor: string
  text: string
}

export interface ScriptItemLine {
  type: 'line'
  text: string
  accent?: string
}

export interface ScriptItemPause {
  type: 'pause'
  duration: number
}

export interface ScriptItemRef {
  type: 'ref'
  text: string
}

export type ScriptItem = ScriptItemNote | ScriptItemLine | ScriptItemPause | ScriptItemRef

/* ── Asset Resolver ────────────────────────────────── */

export type AssetCategory = 'music' | 'sfx' | 'visual' | 'ambience' | 'soundDesign'

export interface MusicAsset {
  id: string
  name: string
  artist: string
  genre: string
  bpm?: number
  dur?: string
  match: number
  local: boolean
  selected: boolean
  confirmed?: boolean
  tags?: string[]
  note?: string
}

export interface SfxFile {
  name: string
  local: boolean
  match: number
}

export interface SfxAsset {
  tc: string
  type: string
  typeColor: string
  desc: string
  file: SfxFile | null
  tags?: string[]
  altCount?: number
}

export interface VisualAsset {
  tc: string
  desc: string
  status: 'pending' | 'resolved'
  file?: string
  search?: string[]
}

export interface AmbienceAsset {
  name: string
  local: boolean
  match: number
  tags?: string[]
}

export interface SoundDesignAsset {
  tc: string
  name: string
  status: 'pending' | 'done'
  tags?: string[]
}

export interface BeatAssets {
  music?: MusicAsset[]
  sfx?: SfxAsset[]
  visual?: VisualAsset[]
  ambience?: AmbienceAsset[]
  soundDesign?: SoundDesignAsset[]
}

/* ── CrossRef ──────────────────────────────────────── */

export interface CrossRefBeat {
  name: string
  srt: string
  dur: string
  estRot: string
  status: string
  statusColor: string
  note?: string
}

export interface CrossRefData {
  summary: string
  beats: CrossRefBeat[]
  divergences: string[]
}

/* ── Speed Ramps ───────────────────────────────────── */

export interface SpeedRampSection {
  name: string
  srt: string
  vel: string
  velColor: string
  racional: string
}

export interface SpeedRampData {
  summary: string
  base: string
  sections: SpeedRampSection[]
}

/* ── PostProd section content shape ────────────────── */

export interface PostProdContent {
  beats?: BeatData[]
  assets?: Record<number, BeatAssets>
  crossRef?: CrossRefData
  speedRamps?: SpeedRampData
}

/* ── Track height map ──────────────────────────────── */

export type TrackHeightMap = Record<string, number>
