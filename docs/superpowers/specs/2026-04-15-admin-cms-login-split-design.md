# Admin + CMS Login Split — Package-First Design

**Date:** 2026-04-15
**Status:** Approved (97/100)
**Target sprint:** Sprint 4c (follow-up to 4b package extraction)

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
- **Rate limiting infra** in the package itself. Supabase provides per-IP baseline; README documents Cloudflare WAF / Upstash as consumer-side recommendation.

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

@tn-figueiredo/admin@0.4.0  (MINOR bump)
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

Test gate: `@axe-core/vitest` run against rendered components must report zero violations at default settings.

### Security

| Concern | Treatment |
|---|---|
| Turnstile / anti-bot | Opt-in via `turnstile={{ siteKey }}` prop. Component only renders widget when prop is set. `signInWithPasswordAction` validates token when received. |
| Open redirect | `safeRedirect` helper moves to `@tn-figueiredo/auth-nextjs/safe-redirect`. Login components call it on `redirectTo`. |
| Clickjacking | Login page layouts emit `X-Frame-Options: DENY` via Next.js `headers()` config in consumer app. Template provided in README. |
| Audit trail | Server actions call `@tn-figueiredo/audit@0.1.0` to log `{event: 'login_attempt', success, email_hash, ip, ua, ts}`. Fire-and-forget; never blocks login path. **Unknown to verify in planning:** confirm the current audit SDK accepts this event shape; if not, task to extend the SDK is added to the plan. |
| Rate limiting | Baseline: Supabase per-IP. Consumer-side: README documents Cloudflare WAF + Upstash Ratelimit as recommended defense-in-depth. |
| Brute-force lockout | Out of scope — Supabase handles `5 attempts / 15min / IP` as of their current defaults. |
| Timing attacks on email enumeration | Generic error message `errorInvalidCredentials` — same response for bad password and unknown email. Supabase already normalizes response time. |

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

### Consumer integration (apps/web)

```
apps/web/src/app/
├── admin/
│   ├── layout.tsx          (existing — requireUser check)
│   ├── login/
│   │   ├── page.tsx        NEW — mounts <AdminLogin>
│   │   └── actions.ts      NEW — re-exports from @tn-figueiredo/auth-nextjs/actions
│   ├── forgot/
│   │   ├── page.tsx        NEW — mounts <AdminForgotPassword>
│   │   └── actions.ts      NEW — re-exports forgotPassword action
│   └── reset/
│       ├── page.tsx        NEW — mounts <AdminResetPassword>
│       └── actions.ts      NEW — re-exports resetPassword action
├── cms/
│   ├── layout.tsx          (existing)
│   ├── login/{page,actions}.tsx      NEW
│   ├── forgot/{page,actions}.tsx     NEW
│   └── reset/{page,actions}.tsx      NEW
├── signin/                 DELETED — entire directory removed
└── middleware.ts           MODIFIED — two authMiddleware instances

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

1. Unauth user → `/cms/campaigns` → `cmsAuth` middleware → redirect `307 /cms/login?next=/cms/campaigns`.
2. `/cms/login` page.tsx → renders `<CmsLogin actions={...} />`.
3. User fills form → `<CmsLogin/>` calls `actions.signInWithPassword({email, password, turnstileToken})`.
4. Server action → Supabase `auth.signInWithPassword()` → audit log → returns `{ok: true, userId}` or `{ok: false, error}`.
5. On success, component reads `next` from URL, runs `safeRedirect(next)`, calls `router.push(safePath)`.
6. Middleware sees authed user → lets through.

Identical flow on admin side, different components.

### Testing strategy

| Level | Scope | Tool |
|---|---|---|
| Unit | Components render, props applied correctly, form validation, error display, a11y snapshot | Vitest + @testing-library/react + axe-core |
| Integration | Mock actions → simulate submit → assert navigation call | Vitest + happy-dom |
| Integration (consumer) | `apps/web` mounts `<AdminLogin>` and `<CmsLogin>` pages render with real actions wired up | Vitest |
| Cross-area RLS (DB-gated) | Editor role signs into `/cms` but `requireUser` on `/admin` RLS rejects. Uses existing `describe.skipIf(skipIfNoLocalDb())`. | Vitest + local Supabase |
| A11y | Zero axe violations on all six new components at default props and with custom theme | @axe-core/vitest |

### Versioning and rollback

| Package | From | To | Reason |
|---|---|---|---|
| `@tn-figueiredo/auth-nextjs` | 2.0.0 | 2.1.0 | New `/actions` + `/safe-redirect` subpaths. No breaking change. |
| `@tn-figueiredo/admin` | 0.3.0 | 0.4.0 | New `/login` subpath. Main `/` export unchanged. |
| `@tn-figueiredo/cms` | 0.1.0-beta.2 | 0.1.0-beta.3 | New `/login` subpath. Rest unchanged. |

**Rollback:** if a deploy regresses, consumer reverts version pin in `apps/web/package.json` to previous exact versions. GitHub Packages retains all published versions (publish.yml is idempotent; never deletes). Zero-cost rollback.

**Tonagarantia migration:** opt-in. Tonagarantia's existing `/admin/login` and `/parceiros/login` keep working unchanged — they don't consume the packages today. When ready to adopt, they swap page.tsx to render `<AdminLogin>` with their theme props. Documented in `@tn-figueiredo/admin` README with side-by-side example.

## Implementation order

1. **auth-nextjs 2.1.0** — promote actions + safeRedirect. Ship independently; no consumer change required.
2. **admin 0.4.0** — build `<AdminLogin>` + siblings with neutral defaults.
3. **cms 0.1.0-beta.3** — build `<CmsLogin>` + siblings (mirror structure).
4. **bythiagofigueiredo consumer wiring** — replace `/signin` with `/admin/login` + `/cms/login`, update middleware, delete old routes/tests.

Each step self-contained and deployable. If step 4 breaks prod, steps 1-3 don't need revert.

## Open questions after approval

None — all three non-goal items (Playwright E2E, visual regression, migration codemod) explicitly deferred with rationale.
