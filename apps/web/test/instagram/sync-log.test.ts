// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstagramAccountRow, SyncResult } from '@/lib/instagram/types'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'

function makeAccount(): InstagramAccountRow {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: 'thiago.figueiredo',
    ig_user_id: 'ig-user-1', access_token: 'tok-abc',
    token_expires_at: null, sync_enabled: true, display_slots: 6,
    layout_type: 'grid', section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: null, created_at: '', updated_at: '',
  }
}

function makeResult(over: Partial<SyncResult> = {}): SyncResult {
  return {
    postsFound: 3, postsInserted: 2, postsUpdated: 1, mediaCached: 2,
    partial: false, mediaFailed: 0, ...over,
  }
}

/** Mock mínimo do supabase-js para `insert().select().single()` e `update().eq()`. */
function mockSupabase(opts: {
  insertResult?: { data: { id: string } | null; error: unknown }
  existingMessage?: string | null
} = {}) {
  const insertResult = opts.insertResult ?? { data: { id: 'log-1' }, error: null }
  const single = vi.fn().mockResolvedValue(insertResult)
  const insertSelect = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  const readSingle = vi.fn().mockResolvedValue({
    data: { error_message: opts.existingMessage ?? null },
    error: null,
  })
  const readEq = vi.fn().mockReturnValue({ single: readSingle })
  const select = vi.fn().mockReturnValue({ eq: readEq })

  const supabase = { from: vi.fn().mockReturnValue({ insert, select, update }) }
  return { supabase, insert, update, updateEq }
}

describe('openSyncRow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('insere started com site_id e devolve o id', async () => {
    const { supabase, insert } = mockSupabase()
    const id = await openSyncRow(supabase as never, makeAccount(), 'manual')
    expect(id).toBe('log-1')
    expect(insert).toHaveBeenCalledWith({
      site_id: 'site-1',
      account_id: 'acc-1',
      mode: 'manual',
      status: 'started',
      error_message: null,
    })
  })

  it('grava o detail com prefixo e redigido', async () => {
    const { supabase, insert } = mockSupabase()
    await openSyncRow(supabase as never, makeAccount(), 'manual', {
      detail: `granted: instagram_business_basic access_token=${'a'.repeat(64)}`,
    })
    const row = insert.mock.calls[0]![0] as { error_message: string }
    expect(row.error_message).toMatch(/^detail: granted: instagram_business_basic /)
    expect(row.error_message).toContain('access_token=[REDACTED]')
    expect(row.error_message).not.toContain('a'.repeat(64))
  })

  it('trunca o detail redigido em 500 chars antes do prefixo', async () => {
    const { supabase, insert } = mockSupabase()
    await openSyncRow(supabase as never, makeAccount(), 'daily', { detail: 'x'.repeat(900) })
    const row = insert.mock.calls[0]![0] as { error_message: string }
    expect(row.error_message).toBe(`detail: ${'x'.repeat(500)}`)
  })

  it('devolve null quando o insert falha (o chamador é quem registra)', async () => {
    const { supabase } = mockSupabase({ insertResult: { data: null, error: { message: 'boom' } } })
    expect(await openSyncRow(supabase as never, makeAccount(), 'manual')).toBeNull()
  })

  it('devolve null e não lança quando o cliente explode', async () => {
    const supabase = { from: vi.fn(() => { throw new Error('offline') }) }
    await expect(openSyncRow(supabase as never, makeAccount(), 'manual')).resolves.toBeNull()
  })
})

describe('closeSyncRow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completed preserva o error_message existente', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: disconnected by owner' })
    await closeSyncRow(supabase as never, 'log-1', makeResult())
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      posts_found: 3,
      posts_inserted: 2,
      posts_updated: 1,
      media_cached: 2,
      error_message: 'detail: disconnected by owner',
    }))
  })

  it('completed acrescenta " partial" e " mediaFailed:<N>"', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: ok' })
    await closeSyncRow(supabase as never, 'log-1', makeResult({ partial: true, mediaFailed: 2 }))
    const patch = update.mock.calls[0]![0] as { error_message: string }
    expect(patch.error_message).toBe('detail: ok partial mediaFailed:2')
  })

  it('não acrescenta mediaFailed quando é zero', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: ok' })
    await closeSyncRow(supabase as never, 'log-1', makeResult({ partial: true, mediaFailed: 0 }))
    const patch = update.mock.calls[0]![0] as { error_message: string }
    expect(patch.error_message).toBe('detail: ok partial')
  })

  it('sem detail e sem sufixos, error_message fica null', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: null })
    await closeSyncRow(supabase as never, 'log-1', makeResult())
    const patch = update.mock.calls[0]![0] as { error_message: string | null }
    expect(patch.error_message).toBeNull()
  })

  it('sem detail mas com mediaFailed, o sufixo mantém o espaço à esquerda', async () => {
    // O espaço é deliberado: §3.2 (C2) deriva "3 execuções com falha" procurando
    // a substring " mediaFailed:" no error_message.
    const { supabase, update } = mockSupabase({ existingMessage: null })
    await closeSyncRow(supabase as never, 'log-1', makeResult({ mediaFailed: 4 }))
    const patch = update.mock.calls[0]![0] as { error_message: string }
    expect(patch.error_message).toBe(' mediaFailed:4')
    expect(patch.error_message).toContain(' mediaFailed:')
  })

  it('failed sobrescreve o error_message, redigido e truncado', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: ok' })
    await closeSyncRow(supabase as never, 'log-1', null, `boom access_token=${'a'.repeat(64)}`)
    const patch = update.mock.calls[0]![0] as { status: string; error_message: string }
    expect(patch.status).toBe('failed')
    expect(patch.error_message).toBe('boom access_token=[REDACTED]')
  })

  it('é no-op de escrita quando logId é null', async () => {
    const { supabase, update } = mockSupabase()
    await closeSyncRow(supabase as never, null, makeResult())
    expect(supabase.from).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('nunca lança quando a escrita falha', async () => {
    const supabase = { from: vi.fn(() => { throw new Error('offline') }) }
    await expect(closeSyncRow(supabase as never, 'log-1', makeResult())).resolves.toBeUndefined()
  })
})
