import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVideoSection } from '@/app/cms/(authed)/video/[id]/edit/use-video-section'

const okJson = (data: unknown, item_version = 4) =>
  ({ ok: true, status: 200, json: async () => ({ data, meta: { item_version } }) })

describe('useVideoSection — format-aware PATCH', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('PATCHes the ideia_pt key derived from getSectionKey(base,lang,"video")', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ rev: 2, source: 'user', edited: true, cowork_rev: null, updated_at: 't' }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() =>
      useVideoSection({ itemId: 'vid-1', sectionBase: 'ideia', lang: 'pt', format: 'video', itemVersion: 3, initialData: { content: { title: '' }, rev: 1, source: 'user', edited: false, cowork_rev: null, updated_at: null } }),
    )
    act(() => { result.current.setContent({ title: 'Direção nova' }) })
    await act(async () => { await result.current.save() })
    const url = fetchMock.mock.calls[0][0] as string
    // section base + lang query — endpoint stays /api/pipeline/items/:id/sections/:base?lang=pt
    expect(url).toContain('/api/pipeline/items/vid-1/sections/ideia?lang=pt')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Expected-Version']).toBe('3')
    expect(JSON.parse(init.body as string)).toMatchObject({ content: { title: 'Direção nova' }, rev: 1, source: 'user' })
  })

  it('surfaces a 409 conflict (remote refetch → conflict state)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { code: 'CONFLICT' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { content: { title: 'remote' }, rev: 5, source: 'cowork', edited: false, cowork_rev: 2, updated_at: 't' }, meta: { item_version: 6 } }) })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() =>
      useVideoSection({ itemId: 'vid-1', sectionBase: 'ideia', lang: 'pt', format: 'video', itemVersion: 3, initialData: { content: { title: 'local' }, rev: 1, source: 'user', edited: false, cowork_rev: null, updated_at: null } }),
    )
    act(() => { result.current.setContent({ title: 'local edit' }) })
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(result.current.conflict).not.toBeNull())
    expect(result.current.conflict!.remoteData.content).toMatchObject({ title: 'remote' })
  })
})
