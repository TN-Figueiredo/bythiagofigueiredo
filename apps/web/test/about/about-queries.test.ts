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

function buildMockClient(
  authorData: unknown,
  translationRows: unknown[],
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'authors') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: authorData, error: authorData ? null : { message: 'not found' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'author_about_translations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: translationRows,
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('getAboutData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns merged author + translation data for requested locale', async () => {
    const author = {
      id: 'a1',
      display_name: 'Thiago',
      about_photo_url: 'https://example.com/photo.jpg',
      social_links: { x: 'https://x.com/test' },
    }
    const tx = {
      locale: 'pt-BR',
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      about_md: '# Hello',
      about_compiled: '<p>compiled</p>',
      photo_caption: 'CN Tower',
      photo_location: 'TORONTO · 2018',
      about_cta_links: { kicker: 'Vem junto', signature: 'tf', links: [] },
    }
    ;(getSupabaseServiceClient as any).mockReturnValue(buildMockClient(author, [tx]))

    const result = await getAboutData('site-123', 'pt-BR')
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('eu sou |Thiago.')
    expect(result!.display_name).toBe('Thiago')
    expect(result!.about_photo_url).toBe('https://example.com/photo.jpg')
    expect(result!.locale).toBe('pt-BR')
    expect(result!.availableLocales).toEqual(['pt-BR'])
    expect(result!.authorId).toBe('a1')
  })

  it('returns null when no default author exists', async () => {
    ;(getSupabaseServiceClient as any).mockReturnValue(buildMockClient(null, []))
    const result = await getAboutData('site-123', 'en')
    expect(result).toBeNull()
  })

  it('returns null when no translations exist', async () => {
    const author = { id: 'a1', display_name: 'Thiago', about_photo_url: null, social_links: null }
    ;(getSupabaseServiceClient as any).mockReturnValue(buildMockClient(author, []))
    const result = await getAboutData('site-123', 'en')
    expect(result).toBeNull()
  })

  it('falls back to any available locale when requested locale is missing', async () => {
    const author = { id: 'a1', display_name: 'Thiago', about_photo_url: null, social_links: null }
    const tx = {
      locale: 'pt-BR',
      headline: 'eu sou |Thiago.',
      subtitle: null, about_md: null, about_compiled: null,
      photo_caption: null, photo_location: null, about_cta_links: null,
    }
    ;(getSupabaseServiceClient as any).mockReturnValue(buildMockClient(author, [tx]))
    const result = await getAboutData('site-123', 'en')
    expect(result).not.toBeNull()
    expect(result!.locale).toBe('pt-BR')
  })

  it('includes all available locales', async () => {
    const author = { id: 'a1', display_name: 'Thiago', about_photo_url: null, social_links: null }
    const txPt = { locale: 'pt-BR', headline: 'Olá', subtitle: null, about_md: null, about_compiled: null, photo_caption: null, photo_location: null, about_cta_links: null }
    const txEn = { locale: 'en', headline: 'Hello', subtitle: null, about_md: null, about_compiled: null, photo_caption: null, photo_location: null, about_cta_links: null }
    ;(getSupabaseServiceClient as any).mockReturnValue(buildMockClient(author, [txEn, txPt]))
    const result = await getAboutData('site-123', 'en')
    expect(result!.availableLocales).toEqual(['en', 'pt-BR'])
    expect(result!.locale).toBe('en')
  })
})
