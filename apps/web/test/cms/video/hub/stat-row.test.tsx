import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatRow } from '@/app/cms/(authed)/video/_components/stat-row'

describe('StatRow', () => {
  it('renders four cards in order with the fixed accent var mapping', () => {
    const { container } = render(
      <StatRow stats={{ total: 9, roteiro: 3, gravacao: 2, published: 4 }} />,
    )
    const cards = Array.from(container.querySelectorAll('.stat-card'))
    expect(cards).toHaveLength(4)
    const accents = cards.map((c) => (c.getAttribute('style') ?? ''))
    expect(accents[0]).toContain('var(--text)')
    expect(accents[1]).toContain('var(--c-pipeline)')
    expect(accents[2]).toContain('var(--warn)')
    expect(accents[3]).toContain('var(--c-links)')
  })

  it('binds the correct count and label to each card', () => {
    const { container } = render(
      <StatRow stats={{ total: 9, roteiro: 3, gravacao: 2, published: 4 }} />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('Total')
    expect(text).toContain('Em roteiro')
    expect(text).toContain('Prontos p/ gravar')
    expect(text).toContain('Publicados')
    const ns = Array.from(container.querySelectorAll('.stat-card-n')).map((n) => n.textContent)
    expect(ns).toEqual(['9', '3', '2', '4'])
  })
})
