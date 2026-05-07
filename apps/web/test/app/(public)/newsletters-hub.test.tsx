import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { HubNewsletterType } from '../../../lib/newsletter/queries'

vi.mock('../../../src/app/(public)/actions/subscribe-newsletters', () => ({
  subscribeToNewsletters: vi.fn().mockResolvedValue({ success: true, subscribedIds: ['nl-1'] }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { NewslettersHub } from '../../../src/app/(public)/newsletters/components/NewslettersHub'

const MOCK_TYPES_EN: HubNewsletterType[] = [
  { id: 'nl-1', slug: 'the-bythiago-diary', name: 'The bythiago diary', tagline: 'the week in review', color: '#C14513', colorDark: '#FF8240', badge: 'main', cadenceLabel: 'weekly, Fridays', subscriberCount: 1240, editionsCount: 34, latestEditionSubject: 'week 17', locale: 'en' },
  { id: 'nl-2', slug: 'curves-and-roads', name: 'Curves & roads', tagline: 'motorcycle trips', color: '#2C6E49', colorDark: '#5FA87D', badge: 'new', cadenceLabel: 'whenever I hit the road', subscriberCount: 182, editionsCount: 4, latestEditionSubject: 'serra da canastra', locale: 'en' },
  { id: 'nl-3', slug: 'grow-inward', name: 'Grow inward', tagline: 'habits, books', color: '#6B4A91', colorDark: '#A983D6', badge: null, cadenceLabel: 'every 2 weeks, Sundays', subscriberCount: 408, editionsCount: 11, latestEditionSubject: 'productivity', locale: 'en' },
  { id: 'nl-4', slug: 'code-in-portuguese', name: 'Code in Portuguese', tagline: 'stack decisions', color: '#1F5F8B', colorDark: '#5FA8E0', badge: null, cadenceLabel: 'monthly, last Thursday', subscriberCount: 620, editionsCount: 8, latestEditionSubject: 'postgres', locale: 'en' },
]

const MOCK_TYPES_PT: HubNewsletterType[] = [
  { id: 'nl-1-pt', slug: 'diario-do-bythiago', name: 'Diário do bythiago', tagline: 'o resumo da semana', color: '#C14513', colorDark: '#FF8240', badge: 'principal', cadenceLabel: '1x por semana, sextas', subscriberCount: 1240, editionsCount: 34, latestEditionSubject: 'semana 17', locale: 'pt-BR' },
  { id: 'nl-2-pt', slug: 'curvas-e-estradas', name: 'Curvas & estradas', tagline: 'relatos de moto', color: '#2C6E49', colorDark: '#5FA87D', badge: 'novo', cadenceLabel: 'quando eu pegar estrada', subscriberCount: 182, editionsCount: 4, latestEditionSubject: 'serra da canastra', locale: 'pt-BR' },
  { id: 'nl-3-pt', slug: 'crescer-de-dentro', name: 'Crescer de dentro', tagline: 'hábitos, leituras', color: '#6B4A91', colorDark: '#A983D6', badge: null, cadenceLabel: 'a cada 2 semanas, domingos', subscriberCount: 408, editionsCount: 11, latestEditionSubject: 'produtividade', locale: 'pt-BR' },
  { id: 'nl-4-pt', slug: 'codigo-em-portugues', name: 'Código em português', tagline: 'decisões de stack', color: '#1F5F8B', colorDark: '#5FA8E0', badge: null, cadenceLabel: 'mensal, última quinta', subscriberCount: 620, editionsCount: 8, latestEditionSubject: 'postgres', locale: 'pt-BR' },
]

function renderHub(props?: Partial<{ locale: 'en' | 'pt-BR'; currentTheme: 'dark' | 'light'; types: HubNewsletterType[] }>) {
  const locale = props?.locale ?? 'en'
  const types = props?.types ?? (locale === 'pt-BR' ? MOCK_TYPES_PT : MOCK_TYPES_EN)
  return render(
    <NewslettersHub
      locale={locale}
      currentTheme={props?.currentTheme ?? 'dark'}
      types={types}
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
    fireEvent.click(cards[0]!)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(cards[0]!)
    expect(cards[0]!.getAttribute('aria-checked')).toBe('true')
  })

  it('selected card shows SELECTED badge', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    expect(within(cards[0]!).getByText(/SELECTED/i)).toBeTruthy()
  })

  it('deselected card shows + select badge', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    expect(within(cards[0]!).getByText(/select/i)).toBeTruthy()
  })
})

describe('NewslettersHub — accessibility', () => {
  it('each card has aria-label with name and cadence', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
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
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
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
    const removeBtn = within(pills[0]!).getByRole('button')
    fireEvent.click(removeBtn)
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
    expect(screen.getByText(/todas selecionadas/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /desmarcar/i })).toBeTruthy()
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

describe('NewslettersHub — announcements', () => {
  it('announces selected message with name and count', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    fireEvent.click(cards[0]!)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toContain('selected')
    expect(liveRegion?.textContent).toContain('4 of 4')
  })

  it('announces deselected message with name and count', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toContain('deselected')
    expect(liveRegion?.textContent).toContain('The bythiago diary')
  })

  it('keyboard Space toggle produces announcement', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.keyDown(cards[1]!, { key: ' ' })
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toContain('deselected')
    expect(liveRegion?.textContent).toContain('3 of 4')
  })

  it('pill remove button triggers announcement', () => {
    renderHub()
    const pillContainer = screen.getByRole('list')
    const pills = within(pillContainer).getAllByRole('listitem')
    const removeBtn = within(pills[1]!).getByRole('button')
    fireEvent.click(removeBtn)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toContain('deselected')
    expect(liveRegion?.textContent).toContain('3 of 4')
  })
})

describe('NewslettersHub — subscribe form', () => {
  it('subscribe button enabled when email valid and cards selected', () => {
    renderHub()
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    const submitBtn = screen.getByRole('button', { name: /subscribe/i })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false)
  })

  it('subscribe button disabled with invalid email even when cards selected', () => {
    renderHub()
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'notanemail' } })
    const submitBtn = screen.getByRole('button', { name: /subscribe/i })
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('pills container is absent when no cards selected', () => {
    renderHub()
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('NewslettersHub — deselected card badge', () => {
  it('deselected card shows "+ select" badge text (not SELECTED)', () => {
    renderHub()
    const cards = screen.getAllByRole('checkbox')
    fireEvent.click(cards[0]!)
    const card = cards[0]!
    expect(within(card).queryByText(/SELECTED/)).toBeNull()
    expect(within(card).getByText((content) => content.includes('select') && !content.includes('SELECTED'))).toBeTruthy()
  })
})

describe('NewslettersHub — learn more links', () => {
  it('each card has a learn more link', () => {
    renderHub()
    const links = screen.getAllByText(/learn more/i)
    expect(links).toHaveLength(4)
  })

  it('learn more links have correct href for locale', () => {
    renderHub({ locale: 'pt-BR' })
    const links = screen.getAllByText(/saiba mais/i)
    expect(links[0]!.closest('a')?.getAttribute('href')).toContain('/newsletters/')
  })
})

describe('NewslettersHub — empty state', () => {
  it('shows empty message when no types', () => {
    renderHub({ types: [] })
    expect(screen.getByText(/no newsletters available/i)).toBeTruthy()
  })

  it('shows back home link in empty state', () => {
    renderHub({ types: [] })
    expect(screen.getByText(/back to home/i)).toBeTruthy()
  })
})

describe('NewslettersHub — single newsletter', () => {
  it('renders single card without select all/clear controls', () => {
    const single = [MOCK_TYPES_EN[0]!]
    renderHub({ types: single })
    const cards = screen.getAllByRole('checkbox')
    expect(cards).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /select all/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull()
  })

  it('single newsletter is selected by default', () => {
    const single = [MOCK_TYPES_EN[0]!]
    renderHub({ types: single })
    const card = screen.getByRole('checkbox')
    expect(card.getAttribute('aria-checked')).toBe('true')
  })
})

describe('NewslettersHub — dynamic stats', () => {
  it('shows formatted subscriber count', () => {
    renderHub()
    expect(screen.getByText(/1,240 subscribers/)).toBeTruthy()
  })

  it('shows formatted editions count', () => {
    renderHub()
    expect(screen.getByText(/34 issues/)).toBeTruthy()
  })

  it('shows latest edition subject in sample box', () => {
    renderHub()
    expect(screen.getByText(/week 17/)).toBeTruthy()
  })
})
