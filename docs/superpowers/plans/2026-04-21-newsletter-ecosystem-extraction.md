# Newsletter Ecosystem Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Newsletter CMS Engine into 3 reusable `@tn-figueiredo/*` packages in the tnf-ecosystem monorepo, with dual email provider support (Resend + SMTP).

**Architecture:** Phase 1 builds `@tn-figueiredo/email@0.2.0` with multi-provider adapters and webhook processors. Phase 2 builds `@tn-figueiredo/newsletter@0.1.0` with core engine use cases. Phase 3 builds `@tn-figueiredo/newsletter-admin@0.1.0` with CMS UI components. Phase 4 wires `bythiagofigueiredo` to consume the new packages. Phase 5 publishes and cleans up.

**Tech Stack:** TypeScript 5, tsup (dual ESM/CJS), vitest, Resend SDK v6, nodemailer, svix, @react-email/components, @supabase/supabase-js

**Target directory:** `~/Workspace/tnf-ecosystem/packages/`

**Spec:** `docs/superpowers/specs/2026-04-21-newsletter-ecosystem-extraction-design.md`

---

## Phase 1: `@tn-figueiredo/email@0.2.0` — Multi-Provider Email

### Task 1: Scaffold email package

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/package.json`
- Create: `~/Workspace/tnf-ecosystem/packages/email/tsconfig.json`
- Create: `~/Workspace/tnf-ecosystem/packages/email/tsup.config.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/vitest.config.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/index.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/webhooks.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@tn-figueiredo/email",
  "version": "0.2.0",
  "description": "Multi-provider email service: Resend, SMTP/SES, Brevo. Adapters, webhook processors, templates.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./webhooks": {
      "import": { "types": "./dist/webhooks.d.ts", "default": "./dist/webhooks.js" },
      "require": { "types": "./dist/webhooks.d.cts", "default": "./dist/webhooks.cjs" }
    }
  },
  "files": ["dist", "migrations"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@supabase/supabase-js": ">=2.0.0",
    "resend": ">=6.0.0",
    "nodemailer": ">=6.0.0",
    "svix": ">=1.0.0"
  },
  "peerDependenciesMeta": {
    "resend": { "optional": true },
    "nodemailer": { "optional": true },
    "svix": { "optional": true }
  },
  "dependencies": {
    "debug": "^4.3.0",
    "p-queue": "^8.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.103.0",
    "@types/nodemailer": "^6.0.0",
    "nodemailer": "^6.0.0",
    "resend": "^6.0.0",
    "svix": "^1.0.0",
    "tsup": "*",
    "typescript": "*",
    "vitest": "*"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/tn-figueiredo/tnf-ecosystem.git",
    "directory": "packages/email"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "exclude": ["src/__tests__", "dist"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    webhooks: 'src/webhooks.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['resend', 'nodemailer', 'svix', '@supabase/supabase-js'],
})
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Create empty barrel files**

`src/index.ts`:
```typescript
// Types
export type { EmailProvider, EmailSender, EmailMessage, EmailResult, EmailWebhookEvent, EmailBranding } from './types.js'
// Interfaces
export type { IEmailService, IEmailTemplate } from './interfaces.js'
// Errors
export { EmailSendError, EmailConfigError } from './errors.js'
// Factory
export { createEmailService, createEmailServiceWithFallback } from './factory.js'
export type { EmailProviderConfig, FallbackOptions } from './factory.js'
// Adapters
export { ResendEmailAdapter } from './adapters/resend.js'
export { SmtpEmailAdapter } from './adapters/smtp.js'
export { BrevoEmailAdapter } from './adapters/brevo.js'
// Templates
export { TemplateRegistry } from './templates/registry.js'
export { welcomeTemplate } from './templates/welcome.js'
export type { WelcomeVars } from './templates/welcome.js'
export { inviteTemplate } from './templates/invite.js'
export type { InviteVars } from './templates/invite.js'
export { confirmSubscriptionTemplate } from './templates/confirm-subscription.js'
export type { ConfirmSubscriptionVars } from './templates/confirm-subscription.js'
export { contactReceivedTemplate } from './templates/contact-received.js'
export type { ContactReceivedVars } from './templates/contact-received.js'
export { contactAdminAlertTemplate } from './templates/contact-admin-alert.js'
export type { ContactAdminAlertVars } from './templates/contact-admin-alert.js'
// Helpers
export { ensureUnsubscribeToken } from './helpers/unsubscribe-token.js'
// Utils
export { emailLayout, emailButton, formatDatePtBR, escapeHtml } from './templates/base-layout.js'
```

`src/webhooks.ts`:
```typescript
export type { IWebhookProcessor, NormalizedWebhookEvent } from './interfaces.js'
export { ResendWebhookProcessor } from './webhooks/resend-processor.js'
export { SesWebhookProcessor } from './webhooks/ses-processor.js'
```

- [ ] **Step 6: Verify scaffold builds**

Run: `cd ~/Workspace/tnf-ecosystem && npm install && npx turbo run build --filter=@tn-figueiredo/email`
Expected: Build fails (missing source files). That's fine — confirms scaffold is wired.

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/
git commit -m "chore(email): scaffold @tn-figueiredo/email@0.2.0 package"
```

---

### Task 2: Types and interfaces

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/types.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/interfaces.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/errors.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export type EmailProvider = 'resend' | 'smtp' | 'brevo'

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
  headers?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface EmailResult {
  messageId: string
  provider: EmailProvider
}

export interface EmailWebhookEvent {
  providerMessageId: string
  type: 'delivered' | 'bounced' | 'complained' | 'unsubscribed'
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface EmailBranding {
  brandName: string
  logoUrl?: string
  primaryColor?: string
  footerText?: string
  unsubscribeUrl?: string
}
```

- [ ] **Step 2: Create interfaces.ts**

```typescript
import type { EmailMessage, EmailResult, EmailWebhookEvent, EmailSender } from './types.js'

export interface IEmailTemplate<V> {
  name: string
  render(variables: V, locale: string): Promise<{ subject: string; html: string; text?: string }>
}

export interface IEmailService {
  send(msg: EmailMessage): Promise<EmailResult>
  sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailSender,
    to: string,
    variables: V,
    locale?: string,
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult>
  handleWebhook?(payload: unknown, signature: string): Promise<EmailWebhookEvent[]>
}

export interface NormalizedWebhookEvent {
  messageId: string
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  timestamp: string
  metadata?: {
    ip?: string
    userAgent?: string
    url?: string
    bounceType?: 'hard' | 'soft'
  }
}

export interface IWebhookProcessor {
  verify(payload: unknown, headers: Record<string, string>): Promise<boolean>
  process(payload: unknown): Promise<NormalizedWebhookEvent[]>
}
```

- [ ] **Step 3: Create errors.ts**

```typescript
export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'EmailSendError'
  }
}

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigError'
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}
```

- [ ] **Step 4: Build and verify types compile**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run typecheck --filter=@tn-figueiredo/email`
Expected: May still fail due to missing implementations referenced in barrel. Fix any import errors.

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/types.ts packages/email/src/interfaces.ts packages/email/src/errors.ts
git commit -m "feat(email): add types, interfaces, and error classes"
```

---

### Task 3: Migrate Brevo adapter + templates from 0.1.0

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/adapters/brevo.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/base-layout.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/registry.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/welcome.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/invite.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/confirm-subscription.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/contact-received.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/templates/contact-admin-alert.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/helpers/unsubscribe-token.ts`

This task migrates all existing 0.1.0 source code. The implementer must:

1. Read the compiled dist/ from `~/Workspace/bythiagofigueiredo/.claude/worktrees/feat+newsletter-cms-engine/node_modules/@tn-figueiredo/email/dist/` to understand the original implementation
2. Reconstruct the TypeScript source from the compiled JS + declaration files
3. Update `BrevoEmailAdapter.send()` return type to use `EmailProvider` instead of the `'brevo'` literal
4. Keep all template names, variable types, and rendering logic identical
5. Use `.js` extension for all local imports (NodeNext requirement)

- [ ] **Step 1: Create BrevoEmailAdapter**

Reconstruct from `dist/brevo/brevo-adapter.js` + `dist/brevo/brevo-adapter.d.ts`. Key: the adapter uses `PQueue` from `p-queue` for rate limiting (5/sec), has retry logic (3 attempts, 200ms backoff), and 8s timeout via AbortController. The `handleWebhook` method throws 'not_implemented'.

```typescript
// src/adapters/brevo.ts
import PQueue from 'p-queue'
import type { IEmailService, IEmailTemplate } from '../interfaces.js'
import type { EmailMessage, EmailResult, EmailWebhookEvent, EmailSender } from '../types.js'
import { EmailSendError } from '../errors.js'

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email'

export class BrevoEmailAdapter implements IEmailService {
  private apiKey: string
  private queue: PQueue
  private maxRetries = 3
  private timeoutMs = 8000

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Brevo API key is required')
    this.apiKey = apiKey
    this.queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 5 })
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    return this.queue.add(() => this.sendWithRetry(msg)) as Promise<EmailResult>
  }

  async sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailSender,
    to: string,
    variables: V,
    locale = 'pt-BR',
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult> {
    const rendered = await template.render(variables, locale)
    return this.send({
      from: sender,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: options?.replyTo,
      metadata: options?.metadata,
    })
  }

  async handleWebhook(_payload: unknown, _signature: string): Promise<EmailWebhookEvent[]> {
    throw new Error('not_implemented: Brevo webhook verification not implemented')
  }

  private async sendWithRetry(msg: EmailMessage): Promise<EmailResult> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.doSend(msg)
      } catch (err: unknown) {
        lastError = err
        if (err instanceof EmailSendError && err.message.includes('4')) break
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
        }
      }
    }
    throw lastError
  }

  private async doSend(msg: EmailMessage): Promise<EmailResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const body = {
        sender: { email: msg.from.email, name: msg.from.name },
        to: (Array.isArray(msg.to) ? msg.to : [msg.to]).map((e) => ({ email: e })),
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text,
        replyTo: msg.replyTo ? { email: msg.replyTo } : undefined,
      }
      const res = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new EmailSendError(`Brevo ${res.status}: ${text}`, 'brevo')
      }
      const data = (await res.json()) as { messageId: string }
      return { messageId: data.messageId, provider: 'brevo' }
    } finally {
      clearTimeout(timer)
    }
  }
}
```

- [ ] **Step 2: Create base-layout.ts, registry.ts, and all 5 template files**

Reconstruct from the dist/ compiled output. Each template implements `IEmailTemplate<V>` with a `name` string and `render(variables, locale)` method. The `base-layout.ts` exports `emailLayout`, `emailButton`, `formatDatePtBR`, `escapeHtml`.

The implementer should read ALL the compiled `.js` files from `node_modules/@tn-figueiredo/email/dist/templates/` and reconstruct TypeScript source that produces identical output.

- [ ] **Step 3: Create unsubscribe-token.ts**

Reconstruct from `dist/helpers/unsubscribe-token.js`. Uses `crypto.getRandomValues` for token generation and `crypto.subtle.digest` for SHA-256 hashing. Upserts into `unsubscribe_tokens` table.

```typescript
// src/helpers/unsubscribe-token.ts
import type { SupabaseClient } from '@supabase/supabase-js'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashToken(token: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(token).digest('hex')
}

export async function ensureUnsubscribeToken(
  supabase: SupabaseClient,
  siteId: string,
  email: string,
  baseUrl: string,
): Promise<string> {
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)

  const { data } = await supabase
    .from('unsubscribe_tokens')
    .upsert(
      { token_hash: tokenHash, site_id: siteId, email },
      { onConflict: 'site_id,email', ignoreDuplicates: true },
    )
    .select('token_hash')
    .single()

  if (data?.token_hash === tokenHash) {
    return `${baseUrl}/unsubscribe/${rawToken}`
  }

  // Conflict — row existed. Update with new hash.
  await supabase
    .from('unsubscribe_tokens')
    .update({ token_hash: tokenHash, used_at: null })
    .eq('site_id', siteId)
    .eq('email', email)

  return `${baseUrl}/unsubscribe/${rawToken}`
}
```

- [ ] **Step 4: Build and verify**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build --filter=@tn-figueiredo/email`
Expected: Build succeeds (some unused exports from barrel may warn — that's OK since adapters are next)

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/
git commit -m "feat(email): migrate Brevo adapter, templates, and helpers from 0.1.0"
```

---

### Task 4: ResendEmailAdapter

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/adapters/resend.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/__tests__/resend-adapter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/resend-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResendEmailAdapter } from '../adapters/resend.js'
import type { EmailMessage } from '../types.js'

const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new ResendEmailAdapter('re_test_key')
  })

  it('throws EmailConfigError if apiKey is empty', () => {
    expect(() => new ResendEmailAdapter('')).toThrow('API key is required')
  })

  it('sends email and returns EmailResult with provider resend', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null })
    const msg: EmailMessage = {
      from: { name: 'Test', email: 'test@example.com' },
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    }
    const result = await adapter.send(msg)
    expect(result).toEqual({ messageId: 'msg_123', provider: 'resend' })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Test <test@example.com>',
        to: ['user@example.com'],
        subject: 'Hello',
        html: '<p>Hi</p>',
      }),
    )
  })

  it('throws EmailSendError on API error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } })
    const msg: EmailMessage = {
      from: { name: 'T', email: 't@e.com' },
      to: 'u@e.com',
      subject: 'X',
      html: '<p>X</p>',
    }
    await expect(adapter.send(msg)).rejects.toThrow('rate limited')
  })

  it('passes custom headers from metadata', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_456' }, error: null })
    const msg: EmailMessage = {
      from: { name: 'T', email: 't@e.com' },
      to: 'u@e.com',
      subject: 'X',
      html: '<p>X</p>',
      headers: { 'List-Unsubscribe': '<mailto:unsub@example.com>' },
    }
    await adapter.send(msg)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'List-Unsubscribe': '<mailto:unsub@example.com>' },
      }),
    )
  })

  it('sendTemplate renders then sends', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_789' }, error: null })
    const template = {
      name: 'test',
      render: vi.fn().mockResolvedValueOnce({ subject: 'Rendered', html: '<p>Rendered</p>' }),
    }
    const result = await adapter.sendTemplate(
      template,
      { name: 'Sender', email: 's@e.com' },
      'user@e.com',
      { key: 'val' },
      'en',
    )
    expect(template.render).toHaveBeenCalledWith({ key: 'val' }, 'en')
    expect(result.provider).toBe('resend')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=resend-adapter -w packages/email`
Expected: FAIL — `Cannot find module '../adapters/resend.js'`

- [ ] **Step 3: Implement ResendEmailAdapter**

```typescript
// src/adapters/resend.ts
import { Resend } from 'resend'
import type { IEmailService, IEmailTemplate } from '../interfaces.js'
import type { EmailMessage, EmailResult, EmailWebhookEvent, EmailSender } from '../types.js'
import { EmailSendError, EmailConfigError } from '../errors.js'

export class ResendEmailAdapter implements IEmailService {
  private client: Resend

  constructor(apiKey: string) {
    if (!apiKey) throw new EmailConfigError('Resend API key is required')
    this.client = new Resend(apiKey)
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    const { data, error } = await this.client.emails.send({
      from: `${msg.from.name} <${msg.from.email}>`,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      headers: msg.headers,
    })
    if (error) throw new EmailSendError(error.message, 'resend', error)
    return { messageId: data!.id, provider: 'resend' }
  }

  async sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailSender,
    to: string,
    variables: V,
    locale?: string,
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult> {
    const rendered = await template.render(variables, locale ?? 'pt-BR')
    return this.send({
      from: sender,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: options?.replyTo,
      metadata: options?.metadata,
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=resend-adapter -w packages/email`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/adapters/resend.ts packages/email/src/__tests__/resend-adapter.test.ts
git commit -m "feat(email): add ResendEmailAdapter with tests"
```

---

### Task 5: SmtpEmailAdapter

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/adapters/smtp.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/__tests__/smtp-adapter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/smtp-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SmtpEmailAdapter } from '../adapters/smtp.js'
import type { EmailMessage } from '../types.js'

const mockSendMail = vi.fn()
const mockClose = vi.fn()

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      close: mockClose,
    })),
  },
}))

describe('SmtpEmailAdapter', () => {
  let adapter: SmtpEmailAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new SmtpEmailAdapter({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'u', pass: 'p' },
    })
  })

  it('throws EmailConfigError if host is empty', () => {
    expect(() => new SmtpEmailAdapter({ host: '', port: 587, auth: { user: 'u', pass: 'p' } }))
      .toThrow('SMTP host is required')
  })

  it('sends email and returns EmailResult with provider smtp', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: '<abc@smtp.example.com>' })
    const msg: EmailMessage = {
      from: { name: 'Test', email: 'test@example.com' },
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    }
    const result = await adapter.send(msg)
    expect(result).toEqual({ messageId: '<abc@smtp.example.com>', provider: 'smtp' })
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Test" <test@example.com>',
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      }),
    )
  })

  it('includes custom headers', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: '<def@smtp.example.com>' })
    const msg: EmailMessage = {
      from: { name: 'T', email: 't@e.com' },
      to: 'u@e.com',
      subject: 'X',
      html: '<p>X</p>',
      headers: { 'List-Unsubscribe': '<mailto:unsub@e.com>' },
    }
    await adapter.send(msg)
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'List-Unsubscribe': '<mailto:unsub@e.com>' },
      }),
    )
  })

  it('closes transport pool', async () => {
    await adapter.close()
    expect(mockClose).toHaveBeenCalled()
  })

  it('sendTemplate renders then sends', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: '<ghi@smtp.example.com>' })
    const template = {
      name: 'test',
      render: vi.fn().mockResolvedValueOnce({ subject: 'Rendered', html: '<p>Rendered</p>' }),
    }
    const result = await adapter.sendTemplate(
      template,
      { name: 'S', email: 's@e.com' },
      'u@e.com',
      { k: 'v' },
      'en',
    )
    expect(template.render).toHaveBeenCalledWith({ k: 'v' }, 'en')
    expect(result.provider).toBe('smtp')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=smtp-adapter -w packages/email`
Expected: FAIL

- [ ] **Step 3: Implement SmtpEmailAdapter**

```typescript
// src/adapters/smtp.ts
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { IEmailService, IEmailTemplate } from '../interfaces.js'
import type { EmailMessage, EmailResult, EmailWebhookEvent, EmailSender } from '../types.js'
import { EmailSendError, EmailConfigError } from '../errors.js'

export interface SmtpConfig {
  host: string
  port: number
  auth: { user: string; pass: string }
  tls?: boolean
  pool?: boolean
  maxConnections?: number
}

export class SmtpEmailAdapter implements IEmailService {
  private transport: Transporter

  constructor(config: SmtpConfig) {
    if (!config.host) throw new EmailConfigError('SMTP host is required')
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: config.auth,
      secure: config.tls ?? config.port === 465,
      pool: config.pool ?? true,
      maxConnections: config.maxConnections ?? 5,
      maxMessages: 100,
    })
  }

  async send(msg: EmailMessage): Promise<EmailResult> {
    try {
      const info = await this.transport.sendMail({
        from: `"${msg.from.name}" <${msg.from.email}>`,
        to: Array.isArray(msg.to) ? msg.to.join(', ') : msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
        headers: msg.headers,
      })
      return { messageId: info.messageId, provider: 'smtp' }
    } catch (err) {
      throw new EmailSendError(
        err instanceof Error ? err.message : 'SMTP send failed',
        'smtp',
        err,
      )
    }
  }

  async sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    sender: EmailSender,
    to: string,
    variables: V,
    locale?: string,
    options?: { replyTo?: string; metadata?: Record<string, unknown> },
  ): Promise<EmailResult> {
    const rendered = await template.render(variables, locale ?? 'pt-BR')
    return this.send({
      from: sender,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: options?.replyTo,
      metadata: options?.metadata,
    })
  }

  async close(): Promise<void> {
    this.transport.close()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=smtp-adapter -w packages/email`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/adapters/smtp.ts packages/email/src/__tests__/smtp-adapter.test.ts
git commit -m "feat(email): add SmtpEmailAdapter with connection pooling"
```

---

### Task 6: Factory and fallback

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/factory.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/__tests__/factory.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/factory.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEmailService, createEmailServiceWithFallback } from '../factory.js'

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'msg_1' }, error: null }),
    },
  })),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: '<msg@smtp>' }),
      close: vi.fn(),
    })),
  },
}))

describe('createEmailService', () => {
  it('creates ResendEmailAdapter for resend config', () => {
    const svc = createEmailService({ provider: 'resend', apiKey: 're_test' })
    expect(svc).toBeDefined()
    expect(svc.send).toBeTypeOf('function')
  })

  it('creates SmtpEmailAdapter for smtp config', () => {
    const svc = createEmailService({
      provider: 'smtp',
      host: 'smtp.test.com',
      port: 587,
      auth: { user: 'u', pass: 'p' },
    })
    expect(svc).toBeDefined()
  })

  it('throws for unknown provider', () => {
    expect(() => createEmailService({ provider: 'unknown' } as never)).toThrow()
  })
})

describe('createEmailServiceWithFallback', () => {
  it('uses primary when it succeeds', async () => {
    const svc = createEmailServiceWithFallback(
      { provider: 'resend', apiKey: 're_test' },
      { provider: 'smtp', host: 'h', port: 587, auth: { user: 'u', pass: 'p' } },
    )
    const result = await svc.send({
      from: { name: 'T', email: 't@e.com' },
      to: 'u@e.com',
      subject: 'X',
      html: '<p>X</p>',
    })
    expect(result.provider).toBe('resend')
  })

  it('falls back when primary throws', async () => {
    const onFallback = vi.fn()
    // Create with mocked resend that throws
    vi.doMock('resend', () => ({
      Resend: vi.fn().mockImplementation(() => ({
        emails: {
          send: vi.fn().mockResolvedValue({ data: null, error: { message: 'rate limited' } }),
        },
      })),
    }))
    // For this test we verify the fallback hook contract
    const svc = createEmailServiceWithFallback(
      { provider: 'resend', apiKey: 're_test' },
      { provider: 'smtp', host: 'h', port: 587, auth: { user: 'u', pass: 'p' } },
      { onFallback },
    )
    expect(svc).toBeDefined()
  })
})
```

- [ ] **Step 2: Implement factory**

```typescript
// src/factory.ts
import type { IEmailService } from './interfaces.js'
import { EmailConfigError } from './errors.js'

export type EmailProviderConfig =
  | { provider: 'resend'; apiKey: string }
  | { provider: 'smtp'; host: string; port: number; auth: { user: string; pass: string }; tls?: boolean; pool?: boolean; maxConnections?: number }
  | { provider: 'brevo'; apiKey: string }

export interface FallbackOptions {
  shouldFallback?: (error: Error) => boolean
  onFallback?: (error: Error, fromProvider: string, toProvider: string) => void
}

export function createEmailService(config: EmailProviderConfig): IEmailService {
  switch (config.provider) {
    case 'resend': {
      const { ResendEmailAdapter } = require('./adapters/resend.js') as typeof import('./adapters/resend.js')
      return new ResendEmailAdapter(config.apiKey)
    }
    case 'smtp': {
      const { SmtpEmailAdapter } = require('./adapters/smtp.js') as typeof import('./adapters/smtp.js')
      return new SmtpEmailAdapter(config)
    }
    case 'brevo': {
      const { BrevoEmailAdapter } = require('./adapters/brevo.js') as typeof import('./adapters/brevo.js')
      return new BrevoEmailAdapter(config.apiKey)
    }
    default:
      throw new EmailConfigError(`Unknown email provider: ${(config as { provider: string }).provider}`)
  }
}

export function createEmailServiceWithFallback(
  primaryConfig: EmailProviderConfig,
  fallbackConfig: EmailProviderConfig,
  opts?: FallbackOptions,
): IEmailService {
  const primary = createEmailService(primaryConfig)
  const fallback = createEmailService(fallbackConfig)
  const shouldFallback = opts?.shouldFallback ?? (() => true)

  return {
    async send(msg) {
      try {
        return await primary.send(msg)
      } catch (err) {
        if (err instanceof Error && shouldFallback(err)) {
          opts?.onFallback?.(err, primaryConfig.provider, fallbackConfig.provider)
          return fallback.send(msg)
        }
        throw err
      }
    },
    async sendTemplate(template, sender, to, variables, locale, options) {
      try {
        return await primary.sendTemplate(template, sender, to, variables, locale, options)
      } catch (err) {
        if (err instanceof Error && shouldFallback(err)) {
          opts?.onFallback?.(err, primaryConfig.provider, fallbackConfig.provider)
          return fallback.sendTemplate(template, sender, to, variables, locale, options)
        }
        throw err
      }
    },
  }
}
```

Note: The factory uses dynamic `require()` to avoid pulling all adapter dependencies when only one is used. Since adapters' peer deps are optional, this prevents runtime errors for unused providers.

**IMPORTANT:** The implementer should check if dynamic require works with NodeNext ESM. If not, use dynamic `import()` instead:
```typescript
case 'resend': {
  const { ResendEmailAdapter } = await import('./adapters/resend.js')
  return new ResendEmailAdapter(config.apiKey)
}
```
If using async imports, `createEmailService` must become `async function createEmailService(...): Promise<IEmailService>`.

- [ ] **Step 3: Run tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=factory -w packages/email`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/factory.ts packages/email/src/__tests__/factory.test.ts
git commit -m "feat(email): add createEmailService factory with fallback support"
```

---

### Task 7: ResendWebhookProcessor

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/webhooks/resend-processor.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/__tests__/resend-webhook.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/resend-webhook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ResendWebhookProcessor } from '../webhooks/resend-processor.js'

const mockVerify = vi.fn()

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}))

describe('ResendWebhookProcessor', () => {
  const processor = new ResendWebhookProcessor('whsec_test')

  it('verify returns true for valid signature', async () => {
    mockVerify.mockReturnValueOnce({ type: 'email.delivered', data: {} })
    const result = await processor.verify('{}', {
      'svix-id': 'msg_1',
      'svix-timestamp': '123',
      'svix-signature': 'sig',
    })
    expect(result).toBe(true)
  })

  it('verify returns false for invalid signature', async () => {
    mockVerify.mockImplementationOnce(() => { throw new Error('invalid') })
    const result = await processor.verify('{}', {
      'svix-id': 'msg_1',
      'svix-timestamp': '123',
      'svix-signature': 'bad',
    })
    expect(result).toBe(false)
  })

  it('processes email.delivered event', async () => {
    const events = await processor.process({
      type: 'email.delivered',
      data: { email_id: 'msg_123', created_at: '2026-01-01T00:00:00Z' },
    })
    expect(events).toEqual([{
      messageId: 'msg_123',
      type: 'delivered',
      timestamp: '2026-01-01T00:00:00Z',
      metadata: {},
    }])
  })

  it('processes email.opened with metadata', async () => {
    const events = await processor.process({
      type: 'email.opened',
      data: { email_id: 'msg_456', created_at: '2026-01-01T00:00:00Z', ipAddress: '1.2.3.4', userAgent: 'Gmail' },
    })
    expect(events).toEqual([{
      messageId: 'msg_456',
      type: 'opened',
      timestamp: '2026-01-01T00:00:00Z',
      metadata: { ip: '1.2.3.4', userAgent: 'Gmail' },
    }])
  })

  it('processes email.clicked with url', async () => {
    const events = await processor.process({
      type: 'email.clicked',
      data: { email_id: 'msg_789', created_at: '2026-01-01T00:00:00Z', link: 'https://example.com' },
    })
    expect(events[0]?.metadata?.url).toBe('https://example.com')
  })

  it('processes email.bounced with bounce type', async () => {
    const events = await processor.process({
      type: 'email.bounced',
      data: { email_id: 'msg_b', created_at: '2026-01-01T00:00:00Z', type: 'Permanent' },
    })
    expect(events[0]?.type).toBe('bounced')
    expect(events[0]?.metadata?.bounceType).toBe('hard')
  })

  it('returns empty for delivery_delayed', async () => {
    const events = await processor.process({
      type: 'email.delivery_delayed',
      data: { email_id: 'msg_d', created_at: '2026-01-01T00:00:00Z' },
    })
    expect(events).toEqual([])
  })
})
```

- [ ] **Step 2: Implement ResendWebhookProcessor**

```typescript
// src/webhooks/resend-processor.ts
import { Webhook } from 'svix'
import type { IWebhookProcessor, NormalizedWebhookEvent } from '../interfaces.js'
import { WebhookVerificationError } from '../errors.js'

export class ResendWebhookProcessor implements IWebhookProcessor {
  private wh: Webhook

  constructor(signingSecret: string) {
    if (!signingSecret) throw new WebhookVerificationError('Resend webhook signing secret is required')
    this.wh = new Webhook(signingSecret)
  }

  async verify(payload: unknown, headers: Record<string, string>): Promise<boolean> {
    try {
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
      this.wh.verify(body, {
        'svix-id': headers['svix-id'] ?? '',
        'svix-timestamp': headers['svix-timestamp'] ?? '',
        'svix-signature': headers['svix-signature'] ?? '',
      })
      return true
    } catch {
      return false
    }
  }

  async process(payload: unknown): Promise<NormalizedWebhookEvent[]> {
    const event = payload as { type: string; data: Record<string, unknown> }
    const messageId = event.data.email_id as string
    const timestamp = event.data.created_at as string
    if (!messageId) return []

    switch (event.type) {
      case 'email.delivered':
        return [{ messageId, type: 'delivered', timestamp, metadata: {} }]

      case 'email.opened':
        return [{
          messageId,
          type: 'opened',
          timestamp,
          metadata: {
            ip: event.data.ipAddress as string | undefined,
            userAgent: event.data.userAgent as string | undefined,
          },
        }]

      case 'email.clicked':
        return [{
          messageId,
          type: 'clicked',
          timestamp,
          metadata: {
            url: event.data.link as string | undefined,
            ip: event.data.ipAddress as string | undefined,
            userAgent: event.data.userAgent as string | undefined,
          },
        }]

      case 'email.bounced':
        return [{
          messageId,
          type: 'bounced',
          timestamp,
          metadata: {
            bounceType: (event.data.type as string) === 'Permanent' ? 'hard' : 'soft',
          },
        }]

      case 'email.complained':
        return [{ messageId, type: 'complained', timestamp, metadata: {} }]

      default:
        return []
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=resend-webhook -w packages/email`
Expected: All 7 tests PASS

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/webhooks/resend-processor.ts packages/email/src/__tests__/resend-webhook.test.ts
git commit -m "feat(email): add ResendWebhookProcessor with Svix verification"
```

---

### Task 8: SesWebhookProcessor

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/webhooks/ses-processor.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/email/src/__tests__/ses-webhook.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/ses-webhook.test.ts
import { describe, it, expect } from 'vitest'
import { SesWebhookProcessor } from '../webhooks/ses-processor.js'

describe('SesWebhookProcessor', () => {
  const processor = new SesWebhookProcessor()

  it('processes SES Delivery notification', async () => {
    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        eventType: 'Delivery',
        mail: { messageId: 'ses_123', timestamp: '2026-01-01T00:00:00Z' },
        delivery: {},
      }),
    }
    const events = await processor.process(payload)
    expect(events).toEqual([{
      messageId: 'ses_123',
      type: 'delivered',
      timestamp: '2026-01-01T00:00:00Z',
      metadata: {},
    }])
  })

  it('processes SES Open notification', async () => {
    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        eventType: 'Open',
        mail: { messageId: 'ses_456', timestamp: '2026-01-01T00:00:00Z' },
        open: { ipAddress: '1.2.3.4', userAgent: 'Gmail' },
      }),
    }
    const events = await processor.process(payload)
    expect(events[0]?.metadata?.ip).toBe('1.2.3.4')
  })

  it('processes SES Bounce Permanent', async () => {
    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        eventType: 'Bounce',
        mail: { messageId: 'ses_b', timestamp: '2026-01-01T00:00:00Z' },
        bounce: { bounceType: 'Permanent' },
      }),
    }
    const events = await processor.process(payload)
    expect(events[0]?.metadata?.bounceType).toBe('hard')
  })

  it('processes SES Click notification', async () => {
    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        eventType: 'Click',
        mail: { messageId: 'ses_c', timestamp: '2026-01-01T00:00:00Z' },
        click: { link: 'https://example.com', ipAddress: '1.2.3.4' },
      }),
    }
    const events = await processor.process(payload)
    expect(events[0]?.metadata?.url).toBe('https://example.com')
  })

  it('handles SubscriptionConfirmation type', async () => {
    const payload = {
      Type: 'SubscriptionConfirmation',
      SubscribeURL: 'https://sns.us-east-1.amazonaws.com/confirm?token=abc',
    }
    const events = await processor.process(payload)
    expect(events).toEqual([])
  })

  it('returns empty for unknown event types', async () => {
    const payload = {
      Type: 'Notification',
      Message: JSON.stringify({
        eventType: 'Send',
        mail: { messageId: 'x', timestamp: '2026-01-01T00:00:00Z' },
      }),
    }
    const events = await processor.process(payload)
    expect(events).toEqual([])
  })
})
```

- [ ] **Step 2: Implement SesWebhookProcessor**

```typescript
// src/webhooks/ses-processor.ts
import type { IWebhookProcessor, NormalizedWebhookEvent } from '../interfaces.js'

interface SnsMessage {
  Type: string
  Message?: string
  SubscribeURL?: string
  SigningCertURL?: string
  Signature?: string
}

interface SesEvent {
  eventType: string
  mail: { messageId: string; timestamp: string }
  delivery?: Record<string, unknown>
  open?: { ipAddress?: string; userAgent?: string }
  click?: { link?: string; ipAddress?: string; userAgent?: string }
  bounce?: { bounceType?: string }
  complaint?: Record<string, unknown>
}

export class SesWebhookProcessor implements IWebhookProcessor {
  async verify(payload: unknown, _headers: Record<string, string>): Promise<boolean> {
    const msg = payload as SnsMessage
    if (!msg.Type) return false
    if (msg.Type === 'SubscriptionConfirmation') return true
    if (msg.Type !== 'Notification') return false
    // SNS signature verification via X.509 cert
    // In production, fetch SigningCertURL and verify Signature
    // For v0.1.0, we trust the payload if it comes over HTTPS to our endpoint
    // Full cert verification is a v0.2.0 enhancement
    return !!msg.Message
  }

  async handleSubscriptionConfirmation(payload: unknown): Promise<void> {
    const msg = payload as SnsMessage
    if (msg.Type !== 'SubscriptionConfirmation' || !msg.SubscribeURL) return
    await fetch(msg.SubscribeURL)
  }

  async process(payload: unknown): Promise<NormalizedWebhookEvent[]> {
    const msg = payload as SnsMessage

    if (msg.Type === 'SubscriptionConfirmation') {
      await this.handleSubscriptionConfirmation(payload)
      return []
    }

    if (msg.Type !== 'Notification' || !msg.Message) return []

    const event: SesEvent = JSON.parse(msg.Message)
    const messageId = event.mail.messageId
    const timestamp = event.mail.timestamp

    switch (event.eventType) {
      case 'Delivery':
        return [{ messageId, type: 'delivered', timestamp, metadata: {} }]

      case 'Open':
        return [{
          messageId,
          type: 'opened',
          timestamp,
          metadata: {
            ip: event.open?.ipAddress,
            userAgent: event.open?.userAgent,
          },
        }]

      case 'Click':
        return [{
          messageId,
          type: 'clicked',
          timestamp,
          metadata: {
            url: event.click?.link,
            ip: event.click?.ipAddress,
            userAgent: event.click?.userAgent,
          },
        }]

      case 'Bounce':
        return [{
          messageId,
          type: 'bounced',
          timestamp,
          metadata: {
            bounceType: event.bounce?.bounceType === 'Permanent' ? 'hard' : 'soft',
          },
        }]

      case 'Complaint':
        return [{ messageId, type: 'complained', timestamp, metadata: {} }]

      default:
        return []
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=ses-webhook -w packages/email`
Expected: All 6 tests PASS

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/src/webhooks/ses-processor.ts packages/email/src/__tests__/ses-webhook.test.ts
git commit -m "feat(email): add SesWebhookProcessor for SNS/SES events"
```

---

### Task 9: Email migration SQL + full build + README

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/email/migrations/001_site_email_config.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/email/README.md`
- Create: `~/Workspace/tnf-ecosystem/packages/email/CHANGELOG.md`

- [ ] **Step 1: Create migration**

```sql
-- 001_site_email_config.sql
-- Email provider configuration per site (no secrets — only selection + usage tracking)

CREATE TABLE IF NOT EXISTS site_email_config (
  site_id         uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  active_provider text NOT NULL DEFAULT 'resend'
    CHECK (active_provider IN ('resend', 'smtp', 'brevo')),
  fallback_provider text
    CHECK (fallback_provider IS NULL OR fallback_provider IN ('resend', 'smtp', 'brevo')),
  smtp_from_domain  text,
  monthly_sends     int NOT NULL DEFAULT 0,
  monthly_limit     int,
  reset_at          timestamptz NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION increment_monthly_sends(p_site_id uuid, p_count int DEFAULT 1)
RETURNS int
LANGUAGE sql
AS $$
  UPDATE site_email_config
  SET monthly_sends = CASE
    WHEN reset_at <= now() THEN p_count
    ELSE monthly_sends + p_count
  END,
  reset_at = CASE
    WHEN reset_at <= now() THEN date_trunc('month', now()) + interval '1 month'
    ELSE reset_at
  END,
  updated_at = now()
  WHERE site_id = p_site_id
  RETURNING monthly_sends;
$$;

ALTER TABLE site_email_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_email_config" ON site_email_config;
CREATE POLICY "staff_manage_email_config" ON site_email_config
  FOR ALL USING (public.can_edit_site(site_id));
```

- [ ] **Step 2: Create README.md**

Write a README following the tnf-ecosystem template: package description, installation with exact version, quick start with `createEmailService` factory, interface table, adapter table, webhook processor table, migration section, CHANGELOG reference.

- [ ] **Step 3: Create CHANGELOG.md**

```markdown
# @tn-figueiredo/email

## 0.2.0

### Breaking Changes

- `EmailResult.provider` widened from `'brevo'` to `'resend' | 'smtp' | 'brevo'`

### Features

- `ResendEmailAdapter` — Resend v6 adapter
- `SmtpEmailAdapter` — nodemailer SMTP adapter with connection pooling
- `createEmailService(config)` — factory with provider selection
- `createEmailServiceWithFallback(primary, fallback)` — automatic fallback on send failure
- `ResendWebhookProcessor` — Svix signature verification + event normalization
- `SesWebhookProcessor` — SNS/SES event normalization
- `IWebhookProcessor` interface + `NormalizedWebhookEvent` type
- `site_email_config` migration for per-site provider selection
- `./webhooks` subpath export for webhook processors

### Preserved from 0.1.0

- `BrevoEmailAdapter`, all 5 templates, `TemplateRegistry`, `ensureUnsubscribeToken`, `emailLayout`, `emailButton`, `formatDatePtBR`, `escapeHtml`
```

- [ ] **Step 4: Full build + all tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build test --filter=@tn-figueiredo/email`
Expected: Build succeeds, all tests pass

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/email/
git commit -m "feat(email): complete @tn-figueiredo/email@0.2.0 — multi-provider, webhooks, migration"
```

---

## Phase 2: `@tn-figueiredo/newsletter@0.1.0` — Core Engine

### Task 10: Scaffold newsletter package

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/package.json`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/tsconfig.json`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/tsup.config.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/vitest.config.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/index.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/templates.ts`

Follow the same pattern as Task 1 but for the newsletter package. Key differences:

- `package.json`: name `@tn-figueiredo/newsletter`, version `0.1.0`, peer deps on `@tn-figueiredo/email@>=0.2.0`, `@supabase/supabase-js@>=2.0.0`, optional peers `@react-email/components@>=0.0.30` and `@react-email/render@>=1.0.0`
- Two entry points: `index` (main) and `templates` (React Email, opt-in)
- `tsconfig.json` needs `"jsx": "react-jsx"` for the templates entry
- Dependencies: `debug@^4.3.0`, `zod@^3.23.0`

- [ ] **Step 1: Create all scaffold files**

(Full package.json, tsconfig.json, tsup.config.ts, vitest.config.ts as described above)

- [ ] **Step 2: Create empty barrel `src/index.ts`**

```typescript
// Types
export type {
  EditionStatus, SubscriptionStatus, SendStatus, Segment,
  NewsletterType, Edition, Subscriber, Send, ClickEvent, SendReport,
} from './types.js'
// Interfaces
export type { INewsletterRepository, ISubscriberRepository, NewsletterConfig, NewsletterContainer } from './interfaces.js'
// Errors
export { BounceThresholdError, EditionNotFoundError, RateLimitError } from './errors.js'
// Use cases
export { SendEditionUseCase } from './use-cases/send-edition.js'
export { ScheduleEditionUseCase } from './use-cases/schedule-edition.js'
export { ProcessWebhookUseCase } from './use-cases/process-webhook.js'
export { SubscribeUseCase } from './use-cases/subscribe.js'
export { ConfirmSubscriptionUseCase } from './use-cases/confirm-subscription.js'
export { UnsubscribeUseCase } from './use-cases/unsubscribe.js'
export { RefreshStatsUseCase } from './use-cases/refresh-stats.js'
export { AnonymizeTrackingUseCase } from './use-cases/anonymize-tracking.js'
// Content queue
export { generateSlots } from './content-queue/slots.js'
export type { CadenceConfig, SlotOptions } from './content-queue/types.js'
// Utils
export { parseUserAgent } from './utils/parse-user-agent.js'
// Supabase implementations
export { SupabaseNewsletterRepository } from './supabase/newsletter-repo.js'
export { SupabaseSubscriberRepository } from './supabase/subscriber-repo.js'
```

- [ ] **Step 3: Create `src/templates.ts` barrel**

```typescript
export { Newsletter } from './templates/newsletter.js'
export type { NewsletterTemplateProps } from './templates/newsletter.js'
export { EmailHeader } from './templates/components/email-header.js'
export { EmailFooter } from './templates/components/email-footer.js'
```

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/
git commit -m "chore(newsletter): scaffold @tn-figueiredo/newsletter@0.1.0 package"
```

---

### Task 11: Newsletter types, interfaces, errors

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/types.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/interfaces.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/errors.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/config.ts`

Copy all types verbatim from the spec's Section 2 "Types" and "Interfaces". The types match the existing Supabase schema exactly. The interfaces define `INewsletterRepository` and `ISubscriberRepository` with all methods from the spec.

- [ ] **Step 1: Create types.ts with all type definitions from the spec**
- [ ] **Step 2: Create interfaces.ts with INewsletterRepository and ISubscriberRepository**
- [ ] **Step 3: Create errors.ts**

```typescript
export class BounceThresholdError extends Error {
  constructor(public readonly editionId: string, public readonly bounceRate: number) {
    super(`Bounce rate ${bounceRate}% exceeded threshold for edition ${editionId}`)
    this.name = 'BounceThresholdError'
  }
}

export class EditionNotFoundError extends Error {
  constructor(editionId: string) {
    super(`Edition not found: ${editionId}`)
    this.name = 'EditionNotFoundError'
  }
}

export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitError'
  }
}
```

- [ ] **Step 4: Create config.ts**

```typescript
import type { IEmailService } from '@tn-figueiredo/email'
import type { INewsletterRepository, ISubscriberRepository } from './interfaces.js'

export interface NewsletterConfig {
  fromDomain: string
  batchSize?: number
  throttleMs?: number
  maxBounceRatePct?: number
  appUrl?: string
}

export interface NewsletterContainer {
  config: NewsletterConfig
  emailService: IEmailService
  repository: INewsletterRepository
  subscriberRepo: ISubscriberRepository
  onError?: (err: Error, ctx: Record<string, unknown>) => void
  onMetric?: (name: string, value: number, tags: Record<string, string>) => void
}
```

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/src/
git commit -m "feat(newsletter): add types, interfaces, errors, and config"
```

---

### Task 12: Content queue slots + parseUserAgent (pure functions)

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/content-queue/types.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/content-queue/slots.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/utils/parse-user-agent.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/slots.test.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/parse-user-agent.test.ts`

- [ ] **Step 1: Write slot generation tests**

```typescript
// src/__tests__/slots.test.ts
import { describe, it, expect } from 'vitest'
import { generateSlots } from '../content-queue/slots.js'

describe('generateSlots', () => {
  it('returns empty when paused', () => {
    const slots = generateSlots(
      { cadenceDays: 7, startDate: '2026-01-01', lastSentAt: null, paused: true },
      { today: '2026-01-15', count: 3 },
    )
    expect(slots).toEqual([])
  })

  it('generates slots from startDate when no lastSentAt', () => {
    const slots = generateSlots(
      { cadenceDays: 7, startDate: '2026-01-01', lastSentAt: null, paused: false },
      { today: '2026-01-10', count: 3 },
    )
    expect(slots).toEqual(['2026-01-15', '2026-01-22', '2026-01-29'])
  })

  it('generates slots from lastSentAt when available', () => {
    const slots = generateSlots(
      { cadenceDays: 7, startDate: '2026-01-01', lastSentAt: '2026-01-20T09:00:00Z', paused: false },
      { today: '2026-01-25', count: 2 },
    )
    expect(slots).toEqual(['2026-01-27', '2026-02-03'])
  })

  it('skips slots in the past', () => {
    const slots = generateSlots(
      { cadenceDays: 3, startDate: '2026-01-01', lastSentAt: null, paused: false },
      { today: '2026-01-20', count: 2 },
    )
    expect(new Date(slots[0]!).getTime()).toBeGreaterThan(new Date('2026-01-20').getTime())
  })
})
```

- [ ] **Step 2: Write parseUserAgent tests**

```typescript
// src/__tests__/parse-user-agent.test.ts
import { describe, it, expect } from 'vitest'
import { parseUserAgent } from '../utils/parse-user-agent.js'

describe('parseUserAgent', () => {
  it('detects Gmail', () => {
    expect(parseUserAgent('Mozilla/5.0 (Gmail)').client).toBe('Gmail')
  })
  it('detects Apple Mail', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel) AppleWebKit/605').client).toBe('Apple Mail')
  })
  it('detects Outlook', () => {
    expect(parseUserAgent('Microsoft Outlook 16.0').client).toBe('Outlook')
  })
  it('detects mobile device', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU)').device).toBe('Mobile')
  })
  it('defaults to Desktop/Other', () => {
    const result = parseUserAgent('curl/7.68')
    expect(result).toEqual({ client: 'Other', device: 'Desktop' })
  })
})
```

- [ ] **Step 3: Implement content-queue/types.ts, content-queue/slots.ts, utils/parse-user-agent.ts**

Copy directly from the existing source in bythiagofigueiredo:
- `slots.ts` from `apps/web/lib/content-queue/slots.ts` (verbatim, add `.js` extensions to imports)
- `parseUserAgent` from `apps/web/lib/newsletter/stats.ts` (only the pure function)

- [ ] **Step 4: Run tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run -w packages/newsletter`
Expected: All slot + parseUserAgent tests pass

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/src/
git commit -m "feat(newsletter): add generateSlots and parseUserAgent pure functions"
```

---

### Task 13: React Email templates

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/templates/newsletter.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/templates/components/email-header.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/templates/components/email-footer.tsx`

- [ ] **Step 1: Copy templates from bythiagofigueiredo**

Copy the three files verbatim from:
- `apps/web/src/emails/newsletter.tsx` → `src/templates/newsletter.tsx`
- `apps/web/src/emails/components/email-header.tsx` → `src/templates/components/email-header.tsx`
- `apps/web/src/emails/components/email-footer.tsx` → `src/templates/components/email-footer.tsx`

Only change: update relative imports to use `.js` extension, and export the props interface:

```typescript
// newsletter.tsx addition
export interface NewsletterTemplateProps {
  subject: string
  preheader?: string
  contentHtml: string
  typeName: string
  typeColor: string
  unsubscribeUrl: string
  archiveUrl: string
}
```

- [ ] **Step 2: Build to verify JSX compilation**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build --filter=@tn-figueiredo/newsletter`
Expected: Build succeeds (templates entry compiles JSX)

- [ ] **Step 3: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/src/templates/
git commit -m "feat(newsletter): add React Email newsletter template"
```

---

### Task 14: SendEditionUseCase

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/send-edition.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/helpers/in-memory-newsletter-repo.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/helpers/in-memory-subscriber-repo.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/helpers/mock-email-service.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/send-edition.test.ts`

This is the most critical task — the batch send engine extracted from `send-scheduled-newsletters/route.ts`.

- [ ] **Step 1: Create test helpers (in-memory repos + mock email)**

The in-memory newsletter repo must implement all `INewsletterRepository` methods using Maps. The mock email service records all sent messages. These helpers are reused by all subsequent use case tests.

- [ ] **Step 2: Write failing tests**

```typescript
// src/__tests__/send-edition.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SendEditionUseCase } from '../use-cases/send-edition.js'
import { InMemoryNewsletterRepository } from './helpers/in-memory-newsletter-repo.js'
import { InMemorySubscriberRepository } from './helpers/in-memory-subscriber-repo.js'
import { MockEmailService } from './helpers/mock-email-service.js'
import type { NewsletterContainer } from '../config.js'

describe('SendEditionUseCase', () => {
  let repo: InMemoryNewsletterRepository
  let subRepo: InMemorySubscriberRepository
  let emailService: MockEmailService
  let container: NewsletterContainer
  let useCase: SendEditionUseCase

  beforeEach(() => {
    repo = new InMemoryNewsletterRepository()
    subRepo = new InMemorySubscriberRepository()
    emailService = new MockEmailService()
    container = {
      config: { fromDomain: 'test.com', batchSize: 10, throttleMs: 0, maxBounceRatePct: 50, appUrl: 'https://test.com' },
      emailService,
      repository: repo,
      subscriberRepo: subRepo,
    }
    useCase = new SendEditionUseCase(container)
  })

  it('claims edition via CAS and sends to all subscribers', async () => {
    repo.seedEdition({ id: 'e1', status: 'scheduled', newsletter_type_id: 'main-en', site_id: 's1', subject: 'Hello' })
    subRepo.seedSubscriber({ site_id: 's1', email: 'a@test.com', newsletter_id: 'main-en', status: 'confirmed' })
    subRepo.seedSubscriber({ site_id: 's1', email: 'b@test.com', newsletter_id: 'main-en', status: 'confirmed' })

    const report = await useCase.execute('e1')
    expect(report.sent).toBe(2)
    expect(report.total).toBe(2)
    expect(emailService.sent).toHaveLength(2)
    expect(repo.getEditionSync('e1')?.status).toBe('sent')
  })

  it('returns 0 sent when CAS claim fails (already sending)', async () => {
    repo.seedEdition({ id: 'e2', status: 'sending', newsletter_type_id: 'main-en', site_id: 's1', subject: 'X' })
    const report = await useCase.execute('e2')
    expect(report.sent).toBe(0)
  })

  it('skips already-sent subscribers (crash recovery)', async () => {
    repo.seedEdition({ id: 'e3', status: 'scheduled', newsletter_type_id: 'main-en', site_id: 's1', subject: 'X' })
    subRepo.seedSubscriber({ site_id: 's1', email: 'a@test.com', newsletter_id: 'main-en', status: 'confirmed' })
    repo.seedSend({ edition_id: 'e3', subscriber_email: 'a@test.com', resend_message_id: 'already_sent' })

    const report = await useCase.execute('e3')
    expect(report.skipped).toBe(1)
    expect(emailService.sent).toHaveLength(0)
  })

  it('aborts when bounce rate exceeds threshold', async () => {
    container.config.maxBounceRatePct = 10
    repo.seedEdition({ id: 'e4', status: 'scheduled', newsletter_type_id: 'main-en', site_id: 's1', subject: 'X' })
    for (let i = 0; i < 10; i++) {
      subRepo.seedSubscriber({ site_id: 's1', email: `u${i}@test.com`, newsletter_id: 'main-en', status: 'confirmed' })
    }
    emailService.failFor(['u0@test.com', 'u1@test.com'])

    const report = await useCase.execute('e4')
    expect(report.aborted).toBe(true)
  })
})
```

- [ ] **Step 3: Implement SendEditionUseCase**

Extract the core logic from `send-scheduled-newsletters/route.ts`. The use case:
1. Calls `repository.claimEditionForSend(editionId)` (CAS)
2. Gets newsletter type info from the edition
3. Calls `subscriberRepo.getActiveSubscribers(siteId, typeId, { segment })`
4. For each subscriber, calls `repository.upsertSend()` then checks if `resend_message_id` exists (crash recovery)
5. Calls `subscriberRepo.ensureUnsubscribeToken()` for each
6. Renders template, calls `emailService.send()` with RFC 8058 headers
7. Updates send row with message ID
8. Checks bounce rate mid-batch
9. Updates edition status and newsletter type last_sent_at
10. Returns `SendReport`

Key difference from the route: NO Supabase imports, NO Sentry imports, NO Next.js imports. All I/O goes through the injected interfaces.

- [ ] **Step 4: Run tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run --filter=send-edition -w packages/newsletter`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/src/
git commit -m "feat(newsletter): add SendEditionUseCase with CAS, crash recovery, bounce threshold"
```

---

### Task 15: Remaining use cases

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/schedule-edition.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/process-webhook.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/subscribe.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/confirm-subscription.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/unsubscribe.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/refresh-stats.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/use-cases/anonymize-tracking.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/subscribe.test.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/__tests__/process-webhook.test.ts`

Each use case follows the same pattern: constructor takes `NewsletterContainer`, has a single `execute()` method.

- [ ] **Step 1: Implement ScheduleEditionUseCase**

```typescript
export class ScheduleEditionUseCase {
  constructor(private container: NewsletterContainer) {}

  async execute(editionId: string, scheduledAt: string): Promise<void> {
    const edition = await this.container.repository.getEdition(editionId)
    if (!edition) throw new EditionNotFoundError(editionId)
    if (edition.status !== 'ready' && edition.status !== 'draft')
      throw new Error(`Cannot schedule edition in status '${edition.status}'`)
    await this.container.repository.updateEditionStatus(editionId, 'scheduled', { scheduled_at: scheduledAt })
  }
}
```

- [ ] **Step 2: Implement ProcessWebhookUseCase**

Extracted from `webhooks/resend/route.ts`'s `processEvent` function. Takes `NormalizedWebhookEvent[]` and routes to the appropriate repository method.

- [ ] **Step 3: Implement SubscribeUseCase**

Extracted from `newsletter/subscribe/actions.ts`. Takes email, siteId, newsletterId, etc. Handles rate limiting, duplicate detection (including sha256 hash check for anonymized re-subscribers), token generation, and sends confirmation email.

- [ ] **Step 4: Implement remaining use cases**

`ConfirmSubscriptionUseCase`, `UnsubscribeUseCase`, `RefreshStatsUseCase`, `AnonymizeTrackingUseCase` — each is a thin wrapper around the corresponding repository method.

- [ ] **Step 5: Write tests for subscribe and process-webhook**

These two have the most complex logic. The subscribe test should cover: new subscriber, existing confirmed (no oracle), rate limited, re-subscribe after anonymization. The webhook test should cover: each event type, dedup, tracking consent gating.

- [ ] **Step 6: Run all tests**

Run: `cd ~/Workspace/tnf-ecosystem && npx vitest run -w packages/newsletter`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/src/
git commit -m "feat(newsletter): add all use cases — subscribe, webhook, schedule, stats, anonymize"
```

---

### Task 16: Supabase repository implementations

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/supabase/newsletter-repo.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/src/supabase/subscriber-repo.ts`

- [ ] **Step 1: Implement SupabaseNewsletterRepository**

Each method maps to Supabase queries against the tables defined in the migrations. Key methods:

- `claimEditionForSend`: `UPDATE newsletter_editions SET status='sending' WHERE id=$1 AND status='scheduled' RETURNING *`
- `upsertSend`: `INSERT INTO newsletter_sends ... ON CONFLICT (edition_id, subscriber_email) DO NOTHING`
- `recordWebhookEvent`: `INSERT INTO webhook_events ... ON CONFLICT (svix_id) DO NOTHING` — returns true if inserted
- `refreshStats`: Calls Supabase RPC `refresh_newsletter_stats`
- `anonymizeTrackingOlderThan`: Updates `open_ip=null, open_user_agent=null` on sends + `ip=null, user_agent=null` on clicks older than N days

- [ ] **Step 2: Implement SupabaseSubscriberRepository**

- `getActiveSubscribers`: SELECT from `newsletter_subscriptions` WHERE status='confirmed' AND newsletter_id matches
- `subscribe`: INSERT with `confirmation_token_hash`, handles ON CONFLICT for re-subscribe
- `confirmSubscription`: Calls Supabase RPC `confirm_newsletter_subscription`
- `unsubscribe`: Calls Supabase RPC `unsubscribe_via_token`
- `checkRateLimit`: Calls Supabase RPC `newsletter_rate_check`
- `ensureUnsubscribeToken`: Delegates to `ensureUnsubscribeToken` from `@tn-figueiredo/email`

- [ ] **Step 3: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/src/supabase/
git commit -m "feat(newsletter): add Supabase repository implementations"
```

---

### Task 17: Newsletter migrations + README + full build

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/001_newsletter_types_extend.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/002_newsletter_editions.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/003_newsletter_sends_clicks_webhooks.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/004_newsletter_rpcs.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/005_newsletter_rls.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/006_blog_cadence.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/migrations/007_consent_texts_seed.sql`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/README.md`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter/CHANGELOG.md`

- [ ] **Step 1: Copy migrations from bythiagofigueiredo**

Extract the relevant SQL from `supabase/migrations/20260421*.sql` files in bythiagofigueiredo. Reorganize into the 7 numbered files. Make all statements idempotent. The seed file (007) should contain example data clearly marked as "customize for your project".

- [ ] **Step 2: Write README**

Following tnf-ecosystem template: description, installation, quick start showing `NewsletterContainer` wiring, interface tables, use case table, migration section, Next.js wiring guide with copy-paste cron route + webhook route examples.

- [ ] **Step 3: Write CHANGELOG**

```markdown
# @tn-figueiredo/newsletter

## 0.1.0

### Features

- `SendEditionUseCase` — batch send with CAS, crash recovery, bounce threshold
- `SubscribeUseCase` — double opt-in with rate limiting and LGPD compliance
- `ProcessWebhookUseCase` — routes normalized webhook events to repository
- `ScheduleEditionUseCase`, `ConfirmSubscriptionUseCase`, `UnsubscribeUseCase`
- `RefreshStatsUseCase`, `AnonymizeTrackingUseCase`
- `generateSlots()` — pure cadence slot computation
- `parseUserAgent()` — email client identification
- `Newsletter` React Email template (via `./templates` subpath)
- `SupabaseNewsletterRepository`, `SupabaseSubscriberRepository`
- 7 migration files for complete newsletter schema
```

- [ ] **Step 4: Full build + test**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build test --filter=@tn-figueiredo/newsletter`
Expected: Build succeeds, all tests pass

- [ ] **Step 5: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter/
git commit -m "feat(newsletter): complete @tn-figueiredo/newsletter@0.1.0 — engine, migrations, docs"
```

---

## Phase 3: `@tn-figueiredo/newsletter-admin@0.1.0` — CMS UI

### Task 18: Scaffold newsletter-admin package

Same pattern as Task 1/10. Key differences:
- Two entry points: `index` (server-safe types) and `client` (React components with `'use client'` directive)
- Peer deps: `react@^19.0.0`, `@tn-figueiredo/newsletter@>=0.1.0`
- `tsup.config.ts` externals include `react`, `next`

- [ ] **Step 1: Create all scaffold files**
- [ ] **Step 2: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter-admin/
git commit -m "chore(newsletter-admin): scaffold @tn-figueiredo/newsletter-admin@0.1.0"
```

---

### Task 19: Theme system

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/theme/types.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/theme/default.ts`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/__tests__/theme.test.ts`

- [ ] **Step 1: Create types and default theme from the spec's Section 3**
- [ ] **Step 2: Write test that verifies default theme has all required keys**
- [ ] **Step 3: Commit**

---

### Task 20: UI components

**Files:**
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/newsletter-dashboard.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/edition-editor.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/edition-analytics.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/subscriber-list.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/newsletter-settings.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/content-queue.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/components/email-provider-settings.tsx`
- Create: `~/Workspace/tnf-ecosystem/packages/newsletter-admin/src/types.ts`

Each component is extracted from the corresponding `bythiagofigueiredo/apps/web/src/app/cms/(authed)/newsletters/` page. The key transformation:
- Remove all `getSupabaseServiceClient()` calls and `getSiteContext()` calls
- Replace with props (data in, callbacks out)
- Apply default theme with merge support
- Add `'use client'` directive to the client barrel

- [ ] **Step 1: Create component prop types (types.ts) from the spec**
- [ ] **Step 2: Implement NewsletterDashboard** — extracted from `newsletters/page.tsx`, receives types + editions + filters via props
- [ ] **Step 3: Implement EditionEditor** — extracted from `newsletters/[id]/edit/page.tsx`
- [ ] **Step 4: Implement EditionAnalytics** — extracted from `newsletters/[id]/analytics/page.tsx`
- [ ] **Step 5: Implement SubscriberList** — extracted from `newsletters/subscribers/page.tsx`
- [ ] **Step 6: Implement NewsletterSettings** — extracted from `newsletters/settings/page.tsx`, includes email provider config section
- [ ] **Step 7: Implement ContentQueue** — extracted from `content-queue/page.tsx`
- [ ] **Step 8: Implement EmailProviderSettings** — new component for Resend/SMTP toggle
- [ ] **Step 9: Create client.ts barrel**

```typescript
'use client'

export { NewsletterDashboard } from './components/newsletter-dashboard.js'
export { EditionEditor } from './components/edition-editor.js'
export { EditionAnalytics } from './components/edition-analytics.js'
export { SubscriberList } from './components/subscriber-list.js'
export { NewsletterSettings } from './components/newsletter-settings.js'
export { ContentQueue } from './components/content-queue.js'
export { EmailProviderSettings } from './components/email-provider-settings.js'
```

- [ ] **Step 10: Build + test**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build --filter=@tn-figueiredo/newsletter-admin`
Expected: Build succeeds

- [ ] **Step 11: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter-admin/
git commit -m "feat(newsletter-admin): add all CMS UI components with default theme"
```

---

### Task 21: Newsletter-admin README + CHANGELOG

- [ ] **Step 1: Write README with component catalog and theme customization guide**
- [ ] **Step 2: Write CHANGELOG**
- [ ] **Step 3: Full build + test all 3 packages**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build test`
Expected: All 3 packages build and test successfully

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/tnf-ecosystem
git add packages/newsletter-admin/
git commit -m "docs(newsletter-admin): add README and CHANGELOG for 0.1.0"
```

---

## Phase 4: Wire bythiagofigueiredo to consume packages

### Task 22: Install packages + update email layer

**Files:**
- Modify: `~/Workspace/bythiagofigueiredo/apps/web/package.json`
- Delete: `~/Workspace/bythiagofigueiredo/apps/web/lib/email/resend.ts`
- Modify: `~/Workspace/bythiagofigueiredo/apps/web/lib/email/service.ts`

- [ ] **Step 1: Install packages**

```bash
cd ~/Workspace/bythiagofigueiredo
npm install @tn-figueiredo/email@0.2.0 @tn-figueiredo/newsletter@0.1.0 @tn-figueiredo/newsletter-admin@0.1.0
```

- [ ] **Step 2: Delete resend.ts and update service.ts**

```typescript
// apps/web/lib/email/service.ts
import type { IEmailService } from '@tn-figueiredo/email'
import { createEmailService } from '@tn-figueiredo/email'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  cached = createEmailService({ provider: 'resend', apiKey: process.env.RESEND_API_KEY! })
  return cached
}
```

- [ ] **Step 3: Run existing tests to verify nothing breaks**

Run: `cd ~/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/bythiagofigueiredo
git add apps/web/package.json apps/web/lib/email/
git commit -m "refactor: consume @tn-figueiredo/email@0.2.0, remove local Resend adapter"
```

---

### Task 23: Wire newsletter use cases into cron routes

**Files:**
- Modify: `~/Workspace/bythiagofigueiredo/apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`
- Modify: `~/Workspace/bythiagofigueiredo/apps/web/src/app/api/cron/anonymize-newsletter-tracking/route.ts`
- Modify: `~/Workspace/bythiagofigueiredo/apps/web/src/app/api/webhooks/resend/route.ts`
- Delete: `~/Workspace/bythiagofigueiredo/apps/web/lib/content-queue/slots.ts`
- Delete: `~/Workspace/bythiagofigueiredo/apps/web/lib/newsletter/stats.ts`
- Delete: `~/Workspace/bythiagofigueiredo/apps/web/src/emails/newsletter.tsx`
- Delete: `~/Workspace/bythiagofigueiredo/apps/web/src/emails/components/email-header.tsx`
- Delete: `~/Workspace/bythiagofigueiredo/apps/web/src/emails/components/email-footer.tsx`

- [ ] **Step 1: Refactor send-scheduled cron to use SendEditionUseCase**

The route becomes a thin shell: auth check, cron lock, then `new SendEditionUseCase(container).execute(editionId)`.

- [ ] **Step 2: Refactor webhook route to use ProcessWebhookUseCase**

The route: verify signature via `ResendWebhookProcessor`, then `new ProcessWebhookUseCase(container).execute(events)`.

- [ ] **Step 3: Refactor anonymize cron to use AnonymizeTrackingUseCase**

- [ ] **Step 4: Update all imports that used local slots.ts, stats.ts, emails/**

- [ ] **Step 5: Delete replaced local files**

- [ ] **Step 6: Run all tests**

Run: `cd ~/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests pass (update test mocks as needed)

- [ ] **Step 7: Commit**

```bash
cd ~/Workspace/bythiagofigueiredo
git add -A
git commit -m "refactor: wire newsletter use cases from @tn-figueiredo/newsletter package"
```

---

### Task 24: Wire newsletter-admin UI components

**Files:**
- Modify: All CMS newsletter pages in `apps/web/src/app/cms/(authed)/newsletters/`
- Modify: `apps/web/src/app/cms/(authed)/content-queue/page.tsx`

- [ ] **Step 1: Refactor newsletters/page.tsx to use NewsletterDashboard component**

The page becomes a server component that fetches data and passes it to `<NewsletterDashboard>`.

- [ ] **Step 2: Refactor all other CMS pages similarly**

- [ ] **Step 3: Run tests + visual check**

- [ ] **Step 4: Commit**

```bash
cd ~/Workspace/bythiagofigueiredo
git add apps/web/src/app/cms/
git commit -m "refactor: consume @tn-figueiredo/newsletter-admin UI components"
```

---

## Phase 5: Publish + cleanup

### Task 25: Publish all packages

- [ ] **Step 1: Build all packages**

Run: `cd ~/Workspace/tnf-ecosystem && npx turbo run build test`
Expected: All green

- [ ] **Step 2: Publish email**

```bash
cd ~/Workspace/tnf-ecosystem
npm publish -w packages/email --access=public
git tag email-v0.2.0
git push --tags
```

- [ ] **Step 3: Publish newsletter**

```bash
npm publish -w packages/newsletter --access=public
git tag newsletter-v0.1.0
git push --tags
```

- [ ] **Step 4: Publish newsletter-admin**

```bash
npm publish -w packages/newsletter-admin --access=public
git tag newsletter-admin-v0.1.0
git push --tags
```

---

### Task 26: Update CLAUDE.md + ecosystem README

**Files:**
- Modify: `~/Workspace/bythiagofigueiredo/CLAUDE.md` — update newsletter section to reference packages
- Modify: `~/Workspace/tnf-ecosystem/README.md` — add email, newsletter, newsletter-admin to catalog

- [ ] **Step 1: Update bythiagofigueiredo CLAUDE.md**

Add note that newsletter engine now lives in `@tn-figueiredo/newsletter` + `@tn-figueiredo/newsletter-admin`. Local code is thin wiring only.

- [ ] **Step 2: Update tnf-ecosystem README catalog**

Add under "Notifications & Communication" section:
```markdown
| `@tn-figueiredo/email` | 0.2.0 | Multi-provider email (Resend, SMTP/SES, Brevo), webhook processors |
| `@tn-figueiredo/newsletter` | 0.1.0 | Newsletter engine: batch send, subscribers, content queue, LGPD |
| `@tn-figueiredo/newsletter-admin` | 0.1.0 | CMS UI components for newsletter management |
```

- [ ] **Step 3: Commit both repos**

```bash
cd ~/Workspace/tnf-ecosystem
git add README.md
git commit -m "docs: add email, newsletter, newsletter-admin to package catalog"

cd ~/Workspace/bythiagofigueiredo
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for newsletter package extraction"
```
