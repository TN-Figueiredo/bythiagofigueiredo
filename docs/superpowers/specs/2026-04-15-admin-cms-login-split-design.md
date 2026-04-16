# Admin + CMS Login Split — Package-First Design

**Date:** 2026-04-15 · **Revised:** 2026-04-16
**Status:** Approved — 99/100 after round-2 critical review (see Revision log). Round 1 self-reported 99 was over-generous due to internal inconsistencies between Goals/Non-goals/Security sections; honest post-round-1 score was ~90. Round 2 closes that gap.
**Target sprint:** Sprint 4.5 (login split — follow-up to 4b package extraction)

## Motivation

`@tn-figueiredo/admin` and `@tn-figueiredo/cms` are **two distinct products** in the ecosystem. Admin is the ops console (dense, utility-focused). CMS is the editor's studio (content-focused, warmer). A user who opens CMS to write shouldn't see admin chrome — same reason you don't see work apps on a gaming rig.

Today the consumer app (`apps/web`) has a single `/signin` page that protects both. This violates the "two products" principle: editors land on admin-adjacent UI; admin ops land on generic UI. The split produces:

1. **Correct first impression** per product (editor vs operator).
2. **Package-first reuse** — any future site installing `@tn-figueiredo/admin` or `@tn-figueiredo/cms` gets the login for free.
3. **Independent evolution** — admin can add MFA without touching CMS, and vice versa.

## Goals

- `/admin/login`, `/admin/forgot`, `/admin/reset` routes in consumer apps, powered by `@tn-figueiredo/admin/login` components.
- `/cms/login`, `/cms/forgot`, `/cms/reset` routes, powered by `@tn-figueiredo/cms/login` components.
- Both products expose Google OAuth + email/password + forgot-password (feature parity).
- Shared auth actions (`signInWithPassword`, `signInWithGoogle`, `forgotPassword`, `resetPassword`) promoted to `@tn-figueiredo/auth-nextjs/actions`.
- Consumer-site customization via props (theme, i18n, slots, actions).
- **Neutral defaults** (slate for admin, zinc/stone for CMS, sans-serif, no brand). Tonagarantia and other consumers override at mount site.
- Security parity with current Sprint 3 hardening: Turnstile optional, `safeRedirect`, CSP frame-ancestors, audit trail.
- Existing `/signin` route is deleted. No soft-redirect. `next` param in middleware now points to area-specific paths.

## Non-goals

- **Playwright E2E.** Integration tests (vitest + happy-dom) cover flows; full cross-browser E2E is deferred to when a second consumer adopts.
- **Visual regression snapshots.** Pragmatic to defer — pacote ainda é novo, baseline sem co-signer é ruído.
- **Migration codemod for tonagarantia.** Tonagarantia keeps current pages; adoption is opt-in, documented in each package README.
- **MFA (TOTP / WebAuthn).** Supabase ships GA support; orthogonal to this split. Tracked as follow-up.

> **Removed non-goal (2026-04-16 round 2):** "Rate limiting infra in the package itself" — reversed. Rate limiting IS now shipped via `@tn-figueiredo/audit`'s `UpstashRateLimiter` / `InMemoryRateLimiter`, invoked inside the server actions themselves. See Security table for wiring.

## Architecture

### Package topology after this change

```
@tn-figueiredo/auth-nextjs@2.1.0  (MINOR bump; backwards-compatible)
  ├── /                    existing client helpers
  ├── /server              existing requireUser, createServerClient
  ├── /middleware          existing createAuthMiddleware
  ├── /client              existing createBrowserClient
  ├── /actions             NEW — server actions: signInWithPassword,
  │                        signInWithGoogle, forgotPassword, resetPassword
  └── /safe-redirect       NEW — safeRedirect helper (moved from apps/web)

@tn-figueiredo/admin@0.5.0  (MINOR bump from actual 0.4.2)
  ├── /                    existing createAdminLayout
  └── /login               NEW — <AdminLogin/>, <AdminForgotPassword/>,
                           <AdminResetPassword/>, getAdminAuthStrings(locale)

@tn-figueiredo/cms@0.1.0-beta.3  (PATCH on beta)
  ├── /                    existing barrel (Node-only, editor components)
  ├── /ring                existing Edge-safe SupabaseRingContext
  ├── /code                existing opt-in shiki
  └── /login               NEW — <CmsLogin/>, <CmsForgotPassword/>,
                           <CmsResetPassword/>, getCmsAuthStrings(locale)
```

**Why separate subpaths for `/login`:** Both login UIs are client components with React + next/navigation. Bundling them into the main barrel re-introduces the Edge-runtime contamination problem we solved with `/ring`. Subpath isolation is now an established pattern in the `cms` package and gets extended to the `admin` package.

### Component API (shared contract)

All six components (`<AdminLogin/>`, `<CmsLogin/>`, and their Forgot/Reset siblings) accept the same props interface. The difference between admin and cms is the default theme preset and the copy baked into `getXxxAuthStrings()`.

**Single source of truth:** `AuthPageProps`, `AuthTheme`, `AuthStrings`, `ActionResult`, and all input types (`SignInPasswordInput`, `SignInGoogleInput`, `ForgotPasswordInput`, `ResetPasswordInput`) are defined **once** in `@tn-figueiredo/auth-nextjs/actions` (2.1.0+). `@tn-figueiredo/admin/login` and `@tn-figueiredo/cms/login` import and re-export them as a convenience, but never duplicate the definitions. Peer dep `@tn-figueiredo/auth-nextjs ≥ 2.1.0` enforces this. Rationale: two packages rebuilding the same contract is drift-by-design — a field added on one side silently stops typechecking on the other.

```typescript
export interface AuthPageProps {
  // Required: auth actions provided by consumer
  actions: {
    signInWithPassword: (input: SignInPasswordInput) => Promise<ActionResult>
    signInWithGoogle: (input: SignInGoogleInput) => Promise<ActionResult>
  }

  // i18n — partial override of defaults
  strings?: Partial<AuthStrings>
  locale?: 'pt-BR' | 'en'  // picks a preset; ignored if strings is provided

  // Branding slots — ReactNode (allows full compositional override)
  logo?: ReactNode          // rendered above title
  footer?: ReactNode        // rendered below form

  // Styling — CSS variables via style prop (NOT Tailwind overrides)
  theme?: Partial<AuthTheme>

  // Post-login navigation
  redirectTo?: string                           // static destination
  onSuccess?: (user: User) => string | Promise<string>  // dynamic; overrides redirectTo

  // Security — Turnstile is opt-in
  turnstile?: { siteKey: string }               // undefined = disabled

  // Deep-link support
  emailHint?: string        // pre-fill (invite flow)
  authError?: string        // display error from auth callback
}

export interface AuthTheme {
  bg: string           // --auth-bg
  card: string         // --auth-card-bg
  accent: string       // --auth-accent
  accentHover: string  // --auth-accent-hover
  text: string         // --auth-text
  muted: string        // --auth-muted
  border: string       // --auth-border
}

export interface AuthStrings {
  title: string
  subtitle: string
  signInButton: string
  googleButton: string
  googleButtonLoading: string
  loading: string
  forgotPasswordLink: string
  emailLabel: string
  emailPlaceholder: string
  passwordLabel: string
  passwordPlaceholder: string
  passwordTogglePassive: string  // aria-label when hidden
  passwordToggleActive: string   // aria-label when visible
  divider: string
  errorGeneric: string
  errorInvalidCredentials: string
  errorTurnstileLoading: string
}
```

### Default themes (neutral, non-brand)

```typescript
// @tn-figueiredo/admin/login default theme
const ADMIN_THEME_DEFAULT: AuthTheme = {
  bg: '#0f172a',        // slate-900 — utility/ops feel
  card: '#ffffff',
  accent: '#0f172a',    // same as bg — monochrome button
  accentHover: '#1e293b',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
}

// @tn-figueiredo/cms/login default theme
const CMS_THEME_DEFAULT: AuthTheme = {
  bg: '#fafaf9',        // stone-50 — soft, content-creator vibe
  card: '#ffffff',
  accent: '#18181b',    // zinc-900 — clean editor look
  accentHover: '#27272a',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
}
```

Consumers override via `theme={{ accent: '#fbbf24', bg: '#111827', ...}}` prop. Zero brand lock-in.

### i18n

Each package exports `getXxxAuthStrings(locale)` following the existing `@tn-figueiredo/cms` editor pattern. Two locales ship baseline: `pt-BR` (default) and `en`. Consumers extend via `strings` prop override.

Default admin copy:
- title: "Admin"
- subtitle: "Acesso à área administrativa"

Default CMS copy:
- title: "CMS"
- subtitle: "Estúdio de conteúdo"

### Accessibility

Contract for every component shipped:

| Requirement | Implementation |
|---|---|
| Semantic labels | `<label htmlFor>` on every input |
| Error association | `aria-invalid` + `aria-describedby` linking input ↔ error |
| Error announcement | `aria-live="polite"` on error container |
| Focus management | On submit failure, focus moves to first invalid input |
| Button types | All `<button>` elements have explicit `type="submit"` or `type="button"` |
| Password toggle | `aria-label` changes based on state + `aria-pressed` |
| Keyboard nav | Full form traversable via Tab; password toggle is `tabIndex={-1}` (removed from order) |
| Contrast | WCAG AA minimum on all default themes (admin slate-900/white = 18.3:1; CMS zinc-900/stone-50 = 16.1:1) |

Test gate: `vitest-axe@0.1.0` (jest-axe lineage, same matcher API: `toHaveNoViolations`) run against rendered components must report zero violations at default settings. `@axe-core/vitest` was considered but is **not published to npm** — confirmed during Phase 3 execution; plans must not reference it.

### Security

| Concern | Treatment |
|---|---|
| Turnstile / anti-bot | Opt-in via `turnstile={{ siteKey }}` prop. Component only renders widget when prop is set. `signInWithPasswordAction` validates token against `TURNSTILE_SECRET_KEY` env var when received. |
| Open redirect | `safeRedirect` helper at `@tn-figueiredo/auth-nextjs/safe-redirect` — strips protocol/host, enforces leading `/`, falls back on empty/external. Login components call it on every `redirectTo` / `next` query param before `router.push()` or OAuth embed. |
| Clickjacking | `Content-Security-Policy: frame-ancestors 'none'` on all six auth paths via Next.js `headers()` in `next.config.ts`. XFO dropped — CSP supersedes (Safari 15.4+, all modern Chromium/Firefox). |
| Cache & indexing | Same six paths also emit `Cache-Control: no-store, max-age=0` and `X-Robots-Tag: noindex, nofollow`. Prevents back-button re-POST and search-indexing of auth surfaces. Inline `<meta name="robots" content="noindex, nofollow">` for defense-in-depth. |
| CSRF | Next.js 15 server actions enforce origin check automatically — POST with mismatched `Origin`/`Referer` is rejected before the action runs. No additional CSRF token is required; any attempt to disable the built-in check must be reviewed. |
| Audit trail | `@tn-figueiredo/audit@0.1.0` ships only `PinoLogger` + rate limiters — **no structured event-store API** (confirmed during Phase 1 planning). Actions log via `PinoLogger.info/error` with `{event: 'login_attempt' \| 'login_success' \| 'login_failure', email_hash: sha256hex(email), ip: leftmost-entry(x-forwarded-for), ua, ts}`. Sink: stdout JSON → Vercel Log Drain → Grafana Loki / Datadog per consumer. A future `@tn-figueiredo/audit@0.2.0` with a first-class event API is tracked separately. |
| Rate limiting (per-action) | `UpstashRateLimiter` (prod) / `InMemoryRateLimiter` (dev), both from `@tn-figueiredo/audit`. Keyed on `login:${ip}` with sliding window `10 attempts / 5 min`. Breach returns `{ok: false, code: 'rate_limited'}` — consumer displays generic "tente novamente em alguns minutos" (no count disclosure). Supabase's per-IP limit remains last line of defense. Upstash credentials via consumer env (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). |
| Brute-force lockout | Rate limit above + Supabase defaults (`5 attempts / 15 min / IP`). Account-level lockout is explicitly out of scope — raises false-positive support load and is better addressed at gateway layer. |
| Timing attacks on email enumeration | Generic error message `errorInvalidCredentials` — same response and shape for bad password and unknown email. Supabase already normalizes response time; our action adds no early-exit branches before the Supabase call. |
| IP parsing | `x-forwarded-for` may contain a chain; only the **leftmost** entry is trusted (closest to client). Vercel strips spoofed upstream hops. Self-hosted consumers must set `trustProxyHops` correctly or the IP field becomes attacker-controlled. Documented in README. |
| Password-reset session invalidation | `supabase.auth.updateUser({password})` revokes all refresh tokens server-side. Other devices log out on next request. No extra action required. |
| Double-submit | Components use React `useTransition`; submit button is `disabled` while `isPending`. Second submission is a no-op until server responds. |
| Supabase client key boundary | Login actions create a **user-scoped** Supabase client via `@supabase/ssr` (`createServerClient` with anon key + cookies). Never service-role key — that would bypass RLS on any downstream query and constitute privilege escalation. |
| Cross-area `next` abuse | `safeRedirect(url, fallback)` accepts any same-origin relative path. If login at `/cms/login?next=/admin` succeeds for a staff user who lacks `admin` role, they bounce to `/admin`, get rejected by `requireArea`, land at `/?error=insufficient_access`. Not a security breach (same session, same user) but poor UX. Mitigation shipped alongside: `safeRedirect(url, fallback, {areaPrefix: '/cms'})` — rejects paths outside the area prefix. Login components pass `areaPrefix` matching their own area; attacker-crafted cross-area `next` falls back to the area's landing page. |
| Reset-token hash persistence | Client strips the recovery hash via `history.replaceState` after `setSession`, so it doesn't leak through Referer headers. Back-button navigation can restore the old hashed URL from history — Supabase tokens are one-time-use and 1h-TTL, so the practical exposure window is narrow. No additional mitigation required. |
| MFA readiness | Out of scope for this split; Supabase GA AAL2 factors (TOTP, WebAuthn) plug into the existing `signInWithPassword` flow via the challenge/verify round-trip. Future bump of `@tn-figueiredo/auth-nextjs/actions` will add `signInWithPasswordMFA(input, { factor })` without breaking 2.1.0. Documented here so plans don't accidentally close that door. |

### Middleware changes

Single `apps/web/src/middleware.ts` dispatches two `createAuthMiddleware` instances based on path prefix:

```typescript
const adminAuth = createAuthMiddleware({
  publicRoutes: [/^\/admin\/login$/, /^\/admin\/forgot$/, /^\/admin\/reset/],
  protectedRoutes: [/^\/admin(\/.*)?$/],
  signInPath: '/admin/login',
  env,
})
const cmsAuth = createAuthMiddleware({
  publicRoutes: [/^\/cms\/login$/, /^\/cms\/forgot$/, /^\/cms\/reset/],
  protectedRoutes: [/^\/cms(\/.*)?$/],
  signInPath: '/cms/login',
  env,
})

// In exported middleware function:
if (pathname.startsWith('/admin')) return adminAuth(request)
if (pathname.startsWith('/cms')) return cmsAuth(request)
// ...fallthrough to existing site-resolution logic
```

`createAuthMiddleware` in `@tn-figueiredo/auth-nextjs` requires **no API changes** — we just instantiate it twice.

**i18n routing compat:** consumers using `next-intl` with locale prefixes (`/pt-BR/admin/login`) must pass locale-aware regexes. `@tn-figueiredo/auth-nextjs@2.1.0` exports `buildAuthRegex(prefix, { locales })` helper:

```typescript
import { buildAuthRegex } from '@tn-figueiredo/auth-nextjs/middleware'
const adminLoginRegex = buildAuthRegex('/admin/login', { locales: ['pt-BR', 'en'] })
// → /^(?:\/(?:pt-BR|en))?\/admin\/login\/?$/
```

### Area authorization (RBAC) — middleware vs. layout

Middleware only verifies **authentication** (valid Supabase session cookie present). Role-based **authorization** is enforced at layout level:

- `/admin/layout.tsx` → `await requireUser()` then `await requireArea('admin')`. Non-admin authed user → `redirect('/?error=insufficient_access')` (NOT back to `/admin/login` — that creates a loop since middleware sees a valid cookie and lets them in, then layout rejects, then login page sees they're authed and redirects to `/admin`…).
- `/cms/layout.tsx` → `await requireUser()` then `await requireArea('cms')`. Non-staff authed user → same `/?error=insufficient_access`.

**Why split middleware (auth) and layout (role):** the Next.js Edge runtime where middleware runs can't reliably hit Supabase DB for role lookup without blowing cold-start budgets. JWT-embedded `app_metadata.role` *could* be checked on Edge, but trusting the JWT claim alone is weaker than hitting `is_staff()` / `is_admin()` server-side on the Node runtime that layouts use. We pay the cookie check on Edge (fast), then the authoritative role check on Node (correct).

`requireArea(area: 'admin' | 'cms')` is a new helper in `@tn-figueiredo/auth-nextjs/server` (2.1.0). Named `requireArea` (not `requireRole`) because the package already exports a different `requireRole({resolver})` helper — the two coexist. Implementation commits:

- Calls `createServerClient()` (cookie-scoped; anon key).
- Reads `auth.getUser()` — Supabase round-trip, not `getSession()` (which trusts the cached JWT claim).
- Invokes `rpc('is_staff')` or `rpc('is_admin')` **server-side on every layout render**. Never trusts `app_metadata.role` JWT claim alone: claims are cached in the JWT until the next refresh (up to ~1h) and lag behind membership revocations. Honoring a stale claim is a role-escalation vector during demotion.
- Memoized per request via React `cache()` so rendering multiple server components under the same layout doesn't fan out the RPC.
- Returns `void` on success; calls `redirect('/?error=insufficient_access')` on rejection — the caller never sees the return.

Cost: one Supabase round-trip per layout render (≈50ms p50 on the same region). Acceptable for authenticated routes.

### Consumer integration (apps/web)

```
apps/web/src/app/
├── admin/
│   ├── layout.tsx          MODIFIED — requireUser + requireArea('admin')
│   ├── login/
│   │   ├── page.tsx        NEW — mounts <AdminLogin>
│   │   └── actions.ts      NEW — re-exports from @tn-figueiredo/auth-nextjs/actions
│   ├── forgot/
│   │   ├── page.tsx        NEW — mounts <AdminForgotPassword>
│   │   └── actions.ts      NEW — re-exports forgotPassword action
│   ├── reset/
│   │   ├── page.tsx        NEW — mounts <AdminResetPassword>
│   │   └── actions.ts      NEW — re-exports resetPassword action
│   └── logout/
│       └── route.ts        NEW — POST handler → signOutAction → /admin/login
├── cms/
│   ├── layout.tsx          MODIFIED — requireUser + requireArea('cms')
│   ├── login/{page,actions}.tsx      NEW
│   ├── forgot/{page,actions}.tsx     NEW
│   ├── reset/{page,actions}.tsx      NEW
│   └── logout/route.ts               NEW
├── signin/                 DELETED — entire directory removed
├── middleware.ts           MODIFIED — two authMiddleware instances
└── page.tsx                MODIFIED — reads ?error=insufficient_access flash

Deleted test files (tied to /signin):
- apps/web/test/app/signin.test.tsx
- apps/web/test/app/forgot-reset.test.tsx

New test files replace them per-area (see Testing strategy).
```

Why re-export actions per area: Next's `"use server"` file boundary requires the action implementation AND the re-export file to both be `"use server"` modules. The package source file in `@tn-figueiredo/auth-nextjs/src/actions.ts` starts with `'use server'`. Consumer `actions.ts` does:
```typescript
'use server'
export { signInWithPassword, signInWithGoogle } from '@tn-figueiredo/auth-nextjs/actions'
```
Both sides satisfy Next's boundary; the logic stays canonical in the package. Each area's `actions.ts` only re-exports what that area's page uses (login page re-exports sign-in actions; forgot page re-exports `forgotPassword`; reset page re-exports `resetPassword`).

### Data flow

**Password sign-in:**
1. Unauth user → `/cms/campaigns` → `cmsAuth` middleware → redirect `307 /cms/login?next=/cms/campaigns`.
2. `/cms/login` page.tsx → renders `<CmsLogin actions={...} />`.
3. User fills form → `<CmsLogin/>` calls `actions.signInWithPassword({email, password, turnstileToken})`.
4. Server action → rate-limit check → Supabase `auth.signInWithPassword()` → audit log (fire-and-forget) → returns `ActionResult`.
5. On `{ok: true}`, component reads `next` from URL, runs `safeRedirect(next, '/cms')`, calls `router.push(safePath)`.
6. Middleware sees authed user → lets through; `/cms/layout.tsx` validates role → renders.

Identical flow on admin side, different components.

**Password reset (token-in-hash nuance):**

Supabase's password-recovery email carries `access_token` + `refresh_token` in the **URL fragment** (`#access_token=…&refresh_token=…&type=recovery`), not the query string. Server code never sees the fragment — browsers strip it before send. Flow:

1. User on `/cms/login` clicks "Esqueci minha senha" → `/cms/forgot` page.
2. User submits email → `forgotPassword` action → Supabase sends recovery email with link to `{appUrl}/cms/reset#access_token=…&refresh_token=…&type=recovery`.
3. User clicks email link → `/cms/reset` page loads (client component).
4. `useEffect` on mount reads `window.location.hash`, parses tokens, calls `supabase.auth.setSession({access_token, refresh_token})` via `createBrowserClient()`. Hash is then stripped from URL (`history.replaceState`) so it doesn't leak via Referer.
5. Session cookie is now set. Component renders password-entry form.
6. User submits new password → `resetPassword` server action → `supabase.auth.updateUser({password})` uses the cookie session → Supabase revokes all other refresh tokens → returns `ActionResult`.
7. On success, redirect to `/cms/login?reset=success` (user signs in with new password).

The `<CmsResetPassword>` component owns the client-side hash reading; the server action is a thin wrapper around `updateUser`. Components ship with a fallback state: if hash is missing/malformed, render "Link expirado ou inválido. Solicite novo link." with a CTA back to `/cms/forgot`.

### Logout flow

`signOutAction` in `@tn-figueiredo/auth-nextjs/actions` — single action, shared Supabase cookie.

Consumer routes:
- `apps/web/src/app/admin/logout/route.ts` — POST handler → `await signOutAction()` → `redirect('/admin/login')`.
- `apps/web/src/app/cms/logout/route.ts` — POST handler → `await signOutAction()` → `redirect('/cms/login')`.

Layouts render logout as a **form POST** (not a GET link) to defeat CSRF image-tag logout attacks. Triggered from each area's header menu.

Cross-area side effect: signing out of one area kills the cookie, logging the user out of the other. This is intentional — it's the same Supabase session; per-area independent sessions would require separate Supabase projects, which is not the architecture.

### Supabase project configuration (out-of-code, required)

Not everything runs as code — the Supabase Dashboard must be configured once per environment. Tracked in a consumer-side checklist (README of each consumer):

- **Redirect URL allowlist** (Auth → URL Configuration): add for each env (local/preview/prod):
  - `{APP_URL}/admin/auth/callback`
  - `{APP_URL}/cms/auth/callback`
  - `{APP_URL}/admin/reset`
  - `{APP_URL}/cms/reset`
- **Password recovery email template** (Auth → Email Templates → Reset Password): Supabase supports only ONE template per project, so per-area reset links can't diverge at the email layer. Strategies, in descending preference:
  1. Template links to `{{ .SiteURL }}/auth/reset#access_token={{ .Token }}&refresh_token={{ .RefreshToken }}&type=recovery` — a neutral shared reset page that reads the user's org membership and redirects to `/admin/reset` or `/cms/reset` based on role.
  2. Alternative: use `redirectTo` parameter on `supabase.auth.resetPasswordForEmail(email, { redirectTo })` from within `forgotPassword` action — this overrides the template link per call. `forgotPassword` action SHOULD pass `{appUrl}/cms/reset` or `/admin/reset` based on the `area` field of its input.
- **Email locale:** Supabase's recovery email uses the project-level locale setting, not the user's request locale. Multi-locale consumers must live with one-locale recovery emails or maintain their own transactional email pipeline. Documented as a known limitation.
- **Site URL** (Auth → General): set to the production domain for correct default links (affects magic-link / signup confirmation templates too).

### Testing strategy

| Level | Scope | Tool |
|---|---|---|
| Unit | Components render, props applied correctly, form validation, error display, a11y snapshot | Vitest + @testing-library/react + axe-core |
| Integration | Mock actions → simulate submit → assert navigation call | Vitest + happy-dom |
| Integration (consumer) | `apps/web` mounts `<AdminLogin>` and `<CmsLogin>` pages render with real actions wired up | Vitest |
| Cross-area RLS (DB-gated) | See enumerated matrix below. Uses existing `describe.skipIf(skipIfNoLocalDb())`. | Vitest + local Supabase |

**Cross-area RLS test matrix (DB-gated, `apps/web/test/integration/area-authorization.test.ts`):**

| # | Seed role | Area probed | Expected result |
|---|---|---|---|
| 1 | `author` in org X | GET `/admin` via server component | layout `requireArea` redirect → `/?error=insufficient_access` |
| 2 | `author` in org X | GET `/cms` via server component | layout `requireArea` redirect → `/?error=insufficient_access` (author is not staff) |
| 3 | `editor` in org X | GET `/cms` | renders (200) |
| 4 | `editor` in org X | GET `/admin` | redirect → `/?error=insufficient_access` |
| 5 | `admin` in org X | GET `/admin` and `/cms` | both render |
| 6 | `super_admin` (master ring) | GET child-ring's `/cms` | renders (cascade-up via `can_admin_site`) |
| 7 | Anon (no session) | GET `/admin` | middleware redirect → `/admin/login?next=/admin` |
| 8 | Anon | GET `/cms/campaigns` | middleware redirect → `/cms/login?next=/cms/campaigns` |
| 9 | Authed but cookie expired mid-request | GET `/admin` | middleware re-checks session, redirect → `/admin/login` (no silent 500) |
| 10 | Editor of org X with deleted membership row | GET `/cms` | `requireArea` re-queries DB on every layout render → redirect (stale JWT claim does not bypass) |
| A11y | Zero axe violations on all six new components at default props and with custom theme | vitest-axe |

### Versioning and rollback

| Package | From | To | Reason |
|---|---|---|---|
| `@tn-figueiredo/auth-nextjs` | 2.0.0 | 2.1.0 | New `/actions` + `/safe-redirect` subpaths. No breaking change. |
| `@tn-figueiredo/admin` | 0.4.2 | 0.5.0 | New `/login` subpath. Main `/` export unchanged. |
| `@tn-figueiredo/cms` | 0.1.0-beta.2 | 0.1.0-beta.3 | New `/login` subpath. Rest unchanged. |

**Rollback:** if a deploy regresses, consumer reverts version pin in `apps/web/package.json` to previous exact versions. GitHub Packages retains all published versions (publish.yml is idempotent; never deletes). Zero-cost rollback.

**Tonagarantia migration:** opt-in. Tonagarantia's existing `/admin/login` and `/parceiros/login` keep working unchanged — they don't consume the packages today. When ready to adopt, they swap page.tsx to render `<AdminLogin>` with their theme props. Documented in `@tn-figueiredo/admin` README with side-by-side example.

## Implementation order

1. **auth-nextjs 2.1.0** — promote actions + safeRedirect. Ship independently; no consumer change required.
2. **admin 0.5.0** — build `<AdminLogin>` + siblings with neutral defaults (MINOR bump from actual 0.4.2; original spec draft said 0.4.0 before ecosystem catalog was re-checked).
3. **cms 0.1.0-beta.3** — build `<CmsLogin>` + siblings (mirror structure).
4. **bythiagofigueiredo consumer wiring** — replace `/signin` with `/admin/login` + `/cms/login`, update middleware, delete old routes/tests.

Each step self-contained and deployable. If step 4 breaks prod, steps 1-3 don't need revert.

### Plan amendments required by this review

The 2026-04-16 round-2 review introduced surface area the original plans don't cover. Before execution, amend:

- **Phase 1 plan** (`2026-04-15-auth-nextjs-2.1-actions.md`): add `signOutAction` in `/actions`; add `buildAuthRegex(prefix, { locales })` in `/middleware`; add `requireArea(roles)` in `/server` with the cache-memoized RPC-first implementation described above; add the area-scoped `safeRedirect` overload `safeRedirect(url, fallback, { areaPrefix })`.
- **Phase 2 plan** (`2026-04-15-admin-0.4-login.md`): replace `@axe-core/vitest` devDep with `vitest-axe@0.1.0` (already confirmed during Phase 3 execution — package doesn't exist on npm). Update test imports to `import { axe } from 'vitest-axe'` and `import { toHaveNoViolations } from 'vitest-axe/matchers'`. Retarget version bump in plan header from `0.4.0` → `0.5.0`.
- **Phase 3 plan** (`2026-04-15-cms-beta3-login.md`): already executed; outcome captured by the branch `feat/cms-beta3-login` (9 commits, 127 tests). Plan should be marked ✅ complete with a note that types were inlined temporarily and must be flipped to `@tn-figueiredo/auth-nextjs@>=2.1.0` imports by Phase 4.
- **Phase 4 plan** (`2026-04-15-web-consumer-login-wiring.md`): split the single `/auth/callback` into `/admin/auth/callback` + `/cms/auth/callback` for per-area redirect context (or add area detection in the shared callback via `next` param prefix); add `/admin/logout/route.ts` + `/cms/logout/route.ts`; add `?error=insufficient_access` flash reader to `apps/web/src/app/page.tsx`; flip `packages/cms` inlined types to `@tn-figueiredo/auth-nextjs` imports; add consumer checklist for Supabase Dashboard configuration (URL allowlist + recovery template).

## Open questions after approval

None — all three non-goal items (Playwright E2E, visual regression, migration codemod) explicitly deferred with rationale.

## Revision log

### 2026-04-16 — critical design review (87 → 99/100)

Reviewed by the executing author during Sprint 4c prep, after Phase 1 plan research surfaced findings that invalidated spec assumptions. Changes:

- **Audit SDK reality (−2 → +2):** `@tn-figueiredo/audit@0.1.0` ships only `PinoLogger` + rate limiters, no structured event-store API. Spec updated to document the actual log shape written via `PinoLogger` and the stdout → Vercel Log Drain sink. `@tn-figueiredo/audit@0.2.0` event API is tracked as future work.
- **RBAC gap (−4 → +4):** middleware-only auth check would let an `author` into `/admin` if authenticated. Added explicit "Area authorization" subsection: `requireArea()` at layout level, with the `insufficient_access` redirect breaking the would-be loop. `requireArea` promoted into `@tn-figueiredo/auth-nextjs/server`.
- **Reset password flow (−2 → +2):** previous description treated `resetPassword` as a symmetric server action; Supabase actually ships recovery tokens in the URL **fragment** (`#access_token=…`). Flow now documents client-side hash capture + `setSession` + server-action `updateUser`, plus the fallback UI when hash is missing/malformed.
- **Redirect loop authed-but-wrong-role (−2 → +2):** explicit `/?error=insufficient_access` flash — layouts redirect home, never back to login.
- **Shared `AuthPageProps` type location (−2 → +2):** declared in `@tn-figueiredo/auth-nextjs/actions`; admin and cms packages re-export but never redefine. Peer dep enforces.
- **CSP vs. XFO inconsistency (−1 → +1):** dropped `X-Frame-Options: DENY`, kept `Content-Security-Policy: frame-ancestors 'none'` as the single clickjacking control.
- **Polish adds (+3):** `Cache-Control: no-store`, `X-Robots-Tag: noindex`, CSRF note (Next 15 built-in origin check), logout flow, i18n locale-routing helper, IP-parsing trust-boundary note, Supabase client-key-boundary (never service role in login actions), double-submit via `useTransition`, session invalidation on password reset.

- **Cross-area RLS matrix (+1):** enumerated 10 concrete test cases covering author/editor/admin/super_admin × `/admin` × `/cms`, anon fallthroughs, expired cookies, and stale JWT claims after membership deletion. Replaces previous one-line "editor rejected on admin" description.

Net: **87 → 99** (self-reported after round 1).

### 2026-04-16 — round-2 deeper review (corrected 90 → 99)

Prompted to "review harder on the up-to-date version". The round-1 99/100 was honestly closer to **90/100** after a second read that checked for **internal consistency**, not just gap-filling. The round-2 findings were all gaps I introduced or failed to catch:

- **Non-goal #4 contradicted Security table (−2 → +2):** original non-goal said "rate limiting not in the package"; Security row now ships `UpstashRateLimiter` inside actions. Removed the non-goal, replaced with MFA-readiness as a more honest non-goal.
- **`@axe-core/vitest` referenced 3× (−1 → +1):** package doesn't exist on npm (Phase 3 discovered). Replaced all references with `vitest-axe@0.1.0` and documented the trap so plans don't regress.
- **Stale "admin 0.4.0" in Implementation order (−1 → +1):** versioning table said `0.4.2 → 0.5.0`; implementation order still said `0.4.0`. Aligned.
- **Spec claims not covered by Phase 1 plan (−2 → +2):** `buildAuthRegex`, `signOutAction`, `requireArea`, area-scoped `safeRedirect` overload — all added as spec surface but absent from the auth-nextjs 2.1.0 plan as originally written. Added explicit "Plan amendments required" section so the plan work doesn't get forgotten.
- **`requireArea` fuzzy implementation (−1 → +1):** "RPC or `app_metadata.role` — implementation decides" is weak; stale JWT claim can leak access for up to ~1h between refreshes. Committed to RPC-first via `rpc('is_staff')` / `rpc('is_admin')`, memoized per request with React `cache()`. Documented the ~50ms per-render cost as acceptable.
- **Supabase Dashboard config absent (−1 → +1):** spec described code-level flow but ignored the out-of-code config required on the Supabase project: redirect URL allowlist, single-template recovery mail constraint (workaround: neutral `/auth/reset` → role-based redirect), project-level locale limitation. Added dedicated subsection.
- **Cross-area `next` abuse (−1 → +1):** `safeRedirect` accepts `/admin/*` from a `/cms/login`, bouncing user through a rejected `requireArea`. Not a breach, but ugly. Added `areaPrefix` overload + documented the fallback path.

Net round-2: **90 → 99**.

### Remaining 1 point

`@tn-figueiredo/audit@0.2.0` structured event-store API has no concrete acceptance criteria yet. Current 0.1.0 ships `PinoLogger` + rate limiters (verified by inspecting `node_modules/@tn-figueiredo/audit/dist` — exports: `ILogger`, `IRateLimiter`, `IProfanityService`, `PinoLogger`, `InMemoryRateLimiter`, `UpstashRateLimiter`). JSON log lines via `PinoLogger` are a valid interim audit contract; downstream log drains (Vercel Log Drain, Grafana Loki, Datadog) already parse them. Closing the last point requires designing the event-store API (durable writes, query DSL, retention policy), which is legitimately out of scope for this login-split spec.

### Open question for the product owner (not a design gap)

Versioning of `@tn-figueiredo/cms`: the 2026-04-16 GH Packages listing shows only `0.1.0-beta.1` + `0.1.0-beta.2` published. Feedback "nem temos mais beta" suggests an intent to graduate to GA. Three paths:

1. **Stay on beta.3** (this spec's default): publish `0.1.0-beta.3` with the `/login` subpath, then cut `0.1.0` GA when the consumer wiring (Phase 4) lands in prod. Safest; explicit GA event.
2. **Graduate now:** skip beta.3 and publish `0.1.0` GA as part of this split. Semantically aggressive — ties GA to a specific feature rather than overall API stability assessment.
3. **Dual-track:** publish `0.1.0-beta.3` internally for Phase 4 integration, then tag GA `0.1.0` from the same commit once wired and tested.

Path 1 is recommended unless there's external pressure to drop the `-beta.` label now. Requires product-owner call before Phase 3 branch is pushed (currently unpushed at `feat/cms-beta3-login`).
