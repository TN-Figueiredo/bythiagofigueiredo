# Newsletter Test Center — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Test Center" tab to the Newsletter Hub CMS that previews/sends test emails and links to all 16 page states.

**Architecture:** New tab in existing hub tab system. Server actions render email templates with mock data and send via SES. Preview routes under `(authed)` render extracted layout components with mock props per state. No DB writes, no production pollution.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, React Email, Supabase service client, Lucide icons

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `_hub/hub-types.ts` | Add `'test-center'` to `TabId` union |
| Modify | `_hub/hub-client.tsx` | Add tab entry, hide `TypeFilterChips` for test-center |
| Modify | `_i18n/types.ts` | Add `'test-center'` tab key + `testCenter` section to `NewsletterHubStrings` |
| Modify | `_i18n/en.ts` | Add English Test Center strings |
| Modify | `_i18n/pt-BR.ts` | Add pt-BR Test Center strings |
| Modify | `page.tsx` (hub) | Add `test-center` case to `TabContent` |
| Create | `_tabs/test-center/test-center-tab.tsx` | Main tab container (2-col grid + preview) |
| Create | `_tabs/test-center/template-selector.tsx` | Segmented radio for confirm/welcome/edition |
| Create | `_tabs/test-center/edition-controls.tsx` | Type + edition selects (edition template only) |
| Create | `_tabs/test-center/test-send-card.tsx` | Locked email + send button + cooldown |
| Create | `_tabs/test-center/page-state-links.tsx` | Chips linking to preview routes (16 states) |
| Create | `actions-test-center.ts` | `renderTestTemplate` + `sendTestTemplate` server actions |
| Create | `confirm/[token]/_layouts/confirm-layout.tsx` | Extracted `ConfirmLayout` + helpers |
| Modify | `confirm/[token]/page.tsx` | Import `ConfirmLayout` from extracted module |
| Create | `unsubscribe/[token]/_layouts/unsubscribe-layout.tsx` | Extracted `UnsubscribeLayout` + helpers |
| Modify | `unsubscribe/[token]/page.tsx` | Import `UnsubscribeLayout` from extracted module |
| Create | `preview/confirm/[state]/page.tsx` | CMS preview route for 8 confirm states |
| Create | `preview/confirm/[state]/error-preview.tsx` | Client wrapper for error boundary preview |
| Create | `preview/unsubscribe/[state]/page.tsx` | CMS preview route for 8 unsubscribe states |
| Create | `preview/unsubscribe/[state]/error-preview.tsx` | Client wrapper for error boundary preview |
| Create | `test/unit/newsletter/test-center-actions.test.ts` | Unit tests for server actions |

**Path prefix note:** All `_hub/`, `_i18n/`, `_tabs/`, `_components/`, `preview/`, `actions*` paths are relative to `apps/web/src/app/cms/(authed)/newsletters/`. All `confirm/`, `unsubscribe/` paths are relative to `apps/web/src/app/newsletter/` and `apps/web/src/app/` respectively.

---

### Task 1: Add `test-center` to TabId union and i18n types

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-types.ts:1`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/types.ts:2`

- [ ] **Step 1: Update TabId union**

In `hub-types.ts`, line 1:

```typescript
// Before:
export type TabId = 'overview' | 'editorial' | 'schedule' | 'automations' | 'audience'

// After:
export type TabId = 'overview' | 'editorial' | 'schedule' | 'automations' | 'audience' | 'test-center'
```

- [ ] **Step 2: Add testCenter section to NewsletterHubStrings**

In `_i18n/types.ts`, add `'test-center'` to the `tabs` property (must be kebab-case to match `TabId`, since `tabLabels: Record<TabId, string>` lookups use `tab.id` as key) and add a new `testCenter` section. The `tabs` property on line 2:

```typescript
// Before:
tabs: { overview: string; editorial: string; schedule: string; automations: string; audience: string }

// After:
tabs: { overview: string; editorial: string; schedule: string; automations: string; audience: string; 'test-center': string }
```

Add after the `typeDrawer` section (before closing `}`):

```typescript
  testCenter: {
    template: string
    edition: string
    locale: string
    sendTest: string
    pageStates: string
    sendTestEmail: string
    sending: string
    testSent: string
    waitCooldown: string
    rateLimited: string
    failedToSend: string
    confirmStates: string
    unsubscribeStates: string
    emailSize: string
    refresh: string
    noEditions: string
    selectType: string
    selectEdition: string
    recipientLocked: string
    summaryStats: string
    deliveringViaSes: string
  }
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: Type errors in `en.ts`, `pt-BR.ts`, `hub-client.tsx`, and `page.tsx` (missing `testCenter` key). This is correct — we'll fix them in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_hub/hub-types.ts apps/web/src/app/cms/\(authed\)/newsletters/_i18n/types.ts
git commit -m "feat(test-center): add test-center to TabId union and i18n types"
```

---

### Task 2: Add i18n strings for Test Center (en + pt-BR)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/en.ts:4`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_i18n/pt-BR.ts:4`

- [ ] **Step 1: Add testCenter to en.ts tabs**

In `en.ts`, line 4, change the `tabs` property (key must be `'test-center'` kebab-case to match `TabId`):

```typescript
// Before:
tabs: { overview: 'Overview', editorial: 'Editorial', schedule: 'Schedule', automations: 'Automations', audience: 'Audience' },

// After:
tabs: { overview: 'Overview', editorial: 'Editorial', schedule: 'Schedule', automations: 'Automations', audience: 'Audience', 'test-center': 'Test Center' },
```

- [ ] **Step 2: Add testCenter section to en.ts**

Add before the closing `}` of the `en` object (after `typeDrawer` section):

```typescript
  testCenter: {
    template: 'Template',
    edition: 'Edition',
    locale: 'Locale',
    sendTest: 'Send Test',
    pageStates: 'Page States',
    sendTestEmail: 'Send Test Email',
    sending: 'Sending...',
    testSent: 'Test sent!',
    waitCooldown: 'Wait for cooldown',
    rateLimited: 'Rate limited — wait 60s',
    failedToSend: 'Failed to send',
    confirmStates: 'Confirm',
    unsubscribeStates: 'Unsubscribe',
    emailSize: 'Size',
    refresh: 'Refresh',
    noEditions: 'No editions available',
    selectType: 'Select type',
    selectEdition: 'Select edition',
    recipientLocked: 'Locked to admin email',
    summaryStats: '3 templates · 16 page states · Send locked to admin email · 60s cooldown · 10/hr limit',
    deliveringViaSes: 'Delivering via SES',
  },
```

- [ ] **Step 3: Add testCenter to pt-BR.ts tabs**

In `pt-BR.ts`, line 4, change the `tabs` property (key must be `'test-center'` kebab-case to match `TabId`):

```typescript
// Before:
tabs: { overview: 'Visão Geral', editorial: 'Editorial', schedule: 'Agenda', automations: 'Automações', audience: 'Audiência' },

// After:
tabs: { overview: 'Visão Geral', editorial: 'Editorial', schedule: 'Agenda', automations: 'Automações', audience: 'Audiência', 'test-center': 'Test Center' },
```

- [ ] **Step 4: Add testCenter section to pt-BR.ts**

Add before the closing `}` of the `ptBR` object (after `typeDrawer` section):

```typescript
  testCenter: {
    template: 'Template',
    edition: 'Edição',
    locale: 'Idioma',
    sendTest: 'Enviar Teste',
    pageStates: 'Estados de Página',
    sendTestEmail: 'Enviar Email de Teste',
    sending: 'Enviando...',
    testSent: 'Teste enviado!',
    waitCooldown: 'Aguarde o cooldown',
    rateLimited: 'Limite atingido — aguarde 60s',
    failedToSend: 'Falha ao enviar',
    confirmStates: 'Confirmação',
    unsubscribeStates: 'Cancelamento',
    emailSize: 'Tamanho',
    refresh: 'Atualizar',
    noEditions: 'Nenhuma edição disponível',
    selectType: 'Selecionar tipo',
    selectEdition: 'Selecionar edição',
    recipientLocked: 'Destinatário fixo (email admin)',
    summaryStats: '3 templates · 16 estados de página · Envio restrito ao email admin · cooldown 60s · limite 10/hr',
    deliveringViaSes: 'Entregando via SES',
  },
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_i18n/en.ts apps/web/src/app/cms/\(authed\)/newsletters/_i18n/pt-BR.ts
git commit -m "feat(test-center): add en + pt-BR i18n strings"
```

---

### Task 3: Wire test-center tab into hub-client.tsx and page.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_hub/hub-client.tsx:6,14-20,162-173`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx:62-88`

- [ ] **Step 1: Add FlaskConical import and tab entry in hub-client.tsx**

In `hub-client.tsx`, line 6, add `FlaskConical` to the lucide-react import:

```typescript
// Before:
import { BarChart3, Kanban, CalendarDays, Workflow, Users, Plus, Bell, Loader2 } from 'lucide-react'

// After:
import { BarChart3, Kanban, CalendarDays, Workflow, Users, FlaskConical, Plus, Bell, Loader2 } from 'lucide-react'
```

Add the test-center entry to the `TABS` array (line 19, after audience):

```typescript
const TABS: Array<{ id: TabId; icon: typeof BarChart3 }> = [
  { id: 'overview', icon: BarChart3 },
  { id: 'editorial', icon: Kanban },
  { id: 'schedule', icon: CalendarDays },
  { id: 'automations', icon: Workflow },
  { id: 'audience', icon: Users },
  { id: 'test-center', icon: FlaskConical },
]
```

- [ ] **Step 2: Hide TypeFilterChips when test-center is active**

In `hub-client.tsx`, around line 162-173, wrap `TypeFilterChips` in a conditional:

```typescript
// Before:
      <div className="px-4 pt-3 md:px-7">
        <TypeFilterChips

// After:
      {activeTab !== 'test-center' && (
        <div className="px-4 pt-3 md:px-7">
          <TypeFilterChips
```

And close the conditional after the closing `</div>` of that block:

```typescript
// Before:
        />
      </div>

// After:
          />
        </div>
      )}
```

- [ ] **Step 3: Create placeholder TestCenterTab component**

Create `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/test-center-tab.tsx`:

```typescript
'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

interface TestCenterTabProps {
  strings: NewsletterHubStrings
  locale: 'en' | 'pt-BR'
  userEmail: string
  types: Array<{ id: string; name: string; color: string }>
}

export function TestCenterTab({ strings }: TestCenterTabProps) {
  return (
    <div className="text-gray-400 text-sm py-8 text-center">
      {strings.tabs['test-center']} — under construction
    </div>
  )
}
```

- [ ] **Step 4: Add test-center case to TabContent in page.tsx**

In `page.tsx`, add the import at the top (after AudienceTab import, line 21):

```typescript
import { TestCenterTab } from './_tabs/test-center/test-center-tab'
```

In the `TabContent` function switch statement (around line 84), add before `default`:

```typescript
    case 'test-center': {
      const userClient = (await import('@supabase/ssr')).createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { async getAll() { return (await (await import('next/headers')).cookies()).getAll() }, async setAll() {} } },
      )
      const { data: { user } } = await userClient.auth.getUser()
      return <TestCenterTab strings={strings} locale={locale} userEmail={user?.email ?? ''} types={types.map(t => ({ id: t.id, name: t.name, color: t.color }))} />
    }
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run test/unit/newsletter/format.test.ts --reporter=verbose 2>&1 | tail -10`

Expected: PASS (no regressions from type changes)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_hub/hub-client.tsx apps/web/src/app/cms/\(authed\)/newsletters/page.tsx apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/test-center-tab.tsx
git commit -m "feat(test-center): wire test-center tab into hub with placeholder"
```

---

### Task 4: Extract ConfirmLayout to shared module

**Files:**
- Create: `apps/web/src/app/newsletter/confirm/[token]/_layouts/confirm-layout.tsx`
- Modify: `apps/web/src/app/newsletter/confirm/[token]/page.tsx`

- [ ] **Step 1: Create the extracted confirm-layout.tsx**

Create `apps/web/src/app/newsletter/confirm/[token]/_layouts/confirm-layout.tsx`. This file must contain:

1. The `StateKind` type
2. The `STATE_CONFIG` constant
3. The `NlType` interface (for newsletter list props)
4. The `localePath` helper
5. The `ConfirmLayout` component (the entire JSX tree from the original, lines ~160-484)

Read the full `page.tsx` to extract lines 99-108 (StateKind + STATE_CONFIG) and lines 152-484 (localePath + ConfirmLayout). The extracted file should export `ConfirmLayout`, `StateKind`, and `NlType`:

```typescript
import React from 'react'

export type StateKind = 'success' | 'already' | 'expired' | 'not_found' | 'error' | 'invalid'

export interface NlType {
  name: string
  tagline: string | null
  color: string
  colorDark: string | null
  cadenceLabel: string | null
}

const STATE_CONFIG: Record<StateKind, { accent: string; icon: string; shimmer: boolean }> = {
  success:   { accent: '#FF8240', icon: '❦', shimmer: true },
  already:   { accent: '#FF8240', icon: '❦', shimmer: false },
  expired:   { accent: '#E5A100', icon: '⏳', shimmer: false },
  not_found: { accent: '#958A75', icon: '⁇', shimmer: false },
  error:     { accent: '#C14513', icon: '⚠', shimmer: false },
  invalid:   { accent: '#C14513', icon: '✕', shimmer: false },
}

function localePath(locale: string | undefined): string {
  return locale === 'pt-BR' ? '/pt/' : '/'
}

// ... paste the full ConfirmLayout function body here (lines 160-484 from page.tsx)
export function ConfirmLayout({ ... }: ConfirmLayoutProps) {
  // exact same implementation
}
```

**IMPORTANT:** Copy the **entire** ConfirmLayout function body verbatim from `page.tsx`. Do not abbreviate. The component is ~324 lines.

- [ ] **Step 2: Update page.tsx to import from extracted module**

In `page.tsx`, remove:
- The `StateKind` type (line 99)
- The `STATE_CONFIG` const (lines 101-108)
- The `NlType` interface (lines 28-34)
- The `localePath` function (lines 154-156)
- The entire `ConfirmLayout` function (lines 160-484)

Add import at the top:

```typescript
import { ConfirmLayout, type StateKind, type NlType } from './_layouts/confirm-layout'
```

`localePath` is used by both `ConfirmLayout` and the main page component. **Export** it from `confirm-layout.tsx` and import it in `page.tsx` too.

- [ ] **Step 3: Verify the page still works**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "confirm" | head -10`

Expected: No type errors in the confirm directory.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run 2>&1 | tail -5`

Expected: All tests pass (no test files directly test ConfirmLayout)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/newsletter/confirm/[token]/_layouts/confirm-layout.tsx" "apps/web/src/app/newsletter/confirm/[token]/page.tsx"
git commit -m "refactor(newsletter): extract ConfirmLayout to shared module"
```

---

### Task 5: Extract UnsubscribeLayout to shared module

**Files:**
- Create: `apps/web/src/app/unsubscribe/[token]/_layouts/unsubscribe-layout.tsx`
- Modify: `apps/web/src/app/unsubscribe/[token]/page.tsx`

- [ ] **Step 1: Create the extracted unsubscribe-layout.tsx**

Create `apps/web/src/app/unsubscribe/[token]/_layouts/unsubscribe-layout.tsx`. This file must contain:

1. The `StateKind` type (line 109 of original: `'initial' | 'ok' | 'already' | 'not_found' | 'error' | 'invalid'`)
2. The `STATE_CONFIG` constant (lines 111-118)
3. The inline styles object `s` (lines 122-~428)
4. All helper components used by UnsubscribeLayout: `ResponsiveStyles`, `GrainOverlay`, `Monogram`, `EndMark` (find them in the file — they're defined inline)
5. The `localePath` helper (line 437-439)
6. The `UnsubscribeLayout` component (lines 441-553)

Read the full `page.tsx` to extract all of these. Export `UnsubscribeLayout`, `StateKind`.

**IMPORTANT:** Copy the **entire** component and all its inline dependencies verbatim. The unsubscribe page uses inline `style` objects extensively (the `s` constant). All must be included. The `UnsubscribeLayout` props interface MUST include `form?: React.ReactNode` — this prop is used by both the original page (passes `<UnsubscribeForm>`) and by the CMS preview route in Task 13 (passes a mock button). Verify the extracted interface matches the original:

```typescript
interface UnsubscribeLayoutProps {
  state: StateKind
  title: string
  body: string
  backLabel: string
  manageLabel?: string
  lang?: string
  locale?: string
  signoff?: string
  form?: React.ReactNode
}
```

- [ ] **Step 2: Update page.tsx to import from extracted module**

In `page.tsx`, remove the extracted code (StateKind, STATE_CONFIG, `s`, helper components, `localePath`, UnsubscribeLayout). Add import:

```typescript
import { UnsubscribeLayout, type StateKind } from './_layouts/unsubscribe-layout'
```

Keep the main `UnsubscribePage` function and its form component (`UnsubscribeForm`) — those stay in `page.tsx` since they handle server logic.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "unsubscribe" | head -10`

Expected: No type errors.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run 2>&1 | tail -5`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/unsubscribe/[token]/_layouts/unsubscribe-layout.tsx" "apps/web/src/app/unsubscribe/[token]/page.tsx"
git commit -m "refactor(newsletter): extract UnsubscribeLayout to shared module"
```

---

### Task 6: Create `renderTestTemplate` and `sendTestTemplate` server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/actions-test-center.ts`
- Test: `apps/web/test/unit/newsletter/test-center-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/unit/newsletter/test-center-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'admin@test.com' } } }) },
  }),
}))

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: vi.fn() }),
}))

vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('../../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn(),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>mock</html>'),
}))

vi.mock('../../../src/emails/confirm', () => ({
  ConfirmEmail: vi.fn(() => null),
}))

vi.mock('../../../src/emails/welcome', () => ({
  WelcomeEmail: vi.fn(() => null),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) }),
}))

import { renderTestTemplate, sendTestTemplate } from '../../../src/app/cms/(authed)/newsletters/actions-test-center'
import { getEmailService } from '../../../lib/email/service'

describe('renderTestTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders confirm template with mock data', async () => {
    const result = await renderTestTemplate('confirm', 'pt-BR')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.html).toBe('<html>mock</html>')
      expect(result.sizeBytes).toBeGreaterThan(0)
    }
  })

  it('renders welcome template with mock data', async () => {
    const result = await renderTestTemplate('welcome', 'en')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.html).toBe('<html>mock</html>')
    }
  })

  it('renders edition template (delegates to renderEmailPreview)', async () => {
    // Mock the dynamic import of actions.renderEmailPreview
    vi.mock('../../../src/app/cms/(authed)/newsletters/actions', () => ({
      renderEmailPreview: vi.fn().mockResolvedValue({ ok: true, html: '<html>edition</html>' }),
    }))

    const supabaseFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ed-1' }, error: null }),
              }),
            }),
          }),
        }),
      }),
    })
    const { getSupabaseServiceClient } = await import('../../../lib/supabase/service')
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: supabaseFrom } as any)

    const result = await renderTestTemplate('edition', 'pt-BR')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.html).toBe('<html>edition</html>')
    }
  })

  it('returns error for invalid template', async () => {
    const result = await renderTestTemplate('invalid' as any, 'pt-BR')
    expect(result).toEqual({ ok: false, error: 'invalid_template' })
  })
})

describe('sendTestTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends confirm email to admin', async () => {
    const result = await sendTestTemplate('confirm', 'pt-BR')
    expect(result).toEqual({ ok: true })
    const sentCall = (getEmailService().send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sentCall.subject).toContain('[TEST]')
  })

  it('returns rate_limited on rapid calls', async () => {
    // Both calls in same test to ensure module-level Map state is sequential
    await sendTestTemplate('confirm', 'pt-BR')
    const second = await sendTestTemplate('confirm', 'pt-BR')
    expect(second).toEqual({ ok: false, error: 'rate_limited' })
  })

  it('returns no_user_email when user has no email', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    } as any)
    const result = await sendTestTemplate('confirm', 'en')
    expect(result).toEqual({ ok: false, error: 'no_user_email' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/newsletter/test-center-actions.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: FAIL — module `actions-test-center` does not exist yet.

- [ ] **Step 3: Implement the server actions**

Create `apps/web/src/app/cms/(authed)/newsletters/actions-test-center.ts`:

```typescript
'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { render } from '@react-email/render'
import { ConfirmEmail } from '@/emails/confirm'
import { WelcomeEmail } from '@/emails/welcome'
import { Newsletter } from '@/emails/newsletter'
import { getEmailService } from '@/lib/email/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type RenderResult = { ok: true; html: string; sizeBytes: number } | { ok: false; error: string }
type SendResult = { ok: true } | { ok: false; error: string }

const lastSendTimestamps = new Map<string, number>()
const hourlySendCounts = new Map<string, { count: number; windowStart: number }>()

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { async getAll() { return cookieStore.getAll() }, async setAll() {} } },
  )
  const { data: { user } } = await client.auth.getUser()
  return user
}

export async function renderTestTemplate(
  template: 'confirm' | 'welcome' | 'edition',
  locale: 'pt-BR' | 'en',
  opts?: { editionId?: string; typeId?: string },
): Promise<RenderResult> {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  let html: string

  switch (template) {
    case 'confirm': {
      html = await render(ConfirmEmail({
        confirmUrl: '#mock-confirm-url',
        locale,
        newsletterNames: ['Diário de Bordo', 'Tech Drops'],
      }))
      break
    }
    case 'welcome': {
      html = await render(WelcomeEmail({
        locale,
        newsletterNames: [
          { name: 'Diário de Bordo', tagline: 'Reflexões semanais', color: '#FF8240' },
          { name: 'Tech Drops', tagline: 'Links + dicas tech', color: '#3b82f6' },
        ],
        latestArticle: {
          title: locale === 'pt-BR' ? 'Artigo de Exemplo' : 'Sample Article',
          url: '#mock-article',
          excerpt: locale === 'pt-BR'
            ? 'Este é um preview de exemplo para o Test Center...'
            : 'This is a sample preview for the Test Center...',
        },
        unsubscribeUrl: '#mock-unsubscribe',
        archiveUrl: '#mock-archive',
      }))
      break
    }
    case 'edition': {
      if (!opts?.editionId) {
        const supabase = getSupabaseServiceClient()
        const { data: latest } = await supabase
          .from('newsletter_editions')
          .select('id')
          .eq('site_id', ctx.siteId)
          .in('status', ['draft', 'ready', 'idea'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!latest) return { ok: false, error: 'no_editions' }
        opts = { ...opts, editionId: latest.id }
      }

      const { renderEmailPreview } = await import('./actions')
      const result = await renderEmailPreview(opts.editionId!)
      if (!result.ok) return result
      html = result.html
      break
    }
    default:
      return { ok: false, error: 'invalid_template' }
  }

  return { ok: true, html, sizeBytes: new TextEncoder().encode(html).length }
}

export async function sendTestTemplate(
  template: 'confirm' | 'welcome' | 'edition',
  locale: 'pt-BR' | 'en',
  opts?: { editionId?: string },
): Promise<SendResult> {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

  const user = await getAuthenticatedUser()
  if (!user?.email) return { ok: false, error: 'no_user_email' }
  const toEmail = user.email

  const now = Date.now()
  const lastSent = lastSendTimestamps.get(user.id) ?? 0
  if (now - lastSent < 60_000) return { ok: false, error: 'rate_limited' }

  const hourly = hourlySendCounts.get(user.id)
  if (hourly && now - hourly.windowStart < 3_600_000 && hourly.count >= 10) {
    return { ok: false, error: 'hourly_limit' }
  }

  const renderResult = await renderTestTemplate(template, locale, opts)
  if (!renderResult.ok) return { ok: false, error: renderResult.error }

  let subject: string
  if (template === 'confirm') {
    subject = locale === 'pt-BR' ? '[TEST] Confirme sua inscrição' : '[TEST] Confirm your subscription'
  } else if (template === 'welcome') {
    subject = locale === 'pt-BR' ? '[TEST] Bem-vindo!' : '[TEST] Welcome!'
  } else {
    const supabase = getSupabaseServiceClient()
    const editionId = opts?.editionId
    if (editionId) {
      const { data: ed } = await supabase.from('newsletter_editions').select('subject').eq('id', editionId).single()
      subject = `[TEST] ${ed?.subject ?? 'Edition Preview'}`
    } else {
      subject = '[TEST] Edition Preview'
    }
  }

  try {
    const emailService = getEmailService()
    await emailService.send({
      from: { name: 'Thiago Figueiredo', email: `newsletter@${process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'}` },
      to: toEmail,
      subject,
      html: renderResult.html,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'email_send_failed'
    return { ok: false, error: message }
  }

  lastSendTimestamps.set(user.id, now)
  if (!hourly || now - hourly.windowStart >= 3_600_000) {
    hourlySendCounts.set(user.id, { count: 1, windowStart: now })
  } else {
    hourly.count++
  }

  return { ok: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/newsletter/test-center-actions.test.ts --reporter=verbose 2>&1 | tail -15`

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Run full test suite**

Run: `npm run test:web 2>&1 | tail -5`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/actions-test-center.ts apps/web/test/unit/newsletter/test-center-actions.test.ts
git commit -m "feat(test-center): renderTestTemplate + sendTestTemplate server actions with tests"
```

---

### Task 7: Build template-selector.tsx

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/template-selector.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

export type TemplateName = 'confirm' | 'welcome' | 'edition'

interface TemplateSelectorProps {
  selected: TemplateName
  onChange: (t: TemplateName) => void
  strings: NewsletterHubStrings['testCenter']
}

const TEMPLATE_LABELS: Record<TemplateName, string> = {
  confirm: 'Confirm',
  welcome: 'Welcome',
  edition: 'Edition',
}

export function TemplateSelector({ selected, onChange, strings }: TemplateSelectorProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.template}
      </label>
      <div role="radiogroup" aria-label="Email template" className="flex flex-row gap-1.5 lg:flex-col">
        {(['confirm', 'welcome', 'edition'] as const).map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={selected === id}
            onClick={() => onChange(id)}
            className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
              selected === id
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-medium'
                : 'bg-[#0a0f1a] border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            {TEMPLATE_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/template-selector.tsx
git commit -m "feat(test-center): template-selector segmented radio component"
```

---

### Task 8: Build edition-controls.tsx

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/edition-controls.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

interface EditionControlsProps {
  types: Array<{ id: string; name: string; color: string }>
  selectedTypeId: string | null
  selectedEditionId: string | null
  onTypeChange: (typeId: string | null) => void
  onEditionChange: (editionId: string | null) => void
  editions: Array<{ id: string; subject: string; status: string }>
  strings: NewsletterHubStrings['testCenter']
  disabled: boolean
}

export function EditionControls({
  types,
  selectedTypeId,
  selectedEditionId,
  onTypeChange,
  onEditionChange,
  editions,
  strings,
  disabled,
}: EditionControlsProps) {
  return (
    <div aria-disabled={disabled} className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.edition}
      </label>
      <div className="flex flex-col gap-2">
        <select
          value={selectedTypeId ?? ''}
          onChange={(e) => {
            onTypeChange(e.target.value || null)
            onEditionChange(null)
          }}
          className="w-full rounded-md border border-gray-800 bg-[#0a0f1a] px-3 py-2 text-xs text-gray-300 focus:border-indigo-500/50 focus:outline-none"
          aria-label={strings.selectType}
        >
          <option value="">{strings.selectType}</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={selectedEditionId ?? ''}
          onChange={(e) => onEditionChange(e.target.value || null)}
          disabled={editions.length === 0}
          className="w-full rounded-md border border-gray-800 bg-[#0a0f1a] px-3 py-2 text-xs text-gray-300 focus:border-indigo-500/50 focus:outline-none disabled:opacity-50"
          aria-label={strings.selectEdition}
        >
          <option value="">{editions.length === 0 ? strings.noEditions : strings.selectEdition}</option>
          {editions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.subject} ({e.status})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/edition-controls.tsx
git commit -m "feat(test-center): edition-controls type/edition selects"
```

---

### Task 9: Build test-send-card.tsx

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/test-send-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lock, Send, Loader2, CheckCircle2 } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface TestSendCardProps {
  userEmail: string
  locale: 'en' | 'pt-BR'
  onSend: () => Promise<{ ok: true } | { ok: false; error: string }>
  strings: NewsletterHubStrings['testCenter']
}

export function TestSendCard({ userEmail, locale, onSend, strings }: TestSendCardProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'cooldown' | 'error'>('idle')
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (cooldownLeft <= 0) {
      if (state === 'cooldown') setState('idle')
      return
    }
    const timer = setTimeout(() => setCooldownLeft((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldownLeft, state])

  const handleSend = useCallback(async () => {
    setState('sending')
    setErrorMsg('')
    try {
      const result = await onSend()
      if (result.ok) {
        setState('success')
        setTimeout(() => {
          setState('cooldown')
          setCooldownLeft(60)
        }, 2000)
      } else {
        if (result.error === 'rate_limited') {
          setState('cooldown')
          setCooldownLeft(60)
        } else {
          setErrorMsg(result.error)
          setState('error')
          setTimeout(() => setState('idle'), 3000)
        }
      }
    } catch {
      setErrorMsg('Unexpected error')
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [onSend])

  const buttonDisabled = state !== 'idle'

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.sendTest}
      </label>

      <div className="rounded-md border border-gray-800 bg-[#0a0f1a] p-3">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-3 w-3 text-gray-600" />
          <span className="text-xs text-gray-500 truncate" aria-label={strings.recipientLocked}>
            {userEmail}
          </span>
        </div>

        <button
          onClick={handleSend}
          disabled={buttonDisabled}
          className={`w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            state === 'cooldown'
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : state === 'success'
              ? 'bg-green-600/20 text-green-400'
              : buttonDisabled
              ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {state === 'sending' && <><Loader2 className="h-3 w-3 animate-spin" />{strings.sending}</>}
          {state === 'success' && <><CheckCircle2 className="h-3 w-3" />{strings.testSent}</>}
          {state === 'cooldown' && <>{strings.waitCooldown} ({cooldownLeft}s)</>}
          {state === 'error' && strings.failedToSend}
          {state === 'idle' && <><Send className="h-3 w-3" />{strings.sendTestEmail}</>}
        </button>

        {state === 'sending' && (
          <p className="text-[10px] text-gray-600 mt-1.5 text-center">{strings.deliveringViaSes}</p>
        )}
        {state === 'error' && errorMsg && (
          <p className="text-[10px] text-red-400 mt-1.5 text-center">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/test-send-card.tsx
git commit -m "feat(test-center): test-send-card with cooldown + state machine"
```

---

### Task 10: Build page-state-links.tsx

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/page-state-links.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { ExternalLink } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface PageStateLinksProps {
  strings: NewsletterHubStrings['testCenter']
}

const CONFIRM_STATES = ['success', 'already', 'expired', 'not_found', 'error', 'invalid', 'loading', 'error-boundary'] as const
const UNSUBSCRIBE_STATES = ['initial', 'ok', 'already', 'not_found', 'error', 'invalid', 'loading', 'error-boundary'] as const

function StateChip({ state, href }: { state: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      role="button"
      aria-label={`Preview ${href.includes('confirm') ? 'confirm' : 'unsubscribe'} page: ${state}`}
      className="inline-flex items-center gap-1 rounded-md border border-gray-800 bg-[#0a0f1a] px-2.5 py-1.5 text-[11px] text-gray-400 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors"
    >
      {state}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  )
}

export function PageStateLinks({ strings }: PageStateLinksProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
        {strings.pageStates}
      </label>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5">{strings.confirmStates}</p>
          <div className="flex flex-wrap gap-1.5">
            {CONFIRM_STATES.map((s) => (
              <StateChip key={s} state={s} href={`/cms/newsletters/preview/confirm/${s}`} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-gray-600 mb-1.5">{strings.unsubscribeStates}</p>
          <div className="flex flex-wrap gap-1.5">
            {UNSUBSCRIBE_STATES.map((s) => (
              <StateChip key={s} state={s} href={`/cms/newsletters/preview/unsubscribe/${s}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/page-state-links.tsx
git commit -m "feat(test-center): page-state-links chips for 16 preview routes"
```

---

### Task 11: Build the full test-center-tab.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/test-center-tab.tsx`

- [ ] **Step 1: Replace placeholder with full implementation**

Replace the entire file with:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { SummaryBar } from '../../_shared/summary-bar'
import { TemplateSelector, type TemplateName } from './template-selector'
import { EditionControls } from './edition-controls'
import { TestSendCard } from './test-send-card'
import { PageStateLinks } from './page-state-links'
import { renderTestTemplate, sendTestTemplate } from '../../actions-test-center'

interface TestCenterTabProps {
  strings: NewsletterHubStrings
  locale: 'en' | 'pt-BR'
  userEmail: string
  types: Array<{ id: string; name: string; color: string }>
}

export function TestCenterTab({ strings, locale, userEmail, types }: TestCenterTabProps) {
  const [template, setTemplate] = useState<TemplateName>('confirm')
  const [emailLocale, setEmailLocale] = useState<'pt-BR' | 'en'>(locale)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null)
  const [editions, setEditions] = useState<Array<{ id: string; subject: string; status: string }>>([])
  const [html, setHtml] = useState<string | null>(null)
  const [sizeBytes, setSizeBytes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await renderTestTemplate(template, emailLocale, {
        editionId: selectedEditionId ?? undefined,
        typeId: selectedTypeId ?? undefined,
      })
      if (result.ok) {
        setHtml(result.html)
        setSizeBytes(result.sizeBytes)
      } else {
        setError(result.error)
        setHtml(null)
        setSizeBytes(null)
      }
    } catch {
      setError('Failed to render preview')
      setHtml(null)
      setSizeBytes(null)
    } finally {
      setLoading(false)
    }
  }, [template, emailLocale, selectedEditionId, selectedTypeId])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleSend = useCallback(async () => {
    return sendTestTemplate(template, emailLocale, {
      editionId: selectedEditionId ?? undefined,
    })
  }, [template, emailLocale, selectedEditionId])

  const tc = strings.testCenter

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Controls column */}
        <div className="flex flex-col gap-4">
          <TemplateSelector selected={template} onChange={setTemplate} strings={tc} />

          {/* Locale toggle */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
              {tc.locale}
            </label>
            <div role="radiogroup" aria-label="Email locale" className="flex gap-1.5">
              {(['pt-BR', 'en'] as const).map((loc) => (
                <button
                  key={loc}
                  role="radio"
                  aria-checked={emailLocale === loc}
                  onClick={() => setEmailLocale(loc)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs text-center transition-colors ${
                    emailLocale === loc
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 font-medium'
                      : 'bg-[#0a0f1a] border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <EditionControls
            types={types}
            selectedTypeId={selectedTypeId}
            selectedEditionId={selectedEditionId}
            onTypeChange={setSelectedTypeId}
            onEditionChange={setSelectedEditionId}
            editions={editions}
            strings={tc}
            disabled={template !== 'edition'}
          />

          <TestSendCard
            userEmail={userEmail}
            locale={emailLocale}
            onSend={handleSend}
            strings={tc}
          />

          <PageStateLinks strings={tc} />
        </div>

        {/* Preview column */}
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 overflow-hidden flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {template.charAt(0).toUpperCase() + template.slice(1)}
                {sizeBytes != null && ` · ${tc.emailSize}: ${(sizeBytes / 1024).toFixed(1)} KB`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label="Preview viewport" className="flex gap-1">
                <button
                  role="radio"
                  aria-checked={width === 'desktop'}
                  onClick={() => setWidth('desktop')}
                  className={`px-2 py-1 text-xs rounded ${width === 'desktop' ? 'bg-indigo-500/15 text-indigo-400 font-medium' : 'text-gray-500'}`}
                >
                  Desktop
                </button>
                <button
                  role="radio"
                  aria-checked={width === 'mobile'}
                  onClick={() => setWidth('mobile')}
                  className={`px-2 py-1 text-xs rounded ${width === 'mobile' ? 'bg-indigo-500/15 text-indigo-400 font-medium' : 'text-gray-500'}`}
                >
                  Mobile
                </button>
              </div>
              <button
                onClick={loadPreview}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                {tc.refresh}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#111827] p-4 flex justify-center" role="region" aria-label="Email preview">
            {error && (
              <div className="text-center py-8">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {loading && !html && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Rendering preview...</p>
              </div>
            )}
            {html && !error && (
              <iframe
                srcDoc={html}
                title="Email preview"
                className="bg-white shadow-md rounded border-0"
                style={{
                  width: width === 'desktop' ? '600px' : '375px',
                  height: '100%',
                  minHeight: '500px',
                  transition: 'width 0.2s ease',
                }}
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      </div>

      <SummaryBar stats={tc.summaryStats} />
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "test-center" | head -10`

Expected: No type errors in test-center files.

- [ ] **Step 3: Run full tests**

Run: `npm run test:web 2>&1 | tail -5`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/test-center-tab.tsx
git commit -m "feat(test-center): full test-center-tab with 2-col layout + preview"
```

---

### Task 12: Create confirm preview routes (8 states)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/preview/confirm/[state]/page.tsx`

- [ ] **Step 1: Create the preview route**

```typescript
import { notFound } from 'next/navigation'
import { ConfirmLayout, type StateKind } from '@/app/newsletter/confirm/[token]/_layouts/confirm-layout'
import ConfirmLoading from '@/app/newsletter/confirm/[token]/loading'
import { ErrorBoundaryPreview } from './error-preview'

const VALID_STATES = ['success', 'already', 'expired', 'not_found', 'error', 'invalid', 'loading', 'error-boundary'] as const
type PreviewState = (typeof VALID_STATES)[number]

const MOCK_NEWSLETTERS = [
  { name: 'Diário de Bordo', tagline: 'Reflexões semanais', color: '#FF8240', colorDark: null, cadenceLabel: 'Semanal, sextas' },
  { name: 'Tech Drops', tagline: 'Links + dicas tech', color: '#3b82f6', colorDark: null, cadenceLabel: 'Quinzenal' },
]

const MOCK_PROPS: Record<StateKind, { title: string; body: string; bodyContinuation?: string; backLabel: string; locale: string; lang: string; newsletters?: typeof MOCK_NEWSLETTERS; subscribedToLabel?: string; signoff?: string; showCta?: boolean; ctaLabel?: string; readLatestLabel?: string }> = {
  success: {
    title: 'Inscrição confirmada!',
    body: 'Obrigado por confirmar. Você agora receberá as newsletters que escolheu:',
    bodyContinuation: 'A primeira edição chega em breve, direto no seu email.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
    newsletters: MOCK_NEWSLETTERS,
    subscribedToLabel: 'Inscrito em',
    signoff: 'Obrigado por estar aqui.',
    showCta: true,
    ctaLabel: 'Explorar newsletters',
    readLatestLabel: 'Ler último artigo',
  },
  already: {
    title: 'Já confirmado',
    body: 'Esta inscrição já foi confirmada anteriormente.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
    newsletters: MOCK_NEWSLETTERS,
    subscribedToLabel: 'Inscrito em',
  },
  expired: {
    title: 'Link expirado',
    body: 'Este link de confirmação expirou. Inscreva-se novamente para receber um novo link.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  not_found: {
    title: 'Link não encontrado',
    body: 'Não encontramos uma inscrição associada a este link.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  error: {
    title: 'Algo deu errado',
    body: 'Ocorreu um erro ao processar sua confirmação. Tente novamente mais tarde.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  invalid: {
    title: 'Link inválido',
    body: 'Este link de confirmação é inválido.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
}

export default async function ConfirmPreviewPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  if (!VALID_STATES.includes(state as PreviewState)) notFound()

  if (state === 'loading') return <ConfirmLoading />
  if (state === 'error-boundary') {
    return <ErrorBoundaryPreview />
  }

  const props = MOCK_PROPS[state as StateKind]
  return <ConfirmLayout state={state as StateKind} {...props} />
}
```

Also create `apps/web/src/app/cms/(authed)/newsletters/preview/confirm/[state]/error-preview.tsx` as a separate file:

```typescript
'use client'

import ConfirmError from '@/app/newsletter/confirm/[token]/error'

export function ErrorBoundaryPreview() {
  return <ConfirmError error={new Error('Mock error for preview')} reset={() => window.location.reload()} />
}
```

**Note:** The import paths use `@/app/...` aliases. Verify that `loading.tsx` and `error.tsx` in the confirm directory export default components.

- [ ] **Step 2: Verify the route works**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "preview" | head -10`

Expected: No type errors (or minimal errors that can be resolved).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/preview/confirm/[state]/page.tsx" "apps/web/src/app/cms/(authed)/newsletters/preview/confirm/[state]/error-preview.tsx"
git commit -m "feat(test-center): confirm preview routes for 8 page states"
```

---

### Task 13: Create unsubscribe preview routes (8 states)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/newsletters/preview/unsubscribe/[state]/page.tsx`

- [ ] **Step 1: Create the preview route**

```typescript
import React from 'react'
import { notFound } from 'next/navigation'
import { UnsubscribeLayout, type StateKind } from '@/app/unsubscribe/[token]/_layouts/unsubscribe-layout'
import UnsubscribeLoading from '@/app/unsubscribe/[token]/loading'
import { ErrorBoundaryPreview } from './error-preview'

const VALID_STATES = ['initial', 'ok', 'already', 'not_found', 'error', 'invalid', 'loading', 'error-boundary'] as const
type PreviewState = (typeof VALID_STATES)[number]

const MOCK_PROPS: Record<StateKind, { title: string; body: string; backLabel: string; manageLabel?: string; locale: string; lang: string; signoff?: string; form?: React.ReactNode }> = {
  initial: {
    title: 'Cancelar inscrição',
    body: 'Tem certeza que deseja cancelar sua inscrição da newsletter Diário de Bordo?',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
    form: (
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          type="button"
          style={{
            padding: '12px 32px',
            border: '1.5px solid #958A75',
            borderRadius: 4,
            background: 'transparent',
            color: '#958A75',
            fontFamily: 'var(--font-inter-var), Arial, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Confirmar cancelamento
        </button>
      </div>
    ),
  },
  ok: {
    title: 'Inscrição cancelada',
    body: 'Você foi removido da newsletter. Sentiremos sua falta!',
    backLabel: '← Voltar para o site',
    manageLabel: 'Gerenciar newsletters',
    locale: 'pt-BR',
    lang: 'pt-BR',
    signoff: 'Obrigado pelo tempo que esteve conosco.',
  },
  already: {
    title: 'Já cancelado',
    body: 'Esta inscrição já foi cancelada anteriormente.',
    backLabel: '← Voltar para o site',
    manageLabel: 'Gerenciar newsletters',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  not_found: {
    title: 'Link não encontrado',
    body: 'Não encontramos uma inscrição associada a este link.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  error: {
    title: 'Algo deu errado',
    body: 'Ocorreu um erro ao processar seu cancelamento. Tente novamente mais tarde.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
  invalid: {
    title: 'Link inválido',
    body: 'Este link de cancelamento é inválido.',
    backLabel: '← Voltar para o site',
    locale: 'pt-BR',
    lang: 'pt-BR',
  },
}

export default async function UnsubscribePreviewPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  if (!VALID_STATES.includes(state as PreviewState)) notFound()

  if (state === 'loading') return <UnsubscribeLoading />
  if (state === 'error-boundary') {
    return <ErrorBoundaryPreview />
  }

  const props = MOCK_PROPS[state as StateKind]
  return <UnsubscribeLayout state={state as StateKind} {...props} />
}
```

Also create a client component wrapper. Create `apps/web/src/app/cms/(authed)/newsletters/preview/unsubscribe/[state]/error-preview.tsx`:

```typescript
'use client'

import UnsubscribeError from '@/app/unsubscribe/[token]/error'

export function ErrorBoundaryPreview() {
  return <UnsubscribeError error={new Error('Mock error for preview')} reset={() => window.location.reload()} />
}
```

**Note:** The `initial` state includes a mock form button (non-functional — it's just for visual preview). The `form` prop renders inside `UnsubscribeLayout` in the form slot.

- [ ] **Step 2: Verify TypeScript**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "preview" | head -10`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/newsletters/preview/unsubscribe/[state]/page.tsx" "apps/web/src/app/cms/(authed)/newsletters/preview/unsubscribe/[state]/error-preview.tsx"
git commit -m "feat(test-center): unsubscribe preview routes for 8 page states"
```

---

### Task 14: Final integration — fetch editions, run full tests, verify

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_tabs/test-center/test-center-tab.tsx` (add edition fetching)
- Modify: `apps/web/src/app/cms/(authed)/newsletters/page.tsx` (add edition data to test-center case)

- [ ] **Step 1: Add edition fetching to page.tsx test-center case**

In `page.tsx`, update the `test-center` case to fetch editions:

```typescript
    case 'test-center': {
      const supabase = (await import('@/lib/supabase/service')).getSupabaseServiceClient()
      const { data: editionRows } = await supabase
        .from('newsletter_editions')
        .select('id, subject, status, newsletter_type_id')
        .eq('site_id', siteId)
        .in('status', ['idea', 'draft', 'ready'])
        .order('created_at', { ascending: false })
        .limit(50)
      const editions = (editionRows ?? []).map(e => ({
        id: e.id as string,
        subject: e.subject as string,
        status: e.status as string,
        typeId: e.newsletter_type_id as string | null,
      }))

      const userClient = (await import('@supabase/ssr')).createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { async getAll() { return (await (await import('next/headers')).cookies()).getAll() }, async setAll() {} } },
      )
      const { data: { user } } = await userClient.auth.getUser()
      return (
        <TestCenterTab
          strings={strings}
          locale={locale}
          userEmail={user?.email ?? ''}
          types={types.map(t => ({ id: t.id, name: t.name, color: t.color }))}
          editions={editions}
        />
      )
    }
```

- [ ] **Step 2: Update TestCenterTab props to accept editions**

In `test-center-tab.tsx`, update the interface and remove the local `editions` state:

```typescript
interface TestCenterTabProps {
  strings: NewsletterHubStrings
  locale: 'en' | 'pt-BR'
  userEmail: string
  types: Array<{ id: string; name: string; color: string }>
  editions: Array<{ id: string; subject: string; status: string; typeId: string | null }>
}
```

Update the component to filter editions by selected type:

```typescript
export function TestCenterTab({ strings, locale, userEmail, types, editions: allEditions }: TestCenterTabProps) {
  // ... existing state declarations (remove local editions state)

  const filteredEditions = selectedTypeId
    ? allEditions.filter((e) => e.typeId === selectedTypeId)
    : allEditions
```

And pass `filteredEditions` to `EditionControls`:

```typescript
  <EditionControls
    ...
    editions={filteredEditions}
    ...
  />
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test:web 2>&1 | tail -5`

Expected: All tests pass.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -15`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/newsletters/_tabs/test-center/test-center-tab.tsx apps/web/src/app/cms/\(authed\)/newsletters/page.tsx
git commit -m "feat(test-center): wire edition fetching and finalize integration"
```

- [ ] **Step 6: Run full test suite one final time**

Run: `npm run test:web 2>&1 | tail -10`

Expected: All tests pass. Zero regressions.
