import type { RecStatus } from '@/lib/pipeline/video-recording'

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
  // Per-beat recording status, keyed by `${activeLang}:${beat.id}` so PT/EN never collide.
  recStatus: Record<string, RecStatus>
  // Free-text retake notes, same lang-qualified beat keys. Absent key = no note.
  retakeNotes: Record<string, string>
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
  | { type: 'CYCLE_BEAT_STATUS'; key: string }
  | { type: 'SET_BEAT_STATUS'; key: string; status: RecStatus }
  | { type: 'SET_RETAKE_NOTE'; key: string; text: string }
