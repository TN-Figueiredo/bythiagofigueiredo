import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('@/app/cms/(authed)/_shared/editor/use-autosave', () => ({
  useAutosave: vi.fn(() => ({
    state: 'idle',
    lastSavedAt: null,
    hasUnsavedChanges: false,
    scheduleSave: vi.fn(),
    saveNow: vi.fn(),
    forceSave: vi.fn().mockResolvedValue({ ok: true }),
    setHasUnsavedChanges: vi.fn(),
    needsConfirmation: false,
    confirmSave: vi.fn(),
    cancelSave: vi.fn(),
    mode: 'auto',
  })),
}))

import {
  EditorProvider,
  useEditorState,
  useEphemeral,
} from '@/app/cms/(authed)/blog/[id]/editor/context'
import { useAutosave } from '@/app/cms/(authed)/_shared/editor/use-autosave'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: null,
    code: '',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'ideia',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, title: 'Meu Post', fresh: true } },
    shared: {
      status: 'draft',
      category: '',
      tagId: null,
      tags: [],
      hashtags: [],
      hook: '',
      synopsis: '',
      plevel: null,
      previousPostId: null,
      continuesInNext: false,
      keyPoints: [],
      pullQuote: '',
      notes: [],
      colophon: '',
      history: [],
    },
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('Ephemeral post flow', () => {
  let mockCreatePost: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatePost = vi.fn().mockResolvedValue({ ok: true, postId: 'new-post-id' })
  })

  /* ---- isEphemeral flag ---- */

  it('isEphemeral is true when postId is null', () => {
    const state = makeState({ postId: null })
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })
    expect(result.current.isEphemeral).toBe(true)
  })

  it('isEphemeral is false when postId exists', () => {
    const state = makeState({ postId: 'existing-id' })
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })
    expect(result.current.isEphemeral).toBe(false)
  })

  /* ---- ensurePostCreated ---- */

  it('ensurePostCreated calls createPostAction with title and locale', async () => {
    const state = makeState()
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })

    let postId: string | null = null
    await act(async () => {
      postId = await result.current.ensurePostCreated()
    })

    expect(mockCreatePost).toHaveBeenCalledOnce()
    expect(mockCreatePost).toHaveBeenCalledWith({
      title: 'Meu Post',
      locale: 'pt-BR',
      status: 'draft',
    })
    expect(postId).toBe('new-post-id')
  })

  it('ensurePostCreated dispatches SET_POST_ID on success', async () => {
    const state = makeState()
    const { result } = renderHook(
      () => ({ ephemeral: useEphemeral(), state: useEditorState() }),
      {
        wrapper: ({ children }) => (
          <EditorProvider initialState={state} createPostAction={mockCreatePost}>
            {children}
          </EditorProvider>
        ),
      },
    )

    expect(result.current.state.postId).toBeNull()

    await act(async () => {
      await result.current.ephemeral.ensurePostCreated()
    })

    expect(result.current.state.postId).toBe('new-post-id')
  })

  it('ensurePostCreated returns null when title is empty', async () => {
    const state = makeState({
      content: { pt: { ...EMPTY_VERSION, title: '', fresh: true } },
    })
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })

    let postId: string | null = null
    await act(async () => {
      postId = await result.current.ensurePostCreated()
    })

    expect(mockCreatePost).not.toHaveBeenCalled()
    expect(postId).toBeNull()
  })

  it('ensurePostCreated returns null when title is whitespace only', async () => {
    const state = makeState({
      content: { pt: { ...EMPTY_VERSION, title: '   ', fresh: true } },
    })
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })

    let postId: string | null = null
    await act(async () => {
      postId = await result.current.ensurePostCreated()
    })

    expect(mockCreatePost).not.toHaveBeenCalled()
    expect(postId).toBeNull()
  })

  it('ensurePostCreated deduplicates concurrent calls', async () => {
    // Use a deferred promise so we can control when createPostAction resolves
    let resolveCreate!: (value: { ok: true; postId: string }) => void
    const slowCreatePost = vi.fn(
      () => new Promise<{ ok: true; postId: string }>((resolve) => {
        resolveCreate = resolve
      }),
    )

    const state = makeState()
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={slowCreatePost}>
          {children}
        </EditorProvider>
      ),
    })

    let promise1: Promise<string | null>
    let promise2: Promise<string | null>

    act(() => {
      promise1 = result.current.ensurePostCreated()
      promise2 = result.current.ensurePostCreated()
    })

    // Both calls should return the same promise — only one createPostAction call
    expect(slowCreatePost).toHaveBeenCalledOnce()

    // Resolve the deferred promise
    await act(async () => {
      resolveCreate({ ok: true, postId: 'deduped-id' })
      await promise1!
      await promise2!
    })

    const [r1, r2] = await Promise.all([promise1!, promise2!])
    expect(r1).toBe('deduped-id')
    expect(r2).toBe('deduped-id')
  })

  it('ensurePostCreated returns existing postId if already set', async () => {
    const state = makeState({ postId: 'already-exists' })
    const { result } = renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })

    let postId: string | null = null
    await act(async () => {
      postId = await result.current.ensurePostCreated()
    })

    expect(mockCreatePost).not.toHaveBeenCalled()
    expect(postId).toBe('already-exists')
  })

  /* ---- Autosave disabled when ephemeral ---- */

  it('autosave is disabled (enabled=false) when ephemeral', () => {
    const state = makeState({ postId: null })
    renderHook(() => useEphemeral(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state} createPostAction={mockCreatePost}>
          {children}
        </EditorProvider>
      ),
    })

    // useAutosave should have been called with enabled: false when postId is null
    expect(useAutosave).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  /* ---- useEphemeral outside provider ---- */

  it('useEphemeral throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useEphemeral())
    }).toThrow('useEphemeral must be used within an EditorProvider')
  })
})
