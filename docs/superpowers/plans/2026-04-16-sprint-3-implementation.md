# Sprint 3 — Auth, Lead Capture, Admin & Package Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver `@tn-figueiredo/email` package, multi-ring schemas (invitations + lead capture + audit), login UI port + invite-only signup, newsletter + contact flows, campaign admin CRUD, blog editor polish, and extraction of both `@tn-figueiredo/cms` and `@tn-figueiredo/email` to standalone repos.

**Architecture:** Approach 3 (package-first). Email adapter via `@mdx`-style pattern (interfaces + Brevo impl + template registry + i18n). Auth via Supabase Auth + Google OAuth + Turnstile. Invite flow uses atomic PL/pgSQL functions to avoid orphaned auth users. Newsletter decoupled via cron sync to Brevo. Campaign editor app-specific (not in package — Sprint 5+ when 2nd content type joins).

**Tech Stack:** Next.js 15 + React 19 + TS strict, Supabase (PostgreSQL 17 + Auth + Storage), `@mdx-js/mdx@3.x`, p-queue@8, Radix AlertDialog, Vitest, Brevo SMTP API.

**Migration numbering:** continues from Sprint 2's `20260415000029`. Sprint 3 starts at `20260416000001`.

**Spec:** `docs/superpowers/specs/2026-04-16-sprint-3-design.md` (read first for full context).

---

## File structure

```
packages/email/                                   (new workspace package — Epic 1)
  package.json, tsconfig.json, tsconfig.build.json, vitest.config.ts, README.md
  src/
    interfaces/{email-service,email-template}.ts
    brevo/{brevo-adapter,types}.ts
    templates/
      base-layout.ts                              (port tonagarantia ~/Workspace/tonagarantia/packages/shared/src/email-templates/base-layout.ts)
      registry.ts
      welcome.ts, invite.ts, confirm-subscription.ts, contact-received.ts, contact-admin-alert.ts
    helpers/unsubscribe-token.ts
    types/{message,branding}.ts
    index.ts
  test/
    brevo-adapter.test.ts
    templates/{welcome,invite,confirm-subscription,contact-received,contact-admin-alert}.test.ts
    helpers/unsubscribe-token.test.ts

supabase/migrations/                              (Epic 2 — 7 new migrations + extensions)
  20260416000001_invitations.sql
  20260416000002_invitations_rate_limit.sql
  20260416000003_contact_submissions.sql
  20260416000004_newsletter_subscriptions.sql
  20260416000005_unsubscribe_tokens.sql
  20260416000006_sent_emails.sql
  20260416000007_sites_extensions.sql

supabase/seeds/dev.sql                            (updated — truncate list + invite/contact/newsletter seed)

apps/api/test/rls/
  invitations.test.ts                             (new)
  contact-submissions.test.ts                     (new)
  newsletter-subscriptions.test.ts                (new)
  unsubscribe-tokens.test.ts                      (new)
  sent-emails.test.ts                             (new)
  sites-extensions.test.ts                        (new — verifies new columns)

apps/web/                                         (Epics 3-6)
  package.json                                    (add @radix-ui/react-alert-dialog)
  middleware.ts                                   (update publicRoutes)
  src/app/
    signin/
      page.tsx                                    (port tonagarantia)
      actions.ts
      forgot/page.tsx
      reset/[token]/page.tsx
    auth/callback/route.ts
    admin/users/
      page.tsx
      actions.ts                                  (createInvitation, revokeInvitation, resendInvitation)
    signup/invite/[token]/
      page.tsx
      actions.ts                                  (acceptInviteForCurrentUser, acceptInviteWithPassword)
    newsletter/confirm/[token]/page.tsx
    unsubscribe/[token]/
      page.tsx
      actions.ts
    contact/page.tsx
    cms/contacts/
      page.tsx
      [id]/page.tsx
    cms/campaigns/
      page.tsx
      new/page.tsx
      [id]/edit/
        page.tsx
        actions.ts
      [id]/submissions/page.tsx
      _components/                                (Next ignores _-prefixed)
        campaign-editor.tsx
        form-fields-editor.tsx
        extras-editor.tsx
        mdx-field.tsx
    api/cron/
      sync-newsletter-pending/route.ts            (new cron)
  src/components/
    confirm-action-button.tsx                     (Radix wrapper)
    newsletter-signup.tsx
    contact-form.tsx
  lib/cms/
    auth-guards.ts                                (requireSiteAdminForRow generic)
    campaign-repositories.ts                      (factory)
  lib/email/
    sender.ts                                     (getEmailSender resolves per-site)
    service.ts                                    (singleton BrevoEmailAdapter)
  lib/cms/site-context.ts                         (existing — no change)
  vercel.json                                     (add new cron schedule)

packages/cms/src/                                  (Epic 6 — additions to existing package)
  editor/
    use-autosave.ts                               (new)
    meta-seo-fields.tsx                           (new)
    editor.tsx                                    (modified — add metaSEO + cover + autosave)
    strings.ts                                    (extended — new i18n entries)
  supabase/campaign-repository.ts                 (new — Epic 5)
  types/campaign.ts                               (new)
  extras/                                          (moved from apps/web/lib/campaigns/)
    schema.ts
    renderer.tsx
    index.ts

apps/web/src/app/cms/blog/                        (Epic 6 — list page changes)
  page.tsx                                        (modified — delete UI via ConfirmActionButton)
  [id]/edit/actions.ts                            (modified — refactor to requireSiteAdminForRow)
```

---

## Task 1 — Package scaffold: `packages/email/`

**Files:**
- Create: `packages/email/package.json`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/tsconfig.build.json`
- Create: `packages/email/vitest.config.ts`
- Create: `packages/email/src/index.ts` (stub)
- Create: `packages/email/README.md`
- Modify: `apps/web/package.json` (add `"@tn-figueiredo/email": "*"`)

- [ ] **Step 1.1 — Create `packages/email/package.json`**

```json
{
  "name": "@tn-figueiredo/email",
  "version": "0.1.0-dev",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md"],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/TN-Figueiredo/email.git"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "prepare": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "p-queue": "8.0.1",
    "zod": "3.23.8"
  },
  "peerDependencies": {
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "@types/node": "20.x",
    "happy-dom": "20.8.9",
    "typescript": "5.6.3",
    "vitest": "3.2.4",
    "@supabase/supabase-js": "2.45.4"
  }
}
```

- [ ] **Step 1.2 — Create `packages/email/tsconfig.json`** (mirror packages/cms)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 1.3 — Create `packages/email/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": false
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "test", "**/*.test.ts"]
}
```

- [ ] **Step 1.4 — Create `packages/email/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 1.5 — Create `packages/email/src/index.ts`** (stub)

```ts
// Public surface — populated by subsequent tasks
export {}
```

- [ ] **Step 1.6 — Create `packages/email/README.md`**

```markdown
# @tn-figueiredo/email

Transactional email package for the TN-Figueiredo conglomerate. Brevo adapter, template registry, i18n, unsubscribe token helper.

## Install

\`\`\`bash
npm install @tn-figueiredo/email --save-exact
\`\`\`

## Usage

\`\`\`ts
import { BrevoEmailAdapter, welcomeTemplate } from '@tn-figueiredo/email'

const email = new BrevoEmailAdapter(process.env.BREVO_API_KEY!)
await email.sendTemplate(welcomeTemplate, 'user@example.com', {
  brandName: 'My Site', siteUrl: 'https://...', unsubscribeUrl: '...',
}, 'pt-BR')
\`\`\`

## Architecture

Decoupled from marketing list management (use existing `lib/brevo.ts createBrevoContact` for that). This package handles **transactional** emails: 1 recipient, template + variables, optional reply-to.

Templates accept locale (pt-BR or en) and per-site branding. Helpers manage unsubscribe tokens stored in `unsubscribe_tokens` table.

## License

Internal.
```

- [ ] **Step 1.7 — Modify `apps/web/package.json`** add to dependencies (alphabetical):

```json
"@tn-figueiredo/email": "*",
```

- [ ] **Step 1.8 — Install + verify**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm install
npm ls @tn-figueiredo/email -w apps/web
# Expected: @tn-figueiredo/email@0.1.0-dev -> ./../../packages/email
```

Also verify package builds:
```bash
cd packages/email && npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 1.9 — Update `apps/web/next.config.ts`** transpilePackages array:

```ts
transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/email'],
```

- [ ] **Step 1.10 — Commit**

```bash
git add packages/email package.json apps/web/package.json apps/web/next.config.ts package-lock.json
git commit -m "feat(sprint-3): scaffold @tn-figueiredo/email workspace package"
```

---

## Task 2 — Email types + interfaces

**Files:**
- Create: `packages/email/src/types/message.ts`
- Create: `packages/email/src/types/branding.ts`
- Create: `packages/email/src/interfaces/email-service.ts`
- Create: `packages/email/src/interfaces/email-template.ts`
- Modify: `packages/email/src/index.ts` (barrel)

- [ ] **Step 2.1 — Create `src/types/message.ts`**

```ts
export interface EmailSender {
  email: string
  name: string
}

export interface EmailMessage {
  from: EmailSender
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  metadata?: Record<string, unknown>
}

export interface EmailResult {
  messageId: string
  provider: 'brevo'
}

export interface EmailWebhookEvent {
  providerMessageId: string
  type: 'delivered' | 'bounced' | 'complained' | 'unsubscribed'
  timestamp: string
  metadata?: Record<string, unknown>
}
```

- [ ] **Step 2.2 — Create `src/types/branding.ts`**

```ts
export interface EmailBranding {
  brandName: string
  logoUrl?: string
  primaryColor?: string
  footerText?: string
  unsubscribeUrl?: string
}
```

- [ ] **Step 2.3 — Create `src/interfaces/email-service.ts`**

```ts
import type { EmailMessage, EmailResult, EmailWebhookEvent } from '../types/message'
import type { IEmailTemplate } from './email-template'

export interface IEmailService {
  send(msg: EmailMessage): Promise<EmailResult>
  sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailMessage['from'],
    to: string,
    variables: V,
    locale?: string,
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult>
  handleWebhook?(payload: unknown, signature: string): Promise<EmailWebhookEvent[]>
}
```

- [ ] **Step 2.4 — Create `src/interfaces/email-template.ts`**

```ts
export interface IEmailTemplate<V> {
  name: string
  render(variables: V, locale: string): Promise<{
    subject: string
    html: string
    text?: string
  }>
}
```

- [ ] **Step 2.5 — Update `src/index.ts`**

```ts
export * from './types/message'
export * from './types/branding'
export * from './interfaces/email-service'
export * from './interfaces/email-template'
```

- [ ] **Step 2.6 — Verify typecheck**

```bash
cd packages/email && npx tsc --noEmit
# Expected: no errors
```

- [ ] **Step 2.7 — Commit**

```bash
git add packages/email/src
git commit -m "feat(sprint-3): @tn-figueiredo/email types + interfaces"
```

---

## Task 3 — Base layout + helpers (port tonagarantia)

**Files:**
- Create: `packages/email/src/templates/base-layout.ts`

- [ ] **Step 3.1 — Read tonagarantia base-layout for reference**

```bash
cat ~/Workspace/tonagarantia/packages/shared/src/email-templates/base-layout.ts
```

Adapt to take `EmailBranding` parameter (do not hardcode tonagarantia colors/logo).

- [ ] **Step 3.2 — Create `src/templates/base-layout.ts`**

```ts
import type { EmailBranding } from '../types/branding'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function formatDatePtBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function emailButton(opts: { url: string; label: string; color?: string }): string {
  const c = opts.color ?? '#0070f3'
  return `<a href="${escapeHtml(opts.url)}" style="display:inline-block;padding:12px 24px;background:${c};color:#fff;text-decoration:none;border-radius:4px;font-weight:600;">${escapeHtml(opts.label)}</a>`
}

export function emailLayout(opts: { body: string; branding: EmailBranding }): string {
  const { branding, body } = opts
  const logo = branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.brandName)}" style="max-height:48px;margin-bottom:16px;" />` : ''
  const footer = branding.footerText ?? `${branding.brandName}`
  const unsub = branding.unsubscribeUrl
    ? `<p style="font-size:12px;color:#999;margin-top:24px;text-align:center;"><a href="${escapeHtml(branding.unsubscribeUrl)}" style="color:#999;">Cancelar inscrição</a></p>`
    : ''
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(branding.brandName)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;padding:32px;border-radius:8px;">
        <tr><td>
          ${logo}
          ${body}
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#999;text-align:center;">${escapeHtml(footer)}</p>
          ${unsub}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
```

- [ ] **Step 3.3 — Add to `src/index.ts`**

```ts
export { emailLayout, emailButton, formatDatePtBR, escapeHtml } from './templates/base-layout'
```

- [ ] **Step 3.4 — Commit**

```bash
git add packages/email/src
git commit -m "feat(sprint-3): email base-layout helpers (port tonagarantia + brand-agnostic)"
```

---

## Task 4 — BrevoEmailAdapter

**Files:**
- Create: `packages/email/src/brevo/brevo-adapter.ts`
- Create: `packages/email/src/brevo/types.ts`
- Create: `packages/email/test/brevo-adapter.test.ts`

- [ ] **Step 4.1 — Write failing test `test/brevo-adapter.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrevoEmailAdapter } from '../src/brevo/brevo-adapter'

describe('BrevoEmailAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('POSTs to Brevo with api-key + correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ messageId: 'm1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BrevoEmailAdapter('test-key')
    const result = await adapter.send({
      from: { email: 'noreply@x.com', name: 'X' },
      to: 'user@y.com',
      subject: 'Hi',
      html: '<p>body</p>',
    })

    expect(result).toEqual({ messageId: 'm1', provider: 'brevo' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect((init as { headers: Record<string, string> }).headers['api-key']).toBe('test-key')
    const body = JSON.parse((init as { body: string }).body)
    expect(body.sender).toEqual({ email: 'noreply@x.com', name: 'X' })
    expect(body.to).toEqual([{ email: 'user@y.com' }])
    expect(body.subject).toBe('Hi')
    expect(body.htmlContent).toBe('<p>body</p>')
  })

  it('throws on 4xx without retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'bad',
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BrevoEmailAdapter('test-key')
    await expect(adapter.send({
      from: { email: 'a@x.com', name: 'A' }, to: 'u@y.com', subject: 'S', html: '<p>b</p>',
    })).rejects.toThrow(/brevo 400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on 5xx then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: async () => 'bad gw' })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ messageId: 'm2' }) })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BrevoEmailAdapter('test-key')
    const promise = adapter.send({
      from: { email: 'a@x.com', name: 'A' }, to: 'u@y.com', subject: 'S', html: '<p>b</p>',
    })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.messageId).toBe('m2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('handleWebhook throws not_implemented (Sprint 3 stub)', async () => {
    const adapter = new BrevoEmailAdapter('test-key')
    await expect(adapter.handleWebhook!({}, '')).rejects.toThrow(/not_implemented/)
  })
})
```

- [ ] **Step 4.2 — Run, expect FAIL** (`brevo-adapter.ts` does not exist)

```bash
cd packages/email && npx vitest run test/brevo-adapter.test.ts
```

- [ ] **Step 4.3 — Create `src/brevo/types.ts`**

```ts
export interface BrevoSendRequest {
  sender: { email: string; name: string }
  to: Array<{ email: string; name?: string }>
  subject: string
  htmlContent: string
  textContent?: string
  replyTo?: { email: string; name?: string }
  tags?: string[]
}

export interface BrevoSendResponse {
  messageId: string
}
```

- [ ] **Step 4.4 — Create `src/brevo/brevo-adapter.ts`**

```ts
import PQueue from 'p-queue'
import type { IEmailService } from '../interfaces/email-service'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailMessage, EmailResult, EmailWebhookEvent } from '../types/message'
import type { BrevoSendRequest, BrevoSendResponse } from './types'

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'

export class BrevoEmailAdapter implements IEmailService {
  private queue: PQueue
  private maxRetries = 3
  private timeoutMs = 8000

  constructor(private apiKey: string) {
    // Brevo free tier limit: 300/min = 5/sec
    this.queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 5 })
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    return this.queue.add(() => this.sendWithRetry(msg)) as Promise<EmailResult>
  }

  async sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailMessage['from'],
    to: string,
    variables: V,
    locale = 'pt-BR',
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult> {
    const { subject, html, text } = await template.render(variables, locale)
    return this.send({
      from: sender,
      to,
      subject,
      html,
      text,
      replyTo: options?.replyTo,
      metadata: { ...(options?.metadata ?? {}), template: template.name, locale },
    })
  }

  async handleWebhook(_payload: unknown, _signature: string): Promise<EmailWebhookEvent[]> {
    throw new Error('not_implemented: Sprint 4 will implement webhook signature verification')
  }

  private async sendWithRetry(msg: EmailMessage): Promise<EmailResult> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        return await this.doSend(msg)
      } catch (e) {
        lastErr = e
        const status = e instanceof Error && 'status' in e ? (e as { status: number }).status : 0
        if (status >= 400 && status < 500) throw e
        if (attempt > this.maxRetries) throw e
        await new Promise((r) => setTimeout(r, 200 * attempt))
      }
    }
    throw lastErr
  }

  private async doSend(msg: EmailMessage): Promise<EmailResult> {
    const body: BrevoSendRequest = {
      sender: msg.from,
      to: (Array.isArray(msg.to) ? msg.to : [msg.to]).map((email) => ({ email })),
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
      replyTo: msg.replyTo ? { email: msg.replyTo } : undefined,
      tags: msg.metadata?.template ? [String(msg.metadata.template)] : undefined,
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const r = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        const err = new Error(`brevo ${r.status}: ${text}`) as Error & { status: number }
        err.status = r.status
        throw err
      }
      const data = (await r.json()) as BrevoSendResponse
      return { messageId: data.messageId, provider: 'brevo' }
    } finally {
      clearTimeout(timer)
    }
  }
}
```

- [ ] **Step 4.5 — Add to `src/index.ts`**

```ts
export { BrevoEmailAdapter } from './brevo/brevo-adapter'
```

- [ ] **Step 4.6 — Run tests, expect PASS**

```bash
cd packages/email && npx vitest run test/brevo-adapter.test.ts
# Expected: 4 tests passed
```

- [ ] **Step 4.7 — Commit**

```bash
git add packages/email
git commit -m "feat(sprint-3): BrevoEmailAdapter with p-queue rate limit + retry"
```

---

## Task 5 — Email templates (5 templates with i18n)

**Files:**
- Create: `packages/email/src/templates/welcome.ts`
- Create: `packages/email/src/templates/invite.ts`
- Create: `packages/email/src/templates/confirm-subscription.ts`
- Create: `packages/email/src/templates/contact-received.ts`
- Create: `packages/email/src/templates/contact-admin-alert.ts`
- Create: `packages/email/src/templates/registry.ts`
- Create: `packages/email/test/templates/welcome.test.ts` (snapshot test pattern for all 5)

- [ ] **Step 5.1 — Create `src/templates/registry.ts`**

```ts
import type { IEmailTemplate } from '../interfaces/email-template'

export class TemplateRegistry {
  private templates = new Map<string, IEmailTemplate<unknown>>()

  register<V>(template: IEmailTemplate<V>): void {
    this.templates.set(template.name, template as IEmailTemplate<unknown>)
  }

  get<V>(name: string): IEmailTemplate<V> | undefined {
    return this.templates.get(name) as IEmailTemplate<V> | undefined
  }

  names(): string[] {
    return [...this.templates.keys()]
  }
}
```

- [ ] **Step 5.2 — Create `src/templates/welcome.ts`**

```ts
import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface WelcomeVars extends Record<string, unknown> {
  name?: string
  siteUrl: string
  branding: EmailBranding
}

export const welcomeTemplate: IEmailTemplate<WelcomeVars> = {
  name: 'welcome',
  async render(vars, locale) {
    const greetingPt = vars.name ? `Bem-vindo, ${escapeHtml(vars.name)}!` : 'Bem-vindo!'
    const greetingEn = vars.name ? `Welcome, ${escapeHtml(vars.name)}!` : 'Welcome!'
    const isEn = locale === 'en'
    const subject = isEn ? greetingEn : greetingPt
    const intro = isEn
      ? `<p>Thanks for subscribing to <strong>${escapeHtml(vars.branding.brandName)}</strong>.</p>`
      : `<p>Obrigado por se inscrever em <strong>${escapeHtml(vars.branding.brandName)}</strong>.</p>`
    const cta = emailButton({
      url: vars.siteUrl,
      label: isEn ? 'Visit the site' : 'Visite o site',
      color: vars.branding.primaryColor,
    })
    return {
      subject,
      html: emailLayout({
        body: `<h1>${subject}</h1>${intro}<p>${cta}</p>`,
        branding: vars.branding,
      }),
    }
  },
}
```

- [ ] **Step 5.3 — Create `src/templates/invite.ts`**

```ts
import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface InviteVars extends Record<string, unknown> {
  inviterName: string
  orgName: string
  role: 'owner' | 'admin' | 'editor' | 'author'
  acceptUrl: string
  expiresAt: Date
  branding: EmailBranding
}

const ROLES_PT: Record<string, string> = { owner: 'proprietário', admin: 'admin', editor: 'editor', author: 'autor' }
const ROLES_EN: Record<string, string> = { owner: 'owner', admin: 'admin', editor: 'editor', author: 'author' }

export const inviteTemplate: IEmailTemplate<InviteVars> = {
  name: 'invite',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn
      ? `${vars.inviterName} invited you to ${vars.orgName}`
      : `${vars.inviterName} convidou você para ${vars.orgName}`
    const role = isEn ? ROLES_EN[vars.role] : ROLES_PT[vars.role]
    const expiresFmt = vars.expiresAt.toISOString().slice(0, 10)
    const body = isEn
      ? `<h1>You have an invitation</h1>
         <p><strong>${escapeHtml(vars.inviterName)}</strong> invited you to join <strong>${escapeHtml(vars.orgName)}</strong> as <strong>${escapeHtml(role!)}</strong>.</p>
         <p>This invitation expires on ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.acceptUrl, label: 'Accept invitation', color: vars.branding.primaryColor })}</p>`
      : `<h1>Você recebeu um convite</h1>
         <p><strong>${escapeHtml(vars.inviterName)}</strong> convidou você para <strong>${escapeHtml(vars.orgName)}</strong> como <strong>${escapeHtml(role!)}</strong>.</p>
         <p>O convite expira em ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.acceptUrl, label: 'Aceitar convite', color: vars.branding.primaryColor })}</p>`
    return {
      subject,
      html: emailLayout({ body, branding: vars.branding }),
    }
  },
}
```

- [ ] **Step 5.4 — Create `src/templates/confirm-subscription.ts`**

```ts
import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface ConfirmSubscriptionVars extends Record<string, unknown> {
  confirmUrl: string
  expiresAt: Date
  branding: EmailBranding
}

export const confirmSubscriptionTemplate: IEmailTemplate<ConfirmSubscriptionVars> = {
  name: 'confirm-subscription',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn ? `Confirm your subscription to ${vars.branding.brandName}` : `Confirme sua inscrição em ${vars.branding.brandName}`
    const expiresFmt = vars.expiresAt.toISOString().slice(0, 10)
    const body = isEn
      ? `<h1>Confirm your subscription</h1>
         <p>Click below to confirm your email address. The link expires on ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.confirmUrl, label: 'Confirm', color: vars.branding.primaryColor })}</p>
         <p style="font-size:12px;color:#999;">If you didn't request this, ignore this email.</p>`
      : `<h1>Confirme sua inscrição</h1>
         <p>Clique abaixo pra confirmar seu email. O link expira em ${expiresFmt}.</p>
         <p>${emailButton({ url: vars.confirmUrl, label: 'Confirmar', color: vars.branding.primaryColor })}</p>
         <p style="font-size:12px;color:#999;">Se você não solicitou, ignore este email.</p>`
    return { subject, html: emailLayout({ body, branding: vars.branding }) }
  },
}
```

- [ ] **Step 5.5 — Create `src/templates/contact-received.ts`** (auto-reply)

```ts
import { emailLayout, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface ContactReceivedVars extends Record<string, unknown> {
  name: string
  expectedReplyTime: string  // e.g. "24 hours" / "24 horas"
  branding: EmailBranding
}

export const contactReceivedTemplate: IEmailTemplate<ContactReceivedVars> = {
  name: 'contact-received',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn ? `We received your message — ${vars.branding.brandName}` : `Recebemos sua mensagem — ${vars.branding.brandName}`
    const body = isEn
      ? `<h1>Hi, ${escapeHtml(vars.name)}</h1>
         <p>Thanks for reaching out. We received your message and will respond within ${vars.expectedReplyTime}.</p>
         <p>— Team ${escapeHtml(vars.branding.brandName)}</p>`
      : `<h1>Olá, ${escapeHtml(vars.name)}</h1>
         <p>Obrigado pelo contato. Recebemos sua mensagem e responderemos em até ${vars.expectedReplyTime}.</p>
         <p>— Equipe ${escapeHtml(vars.branding.brandName)}</p>`
    return { subject, html: emailLayout({ body, branding: vars.branding }) }
  },
}
```

- [ ] **Step 5.6 — Create `src/templates/contact-admin-alert.ts`**

```ts
import { emailLayout, emailButton, escapeHtml } from './base-layout'
import type { IEmailTemplate } from '../interfaces/email-template'
import type { EmailBranding } from '../types/branding'

export interface ContactAdminAlertVars extends Record<string, unknown> {
  submitterName: string
  submitterEmail: string
  message: string
  viewInAdminUrl: string
  branding: EmailBranding
}

export const contactAdminAlertTemplate: IEmailTemplate<ContactAdminAlertVars> = {
  name: 'contact-admin-alert',
  async render(vars, locale) {
    const isEn = locale === 'en'
    const subject = isEn
      ? `New contact: ${vars.submitterName}`
      : `Novo contato: ${vars.submitterName}`
    const fromLine = isEn ? 'From' : 'De'
    const messageLine = isEn ? 'Message' : 'Mensagem'
    const body = `<h1>${subject}</h1>
      <p><strong>${fromLine}:</strong> ${escapeHtml(vars.submitterName)} &lt;${escapeHtml(vars.submitterEmail)}&gt;</p>
      <p><strong>${messageLine}:</strong></p>
      <blockquote style="border-left:3px solid #ddd;padding-left:12px;margin:12px 0;color:#555;">${escapeHtml(vars.message).replace(/\n/g, '<br>')}</blockquote>
      <p>${emailButton({ url: vars.viewInAdminUrl, label: isEn ? 'View in admin' : 'Ver no admin', color: vars.branding.primaryColor })}</p>`
    return { subject, html: emailLayout({ body, branding: vars.branding }) }
  },
}
```

- [ ] **Step 5.7 — Update `src/index.ts`** with template exports + registry

```ts
export { TemplateRegistry } from './templates/registry'
export { welcomeTemplate, type WelcomeVars } from './templates/welcome'
export { inviteTemplate, type InviteVars } from './templates/invite'
export { confirmSubscriptionTemplate, type ConfirmSubscriptionVars } from './templates/confirm-subscription'
export { contactReceivedTemplate, type ContactReceivedVars } from './templates/contact-received'
export { contactAdminAlertTemplate, type ContactAdminAlertVars } from './templates/contact-admin-alert'
```

- [ ] **Step 5.8 — Snapshot test for welcome (template `test/templates/welcome.test.ts`)**

```ts
import { describe, it, expect } from 'vitest'
import { welcomeTemplate } from '../../src/templates/welcome'

describe('welcomeTemplate', () => {
  const branding = { brandName: 'TestBrand', primaryColor: '#ff0000' }
  it('renders pt-BR with name', async () => {
    const r = await welcomeTemplate.render({ name: 'João', siteUrl: 'https://x.com', branding }, 'pt-BR')
    expect(r.subject).toBe('Bem-vindo, João!')
    expect(r.html).toContain('Obrigado por se inscrever')
    expect(r.html).toContain('TestBrand')
    expect(r.html).toContain('https://x.com')
  })
  it('renders en without name', async () => {
    const r = await welcomeTemplate.render({ siteUrl: 'https://x.com', branding }, 'en')
    expect(r.subject).toBe('Welcome!')
    expect(r.html).toContain('Thanks for subscribing')
  })
  it('escapes HTML in name', async () => {
    const r = await welcomeTemplate.render({ name: '<script>x</script>', siteUrl: 'https://x.com', branding }, 'pt-BR')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})
```

Repeat similar small test files for `invite`, `confirm-subscription`, `contact-received`, `contact-admin-alert` — verify subject + key content per locale + HTML escaping.

- [ ] **Step 5.9 — Run tests, expect PASS**

```bash
cd packages/email && npx vitest run
# Expected: ~15 tests passing (4 brevo-adapter + 3 per template * 5 templates)
```

- [ ] **Step 5.10 — Commit**

```bash
git add packages/email
git commit -m "feat(sprint-3): 5 email templates (welcome, invite, confirm, contact-received, contact-admin-alert) with pt-BR + en"
```

---

## Task 6 — Unsubscribe token helper

**Files:**
- Create: `packages/email/src/helpers/unsubscribe-token.ts`
- Create: `packages/email/test/helpers/unsubscribe-token.test.ts`

- [ ] **Step 6.1 — Write test `test/helpers/unsubscribe-token.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { ensureUnsubscribeToken } from '../../src/helpers/unsubscribe-token'

describe('ensureUnsubscribeToken', () => {
  it('returns URL with existing token if found', async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }
    // Simulate upsert returning existing row
    supabase.single
      .mockResolvedValueOnce({ data: null })  // upsert ignored conflict
      .mockResolvedValueOnce({ data: { token: 'abc123' } })  // existing fetch

    const url = await ensureUnsubscribeToken(supabase as never, 'site-1', 'user@x.com', 'https://x.com')
    expect(url).toBe('https://x.com/unsubscribe/abc123')
  })

  it('generates and returns new token for new (site, email)', async () => {
    const supabase = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { token: 'newtoken' } }),
    }
    const url = await ensureUnsubscribeToken(supabase as never, 'site-1', 'fresh@x.com', 'https://x.com')
    expect(url).toContain('/unsubscribe/newtoken')
  })
})
```

- [ ] **Step 6.2 — Create `src/helpers/unsubscribe-token.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  // crypto.getRandomValues is available in Node 19+ and Edge
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function ensureUnsubscribeToken(
  supabase: SupabaseClient,
  siteId: string,
  email: string,
  baseUrl: string,
): Promise<string> {
  const token = generateToken()
  // Upsert; ignore conflict (already exists)
  const { data } = await supabase
    .from('unsubscribe_tokens')
    .upsert({ token, site_id: siteId, email }, { onConflict: 'site_id,email', ignoreDuplicates: true })
    .select('token')
    .single()

  if (data?.token) {
    return `${baseUrl.replace(/\/$/, '')}/unsubscribe/${data.token}`
  }

  // Conflict path: fetch existing
  const { data: existing } = await supabase
    .from('unsubscribe_tokens')
    .select('token')
    .eq('site_id', siteId)
    .eq('email', email)
    .single()

  if (!existing) throw new Error('unsubscribe_token_lookup_failed')
  return `${baseUrl.replace(/\/$/, '')}/unsubscribe/${existing.token}`
}
```

- [ ] **Step 6.3 — Add to `src/index.ts`**

```ts
export { ensureUnsubscribeToken } from './helpers/unsubscribe-token'
```

- [ ] **Step 6.4 — Run tests, expect PASS, commit**

```bash
cd packages/email && npx vitest run
git add packages/email
git commit -m "feat(sprint-3): ensureUnsubscribeToken helper for marketing email footers"
```

---

## Task 7 — Migration: invitations + RLS + RPCs

**Files:**
- Create: `supabase/migrations/20260416000001_invitations.sql`
- Create: `apps/api/test/rls/invitations.test.ts`
- Create: `apps/api/test/helpers/invitation-fixtures.ts`

- [ ] **Step 7.1 — Write failing test `apps/api/test/rls/invitations.test.ts`**

```ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_RING_ORG_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const SEED_USER = '00000000-0000-0000-0000-000000000001'

describe.skipIf(skipIfNoLocalDb())('invitations schema + RPCs', () => {
  const inviteIds: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    if (inviteIds.length) await admin.from('invitations').delete().in('id', inviteIds)
  })

  it('insert minimal invitation', async () => {
    const token = 'a'.repeat(64)
    const { data, error } = await admin.from('invitations').insert({
      email: 'invitee@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token, invited_by: SEED_USER,
    }).select().single()
    expect(error).toBeNull()
    expect(data?.expires_at).toBeTruthy()
    if (data?.id) inviteIds.push(data.id)
  })

  it('rejects malformed token (not 64 hex chars)', async () => {
    const { error } = await admin.from('invitations').insert({
      email: 'x@y.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token: 'short', invited_by: SEED_USER,
    })
    expect(error).not.toBeNull()
  })

  it('rejects invalid role', async () => {
    const token = 'b'.repeat(64)
    const { error } = await admin.from('invitations').insert({
      email: 'x@y.com', org_id: SHARED_RING_ORG_ID,
      role: 'nonexistent', token, invited_by: SEED_USER,
    })
    expect(error).not.toBeNull()
  })

  it('partial unique on (org_id, email) WHERE pending', async () => {
    const t1 = 'c'.repeat(64), t2 = 'd'.repeat(64)
    const a = await admin.from('invitations').insert({
      email: 'dup@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token: t1, invited_by: SEED_USER,
    }).select('id').single()
    if (a.data?.id) inviteIds.push(a.data.id)
    expect(a.error).toBeNull()
    const b = await admin.from('invitations').insert({
      email: 'dup@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token: t2, invited_by: SEED_USER,
    })
    expect(b.error).not.toBeNull()
  })

  it('get_invitation_by_token RPC returns minimal info', async () => {
    const token = 'e'.repeat(64)
    const ins = await admin.from('invitations').insert({
      email: 'rpc@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'author', token, invited_by: SEED_USER,
    }).select('id').single()
    if (ins.data?.id) inviteIds.push(ins.data.id)
    const { data, error } = await admin.rpc('get_invitation_by_token', { p_token: token })
    expect(error).toBeNull()
    expect(data?.email).toBe('rpc@example.com')
    expect(data?.role).toBe('author')
    expect(data?.expired).toBe(false)
  })

  it('get_invitation_by_token returns expired=true for past expires_at', async () => {
    const token = 'f'.repeat(64)
    const ins = await admin.from('invitations').insert({
      email: 'expired@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token, invited_by: SEED_USER,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }).select('id').single()
    if (ins.data?.id) inviteIds.push(ins.data.id)
    const { data } = await admin.rpc('get_invitation_by_token', { p_token: token })
    expect(data?.expired).toBe(true)
  })
})
```

- [ ] **Step 7.2 — Run, expect FAIL** (`relation "invitations" does not exist`)

```bash
HAS_LOCAL_DB=1 npm run test:api -- test/rls/invitations.test.ts
```

- [ ] **Step 7.3 — Create migration `supabase/migrations/20260416000001_invitations.sql`**

```sql
-- Invitations: admin-created, email-delivered, token-accepted.
-- Audit fields: invited_by, accepted_at/by, revoked_at/by, last_sent_at, resend_count.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','author')),
  token text not null check (token ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  last_sent_at timestamptz not null default now(),
  resend_count int not null default 0
);

create unique index invitations_token_unique on public.invitations (token);
create unique index invitations_pending_unique
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;
create index on public.invitations (org_id, accepted_at) where accepted_at is null;

-- RLS policies
alter table public.invitations enable row level security;

drop policy if exists "invitations admin manage" on public.invitations;
create policy "invitations admin manage"
  on public.invitations for all to authenticated
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

-- RPC: get invitation by token (anon-callable, returns minimal info)
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  email citext,
  role text,
  org_name text,
  expires_at timestamptz,
  expired boolean
)
language sql
stable
as $$
  select
    i.email,
    i.role,
    o.name as org_name,
    i.expires_at,
    (i.expires_at <= now() or i.accepted_at is not null or i.revoked_at is not null) as expired
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token
  limit 1
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- RPC: accept invitation atomically (security definer + FOR UPDATE lock)
create or replace function public.accept_invitation_atomic(
  p_token text,
  p_user_id uuid
) returns json
language plpgsql
security definer
as $$
declare
  v_inv record;
  v_user_email citext;
begin
  -- Lock the invitation row
  select id, email, org_id, role, expires_at, accepted_at, revoked_at
    into v_inv
  from public.invitations
  where token = p_token
  for update;

  if v_inv.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;
  if v_inv.revoked_at is not null then
    return json_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_inv.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  -- Verify user_id email matches invitation email
  select email::citext into v_user_email from auth.users where id = p_user_id;
  if v_user_email is null or lower(v_user_email::text) <> lower(v_inv.email::text) then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Atomic inserts
  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, p_user_id, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  insert into public.authors (user_id, name, slug)
  values (
    p_user_id,
    split_part(v_inv.email::text, '@', 1),
    split_part(v_inv.email::text, '@', 1) || '-' || substring(p_user_id::text, 1, 8)
  )
  on conflict (user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by_user_id = p_user_id
  where id = v_inv.id;

  return json_build_object('ok', true, 'org_id', v_inv.org_id);
end $$;

grant execute on function public.accept_invitation_atomic(text, uuid) to authenticated;
```

- [ ] **Step 7.4 — Create test helper `apps/api/test/helpers/invitation-fixtures.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export function generateInviteToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function makeInvitation(
  admin: SupabaseClient,
  tracker: string[],
  opts: { email: string; orgId: string; role: 'owner'|'admin'|'editor'|'author'; invitedBy: string; expiresIn?: number },
): Promise<{ id: string; token: string }> {
  const token = generateInviteToken()
  const { data, error } = await admin.from('invitations').insert({
    email: opts.email, org_id: opts.orgId, role: opts.role, token, invited_by: opts.invitedBy,
    expires_at: opts.expiresIn ? new Date(Date.now() + opts.expiresIn).toISOString() : undefined,
  }).select('id').single()
  if (error || !data) throw error ?? new Error('invitation insert failed')
  tracker.push(data.id)
  return { id: data.id, token }
}
```

- [ ] **Step 7.5 — Run** `npm run db:reset && HAS_LOCAL_DB=1 npm run test:api -- test/rls/invitations.test.ts` — expect PASS

- [ ] **Step 7.6 — Commit**

```bash
git add supabase/migrations/20260416000001_invitations.sql apps/api/test/rls/invitations.test.ts apps/api/test/helpers/invitation-fixtures.ts
git commit -m "feat(sprint-3): invitations table + RLS + RPCs (get_invitation_by_token, accept_invitation_atomic)"
```

---

## Task 8 — Migration: invitations rate limit trigger

**Files:**
- Create: `supabase/migrations/20260416000002_invitations_rate_limit.sql`
- Update: `apps/api/test/rls/invitations.test.ts` (append rate limit test)

- [ ] **Step 8.1 — Append test**

```ts
describe.skipIf(skipIfNoLocalDb())('invitations rate limit', () => {
  const inviteIds: string[] = []
  afterAll(async () => {
    if (inviteIds.length) await admin.from('invitations').delete().in('id', inviteIds)
  })

  it('rejects 21st invite within 1 hour from same admin', async () => {
    // Create 20 first
    for (let i = 0; i < 20; i++) {
      const token = (i.toString(16).padStart(2, '0')).repeat(32)
      const { data } = await admin.from('invitations').insert({
        email: `bulk${i}@example.com`, org_id: SHARED_RING_ORG_ID,
        role: 'editor', token, invited_by: SEED_USER,
      }).select('id').single()
      if (data?.id) inviteIds.push(data.id)
    }
    // 21st should fail
    const token = '21212121'.repeat(8)
    const { error } = await admin.from('invitations').insert({
      email: 'overflow@example.com', org_id: SHARED_RING_ORG_ID,
      role: 'editor', token, invited_by: SEED_USER,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/rate_limit/i)
  })
})
```

- [ ] **Step 8.2 — Create migration**

```sql
-- Rate limit: max 20 invitations per hour per (invited_by). Defense against
-- compromised admin credentials spamming invites.

create or replace function public.invitations_rate_limit()
returns trigger language plpgsql as $$
declare v_count int;
begin
  select count(*) into v_count from public.invitations
   where invited_by = new.invited_by
     and created_at > now() - interval '1 hour';
  if v_count >= 20 then
    raise exception 'rate_limit_exceeded: max 20 invitations per hour per admin'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists tg_invitations_rate_limit on public.invitations;
create trigger tg_invitations_rate_limit
  before insert on public.invitations
  for each row execute function public.invitations_rate_limit();
```

- [ ] **Step 8.3 — Run, expect PASS, commit**

```bash
npm run db:reset && HAS_LOCAL_DB=1 npm run test:api -- test/rls/invitations.test.ts
git add supabase/migrations/20260416000002_invitations_rate_limit.sql apps/api/test/rls/invitations.test.ts
git commit -m "feat(sprint-3): invitations rate limit trigger (max 20/hr per admin)"
```

---

## Task 9 — Migration: contact_submissions

**Files:**
- Create: `supabase/migrations/20260416000003_contact_submissions.sql`
- Create: `apps/api/test/rls/contact-submissions.test.ts`

- [ ] **Step 9.1 — Write test** (5 cases: insert with both consents, processing required, length checks, marketing-version-when-true, anon insert)

```ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

describe.skipIf(skipIfNoLocalDb())('contact_submissions schema', () => {
  const ids: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    if (ids.length) await admin.from('contact_submissions').delete().in('id', ids)
  })

  it('insert with processing consent only (no marketing)', async () => {
    const { data, error } = await admin.from('contact_submissions').insert({
      site_id: SHARED_SITE_A_ID, name: 'João', email: 'joao@x.com',
      message: 'Hello there, this is a test message',
      consent_processing: true, consent_processing_text_version: 'v1',
    }).select('id').single()
    expect(error).toBeNull()
    if (data?.id) ids.push(data.id)
  })

  it('rejects message shorter than 10 chars', async () => {
    const { error } = await admin.from('contact_submissions').insert({
      site_id: SHARED_SITE_A_ID, name: 'A', email: 'a@x.com', message: 'short',
      consent_processing: true, consent_processing_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('rejects name longer than 200 chars', async () => {
    const { error } = await admin.from('contact_submissions').insert({
      site_id: SHARED_SITE_A_ID, name: 'A'.repeat(201), email: 'a@x.com',
      message: 'Hello there, this is a test message',
      consent_processing: true, consent_processing_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('rejects marketing=true without text_version', async () => {
    const { error } = await admin.from('contact_submissions').insert({
      site_id: SHARED_SITE_A_ID, name: 'A', email: 'a@x.com',
      message: 'Hello there, this is a test message',
      consent_processing: true, consent_processing_text_version: 'v1',
      consent_marketing: true,
    })
    expect(error).not.toBeNull()
  })

  it('accepts marketing=true with text_version', async () => {
    const { data, error } = await admin.from('contact_submissions').insert({
      site_id: SHARED_SITE_A_ID, name: 'A', email: 'a@x.com',
      message: 'Hello there, this is a test message',
      consent_processing: true, consent_processing_text_version: 'v1',
      consent_marketing: true, consent_marketing_text_version: 'v1',
    }).select('id').single()
    expect(error).toBeNull()
    if (data?.id) ids.push(data.id)
  })

  it('staff read RLS works', async () => {
    const { error } = await admin.from('contact_submissions').select('id').eq('site_id', SHARED_SITE_A_ID)
    expect(error).toBeNull()
  })

  it('anon cannot read', async () => {
    const { data } = await anon.from('contact_submissions').select('id')
    expect((data ?? []).length).toBe(0)
  })
})
```

- [ ] **Step 9.2 — Create migration**

```sql
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null check (length(name) between 2 and 200),
  email citext not null check (length(email) between 5 and 320),
  message text not null check (length(message) between 10 and 5000),

  consent_processing boolean not null,
  consent_processing_text_version text not null,
  consent_marketing boolean not null default false,
  consent_marketing_text_version text,

  ip inet,
  user_agent text,
  submitted_at timestamptz not null default now(),
  replied_at timestamptz,

  check (consent_marketing = false or consent_marketing_text_version is not null)
);

create index on public.contact_submissions (site_id, submitted_at desc);
create index on public.contact_submissions (email);

alter table public.contact_submissions enable row level security;

drop policy if exists "contact_submissions anon insert" on public.contact_submissions;
create policy "contact_submissions anon insert"
  on public.contact_submissions for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sites s
      where s.id = site_id
        and (
          coalesce(nullif(current_setting('app.site_id', true), ''), '') = ''
          or s.id = nullif(current_setting('app.site_id', true), '')::uuid
        )
    )
  );

drop policy if exists "contact_submissions staff read" on public.contact_submissions;
create policy "contact_submissions staff read"
  on public.contact_submissions for select to authenticated
  using (public.can_admin_site(site_id) or public.is_staff());

drop policy if exists "contact_submissions staff update" on public.contact_submissions;
create policy "contact_submissions staff update"
  on public.contact_submissions for update to authenticated
  using (public.can_admin_site(site_id) or public.is_staff())
  with check (public.can_admin_site(site_id) or public.is_staff());
```

- [ ] **Step 9.3 — Run, PASS, commit**

```bash
npm run db:reset && HAS_LOCAL_DB=1 npm run test:api -- test/rls/contact-submissions.test.ts
git add supabase/migrations/20260416000003_contact_submissions.sql apps/api/test/rls/contact-submissions.test.ts
git commit -m "feat(sprint-3): contact_submissions table + RLS (two-consent LGPD pattern)"
```

---

## Task 10 — Migration: newsletter_subscriptions + RPC confirm

**Files:**
- Create: `supabase/migrations/20260416000004_newsletter_subscriptions.sql`
- Create: `apps/api/test/rls/newsletter-subscriptions.test.ts`

- [ ] **Step 10.1 — Write test** (insert pending, confirm via RPC, expired token rejected, brevo_id required when confirmed via direct update)

```ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

function token(seed: string) { return seed.padEnd(64, '0') }

describe.skipIf(skipIfNoLocalDb())('newsletter_subscriptions + confirm RPC', () => {
  const ids: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    if (ids.length) await admin.from('newsletter_subscriptions').delete().in('id', ids)
  })

  it('insert pending then confirm via RPC', async () => {
    const t = token('aaaa')
    const { data: ins } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'sub@x.com',
      status: 'pending_confirmation', confirmation_token: t,
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (ins?.id) ids.push(ins.id)

    const { data, error } = await admin.rpc('confirm_newsletter_subscription', { p_token: t })
    expect(error).toBeNull()
    expect(data.ok).toBe(true)
    expect(data.email).toBe('sub@x.com')
  })

  it('confirm RPC rejects expired token', async () => {
    const t = token('bbbb')
    const { data: ins } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'expired@x.com',
      status: 'pending_confirmation', confirmation_token: t,
      confirmation_expires_at: new Date(Date.now() - 60_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (ins?.id) ids.push(ins.id)

    const { data } = await admin.rpc('confirm_newsletter_subscription', { p_token: t })
    expect(data.ok).toBe(false)
    expect(data.error).toBe('expired')
  })

  it('rejects status=confirmed without brevo_contact_id', async () => {
    const { error } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'forced@x.com',
      status: 'confirmed', consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('UPSERT on existing pending rotates token', async () => {
    const t1 = token('cccc')
    const r1 = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'rotate@x.com',
      status: 'pending_confirmation', confirmation_token: t1,
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (r1.data?.id) ids.push(r1.data.id)

    const t2 = token('dddd')
    const r2 = await admin.from('newsletter_subscriptions').upsert({
      site_id: SHARED_SITE_A_ID, email: 'rotate@x.com',
      status: 'pending_confirmation', confirmation_token: t2,
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }, { onConflict: 'site_id,email' }).select('confirmation_token').single()
    expect(r2.error).toBeNull()
    expect(r2.data?.confirmation_token).toBe(t2)
  })
})
```

- [ ] **Step 10.2 — Create migration**

```sql
create table public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  email citext not null,
  status text not null check (status in ('pending_confirmation','confirmed','unsubscribed')),
  confirmation_token text,
  confirmation_expires_at timestamptz,
  consent_text_version text not null,
  ip inet,
  user_agent text,
  subscribed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  brevo_contact_id text,
  unique (site_id, email),
  check (status <> 'confirmed' or brevo_contact_id is not null or status = 'pending_confirmation')
);

-- Note: status='confirmed' brevo_contact_id check is loosened to allow cron-driven sync.
-- Production invariant enforced in cron sync logic, not at DB level (cron will sync brevo_contact_id immediately after confirm).

create unique index newsletter_pending_token
  on public.newsletter_subscriptions (confirmation_token)
  where status = 'pending_confirmation' and confirmation_expires_at > now();
create index on public.newsletter_subscriptions (site_id, status);

alter table public.newsletter_subscriptions enable row level security;

drop policy if exists "newsletter anon insert" on public.newsletter_subscriptions;
create policy "newsletter anon insert"
  on public.newsletter_subscriptions for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sites s
      where s.id = site_id
        and (
          coalesce(nullif(current_setting('app.site_id', true), ''), '') = ''
          or s.id = nullif(current_setting('app.site_id', true), '')::uuid
        )
    )
  );

drop policy if exists "newsletter staff read" on public.newsletter_subscriptions;
create policy "newsletter staff read"
  on public.newsletter_subscriptions for select to authenticated
  using (public.can_admin_site(site_id) or public.is_staff());

-- RPC: confirm subscription via token
create or replace function public.confirm_newsletter_subscription(p_token text)
returns json language plpgsql security definer as $$
declare v_sub record;
begin
  select id, site_id, email, status, confirmation_expires_at into v_sub
  from public.newsletter_subscriptions
  where confirmation_token = p_token
  for update;

  if v_sub.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_sub.status = 'confirmed' then
    return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id, 'already', true);
  end if;
  if v_sub.confirmation_expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  update public.newsletter_subscriptions
  set status = 'confirmed',
      confirmed_at = now(),
      confirmation_token = null,
      confirmation_expires_at = null
  where id = v_sub.id;

  return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id);
end $$;

grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated;
```

- [ ] **Step 10.3 — Run, PASS, commit**

```bash
npm run db:reset && HAS_LOCAL_DB=1 npm run test:api -- test/rls/newsletter-subscriptions.test.ts
git add supabase/migrations/20260416000004_newsletter_subscriptions.sql apps/api/test/rls/newsletter-subscriptions.test.ts
git commit -m "feat(sprint-3): newsletter_subscriptions + confirm RPC (decoupled Brevo sync via cron)"
```

---

## Task 11 — Migration: unsubscribe_tokens + RPC unsubscribe

**Files:**
- Create: `supabase/migrations/20260416000005_unsubscribe_tokens.sql`
- Create: `apps/api/test/rls/unsubscribe-tokens.test.ts`

- [ ] **Step 11.1 — Write test** (insert, RPC marks used, second RPC call returns already=true)

Full test pattern mirrors Task 10. Cases:
- insert token → RPC with token → returns ok + flips newsletter_subscriptions to unsubscribed
- RPC with non-existent token → not_found
- second RPC with same token → ok + already=true (idempotent)

- [ ] **Step 11.2 — Create migration**

```sql
create table public.unsubscribe_tokens (
  token text primary key check (token ~ '^[a-f0-9]{64}$'),
  site_id uuid not null references public.sites(id) on delete restrict,
  email citext not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (site_id, email)
);

create index on public.unsubscribe_tokens (email);

alter table public.unsubscribe_tokens enable row level security;

-- service role only direct access; anon via RPC
drop policy if exists "unsubscribe service write" on public.unsubscribe_tokens;
-- (no policy = effectively service-role only via bypass)

create or replace function public.unsubscribe_via_token(p_token text)
returns json language plpgsql security definer as $$
declare v_tok record; v_sub record;
begin
  select token, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens where token = p_token for update;

  if v_tok.token is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true, 'site_id', v_tok.site_id, 'email', v_tok.email);
  end if;

  select id, status into v_sub from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email for update;

  if v_sub.id is not null and v_sub.status <> 'unsubscribed' then
    update public.newsletter_subscriptions
    set status = 'unsubscribed', unsubscribed_at = now()
    where id = v_sub.id;
  end if;

  update public.unsubscribe_tokens set used_at = now() where token = p_token;

  return json_build_object('ok', true, 'site_id', v_tok.site_id, 'email', v_tok.email, 'sub_id', v_sub.id);
end $$;

grant execute on function public.unsubscribe_via_token(text) to anon, authenticated;
```

- [ ] **Step 11.3 — Run, PASS, commit**

```bash
git commit -m "feat(sprint-3): unsubscribe_tokens + unsubscribe_via_token RPC"
```

---

## Task 12 — Migration: sent_emails + email_provider enum

**Files:**
- Create: `supabase/migrations/20260416000006_sent_emails.sql`
- Create: `apps/api/test/rls/sent-emails.test.ts`

- [ ] **Step 12.1 — Write test** (insert via service, anon cannot read, staff can read for own site)

Standard pattern.

- [ ] **Step 12.2 — Create migration**

```sql
create type public.email_provider as enum ('brevo');

create table public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  template_name text not null,
  to_email citext not null,
  subject text not null,
  provider public.email_provider not null,
  provider_message_id text,
  status text not null check (status in ('queued','sent','bounced','complained','failed')),
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  error text,
  metadata jsonb
);

create index on public.sent_emails (to_email, sent_at desc);
create index on public.sent_emails (site_id, template_name, sent_at desc);
create index on public.sent_emails (provider_message_id) where provider_message_id is not null;

alter table public.sent_emails enable row level security;

drop policy if exists "sent_emails staff read" on public.sent_emails;
create policy "sent_emails staff read"
  on public.sent_emails for select to authenticated
  using (public.can_admin_site(site_id) or public.is_staff());

-- Insert/update only via service role (cron + server actions). No anon/authenticated write policy = denied.

comment on table public.sent_emails is
  'Audit log of transactional emails sent. Retention: 90 days (purge via cron in Sprint 4).';
```

- [ ] **Step 12.3 — Commit**

```bash
git commit -m "feat(sprint-3): sent_emails audit table + email_provider enum"
```

---

## Task 13 — Migration: sites extensions

**Files:**
- Create: `supabase/migrations/20260416000007_sites_extensions.sql`
- Create: `apps/api/test/rls/sites-extensions.test.ts`

- [ ] **Step 13.1 — Test**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe.skipIf(skipIfNoLocalDb())('sites extensions', () => {
  beforeAll(async () => { await ensureSharedSites(admin) })

  it('brevo_newsletter_list_id and contact_notification_email columns exist', async () => {
    const { data, error } = await admin.from('sites')
      .update({ brevo_newsletter_list_id: 7, contact_notification_email: 'admin@x.com' })
      .eq('id', SHARED_SITE_A_ID)
      .select('brevo_newsletter_list_id, contact_notification_email')
      .single()
    expect(error).toBeNull()
    expect(data?.brevo_newsletter_list_id).toBe(7)
    expect(data?.contact_notification_email).toBe('admin@x.com')
  })
})
```

- [ ] **Step 13.2 — Migration**

```sql
alter table public.sites
  add column brevo_newsletter_list_id int,
  add column contact_notification_email citext;

comment on column public.sites.brevo_newsletter_list_id is
  'Per-site Brevo list ID for newsletter sync. NULL = newsletter not configured for this site.';
comment on column public.sites.contact_notification_email is
  'Per-site email for contact form admin alerts. NULL = fallback to first owner of org.';
```

- [ ] **Step 13.3 — Update seed `supabase/seeds/dev.sql`** — set values for seeded site:

After the `insert into public.sites ...` block (the bythiagofigueiredo site), add:

```sql
update public.sites
set brevo_newsletter_list_id = 1,
    contact_notification_email = 'thiago@bythiagofigueiredo.com'
where slug = 'bythiagofigueiredo';
```

Also update truncate list at top of file to include new tables (child→parent):

```sql
truncate table
  public.sent_emails,
  public.unsubscribe_tokens,
  public.newsletter_subscriptions,
  public.contact_submissions,
  public.invitations,
  -- ... existing entries continue
  public.organizations
restrict;
```

- [ ] **Step 13.4 — Commit**

```bash
git add supabase/migrations/20260416000007_sites_extensions.sql apps/api/test/rls/sites-extensions.test.ts supabase/seeds/dev.sql
git commit -m "feat(sprint-3): sites.brevo_newsletter_list_id + contact_notification_email + seed update"
```

---

## Task 14 — `requireSiteAdminForRow` generic helper + Sprint 2 refactor

**Files:**
- Create: `apps/web/lib/cms/auth-guards.ts`
- Modify: `apps/web/src/app/cms/blog/[id]/edit/actions.ts` (refactor to use new helper)
- Test: extend existing `apps/web/test/app/cms-blog-actions.test.ts` to verify guard still works

- [ ] **Step 14.1 — Create `apps/web/lib/cms/auth-guards.ts`**

```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../supabase/service'

export type AuthorizableTable = 'blog_posts' | 'campaigns'

/**
 * Authorization guard for write server actions on site-scoped rows.
 * Looks up the row's site_id, then verifies the current user can administer that site
 * via can_admin_site RPC (uses authenticated SSR client, not service role).
 *
 * Throws on failure: 'row_not_found', 'authz_check_failed', 'forbidden'.
 */
export async function requireSiteAdminForRow(
  table: AuthorizableTable,
  rowId: string,
): Promise<{ siteId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data: row, error: rowErr } = await supabase
    .from(table)
    .select('site_id')
    .eq('id', rowId)
    .maybeSingle()

  if (rowErr) throw new Error(`row_lookup_failed: ${rowErr.message}`)
  if (!row) throw new Error('row_not_found')

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { data: allowed, error } = await userClient.rpc('can_admin_site', { p_site_id: row.site_id })
  if (error) throw new Error(`authz_check_failed: ${error.message}`)
  if (!allowed) throw new Error('forbidden')

  return { siteId: row.site_id as string }
}
```

- [ ] **Step 14.2 — Refactor `apps/web/src/app/cms/blog/[id]/edit/actions.ts`** — replace inline `requireSiteAdmin` with import:

Find existing `async function requireSiteAdmin(postId: string): ...` block and remove it. At top of file, add:

```ts
import { requireSiteAdminForRow } from '../../../../../../lib/cms/auth-guards'
```

Replace all internal calls `await requireSiteAdmin(id)` with `await requireSiteAdminForRow('blog_posts', id)`.

- [ ] **Step 14.3 — Update existing tests in `apps/web/test/app/cms-blog-actions.test.ts`**

The test mocks need to update import path:

Replace mock for the local guard with mock for `lib/cms/auth-guards`:

```ts
vi.mock('../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))
```

Adjust other `vi.doMock` paths similarly. Existing 6 tests should still pass with this guard mocked.

- [ ] **Step 14.4 — Run web tests, expect PASS**

```bash
npm run test:web
```

- [ ] **Step 14.5 — Commit**

```bash
git add apps/web/lib/cms/auth-guards.ts apps/web/src/app/cms/blog apps/web/test/app/cms-blog-actions.test.ts
git commit -m "refactor(sprint-3): generic requireSiteAdminForRow helper + Sprint 2 blog refactor"
```

---

## Task 15 — Login UI port + Turnstile

**Files:**
- Create: `apps/web/src/app/signin/page.tsx`
- Create: `apps/web/src/app/signin/actions.ts`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Modify: `apps/web/middleware.ts` (publicRoutes update)

- [ ] **Step 15.1 — Read tonagarantia signin page**

```bash
cat ~/Workspace/tonagarantia/apps/web/app/signin/page.tsx
```

Adapt for bythiagofigueiredo: same fields (email/password + Google OAuth), add Turnstile widget per Sprint 1b pattern (`apps/web/src/app/campaigns/[locale]/[slug]/submit-form.tsx` for reference).

- [ ] **Step 15.2 — Create `src/app/signin/page.tsx`**

```tsx
'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithPasswordAction, signInWithGoogleAction } from './actions'

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }): string
      reset(id?: string): void
    }
  }
}

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>
}

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const router = useRouter()
  const sp = useSearchParams()
  const redirect = sp.get('redirect') ?? '/cms'

  // Email hint from invite redirect
  useEffect(() => {
    const hint = sp.get('hint')
    if (hint) setEmail(hint)
  }, [sp])

  // Mount Turnstile widget
  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!sitekey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true; script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey, callback: (t) => setToken(t),
        })
        widgetIdRef.current = id
      }
    }
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [])

  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current)
    setToken(null)
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) { setError('Verificação anti-bot ainda carregando.'); return }
    setLoading(true)
    try {
      const result = await signInWithPasswordAction({ email, password, turnstileToken: token })
      if (!result.ok) {
        setError(result.error)
        resetTurnstile()
      } else {
        router.push(redirect)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  async function onGoogleClick() {
    setLoading(true)
    setError(null)
    const result = await signInWithGoogleAction({ redirectTo: redirect })
    if (!result.ok) setError(result.error)
    if (result.url) window.location.href = result.url
  }

  return (
    <main>
      <h1>Entrar</h1>
      <form onSubmit={onPasswordSubmit}>
        <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <div ref={turnstileRef} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading || !token}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <button type="button" onClick={onGoogleClick} disabled={loading}>Entrar com Google</button>
      <p><Link href="/signin/forgot">Esqueci minha senha</Link></p>
    </main>
  )
}
```

- [ ] **Step 15.3 — Create `src/app/signin/actions.ts`**

```ts
'use server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { verifyTurnstileToken } from '../../../lib/turnstile'

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )
}

export async function signInWithPasswordAction(input: { email: string; password: string; turnstileToken: string }) {
  const turnstileOk = await verifyTurnstileToken(input.turnstileToken)
  if (!turnstileOk) return { ok: false as const, error: 'Verificação anti-bot falhou' }

  const supabase = await getUserClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email, password: input.password,
  })
  if (error) {
    if (error.message.match(/invalid login credentials/i)) {
      return { ok: false as const, error: 'Email ou senha incorretos' }
    }
    if (error.message.match(/email not confirmed/i)) {
      return { ok: false as const, error: 'Confirme seu email antes de entrar' }
    }
    return { ok: false as const, error: 'Erro ao entrar. Tente novamente.' }
  }
  return { ok: true as const }
}

export async function signInWithGoogleAction(input: { redirectTo: string }) {
  const supabase = await getUserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(input.redirectTo)}`,
    },
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, url: data.url }
}
```

- [ ] **Step 15.4 — Create `src/app/auth/callback/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/cms'

  if (!code) return NextResponse.redirect(`${url.origin}/signin?error=oauth_no_code`)

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${url.origin}/signin?error=oauth_exchange_failed`)

  return NextResponse.redirect(`${url.origin}${next}`)
}
```

- [ ] **Step 15.5 — Update `apps/web/middleware.ts`** publicRoutes:

Find existing publicRoutes array in `createAuthMiddleware` config and replace with:

```ts
publicRoutes: [
  /^\/$/,
  '/signin',
  /^\/signin\/(forgot|reset)/,
  /^\/auth\//,
  /^\/api\//,
  /^\/_next\//,
  /^\/blog/,
  /^\/campaigns/,
  /^\/contact$/,
  /^\/signup\/invite\//,
  /^\/unsubscribe\//,
  /^\/newsletter\/confirm\//,
],
```

- [ ] **Step 15.6 — Test (web)**

Create `apps/web/test/app/signin.test.tsx` — at minimum: renders form, submit calls action with turnstile token, error shows on action failure.

- [ ] **Step 15.7 — Commit**

```bash
git add apps/web/src/app/signin apps/web/src/app/auth apps/web/middleware.ts apps/web/test/app/signin.test.tsx
git commit -m "feat(sprint-3): /signin port from tonagarantia + Turnstile + Google OAuth + /auth/callback"
```

---

## Task 16 — Forgot password + reset

**Files:**
- Create: `apps/web/src/app/signin/forgot/page.tsx`
- Create: `apps/web/src/app/signin/reset/[token]/page.tsx`

- [ ] **Step 16.1 — Create forgot page**

```tsx
'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: e1 } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/signin/reset`,
    })
    if (e1) { setError(e1.message); return }
    setSent(true)
  }

  if (sent) return <main><p>Verifique seu email pra redefinir a senha.</p></main>

  return (
    <main>
      <h1>Esqueci minha senha</h1>
      <form onSubmit={onSubmit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Enviar link</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 16.2 — Create reset page**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function ResetPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Senhas não coincidem'); return }
    if (password.length < 8) { setError('Senha deve ter pelo menos 8 caracteres'); return }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: e1 } = await supabase.auth.updateUser({ password })
    if (e1) { setError(e1.message); return }
    router.push('/cms')
  }

  return (
    <main>
      <h1>Nova senha</h1>
      <form onSubmit={onSubmit}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Nova senha" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirme" />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Atualizar senha</button>
      </form>
    </main>
  )
}
```

Note: Reset token from email opens this page with active session (Supabase handles via URL fragment). The `[token]` segment is decorative — reset link looks like `/signin/reset#access_token=...&type=recovery` and Supabase client picks up automatically.

- [ ] **Step 16.3 — Commit**

```bash
git add apps/web/src/app/signin/forgot apps/web/src/app/signin/reset
git commit -m "feat(sprint-3): /signin/forgot + /signin/reset (Supabase Auth defaults)"
```

---

## Task 17 — `/admin/users` page + invite actions

**Files:**
- Create: `apps/web/src/app/admin/users/page.tsx`
- Create: `apps/web/src/app/admin/users/actions.ts`
- Create: `apps/web/lib/email/sender.ts`
- Create: `apps/web/lib/email/service.ts`

- [ ] **Step 17.1 — Create email service singleton `apps/web/lib/email/service.ts`**

```ts
import { BrevoEmailAdapter, type IEmailService } from '@tn-figueiredo/email'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')
  cached = new BrevoEmailAdapter(apiKey)
  return cached
}
```

- [ ] **Step 17.2 — Create sender helper `apps/web/lib/email/sender.ts`**

```ts
import { ringContext } from '../cms/repositories'

export async function getEmailSender(siteId: string): Promise<{ email: string; name: string; brandName: string; primaryColor?: string }> {
  const site = await ringContext().getSite(siteId)
  if (!site) throw new Error(`site not found: ${siteId}`)
  const primaryDomain = site.domains[0] ?? 'bythiagofigueiredo.com'
  return {
    email: `noreply@${primaryDomain}`,
    name: site.name,
    brandName: site.name,
    primaryColor: '#0070f3', // Sprint 4 will resolve from sites.brand_color column
  }
}
```

- [ ] **Step 17.3 — Create actions `apps/web/src/app/admin/users/actions.ts`**

```ts
'use server'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { inviteTemplate } from '@tn-figueiredo/email'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getEmailService } from '../../../../lib/email/service'
import { getEmailSender } from '../../../../lib/email/sender'
import { getSiteContext } from '../../../../lib/cms/site-context'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function requireOrgAdmin(orgId: string): Promise<{ userId: string; email: string }> {
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('not_authenticated')
  const { data: role } = await userClient.rpc('org_role', { p_org_id: orgId })
  if (role !== 'owner' && role !== 'admin') throw new Error('forbidden')
  return { userId: user.id, email: user.email ?? '' }
}

export async function createInvitation(input: { email: string; role: 'admin' | 'editor' | 'author' }) {
  const ctx = await getSiteContext()
  const { userId: invitedBy, email: inviterEmail } = await requireOrgAdmin(ctx.orgId)

  const supabase = getSupabaseServiceClient()
  const token = generateToken()

  const { data: inv, error } = await supabase.from('invitations').insert({
    email: input.email,
    org_id: ctx.orgId,
    role: input.role,
    token,
    invited_by: invitedBy,
  }).select('id, expires_at').single()
  if (error) {
    if (error.message.match(/rate_limit_exceeded/)) return { ok: false as const, error: 'Limite de 20 convites/hora excedido' }
    if (error.code === '23505') return { ok: false as const, error: 'Já existe um convite pendente para esse email' }
    return { ok: false as const, error: `db_error: ${error.message}` }
  }

  // Get org name for email
  const { data: org } = await supabase.from('organizations').select('name').eq('id', ctx.orgId).single()
  const sender = await getEmailSender(ctx.siteId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const acceptUrl = `${baseUrl}/signup/invite/${token}`

  // Send invite email
  try {
    const result = await getEmailService().sendTemplate(inviteTemplate, sender, input.email, {
      inviterName: inviterEmail.split('@')[0]!,
      orgName: org?.name ?? 'TN Figueiredo',
      role: input.role,
      acceptUrl,
      expiresAt: new Date(inv.expires_at as string),
      branding: { brandName: sender.brandName, primaryColor: sender.primaryColor },
    }, ctx.defaultLocale)

    await supabase.from('sent_emails').insert({
      site_id: ctx.siteId, template_name: 'invite', to_email: input.email,
      subject: `${inviterEmail.split('@')[0]} convidou você`,
      provider: 'brevo', provider_message_id: result.messageId, status: 'queued',
      metadata: { invitation_id: inv.id },
    })
  } catch (e) {
    // Log but don't fail invitation
    console.error('[invite_email_send_failed]', e)
  }

  revalidatePath('/admin/users')
  return { ok: true as const, invitationId: inv.id }
}

export async function revokeInvitation(invitationId: string) {
  const supabase = getSupabaseServiceClient()
  const { data: row } = await supabase.from('invitations').select('org_id').eq('id', invitationId).maybeSingle()
  if (!row) throw new Error('not_found')
  const { userId } = await requireOrgAdmin(row.org_id as string)

  await supabase.from('invitations')
    .update({ revoked_at: new Date().toISOString(), revoked_by_user_id: userId })
    .eq('id', invitationId)
  revalidatePath('/admin/users')
}

export async function resendInvitation(invitationId: string) {
  const supabase = getSupabaseServiceClient()
  const { data: row } = await supabase.from('invitations')
    .select('id, email, role, org_id, token, expires_at, organization:organizations(name)')
    .eq('id', invitationId)
    .maybeSingle()
  if (!row) throw new Error('not_found')
  await requireOrgAdmin(row.org_id as string)

  const ctx = await getSiteContext()
  const sender = await getEmailSender(ctx.siteId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const acceptUrl = `${baseUrl}/signup/invite/${row.token as string}`

  await getEmailService().sendTemplate(inviteTemplate, sender, row.email as string, {
    inviterName: 'TN Figueiredo',
    orgName: (row.organization as { name?: string } | null)?.name ?? 'TN Figueiredo',
    role: row.role as 'admin' | 'editor' | 'author' | 'owner',
    acceptUrl,
    expiresAt: new Date(row.expires_at as string),
    branding: { brandName: sender.brandName, primaryColor: sender.primaryColor },
  }, ctx.defaultLocale)

  await supabase.from('invitations').update({
    last_sent_at: new Date().toISOString(),
    resend_count: (await supabase.from('invitations').select('resend_count').eq('id', invitationId).single()).data!.resend_count as number + 1,
  }).eq('id', invitationId)
  revalidatePath('/admin/users')
}
```

- [ ] **Step 17.4 — Create page `apps/web/src/app/admin/users/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { createInvitation, revokeInvitation, resendInvitation } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const ctx = await getSiteContext()
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
  const { data: role } = await userClient.rpc('org_role', { p_org_id: ctx.orgId })
  if (role !== 'owner' && role !== 'admin') redirect('/cms')

  const supabase = getSupabaseServiceClient()
  const { data: members } = await supabase.from('organization_members').select('user_id, role')
    .eq('org_id', ctx.orgId)
  const { data: invites } = await supabase.from('invitations')
    .select('id, email, role, expires_at, last_sent_at, resend_count')
    .eq('org_id', ctx.orgId)
    .is('accepted_at', null).is('revoked_at', null)

  return (
    <main>
      <h1>Usuários e convites</h1>
      <h2>Membros ativos ({members?.length ?? 0})</h2>
      <ul>
        {members?.map(m => <li key={m.user_id as string}>{m.user_id} · {m.role as string}</li>)}
      </ul>

      <h2>Convites pendentes ({invites?.length ?? 0})</h2>
      <ul>
        {invites?.map(inv => (
          <li key={inv.id as string}>
            {inv.email} · {inv.role} · expira em {String(inv.expires_at).slice(0, 10)}
            <form action={async () => { 'use server'; await resendInvitation(inv.id as string) }}>
              <button type="submit">Reenviar</button>
            </form>
            <form action={async () => { 'use server'; await revokeInvitation(inv.id as string) }}>
              <button type="submit">Revogar</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Novo convite</h2>
      <form action={async (formData) => {
        'use server'
        await createInvitation({
          email: formData.get('email') as string,
          role: formData.get('role') as 'admin' | 'editor' | 'author',
        })
      }}>
        <input type="email" name="email" required placeholder="email@example.com" />
        <select name="role">
          <option value="author">author</option>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </select>
        <button type="submit">Convidar</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 17.5 — Test (mock email service)** — minimal: `createInvitation` happy path returns ok, rate limit error surfaces correctly, revoke updates row.

- [ ] **Step 17.6 — Commit**

```bash
git add apps/web/lib/email apps/web/src/app/admin/users
git commit -m "feat(sprint-3): /admin/users page + createInvitation/revokeInvitation/resendInvitation actions"
```

---

## Task 18 — `/signup/invite/[token]` acceptance page + actions

**Files:**
- Create: `apps/web/src/app/signup/invite/[token]/page.tsx`
- Create: `apps/web/src/app/signup/invite/[token]/actions.ts`

- [ ] **Step 18.1 — Create actions**

```ts
// apps/web/src/app/signup/invite/[token]/actions.ts
'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
}

export async function acceptInviteForCurrentUser(token: string) {
  const supabase = await getUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'not_authenticated' }

  const { data, error } = await supabase.rpc('accept_invitation_atomic', {
    p_token: token, p_user_id: user.id,
  })
  if (error) return { ok: false as const, error: `rpc_failed: ${error.message}` }
  return data as { ok: true; org_id: string } | { ok: false; error: string }
}

export async function acceptInviteWithPassword(token: string, password: string) {
  const supabase = getSupabaseServiceClient()

  // 1. Validate via RPC
  const { data: invInfo } = await supabase.rpc('get_invitation_by_token', { p_token: token })
  if (!invInfo || invInfo.expired) return { ok: false as const, error: 'invalid_or_expired' }

  // 2. createUser
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: invInfo.email as string,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    if (createErr?.message.match(/already registered/i)) return { ok: false as const, error: 'email_already_registered' }
    return { ok: false as const, error: 'signup_failed' }
  }
  const userId = created.user.id

  // 3. Atomic accept
  const { data: acceptData, error: acceptErr } = await supabase.rpc('accept_invitation_atomic', {
    p_token: token, p_user_id: userId,
  })
  if (acceptErr || (acceptData && !(acceptData as { ok: boolean }).ok)) {
    // Compensating: delete the user we just created
    await supabase.auth.admin.deleteUser(userId)
    return { ok: false as const, error: 'accept_failed' }
  }

  // 4. Sign in via cookie (set session)
  const userClient = await getUserClient()
  await userClient.auth.signInWithPassword({ email: invInfo.email as string, password })

  return { ok: true as const, redirectTo: '/cms' }
}
```

- [ ] **Step 18.2 — Create page**

```tsx
// apps/web/src/app/signup/invite/[token]/page.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { acceptInviteForCurrentUser, acceptInviteWithPassword } from './actions'

interface Props { params: Promise<{ token: string }> }

export default async function InviteAcceptPage({ params }: Props) {
  const { token } = await params
  const supabase = getSupabaseServiceClient()

  const { data: inv } = await supabase.rpc('get_invitation_by_token', { p_token: token })
  if (!inv) return <main><h1>Convite inválido</h1></main>
  if (inv.expired) return <main><h1>Convite expirado</h1><p>Solicite um novo ao admin.</p></main>

  // Check current session
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
  const { data: { user } } = await userClient.auth.getUser()

  if (user) {
    if (user.email !== inv.email) {
      return <main>
        <h1>Email diferente</h1>
        <p>Este convite é para <strong>{inv.email as string}</strong> mas você está logado como <strong>{user.email}</strong>.</p>
        <p>Saia da sua conta e tente novamente, ou peça um convite pro email correto.</p>
      </main>
    }
    return (
      <main>
        <h1>Aceitar convite</h1>
        <p>Você foi convidado para <strong>{inv.org_name as string}</strong> como <strong>{inv.role as string}</strong>.</p>
        <form action={async () => {
          'use server'
          const r = await acceptInviteForCurrentUser(token)
          if (r.ok) redirect('/cms')
        }}>
          <button type="submit">Aceitar convite</button>
        </form>
      </main>
    )
  }

  // Anon: check existing user
  const { data: existing } = await supabase.auth.admin.listUsers()
  const exists = (existing.users ?? []).some((u) => u.email?.toLowerCase() === String(inv.email).toLowerCase())

  if (exists) {
    redirect(`/signin?redirect=/signup/invite/${token}&hint=${encodeURIComponent(inv.email as string)}`)
  }

  return (
    <main>
      <h1>Criar conta</h1>
      <p>Convite para <strong>{inv.email as string}</strong> em <strong>{inv.org_name as string}</strong> como <strong>{inv.role as string}</strong>.</p>
      <form action={async (formData) => {
        'use server'
        const password = formData.get('password') as string
        const confirm = formData.get('confirm') as string
        if (password !== confirm) return
        if (password.length < 8) return
        const r = await acceptInviteWithPassword(token, password)
        if (r.ok) redirect(r.redirectTo)
      }}>
        <input type="password" name="password" required placeholder="Senha (min 8)" />
        <input type="password" name="confirm" required placeholder="Confirmar senha" />
        <button type="submit">Criar conta e aceitar convite</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 18.3 — Commit**

```bash
git add apps/web/src/app/signup
git commit -m "feat(sprint-3): /signup/invite/[token] page + accept actions (existing + new user paths)"
```

---

## Task 19-20 — Newsletter signup widget + confirm page + unsubscribe

Use Sprint 1b campaign-submit pattern as reference. Files:
- Create: `apps/web/src/components/newsletter-signup.tsx`
- Create: `apps/web/src/app/newsletter/subscribe/actions.ts`
- Create: `apps/web/src/app/newsletter/confirm/[token]/page.tsx`
- Create: `apps/web/src/app/unsubscribe/[token]/page.tsx`
- Create: `apps/web/src/app/unsubscribe/[token]/actions.ts`

Pattern (abbreviated due to length — follow Sprint 1b campaign submit + Section 5 of spec):

- `<NewsletterSignup>` client component: email + consent checkbox + Turnstile + submit calls `subscribeToNewsletter` action
- `subscribeToNewsletter` server action: verifyTurnstile, validate, generate token, UPSERT (with conflict handling for existing pending/confirmed/unsubscribed), send confirmation email
- `/newsletter/confirm/[token]` server component: calls RPC, renders success/error
- `/unsubscribe/[token]` server component + form action: calls RPC, renders success
- All wrapped in standard error handling + sent_emails audit insert

- [ ] **Step 19.1 — Implement (~150 LOC across files)**
- [ ] **Step 19.2 — Test (subscribe action mocking email service + supabase, confirm page rendering, unsubscribe page form action)**
- [ ] **Step 19.3 — Commit:** `feat(sprint-3): newsletter subscribe + confirm + unsubscribe flow`

---

## Task 21 — Contact form + page + actions

Files:
- Create: `apps/web/src/components/contact-form.tsx`
- Create: `apps/web/src/app/contact/page.tsx`
- Create: `apps/web/src/app/contact/actions.ts`
- Create: `apps/web/src/app/cms/contacts/page.tsx`
- Create: `apps/web/src/app/cms/contacts/[id]/page.tsx`

Pattern from Section 5 spec:
- `<ContactForm>` client: name + email + message + processing consent + optional marketing + Turnstile
- `submitContact` server action: validate, INSERT, chain to subscribeToNewsletter if marketing=true, send admin alert + auto-reply (rate-limited 1/24h via sent_emails query)
- `/cms/contacts` admin list (mirror /cms/blog list pattern)
- `/cms/contacts/[id]` detail with mailto: reply + "marcar como respondido" form

- [ ] **Step 21.1 — Implement**
- [ ] **Step 21.2 — Test**
- [ ] **Step 21.3 — Commit:** `feat(sprint-3): contact form + admin contacts list + admin alerts + auto-reply with rate limit`

---

## Task 22 — Cron route: sync newsletter pending

**Files:**
- Create: `apps/web/src/app/api/cron/sync-newsletter-pending/route.ts`
- Modify: `apps/web/vercel.json` (add cron schedule)
- Test: `apps/web/test/api/cron-sync-newsletter.test.ts`

- [ ] **Step 22.1 — Test (5 cases: 401, 200 with 0 to sync, 200 syncs confirmed-pending-brevo, handles Brevo error gracefully, processes unsubscribe sync)**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('../../lib/brevo', () => ({
  createBrevoContact: vi.fn(),
}))
vi.mock('../../lib/email/service', () => ({
  getEmailService: () => ({ sendTemplate: vi.fn().mockResolvedValue({ messageId: 'x' }) }),
}))
vi.mock('../../lib/email/sender', () => ({
  getEmailSender: vi.fn().mockResolvedValue({ email: 'noreply@x.com', name: 'X', brandName: 'X' }),
}))
vi.mock('../../lib/cms/repositories', () => ({
  ringContext: () => ({ getSite: vi.fn().mockResolvedValue({ id: 's1', brevo_newsletter_list_id: 1, default_locale: 'pt-BR' }) }),
}))

import { POST } from '../../src/app/api/cron/sync-newsletter-pending/route'

beforeEach(() => { process.env.CRON_SECRET = 'topsecret'; vi.clearAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

describe('POST /api/cron/sync-newsletter-pending', () => {
  it('401 without bearer', async () => {
    const req = new Request('http://x/api/cron/sync-newsletter-pending', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
  // ... additional cases
})
```

- [ ] **Step 22.2 — Implement route**

```ts
// apps/web/src/app/api/cron/sync-newsletter-pending/route.ts
import { welcomeTemplate, ensureUnsubscribeToken } from '@tn-figueiredo/email'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getEmailService } from '../../../../lib/email/service'
import { getEmailSender } from '../../../../lib/email/sender'
import { ringContext } from '../../../../lib/cms/repositories'
import { createBrevoContact } from '../../../../lib/brevo'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const start = Date.now()
  let synced = 0, unsubscribed = 0
  const errors: string[] = []

  // Sync pending confirms → Brevo
  const { data: pending } = await supabase
    .from('newsletter_subscriptions')
    .select('id, site_id, email, consent_text_version')
    .eq('status', 'confirmed')
    .is('brevo_contact_id', null)
    .limit(50)

  for (const sub of pending ?? []) {
    try {
      const site = await ringContext().getSite(sub.site_id as string)
      if (!site?.brevo_newsletter_list_id) continue

      const contact = await createBrevoContact({
        email: sub.email as string,
        listId: site.brevo_newsletter_list_id,
      })
      const brevoId = contact.id != null ? String(contact.id) : null
      await supabase.from('newsletter_subscriptions')
        .update({ brevo_contact_id: brevoId })
        .eq('id', sub.id as string)

      // Send welcome email
      const sender = await getEmailSender(sub.site_id as string)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
      const unsubscribeUrl = await ensureUnsubscribeToken(supabase, sub.site_id as string, sub.email as string, baseUrl)
      const result = await getEmailService().sendTemplate(welcomeTemplate, sender, sub.email as string, {
        siteUrl: baseUrl,
        branding: { brandName: sender.brandName, primaryColor: sender.primaryColor, unsubscribeUrl },
      }, site.default_locale ?? 'pt-BR')
      await supabase.from('sent_emails').insert({
        site_id: sub.site_id, template_name: 'welcome', to_email: sub.email,
        subject: 'Welcome', provider: 'brevo', provider_message_id: result.messageId, status: 'queued',
      })
      synced++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  // Sync unsubscribes → Brevo deletion
  const { data: unsubs } = await supabase
    .from('newsletter_subscriptions')
    .select('id, site_id, brevo_contact_id')
    .eq('status', 'unsubscribed')
    .not('brevo_contact_id', 'is', null)
    .limit(50)

  for (const sub of unsubs ?? []) {
    // Sprint 3 minimal: nullify brevo_contact_id (Brevo deletion API call deferred to Sprint 4)
    await supabase.from('newsletter_subscriptions')
      .update({ brevo_contact_id: null })
      .eq('id', sub.id as string)
    unsubscribed++
  }

  await supabase.from('cron_runs').insert({
    job: 'sync-newsletter-pending',
    status: errors.length > 0 ? 'error' : 'ok',
    duration_ms: Date.now() - start,
    items_processed: synced + unsubscribed,
    error: errors.length > 0 ? errors.join('; ').slice(0, 1000) : null,
  })

  return Response.json({ synced, unsubscribed, errors: errors.length })
}
```

- [ ] **Step 22.3 — Update `apps/web/vercel.json`** crons array:

```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/sync-newsletter-pending", "schedule": "* * * * *" }
  ]
}
```

- [ ] **Step 22.4 — Commit**

```bash
git add apps/web/src/app/api/cron/sync-newsletter-pending apps/web/test/api/cron-sync-newsletter.test.ts apps/web/vercel.json
git commit -m "feat(sprint-3): cron sync-newsletter-pending (Brevo sync + welcome email + unsubscribe sync)"
```

---

## Task 23-30 — Campaign admin CRUD (Epic 5)

This epic mirrors Sprint 2 blog admin CRUD pattern with specialized components for campaigns. Tasks (abbreviated):

### Task 23 — `Campaign` types in package

Create `packages/cms/src/types/campaign.ts` with `Campaign`, `CampaignTranslation`, `CampaignListItem`, `CreateCampaignInput`, `UpdateCampaignInput`. Bump cms package version. Commit.

### Task 24 — `SupabaseCampaignRepository`

Create `packages/cms/src/supabase/campaign-repository.ts` mirroring `SupabasePostRepository` structure. Tests with mocked Supabase. Commit.

### Task 25 — Move extras-schema + extras-renderer to package

Move `apps/web/lib/campaigns/extras-schema.ts` → `packages/cms/src/extras/schema.ts`. Move `apps/web/src/app/campaigns/[locale]/[slug]/extras-renderer.tsx` → `packages/cms/src/extras/renderer.tsx`. Update imports in apps/web (now `import { ExtrasRenderer, ExtrasSchema } from '@tn-figueiredo/cms'`). Add to package barrel. Commit.

### Task 26 — `update_campaign_atomic` RPC

Create `supabase/migrations/20260416000008_update_campaign_atomic.sql`:

```sql
create or replace function public.update_campaign_atomic(
  p_campaign_id uuid,
  p_locale text,
  p_campaign_patch jsonb,
  p_translation_patch jsonb
) returns void language plpgsql security definer as $$
begin
  update public.campaigns set
    interest          = coalesce(p_campaign_patch->>'interest', interest),
    status            = coalesce((p_campaign_patch->>'status')::post_status, status),
    scheduled_for     = coalesce((p_campaign_patch->>'scheduled_for')::timestamptz, scheduled_for),
    pdf_storage_path  = coalesce(p_campaign_patch->>'pdf_storage_path', pdf_storage_path),
    brevo_list_id     = coalesce((p_campaign_patch->>'brevo_list_id')::int, brevo_list_id),
    brevo_template_id = coalesce((p_campaign_patch->>'brevo_template_id')::int, brevo_template_id),
    form_fields       = coalesce(p_campaign_patch->'form_fields', form_fields)
  where id = p_campaign_id;

  insert into public.campaign_translations as ct (
    campaign_id, locale, slug, title, main_hook_md,
    supporting_argument_md, introductory_block_md, body_content_md,
    form_intro_md, form_button_label, form_button_loading_label,
    context_tag, success_headline, success_headline_duplicate,
    success_subheadline, success_subheadline_duplicate,
    check_mail_text, download_button_label,
    meta_title, meta_description, og_image_url, extras
  )
  values (
    p_campaign_id, p_locale,
    coalesce(p_translation_patch->>'slug', ''),
    coalesce(p_translation_patch->>'title', ''),
    coalesce(p_translation_patch->>'main_hook_md', ''),
    p_translation_patch->>'supporting_argument_md',
    p_translation_patch->>'introductory_block_md',
    p_translation_patch->>'body_content_md',
    p_translation_patch->>'form_intro_md',
    coalesce(p_translation_patch->>'form_button_label', 'Enviar'),
    coalesce(p_translation_patch->>'form_button_loading_label', 'Enviando...'),
    coalesce(p_translation_patch->>'context_tag', ''),
    coalesce(p_translation_patch->>'success_headline', ''),
    coalesce(p_translation_patch->>'success_headline_duplicate', ''),
    coalesce(p_translation_patch->>'success_subheadline', ''),
    coalesce(p_translation_patch->>'success_subheadline_duplicate', ''),
    coalesce(p_translation_patch->>'check_mail_text', ''),
    coalesce(p_translation_patch->>'download_button_label', ''),
    p_translation_patch->>'meta_title',
    p_translation_patch->>'meta_description',
    p_translation_patch->>'og_image_url',
    p_translation_patch->'extras'
  )
  on conflict (campaign_id, locale) do update set
    slug              = coalesce(p_translation_patch->>'slug', ct.slug),
    title             = coalesce(p_translation_patch->>'title', ct.title),
    main_hook_md      = coalesce(p_translation_patch->>'main_hook_md', ct.main_hook_md),
    supporting_argument_md = coalesce(p_translation_patch->>'supporting_argument_md', ct.supporting_argument_md),
    introductory_block_md  = coalesce(p_translation_patch->>'introductory_block_md', ct.introductory_block_md),
    body_content_md   = coalesce(p_translation_patch->>'body_content_md', ct.body_content_md),
    form_intro_md     = coalesce(p_translation_patch->>'form_intro_md', ct.form_intro_md),
    form_button_label = coalesce(p_translation_patch->>'form_button_label', ct.form_button_label),
    form_button_loading_label = coalesce(p_translation_patch->>'form_button_loading_label', ct.form_button_loading_label),
    context_tag       = coalesce(p_translation_patch->>'context_tag', ct.context_tag),
    success_headline  = coalesce(p_translation_patch->>'success_headline', ct.success_headline),
    success_headline_duplicate    = coalesce(p_translation_patch->>'success_headline_duplicate', ct.success_headline_duplicate),
    success_subheadline           = coalesce(p_translation_patch->>'success_subheadline', ct.success_subheadline),
    success_subheadline_duplicate = coalesce(p_translation_patch->>'success_subheadline_duplicate', ct.success_subheadline_duplicate),
    check_mail_text   = coalesce(p_translation_patch->>'check_mail_text', ct.check_mail_text),
    download_button_label = coalesce(p_translation_patch->>'download_button_label', ct.download_button_label),
    meta_title        = coalesce(p_translation_patch->>'meta_title', ct.meta_title),
    meta_description  = coalesce(p_translation_patch->>'meta_description', ct.meta_description),
    og_image_url      = coalesce(p_translation_patch->>'og_image_url', ct.og_image_url),
    extras            = coalesce(p_translation_patch->'extras', ct.extras);
end $$;

grant execute on function public.update_campaign_atomic(uuid, text, jsonb, jsonb) to authenticated, service_role;
```

Commit.

### Task 27 — `/cms/campaigns` list page

Mirror `/cms/blog/page.tsx` adapting columns. Filters: status, locale, title search. Action menu per row.

### Task 28 — `/cms/campaigns/new` page

Server action creates draft campaign + initial translation, redirect to edit.

### Task 29 — `/cms/campaigns/[id]/edit` page + actions

Page wraps `<CampaignEditor>` from `_components/`. Actions mirror blog: `saveCampaign`, `publishCampaign`, `unpublishCampaign`, `archiveCampaign`, `deleteCampaign`, `uploadCampaignAsset`, `compileCampaignPreview`. All guarded by `requireSiteAdminForRow('campaigns', id)`.

### Task 30 — `<CampaignEditor>` + sub-components

Files in `apps/web/src/app/cms/campaigns/_components/`:
- `campaign-editor.tsx` — main editor with collapsible sections
- `form-fields-editor.tsx` — structured rows for form fields
- `extras-editor.tsx` — Add Block dropdown + per-kind forms (4 kinds)
- `mdx-field.tsx` — textarea + collapsible preview using `<EditorPreview>`

Estimate per task: ~2h each. Commits:
- `feat(sprint-3): Campaign types in @tn-figueiredo/cms`
- `feat(sprint-3): SupabaseCampaignRepository`
- `refactor(sprint-3): move extras schema + renderer to @tn-figueiredo/cms`
- `feat(sprint-3): update_campaign_atomic RPC`
- `feat(sprint-3): /cms/campaigns admin pages + actions`
- `feat(sprint-3): CampaignEditor + structured form_fields/extras editors + MDX field with preview`
- `feat(sprint-3): /cms/campaigns/[id]/submissions list`

---

## Task 31-37 — Carry-over polish (Epic 6)

### Task 31 — `useAutosave` hook in package

Create `packages/cms/src/editor/use-autosave.ts` per Section 7 spec (primitive deps, dirty tracking, conditional beforeunload). Tests. Commit.

### Task 32 — Extend `getEditorStrings` for new fields

Add to `packages/cms/src/editor/strings.ts`: `metaSeoSection`, `metaTitle`, `metaDescription`, `ogImage`, `coverImage`, `restoreDraftPrompt`, `restoreButton`, `discardButton`, `unsavedChangesWarning`. pt-BR + en. Commit.

### Task 33 — `<MetaSeoFields>` + PostEditor integration

Create `packages/cms/src/editor/meta-seo-fields.tsx`. Update `editor.tsx` to use it (collapsible details element). Update SavePostInput to include metaTitle/metaDescription/ogImageUrl. Update `apps/web` server action `savePost` to pass through. Tests. Commit.

### Task 34 — Cover image picker integration

Update `editor.tsx` to add cover image field with text URL + AssetPicker. Update SavePostInput + apps/web server action. Tests. Commit.

### Task 35 — Locale switcher on `/blog/[locale]/[slug]`

Update `apps/web/src/app/blog/[locale]/[slug]/page.tsx`: add `<nav aria-label="Locale switcher">` with Links to each locale's slug. Update `generateMetadata` with `alternates.languages` mapping. Tests. Commit.

### Task 36 — Radix AlertDialog + ConfirmActionButton

Add `@radix-ui/react-alert-dialog@1.1.4` to `apps/web/package.json` deps. Create `apps/web/src/components/confirm-action-button.tsx` per Section 7 spec. Tests. Commit.

### Task 37 — Delete UI in `/cms/blog`

Update `apps/web/src/app/cms/blog/page.tsx` to use `<ConfirmActionButton>` for delete + archive actions per row. Show only for valid status. Tests. Commit.

---

## Task 38-44 — Package extraction (Epic 7 / T14)

After all Epics 1-6 complete and tests green:

### Task 38 — Bump versions + remove private flags

In `packages/cms/package.json` and `packages/email/package.json`:
- Change `"version": "0.1.0-dev"` → `"version": "0.1.0"`
- Remove `"private": true`

Verify each package builds + tests pass. Commit:
```bash
git commit -m "chore(sprint-3): prepare packages/cms + packages/email for v0.1.0 release"
```

### Task 39 — Create GitHub repos

```bash
gh repo create TN-Figueiredo/cms --private --description "CMS package — TN-Figueiredo ecosystem" --disable-wiki
gh repo create TN-Figueiredo/email --private --description "Transactional email — TN-Figueiredo ecosystem" --disable-wiki
```

### Task 40 — Subtree split + push (cms first)

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git subtree split --prefix=packages/cms -b cms-extract
git clone git@github.com:TN-Figueiredo/cms.git /tmp/cms-repo
cd /tmp/cms-repo
git fetch /Users/figueiredo/Workspace/bythiagofigueiredo cms-extract:main
git push origin main
```

Repeat for email:
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git subtree split --prefix=packages/email -b email-extract
git clone git@github.com:TN-Figueiredo/email.git /tmp/email-repo
cd /tmp/email-repo
git fetch /Users/figueiredo/Workspace/bythiagofigueiredo email-extract:main
git push origin main
```

### Task 41 — Setup CI workflows in both repos

In each new repo, add `.github/workflows/publish.yml` (publish on tag v*) and `.github/workflows/ci.yml` (typecheck + test + build on PR/push). Also add `.npmrc` with `@tn-figueiredo:registry=https://npm.pkg.github.com`. Commit + push.

(See Section 2 of spec for complete workflow YAML.)

### Task 42 — Tag + publish v0.1.0 (both repos)

```bash
cd /tmp/cms-repo && git tag v0.1.0 && git push origin v0.1.0
cd /tmp/email-repo && git tag v0.1.0 && git push origin v0.1.0
```

Wait for CI to publish each. Verify on GH Packages.

### Task 43 — Smoke test published packages

```bash
mkdir /tmp/pkg-smoke && cd /tmp/pkg-smoke && npm init -y
npm install @tn-figueiredo/cms@0.1.0 @tn-figueiredo/email@0.1.0 react@19 react-dom@19 @supabase/supabase-js@2.45.4

cat > smoke.mjs <<'EOF'
import { compileMdx, defaultComponents, calculateReadingTime } from '@tn-figueiredo/cms'
import { welcomeTemplate, BrevoEmailAdapter } from '@tn-figueiredo/email'
const r = await compileMdx('# Hello', defaultComponents)
if (calculateReadingTime('a '.repeat(400)) !== 2) { console.error('FAIL'); process.exit(1) }
const w = await welcomeTemplate.render({ siteUrl: 'https://x.com', branding: { brandName: 'X' } }, 'pt-BR')
if (!w.subject || !w.html) { console.error('FAIL'); process.exit(1) }
console.log('OK')
EOF
node smoke.mjs
# Expected: OK
```

If fails, fix in respective repo, bump v0.1.1, retry.

### Task 44 — Swap apps/web → published versions + cleanup

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
# Edit apps/web/package.json:
#   "@tn-figueiredo/cms": "*"   →   "@tn-figueiredo/cms": "0.1.0"
#   "@tn-figueiredo/email": "*" →   "@tn-figueiredo/email": "0.1.0"

# Edit apps/web/next.config.ts: remove transpilePackages (published packages ship dist)
#   transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/email'],  →  delete entire line

npm install
npm test                  # all green
cd apps/web && npx next build   # green

# Remove monorepo packages
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git rm -r packages/cms packages/email
git commit -m "chore(sprint-3): extract @tn-figueiredo/cms + email to own repos, install v0.1.0 from GH Packages"
```

---

## Task 45 — Final docs + PR + prod push

### Task 45a — Update CLAUDE.md

Document Sprint 3 in CLAUDE.md:
- Add `## @tn-figueiredo/email package` section (mirrors cms section)
- Update Roadmap: Sprint 3 ✅ done, Sprint 4 next
- Add carry-over notes Sprint 3 → Sprint 4 (LGPD pages, custom auth emails, observability, etc.)
- Update env section: no new env vars needed (Brevo credentials already exist)
- Add new helper section: "Server action authz: use `requireSiteAdminForRow(table, id)` for all write actions on site-scoped rows"

### Task 45b — Push + PR + merge

```bash
git push origin staging
gh pr create --base main --head staging --title "feat: Sprint 3 — auth, lead capture, admin extraction" --body "..."
gh pr merge <PR#> --merge --admin
git pull origin main
```

### Task 45c — Prod DB push (manual)

User runs:
```bash
npm run db:push:prod
```

Push 8 new migrations (20260416000001-008). Type YES.

After prod push, manually configure in Supabase Dashboard:
- Auth → Providers → Google: enable + client_id/secret
- Sites table: ensure prod row has correct `domains`, `default_locale`, `brevo_newsletter_list_id`, `contact_notification_email`

Commit final:
```bash
git commit -m "docs(sprint-3): update CLAUDE.md + Sprint 4 carry-over"
```

---

## Done criteria (Sprint 3)

- [ ] All 8 new migrations apply cleanly on `db:reset` + prod
- [ ] `@tn-figueiredo/email@0.1.0` + `@tn-figueiredo/cms@0.1.0` published to GH Packages
- [ ] Both packages extracted to own repos (TN-Figueiredo/email, TN-Figueiredo/cms)
- [ ] apps/web installs published packages (no workspace dependency)
- [ ] /signin functional with email+password + Google OAuth + Turnstile
- [ ] /admin/users page + invite flow end-to-end
- [ ] /signup/invite/[token] handles new + existing user paths
- [ ] Newsletter subscribe → confirm → cron sync to Brevo + welcome email
- [ ] Contact form → admin alert + auto-reply (rate-limited)
- [ ] /unsubscribe/[token] flips status + cron syncs to Brevo
- [ ] /cms/campaigns CRUD functional
- [ ] PostEditor with autosave + meta SEO + cover picker
- [ ] /blog/[locale]/[slug] with locale switcher + hreflang
- [ ] /cms/blog with delete UI (Radix AlertDialog)
- [ ] All write actions guarded by `requireSiteAdminForRow`
- [ ] Tests green: `npm test` + `HAS_LOCAL_DB=1 npm run test:api`
- [ ] CLAUDE.md updated
- [ ] PR merged + prod pushed

## Notes & caveats

- **Empire pattern complete:** 4 consumers (tonagarantia, CalcHub, MEISimples, TravelCalc) can now consume `@tn-figueiredo/cms` + `@tn-figueiredo/email` from GH Packages.
- **Iteration post-extraction:** clone TN-Figueiredo/<name> separately, edit, bump version, tag → CI publishes, then `npm install @tn-figueiredo/<name>@<new> -w apps/web`.
- **Edge runtime:** middleware uses ring context — verify Edge Runtime imports work after T14 (no `transpilePackages`).
- **Brevo rate limit:** p-queue enforces 5 req/s. For bulk imports (not Sprint 3 scope), use Brevo bulk API.
- **Compensating actions:** invite acceptance with createUser failure → deleteUser. Tested via test injection.
- **Cron sync latency:** newsletter confirmation shows instant success; Brevo sync + welcome email arrive within 1 minute.
- **Sprint 4 carry-over:** custom branded password reset email, LGPD pages, right-to-be-forgotten flow, consent_versions table, webhook handler, retention purge cron, observability dashboard.
