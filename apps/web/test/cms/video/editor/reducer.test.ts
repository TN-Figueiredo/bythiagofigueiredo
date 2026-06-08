import { describe, it, expect } from 'vitest'
import { videoReducer, initialFromDetail } from '@/app/cms/(authed)/video/[id]/edit/reducer'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const base: VideoEditorState = {
  itemId: 'vid-1',
  code: 'V-A07',
  siteId: 'site-1',
  stage: 'idea',
  version: 3,
  primaryLang: 'pt',
  activeLang: 'pt',
  activeStage: 'ideia',
  focus: false,
  notes: false,
  recordingOpen: false,
  handoffOpen: false,
  coworkOpen: false,
}

describe('videoReducer', () => {
  it('SET_STAGE switches the active stage tab', () => {
    expect(videoReducer(base, { type: 'SET_STAGE', stage: 'roteiro' }).activeStage).toBe('roteiro')
  })
  it('TOGGLE_FOCUS flips focus', () => {
    expect(videoReducer(base, { type: 'TOGGLE_FOCUS' }).focus).toBe(true)
    expect(videoReducer({ ...base, focus: true }, { type: 'TOGGLE_FOCUS' }).focus).toBe(false)
  })
  it('TOGGLE_NOTES flips editor-notes (default OFF)', () => {
    expect(base.notes).toBe(false)
    expect(videoReducer(base, { type: 'TOGGLE_NOTES' }).notes).toBe(true)
  })
  it('SET_LANG switches active language', () => {
    expect(videoReducer(base, { type: 'SET_LANG', lang: 'en' }).activeLang).toBe('en')
  })
  it('SET_VERSION bumps the optimistic-lock version after a transition', () => {
    expect(videoReducer(base, { type: 'SET_VERSION', version: 4 }).version).toBe(4)
  })
  it('ADVANCE_RECORDED moves stage to gravacao and bumps version', () => {
    const next = videoReducer(base, { type: 'ADVANCE_RECORDED', version: 4 })
    expect(next.stage).toBe('gravacao')
    expect(next.version).toBe(4)
  })
  it('OPEN_OVERLAY/CLOSE_OVERLAY toggle recording/handoff/cowork flags', () => {
    expect(videoReducer(base, { type: 'OPEN_OVERLAY', overlay: 'recording' }).recordingOpen).toBe(true)
    expect(videoReducer({ ...base, handoffOpen: true }, { type: 'CLOSE_OVERLAY', overlay: 'handoff' }).handoffOpen).toBe(false)
  })
})

describe('initialFromDetail (OPEN_AT projection)', () => {
  it('opens a gravacao-stage item on the Pós tab', () => {
    const s = initialFromDetail({
      itemId: 'x', code: 'V-A01', siteId: 's', stage: 'gravacao', version: 1, primaryLang: 'pt',
    })
    expect(s.activeStage).toBe('pos')
  })
  it('opens an idea-stage item on the Ideia tab', () => {
    const s = initialFromDetail({
      itemId: 'x', code: 'V-A01', siteId: 's', stage: 'idea', version: 1, primaryLang: 'en',
    })
    expect(s.activeStage).toBe('ideia')
    expect(s.activeLang).toBe('en')
  })
})
