// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/instagram/api-client', () => ({ fetchInstagramProfile: vi.fn().mockResolvedValue({ id: 'ig-1' }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
const mockGetClient = vi.mocked(getSupabaseServiceClient)
const mockRevalidatePath = vi.mocked(revalidatePath)

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'
const POST_ID = '00000000-0000-0000-0000-000000000010'

describe('Instagram server actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('addInstagramAccount inserts row with handle and locale', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'acc-1' }, error: null }) }),
    })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: insertFn }) } as never)
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'pt' })
    expect(result.ok).toBe(true)
    expect(insertFn).toHaveBeenCalledTimes(1)
    // Regressão A1: o insert carrega o site do contexto, nunca um site do input.
    expect(insertFn.mock.calls[0]![0]).toMatchObject({ site_id: 'site-1' })
  })

  it('addInstagramAccount rejects invalid locale', async () => {
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'fr' as never })
    expect(result.ok).toBe(false)
  })

  it('removeInstagramAccount scopes the delete to the session site', async () => {
    const eqSite = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ delete: deleteFn }) } as never)
    const { removeInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await removeInstagramAccount({ accountId: ACCOUNT_ID })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSettings scopes the update to the session site', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [{ id: ACCOUNT_ID }], error: null })
    const eqSite = vi.fn().mockReturnValue({ select: selectFn })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const updateFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: updateFn }) } as never)
    const { updateInstagramSettings } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSettings({ accountId: ACCOUNT_ID, display_slots: 9 })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSettings reports not found when no row matches the site', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqSite = vi.fn().mockReturnValue({ select: selectFn })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqId }) }),
    } as never)
    const { updateInstagramSettings } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSettings({ accountId: ACCOUNT_ID, display_slots: 9 })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
  })

  it('setInstagramToken scopes the update to the session site', async () => {
    const eqSite = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const updateFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: updateFn }) } as never)
    const { setInstagramToken } = await import('@/app/cms/(authed)/settings/actions')
    const result = await setInstagramToken({ accountId: ACCOUNT_ID, accessToken: 'tok-abc' })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSlots updates positions in batch when the account belongs to the site', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsIn = vi.fn().mockResolvedValue({ data: [{ id: POST_ID }], error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: postsIn }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID,
      slots: [{ position: 1, postId: POST_ID }, { position: 2, postId: null }],
    })
    expect(result.ok).toBe(true)
    expect(upsertFn).toHaveBeenCalledTimes(1)
  })

  it('updateInstagramSlots refuses an account owned by another site', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-2' }, error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: null }],
    })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('updateInstagramSlots refuses a postId that belongs to another account', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsIn = vi.fn().mockResolvedValue({ data: [], error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: postsIn }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: POST_ID }],
    })
    expect(result).toEqual({ ok: false, error: 'Post not found for this account' })
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('updateInstagramSlots skips the post lookup when every slot is empty', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsSelect = vi.fn()
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') return { select: postsSelect }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: null }],
    })
    expect(result.ok).toBe(true)
    expect(postsSelect).not.toHaveBeenCalled()
  })
})

// `vi.hoisted` porque `vi.mock` é içado para o topo do arquivo: sem ele, a
// fábrica referenciaria um `const` ainda em TDZ.
const { syncMock, openSyncRowMock, closeSyncRowMock } = vi.hoisted(() => ({
  syncMock: vi.fn(),
  openSyncRowMock: vi.fn(),
  closeSyncRowMock: vi.fn(),
}))
vi.mock('@/lib/instagram/sync', () => ({ syncInstagramAccount: syncMock }))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: openSyncRowMock,
  closeSyncRow: closeSyncRowMock,
}))

function accountRow(siteId = 'site-1') {
  return {
    id: ACCOUNT_ID, site_id: siteId, locale: 'pt', handle: 'thiago.figueiredo',
    ig_user_id: 'ig-1', access_token: 'tok-abc', token_expires_at: null,
    sync_enabled: true, display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: null, created_at: '', updated_at: '',
  }
}

/** `select('*').eq('id').eq('site_id').single()` */
function clientReturning(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eqSite = vi.fn().mockReturnValue({ single })
  const eqId = vi.fn().mockReturnValue({ eq: eqSite })
  const select = vi.fn().mockReturnValue({ eq: eqId })
  return {
    client: { from: vi.fn().mockReturnValue({ select }) },
    select, eqId, eqSite,
  }
}

describe('triggerInstagramSync (A2 — in-process)', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchSpy)
    openSyncRowMock.mockResolvedValue('log-1')
    closeSyncRowMock.mockResolvedValue(undefined)
    syncMock.mockResolvedValue({
      postsFound: 2, postsInserted: 1, postsUpdated: 1, mediaCached: 1,
      partial: false, mediaFailed: 0,
    })
  })

  it('reads the row scoped to the site and calls the sync IN PROCESS', async () => {
    const { client, select, eqId, eqSite } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({ ok: true })
    expect(select).toHaveBeenCalledWith('*')
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
    expect(syncMock).toHaveBeenCalledTimes(1)
    // Nenhuma chamada HTTP ao cron: é ela que carimbava cron_health['instagram-sync'].
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes the full row and a 90s deadline to syncInstagramAccount', async () => {
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const before = Date.now()
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    await triggerInstagramSync({ accountId: ACCOUNT_ID })

    const [, account, token, opts] = syncMock.mock.calls[0] as [
      unknown, { id: string; ig_user_id: string }, unknown, { deadlineAt: number },
    ]
    expect(account.id).toBe(ACCOUNT_ID)
    expect(account.ig_user_id).toBe('ig-1')
    expect(token).toBeUndefined()
    expect(opts.deadlineAt).toBeGreaterThanOrEqual(before + 90_000)
    expect(opts.deadlineAt).toBeLessThanOrEqual(Date.now() + 90_000)
  })

  it('errors when the account belongs to another site', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'no rows' } })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
    expect(syncMock).not.toHaveBeenCalled()
    expect(openSyncRowMock).not.toHaveBeenCalled()
  })

  it('opens a manual sync row and always closes it as completed', async () => {
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(openSyncRowMock).toHaveBeenCalledTimes(1)
    expect(openSyncRowMock.mock.calls[0]![2]).toBe('manual')
    expect(closeSyncRowMock).toHaveBeenCalledTimes(1)
    const [, logId, result] = closeSyncRowMock.mock.calls[0] as [unknown, string, { partial: boolean }]
    expect(logId).toBe('log-1')
    expect(result.partial).toBe(false)
  })

  // §6 descreve este caso como "fake timers + cacheImage de 91 s". `vi.useFakeTimers`
  // NÃO controla o relógio interno de `AbortSignal.timeout` (API nativa do Node),
  // então o cenário de 91 s é dividido: aqui, o plumbing da action com o `partial`
  // que `syncInstagramAccount` devolve; em `test/instagram/sync.test.ts`, o prazo
  // real cortando o lote ("aborts a hung download…", relógio de verdade, 1 s).
  // As duas asserções observáveis de §6 — `{ ok:true, partial:true }`,
  // `closeSyncRow` `completed`, nenhuma `started` aberta — ficam cobertas.
  it('returns { ok: true, partial: true } and still closes the row when the deadline cut the run', async () => {
    syncMock.mockResolvedValue({
      postsFound: 9, postsInserted: 4, postsUpdated: 0, mediaCached: 2,
      partial: true, mediaFailed: 2,
    })
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({ ok: true, partial: true })
    // Nunca `Promise.race` no closeSyncRow: nenhuma linha `started` fica aberta.
    expect(closeSyncRowMock).toHaveBeenCalledTimes(1)
    const [, , closed] = closeSyncRowMock.mock.calls[0] as [unknown, unknown, { partial: boolean }]
    expect(closed.partial).toBe(true)
  })

  it('closes the row as failed and surfaces the human message on throw', async () => {
    syncMock.mockRejectedValue(new Error("This account isn't connected — use Connect with Instagram"))
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({
      ok: false,
      error: "This account isn't connected — use Connect with Instagram",
    })
    const [, , closedResult, message] = closeSyncRowMock.mock.calls[0] as [unknown, unknown, null, string]
    expect(closedResult).toBeNull()
    expect(message).toContain("isn't connected")
  })

  // Fix round 1, finding 1: the cron route reports per-account failures to
  // Sentry (route.ts:84); the HTTP hop this action used to make was the only
  // thing carrying that trace for a manual click. Losing it defeats the
  // point of this commit, so it must be restored here, tagged distinctly
  // from the cron path.
  it('captures the failure in Sentry, tagged as the manual sync path', async () => {
    syncMock.mockRejectedValue(new Error('boom'))
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const Sentry = await import('@sentry/nextjs')
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [err, ctx] = vi.mocked(Sentry.captureException).mock.calls[0] as [
      Error, { tags: Record<string, string> },
    ]
    expect(err.message).toBe('boom')
    expect(ctx.tags).toMatchObject({ component: 'instagram-sync', mode: 'manual' })
  })

  // Fix round 1, finding 2: `sync-log.ts` documents `logId === null` as the
  // failure signal the CALLER must report — this action was swallowing it.
  // A missing log row must never block the sync itself.
  it('reports a warning and still runs the sync when the log row fails to open', async () => {
    openSyncRowMock.mockResolvedValue(null)
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const Sentry = await import('@sentry/nextjs')
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({ ok: true })
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    const [message, ctx] = vi.mocked(Sentry.captureMessage).mock.calls[0] as [
      string, { level: string; extra: { accountId: string } },
    ]
    expect(message).toContain(ACCOUNT_ID)
    expect(ctx.level).toBe('warning')
    expect(ctx.extra.accountId).toBe(ACCOUNT_ID)
    // `closeSyncRow(supabase, null, …)` is a documented no-op — calling it
    // with the null logId must not throw or re-open anything.
    expect(closeSyncRowMock).toHaveBeenCalledTimes(1)
    expect(closeSyncRowMock.mock.calls[0]![1]).toBeNull()
  })

  // Fix round 1, finding 3: the try block used to wrap the post-success cache
  // invalidation too, so a throwing `revalidatePath` closed the SAME row a
  // second time as `failed`, corrupting a successful sync's own record.
  it('keeps the row completed, closed exactly once, when cache invalidation throws after success', async () => {
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error('revalidate exploded')
    })
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const Sentry = await import('@sentry/nextjs')
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({ ok: true })
    expect(closeSyncRowMock).toHaveBeenCalledTimes(1)
    const [, , closedResult] = closeSyncRowMock.mock.calls[0] as [unknown, unknown, { partial: boolean } | null]
    expect(closedResult).not.toBeNull()
    expect(closedResult?.partial).toBe(false)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [, ctx] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, { tags: Record<string, string> }]
    expect(ctx.tags).toMatchObject({ phase: 'revalidate' })
  })

  it('rejects a non-uuid accountId before touching the database', async () => {
    mockGetClient.mockReturnValue({ from: vi.fn() } as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: 'not-a-uuid' })
    expect(result.ok).toBe(false)
    expect(syncMock).not.toHaveBeenCalled()
  })
})

describe('settings segment config', () => {
  it('declares maxDuration = 120 (the Sync Now runs in this segment)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(
      join(__dirname, '..', '..', 'src', 'app', 'cms', '(authed)', 'settings', 'page.tsx'),
      'utf8',
    )
    expect(src).toMatch(/^export const maxDuration = 120$/m)
  })
})
