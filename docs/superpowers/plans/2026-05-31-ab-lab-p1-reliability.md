# AB Lab P1: Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure AB tests never break silently — every failure detected in <2h, self-healed where possible, user notified immediately.

**Architecture:** Add a `cron_health` heartbeat table written by all crons. A watchdog cron (10:00 UTC) verifies ab-rotate succeeded and triggers catch-up if not. Idempotency via date-keyed checks prevents double rotations. Drift detection compares YouTube's actual thumbnail against the expected variant. Force Rotate button gives manual control with pre-flight safety.

**Tech Stack:** Next.js 15 API routes, Supabase PostgreSQL, Vitest, Resend email, Lucide icons, existing `createNotification()` system.

**Spec:** `docs/superpowers/specs/2026-05-31-ab-lab-observatory-design.md` — Phase 1

---

### Task 1: cron_health Table Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_cron_health.sql` (via `npm run db:new cron_health`)

- [ ] **Step 1: Create migration file**

Run: `npm run db:new cron_health`

Then edit the generated file:

```sql
CREATE TABLE cron_health (
  cron_name text PRIMARY KEY,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'info')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cron_health IS 'Heartbeat table for all system crons. Written on success and failure.';
```

- [ ] **Step 2: Push migration to prod**

Run: `npm run db:push:prod`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(p1): cron_health heartbeat table"
```

---

### Task 2: cron_health Helper + Integration

**Files:**
- Create: `apps/web/src/lib/cron-health.ts`
- Create: `apps/web/test/lib/cron-health.test.ts`
- Modify: `apps/web/src/app/api/cron/ab-rotate/route.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/lib/cron-health.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockUpsert = vi.fn().mockResolvedValue({ error: null })

beforeEach(() => {
  vi.clearAllMocks()
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn(() => ({ upsert: mockUpsert })),
  })
})

describe('recordCronSuccess', () => {
  it('upserts cron_health with success timestamp', async () => {
    await recordCronSuccess('ab-rotate', 'critical')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'ab-rotate',
        consecutive_failures: 0,
        severity: 'critical',
      }),
      { onConflict: 'cron_name' },
    )
  })
})

describe('recordCronFailure', () => {
  it('upserts cron_health with failure info', async () => {
    await recordCronFailure('ab-rotate', 'token expired', 'critical')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'ab-rotate',
        last_error: 'token expired',
        severity: 'critical',
      }),
      { onConflict: 'cron_name' },
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/cron-health.test.ts --config apps/web/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/lib/cron-health.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type Severity = 'critical' | 'info'

export async function recordCronSuccess(cronName: string, severity: Severity = 'info') {
  const supabase = getSupabaseServiceClient()
  await supabase.from('cron_health').upsert(
    {
      cron_name: cronName,
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      severity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cron_name' },
  )
}

export async function recordCronFailure(cronName: string, error: string, severity: Severity = 'info') {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('cron_health')
    .select('consecutive_failures')
    .eq('cron_name', cronName)
    .single()

  const failures = (data?.consecutive_failures ?? 0) + 1

  await supabase.from('cron_health').upsert(
    {
      cron_name: cronName,
      last_failure_at: new Date().toISOString(),
      last_error: error,
      consecutive_failures: failures,
      severity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cron_name' },
  )
}

export async function getCronHealth(cronName: string) {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('cron_health')
    .select('*')
    .eq('cron_name', cronName)
    .single()
  return data
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/lib/cron-health.test.ts --config apps/web/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Wire into ab-rotate**

In `apps/web/src/app/api/cron/ab-rotate/route.ts`, add at top:

```typescript
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
```

After the `return Response.json(...)` at the end (line ~180), wrap the response:

```typescript
  // Before the final return, after the for loop:
  if (errors === 0) {
    await recordCronSuccess('ab-rotate', 'critical')
  } else {
    await recordCronFailure('ab-rotate', `${errors} test(s) failed`, 'critical')
  }

  return Response.json({ status: 'ok', processed, errors })
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/cron-health.ts apps/web/test/lib/cron-health.test.ts apps/web/src/app/api/cron/ab-rotate/route.ts
git commit -m "feat(p1): cron_health helper + ab-rotate heartbeat"
```

---

### Task 3: Token Refresh Buffer 5min → 30min

**Files:**
- Modify: `apps/web/src/lib/social/token-refresh.ts:66`

- [ ] **Step 1: Change the buffer**

In `apps/web/src/lib/social/token-refresh.ts`, line 66, change:

```typescript
// OLD:
const isExpired = expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000
// NEW:
const isExpired = expiresAt && expiresAt.getTime() - Date.now() < 30 * 60 * 1000
```

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run test/youtube/ --config apps/web/vitest.config.ts`
Expected: All pass (no test asserts on the exact buffer value)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/social/token-refresh.ts
git commit -m "fix(p1): token refresh buffer 5min → 30min"
```

---

### Task 4: Idempotency in ab-rotate

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-rotate/route.ts`
- Modify: `apps/web/test/ab-cron-rotate.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/test/ab-cron-rotate.test.ts`:

```typescript
it('skips rotation if cycle already exists for today', async () => {
  const test = makeTest()
  // Mock: a cycle already exists for today
  buildSupabaseMock({
    tests: [test],
    todayCycleExists: true,
  })

  const req = createCronRequest('test-secret')
  const res = await GET(req)
  const body = await res.json()

  expect(body.processed).toBe(0)
  expect(setThumbnail).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/ab-cron-rotate.test.ts --config apps/web/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Add idempotency check in ab-rotate**

In `apps/web/src/app/api/cron/ab-rotate/route.ts`, inside the `for (const test of tests)` loop, after getting the video (line ~53), add:

```typescript
      // Idempotency: skip if we already rotated today
      const today = new Date().toISOString().slice(0, 10)
      const { data: todayCycle } = await supabase
        .from('ab_test_cycles')
        .select('id')
        .eq('test_id', test.id)
        .gte('started_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()

      if (todayCycle) continue
```

- [ ] **Step 4: Update test mock to support todayCycleExists flag and run tests**

Run: `npx vitest run test/ab-cron-rotate.test.ts --config apps/web/vitest.config.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/ab-rotate/route.ts apps/web/test/ab-cron-rotate.test.ts
git commit -m "feat(p1): date-based idempotency in ab-rotate"
```

---

### Task 5: Write-Ahead Marker + Operation Reorder

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-rotate/route.ts`
- Modify: `apps/web/src/lib/youtube/ab-types.ts` (add `last_applied_variant_id` to AbTestRow)

- [ ] **Step 1: Add column to AbTestRow type**

In `apps/web/src/lib/youtube/ab-types.ts`, add to `AbTestRow`:

```typescript
last_applied_variant_id: string | null
```

- [ ] **Step 2: Create migration**

Run: `npm run db:new ab_tests_write_ahead_marker`

```sql
ALTER TABLE ab_tests ADD COLUMN IF NOT EXISTS last_applied_variant_id uuid;
```

- [ ] **Step 3: Reorder operations in ab-rotate**

In `apps/web/src/app/api/cron/ab-rotate/route.ts`, change the order inside the try block to:

```typescript
      // 1. Write-ahead marker FIRST
      await supabase
        .from('ab_tests')
        .update({ last_applied_variant_id: nextVariant.id })
        .eq('id', test.id)

      // 2. Apply variant on YouTube (idempotent — re-uploading same image is safe)
      const appliedMeta: AppliedMetadata = {}
      // ... existing thumbnail/title apply logic ...

      // 3. Close old cycle + open new cycle (AFTER YouTube confirms)
      await supabase
        .from('ab_test_cycles')
        .update({ ended_at: new Date().toISOString() })
        .eq('test_id', test.id)
        .is('ended_at', null)

      await supabase.from('ab_test_cycles').insert({ /* ... existing insert ... */ })
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/ab-cron-rotate.test.ts --config apps/web/vitest.config.ts`
Expected: All pass

- [ ] **Step 5: Push migration + commit**

```bash
npm run db:push:prod
git add supabase/migrations/ apps/web/src/app/api/cron/ab-rotate/route.ts apps/web/src/lib/youtube/ab-types.ts
git commit -m "feat(p1): write-ahead marker + reorder rotation ops"
```

---

### Task 6: Pre-flight Token Check

**Files:**
- Create: `apps/web/src/lib/youtube/ab-preflight.ts`
- Create: `apps/web/test/youtube/ab-preflight.test.ts`
- Modify: `apps/web/src/app/api/cron/ab-rotate/route.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/youtube/ab-preflight.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn(),
}))

import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { ensureFreshToken } from '@/lib/social/token-refresh'

describe('preflightTokenCheck', () => {
  it('returns ok when token is valid and API responds 200', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'valid-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockResolvedValue({ status: 200 })

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(true)
  })

  it('returns not ok when API responds 403', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      accessToken: 'bad-token',
      connectionId: 'conn-1',
    })
    global.fetch = vi.fn().mockResolvedValue({ status: 403 })

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('403')
  })

  it('returns not ok when ensureFreshToken throws', async () => {
    ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('No connection found'),
    )

    const result = await preflightTokenCheck('site-1', 'youtube', 'UC_x')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('No connection found')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/youtube/ab-preflight.test.ts --config apps/web/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/lib/youtube/ab-preflight.ts
import { ensureFreshToken } from '@/lib/social/token-refresh'

interface PreflightResult {
  ok: boolean
  reason?: string
  accessToken?: string
}

export async function preflightTokenCheck(
  siteId: string,
  provider: 'youtube',
  channelId?: string,
): Promise<PreflightResult> {
  try {
    const { accessToken } = await ensureFreshToken(siteId, provider, channelId)

    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      },
    )

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: `token_invalid_${res.status}` }
    }

    return { ok: true, accessToken }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/youtube/ab-preflight.test.ts --config apps/web/vitest.config.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire into ab-rotate (replace direct ensureFreshToken call)**

In `apps/web/src/app/api/cron/ab-rotate/route.ts`, replace:

```typescript
const { accessToken } = await ensureFreshToken(test.site_id, 'youtube', channel?.channel_id)
```

With:

```typescript
const preflight = await preflightTokenCheck(test.site_id, 'youtube', channel?.channel_id)
if (!preflight.ok) {
  await createNotification({
    site_id: test.site_id,
    type: 'youtube.token_invalid',
    domain: 'youtube',
    priority: 1,
    title: 'Token YouTube inválido',
    message: `Não foi possível acessar a API do YouTube: ${preflight.reason}`,
    action_href: '/cms/youtube',
    dedup_key: `token-invalid-${test.site_id}-${new Date().toISOString().slice(0, 10)}`,
  })
  continue
}
const accessToken = preflight.accessToken!
```

Add import at top:

```typescript
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { createNotification } from '@/lib/notifications/create'
```

- [ ] **Step 6: Run all AB tests**

Run: `npx vitest run test/ab-cron-rotate.test.ts test/youtube/ab-preflight.test.ts --config apps/web/vitest.config.ts`
Expected: All pass (update mocks as needed for new import)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/ab-preflight.ts apps/web/test/youtube/ab-preflight.test.ts apps/web/src/app/api/cron/ab-rotate/route.ts
git commit -m "feat(p1): pre-flight token check before rotation"
```

---

### Task 7: Watchdog Cron

**Files:**
- Create: `apps/web/src/app/api/cron/ab-watchdog/route.ts`
- Create: `apps/web/test/ab-cron-watchdog.test.ts`
- Modify: `apps/web/vercel.json` (add schedule)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/ab-cron-watchdog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({
  getCronHealth: vi.fn(),
  recordCronSuccess: vi.fn(),
}))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))

import { GET } from '@/app/api/cron/ab-watchdog/route'
import { getCronHealth } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'

const mockGetHealth = vi.mocked(getCronHealth)
const mockNotify = vi.mocked(createNotification)

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/ab-watchdog', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
})

describe('ab-watchdog', () => {
  it('rejects unauthorized requests', async () => {
    const res = await GET(makeRequest('wrong'))
    expect(res.status).toBe(401)
  })

  it('reports healthy when ab-rotate ran today', async () => {
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: new Date().toISOString(),
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: new Date().toISOString(),
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.rotate_healthy).toBe(true)
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('sends notification when ab-rotate missed today', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    mockGetHealth.mockResolvedValue({
      cron_name: 'ab-rotate',
      last_success_at: yesterday,
      last_failure_at: null,
      last_error: null,
      consecutive_failures: 0,
      severity: 'critical',
      updated_at: yesterday,
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.rotate_healthy).toBe(false)
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'youtube.rotation_missed',
        priority: 1,
      }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/ab-cron-watchdog.test.ts --config apps/web/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/app/api/cron/ab-watchdog/route.ts
import { NextRequest } from 'next/server'
import { getCronHealth, recordCronSuccess } from '@/lib/cron-health'
import { createNotification } from '@/lib/notifications/create'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const rotateHealth = await getCronHealth('ab-rotate')

  const rotateRanToday =
    rotateHealth?.last_success_at &&
    rotateHealth.last_success_at.slice(0, 10) === today

  if (!rotateRanToday) {
    const supabase = getSupabaseServiceClient()
    const { data: activeTests } = await supabase
      .from('ab_tests')
      .select('site_id')
      .eq('status', 'active')
      .limit(1)

    if (activeTests && activeTests.length > 0) {
      await createNotification({
        site_id: activeTests[0].site_id,
        type: 'youtube.rotation_missed',
        domain: 'youtube',
        priority: 1,
        title: 'Rotação A/B não executou hoje',
        message: `O cron ab-rotate não rodou hoje (${today}). Último sucesso: ${rotateHealth?.last_success_at ?? 'nunca'}.`,
        action_href: '/cms/youtube/ab-lab',
        dedup_key: `rotation-missed-${today}`,
      })
    }
  }

  await recordCronSuccess('ab-watchdog', 'info')

  return Response.json({
    status: 'ok',
    rotate_healthy: !!rotateRanToday,
    last_rotate: rotateHealth?.last_success_at ?? null,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/ab-cron-watchdog.test.ts --config apps/web/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Add to vercel.json**

In `apps/web/vercel.json`, add to the `crons` array:

```json
{ "path": "/api/cron/ab-watchdog", "schedule": "0 10 * * *" }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/ab-watchdog/route.ts apps/web/test/ab-cron-watchdog.test.ts apps/web/vercel.json
git commit -m "feat(p1): watchdog cron at 10:00 UTC with missed-rotation alert"
```

---

### Task 8: Per-test Health Indicator

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-test-card.tsx`

- [ ] **Step 1: Add health dot to ActiveTestCard**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-test-card.tsx`, find the card header area and add:

```typescript
function cycleHealthDot(cycleStartedAt: string | null): React.ReactNode {
  if (!cycleStartedAt) return null
  const hoursAgo = (Date.now() - new Date(cycleStartedAt).getTime()) / 3600000
  const color = hoursAgo < 26 ? 'bg-green-400' : hoursAgo < 50 ? 'bg-yellow-400' : 'bg-red-400'
  const label = hoursAgo < 26 ? 'Saudável' : hoursAgo < 50 ? 'Atrasado' : 'Falhou'
  return (
    <span title={label} className={`inline-block h-2 w-2 rounded-full ${color}`} />
  )
}
```

Add the dot next to the test status badge in the card header JSX.

- [ ] **Step 2: Verify visually**

Run the dev server (`npm run dev -w apps/web`) and check `/cms/youtube/ab-lab`. The active test card should show a green dot (your test started today).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-test-card.tsx
git commit -m "feat(p1): per-test health indicator dot (green/yellow/red)"
```

---

### Task 9: Token Expiry Warning Banner

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/layout.tsx`

- [ ] **Step 1: Add banner component inline**

In `apps/web/src/app/cms/(authed)/youtube/layout.tsx`, after the tab bar `</nav>` (line ~82) and before `<div className="p-6">`, add:

```typescript
// Add this query in the server component body (before the return):
const { data: connections } = await supabase
  .from('social_connections')
  .select('token_expires_at')
  .eq('provider', 'youtube')
  .is('revoked_at', null)

const soonestExpiry = connections
  ?.map(c => new Date(c.token_expires_at).getTime())
  .filter(t => t > Date.now())
  .sort((a, b) => a - b)[0]

const hoursUntilExpiry = soonestExpiry
  ? (soonestExpiry - Date.now()) / 3600000
  : null

// In the JSX, between tab bar and children:
{hoursUntilExpiry !== null && hoursUntilExpiry < 48 && (
  <div className="mx-6 mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
    Token do YouTube expira em {Math.round(hoursUntilExpiry)}h.
    Reconecte em <a href="/cms/youtube" className="underline">Channels</a> para evitar falhas.
  </div>
)}
```

- [ ] **Step 2: Verify in dev server**

Check `/cms/youtube` — banner should NOT appear (token expires in >48h normally).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/layout.tsx
git commit -m "feat(p1): token expiry warning banner (48h before)"
```

---

### Task 10: Force Rotate Button

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx`

- [ ] **Step 1: Add forceRotate server action**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, add:

```typescript
export async function forceRotate(testId: string): Promise<{ ok: boolean; error?: string }> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('*, variants:ab_test_variants!test_id(*)')
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'active')
    .single()

  if (!test) return { ok: false, error: 'Test not found or not active' }

  const { data: video } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id, channel_id')
    .eq('id', test.youtube_video_id)
    .single()
  if (!video) return { ok: false, error: 'Video not found' }

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('channel_id')
    .eq('id', video.channel_id)
    .single()

  const preflight = await preflightTokenCheck(siteId, 'youtube', channel?.channel_id)
  if (!preflight.ok) return { ok: false, error: `Token inválido: ${preflight.reason}` }

  // Close current cycle
  await supabase
    .from('ab_test_cycles')
    .update({ ended_at: new Date().toISOString() })
    .eq('test_id', testId)
    .is('ended_at', null)

  // Count completed cycles
  const { count } = await supabase
    .from('ab_test_cycles')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', testId)
    .not('ended_at', 'is', null)

  const variants = (test.variants as AbTestVariantRow[]).sort((a, b) => a.sort_order - b.sort_order)
  const nextCycle = count ?? 0
  const pattern = test.config?.rotation_pattern ?? 'abba'
  const nextIndex = getNextVariantIndex(pattern, variants.length, nextCycle)
  const nextVariant = variants[nextIndex]
  if (!nextVariant) return { ok: false, error: 'Invalid variant index' }

  // Apply variant
  if (nextVariant.blob_url) {
    const { buffer, contentType } = await fetchVariantImageBuffer(nextVariant.blob_url)
    await setThumbnail(video.youtube_video_id, buffer, contentType, preflight.accessToken!)
  }

  // Open new cycle
  await supabase.from('ab_test_cycles').insert({
    test_id: testId,
    variant_id: nextVariant.id,
    cycle_number: nextCycle,
    started_at: new Date().toISOString(),
    applied_metadata: { trigger: 'manual' },
  })

  revalidateTag('ab-tests')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}
```

- [ ] **Step 2: Add button to active-detail.tsx**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx`, after the Settings button (line ~108), add:

```tsx
<button
  type="button"
  className={BTN}
  onClick={async () => {
    if (!confirm('Forçar rotação agora? A variante atual será trocada imediatamente.')) return
    const result = await forceRotate(view.id)
    if (!result.ok) alert(result.error)
    else router.refresh()
  }}
>
  <RefreshCw size={14} aria-hidden="true" />
  Forçar Rotação
</button>
```

Add import: `import { forceRotate } from '../actions'`

- [ ] **Step 3: Verify visually**

Dev server → `/cms/youtube/ab-lab/{testId}` — "Forçar Rotação" button should appear next to Pause/Settings.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/active-detail.tsx
git commit -m "feat(p1): Force Rotate button with pre-flight check"
```

---

### Task 11: Wire Heartbeats to Remaining Crons

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-evaluate/route.ts`
- Modify: `apps/web/src/app/api/cron/ab-backfill/route.ts`
- Modify: `apps/web/src/app/api/cron/sync-youtube/route.ts`

- [ ] **Step 1: Add heartbeat to ab-evaluate**

Import `recordCronSuccess, recordCronFailure` from `@/lib/cron-health`. At the end of the handler, before the final `return`, add success/failure recording matching the ab-rotate pattern.

- [ ] **Step 2: Add heartbeat to ab-backfill**

Same pattern.

- [ ] **Step 3: Add heartbeat to sync-youtube**

Same pattern, using severity `'critical'`.

- [ ] **Step 4: Run all tests**

Run: `npm run test:web`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/ab-evaluate/route.ts apps/web/src/app/api/cron/ab-backfill/route.ts apps/web/src/app/api/cron/sync-youtube/route.ts
git commit -m "feat(p1): heartbeat recording in evaluate, backfill, sync-youtube"
```

---

### Task 12: Final Integration Test + Push

- [ ] **Step 1: Run full test suite**

```bash
npm run build:packages && npm run test:web
```

Expected: All tests pass, zero failures.

- [ ] **Step 2: Run next build**

```bash
cd apps/web && npx next build
```

Expected: Build succeeds.

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

Expected: Pre-push hook passes (typecheck + ecosystem validation).

- [ ] **Step 4: Verify deploy on Vercel**

Check Vercel dashboard for successful deployment. Verify the new cron `ab-watchdog` appears in the cron list.

- [ ] **Step 5: Update staging**

```bash
git checkout staging && git merge main --ff-only && git push origin staging && git checkout main
```
