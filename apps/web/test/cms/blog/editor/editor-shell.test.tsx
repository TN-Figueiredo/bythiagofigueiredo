import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/edit/types'

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
  inspectorOpen: false,
  categories: [],
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
    coverPrompt: '',
    history: [],
  },
  saveStatus: 'idle',
  scrollToImageId: null,
}

let mockState: EditorState = { ...baseState }

vi.mock('@/app/cms/(authed)/blog/[id]/edit/context', () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => null,
  useAutosaveState: () => ({ state: 'idle', hasUnsavedChanges: false }),
  useSaveActions: () => ({ saveNow: vi.fn() }),
}))

/* ------------------------------------------------------------------ */
/*  Mock sub-components — avoid deep rendering                        */
/* ------------------------------------------------------------------ */

vi.mock('@/app/cms/(authed)/blog/[id]/edit/action-bar', () => ({
  ActionBar: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="action-bar">{children}</div>
  ),
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/lang-toggle', () => ({
  LangToggle: () => <div data-testid="lang-toggle">LangToggle</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/stage-bar', () => ({
  StageBar: () => <div data-testid="stage-bar">StageBar</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/inspector/inspector', () => ({
  Inspector: () => <div data-testid="inspector">Inspector</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/stages/stage-ideia', () => ({
  StageIdeia: () => <div data-testid="stage-ideia">StageIdeia</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/stages/stage-rascunho', () => ({
  StageRascunho: () => <div data-testid="stage-rascunho">StageRascunho</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/stages/stage-imagens', () => ({
  StageImagens: () => <div data-testid="stage-imagens">StageImagens</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/stages/stage-seo', () => ({
  StageSeo: () => <div data-testid="stage-seo">StageSeo</div>,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/stages/stage-publicacao', () => ({
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

import { EditorClient } from '@/app/cms/(authed)/blog/[id]/edit/editor-client'

describe('EditorClient (shell)', () => {
  beforeEach(() => {
    mockState = { ...baseState, focus: false }
    mockDispatch.mockClear()
  })

  it('renders action-bar and stage-bar', () => {
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('action-bar')).toBeDefined()
    expect(getByTestId('stage-bar')).toBeDefined()
  })

  it('renders inspector drawer when inspectorOpen is true', () => {
    mockState = { ...baseState, inspectorOpen: true }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('inspector-drawer')).toBeDefined()
    expect(getByTestId('inspector')).toBeDefined()
  })

  it('hides inspector drawer when inspectorOpen is false', () => {
    mockState = { ...baseState, inspectorOpen: false }
    const { queryByTestId } = render(<EditorClient initialState={mockState} />)
    expect(queryByTestId('inspector-drawer')).toBeNull()
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

  it('Esc closes inspector first when both inspector and focus are active', () => {
    mockState = { ...baseState, focus: true, inspectorOpen: true }
    render(<EditorClient initialState={mockState} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_INSPECTOR' })
    expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'TOGGLE_FOCUS' })
  })

  it('Esc exits focus when inspector is closed', () => {
    mockState = { ...baseState, focus: true, inspectorOpen: false }
    render(<EditorClient initialState={mockState} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_FOCUS' })
  })

  it('Esc does nothing when both inspector and focus are inactive', () => {
    mockState = { ...baseState, focus: false, inspectorOpen: false }
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

  it('renders different stage component when activeStage changes', async () => {
    mockState = { ...baseState, activeStage: 'seo' }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    await waitFor(() => expect(getByTestId('stage-seo')).toBeDefined())
  })
})
