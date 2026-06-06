import { describe, it, expect, vi, beforeEach } from 'vitest'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_LINK_ID = '44444444-4444-4444-4444-444444444444'

// ---------------------------------------------------------------------------
// Mock: MCP context + auth
// ---------------------------------------------------------------------------
let mockPermissions: string[] = ['read', 'write']

vi.mock('@/lib/pipeline/mcp/context', () => ({
  getMcpContext: vi.fn(() => ({
    siteId: MOCK_SITE_ID,
    permissions: mockPermissions,
    keyHash: 'test',
  })),
}))

vi.mock('@/lib/pipeline/mcp/auth', () => ({
  mcpRequirePermission: vi.fn((ctx: { permissions: string[] }, required: string) =>
    ctx.permissions.includes(required),
  ),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({})),
}))

// ---------------------------------------------------------------------------
// Mock: links service layer — the dispatch target
// ---------------------------------------------------------------------------
const mockListTrackedLinks = vi.fn()
const mockCreateTrackedLink = vi.fn()
const mockGetTrackedLink = vi.fn()
const mockUpdateTrackedLink = vi.fn()
const mockArchiveTrackedLink = vi.fn()

vi.mock('@/lib/pipeline/services/links', () => ({
  listTrackedLinks: (...a: unknown[]) => mockListTrackedLinks(...a),
  createTrackedLink: (...a: unknown[]) => mockCreateTrackedLink(...a),
  getTrackedLink: (...a: unknown[]) => mockGetTrackedLink(...a),
  updateTrackedLink: (...a: unknown[]) => mockUpdateTrackedLink(...a),
  archiveTrackedLink: (...a: unknown[]) => mockArchiveTrackedLink(...a),
}))

import { manageLinks } from '@/lib/pipeline/mcp/services/links'

function parse(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
  return JSON.parse(result.content[0]!.text)
}

describe('manageLinks MCP adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissions = ['read', 'write']
  })

  it('list dispatches to listTrackedLinks and returns data', async () => {
    mockListTrackedLinks.mockResolvedValue({
      data: { data: [{ id: MOCK_LINK_ID, code: 'abc1234', short_url: '.../go/abc1234' }], meta: { total: 1, has_next: false, limit: 50 } },
    })

    const res = await manageLinks({ action: 'list', utm_campaign: 'junho-2026' })
    expect(res.isError).toBe(false)
    expect(mockListTrackedLinks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ utm_campaign: 'junho-2026' }),
    )
    const body = parse(res)
    expect(body.data[0].code).toBe('abc1234')
  })

  it('undefined action defaults to list', async () => {
    mockListTrackedLinks.mockResolvedValue({ data: { data: [], meta: { total: 0, has_next: false, limit: 50 } } })
    const res = await manageLinks({})
    expect(res.isError).toBe(false)
    expect(mockListTrackedLinks).toHaveBeenCalled()
  })

  it('get requires id', async () => {
    const res = await manageLinks({ action: 'get' })
    expect(res.isError).toBe(true)
    expect(parse(res).code).toBe('VALIDATION_ERROR')
  })

  it('create dry_run (default) previews without calling the service', async () => {
    const res = await manageLinks({ action: 'create', destination_url: 'https://example.com' })
    expect(res.isError).toBe(false)
    const body = parse(res)
    expect(body.dry_run).toBe(true)
    expect(body.action).toBe('create_link')
    expect(mockCreateTrackedLink).not.toHaveBeenCalled()
  })

  it('create dry_run rejects missing destination_url', async () => {
    const res = await manageLinks({ action: 'create' })
    expect(res.isError).toBe(true)
    expect(parse(res).code).toBe('VALIDATION_ERROR')
  })

  it('create dry_run:false executes the service (without action/dry_run keys)', async () => {
    mockCreateTrackedLink.mockResolvedValue({
      data: { id: MOCK_LINK_ID, code: 'abc1234', short_url: '.../go/abc1234', source_type: 'manual' },
      status: 201,
    })
    const res = await manageLinks({
      action: 'create',
      dry_run: false,
      destination_url: 'https://example.com',
      utm_campaign: 'junho-2026',
    })
    expect(res.isError).toBe(false)
    expect(mockCreateTrackedLink).toHaveBeenCalledTimes(1)
    const passedInput = mockCreateTrackedLink.mock.calls[0]![1] as Record<string, unknown>
    expect(passedInput).not.toHaveProperty('action')
    expect(passedInput).not.toHaveProperty('dry_run')
    expect(passedInput.destination_url).toBe('https://example.com')
    expect(parse(res).code).toBe('abc1234')
  })

  it('write actions are blocked without write permission', async () => {
    mockPermissions = ['read']
    const res = await manageLinks({ action: 'create', dry_run: false, destination_url: 'https://example.com' })
    expect(res.isError).toBe(true)
    expect(parse(res).code).toBe('FORBIDDEN')
    expect(mockCreateTrackedLink).not.toHaveBeenCalled()
  })

  it('update requires id', async () => {
    const res = await manageLinks({ action: 'update' })
    expect(res.isError).toBe(true)
    expect(parse(res).code).toBe('VALIDATION_ERROR')
  })

  it('update dry_run previews the diff', async () => {
    mockGetTrackedLink.mockResolvedValue({ data: { id: MOCK_LINK_ID, code: 'abc1234', utm_campaign: 'old' } })
    const res = await manageLinks({ action: 'update', id: MOCK_LINK_ID, utm_campaign: 'new' })
    expect(res.isError).toBe(false)
    const body = parse(res)
    expect(body.dry_run).toBe(true)
    expect(body.changes).toEqual(
      expect.arrayContaining([{ field: 'utm_campaign', from: 'old', to: 'new' }]),
    )
    expect(mockUpdateTrackedLink).not.toHaveBeenCalled()
  })

  it('update dry_run:false executes', async () => {
    mockUpdateTrackedLink.mockResolvedValue({ data: { id: MOCK_LINK_ID, utm_campaign: 'new' } })
    const res = await manageLinks({ action: 'update', dry_run: false, id: MOCK_LINK_ID, utm_campaign: 'new' })
    expect(res.isError).toBe(false)
    expect(mockUpdateTrackedLink).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_LINK_ID,
      expect.objectContaining({ utm_campaign: 'new' }),
    )
  })

  it('archive dry_run previews active=false', async () => {
    mockGetTrackedLink.mockResolvedValue({ data: { id: MOCK_LINK_ID, code: 'abc1234', active: true } })
    const res = await manageLinks({ action: 'archive', id: MOCK_LINK_ID })
    expect(res.isError).toBe(false)
    const body = parse(res)
    expect(body.dry_run).toBe(true)
    expect(body.changes).toEqual([{ field: 'active', from: true, to: false }])
    expect(mockArchiveTrackedLink).not.toHaveBeenCalled()
  })

  it('archive dry_run:false executes', async () => {
    mockArchiveTrackedLink.mockResolvedValue({ data: { id: MOCK_LINK_ID, active: false } })
    const res = await manageLinks({ action: 'archive', dry_run: false, id: MOCK_LINK_ID })
    expect(res.isError).toBe(false)
    expect(mockArchiveTrackedLink).toHaveBeenCalledWith(expect.anything(), MOCK_LINK_ID)
    expect(parse(res).active).toBe(false)
  })

  it('unknown action returns VALIDATION_ERROR', async () => {
    const res = await manageLinks({ action: 'frobnicate' })
    expect(res.isError).toBe(true)
    expect(parse(res).code).toBe('VALIDATION_ERROR')
  })
})
