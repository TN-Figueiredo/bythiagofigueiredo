// @vitest-environment happy-dom
/**
 * NOTE: the TemplatePicker / DraftReviewBanner / BilingualEditor suites that
 * used to live here tested components deleted in 35b6a0f7 (2026-05-30 dead-file
 * cleanup) — the file failed module resolution ever since. ComposerEditor is
 * still live and keeps its suite; TemplateCarousel (template-picker's
 * successor) is pinned below.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social/new'),
}))

import { ComposerEditor } from '@/app/cms/(authed)/social/new/_components/composer-editor'
import { TemplateCarousel } from '@/app/cms/(authed)/social/new/_components/template-carousel'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

afterEach(() => cleanup())

// ── ComposerEditor ─────────────────────────────────────────────────────────────

describe('ComposerEditor', () => {
  const defaultProps = {
    content: '',
    url: '',
    hashtags: [] as string[],
    selectedPlatforms: [] as string[],
    onContentChange: vi.fn(),
    onUrlChange: vi.fn(),
    onHashtagsChange: vi.fn(),
    strings: en,
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders content textarea', () => {
    render(<ComposerEditor {...defaultProps} />)
    expect(screen.getByPlaceholderText(en.composer.editor.contentPlaceholder)).toBeDefined()
  })

  it('renders URL input', () => {
    render(<ComposerEditor {...defaultProps} />)
    expect(screen.getByPlaceholderText(en.composer.editor.urlPlaceholder)).toBeDefined()
  })

  it('renders hashtags input', () => {
    render(<ComposerEditor {...defaultProps} />)
    expect(screen.getByPlaceholderText(en.composer.editor.hashtagsPlaceholder)).toBeDefined()
  })

  it('calls onContentChange when textarea changes', () => {
    const onContentChange = vi.fn()
    render(<ComposerEditor {...defaultProps} onContentChange={onContentChange} />)
    fireEvent.change(screen.getByPlaceholderText(en.composer.editor.contentPlaceholder), { target: { value: 'Hello' } })
    expect(onContentChange).toHaveBeenCalledWith('Hello')
  })

  it('shows char count when a platform with a limit is selected', () => {
    // Bluesky has a 300 char limit
    render(<ComposerEditor {...defaultProps} content="Hi" selectedPlatforms={['bluesky'] as never} />)
    expect(screen.getByText(/2\s*\/\s*300/)).toBeDefined()
  })

  it('does not show char count when no platform is selected', () => {
    render(<ComposerEditor {...defaultProps} content="Hi" selectedPlatforms={[]} />)
    expect(screen.queryByText(/\/\s*\d+/)).toBeNull()
  })

  it('adds hashtag on Enter key', () => {
    const onHashtagsChange = vi.fn()
    render(<ComposerEditor {...defaultProps} onHashtagsChange={onHashtagsChange} />)
    const input = screen.getByPlaceholderText(en.composer.editor.hashtagsPlaceholder)
    fireEvent.change(input, { target: { value: 'typescript' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onHashtagsChange).toHaveBeenCalledWith(['#typescript'])
  })

  it('renders existing hashtag chips', () => {
    render(<ComposerEditor {...defaultProps} hashtags={['#react', '#typescript']} />)
    expect(screen.getByText('#react')).toBeDefined()
    expect(screen.getByText('#typescript')).toBeDefined()
  })
})

// ── TemplateCarousel ───────────────────────────────────────────────────────────

describe('TemplateCarousel', () => {
  const templates = [
    { id: 't1', name: 'Story Clean', aspect_ratio: '9:16' as const, thumbnail_url: null, is_default: true },
    { id: 't2', name: 'Quote Square', aspect_ratio: '1:1' as const, thumbnail_url: null, is_default: false },
    { id: 't3', name: 'Wide Banner', aspect_ratio: '16:9' as const, thumbnail_url: null, is_default: false },
  ]

  beforeEach(() => vi.clearAllMocks())

  it('renders a listbox with one option per template', () => {
    render(<TemplateCarousel templates={templates} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByRole('listbox', { name: 'Template selection' })).toBeDefined()
    expect(screen.getAllByRole('option').length).toBe(3)
  })

  it('marks the selected template with aria-selected', () => {
    render(<TemplateCarousel templates={templates} selectedId="t2" onSelect={vi.fn()} />)
    const options = screen.getAllByRole('option')
    expect(options.map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
  })

  it('calls onSelect with the template id on click', () => {
    const onSelect = vi.fn()
    render(<TemplateCarousel templates={templates} selectedId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('option')[1]!)
    expect(onSelect).toHaveBeenCalledWith('t2')
  })

  it('navigates with arrow keys', () => {
    const onSelect = vi.fn()
    const { container } = render(<TemplateCarousel templates={templates} selectedId="t2" onSelect={onSelect} />)
    const root = container.querySelector('[tabindex="0"]')!
    fireEvent.keyDown(root, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('t3')
    fireEvent.keyDown(root, { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith('t1')
  })

  it('renders skeletons while loading', () => {
    const { container } = render(<TemplateCarousel templates={[]} selectedId={null} onSelect={vi.fn()} isLoading />)
    expect(container.querySelectorAll('.animate-pulse').length).toBe(4)
  })

  it('renders empty message when no templates match', () => {
    render(<TemplateCarousel templates={[]} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Nenhum template disponivel para esta plataforma')).toBeDefined()
  })
})
