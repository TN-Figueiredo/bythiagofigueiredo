import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, SharedFields } from '@/app/cms/(authed)/blog/[id]/editor/types'
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

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    content: {
      pt: {
        ...EMPTY_VERSION,
        fresh: false,
        title: 'Meu Post',
        slug: 'meu-post',
        slugTouched: false,
        excerpt: 'Resumo do post',
      },
    },
    shared: makeShared(),
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadComponent() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/editor/inspector/insp-detalhes'
  )
  return mod.InspDetalhes
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('InspDetalhes', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  it('renders slug with /blog/{lang}/ prefix', async () => {
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    const slugSection = screen.getByTestId('insp-slug')
    expect(slugSection.textContent).toContain('/blog/pt/')
  })

  it('slug input change dispatches SET_SLUG with touched: true', async () => {
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    const input = screen.getByLabelText('Slug')
    fireEvent.change(input, { target: { value: 'novo-slug' } })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SLUG',
      slug: 'novo-slug',
      touched: true,
    })
  })

  it('regenerate link shown when slugTouched is true', async () => {
    mockState = makeState({
      content: {
        pt: {
          ...EMPTY_VERSION,
          fresh: false,
          title: 'Meu Post',
          slug: 'custom-slug',
          slugTouched: true,
          excerpt: '',
        },
      },
    })
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    expect(screen.getByText('↻ regenerar do titulo')).toBeDefined()
  })

  it('regenerate link hidden when slugTouched is false', async () => {
    mockState = makeState({
      content: {
        pt: {
          ...EMPTY_VERSION,
          fresh: false,
          title: 'Meu Post',
          slug: 'meu-post',
          slugTouched: false,
          excerpt: '',
        },
      },
    })
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    expect(screen.queryByText('↻ regenerar do titulo')).toBeNull()
  })

  it('clicking regenerate dispatches SET_SLUG from title with touched: false', async () => {
    mockState = makeState({
      content: {
        pt: {
          ...EMPTY_VERSION,
          fresh: false,
          title: 'Meu Post Legal',
          slug: 'custom-slug',
          slugTouched: true,
          excerpt: '',
        },
      },
    })
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    fireEvent.click(screen.getByText('↻ regenerar do titulo'))

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SLUG',
      slug: 'meu-post-legal',
      touched: false,
    })
  })

  it('excerpt textarea dispatches SET_EXCERPT on change', async () => {
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    const textarea = screen.getByLabelText('Excerpt')
    fireEvent.change(textarea, { target: { value: 'Novo resumo' } })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_EXCERPT',
      excerpt: 'Novo resumo',
    })
  })

  it('priority badge shows plevel value', async () => {
    mockState = makeState({
      shared: makeShared({ plevel: 2 }),
    })
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    const badge = screen.getByTestId('insp-plevel')
    expect(badge.textContent).toContain('P2')
  })

  it('category shows category name', async () => {
    mockState = makeState({
      shared: makeShared({ category: 'Tecnologia' }),
    })
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    const categorySection = screen.getByTestId('insp-category')
    expect(categorySection.textContent).toContain('Tecnologia')
  })

  it('tags render as chips', async () => {
    mockState = makeState({
      shared: makeShared({ tags: ['react', 'typescript', 'next'] }),
    })
    const InspDetalhes = await loadComponent()
    render(<InspDetalhes />)

    const tagsSection = screen.getByTestId('insp-tags')
    expect(tagsSection.textContent).toContain('react')
    expect(tagsSection.textContent).toContain('typescript')
    expect(tagsSection.textContent).toContain('next')
  })
})
