/**
 * Tests for POST /api/cron/social-auto-draft — auto-generates social draft
 * posts from recently-published blog posts. Because it CREATES content
 * unsupervised, the spam/over-generation guards are the safety-critical part.
 *
 * Flow:
 *   1. Fetch blog_posts published in the last 24h (status='published').
 *      title/slug live on blog_translations (see migration
 *      20260507000001_schema.sql), NOT blog_posts — the route must join
 *      `blog_translations(title, slug)` rather than select those columns
 *      directly off blog_posts (that shape doesn't exist and errors 100%
 *      of the time — this broke the cron from 2026-05-29 until fixed here).
 *   2. Look up which already have an active social post (draft/scheduled/
 *      publishing/completed) — those are skipped.
 *   3. Insert a 'draft' social_post for each remaining blog post, with a
 *      deterministic idempotency_key `auto-blog-<id>`. created_by must be
 *      `null` — it has an ON DELETE SET NULL FK to auth.users (see
 *      20260524000003_lgpd_social_fk_fix.sql) and a placeholder/system UUID
 *      that doesn't exist in auth.users violates that FK on every insert
 *      that reaches it. A unique-index violation (23505) is swallowed as
 *      "already exists".
 *   4. Log the run into cron_runs.
 *
 * Coverage focuses on:
 *   - auth gate (401 without / with bad bearer / with CRON_SECRET unset)
 *   - happy path: correct draft rows created (origin=auto, idempotency_key, etc.)
 *   - blog_posts is queried via a blog_translations join, never flat title/slug columns
 *   - created_by is null on every insert (never a placeholder UUID — FK safety)
 *   - a post with no translations is skipped as an error, not a crash
 *   - de-dup guard: blog posts with an existing active social post are skipped
 *   - unique-index guard: a 23505 insert error is swallowed, not counted
 *   - no-op: empty 24h window never queries social_posts
 *   - error handling: a non-23505 insert error is collected + logged, run continues
 *   - cutoff is relative (~ now-24h), never a hardcoded date
 *
 * Pure mock (no DB). Route uses src/lib/logger#withCronLock (in-memory lock).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/social-auto-draft/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface SocialCapture {
  blogSelectCols: string | null
  gteCol: string | null
  gteVal: string | null
  blogStatusEq: string | null
  socialReadEqCols: string[]
  socialInCalls: Array<[string, unknown]>
  inserts: Array<Record<string, unknown>>
  cronRun: Record<string, unknown> | null
}

/**
 * Multi-table supabase mock.
 *   blog_posts:  .select().gte('published_at',cutoff).eq('status','published')
 *   social_posts (read):  .select().eq().in('source_content_id',ids).in('status',[...])
 *   social_posts (write): .insert(row)
 *   cron_runs:   .insert(row)
 */
function makeSocialSupabase(opts: {
  blogPosts?: Array<Record<string, unknown>>
  existingSocial?: Array<{ source_content_id: string }>
  blogError?: { message: string } | null
  insertErrorByKey?: Record<string, { code?: string; message: string }>
} = {}) {
  const blogPosts = opts.blogPosts ?? []
  const existingSocial = opts.existingSocial ?? []
  const insertErrorByKey = opts.insertErrorByKey ?? {}
  const capture: SocialCapture = {
    blogSelectCols: null,
    gteCol: null,
    gteVal: null,
    blogStatusEq: null,
    socialReadEqCols: [],
    socialInCalls: [],
    inserts: [],
    cronRun: null,
  }

  const from = vi.fn((table: string) => {
    if (table === 'blog_posts') {
      const c: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn((cols: string) => {
          capture.blogSelectCols = cols
          return c
        }),
        gte: vi.fn((col: string, val: string) => {
          capture.gteCol = col
          capture.gteVal = val
          return c
        }),
        // terminal: .eq('status','published') is awaited
        eq: vi.fn((col: string, val: string) => {
          capture.blogStatusEq = val
          return Promise.resolve({ data: blogPosts, error: opts.blogError ?? null })
        }),
      }
      return c
    }

    if (table === 'social_posts') {
      let inCount = 0
      const rc: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn(() => rc),
        eq: vi.fn((col: string) => {
          capture.socialReadEqCols.push(col)
          return rc
        }),
        in: vi.fn((col: string, val: unknown) => {
          capture.socialInCalls.push([col, val])
          inCount++
          // second .in(...) terminates the read chain
          if (inCount >= 2) {
            return Promise.resolve({ data: existingSocial, error: null })
          }
          return rc
        }),
        insert: vi.fn((row: Record<string, unknown>) => {
          capture.inserts.push(row)
          const err = insertErrorByKey[row.source_content_id as string] ?? null
          return Promise.resolve({ error: err })
        }),
      }
      return rc
    }

    if (table === 'cron_runs') {
      return {
        insert: vi.fn((row: Record<string, unknown>) => {
          capture.cronRun = row
          return Promise.resolve({ error: null })
        }),
      }
    }

    return {}
  })

  const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return { from, rpc, _capture: capture }
}

function req(secret?: string) {
  return new Request('http://localhost/api/cron/social-auto-draft', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/cron/social-auto-draft — auth gate', () => {
  it('401 without Authorization header', async () => {
    const res = await POST(req() as never)
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('nope') as never)
    expect(res.status).toBe(401)
  })

  it('401 when CRON_SECRET is unset (fail-closed)', async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req('Bearer-anything') as never)
    expect(res.status).toBe(401)
    process.env.CRON_SECRET = CRON_SECRET
  })

  it('does not touch supabase on an unauthorized request', async () => {
    const supabase = makeSocialSupabase({ blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'T', slug: 't' }] }] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    await POST(req() as never)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('POST /api/cron/social-auto-draft — happy path', () => {
  it('creates one draft social post per new blog post', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [
        { id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] },
        { id: 'p2', site_id: 's2', blog_translations: [{ title: 'Second', slug: 'second' }] },
      ],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.draftsCreated).toBe(2)
    expect(body.errors).toBeUndefined()
    expect(supabase._capture.inserts).toHaveLength(2)
  })

  it('stamps each draft with origin=auto, status=draft and a deterministic idempotency_key', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET) as never)
    const row = supabase._capture.inserts[0]
    expect(row.origin).toBe('auto')
    expect(row.status).toBe('draft')
    expect(row.source_content_type).toBe('blog')
    expect(row.source_content_id).toBe('p1')
    expect(row.site_id).toBe('s1')
    expect(row.idempotency_key).toBe('auto-blog-p1')
  })

  // Regression: title/slug live on blog_translations, not blog_posts
  // (20260507000001_schema.sql). Selecting `title, slug` directly off
  // blog_posts throws "column blog_posts.title does not exist" on every
  // run — that broke this cron 100% of the time from 2026-05-29 onward
  // (see cron_health.last_error in prod). The route must join instead,
  // the way apps/web/src/lib/social/content-metadata.ts and
  // apps/web/src/app/cms/(authed)/blog/_hub/hub-queries.ts do.
  it('selects title/slug via a blog_translations join, never as flat blog_posts columns', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET) as never)
    const cols = supabase._capture.blogSelectCols ?? ''
    expect(cols).toContain('blog_translations(')
    expect(cols).toMatch(/blog_translations\([^)]*title[^)]*\)/)
    expect(cols).toMatch(/blog_translations\([^)]*slug[^)]*\)/)
    // The bug: `title`/`slug` selected as bare top-level blog_posts columns.
    const bareColumns = cols.split(',').map((c) => c.trim())
    expect(bareColumns).not.toContain('title')
    expect(bareColumns).not.toContain('slug')
  })

  // Regression: created_by has an ON DELETE SET NULL FK to auth.users
  // (20260524000003_lgpd_social_fk_fix.sql). A placeholder/system UUID
  // (e.g. the zero UUID) that isn't a real auth.users row violates that
  // FK on insert (23503) — it's only ever nullable so system-generated
  // rows can omit an author safely.
  it('sets created_by to null for system-generated drafts (never a placeholder UUID)', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET) as never)
    const row = supabase._capture.inserts[0]
    expect(row.created_by).toBeNull()
    expect(row.created_by).not.toBe('00000000-0000-0000-0000-000000000000')
  })

  it('skips a blog post with no translations as an error, without crashing the run', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [
        { id: 'p1', site_id: 's1', blog_translations: [] },
        { id: 'p2', site_id: 's2', blog_translations: [{ title: 'Second', slug: 'second' }] },
      ],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.draftsCreated).toBe(1)
    expect(body.errors).toBeDefined()
    expect(body.errors[0]).toContain('p1')
    expect(supabase._capture.inserts).toHaveLength(1)
    expect(supabase._capture.inserts[0].source_content_id).toBe('p2')
  })

  it('logs a successful run into cron_runs', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET) as never)
    expect(supabase._capture.cronRun).toMatchObject({
      job: 'social-auto-draft',
      status: 'ok',
      items_processed: 1,
      error: null,
    })
  })
})

describe('POST /api/cron/social-auto-draft — over-generation guards', () => {
  it('skips blog posts that already have an active social post (no duplicate insert)', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [
        { id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] },
        { id: 'p2', site_id: 's2', blog_translations: [{ title: 'Second', slug: 'second' }] },
      ],
      existingSocial: [{ source_content_id: 'p1' }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    const body = await res.json()
    expect(body.draftsCreated).toBe(1)
    // p1 must NOT be inserted — only p2.
    expect(supabase._capture.inserts).toHaveLength(1)
    expect(supabase._capture.inserts[0].source_content_id).toBe('p2')
  })

  it('swallows a unique-index (23505) insert error without counting it', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] }],
      insertErrorByKey: { p1: { code: '23505', message: 'duplicate key' } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    const body = await res.json()
    expect(body.draftsCreated).toBe(0)
    expect(body.errors).toBeUndefined() // 23505 is not treated as an error
  })

  it('scopes the existing-social lookup to active statuses only', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [{ id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req(CRON_SECRET) as never)
    const statusIn = supabase._capture.socialInCalls.find(([col]) => col === 'status')
    expect(statusIn?.[1]).toEqual(['draft', 'scheduled', 'publishing', 'completed'])
  })
})

describe('POST /api/cron/social-auto-draft — no-op window', () => {
  it('returns draftsCreated:0 and never queries social_posts when no posts in 24h', async () => {
    const supabase = makeSocialSupabase({ blogPosts: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    const body = await res.json()
    expect(body.draftsCreated).toBe(0)
    expect(supabase._capture.inserts).toHaveLength(0)
    expect(supabase._capture.socialInCalls).toHaveLength(0)
    // Only blog_posts was queried.
    expect(supabase.from).toHaveBeenCalledWith('blog_posts')
    expect(supabase.from).not.toHaveBeenCalledWith('social_posts')
  })

  it('uses a relative ~24h cutoff for published_at (never a hardcoded date)', async () => {
    const supabase = makeSocialSupabase({ blogPosts: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const before = Date.now()
    await POST(req(CRON_SECRET) as never)
    const after = Date.now()

    expect(supabase._capture.gteCol).toBe('published_at')
    const DAY = 24 * 60 * 60 * 1000
    const cutoff = new Date(supabase._capture.gteVal as string).getTime()
    expect(cutoff).toBeGreaterThanOrEqual(before - DAY - 5000)
    expect(cutoff).toBeLessThanOrEqual(after - DAY + 1000)
  })
})

describe('POST /api/cron/social-auto-draft — error handling', () => {
  it('collects a non-23505 insert error and logs the run as error, but keeps going', async () => {
    const supabase = makeSocialSupabase({
      blogPosts: [
        { id: 'p1', site_id: 's1', blog_translations: [{ title: 'First', slug: 'first' }] },
        { id: 'p2', site_id: 's2', blog_translations: [{ title: 'Second', slug: 'second' }] },
      ],
      insertErrorByKey: { p1: { code: '500', message: 'db exploded' } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    // p2 still succeeds despite p1 failing.
    expect(body.draftsCreated).toBe(1)
    expect(body.errors).toBeDefined()
    expect(body.errors[0]).toContain('p1')
    expect(supabase._capture.cronRun).toMatchObject({ status: 'error', items_processed: 1 })
  })

  it('returns 500 when the initial blog fetch errors', async () => {
    const supabase = makeSocialSupabase({ blogError: { message: 'connection refused' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req(CRON_SECRET) as never)
    expect(res.status).toBe(500)
  })
})
