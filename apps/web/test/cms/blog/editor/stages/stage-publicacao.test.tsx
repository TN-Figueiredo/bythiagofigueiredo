import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
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

/* ------------------------------------------------------------------ */
/*  Mock server actions                                               */
/* ------------------------------------------------------------------ */

const mockPublishPost = vi.fn().mockResolvedValue(undefined)
const mockMovePost = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/app/cms/(authed)/blog/[id]/edit/actions', () => ({
  publishPost: (...args: unknown[]) => mockPublishPost(...args),
}))

vi.mock('@/app/cms/(authed)/blog/actions', () => ({
  movePost: (...args: unknown[]) => mockMovePost(...args),
}))

vi.mock('@/app/cms/(authed)/blog/_tabs/editorial/schedule-modal', () => ({
  ScheduleModal: () => null,
}))

vi.mock('@/app/cms/(authed)/blog/[id]/edit/hashtag-actions', () => ({
  searchHashtags: vi.fn().mockResolvedValue({ ok: true, hashtags: [] }),
  createHashtag: vi.fn().mockResolvedValue({ ok: false }),
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
    coverPrompt: '',
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
    inspectorOpen: false,
    categories: [],
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
    mockPublishPost.mockClear()
    mockMovePost.mockClear()
  })

  /* ---- 1. Shows read-only title ---- */
  it('shows read-only title', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    // Title is rendered in a doc-title-sm h2 element (no data-testid)
    const title = document.querySelector('.doc-title-sm')
    expect(title).not.toBeNull()
    expect(title!.textContent).toBe('Meu Post Completo')
  })

  /* ---- 2. Gate shows green chips when all checks pass ---- */
  it('gate shows green chips when all checks pass', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const gate = screen.getByTestId('pub-gate')
    expect(gate.textContent).toContain('Pronto para publicar')

    // CHECK_LABELS in component uses unaccented strings
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
    expect(gate.textContent).toContain('Falta para publicar')

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

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'PUBLISH' })
    })
    expect(mockPublishPost).toHaveBeenCalledWith('p1')
  })

  /* ---- 8. Shows update box when published + dirty ---- */
  it('shows update box when published + dirty', async () => {
    const s = publishedDirty()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const actions = screen.getByTestId('pub-actions')
    expect(actions.textContent).toContain('Alterações não publicadas')
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

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(1)
    })
    expect(mockPublishPost).toHaveBeenCalledWith('p1')
    const call = mockDispatch.mock.calls[0][0]
    expect(call.type).toBe('UPDATE_PUBLISHED')
    expect(typeof call.publishedAt).toBe('string')
  })

  /* ---- 10. Title char counter shows correct count ---- */
  it('title char counter shows correct count', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const counter = screen.getByTestId('pub-title-counter')
    expect(counter.textContent).toContain(`${s.content.pt!.title.length} chars`)
  })

  /* ---- 11. Hashtags render with # prefix ---- */
  it('hashtags render with # prefix', async () => {
    const s = makeState({
      content: { pt: makeVersion({ title: 'T', slug: 's' }) },
      shared: makeShared({
        hashtags: [
          { id: 'h1', name: 'AI Empire', slug: 'ai-empire' },
          { id: 'h2', name: 'BTS', slug: 'bts' },
        ],
      }),
    })
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const tags = screen.getByTestId('pub-tags')
    expect(tags.textContent).toContain('#ai-empire')
    expect(tags.textContent).toContain('#bts')
  })

  /* ---- 12. Readonly title input navigates to rascunho on click ---- */
  it('readonly title input navigates to rascunho on click', async () => {
    const s = draftPassing()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const input = screen.getByDisplayValue('Meu Post Completo')
    fireEvent.click(input)

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_STAGE', stage: 'rascunho' })
  })

  /* ---- Published + clean shows link and share button ---- */
  it('shows "Ver no site" link when published + clean', async () => {
    const s = publishedClean()
    mockState = s
    mockVersion = s.content.pt!

    const StagePublicacao = await loadStagePublicacao()
    render(<StagePublicacao />)

    const actions = screen.getByTestId('pub-actions')
    // Text changed from "Ver post no site" to "Ver no site"
    const link = within(actions).getByText(/ver no site/i)
    expect(link.closest('a')).toHaveProperty(
      'href',
      expect.stringContaining('/blog/pt/post-publicado'),
    )
    // "Compartilhar" replaced by the social-panel handoff
    const panel = within(actions).getByText(/abrir painel social/i)
    expect(panel.closest('a')).toHaveProperty(
      'href',
      expect.stringContaining('/cms/social'),
    )
  })
})
