import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { YtSearchTerm } from '@/lib/youtube/analytics-types'

/* ── Mocks ── */

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: pushMock, refresh: vi.fn(), back: vi.fn() })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const createPipelineItemMock = vi.fn()
vi.mock('@/app/cms/(authed)/pipeline/actions', () => ({
  createPipelineItem: (...args: unknown[]) => createPipelineItemMock(...args),
}))

/* ── Import after mocks ── */

import { YtSearchTermsView } from '@/app/cms/(authed)/youtube/analytics/_components/yt-search-terms'
import { toast } from 'sonner'

/* ── Helpers ── */

function makeTerm(overrides: Partial<YtSearchTerm> & { term: string }): YtSearchTerm {
  return {
    views: 100,
    estimatedMinutesWatched: 200,
    ...overrides,
  }
}

const sampleTerms: YtSearchTerm[] = [
  makeTerm({ term: 'react hooks', views: 500, estimatedMinutesWatched: 400 }),
  makeTerm({ term: 'nextjs tutorial', views: 1200, estimatedMinutesWatched: 900 }),
  makeTerm({ term: 'typescript generics', views: 300, estimatedMinutesWatched: 100 }),
]

/* ── Tests ── */

describe('YtSearchTermsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "not available" when terms empty and no error', () => {
    render(<YtSearchTermsView terms={[]} />)
    expect(
      screen.getByText('Termos de busca nao disponiveis para este canal.'),
    ).toBeTruthy()
  })

  it('shows scope error message when apiError === "scope"', () => {
    render(<YtSearchTermsView terms={[]} apiError="scope" />)
    expect(
      screen.getByText('Permissao insuficiente para acessar termos de busca.'),
    ).toBeTruthy()
    expect(screen.getByText(/yt-analytics\.readonly/)).toBeTruthy()
  })

  it('shows generic error message for other apiError values', () => {
    render(<YtSearchTermsView terms={[]} apiError="quota_exceeded" />)
    expect(
      screen.getByText('Erro ao carregar termos de busca da API do YouTube.'),
    ).toBeTruthy()
    expect(
      screen.getByText(/erro temporario/),
    ).toBeTruthy()
  })

  it('renders term rows with correct data', () => {
    render(<YtSearchTermsView terms={sampleTerms} />)

    // All three terms visible
    expect(screen.getByText('react hooks')).toBeTruthy()
    expect(screen.getByText('nextjs tutorial')).toBeTruthy()
    expect(screen.getByText('typescript generics')).toBeTruthy()

    // Counter line
    expect(screen.getByText(/3 termos/)).toBeTruthy()
  })

  it('sorts by views desc by default', () => {
    render(<YtSearchTermsView terms={sampleTerms} />)

    const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR')
    // Default: desc by views -> nextjs (1200) > react hooks (500) > typescript (300)
    const termTexts = rows.map((r) => r.querySelector('.search-term span')?.textContent)
    expect(termTexts).toEqual(['nextjs tutorial', 'react hooks', 'typescript generics'])
  })

  it('toggles sort direction when clicking same header', () => {
    render(<YtSearchTermsView terms={sampleTerms} />)

    // Find the Views header (it has aria-sort="descending" by default)
    const viewsHeader = screen.getByTitle('Ordenar por Views')
    expect(viewsHeader.getAttribute('aria-sort')).toBe('descending')

    // Click to toggle to asc
    fireEvent.click(viewsHeader)
    expect(viewsHeader.getAttribute('aria-sort')).toBe('ascending')

    // Rows should now be ascending: typescript (300) > react hooks (500) > nextjs (1200)
    const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR')
    const termTexts = rows.map((r) => r.querySelector('.search-term span')?.textContent)
    expect(termTexts).toEqual(['typescript generics', 'react hooks', 'nextjs tutorial'])
  })

  it('switches sort key on different header click', () => {
    render(<YtSearchTermsView terms={sampleTerms} />)

    const ctrHeader = screen.getByTitle('Ordenar por CTR')
    fireEvent.click(ctrHeader)

    // CTR header should now be active & descending
    expect(ctrHeader.getAttribute('aria-sort')).toBe('descending')

    // Views header should become inactive
    const viewsHeader = screen.getByTitle('Ordenar por Views')
    expect(viewsHeader.getAttribute('aria-sort')).toBe('none')
  })

  it('row click calls createPipelineItem with correct payload', async () => {
    createPipelineItemMock.mockResolvedValue({ ok: true, data: { id: 'abc-123' } })

    render(<YtSearchTermsView terms={sampleTerms} />)

    const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR')
    // Click the first row (nextjs tutorial — sorted desc by views)
    fireEvent.click(rows[0])

    await waitFor(() => {
      expect(createPipelineItemMock).toHaveBeenCalledWith({
        format: 'video',
        title_pt: 'Roteiro: nextjs tutorial',
        synopsis: 'Video baseado no termo de busca "nextjs tutorial".',
        tags: ['search-term', 'youtube-analytics'],
      })
    })

    await waitFor(() => {
      expect((toast.success as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'Roteiro "nextjs tutorial" criado no pipeline.',
      )
    })

    expect(pushMock).toHaveBeenCalledWith('/cms/pipeline/abc-123')
  })

  it('shows loading state on row during pipeline creation', async () => {
    // Use a deferred promise so we can inspect intermediate state
    let resolvePromise!: (v: { ok: boolean; data: { id: string } }) => void
    createPipelineItemMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      }),
    )

    render(<YtSearchTermsView terms={sampleTerms} />)

    const rows = screen.getAllByRole('button').filter((el) => el.tagName === 'TR')
    fireEvent.click(rows[0])

    // During creation: row should show "Criando..." text
    await waitFor(() => {
      expect(screen.getByText('Criando...')).toBeTruthy()
    })

    // The clicked row should have reduced opacity (loading style)
    const loadingRow = rows[0]
    expect(loadingRow.style.opacity).toBe('0.55')

    // Resolve and verify loading state clears
    resolvePromise({ ok: true, data: { id: 'xyz-789' } })

    await waitFor(() => {
      expect(screen.queryByText('Criando...')).toBeNull()
    })
  })
})
