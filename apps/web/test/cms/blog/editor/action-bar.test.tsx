import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/editor/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockState: EditorState
let mockVersion: VersionContent | null

vi.mock('@/app/cms/(authed)/blog/[id]/editor/context', () => ({
  useEditorState: () => mockState,
  useEditorDispatch: () => mockDispatch,
  useEditorVersion: () => mockVersion,
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeShared(
  overrides: Partial<EditorState['shared']> = {},
): EditorState['shared'] {
  return {
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
    ...overrides,
  }
}

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  const base: EditorState = {
    postId: 'p1',
    code: 'tg-07',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: makeShared(),
    saveStatus: 'idle',
  }
  const merged = { ...base, ...overrides }
  if (overrides.shared) {
    merged.shared = { ...base.shared, ...overrides.shared }
  }
  return merged
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadActionBar() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/editor/action-bar'
  )
  return mod.ActionBar
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('ActionBar', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
    mockVersion = mockState.content[mockState.activeLang] ?? null
  })

  it('renders breadcrumb with post code', async () => {
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    expect(screen.getByText('Blog')).toBeDefined()
    expect(screen.getByText('tg-07')).toBeDefined()
  })

  it('shows "Rascunho" status for draft posts', async () => {
    mockState = makeState({ shared: makeShared({ status: 'draft' }) })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    expect(screen.getByText('Rascunho')).toBeDefined()
  })

  it('shows "Publicado" status for published + clean posts', async () => {
    mockState = makeState({
      shared: makeShared({ status: 'published' }),
      content: { pt: { ...EMPTY_VERSION, dirty: false, fresh: false } },
    })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    expect(screen.getByText('Publicado')).toBeDefined()
  })

  it('shows "Alteracoes pendentes" for published + dirty posts', async () => {
    mockState = makeState({
      shared: makeShared({ status: 'published' }),
      content: { pt: { ...EMPTY_VERSION, dirty: true, fresh: false } },
    })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    expect(screen.getByText(/Altera/)).toBeDefined()
  })

  it('shows "Agendado" for scheduled posts', async () => {
    mockState = makeState({ shared: makeShared({ status: 'scheduled' }) })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    expect(screen.getByText('Agendado')).toBeDefined()
  })

  it('shows "Arquivado" for archived posts', async () => {
    mockState = makeState({ shared: makeShared({ status: 'archived' }) })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    expect(screen.getByText('Arquivado')).toBeDefined()
  })

  it('focus toggle dispatches TOGGLE_FOCUS on click', async () => {
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    const focusBtn = screen.getByTestId('focus-toggle')
    fireEvent.click(focusBtn)

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_FOCUS' })
  })

  it('focus toggle has accent styling when focus is active', async () => {
    mockState = makeState({ focus: true })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    const focusBtn = screen.getByTestId('focus-toggle')
    expect(focusBtn.getAttribute('data-active')).toBe('true')
  })

  it('focus toggle does NOT have accent styling when focus is inactive', async () => {
    mockState = makeState({ focus: false })
    mockVersion = mockState.content[mockState.activeLang] ?? null
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    const focusBtn = screen.getByTestId('focus-toggle')
    expect(focusBtn.getAttribute('data-active')).toBe('false')
  })

  it('save button is rendered', async () => {
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    const saveBtn = screen.getByTestId('save-btn')
    expect(saveBtn).toBeDefined()
    expect(saveBtn.textContent).toBe('Salvar')
  })

  it('back link points to /cms/blog', async () => {
    const ActionBar = await loadActionBar()
    render(<ActionBar />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/cms/blog')
  })
})
