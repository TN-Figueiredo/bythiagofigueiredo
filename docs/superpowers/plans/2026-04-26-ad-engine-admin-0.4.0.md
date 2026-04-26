# Ad Engine Admin 0.4.0 — Campaign CRUD + Placeholder Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `@tn-figueiredo/ad-engine-admin` from 0.3.3 to 0.4.0 so campaigns are editable/deletable, creatives can be authored per slot per locale, and placeholders show human-readable labels with active campaign indicators.

**Architecture:** Package-first changes in `tnf-ecosystem/packages/ad-engine-admin`, consumed by `bythiagofigueiredo`. All new props/actions optional for backward compatibility. TDD with existing `makeChain`/`makeSupabase` mock pattern. Zero DB migrations — all columns already exist.

**Tech Stack:** React 19, Next.js 15, TypeScript 5, Zod, Supabase, tsup, Vitest, @testing-library/react, happy-dom

**Repos:**
- `tnf-ecosystem` at `/Users/figueiredo/Workspace/tnf-ecosystem` — branch `feat/ad-inquiries`
- `bythiagofigueiredo` at `/Users/figueiredo/Workspace/bythiagofigueiredo` — branch `staging`

---

## Session 1: Data Layer + Schemas + Types

**Files:**
- Modify: `packages/ad-engine-admin/src/queries.ts`
- Modify: `packages/ad-engine-admin/src/schemas.ts`
- Modify: `packages/ad-engine-admin/src/types.ts`
- Modify: `packages/ad-engine-admin/src/index.ts`
- Modify: `packages/ad-engine-admin/src/__tests__/queries.test.ts`
- Modify: `packages/ad-engine-admin/src/__tests__/schemas.test.ts`

---

### Task 1: Add new type interfaces to queries.ts

**Files:**
- Modify: `packages/ad-engine-admin/src/queries.ts`
- Test: `packages/ad-engine-admin/src/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing test for AdSlotCreativeRow type shape**

Add to `packages/ad-engine-admin/src/__tests__/queries.test.ts`:

```typescript
import type { AdSlotCreativeRow, AdCampaignDetail, ActiveCampaignSummary } from '../queries'

describe('new type interfaces', () => {
  it('AdSlotCreativeRow has required fields', () => {
    const row: AdSlotCreativeRow = {
      id: 'cr-1',
      slot_key: 'banner_top',
      title: 'Test',
      body: 'Body text',
      cta_text: 'Click',
      cta_url: 'https://example.com',
      image_url: null,
      dismiss_seconds: 5,
      locale: 'pt-BR',
      interaction: 'link',
    }
    expect(row.slot_key).toBe('banner_top')
    expect(row.locale).toBe('pt-BR')
    expect(row.interaction).toBe('link')
  })

  it('AdCampaignDetail extends AdCampaignRow with creatives', () => {
    const detail: AdCampaignDetail = {
      id: 'c-1',
      name: 'Test Campaign',
      advertiser: null,
      format: 'native',
      status: 'active',
      active: true,
      slot_id: 'banner_top',
      slots: ['banner_top'],
      schedule_start: null,
      schedule_end: null,
      pricing_model: 'house_free',
      pricing_value: 0,
      audience: ['all'],
      created_at: '2026-01-01',
      brand_color: '#6B7280',
      logo_url: null,
      type: 'house',
      priority: 10,
      creatives: [
        {
          id: 'cr-1',
          slot_key: 'banner_top',
          title: 'Test',
          body: null,
          cta_text: 'Click',
          cta_url: 'https://example.com',
          image_url: null,
          dismiss_seconds: 5,
          locale: 'pt-BR',
          interaction: 'link',
        },
      ],
    }
    expect(detail.creatives).toHaveLength(1)
    expect(detail.creatives[0].slot_key).toBe('banner_top')
  })

  it('ActiveCampaignSummary has required fields', () => {
    const summary: ActiveCampaignSummary = {
      id: 'c-1',
      name: 'Test Campaign',
      slot_id: 'banner_top',
    }
    expect(summary.slot_id).toBe('banner_top')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts 2>&1 | tail -20
```

Expected: FAIL — types `AdSlotCreativeRow`, `AdCampaignDetail`, `ActiveCampaignSummary` not exported from `../queries`.

- [ ] **Step 3: Add new interfaces and expand AdCampaignRow**

In `packages/ad-engine-admin/src/queries.ts`, add after the existing `AdCampaignRow` interface:

```typescript
export interface AdSlotCreativeRow {
  id: string
  slot_key: string
  title: string | null
  body: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  dismiss_seconds: number
  locale: string
  interaction: string
}

export interface AdCampaignDetail extends AdCampaignRow {
  creatives: AdSlotCreativeRow[]
}

export interface ActiveCampaignSummary {
  id: string
  name: string
  slot_id: string
}
```

Add these fields to the existing `AdCampaignRow` interface:

```typescript
export interface AdCampaignRow {
  // ... existing fields ...
  brand_color: string
  logo_url: string | null
  type: string
  priority: number
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Fix any existing tests broken by new required fields on AdCampaignRow**

The existing `fetchAdConfigs` test creates mock campaign objects that now need `brand_color`, `logo_url`, `type`, `priority`. Search for all mock `AdCampaignRow` objects in the test file and add the new fields:

```typescript
brand_color: '#6B7280',
logo_url: null,
type: 'house',
priority: 10,
```

- [ ] **Step 6: Run full test suite to verify nothing is broken**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/queries.ts packages/ad-engine-admin/src/__tests__/queries.test.ts && git commit -m "feat(ad-admin): add AdSlotCreativeRow, AdCampaignDetail, ActiveCampaignSummary types and expand AdCampaignRow"
```

---

### Task 2: Add fetchAdCampaignById query function

**Files:**
- Modify: `packages/ad-engine-admin/src/queries.ts`
- Test: `packages/ad-engine-admin/src/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing test for fetchAdCampaignById**

Add to `packages/ad-engine-admin/src/__tests__/queries.test.ts`:

```typescript
import { fetchAdCampaignById } from '../queries'

describe('fetchAdCampaignById', () => {
  it('returns campaign detail with creatives', async () => {
    const campaignData = {
      id: 'c-1',
      name: 'Test Campaign',
      advertiser: null,
      format: 'native',
      status: 'active',
      active: true,
      slot_id: 'banner_top',
      schedule_start: null,
      schedule_end: null,
      pricing_model: 'house_free',
      pricing_value: 0,
      audience: ['all'],
      created_at: '2026-01-01',
      brand_color: '#6B7280',
      logo_url: null,
      type: 'house',
      priority: 10,
      ad_slot_creatives: [
        {
          id: 'cr-1',
          slot_key: 'banner_top',
          title: 'Creative Title',
          body: 'Body',
          cta_text: 'Click',
          cta_url: 'https://example.com',
          image_url: null,
          dismiss_seconds: 5,
          locale: 'pt-BR',
          interaction: 'link',
        },
      ],
    }

    const chain = makeChain({ data: campaignData, error: null })
    const supabase = makeSupabase(() => chain)
    const result = await fetchAdCampaignById(supabase, 'app-1', 'c-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('c-1')
    expect(result!.name).toBe('Test Campaign')
    expect(result!.creatives).toHaveLength(1)
    expect(result!.creatives[0].slot_key).toBe('banner_top')
    expect(result!.creatives[0].locale).toBe('pt-BR')
  })

  it('returns null when campaign not found', async () => {
    const chain = makeChain({ data: null, error: null })
    const supabase = makeSupabase(() => chain)
    const result = await fetchAdCampaignById(supabase, 'app-1', 'nonexistent')

    expect(result).toBeNull()
  })

  it('returns null on error (fail closed)', async () => {
    const chain = makeChain({ data: null, error: { message: 'DB error' } })
    const supabase = makeSupabase(() => chain)
    const result = await fetchAdCampaignById(supabase, 'app-1', 'c-1')

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "fetchAdCampaignById" 2>&1 | tail -20
```

Expected: FAIL — `fetchAdCampaignById` is not exported.

- [ ] **Step 3: Implement fetchAdCampaignById**

Add to `packages/ad-engine-admin/src/queries.ts`:

```typescript
export async function fetchAdCampaignById(
  supabase: SupabaseClient,
  appId: string,
  campaignId: string,
): Promise<AdCampaignDetail | null> {
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select(
      '*, ad_slot_creatives(id, slot_key, title, body, cta_text, cta_url, image_url, dismiss_seconds, locale, interaction)',
    )
    .eq('app_id', appId)
    .eq('id', campaignId)
    .single()

  if (error || !data) return null

  const { ad_slot_creatives, ...campaign } = data as Record<string, unknown>
  const creatives = (ad_slot_creatives ?? []) as AdSlotCreativeRow[]

  const slots = creatives.map((c) => c.slot_key)
  const uniqueSlots = [...new Set(slots)]

  return {
    ...(campaign as unknown as AdCampaignRow),
    slots: uniqueSlots,
    slot_id: uniqueSlots[0] ?? '',
    creatives: creatives.sort((a, b) => {
      const localeCompare = a.locale.localeCompare(b.locale)
      return localeCompare !== 0 ? localeCompare : a.slot_key.localeCompare(b.slot_key)
    }),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "fetchAdCampaignById" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/queries.ts packages/ad-engine-admin/src/__tests__/queries.test.ts && git commit -m "feat(ad-admin): add fetchAdCampaignById query with creatives join"
```

---

### Task 3: Add fetchActiveCampaignsPerSlot query function

**Files:**
- Modify: `packages/ad-engine-admin/src/queries.ts`
- Test: `packages/ad-engine-admin/src/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing test for fetchActiveCampaignsPerSlot**

Add to `packages/ad-engine-admin/src/__tests__/queries.test.ts`:

```typescript
import { fetchActiveCampaignsPerSlot } from '../queries'

describe('fetchActiveCampaignsPerSlot', () => {
  it('returns active campaign summaries', async () => {
    const mockData = [
      {
        id: 'c-1',
        name: 'Campaign A',
        ad_slot_creatives: [{ slot_key: 'banner_top' }],
      },
      {
        id: 'c-2',
        name: 'Campaign B',
        ad_slot_creatives: [{ slot_key: 'rail_left' }, { slot_key: 'rail_right' }],
      },
    ]

    const chain = makeChain({ data: mockData, error: null })
    const supabase = makeSupabase(() => chain)
    const result = await fetchActiveCampaignsPerSlot(supabase, 'app-1')

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({ id: 'c-1', name: 'Campaign A', slot_id: 'banner_top' })
    expect(result).toContainEqual({ id: 'c-2', name: 'Campaign B', slot_id: 'rail_left' })
    expect(result).toContainEqual({ id: 'c-2', name: 'Campaign B', slot_id: 'rail_right' })
  })

  it('returns empty array on error', async () => {
    const chain = makeChain({ data: null, error: { message: 'DB error' } })
    const supabase = makeSupabase(() => chain)
    const result = await fetchActiveCampaignsPerSlot(supabase, 'app-1')

    expect(result).toEqual([])
  })

  it('returns empty array when no active campaigns', async () => {
    const chain = makeChain({ data: [], error: null })
    const supabase = makeSupabase(() => chain)
    const result = await fetchActiveCampaignsPerSlot(supabase, 'app-1')

    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "fetchActiveCampaignsPerSlot" 2>&1 | tail -20
```

Expected: FAIL — `fetchActiveCampaignsPerSlot` not exported.

- [ ] **Step 3: Implement fetchActiveCampaignsPerSlot**

Add to `packages/ad-engine-admin/src/queries.ts`:

```typescript
export async function fetchActiveCampaignsPerSlot(
  supabase: SupabaseClient,
  appId: string,
): Promise<ActiveCampaignSummary[]> {
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select('id, name, ad_slot_creatives(slot_key)')
    .eq('app_id', appId)
    .eq('status', 'active')

  if (error || !data) return []

  const summaries: ActiveCampaignSummary[] = []
  for (const campaign of data) {
    const creatives = (campaign as Record<string, unknown>).ad_slot_creatives as
      | { slot_key: string }[]
      | undefined
    if (!creatives) continue
    const seen = new Set<string>()
    for (const c of creatives) {
      if (seen.has(c.slot_key)) continue
      seen.add(c.slot_key)
      summaries.push({
        id: campaign.id,
        name: campaign.name,
        slot_id: c.slot_key,
      })
    }
  }

  return summaries
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "fetchActiveCampaignsPerSlot" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/queries.ts packages/ad-engine-admin/src/__tests__/queries.test.ts && git commit -m "feat(ad-admin): add fetchActiveCampaignsPerSlot query"
```

---

### Task 4: Expand fetchAdConfigs SELECT to include new fields

**Files:**
- Modify: `packages/ad-engine-admin/src/queries.ts`
- Test: `packages/ad-engine-admin/src/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing test for expanded fetchAdConfigs**

Update the existing `fetchAdConfigs` test in `packages/ad-engine-admin/src/__tests__/queries.test.ts` to assert new fields:

```typescript
it('includes brand_color, logo_url, type, priority in returned configs', async () => {
  const mockCampaign = {
    id: 'c-1',
    name: 'Test',
    advertiser: null,
    format: 'native',
    status: 'active',
    active: true,
    schedule_start: null,
    schedule_end: null,
    pricing_model: 'house_free',
    pricing_value: 0,
    audience: ['all'],
    created_at: '2026-01-01',
    brand_color: '#FF5733',
    logo_url: 'https://example.com/logo.png',
    type: 'cpa',
    priority: 50,
    ad_slot_creatives: [{ slot_key: 'banner_top' }],
  }

  let callCount = 0
  const chain = makeChain({
    data: callCount === 0 ? [mockCampaign] : undefined,
    count: 1,
    error: null,
  })
  const supabase = makeSupabase(() => {
    callCount++
    if (callCount === 1)
      return makeChain({ data: [mockCampaign], count: 1, error: null })
    return makeChain({ data: undefined, count: 1, error: null })
  })
  const result = await fetchAdConfigs(supabase, 'app-1')

  expect(result.configs[0].brand_color).toBe('#FF5733')
  expect(result.configs[0].logo_url).toBe('https://example.com/logo.png')
  expect(result.configs[0].type).toBe('cpa')
  expect(result.configs[0].priority).toBe(50)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "includes brand_color" 2>&1 | tail -20
```

Expected: FAIL — new fields not in SELECT, so not returned.

- [ ] **Step 3: Expand fetchAdConfigs SELECT string**

In `packages/ad-engine-admin/src/queries.ts`, find the `fetchAdConfigs` function. Update its `.select()` call to include the new columns:

```typescript
// Before (approximate):
.select('*, ad_slot_creatives(slot_key)', { count: 'exact' })

// After:
.select('*, ad_slot_creatives(slot_key)', { count: 'exact' })
```

The `*` in the select already includes all columns from `ad_campaigns`, so `brand_color`, `logo_url`, `type`, `priority` are already returned by the query. The issue is in the mapping function that constructs `AdCampaignRow` — it must preserve these fields. Find the mapping logic and ensure these fields are passed through:

```typescript
brand_color: (row as Record<string, unknown>).brand_color as string ?? '#6B7280',
logo_url: (row as Record<string, unknown>).logo_url as string | null ?? null,
type: (row as Record<string, unknown>).type as string ?? 'house',
priority: (row as Record<string, unknown>).priority as number ?? 10,
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "includes brand_color" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/queries.ts packages/ad-engine-admin/src/__tests__/queries.test.ts && git commit -m "feat(ad-admin): expand fetchAdConfigs to return brand_color, logo_url, type, priority"
```

---

### Task 5: Extend schemas with new fields and validation helper

**Files:**
- Modify: `packages/ad-engine-admin/src/schemas.ts`
- Test: `packages/ad-engine-admin/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing tests for new schema fields**

Add to `packages/ad-engine-admin/src/__tests__/schemas.test.ts`:

```typescript
describe('slotCreativeSchema — locale and interaction', () => {
  it('defaults locale to pt-BR', () => {
    const result = slotCreativeSchema.parse({
      slotKey: 'banner_top',
      title: 'Test Title',
      ctaText: 'Click',
      ctaUrl: 'https://example.com',
      dismissSeconds: 5,
    })
    expect(result.locale).toBe('pt-BR')
    expect(result.interaction).toBe('link')
  })

  it('accepts explicit locale and interaction', () => {
    const result = slotCreativeSchema.parse({
      slotKey: 'banner_top',
      title: 'Test Title',
      ctaText: 'Click',
      ctaUrl: 'https://example.com',
      dismissSeconds: 5,
      locale: 'en',
      interaction: 'form',
    })
    expect(result.locale).toBe('en')
    expect(result.interaction).toBe('form')
  })

  it('rejects invalid interaction value', () => {
    const result = slotCreativeSchema.safeParse({
      slotKey: 'banner_top',
      title: 'Test Title',
      ctaText: 'Click',
      ctaUrl: 'https://example.com',
      dismissSeconds: 5,
      interaction: 'popup',
    })
    expect(result.success).toBe(false)
  })
})

describe('campaignFormSchema — new fields', () => {
  const validBase = {
    name: 'Campaign Name',
    format: 'native',
    selectedSlots: ['banner_top'],
    audience: ['all'],
    schedule: { start: '2026-01-01' },
    pricing: { model: 'house_free', value: 0 },
    creatives: {
      'banner_top:pt-BR': {
        slotKey: 'banner_top',
        title: 'Test Title',
        ctaText: 'Click',
        ctaUrl: 'https://example.com',
        dismissSeconds: 5,
        locale: 'pt-BR',
        interaction: 'link',
      },
    },
  }

  it('defaults type to house', () => {
    const result = campaignFormSchema.parse(validBase)
    expect(result.type).toBe('house')
  })

  it('defaults brandColor to #6B7280', () => {
    const result = campaignFormSchema.parse(validBase)
    expect(result.brandColor).toBe('#6B7280')
  })

  it('accepts draft status', () => {
    const result = campaignFormSchema.parse({ ...validBase, status: 'draft' })
    expect(result.status).toBe('draft')
  })

  it('defaults status to draft', () => {
    const result = campaignFormSchema.parse(validBase)
    expect(result.status).toBe('draft')
  })

  it('allows creatives to be omitted for drafts', () => {
    const { creatives, ...noCr } = validBase
    const result = campaignFormSchema.parse({ ...noCr, status: 'draft' })
    expect(result.creatives).toBeUndefined()
  })

  it('accepts logoUrl as valid URL or null', () => {
    const result = campaignFormSchema.parse({
      ...validBase,
      logoUrl: 'https://example.com/logo.png',
    })
    expect(result.logoUrl).toBe('https://example.com/logo.png')
  })

  it('accepts nullish logoUrl', () => {
    const result = campaignFormSchema.parse({ ...validBase, logoUrl: null })
    expect(result.logoUrl).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/schemas.test.ts 2>&1 | tail -30
```

Expected: FAIL — `locale`, `interaction`, `type`, `brandColor`, `logoUrl` fields not in schemas.

- [ ] **Step 3: Update slotCreativeSchema**

In `packages/ad-engine-admin/src/schemas.ts`, add two fields to `slotCreativeSchema`:

```typescript
export const slotCreativeSchema = z.object({
  slotKey: z.string().min(1),
  title: z.string().min(3).max(60),
  body: z.string().max(120).optional().default(''),
  ctaText: z.string().min(2).max(25),
  ctaUrl: z.string().min(1),
  imageUrl: z.string().url().optional(),
  dismissSeconds: z.coerce.number().int().min(0).max(30),
  locale: z.string().default('pt-BR'),
  interaction: z.enum(['link', 'form']).default('link'),
})
```

- [ ] **Step 4: Update campaignFormSchema**

In `packages/ad-engine-admin/src/schemas.ts`, update `campaignFormSchema`:

```typescript
export const campaignFormSchema = z.object({
  name: z.string().min(3).max(100),
  advertiser: z.string().max(100).optional().default(''),
  format: z.enum(['image', 'video', 'native', 'house']),
  type: z.enum(['house', 'cpa']).default('house'),
  brandColor: z.string().default('#6B7280'),
  logoUrl: z.string().url().nullish(),
  selectedSlots: z.array(z.string()).min(1),
  audience: z.array(z.string()).min(1),
  limits: limitsSchema,
  schedule: scheduleSchema,
  pricing: pricingSchema,
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),
  priority: z.coerce.number().int().min(1).max(100).default(10),
  creatives: z.record(z.string(), slotCreativeSchema).optional(),
})
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/schemas.test.ts 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 6: Fix any existing tests broken by schema changes**

The `status` default changed from `'active'` to `'draft'`. The `creatives` field is now optional. Check existing tests in `schemas.test.ts` that rely on the old defaults and update assertions.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/schemas.ts packages/ad-engine-admin/src/__tests__/schemas.test.ts && git commit -m "feat(ad-admin): add locale, interaction, type, brandColor, logoUrl, draft status to schemas"
```

---

### Task 6: Add validateCreativesForActivation helper

**Files:**
- Modify: `packages/ad-engine-admin/src/schemas.ts`
- Test: `packages/ad-engine-admin/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing tests for validateCreativesForActivation**

Add to `packages/ad-engine-admin/src/__tests__/schemas.test.ts`:

```typescript
import { validateCreativesForActivation } from '../schemas'

describe('validateCreativesForActivation', () => {
  it('returns empty errors for valid creatives', () => {
    const creatives = {
      'banner_top:pt-BR': {
        slotKey: 'banner_top',
        title: 'Valid Title',
        body: '',
        ctaText: 'Click Me',
        ctaUrl: 'https://example.com',
        imageUrl: undefined,
        dismissSeconds: 5,
        locale: 'pt-BR',
        interaction: 'link' as const,
      },
    }
    const errors = validateCreativesForActivation(creatives, ['banner_top'], 'pt-BR')
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('reports missing creative for required slot', () => {
    const errors = validateCreativesForActivation({}, ['banner_top'], 'pt-BR')
    expect(errors['banner_top:pt-BR']).toBeDefined()
    expect(errors['banner_top:pt-BR']).toContain('banner_top')
  })

  it('reports title too short', () => {
    const creatives = {
      'banner_top:pt-BR': {
        slotKey: 'banner_top',
        title: 'AB',
        body: '',
        ctaText: 'Click',
        ctaUrl: 'https://example.com',
        imageUrl: undefined,
        dismissSeconds: 5,
        locale: 'pt-BR',
        interaction: 'link' as const,
      },
    }
    const errors = validateCreativesForActivation(creatives, ['banner_top'], 'pt-BR')
    expect(errors['banner_top:pt-BR']).toBeDefined()
  })

  it('reports missing ctaUrl', () => {
    const creatives = {
      'banner_top:pt-BR': {
        slotKey: 'banner_top',
        title: 'Valid Title',
        body: '',
        ctaText: 'Click',
        ctaUrl: '',
        imageUrl: undefined,
        dismissSeconds: 5,
        locale: 'pt-BR',
        interaction: 'link' as const,
      },
    }
    const errors = validateCreativesForActivation(creatives, ['banner_top'], 'pt-BR')
    expect(errors['banner_top:pt-BR']).toBeDefined()
  })

  it('only validates default locale', () => {
    const creatives = {
      'banner_top:pt-BR': {
        slotKey: 'banner_top',
        title: 'Valid Title',
        body: '',
        ctaText: 'Click',
        ctaUrl: 'https://example.com',
        imageUrl: undefined,
        dismissSeconds: 5,
        locale: 'pt-BR',
        interaction: 'link' as const,
      },
    }
    const errors = validateCreativesForActivation(
      creatives,
      ['banner_top'],
      'pt-BR',
    )
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('validates multiple slots', () => {
    const errors = validateCreativesForActivation(
      {},
      ['banner_top', 'rail_left'],
      'pt-BR',
    )
    expect(errors['banner_top:pt-BR']).toBeDefined()
    expect(errors['rail_left:pt-BR']).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/schemas.test.ts -t "validateCreativesForActivation" 2>&1 | tail -20
```

Expected: FAIL — `validateCreativesForActivation` not exported.

- [ ] **Step 3: Implement validateCreativesForActivation**

Add to `packages/ad-engine-admin/src/schemas.ts`:

```typescript
export type SlotCreativeData = z.infer<typeof slotCreativeSchema>

export function validateCreativesForActivation(
  creatives: Record<string, SlotCreativeData>,
  selectedSlots: string[],
  defaultLocale: string,
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const slot of selectedSlots) {
    const key = `${slot}:${defaultLocale}`
    const creative = creatives[key]

    if (!creative) {
      errors[key] = `Criativo obrigatório para ${slot} (${defaultLocale})`
      continue
    }

    if (!creative.title || creative.title.length < 3) {
      errors[key] = `Título deve ter pelo menos 3 caracteres`
      continue
    }

    if (!creative.ctaText || creative.ctaText.length < 2) {
      errors[key] = `Texto do CTA deve ter pelo menos 2 caracteres`
      continue
    }

    if (!creative.ctaUrl) {
      errors[key] = `URL do CTA é obrigatória`
    }
  }

  return errors
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/schemas.test.ts -t "validateCreativesForActivation" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/schemas.ts packages/ad-engine-admin/src/__tests__/schemas.test.ts && git commit -m "feat(ad-admin): add validateCreativesForActivation helper"
```

---

### Task 7: Extend AdAdminConfig and AdAdminActions types

**Files:**
- Modify: `packages/ad-engine-admin/src/types.ts`
- Test: `packages/ad-engine-admin/src/__tests__/queries.test.ts` (type-level assertion)

- [ ] **Step 1: Write type-level test**

Add to `packages/ad-engine-admin/src/__tests__/queries.test.ts`:

```typescript
import type { AdAdminConfig, AdAdminActions } from '../types'
import type { AdCampaignDetail } from '../queries'

describe('AdAdminConfig and AdAdminActions extensions', () => {
  it('AdAdminConfig accepts supportedLocales', () => {
    const config: AdAdminConfig = {
      appId: 'app-1',
      slots: [],
      basePath: '/admin/ads',
      supportedLocales: ['pt-BR', 'en'],
    }
    expect(config.supportedLocales).toEqual(['pt-BR', 'en'])
  })

  it('AdAdminConfig defaults supportedLocales to undefined', () => {
    const config: AdAdminConfig = {
      appId: 'app-1',
      slots: [],
      basePath: '/admin/ads',
    }
    expect(config.supportedLocales).toBeUndefined()
  })

  it('AdAdminActions accepts optional updateCampaignStatus', () => {
    const actions: AdAdminActions = {
      createCampaign: async () => {},
      updateCampaign: async () => {},
      deleteCampaign: async () => {},
      updatePlaceholder: async () => {},
      uploadMedia: async () => ({ id: '1', url: '' }),
      deleteMedia: async () => {},
      updateCampaignStatus: async () => {},
    }
    expect(actions.updateCampaignStatus).toBeDefined()
  })

  it('AdAdminActions accepts optional fetchCampaignById', () => {
    const actions: AdAdminActions = {
      createCampaign: async () => {},
      updateCampaign: async () => {},
      deleteCampaign: async () => {},
      updatePlaceholder: async () => {},
      uploadMedia: async () => ({ id: '1', url: '' }),
      deleteMedia: async () => {},
      fetchCampaignById: async (): Promise<AdCampaignDetail | null> => null,
    }
    expect(actions.fetchCampaignById).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "AdAdminConfig and AdAdminActions" 2>&1 | tail -20
```

Expected: FAIL — `supportedLocales`, `updateCampaignStatus`, `fetchCampaignById` not in types.

- [ ] **Step 3: Update types.ts**

In `packages/ad-engine-admin/src/types.ts`:

Add import at top:
```typescript
import type { AdCampaignDetail } from './queries'
```

Add to `AdAdminConfig` interface:
```typescript
supportedLocales?: string[]
```

Add to `AdAdminActions` interface:
```typescript
updateCampaignStatus?(id: string, status: string): Promise<void>
fetchCampaignById?(id: string): Promise<AdCampaignDetail | null>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/queries.test.ts -t "AdAdminConfig and AdAdminActions" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/types.ts packages/ad-engine-admin/src/__tests__/queries.test.ts && git commit -m "feat(ad-admin): extend AdAdminConfig with supportedLocales, AdAdminActions with status/fetch"
```

---

### Task 8: Update index.ts exports and createAdminQueries factory

**Files:**
- Modify: `packages/ad-engine-admin/src/index.ts`

- [ ] **Step 1: Add new exports to index.ts**

In `packages/ad-engine-admin/src/index.ts`, add the new type and function exports:

```typescript
// Add to the queries re-exports:
export type { AdSlotCreativeRow, AdCampaignDetail, ActiveCampaignSummary } from './queries'
export { fetchAdCampaignById, fetchActiveCampaignsPerSlot } from './queries'

// Add to the schemas re-exports:
export { validateCreativesForActivation } from './schemas'
```

- [ ] **Step 2: Expand createAdminQueries factory**

In `packages/ad-engine-admin/src/index.ts`, find the `createAdminQueries` function and add two new methods:

```typescript
import { fetchAdCampaignById, fetchActiveCampaignsPerSlot } from './queries'

// Inside createAdminQueries return object:
fetchAdCampaignById: (campaignId: string) =>
  fetchAdCampaignById(supabase, appId, campaignId),
fetchActiveCampaignsPerSlot: () =>
  fetchActiveCampaignsPerSlot(supabase, appId),
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 4: Build to verify no compile errors**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx tsup --config packages/ad-engine-admin/tsup.config.ts 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/index.ts && git commit -m "feat(ad-admin): export new types, queries, and validation; extend createAdminQueries factory"
```

---

### Task 9: Update step2RequiredFields for composite keys

**Files:**
- Modify: `packages/ad-engine-admin/src/schemas.ts`
- Test: `packages/ad-engine-admin/src/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing test for composite key step2RequiredFields**

Add to `packages/ad-engine-admin/src/__tests__/schemas.test.ts`:

```typescript
describe('step2RequiredFields with composite keys', () => {
  it('generates composite keys with locale', () => {
    const fields = step2RequiredFields(['banner_top', 'rail_left'], ['pt-BR', 'en'])
    expect(fields).toContain('creatives.banner_top:pt-BR.title')
    expect(fields).toContain('creatives.banner_top:pt-BR.ctaText')
    expect(fields).toContain('creatives.banner_top:en.title')
    expect(fields).toContain('creatives.rail_left:pt-BR.title')
    expect(fields).toHaveLength(8)
  })

  it('backward compat: single-arg form uses default locale', () => {
    const fields = step2RequiredFields(['banner_top'])
    expect(fields).toContain('creatives.banner_top.title')
    expect(fields).toContain('creatives.banner_top.ctaText')
    expect(fields).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/schemas.test.ts -t "step2RequiredFields with composite" 2>&1 | tail -20
```

Expected: FAIL — `step2RequiredFields` doesn't accept locale array.

- [ ] **Step 3: Update step2RequiredFields signature**

In `packages/ad-engine-admin/src/schemas.ts`, update `step2RequiredFields`:

```typescript
export function step2RequiredFields(
  slotKeys: string[],
  locales?: string[],
): string[] {
  if (!locales || locales.length === 0) {
    return slotKeys.flatMap((k) => [
      `creatives.${k}.title`,
      `creatives.${k}.ctaText`,
    ])
  }
  return slotKeys.flatMap((k) =>
    locales.flatMap((l) => [
      `creatives.${k}:${l}.title`,
      `creatives.${k}:${l}.ctaText`,
    ]),
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/schemas.test.ts -t "step2RequiredFields with composite" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/schemas.ts packages/ad-engine-admin/src/__tests__/schemas.test.ts && git commit -m "feat(ad-admin): step2RequiredFields supports composite locale keys"
```

---

## Session 2: CampaignList + Delete + Status Toggle

**Files:**
- Create: `packages/ad-engine-admin/src/client/CampaignList.tsx`
- Modify: `packages/ad-engine-admin/src/server/CampaignWizardServer.tsx`
- Modify: `packages/ad-engine-admin/src/client/index.ts`
- Create: `packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx`

---

### Task 10: Create CampaignList client component — basic rendering

**Files:**
- Create: `packages/ad-engine-admin/src/client/CampaignList.tsx`
- Create: `packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx`

- [ ] **Step 1: Write failing test for basic campaign list rendering**

Create `packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampaignList } from '../client/CampaignList'
import type { AdCampaignRow } from '../queries'

function makeCampaign(overrides: Partial<AdCampaignRow> = {}): AdCampaignRow {
  return {
    id: 'c-1',
    name: 'Test Campaign',
    advertiser: null,
    format: 'native',
    status: 'active',
    active: true,
    slot_id: 'banner_top',
    slots: ['banner_top'],
    schedule_start: null,
    schedule_end: null,
    pricing_model: 'house_free',
    pricing_value: 0,
    audience: ['all'],
    created_at: '2026-01-01',
    brand_color: '#6B7280',
    logo_url: null,
    type: 'house',
    priority: 10,
    ...overrides,
  }
}

const noop = async () => {}

describe('CampaignList', () => {
  it('renders campaign rows', () => {
    const campaigns = [
      makeCampaign({ id: 'c-1', name: 'Campaign Alpha' }),
      makeCampaign({ id: 'c-2', name: 'Campaign Beta' }),
    ]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 2, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    expect(screen.getByText('Campaign Alpha')).toBeDefined()
    expect(screen.getByText('Campaign Beta')).toBeDefined()
  })

  it('shows empty state when no campaigns', () => {
    render(
      <CampaignList
        campaigns={[]}
        pagination={{ total: 0, totalPages: 0, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    expect(screen.getByText(/nenhuma campanha/i)).toBeDefined()
  })

  it('shows status badges', () => {
    const campaigns = [
      makeCampaign({ id: 'c-1', name: 'Active One', status: 'active' }),
      makeCampaign({ id: 'c-2', name: 'Paused One', status: 'paused' }),
      makeCampaign({ id: 'c-3', name: 'Draft One', status: 'draft' }),
    ]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 3, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    expect(screen.getByText('active')).toBeDefined()
    expect(screen.getByText('paused')).toBeDefined()
    expect(screen.getByText('draft')).toBeDefined()
  })

  it('renders "Nova campanha" button', () => {
    render(
      <CampaignList
        campaigns={[]}
        pagination={{ total: 0, totalPages: 0, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    expect(screen.getByRole('button', { name: /nova campanha/i })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module `../client/CampaignList` not found.

- [ ] **Step 3: Implement CampaignList basic rendering**

Create `packages/ad-engine-admin/src/client/CampaignList.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { AdCampaignRow, AdCampaignDetail } from '../queries'
import { CampaignFormModal } from './CampaignFormModal'
import { useAdEngineAdmin } from '../provider'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  draft: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
}

export interface CampaignListProps {
  campaigns: AdCampaignRow[]
  pagination: { total: number; totalPages: number; currentPage: number }
  deleteCampaignAction: (id: string) => Promise<void>
  updateCampaignStatusAction?: (id: string, status: string) => Promise<void>
  fetchCampaignByIdAction?: (id: string) => Promise<AdCampaignDetail | null>
}

export function CampaignList({
  campaigns,
  pagination,
  deleteCampaignAction,
  updateCampaignStatusAction,
  fetchCampaignByIdAction,
}: CampaignListProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<AdCampaignDetail | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleRowClick(campaign: AdCampaignRow) {
    if (!fetchCampaignByIdAction) return
    setLoadingId(campaign.id)
    try {
      const detail = await fetchCampaignByIdAction(campaign.id)
      if (detail) {
        setEditingCampaign(detail)
        setModalOpen(true)
      }
    } finally {
      setLoadingId(null)
    }
  }

  async function handleStatusToggle(campaign: AdCampaignRow) {
    if (!updateCampaignStatusAction) return
    const nextStatus = campaign.status === 'active' ? 'paused' : 'active'
    startTransition(async () => {
      await updateCampaignStatusAction(campaign.id, nextStatus)
    })
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteCampaignAction(id)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  function handleNewCampaign() {
    setEditingCampaign(null)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setEditingCampaign(null)
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {pagination.total} campanha{pagination.total !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={handleNewCampaign}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Nova campanha
        </button>
      </div>

      {campaigns.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Nenhuma campanha encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">Nome</th>
                <th className="py-2 pr-4 font-medium">Formato</th>
                <th className="py-2 pr-4 font-medium">Slots</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Período</th>
                <th className="py-2 pr-4 font-medium">Criada</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b transition-colors ${
                    loadingId === c.id
                      ? 'bg-indigo-50'
                      : deletingId === c.id
                        ? 'opacity-50'
                        : fetchCampaignByIdAction
                          ? 'cursor-pointer hover:bg-gray-50'
                          : ''
                  }`}
                  onClick={() => handleRowClick(c)}
                >
                  <td className="py-3 pr-4 font-medium">{c.name}</td>
                  <td className="py-3 pr-4 capitalize">{c.format}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {c.slots.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {(c.status === 'active' || c.status === 'paused') &&
                    updateCampaignStatusAction ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusToggle(c)
                        }}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'
                        } ${isPending ? 'animate-pulse' : ''}`}
                      >
                        {c.status}
                      </button>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {c.schedule_start || c.schedule_end
                      ? `${formatDate(c.schedule_start)} — ${formatDate(c.schedule_end)}`
                      : 'Sempre'}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="py-3">
                    {confirmDeleteId === c.id ? (
                      <div
                        className="flex items-center gap-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Excluir &ldquo;{c.name}&rdquo;?</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="font-medium text-red-600 hover:text-red-800"
                        >
                          Excluir
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(c.id)
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Excluir campanha"
                      >
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2 text-sm">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (page) => (
              <a
                key={page}
                href={`?tab=campaigns&page=${page}`}
                className={`rounded px-3 py-1 ${
                  page === pagination.currentPage
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {page}
              </a>
            ),
          )}
        </div>
      )}

      <CampaignFormModal
        key={editingCampaign?.id ?? 'new'}
        open={modalOpen}
        campaign={editingCampaign ?? undefined}
        onClose={handleCloseModal}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/client/CampaignList.tsx packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx && git commit -m "feat(ad-admin): create CampaignList client component with basic CRUD"
```

---

### Task 11: CampaignList — delete, status toggle, and row click tests

**Files:**
- Modify: `packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx`

- [ ] **Step 1: Add interaction tests**

Add to `packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx`:

```tsx
import { fireEvent, waitFor } from '@testing-library/react'

describe('CampaignList — interactions', () => {
  it('shows delete confirmation on trash click', async () => {
    const campaigns = [makeCampaign({ id: 'c-1', name: 'Delete Me' })]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 1, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    const trashBtn = screen.getByTitle('Excluir campanha')
    fireEvent.click(trashBtn)
    expect(screen.getByText(/Excluir "Delete Me"/)).toBeDefined()
    expect(screen.getByText('Cancelar')).toBeDefined()
    expect(screen.getByText('Excluir')).toBeDefined()
  })

  it('calls deleteCampaignAction on confirm', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined)
    const campaigns = [makeCampaign({ id: 'c-1', name: 'Delete Me' })]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 1, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={deleteFn}
      />,
    )
    fireEvent.click(screen.getByTitle('Excluir campanha'))
    fireEvent.click(screen.getByText('Excluir'))
    await waitFor(() => expect(deleteFn).toHaveBeenCalledWith('c-1'))
  })

  it('hides confirmation on cancel', () => {
    const campaigns = [makeCampaign({ id: 'c-1', name: 'Delete Me' })]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 1, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    fireEvent.click(screen.getByTitle('Excluir campanha'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByText(/Excluir "Delete Me"/)).toBeNull()
  })

  it('renders clickable status badge for active/paused when toggle action provided', () => {
    const toggleFn = vi.fn().mockResolvedValue(undefined)
    const campaigns = [makeCampaign({ id: 'c-1', status: 'active' })]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 1, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={noop}
        updateCampaignStatusAction={toggleFn}
      />,
    )
    const badge = screen.getByText('active')
    expect(badge.tagName).toBe('BUTTON')
  })

  it('renders non-interactive badge for draft status', () => {
    const campaigns = [makeCampaign({ id: 'c-1', status: 'draft' })]
    render(
      <CampaignList
        campaigns={campaigns}
        pagination={{ total: 1, totalPages: 1, currentPage: 1 }}
        deleteCampaignAction={noop}
        updateCampaignStatusAction={vi.fn()}
      />,
    )
    const badge = screen.getByText('draft')
    expect(badge.tagName).toBe('SPAN')
  })

  it('renders pagination links when totalPages > 1', () => {
    render(
      <CampaignList
        campaigns={[makeCampaign()]}
        pagination={{ total: 40, totalPages: 2, currentPage: 1 }}
        deleteCampaignAction={noop}
      />,
    )
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx 2>&1 | tail -30
```

Expected: PASS — these test the component we just built.

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx && git commit -m "test(ad-admin): add CampaignList interaction tests for delete, status toggle, pagination"
```

---

### Task 12: Update CampaignWizardServer to use CampaignList

**Files:**
- Modify: `packages/ad-engine-admin/src/server/CampaignWizardServer.tsx`

- [ ] **Step 1: Write failing test for updated server component**

The existing `dashboard-server.test.tsx` may test this component. Add or update in `packages/ad-engine-admin/src/__tests__/dashboard-server.test.tsx`:

```tsx
// Test that CampaignWizardServer passes new props through to CampaignList
// This is a structural test — the server component renders CampaignList with forwarded props
```

Since CampaignWizardServer is a server component and CampaignList is a client component, the integration is structural. The key test is: does it compile and render without errors? The CampaignList tests already cover the client logic.

- [ ] **Step 2: Rewrite CampaignWizardServer**

Replace `packages/ad-engine-admin/src/server/CampaignWizardServer.tsx` with:

```tsx
import type { AdCampaignRow, AdCampaignDetail } from '../queries'
import type { AdAdminConfig } from '../types'
import { CampaignList } from '../client/CampaignList'

export interface CampaignWizardServerProps {
  campaigns: AdCampaignRow[]
  config: AdAdminConfig
  pagination?: { total: number; totalPages: number; currentPage: number }
  deleteCampaignAction?: (id: string) => Promise<void>
  updateCampaignStatusAction?: (id: string, status: string) => Promise<void>
  fetchCampaignByIdAction?: (id: string) => Promise<AdCampaignDetail | null>
}

export function CampaignWizardServer({
  campaigns,
  config,
  pagination,
  deleteCampaignAction,
  updateCampaignStatusAction,
  fetchCampaignByIdAction,
}: CampaignWizardServerProps) {
  const defaultPagination = pagination ?? {
    total: campaigns.length,
    totalPages: 1,
    currentPage: 1,
  }

  const defaultDelete = deleteCampaignAction ?? (async () => {})

  return (
    <CampaignList
      campaigns={campaigns}
      pagination={defaultPagination}
      deleteCampaignAction={defaultDelete}
      updateCampaignStatusAction={updateCampaignStatusAction}
      fetchCampaignByIdAction={fetchCampaignByIdAction}
    />
  )
}
```

- [ ] **Step 3: Add CampaignList to client barrel export**

In `packages/ad-engine-admin/src/client/index.ts`, add:

```typescript
export { CampaignList } from './CampaignList'
```

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass. Fix any broken dashboard-server tests that reference the old CampaignWizardServer structure.

- [ ] **Step 5: Build to verify**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx tsup --config packages/ad-engine-admin/tsup.config.ts 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/server/CampaignWizardServer.tsx packages/ad-engine-admin/src/client/index.ts packages/ad-engine-admin/src/client/CampaignList.tsx && git commit -m "feat(ad-admin): CampaignWizardServer delegates to CampaignList, export CampaignList"
```

---

## Session 3: CampaignFormModal Multi-Step Wizard

**Files:**
- Modify: `packages/ad-engine-admin/src/client/CampaignFormModal.tsx`
- Modify: `packages/ad-engine-admin/src/__tests__/campaign-list.test.tsx` (or new test file)

---

### Task 13: CampaignFormModal — Step 1 Metadata Form with new fields

**Files:**
- Modify: `packages/ad-engine-admin/src/client/CampaignFormModal.tsx`

- [ ] **Step 1: Write failing tests for Step 1 new fields**

Add test in `packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx` (new file or extend existing):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampaignFormModal } from '../client/CampaignFormModal'
import { AdEngineAdminProvider } from '../provider'
import type { AdAdminConfig, AdAdminActions } from '../types'

function renderModal(props?: { campaign?: any }) {
  const config: AdAdminConfig = {
    appId: 'app-1',
    slots: [
      { key: 'banner_top', label: 'Banner Topo', desc: '', badge: '', badgeColor: '' },
      { key: 'rail_left', label: 'Rail Esquerda', desc: '', badge: '', badgeColor: '' },
    ],
    basePath: '/admin/ads',
    supportedLocales: ['pt-BR', 'en'],
  }
  const actions: AdAdminActions = {
    createCampaign: vi.fn().mockResolvedValue(undefined),
    updateCampaign: vi.fn().mockResolvedValue(undefined),
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
    updatePlaceholder: vi.fn().mockResolvedValue(undefined),
    uploadMedia: vi.fn().mockResolvedValue({ id: '1', url: '' }),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
  }
  return render(
    <AdEngineAdminProvider config={config} actions={actions}>
      <CampaignFormModal
        open={true}
        onClose={vi.fn()}
        campaign={props?.campaign}
      />
    </AdEngineAdminProvider>,
  )
}

describe('CampaignFormModal — Step 1', () => {
  it('renders type selector (house/cpa)', () => {
    renderModal()
    expect(screen.getByLabelText(/tipo/i)).toBeDefined()
  })

  it('renders brand color input', () => {
    renderModal()
    expect(screen.getByLabelText(/cor da marca/i)).toBeDefined()
  })

  it('renders status selector with draft option', () => {
    renderModal()
    const select = screen.getByLabelText(/status/i)
    expect(select).toBeDefined()
  })

  it('renders priority input', () => {
    renderModal()
    expect(screen.getByLabelText(/prioridade/i)).toBeDefined()
  })

  it('renders step indicator showing step 1 of 2', () => {
    renderModal()
    expect(screen.getByText(/1.*2/)).toBeDefined()
  })

  it('has "Próximo: Criativos" button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /próximo.*criativo/i })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx 2>&1 | tail -20
```

Expected: FAIL — current modal doesn't have type/brand color/draft status/priority/step indicator.

- [ ] **Step 3: Rewrite CampaignFormModal as 2-step wizard**

Replace `packages/ad-engine-admin/src/client/CampaignFormModal.tsx` with the full wizard implementation. This is a large file (~500 lines). The key structural changes:

```tsx
'use client'

import { useState, useCallback } from 'react'
import type { AdCampaignRow, AdCampaignDetail, AdSlotCreativeRow } from '../queries'
import type { SlotCreativeData } from '../schemas'
import { campaignFormSchema, validateCreativesForActivation } from '../schemas'
import { AudienceSelector } from './AudienceSelector'
import { useAdEngineAdmin } from '../provider'

const AD_FORMATS = ['image', 'video', 'native', 'house'] as const
const AD_TYPES = ['house', 'cpa'] as const
const STATUSES = ['draft', 'active', 'paused', 'archived'] as const

interface CampaignFormModalProps {
  open: boolean
  onClose: () => void
  campaign?: AdCampaignDetail
}

export function CampaignFormModal({ open, onClose, campaign }: CampaignFormModalProps) {
  const { config, actions } = useAdEngineAdmin()
  const locales = config.supportedLocales ?? ['pt-BR']
  const defaultLocale = locales[0] ?? 'pt-BR'
  const isEdit = !!campaign

  // Step state
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [name, setName] = useState(campaign?.name ?? '')
  const [advertiser, setAdvertiser] = useState(campaign?.advertiser ?? '')
  const [format, setFormat] = useState(campaign?.format ?? 'native')
  const [type, setType] = useState(campaign?.type ?? 'house')
  const [brandColor, setBrandColor] = useState(campaign?.brand_color ?? '#6B7280')
  const [logoUrl, setLogoUrl] = useState(campaign?.logo_url ?? '')
  const [status, setStatus] = useState(campaign?.status ?? 'draft')
  const [priority, setPriority] = useState(campaign?.priority ?? 10)
  const [selectedSlots, setSelectedSlots] = useState<string[]>(campaign?.slots ?? [])
  const [audience, setAudience] = useState<string[]>(campaign?.audience ?? ['all'])
  const [scheduleStart, setScheduleStart] = useState(campaign?.schedule_start ?? '')
  const [scheduleEnd, setScheduleEnd] = useState(campaign?.schedule_end ?? '')
  const [pricingModel, setPricingModel] = useState(campaign?.pricing_model ?? 'house_free')
  const [pricingValue, setPricingValue] = useState(campaign?.pricing_value ?? 0)

  // Step 2 fields
  const [creatives, setCreatives] = useState<Record<string, SlotCreativeData>>(() => {
    if (campaign?.creatives) {
      return creativesFromRows(campaign.creatives, locales)
    }
    return {}
  })
  const [activeLocale, setActiveLocale] = useState(defaultLocale)

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function creativesFromRows(
    rows: AdSlotCreativeRow[],
    locs: string[],
  ): Record<string, SlotCreativeData> {
    const result: Record<string, SlotCreativeData> = {}
    for (const row of rows) {
      const key = `${row.slot_key}:${row.locale}`
      result[key] = {
        slotKey: row.slot_key,
        title: row.title ?? '',
        body: row.body ?? '',
        ctaText: row.cta_text ?? 'Saiba mais',
        ctaUrl: row.cta_url ?? '',
        imageUrl: row.image_url ?? undefined,
        dismissSeconds: row.dismiss_seconds,
        locale: row.locale,
        interaction: (row.interaction as 'link' | 'form') ?? 'link',
      }
    }
    return result
  }

  function buildEmptyCreatives(
    slots: string[],
    locs: string[],
  ): Record<string, SlotCreativeData> {
    const result: Record<string, SlotCreativeData> = {}
    for (const slot of slots) {
      for (const locale of locs) {
        const key = `${slot}:${locale}`
        if (!result[key]) {
          result[key] = {
            slotKey: slot,
            title: '',
            body: '',
            ctaText: 'Saiba mais',
            ctaUrl: '',
            dismissSeconds: 5,
            locale,
            interaction: 'link',
          }
        }
      }
    }
    return result
  }

  function reconcileCreatives() {
    const updated = { ...creatives }
    for (const slot of selectedSlots) {
      for (const locale of locales) {
        const key = `${slot}:${locale}`
        if (!updated[key]) {
          updated[key] = {
            slotKey: slot,
            title: '',
            body: '',
            ctaText: 'Saiba mais',
            ctaUrl: '',
            dismissSeconds: 5,
            locale,
            interaction: 'link',
          }
        }
      }
    }
    const selectedSet = new Set(selectedSlots)
    for (const key of Object.keys(updated)) {
      const slotKey = key.split(':')[0]
      if (!selectedSet.has(slotKey)) {
        delete updated[key]
      }
    }
    setCreatives(updated)
  }

  function goToStep2() {
    if (selectedSlots.length === 0) {
      setErrors({ selectedSlots: 'Selecione pelo menos um slot' })
      return
    }
    if (!name || name.length < 3) {
      setErrors({ name: 'Nome deve ter pelo menos 3 caracteres' })
      return
    }
    setErrors({})
    reconcileCreatives()
    setStep(2)
  }

  function updateCreative(key: string, field: keyof SlotCreativeData, value: unknown) {
    setCreatives((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  function copyFromDefault(targetLocale: string) {
    const updated = { ...creatives }
    for (const slot of selectedSlots) {
      const srcKey = `${slot}:${defaultLocale}`
      const dstKey = `${slot}:${targetLocale}`
      const src = updated[srcKey]
      if (src && updated[dstKey]) {
        updated[dstKey] = { ...src, locale: targetLocale }
      }
    }
    setCreatives(updated)
  }

  async function handleSave(targetStatus?: string) {
    const finalStatus = targetStatus ?? status
    setSaving(true)
    setErrors({})

    try {
      if (finalStatus !== 'draft' && Object.keys(creatives).length > 0) {
        const activationErrors = validateCreativesForActivation(
          creatives,
          selectedSlots,
          defaultLocale,
        )
        if (Object.keys(activationErrors).length > 0) {
          setErrors(activationErrors)
          setSaving(false)
          return
        }
      }

      const formData = {
        name,
        advertiser: advertiser || undefined,
        format,
        type,
        brandColor,
        logoUrl: logoUrl || null,
        selectedSlots,
        audience,
        limits: {
          impressions: { enabled: false, value: 0 },
          clicks: { enabled: false, value: 0 },
          freqCap: { enabled: false, value: 0 },
          minCtr: { enabled: false, value: 0 },
        },
        schedule: {
          start: scheduleStart || undefined,
          end: scheduleEnd || undefined,
        },
        pricing: { model: pricingModel, value: pricingValue },
        status: finalStatus,
        priority,
        creatives: Object.keys(creatives).length > 0 ? creatives : undefined,
      }

      const parsed = campaignFormSchema.safeParse(formData)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          fieldErrors[issue.path.join('.')] = issue.message
        }
        setErrors(fieldErrors)
        setSaving(false)
        return
      }

      if (isEdit && campaign) {
        await actions.updateCampaign(campaign.id, parsed.data)
      } else {
        await actions.createCampaign(parsed.data)
      }

      onClose()
    } catch (err) {
      setErrors({ _form: 'Erro ao salvar campanha' })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const slotsForLocale = selectedSlots.map((slot) => `${slot}:${activeLocale}`)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span className={step === 1 ? 'font-bold text-indigo-600' : ''}>1 Dados</span>
          <span>→</span>
          <span className={step === 2 ? 'font-bold text-indigo-600' : ''}>2 Criativos</span>
        </div>

        <h2 className="mb-4 text-lg font-semibold">
          {isEdit ? 'Editar campanha' : 'Nova campanha'}
        </h2>

        {errors._form && (
          <p className="mb-3 text-sm text-red-600">{errors._form}</p>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {/* Row 1: Name + Advertiser */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-name" className="block text-sm font-medium">
                  Nome
                </label>
                <input
                  id="cf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="cf-advertiser" className="block text-sm font-medium">
                  Anunciante
                </label>
                <input
                  id="cf-advertiser"
                  value={advertiser}
                  onChange={(e) => setAdvertiser(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </div>
            </div>

            {/* Row 2: Format + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-format" className="block text-sm font-medium">
                  Formato
                </label>
                <select
                  id="cf-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                >
                  {AD_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cf-type" className="block text-sm font-medium">
                  Tipo
                </label>
                <select
                  id="cf-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                >
                  {AD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === 'house' ? 'Da casa' : 'CPA'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Brand Color + Logo URL */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-brand-color" className="block text-sm font-medium">
                  Cor da marca
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    id="cf-brand-color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border"
                  />
                  <input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-full rounded border p-2 text-sm font-mono"
                    placeholder="#6B7280"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cf-logo-url" className="block text-sm font-medium">
                  Logo URL
                </label>
                <input
                  id="cf-logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Row 4: Status + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-status" className="block text-sm font-medium">
                  Status
                </label>
                <select
                  id="cf-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cf-priority" className="block text-sm font-medium">
                  Prioridade
                </label>
                <input
                  id="cf-priority"
                  type="number"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </div>
            </div>

            {/* Row 5: Slot chips */}
            <div>
              <span className="block text-sm font-medium">Slots</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {config.slots.map((slot) => {
                  const active = selectedSlots.includes(slot.key)
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() =>
                        setSelectedSlots((prev) =>
                          active
                            ? prev.filter((s) => s !== slot.key)
                            : [...prev, slot.key],
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
              {errors.selectedSlots && (
                <p className="text-xs text-red-500">{errors.selectedSlots}</p>
              )}
            </div>

            {/* Row 6: Audience */}
            <div>
              <span className="block text-sm font-medium">Audiência</span>
              <AudienceSelector value={audience} onChange={setAudience} />
            </div>

            {/* Row 7: Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-start" className="block text-sm font-medium">
                  Início
                </label>
                <input
                  id="cf-start"
                  type="date"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cf-end" className="block text-sm font-medium">
                  Fim
                </label>
                <input
                  id="cf-end"
                  type="date"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </div>
            </div>

            {/* Row 8: Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="cf-pricing" className="block text-sm font-medium">
                  Modelo de preço
                </label>
                <select
                  id="cf-pricing"
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value)}
                  className="mt-1 w-full rounded border p-2 text-sm"
                >
                  <option value="cpm">CPM</option>
                  <option value="cpc">CPC</option>
                  <option value="flat">Flat</option>
                  <option value="house_free">Da casa</option>
                </select>
              </div>
              <div>
                <label htmlFor="cf-price" className="block text-sm font-medium">
                  Valor
                </label>
                <input
                  id="cf-price"
                  type="number"
                  min={0}
                  value={pricingValue}
                  onChange={(e) => setPricingValue(Number(e.target.value))}
                  className="mt-1 w-full rounded border p-2 text-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('draft')}
                className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Salvar rascunho
              </button>
              <button
                type="button"
                onClick={goToStep2}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Próximo: Criativos →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Locale tabs */}
            <div className="flex gap-1 border-b">
              {locales.map((locale) => {
                const slotsWithContent = selectedSlots.filter(
                  (s) => creatives[`${s}:${locale}`]?.title,
                ).length
                return (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setActiveLocale(locale)}
                    className={`px-3 py-2 text-sm font-medium ${
                      activeLocale === locale
                        ? 'border-b-2 border-indigo-600 text-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {locale}
                    {slotsWithContent > 0 && (
                      <span className="ml-1 text-xs text-green-600">
                        {slotsWithContent}/{selectedSlots.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Copy button for non-default locales */}
            {activeLocale !== defaultLocale && (
              <button
                type="button"
                onClick={() => copyFromDefault(activeLocale)}
                className="text-xs text-indigo-600 hover:underline"
              >
                Copiar de {defaultLocale}
              </button>
            )}

            {/* Per-slot creative cards */}
            {selectedSlots.map((slotKey) => {
              const key = `${slotKey}:${activeLocale}`
              const creative = creatives[key]
              if (!creative) return null
              const slotDef = config.slots.find((s) => s.key === slotKey)
              return (
                <div key={key} className="rounded border p-4">
                  <h4 className="mb-3 text-sm font-semibold">
                    {slotDef?.label ?? slotKey}
                    <span className="ml-2 font-mono text-xs text-gray-400">
                      {slotKey}
                    </span>
                  </h4>
                  {errors[key] && (
                    <p className="mb-2 text-xs text-red-500">{errors[key]}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium">Título</label>
                        <input
                          value={creative.title}
                          onChange={(e) =>
                            updateCreative(key, 'title', e.target.value)
                          }
                          className="mt-1 w-full rounded border p-2 text-sm"
                          placeholder="Título do anúncio"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium">Corpo</label>
                        <textarea
                          value={creative.body}
                          onChange={(e) =>
                            updateCreative(key, 'body', e.target.value)
                          }
                          className="mt-1 w-full rounded border p-2 text-sm"
                          rows={2}
                          placeholder="Descrição curta"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium">
                            Texto do CTA
                          </label>
                          <input
                            value={creative.ctaText}
                            onChange={(e) =>
                              updateCreative(key, 'ctaText', e.target.value)
                            }
                            className="mt-1 w-full rounded border p-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium">URL do CTA</label>
                          <input
                            value={creative.ctaUrl}
                            onChange={(e) =>
                              updateCreative(key, 'ctaUrl', e.target.value)
                            }
                            className="mt-1 w-full rounded border p-2 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium">Imagem URL</label>
                        <input
                          value={creative.imageUrl ?? ''}
                          onChange={(e) =>
                            updateCreative(
                              key,
                              'imageUrl',
                              e.target.value || undefined,
                            )
                          }
                          className="mt-1 w-full rounded border p-2 text-sm"
                          placeholder="https://..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium">Interação</label>
                          <div className="mt-1 flex gap-3">
                            {(['link', 'form'] as const).map((v) => (
                              <label key={v} className="flex items-center gap-1 text-xs">
                                <input
                                  type="radio"
                                  name={`interaction-${key}`}
                                  value={v}
                                  checked={creative.interaction === v}
                                  onChange={() =>
                                    updateCreative(key, 'interaction', v)
                                  }
                                />
                                {v}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium">
                            Dismiss (s)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            value={creative.dismissSeconds}
                            onChange={(e) =>
                              updateCreative(
                                key,
                                'dismissSeconds',
                                Number(e.target.value),
                              )
                            }
                            className="mt-1 w-full rounded border p-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Inline preview */}
                    <div className="rounded border bg-gray-50 p-3">
                      <p className="mb-2 text-xs font-medium text-gray-400">
                        Preview
                      </p>
                      <div
                        className="rounded border bg-white p-3"
                        style={{ borderLeftColor: brandColor, borderLeftWidth: 3 }}
                      >
                        <p className="text-xs font-semibold uppercase text-amber-600">
                          Da casa
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {creative.title || 'Título'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {creative.body || 'Descrição'}
                        </p>
                        <button
                          type="button"
                          className="mt-2 rounded px-3 py-1 text-xs text-white"
                          style={{ backgroundColor: brandColor }}
                        >
                          {creative.ctaText || 'CTA'}
                        </button>
                        {creative.ctaUrl && (
                          <p className="mt-1 truncate font-mono text-[10px] text-gray-400">
                            {creative.ctaUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Footer */}
            <div className="flex justify-between border-t pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Voltar
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Salvar rascunho
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('active')}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                >
                  Salvar e ativar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass. Fix any broken tests that depended on old CampaignFormModal structure.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/client/CampaignFormModal.tsx packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx && git commit -m "feat(ad-admin): rewrite CampaignFormModal as 2-step wizard with creative editor"
```

---

### Task 14: CampaignFormModal — Step 2 creative editor tests

**Files:**
- Modify: `packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx`

- [ ] **Step 1: Add Step 2 tests**

```tsx
import { fireEvent, waitFor } from '@testing-library/react'

describe('CampaignFormModal — Step 2', () => {
  function goToStep2(container: ReturnType<typeof renderModal>) {
    const nameInput = screen.getByLabelText(/nome/i)
    fireEvent.change(nameInput, { target: { value: 'Test Campaign' } })
    // Select a slot
    fireEvent.click(screen.getByText('Banner Topo'))
    // Click next
    fireEvent.click(screen.getByRole('button', { name: /próximo.*criativo/i }))
  }

  it('shows locale tabs after advancing to step 2', () => {
    renderModal()
    goToStep2(undefined as any)
    expect(screen.getByText('pt-BR')).toBeDefined()
    expect(screen.getByText('en')).toBeDefined()
  })

  it('shows creative card for selected slot', () => {
    renderModal()
    goToStep2(undefined as any)
    expect(screen.getByText('Banner Topo')).toBeDefined()
    expect(screen.getByPlaceholderText('Título do anúncio')).toBeDefined()
  })

  it('shows "Copiar de pt-BR" button on en tab', () => {
    renderModal()
    goToStep2(undefined as any)
    fireEvent.click(screen.getByText('en'))
    expect(screen.getByText(/copiar de pt-br/i)).toBeDefined()
  })

  it('has "Voltar" button that returns to step 1', () => {
    renderModal()
    goToStep2(undefined as any)
    fireEvent.click(screen.getByText(/voltar/i))
    expect(screen.getByLabelText(/nome/i)).toBeDefined()
  })

  it('has "Salvar e ativar" button', () => {
    renderModal()
    goToStep2(undefined as any)
    expect(screen.getByRole('button', { name: /salvar e ativar/i })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx && git commit -m "test(ad-admin): add CampaignFormModal Step 2 creative editor tests"
```

---

### Task 15: CampaignFormModal — edit mode with pre-filled creatives

**Files:**
- Modify: `packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx`

- [ ] **Step 1: Add edit mode tests**

```tsx
describe('CampaignFormModal — edit mode', () => {
  const editCampaign: AdCampaignDetail = {
    id: 'c-1',
    name: 'Existing Campaign',
    advertiser: 'Acme Inc',
    format: 'native',
    status: 'active',
    active: true,
    slot_id: 'banner_top',
    slots: ['banner_top'],
    schedule_start: '2026-01-01',
    schedule_end: '2026-12-31',
    pricing_model: 'cpm',
    pricing_value: 15,
    audience: ['developers'],
    created_at: '2026-01-01',
    brand_color: '#FF5733',
    logo_url: 'https://example.com/logo.png',
    type: 'cpa',
    priority: 50,
    creatives: [
      {
        id: 'cr-1',
        slot_key: 'banner_top',
        title: 'Existing Title',
        body: 'Existing Body',
        cta_text: 'Click Here',
        cta_url: 'https://example.com',
        image_url: null,
        dismiss_seconds: 3,
        locale: 'pt-BR',
        interaction: 'link',
      },
    ],
  }

  it('pre-fills Step 1 fields from campaign', () => {
    renderModal({ campaign: editCampaign })
    expect((screen.getByLabelText(/nome/i) as HTMLInputElement).value).toBe(
      'Existing Campaign',
    )
  })

  it('pre-fills creatives on Step 2', () => {
    renderModal({ campaign: editCampaign })
    fireEvent.click(screen.getByRole('button', { name: /próximo.*criativo/i }))
    expect(
      (screen.getByPlaceholderText('Título do anúncio') as HTMLInputElement).value,
    ).toBe('Existing Title')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx -t "edit mode" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/__tests__/campaign-form-modal.test.tsx && git commit -m "test(ad-admin): add CampaignFormModal edit mode tests"
```

---

## Session 4: PlaceholderManager + App Wiring + Publish

**Files:**
- Modify: `packages/ad-engine-admin/src/client/PlaceholderManager.tsx`
- Modify: `packages/ad-engine-admin/src/client/PlaceholderForm.tsx`
- Modify: `packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx`
- Modify: `packages/ad-engine-admin/package.json` (version bump)
- Modify: `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` (in bythiagofigueiredo)
- Modify: `apps/web/src/app/admin/(authed)/ads/page.tsx` (in bythiagofigueiredo)
- Modify: `apps/web/package.json` (in bythiagofigueiredo)

---

### Task 16: PlaceholderManager — slot labels from context

**Files:**
- Modify: `packages/ad-engine-admin/src/client/PlaceholderManager.tsx`
- Test: `packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx`

- [ ] **Step 1: Write failing test for slot labels**

Update `packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaceholderManager } from '../client/PlaceholderManager'
import { AdEngineAdminProvider } from '../provider'
import type { AdAdminConfig, AdAdminActions } from '../types'
import type { AdPlaceholderRow } from '../queries'

function makePlaceholder(overrides: Partial<AdPlaceholderRow> = {}): AdPlaceholderRow {
  return {
    slot_id: 'banner_top',
    is_enabled: true,
    headline: 'Test Headline',
    body: 'Test Body',
    cta_text: 'Click',
    cta_url: 'https://example.com',
    image_url: null,
    dismiss_after_ms: 5000,
    updated_at: '2026-01-01',
    ...overrides,
  }
}

const config: AdAdminConfig = {
  appId: 'app-1',
  slots: [
    { key: 'banner_top', label: 'Banner — Topo', desc: 'Full-width top', badge: 'Alto alcance', badgeColor: 'blue' },
    { key: 'rail_left', label: 'Marginália — Esquerda', desc: 'Left sidebar', badge: 'Contextual', badgeColor: 'green' },
  ],
  basePath: '/admin/ads',
}

const actions: AdAdminActions = {
  createCampaign: vi.fn().mockResolvedValue(undefined),
  updateCampaign: vi.fn().mockResolvedValue(undefined),
  deleteCampaign: vi.fn().mockResolvedValue(undefined),
  updatePlaceholder: vi.fn().mockResolvedValue(undefined),
  uploadMedia: vi.fn().mockResolvedValue({ id: '1', url: '' }),
  deleteMedia: vi.fn().mockResolvedValue(undefined),
}

function renderManager(props?: { activeCampaigns?: any[] }) {
  const placeholders = [
    makePlaceholder({ slot_id: 'banner_top' }),
    makePlaceholder({ slot_id: 'rail_left' }),
  ]
  return render(
    <AdEngineAdminProvider config={config} actions={actions}>
      <PlaceholderManager
        placeholders={placeholders}
        activeCampaigns={props?.activeCampaigns}
      />
    </AdEngineAdminProvider>,
  )
}

describe('PlaceholderManager — slot labels', () => {
  it('shows human-readable label instead of raw slot_id', () => {
    renderManager()
    expect(screen.getByText('Banner — Topo')).toBeDefined()
    expect(screen.getByText('Marginália — Esquerda')).toBeDefined()
  })

  it('shows badge text from slot definition', () => {
    renderManager()
    expect(screen.getByText('Alto alcance')).toBeDefined()
  })

  it('still shows slot_id in monospace', () => {
    renderManager()
    expect(screen.getByText('banner_top')).toBeDefined()
    expect(screen.getByText('rail_left')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx -t "slot labels" 2>&1 | tail -20
```

Expected: FAIL — current PlaceholderManager shows raw slot_id only.

- [ ] **Step 3: Update PlaceholderManager**

Replace `packages/ad-engine-admin/src/client/PlaceholderManager.tsx`:

```tsx
'use client'

import type { AdPlaceholderRow, ActiveCampaignSummary } from '../queries'
import { PlaceholderForm } from './PlaceholderForm'
import { useAdEngineAdmin } from '../provider'

export interface PlaceholderManagerProps {
  placeholders: AdPlaceholderRow[]
  activeCampaigns?: ActiveCampaignSummary[]
  renderPreview?: (props: PlaceholderPreviewProps) => React.ReactNode
}

export interface PlaceholderPreviewProps {
  slotId: string
  isEnabled: boolean
  headline: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string
  dismissAfterMs: number
}

export function PlaceholderManager({
  placeholders,
  activeCampaigns,
  renderPreview,
}: PlaceholderManagerProps) {
  const { config } = useAdEngineAdmin()

  const slotMap = new Map(config.slots.map((s) => [s.key, s]))

  if (placeholders.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">
        Nenhum placeholder configurado. Execute a migration para criar os registros
        iniciais.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {placeholders.map((p) => {
        const slot = slotMap.get(p.slot_id)
        const activeCampaign = activeCampaigns?.find((c) => c.slot_id === p.slot_id)

        return (
          <div key={p.slot_id} className="rounded-lg border p-4">
            {/* Header with slot label */}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {slot?.label ?? p.slot_id}
                  </h3>
                  {slot?.badge && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${slot.badgeColor}20`,
                        color: slot.badgeColor,
                      }}
                    >
                      {slot.badge}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      p.is_enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p.is_enabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {slot?.desc && (
                  <p className="mt-0.5 text-xs text-gray-500">{slot.desc}</p>
                )}
                <p className="font-mono text-[10px] text-gray-400">{p.slot_id}</p>
              </div>
              <span className="text-[10px] text-gray-400">
                Atualizado: {new Date(p.updated_at).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Active campaign indicator */}
            {activeCampaign && (
              <div className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Campanha <strong>&ldquo;{activeCampaign.name}&rdquo;</strong> está ativa
                neste slot — o placeholder não será exibido enquanto a campanha estiver no
                ar.
              </div>
            )}

            <PlaceholderForm
              slotId={p.slot_id}
              initial={p}
              renderPreview={renderPreview}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx -t "slot labels" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/client/PlaceholderManager.tsx packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx && git commit -m "feat(ad-admin): PlaceholderManager shows slot labels, badges, descriptions from context"
```

---

### Task 17: PlaceholderManager — active campaign indicator

**Files:**
- Modify: `packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx`

- [ ] **Step 1: Write test for active campaign indicator**

Add to `packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx`:

```tsx
describe('PlaceholderManager — active campaign indicator', () => {
  it('shows active campaign banner when slot has active campaign', () => {
    renderManager({
      activeCampaigns: [
        { id: 'c-1', name: 'Ensaios de Obsidian', slot_id: 'banner_top' },
      ],
    })
    expect(screen.getByText(/Ensaios de Obsidian/)).toBeDefined()
    expect(screen.getByText(/não será exibido/)).toBeDefined()
  })

  it('does not show banner when no active campaign for slot', () => {
    renderManager({
      activeCampaigns: [
        { id: 'c-1', name: 'Other Campaign', slot_id: 'inline_mid' },
      ],
    })
    expect(screen.queryByText(/não será exibido/)).toBeNull()
  })

  it('works without activeCampaigns prop', () => {
    renderManager()
    expect(screen.queryByText(/não será exibido/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx -t "active campaign" 2>&1 | tail -20
```

Expected: PASS — we already implemented the indicator in the previous task.

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx && git commit -m "test(ad-admin): add PlaceholderManager active campaign indicator tests"
```

---

### Task 18: PlaceholderForm — improved preview with "DA CASA" badge and renderPreview slot

**Files:**
- Modify: `packages/ad-engine-admin/src/client/PlaceholderForm.tsx`

- [ ] **Step 1: Write failing test for improved preview**

The existing `placeholder-manager.test.tsx` can be extended, or we test via the form directly. Add to the test file:

```tsx
describe('PlaceholderForm — preview improvements', () => {
  it('shows "DA CASA" badge in preview', () => {
    render(
      <AdEngineAdminProvider config={config} actions={actions}>
        <PlaceholderManager placeholders={[makePlaceholder()]} />
      </AdEngineAdminProvider>,
    )
    expect(screen.getByText('DA CASA')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx -t "DA CASA" 2>&1 | tail -20
```

Expected: FAIL — current preview doesn't have "DA CASA" badge.

- [ ] **Step 3: Update PlaceholderForm preview section**

In `packages/ad-engine-admin/src/client/PlaceholderForm.tsx`, update the preview card section to include:

1. "DA CASA" amber badge at top
2. CTA URL in monospace below button
3. Metadata footer: dismiss time + slot_id
4. Disabled state: blur overlay with "INATIVO" badge
5. Accept optional `renderPreview` prop and delegate if provided

Add prop to PlaceholderForm:

```typescript
interface PlaceholderFormProps {
  slotId: string
  initial?: AdPlaceholderRow
  renderPreview?: (props: PlaceholderPreviewProps) => React.ReactNode
}
```

Update preview section in the form's JSX:

```tsx
{/* Preview */}
<div className="relative rounded-lg border bg-gray-50 p-4">
  {renderPreview ? (
    renderPreview({
      slotId,
      isEnabled,
      headline,
      body,
      ctaText,
      ctaUrl,
      imageUrl: imageUrl ?? '',
      dismissAfterMs: dismissAfterMs,
    })
  ) : (
    <>
      {!isEnabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm">
          <span className="rounded bg-gray-800 px-3 py-1 text-xs font-bold text-white">
            INATIVO
          </span>
        </div>
      )}
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">
        DA CASA
      </p>
      {imageUrl && !imgError && (
        <img
          src={imageUrl}
          alt=""
          className="mb-2 h-24 w-full rounded object-cover"
          onError={() => setImgError(true)}
        />
      )}
      <p className="text-sm font-bold">{headline || 'Título do anúncio'}</p>
      <p className="mt-1 text-xs text-gray-600">{body || 'Descrição'}</p>
      <button
        type="button"
        className="mt-3 rounded bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white"
      >
        {ctaText || 'CTA'}
      </button>
      {ctaUrl && (
        <p className="mt-1 truncate font-mono text-[10px] text-gray-400">
          {ctaUrl}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px] text-gray-400">
        <span>Dismiss: {dismissAfterMs / 1000}s</span>
        <span className="font-mono">{slotId}</span>
      </div>
    </>
  )}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx -t "DA CASA" 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/src/client/PlaceholderForm.tsx packages/ad-engine-admin/src/client/PlaceholderManager.tsx packages/ad-engine-admin/src/__tests__/placeholder-manager.test.tsx && git commit -m "feat(ad-admin): PlaceholderForm preview with DA CASA badge, metadata footer, renderPreview slot"
```

---

### Task 19: Build + version bump to 0.4.0

**Files:**
- Modify: `packages/ad-engine-admin/package.json`

- [ ] **Step 1: Run full test suite one final time**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx vitest run packages/ad-engine-admin/ 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 2: Build package**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx tsup --config packages/ad-engine-admin/tsup.config.ts 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Bump version to 0.4.0**

In `packages/ad-engine-admin/package.json`, change:

```diff
- "version": "0.3.3",
+ "version": "0.4.0",
```

- [ ] **Step 4: Commit version bump**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && git add packages/ad-engine-admin/package.json && git commit -m "chore(ad-admin): bump version to 0.4.0"
```

- [ ] **Step 5: Publish to GitHub Packages**

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem/packages/ad-engine-admin && npm publish 2>&1 | tail -10
```

Expected: Package published successfully as `@tn-figueiredo/ad-engine-admin@0.4.0`.

---

### Task 20: App wiring — new server actions in bythiagofigueiredo

**Files:**
- Modify: `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` (in bythiagofigueiredo)

- [ ] **Step 1: Add updateCampaignStatus server action**

In `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`, add:

```typescript
import type { AdCampaignDetail } from '@tn-figueiredo/ad-engine-admin'

const VALID_STATUSES = ['active', 'paused', 'draft', 'archived']

export async function updateCampaignStatus(
  id: string,
  status: string,
): Promise<void> {
  'use server'
  await requireArea('admin')

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('ad_campaigns')
    .update({ status, active: status === 'active' })
    .eq('id', id)

  if (error) {
    captureException(error)
    throw new Error('Failed to update campaign status')
  }

  revalidateTag('ads')
  revalidatePath('/admin/ads')
}
```

- [ ] **Step 2: Add fetchCampaignById server action**

```typescript
export async function fetchCampaignById(
  id: string,
): Promise<AdCampaignDetail | null> {
  'use server'
  await requireArea('admin')

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select(
      '*, ad_slot_creatives(id, slot_key, title, body, cta_text, cta_url, image_url, dismiss_seconds, locale, interaction)',
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const { ad_slot_creatives, ...campaign } = data as Record<string, unknown>
  const creatives = ((ad_slot_creatives ?? []) as AdCampaignDetail['creatives']).sort(
    (a, b) => {
      const lc = a.locale.localeCompare(b.locale)
      return lc !== 0 ? lc : a.slot_key.localeCompare(b.slot_key)
    },
  )

  const slots = [...new Set(creatives.map((c) => c.slot_key))]

  return {
    ...(campaign as unknown as Omit<AdCampaignDetail, 'creatives' | 'slots' | 'slot_id'>),
    slots,
    slot_id: slots[0] ?? '',
    creatives,
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/app/admin/\(authed\)/ads/_actions/campaigns.ts && git commit -m "feat(ads): add updateCampaignStatus and fetchCampaignById server actions"
```

---

### Task 21: App wiring — update ads page with new config, actions, and data

**Files:**
- Modify: `apps/web/src/app/admin/(authed)/ads/page.tsx` (in bythiagofigueiredo)

- [ ] **Step 1: Update adminConfig to include supportedLocales**

In `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/src/app/admin/(authed)/ads/page.tsx`:

Add `supportedLocales` to the config object:

```typescript
const adminConfig: AdAdminConfig = {
  appId: APP_ID,
  slots: SITE_AD_SLOTS,
  basePath: '/admin/ads',
  locale: 'pt-BR',
  currency: 'BRL',
  supportedLocales: ['pt-BR', 'en'],
}
```

- [ ] **Step 2: Update actions map**

Add new actions to the actions object:

```typescript
import { updateCampaignStatus, fetchCampaignById } from './_actions/campaigns'

const actions: AdAdminActions = {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  updatePlaceholder,
  uploadMedia,
  deleteMedia,
  updateCampaignStatus,
  fetchCampaignById,
}
```

- [ ] **Step 3: Update data loading for placeholders tab**

Add `fetchActiveCampaignsPerSlot` import and call when `tab === 'placeholders'`:

```typescript
import { fetchActiveCampaignsPerSlot } from '@tn-figueiredo/ad-engine-admin'

// In the data loading section for placeholders:
const [placeholderResult, activeCampaignsResult] = await Promise.allSettled([
  queries.fetchAdPlaceholders(),
  fetchActiveCampaignsPerSlot(supabase, APP_ID),
])
const placeholders = placeholderResult.status === 'fulfilled' ? placeholderResult.value : []
const activeCampaigns = activeCampaignsResult.status === 'fulfilled' ? activeCampaignsResult.value : []
```

- [ ] **Step 4: Update CampaignWizardServer props**

Pass pagination and action props:

```tsx
<CampaignWizardServer
  campaigns={configs}
  config={adminConfig}
  pagination={{ total, totalPages, currentPage: page }}
  deleteCampaignAction={deleteCampaign}
  updateCampaignStatusAction={updateCampaignStatus}
  fetchCampaignByIdAction={fetchCampaignById}
/>
```

- [ ] **Step 5: Update PlaceholderManager props**

Pass activeCampaigns:

```tsx
<PlaceholderManager
  placeholders={placeholders}
  activeCampaigns={activeCampaigns}
/>
```

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/app/admin/\(authed\)/ads/page.tsx && git commit -m "feat(ads): wire CampaignList CRUD actions, supportedLocales, activeCampaigns to admin page"
```

---

### Task 22: Version bump ad-engine-admin in bythiagofigueiredo

**Files:**
- Modify: `apps/web/package.json` (in bythiagofigueiredo)

- [ ] **Step 1: Update package.json**

In `/Users/figueiredo/Workspace/bythiagofigueiredo/apps/web/package.json`, change:

```diff
- "@tn-figueiredo/ad-engine-admin": "0.3.3",
+ "@tn-figueiredo/ad-engine-admin": "0.4.0",
```

- [ ] **Step 2: Install**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm install 2>&1 | tail -10
```

Expected: Install succeeds, `@tn-figueiredo/ad-engine-admin@0.4.0` installed.

- [ ] **Step 3: Run tests**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -20
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/package.json package-lock.json && git commit -m "chore: pin ad-engine-admin@0.4.0"
```

---

### Task 23: Final verification — dev server smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run dev --workspace=apps/web &
```

- [ ] **Step 2: Manual verification checklist**

Open `http://localhost:3000/admin/ads` in browser and verify:

1. **Campaigns tab**: Rows are clickable → opens edit modal
2. **Edit modal**: Step 1 shows type, brand color, status (draft), priority fields
3. **Edit modal**: "Próximo: Criativos →" advances to Step 2
4. **Step 2**: Locale tabs (pt-BR, en) with creative cards per slot
5. **Step 2**: Creative preview shows brand color, "DA CASA" badge
6. **"Nova campanha" button**: Opens modal in create mode (not a broken link)
7. **Status toggle**: Clicking active badge toggles to paused (and back)
8. **Delete**: Trash icon → inline confirmation → deletes campaign
9. **Placeholders tab**: Shows human-readable slot labels (e.g., "Banner — Topo")
10. **Placeholders tab**: Active campaign indicator shows for slots with campaigns
11. **Placeholder preview**: Shows "DA CASA" badge, CTA URL, metadata footer

- [ ] **Step 3: Stop dev server**

```bash
kill %1
```
