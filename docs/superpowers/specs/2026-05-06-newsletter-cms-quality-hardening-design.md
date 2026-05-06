# Newsletter CMS Quality Hardening — Design Spec

**Date:** 2026-05-06
**Score antes:** 72/100 → **Score alvo:** 98/100
**Escopo:** 38 issues (3 CRITICAL, 6 HIGH, 16 MEDIUM, 13 LOW) + cadence pattern wiring + 38 novos testes
**Migrations:** nenhuma (cadence_pattern jsonb já suporta todos os tipos)

---

## 1. Time Format Chain Fix (CRITICAL)

### Problema

DB column `preferred_send_time` é `time without time zone` → retorna `HH:MM:SS` (ex: `09:00:00`). `hub-queries.ts:635` passa raw sem `.slice(0,5)`. `cadence-card.tsx:57` valida com `/^\d{2}:\d{2}$/` que rejeita `09:00:00`. **100% dos saves de cadência falham.**

### Fix

Nova utility em `apps/web/src/lib/newsletter/format.ts`:

```typescript
export function normalizeTime(t: string | null | undefined): string {
  if (!t) return '09:00'
  const m = t.match(/^(\d{2}:\d{2})/)
  return m?.[1] ?? '09:00'
}
```

Aplicar em 5 sites:
- `hub-queries.ts:635` — `time: normalizeTime(t.preferred_send_time as string)`
- `hub-queries.ts:685` — substituir `.slice(0, 5)` por `normalizeTime()` (consistência)
- `settings/page.tsx:22` — `preferred_send_time: normalizeTime(t.preferred_send_time as string)`
- `cadence-card.tsx:36,43` — `normalizeTime(config.time)` nos `useState`/`useEffect`
- `cadence-pattern-form.tsx:89` — `normalizeTime(preferredSendTime)` no `useState`

Defense-in-depth: atualizar regex em `cadence-card.tsx:57` para `/^\d{2}:\d{2}(:\d{2})?$/`.

Display fix: `cadence-card.tsx:85` — `normalizeTime(config.time)` na linha de summary.

## 2. Cadence Card Redesign — Wire Existing CadencePatternForm

### Problema

`cadence-card.tsx` expõe apenas `cadence_days` + `start_day` + `send_time` (campos legados). O package `@tn-figueiredo/newsletter` já implementa 10 pattern types com `generateCadenceSlots`, `describePattern` (pt-BR + en), e `CadencePatternForm` existe em `cadence-pattern-form.tsx` mas não é usado no cadence card.

### 10 Pattern Types (já implementados)

| Type | Exemplo |
|---|---|
| `daily` | Todos os dias |
| `daily_weekdays` | Dias úteis |
| `weekly` | Semanal (seg, qua, ...) |
| `biweekly` | Quinzenal (quarta) |
| `every_n_days` | A cada N dias |
| `monthly_day` | Mensal, dia 1 ← "todo dia primeiro" |
| `monthly_last_day` | Último dia do mês |
| `monthly_weekday` | 1a segunda do mês |
| `monthly_last_weekday` | Última sexta do mês |
| `quarterly_day` | Trimestral, dia 1 |

### Fix

Cadence card expandido embeds `CadencePatternForm`:

**Collapsed state:**
- Summary usa `describePattern(pattern, locale)` em vez de hardcoded "N days"
- Time exibido via `normalizeTime()`
- Locale passado do site context (não hardcoded 'en')

**Expanded state:**
- Substitui form de 3 campos legados pelo `CadencePatternForm`
- Props mapping:
  - `currentPattern={config.cadencePattern ?? legacyToPattern(config)}`
  - `preferredSendTime={normalizeTime(config.time)}`
  - `siteTimezone={siteTimezone}` (passado via ScheduleTab → CadenceCard)
  - `locale={locale}`
  - `onSave={(pattern, time) => updateCadencePattern(config.typeId, pattern, time)}`
  - `strings={strings}`

**Legacy-to-pattern conversion** (client-side, sem migration):

```typescript
function legacyToPattern(config: CadenceConfig): CadencePattern {
  if (config.cadenceDays === 7 && config.dayOfWeek)
    return { type: 'weekly', days: [dayNameToWeekday(config.dayOfWeek)] }
  if (config.cadenceDays === 14 && config.dayOfWeek)
    return { type: 'biweekly', day: dayNameToWeekday(config.dayOfWeek) }
  return { type: 'every_n_days', interval: config.cadenceDays }
}
```

On first save: `updateCadencePattern` writes to `cadence_pattern` jsonb. Legacy `cadence_days`/`cadence_start_date` columns ficam untouched (backward compat).

### CadencePatternForm changes

- Use `siteTimezone` (currently dead param `_siteTimezone`) no preview: "09:00 America/Sao_Paulo"
- Normalize `preferredSendTime` com `normalizeTime()` no init
- i18n ordinals ("1st"→"1o") via strings em vez de hardcoded English

### CadenceConfig type extension

Adicionar campo em `hub-types.ts`:

```typescript
export interface CadenceConfig {
  // ... existing fields ...
  cadencePattern: CadencePattern | null  // NEW
}
```

Populado em `hub-queries.ts:613` a partir de `t.cadence_pattern`.

### CadenceCard prop extension

```typescript
interface CadenceCardProps {
  config: CadenceConfig
  siteTimezone: string       // NEW — from ScheduleTab
  locale: 'en' | 'pt-BR'    // NEW — for describePattern
  onTogglePause?: (typeId: string, paused: boolean) => void
  strings?: NewsletterHubStrings
}
```

ScheduleTab já recebe `locale` prop e `data.sendWindow.timezone` — passa ambos.

## 3. Slug Auto-Sync (Type Drawer)

### Problema

`type-drawer.tsx:217` — `handleNameBlur()` só sincroniza slug em `create` mode e no `onBlur`. Em edit mode, `slugManual=true` é setado incondicionalmente no load (line 138), travando auto-sync pra sempre.

### Fix

Renomear `slugManual` → `slugTouched`. Semântica: `true` SOMENTE quando usuário digita manualmente no campo slug.

```typescript
// State
const [slugTouched, setSlugTouched] = useState(false)

// Name onChange — sync slug if not manually touched
function handleNameChange(val: string) {
  setName(val)
  if (!slugTouched && val.trim()) {
    setSlug(generateSlug(val))
  }
}

// Slug onChange — mark as manually touched
function handleSlugChange(val: string) {
  setSlugTouched(true)
  setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
}
```

No load de edit mode: `setSlugTouched(false)` (não `true`). O slug original é preservado como `editData.slug` para o warning.

**UI indicators:**
- Badge `auto` ao lado do label "Slug" quando `!slugTouched`
- Warning `⚠ Slug será alterado de "X" para "Y"` em edit mode quando `slug !== editData.slug`
- Badge some quando `slugTouched=true`

**3 estados visuais:**
1. **Auto** — badge "auto", slug synca com name, cor suave
2. **Manual** — sem badge, slug editado pelo usuário, border active
3. **Warning** — em edit mode quando slug difere do salvo

## 4. Unsaved Changes Guard (Type Drawer)

### Problema

4 close paths descartam form state sem aviso: close button (✕), backdrop click, Cancel, "Edit in Schedule tab", Escape key.

### Fix

**Snapshot tracking:**

```typescript
type FormSnapshot = {
  name: string; tagline: string; locale: string; slug: string
  badge: string; description: string; promiseValues: string[]
  color: string; colorDark: string; ogImageUrl: string
  linkedTagId: string | null
}

const initialRef = useRef<FormSnapshot | null>(null)

function currentSnapshot(): FormSnapshot {
  return {
    name, tagline, locale: drawerLocale, slug, badge, description,
    promiseValues: promiseItems.map(i => i.value),
    color, colorDark, ogImageUrl, linkedTagId,
  }
}

const isDirty = initialRef.current !== null
  && JSON.stringify(currentSnapshot()) !== JSON.stringify(initialRef.current)
```

Snapshot capturado:
- Create mode: após reset de defaults
- Edit mode: após `getNewsletterTypeForEdit` response popula state

**Confirmation dialog:**

```typescript
const [showDiscardDialog, setShowDiscardDialog] = useState(false)
const pendingCloseAction = useRef<(() => void) | null>(null)

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
  handleClose()
  pendingCloseAction.current?.()
  pendingCloseAction.current = null
}
```

Gatear em todos os 5 paths:
- Close button (✕): `onClick={() => guardedClose()}`
- Backdrop click: `onClick={() => guardedClose()}`
- Cancel button: `onClick={() => guardedClose()}`
- "Edit in Schedule tab": `onClick={() => guardedClose(() => router.push('/cms/newsletters?tab=schedule'))}`
- Escape key: `if (e.key === 'Escape') { guardedClose(); return }`

Dialog i18n strings: `unsavedTitle`, `unsavedMessage`, `keepEditing`, `discardClose`.

## 5. OG Image Default Fallback (Type Drawer)

### Problema

`type-drawer.tsx:644` só renderiza preview quando `ogImageUrl` é set. Sem fallback ao default do site.

### Fix

**Prop drilling path:**
1. `fetchSharedData` em `hub-queries.ts` — adicionar `seo_default_og_image` à query de sites
2. `NewsletterHubSharedData` type — `seoDefaultOgImage: string | null`
3. `HubClient` já recebe `sharedData` — extrair e passar
4. `TypeDrawer` ganha prop `defaultOgImage?: string | null`

**Render logic:**

```typescript
const effectiveOg = ogImageUrl || defaultOgImage || '/og-default.png'
const isDefault = !ogImageUrl
```

Quando `isDefault`:
- Preview mostra `effectiveOg` com bar "Usando padrão do site" + badge "padrão"
- Dropzone text: "Envie uma imagem para substituir o padrão"

Quando tem custom image:
- Preview mostra custom image com hover ✕ para remover
- Remover volta pro default

`type-cards.tsx` que também instancia TypeDrawer: mesma prop passada.

## 6. Security Fix: settings/page.tsx Site Scope

### Problema

`settings/page.tsx:10-14` usa `getSupabaseServiceClient()` (bypassa RLS) com NO `.eq('site_id', ...)`. Multi-site admin vê newsletter types de TODOS os sites.

### Fix

```typescript
const ctx = await getSiteContext()
const { data } = await supabase
  .from('newsletter_types')
  .select('id, name, locale, color, cadence_days, preferred_send_time, cadence_paused, ...')
  .eq('site_id', ctx.siteId)  // ADD
  .eq('active', true)
  .order('sort_order')
```

## 7. Timezone Fix: getNextDateForDay

### Problema

`cadence-card.tsx:14` usa `getUTCDay()` mas line 17 usa local `getDate()`/`setDate()`. Em BRT (-0300) perto da meia-noite, UTC day pode diferir do local day → computa "next Wednesday" errado.

### Fix

All-local (UI-facing calculation):

```typescript
function getNextDateForDay(dayIndex: number): string {
  const now = new Date()
  const current = now.getDay() // local, not UTC
  const diff = (dayIndex - current + 7) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + diff)
  return next.toISOString().slice(0, 10)
}

function getDayIndexFromDate(dateStr: string | null): number {
  if (!dateStr) return 1
  return new Date(dateStr + 'T12:00:00').getDay() // noon avoids midnight flip
}
```

Nota: `getNextDateForDay` fica no cadence-card mas será menos usado após redesign (CadencePatternForm gera datas via `generateCadenceSlots`). Manter corrigido para backward compat.

## 8. Server-Side Zod Validation

### Problema

`updateCadence` (actions.ts:902) aceita `patch` raw e passa direto para `.update(patch)`. Sem validação de formato de time, range de cadence_days, ou formato de date.

### Fix

```typescript
const UpdateCadencePatch = z.object({
  cadence_days: z.number().int().min(1).max(365).optional(),
  preferred_send_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  cadence_paused: z.boolean().optional(),
  cadence_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
```

Aplicar em:
- `updateCadence` (line 902): `const validated = UpdateCadencePatch.parse(patch)`
- `updateSendTime` (line ~1549): validar formato `HH:MM`
- `updateCadencePattern` (line ~1568): já valida que pattern gera slots — adicionar Zod schema para sendTime

## 9. i18n — Hardcoded English + Missing Keys

### hub-queries.ts:621

`describePattern(pattern, 'en')` → `describePattern(pattern, locale)`. Locale passado via `fetchScheduleData(siteId, locale)` (adicionar param).

### cadence-card.tsx:93-95

Conflitos badge: `'conflict'`/`'s'` → `s?.conflict` / `s?.conflicts` com plural handling.

### cadence-pattern-form.tsx:348

Ordinals `'1st', '2nd', '3rd', '4th'` → `cc?.ordinals?.[week-1]`.

### New i18n keys

| Key | en | pt-BR |
|---|---|---|
| `typeDrawer.unsavedTitle` | Unsaved changes | Alterações não salvas |
| `typeDrawer.unsavedMessage` | You have unsaved changes. Discard? | Você tem alterações não salvas. Descartar? |
| `typeDrawer.keepEditing` | Keep editing | Continuar editando |
| `typeDrawer.discardClose` | Discard & close | Descartar e fechar |
| `typeDrawer.slugAutoLabel` | auto | auto |
| `typeDrawer.ogDefaultLabel` | Using site default | Usando padrão do site |
| `typeDrawer.ogDefaultBadge` | default | padrão |
| `typeDrawer.ogOverrideHint` | Upload to override the default | Envie uma imagem para substituir o padrão |
| `schedule.conflict` | conflict | conflito |
| `schedule.conflicts` | conflicts | conflitos |
| `cadenceConfig.ordinals` | 1st, 2nd, 3rd, 4th | 1o, 2o, 3o, 4o |

Types em `_i18n/types.ts`: adicionar keys no `typeDrawer`, `schedule`, `cadenceConfig` interfaces.

## 10. Accessibility Fixes

### cadence-card.tsx inputs sem id/htmlFor

```
Cadence days input:  id={`cadence-days-${config.typeId}`}  + label htmlFor
Start day select:    id={`cadence-start-${config.typeId}`} + label htmlFor
Send time input:     id={`cadence-time-${config.typeId}`}  + label htmlFor
```

Após redesign (CadencePatternForm embedded), os inputs do CadencePatternForm já têm structure — verificar que pattern select e dynamic fields têm ids únicos.

### schedule-tab.tsx:100

`isPending` descartado: `const [, startTransition]` → `const [isPending, startTransition]`. Usar para disable buttons durante toggle/slot actions.

## 11. Code Quality Fixes

### schedule-tab.tsx:104-108 — Custom toast → sonner

Remover `useState<string | null>` toast state + `setTimeout(3000)` + custom div. Substituir por `toast.info()` / `toast.success()` / `toast.error()` de sonner (já importado em outros files).

### cadence-pattern-form.tsx:77 — Dead siteTimezone param

Usar no preview: exibir `"{time} {siteTimezone}"` abaixo das datas de preview.

### month-calendar.tsx:94 — Unstable useMemo ref

`slots` prop cria nova referência a cada server render. Fix: `useMemo` com `JSON.stringify(slots)` como dep, ou `useRef` comparison.

### type-drawer.tsx:307 — Fragile error matching

`result.error.includes('slug')` → checar structured error code se disponível. Se não, manter mas adicionar comment explicando a fragilidade.

## 12. Test Strategy

### New test files

**`test/cms/cadence-card.test.tsx` (12 tests):**
1. renders collapsed with pattern description + normalized time
2. renders collapsed with legacy fields when no pattern (legacyToPattern)
3. expand/collapse toggle
4. embeds CadencePatternForm when expanded
5. legacyToPattern converts 7-day to weekly
6. legacyToPattern converts 14-day to biweekly
7. legacyToPattern converts N-day to every_n_days
8. onSave calls updateCadencePattern action
9. cancel collapses without saving
10. pause toggle calls onTogglePause
11. conflicts badge renders count
12. syncs state when config prop changes

**`test/cms/newsletter-schedule-tab.test.tsx` (8 tests):**
1. renders health strip KPIs
2. renders calendar with slots
3. type filter shows only matching cadence configs
4. click date opens edition picker
5. uses sonner toast (not custom)
6. send window displays timezone
7. ready editions list renders
8. empty state when no cadence configs

**`test/cms/cadence-actions.test.ts` (10 tests):**
1. updateCadence rejects invalid cadence_days (0, 366)
2. updateCadence rejects malformed time string
3. updateCadence rejects invalid date format
4. updateCadence succeeds with valid input
5. updateCadence enforces site_id scope
6. updateSendTime rejects non-HH:MM format
7. updateSendTime succeeds with valid time
8. updateCadencePattern validates pattern generates slots
9. updateCadencePattern saves to DB
10. updateCadencePattern revalidates paths

### Expand existing

**`test/cms/newsletter-type-drawer.test.tsx` (+8 tests):**
1. slug auto-syncs on name change (create mode)
2. slug auto-syncs on name change (edit mode)
3. slug stops auto-sync after manual edit
4. shows "auto" badge when syncing
5. dirty state detects form changes
6. close with dirty state shows confirm dialog
7. confirm discard closes drawer
8. OG image shows site default when no custom image

**Total: 38 new + 20 existing = 58 tests for newsletter hub area.**

## 13. Regression Risk Mitigation

- **E2E:** Check `e2e/newsletter*.spec.ts` for cadence-card selectors — update `data-testid` if form structure changes
- **Vitest:** Existing 20 type-drawer tests must still pass — slug behavior is additive (new in edit mode, create unchanged)
- **Actions:** `updateCadence` kept for backward compat — cadence-card switches to `updateCadencePattern` but old action still works
- **Data:** Legacy types render via `legacyToPattern()` — no data migration
- **CI:** Full `npm test` (web + api) per CLAUDE.md

## 14. Files Modified

| File | Changes |
|---|---|
| `apps/web/src/lib/newsletter/format.ts` | Add `normalizeTime()` |
| `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-queries.ts` | normalizeTime in cadenceConfigs, locale param, seoDefaultOgImage in shared data |
| `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts` | CadenceConfig.cadencePattern, NewsletterHubSharedData.seoDefaultOgImage |
| `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/cadence-card.tsx` | Embed CadencePatternForm, normalizeTime, legacyToPattern, a11y, locale, siteTimezone |
| `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/schedule-tab.tsx` | Pass locale+tz to CadenceCard, replace custom toast with sonner, use isPending |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx` | slugTouched, isDirty, confirm dialog, defaultOgImage, i18n keys |
| `apps/web/src/app/cms/(authed)/newsletters/_components/cadence-pattern-form.tsx` | normalizeTime, use siteTimezone, i18n ordinals |
| `apps/web/src/app/cms/(authed)/newsletters/settings/page.tsx` | site_id filter, normalizeTime |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | Zod validation for updateCadence, updateSendTime, updateCadencePattern |
| `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx` | Pass defaultOgImage to TypeDrawer |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-cards.tsx` | Pass defaultOgImage to TypeDrawer |
| `apps/web/src/app/cms/(authed)/newsletters/_tabs/schedule/month-calendar.tsx` | Stable useMemo |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts` | 11 new keys |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts` | 11 new keys |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts` | Type definitions for new keys |
| `apps/web/src/app/cms/(authed)/newsletters/page.tsx` | Pass locale to fetchScheduleData |
| `apps/web/test/cms/cadence-card.test.tsx` | NEW — 12 tests |
| `apps/web/test/cms/newsletter-schedule-tab.test.tsx` | NEW — 8 tests |
| `apps/web/test/cms/cadence-actions.test.ts` | NEW — 10 tests |
| `apps/web/test/cms/newsletter-type-drawer.test.tsx` | +8 tests |

**20 files modified, 3 new test files, 0 migrations.**
