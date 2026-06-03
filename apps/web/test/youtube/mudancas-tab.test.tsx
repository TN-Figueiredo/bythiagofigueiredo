import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { render, screen, fireEvent } from '@testing-library/react'
import { MudancasTab } from '@/app/cms/(authed)/youtube/competitors/_components/mudancas-tab'
import type { CompetitorChangeView } from '@/lib/youtube/observatory-types'

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Search: icon('Search'), Bookmark: icon('Bookmark'), ChevronRight: icon('ChevronRight'),
    ChevronDown: icon('ChevronDown'), ChevronUp: icon('ChevronUp'), ZoomIn: icon('ZoomIn'),
    ArrowRight: icon('ArrowRight'), X: icon('X'), Filter: icon('Filter'),
    FlaskConical: icon('FlaskConical'), RotateCcw: icon('RotateCcw'),
    Image: icon('Image'), List: icon('List'), MessageSquare: icon('MessageSquare'),
  }
})

vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="yt-portal">{children}</div>,
}))

vi.mock('@/app/cms/(authed)/_shared/editor/use-modal-focus-trap', () => ({
  useModalFocusTrap: vi.fn(),
}))

vi.mock('@/lib/youtube/format', () => ({
  fmtC: (n: number) => String(n),
  fmtRelative: () => 'há 2 dias',
}))

vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  toggleBookmark: vi.fn().mockResolvedValue({ ok: true }),
}))

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

function makeChange(overrides: Partial<CompetitorChangeView> = {}): CompetitorChangeView {
  return {
    id: 'change-1',
    videoId: 'vid-1',
    videoTitle: 'Great Video Title',
    channelName: 'Competitor Alpha',
    channelThumbnailUrl: null,
    changeType: 'thumbnail',
    oldTitle: null,
    newTitle: null,
    oldThumbnailUrl: 'https://img.example.com/old.jpg',
    newThumbnailUrl: 'https://img.example.com/new.jpg',
    viewCountAtChange: 50000,
    detectedAt: new Date().toISOString(),
    bookmarked: false,
    history: [],
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Behavioral tests                                                   */
/* ------------------------------------------------------------------ */

describe('MudancasTab', () => {
  beforeEach(() => {
    pushMock.mockClear()
    refreshMock.mockClear()
  })

  it('groups changes by video — parent shows most recent, history has older', () => {
    const now = new Date()
    const older = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    const historyItem = makeChange({
      id: 'change-old',
      detectedAt: older.toISOString(),
      changeType: 'title',
      oldTitle: 'Old Title V1',
      newTitle: 'Old Title V2',
    })

    const parentChange = makeChange({
      id: 'change-recent',
      detectedAt: now.toISOString(),
      changeType: 'thumbnail',
      history: [historyItem],
    })

    render(<MudancasTab changes={[parentChange]} channelNames={['Competitor Alpha']} />)

    // Parent card's "Mudanca mais recente" section shows the parent change type
    expect(screen.getByText('Mudanca mais recente')).toBeDefined()

    // History toggle shows count
    const historyBtn = screen.getByText(/Ver historico completo/)
    expect(historyBtn).toBeDefined()
    expect(historyBtn.textContent).toContain('1')
  })

  it('ZoomModal CTA navigates to /cms/youtube/ab-lab/new with competitor params', () => {
    const change = makeChange({
      changeType: 'thumbnail',
      newThumbnailUrl: 'https://img.example.com/new-thumb.jpg',
    })

    render(<MudancasTab changes={[change]} channelNames={['Competitor Alpha']} />)

    // Click the "Testar esta abordagem" button on the card to open the zoom modal
    const ctaButtons = screen.getAllByText('Testar esta abordagem')
    fireEvent.click(ctaButtons[0])

    // Now we should see the ZoomModal — find the CTA button inside the modal footer
    const modalCtaButtons = screen.getAllByText('Testar esta abordagem')
    // The modal adds a second CTA button — click the last one (modal's)
    const modalCta = modalCtaButtons[modalCtaButtons.length - 1]
    fireEvent.click(modalCta)

    expect(pushMock).toHaveBeenCalledTimes(1)
    const pushedUrl = pushMock.mock.calls[0][0] as string
    expect(pushedUrl).toContain('/cms/youtube/ab-lab/new')
    expect(pushedUrl).toContain('ref=competitor')
    expect(pushedUrl).toContain('changeType=thumbnail')
    expect(pushedUrl).toContain('competitorThumb=')
  })

  it('ZoomModal CTA includes competitorTitle for title changes', () => {
    const change = makeChange({
      changeType: 'title',
      oldTitle: 'Before Title',
      newTitle: 'After Title Improved',
      oldThumbnailUrl: null,
      newThumbnailUrl: null,
    })

    render(<MudancasTab changes={[change]} channelNames={['Competitor Alpha']} />)

    // Open zoom modal
    const ctaButtons = screen.getAllByText('Testar esta abordagem')
    fireEvent.click(ctaButtons[0])

    // Click modal CTA
    const allCta = screen.getAllByText('Testar esta abordagem')
    fireEvent.click(allCta[allCta.length - 1])

    const pushedUrl = pushMock.mock.calls[0][0] as string
    expect(pushedUrl).toContain('ref=competitor')
    expect(pushedUrl).toContain('changeType=title')
    expect(pushedUrl).toContain('competitorTitle=')
  })

  it('filters by type correctly', () => {
    const thumbChange = makeChange({ id: 'c1', changeType: 'thumbnail', videoTitle: 'Thumb Video' })
    const titleChange = makeChange({ id: 'c2', changeType: 'title', videoTitle: 'Title Video', oldTitle: 'Old', newTitle: 'New' })

    render(<MudancasTab changes={[thumbChange, titleChange]} channelNames={[]} />)

    // Both visible initially
    expect(screen.getByText('Thumb Video')).toBeDefined()
    expect(screen.getByText('Title Video')).toBeDefined()

    // Filter to thumbnail only
    const typeSelect = screen.getByDisplayValue('Todos os tipos')
    fireEvent.change(typeSelect, { target: { value: 'thumbnail' } })

    expect(screen.getByText('Thumb Video')).toBeDefined()
    expect(screen.queryByText('Title Video')).toBeNull()
  })

  it('shows empty state when no changes match filters', () => {
    render(<MudancasTab changes={[]} channelNames={[]} />)
    expect(screen.getByText('Nenhuma mudança encontrada.')).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/*  Static analysis / honesty tests                                    */
/* ------------------------------------------------------------------ */

describe('mudancas-tab honesty', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/app/cms/(authed)/youtube/competitors/_components/mudancas-tab.tsx'),
    'utf-8',
  )

  it('ZoomModal CTA does not just close the modal', () => {
    expect(src).toContain('router.push')
    expect(src).toContain("ref: 'competitor'")
  })

  it('navigates to ab-lab/new route', () => {
    expect(src).toContain('/cms/youtube/ab-lab/new')
  })

  it('passes changeType as URL param', () => {
    expect(src).toContain("params.set('changeType'")
  })

  it('passes competitorThumb for thumbnail changes', () => {
    expect(src).toContain("params.set('competitorThumb'")
  })

  it('passes competitorTitle for title changes', () => {
    expect(src).toContain("params.set('competitorTitle'")
  })

  it('does not contain Math.random', () => {
    expect(src).not.toContain('Math.random')
  })

  it('does not contain fabricated metrics', () => {
    expect(src).not.toContain('ctr estimado')
    expect(src).not.toContain('taxa de clique')
  })
})
