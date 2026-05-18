import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Proxy-based Supabase mock (same pattern as blog-hub-actions.test.ts) ───

type MockRow = Record<string, unknown>
type MockError = { message: string; code?: string } | null

let defaultRows: MockRow[] = []
let defaultError: MockError = null
let perTableRows: Record<string, MockRow[]> = {}
let perTableError: Record<string, MockError> = {}
let perTableSequence: Record<string, Array<{ rows?: MockRow[]; error?: MockError }>> = {}
let perTableCallIndex: Record<string, number> = {}
let callLog: Array<{ table: string; method: string; args: unknown[] }> = []

function createMockSupabase() {
  function makeChain(table: string) {
    let useSingle = false
    let isCountQuery = false
    const chain: Record<string, unknown> = {}

    const seqIdx = perTableCallIndex[table] ?? 0
    perTableCallIndex[table] = seqIdx + 1
    const seqEntry = perTableSequence[table]?.[seqIdx]

    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop: string) {
        if (prop === 'then') {
          const rows = seqEntry?.rows ?? perTableRows[table] ?? defaultRows
          const err = seqEntry?.error !== undefined ? seqEntry.error : (perTableError[table] ?? defaultError)
          if (isCountQuery) {
            return (resolve?: (v: unknown) => void) => resolve?.({ data: null, error: err, count: rows?.length ?? 0 })
          }
          if (useSingle) {
            return (resolve?: (v: unknown) => void) =>
              resolve?.({ data: err ? null : (rows?.[0] ?? null), error: err })
          }
          return (resolve?: (v: unknown) => void) =>
            resolve?.({ data: err ? null : rows, error: err, count: rows?.length ?? 0 })
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            useSingle = true
            return new Proxy(chain, handler)
          }
        }
        if (prop === 'from') {
          return (t: string) => {
            callLog.push({ table: t, method: 'from', args: [t] })
            return makeChain(t)
          }
        }
        return (...args: unknown[]) => {
          callLog.push({ table, method: prop, args })
          if (prop === 'select' && args.length >= 2) {
            const opts = args[1] as Record<string, unknown> | undefined
            if (opts?.count === 'exact' && opts?.head === true) isCountQuery = true
          }
          return new Proxy(chain, handler)
        }
      },
    }
    return new Proxy(chain, handler)
  }

  const mockStorage = {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/qr.svg' } }),
    })),
  }

  const top: Record<string, unknown> = {}
  const topHandler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'from') {
        return (t: string) => {
          callLog.push({ table: t, method: 'from', args: [t] })
          return makeChain(t)
        }
      }
      if (prop === 'storage') return mockStorage
      return undefined
    },
  }
  return new Proxy(top, topHandler)
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => createMockSupabase(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'test-user-id' } }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/media/upload', () => ({
  uploadMediaAsset: vi.fn().mockResolvedValue({
    ok: true,
    asset: {
      id: 'media-1',
      blobUrl: 'https://cdn/qr.svg',
      blobPathname: 'links/qr-abc123.svg',
      mimeType: 'image/svg+xml',
      filename: 'qr-abc123.svg',
    },
  }),
}))

vi.mock('@/lib/media/track-usage', () => ({
  trackMediaUsage: vi.fn().mockResolvedValue(undefined),
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  createLink,
  updateLink,
  deleteLink,
  duplicateLink,
  toggleLinkActive,
  bulkDeleteLinks,
  bulkToggleLinks,
  checkCodeAvailable,
  createAnnotation,
  createGoal,
  createAlert,
  saveAlertRule,
  toggleAlert,
  deleteAlertRule,
  getLinks,
  getLinkDetail,
  getAiInsights,
  generateQr,
  saveLinkSettings,
  saveUtmPreset,
  deleteUtmPreset,
  saveQrTemplate,
  deleteQrTemplate,
  validateDestinationUrl,
} from '../../src/app/cms/(authed)/links/actions'

import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetMockState(opts?: {
  rows?: MockRow[]
  error?: MockError
  perTable?: Record<string, MockRow[]>
  perTableErr?: Record<string, MockError>
  sequence?: Record<string, Array<{ rows?: MockRow[]; error?: MockError }>>
}) {
  defaultRows = opts?.rows ?? []
  defaultError = opts?.error ?? null
  perTableRows = opts?.perTable ?? {}
  perTableError = opts?.perTableErr ?? {}
  perTableSequence = opts?.sequence ?? {}
  perTableCallIndex = {}
  callLog = []
}

// ─── createLink ───────────────────────────────────────────────────────────────

describe('createLink', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: {
        tracked_links: [{ id: 'link-123' }],
      },
    })
  })

  it('returns linkId on success', async () => {
    const result = await createLink({
      destination_url: 'https://example.com/page',
      title: 'My Link',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.linkId).toBe('link-123')
    }
  })

  it('rejects invalid destination URL', async () => {
    const result = await createLink({ destination_url: 'not-a-url', title: 'Test' })
    expect(result.ok).toBe(false)
  })

  it('rejects empty destination URL', async () => {
    const result = await createLink({ destination_url: '', title: 'Test' })
    expect(result.ok).toBe(false)
  })

  it('returns code_taken on unique constraint violation', async () => {
    resetMockState({
      perTableErr: {
        tracked_links: { message: 'duplicate key', code: '23505' },
      },
    })
    const result = await createLink({
      destination_url: 'https://example.com',
      code: 'taken',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('code_taken')
    }
  })
})

// ─── updateLink ───────────────────────────────────────────────────────────────

describe('updateLink', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('returns error on empty id', async () => {
    const result = await updateLink('', { title: 'Updated' })
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid patch', async () => {
    const result = await updateLink('link-1', { title: 'Updated Title' })
    expect(result.ok).toBe(true)
  })

  it('rejects invalid destination_url if provided', async () => {
    const result = await updateLink('link-1', { destination_url: 'not-a-url' })
    expect(result.ok).toBe(false)
  })
})

// ─── deleteLink ───────────────────────────────────────────────────────────────

describe('deleteLink', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('returns error on empty id', async () => {
    const result = await deleteLink('')
    expect(result.ok).toBe(false)
  })

  it('soft-deletes by setting deleted_at', async () => {
    const result = await deleteLink('link-1')
    expect(result.ok).toBe(true)
    // Verify update was called on tracked_links
    const updateCall = callLog.find(c => c.table === 'tracked_links' && c.method === 'update')
    expect(updateCall).toBeDefined()
  })
})

// ─── duplicateLink ────────────────────────────────────────────────────────────

describe('duplicateLink', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      sequence: {
        tracked_links: [
          { rows: [{ destination_url: 'https://ex.com', title: 'Orig', source_type: 'manual', tags: [], utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, redirect_type: 302, expires_at: null }] },
          { rows: [{ id: 'link-copy-1' }] },
        ],
      },
    })
  })

  it('returns error on empty id', async () => {
    const result = await duplicateLink('')
    expect(result.ok).toBe(false)
  })

  it('returns linkId on success', async () => {
    const result = await duplicateLink('link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.linkId).toBe('link-copy-1')
    }
  })
})

// ─── toggleLinkActive ─────────────────────────────────────────────────────────

describe('toggleLinkActive', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      sequence: {
        tracked_links: [
          { rows: [{ id: 'link-1', active: true }] },
          { rows: [] },
        ],
      },
    })
  })

  it('returns error on empty id', async () => {
    const result = await toggleLinkActive('')
    expect(result.ok).toBe(false)
  })

  it('flips active boolean', async () => {
    const result = await toggleLinkActive('link-1')
    expect(result.ok).toBe(true)
  })
})

// ─── bulkDeleteLinks ──────────────────────────────────────────────────────────

describe('bulkDeleteLinks', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('returns error on empty array', async () => {
    const result = await bulkDeleteLinks([])
    expect(result.ok).toBe(false)
  })

  it('soft-deletes multiple links', async () => {
    const result = await bulkDeleteLinks(['link-1', 'link-2'])
    expect(result.ok).toBe(true)
  })
})

// ─── bulkToggleLinks ──────────────────────────────────────────────────────────

describe('bulkToggleLinks', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('returns error on empty array', async () => {
    const result = await bulkToggleLinks([], true)
    expect(result.ok).toBe(false)
  })

  it('activates multiple links', async () => {
    const result = await bulkToggleLinks(['link-1', 'link-2'], true)
    expect(result.ok).toBe(true)
  })
})

// ─── checkCodeAvailable ───────────────────────────────────────────────────────

describe('checkCodeAvailable', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('returns error on empty code', async () => {
    const result = await checkCodeAvailable('')
    expect(result.ok).toBe(false)
  })

  it('returns available=true when code is not taken', async () => {
    resetMockState({ perTable: { tracked_links: [] } })
    const result = await checkCodeAvailable('my-code')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.available).toBe(true)
    }
  })
})

// ─── createAnnotation ─────────────────────────────────────────────────────────

describe('createAnnotation', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: { link_annotations: [{ id: 'ann-1' }] },
    })
  })

  it('returns error when label is missing', async () => {
    const result = await createAnnotation({ link_id: 'link-1', label: '' })
    expect(result.ok).toBe(false)
  })

  it('returns annotationId on success', async () => {
    const result = await createAnnotation({ link_id: 'link-1', label: 'Campaign launch' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.annotationId).toBe('ann-1')
    }
  })
})

// ─── createGoal ───────────────────────────────────────────────────────────────

describe('createGoal', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: { link_goals: [{ id: 'goal-1' }] },
    })
  })

  it('returns error when metric is missing', async () => {
    const result = await createGoal({ link_id: 'link-1', metric: '', target_value: 100 })
    expect(result.ok).toBe(false)
  })

  it('returns goalId on success', async () => {
    const result = await createGoal({ link_id: 'link-1', metric: 'clicks', target_value: 1000 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.goalId).toBe('goal-1')
    }
  })
})

// ─── createAlert ──────────────────────────────────────────────────────────────

describe('createAlert', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: { link_alerts: [{ id: 'alert-1' }] },
    })
  })

  it('returns error when metric is missing', async () => {
    const result = await createAlert({ link_id: 'link-1', alert_type: 'threshold', metric: '', condition: {} })
    expect(result.ok).toBe(false)
  })

  it('returns alertId on success', async () => {
    const result = await createAlert({ link_id: 'link-1', alert_type: 'threshold', metric: 'clicks', condition: { operator: 'gt', threshold: 100 } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.alertId).toBe('alert-1')
    }
  })
})

// ─── saveAlertRule ────────────────────────────────────────────────────────────

describe('saveAlertRule', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: { link_alerts: [{ id: 'rule-1' }] },
    })
  })

  it('returns error when metric is invalid', async () => {
    const result = await saveAlertRule({
      link_id: 'link-1',
      metric: '' as 'clicks',
      operator: 'gt',
      threshold: 100,
      window_minutes: 60,
    })
    expect(result.ok).toBe(false)
  })

  it('returns ok for valid alert rule (insert)', async () => {
    const result = await saveAlertRule({
      link_id: '00000000-0000-0000-0000-000000000001',
      metric: 'clicks',
      operator: 'gt',
      threshold: 100,
      window_minutes: 60,
    })
    expect(result.ok).toBe(true)
  })

  it('returns ok for valid alert rule (update)', async () => {
    const result = await saveAlertRule({
      id: '00000000-0000-0000-0000-000000000099',
      link_id: '00000000-0000-0000-0000-000000000001',
      metric: 'clicks',
      operator: 'gt',
      threshold: 200,
      window_minutes: 120,
    })
    expect(result.ok).toBe(true)
  })
})

// ─── toggleAlert ──────────────────────────────────────────────────────────────

describe('toggleAlert', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      sequence: {
        link_alerts: [
          { rows: [{ id: 'a-1', active: true }] },
          { rows: [] },
        ],
      },
    })
  })

  it('returns error on empty id', async () => {
    const result = await toggleAlert('')
    expect(result.ok).toBe(false)
  })

  it('toggles alert active state', async () => {
    const result = await toggleAlert('a-1')
    expect(result.ok).toBe(true)
  })
})

// ─── deleteAlertRule ──────────────────────────────────────────────────────────

describe('deleteAlertRule', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('returns error on empty id', async () => {
    const result = await deleteAlertRule('')
    expect(result.ok).toBe(false)
  })

  it('returns ok on valid id', async () => {
    const result = await deleteAlertRule('rule-1')
    expect(result.ok).toBe(true)
  })
})

// ─── getLinks ─────────────────────────────────────────────────────────────────

describe('getLinks', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: {
        tracked_links: [{ id: 'link-1', title: 'Test', code: 'abc' }],
      },
    })
  })

  it('returns paginated list', async () => {
    const result = await getLinks('site-1', {})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Array.isArray(result.links)).toBe(true)
    }
  })

  it('returns error on invalid filters', async () => {
    const result = await getLinks('site-1', { page: -1 })
    expect(result.ok).toBe(false)
  })
})

// ─── getLinkDetail ────────────────────────────────────────────────────────────

describe('getLinkDetail', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      perTable: {
        tracked_links: [{ id: 'link-1', code: 'abc', destination_url: 'https://example.com' }],
      },
    })
  })

  it('returns error on empty id', async () => {
    const result = await getLinkDetail('')
    expect(result.ok).toBe(false)
  })

  it('returns link data on valid id', async () => {
    const result = await getLinkDetail('link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.link).toBeDefined()
    }
  })
})

// ─── getAiInsights ────────────────────────────────────────────────────────────

describe('getAiInsights', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      sequence: {
        tracked_links: [
          { rows: [{ id: 'link-1', title: 'Test', total_clicks: 50, unique_visitors: 30 }] },
        ],
        link_daily_metrics: [{ rows: [] }],
      },
    })
  })

  it('returns error on empty id', async () => {
    const result = await getAiInsights('')
    expect(result.ok).toBe(false)
  })

  it('returns insights array', async () => {
    const result = await getAiInsights('link-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Array.isArray(result.insights)).toBe(true)
    }
  })
})

// ─── generateQr ───────────────────────────────────────────────────────────────

describe('generateQr', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState({
      sequence: {
        tracked_links: [
          { rows: [{ id: 'link-1', code: 'abc123' }] },
          { rows: [] }, // update response
        ],
      },
    })
  })

  it('returns error on empty id', async () => {
    const result = await generateQr('', {})
    expect(result.ok).toBe(false)
  })

  it('returns qrUrl on success', async () => {
    const result = await generateQr('link-1', { size: 512 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.qrUrl).toContain('https://')
    }
  })
})

// ─── Settings actions ─────────────────────────────────────────────────────────

describe('settings actions', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('saveLinkSettings upserts successfully', async () => {
    const result = await saveLinkSettings({ default_redirect_type: 301 })
    expect(result.ok).toBe(true)
  })

  it('saveLinkSettings returns error on DB failure', async () => {
    perTableError['link_settings'] = { message: 'upsert_failed' }
    const result = await saveLinkSettings({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('upsert_failed')
  })

  it('saveUtmPreset returns error on empty name', async () => {
    const result = await saveUtmPreset({ name: '', utm_source: 's', utm_medium: 'm', utm_campaign: 'c' })
    expect(result.ok).toBe(false)
  })

  it('saveUtmPreset inserts and returns id', async () => {
    perTableRows['link_utm_presets'] = [{ id: 'preset-1' }]
    const result = await saveUtmPreset({ name: 'preset-1', utm_source: 's', utm_medium: 'm', utm_campaign: 'c' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.id).toBe('preset-1')
  })

  it('deleteUtmPreset returns error on empty id', async () => {
    const result = await deleteUtmPreset('')
    expect(result.ok).toBe(false)
  })

  it('deleteUtmPreset succeeds with valid id', async () => {
    const result = await deleteUtmPreset('preset-1')
    expect(result.ok).toBe(true)
  })

  it('saveQrTemplate returns error on empty name', async () => {
    const result = await saveQrTemplate({ name: '', config: {} })
    expect(result.ok).toBe(false)
  })

  it('saveQrTemplate inserts and returns id', async () => {
    perTableRows['link_qr_templates'] = [{ id: 'tmpl-1' }]
    const result = await saveQrTemplate({ name: 'tmpl', config: { color: '#000' } })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.id).toBe('tmpl-1')
  })

  it('deleteQrTemplate returns error on empty id', async () => {
    const result = await deleteQrTemplate('')
    expect(result.ok).toBe(false)
  })

  it('deleteQrTemplate succeeds with valid id', async () => {
    const result = await deleteQrTemplate('tmpl-1')
    expect(result.ok).toBe(true)
  })
})

// ─── validateDestinationUrl ──────────────────────────────────────────────────

describe('validateDestinationUrl', () => {
  beforeEach(() => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'test-user-id' } })
    resetMockState()
  })

  it('rejects invalid URL', async () => {
    const result = await validateDestinationUrl('not-a-url')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_url')
  })
})

// ─── RBAC enforcement ─────────────────────────────────────────────────────────

describe('RBAC enforcement', () => {
  beforeEach(() => {
    resetMockState()
  })

  it('throws forbidden when requireSiteScope denies access', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'insufficient_access',
    })
    await expect(
      createLink({ destination_url: 'https://example.com', title: 'Test' }),
    ).rejects.toThrow('forbidden')
  })

  it('throws unauthenticated when no session', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({
      ok: false,
      reason: 'unauthenticated',
    })
    await expect(deleteLink('link-1')).rejects.toThrow('unauthenticated')
  })
})
