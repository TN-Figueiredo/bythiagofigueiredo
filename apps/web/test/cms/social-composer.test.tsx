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
}))

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
    expect(screen.getByText(en.composer.schedule.now)).toBeDefined()
    expect(screen.getByText(en.composer.schedule.scheduled)).toBeDefined()
    expect(screen.getByText(en.composer.schedule.queue)).toBeDefined()
  })

  it('submits post on publish', async () => {
    renderComposer()
    const textarea = screen.getByPlaceholderText(
      en.composer.editor.contentPlaceholder,
    )
    fireEvent.change(textarea, { target: { value: 'Hello world!' } })
    fireEvent.click(screen.getByText('Facebook'))
    fireEvent.click(screen.getByText(en.composer.schedule.publish))
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce()
    })
  })
})
