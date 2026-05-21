# Newsletter Test Center — Design Spec

## Summary

A new "Test Center" tab in the Newsletter Hub CMS panel that centralizes testing of the full newsletter workflow: previewing and sending test emails (Confirm, Welcome, Edition), and quick-linking to all 16 page states (Confirm + Unsubscribe) — without polluting production data or history.

**Scope:** Single-user personal CMS. No multi-user features, no analytics, no history tracking.

**Budget:** ~4-6h implementation.

---

## Architecture

### Tab Integration

Add `'test-center'` to the existing `TabId` union in `hub-types.ts`. Add entry to `TABS` array in `hub-client.tsx` with `FlaskConical` icon (lucide-react). Hide `TypeFilterChips` row when `tab === 'test-center'`.

### Layout

- **Desktop (lg+):** 2-column grid `grid-cols-[280px_1fr]` — left controls, right preview
- **Mobile (<lg):** Single column, controls stacked above preview. Template selector becomes horizontal segmented control.

### Components

```
_tabs/test-center/
  test-center-tab.tsx       # Main tab container
  template-selector.tsx     # Segmented radio group (3 templates)
  edition-controls.tsx      # Type + edition selects (enabled only for Edition)
  test-send-card.tsx        # Locked email display + send button + cooldown
  page-state-links.tsx      # Chips linking to preview routes
```

### Preview Routes (CMS-only, behind auth)

```
app/cms/(authed)/newsletters/_preview/
  confirm/[state]/page.tsx      # Renders ConfirmLayout with mock props
  unsubscribe/[state]/page.tsx  # Renders UnsubscribeLayout with mock props
```

These import extracted layout components and render them with hardcoded mock data per state. No DB access, no query params on public pages.

### Layout Extraction

Extract `ConfirmLayout` from `app/newsletter/confirm/[token]/page.tsx` (lines ~151-474) into:
```
app/newsletter/confirm/[token]/_layouts/confirm-layout.tsx
```

Extract `UnsubscribeLayout` from `app/unsubscribe/[token]/page.tsx` into:
```
app/unsubscribe/[token]/_layouts/unsubscribe-layout.tsx
```

Original pages import from the extracted module. CMS preview routes also import them.

---

## Server Actions

### `renderTestTemplate`

```typescript
export async function renderTestTemplate(
  template: 'confirm' | 'welcome' | 'edition',
  locale: 'pt-BR' | 'en',
  opts?: { editionId?: string; typeId?: string }
): Promise<{ ok: true; html: string; sizeBytes: number } | { ok: false; error: string }>
```

**Auth:** `requireSiteAdmin(siteId)` via session.

**No rate limit** (preview only, no SES call).

**Mock data per template:**

| Template | Mock Props |
|----------|-----------|
| `confirm` | `{ confirmUrl: '#mock', locale, newsletterNames: ['Diário de Bordo', 'Tech Drops'] }` |
| `welcome` | `{ locale, newsletterNames: [{ name: 'Diário de Bordo', tagline: 'Reflexões semanais', color: '#FF8240' }, { name: 'Tech Drops', tagline: 'Links + dicas tech', color: '#3b82f6' }], latestArticle: { title: 'Mock Article Title', url: '#mock', excerpt: 'Preview excerpt...' }, unsubscribeUrl: '#mock', archiveUrl: '#mock' }` |
| `edition` | Uses existing `renderEmailPreview(editionId)` logic — fetches real edition data. Falls back to latest draft if no `editionId`. |

### `sendTestTemplate`

```typescript
export async function sendTestTemplate(
  template: 'confirm' | 'welcome' | 'edition',
  locale: 'pt-BR' | 'en',
  opts?: { editionId?: string }
): Promise<{ ok: true } | { ok: false; error: string }>
```

**Auth:** `requireSiteAdmin(siteId)` via session.

**Rate limit:** 60s cooldown (shared with existing `sendTestEmail`). Uses `test_sent_at` column on the user's profile or a per-session timestamp check. Returns `{ ok: false, error: 'rate_limited' }`.

**Hourly cap:** 10 sends/hour per user (soft check via count query on `newsletter_test_log` or in-memory counter). Not critical to enforce strictly for single user — can be a simple counter.

**Relationship to existing `sendTestEmail`:** `sendTestTemplate` is a new action that **wraps** the existing pattern. For `template === 'edition'`, it delegates to the same logic as `sendTestEmail` (render Newsletter component + sanitize + SES send). For `confirm`/`welcome`, it renders the respective React Email template with mock data and sends via the same SES transport. The existing `sendTestEmail` remains unchanged (used by the edition detail page).

**Email recipient:** Always `user.email` from session — not configurable. UI shows locked field with padlock icon for clarity.

**Subject prefixes:**
- Confirm: `[TEST] Confirme sua inscrição`
- Welcome: `[TEST] Bem-vindo!` / `[TEST] Welcome!`
- Edition: `[TEST] ${edition.subject}` (existing behavior)

---

## Page State Preview Routes

### How they work

Each route (`_preview/confirm/[state]/page.tsx`, `_preview/unsubscribe/[state]/page.tsx`) is a Next.js page under the CMS `(authed)` layout group. It:

1. Validates `state` param against the known `StateKind` union + `'loading'` + `'error-boundary'`
2. Imports the extracted layout component (`ConfirmLayout` / `UnsubscribeLayout`)
3. Passes mock props that produce the desired visual state
4. Renders directly — no DB calls, no tokens, no side effects

### States covered

**Confirm (8):** `success`, `already`, `expired`, `not_found`, `error`, `invalid`, `loading`, `error-boundary`

**Unsubscribe (8):** `initial`, `ok`, `already`, `not_found`, `error`, `invalid`, `loading`, `error-boundary`

### Mock props per state

Confirm:
- `success`: `{ state: 'success', newsletterNames: [...], locale: 'pt-BR' }`
- `already`: `{ state: 'already', locale: 'pt-BR' }`
- `expired`: `{ state: 'expired', locale: 'pt-BR' }`
- `not_found`: `{ state: 'not_found', locale: 'pt-BR' }`
- `error`: `{ state: 'error', locale: 'pt-BR' }`
- `invalid`: `{ state: 'invalid', locale: 'pt-BR' }`
- `loading`: Renders the `loading.tsx` Suspense fallback component
- `error-boundary`: Renders the `error.tsx` error boundary component

Unsubscribe:
- `initial`: `{ state: 'initial', newsletterName: 'Diário de Bordo', locale: 'pt-BR' }`
- `ok`: `{ state: 'ok', locale: 'pt-BR' }`
- `already`: `{ state: 'already', locale: 'pt-BR' }`
- `not_found`: `{ state: 'not_found', locale: 'pt-BR' }`
- `error`: `{ state: 'error', locale: 'pt-BR' }`
- `invalid`: `{ state: 'invalid', locale: 'pt-BR' }`
- `loading`: Renders the `loading.tsx` Suspense fallback
- `error-boundary`: Renders the `error.tsx` error boundary

---

## UI Design

### Visual Specifications

All values match the existing CMS design system:

| Element | Value |
|---------|-------|
| Page bg | `bg-[#030712]` |
| Cards | `bg-gray-900` (#111827), `border-gray-800` (#1f2937), `rounded-[10px]` |
| Tab font | `text-[11px] font-medium` (weight 500) |
| Active tab | `border-indigo-500 text-indigo-400` (#818cf8) |
| Inactive tab | `text-gray-500` (#6b7280) |
| Icons | 14px, all tabs have icons |
| Section labels | `text-[11px] uppercase tracking-wider font-semibold text-gray-500` |
| Active radio | `bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-medium` |
| Inactive radio | `bg-[#0a0f1a] border-gray-800 text-gray-400` |
| Send button | `bg-indigo-600 text-white font-semibold text-xs rounded-md` |
| Preview toolbar | Same as `EmailPreview`: `text-xs` (12px), `px-2 py-1`, active `bg-indigo-500/15 text-indigo-400 font-medium` |
| SummaryBar | `sticky bottom-0`, `bg-gray-900`, `border-t border-gray-800`, `px-6 py-2`, left `text-gray-400`, right `text-gray-500` |

### Interaction States

1. **Default:** Send button enabled with indigo bg
2. **Sending:** Button disabled, text "Sending...", pulse indicator, "Delivering via SES" helper text
3. **Success:** Toast notification (green bg, checkmark icon, template name + recipient)
4. **Cooldown:** Button disabled with gray bg, countdown timer "(47s)", "Wait for cooldown" helper
5. **Error:** Toast notification (red bg, X icon, error message)

### Accessibility

- Tab bar: `role="tablist"` with `aria-label="Newsletter hub tabs"`, each tab `role="tab"` + `aria-selected`
- Template selector: `role="radiogroup"` + `aria-label="Email template"`, each option `role="radio"` + `aria-checked`
- Locale toggle: `role="radiogroup"` + `aria-label="Email locale"`
- Preview viewport: `role="radiogroup"` + `aria-label="Preview viewport"`
- Page state chips: `role="button"` with descriptive `aria-label` (e.g., "Preview confirm page: success")
- Email field: `aria-label="Recipient email (locked to admin)"`
- Preview area: `role="region" aria-label="Email preview"`
- SummaryBar: `role="status"`
- Disabled edition controls: `aria-disabled="true"` on container

### SummaryBar Content

Left: `3 templates · 16 page states · Send locked to admin email`
Right: `60s cooldown · 10/hr limit`

---

## Email Preview

Reuses the existing `EmailPreview` component pattern (iframe with `srcDoc={html}` and `sandbox="allow-same-origin"`). Desktop viewport 600px, mobile 375px toggle.

Additional info shown:
- Email size in KB (from `sizeBytes` in render response)
- Refresh button to re-render

Preview auto-renders on template/locale change. No manual "Render" button needed.

---

## Constraints & Non-Goals

- **No DB writes** for test sends (no entries in `newsletter_editions_sent`, no subscriber creation)
- **No subscription management** (no test subscribe/unsubscribe flows — page state previews cover visual testing)
- **No email history** (no log of test sends beyond rate-limit tracking)
- **No dark mode email preview toggle** (emails use system preference, not a CMS toggle)
- **No source/HTML view** (unnecessary for single user — browser DevTools suffices)
- **No keyboard shortcuts** (YAGNI for single user)
- **No HealthStrip** (no metrics to show for a testing tool)

---

## Known Issue (Separate Scope)

`sanitizeForEmail()` in `lib/newsletter/email-sanitizer.ts` strips all `@media (prefers-color-scheme: dark)` CSS blocks via `preserveMediaQueries: false` + `<style>` tag removal. This is a production bug affecting edition emails but is **not** part of the Test Center scope. Track and fix independently.

---

## i18n

Extend `NewsletterHubStrings` in the hub i18n file with Test Center labels. Minimal set:
- Tab label: "Test Center"
- Section headers: "Template", "Edition", "Locale", "Send Test", "Page States"
- Button: "Send Test Email"
- States: "Sending...", "Test sent", "Wait for cooldown"
- Errors: "Rate limited", "Failed to send"

---

## Success Criteria

1. Can preview all 3 email templates in both locales without sending
2. Can send test email for any template to admin inbox
3. Can open all 16 page states in new tabs via one-click links
4. No production data pollution (no subscriber records, no edition history entries)
5. Fits visually within existing hub tab patterns (indistinguishable from other tabs)
6. All existing tests pass (`npm test`)
