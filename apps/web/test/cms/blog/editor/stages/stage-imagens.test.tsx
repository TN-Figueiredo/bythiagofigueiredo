import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/edit/types'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/edit/types'

/* ------------------------------------------------------------------ */
/*  Mock context                                                      */
/* ------------------------------------------------------------------ */

const mockDispatch = vi.fn()
let mockVersion: VersionContent
let mockState: EditorState

vi.mock('@/app/cms/(authed)/blog/[id]/edit/context', () => ({
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
    coverPrompt: '',
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
    '@/app/cms/(authed)/blog/[id]/edit/stages/stage-imagens'
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

  it('renders summary with correct progress count', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const summary = screen.getByTestId('img-summary')
    // 2 content images (1 done) + 1 cover (not ready) = 1/3
    expect(summary.textContent).toContain('1')
    expect(summary.textContent).toContain('/3')
    expect(summary.textContent).toContain('imagens prontas')
  })

  it('cover section renders with label', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const cover = screen.getByTestId('img-cover')
    expect(cover).toBeDefined()
    expect(cover.textContent).toContain('Capa')
    expect(cover.textContent).toContain('thumbnail')
  })

  it('empty cover shows Gerar and Enviar buttons', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const cover = screen.getByTestId('img-cover')
    expect(cover.textContent).toContain('Gerar')
    expect(cover.textContent).toContain('Enviar')
  })

  it('cover with image shows Trocar and Ver buttons', async () => {
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
    expect(cover.textContent).toContain('Trocar')
    expect(cover.textContent).toContain('Ver')
    expect(cover.textContent).toContain('1200')
  })

  it('content image tiles render for each blogImage node', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const content = screen.getByTestId('img-content')
    expect(content.textContent).toContain('img-1')
    expect(content.textContent).toContain('Screenshot')
    expect(content.textContent).toContain('no ar')

    expect(content.textContent).toContain('img-2')
    expect(content.textContent).toContain('sem imagem')
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
    expect(summary.textContent).toContain('3')
    expect(summary.textContent).toContain('/3')
  })

  it('hint text references image block IDs', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    expect(
      screen.getByText(
        /do rascunho/,
      ),
    ).toBeDefined()
  })

  it('shows "Gerar todas" button when images are pending', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const summary = screen.getByTestId('img-summary')
    expect(summary.textContent).toContain('Gerar todas')
  })

  it('content section shows image count in label', async () => {
    const StageImagens = await loadStageImagens()
    render(<StageImagens />)

    const content = screen.getByTestId('img-content')
    expect(content.textContent).toContain('No conteúdo · 2')
  })
})
