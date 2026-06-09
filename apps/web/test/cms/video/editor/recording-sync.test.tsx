import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// --- Mock the session-authed server actions + the local-first store ---
vi.mock('@/app/cms/(authed)/video/[id]/edit/recording-actions', () => ({
  loadRecording: vi.fn(),
  saveRecordingBeat: vi.fn(),
  persistBeatIds: vi.fn(),
}))
vi.mock('@/lib/pipeline/recording-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pipeline/recording-store')>(
    '@/lib/pipeline/recording-store',
  )
  return {
    ...actual, // keep the pure mergeRemoteRows + rowKey
    loadLocal: vi.fn(),
    putLocal: vi.fn(),
    applyRemote: vi.fn(),
    dirtyRows: vi.fn(),
    markSynced: vi.fn(),
  }
})

import { VideoEditorProvider, useVideoEditorState, useVideoEditorDispatch } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider, type VideoData } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { useRecordingSync } from '@/app/cms/(authed)/video/[id]/edit/use-recording-sync'
import { initialFromDetail } from '@/app/cms/(authed)/video/[id]/edit/reducer'
import { loadRecording, saveRecordingBeat, persistBeatIds } from '@/app/cms/(authed)/video/[id]/edit/recording-actions'
import { loadLocal, putLocal, applyRemote, dirtyRows } from '@/lib/pipeline/recording-store'
import type { RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const ROTEIRO: RoteiroContentV3 = {
  version: 3,
  meta: {},
  beats: [
    { idx: 0, name: 'Hook', status: 'PENDING', kind: 'fala', id: 'beat-a', script: [{ type: 'line', text: 'Olá' }] },
  ],
}

function buildData(): VideoData {
  return {
    ideia: {
      pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' },
      en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' },
    },
    roteiro: { pt: ROTEIRO, en: null },
    versions: { pt: undefined, en: undefined } as unknown as VideoData['versions'],
    pillar: undefined,
    durationRange: undefined,
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(),
    hasUnsavedChanges: false, saveAll: vi.fn(), autosaveState: 'saved',
    sections: {}, abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null },
    winnerVariantId: null, savePostprod: vi.fn(), savePublish: vi.fn(),
    advanceToRecorded: vi.fn(), publishVideo: vi.fn(), coworkSubmit: vi.fn(),
  }
}

/** Probe: mounts the sync hook, exposes recStatus, and a button to set a beat status. */
function Probe() {
  useRecordingSync()
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  return (
    <div>
      <span data-testid="status">{state.recStatus['pt:beat-a'] ?? 'none'}</span>
      <button onClick={() => dispatch({ type: 'SET_BEAT_STATUS', key: 'pt:beat-a', status: 'gravada' })}>
        set
      </button>
    </div>
  )
}

function Harness({ children }: { children: ReactNode }) {
  const initial = initialFromDetail({
    itemId: 'vid-1', code: 'V-A01', siteId: 'site-1', stage: 'gravacao', version: 3, primaryLang: 'pt',
  })
  return (
    <VideoEditorProvider initialState={initial}>
      <VideoDataProvider value={buildData()}>{children}</VideoDataProvider>
    </VideoEditorProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadLocal).mockResolvedValue([])
  vi.mocked(putLocal).mockResolvedValue(undefined)
  vi.mocked(applyRemote).mockResolvedValue([])
  vi.mocked(dirtyRows).mockResolvedValue([])
  vi.mocked(persistBeatIds).mockResolvedValue({ ok: true, data: { persisted: false, version: 3 } })
  vi.mocked(saveRecordingBeat).mockResolvedValue({ ok: true, data: { updatedAt: 'now' } })
})

afterEach(() => cleanup())

describe('useRecordingSync', () => {
  it('persists beat-ids once on mount for the active lang with a roteiro', async () => {
    render(<Harness><Probe /></Harness>)
    await waitFor(() => expect(persistBeatIds).toHaveBeenCalledWith('vid-1', 'pt', 3))
  })

  it('hydrates from the server: loadRecording → applyRemote → HYDRATE dispatch updates state', async () => {
    vi.mocked(loadRecording).mockResolvedValue({
      ok: true,
      data: [{ beat_id: 'beat-a', status: 'refazer', retake_note: 'luz', beat_name: 'Hook', content_hash: 'h' }],
    })
    vi.mocked(applyRemote).mockResolvedValue([
      { pipelineId: 'vid-1', lang: 'pt', beatId: 'beat-a', status: 'refazer', retakeNote: 'luz', updatedAt: 0, dirty: false },
    ])

    render(<Harness><Probe /></Harness>)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('refazer'))
    expect(loadRecording).toHaveBeenCalledWith('vid-1', 'pt')
    expect(applyRemote).toHaveBeenCalled()
  })

  it('local-first write: a SET_BEAT_STATUS change fires putLocal(dirty) + the server upsert', async () => {
    vi.mocked(loadRecording).mockResolvedValue({ ok: true, data: [] })
    render(<Harness><Probe /></Harness>)
    // Let hydrate settle so the synced baseline is established first.
    await waitFor(() => expect(loadRecording).toHaveBeenCalled())

    fireEvent.click(screen.getByText('set'))
    expect(screen.getByTestId('status').textContent).toBe('gravada')

    await waitFor(() => {
      expect(putLocal).toHaveBeenCalledWith(expect.objectContaining({
        beatId: 'beat-a', lang: 'pt', status: 'gravada', dirty: true,
      }))
      expect(saveRecordingBeat).toHaveBeenCalledWith('vid-1', 'pt', expect.objectContaining({
        beatId: 'beat-a', status: 'gravada', contentHash: expect.any(String),
      }))
    })
  })
})
