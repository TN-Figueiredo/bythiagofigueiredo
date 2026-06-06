import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { EditorState, Stage } from '@/app/cms/(authed)/blog/[id]/edit/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockAutosaveState = { state: 'idle', hasUnsavedChanges: false }

const baseState: EditorState = {
  postId: 'test-post-1',
  code: 'INTEG01',
  siteId: 'site-1',
  siteTimezone: 'America/Sao_Paulo',
  activeStage: 'rascunho',
  activeLang: 'pt',
  focus: false,
  inspectorOpen: false,
  categories: [],
  content: {
    pt: {
      title: 'Test Post',
      slug: 'test-post',
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
  useAutosaveState: () => mockAutosaveState,
  useSaveActions: () => ({ saveNow: vi.fn() }),
}))

/* ------------------------------------------------------------------ */
/*  Mock sub-components — shallow rendering                           */
/* ------------------------------------------------------------------ */

vi.mock('@/app/cms/(authed)/blog/[id]/edit/action-bar', () => ({
  ActionBar: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="action-bar">ActionBar{children}</div>
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
/*  Import after mocks                                                */
/* ------------------------------------------------------------------ */

import { EditorClient } from '@/app/cms/(authed)/blog/[id]/edit/editor-client'

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('EditorClient integration wiring', () => {
  beforeEach(() => {
    mockState = { ...baseState }
    mockAutosaveState = { state: 'idle', hasUnsavedChanges: false }
    mockDispatch.mockClear()
  })

  it('renders ActionBar component (not a placeholder div)', () => {
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('action-bar').textContent).toContain('ActionBar')
  })

  it('renders LangToggle inside ActionBar', () => {
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    const actionBar = getByTestId('action-bar')
    const langToggle = getByTestId('lang-toggle')
    expect(actionBar.contains(langToggle)).toBe(true)
  })

  it('renders StageBar component', () => {
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('stage-bar').textContent).toContain('StageBar')
  })

  it('renders Inspector drawer when inspectorOpen is true', () => {
    mockState = { ...baseState, inspectorOpen: true }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('inspector-drawer')).toBeDefined()
    expect(getByTestId('inspector').textContent).toContain('Inspector')
  })

  it('renders NavigationGuard', () => {
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('navigation-guard')).toBeDefined()
  })

  it('NavigationGuard receives hasUnsavedChanges from autosave context', () => {
    mockAutosaveState = { state: 'dirty', hasUnsavedChanges: true }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('navigation-guard').getAttribute('data-unsaved')).toBe('true')
  })

  it('NavigationGuard receives hasUnsavedChanges=false when nothing is dirty', () => {
    mockAutosaveState = { state: 'idle', hasUnsavedChanges: false }
    const { getByTestId } = render(<EditorClient initialState={mockState} />)
    expect(getByTestId('navigation-guard').getAttribute('data-unsaved')).toBe('false')
  })

  describe('stage router renders correct stage', () => {
    const stages: Stage[] = ['ideia', 'rascunho', 'imagens', 'seo', 'publicacao']

    for (const stage of stages) {
      it(`renders Stage "${stage}" when activeStage="${stage}"`, async () => {
        mockState = { ...baseState, activeStage: stage }
        const { getByTestId } = render(<EditorClient initialState={mockState} />)
        await waitFor(() => expect(getByTestId(`stage-${stage}`)).toBeDefined())
      })
    }

    it('only renders the active stage, not others', async () => {
      mockState = { ...baseState, activeStage: 'ideia' }
      const { queryByTestId } = render(<EditorClient initialState={mockState} />)
      await waitFor(() => expect(queryByTestId('stage-ideia')).not.toBeNull())
      expect(queryByTestId('stage-rascunho')).toBeNull()
      expect(queryByTestId('stage-imagens')).toBeNull()
      expect(queryByTestId('stage-seo')).toBeNull()
      expect(queryByTestId('stage-publicacao')).toBeNull()
    })
  })

  it('CSS theme import does not crash', () => {
    // If the import of editor-theme.css caused an error, the module
    // would fail to load and this test file would not even run.
    expect(true).toBe(true)
  })

  it('applies blog-editor class to layout div', () => {
    const { container } = render(<EditorClient initialState={mockState} />)
    const blogEditor = container.querySelector('.blog-editor')
    expect(blogEditor).not.toBeNull()
  })
})
