import { OPEN_AT } from '@/lib/pipeline/video-lifecycle'
import type { VideoEditorState, VideoEditorAction, VideoStage } from './types'

function overlayKey(o: 'recording' | 'handoff' | 'cowork'): keyof VideoEditorState {
  return o === 'recording' ? 'recordingOpen' : o === 'handoff' ? 'handoffOpen' : 'coworkOpen'
}

export function videoReducer(state: VideoEditorState, action: VideoEditorAction): VideoEditorState {
  switch (action.type) {
    case 'SET_STAGE':
      return { ...state, activeStage: action.stage }
    case 'TOGGLE_FOCUS':
      return { ...state, focus: !state.focus }
    case 'TOGGLE_NOTES':
      return { ...state, notes: !state.notes }
    case 'SET_LANG':
      return { ...state, activeLang: action.lang }
    case 'SET_VERSION':
      return { ...state, version: action.version }
    case 'ADVANCE_RECORDED':
      return { ...state, stage: 'gravacao', version: action.version }
    case 'OPEN_OVERLAY':
      return { ...state, [overlayKey(action.overlay)]: true }
    case 'CLOSE_OVERLAY':
      return { ...state, [overlayKey(action.overlay)]: false }
    default:
      return state
  }
}

export interface DetailSeed {
  itemId: string
  code: string
  siteId: string
  stage: string
  version: number
  primaryLang: 'pt' | 'en'
}

export function initialFromDetail(seed: DetailSeed): VideoEditorState {
  return {
    itemId: seed.itemId,
    code: seed.code,
    siteId: seed.siteId,
    stage: seed.stage,
    version: seed.version,
    primaryLang: seed.primaryLang,
    activeLang: seed.primaryLang,
    activeStage: OPEN_AT(seed.stage) as VideoStage,
    focus: false,
    notes: false,
    recordingOpen: false,
    handoffOpen: false,
    coworkOpen: false,
  }
}
