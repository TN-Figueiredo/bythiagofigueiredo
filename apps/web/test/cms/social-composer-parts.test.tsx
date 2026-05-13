import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social/new'),
}))

import { ComposerEditor } from '@/app/cms/(authed)/social/new/_components/composer-editor'
import { TemplatePicker } from '@/app/cms/(authed)/social/new/_components/template-picker'
import { DraftReviewBanner } from '@/app/cms/(authed)/social/new/_components/draft-review-banner'
import { BilingualEditor } from '@/app/cms/(authed)/social/new/_components/bilingual-editor'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

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

// ── TemplatePicker ────────────────────────────────────────────────────────────

describe('TemplatePicker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the templates button', () => {
    render(<TemplatePicker onSelect={vi.fn()} strings={en} />)
    expect(screen.getByRole('button', { name: new RegExp(en.composer.template.title) })).toBeDefined()
  })

  it('opens dropdown when button is clicked', () => {
    render(<TemplatePicker onSelect={vi.fn()} strings={en} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.composer.template.title) }))
    expect(screen.getByRole('menu')).toBeDefined()
  })

  it('shows template options in dropdown', () => {
    render(<TemplatePicker onSelect={vi.fn()} strings={en} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.composer.template.title) }))
    expect(screen.getByText(en.composer.template.blogAnnouncement)).toBeDefined()
    expect(screen.getByText(en.composer.template.videoLaunch)).toBeDefined()
    expect(screen.getByText(en.composer.template.linkShare)).toBeDefined()
  })

  it('calls onSelect and closes dropdown when template is clicked', () => {
    const onSelect = vi.fn()
    render(<TemplatePicker onSelect={onSelect} strings={en} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.composer.template.title) }))
    const menuItems = screen.getAllByRole('menuitem')
    fireEvent.click(menuItems[0])
    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes dropdown on Escape key', () => {
    render(<TemplatePicker onSelect={vi.fn()} strings={en} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.composer.template.title) }))
    expect(screen.getByRole('menu')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shows create custom button in dropdown', () => {
    render(<TemplatePicker onSelect={vi.fn()} strings={en} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.composer.template.title) }))
    expect(screen.getByText(en.composer.template.createCustom)).toBeDefined()
  })
})

// ── DraftReviewBanner ─────────────────────────────────────────────────────────

describe('DraftReviewBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the banner alert', () => {
    render(<DraftReviewBanner source="blog-post" createdAt="2026-05-10T12:00:00Z" strings={en} />)
    expect(screen.getByRole('alert')).toBeDefined()
  })

  it('renders the banner text', () => {
    render(<DraftReviewBanner source="blog-post" createdAt="2026-05-10T12:00:00Z" strings={en} />)
    expect(screen.getByText(en.composer.draftReview.banner)).toBeDefined()
  })

  it('shows the source in the banner', () => {
    render(<DraftReviewBanner source="newsletter-sent" createdAt="2026-05-10T12:00:00Z" strings={en} />)
    const expected = en.composer.draftReview.source.replace('{source}', 'newsletter-sent')
    expect(screen.getByText((text) => text.includes('newsletter-sent'))).toBeDefined()
    expect(screen.getByText((text) => text.includes(expected.replace(' · ', '').trim()))).toBeDefined()
  })

  it('shows formatted created date', () => {
    const createdAt = '2026-05-10T12:00:00Z'
    render(<DraftReviewBanner source="blog" createdAt={createdAt} strings={en} />)
    const formatted = new Date(createdAt).toLocaleString()
    expect(screen.getByText((text) => text.includes(formatted))).toBeDefined()
  })
})

// ── BilingualEditor ────────────────────────────────────────────────────────────

describe('BilingualEditor', () => {
  const defaultProps = {
    enabled: false,
    onToggle: vi.fn(),
    ptContent: '',
    enContent: '',
    onPtChange: vi.fn(),
    onEnChange: vi.fn(),
    strings: en,
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders enable button when disabled', () => {
    render(<BilingualEditor {...defaultProps} />)
    expect(screen.getByRole('button', { name: en.composer.bilingual.enableEn })).toBeDefined()
  })

  it('calls onToggle(true) when enable button is clicked', () => {
    const onToggle = vi.fn()
    render(<BilingualEditor {...defaultProps} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: en.composer.bilingual.enableEn }))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('shows PT-BR and EN labels when enabled', () => {
    render(<BilingualEditor {...defaultProps} enabled={true} />)
    expect(screen.getByText(en.composer.bilingual.ptBr)).toBeDefined()
    expect(screen.getByText(en.composer.bilingual.en)).toBeDefined()
  })

  it('renders two textareas when enabled', () => {
    render(<BilingualEditor {...defaultProps} enabled={true} />)
    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBe(2)
  })

  it('shows auto-translate button when enabled', () => {
    render(<BilingualEditor {...defaultProps} enabled={true} />)
    expect(screen.getByText(en.composer.bilingual.autoTranslate)).toBeDefined()
  })

  it('calls onToggle(false) when close button clicked', () => {
    const onToggle = vi.fn()
    render(<BilingualEditor {...defaultProps} enabled={true} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('calls onPtChange when PT textarea changes', () => {
    const onPtChange = vi.fn()
    render(<BilingualEditor {...defaultProps} enabled={true} onPtChange={onPtChange} />)
    const textareas = screen.getAllByRole('textbox')
    fireEvent.change(textareas[0], { target: { value: 'Olá mundo' } })
    expect(onPtChange).toHaveBeenCalledWith('Olá mundo')
  })

  it('calls onEnChange when EN textarea changes', () => {
    const onEnChange = vi.fn()
    render(<BilingualEditor {...defaultProps} enabled={true} onEnChange={onEnChange} />)
    const textareas = screen.getAllByRole('textbox')
    fireEvent.change(textareas[1], { target: { value: 'Hello world' } })
    expect(onEnChange).toHaveBeenCalledWith('Hello world')
  })
})
