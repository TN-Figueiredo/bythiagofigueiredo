import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Degrau "administrar o site": estes testes rodam como quem administra (o dono).
// A recusa da editora e o erro da RPC ficam em test/cms/site-admin-step-*.test.ts.
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))

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
  updateTag: vi.fn(),
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
  batchStartTests,
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

// Site com dois canais: PT (`UCpt`, dono do vídeo dos testes) e EN (`UCen`).
// A primeira linha de `youtube_channels` do site é a do EN — quem pegar "um
// canal qualquer do site" pega o canal errado.
const FIRST_CHANNEL_ROW_OF_SITE = { channel_id: 'UCen' }
let videoOwner: { channel_id: string } | null = { channel_id: 'UCpt' }

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
  videoOwner = { channel_id: 'UCpt' }
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

// applyWinnerNow, cancelGracePeriod e revertWinner saíram (P4a T7): o caminho novo é settleOnAir,
// coberto por ab-settle.test.ts, ab-p4a-chamadores.test.ts e ab-p4a-concorrencia.test.ts.

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
