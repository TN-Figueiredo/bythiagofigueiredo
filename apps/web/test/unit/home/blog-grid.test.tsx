import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BlogGrid } from '../../../src/app/(public)/components/BlogGrid'

const mockT: Record<string, string> = {
  'home.blog.title': 'Latest writing', 'home.blog.subtitle': 'the 6 most recent',
  'home.blog.viewAll': 'See all posts →', 'home.blog.archiveLink': 'browse archive →',
  'home.blog.emptyTitle': 'nothing here yet', 'home.blog.emptyBody': '— but good stuff is coming',
}
const makePost = (i: number) => ({
  id: `p${i}`, slug: `post-${i}`, locale: 'en', title: `Post ${i}`,
  excerpt: `Excerpt ${i}`, publishedAt: `2026-05-0${i}`, category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: i === 1,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: null,
})

describe('BlogGrid', () => {
  it('renders empty state when 0 posts', () => {
    const { getByText } = render(<BlogGrid posts={[]} locale="en" t={mockT} isDark />)
    expect(getByText('nothing here yet')).toBeDefined()
  })

  it('renders correct number of cards', () => {
    const posts = [1, 2, 3, 4, 5, 6].map(makePost)
    const { getAllByRole } = render(<BlogGrid posts={posts} locale="en" t={mockT} isDark />)
    expect(getAllByRole('heading', { level: 3 }).length).toBe(6)
  })

  it('renders CTA button', () => {
    const { getByText } = render(<BlogGrid posts={[makePost(1)]} locale="en" t={mockT} isDark />)
    expect(getByText('See all posts →')).toBeDefined()
  })
})
