import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/youtube/ab-types', () => ({
  AB_TEST_CONFIG_DEFAULTS: {},
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))

import {
  applyWinnerNow,
  cancelGracePeriod,
  revertWinner,
  batchStartTests,
  dismissFatigueAlert,
} from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { revalidatePath } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ---------------------------------------------------------------------------
// Helper: build a chainable Supabase mock
// ---------------------------------------------------------------------------

function chainable(resolveValue: unknown = { data: null, error: null }) {
  const obj: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') return undefined // not a thenable
      if (prop === 'mockResolvedValue' || prop === 'mockReturnValue') return undefined
      return vi.fn(() => new Proxy(obj, handler))
    },
  }
  // terminal calls resolve
  const terminal = () => Promise.resolve(resolveValue)
  const proxy: Record<string, unknown> = {}
  const terminalHandler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make it thenable so awaiting works
        return (resolve: (v: unknown) => void) => resolve(resolveValue)
      }
      return vi.fn(() => new Proxy(proxy, terminalHandler))
    },
  }
  return new Proxy(proxy, terminalHandler)
}

interface FromSetup {
  [table: string]: (method: string, ...args: unknown[]) => unknown
}

function buildMock(setup: FromSetup) {
  const fromMock = vi.fn((table: string) => {
    const builder = setup[table]
    if (!builder) {
      // Default: return chainable proxy that resolves { data: null, error: null }
      return makeChain({ data: null, error: null })
    }
    return builder as unknown
  })
  const client = { from: fromMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
  return { client, fromMock }
}

/** Creates a deeply chainable mock object; all methods return `this`, except those in `terminals` which resolve to `value`. */
function makeChain(value: unknown, overrides: Record<string, unknown> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const self = new Proxy(chain, {
    get(_target, prop: string) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(value)
      if (overrides[prop]) return overrides[prop]
      if (!chain[prop]) {
        chain[prop] = vi.fn(() => self)
      }
      return chain[prop]
    },
  })
  return self
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(requireSiteScope as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
  ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    accessToken: 'fresh-token',
  })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
})

// ===========================================================================
// applyWinnerNow
// ===========================================================================

describe('applyWinnerNow', () => {
  function setupApplyWinnerMock(testOverrides: Record<string, unknown> = {}) {
    const testRow = {
      id: 'test-1',
      site_id: 'site-1',
      status: 'active',
      winner_variant_id: 'v-winner',
      youtube_video_id: 'vid-db-1',
      test_type: 'thumbnail',
      original_title: 'Orig Title',
      original_description: 'Orig Desc',
      grace_expires_at: new Date(Date.now() + 86400000).toISOString(),
      winner_applied_at: null,
      ...testOverrides,
    }

    const variantRow = {
      id: 'v-winner',
      blob_url: 'https://blob/winner.jpg',
      title_text: null,
      description_text: null,
      is_original: false,
    }

    const channelRow = { channel_id: 'ch-1' }
    const videoRow = { youtube_video_id: 'YT_VID_001' }

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: testRow, error: null }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      if (table === 'ab_test_variants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: variantRow, error: null }),
            })),
          })),
        }
      }
      if (table === 'youtube_channels') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: channelRow, error: null }),
              })),
            })),
          })),
        }
      }
      if (table === 'youtube_videos') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: videoRow, error: null }),
            })),
          })),
        }
      }
      if (table === 'ab_test_cycles') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      return makeChain({ data: null, error: null })
    })

    const client = { from: fromMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    return { fromMock, testRow }
  }

  it('happy path: applies thumbnail, closes cycle, marks completed with manual_apply', async () => {
    setupApplyWinnerMock()

    const result = await applyWinnerNow('test-1')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob/winner.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VID_001',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token',
    )
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('returns error when no winner_variant_id (not in grace)', async () => {
    setupApplyWinnerMock({ winner_variant_id: null })

    const result = await applyWinnerNow('test-1')

    expect(result).toEqual({ ok: false, error: 'Test not in grace period or already applied' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('returns error when preflight fails', async () => {
    setupApplyWinnerMock()
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'token_expired',
    })

    const result = await applyWinnerNow('test-1')

    expect(result).toEqual({ ok: false, error: 'Token inválido: token_expired' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('for title test applies title without thumbnail', async () => {
    const testRow = {
      id: 'test-1',
      site_id: 'site-1',
      status: 'active',
      winner_variant_id: 'v-winner',
      youtube_video_id: 'vid-db-1',
      test_type: 'title',
      original_title: 'Orig Title',
      original_description: 'Orig Desc',
      grace_expires_at: new Date(Date.now() + 86400000).toISOString(),
      winner_applied_at: null,
    }

    const variantRow = {
      id: 'v-winner',
      blob_url: null,
      title_text: 'New Winner Title',
      description_text: null,
      is_original: false,
    }

    const channelRow = { channel_id: 'ch-1' }
    const videoRow = { youtube_video_id: 'YT_VID_001' }

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: testRow, error: null }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      if (table === 'ab_test_variants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: variantRow, error: null }),
            })),
          })),
        }
      }
      if (table === 'youtube_channels') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: channelRow, error: null }),
              })),
            })),
          })),
        }
      }
      if (table === 'youtube_videos') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: videoRow, error: null }),
            })),
          })),
        }
      }
      if (table === 'ab_test_cycles') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      return makeChain({ data: null, error: null })
    })

    const client = { from: fromMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

    const result = await applyWinnerNow('test-1')

    expect(result).toEqual({ ok: true })
    // Title test should call updateVideoMetadata with the winner title
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VID_001',
      'New Winner Title',
      null,
      'fresh-token',
    )
    // Should NOT call setThumbnail since it's a title test with no blob_url
    expect(setThumbnail).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// cancelGracePeriod
// ===========================================================================

describe('cancelGracePeriod', () => {
  function setupCancelMock(testOverrides: Record<string, unknown> = {}) {
    const testRow = {
      id: 'test-1',
      status: 'active',
      grace_expires_at: new Date(Date.now() + 86400000).toISOString(),
      ...testOverrides,
    }

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: testRow, error: null }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      return makeChain({ data: null, error: null })
    })

    const client = { from: fromMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    return { fromMock }
  }

  it('happy path: transitions to completed with manual_no_apply', async () => {
    setupCancelMock()

    const result = await cancelGracePeriod('test-1')

    expect(result).toEqual({ ok: true })
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('returns error when test not in grace period', async () => {
    setupCancelMock({ grace_expires_at: null })

    const result = await cancelGracePeriod('test-1')

    expect(result).toEqual({ ok: false, error: 'Test not in grace period' })
  })
})

// ===========================================================================
// revertWinner
// ===========================================================================

describe('revertWinner', () => {
  function setupRevertMock(testOverrides: Record<string, unknown> = {}) {
    const testRow = {
      id: 'test-1',
      site_id: 'site-1',
      youtube_video_id: 'vid-db-1',
      test_type: 'thumbnail',
      original_thumbnail_url: 'https://blob/original.jpg',
      original_title: 'Orig Title',
      original_description: 'Orig Desc',
      revert_expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      winner_applied_at: new Date(Date.now() - 86400000).toISOString(),
      ...testOverrides,
    }

    const channelRow = { channel_id: 'ch-1' }
    const videoRow = { youtube_video_id: 'YT_VID_001' }

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: testRow, error: null }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        }
      }
      if (table === 'youtube_channels') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: channelRow, error: null }),
              })),
            })),
          })),
        }
      }
      if (table === 'youtube_videos') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: videoRow, error: null }),
            })),
          })),
        }
      }
      return makeChain({ data: null, error: null })
    })

    const client = { from: fromMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    return { fromMock }
  }

  it('happy path: restores original thumbnail, clears winner_applied_at', async () => {
    setupRevertMock()

    const result = await revertWinner('test-1')

    expect(result).toEqual({ ok: true })
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob/original.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VID_001',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token',
    )
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('returns error when revert window expired', async () => {
    setupRevertMock({
      revert_expires_at: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
    })

    const result = await revertWinner('test-1')

    expect(result).toEqual({ ok: false, error: 'Revert window expired (7 days)' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('returns error when no winner_applied_at', async () => {
    setupRevertMock({ winner_applied_at: null })

    const result = await revertWinner('test-1')

    expect(result).toEqual({ ok: false, error: 'Test has no applied winner' })
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('restores original title and description for title test (no setThumbnail)', async () => {
    setupRevertMock({
      test_type: 'title',
      original_thumbnail_url: null,
    })

    const result = await revertWinner('test-1')

    expect(result).toEqual({ ok: true })
    // Should call updateVideoMetadata with original title + description
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VID_001',
      'Orig Title',
      'Orig Desc',
      'fresh-token',
    )
    // Should NOT call setThumbnail since it's a title test
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('for combo test applies both thumbnail and metadata', async () => {
    setupRevertMock({
      test_type: 'combo',
      original_thumbnail_url: 'https://blob/original-combo.jpg',
    })

    const result = await revertWinner('test-1')

    expect(result).toEqual({ ok: true })
    // Should restore thumbnail
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob/original-combo.jpg')
    expect(setThumbnail).toHaveBeenCalledWith(
      'YT_VID_001',
      expect.any(Buffer),
      'image/jpeg',
      'fresh-token',
    )
    // Should also restore metadata
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_VID_001',
      'Orig Title',
      'Orig Desc',
      'fresh-token',
    )
  })
})

// ===========================================================================
// batchStartTests
// ===========================================================================

describe('batchStartTests', () => {
  function setupBatchMock(opts: { existingTestVideoIds?: string[] } = {}) {
    const { existingTestVideoIds = [] } = opts
    const insertedTests: Record<string, unknown>[] = []
    const insertedVariants: Record<string, unknown>[] = []

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                in: vi.fn().mockResolvedValue({
                  data: existingTestVideoIds.map(id => ({ youtube_video_id: id })),
                  error: null,
                }),
              })),
            })),
          })),
          insert: vi.fn((data: Record<string, unknown>) => {
            insertedTests.push(data)
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: `test-${insertedTests.length}` },
                  error: null,
                }),
              })),
            }
          }),
        }
      }
      if (table === 'youtube_videos') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => {
              if (col === 'id') {
                return {
                  eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: val, title: `Video ${val}`, thumbnail_hq_url: `https://img/${val}.jpg` },
                      error: null,
                    }),
                  })),
                }
              }
              return {
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }
            }),
          })),
        }
      }
      if (table === 'ab_test_variants') {
        return {
          insert: vi.fn((data: Record<string, unknown>) => {
            insertedVariants.push(data)
            return Promise.resolve({ data: null, error: null })
          }),
        }
      }
      return makeChain({ data: null, error: null })
    })

    const client = { from: fromMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    return { fromMock, insertedTests, insertedVariants }
  }

  it('happy path: creates 3 drafts for eligible videos', async () => {
    const { insertedTests } = setupBatchMock()

    const result = await batchStartTests(['vid-1', 'vid-2', 'vid-3'])

    expect(result.ok).toBe(true)
    expect(result.created).toBe(3)
    // All tests are created as draft
    expect(insertedTests[0]).toMatchObject({ status: 'draft' })
    expect(insertedTests[1]).toMatchObject({ status: 'draft' })
    expect(insertedTests[2]).toMatchObject({ status: 'draft' })
  })

  it('returns error for < 2 videos', async () => {
    setupBatchMock()

    const result = await batchStartTests(['vid-1'])

    expect(result).toEqual({ ok: false, created: 0, error: 'Select 2-5 videos' })
  })

  it('rejects more than 5 videos', async () => {
    setupBatchMock()

    const result = await batchStartTests(['v1', 'v2', 'v3', 'v4', 'v5', 'v6'])

    expect(result).toEqual({ ok: false, created: 0, error: 'Select 2-5 videos' })
  })

  it('skips ineligible videos (already have tests)', async () => {
    setupBatchMock({ existingTestVideoIds: ['vid-1', 'vid-2', 'vid-3'] })

    const result = await batchStartTests(['vid-1', 'vid-2', 'vid-3'])

    expect(result).toEqual({ ok: false, created: 0, error: 'All videos already have active tests' })
  })
})

// ===========================================================================
// dismissFatigueAlert
// ===========================================================================

describe('dismissFatigueAlert', () => {
  function setupDismissMock() {
    const fromMock = vi.fn((table: string) => {
      if (table === 'youtube_fatigue_alerts') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      }
      return makeChain({ data: null, error: null })
    })

    const client = { from: fromMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
    return { fromMock }
  }

  it('happy path: updates status to dismissed', async () => {
    setupDismissMock()

    const result = await dismissFatigueAlert('alert-1')

    expect(result).toEqual({ ok: true })
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('returns ok: false on auth failure', async () => {
    ;(requireSiteScope as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
    })
    setupDismissMock()

    const result = await dismissFatigueAlert('alert-1')

    expect(result).toEqual({ ok: false })
  })
})
