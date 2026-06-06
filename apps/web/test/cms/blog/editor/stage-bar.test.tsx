import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/edit/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/edit/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState

vi.mock('@/app/cms/(authed)/blog/[id]/edit/context', () => ({
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
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
    coverPrompt: '',
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
    inspectorOpen: false,
    categories: [],
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: makeShared(),
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadStageBar() {
  const mod = await import('@/app/cms/(authed)/blog/[id]/edit/stage-bar')
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

    const labels = ['Ideia', 'Conteúdo', 'Imagens', 'SEO', 'Publicação']
    for (const label of labels) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeDefined()
    }
  })

  it('active stage tab has .on class', async () => {
    mockState = makeState({ activeStage: 'seo' })
    const StageBar = await loadStageBar()
    render(<StageBar />)

    const seoBtn = screen.getByRole('tab', { name: /SEO/i })
    expect(seoBtn.classList.contains('on')).toBe(true)

    const ideiaBtn = screen.getByRole('tab', { name: /Ideia/i })
    expect(ideiaBtn.classList.contains('on')).toBe(false)
  })

  it('clicking a tab dispatches SET_STAGE', async () => {
    const StageBar = await loadStageBar()
    render(<StageBar />)

    fireEvent.click(screen.getByRole('tab', { name: /Imagens/i }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_STAGE', stage: 'imagens' })

    fireEvent.click(screen.getByRole('tab', { name: /Publicação/i }))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_STAGE', stage: 'publicacao' })
  })

  it('bar is not rendered when focus is true', async () => {
    mockState = makeState({ focus: true })
    const StageBar = await loadStageBar()
    const { container } = render(<StageBar />)

    expect(container.innerHTML).toBe('')
  })

  /* Pending-dot tests removed — .esn notification dots were removed from
     the StageBar component. Image pending state is now shown only in the
     Imagens stage itself. */
})
