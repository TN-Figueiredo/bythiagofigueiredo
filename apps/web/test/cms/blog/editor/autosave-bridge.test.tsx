import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/edit/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/edit/types'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const mockScheduleSave = vi.fn()
const mockSaveNow = vi.fn()

vi.mock('@/app/cms/(authed)/_shared/editor/use-autosave', () => ({
  useAutosave: vi.fn(() => ({
    state: 'idle',
    lastSavedAt: null,
    hasUnsavedChanges: false,
    scheduleSave: mockScheduleSave,
    saveNow: mockSaveNow,
    forceSave: vi.fn().mockResolvedValue({ ok: true }),
    setHasUnsavedChanges: vi.fn(),
    needsConfirmation: false,
    confirmSave: vi.fn(),
    cancelSave: vi.fn(),
    mode: 'auto',
  })),
}))

/* Import after mock so the mock is in place */
import {
  EditorProvider,
  useEditorState,
  useEditorDispatch,
  useAutosaveState,
  buildSnapshot,
  buildSavePayload,
} from '@/app/cms/(authed)/blog/[id]/edit/context'
import { useAutosave } from '@/app/cms/(authed)/_shared/editor/use-autosave'

/* ------------------------------------------------------------------ */
/*  Helper                                                            */
/* ------------------------------------------------------------------ */

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    inspectorOpen: false,
    categories: [],
    content: {
      pt: {
        ...EMPTY_VERSION,
        title: 'Test Post',
        slug: 'test-post',
        excerpt: 'An excerpt',
        bodyHtml: '<p>Hello</p>',
        metaTitle: 'Meta Title',
        metaDesc: 'Meta desc',
        ogImageUrl: 'https://example.com/og.png',
        coverImageUrl: 'https://example.com/cover.png',
        fresh: false,
      },
    },
    shared: {
      status: 'draft',
      category: '',
      tagId: 'tag-1',
      tags: [],
      hashtags: [{ id: 'h1', name: 'tech', slug: 'tech' }],
      hook: '',
      synopsis: '',
      plevel: null,
      previousPostId: 'prev-1',
      continuesInNext: true,
      keyPoints: ['point1', 'point2'],
      pullQuote: 'a quote',
      notes: ['note1'],
      colophon: 'colophon text',
      history: [],
    },
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  buildSnapshot                                                     */
/* ------------------------------------------------------------------ */

describe('buildSnapshot', () => {
  it('extracts correct fields from state', () => {
    const state = makeState()
    const snap = buildSnapshot(state)

    expect(snap.title).toBe('Test Post')
    expect(snap.slug).toBe('test-post')
    expect(snap.excerpt).toBe('An excerpt')
    expect(snap.contentHtml).toBe('<p>Hello</p>')
    expect(snap.contentJson).toBeNull() // EMPTY_VERSION body is null
    expect(snap.coverImageUrl).toBe('https://example.com/cover.png')
    expect(snap.metaTitle).toBe('Meta Title')
    expect(snap.metaDescription).toBe('Meta desc')
    expect(snap.ogImageUrl).toBe('https://example.com/og.png')
    expect(snap.selectedTagId).toBe('tag-1')
    expect(snap.keyPoints).toEqual(['point1', 'point2'])
    expect(snap.pullQuote).toBe('a quote')
    expect(snap.notes).toEqual(['note1'])
    expect(snap.colophon).toBe('colophon text')
    expect(snap.previousPostId).toBe('prev-1')
    expect(snap.continuesInNext).toBe(true)
    expect(snap.hashtags).toEqual([{ id: 'h1', name: 'tech', slug: 'tech' }])
  })

  it('returns defaults when active language version is missing', () => {
    const state = makeState({ activeLang: 'en', content: {} })
    const snap = buildSnapshot(state)

    expect(snap.title).toBe('')
    expect(snap.slug).toBe('')
    expect(snap.contentHtml).toBe('')
    expect(snap.contentJson).toBeNull()
    expect(snap.coverImageUrl).toBeNull()
    expect(snap.metaTitle).toBe('')
    expect(snap.metaDescription).toBe('')
    expect(snap.ogImageUrl).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  buildSavePayload                                                  */
/* ------------------------------------------------------------------ */

describe('buildSavePayload', () => {
  it('transforms snapshot to save format', () => {
    const snap = buildSnapshot(makeState())
    const payload = buildSavePayload(snap)

    expect(payload.title).toBe('Test Post')
    expect(payload.slug).toBe('test-post')
    expect(payload.content_mdx).toBe('<p>Hello</p>')
    expect(payload.content_html).toBe('<p>Hello</p>')
    expect(payload.content_json).toBeNull()
    expect(payload.excerpt).toBe('An excerpt')
    expect(payload.meta_title).toBe('Meta Title')
    expect(payload.meta_description).toBe('Meta desc')
    expect(payload.og_image_url).toBe('https://example.com/og.png')
    expect(payload.cover_image_url).toBe('https://example.com/cover.png')
    expect(payload.tag_id).toBe('tag-1')
    expect(payload.key_points).toEqual(['point1', 'point2'])
    expect(payload.pull_quote).toBe('a quote')
    expect(payload.notes).toEqual(['note1'])
    expect(payload.colophon).toBe('colophon text')
    expect(payload.previous_post_id).toBe('prev-1')
    expect(payload.continues_in_next).toBe(true)
    expect(payload.hashtag_ids).toEqual(['h1'])
  })

  it('filters empty strings from key_points and notes', () => {
    const state = makeState()
    state.shared.keyPoints = ['valid', '', 'also-valid']
    state.shared.notes = ['', 'note']
    const snap = buildSnapshot(state)
    const payload = buildSavePayload(snap)

    expect(payload.key_points).toEqual(['valid', 'also-valid'])
    expect(payload.notes).toEqual(['note'])
  })

  it('sets empty excerpt to undefined', () => {
    const state = makeState()
    state.content.pt = { ...state.content.pt!, excerpt: '' }
    const snap = buildSnapshot(state)
    const payload = buildSavePayload(snap)

    expect(payload.excerpt).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */
/*  dispatchAndSave                                                   */
/* ------------------------------------------------------------------ */

describe('dispatchAndSave (via useEditorDispatch)', () => {
  beforeEach(() => {
    mockScheduleSave.mockClear()
    mockSaveNow.mockClear()
    vi.mocked(useAutosave).mockClear()
  })

  it('calls both dispatch and scheduleSave', () => {
    const state = makeState()
    const { result } = renderHook(
      () => ({
        state: useEditorState(),
        dispatch: useEditorDispatch(),
      }),
      {
        wrapper: ({ children }) => (
          <EditorProvider initialState={state}>{children}</EditorProvider>
        ),
      },
    )

    act(() => {
      result.current.dispatch({ type: 'SET_TITLE', title: 'Updated' })
    })

    expect(mockScheduleSave).toHaveBeenCalledTimes(1)
    const call = mockScheduleSave.mock.calls[0][0]
    expect(call.title).toBeDefined()
    expect(call.slug).toBeDefined()
  })

  it('does not call scheduleSave when postId is null', () => {
    const state = makeState({ postId: null })
    const { result } = renderHook(
      () => ({
        dispatch: useEditorDispatch(),
      }),
      {
        wrapper: ({ children }) => (
          <EditorProvider initialState={state}>{children}</EditorProvider>
        ),
      },
    )

    act(() => {
      result.current.dispatch({ type: 'SET_TITLE', title: 'No save' })
    })

    expect(mockScheduleSave).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */
/*  Autosave disabled when postId is null                             */
/* ------------------------------------------------------------------ */

describe('autosave disabled when postId is null', () => {
  beforeEach(() => {
    vi.mocked(useAutosave).mockClear()
  })

  it('passes enabled=false when postId is null', () => {
    const state = makeState({ postId: null })
    renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, editionId: null }),
    )
  })

  it('passes enabled=true when postId exists', () => {
    const state = makeState({ postId: 'p1' })
    renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, editionId: 'p1' }),
    )
  })
})

/* ------------------------------------------------------------------ */
/*  useAutosaveState                                                  */
/* ------------------------------------------------------------------ */

describe('useAutosaveState', () => {
  it('returns autosave context values', () => {
    const state = makeState()
    const { result } = renderHook(() => useAutosaveState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useAutosaveState())
    }).toThrow('useAutosaveState must be used within an EditorProvider')
  })
})

/* ------------------------------------------------------------------ */
/*  Save mode derivation                                              */
/* ------------------------------------------------------------------ */

describe('save mode derivation', () => {
  beforeEach(() => {
    vi.mocked(useAutosave).mockClear()
  })

  it('uses auto mode for draft status', () => {
    const state = makeState()
    state.shared.status = 'draft'
    renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'auto' }),
    )
  })

  it('uses auto mode for idea status', () => {
    const state = makeState()
    state.shared.status = 'idea'
    renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'auto' }),
    )
  })

  it('uses guarded mode for published status', () => {
    const state = makeState()
    state.shared.status = 'published'
    renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'guarded' }),
    )
  })

  it('uses manual mode for other statuses', () => {
    const state = makeState()
    state.shared.status = 'ready'
    renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })

    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'manual' }),
    )
  })
})
