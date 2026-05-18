import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: '11111111-1111-1111-1111-111111111111',
    orgId: 'org-1',
    defaultLocale: 'pt-br',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.example.com/template.png' }),
}))

// ---------------------------------------------------------------------------
// Supabase mock state — mutated per-test via helpers
// ---------------------------------------------------------------------------

const SITE_ID = '11111111-1111-1111-1111-111111111111'
const TEMPLATE_ID = '22222222-2222-2222-2222-222222222222'
const OTHER_SITE_ID = '33333333-3333-3333-3333-333333333333'

// Mutable results controlled by individual tests
let singleCallCount = 0
let singleResults: Array<{ data: unknown; error: unknown }> = []
let listResult: { data: unknown; error: unknown } = { data: [], error: null }
let insertResult: { data: unknown; error: unknown } = { data: null, error: null }
let updateResult: { data: unknown; error: unknown } = { data: null, error: null }
let deleteResult: { data: unknown; error: unknown } = { data: null, error: null }

// Spy functions to assert on calls
const mockFrom = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

function resetMockState() {
  singleCallCount = 0
  singleResults = []
  listResult = { data: [], error: null }
  insertResult = { data: null, error: null }
  updateResult = { data: null, error: null }
  deleteResult = { data: null, error: null }
  mockFrom.mockClear()
  mockInsert.mockClear()
  mockUpdate.mockClear()
  mockDelete.mockClear()
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      mockFrom(table)
      // Return a chainable proxy object
      const proxy: Record<string, unknown> = {}

      proxy.select = vi.fn().mockReturnValue(proxy)

      proxy.insert = vi.fn().mockImplementation((row: unknown) => {
        mockInsert(table, row)
        return Promise.resolve(insertResult)
      })

      proxy.update = vi.fn().mockImplementation((patch: unknown) => {
        mockUpdate(table, patch)
        return proxy
      })

      proxy.delete = vi.fn().mockImplementation(() => {
        mockDelete(table)
        return proxy
      })

      proxy.eq = vi.fn().mockReturnValue(proxy)
      proxy.or = vi.fn().mockReturnValue(proxy)
      proxy.order = vi.fn().mockReturnValue(proxy)
      proxy.not = vi.fn().mockReturnValue(proxy)

      proxy.single = vi.fn().mockImplementation(() => {
        const idx = singleCallCount++
        const result = singleResults[idx] ?? { data: null, error: null }
        return Promise.resolve(result)
      })

      // Thenable: when the chain is awaited directly (e.g. list queries)
      proxy.then = (
        resolve: (v: unknown) => unknown,
        reject: (e: unknown) => unknown,
      ) => Promise.resolve(listResult).then(resolve, reject)

      return proxy
    },
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validComposition = {
  version: 1 as const,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: { type: 'solid' as const, color: '#000000' },
  elements: [
    {
      id: 'el-1',
      type: 'text' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{title}}',
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '0em',
      align: 'left' as const,
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

const sampleTemplateRow = {
  id: TEMPLATE_ID,
  site_id: SITE_ID,
  name: 'My Template',
  aspect_ratio: '9:16',
  composition: validComposition,
  thumbnail_url: null,
  is_default: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Import actions after mocks are defined
// ---------------------------------------------------------------------------
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  duplicateTemplate,
} from '@/lib/social/actions/templates'

// ---------------------------------------------------------------------------
// A. listTemplates
// ---------------------------------------------------------------------------

describe('listTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('rejects invalid siteId (not a UUID)', async () => {
    const result = await listTemplates('not-a-uuid')
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns empty array when no templates exist', async () => {
    listResult = { data: [], error: null }
    const result = await listTemplates(SITE_ID)
    expect(result).toEqual({ ok: true, data: [] })
  })

  it('returns templates for the site including global templates (site_id IS NULL)', async () => {
    const globalRow = { ...sampleTemplateRow, id: '44444444-4444-4444-4444-444444444444', site_id: null, name: 'Global Template' }
    listResult = { data: [sampleTemplateRow, globalRow], error: null }

    const result = await listTemplates(SITE_ID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('My Template')
      expect(result.data[1].name).toBe('Global Template')
      expect(result.data[1].site_id).toBeNull()
    }
  })

  it('returns error when supabase query fails', async () => {
    listResult = { data: null, error: { message: 'connection refused' } }
    const result = await listTemplates(SITE_ID)
    expect(result).toEqual({ ok: false, error: 'connection refused' })
  })

  it('rejects invalid aspect ratio filter', async () => {
    const result = await listTemplates(SITE_ID, '4:3' as never)
    expect(result).toEqual({ ok: false, error: 'Invalid aspect ratio' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('accepts valid aspect ratio filter and returns matching templates', async () => {
    listResult = { data: [sampleTemplateRow], error: null }
    const result = await listTemplates(SITE_ID, '9:16')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].aspect_ratio).toBe('9:16')
    }
  })
})

// ---------------------------------------------------------------------------
// B. createTemplate
// ---------------------------------------------------------------------------

describe('createTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('creates template with correct fields and returns new id', async () => {
    insertResult = { data: null, error: null }

    const result = await createTemplate({
      name: 'New Template',
      aspectRatio: '1:1',
      composition: validComposition,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBeDefined()
      expect(typeof result.data.id).toBe('string')
      expect(result.data.id).toMatch(/^[0-9a-f-]{36}$/)
    }

    expect(mockInsert).toHaveBeenCalledWith(
      'social_templates',
      expect.objectContaining({
        site_id: SITE_ID,
        name: 'New Template',
        aspect_ratio: '1:1',
        is_default: false,
      }),
    )
  })

  it('rejects when name is empty (Zod validation fails)', async () => {
    const result = await createTemplate({
      name: '',
      aspectRatio: '1:1',
      composition: validComposition,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects when aspect ratio is invalid', async () => {
    const result = await createTemplate({
      name: 'Test',
      aspectRatio: '4:3' as never,
      composition: validComposition,
    })
    expect(result.ok).toBe(false)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects when composition fails Zod validation (missing version)', async () => {
    const { version: _v, ...noVersion } = validComposition
    const result = await createTemplate({
      name: 'Test',
      aspectRatio: '9:16',
      composition: noVersion as never,
    })
    expect(result.ok).toBe(false)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when insert fails', async () => {
    insertResult = { data: null, error: { message: 'unique constraint violated' } }

    const result = await createTemplate({
      name: 'Duplicate',
      aspectRatio: '16:9',
      composition: validComposition,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('unique constraint violated')
    }
  })
})

// ---------------------------------------------------------------------------
// C. updateTemplate
// ---------------------------------------------------------------------------

describe('updateTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('rejects invalid template ID (not a UUID)', async () => {
    const result = await updateTemplate('not-a-uuid', { name: 'New Name' })
    expect(result).toEqual({ ok: false, error: 'Invalid template ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects update to system templates (site_id IS NULL)', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, site_id: null }, error: null }]

    const result = await updateTemplate(TEMPLATE_ID, { name: 'New Name' })
    expect(result).toEqual({ ok: false, error: 'Cannot edit system default templates' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns forbidden when template belongs to another site', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, site_id: OTHER_SITE_ID }, error: null }]

    const result = await updateTemplate(TEMPLATE_ID, { name: 'New Name' })
    expect(result).toEqual({ ok: false, error: 'forbidden' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates template fields successfully', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, site_id: SITE_ID }, error: null }]
    updateResult = { data: null, error: null }

    const result = await updateTemplate(TEMPLATE_ID, { name: 'Updated Name' })
    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      'social_templates',
      expect.objectContaining({ name: 'Updated Name' }),
    )
  })

  it('returns error when template not found', async () => {
    singleResults = [{ data: null, error: { message: 'PGRST116' } }]

    const result = await updateTemplate(TEMPLATE_ID, { name: 'New' })
    expect(result).toEqual({ ok: false, error: 'Template not found' })
  })

  it('rejects update when name is empty (Zod validation)', async () => {
    const result = await updateTemplate(TEMPLATE_ID, { name: '' })
    expect(result.ok).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// D. deleteTemplate
// ---------------------------------------------------------------------------

describe('deleteTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('rejects invalid template ID', async () => {
    const result = await deleteTemplate('bad-id')
    expect(result).toEqual({ ok: false, error: 'Invalid template ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects deletion of system templates (site_id IS NULL)', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, site_id: null }, error: null }]

    const result = await deleteTemplate(TEMPLATE_ID)
    expect(result).toEqual({ ok: false, error: 'Cannot delete system default templates' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns forbidden when template belongs to another site', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, site_id: OTHER_SITE_ID }, error: null }]

    const result = await deleteTemplate(TEMPLATE_ID)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes the template successfully', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, site_id: SITE_ID }, error: null }]
    deleteResult = { data: null, error: null }

    const result = await deleteTemplate(TEMPLATE_ID)
    expect(result.ok).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('social_templates')
  })

  it('returns error when template not found', async () => {
    singleResults = [{ data: null, error: { message: 'no rows returned' } }]

    const result = await deleteTemplate(TEMPLATE_ID)
    expect(result).toEqual({ ok: false, error: 'Template not found' })
  })
})

// ---------------------------------------------------------------------------
// E. setDefaultTemplate
// ---------------------------------------------------------------------------

describe('setDefaultTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('rejects invalid template ID', async () => {
    const result = await setDefaultTemplate('bad-id', SITE_ID)
    expect(result).toEqual({ ok: false, error: 'Invalid template ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects invalid site ID', async () => {
    const result = await setDefaultTemplate(TEMPLATE_ID, 'bad-site')
    expect(result).toEqual({ ok: false, error: 'Invalid site ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns forbidden when siteId does not match authorized site', async () => {
    const result = await setDefaultTemplate(TEMPLATE_ID, OTHER_SITE_ID)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when template not found', async () => {
    singleResults = [{ data: null, error: { message: 'not found' } }]

    const result = await setDefaultTemplate(TEMPLATE_ID, SITE_ID)
    expect(result).toEqual({ ok: false, error: 'Template not found' })
  })

  it('returns forbidden when template belongs to a different site', async () => {
    singleResults = [{ data: { id: TEMPLATE_ID, aspect_ratio: '1:1', site_id: OTHER_SITE_ID }, error: null }]

    const result = await setDefaultTemplate(TEMPLATE_ID, SITE_ID)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('clears previous default then sets new one for site-owned template', async () => {
    singleResults = [
      { data: { id: TEMPLATE_ID, aspect_ratio: '16:9', site_id: SITE_ID }, error: null },
    ]
    updateResult = { data: null, error: null }

    const result = await setDefaultTemplate(TEMPLATE_ID, SITE_ID)
    expect(result.ok).toBe(true)

    // First update unsets existing defaults, second update sets the new one
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenNthCalledWith(
      1,
      'social_templates',
      expect.objectContaining({ is_default: false }),
    )
    expect(mockUpdate).toHaveBeenNthCalledWith(
      2,
      'social_templates',
      expect.objectContaining({ is_default: true }),
    )
  })

  it('creates a site-scoped copy when setting a global template as default', async () => {
    // setDefaultTemplate does: fetch template (single), then for global: fetch full row (second single), insert copy
    singleResults = [
      // First single: get template to check aspect_ratio + site_id
      { data: { id: TEMPLATE_ID, aspect_ratio: '1:1', site_id: null }, error: null },
      // Second single: fetch full global template data for copy
      { data: { ...sampleTemplateRow, site_id: null }, error: null },
    ]
    insertResult = { data: null, error: null }

    const result = await setDefaultTemplate(TEMPLATE_ID, SITE_ID)
    expect(result.ok).toBe(true)

    expect(mockInsert).toHaveBeenCalledWith(
      'social_templates',
      expect.objectContaining({
        site_id: SITE_ID,
        is_default: true,
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// F. duplicateTemplate
// ---------------------------------------------------------------------------

describe('duplicateTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  it('rejects invalid template ID', async () => {
    const result = await duplicateTemplate('not-valid')
    expect(result).toEqual({ ok: false, error: 'Invalid template ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when source template not found', async () => {
    singleResults = [{ data: null, error: { message: 'no rows' } }]

    const result = await duplicateTemplate(TEMPLATE_ID)
    expect(result).toEqual({ ok: false, error: 'Template not found' })
  })

  it('returns forbidden when source template belongs to another site', async () => {
    singleResults = [{ data: { ...sampleTemplateRow, site_id: OTHER_SITE_ID }, error: null }]

    const result = await duplicateTemplate(TEMPLATE_ID)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('creates a copy with "Copy of" prefix and returns new id', async () => {
    singleResults = [{ data: { ...sampleTemplateRow, site_id: SITE_ID }, error: null }]
    insertResult = { data: null, error: null }

    const result = await duplicateTemplate(TEMPLATE_ID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBeDefined()
      expect(result.data.id).not.toBe(TEMPLATE_ID)
    }

    expect(mockInsert).toHaveBeenCalledWith(
      'social_templates',
      expect.objectContaining({
        name: 'Copy of My Template',
        site_id: SITE_ID,
        is_default: false,
      }),
    )
  })

  it('new template belongs to the current site, not the source site', async () => {
    singleResults = [{ data: { ...sampleTemplateRow, site_id: SITE_ID }, error: null }]
    insertResult = { data: null, error: null }

    await duplicateTemplate(TEMPLATE_ID)

    expect(mockInsert).toHaveBeenCalledWith(
      'social_templates',
      expect.objectContaining({ site_id: SITE_ID }),
    )
  })

  it('can duplicate a global template (site_id IS NULL) into the current site', async () => {
    singleResults = [{ data: { ...sampleTemplateRow, site_id: null, name: 'Global Base' }, error: null }]
    insertResult = { data: null, error: null }

    const result = await duplicateTemplate(TEMPLATE_ID)
    expect(result.ok).toBe(true)
    expect(mockInsert).toHaveBeenCalledWith(
      'social_templates',
      expect.objectContaining({
        name: 'Copy of Global Base',
        site_id: SITE_ID,
      }),
    )
  })

  it('returns error when insert fails during duplication', async () => {
    singleResults = [{ data: { ...sampleTemplateRow, site_id: SITE_ID }, error: null }]
    insertResult = { data: null, error: { message: 'storage limit exceeded' } }

    const result = await duplicateTemplate(TEMPLATE_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('storage limit exceeded')
    }
  })
})
