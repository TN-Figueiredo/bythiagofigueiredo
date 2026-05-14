import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// --- Navigation ---
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))

// --- Social actions (server actions) ---
const mockCreateSocialPost = vi.fn()
const mockGetContentForSocialPost = vi.fn()
const mockCreateFromContentAction = vi.fn()

vi.mock('@/lib/social/actions', () => ({
  createSocialPost: (...args: unknown[]) => mockCreateSocialPost(...args),
  getContentForSocialPost: (...args: unknown[]) => mockGetContentForSocialPost(...args),
  createFromContentAction: (...args: unknown[]) => mockCreateFromContentAction(...args),
}))

// --- Search content (used by ContentPicker) ---
vi.mock(
  '@/app/cms/(authed)/social/new/_actions/search-content',
  () => ({
    searchContent: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'blog-1',
          type: 'blog',
          title: 'My Blog Post',
          thumbnail: null,
          status: 'published',
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'newsletter-1',
          type: 'newsletter',
          title: 'My Newsletter',
          thumbnail: null,
          status: 'sent',
          updatedAt: new Date().toISOString(),
        },
      ],
      counts: { all: 2, blog: 1, newsletter: 1, campaign: 0, video: 0 },
    }),
  }),
)

// --- Queue (used by ScheduleBar) ---
vi.mock('@/lib/social/queue', () => ({
  getNextQueueSlot: vi.fn().mockResolvedValue(null),
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
      {...overrides}
    />,
  )
}

describe('ComposerShell redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSocialPost.mockResolvedValue({ ok: true, data: { id: 'new-1' } })
    mockGetContentForSocialPost.mockResolvedValue({ ok: false, error: 'not_found' })
    mockCreateFromContentAction.mockResolvedValue({ ok: true, data: { postId: 'p-1', shortLinkId: null } })
  })

  it('renders "Do CMS" and "Compor do zero" mode toggle buttons', () => {
    renderComposer()
    expect(screen.getByText('Do CMS')).toBeDefined()
    expect(screen.getByText('Compor do zero')).toBeDefined()
  })

  it('defaults to CMS mode — "Do CMS" button has accent class', () => {
    renderComposer()
    const cmsModeButton = screen.getByText('Do CMS').closest('button')
    expect(cmsModeButton?.className).toContain('cms-accent')
  })

  it('renders ContentPicker in CMS mode with Blog and Newsletter tabs', () => {
    renderComposer()
    expect(screen.getByText('Blog')).toBeDefined()
    expect(screen.getByText('Newsletter')).toBeDefined()
  })

  it('renders schedule bar with Agora, Agendar, Fila buttons', () => {
    renderComposer()
    expect(screen.getByText('Agora')).toBeDefined()
    expect(screen.getByText('Agendar')).toBeDefined()
    expect(screen.getByText('Fila')).toBeDefined()
  })

  it('renders Salvar Rascunho button', () => {
    renderComposer()
    expect(screen.getByText('Salvar Rascunho')).toBeDefined()
  })

  it('switches to freeform mode — hides ContentPicker (no Blog tab)', () => {
    renderComposer()
    fireEvent.click(screen.getByText('Compor do zero'))
    // In freeform mode ContentPicker hides the content list tabs
    // The mode toggle buttons remain, but Blog/Newsletter content tabs disappear
    const allBlogElements = screen.queryAllByText('Blog')
    // All "Blog" text elements should be gone (the tabs inside the CMS picker are hidden)
    expect(allBlogElements.length).toBe(0)
  })

  it('in freeform mode renders the text composer editor', () => {
    renderComposer()
    fireEvent.click(screen.getByText('Compor do zero'))
    expect(
      screen.getByPlaceholderText(en.composer.editor.contentPlaceholder),
    ).toBeDefined()
  })

  it('renders platform selector', () => {
    renderComposer()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })
})
