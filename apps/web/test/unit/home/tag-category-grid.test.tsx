import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TagCategoryGrid } from '../../../src/app/(public)/components/TagCategoryGrid'

const mockT: Record<string, string> = { 'home.tags.title': 'By category' }
const makePosts = (tag: string, n: number) => Array.from({ length: n }, (_, i) => ({
  id: `${tag}-${i}`, slug: `${tag}-${i}`, locale: 'en', title: `${tag} Post ${i}`,
  excerpt: null, publishedAt: `2026-05-0${i+1}`, category: tag,
  readingTimeMin: 3, coverImageUrl: null, isFeatured: false,
  tagName: tag, tagColor: '#6366f1', tagColorDark: null,
}))

describe('TagCategoryGrid', () => {
  it('renders nothing when no groups', () => {
    const { container } = render(<TagCategoryGrid tagGroups={[]} locale="en" t={mockT} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders tag cards', () => {
    const groups = [
      { tag: { id: '1', name: 'tech', slug: 'tech', color: '#6366f1', colorDark: null, postCount: 2 }, posts: makePosts('tech', 2) },
      { tag: { id: '2', name: 'vida', slug: 'vida', color: '#22c55e', colorDark: null, postCount: 2 }, posts: makePosts('vida', 2) },
    ]
    const { getByText } = render(<TagCategoryGrid tagGroups={groups} locale="en" t={mockT} />)
    expect(getByText('By category')).toBeDefined()
    expect(getByText('tech')).toBeDefined()
    expect(getByText('vida')).toBeDefined()
  })
})
