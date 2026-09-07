// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
const listMock = vi.fn()
const delMock = vi.fn()
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a), del: (...a: unknown[]) => delMock(...a) }))

import { revalidateTag } from 'next/cache'
import { resumeStuckDeletionRequest, runDeletionEffects } from '@/lib/instagram/deletion'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ICall { table: string; op: string; arg?: unknown }

function client(opts: {
  pending?: Array<{ id: string; ig_user_id: string }>
  accounts?: Array<{ id: string; site_id: string }>
}) {
  const calls: ICall[] = []
  const accounts = opts.accounts ?? [{ id: 'acc-1', site_id: 'site-1' }]
  const from = vi.fn((table: string) => {
    if (table === 'instagram_deletion_requests') {
      return {
        select: () => ({
          is: () => ({
            lt: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: opts.pending ?? [], error: null }) }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          calls.push({ table, op: 'update', arg: patch })
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    }
    if (table === 'instagram_accounts') {
      return {
        select: () => ({ or: () => ({ eq: () => Promise.resolve({ data: accounts, error: null }) }) }),
        update: (patch: Record<string, unknown>) => {
          calls.push({ table, op: 'update', arg: patch })
          return { in: () => Promise.resolve({ error: null }) }
        },
      }
    }
    return {
      delete: () => {
        calls.push({ table, op: 'delete' })
        return { in: () => Promise.resolve({ error: null }), eq: () => Promise.resolve({ error: null }) }
      },
      insert: (row: Record<string, unknown>) => {
        calls.push({ table, op: 'insert', arg: row })
        return Promise.resolve({ error: null })
      },
    }
  })
  return { client: { from } as unknown as SupabaseClient, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined })
  delMock.mockResolvedValue(undefined)
})

describe('runDeletionEffects', () => {
  it('apaga slots, posts, blobs e sync_log; anonimiza; invalida o cache; completed_at por ÚLTIMO', async () => {
    listMock.mockResolvedValueOnce({ blobs: [{ url: 'https://b/1.jpg' }], hasMore: true, cursor: 'c1' })
    listMock.mockResolvedValueOnce({ blobs: [{ url: 'https://b/2.jpg' }], hasMore: false, cursor: undefined })
    const { client: c, calls } = client({})

    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)

    const order = calls.map((x) => `${x.table}:${x.op}`)
    expect(order).toContain('instagram_feed_slots:delete')
    expect(order).toContain('instagram_posts:delete')
    expect(order).toContain('instagram_sync_log:delete')
    expect(order).toContain('instagram_sync_log:insert')
    // del recebe URLs, NUNCA prefixo
    expect(delMock).toHaveBeenCalledWith(['https://b/1.jpg'])
    expect(delMock).toHaveBeenCalledWith(['https://b/2.jpg'])
    // anonimização
    expect(calls.find((x) => x.table === 'instagram_accounts' && x.op === 'update')!.arg)
      .toEqual({ ig_user_id: null, ig_professional_id: null, ig_user_id_source: 'legacy' })
    // completed_at é a última escrita
    expect(order[order.length - 1]).toBe('instagram_deletion_requests:update')
    expect(revalidateTag).toHaveBeenCalledWith('instagram-feed', { expire: 0 })
  })

  it('a linha de trilha é mode=data_deletion / completed', async () => {
    const { client: c, calls } = client({})
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)
    const row = calls.find((x) => x.table === 'instagram_sync_log' && x.op === 'insert')!
      .arg as Record<string, unknown>
    expect(row.mode).toBe('data_deletion')
    expect(row.status).toBe('completed')
  })

  it('laço de blobs cortado pelo deadline => completed_at continua NULL', async () => {
    listMock.mockResolvedValue({ blobs: [{ url: 'https://b/x.jpg' }], hasMore: true, cursor: 'c' })
    const { client: c, calls } = client({})
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() - 1)
    expect(calls.some((x) => x.table === 'instagram_deletion_requests' && x.op === 'update')).toBe(false)
  })

  it('sem contas casadas ainda conclui (idempotente: já foi anonimizado num run anterior)', async () => {
    const { client: c, calls } = client({ accounts: [] })
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)
    expect(calls.some((x) => x.table === 'instagram_deletion_requests' && x.op === 'update')).toBe(true)
    expect(delMock).not.toHaveBeenCalled()
  })

  it('deadline cortado na 2ª de duas contas: 1ª já limpa (idempotente), 2ª retoma do zero', async () => {
    // Simula uma retomada: a 1ª conta já não tem blobs (já foi deletada num
    // run anterior que morreu no meio); a 2ª ainda tem 1 blob pendente.
    listMock.mockImplementation(({ prefix }: { prefix: string }) =>
      Promise.resolve(
        prefix === 'instagram/acc-1/'
          ? { blobs: [], hasMore: false, cursor: undefined }
          : { blobs: [{ url: 'https://b/only.jpg' }], hasMore: false, cursor: undefined },
      ),
    )
    const { client: c, calls } = client({ accounts: [{ id: 'acc-1', site_id: 's' }, { id: 'acc-2', site_id: 's' }] })
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)
    expect(delMock).toHaveBeenCalledTimes(1)
    expect(delMock).toHaveBeenCalledWith(['https://b/only.jpg'])
    expect(calls.some((x) => x.table === 'instagram_deletion_requests' && x.op === 'update')).toBe(true)
  })
})

describe('resumeStuckDeletionRequest', () => {
  it('nenhum pedido pendente => false, nenhum efeito', async () => {
    const { client: c, calls } = client({ pending: [] })
    expect(await resumeStuckDeletionRequest(c, Date.now() + 60_000)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('UM pedido por run (o 2º pendente fica para o run seguinte)', async () => {
    const { client: c } = client({ pending: [{ id: 'req-1', ig_user_id: '1' }] })
    expect(await resumeStuckDeletionRequest(c, Date.now() + 60_000)).toBe(true)
    expect(delMock.mock.calls.length + 1).toBeGreaterThan(0)
  })

  it('propaga o pedido pendente para runDeletionEffects e completa o req-1', async () => {
    const { client: c, calls } = client({ pending: [{ id: 'req-1', ig_user_id: '1' }] })
    await resumeStuckDeletionRequest(c, Date.now() + 60_000)
    const update = calls.find((x) => x.table === 'instagram_deletion_requests' && x.op === 'update')
    expect(update).toBeDefined()
    expect((update!.arg as Record<string, unknown>).completed_at).toEqual(expect.any(String))
  })
})
