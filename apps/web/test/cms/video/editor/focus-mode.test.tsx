// apps/web/test/cms/video/editor/focus-mode.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const make = (over: Partial<VideoEditorState> = {}): VideoEditorState => ({
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'gravacao', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false, ...over,
})

const emptyVer = { title: '', direction: '', siblings: [], logline: '', pillar: undefined, angles: '', framework: '', duration: '', location: '', recorded: '—', beats: [] }
const stubData = {
  ideia: { pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
  roteiro: { pt: null, en: null }, versions: { pt: emptyVer, en: emptyVer }, pillar: undefined, durationRange: undefined,
  saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(),
  hasUnsavedChanges: false, saveAll: vi.fn().mockResolvedValue(undefined), autosaveState: 'saved' as const,
}

function shell(state: VideoEditorState) {
  return render(<VideoEditorProvider initialState={state}><VideoDataProvider value={stubData as never}><EditorShell /></VideoDataProvider></VideoEditorProvider>)
}

describe('Focus mode', () => {
  it('shows .ed-stages when not in focus; hides them in focus', () => {
    const { container, getByTitle } = shell(make())
    expect(container.querySelector('.ed-stages')).toBeTruthy()
    fireEvent.click(getByTitle('Modo foco (Esc)'))
    expect(container.querySelector('.ed-stages')).toBeNull()
  })
  it('shows the persistent .focus-exit with the exact copy in focus', () => {
    const { container, getByTitle } = shell(make())
    expect(container.querySelector('.focus-exit')).toBeNull()
    fireEvent.click(getByTitle('Modo foco (Esc)'))
    const exit = container.querySelector('.focus-exit')!
    expect(exit.textContent).toContain('Modo foco')
    expect(exit.textContent).toContain('clique para sair')
    expect(exit.textContent).toContain('esc')
  })
  it('Esc exits focus', () => {
    const { container, getByTitle } = shell(make())
    fireEvent.click(getByTitle('Modo foco (Esc)'))
    expect(container.querySelector('.focus-exit')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('.focus-exit')).toBeNull()
    expect(container.querySelector('.ed-stages')).toBeTruthy()
  })
  it('hides the published robanner in focus, shows it otherwise', () => {
    const { container, getByTitle } = shell(make({ stage: 'published', activeStage: 'publicacao' }))
    expect(container.querySelector('.vid-robanner')).toBeTruthy()
    fireEvent.click(getByTitle('Modo foco (Esc)'))
    expect(container.querySelector('.vid-robanner')).toBeNull()
  })
})
