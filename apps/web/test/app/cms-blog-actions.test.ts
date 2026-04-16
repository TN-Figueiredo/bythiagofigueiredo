import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authGuards from '../../lib/cms/auth-guards'

vi.mock('../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

const getByIdMock = vi.fn().mockResolvedValue({
  id: 'p1',
  site_id: 's1',
  status: 'draft',
  translations: [{ locale: 'pt-BR', slug: 'hello' }],
})
const deleteMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/cms/repositories', () => ({
  postRepo: () => ({
    getById: getByIdMock,
    update: vi.fn().mockResolvedValue({
      id: 'p1',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    }),
    publish: vi.fn().mockResolvedValue({
      id: 'p1',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    }),
    delete: deleteMock,
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

import {
  savePost,
  publishPost,
  deletePost,
} from '../../src/app/cms/(authed)/blog/[id]/edit/actions'

describe('savePost', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
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
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
  })

  it('calls postRepo.publish + revalidates paths', async () => {
    await publishPost('p1')
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalled()
  })
})

describe('savePost URL-encodes slug in revalidatePath', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
  })

  it('encodes slug with non-ASCII characters when revalidating', async () => {
    const { revalidatePath } = await import('next/cache')
    vi.mocked(revalidatePath).mockClear()
    await savePost('p1', 'pt-BR', {
      content_mdx: '# Hi',
      title: 'Olá',
      slug: 'ação-e-reação',
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      `/blog/pt-BR/${encodeURIComponent('ação-e-reação')}`,
    )
  })
})

describe('deletePost discriminated result', () => {
  beforeEach(() => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockResolvedValue({ siteId: 's1' })
    getByIdMock.mockReset()
    deleteMock.mockReset()
    deleteMock.mockResolvedValue(undefined)
  })

  it('returns ok:true when post is draft and delete succeeds', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'hi' }],
    })
    const result = await deletePost('p1')
    expect(result).toEqual({ ok: true })
    expect(deleteMock).toHaveBeenCalledWith('p1')
  })

  it('returns not_found when repo returns null (stale id)', async () => {
    getByIdMock.mockResolvedValueOnce(null)
    const result = await deletePost('gone')
    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('returns already_published when status transitioned to published between list render and click', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      status: 'published',
      translations: [{ locale: 'pt-BR', slug: 'hi' }],
    })
    const result = await deletePost('p1')
    expect(result).toEqual({ ok: false, error: 'already_published' })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('returns db_error when the delete call throws', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 'p1',
      site_id: 's1',
      status: 'draft',
      translations: [{ locale: 'pt-BR', slug: 'hi' }],
    })
    deleteMock.mockRejectedValueOnce(new Error('boom'))
    const result = await deletePost('p1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('db_error')
      expect(result.message).toBe('boom')
    }
  })
})

describe('authorization', () => {
  it('savePost throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(
      savePost('p1', 'pt-BR', { content_mdx: '', title: 'T', slug: 's' }),
    ).rejects.toThrow(/forbidden/)
  })

  it('publishPost throws when requireSiteAdminForRow throws forbidden', async () => {
    vi.mocked(authGuards.requireSiteAdminForRow).mockRejectedValueOnce(new Error('forbidden'))
    await expect(publishPost('p1')).rejects.toThrow(/forbidden/)
  })
})
