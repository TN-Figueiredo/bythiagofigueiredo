import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/edit/types'
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

function makeShared(): EditorState['shared'] {
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
  }
}

function makeVersion(overrides: Partial<VersionContent> = {}): VersionContent {
  return { ...EMPTY_VERSION, fresh: false, ...overrides }
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
/*  Lazy import — after mocks are registered                          */
/* ------------------------------------------------------------------ */

async function loadLangToggle() {
  const mod = await import('@/app/cms/(authed)/blog/[id]/edit/lang-toggle')
  return mod.LangToggle
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('LangToggle', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockState = makeState()
  })

  /* ---- Single version ---- */

  it('single version: shows label + add button', async () => {
    mockState = makeState({ activeLang: 'pt', content: { pt: makeVersion() } })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    // Shows the current language label
    expect(screen.getByText(/PT-BR/)).toBeDefined()

    // Shows the add button for the other language
    const addBtn = screen.getByTestId('lang-add')
    expect(addBtn).toBeDefined()
    expect(addBtn.textContent).toMatch(/EN/)
  })

  it('add button dispatches ADD_VERSION', async () => {
    mockState = makeState({ activeLang: 'pt', content: { pt: makeVersion() } })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    fireEvent.click(screen.getByTestId('lang-add'))
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'ADD_VERSION', lang: 'en' })
  })

  it('single EN version shows "+ PT" add button', async () => {
    mockState = makeState({ activeLang: 'en', content: { en: makeVersion() } })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    expect(screen.getByText(/EN/)).toBeDefined()
    const addBtn = screen.getByTestId('lang-add')
    expect(addBtn.textContent).toMatch(/PT/)
  })

  /* ---- Two versions — segmented toggle ---- */

  it('two versions: shows segmented toggle with both languages', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: { pt: makeVersion(), en: makeVersion() },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    // Should not show add button
    expect(screen.queryByTestId('lang-add')).toBeNull()

    // Both segments rendered
    const buttons = screen.getAllByRole('button')
    const labels = buttons.map((b) => b.textContent)
    expect(labels.some((l) => l?.includes('PT-BR'))).toBe(true)
    expect(labels.some((l) => l?.includes('EN'))).toBe(true)
  })

  it('clicking inactive segment dispatches SET_LANG', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: { pt: makeVersion(), en: makeVersion() },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    // Find the EN segment button (not the remove button)
    const enBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('EN') && !b.textContent?.includes('×'),
    )
    expect(enBtn).toBeDefined()
    fireEvent.click(enBtn!)

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_LANG', lang: 'en' })
  })

  it('active segment does not dispatch SET_LANG when clicked', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: { pt: makeVersion(), en: makeVersion() },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    const ptBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('PT-BR') && !b.textContent?.includes('×'),
    )
    fireEvent.click(ptBtn!)

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  /* ---- Remove button ---- */

  it('remove button exists for inactive version', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: { pt: makeVersion(), en: makeVersion() },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    // Remove button for the inactive language (EN)
    expect(screen.getByTestId('lang-remove-en')).toBeDefined()

    // No remove button for the active language (PT)
    expect(screen.queryByTestId('lang-remove-pt')).toBeNull()
  })

  it('remove on empty version dispatches immediately (no confirm)', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: {
        pt: makeVersion(),
        en: makeVersion(), // empty version — all fields zeroed
      },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    fireEvent.click(screen.getByTestId('lang-remove-en'))

    // Should dispatch immediately without showing popover
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REMOVE_VERSION', lang: 'en' })
    expect(screen.queryByTestId('lang-confirm')).toBeNull()
  })

  it('remove on version with title shows confirmation popover', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: {
        pt: makeVersion(),
        en: makeVersion({ title: 'Hello World' }),
      },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    fireEvent.click(screen.getByTestId('lang-remove-en'))

    // Should NOT dispatch yet
    expect(mockDispatch).not.toHaveBeenCalled()

    // Popover visible
    const popover = screen.getByTestId('lang-confirm')
    expect(popover).toBeDefined()
    expect(popover.textContent).toContain('não pode ser desfeita')
  })

  it('published version shows specific warning message', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: {
        pt: makeVersion(),
        en: makeVersion({ title: 'Published post', published: true }),
      },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    fireEvent.click(screen.getByTestId('lang-remove-en'))

    const popover = screen.getByTestId('lang-confirm')
    expect(popover.textContent).toContain('publicada')
    expect(popover.textContent).toContain('não despublica')
  })

  it('confirm button dispatches REMOVE_VERSION', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: {
        pt: makeVersion(),
        en: makeVersion({ title: 'Hello World' }),
      },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    // Open popover
    fireEvent.click(screen.getByTestId('lang-remove-en'))

    // Click "Remover"
    const confirmBtn = screen.getByRole('button', { name: 'Remover' })
    fireEvent.click(confirmBtn)

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REMOVE_VERSION', lang: 'en' })
  })

  it('cancel button closes popover', async () => {
    mockState = makeState({
      activeLang: 'pt',
      content: {
        pt: makeVersion(),
        en: makeVersion({ title: 'Hello World' }),
      },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    // Open popover
    fireEvent.click(screen.getByTestId('lang-remove-en'))
    expect(screen.getByTestId('lang-confirm')).toBeDefined()

    // Click "Cancelar"
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    // Popover gone, no dispatch
    expect(screen.queryByTestId('lang-confirm')).toBeNull()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('last remaining version hides remove button', async () => {
    // Single version — should have no remove buttons at all
    mockState = makeState({
      activeLang: 'pt',
      content: { pt: makeVersion({ title: 'Only version' }) },
    })
    const LangToggle = await loadLangToggle()
    render(<LangToggle />)

    expect(screen.queryByTestId('lang-remove-pt')).toBeNull()
    expect(screen.queryByTestId('lang-remove-en')).toBeNull()
  })
})
