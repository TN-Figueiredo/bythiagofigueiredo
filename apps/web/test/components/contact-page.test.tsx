import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeroSection } from '../../src/app/(public)/contact/_components/hero-section'
import { FaqSection } from '../../src/app/(public)/contact/_components/faq-section'
import { SocialLinksColumn } from '../../src/app/(public)/contact/_components/social-links-column'
import { DEFAULT_SETTINGS_EN, DEFAULT_VISIBILITY } from '../../src/lib/contact/defaults'
import type { ContactPageSettings, ContactPageVisibility, ContactAuthorData } from '../../src/lib/contact/types'

const mockSettings: ContactPageSettings = {
  id: '1',
  site_id: 's1',
  locale: 'en',
  ...DEFAULT_SETTINGS_EN,
}

const mockVis: ContactPageVisibility = {
  id: '1',
  site_id: 's1',
  ...DEFAULT_VISIBILITY,
}

const mockAuthor: ContactAuthorData = {
  name: 'Test Author',
  avatar_url: 'https://example.com/avatar.jpg',
  social_links: { email: 'test@test.com', github: 'https://github.com/test' },
  headline: 'Test Headline',
  bio: 'Test bio text',
}

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------

describe('HeroSection', () => {
  it('renders title', () => {
    render(<HeroSection settings={mockSettings} visibility={mockVis} author={mockAuthor} />)
    // hero_title from DEFAULT_SETTINGS_EN is "Let's talk?" — split into "Let's" + "talk?"
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toContain("talk?")
  })

  it('hides when show_hero is false', () => {
    const vis = { ...mockVis, show_hero: false }
    const { container } = render(
      <HeroSection settings={mockSettings} visibility={vis} author={mockAuthor} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('hides avatar when show_avatar is false', () => {
    const vis = { ...mockVis, show_avatar: false }
    render(<HeroSection settings={mockSettings} visibility={vis} author={mockAuthor} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows avatar img when show_avatar is true and author has avatar_url', () => {
    render(<HeroSection settings={mockSettings} visibility={mockVis} author={mockAuthor} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg')
  })

  it('shows response badge with text', () => {
    render(<HeroSection settings={mockSettings} visibility={mockVis} author={mockAuthor} />)
    expect(screen.getByText(mockSettings.response_time_text)).toBeTruthy()
  })

  it('hides response badge when show_response_badge is false', () => {
    const vis = { ...mockVis, show_response_badge: false }
    render(<HeroSection settings={mockSettings} visibility={vis} author={mockAuthor} />)
    expect(screen.queryByText(mockSettings.response_time_text)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FaqSection
// ---------------------------------------------------------------------------

const faqItems = [
  { q: 'What is your return policy?', a: 'We accept returns within 30 days.' },
  { q: 'Do you ship internationally?', a: 'Yes, we ship worldwide.' },
]

describe('FaqSection', () => {
  it('renders FAQ items', () => {
    render(<FaqSection items={faqItems} locale="en" />)
    expect(screen.getByText('What is your return policy?')).toBeTruthy()
    expect(screen.getByText('Do you ship internationally?')).toBeTruthy()
  })

  it('returns null when empty', () => {
    const { container } = render(<FaqSection items={[]} locale="en" />)
    expect(container.firstChild).toBeNull()
  })

  it('expands item on click', () => {
    render(<FaqSection items={faqItems} locale="en" />)
    // Answer should not be visible initially
    expect(screen.queryByText('We accept returns within 30 days.')).toBeNull()
    // Click the first question button
    fireEvent.click(screen.getByText('What is your return policy?'))
    // Answer should now be visible
    expect(screen.getByText('We accept returns within 30 days.')).toBeTruthy()
  })

  it('collapses expanded item on second click', () => {
    render(<FaqSection items={faqItems} locale="en" />)
    fireEvent.click(screen.getByText('What is your return policy?'))
    expect(screen.getByText('We accept returns within 30 days.')).toBeTruthy()
    fireEvent.click(screen.getByText('What is your return policy?'))
    expect(screen.queryByText('We accept returns within 30 days.')).toBeNull()
  })

  it('renders the "Frequently asked questions" heading for en locale', () => {
    render(<FaqSection items={faqItems} locale="en" />)
    expect(screen.getByText('Frequently asked questions')).toBeTruthy()
  })

  it('renders the pt-BR heading for pt-BR locale', () => {
    render(<FaqSection items={faqItems} locale="pt-BR" />)
    expect(screen.getByText('Perguntas frequentes')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SocialLinksColumn
// ---------------------------------------------------------------------------

describe('SocialLinksColumn', () => {
  beforeEach(() => {
    // Mock clipboard API — navigator.clipboard is a getter-only property
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
  })

  it('renders visible social links', () => {
    const vis: ContactPageVisibility = {
      ...mockVis,
      social_order: ['email', 'github'],
      social_visible: { email: true, github: true },
      handwritten_note: false,
    }
    render(<SocialLinksColumn visibility={vis} author={mockAuthor} locale="en" />)
    // email and github buttons should be present via aria-label
    expect(screen.getByRole('button', { name: /Email/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /GitHub/i })).toBeTruthy()
  })

  it('hides when show_social_links is false', () => {
    const vis = { ...mockVis, show_social_links: false }
    const { container } = render(
      <SocialLinksColumn visibility={vis} author={mockAuthor} locale="en" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when author is null', () => {
    const { container } = render(
      <SocialLinksColumn visibility={mockVis} author={null} locale="en" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('hides a link when social_visible sets it to false', () => {
    const vis: ContactPageVisibility = {
      ...mockVis,
      social_order: ['email', 'github'],
      social_visible: { email: true, github: false },
      handwritten_note: false,
    }
    render(<SocialLinksColumn visibility={vis} author={mockAuthor} locale="en" />)
    expect(screen.getByRole('button', { name: /Email/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /GitHub/i })).toBeNull()
  })

  it('shows handwritten note when enabled', () => {
    const vis: ContactPageVisibility = {
      ...mockVis,
      social_order: [],
      social_visible: {},
      handwritten_note: true,
    }
    const authorNoLinks: ContactAuthorData = { ...mockAuthor, social_links: {} }
    render(<SocialLinksColumn visibility={vis} author={authorNoLinks} locale="en" />)
    expect(screen.getByText('↑ email = fastest way')).toBeTruthy()
  })
})
