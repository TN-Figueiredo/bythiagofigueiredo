import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// Mock the server action
vi.mock('../../../src/app/(public)/actions/subscribe-newsletters', () => ({
  subscribeToNewsletters: vi.fn().mockResolvedValue({ success: true, subscribedIds: ['main-en'] }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { NewslettersHub } from '../../../src/app/(public)/newsletters/components/NewslettersHub'

function renderHub(props?: Partial<{ locale: 'en' | 'pt-BR'; currentTheme: 'dark' | 'light' }>) {
  return render(
    <NewslettersHub
      locale={props?.locale ?? 'en'}
      currentTheme={props?.currentTheme ?? 'dark'}
    />,
  )
}

describe('NewslettersHub — card selection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders all 4 newsletter cards', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    expect(cards).toHaveLength(4)
  })

  it('all 4 cards are selected by default', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    cards.forEach(card => {
      expect(card.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('clicking a selected card deselects it', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
  })

  it('clicking a deselected card selects it', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    // Deselect first
    fireEvent.click(cards[0]!)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
    // Re-select
    fireEvent.click(cards[0]!)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('true')
  })

  it('selected card shows ADDED badge', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    // First card is selected by default
    expect(within(cards[0]!).getByText(/ADDED/i)).toBeTruthy()
  })

  it('deselected card shows + add badge', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    expect(within(cards[0]!).getByText(/add/i)).toBeTruthy()
  })
})

describe('NewslettersHub — accessibility', () => {
  it('each card has aria-label with name and cadence', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    // First card: "The bythiago diary"
    expect(cards[0]!.getAttribute('aria-label')).toContain('The bythiago diary')
    expect(cards[0]!.getAttribute('aria-label')).toContain('weekly, Fridays')
  })

  it('keyboard Enter toggles card', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.keyDown(cards[0]!, { key: 'Enter' })
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
  })

  it('keyboard Space toggles card', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.keyDown(cards[0]!, { key: ' ' })
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
  })

  it('has aria-live region for announcements', () => {
    renderHub()
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
  })

  it('aria-live region announces count after toggle', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toContain('3 of 4')
  })

  it('cards have tabIndex=0 for focus', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    cards.forEach(card => {
      expect(card.getAttribute('tabindex')).toBe('0')
    })
  })

  it('email input has autocomplete=email', () => {
    renderHub()
    const emailInput = document.querySelector('input[type="email"]')
    expect(emailInput?.getAttribute('autocomplete')).toBe('email')
  })
})

describe('NewslettersHub — controls', () => {
  it('shows hero counter with all 4 selected by default', () => {
    renderHub()
    const matches = screen.getAllByText(/all 4/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('hero counter updates on deselect', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    const matches = screen.getAllByText(/3.*of 4/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('Select All shows "all selected" state when all checked', () => {
    renderHub()
    // All are already selected
    expect(screen.getByText(/all selected/i)).toBeTruthy()
  })

  it('clicking Clear deselects all cards', () => {
    renderHub()
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    const cards = screen.getAllByRole('checkbox')
    cards.forEach(card => {
      expect(card.getAttribute('aria-checked')).toBe('false')
    })
  })

  it('clicking Select All selects all cards', () => {
    renderHub()
    // First clear all
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    // Then select all
    const selectAllBtn = screen.getByRole('button', { name: /select all/i })
    fireEvent.click(selectAllBtn)
    const cards = screen.getAllByRole('checkbox')
    cards.forEach(card => {
      expect(card.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('Clear is disabled when no cards selected', () => {
    renderHub()
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    // Now clear should be disabled
    expect(clearBtn.getAttribute('aria-disabled')).toBe('true')
  })
})

describe('NewslettersHub — sticky bar', () => {
  it('shows pill for each selected newsletter', () => {
    renderHub()
    const pillContainer = screen.getByRole('list')
    const pills = within(pillContainer).getAllByRole('listitem')
    expect(pills).toHaveLength(4)
  })

  it('removing a pill deselects the corresponding card', () => {
    renderHub()
    const pillContainer = screen.getByRole('list')
    const pills = within(pillContainer).getAllByRole('listitem')
    // Click the remove button on the first pill
    const removeBtn = within(pills[0]!).getByRole('button')
    fireEvent.click(removeBtn)
    // Card should now be deselected
    const cards = screen.getAllByRole('checkbox')
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
  })

  it('shows "pick at least one" when no cards selected', () => {
    renderHub()
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    const matches = screen.getAllByText(/pick at least one/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('subscribe button is disabled when no cards selected', () => {
    renderHub()
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    const submitBtn = screen.getByRole('button', { name: /subscribe/i })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('subscribe button is disabled when email is empty', () => {
    renderHub()
    const submitBtn = screen.getByRole('button', { name: /subscribe/i })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('NewslettersHub — i18n (pt-BR)', () => {
  it('renders Portuguese card names', () => {
    renderHub({ locale: 'pt-BR' })
    const matches = screen.getAllByText('Diário do bythiago', { exact: false })
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders Portuguese controls', () => {
    renderHub({ locale: 'pt-BR' })
    // "all selected" state shows as status span, desmarcar as button
    expect(screen.getByText(/todas selecionadas/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /desmarcar/i })).toBeTruthy()
    // Deselect one to reveal "marcar todas" button
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    expect(screen.getByRole('button', { name: /marcar todas/i })).toBeTruthy()
  })

  it('renders Portuguese counter', () => {
    renderHub({ locale: 'pt-BR' })
    const matches = screen.getAllByText(/todas 4/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('shows Portuguese "pick at least one" when empty', () => {
    renderHub({ locale: 'pt-BR' })
    const clearBtn = screen.getByRole('button', { name: /desmarcar/i })
    fireEvent.click(clearBtn)
    const matches = screen.getAllByText(/marca pelo menos uma/i)
    expect(matches.length).toBeGreaterThan(0)
  })
})

describe('NewslettersHub — light theme', () => {
  it('renders all 4 cards in light theme', () => {
    renderHub({ currentTheme: 'light' })
    const cards = screen.getAllByRole('checkbox')
    expect(cards).toHaveLength(4)
  })

  it('all cards are selected by default in light theme', () => {
    renderHub({ currentTheme: 'light' })
    const cards = screen.getAllByRole('checkbox')
    cards.forEach(card => {
      expect(card.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('toggle works in light theme', () => {
    renderHub({ currentTheme: 'light' })
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
  })
})
