import { OPEN_AT } from '@/lib/pipeline/video-lifecycle'
import { nextStatus, DEFAULT_MARK_GRAN, type RecStatus } from '@/lib/pipeline/video-recording'
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
    case 'TOGGLE_REC_STATUS':
      return { ...state, showRecStatus: !state.showRecStatus }
    case 'SET_MARK_GRAN':
      return { ...state, markGran: action.gran }
    case 'CYCLE_BEAT_STATUS': {
      const cur: RecStatus = state.recStatus[action.key] ?? 'pendente'
      return { ...state, recStatus: { ...state.recStatus, [action.key]: nextStatus(cur) } }
    }
    case 'SET_BEAT_STATUS':
      return { ...state, recStatus: { ...state.recStatus, [action.key]: action.status } }
    case 'SET_RETAKE_NOTE': {
      const text = action.text.trim()
      const retakeNotes = { ...state.retakeNotes }
      if (text) retakeNotes[action.key] = text
      else delete retakeNotes[action.key]
      return { ...state, retakeNotes }
    }
    case 'HYDRATE_RECORDING': {
      // Replace only this lang's keys (prefix `${lang}:`); keep the other lang intact.
      const prefix = `${action.lang}:`
      const recStatus: Record<string, RecStatus> = {}
      for (const [k, v] of Object.entries(state.recStatus)) {
        if (!k.startsWith(prefix)) recStatus[k] = v
      }
      for (const [k, v] of Object.entries(action.recStatus)) recStatus[k] = v

      const retakeNotes: Record<string, string> = {}
      for (const [k, v] of Object.entries(state.retakeNotes)) {
        if (!k.startsWith(prefix)) retakeNotes[k] = v
      }
      for (const [k, v] of Object.entries(action.retakeNotes)) {
        if (v.trim()) retakeNotes[k] = v
      }
      return { ...state, recStatus, retakeNotes }
    }
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
    showRecStatus: false,
    markGran: DEFAULT_MARK_GRAN,
    recStatus: {},
    retakeNotes: {},
    recordingOpen: false,
    handoffOpen: false,
    coworkOpen: false,
  }
}
