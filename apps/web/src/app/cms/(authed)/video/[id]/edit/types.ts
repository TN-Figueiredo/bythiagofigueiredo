import type { RecStatus, MarkGran } from '@/lib/pipeline/video-recording'

export type VideoStage = 'ideia' | 'roteiro' | 'pos' | 'publicacao'
export const VIDEO_STAGES: VideoStage[] = ['ideia', 'roteiro', 'pos', 'publicacao']
export type VideoLang = 'pt' | 'en'
export type VideoOverlay = 'recording' | 'handoff' | 'cowork'

export interface VideoEditorState {
  itemId: string
  code: string
  siteId: string
  stage: string            // DB workflow token (idea/roteiro/gravacao/edicao/pos_producao/scheduled/published)
  version: number          // content_pipeline.version (optimistic lock)
  primaryLang: VideoLang   // the video's primary language (always a present version)
  activeLang: VideoLang
  activeStage: VideoStage
  focus: boolean
  notes: boolean           // "Notas do editor" toggle — default OFF
  showRecStatus: boolean   // "Status de gravação" toggle — default OFF (clean reading)
  // Per-line/beat/section pen-marking granularity for the print + recording overlay.
  // Default 'off' → a clean script, no checkboxes (especially on paper). Persisted to
  // localStorage under a single global key (`video-mark-gran`), hydrated in the shell.
  markGran: MarkGran
  // Per-beat recording status, keyed by `${activeLang}:${beat.id}` so PT/EN never collide.
  recStatus: Record<string, RecStatus>
  // Free-text retake notes, same lang-qualified beat keys. Absent key = no note.
  retakeNotes: Record<string, string>
  // The content_hash the beat was RECORDED against, carried verbatim from the durable
  // ledger on hydrate (same `${lang}:${beat.id}` keys). The UI computes
  // `stale = recRecordedHash[key] !== currentBeatHash` — so an edit AFTER a recording is
  // surfaced ("roteiro mudou desde a gravação") without the write path overwriting it.
  // Absent key = never recorded (no stale baseline).
  recRecordedHash: Record<string, string>
  recordingOpen: boolean
  handoffOpen: boolean
  coworkOpen: boolean
}

export type VideoEditorAction =
  | { type: 'SET_STAGE'; stage: VideoStage }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'TOGGLE_NOTES' }
  | { type: 'SET_LANG'; lang: VideoLang }
  | { type: 'SET_VERSION'; version: number }
  | { type: 'ADVANCE_RECORDED'; version: number }
  | { type: 'OPEN_OVERLAY'; overlay: VideoOverlay }
  | { type: 'CLOSE_OVERLAY'; overlay: VideoOverlay }
  | { type: 'TOGGLE_REC_STATUS' }
  | { type: 'SET_MARK_GRAN'; gran: MarkGran }
  | { type: 'CYCLE_BEAT_STATUS'; key: string }
  | { type: 'SET_BEAT_STATUS'; key: string; status: RecStatus }
  | { type: 'SET_RETAKE_NOTE'; key: string; text: string }
  // Reconcile the editor's per-beat status/notes with the durable ledger (local-first +
  // server). Replaces the keys for the hydrated lang while preserving other-lang keys —
  // the maps are lang-qualified (`${lang}:${beat.id}`), so a PT hydrate must not wipe EN.
  | { type: 'HYDRATE_RECORDING'; lang: VideoLang; recStatus: Record<string, RecStatus>; retakeNotes: Record<string, string>; recordedHash: Record<string, string> }
