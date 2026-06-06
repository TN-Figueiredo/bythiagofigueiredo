import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/edit/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/edit/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState
let mockVersion: VersionContent

vi.mock('@/app/cms/(authed)/blog/[id]/edit/context', () => ({
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => mockVersion,
}))

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeShared() {
  return {
    status: 'draft' as const,
    category: 'Tecnologia',
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
  }
}

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return {
    ...EMPTY_VERSION,
    fresh: false,
    title: 'Meu Post de Teste',
    words: 1500,
    readTime: 7,
    ...overrides,
  }
}

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
    content: { pt: makeVersion() },
    shared: makeShared(),
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadStageRascunho() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/edit/stages/stage-rascunho'
  )
  return mod.StageRascunho
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('StageRascunho', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockVersion = makeVersion()
    mockState = makeState({ content: { pt: mockVersion } })
  })

  it('renders title textarea with current title value', async () => {
    const StageRascunho = await loadStageRascunho()
    render(<StageRascunho />)

    const titleEl = screen.getByTestId('doc-title')
    expect(titleEl).toBeDefined()
    expect((titleEl as HTMLTextAreaElement).value).toBe('Meu Post de Teste')
  })

  it('title change dispatches SET_TITLE', async () => {
    const StageRascunho = await loadStageRascunho()
    render(<StageRascunho />)

    const titleEl = screen.getByTestId('doc-title')
    fireEvent.change(titleEl, { target: { value: 'Novo Titulo' } })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TITLE',
      title: 'Novo Titulo',
    })
  })

  it('meta line shows category name', async () => {
    const StageRascunho = await loadStageRascunho()
    render(<StageRascunho />)

    const meta = screen.getByTestId('doc-meta')
    expect(meta.textContent).toContain('Tecnologia')
  })

  it('meta line shows read time', async () => {
    const StageRascunho = await loadStageRascunho()
    render(<StageRascunho />)

    const meta = screen.getByTestId('doc-meta')
    expect(meta.textContent).toContain('7 min')
  })

  it('meta line shows word count', async () => {
    const StageRascunho = await loadStageRascunho()
    render(<StageRascunho />)

    const meta = screen.getByTestId('doc-meta')
    expect(meta.textContent).toContain('1.500 palavras')
  })

  it('TipTap slot placeholder is rendered', async () => {
    const StageRascunho = await loadStageRascunho()
    render(<StageRascunho />)

    expect(screen.getByTestId('tiptap-slot')).toBeDefined()
  })
})
