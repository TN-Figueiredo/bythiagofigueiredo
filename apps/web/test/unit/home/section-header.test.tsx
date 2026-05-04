import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SectionHeader } from '../../../src/app/(public)/components/SectionHeader'

describe('SectionHeader', () => {
  it('renders section number and label', () => {
    const { getByText } = render(
      <SectionHeader number="02" label="blog" title="Últimos escritos" subtitle="os 6 mais recentes" />
    )
    expect(getByText(/§ 02/)).toBeDefined()
    expect(getByText(/blog/)).toBeDefined()
    expect(getByText('Últimos escritos')).toBeDefined()
    expect(getByText('os 6 mais recentes')).toBeDefined()
  })

  it('renders right-side link when provided', () => {
    const { getByText } = render(
      <SectionHeader number="02" label="blog" title="Latest" linkText="see all →" linkHref="/blog" />
    )
    const link = getByText('see all →')
    expect(link.closest('a')?.getAttribute('href')).toBe('/blog')
  })

  it('has section-kicker data-testid', () => {
    const { container } = render(
      <SectionHeader number="02" label="blog" title="Latest" />
    )
    expect(container.querySelector('[data-testid="section-kicker"]')).not.toBeNull()
  })

  it('accepts custom kicker color', () => {
    const { container } = render(
      <SectionHeader number="03" label="do canal" title="Últimos vídeos" kickerColor="var(--pb-yt)" />
    )
    expect(container.querySelector('[data-testid="section-kicker"]')).not.toBeNull()
  })
})
