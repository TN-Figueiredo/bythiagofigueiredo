import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
  revalidateTag: vi.fn(),
}))

let mockRows: { locale: string; content: Record<string, string> }[] = []

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockRows }),
          }),
        }),
      })),
    })),
  }),
}))

import { getPageContent } from '../../../src/lib/content/fetch'

const enDefaults = { greeting: 'hello', farewell: 'bye' } as Record<string, string>
const ptDefaults = { greeting: 'olá', farewell: 'tchau' } as Record<string, string>
const defaults = { en: enDefaults, pt: ptDefaults }

describe('getPageContent', () => {
  beforeEach(() => {
    mockRows = []
  })

  it('returns EN defaults when DB is empty and locale is en', async () => {
    const result = await getPageContent('site1', 'test', 'en', defaults)
    expect(result.greeting).toBe('hello')
    expect(result.farewell).toBe('bye')
  })

  it('returns PT defaults when DB is empty and locale is pt-BR', async () => {
    const result = await getPageContent('site1', 'test', 'pt-BR', defaults)
    expect(result.greeting).toBe('olá')
    expect(result.farewell).toBe('tchau')
  })

  it('merges DB content over EN defaults', async () => {
    mockRows = [{ locale: 'en', content: { greeting: 'hey' } }]
    const result = await getPageContent('site1', 'test', 'en', defaults)
    expect(result.greeting).toBe('hey')
    expect(result.farewell).toBe('bye')
  })

  it('falls back field-level from pt-BR to en DB value', async () => {
    mockRows = [
      { locale: 'en', content: { greeting: 'hey', farewell: 'see ya' } },
      { locale: 'pt-BR', content: { greeting: 'oi' } },
    ]
    const result = await getPageContent('site1', 'test', 'pt-BR', defaults)
    expect(result.greeting).toBe('oi')
    expect(result.farewell).toBe('see ya')
  })

  it('uses PT defaults for fields missing from both DB rows', async () => {
    mockRows = [
      { locale: 'en', content: { greeting: 'hey' } },
      { locale: 'pt-BR', content: {} },
    ]
    const result = await getPageContent('site1', 'test', 'pt-BR', defaults)
    expect(result.greeting).toBe('hey')
    expect(result.farewell).toBe('tchau')
  })
})
