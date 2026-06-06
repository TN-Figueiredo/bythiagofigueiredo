import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

async function loadInspector() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/edit/inspector/inspector'
  )
  return mod.Inspector
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('Inspector', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  it('renders all 4 card sections', async () => {
    const Inspector = await loadInspector()
    render(<Inspector />)

    expect(screen.getByTestId('insp-detalhes')).toBeDefined()
    expect(screen.getByTestId('insp-distribuicao')).toBeDefined()
    expect(screen.getByTestId('insp-historico')).toBeDefined()
    expect(screen.getByTestId('insp-arquivar')).toBeDefined()
  })

  it('always renders regardless of focus state', async () => {
    mockState = makeState({ focus: true })
    const Inspector = await loadInspector()
    const { container } = render(<Inspector />)

    expect(container.innerHTML).not.toBe('')
    expect(screen.getByTestId('insp-detalhes')).toBeDefined()
  })

  it('has scrollable container', async () => {
    const Inspector = await loadInspector()
    const { container } = render(<Inspector />)

    const sidebar = container.firstElementChild as HTMLElement
    expect(sidebar).not.toBeNull()
    expect(sidebar.getAttribute('data-inspector')).toBe('')
    expect(sidebar.className).toContain('insp')
  })
})
