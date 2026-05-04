import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { getAboutData } from '@/lib/about/queries'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  const chain = { select: mockSelect, eq: mockEq, single: mockSingle }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValueOnce(chain).mockReturnValueOnce(chain)
  ;(getSupabaseServiceClient as any).mockReturnValue({
    from: () => chain,
  })
})

describe('getAboutData', () => {
  it('returns author data when default author has about fields', async () => {
    const authorRow = {
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      about_md: '# Chapter 1',
      about_compiled: '<p>compiled</p>',
      about_photo_url: 'https://example.com/photo.jpg',
      photo_caption: 'CN Tower',
      photo_location: 'TORONTO · 2018',
      about_cta_links: { kicker: 'Vem junto', signature: 'tf', links: [] },
      social_links: { x: 'https://x.com/test' },
      display_name: 'Thiago',
    }
    mockSingle.mockResolvedValue({ data: authorRow, error: null })

    const result = await getAboutData('site-123')
    expect(result).toEqual(authorRow)
  })

  it('returns null when no default author exists', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })

    const result = await getAboutData('site-123')
    expect(result).toBeNull()
  })

  it('returns null when all about fields are empty', async () => {
    const authorRow = {
      headline: null,
      subtitle: null,
      about_md: null,
      about_compiled: null,
      about_photo_url: null,
      photo_caption: null,
      photo_location: null,
      about_cta_links: null,
      social_links: null,
      display_name: 'Thiago',
    }
    mockSingle.mockResolvedValue({ data: authorRow, error: null })

    const result = await getAboutData('site-123')
    expect(result).toBeNull()
  })
})
