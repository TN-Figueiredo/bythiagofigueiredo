import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MostReadSidebar } from '../../../src/app/(public)/components/MostReadSidebar'

const mockT = { 'home.mostRead.title': 'MOST READ', 'home.mostRead.subtitle': 'most read this month' }
const makePost = (i: number) => ({
  id: `p${i}`, slug: `post-${i}`, locale: 'en', title: `Most Read ${i}`,
  excerpt: null, publishedAt: `2026-05-0${i}`, category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: false,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: null,
})

describe('MostReadSidebar', () => {
  it('renders nothing when 0 posts', () => {
    const { container } = render(<MostReadSidebar posts={[]} locale="en" t={mockT} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders ordered list', () => {
    const { container, getByText } = render(<MostReadSidebar posts={[1,2,3,4,5].map(makePost)} locale="en" t={mockT} />)
    expect(container.querySelector('ol')).not.toBeNull()
    expect(container.querySelector('ol')!.children.length).toBe(5)
    expect(getByText('Most Read 1')).toBeDefined()
  })

  it('renders header', () => {
    const { getByText } = render(<MostReadSidebar posts={[makePost(1)]} locale="en" t={mockT} />)
    expect(getByText(/MOST READ/)).toBeDefined()
  })
})
