import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Mock context — avoid full reducer setup                           */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()

const baseState: EditorState = {
  postId: 'test-post-1',
  code: 'TEST01',
  siteId: 'site-1',
  siteTimezone: 'America/Sao_Paulo',
  activeStage: 'rascunho',
  activeLang: 'pt',
  focus: false,
  content: {
    pt: {
      title: '',
      slug: '',
      slugTouched: false,
      excerpt: '',
      body: null,
      bodyHtml: '',
      published: false,
      publishedAt: null,
      updatedAt: null,
      dirty: false,
      fresh: true,
      coverImageUrl: null,
      coverReady: false,
      metaTitle: '',
      metaDesc: '',
      ogImageUrl: null,
      words: 0,
      readTime: 0,
      titleAlts: [],
    },
  },
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
}

let mockState: EditorState = { ...baseState }

vi.mock('@/app/cms/(authed)/blog/[id]/editor/context', () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => null,
  useAutosaveState: () => ({ state: 'idle', hasUnsavedChanges: false }),
}))

/* ------------------------------------------------------------------ */
/*  Mock sub-components — avoid deep rendering                        */
/* ------------------------------------------------------------------ */

vi.mock('@/app/cms/(authed)/blog/[id]/editor/action-bar', () => ({
  ActionBar: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="action-bar">{children}</div>
  ),
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/lang-toggle', () => ({
  LangToggle: () => <div data-testid="lang-toggle">LangToggle</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/stage-bar', () => ({
  StageBar: () => <div data-testid="stage-bar">StageBar</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/inspector/inspector', () => ({
  Inspector: () => <div data-testid="inspector">Inspector</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/stages/stage-ideia', () => ({
  StageIdeia: () => <div data-testid="stage-ideia">StageIdeia</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/stages/stage-rascunho', () => ({
  StageRascunho: () => <div data-testid="stage-rascunho">StageRascunho</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/stages/stage-imagens', () => ({
  StageImagens: () => <div data-testid="stage-imagens">StageImagens</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/stages/stage-seo', () => ({
  StageSeo: () => <div data-testid="stage-seo">StageSeo</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/editor/stages/stage-publicacao', () => ({
  StagePublicacao: () => <div data-testid="stage-publicacao">StagePublicacao</div>,
}))

vi.mock('@/app/cms/(authed)/_shared/editor/navigation-guard', () => ({
  NavigationGuard: ({ hasUnsavedChanges }: { hasUnsavedChanges: boolean }) => (
    <div data-testid="navigation-guard" data-unsaved={String(hasUnsavedChanges)} />
  ),
}))

/* ------------------------------------------------------------------ */
/*  Import after mock                                                 */
/* ------------------------------------------------------------------ */

import { EditorClient } from '@/app/cms/(authed)/blog/[id]/editor/editor-client'

describe('EditorClient (shell)', () => {
  beforeEach(() => {
    mockState = { ...baseState, focus: false }
    mockDispatch.mockClear()
  })

  it('renders action-bar, stage-bar, and inspector components', () => {
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('action-bar')).toBeDefined()
    expect(getByTestId('stage-bar')).toBeDefined()
    expect(getByTestId('inspector')).toBeDefined()
  })

  it('renders the active stage component', () => {
    mockState = { ...baseState, activeStage: 'rascunho' }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('stage-rascunho')).toBeDefined()
  })

  it('hides stage-bar when focus is true', () => {
    mockState = { ...baseState, focus: true }
    const { queryByTestId } = render(<EditorClient initialState={mockState} />)
    expect(queryByTestId('stage-bar')).toBeNull()
  })

  it('hides inspector when focus is true', () => {
    mockState = { ...baseState, focus: true }
    const { queryByTestId } = render(<EditorClient initialState={mockState} />)
    expect(queryByTestId('inspector')).toBeNull()
  })

  it('shows focus pill when focus is true', () => {
    mockState = { ...baseState, focus: true }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('focus-pill')).toBeDefined()
  })

  it('hides focus pill when focus is false', () => {
    mockState = { ...baseState, focus: false }
    const { queryByTestId } = render(<EditorClient initialState={mockState} />)
    expect(queryByTestId('focus-pill')).toBeNull()
  })

  it('dispatches TOGGLE_FOCUS when Esc is pressed in focus mode', () => {
    mockState = { ...baseState, focus: true }
    render(<EditorClient initialState={mockState} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_FOCUS' })
  })

  it('does NOT dispatch TOGGLE_FOCUS when Esc is pressed outside focus mode', () => {
    mockState = { ...baseState, focus: false }
    render(<EditorClient initialState={mockState} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('dispatches TOGGLE_FOCUS when focus pill is clicked', () => {
    mockState = { ...baseState, focus: true }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    fireEvent.click(getByTestId('focus-pill'))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_FOCUS' })
  })

  it('renders different stage component when activeStage changes', () => {
    mockState = { ...baseState, activeStage: 'seo' }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('stage-seo')).toBeDefined()
  })
})
