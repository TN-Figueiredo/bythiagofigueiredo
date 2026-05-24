import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

const selectMock = vi.fn()
const eqMock = vi.fn()
const ilikeMock = vi.fn()
const orderMock = vi.fn()
const limitMock = vi.fn()
const singleMock = vi.fn()
const upsertMock = vi.fn()

// Build chainable query builder mocks
function resetQueryChain() {
  selectMock.mockReset()
  eqMock.mockReset()
  ilikeMock.mockReset()
  orderMock.mockReset()
  limitMock.mockReset()
  singleMock.mockReset()
  upsertMock.mockReset()

  // Default chain for searchHashtags: from().select().eq().ilike().order().limit()
  limitMock.mockResolvedValue({ data: [], error: null })
  orderMock.mockReturnValue({ limit: limitMock })
  ilikeMock.mockReturnValue({ order: orderMock })
  eqMock.mockReturnValue({ ilike: ilikeMock })
  selectMock.mockReturnValue({ eq: eqMock })

  // For upsert: from().upsert().select().single()
  singleMock.mockResolvedValue({ data: null, error: null })
  upsertMock.mockReturnValue({
    select: vi.fn().mockReturnValue({ single: singleMock }),
  })
}

const fromMock = vi.fn()
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}))

import {
  searchHashtags,
  createHashtag,
  getPostHashtags,
} from '../../src/app/cms/(authed)/blog/[id]/edit/hashtag-actions'

describe('searchHashtags', () => {
  beforeEach(() => {
    resetQueryChain()
    fromMock.mockReset()
    fromMock.mockReturnValue({ select: selectMock })
  })

  it('returns filtered results', async () => {
    const hashtags = [
      { id: 'h1', name: 'React', slug: 'react' },
      { id: 'h2', name: 'React Native', slug: 'react-native' },
    ]
    limitMock.mockResolvedValueOnce({ data: hashtags, error: null })

    const result = await searchHashtags('s1', 'react')
    expect(result).toEqual({ ok: true, hashtags })
    expect(fromMock).toHaveBeenCalledWith('hashtags')
    expect(eqMock).toHaveBeenCalledWith('site_id', 's1')
    expect(ilikeMock).toHaveBeenCalledWith('name', '%react%')
  })

  it('returns empty array when no matches', async () => {
    limitMock.mockResolvedValueOnce({ data: [], error: null })

    const result = await searchHashtags('s1', 'nonexistent')
    expect(result).toEqual({ ok: true, hashtags: [] })
  })

  it('returns error on database failure', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })

    const result = await searchHashtags('s1', 'test')
    expect(result).toEqual({ ok: false, error: 'db error' })
  })

  it('returns site_mismatch when siteId does not match context', async () => {
    const result = await searchHashtags('other-site', 'test')
    expect(result).toEqual({ ok: false, error: 'site_mismatch' })
    // Should not reach the DB at all
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns data as empty array when DB returns null data without error', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await searchHashtags('s1', 'test')
    expect(result).toEqual({ ok: true, hashtags: [] })
  })
})

describe('createHashtag', () => {
  beforeEach(() => {
    resetQueryChain()
    fromMock.mockReset()
    fromMock.mockReturnValue({ upsert: upsertMock })
  })

  it('generates proper slug from simple name', async () => {
    const hashtag = { id: 'h1', name: 'React', slug: 'react' }
    singleMock.mockResolvedValueOnce({ data: hashtag, error: null })

    const result = await createHashtag('s1', 'React')
    expect(result).toEqual({ ok: true, hashtag })
    expect(fromMock).toHaveBeenCalledWith('hashtags')
    // Verify the upsert was called with lowercased slug
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(upsertArg.slug).toBe('react')
    expect(upsertArg.name).toBe('React')
    expect(upsertArg.site_id).toBe('s1')
  })

  it('generates slug with diacritics removed', async () => {
    const hashtag = { id: 'h2', name: 'Ação', slug: 'acao' }
    singleMock.mockResolvedValueOnce({ data: hashtag, error: null })

    await createHashtag('s1', 'Ação')
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(upsertArg.slug).toBe('acao')
  })

  it('replaces non-alphanumeric chars with hyphens', async () => {
    const hashtag = { id: 'h3', name: 'Hello World!', slug: 'hello-world' }
    singleMock.mockResolvedValueOnce({ data: hashtag, error: null })

    await createHashtag('s1', 'Hello World!')
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(upsertArg.slug).toBe('hello-world')
  })

  it('strips leading/trailing hyphens from slug', async () => {
    const hashtag = { id: 'h4', name: '  --test--  ', slug: 'test' }
    singleMock.mockResolvedValueOnce({ data: hashtag, error: null })

    await createHashtag('s1', '  --test--  ')
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(upsertArg.slug).toBe('test')
  })

  it('truncates slug to 80 characters', async () => {
    const longName = 'a'.repeat(100)
    singleMock.mockResolvedValueOnce({
      data: { id: 'h5', name: longName, slug: 'a'.repeat(80) },
      error: null,
    })

    await createHashtag('s1', longName)
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(upsertArg.slug).toHaveLength(80)
  })

  it('trims name before upserting', async () => {
    singleMock.mockResolvedValueOnce({
      data: { id: 'h6', name: 'Trimmed', slug: 'trimmed' },
      error: null,
    })

    await createHashtag('s1', '  Trimmed  ')
    const upsertArg = upsertMock.mock.calls[0][0]
    expect(upsertArg.name).toBe('Trimmed')
  })

  it('uses onConflict site_id,slug for upsert', async () => {
    singleMock.mockResolvedValueOnce({
      data: { id: 'h7', name: 'Test', slug: 'test' },
      error: null,
    })

    await createHashtag('s1', 'Test')
    const upsertOpts = upsertMock.mock.calls[0][1]
    expect(upsertOpts).toEqual({ onConflict: 'site_id,slug' })
  })

  it('returns error on database failure', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'conflict' } })

    const result = await createHashtag('s1', 'Test')
    expect(result).toEqual({ ok: false, error: 'conflict' })
  })

  it('returns site_mismatch when siteId does not match context', async () => {
    const result = await createHashtag('other-site', 'Test')
    expect(result).toEqual({ ok: false, error: 'site_mismatch' })
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('getPostHashtags', () => {
  beforeEach(() => {
    resetQueryChain()
    fromMock.mockReset()
  })

  it('returns hashtag list', async () => {
    const dbRows = [
      { hashtag_id: 'h1', hashtags: { id: 'h1', name: 'React', slug: 'react' } },
      { hashtag_id: 'h2', hashtags: { id: 'h2', name: 'TypeScript', slug: 'typescript' } },
    ]
    eqMock.mockResolvedValueOnce({ data: dbRows, error: null })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })

    const result = await getPostHashtags('p1')
    expect(result).toEqual([
      { id: 'h1', name: 'React', slug: 'react' },
      { id: 'h2', name: 'TypeScript', slug: 'typescript' },
    ])
    expect(fromMock).toHaveBeenCalledWith('post_hashtags')
    expect(eqMock).toHaveBeenCalledWith('post_id', 'p1')
  })

  it('returns empty array on error', async () => {
    eqMock.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })

    const result = await getPostHashtags('p1')
    expect(result).toEqual([])
  })

  it('filters out null hashtag joins', async () => {
    const dbRows = [
      { hashtag_id: 'h1', hashtags: { id: 'h1', name: 'React', slug: 'react' } },
      { hashtag_id: 'h2', hashtags: null },
    ]
    eqMock.mockResolvedValueOnce({ data: dbRows, error: null })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })

    const result = await getPostHashtags('p1')
    expect(result).toEqual([{ id: 'h1', name: 'React', slug: 'react' }])
  })

  it('returns empty array when data is null without error', async () => {
    eqMock.mockResolvedValueOnce({ data: null, error: null })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })

    const result = await getPostHashtags('p1')
    expect(result).toEqual([])
  })
})
