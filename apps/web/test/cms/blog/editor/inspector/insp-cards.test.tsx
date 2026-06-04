import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, SharedFields, VersionContent } from '@/app/cms/(authed)/blog/[id]/edit/types'
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

function makeShared(overrides: Partial<SharedFields> = {}): SharedFields {
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

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return {
    ...EMPTY_VERSION,
    fresh: false,
    title: 'Meu Post',
    slug: 'meu-post',
    slugTouched: false,
    excerpt: 'Resumo do post',
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
    content: { pt: makeVersion() },
    shared: makeShared(),
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Lazy imports — after mocks are registered                         */
/* ------------------------------------------------------------------ */

async function loadDistribuicao() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/edit/inspector/insp-distribuicao'
  )
  return mod.InspDistribuicao
}

async function loadHistorico() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/edit/inspector/insp-historico'
  )
  return mod.InspHistorico
}

async function loadArquivar() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/edit/inspector/insp-arquivar'
  )
  return mod.InspArquivar
}

/* ================================================================== */
/*  InspDistribuicao                                                   */
/* ================================================================== */

describe('InspDistribuicao', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  it('shows "Rascunho" for unpublished', async () => {
    const Comp = await loadDistribuicao()
    render(<Comp />)

    const status = screen.getByTestId('dist-status')
    expect(status.textContent).toContain('Rascunho · não publicado')
  })

  it('shows "Publicado · no ar" for published+clean', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          published: true,
          dirty: false,
          publishedAt: '2026-01-01T00:00:00Z',
        }),
      },
    })
    const Comp = await loadDistribuicao()
    render(<Comp />)

    const status = screen.getByTestId('dist-status')
    expect(status.textContent).toContain('Publicado · no ar')
  })

  it('shows "Publicado · alterações pendentes" for published+dirty', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          published: true,
          dirty: true,
          publishedAt: '2026-01-01T00:00:00Z',
        }),
      },
    })
    const Comp = await loadDistribuicao()
    render(<Comp />)

    const status = screen.getByTestId('dist-status')
    expect(status.textContent).toContain('Publicado · alterações pendentes')
  })

  it('shows URL when published', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          published: true,
          slug: 'meu-post',
          publishedAt: '2026-01-01T00:00:00Z',
        }),
      },
    })
    const Comp = await loadDistribuicao()
    render(<Comp />)

    const url = screen.getByTestId('dist-url')
    expect(url.textContent).toContain('/blog/pt/meu-post')
  })

  it('shows update button when dirty+published', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          published: true,
          dirty: true,
          publishedAt: '2026-01-01T00:00:00Z',
        }),
      },
    })
    const Comp = await loadDistribuicao()
    render(<Comp />)

    expect(screen.getByTestId('dist-update')).toBeDefined()
  })

  it('update button dispatches UPDATE_PUBLISHED', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          published: true,
          dirty: true,
          publishedAt: '2026-01-01T00:00:00Z',
        }),
      },
    })
    const Comp = await loadDistribuicao()
    render(<Comp />)

    fireEvent.click(screen.getByTestId('dist-update'))

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPDATE_PUBLISHED' }),
    )
    // Also check that publishedAt is a string (ISO date)
    const call = mockDispatch.mock.calls[0][0]
    expect(typeof call.publishedAt).toBe('string')
  })

  it('shows images count', async () => {
    mockState = makeState({
      content: {
        pt: makeVersion({
          body: {
            type: 'doc',
            content: [
              { type: 'blogImage', attrs: { status: 'done' } },
              { type: 'blogImage', attrs: { status: 'uploading' } },
            ],
          },
        }),
      },
    })
    const Comp = await loadDistribuicao()
    render(<Comp />)

    const images = screen.getByTestId('dist-images')
    expect(images.textContent).toContain('1/2')
  })
})

/* ================================================================== */
/*  InspHistorico                                                      */
/* ================================================================== */

describe('InspHistorico', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  it('renders timeline entries', async () => {
    mockState = makeState({
      shared: makeShared({
        history: [
          { to: 'rascunho', date: '2026-01-01' },
          { to: 'imagens', date: '2026-01-02' },
        ],
      }),
    })
    const Comp = await loadHistorico()
    render(<Comp />)

    const timeline = screen.getByTestId('hist-timeline')
    expect(timeline.textContent).toContain('Etapa → rascunho')
    expect(timeline.textContent).toContain('Etapa → imagens')
    expect(timeline.textContent).toContain('2026-01-01')
    expect(timeline.textContent).toContain('2026-01-02')
  })

  it('shows "Sem histórico" when empty', async () => {
    mockState = makeState({
      shared: makeShared({ history: [] }),
    })
    const Comp = await loadHistorico()
    render(<Comp />)

    expect(screen.getByTestId('hist-empty').textContent).toBe('Sem histórico')
  })

  it('shows count badge', async () => {
    mockState = makeState({
      shared: makeShared({
        history: [
          { to: 'rascunho', date: '2026-01-01' },
          { to: 'imagens', date: '2026-01-02' },
          { to: 'seo', date: '2026-01-03' },
        ],
      }),
    })
    const Comp = await loadHistorico()
    render(<Comp />)

    const badge = screen.getByTestId('hist-count')
    expect(badge.textContent).toBe('3')
  })
})

/* ================================================================== */
/*  InspArquivar                                                       */
/* ================================================================== */

describe('InspArquivar', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  it('archive button renders', async () => {
    const Comp = await loadArquivar()
    render(<Comp />)

    expect(screen.getByTestId('archive-btn')).toBeDefined()
    expect(screen.getByTestId('archive-btn').textContent).toBe('Arquivar post')
  })

  it('click shows confirmation', async () => {
    const Comp = await loadArquivar()
    render(<Comp />)

    fireEvent.click(screen.getByTestId('archive-btn'))

    expect(screen.getByTestId('archive-confirm')).toBeDefined()
    expect(screen.getByTestId('archive-confirm').textContent).toContain(
      'Arquivar este post?',
    )
  })

  it('confirm dispatches status change', async () => {
    const Comp = await loadArquivar()
    render(<Comp />)

    fireEvent.click(screen.getByTestId('archive-btn'))
    fireEvent.click(screen.getByTestId('archive-confirm-yes'))

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SHARED',
      field: 'status',
      value: 'archived',
    })
  })

  it('cancel closes confirmation', async () => {
    const Comp = await loadArquivar()
    render(<Comp />)

    fireEvent.click(screen.getByTestId('archive-btn'))
    expect(screen.getByTestId('archive-confirm')).toBeDefined()

    fireEvent.click(screen.getByTestId('archive-confirm-cancel'))

    // Confirmation should be gone, archive button should be back
    expect(screen.queryByTestId('archive-confirm')).toBeNull()
    expect(screen.getByTestId('archive-btn')).toBeDefined()
  })
})
