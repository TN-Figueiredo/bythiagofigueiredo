# Sprint 3 — Auth, Lead Capture, Admin & Package Extraction Design

**Data:** 2026-04-16
**Sprint:** 3 (Auth & Lead Capture & Admin Extraction)
**Horas estimadas:** 58h
**Depende de:** Sprint 2 ✅
**Desbloqueia:** Sprint 4 (LGPD, SEO, deploy)

## Goal

Entregar lead capture end-to-end (newsletter + contact + transactional emails), experiência admin completa (login + invite-only signup + campaign CRUD + carry-over polish), e extração formal dos packages reusáveis (`@tn-figueiredo/cms` + `@tn-figueiredo/email`) preparando para os 4 sites consumers do conglomerado (tonagarantia, CalcHub, MEISimples, TravelCalc).

## Exit criteria

- [ ] `@tn-figueiredo/email@0.1.0` publicado em GitHub Packages, instalado em apps/web pinned
- [ ] `@tn-figueiredo/cms@0.1.0` extraído pra repo TN-Figueiredo/cms, publicado, instalado pinned
- [ ] 7 novas migrations Sprint 3 aplicadas (invitations + RLS, contact_submissions, newsletter_subscriptions, unsubscribe_tokens, sent_emails + enum, rate-limit trigger, sites.brevo_newsletter_list_id + contact_notification_email)
- [ ] `/signin` UI funcional: email+password + Google OAuth + Turnstile + forgot/reset
- [ ] Invite flow: admin cria via `/admin/users` → email transacional → invitee aceita via `/signup/invite/[token]` → atomic accept (existing or new user)
- [ ] Newsletter signup widget: subscribe → confirmação por email → cron sync pra Brevo + welcome email enviado
- [ ] Contact form: insert + auto-reply (rate-limited 1/24h) + admin alert
- [ ] Unsubscribe via token funcional (RLS-protected RPC)
- [ ] `/cms/campaigns` CRUD: list + new + edit + delete + submissions view
- [ ] PostEditor com autosave localStorage + meta SEO fields + cover image picker
- [ ] `/blog/[locale]/[slug]` com locale switcher + hreflang alternates
- [ ] `/cms/blog` lista com delete UI via AlertDialog (Radix)
- [ ] All write actions guarded por `requireSiteAdminForRow(table, id)` helper genérico
- [ ] Tests verdes em todos workspaces; pre-commit hook green

---

## Arquitetura

### `@tn-figueiredo/email` package (NEW)

Adapter de email transacional. Separado do Brevo marketing lists (Sprint 1b já tem `lib/brevo.ts createBrevoContact` para listas). Empire-pattern: 4 consumers usarão o mesmo package.

#### Estrutura

```
@tn-figueiredo/email/
  src/
    interfaces/
      email-service.ts         -- IEmailService (send + sendTemplate + handleWebhook?)
      email-template.ts        -- IEmailTemplate<V> (async render)
    
    brevo/
      brevo-adapter.ts         -- BrevoEmailAdapter implements IEmailService
      types.ts                 -- Brevo API types (stripped)
    
    templates/
      base-layout.ts           -- emailLayout, emailButton, formatDatePtBR, escapeHtml (port tonagarantia)
      registry.ts              -- TemplateRegistry class (type-safe template lookup)
      welcome.ts               -- "Bem-vindo à newsletter" pt-BR + en
      invite.ts                -- "Você foi convidado"
      confirm-subscription.ts  -- double opt-in confirmation
      contact-received.ts      -- auto-reply ao submitter
      contact-admin-alert.ts   -- notifica admin de novo contato
    
    helpers/
      unsubscribe-token.ts     -- ensureUnsubscribeToken(supabase, siteId, email, baseUrl)
    
    types/
      message.ts               -- EmailMessage, EmailResult, EmailWebhookEvent
      branding.ts              -- EmailBranding (logoUrl, primaryColor, brandName, ...)
    
    index.ts
    
  test/
    brevo-adapter.test.ts
    templates/{welcome,invite,confirm-subscription,contact-received,contact-admin-alert}.test.ts
    helpers/unsubscribe-token.test.ts
```

#### Interfaces principais

```ts
interface IEmailService {
  send(msg: EmailMessage): Promise<EmailResult>
  sendTemplate<V extends Record<string, unknown>>(
    template: IEmailTemplate<V>,
    to: string,
    variables: V,
    locale?: string,
  ): Promise<EmailResult>
  handleWebhook?(payload: unknown, signature: string): Promise<EmailWebhookEvent[]>
}

interface EmailMessage {
  from: { email: string; name: string }   // REQUIRED — consumer resolves per-site
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  metadata?: Record<string, unknown>       // generic — adapter maps to provider-specific
}

interface EmailResult {
  messageId: string
  provider: 'brevo'
}

interface IEmailTemplate<V> {
  name: string
  render(variables: V, locale: string): Promise<{
    subject: string
    html: string
    text?: string
  }>
}

interface EmailBranding {
  logoUrl?: string
  primaryColor?: string
  brandName: string
  footerText?: string
  unsubscribeUrl?: string
}
```

#### Sender identity per-site

`BrevoEmailAdapter` é stateless (só apiKey no construtor). Cada `send()` recebe `from` no message. Consumer resolve via:

```ts
async function getEmailSender(siteId: string) {
  const site = await ringContext().getSite(siteId)
  return {
    email: `noreply@${site.domains[0]}`,
    name: site.name,
  }
}
```

#### Rate limiting

`BrevoEmailAdapter` usa `p-queue` interno: `concurrency: 5, interval: 1000, intervalCap: 5` = 300/min (Brevo free tier limit). Bulk sends devem usar Brevo bulk API.

#### Unsubscribe token helper

```ts
export async function ensureUnsubscribeToken(
  supabase: SupabaseClient,
  siteId: string,
  email: string,
  baseUrl: string,
): Promise<string> {
  // INSERT/UPSERT unsubscribe_tokens, return URL `${baseUrl}/unsubscribe/${token}`
}
```

#### Dependencies

```json
{
  "dependencies": {
    "p-queue": "8.0.1",
    "zod": "3.23.8"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

### Database schemas (7 migrations Sprint 3)

Todas com RLS ring-scoped via `can_admin_site()` (Sprint 2 helper).

#### `invitations` (20260416000001)

```sql
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
```

**Rate limit trigger** (separate migration `20260416000006`):
```sql
create function public.invitations_rate_limit() returns trigger ...
-- max 20 invites/hour per invited_by
```

**RPC** `get_invitation_by_token(p_token)` returns minimal info (email, role, org_name, expires_at, expired bool) — anon-callable.

**RPC** `accept_invitation_atomic(p_token, p_user_id)` — `SECURITY DEFINER`, FOR UPDATE lock, atomic insert org_member + author + update invitation. Validates `auth.users.email = invitation.email`.

**RLS:**
- Staff (`is_org_staff(org_id) IN ('owner','admin')`) CRUD em sua org
- Anon: read via RPC only

#### `contact_submissions` (20260416000002)

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
```

**RLS:**
- Anon insert com `app.site_id` GUC match validation (Sprint 1a pattern)
- Staff read via `can_admin_site(site_id)`

#### `newsletter_subscriptions` (20260416000003)

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
  
  check (status <> 'confirmed' or brevo_contact_id is not null)
);

create unique index newsletter_pending_token
  on public.newsletter_subscriptions (confirmation_token)
  where status = 'pending_confirmation' and confirmation_expires_at > now();
create index on public.newsletter_subscriptions (site_id, status);
```

**RPC** `confirm_newsletter_subscription(p_token)` — atomic confirm, returns email + site_id.

**RLS:** anon insert (site GUC), anon update via RPC, staff read via `can_admin_site`.

#### `unsubscribe_tokens` (20260416000004)

```sql
create table public.unsubscribe_tokens (
  token text primary key check (token ~ '^[a-f0-9]{64}$'),
  site_id uuid not null references public.sites(id) on delete restrict,
  email citext not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique (site_id, email)
);
```

**RPC** `unsubscribe_via_token(p_token)` — atomic unsub + Brevo cleanup queued via cron.

**RLS:** service role + RPC for anon.

#### `sent_emails` + enum (20260416000005)

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
```

**Retention policy (documented):** sent_emails kept 90d via cron purge; unsubscribe_tokens used kept 365d (LGPD accountability); invitations expired+non-accepted kept 30d after expires_at.

#### `sites` extensions (20260416000007)

```sql
alter table public.sites
  add column brevo_newsletter_list_id int,
  add column contact_notification_email citext;
```

Per-site Brevo list ID + per-site contact alert recipient.

#### Seed updates

`supabase/seeds/dev.sql` truncate list ganha 5 novas tabelas (child→parent):
```
sent_emails, unsubscribe_tokens, invitations, contact_submissions, newsletter_subscriptions
```

Seed data: 1 pending invite (thiago→editor), 2 contact_submissions, 3 newsletter_subscriptions (mixed status), 0 sent_emails (cron will populate).

### Auth flow (login port + invite)

#### `/signin` (port from tonagarantia)

`apps/web/src/app/signin/page.tsx` — port integral adaptado pra branding bythiagofigueiredo:
- Email + password form
- Google OAuth button (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
- Turnstile token (server action validates)
- Error states (wrong password, unconfirmed email, locked, OAuth error, Turnstile failed)
- `?redirect=` post-login destination

#### `/auth/callback`

OAuth code exchange handler:
```ts
GET /auth/callback?code=xxx&next=/cms
→ supabase.auth.exchangeCodeForSession(code)
→ Set session cookies
→ Redirect to ?next or /cms
```

#### `/signin/forgot` + `/signin/reset/[token]`

Uses Supabase Auth defaults (no @tn-figueiredo/email yet for reset):
- `/signin/forgot`: form → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/signin/reset' })`
- `/signin/reset/[token]`: form (Supabase session active via link) → `supabase.auth.updateUser({ password })`

Sprint 4 will customize via Supabase Auth Hooks.

#### `/admin/users` (admin page)

Layout:
- Active members list (org_members JOIN auth.users)
- Pending invitations list (with [Reenviar] + [Revogar] actions)
- Form: email + role → [Convidar]

Server actions:
- `createInvitation(email, role)` — require `org_role IN ('owner','admin')`, generate token, INSERT (DB rate-limit trigger fires), send email via @tn-figueiredo/email inviteTemplate
- `revokeInvitation(id)` — UPDATE revoked_at + revoked_by_user_id
- `resendInvitation(id)` — re-send email + UPDATE last_sent_at + resend_count++

#### `/signup/invite/[token]` (invitee)

Server component (public route):
1. RPC `get_invitation_by_token(token)` → if invalid/expired → InviteInvalid component
2. Check session: `supabase.auth.getUser()`
3. If logged-in user:
   - email matches invitation.email → AcceptButton
   - email mismatches → WrongAccount component
4. If anon:
   - Check `auth.admin.listUsers({ filter: 'email.eq.' + email })` (service role)
   - Email exists → redirect `/signin?redirect=/signup/invite/${token}&hint=${email}`
   - Email new → NewUserSignupForm (password + confirm)

Server actions:
- `acceptInviteForCurrentUser(token)` — calls `accept_invitation_atomic(token, user.id)`
- `acceptInviteWithPassword(token, password)`:
  1. Validate via `get_invitation_by_token`
  2. `auth.admin.createUser({ email, password, email_confirm: true })`
  3. Call `accept_invitation_atomic(token, user.id)`
  4. If RPC fails → `auth.admin.deleteUser(user.id)` (compensating)
  5. `signInWithPassword({ email, password })` to set session
  6. Return `{ ok: true, redirectTo: '/cms' }`

#### Middleware route updates

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
  /^\/signup\/invite\//,
  /^\/unsubscribe\//,
  /^\/newsletter\/confirm\//,
],
protectedRoutes: [
  /^\/cms(\/.*)?$/,
  /^\/admin(\/.*)?$/,
],
```

`/admin/users` server component re-checks `org_role IN ('owner','admin')` — editor/author redirected to `/cms`.

### Lead capture (newsletter + contact)

#### Newsletter signup widget

Component `<NewsletterSignup>` at homepage footer + blog list sidebar:
- Email input + LGPD consent checkbox + submit
- Submit → server action `subscribeToNewsletter`

Server action:
```ts
1. verifyTurnstileToken
2. validate email, consent === true
3. resolve site context
4. generate confirmation_token (32-byte hex)
5. INSERT/UPSERT newsletter_subscriptions:
   - new row → status='pending_confirmation', token, expires_at=now()+7d
   - existing pending → rotate token, reset expires_at
   - existing confirmed → return { ok: true, alreadyConfirmed: true }
   - existing unsubscribed → reactivate (status='pending_confirmation', new token)
6. Send confirmation email via @tn-figueiredo/email confirmSubscriptionTemplate
7. Return result
```

#### `/newsletter/confirm/[token]` (confirmation page)

Server component, **decoupled from Brevo sync**:
1. RPC `confirm_newsletter_subscription(token)` — atomic mark confirmed
2. Render success or error
3. Brevo sync + welcome email handled by cron (not blocking confirm UX)

#### `/api/cron/sync-newsletter-pending` (NEW cron route)

Runs every 1min via vercel.json:
1. Auth: `Bearer CRON_SECRET`
2. Find newsletter_subscriptions WHERE status='confirmed' AND brevo_contact_id IS NULL (limit 50)
3. For each:
   - Resolve site (for `brevo_newsletter_list_id` + sender)
   - `createBrevoContact` via existing `lib/brevo.ts`
   - On success: UPDATE brevo_contact_id
   - Send welcome email (uses `ensureUnsubscribeToken`)
   - INSERT sent_emails
   - On Brevo error: log, leave NULL (next run retries)
4. Also process unsubscribe sync (status='unsubscribed' AND brevo_contact_id IS NOT NULL): remove from Brevo + clear brevo_contact_id
5. INSERT cron_runs

#### Contact form

Component `<ContactForm>` at `/contact` page or homepage section:
- Name + email + message + LGPD processing consent + optional marketing opt-in + Turnstile
- Submit → server action `submitContact`

Server action:
```ts
1. verifyTurnstileToken
2. validate (lengths, email, consent_processing === true)
3. site context
4. INSERT contact_submissions
5. If consent_marketing: chain into subscribeToNewsletter
6. Auto-reply rate limit check: query sent_emails WHERE to_email=email AND template_name='contact-received' AND sent_at>now()-24h
   - If 0 hits: send auto-reply via contactReceivedTemplate
7. Send admin alert via contactAdminAlertTemplate (replyTo: input.email)
   - Recipient: site.contact_notification_email OR fallback to first org owner email
8. Return combined result (contact + newsletter status)
```

#### `/cms/contacts` (admin)

List all contact_submissions for current site (RLS-scoped). Click row → `/cms/contacts/[id]` detail with "Marcar como respondido" + mailto reply link.

#### `/unsubscribe/[token]` (public page)

Server component:
1. Lookup `unsubscribe_tokens` row
2. If valid: render confirm form
3. Submit → `unsubscribe_via_token(token)` RPC
4. Render success
5. Brevo cleanup handled by cron (decoupled)

### Campaign admin CRUD

#### Repository (in package)

`packages/cms/src/supabase/campaign-repository.ts`:
```ts
export class SupabaseCampaignRepository extends SupabaseContentRepository
  implements IContentRepository<Campaign, CreateCampaignInput, UpdateCampaignInput, CampaignListItem> {
  
  // Standard CRUD (mirror SupabasePostRepository)
  async list, getById, getBySlug, create, update, publish, unpublish, schedule, archive, delete, count
  
  // Campaign-specific
  async listSubmissions(campaignId): Promise<CampaignSubmission[]>
}
```

Types `Campaign`, `CampaignTranslation`, `CreateCampaignInput`, `UpdateCampaignInput` in `packages/cms/src/types/campaign.ts`. Schema-opinionated for current bythiagofigueiredo (4 consumers may extend in their own forks/extensions in future).

#### CampaignEditor (NOT in package — apps/web only)

`apps/web/src/app/cms/campaigns/_components/`:
- `campaign-editor.tsx` — main editor with collapsible sections (useState toggle)
- `form-fields-editor.tsx` — structured rows (no JSON textarea)
- `extras-editor.tsx` — dropdown "Add block" + form per kind
- `mdx-field.tsx` — textarea + collapsible preview (uses package's `<EditorPreview>`)

Sections:
1. Configuração: interest dropdown, PDF picker (campaign-files bucket), brevo IDs, form_fields editor
2. Conteúdo (per locale tab): slug, meta SEO, OG image, main_hook (MDX), supporting/intro/body
3. Form copy: form_intro, button labels
4. Success copy: 7 fields
5. Extras: structured editor with Add Block dropdown
6. Status panel: publish/unpublish/archive/delete buttons (AlertDialog confirm)

Decision: **CampaignEditor stays in apps/web, NOT in package**. Sprint 5+ when 2nd content type joins package, design generic `<ContentEditor>` accepting field schema as prop. Documented decision.

#### Atomic save RPC

`update_campaign_atomic(p_campaign_id, p_locale, p_campaign_patch jsonb, p_translation_patch jsonb)` PL/pgSQL function — single round-trip, atomic update of campaigns + campaign_translations.

#### Pages

```
apps/web/src/app/cms/campaigns/
  page.tsx                         -- list with filters
  new/page.tsx                     -- create draft + redirect
  [id]/edit/
    page.tsx                       -- editor wrapper
    actions.ts                     -- saveCampaign, publishCampaign, etc
  [id]/submissions/
    page.tsx                       -- list of campaign_submissions
```

### `requireSiteAdminForRow` generic helper

Refactor Sprint 2 `requireSiteAdmin(postId)` → generic:

```ts
// apps/web/lib/cms/auth-guards.ts
export async function requireSiteAdminForRow(
  table: 'blog_posts' | 'campaigns',
  rowId: string,
): Promise<{ siteId: string }>
```

Sprint 2 blog actions refactor to use this. Sprint 3 campaigns actions use this.

### Carry-over polish (PostEditor + blog detail + admin list)

#### autosave hook (in package)

`packages/cms/src/editor/use-autosave.ts` — primitive deps in useEffect (no object reference issues), dirty state tracking, conditional beforeunload listener:

```ts
export function useAutosave(opts: {
  postId: string
  locale: string
  current: Omit<AutosaveDraft, 'savedAt'>
  initial: Omit<AutosaveDraft, 'savedAt'>
  debounceMs?: number
}): { dirty: boolean; clearDraft: () => void; storedDraft: AutosaveDraft | null }
```

PostEditor integrates: shows restore prompt if storedDraft.savedAt > initial.updatedAt.

#### Meta SEO fields (in package)

`packages/cms/src/editor/meta-seo-fields.tsx` — collapsible `<details>` section with metaTitle, metaDescription (maxLength 160), ogImageUrl (text + AssetPicker for upload).

#### Cover image picker (in package)

PostEditor cover field — text URL + AssetPicker for upload. **Cover is shared per-post (single image for all locales)** — documented decision. OG image stays per-translation (per-locale).

#### Locale switcher on /blog/[locale]/[slug]

`apps/web/src/app/blog/[locale]/[slug]/page.tsx` — adds nav with Link to each `availableLocales`. `generateMetadata` adds `alternates.languages` mapping.

#### Delete UI in /cms/blog list (Radix AlertDialog)

Adds `@radix-ui/react-alert-dialog@1.1.4` to apps/web. New component `<ConfirmActionButton>` wraps Radix dialog. List page row uses it for delete action (only shown for draft/archived).

### Package extraction (T14 — both packages together)

After Epics 1-7 complete and tested in workspace:

For each of `cms` and `email`:
1. Bump version `0.1.0-dev` → `0.1.0`, remove `"private": true`
2. `gh repo create TN-Figueiredo/<name> --private`
3. `git subtree split --prefix=packages/<name> -b <name>-extract`
4. Push to new repo as main
5. Setup `.npmrc` + `.github/workflows/{publish,ci}.yml`
6. Add LICENSE + verify README
7. Tag `v0.1.0` + push → CI publishes
8. Smoke test in scratch project
9. Update `apps/web/package.json`: `"workspace:*"` (or `"*"`) → `"0.1.0"`
10. Remove `transpilePackages` entry for the package (now ships pre-built dist)
11. `git rm -r packages/<name>` from monorepo
12. `npm install` + verify all tests pass + web build green

Iteration workflow post-extraction (Option 1 — bump + publish per change):
- Clone TN-Figueiredo/<name> separately
- Make changes, bump version, tag, push → CI publishes
- `npm install @tn-figueiredo/<name>@<new> -w apps/web`

---

## Épicos e estimativas

| Epic | Conteúdo | Estimate |
|---|---|---|
| 1 | `@tn-figueiredo/email` package: interfaces, BrevoEmailAdapter, base-layout port, 5 templates (welcome, invite, confirm, contact-received, contact-admin-alert), unsubscribe_token helper, tests | 8h |
| 2 | Database schemas: 7 migrations (invitations + RLS + RPC, contact_submissions, newsletter_subscriptions + RPC, unsubscribe_tokens + RPC, sent_emails + enum, rate-limit trigger, sites extensions), seed update, tests | 5h |
| 3 | Auth flow: /signin port + Turnstile, /auth/callback, /signin/forgot/reset, /admin/users, /signup/invite/[token], 4 server actions, accept_invitation_atomic RPC, tests | 9h |
| 4 | Newsletter + contact + cron sync: <NewsletterSignup>, /newsletter/confirm/[token], /unsubscribe/[token], <ContactForm>, /contact, /cms/contacts, /api/cron/sync-newsletter-pending, server actions, tests | 10h |
| 5 | Campaign admin CRUD: SupabaseCampaignRepository, /cms/campaigns pages, _components (CampaignEditor + form-fields-editor + extras-editor + mdx-field), update_campaign_atomic RPC, /cms/campaigns/[id]/submissions, server actions, tests | 10h |
| 6 | Carry-over polish: autosave hook + restore, meta SEO fields, cover image picker (PostEditor), locale switcher (/blog detail), AlertDialog delete (/cms/blog), `requireSiteAdminForRow` refactor, i18n strings extension, tests | 12h |
| 7 | Package extraction (T14): both packages — version bump + GH repo + subtree split + CI workflows + publish v0.1.0 + smoke + swap workspace→pinned + remove transpilePackages + remove from monorepo | 4h |
| **Total** | | **58h** |

### Dependency order

```
Epic 1 (email pkg) → Epic 2 (schemas) → Epic 3 (auth/invite) → Epic 4 (newsletter/contact)
                                                              → Epic 5 (campaigns)
                                                              → Epic 6 (polish)
                                                              ↓
                                                        Epic 7 (extract both packages)
```

Epics 4, 5, 6 são parallelizáveis (diferentes files/areas) após Epics 1-3.

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| Atomic accept_invitation_atomic edge cases (concurrent requests, email mismatch) | 30% | alto | FOR UPDATE lock, validate auth.users.email match, comprehensive tests |
| @tnf/email rate limit insuficiente em production load | 20% | médio | p-queue conservative; admin alert when queue depth >100 (Sprint 4 observability) |
| Cron sync atrasa welcome email perceptivelmente | 25% | baixo | 1min interval acceptable; optimize to instant-send if Brevo SLA tight |
| Package publish workflow breaks no GH Actions | 15% | médio | Test publish workflow in beta tag (v0.1.0-beta.1) before v0.1.0 |
| Turnstile + Google OAuth conflict (both on /signin) | 15% | baixo | OAuth bypasses Turnstile (provider handles); password path requires both |
| transpilePackages removal breaks Edge runtime imports | 20% | médio | Test middleware import after removal; rollback to transpilePackages if Edge Runtime issues |

## Fora do escopo (Sprint 4+)

- Custom branded password reset email (Sprint 4 via Supabase Auth Hooks)
- Privacy policy + Terms pages + cookie banner (Sprint 4 LGPD)
- Right-to-be-forgotten data deletion flow (Sprint 4)
- consent_versions table with snapshot text (Sprint 4)
- Generic `<ContentEditor>` component with field schema prop (Sprint 5+ when 2nd content type)
- Email webhook handler full implementation (interface slot reserved Sprint 3, impl Sprint 4)
- Cron retention purge implementation (stub Sprint 3, full Sprint 4)
- Newsletter campaign sending UI (admin sends broadcast — Sprint 4)
- MFA on login (Sprint 4+)
- Admin observability dashboard (cron_runs viz, sent_emails metrics) — Sprint 4
- Per-locale cover images (currently shared per-post — migrate if demand surfaces)

## Decisões de design tomadas

| Decisão | Escolha | Alternativas |
|---|---|---|
| Email package separate from CMS | Yes — `@tn-figueiredo/email` reusable across 4 consumers | (a) inline in apps/web (rejected: empire) |
| Login UI + invite flow | Port tonagarantia + admin invite-only signup | OAuth-only, open signup (rejected: admin-controlled) |
| Sprint structure | Integral 58h | 3a/3b split (rejected: integral preferred) |
| Approach order | Approach 3 — package-first (publish first, consume) | Schema-first, vertical slice (rejected: empire-first) |
| T14 timing | Sprint 3 with 4 consumers planned | Defer to 5+ (rejected — empire ready now) |
| CampaignEditor location | apps/web (not package) | In package (rejected: not generic enough yet) |
| Cover image scope | Shared per-post | Per-locale (deferred, doc'd) |
| Newsletter sync | Decoupled via cron (1min) | Inline in confirm (rejected: blocks UX) |
| Auto-reply rate limit | 1 per (email, site_id) per 24h | Unlimited (rejected: spammable) |
| Password reset | Supabase default email Sprint 3 | Custom branded (deferred Sprint 4) |
| Atomic RPCs | PL/pgSQL functions for accept/save/confirm | Raw pg.Client (rejected: edge-incompatible) |
| Confirm dialogs | Radix AlertDialog | Native confirm() (rejected: poor UX, server action issues) |

## Notes & caveats

- **Empire pattern compliance:** all 7 epics produce code that's reusable by future consumers (tonagarantia, CalcHub, MEISimples, TravelCalc). Email package + CMS package extraction completes the empire toolkit.
- **Brevo rate limits:** free tier 300/min. p-queue in adapter prevents bursts. For >300/min sustained loads, upgrade Brevo tier.
- **Compensating actions:** invite acceptance with createUser + RPC failure → deleteUser. Tested under failure injection.
- **Edge runtime:** middleware uses `SupabaseRingContext` from `@tn-figueiredo/cms`. After T14, package ships pre-built dist — Edge import works without transpilePackages. Verify post-extraction.
- **Token security:** all anon-accessible tokens are 32-byte hex (256 bits entropy). Brute force infeasible. Time-limited where applicable.
- **i18n:** Sprint 3 expands `getEditorStrings(locale)` with new entries. pt-BR + en supported. Other locales fallback to pt-BR.
- **LGPD:** two-consent pattern (processing + marketing) on contact form. Audit trail in sent_emails. Right-to-be-forgotten flow comes Sprint 4.
- **Carry-over polish moves to package:** autosave + meta SEO + cover picker = PostEditor improvements in `@tn-figueiredo/cms`. Reusable by 4 consumers.

---

## Retrospective (2026-04-15)

### What shipped

- **Epic 1 — `@tn-figueiredo/email` package** ✅ — interfaces, `BrevoEmailAdapter` com `p-queue` rate limit, 5 templates (welcome, invite, confirm-subscription, contact-received, contact-admin-alert), `ensureUnsubscribeToken` helper, test suite verde. Package vive em `packages/email/` como workspace `0.1.0-dev` (extraction → Sprint 4 Epic 7).
- **Epic 2 — Database schemas** ✅ — 7 migrations aplicadas (invitations + RLS + RPCs, contact_submissions, newsletter_subscriptions + confirm RPC, unsubscribe_tokens + RPC, sent_emails + enum, rate-limit trigger em invitations, sites.brevo_newsletter_list_id + contact_notification_email). Migration extra `20260416000014_contact_rate_limit_and_cron_locks.sql` adicionou rate-limit em contato + locks distribuídos em cron.
- **Epic 3 — Auth flow** ✅ — `/signin` port (email+senha + Google OAuth + Turnstile), `/auth/callback`, `/signin/forgot` + `/signin/reset`, `/admin/users` com invite/revoke/resend, `/signup/invite/[token]` atomic accept, `accept_invitation_atomic` RPC com FOR UPDATE + compensating deleteUser.
- **Epic 4 — Newsletter + contact + cron** ✅ — `<NewsletterSignup>`, `/newsletter/confirm/[token]`, `/unsubscribe/[token]`, `<ContactForm>` + `/contact`, `/cms/contacts` list+detail, `/api/cron/sync-newsletter-pending` (Brevo sync + welcome email + unsub cleanup).
- **Epic 5 — Campaign admin CRUD** ✅ — `SupabaseCampaignRepository` no package, `/cms/campaigns` list/new/edit/submissions, `<CampaignEditor>` em `apps/web` com seções colapsáveis, `update_campaign_atomic` RPC.
- **Epic 6 — Carry-over polish** ✅ — `useAutosave` hook + restore prompt no PostEditor, meta SEO fields (metaTitle/metaDescription/ogImageUrl), cover image picker (shared per-post), locale switcher em `/blog/[locale]/[slug]` com hreflang alternates, AlertDialog delete em `/cms/blog`, `requireSiteAdminForRow` refactor genérico.

### What was deferred to Sprint 4

- **Epic 7 — Package extraction (T14)** — ambos `@tn-figueiredo/cms` e `@tn-figueiredo/email` continuam como workspace packages. Movidos integralmente para Sprint 4 Epics 6 e 7. Decisão: priorizou-se consolidar features + polish no Sprint 3 antes de cristalizar a API pública.
- **DB-gated integration tests para RPCs** — `confirm_newsletter_subscription`, `unsubscribe_via_token`, `update_campaign_atomic`, `cron_try_lock`/`cron_unlock` têm só unit tests com mock → Sprint 4 Epic 8.
- **Sentry + logs estruturados em cron** — oncall ainda é grep em Vercel logs → Sprint 4 Epic 9.
- **LGPD: unsubscribe anonymization + purge `sent_emails` 90d** — unsubscribe flipa status mas não anonymiza; purge cron pendente → Sprint 4 Epic 10.

### Audit trajectory

| Epic | Início | Final | Δ |
|---|:---:|:---:|:---:|
| Epic 3 (Auth flow) | 82 | 98 | +16 |
| Epic 4 (Newsletter + contact + cron) | 62 | 99 | +37 |
| Epic 5 (Campaign admin CRUD) | 82 | 99 | +17 |
| Sprint-wide | 93 | 99 | +6 |

Epic 4 foi o maior ganho (+37) — audit inicial apontou gaps em rate limiting (contact auto-reply), cron idempotency (sem locks distribuídos), e treatment de Brevo errors. Migration `20260416000014` e subsequent hardening fecharam a maioria dos pontos.

### Métricas

- **Commits:** ~40 ao longo do sprint.
- **Tests:** suite verde em todos workspaces (pre-commit hook enforces).
- **Migrations aplicadas em prod:** 7 planejadas + 1 adicional (rate limit + cron locks) = 8 total.

### Lessons learned

- **Package extraction é seu próprio epic** — tentar extrair no mesmo sprint das features novas criou risco de API churn. Adiar para Sprint 4 foi a call correta.
- **Cron observability importa cedo** — debuggar `sync-newsletter-pending` em staging sem logs estruturados custou horas. Epic 9 do Sprint 4 endereça.
- **Rate limiting é fácil de esquecer** — contact form foi pro audit sem rate limit; migration 14 corrigiu. Padrão: todo endpoint anon-writable precisa rate limit explícito desde o PR inicial.

