// apps/web/test/cms/video/editor/autosave-wiring.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 1,
  activeLang: 'pt', activeStage: 'ideia', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

function shell(saveAll = vi.fn().mockResolvedValue(undefined), hasUnsaved = false) {
  const data = {
    ideia: { pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
    roteiro: { pt: null, en: null }, pillar: undefined, durationRange: undefined,
    saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(),
    hasUnsavedChanges: hasUnsaved, saveAll, autosaveState: 'saved' as const,
  }
  return { saveAll, ...render(<VideoEditorProvider initialState={seed}><VideoDataProvider value={data as never}><EditorShell /></VideoDataProvider></VideoEditorProvider>) }
}

describe('autosave wiring', () => {
  it('renders the SR live-region for autosave status', () => {
    const { container } = shell()
    expect(container.querySelector('[role="status"][aria-live="polite"]')).toBeTruthy()
  })
  it('⌘S triggers saveAll', () => {
    const { saveAll } = shell()
    fireEvent.keyDown(document, { key: 's', metaKey: true })
    expect(saveAll).toHaveBeenCalled()
  })
})
