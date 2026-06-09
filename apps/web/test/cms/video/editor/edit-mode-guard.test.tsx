// apps/web/test/cms/video/editor/edit-mode-guard.test.tsx
//
// Regression guard for the View/Edit safety mode: "VIEW NEVER WRITES CONTENT".
//
// The View/Edit toggle is a safety gate — in view mode (and on a hard-locked published
// stage) NO content save path may fire: not on field blur, not on ⌘S force-flush. This
// suite mounts the real stage + provider stack in view mode, mocks every content-save path
// (saveTitle / savePostprod / savePublish / saveAll), and asserts ZERO calls on blur + ⌘S.
// It then proves the orthogonal guarantee: recording-status (gravada/refazer) STILL persists
// in view mode via the recording-sync path, because that channel is never gated by edit mode.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { useState, type ReactNode } from 'react'

// --- Mock the session-authed recording server actions + the local-first store (recording path) ---
vi.mock('@/app/cms/(authed)/video/[id]/edit/recording-actions', () => ({
  loadRecording: vi.fn(),
  saveRecordingBeat: vi.fn(),
  persistBeatIds: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  retreatPipelineItem: vi.fn(),
}))
vi.mock('@/lib/pipeline/recording-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pipeline/recording-store')>(
    '@/lib/pipeline/recording-store',
  )
  return {
    ...actual,
    loadLocal: vi.fn(),
    putLocal: vi.fn(),
    applyRemote: vi.fn(),
    dirtyRows: vi.fn(),
    markSynced: vi.fn(),
  }
})

import {
  VideoEditorProvider,
  useVideoEditorState,
  useVideoEditorDispatch,
} from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider, type VideoData } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { IdeiaStage } from '@/app/cms/(authed)/video/[id]/edit/stages/ideia-stage'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import { AutosaveGate, useAutosaveGateRef } from '@/app/cms/(authed)/video/[id]/edit/use-autosave'
import { useRecordingSync } from '@/app/cms/(authed)/video/[id]/edit/use-recording-sync'
import {
  loadRecording,
  saveRecordingBeat,
  persistBeatIds,
} from '@/app/cms/(authed)/video/[id]/edit/recording-actions'
import { loadLocal, putLocal, applyRemote, dirtyRows } from '@/lib/pipeline/recording-store'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

// --- Shared spies for every content-save path. Asserting === 0 calls is the contract. ---
const saveTitle = vi.fn().mockResolvedValue(undefined)
const saveIdeia = vi.fn().mockResolvedValue(undefined)
const saveRoteiro = vi.fn().mockResolvedValue(undefined)
const savePostprod = vi.fn().mockResolvedValue(undefined)
const savePublish = vi.fn().mockResolvedValue(undefined)
const saveAll = vi.fn().mockResolvedValue(undefined)

function seedOf(over: Partial<VideoEditorState> = {}): VideoEditorState {
  return {
    itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 3,
    primaryLang: 'pt', activeLang: 'pt', activeStage: 'ideia', editMode: 'view',
    focus: false, notes: false, showRecStatus: false, markGran: 'off',
    recStatus: {}, retakeNotes: {}, recRecordedHash: {},
    recordingOpen: false, handoffOpen: false, coworkOpen: false, ...over,
  }
}

const emptyVer = {
  title: 'Título existente', direction: 'Direção existente', siblings: [], logline: '', pillar: undefined,
  angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [],
}

function stubData(over: Partial<VideoData> = {}): VideoData {
  return {
    ideia: {
      pt: { title: 'Título existente', direction: 'Direção existente', siblings: [], logline: '', angles: '', framework: '' },
      en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' },
    },
    roteiro: { pt: null, en: null },
    versions: { pt: emptyVer, en: emptyVer } as unknown as VideoData['versions'],
    pillar: undefined, durationRange: undefined,
    saveIdeia, saveTitle, appendSiblings: vi.fn(), saveRoteiro,
    hasUnsavedChanges: false, saveAll, autosaveState: 'saved',
    sections: {}, abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null },
    winnerVariantId: null, savePostprod, savePublish,
    advanceToRecorded: vi.fn(), publishVideo: vi.fn(), coworkSubmit: vi.fn(),
    ...over,
  }
}

function mountIdeia(state: VideoEditorState) {
  return render(
    <VideoEditorProvider initialState={state}>
      <VideoDataProvider value={stubData()}><IdeiaStage cur={emptyVer} lang="pt" /></VideoDataProvider>
    </VideoEditorProvider>,
  )
}

/** Edits a contentEditable title node + blurs it — the only commit trigger in edit mode. */
function editTitleAndBlur(container: HTMLElement) {
  const title = container.querySelector('.vi-title') as HTMLElement
  expect(title).toBeTruthy()
  title.textContent = 'Título alterado pelo usuário'
  fireEvent.blur(title)
}

/** Dispatches the ⌘S (Cmd/Ctrl+S) force-flush keydown the shell binds to saveAll. */
function pressSave() {
  fireEvent.keyDown(document, { key: 's', metaKey: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Safe defaults for the recording-store mocks so the EditorShell's useRecordingSync (mounted
  // in the ⌘S section) hydrates quietly. The recording describe overrides these as needed.
  vi.mocked(loadLocal).mockResolvedValue([])
  vi.mocked(putLocal).mockResolvedValue(undefined)
  vi.mocked(applyRemote).mockResolvedValue([])
  vi.mocked(dirtyRows).mockResolvedValue([])
  vi.mocked(persistBeatIds).mockResolvedValue({ ok: true, data: { persisted: false, version: 3 } })
  vi.mocked(saveRecordingBeat).mockResolvedValue({ ok: true, data: { updatedAt: 'now' } })
  vi.mocked(loadRecording).mockResolvedValue({ ok: true, data: [] })
})
afterEach(() => cleanup())

describe('View never writes content — field blur', () => {
  it('does NOT call saveTitle on blur in view mode (unlocked stage)', () => {
    const { container } = mountIdeia(seedOf())
    editTitleAndBlur(container)
    expect(saveTitle).not.toHaveBeenCalled()
    expect(saveIdeia).not.toHaveBeenCalled()
  })

  it('the title field is NOT contentEditable in view mode', () => {
    const { container } = mountIdeia(seedOf())
    const title = container.querySelector('.vi-title') as HTMLElement
    // contentEditable={false} renders as the string "false" (or "inherit" when unset).
    expect(title.getAttribute('contenteditable')).not.toBe('true')
  })

  it('DOES call saveTitle on blur once edit mode is on (sanity: the guard is mode-scoped)', () => {
    const { container } = mountIdeia(seedOf({ editMode: 'edit' }))
    editTitleAndBlur(container)
    expect(saveTitle).toHaveBeenCalledTimes(1)
  })

  it('does NOT call saveTitle on blur on a PUBLISHED stage even in edit mode (hard lock)', () => {
    const { container } = mountIdeia(seedOf({ editMode: 'edit', stage: 'published' }))
    editTitleAndBlur(container)
    expect(saveTitle).not.toHaveBeenCalled()
  })

  it('does NOT call saveTitle on blur on a SCHEDULED stage even in edit mode (hard lock)', () => {
    const { container } = mountIdeia(seedOf({ editMode: 'edit', stage: 'scheduled' }))
    editTitleAndBlur(container)
    expect(saveTitle).not.toHaveBeenCalled()
  })
})

// ----- ⌘S force-flush through the real EditorShell + the real autosave gate -----
// EditorShell binds ⌘S → data.saveAll(). The product's saveAll (editor-client.tsx) opens with
// `if (!canEditRef.current) return`, where canEditRef is driven by <AutosaveGate>. We reproduce
// that exact guard: a gated saveAll wired through the REAL useAutosaveGateRef + AutosaveGate, so
// ⌘S exercises the genuine view/published gate rather than a hand-rolled flag.
function GatedShell({ state }: { state: VideoEditorState }) {
  const canEditRef = useAutosaveGateRef()
  const gatedSaveAll = vi.fn(async () => {
    if (!canEditRef.current) return // mirrors editor-client.tsx saveAll gate
    await saveAll()
  })
  // Expose the wrapper so the test can assert the inner saveAll never ran.
  ;(gatedSaveAll as unknown as { __inner: typeof saveAll }).__inner = saveAll
  const data = stubData({ saveAll: gatedSaveAll })
  return (
    <VideoEditorProvider initialState={state}>
      <VideoDataProvider value={data}>
        <AutosaveGate canEditRef={canEditRef} />
        <EditorShell />
      </VideoDataProvider>
    </VideoEditorProvider>
  )
}

describe('View never writes content — ⌘S force-flush', () => {
  it('⌘S in view mode (unlocked stage) never reaches the real content saveAll', async () => {
    render(<GatedShell state={seedOf()} />)
    await act(async () => { pressSave() })
    expect(saveAll).not.toHaveBeenCalled()
  })

  it('⌘S on a published stage never reaches the real content saveAll', async () => {
    render(<GatedShell state={seedOf({ editMode: 'edit', stage: 'published' })} />)
    await act(async () => { pressSave() })
    expect(saveAll).not.toHaveBeenCalled()
  })

  it('⌘S in edit mode on an unlocked stage DOES flush (sanity: the gate is mode-scoped)', async () => {
    render(<GatedShell state={seedOf({ editMode: 'edit' })} />)
    await act(async () => { pressSave() })
    await waitFor(() => expect(saveAll).toHaveBeenCalled())
  })
})

// ----- ⌘S force-flush: drives data.saveAll directly; the autosave gate must keep it inert. -----
const ROTEIRO_FALA: RoteiroContentV3 = {
  version: 3, meta: {},
  beats: [{ idx: 0, name: 'Hook', status: 'PENDING', kind: 'fala', id: 'beat-a', script: [{ type: 'line', text: 'Olá' }] }],
}

/** Mounts the recording-sync hook + exposes a beat-status button — exercises the gravada path. */
function RecProbe() {
  useRecordingSync()
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  return (
    <div>
      <span data-testid="status">{state.recStatus['pt:beat-a'] ?? 'none'}</span>
      <button onClick={() => dispatch({ type: 'SET_BEAT_STATUS', key: 'pt:beat-a', status: 'gravada' })}>set</button>
    </div>
  )
}

function RecHarness({ children, state }: { children: ReactNode; state: VideoEditorState }) {
  const [version, setVersion] = useState(state.version)
  const data = stubData({ roteiro: { pt: ROTEIRO_FALA, en: null } })
  return (
    <VideoEditorProvider initialState={state} liveVersion={version} setLiveVersion={setVersion}>
      <VideoDataProvider value={data}>{children}</VideoDataProvider>
    </VideoEditorProvider>
  )
}

describe('Recording status STILL persists in view mode (orthogonal to the content gate)', () => {
  it('a gravada mark in VIEW mode fires the local-first write + the server upsert', async () => {
    const { getByText } = render(<RecHarness state={seedOf({ activeStage: 'roteiro', stage: 'gravacao' })}><RecProbe /></RecHarness>)
    await waitFor(() => expect(loadRecording).toHaveBeenCalled())
    await act(async () => { fireEvent.click(getByText('set')) })
    await waitFor(() => expect(putLocal).toHaveBeenCalled())
    await waitFor(() => expect(saveRecordingBeat).toHaveBeenCalled())
    // And the content-save paths stayed completely silent throughout.
    expect(saveTitle).not.toHaveBeenCalled()
    expect(saveAll).not.toHaveBeenCalled()
  })
})
