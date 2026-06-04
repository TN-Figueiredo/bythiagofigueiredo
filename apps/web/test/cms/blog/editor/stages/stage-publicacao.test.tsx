import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type {
  EditorState,
  VersionContent,
  SharedFields,
} from '@/app/cms/(authed)/blog/[id]/edit/types'
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

vi.mock('@/app/cms/(authed)/blog/_tabs/editorial/schedule-modal', () => ({
  ScheduleModal: () => null,
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
  return { ...EMPTY_VERSION, ...overrides }
}

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    siteId: 'site-1',
    siteTimezone: 'America/Sao_Paulo',
    activeStage: 'publicacao',
    activeLang: 'pt',
    focus: false,
    content: { pt: makeVersion() },
    shared: makeShared(),
    saveStatus: 'idle',
    scrollToImageId: null,
    ...overrides,
  }
}

/* ---- Preset states ---- */

/** Draft with all gate checks passing. */
function draftPassing(): EditorState {
  const v = makeVersion({
    title: 'Meu Post Completo',
    slug: 'meu-post-completo',
    excerpt: 'Uma descricao do post',
    body: { type: 'doc', content: [{ type: 'text', text: 'Corpo do post' }] },
    coverReady: true,
    published: false,
    dirty: false,
  })
  return makeState({
    content: { pt: v },
    shared: makeShared({ tags: ['tech', 'brasil'] }),
  })
}

/** Draft with gate checks failing (no title, no content, no cover). */
function draftFailing(): EditorState {
  const v = makeVersion({
    title: '',
    slug: '',
    excerpt: '',
    body: null,
    coverReady: false,
    published: false,
    dirty: false,
  })
  return makeState({ content: { pt: v } })
}

/** Published + clean (no pending changes). */
function publishedClean(): EditorState {
  const v = makeVersion({
    title: 'Post Publicado',
    slug: 'post-publicado',
    excerpt: 'Descricao publicada',
    body: { type: 'doc', content: [{ type: 'text', text: 'Corpo publicado' }] },
    coverReady: true,
    published: true,
    publishedAt: '2026-01-01T00:00:00Z',
    dirty: false,
  })
  return makeState({ content: { pt: v } })
}

/** Published + dirty (has unpublished changes). */
function publishedDirty(): EditorState {
  const v = makeVersion({
    title: 'Post Publicado Editado',
    slug: 'post-publicado-editado',
    excerpt: 'Descricao editada',
    body: { type: 'doc', content: [{ type: 'text', text: 'Corpo editado' }] },
    coverReady: true,
    published: true,
    publishedAt: '2026-01-01T00:00:00Z',
    dirty: true,
  })
  return makeState({ content: { pt: v } })
}

/* ------------------------------------------------------------------ */
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadStagePublicacao() {
  const mod = await import(
    '@/app/cms/(authed)/blog/[id]/edit/stages/stage-publicacao'
  )
  return mod.StagePublicacao
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('StagePublicacao', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
  })

  /* ---- 1. Shows read-only title ---- */
  it('shows read-only title', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const title = screen.getByTestId('pub-title')
    expect(title.textContent).toBe('Meu Post Completo')
  })

  /* ---- 2. Gate shows green chips when all checks pass ---- */
  it('gate shows green chips when all checks pass', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const gate = screen.getByTestId('pub-gate')
    expect(gate.textContent).toContain('Pronto para publicacao')

    // All 3 checks should appear as text
    expect(gate.textContent).toContain('Título')
    expect(gate.textContent).toContain('Conteúdo')
    expect(gate.textContent).toContain('Imagens')

    // No buttons (red chips) inside the gate
    const buttons = within(gate).queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  /* ---- 3. Gate shows red chips when checks fail ---- */
  it('gate shows red chips when checks fail', async () => {
    const s = draftFailing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const gate = screen.getByTestId('pub-gate')
    expect(gate.textContent).toContain('Itens pendentes para publicacao')

    // All 3 failing checks should be clickable buttons
    const buttons = within(gate).getAllByRole('button')
    expect(buttons.length).toBe(3)
  })

  /* ---- 4. Publish button disabled when gate fails ---- */
  it('publish button disabled when gate fails', async () => {
    const s = draftFailing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const publishBtn = screen.getByRole('button', { name: /publicar/i })
    expect(publishBtn).toHaveProperty('disabled', true)

    const scheduleBtn = screen.getByRole('button', { name: /agendar/i })
    expect(scheduleBtn).toHaveProperty('disabled', true)
  })

  /* ---- 5. Publish button enabled when gate passes ---- */
  it('publish button enabled when gate passes', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const publishBtn = screen.getByRole('button', { name: /publicar/i })
    expect(publishBtn).toHaveProperty('disabled', false)
  })

  /* ---- 6. Clicking red chip dispatches SET_STAGE ---- */
  it('clicking red chip dispatches SET_STAGE to correct stage', async () => {
    const s = draftFailing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const gate = screen.getByTestId('pub-gate')
    // Title check → stage 'rascunho'
    const titleChip = within(gate).getAllByRole('button').find(
      (btn) => btn.textContent?.includes('Título'),
    )
    expect(titleChip).toBeDefined()
    fireEvent.click(titleChip!)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_STAGE',
      stage: 'rascunho',
    })
  })

  /* ---- 7. Publish button dispatches PUBLISH ---- */
  it('publish button dispatches PUBLISH', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const publishBtn = screen.getByRole('button', { name: /publicar/i })
    fireEvent.click(publishBtn)

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'PUBLISH' })
  })

  /* ---- 8. Shows update box when published + dirty ---- */
  it('shows update box when published + dirty', async () => {
    const s = publishedDirty()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const actions = screen.getByTestId('pub-actions')
    expect(actions.textContent).toContain('Alteracoes nao publicadas')
    expect(
      within(actions).getByRole('button', { name: /atualizar no site/i }),
    ).toBeDefined()
  })

  /* ---- 9. Update button dispatches UPDATE_PUBLISHED ---- */
  it('update button dispatches UPDATE_PUBLISHED', async () => {
    const s = publishedDirty()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const updateBtn = screen.getByRole('button', { name: /atualizar no site/i })
    fireEvent.click(updateBtn)

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const call = mockDispatch.mock.calls[0][0]
    expect(call.type).toBe('UPDATE_PUBLISHED')
    expect(typeof call.publishedAt).toBe('string')
  })

  /* ---- 10. Title alts chips render when titleAlts has entries ---- */
  it('title alt chips render when titleAlts has entries', async () => {
    const v = makeVersion({
      title: 'Titulo Original',
      slug: 'titulo-original',
      excerpt: 'Descricao',
      body: { type: 'doc', content: [{ type: 'text', text: 'Corpo' }] },
      coverReady: true,
      titleAlts: ['Alternativa 1', 'Alternativa 2', 'Alternativa 3'],
    })
    mockState = makeState({ content: { pt: v } })
    mockVersion = v

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const altsSection = screen.getByTestId('title-alts')
    expect(altsSection).toBeDefined()

    const altButtons = within(altsSection).getAllByRole('button')
    expect(altButtons).toHaveLength(3)
    expect(altButtons[0].textContent).toContain('1')
    expect(altButtons[0].textContent).toContain('Alternativa 1')
  })

  /* ---- 11. Title alt click dispatches SET_TITLE ---- */
  it('title alt click dispatches SET_TITLE with alt text', async () => {
    const v = makeVersion({
      title: 'Titulo Original',
      slug: 'titulo-original',
      excerpt: 'Descricao',
      body: { type: 'doc', content: [{ type: 'text', text: 'Corpo' }] },
      coverReady: true,
      titleAlts: ['Alternativa Escolhida'],
    })
    mockState = makeState({ content: { pt: v } })
    mockVersion = v

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const altsSection = screen.getByTestId('title-alts')
    const altBtn = within(altsSection).getByRole('button')
    fireEvent.click(altBtn)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TITLE',
      title: 'Alternativa Escolhida',
    })
  })

  /* ---- Bonus: title-alts hidden when empty ---- */
  it('title alts section hidden when titleAlts is empty', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    expect(screen.queryByTestId('title-alts')).toBeNull()
  })

  /* ---- Published + clean shows link and share button ---- */
  it('shows "Ver post no site" link when published + clean', async () => {
    const s = publishedClean()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const actions = screen.getByTestId('pub-actions')
    const link = within(actions).getByText(/ver post no site/i)
    expect(link.closest('a')).toHaveProperty(
      'href',
      expect.stringContaining('/blog/pt/post-publicado'),
    )
    expect(
      within(actions).getByRole('button', { name: /compartilhar nas redes/i }),
    ).toBeDefined()
  })
})
