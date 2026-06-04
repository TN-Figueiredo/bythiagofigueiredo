import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/editor/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState

vi.mock('@/app/cms/(authed)/blog/[id]/editor/context', () => ({
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
    history: [],
  }
}

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: makeShared(),
    saveStatus: 'idle',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadInspector() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/editor/inspector/inspector'
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

  it('hidden when focus is true', async () => {
    mockState = makeState({ focus: true })
    const Inspector = await loadInspector()
    const { container } = render(<Inspector />)

    expect(container.innerHTML).toBe('')
  })

  it('visible when focus is false', async () => {
    mockState = makeState({ focus: false })
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
    // overflow-y: auto is applied via className
    expect(sidebar.className).toContain('overflow-y-auto')
  })
})
