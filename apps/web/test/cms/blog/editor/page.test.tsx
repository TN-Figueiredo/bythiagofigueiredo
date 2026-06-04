import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

/* ------------------------------------------------------------------ */
/*  Supabase mock chain builder                                       */
/* ------------------------------------------------------------------ */

interface ChainConfig {
  data: unknown
  error: unknown
}

function makeChain(config: ChainConfig) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    single: () => Promise.resolve(config),
    maybeSingle: () => Promise.resolve(config),
    then: (resolve: (v: ChainConfig) => void) => Promise.resolve(config).then(resolve),
  }
  return chain
}

let fromMap: Record<string, ChainConfig> = {}

const mockSupabase = {
  from: (table: string) => makeChain(fromMap[table] ?? { data: null, error: null }),
}

/* ------------------------------------------------------------------ */
/*  Module mocks                                                      */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/pipeline/blog-link', () => ({
  getPipelineItemForPost: vi.fn().mockResolvedValue(null),
}))

// Mock the client component to a simple div
vi.mock('@/app/cms/(authed)/blog/[id]/edit/editor-client', () => ({
  EditorClient: (props: { initialState: { postId: string } }) => (
    <div data-testid="editor-client" data-post-id={props.initialState?.postId} />
  ),
}))

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const defaultPost = {
  id: 'p1',
  site_id: 's1',
  status: 'draft',
  cover_image_url: null,
  category: null,
  tag_id: null,
}

const defaultTranslation = {
  locale: 'pt-BR',
  title: 'My Post',
  slug: 'my-post',
  excerpt: 'Excerpt text',
  content_json: null,
  content_html: null,
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  reading_time_min: 2,
  key_points: [],
  pull_quote: null,
  notes: [],
  colophon: null,
}

function setupMocks(overrides?: {
  post?: Partial<typeof defaultPost> | null
  postError?: unknown
  translations?: Array<typeof defaultTranslation> | null
}) {
  fromMap = {
    blog_posts: {
      data: overrides?.post === null ? null : { ...defaultPost, ...overrides?.post },
      error: overrides?.postError ?? null,
    },
    blog_translations: {
      data: overrides?.translations === null ? null : (overrides?.translations ?? [defaultTranslation]),
      error: null,
    },
    blog_tags: { data: [], error: null },
    post_hashtags: { data: [], error: null },
  }
}

/* ------------------------------------------------------------------ */
/*  Import page (after mocks)                                         */
/* ------------------------------------------------------------------ */

import BlogEditorPage from '../../../../src/app/cms/(authed)/blog/[id]/edit/page'

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('BlogEditorPage', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('renders EditorClient with correct postId from initialState', async () => {
    const jsx = await BlogEditorPage({ params: Promise.resolve({ id: 'p1' }) })
    const { getByTestId } = render(jsx as never)
    const client = getByTestId('editor-client')
    expect(client).toBeTruthy()
    expect(client.getAttribute('data-post-id')).toBe('p1')
  })

  it('calls notFound when post does not exist', async () => {
    setupMocks({ post: null })
    await expect(
      BlogEditorPage({ params: Promise.resolve({ id: 'missing' }) }),
    ).rejects.toThrow()
  })

  it('calls notFound when post belongs to a different site', async () => {
    setupMocks({ post: { site_id: 'other-site' } })
    await expect(
      BlogEditorPage({ params: Promise.resolve({ id: 'p1' }) }),
    ).rejects.toThrow()
  })

  it('calls notFound when no translations exist', async () => {
    setupMocks({ translations: [] })
    await expect(
      BlogEditorPage({ params: Promise.resolve({ id: 'p1' }) }),
    ).rejects.toThrow()
  })
})
