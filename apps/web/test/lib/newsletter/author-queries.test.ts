import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { getAuthorWithLocale } from '@/lib/newsletter/author-queries'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const AUTHOR_FIXTURE = {
  id: 'a1',
  name: 'Thiago Figueiredo',
  display_name: 'Thiago',
  slug: 'thiago',
  bio: 'Default bio text',
  bio_md: '**Default bio**',
  avatar_url: 'https://example.com/avatar.jpg',
  social_links: { x: 'https://x.com/test' },
  is_default: true,
}

function buildMockClient(
  authorData: unknown,
  authorError: { message: string } | null,
  translationData: unknown,
  translationError: { message: string } | null = null,
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'authors') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: authorData, error: authorError }),
            }),
          }),
        }
      }
      if (table === 'author_about_translations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: translationData, error: translationError }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

describe('getAuthorWithLocale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when author not found', async () => {
    ;(getSupabaseServiceClient as any).mockReturnValue(
      buildMockClient(null, { message: 'not found' }, null),
    )

    const result = await getAuthorWithLocale('a1', 'pt-BR')
    expect(result).toBeNull()
  })

  it('returns author with locale bio when translation exists', async () => {
    const translation = { bio: 'Bio em portugues', subtitle: 'Subtitulo' }
    ;(getSupabaseServiceClient as any).mockReturnValue(
      buildMockClient(AUTHOR_FIXTURE, null, translation),
    )

    const result = await getAuthorWithLocale('a1', 'pt-BR')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('a1')
    expect(result!.name).toBe('Thiago Figueiredo')
    expect(result!.display_name).toBe('Thiago')
    expect(result!.localeBio).toBe('Bio em portugues')
    expect(result!.localeSubtitle).toBe('Subtitulo')
    expect(result!.bio).toBe('Default bio text')
  })

  it('returns author with null localeBio when no translation exists', async () => {
    ;(getSupabaseServiceClient as any).mockReturnValue(
      buildMockClient(AUTHOR_FIXTURE, null, null),
    )

    const result = await getAuthorWithLocale('a1', 'en')
    expect(result).not.toBeNull()
    expect(result!.localeBio).toBeNull()
    expect(result!.localeSubtitle).toBeNull()
    expect(result!.bio).toBe('Default bio text')
  })

  it('returns author with null localeBio when both translation and authors.bio are null', async () => {
    const authorNoBio = { ...AUTHOR_FIXTURE, bio: null, bio_md: null }
    ;(getSupabaseServiceClient as any).mockReturnValue(
      buildMockClient(authorNoBio, null, null),
    )

    const result = await getAuthorWithLocale('a1', 'pt-BR')
    expect(result).not.toBeNull()
    expect(result!.localeBio).toBeNull()
    expect(result!.localeSubtitle).toBeNull()
    expect(result!.bio).toBeNull()
  })
})
