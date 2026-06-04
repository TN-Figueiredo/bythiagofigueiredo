import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  EditorProvider,
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '@/app/cms/(authed)/blog/[id]/editor/context'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Helper                                                            */
/* ------------------------------------------------------------------ */

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
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
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  useEditorState                                                    */
/* ------------------------------------------------------------------ */

describe('useEditorState', () => {
  it('returns state from provider', () => {
    const state = makeState()
    const { result } = renderHook(() => useEditorState(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })
    expect(result.current.postId).toBe('p1')
    expect(result.current.activeLang).toBe('pt')
    expect(result.current.activeStage).toBe('rascunho')
  })

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useEditorState())
    }).toThrow()
  })
})

/* ------------------------------------------------------------------ */
/*  useEditorDispatch                                                 */
/* ------------------------------------------------------------------ */

describe('useEditorDispatch', () => {
  it('returns a function', () => {
    const state = makeState()
    const { result } = renderHook(() => useEditorDispatch(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })
    expect(typeof result.current).toBe('function')
  })

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useEditorDispatch())
    }).toThrow()
  })
})

/* ------------------------------------------------------------------ */
/*  Dispatch integration                                              */
/* ------------------------------------------------------------------ */

describe('Dispatch integration', () => {
  it('dispatching SET_TITLE updates state', () => {
    const state = makeState()
    const { result } = renderHook(
      () => ({ state: useEditorState(), dispatch: useEditorDispatch() }),
      {
        wrapper: ({ children }) => (
          <EditorProvider initialState={state}>{children}</EditorProvider>
        ),
      },
    )

    act(() => {
      result.current.dispatch({ type: 'SET_TITLE', title: 'New Title' })
    })

    expect(result.current.state.content.pt?.title).toBe('New Title')
  })

  it('dispatch ref is stable across re-renders', () => {
    const state = makeState()
    const { result, rerender } = renderHook(() => useEditorDispatch(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

/* ------------------------------------------------------------------ */
/*  useEditorVersion                                                  */
/* ------------------------------------------------------------------ */

describe('useEditorVersion', () => {
  it('returns active language version', () => {
    const state = makeState()
    const { result } = renderHook(() => useEditorVersion(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })
    expect(result.current).not.toBeNull()
    expect(result.current?.fresh).toBe(false)
  })

  it('returns null for non-existent version', () => {
    const state = makeState({ activeLang: 'en', content: { pt: { ...EMPTY_VERSION, fresh: false } } })
    const { result } = renderHook(() => useEditorVersion(), {
      wrapper: ({ children }) => (
        <EditorProvider initialState={state}>{children}</EditorProvider>
      ),
    })
    expect(result.current).toBeNull()
  })
})
