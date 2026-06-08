import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { VideoEditorClient } from '@/app/cms/(authed)/video/[id]/edit/editor-client'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

vi.mock('@/app/cms/(authed)/video/[id]/edit/use-video-section', () => ({
  useVideoSection: () => ({
    content: { title: '' }, rev: 0, isDirty: false, isSaving: false, isEditing: false,
    conflict: null, setContent: vi.fn(), setIsEditing: vi.fn(), save: vi.fn(),
    acceptRemote: vi.fn(), keepLocal: vi.fn(), dismissConflict: vi.fn(),
    source: null, edited: false, coworkRev: null, updatedAt: null,
  }),
}))

const initialState: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 1,
  activeLang: 'pt', activeStage: 'ideia', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

describe('VideoEditorClient', () => {
  it('mounts the editor shell with the ed-bar and ideia canvas', async () => {
    const { container } = render(
      <VideoEditorClient
        initialState={initialState}
        initial={{
          ideia: { pt: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' }, en: { title: '', direction: '', siblings: [], logline: '', angles: '', framework: '' } },
          roteiro: { pt: null, en: null },
          pillar: undefined, durationRange: undefined,
        }}
      />,
    )
    expect(container.querySelector('.ed-bar')).toBeTruthy()
    // The ideia canvas is lazy-loaded inside a Suspense boundary; await its resolution.
    await waitFor(() => expect(container.querySelector('.vi-canvas')).toBeTruthy())
  })
})
