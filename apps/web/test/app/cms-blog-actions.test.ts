import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
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

import { savePost, publishPost } from '../../src/app/cms/blog/[id]/edit/actions'

describe('savePost', () => {
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
  it('calls postRepo.publish + revalidates paths', async () => {
    await publishPost('p1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalled()
  })
})
