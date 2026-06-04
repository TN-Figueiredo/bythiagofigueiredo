import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/editor/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockVersion: VersionContent
let mockState: EditorState

vi.mock('@/app/cms/(authed)/blog/[id]/editor/context', () => ({
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

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return { ...EMPTY_VERSION, ...overrides }
}

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'seo',
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
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadStageSeo() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/editor/stages/stage-seo'
  )
  return mod.StageSeo
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('StageSeo', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockVersion = makeVersion({
      title: 'Meu Post',
      slug: 'meu-post',
      metaTitle: '',
      metaDesc: '',
      excerpt: '',
    })
    mockState = makeState({ content: { pt: mockVersion } })
  })

  it('renders kicker with language (SEO · PT-BR)', async () => {
    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    expect(screen.getByText(/SEO · PT-BR/)).toBeDefined()
  })

  it('renders kicker with EN when activeLang is en', async () => {
    mockState = makeState({
      activeLang: 'en',
      content: { en: mockVersion },
    })
    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    expect(screen.getByText(/SEO · EN/)).toBeDefined()
  })

  it('meta title input dispatches SET_FIELD on change', async () => {
    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const input = screen.getByLabelText(/meta t[ií]tulo/i)
    fireEvent.change(input, { target: { value: 'Novo título SEO' } })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_FIELD',
      field: 'metaTitle',
      value: 'Novo título SEO',
    })
  })

  it('title char counter shows "vazio" when empty', async () => {
    mockVersion = makeVersion({ metaTitle: '' })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const counter = screen.getByTestId('meta-title-counter')
    expect(counter.textContent).toContain('vazio')
  })

  it('title char counter shows "curto" when < 40', async () => {
    mockVersion = makeVersion({ metaTitle: 'Short' })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const counter = screen.getByTestId('meta-title-counter')
    expect(counter.textContent).toContain('curto')
  })

  it('title char counter shows "ideal" when 40-60', async () => {
    // 45 chars
    mockVersion = makeVersion({
      metaTitle: 'Este e um titulo com exatamente 45 caracte!',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const counter = screen.getByTestId('meta-title-counter')
    expect(counter.textContent).toContain('ideal')
  })

  it('title char counter shows "pode truncar" when > 60', async () => {
    // 65 chars
    mockVersion = makeVersion({
      metaTitle:
        'Este titulo e propositalmente longo para ultrapassar sessenta e cinco',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const counter = screen.getByTestId('meta-title-counter')
    expect(counter.textContent).toContain('pode truncar')
  })

  it('SERP preview shows metaTitle when set', async () => {
    mockVersion = makeVersion({
      metaTitle: 'Titulo SEO Personalizado',
      slug: 'meu-post',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const serpTitle = screen.getByTestId('serp-title')
    expect(serpTitle.textContent).toBe('Titulo SEO Personalizado')
  })

  it('SERP preview falls back to post title when metaTitle is empty', async () => {
    mockVersion = makeVersion({
      title: 'Titulo do Post',
      metaTitle: '',
      slug: 'meu-post',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const serpTitle = screen.getByTestId('serp-title')
    expect(serpTitle.textContent).toBe('Titulo do Post')
  })

  it('SERP preview shows slug in URL', async () => {
    mockVersion = makeVersion({ slug: 'meu-post-legal' })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const serpUrl = screen.getByTestId('serp-url')
    expect(serpUrl.textContent).toContain('meu-post-legal')
  })

  it('meta description dispatches SET_FIELD on change', async () => {
    const StageSeo = await loadStageSeo()
    render(<StageSeo />)

    const textarea = screen.getByLabelText(/meta descri[cç][aã]o/i)
    fireEvent.change(textarea, {
      target: { value: 'Nova descrição para SEO' },
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_FIELD',
      field: 'metaDesc',
      value: 'Nova descrição para SEO',
    })
  })
})
