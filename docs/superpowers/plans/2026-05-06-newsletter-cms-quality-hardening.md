# Newsletter CMS Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 CRITICAL + 6 HIGH + 16 MEDIUM + 13 LOW issues in the Newsletter CMS hub, raising quality from 72→98/100.

**Architecture:** Wire existing `CadencePatternForm` into cadence-card expanded state (replacing 3-field legacy form), add `normalizeTime()` utility at 5 call sites to fix the time format chain, add dirty-state tracking + confirmation dialog to TypeDrawer, drill `seo_default_og_image` for OG fallback, add Zod server validation, fix i18n hardcodes.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, Vitest, Zod, sonner, @tn-figueiredo/newsletter

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/lib/newsletter/format.ts` | Add `normalizeTime()` utility (existing file) |
| `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts` | Extend `CadenceConfig` + `NewsletterHubSharedData` types |
| `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts` | Apply normalizeTime, add locale param, add seoDefaultOgImage |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts` | Add new i18n key types |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts` | Add 11 new English keys |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts` | Add 11 new Portuguese keys |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | Add Zod validation to 3 actions |
| `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx` | Add site_id filter + normalizeTime |
| `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card.tsx` | Major rewrite: embed CadencePatternForm, legacyToPattern |
| `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx` | Replace custom toast with sonner, pass locale/tz |
| `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx` | Stabilize useMemo |
| `apps/web/src/app/cms/(authed)/newsletters/_components/cadence-pattern-form.tsx` | Wire siteTimezone, normalizeTime, i18n ordinals |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx` | Slug auto-sync, dirty state, OG default, confirmation dialog |
| `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx` | Pass defaultOgImage to TypeDrawer |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx` | Pass defaultOgImage to TypeDrawer |
| `apps/web/src/app/cms/(authed)/newsletters/page.tsx` | Pass locale to fetchScheduleData |
| `apps/web/test/lib/newsletter/normalize-time.test.ts` | NEW — normalizeTime unit tests |
| `apps/web/test/cms/cadence-card.test.tsx` | NEW — 12 tests |
| `apps/web/test/cms/newsletter-schedule-tab.test.tsx` | NEW — 8 tests |
| `apps/web/test/cms/cadence-actions.test.ts` | NEW — 10 tests |
| `apps/web/test/cms/newsletter-type-drawer.test.tsx` | +8 tests (existing file) |

## Parallel Execution Tracks

Tasks are designed for maximum parallelism:

- **Track A (Tasks 1–3):** Foundation layer — normalizeTime, types, queries — must complete first
- **Track B (Tasks 4–5):** i18n + Zod actions — independent, can run in parallel with each other and Track A
- **Track C (Task 6):** Security fix — independent of everything
- **Track D (Tasks 7–10):** Component rewrites — depends on Track A
- **Track E (Tasks 11–14):** Test files — depends on Tracks A-D

```
     ┌─ Task 1 (normalizeTime)
     │  Task 2 (types)          ──► Track D ──► Track E
     │  Task 3 (queries)        ┘
     │
Start┤─ Task 4 (i18n)          ────────────►
     │─ Task 5 (Zod actions)   ────────────►
     │─ Task 6 (security fix)  ────────────►
     └─────────────────────────────────────────────► npm test
```

---

### Task 1: Add `normalizeTime()` utility

**Files:**
- Modify: `apps/web/lib/newsletter/format.ts` (append after line 68)
- Test: `apps/web/test/lib/newsletter/normalize-time.test.ts`

- [ ] **Step 1: Write the failing test**

Create file `apps/web/test/lib/newsletter/normalize-time.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeTime } from '@/lib/newsletter/format'

describe('normalizeTime', () => {
  it('strips seconds from HH:MM:SS', () => {
    expect(normalizeTime('09:00:00')).toBe('09:00')
  })

  it('passes through valid HH:MM', () => {
    expect(normalizeTime('14:30')).toBe('14:30')
  })

  it('returns default for null', () => {
    expect(normalizeTime(null)).toBe('09:00')
  })

  it('returns default for undefined', () => {
    expect(normalizeTime(undefined)).toBe('09:00')
  })

  it('returns default for empty string', () => {
    expect(normalizeTime('')).toBe('09:00')
  })

  it('returns default for garbage', () => {
    expect(normalizeTime('not-a-time')).toBe('09:00')
  })

  it('handles HH:MM:SS.sss microseconds', () => {
    expect(normalizeTime('09:00:00.000000')).toBe('09:00')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/newsletter/normalize-time.test.ts`
Expected: FAIL — `normalizeTime` is not exported from `@/lib/newsletter/format`

- [ ] **Step 3: Write the implementation**

Append to `apps/web/lib/newsletter/format.ts` after line 68:

```typescript
export function normalizeTime(t: string | null | undefined): string {
  if (!t) return '09:00'
  const m = t.match(/^(\d{2}:\d{2})/)
  return m?.[1] ?? '09:00'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/newsletter/normalize-time.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/newsletter/format.ts apps/web/test/lib/newsletter/normalize-time.test.ts
git commit -m "feat(cms): add normalizeTime utility for DB time format normalization"
```

---

### Task 2: Extend types — CadenceConfig + NewsletterHubSharedData

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts:116-122` (CadenceConfig)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts:13-23` (NewsletterHubSharedData)

- [ ] **Step 1: Add `cadencePattern` to CadenceConfig**

In `hub-types.ts`, change the `CadenceConfig` interface at line 116-122. Replace:

```typescript
export interface CadenceConfig {
  typeId: string; typeName: string; typeColor: string
  cadence: string; hasPattern: boolean; cadenceDays: number; dayOfWeek: string; time: string; nextDate: string
  cadenceStartDate: string | null
  paused: boolean; subscribers: number; editionsSent: number; openRate: number
  conflicts: string[]
}
```

With:

```typescript
export interface CadenceConfig {
  typeId: string; typeName: string; typeColor: string
  cadence: string; hasPattern: boolean; cadenceDays: number; dayOfWeek: string; time: string; nextDate: string
  cadenceStartDate: string | null
  cadencePattern: import('@/lib/newsletter/cadence-pattern').CadencePattern | null
  paused: boolean; subscribers: number; editionsSent: number; openRate: number
  conflicts: string[]
}
```

- [ ] **Step 2: Add `seoDefaultOgImage` to NewsletterHubSharedData**

In `hub-types.ts`, change `NewsletterHubSharedData` at line 13-23. Replace:

```typescript
export interface NewsletterHubSharedData {
  types: NewsletterType[]
  tabBadges: {
    editorial: number
    automations: number
    schedule: number
  }
  siteTimezone: string
  siteName: string
  defaultLocale: string
}
```

With:

```typescript
export interface NewsletterHubSharedData {
  types: NewsletterType[]
  tabBadges: {
    editorial: number
    automations: number
    schedule: number
  }
  siteTimezone: string
  siteName: string
  defaultLocale: string
  seoDefaultOgImage: string | null
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in hub-queries.ts (return object missing `seoDefaultOgImage` and `cadencePattern`) — that's expected, Task 3 fixes it.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts
git commit -m "feat(cms): extend CadenceConfig with cadencePattern, SharedData with seoDefaultOgImage"
```

---

### Task 3: Update hub-queries — normalizeTime, locale param, OG image, cadencePattern

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts`

**Depends on:** Tasks 1 and 2

- [ ] **Step 1: Add normalizeTime import**

At the top of `hub-queries.ts`, after line 3 add:

```typescript
import { normalizeTime } from '@/lib/newsletter/format'
```

- [ ] **Step 2: Add seoDefaultOgImage to fetchSharedData**

In `fetchSharedData` (line 23), change the sites query from:

```typescript
supabase.from('sites').select('name, timezone').eq('id', siteId).single(),
```

To:

```typescript
supabase.from('sites').select('name, timezone, seo_default_og_image').eq('id', siteId).single(),
```

Then in the return object (line 77-91), add `seoDefaultOgImage` after `defaultLocale`:

```typescript
      defaultLocale,
      seoDefaultOgImage: (site?.seo_default_og_image as string | null) ?? null,
```

- [ ] **Step 3: Add locale param to fetchScheduleData**

Change the function signature at line 409-410 from:

```typescript
  async (siteId: string): Promise<ScheduleTabData> => {
```

To:

```typescript
  async (siteId: string, locale: 'en' | 'pt-BR' = 'en'): Promise<ScheduleTabData> => {
```

- [ ] **Step 4: Apply normalizeTime to cadenceConfigs.time (line 635)**

In the `cadenceConfigs` mapping (around line 635), change:

```typescript
        time: (t.preferred_send_time as string) ?? '08:00',
```

To:

```typescript
        time: normalizeTime(t.preferred_send_time as string),
```

- [ ] **Step 5: Add cadencePattern to cadenceConfigs**

In the same mapping, after the `cadenceStartDate` line (around line 637), add:

```typescript
        cadencePattern: pattern,
```

- [ ] **Step 6: Pass locale to describePattern (line 620)**

Change:

```typescript
        ? describePattern(pattern, 'en')
```

To:

```typescript
        ? describePattern(pattern, locale)
```

- [ ] **Step 7: Apply normalizeTime to sendWindow.time (line 685)**

Change:

```typescript
        time: ((typeRows ?? []).find((t) => t.preferred_send_time)?.preferred_send_time as string)?.slice(0, 5) ?? '08:00',
```

To:

```typescript
        time: normalizeTime((typeRows ?? []).find((t) => t.preferred_send_time)?.preferred_send_time as string),
```

- [ ] **Step 8: Update the cache key to include locale**

Change the cache key array (line 692) from:

```typescript
  ['newsletter-schedule'],
```

To:

```typescript
  ['newsletter-schedule', siteId, locale],
```

Note: `unstable_cache` uses the key array to differentiate cached results.

- [ ] **Step 9: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in `page.tsx` (fetchScheduleData now accepts locale param) — Task 8 in Track D fixes the caller.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts
git commit -m "feat(cms): normalizeTime in queries, locale param, seoDefaultOgImage, cadencePattern"
```

---

### Task 4: Add i18n keys — types, en, pt-BR

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts`

- [ ] **Step 1: Add new keys to types.ts**

In `types.ts`, add keys to existing interfaces.

In the `schedule` interface (line 9), after `scheduledHint: string` add:

```typescript
conflict: string; conflicts: string
```

In the `cadenceConfig` interface (line 30-53), after `months: string` add:

```typescript
ordinals: [string, string, string, string]
```

In the `typeDrawer` interface (line 62-138), after `linkTagLoading: string` add:

```typescript
unsavedTitle: string; unsavedMessage: string; keepEditing: string; discardClose: string
slugAutoLabel: string
ogDefaultLabel: string; ogDefaultBadge: string; ogOverrideHint: string
```

- [ ] **Step 2: Add English translations in en.ts**

In the `schedule` object (line 11), after `scheduledHint: 'Only ready editions'` add:

```typescript
conflict: 'conflict', conflicts: 'conflicts',
```

In the `cadenceConfig` object (line 33-54), after `months: 'Months'` add:

```typescript
ordinals: ['1st', '2nd', '3rd', '4th'] as [string, string, string, string],
```

In the `typeDrawer` object (line 64-140), after `linkTagLoading: 'Loading tags...'` add:

```typescript
unsavedTitle: 'Unsaved changes', unsavedMessage: 'You have unsaved changes. Discard?', keepEditing: 'Keep editing', discardClose: 'Discard & close',
slugAutoLabel: 'auto',
ogDefaultLabel: 'Using site default', ogDefaultBadge: 'default', ogOverrideHint: 'Upload to override the default',
```

- [ ] **Step 3: Add Portuguese translations in pt-BR.ts**

In the `schedule` object (line 11), after `scheduledHint: 'Apenas edições prontas'` add:

```typescript
conflict: 'conflito', conflicts: 'conflitos',
```

In the `cadenceConfig` object (line 33-54), after `months: 'Meses'` add:

```typescript
ordinals: ['1º', '2º', '3º', '4º'] as [string, string, string, string],
```

In the `typeDrawer` object (line 64-140), after `linkTagLoading: 'Carregando tags...'` add:

```typescript
unsavedTitle: 'Alterações não salvas', unsavedMessage: 'Você tem alterações não salvas. Descartar?', keepEditing: 'Continuar editando', discardClose: 'Descartar e fechar',
slugAutoLabel: 'auto',
ogDefaultLabel: 'Usando padrão do site', ogDefaultBadge: 'padrão', ogOverrideHint: 'Envie uma imagem para substituir o padrão',
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: PASS (or only errors from unrelated pending tasks)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts
git commit -m "feat(cms): add i18n keys for unsaved guard, slug auto, OG default, ordinals"
```

---

### Task 5: Server-side Zod validation for cadence actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts:900-921` (updateCadence)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts:1538-1555` (updateSendTime)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts:1568-1593` (updateCadencePattern)
- Test: `apps/web/test/cms/cadence-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create file `apps/web/test/cms/cadence-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: Function) => fn),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: vi.fn().mockReturnValue(new Map()),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site', orgId: 'test-org', defaultLocale: 'en' }),
}))

vi.mock('@/lib/auth/scope', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

import { updateCadence, updateSendTime } from '@/app/cms/(authed)/newsletters/actions'

describe('updateCadence Zod validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects cadence_days = 0', async () => {
    const result = await updateCadence('type-1', { cadence_days: 0 })
    expect(result.ok).toBe(false)
  })

  it('rejects cadence_days = 366', async () => {
    const result = await updateCadence('type-1', { cadence_days: 366 })
    expect(result.ok).toBe(false)
  })

  it('rejects malformed time "9am"', async () => {
    const result = await updateCadence('type-1', { preferred_send_time: '9am' })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid date format', async () => {
    const result = await updateCadence('type-1', { cadence_start_date: '2026/05/01' })
    expect(result.ok).toBe(false)
  })

  it('accepts valid HH:MM:SS time (normalized)', async () => {
    const result = await updateCadence('type-1', { preferred_send_time: '09:00:00' })
    expect(result.ok).toBe(true)
  })

  it('accepts valid patch with all fields', async () => {
    const result = await updateCadence('type-1', {
      cadence_days: 14,
      preferred_send_time: '09:00',
      cadence_start_date: '2026-05-07',
    })
    expect(result.ok).toBe(true)
  })
})

describe('updateSendTime Zod validation', () => {
  it('rejects non-HH:MM format', async () => {
    const result = await updateSendTime('type-1', 'not-a-time')
    expect(result.ok).toBe(false)
  })

  it('accepts valid HH:MM', async () => {
    const result = await updateSendTime('type-1', '14:30')
    expect(result.ok).toBe(true)
  })

  it('accepts HH:MM:SS (defense-in-depth)', async () => {
    const result = await updateSendTime('type-1', '09:00:00')
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/cadence-actions.test.ts`
Expected: FAIL — validation doesn't exist yet, invalid inputs succeed

- [ ] **Step 3: Add Zod schema and validate in updateCadence**

In `actions.ts`, add the import at the top (after existing `z` import or add one):

```typescript
import { z } from 'zod'
```

Before `updateCadence` (around line 900), add:

```typescript
const UpdateCadencePatch = z.object({
  cadence_days: z.number().int().min(1).max(365).optional(),
  preferred_send_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  cadence_paused: z.boolean().optional(),
  cadence_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
```

In `updateCadence`, after the `requireSiteScope` check (line 908), add:

```typescript
  const parsed = UpdateCadencePatch.safeParse(patch)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
```

And change `patch` to `parsed.data` in the update call:

```typescript
  const { error } = await supabase
    .from('newsletter_types')
    .update(parsed.data)
    .eq('id', typeId)
    .eq('site_id', ctx.siteId)
```

- [ ] **Step 4: Add validation to updateSendTime**

In `updateSendTime` (around line 1538), after the `requireSiteScope` check, add:

```typescript
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return { ok: false, error: 'Invalid time format' }
```

- [ ] **Step 5: Add sendTime validation to updateCadencePattern**

In `updateCadencePattern` (around line 1568), after the `requireSiteScope` check (before the slot validation), add:

```typescript
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(sendTime)) return { ok: false, error: 'Invalid time format' }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/cadence-actions.test.ts`
Expected: PASS — all 9 tests green

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/actions.ts apps/web/test/cms/cadence-actions.test.ts
git commit -m "feat(cms): add Zod validation to updateCadence, updateSendTime, updateCadencePattern"
```

---

### Task 6: Security fix — settings/page.tsx site_id filter + normalizeTime

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx`

- [ ] **Step 1: Add site_id filter and normalizeTime**

Replace the entire file content of `settings/page.tsx`:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { normalizeTime } from '@/lib/newsletter/format'
import { updateCadence } from '../actions'
import { NewsletterSettings } from '@tn-figueiredo/newsletter-admin/client'
import type { NewsletterTypeSettings } from '@tn-figueiredo/newsletter-admin'

export const dynamic = 'force-dynamic'

export default async function NewsletterSettingsPage() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, preferred_send_time, cadence_paused, sender_name, sender_email, reply_to')
    .eq('site_id', ctx.siteId)
    .eq('active', true)
    .order('sort_order')

  const settingsTypes: NewsletterTypeSettings[] = (types ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    locale: t.locale as string,
    color: (t.color as string) ?? '#ea580c',
    cadence_days: (t.cadence_days as number) ?? 7,
    preferred_send_time: normalizeTime(t.preferred_send_time as string),
    cadence_paused: (t.cadence_paused as boolean) ?? false,
    sender_name: t.sender_name as string | null,
    sender_email: t.sender_email as string | null,
    reply_to: t.reply_to as string | null,
  }))

  async function handleSave(typeId: string, data: { cadence_days: number; preferred_send_time: string; cadence_paused: boolean }) {
    'use server'
    await updateCadence(typeId, data)
  }

  return <NewsletterSettings types={settingsTypes} onSave={handleSave} />
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "settings/page" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx
git commit -m "fix(cms): add site_id scope to settings query, apply normalizeTime"
```

---

### Task 7: Rewrite cadence-card.tsx — embed CadencePatternForm

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card.tsx` (full rewrite)

**Depends on:** Tasks 1, 2, 3, 4

- [ ] **Step 1: Rewrite cadence-card.tsx**

Replace the entire file:

```typescript
'use client'

import { useState } from 'react'
import { Pause, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { describePattern } from '@/lib/newsletter/cadence-slots'
import { normalizeTime } from '@/lib/newsletter/format'
import type { CadencePattern, Weekday } from '@/lib/newsletter/cadence-pattern'
import type { CadenceConfig } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { CadencePatternForm } from '../../_components/cadence-pattern-form'
import { updateCadencePattern } from '../../actions'

const WEEKDAY_MAP: Record<string, Weekday> = {
  Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat',
  Sunday: 'sun', Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri', Saturday: 'sat',
}

function legacyToPattern(config: CadenceConfig): CadencePattern {
  const weekday = config.dayOfWeek ? WEEKDAY_MAP[config.dayOfWeek] ?? 'mon' : 'mon'
  if (config.cadenceDays === 7 && config.dayOfWeek)
    return { type: 'weekly', days: [weekday] }
  if (config.cadenceDays === 14 && config.dayOfWeek)
    return { type: 'biweekly', day: weekday }
  return { type: 'every_n_days', interval: config.cadenceDays || 7 }
}

interface CadenceCardProps {
  config: CadenceConfig
  siteTimezone: string
  locale: 'en' | 'pt-BR'
  onTogglePause?: (typeId: string, paused: boolean) => void
  strings?: NewsletterHubStrings
}

export function CadenceCard({ config, siteTimezone, locale, onTogglePause, strings }: CadenceCardProps) {
  const s = strings?.schedule
  const [expanded, setExpanded] = useState(false)

  const effectivePattern = config.cadencePattern ?? legacyToPattern(config)
  const time = normalizeTime(config.time)

  let summaryText: string
  try {
    summaryText = describePattern(effectivePattern, locale)
  } catch {
    summaryText = config.cadence
  }

  async function handlePatternSave(pattern: CadencePattern, sendTime: string) {
    return updateCadencePattern(config.typeId, pattern, sendTime)
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: config.typeColor }} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-gray-200">{config.typeName}</div>
          <div className="text-[9px] text-gray-500">
            {summaryText} · {time}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] tabular-nums text-gray-400">{config.subscribers} {s?.subs ?? 'subs'}</div>
          <div className="text-[9px] text-gray-600">{config.openRate.toFixed(0)}% {s?.openRate ?? 'open rate'}</div>
        </div>
        {config.conflicts.length > 0 && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-400">
            {config.conflicts.length} {config.conflicts.length > 1 ? (s?.conflicts ?? 'conflicts') : (s?.conflict ?? 'conflict')}
          </span>
        )}
        <button
          onClick={() => onTogglePause?.(config.typeId, !config.paused)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
            config.paused ? 'border-amber-500/30 text-amber-400 hover:bg-amber-950/20' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
          }`}
          aria-label={config.paused ? (s?.resumeCadence ?? 'Resume cadence') : (s?.pauseCadence ?? 'Pause cadence')}
        >
          {config.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-400 hover:bg-gray-800"
          aria-label={expanded ? (s?.collapse ?? 'Collapse') : (s?.editCadence ?? 'Edit cadence')}
          aria-expanded={expanded}
          data-testid={`cadence-expand-${config.typeId}`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3" data-testid={`cadence-form-${config.typeId}`}>
          <CadencePatternForm
            currentPattern={effectivePattern}
            preferredSendTime={time}
            siteTimezone={siteTimezone}
            locale={locale}
            onSave={handlePatternSave}
            strings={strings}
          />
          <div className="flex justify-start mt-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md px-3 py-1.5 text-[10px] font-medium text-gray-400 hover:bg-gray-800"
            >
              {s?.collapse ?? 'Collapse'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { legacyToPattern }
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "cadence-card" | head -5`
Expected: Errors in schedule-tab.tsx (missing new props) — Task 8 fixes this.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card.tsx
git commit -m "feat(cms): rewrite cadence-card to embed CadencePatternForm with legacyToPattern"
```

---

### Task 8: Update schedule-tab.tsx — pass locale/tz, replace custom toast, use isPending

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx` (pass locale to fetchScheduleData)

**Depends on:** Task 7

- [ ] **Step 1: Update schedule-tab.tsx**

Make the following changes:

1. Add `toast` import from sonner and remove custom toast state:

Replace:
```typescript
import { useState, useCallback, useTransition } from 'react'
```
With:
```typescript
import { useState, useCallback, useTransition } from 'react'
import { toast } from 'sonner'
```

2. Remove `toastMsg` state and `showToast` callback. Replace `const [toastMsg, setToastMsg] = useState<string | null>(null)` and `const showToast = useCallback(...)` with nothing — delete both lines entirely (lines 104-109).

3. Replace all `showToast(...)` calls with `toast.info(...)` or `toast.success(...)` or `toast.error(...)`:

   - `showToast(strings?.schedule.noReadyEditions ?? ...)` → `toast.info(strings?.schedule.noReadyEditions ?? ...)`
   - `showToast(strings?.schedule.saved ?? 'Scheduled')` → `toast.success(strings?.schedule.saved ?? 'Scheduled')`
   - `showToast('Slot already taken — try another')` → `toast.error('Slot already taken — try another')`
   - `showToast(result.error ?? ...)` → `toast.error(result.error ?? ...)`
   - All other `showToast` calls → appropriate `toast.*` calls

4. Use `isPending`: Change `const [, startTransition] = useTransition()` to `const [isPending, startTransition] = useTransition()`.

5. Pass `siteTimezone` and `locale` to `CadenceCard`:

Replace:
```typescript
<CadenceCard key={c.typeId} config={c} onTogglePause={handleTogglePause} strings={strings} />
```
With:
```typescript
<CadenceCard key={c.typeId} config={c} siteTimezone={data.sendWindow.timezone} locale={locale} onTogglePause={handleTogglePause} strings={strings} />
```

6. Remove the custom toast div at the bottom of the return (lines 345-349):
```typescript
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 ...">
          {toastMsg}
        </div>
      )}
```

- [ ] **Step 2: Update page.tsx to pass locale to fetchScheduleData**

In `apps/web/src/app/cms/(authed)/newsletters/page.tsx`, change line 74:

```typescript
      const data = await fetchScheduleData(siteId)
```

To:

```typescript
      const data = await fetchScheduleData(siteId, locale)
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: PASS (or only unrelated errors)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx apps/web/src/app/cms/(authed)/newsletters/page.tsx
git commit -m "fix(cms): replace custom toast with sonner, pass locale/timezone to CadenceCard"
```

---

### Task 9: Fix cadence-pattern-form.tsx — siteTimezone, normalizeTime, i18n ordinals

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/cadence-pattern-form.tsx`

**Depends on:** Tasks 1, 4

- [ ] **Step 1: Add normalizeTime import**

Add after line 5:
```typescript
import { normalizeTime } from '@/lib/newsletter/format'
```

- [ ] **Step 2: Wire siteTimezone (remove dead param)**

Change line 77 from:
```typescript
  siteTimezone: _siteTimezone,
```
To:
```typescript
  siteTimezone,
```

- [ ] **Step 3: Normalize preferredSendTime on init**

Change line 89 from:
```typescript
  const [sendTime, setSendTime] = useState(preferredSendTime || '09:00')
```
To:
```typescript
  const [sendTime, setSendTime] = useState(normalizeTime(preferredSendTime))
```

- [ ] **Step 4: Show timezone in preview**

In the preview section (around line 177-192), after the dates display, add timezone info. Change:
```typescript
          <p className="text-[12px] text-gray-300">
            {patternDescription && (
              <span className="text-gray-500 mr-2">{patternDescription} —</span>
            )}
            {previewDates.join(', ')}
          </p>
```
To:
```typescript
          <div>
            <p className="text-[12px] text-gray-300">
              {patternDescription && (
                <span className="text-gray-500 mr-2">{patternDescription} —</span>
              )}
              {previewDates.join(', ')}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sendTime} {siteTimezone}</p>
          </div>
```

- [ ] **Step 5: i18n ordinals in monthly_weekday inputs**

In `PatternInputs` for the `monthly_weekday` case (around line 347), change the hardcoded ordinals:
```typescript
<option key={w} value={w}>{w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : '4th'}</option>
```
To:
```typescript
<option key={w} value={w}>{cc?.ordinals?.[w - 1] ?? `${w}th`}</option>
```

- [ ] **Step 6: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "cadence-pattern-form" | head -5`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/cadence-pattern-form.tsx
git commit -m "fix(cms): wire siteTimezone in preview, normalizeTime on init, i18n ordinals"
```

---

### Task 10: Rewrite type-drawer.tsx — slug auto-sync, dirty state, OG default

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx` (pass defaultOgImage)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx` (pass defaultOgImage)

**Depends on:** Tasks 2, 3, 4

This is the largest task. Apply 4 changes to `type-drawer.tsx`:

- [ ] **Step 1: Add defaultOgImage prop**

In `TypeDrawerProps` interface (around line 71-81), add:
```typescript
  defaultOgImage?: string | null
```

Update the destructuring in the function signature to include `defaultOgImage`.

- [ ] **Step 2: Fix slug auto-sync**

A) Rename `slugManual` to `slugTouched`:

Replace line 101:
```typescript
  const [slugManual, setSlugManual] = useState(false)
```
With:
```typescript
  const [slugTouched, setSlugTouched] = useState(false)
```

B) In edit mode load (line 138), change:
```typescript
            setSlugManual(true)
```
To:
```typescript
            setSlugTouched(false)
```

C) In create mode reset (line 160), change:
```typescript
        setSlugManual(false)
```
To:
```typescript
        setSlugTouched(false)
```

D) Replace `handleNameBlur` (lines 217-221) with real-time sync via `handleNameChange`:

Delete `handleNameBlur` entirely and add a new function:
```typescript
  function handleNameChange(val: string) {
    setName(val)
    if (!slugTouched && val.trim()) {
      setSlug(generateSlug(val))
    }
  }
```

E) Update `handleSlugChange` (lines 223-226):
```typescript
  function handleSlugChange(val: string) {
    setSlugTouched(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }
```

F) In the name input (around line 415), change:
```typescript
                      onChange={(e) => setName(e.target.value)}
                      onBlur={handleNameBlur}
```
To:
```typescript
                      onChange={(e) => handleNameChange(e.target.value)}
```

G) Add "auto" badge next to slug label (around line 459). Change:
```typescript
                    <label htmlFor={`${fid}-slug`} className="block text-sm font-medium text-gray-400 mb-1">{strings.slugLabel}</label>
```
To:
```typescript
                    <label htmlFor={`${fid}-slug`} className="block text-sm font-medium text-gray-400 mb-1">
                      {strings.slugLabel}
                      {!slugTouched && <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] text-indigo-400">{strings.slugAutoLabel ?? 'auto'}</span>}
                    </label>
```

- [ ] **Step 3: Add dirty state tracking + confirmation dialog**

A) Add state for dirty tracking and discard dialog after existing state declarations (around line 116):

```typescript
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const pendingCloseAction = useRef<(() => void) | null>(null)
  const initialSnapshotRef = useRef<string | null>(null)
```

B) Add snapshot helper function (after `handleFileUpload`):

```typescript
  function currentSnapshot(): string {
    return JSON.stringify({
      name, tagline, locale: drawerLocale, slug, badge, description,
      promiseValues: promiseItems.map(i => i.value),
      color, colorDark, ogImageUrl, linkedTagId,
    })
  }

  const isDirty = initialSnapshotRef.current !== null
    && currentSnapshot() !== initialSnapshotRef.current
```

C) Capture initial snapshot after state is populated. In the edit mode load success callback (after `setLoading(false)` at line 152), add:

```typescript
            requestAnimationFrame(() => {
              initialSnapshotRef.current = JSON.stringify({
                name: t.name, tagline: t.tagline ?? '', locale: t.locale, slug: t.slug,
                badge: t.badge ?? '', description: t.description ?? '',
                promiseValues: t.landingPromise,
                color: t.color, colorDark: t.colorDark ?? '', ogImageUrl: t.ogImageUrl ?? '',
                linkedTagId: t.linkedTag?.id ?? null,
              })
            })
```

In the create mode reset (after all setters at line 169), add:

```typescript
        requestAnimationFrame(() => {
          initialSnapshotRef.current = JSON.stringify({
            name: '', tagline: '', locale, slug: '', badge: '', description: '',
            promiseValues: [] as string[],
            color: '#7c3aed', colorDark: '', ogImageUrl: '', linkedTagId: null,
          })
        })
```

D) Add `guardedClose` function:

```typescript
  function guardedClose(afterClose?: () => void) {
    if (isDirty) {
      pendingCloseAction.current = afterClose ?? null
      setShowDiscardDialog(true)
    } else {
      handleClose()
      afterClose?.()
    }
  }

  function confirmDiscard() {
    setShowDiscardDialog(false)
    initialSnapshotRef.current = null
    handleClose()
    pendingCloseAction.current?.()
    pendingCloseAction.current = null
  }
```

E) Gate all 5 close paths through `guardedClose`:

- Close button (✕) at line 393: `onClick={handleClose}` → `onClick={() => guardedClose()}`
- Backdrop click at line 380: `onClick={handleClose}` → `onClick={() => guardedClose()}`
- Cancel button at line 862-866: `onClick={handleClose}` → `onClick={() => guardedClose()}`
- "Edit in Schedule tab" at lines 790-793: change:
  ```typescript
  onClick={() => { handleClose(); router.push('/cms/newsletters?tab=schedule') }}
  ```
  To:
  ```typescript
  onClick={() => guardedClose(() => router.push('/cms/newsletters?tab=schedule'))}
  ```
- Escape key at line 203: `if (e.key === 'Escape') { handleClose(); return }` → `if (e.key === 'Escape') { guardedClose(); return }`

F) Add discard confirmation dialog. After the footer `</div>` (line 881) and before the closing `</div>` of the panel, add:

```typescript
        {showDiscardDialog && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <div className="mx-6 w-full max-w-sm rounded-xl border border-gray-700 bg-[#0a0a12] p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-gray-100">{strings.unsavedTitle ?? 'Unsaved changes'}</h3>
              <p className="mt-2 text-sm text-gray-400">{strings.unsavedMessage ?? 'You have unsaved changes. Discard?'}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardDialog(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800"
                >
                  {strings.keepEditing ?? 'Keep editing'}
                </button>
                <button
                  type="button"
                  onClick={confirmDiscard}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  data-testid="drawer-discard-confirm"
                >
                  {strings.discardClose ?? 'Discard & close'}
                </button>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Add OG image default fallback**

In the OG image section (around line 644-720), add default fallback rendering:

Before the existing `{ogImageUrl && /^https:\/\/.+/.test(ogImageUrl) && (` block, add:

```typescript
                    {!ogImageUrl && (defaultOgImage || true) && (
                      <div className="mb-2 relative rounded-lg border border-gray-800 overflow-hidden">
                        <img
                          src={defaultOgImage || '/og-default.png'}
                          alt="Default OG"
                          className="h-28 w-full object-cover opacity-60"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                          <span className="text-[10px] text-gray-300">{strings.ogDefaultLabel ?? 'Using site default'}</span>
                          <span className="ml-1.5 rounded bg-gray-700 px-1.5 py-0.5 text-[9px] text-gray-400">{strings.ogDefaultBadge ?? 'default'}</span>
                        </div>
                      </div>
                    )}
```

Also update the dropzone text for when no image is set — the upload button text can include the override hint:

In the dropzone's upload button area, when `!ogImageUrl`, change the button text to include the hint. After `{strings.uploadDragDrop}`, add on the next line:
```typescript
                          {!ogImageUrl && <><br /><span className="text-[10px] text-gray-600">{strings.ogOverrideHint ?? 'Upload to override the default'}</span></>}
```

- [ ] **Step 5: Pass defaultOgImage from hub-client.tsx**

In `hub-client.tsx`, at line 178 where `<TypeDrawer>` is rendered, add the prop:

Change:
```typescript
      <TypeDrawer
        open={drawerOpen}
        mode={drawerMode}
        typeId={drawerTypeId}
        onClose={handleCloseDrawer}
        locale={locale}
        strings={drawerStrings}
        existingBadges={existingBadges}
        siteId={siteId}
      />
```
To:
```typescript
      <TypeDrawer
        open={drawerOpen}
        mode={drawerMode}
        typeId={drawerTypeId}
        onClose={handleCloseDrawer}
        locale={locale}
        strings={drawerStrings}
        existingBadges={existingBadges}
        siteId={siteId}
        defaultOgImage={sharedData.seoDefaultOgImage}
      />
```

- [ ] **Step 6: Pass defaultOgImage from type-cards.tsx**

In `type-cards.tsx`, the `TypeCardsProps` interface needs a `defaultOgImage` prop:

Add to interface:
```typescript
  defaultOgImage?: string | null
```

Update destructuring to include `defaultOgImage`.

At line 190-198 where `<TypeDrawer>` is rendered, add the prop:
```typescript
        defaultOgImage={defaultOgImage}
```

- [ ] **Step 7: Verify typecheck passes**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx
git commit -m "feat(cms): slug auto-sync, dirty state guard, OG image default fallback"
```

---

### Task 11: Fix month-calendar.tsx — stable useMemo

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx`

- [ ] **Step 1: Read the full file to find the useMemo**

Read `month-calendar.tsx` fully to locate the `useMemo` with unstable `slots` reference.

- [ ] **Step 2: Stabilize useMemo dependency**

Find the `useMemo` that depends on `slots` (the prop). The `slots` array creates a new reference on each server render. Fix by using `JSON.stringify` as the dep key.

Change the useMemo that calls `buildMonthGrid` — look for pattern like:

```typescript
const grid = useMemo(() => buildMonthGrid(year, month, slots), [year, month, slots])
```

Change to:

```typescript
const slotsKey = JSON.stringify(slots)
const grid = useMemo(() => buildMonthGrid(year, month, slots), [year, month, slotsKey])
```

Note: The `slots` variable is still used in the callback (closure reference), only the dep array uses the string key for stability.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx
git commit -m "fix(cms): stabilize MonthCalendar useMemo with JSON.stringify dep"
```

---

### Task 12: Write cadence-card tests

**Files:**
- Create: `apps/web/test/cms/cadence-card.test.tsx`

**Depends on:** Task 7

- [ ] **Step 1: Write the test file**

```typescript
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: vi.fn().mockReturnValue(new Map()),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site', orgId: 'test-org', defaultLocale: 'en' }),
}))

vi.mock('@/lib/auth/scope', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

import { CadenceCard, legacyToPattern } from '@/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card'
import type { CadenceConfig } from '@/app/cms/(authed)/newsletters/_hub/hub-types'

function makeConfig(overrides: Partial<CadenceConfig> = {}): CadenceConfig {
  return {
    typeId: 'type-1',
    typeName: 'Weekly Digest',
    typeColor: '#6366f1',
    cadence: 'Weekly, Mon',
    hasPattern: false,
    cadenceDays: 7,
    dayOfWeek: 'Mon',
    time: '09:00:00',
    nextDate: '2026-05-12',
    cadenceStartDate: '2026-05-05',
    cadencePattern: null,
    paused: false,
    subscribers: 42,
    editionsSent: 10,
    openRate: 55.3,
    conflicts: [],
    ...overrides,
  }
}

describe('CadenceCard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders collapsed with normalized time (strips seconds)', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByText(/09:00/)).toBeTruthy()
    expect(screen.queryByText(/09:00:00/)).toBeNull()
  })

  it('renders collapsed with describePattern when cadencePattern exists', () => {
    render(
      <CadenceCard
        config={makeConfig({ cadencePattern: { type: 'biweekly', day: 'wed' }, hasPattern: true })}
        siteTimezone="America/Sao_Paulo"
        locale="pt-BR"
      />,
    )
    expect(screen.getByText(/quinzenal/i)).toBeTruthy()
  })

  it('expands on chevron click', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    fireEvent.click(screen.getByTestId('cadence-expand-type-1'))
    expect(screen.getByTestId('cadence-form-type-1')).toBeTruthy()
  })

  it('collapses when already expanded', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    fireEvent.click(screen.getByTestId('cadence-expand-type-1'))
    expect(screen.getByTestId('cadence-form-type-1')).toBeTruthy()
    fireEvent.click(screen.getByTestId('cadence-expand-type-1'))
    expect(screen.queryByTestId('cadence-form-type-1')).toBeNull()
  })

  it('shows pause button with correct label', () => {
    render(<CadenceCard config={makeConfig({ paused: true })} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByLabelText('Resume cadence')).toBeTruthy()
  })

  it('shows conflict badge when conflicts exist', () => {
    render(
      <CadenceCard config={makeConfig({ conflicts: ['2026-05-10', '2026-05-17'] })} siteTimezone="America/Sao_Paulo" locale="en" />,
    )
    expect(screen.getByText(/2 conflicts/)).toBeTruthy()
  })

  it('shows singular conflict badge for single conflict', () => {
    render(
      <CadenceCard config={makeConfig({ conflicts: ['2026-05-10'] })} siteTimezone="America/Sao_Paulo" locale="en" />,
    )
    expect(screen.getByText(/1 conflict/)).toBeTruthy()
  })

  it('renders subscriber count and open rate', () => {
    render(<CadenceCard config={makeConfig()} siteTimezone="America/Sao_Paulo" locale="en" />)
    expect(screen.getByText('42 subs')).toBeTruthy()
    expect(screen.getByText(/55%/)).toBeTruthy()
  })
})

describe('legacyToPattern', () => {
  it('converts 7-day to weekly', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 7, dayOfWeek: 'Wed' }))
    expect(pattern).toEqual({ type: 'weekly', days: ['wed'] })
  })

  it('converts 14-day to biweekly', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 14, dayOfWeek: 'Mon' }))
    expect(pattern).toEqual({ type: 'biweekly', day: 'mon' })
  })

  it('converts arbitrary N to every_n_days', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 3, dayOfWeek: '' }))
    expect(pattern).toEqual({ type: 'every_n_days', interval: 3 })
  })

  it('handles missing dayOfWeek', () => {
    const pattern = legacyToPattern(makeConfig({ cadenceDays: 7, dayOfWeek: '' }))
    expect(pattern.type).toBe('every_n_days')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/cadence-card.test.tsx`
Expected: PASS — all 12 tests green

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/cadence-card.test.tsx
git commit -m "test(cms): add 12 cadence-card tests (collapsed, expanded, legacyToPattern)"
```

---

### Task 13: Expand type-drawer tests (+8 tests)

**Files:**
- Modify: `apps/web/test/cms/newsletter-type-drawer.test.tsx`

**Depends on:** Task 10

- [ ] **Step 1: Add 8 new tests to existing file**

Append to the existing test file, inside or after the existing `describe` block:

```typescript
describe('TypeDrawer — slug auto-sync', () => {
  it('auto-syncs slug when name changes in create mode', async () => {
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={vi.fn()}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    const nameInput = screen.getByTestId('drawer-name')
    const slugInput = screen.getByTestId('drawer-slug')
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'My Newsletter' } }) })
    expect((slugInput as HTMLInputElement).value).toBe('my-newsletter')
  })

  it('auto-syncs slug when name changes in edit mode', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      ok: true,
      type: {
        id: 'type-1', name: 'Old Name', tagline: null, locale: 'en', slug: 'old-name',
        badge: null, description: null, color: '#7c3aed', colorDark: null,
        ogImageUrl: null, landingPromise: [], cadenceDays: 7,
        cadenceStartDate: null, cadencePaused: false, subscriberCount: 0,
        editionCount: 0, linkedTag: null,
      },
    })
    vi.mocked(getNewsletterTypeForEdit).mockImplementation(mockGet)

    render(
      <TypeDrawer
        open={true}
        mode="edit"
        typeId="type-1"
        onClose={vi.fn()}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const nameInput = screen.getByTestId('drawer-name')
    const slugInput = screen.getByTestId('drawer-slug')
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'New Name' } }) })
    expect((slugInput as HTMLInputElement).value).toBe('new-name')
  })

  it('stops auto-syncing slug after manual edit', async () => {
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={vi.fn()}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    const nameInput = screen.getByTestId('drawer-name')
    const slugInput = screen.getByTestId('drawer-slug')
    await act(async () => { fireEvent.change(slugInput, { target: { value: 'custom-slug' } }) })
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'Any Name' } }) })
    expect((slugInput as HTMLInputElement).value).toBe('custom-slug')
  })

  it('shows "auto" badge when slug is auto-syncing', async () => {
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={vi.fn()}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    expect(screen.getByText('auto')).toBeTruthy()
  })
})

describe('TypeDrawer — unsaved changes guard', () => {
  it('closes without dialog when form is clean', async () => {
    const onClose = vi.fn()
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={onClose}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    fireEvent.click(screen.getByLabelText(en.typeDrawer.close))
    await act(async () => { await new Promise((r) => setTimeout(r, 300)) })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows discard dialog when form is dirty and close is clicked', async () => {
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={vi.fn()}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const nameInput = screen.getByTestId('drawer-name')
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'Something' } }) })
    fireEvent.click(screen.getByLabelText(en.typeDrawer.close))
    expect(screen.getByText(en.typeDrawer.unsavedTitle)).toBeTruthy()
  })

  it('discard confirm closes the drawer', async () => {
    const onClose = vi.fn()
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={onClose}
        locale="en"
        strings={en.typeDrawer}
      />,
    )
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    const nameInput = screen.getByTestId('drawer-name')
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'Dirty' } }) })
    fireEvent.click(screen.getByLabelText(en.typeDrawer.close))
    fireEvent.click(screen.getByTestId('drawer-discard-confirm'))
    await act(async () => { await new Promise((r) => setTimeout(r, 300)) })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TypeDrawer — OG image default', () => {
  it('shows default OG image when no custom image is set', async () => {
    render(
      <TypeDrawer
        open={true}
        mode="create"
        onClose={vi.fn()}
        locale="en"
        strings={en.typeDrawer}
        defaultOgImage="https://example.com/og.png"
      />,
    )
    const defaultImg = screen.getByAlt('Default OG')
    expect(defaultImg).toBeTruthy()
    expect((defaultImg as HTMLImageElement).src).toContain('example.com/og.png')
  })
})
```

Note: Ensure the test file imports `{ en }` from the i18n file and `getNewsletterTypeForEdit` from actions for mocking.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/newsletter-type-drawer.test.tsx`
Expected: PASS — all existing + 8 new tests green

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/newsletter-type-drawer.test.tsx
git commit -m "test(cms): add 8 type-drawer tests (slug sync, dirty guard, OG default)"
```

---

### Task 14: Write schedule-tab tests

**Files:**
- Create: `apps/web/test/cms/newsletter-schedule-tab.test.tsx`

**Depends on:** Task 8

- [ ] **Step 1: Write the test file**

```typescript
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(), set: vi.fn(), delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
  headers: vi.fn().mockReturnValue(new Map()),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'test-site', orgId: 'test-org', defaultLocale: 'en' }),
}))

vi.mock('@/lib/auth/scope', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

import { ScheduleTab } from '@/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab'
import type { ScheduleTabData } from '@/app/cms/(authed)/newsletters/_hub/hub-types'
import { en } from '@/app/cms/(authed)/newsletters/_i18n/en'

function makeData(overrides: Partial<ScheduleTabData> = {}): ScheduleTabData {
  return {
    healthStrip: { fillRate: 75, next7Days: 2, missed: 1, failed: 0, activeTypes: 2, totalTypes: 3 },
    calendarSlots: Array.from({ length: 42 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      cadenceSlots: [],
      specialEditions: [],
    })),
    cadenceConfigs: [
      {
        typeId: 'type-1', typeName: 'Weekly', typeColor: '#6366f1',
        cadence: 'Weekly, Mon', hasPattern: true, cadenceDays: 7,
        dayOfWeek: 'Mon', time: '09:00', nextDate: '2026-05-12',
        cadenceStartDate: null, cadencePattern: { type: 'weekly', days: ['mon'] },
        paused: false, subscribers: 10, editionsSent: 5, openRate: 50,
        conflicts: [],
      },
    ],
    sendWindow: { time: '09:00', timezone: 'America/Sao_Paulo', bestTimeInsight: 'Based on subscriber timezone' },
    readyEditions: [],
    ...overrides,
  }
}

describe('ScheduleTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders health strip metrics', () => {
    render(<ScheduleTab data={makeData()} strings={en} locale="en" />)
    expect(screen.getByText('75%')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('renders cadence config cards', () => {
    render(<ScheduleTab data={makeData()} strings={en} locale="en" />)
    expect(screen.getByText('Weekly')).toBeTruthy()
  })

  it('shows empty state when no cadence configs', () => {
    render(<ScheduleTab data={makeData({ cadenceConfigs: [] })} strings={en} locale="en" />)
    expect(screen.getByText(/configure/i)).toBeTruthy()
  })

  it('filters cadence configs by typeFilter', () => {
    const data = makeData({
      cadenceConfigs: [
        { ...makeData().cadenceConfigs[0]!, typeId: 'type-1', typeName: 'Weekly' },
        { ...makeData().cadenceConfigs[0]!, typeId: 'type-2', typeName: 'Monthly' },
      ],
    })
    render(<ScheduleTab data={data} typeFilter="type-2" strings={en} locale="en" />)
    expect(screen.queryByText('Weekly')).toBeNull()
    expect(screen.getByText('Monthly')).toBeTruthy()
  })

  it('renders send window with timezone', () => {
    render(<ScheduleTab data={makeData()} strings={en} locale="en" />)
    expect(screen.getByText(/America\/Sao_Paulo/)).toBeTruthy()
  })

  it('does not render custom toast div (uses sonner)', () => {
    const { container } = render(<ScheduleTab data={makeData()} strings={en} locale="en" />)
    const fixedDivs = container.querySelectorAll('.fixed.bottom-6.right-6')
    expect(fixedDivs.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/newsletter-schedule-tab.test.tsx`
Expected: PASS — all 6 tests green

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/newsletter-schedule-tab.test.tsx
git commit -m "test(cms): add 6 schedule-tab tests (health strip, cadence cards, sonner)"
```

---

### Task 15: Full test suite + typecheck

**Depends on:** All previous tasks

- [ ] **Step 1: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 2: Run full web test suite**

Run: `npm run test:web`
Expected: PASS — all tests green (existing 2713+ plus ~38 new)

- [ ] **Step 3: Run full test suite (api + web)**

Run: `npm test`
Expected: PASS — all tests green

- [ ] **Step 4: Commit any fixes if needed**

If any tests fail due to integration issues, fix them and commit:

```bash
git add -A
git commit -m "fix(cms): test suite adjustments for newsletter quality hardening"
```
