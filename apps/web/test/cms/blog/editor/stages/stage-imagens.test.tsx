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

vi.mock('@/app/cms/(authed)/_shared/media/media-gallery-modal', () => ({
  MediaGalleryModal: () => null,
}))

vi.mock('@/app/cms/(authed)/_shared/media/use-media-gallery', () => ({
  useMediaGallery: () => ({
    open: false,
    openGallery: vi.fn(),
    closeGallery: vi.fn(),
    galleryProps: { open: false, onClose: vi.fn() },
  }),
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
    activeStage: 'imagens',
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
/*  Test body fixtures                                                */
/* ------------------------------------------------------------------ */

const bodyWithImages = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
    {
      type: 'blogImage',
      attrs: {
        id: 'img-1',
        status: 'done',
        alt: 'Screenshot',
        src: 'https://example.com/img.jpg',
      },
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'Middle' }] },
    {
      type: 'blogImage',
      attrs: { id: 'img-2', status: 'empty', alt: '', src: null },
    },
  ],
}

const bodyAllDone = {
  type: 'doc',
  content: [
    {
      type: 'blogImage',
      attrs: {
        id: 'img-1',
        status: 'done',
        alt: 'First',
        src: 'https://example.com/1.jpg',
      },
    },
    {
      type: 'blogImage',
      attrs: {
        id: 'img-2',
        status: 'done',
        alt: 'Second',
        src: 'https://example.com/2.jpg',
      },
    },
  ],
}

const bodyEmpty = { type: 'doc', content: [] }

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadStageImagens() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/editor/stages/stage-imagens'
  )
  return mod.StageImagens
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('StageImagens', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockVersion = makeVersion({
      title: 'Meu Post',
      body: bodyWithImages,
      coverReady: false,
      coverImageUrl: null,
    })
    mockState = makeState({ content: { pt: mockVersion } })
  })

  it('renders summary with correct count "1/3 imagens prontas"', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const summary = screen.getByTestId('img-summary')
    // 2 content images (1 done) + 1 cover (not ready) = 1/3
    expect(summary.textContent).toContain('1/3 imagens prontas')
  })

  it('cover section renders with status badge', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const cover = screen.getByTestId('img-cover')
    expect(cover).toBeDefined()
    expect(cover.textContent).toContain('Capa')
    expect(cover.textContent).toContain('1200×675')
    // Cover not ready → aguardando
    expect(cover.textContent).toContain('aguardando')
  })

  it('cover section shows "no ar" when coverReady is true', async () => {
    mockVersion = makeVersion({
      title: 'Post',
      body: bodyWithImages,
      coverReady: true,
      coverImageUrl: 'https://example.com/cover.jpg',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const cover = screen.getByTestId('img-cover')
    expect(cover.textContent).toContain('no ar')
  })

  it('content image rows render for each blogImage node', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const content = screen.getByTestId('img-content')
    // img-1 row
    expect(content.textContent).toContain('img-1')
    expect(content.textContent).toContain('Screenshot')
    expect(content.textContent).toContain('no ar')

    // img-2 row
    expect(content.textContent).toContain('img-2')
    expect(content.textContent).toContain('aguardando')
  })

  it('navigation button dispatches SCROLL_TO_IMAGE and SET_STAGE to rascunho', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const navBtn = screen.getByTestId('img-nav-img-1')
    fireEvent.click(navBtn)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SCROLL_TO_IMAGE',
      imageId: 'img-1',
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STAGE',
      stage: 'rascunho',
    })
  })

  it('empty body shows "Nenhuma imagem no conteúdo"', async () => {
    mockVersion = makeVersion({
      title: 'Post sem imagem',
      body: bodyEmpty,
      coverReady: false,
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    expect(screen.getByText('Nenhuma imagem no conteúdo')).toBeDefined()
  })

  it('all-done state shows "Tudo pronto"', async () => {
    mockVersion = makeVersion({
      title: 'Post completo',
      body: bodyAllDone,
      coverReady: true,
      coverImageUrl: 'https://example.com/cover.jpg',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const summary = screen.getByTestId('img-summary')
    expect(summary.textContent).toContain('Tudo pronto')
    // 2 done content + 1 cover ready = 3/3
    expect(summary.textContent).toContain('3/3 imagens prontas')
  })

  it('hint text is rendered', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    expect(
      screen.getByText(
        /Essas imagens vêm dos blocos do rascunho/,
      ),
    ).toBeDefined()
  })

  it('renders kicker with language (IMAGENS · PT-BR)', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    expect(screen.getByText(/IMAGENS · PT-BR/)).toBeDefined()
  })

  it('shows "Trocar" button when cover image exists', async () => {
    mockVersion = makeVersion({
      title: 'Post',
      body: bodyEmpty,
      coverReady: true,
      coverImageUrl: 'https://example.com/cover.jpg',
    })
    mockState = makeState({ content: { pt: mockVersion } })

    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const cover = screen.getByTestId('img-cover')
    expect(cover.textContent).toContain('Trocar')
  })

  it('shows "Galeria" and "Upload" buttons when no cover', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const cover = screen.getByTestId('img-cover')
    expect(cover.textContent).toContain('Galeria')
    expect(cover.textContent).toContain('Upload')
  })

  it('shows "Verificar pendente" button when not all done', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const summary = screen.getByTestId('img-summary')
    expect(summary.textContent).toContain('Verificar pendente')
  })
})
