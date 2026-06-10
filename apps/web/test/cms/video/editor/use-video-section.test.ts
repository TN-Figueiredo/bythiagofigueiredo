import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { useVideoSection } from '@/app/cms/(authed)/video/[id]/edit/use-video-section'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const okJson = (data: unknown, item_version = 4) =>
  ({ ok: true, status: 200, json: async () => ({ data, meta: { item_version } }) })

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('useVideoSection — format-aware PATCH', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

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

  it('re-runs a trailing save when content changes mid-flight — nothing lost, dirty only clears at the end', async () => {
    // Save A in flight (deferred); blur B edits the content before A resolves.
    const first = deferred<ReturnType<typeof okJson>>()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(okJson({ rev: 3, source: 'user', edited: true, cowork_rev: null, updated_at: 't2' }, 5))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() =>
      useVideoSection({ itemId: 'vid-1', sectionBase: 'postprod', lang: 'pt', format: 'video', itemVersion: 3, initialData: { content: { kind: 'brief' }, rev: 1, source: 'user', edited: false, cowork_rev: null, updated_at: null } }),
    )
    act(() => { result.current.setContent({ kind: 'brief', cuts: 'A' }) })
    let savePromise!: Promise<void>
    act(() => { savePromise = result.current.save() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Mid-flight edit (field B) — must NOT be flagged clean when save A resolves.
    act(() => { result.current.setContent({ kind: 'brief', cuts: 'A', broll: 'B' }) })
    expect(result.current.isDirty).toBe(true)
    await act(async () => {
      first.resolve(okJson({ rev: 2, source: 'user', edited: true, cowork_rev: null, updated_at: 't1' }, 4))
      await savePromise
    })
    // Trailing save fired with the fresh content AND the rev returned by save A.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(secondBody.content).toMatchObject({ kind: 'brief', cuts: 'A', broll: 'B' })
    expect(secondBody.rev).toBe(2)
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>).toMatchObject({ 'X-Expected-Version': '4' })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.rev).toBe(3)
    // One toast for the whole burst, not one per PATCH.
    expect(vi.mocked(toast.success)).toHaveBeenCalledTimes(1)
  })

  it("notify:'errors' mutes the success toast but errors still toast", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson({ rev: 2, source: 'user', edited: true, cowork_rev: null, updated_at: 't' }))
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: 'INTERNAL' } }) })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() =>
      useVideoSection({ itemId: 'vid-1', sectionBase: 'publish', lang: 'pt', format: 'video', itemVersion: 3, initialData: { content: { a: 1 }, rev: 1, source: 'user', edited: false, cowork_rev: null, updated_at: null }, notify: 'errors' }),
    )
    act(() => { result.current.setContent({ a: 2 }) })
    await act(async () => { await result.current.save() })
    expect(result.current.isDirty).toBe(false)
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled()
    // Error path: ALWAYS toasts, even in silent mode.
    act(() => { result.current.setContent({ a: 3 }) })
    await act(async () => { await result.current.save() })
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Erro ao salvar seção. Tente novamente.')
    expect(result.current.isDirty).toBe(true) // failed save keeps the section dirty
  })
})
