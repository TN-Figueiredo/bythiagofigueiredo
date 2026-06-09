// apps/web/test/cms/video/editor/edit-mode.test.tsx
//
// Core View/Edit safety contract: the editMode reducer field, the derived content lock,
// the `useCanEditContent()` / `useEditMode()` hooks the stage agents consume, the header
// toggle + published-lock retreat, and the autosave pause guarantee.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act, waitFor } from '@testing-library/react'

const retreatPipelineItem = vi.fn()
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  retreatPipelineItem: (...args: unknown[]) => retreatPipelineItem(...args),
}))

import {
  VideoEditorProvider,
  useCanEditContent,
  useEditMode,
} from '@/app/cms/(authed)/video/[id]/edit/context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import { AutosaveGate, useAutosaveGateRef } from '@/app/cms/(authed)/video/[id]/edit/use-autosave'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { isContentLockedStage } from '@/app/cms/(authed)/video/[id]/edit/types'
import type { VideoEditorState, EditMode } from '@/app/cms/(authed)/video/[id]/edit/types'

function seedOf(over: Partial<VideoEditorState> = {}): VideoEditorState {
  return {
    itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 3,
    primaryLang: 'pt', activeLang: 'pt', activeStage: 'ideia', editMode: 'view',
    focus: false, notes: false, showRecStatus: false, markGran: 'off',
    recStatus: {}, retakeNotes: {}, recRecordedHash: {},
    recordingOpen: false, handoffOpen: false, coworkOpen: false, ...over,
  }
}

const emptyVer = { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] }
function stubData(over: Record<string, unknown> = {}) {
  return {
    ideia: { pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
    roteiro: { pt: null, en: null }, versions: { pt: emptyVer, en: emptyVer }, pillar: undefined, durationRange: undefined,
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(),
    hasUnsavedChanges: false, saveAll: vi.fn().mockResolvedValue(undefined), autosaveState: 'saved' as const,
    sections: {}, abJoinFacts: { youtubeVideoId: null, thumbnailHqUrl: null, durationSeconds: null }, winnerVariantId: null,
    savePostprod: vi.fn(), savePublish: vi.fn(),
    advanceToRecorded: vi.fn(), publishVideo: vi.fn(), coworkSubmit: vi.fn(),
    ...over,
  }
}

// Captures hook output for assertions.
let captured: { canEdit: boolean; mode: EditMode; locked: boolean; setMode: (m: EditMode) => void } | null = null
function Probe() {
  const canEdit = useCanEditContent()
  const api = useEditMode()
  captured = { canEdit, mode: api.mode, locked: api.locked, setMode: api.setMode }
  return <div data-testid="can-edit">{String(canEdit)}</div>
}

function withProvider(state: VideoEditorState, node: React.ReactNode) {
  return render(<VideoEditorProvider initialState={state}>{node}</VideoEditorProvider>)
}

function shell(state: VideoEditorState, data = stubData()) {
  return render(
    <VideoEditorProvider initialState={state}>
      <VideoDataProvider value={data as never}><EditorShell /></VideoDataProvider>
    </VideoEditorProvider>,
  )
}

beforeEach(() => {
  retreatPipelineItem.mockReset()
  captured = null
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('isContentLockedStage', () => {
  it('locks scheduled + published, leaves everything else editable', () => {
    expect(isContentLockedStage('scheduled')).toBe(true)
    expect(isContentLockedStage('published')).toBe(true)
    expect(isContentLockedStage('idea')).toBe(false)
    expect(isContentLockedStage('gravacao')).toBe(false)
    expect(isContentLockedStage('roteiro')).toBe(false)
  })
})

describe('useCanEditContent — the stage-gate contract', () => {
  it('false in default view mode', () => {
    withProvider(seedOf(), <Probe />)
    expect(captured!.canEdit).toBe(false)
  })
  it('true once editMode is edit on an unlocked stage', () => {
    withProvider(seedOf({ editMode: 'edit' }), <Probe />)
    expect(captured!.canEdit).toBe(true)
  })
  it('false on a published stage EVEN in edit mode (hard publish lock)', () => {
    withProvider(seedOf({ editMode: 'edit', stage: 'published' }), <Probe />)
    expect(captured!.canEdit).toBe(false)
  })
  it('false on a scheduled stage even in edit mode', () => {
    withProvider(seedOf({ editMode: 'edit', stage: 'scheduled' }), <Probe />)
    expect(captured!.canEdit).toBe(false)
  })
  it('defaults to false when no provider is mounted (robust)', () => {
    render(<Probe />)
    expect(captured!.canEdit).toBe(false)
    expect(captured!.mode).toBe('view')
    expect(captured!.locked).toBe(false)
  })
})

describe('useEditMode — toggle API', () => {
  it('reports locked + canEdit consistently', () => {
    withProvider(seedOf({ editMode: 'edit', stage: 'published' }), <Probe />)
    expect(captured!.locked).toBe(true)
    expect(captured!.canEdit).toBe(false)
  })
  it('setMode flips the live mode through the reducer', () => {
    withProvider(seedOf(), <Probe />)
    expect(captured!.mode).toBe('view')
    act(() => captured!.setMode('edit'))
    expect(captured!.mode).toBe('edit')
    expect(captured!.canEdit).toBe(true)
  })
})

describe('EditModeToggle (header)', () => {
  it('renders the Visualizando toggle by default and flips to Editar on click', () => {
    const { getByRole, container } = shell(seedOf())
    const btn = container.querySelector('.ed-editmode') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('Visualizando')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    const btn2 = container.querySelector('.ed-editmode') as HTMLButtonElement
    expect(btn2.textContent).toContain('Editar')
    expect(btn2.getAttribute('aria-pressed')).toBe('true')
    expect(getByRole).toBeTruthy()
  })
  it('shows the somente-leitura hint in view mode and the editing ring class in edit mode', () => {
    const { container } = shell(seedOf())
    expect(container.querySelector('.vid-viewing')).toBeTruthy()
    expect(container.textContent).toContain('Somente leitura')
    fireEvent.click(container.querySelector('.ed-editmode') as HTMLButtonElement)
    expect(container.querySelector('.vid-editing')).toBeTruthy()
  })
})

describe('Autosave pause gate', () => {
  // Bridge that exposes the live gate ref + a setMode handle, mirroring the editor-client wiring.
  function GateHarness({ onRef }: { onRef: (ref: { current: boolean }) => void }) {
    const ref = useAutosaveGateRef()
    onRef(ref)
    return <AutosaveGate canEditRef={ref} />
  }

  it('keeps the gate ref false in view mode and true after entering edit on an unlocked stage', () => {
    let gateRef: { current: boolean } | null = null
    withProvider(seedOf(), <><GateHarness onRef={(r) => { gateRef = r }} /><Probe /></>)
    expect(gateRef!.current).toBe(false)            // view mode → autosave paused
    act(() => captured!.setMode('edit'))
    expect(gateRef!.current).toBe(true)             // edit mode → autosave allowed
  })

  it('holds the gate ref false on a published stage even in edit mode', () => {
    let gateRef: { current: boolean } | null = null
    withProvider(seedOf({ editMode: 'edit', stage: 'published' }), <GateHarness onRef={(r) => { gateRef = r }} />)
    expect(gateRef!.current).toBe(false)            // published lock → autosave paused
  })
})

describe('Published lock + retreat (despublicar)', () => {
  it('replaces the toggle with the locked affordance when published', () => {
    const { container } = shell(seedOf({ stage: 'published' }))
    expect(container.querySelector('.ed-editmode')).toBeNull()
    const lock = container.querySelector('.ed-editlock') as HTMLButtonElement
    expect(lock).toBeTruthy()
    expect(lock.textContent).toContain('despublicar')
    expect(container.textContent).toContain('Conteúdo travado')
  })

  it('retreats the stage via retreatPipelineItem, updates stage/version, and enters edit mode', async () => {
    retreatPipelineItem.mockResolvedValue({ ok: true, data: { stage: 'scheduled', version: 9 } })
    const { container } = shell(seedOf({ stage: 'published', version: 3 }))
    await act(async () => {
      fireEvent.click(container.querySelector('.ed-editlock') as HTMLButtonElement)
    })
    expect(retreatPipelineItem).toHaveBeenCalledWith('vid-1', 3)
    // scheduled is still locked → after one retreat the lock affordance remains, version bumped.
    await waitFor(() => {
      const lock = container.querySelector('.ed-editlock') as HTMLButtonElement
      expect(lock).toBeTruthy()
    })
  })

  it('after retreating below the lock the editable toggle appears in edit mode', async () => {
    retreatPipelineItem.mockResolvedValue({ ok: true, data: { stage: 'gravacao', version: 9 } })
    const { container } = shell(seedOf({ stage: 'published', version: 3 }))
    await act(async () => {
      fireEvent.click(container.querySelector('.ed-editlock') as HTMLButtonElement)
    })
    await waitFor(() => {
      const toggle = container.querySelector('.ed-editmode') as HTMLButtonElement
      expect(toggle).toBeTruthy()
      expect(toggle.textContent).toContain('Editar') // auto-entered edit mode after despublicar
    })
  })

  it('does not retreat if the user cancels the confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = shell(seedOf({ stage: 'published' }))
    await act(async () => {
      fireEvent.click(container.querySelector('.ed-editlock') as HTMLButtonElement)
    })
    expect(retreatPipelineItem).not.toHaveBeenCalled()
  })
})
