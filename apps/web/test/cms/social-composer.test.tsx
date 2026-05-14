import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))

const mockCreate = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  createSocialPost: (...args: unknown[]) => mockCreate(...args),
  getContentForSocialPost: vi.fn().mockResolvedValue({ ok: false, error: 'not_found' }),
  createFromContentAction: vi.fn().mockResolvedValue({ ok: true, data: { postId: 'p-1', shortLinkId: null } }),
}))

vi.mock('@/lib/social/queue', () => ({
  getNextQueueSlot: vi.fn().mockResolvedValue(null),
}))

vi.mock(
  '@/app/cms/(authed)/social/new/_actions/search-content',
  () => ({
    searchContent: vi.fn().mockResolvedValue({
      items: [],
      counts: { all: 0, blog: 0, newsletter: 0, campaign: 0, video: 0 },
    }),
  }),
)

import { ComposerShell } from '@/app/cms/(authed)/social/new/_components/composer-shell'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockConnections = [
  { provider: 'facebook' as const, account_name: 'My Page' },
  { provider: 'instagram' as const, account_name: '@me' },
  { provider: 'bluesky' as const, account_name: '@me.bsky' },
]

function renderComposer(overrides: Record<string, unknown> = {}) {
  return render(
    <ComposerShell
      connections={mockConnections}
      strings={en}
      initialMode="text"
      initialSourceMode="freeform"
      {...overrides}
    />,
  )
}

describe('ComposerShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ ok: true, data: { id: 'new-1' } })
  })

  it('renders mode tabs', () => {
    renderComposer()
    expect(screen.getByText(en.composer.modes.text)).toBeDefined()
    expect(screen.getByText(en.composer.modes.image)).toBeDefined()
    expect(screen.getByText(en.composer.modes.video)).toBeDefined()
  })

  it('renders content textarea in text mode', () => {
    renderComposer()
    expect(
      screen.getByPlaceholderText(en.composer.editor.contentPlaceholder),
    ).toBeDefined()
  })

  it('renders URL input', () => {
    renderComposer()
    expect(
      screen.getByPlaceholderText(en.composer.editor.urlPlaceholder),
    ).toBeDefined()
  })

  it('renders platform selector with connected platforms', () => {
    renderComposer()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('renders schedule bar', () => {
    renderComposer()
    // ScheduleBar uses hard-coded Portuguese labels
    expect(screen.getByText('Agora')).toBeDefined()
    expect(screen.getByText('Agendar')).toBeDefined()
    expect(screen.getByText('Fila')).toBeDefined()
  })

  it('submits post on publish', async () => {
    renderComposer()
    const textarea = screen.getByPlaceholderText(
      en.composer.editor.contentPlaceholder,
    )
    fireEvent.change(textarea, { target: { value: 'Hello world!' } })
    fireEvent.click(screen.getByText('Facebook'))
    // ScheduleBar renders "Publicar" in "Agora" mode
    fireEvent.click(screen.getByText('Publicar'))
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce()
    })
  })

  it('switches to image mode on tab click', () => {
    renderComposer()
    fireEvent.click(screen.getByText(en.composer.modes.image))
    // Image composer renders its "Add images" label instead of the text textarea
    expect(screen.getByText(en.composer.image.addImages)).toBeDefined()
    // Text textarea should be gone
    expect(screen.queryByPlaceholderText(en.composer.editor.contentPlaceholder)).toBeNull()
  })

  it('toggles a platform off after selecting it', () => {
    renderComposer()
    const fbButton = screen.getByText('Facebook')
    // Select Facebook
    fireEvent.click(fbButton)
    // aria-pressed should now be 'true'
    expect(fbButton.closest('button')!.getAttribute('aria-pressed')).toBe('true')
    // Toggle it off
    fireEvent.click(fbButton)
    expect(fbButton.closest('button')!.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows character count when platform is selected', () => {
    renderComposer()
    // Select Bluesky to trigger character limit display
    fireEvent.click(screen.getByText('Bluesky'))
    const textarea = screen.getByPlaceholderText(en.composer.editor.contentPlaceholder)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    // Character count should show "5 / <limit>"
    expect(screen.getByText(/5\s*\/\s*\d+/)).toBeDefined()
  })

  it('renders Salvar Rascunho button', () => {
    renderComposer()
    expect(screen.getByText('Salvar Rascunho')).toBeDefined()
  })
})
