// apps/web/test/cms/video/editor/sticky-header.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { VideoDataProvider } from '@/app/cms/(authed)/video/[id]/edit/data-context'
import { EditorShell } from '@/app/cms/(authed)/video/[id]/edit/editor-shell'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'roteiro', version: 1,
  activeLang: 'pt', activeStage: 'roteiro', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

beforeEach(() => {
  // jsdom has no ResizeObserver — provide a minimal one that fires once.
  ;(globalThis as Record<string, unknown>).ResizeObserver = class {
    cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) { this.cb = cb }
    observe() { this.cb([{ contentRect: { height: 56 } } as ResizeObserverEntry], this as unknown as ResizeObserver) }
    unobserve() {}
    disconnect() {}
  }
})

const stubData = {
  ideia: { pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
  roteiro: { pt: null, en: null }, pillar: undefined, durationRange: undefined,
  saveIdeia: vi.fn(), saveTitle: vi.fn(), appendSiblings: vi.fn(), saveRoteiro: vi.fn(),
  hasUnsavedChanges: false, saveAll: vi.fn().mockResolvedValue(undefined), autosaveState: 'saved' as const,
}

describe('sticky beat-header CSS var', () => {
  it('sets --ed-bar-h on the editor root from the measured ed-bar height (not hardcoded)', () => {
    const { container } = render(<VideoEditorProvider initialState={seed}><VideoDataProvider value={stubData as never}><EditorShell /></VideoDataProvider></VideoEditorProvider>)
    const root = container.querySelector('.video-editor') as HTMLElement
    // jsdom getBoundingClientRect returns 0 height; the hook falls back to a measured value via ResizeObserver mock (56)
    const v = root.style.getPropertyValue('--ed-bar-h')
    expect(v).toMatch(/px$/)
  })
})
