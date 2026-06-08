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
