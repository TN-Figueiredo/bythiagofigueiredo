import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
    getById: vi.fn().mockResolvedValue({
      id: 'p1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    }),
    update: vi.fn().mockResolvedValue({
      id: 'p1',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    }),
    publish: vi.fn().mockResolvedValue({
      id: 'p1',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    }),
  }),
}))

vi.mock('../../lib/cms/registry', () => ({ blogRegistry: {} }))

vi.mock('@tn-figueiredo/cms', async () => {
  const actual = await vi.importActual<object>('@tn-figueiredo/cms')
  return {
    ...actual,
    compileMdx: vi.fn().mockResolvedValue({ compiledSource: 'src', toc: [], readingTimeMin: 1 }),
  }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ getAll: () => [], set: () => {} }),
}))

// Default: authorized. Individual tests can override the rpc mock before import.
const rpcMock = vi.fn().mockResolvedValue({ data: true, error: null })
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    rpc: rpcMock,
  }),
}))

import { savePost, publishPost } from '../../src/app/cms/blog/[id]/edit/actions'

describe('savePost', () => {
  beforeEach(() => {
    rpcMock.mockResolvedValue({ data: true, error: null })
  })

  it('returns ok for valid input', async () => {
    const result = await savePost('p1', 'pt-BR', {
      content_mdx: '# Hello',
      title: 'Hello',
      slug: 'hello',
    })
    expect(result.ok).toBe(true)
  })

  it('returns validation error for empty title', async () => {
    const result = await savePost('p1', 'pt-BR', { content_mdx: '', title: '', slug: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.title).toBeTruthy()
    }
  })

  it('returns validation error for empty slug', async () => {
    const result = await savePost('p1', 'pt-BR', { content_mdx: '', title: 'Ok', slug: '' })
    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'validation_failed') {
      expect(result.fields.slug).toBeTruthy()
    }
  })
})

describe('publishPost', () => {
  beforeEach(() => {
    rpcMock.mockResolvedValue({ data: true, error: null })
  })

  it('calls postRepo.publish + revalidates paths', async () => {
    await publishPost('p1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalled()
  })
})

describe('authorization', () => {
  it('savePost throws when can_admin_site returns false', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    await expect(
      savePost('p1', 'pt-BR', { content_mdx: '', title: 'T', slug: 's' }),
    ).rejects.toThrow(/forbidden/)
  })

  it('publishPost throws when can_admin_site returns false', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    await expect(publishPost('p1')).rejects.toThrow(/forbidden/)
  })
})
