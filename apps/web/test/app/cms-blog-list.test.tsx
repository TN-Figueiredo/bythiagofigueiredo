import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

const mockFrom = vi.fn()

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

// mock next/navigation for client components
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

function makeChain(data: unknown, count?: number) {
  const chain: Record<string, unknown> = {}
  const terminal = { data, count: count ?? (Array.isArray(data) ? (data as unknown[]).length : 0), error: null }
  const ops = ['select', 'eq', 'ilike', 'order', 'range']
  for (const op of ops) {
    chain[op] = vi.fn().mockReturnValue(chain)
  }
  // make the last awaitable call resolve
  ;(chain as unknown as Promise<unknown> & Record<string, unknown>)[Symbol.iterator] = undefined
  Object.assign(chain, terminal)
  // make it thenable so await works
  ;(chain as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) => Promise.resolve(terminal).then(resolve)
  return chain
}

beforeEach(() => {
  const statusChain = makeChain([{ status: 'draft' }, { status: 'published' }])
  const postsChain = makeChain([
    {
      id: 'p1',
      slug: 'draft-x',
      status: 'draft',
      updated_at: '2026-01-01T00:00:00Z',
      blog_translations: [{ title: 'Draft X', locale: 'pt-BR', reading_time_min: 1 }],
      authors: { display_name: 'Alice' },
    },
    {
      id: 'p2',
      slug: 'published-y',
      status: 'published',
      updated_at: '2026-01-02T00:00:00Z',
      blog_translations: [{ title: 'Published Y', locale: 'pt-BR', reading_time_min: 3 }],
      authors: { display_name: 'Bob' },
    },
  ], 2)

  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    // first call → status count query, second → posts query
    return callCount === 1 ? statusChain : postsChain
  })
})

import BlogListPage from '../../src/app/cms/(authed)/blog/page'

describe('CmsBlogListPage', () => {
  it('renders post rows', async () => {
    const jsx = await BlogListPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Draft X')
    expect(container.textContent).toContain('Published Y')
  })

  it('has [+ New Post] link to /cms/blog/new', async () => {
    const jsx = await BlogListPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    const link = container.querySelector('a[href="/cms/blog/new"]')
    expect(link).toBeTruthy()
  })

  it('shows empty state when no posts', async () => {
    const emptyChain = makeChain([], 0)
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return callCount === 1 ? makeChain([]) : emptyChain
    })
    const jsx = await BlogListPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('No posts yet')
  })
})
