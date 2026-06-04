import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/editor/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState

vi.mock('@/app/cms/(authed)/blog/[id]/editor/context', () => ({
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => mockState.content[mockState.activeLang] ?? null,
}))

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeShared() {
  return {
    status: 'draft' as const,
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
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: makeShared(),
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return { ...EMPTY_VERSION, ...overrides }
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadStageBar() {
  const mod = await import('@/app/cms/(authed)/blog/[id]/editor/stage-bar')
  return mod.StageBar
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('StageBar', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  it('renders 5 tab buttons with correct labels', async () => {
    const StageBar = await loadStageBar()
    render(<StageBar />)

    const labels = ['Ideia', 'Rascunho', 'Imagens', 'SEO', 'Publicacao']
    for (const label of labels) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeDefined()
    }
  })

  it('active stage tab has data-active="true"', async () => {
    mockState = makeState({ activeStage: 'seo' })
    const StageBar = await loadStageBar()
    render(<StageBar />)

    const seoBtn = screen.getByRole('button', { name: /SEO/i })
    expect(seoBtn.getAttribute('data-active')).toBe('true')

    const ideiaBtn = screen.getByRole('button', { name: /Ideia/i })
    expect(ideiaBtn.getAttribute('data-active')).toBe('false')
  })

  it('clicking a tab dispatches SET_STAGE', async () => {
    const StageBar = await loadStageBar()
    render(<StageBar />)

    fireEvent.click(screen.getByRole('button', { name: /Imagens/i }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_STAGE', stage: 'imagens' })

    fireEvent.click(screen.getByRole('button', { name: /Publicacao/i }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_STAGE', stage: 'publicacao' })
  })

  it('bar is not rendered when focus is true', async () => {
    mockState = makeState({ focus: true })
    const StageBar = await loadStageBar()
    const { container } = render(<StageBar />)

    expect(container.innerHTML).toBe('')
  })

  it('Imagens tab shows amber dot when there are pending images', async () => {
    mockState = makeState({
      activeStage: 'rascunho',
      content: {
        pt: makeVersion({
          body: {
            type: 'doc',
            content: [
              { type: 'blogImage', attrs: { status: 'empty' } },
              { type: 'blogImage', attrs: { status: 'done' } },
            ],
          },
        }),
      },
    })

    const StageBar = await loadStageBar()
    render(<StageBar />)

    const imagensBtn = screen.getByRole('button', { name: /Imagens/i })
    const dot = imagensBtn.querySelector('[data-pending-dot]')
    expect(dot).not.toBeNull()
  })

  it('Imagens tab does NOT show dot when all images are done', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          body: {
            type: 'doc',
            content: [
              { type: 'blogImage', attrs: { status: 'done' } },
              { type: 'blogImage', attrs: { status: 'done' } },
            ],
          },
        }),
      },
    })

    const StageBar = await loadStageBar()
    render(<StageBar />)

    const imagensBtn = screen.getByRole('button', { name: /Imagens/i })
    const dot = imagensBtn.querySelector('[data-pending-dot]')
    expect(dot).toBeNull()
  })
})
