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
  editMode: 'view',
  focus: false,
  notes: false,
  showRecStatus: false,
  markGran: 'off',
  recStatus: {},
  retakeNotes: {},
  recRecordedHash: {},
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
  it('SET_EDIT_MODE switches editMode (default view)', () => {
    expect(base.editMode).toBe('view')
    expect(videoReducer(base, { type: 'SET_EDIT_MODE', mode: 'edit' }).editMode).toBe('edit')
    expect(videoReducer({ ...base, editMode: 'edit' }, { type: 'SET_EDIT_MODE', mode: 'view' }).editMode).toBe('view')
  })
  it('SET_EDIT_MODE does not touch the DB stage (toggle is independent of publish lock)', () => {
    const next = videoReducer({ ...base, stage: 'published' }, { type: 'SET_EDIT_MODE', mode: 'edit' })
    expect(next.editMode).toBe('edit')
    expect(next.stage).toBe('published') // lock derivation happens at read-time, not in the reducer
  })
  it('SET_VERSION bumps the optimistic-lock version after a transition', () => {
    expect(videoReducer(base, { type: 'SET_VERSION', version: 4 }).version).toBe(4)
  })
  it('SET_DB_STAGE updates the DB workflow stage (e.g. after a publish retreat)', () => {
    const next = videoReducer({ ...base, stage: 'published' }, { type: 'SET_DB_STAGE', stage: 'scheduled' })
    expect(next.stage).toBe('scheduled')
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

describe('videoReducer — recording status (per-beat)', () => {
  it('TOGGLE_REC_STATUS flips showRecStatus (default OFF)', () => {
    expect(base.showRecStatus).toBe(false)
    const on = videoReducer(base, { type: 'TOGGLE_REC_STATUS' })
    expect(on.showRecStatus).toBe(true)
    expect(videoReducer(on, { type: 'TOGGLE_REC_STATUS' }).showRecStatus).toBe(false)
  })

  it('markGran defaults to off and SET_MARK_GRAN sets it', () => {
    expect(base.markGran).toBe('off')
    expect(videoReducer(base, { type: 'SET_MARK_GRAN', gran: 'beat' }).markGran).toBe('beat')
    expect(videoReducer(base, { type: 'SET_MARK_GRAN', gran: 'secao' }).markGran).toBe('secao')
    expect(videoReducer(base, { type: 'SET_MARK_GRAN', gran: 'linha' }).markGran).toBe('linha')
    expect(videoReducer({ ...base, markGran: 'linha' }, { type: 'SET_MARK_GRAN', gran: 'off' }).markGran).toBe('off')
  })

  it('CYCLE_BEAT_STATUS advances pendente → gravada → refazer → pendente', () => {
    const k = 'pt:beat-1'
    const a = videoReducer(base, { type: 'CYCLE_BEAT_STATUS', key: k })
    expect(a.recStatus[k]).toBe('gravada')
    const b = videoReducer(a, { type: 'CYCLE_BEAT_STATUS', key: k })
    expect(b.recStatus[k]).toBe('refazer')
    const c = videoReducer(b, { type: 'CYCLE_BEAT_STATUS', key: k })
    expect(c.recStatus[k]).toBe('pendente')
  })

  it('CYCLE_BEAT_STATUS treats a missing key as pendente (→ gravada)', () => {
    const next = videoReducer(base, { type: 'CYCLE_BEAT_STATUS', key: 'en:beat-9' })
    expect(next.recStatus['en:beat-9']).toBe('gravada')
  })

  it('CYCLE_BEAT_STATUS does not mutate sibling keys', () => {
    const seeded: VideoEditorState = { ...base, recStatus: { 'pt:beat-1': 'gravada' } }
    const next = videoReducer(seeded, { type: 'CYCLE_BEAT_STATUS', key: 'pt:beat-2' })
    expect(next.recStatus['pt:beat-1']).toBe('gravada')
    expect(next.recStatus['pt:beat-2']).toBe('gravada')
  })

  it('SET_BEAT_STATUS sets an explicit status', () => {
    const next = videoReducer(base, { type: 'SET_BEAT_STATUS', key: 'pt:beat-1', status: 'refazer' })
    expect(next.recStatus['pt:beat-1']).toBe('refazer')
  })

  it('SET_RETAKE_NOTE stores trimmed text; empty text deletes the key', () => {
    const withNote = videoReducer(base, { type: 'SET_RETAKE_NOTE', key: 'pt:beat-1', text: 'luz estourou' })
    expect(withNote.retakeNotes['pt:beat-1']).toBe('luz estourou')
    const cleared = videoReducer(withNote, { type: 'SET_RETAKE_NOTE', key: 'pt:beat-1', text: '   ' })
    expect(cleared.retakeNotes['pt:beat-1']).toBeUndefined()
    expect('pt:beat-1' in cleared.retakeNotes).toBe(false)
  })
})

describe('videoReducer — HYDRATE_RECORDING', () => {
  it('replaces the hydrated lang keys with the server/local truth', () => {
    const s = videoReducer(base, {
      type: 'HYDRATE_RECORDING',
      lang: 'pt',
      recStatus: { 'pt:b1': 'gravada', 'pt:b2': 'refazer' },
      retakeNotes: { 'pt:b2': 'estourou' },
      recordedHash: {},
    })
    expect(s.recStatus['pt:b1']).toBe('gravada')
    expect(s.recStatus['pt:b2']).toBe('refazer')
    expect(s.retakeNotes['pt:b2']).toBe('estourou')
  })

  it('carries the RECORDED content_hash (recRecordedHash) so the UI can flag staleness', () => {
    const s = videoReducer(base, {
      type: 'HYDRATE_RECORDING',
      lang: 'pt',
      recStatus: { 'pt:b1': 'gravada' },
      retakeNotes: {},
      recordedHash: { 'pt:b1': 'abc123' },
    })
    expect(s.recRecordedHash['pt:b1']).toBe('abc123')
  })

  it('recRecordedHash is lang-scoped: a PT hydrate keeps EN recorded hashes', () => {
    const seeded: VideoEditorState = {
      ...base,
      recRecordedHash: { 'en:e1': 'enhash' },
    }
    const s = videoReducer(seeded, {
      type: 'HYDRATE_RECORDING',
      lang: 'pt',
      recStatus: { 'pt:p1': 'gravada' },
      retakeNotes: {},
      recordedHash: { 'pt:p1': 'pthash' },
    })
    expect(s.recRecordedHash['en:e1']).toBe('enhash')
    expect(s.recRecordedHash['pt:p1']).toBe('pthash')
  })

  it('drops stale keys for the hydrated lang not present in the snapshot', () => {
    const seeded: VideoEditorState = {
      ...base,
      recStatus: { 'pt:old': 'gravada', 'pt:b1': 'pendente' },
      retakeNotes: { 'pt:old': 'antigo' },
    }
    const s = videoReducer(seeded, {
      type: 'HYDRATE_RECORDING',
      lang: 'pt',
      recStatus: { 'pt:b1': 'gravada' },
      retakeNotes: {},
      recordedHash: {},
    })
    expect(s.recStatus['pt:old']).toBeUndefined()
    expect(s.retakeNotes['pt:old']).toBeUndefined()
    expect(s.recStatus['pt:b1']).toBe('gravada')
  })

  it('preserves the OTHER lang keys when hydrating one lang (lang-qualified maps)', () => {
    const seeded: VideoEditorState = {
      ...base,
      recStatus: { 'en:e1': 'gravada' },
      retakeNotes: { 'en:e1': 'note-en' },
    }
    const s = videoReducer(seeded, {
      type: 'HYDRATE_RECORDING',
      lang: 'pt',
      recStatus: { 'pt:p1': 'refazer' },
      retakeNotes: { 'pt:p1': 'refaz' },
      recordedHash: {},
    })
    expect(s.recStatus['en:e1']).toBe('gravada')
    expect(s.retakeNotes['en:e1']).toBe('note-en')
    expect(s.recStatus['pt:p1']).toBe('refazer')
  })

  it('ignores blank retake notes in the hydrate payload', () => {
    const s = videoReducer(base, {
      type: 'HYDRATE_RECORDING',
      lang: 'pt',
      recStatus: { 'pt:b1': 'gravada' },
      retakeNotes: { 'pt:b1': '   ' },
      recordedHash: {},
    })
    expect(s.retakeNotes['pt:b1']).toBeUndefined()
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
  it('defaults editMode to view (content read-only on open) regardless of stage', () => {
    expect(initialFromDetail({ itemId: 'x', code: 'V', siteId: 's', stage: 'idea', version: 1, primaryLang: 'pt' }).editMode).toBe('view')
    expect(initialFromDetail({ itemId: 'x', code: 'V', siteId: 's', stage: 'published', version: 1, primaryLang: 'pt' }).editMode).toBe('view')
  })
})
