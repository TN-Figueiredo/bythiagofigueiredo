# Ad Engine Admin 0.4.0 — Campaign CRUD + Placeholder Improvements

## Status
Draft — pending implementation plan

## Problem
`@tn-figueiredo/ad-engine-admin@0.3.3` has critical UX gaps that prevent real ad management:
1. Campaign rows in the listing are not clickable — no way to edit existing campaigns
2. `CampaignFormModal` lacks creative editing (title, body, CTA per slot per locale)
3. No delete button or status toggle anywhere in the UI
4. "Nova campanha" links to a nonexistent route
5. Placeholder preview is a generic white card — uninformative
6. Placeholder cards show raw `slot_id` strings instead of human-readable labels
7. No indication of which slots have active campaigns (placeholder hidden but admin doesn't know)

## Scope
Two packages in `tnf-ecosystem`:
- `@tn-figueiredo/ad-engine-admin` — 0.3.3 → 0.4.0 (semver minor: new features, no breaking changes)
- `@tn-figueiredo/ad-engine` — 0.3.0 → 0.3.1 if needed (patch only)

One consumer app:
- `bythiagofigueiredo` — wiring changes + version bump

## Section 1: Data Layer

### New types (`queries.ts`)

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

### Expanded `AdCampaignRow`

```typescript
export interface AdCampaignRow {
  // existing fields...
  brand_color: string      // NEW
  logo_url: string | null  // NEW
  type: string             // NEW ('house' | 'cpa')
  priority: number         // NEW
}
```

### New query functions

```typescript
// Single campaign with full creatives for edit modal
export async function fetchAdCampaignById(
  supabase: SupabaseClient,
  appId: string,
  campaignId: string,
): Promise<AdCampaignDetail | null>
// SELECT: *, ad_slot_creatives(id, slot_key, title, body, cta_text, cta_url, image_url, dismiss_seconds, locale, interaction)
// ORDER: locale, slot_key
// Returns null on not-found or app_id mismatch (fail closed)

// Lightweight active campaigns per slot for placeholder indicator
export async function fetchActiveCampaignsPerSlot(
  supabase: SupabaseClient,
  appId: string,
): Promise<ActiveCampaignSummary[]>
```

### Expanded `fetchAdConfigs` SELECT

```sql
-- adds: brand_color, logo_url, type, priority
-- creatives join stays lightweight: ad_slot_creatives(slot_key) only
```

### Schema changes (`schemas.ts`)

```typescript
// slotCreativeSchema gains:
locale: z.string().default('pt-BR'),
interaction: z.enum(['link', 'form']).default('link'),

// campaignFormSchema gains:
type: z.enum(['house', 'cpa']).default('house'),
brandColor: z.string().default('#6B7280'),
logoUrl: z.string().url().nullish(),
status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),  // added 'draft'

// creatives becomes optional (drafts can save without creatives):
creatives: z.record(z.string(), slotCreativeSchema).optional(),
// with .refine(): non-draft campaigns must have ≥1 creative

// Creative Record key = `${slotKey}:${locale}` (composite)
```

### New validation helper

```typescript
export function validateCreativesForActivation(
  creatives: Record<string, SlotCreativeData>,
  selectedSlots: string[],
  defaultLocale: string,
): Record<string, string>
// Validates: every selectedSlot has creative for defaultLocale with title≥3, ctaText≥2, ctaUrl non-empty
```

### Config changes (`types.ts`)

```typescript
export interface AdAdminConfig {
  // existing...
  supportedLocales?: string[]  // NEW — defaults to ['pt-BR']
}

export interface AdAdminActions {
  // existing...
  updateCampaignStatus?(id: string, status: string): Promise<void>  // NEW
  fetchCampaignById?(id: string): Promise<AdCampaignDetail | null>  // NEW
}
```

### `createAdminQueries` factory gains:

```typescript
fetchAdCampaignById: (campaignId: string) => Promise<AdCampaignDetail | null>
fetchActiveCampaignsPerSlot: () => Promise<ActiveCampaignSummary[]>
```

---

## Section 2: CampaignFormModal Multi-Step Wizard

### Architecture

2-step wizard inside the existing modal shell:

**Step 1 — Campaign Metadata:**
- Row 1: Name (required) | Advertiser (optional)
- Row 2: Format (select) | Type (house/cpa select)
- Row 3: Brand Color (color input + hex) | Logo URL (text)
- Row 4: Status (draft/active/paused/archived) | Priority (1-100)
- Row 5: Slot chips (toggle grid from config.slots)
- Row 6: Audience selector (existing component)
- Row 7: Schedule start | end
- Row 8: Pricing model | value
- Footer: Cancelar | Salvar rascunho | Proximo: Criativos →

**Step 2 — Creative Editor:**
- Locale tab bar from `config.supportedLocales` with completion indicators
- Per slot: card with title, body, ctaText, ctaUrl, imageUrl, interaction radio, dismissSeconds, inline preview
- "Copiar de pt-BR" button on non-default locale tabs
- Footer: ← Voltar | Salvar rascunho | Salvar e ativar

### Props

```typescript
interface CampaignFormModalProps {
  open: boolean
  onClose: () => void
  campaign?: AdCampaignDetail  // undefined = new, populated = edit
}
```

### Creative initialization

**New campaign:** `buildEmptyCreatives(selectedSlots, locales)` → skeleton per slot × locale
**Edit campaign:** `creativesFromRows(campaign.creatives, slots, locales)` → transform `AdSlotCreativeRow[]` into Record with composite keys

### Step transition

- Step 1 → 2: validate metadata, reconcile creatives (add new slots, prune removed)
- Step 2 → 1: preserve all state
- Slot re-sync on transition: new slots get empty skeletons, removed slots pruned

### Validation

- "Save as draft": structural only (valid JSON shape)
- "Save and activate": `validateCreativesForActivation()` — default locale must have complete creatives for all slots

### Component decomposition (all internal, not exported)

```
CampaignFormModal
  ├── StepIndicator
  ├── Step1MetadataForm
  │   └── AudienceSelector (existing)
  ├── Step2CreativeEditor
  │   ├── LocaleTabBar
  │   ├── SlotCreativeCard (per slot)
  │   │   └── CreativeInlinePreview
  │   └── CopyLocaleButton
  └── ModalFooter
```

---

## Section 3: CampaignList with Full CRUD

### Architecture

New **client component** `CampaignList` replaces the static table. `CampaignWizardServer` becomes a thin server wrapper.

### Features

1. **Clickable rows** → lazy-load `AdCampaignDetail` via `fetchCampaignByIdAction` → open `CampaignFormModal` in edit mode
2. **"Nova campanha" button** → opens modal in create mode (no more broken `<a>` link)
3. **Status toggle** → clickable badge (active↔paused only), optimistic UI with revert on error. Draft/archived badges are non-interactive.
4. **Delete** → trash icon per row → inline confirmation bar (`Excluir campanha "X"? [Cancelar] [Excluir]`). No `window.confirm()`.
5. **Pagination** → URL-based `?tab=campaigns&page=N`, server-side consistent with tab pattern
6. **Loading states** → row highlight + spinner on edit click, badge pulse on toggle, opacity on delete

### Props

```typescript
interface CampaignListProps {
  campaigns: AdCampaignRow[]
  pagination: { total: number; totalPages: number; currentPage: number }
  deleteCampaignAction: (id: string) => Promise<void>
  updateCampaignStatusAction?: (id: string, status: string) => Promise<void>
  fetchCampaignByIdAction?: (id: string) => Promise<AdCampaignDetail | null>
}
```

### `CampaignWizardServer` updated props

```typescript
interface CampaignWizardServerProps {
  campaigns: AdCampaignRow[]
  config: AdAdminConfig
  pagination?: { total: number; totalPages: number; currentPage: number }
  deleteCampaignAction?: (id: string) => Promise<void>
  updateCampaignStatusAction?: (id: string, status: string) => Promise<void>
  fetchCampaignByIdAction?: (id: string) => Promise<AdCampaignDetail | null>
}
```

### Modal instantiation

```tsx
<CampaignFormModal
  key={editingCampaign?.id ?? 'new'}  // forces state reset
  open={modalOpen}
  campaign={editingCampaign ?? undefined}
  onClose={handleCloseModal}
/>
```

### Backward compatibility

All new props are optional. Existing consumers see current behavior — static rows, no delete, no toggle.

---

## Section 4: PlaceholderManager Improvements

### Slot labels

`PlaceholderManager` reads `config.slots` from context via `useAdEngineAdmin()`. Builds lookup map `slot_id → AdSlotDefinition`. Card headers show:
- Human-readable label (e.g., "Banner — Topo") instead of raw `slot_id`
- Badge with `badgeColor` from slot definition
- Description text
- Raw `slot_id` in small monospace below

### Active campaign indicator

New prop `activeCampaigns?: ActiveCampaignSummary[]`. When a slot has an active campaign, info banner:

> Campanha **"Ensaios de Obsidian"** esta ativa neste slot — o placeholder nao sera exibido enquanto a campanha estiver no ar.

### Preview improvements (built-in)

- "DA CASA" badge (amber pill, matching AdLabel style)
- CTA URL shown in monospace below button
- Metadata footer: dismiss time + slot_id
- Disabled state: blur overlay with "INATIVO" badge (replaces opacity-40)

### `renderPreview` composition slot

```typescript
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

interface PlaceholderManagerProps {
  placeholders: AdPlaceholderRow[]
  activeCampaigns?: ActiveCampaignSummary[]
  renderPreview?: (props: PlaceholderPreviewProps) => React.ReactNode
}
```

When provided, replaces the built-in generic preview. The consuming app can render actual blog ad components (DoormanAd, BookmarkAd) with live form state.

---

## Section 5: App-Side Wiring (bythiagofigueiredo)

### New server actions (`_actions/campaigns.ts`)

```typescript
// Status toggle — lightweight, no full form payload
export async function updateCampaignStatus(id: string, status: string): Promise<void>
// validates status whitelist, requireArea('admin'), update + revalidateTag('ads')

// Detail fetch — server action (not route handler, follows codebase convention)
export async function fetchCampaignById(id: string): Promise<AdCampaignDetail | null>
// requireArea('admin'), select campaign + creatives, return null on not-found
```

### Config update

```typescript
const adminConfig: AdAdminConfig = {
  // existing...
  supportedLocales: ['pt-BR', 'en'],  // NEW
}
```

### Actions map update

```typescript
const actions: AdAdminActions = {
  // existing...
  updateCampaignStatus,   // NEW
  fetchCampaignById,      // NEW
}
```

### Page data loading

When `tab === 'placeholders'`, fetch `activeCampaigns` via `fetchActiveCampaignsPerSlot(supabase, APP_ID)` and pass to `PlaceholderManager`.

Pass `pagination` object to `CampaignWizardServer`.

### Version bump

```diff
- "@tn-figueiredo/ad-engine-admin": "0.3.3",
+ "@tn-figueiredo/ad-engine-admin": "0.4.0",
```

### Zero migrations needed

All DB columns already exist: `brand_color`, `logo_url`, `type`, `priority`, `locale`, `interaction`, `app_id`.

---

## File Changes Summary

### Package: `@tn-figueiredo/ad-engine-admin`

| File | Change |
|---|---|
| `src/queries.ts` | New types + queries, expand fetchAdConfigs SELECT |
| `src/schemas.ts` | New fields + validation helper |
| `src/types.ts` | Config + Actions extensions |
| `src/client/CampaignFormModal.tsx` | Full rewrite: 2-step wizard |
| `src/client/CampaignList.tsx` | NEW — CRUD table |
| `src/client/PlaceholderManager.tsx` | Slot labels, campaign indicator, renderPreview |
| `src/client/PlaceholderForm.tsx` | Preview improvements |
| `src/server/CampaignWizardServer.tsx` | Thin wrapper → CampaignList |
| `src/client/index.ts` | Add CampaignList export |
| `src/index.ts` | New type + query exports |

### App: `bythiagofigueiredo`

| File | Change |
|---|---|
| `apps/web/package.json` | Pin ad-engine-admin@0.4.0 |
| `apps/web/.../ads/_actions/campaigns.ts` | 2 new server actions |
| `apps/web/.../ads/page.tsx` | Config + actions + data loading |

## Open Decisions

1. **`uploadMedia` stub** — remains `throw new Error('Not implemented')`. Supabase Storage integration deferred to future sprint.
2. **Ad event tracking** — blog components don't emit impression/click events yet. The admin dashboard KPIs will stay at zero until event tracking is implemented. Out of scope for 0.4.0.
3. **renderPreview in app** — optional. App can ship without custom preview and add it later.

## Session Breakdown (Implementation)

Suggested 4 sessions:
1. **Data layer + schemas** — queries.ts, schemas.ts, types.ts, tests
2. **CampaignList + delete + status toggle** — CampaignList.tsx, CampaignWizardServer.tsx update
3. **CampaignFormModal multi-step** — full rewrite with sub-components
4. **PlaceholderManager + app wiring + publish** — placeholder improvements, app changes, build, publish 0.4.0, bump in bythiagofigueiredo
