import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { FaqAccordion } from '@/app/(public)/newsletters/[slug]/faq-accordion'

const items = [
  { q: 'Is this free?', a: 'Yes. Free forever.' },
  { q: 'How often?', a: 'Depends on the newsletter.' },
  { q: 'Can I unsubscribe?', a: 'Yes, one click.' },
]

describe('FaqAccordion', () => {
  it('renders all questions', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    expect(screen.getByText('Is this free?')).toBeDefined()
    expect(screen.getByText('How often?')).toBeDefined()
    expect(screen.getByText('Can I unsubscribe?')).toBeDefined()
  })

  it('first item is open by default', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
    expect(buttons[1].getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles item on click', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('has correct aria-controls and role="region"', () => {
    const { container } = render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const regions = container.querySelectorAll('[role="region"]')
    expect(regions.length).toBe(items.length)
    const firstBtn = screen.getAllByRole('button')[0]
    const panelId = firstBtn.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    // Use attribute selector to handle React useId() colon-containing IDs
    expect(container.querySelector(`[id="${panelId}"]`)).toBeTruthy()
  })

  it('toggles via Enter key', () => {
    render(<FaqAccordion items={items} sectionTitle="Questions" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.keyDown(buttons[1], { key: 'Enter' })
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  })
})
