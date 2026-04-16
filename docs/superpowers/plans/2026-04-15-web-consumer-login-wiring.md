# Phase 4 — bythiagofigueiredo Consumer Login Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `/signin` route with per-area `/admin/login` + `/cms/login` (plus forgot/reset siblings), update middleware to dispatch two `createAuthMiddleware` instances, remove the now-redundant `/signin` directory and its tests, and wire up the `X-Frame-Options: DENY` header on all login pages.

**Depends on (execute AFTER):**
- Phase 1: `@tn-figueiredo/auth-nextjs@2.1.0` published (adds `/actions` + `/safe-redirect` subpaths).
- Phase 2: `@tn-figueiredo/admin@0.4.0` published (adds `/login` subpath with `<AdminLogin>`, `<AdminForgotPassword>`, `<AdminResetPassword>`).
- Phase 3: `@tn-figueiredo/cms@0.1.0-beta.3` published (adds `/login` subpath with `<CmsLogin>`, `<CmsForgotPassword>`, `<CmsResetPassword>`).

**Rollback note:** This plan's execution spans several commits. If a deploy regresses after the final commit, revert `apps/web/package.json` to the prior exact version pins and `git revert` the commit that deleted `apps/web/src/app/signin/`. GitHub Packages retains all published versions; the old binaries are always available. No rollback touch needed on packages 1-3.

**Branch:** `feat/sprint-4b-package-extraction` (already checked out).

---

## File inventory

Files **created** by this plan:

```
apps/web/src/app/admin/login/page.tsx
apps/web/src/app/admin/login/actions.ts
apps/web/src/app/admin/forgot/page.tsx
apps/web/src/app/admin/forgot/actions.ts
apps/web/src/app/admin/reset/page.tsx
apps/web/src/app/admin/reset/actions.ts
apps/web/src/app/cms/login/page.tsx
apps/web/src/app/cms/login/actions.ts
apps/web/src/app/cms/forgot/page.tsx
apps/web/src/app/cms/forgot/actions.ts
apps/web/src/app/cms/reset/page.tsx
apps/web/src/app/cms/reset/actions.ts
apps/web/test/app/admin-login.test.tsx
apps/web/test/app/cms-login.test.tsx
```

Files **modified** by this plan:

```
apps/web/package.json                            (pin bumps)
apps/web/src/middleware.ts                       (two createAuthMiddleware instances)
apps/web/test/middleware.test.ts                 (per-area redirect expectations)
apps/web/src/app/auth/callback/route.ts          (safe-redirect import source + error redirects)
apps/web/src/app/signup/invite/[token]/page.tsx  (/signin → /admin/login redirect)
apps/web/next.config.ts                          (X-Frame-Options DENY on login paths)
```

Files **deleted** by this plan:

```
apps/web/src/app/signin/                         (entire directory)
apps/web/test/app/signin.test.tsx
apps/web/test/app/forgot-reset.test.tsx
```

---

## Tasks

### T1 — Bump package pins in `apps/web/package.json`

Update three `@tn-figueiredo/*` pins to the versions that carry the new `/login` subpaths. No `^` prefix — pre-commit hook enforces exact pins.

- [ ] Edit `apps/web/package.json`:

```json
// Before
"@tn-figueiredo/admin": "0.3.0",
"@tn-figueiredo/auth-nextjs": "2.0.0",
"@tn-figueiredo/cms": "0.1.0-beta.2",

// After
"@tn-figueiredo/admin": "0.4.0",
"@tn-figueiredo/auth-nextjs": "2.1.0",
"@tn-figueiredo/cms": "0.1.0-beta.3",
```

- [ ] Run install and verify resolution:

```bash
npm install --workspace=apps/web
# Expected: no errors; lock file updated with new sha sums.
```

- [ ] Run typecheck to catch any removed-symbol breakage early:

```bash
npm run typecheck --workspace=apps/web
# Expected: exits 0 (new packages are additive; no breaking changes per spec).
```

- [ ] Commit:

```
chore(sprint-4c): bump auth-nextjs@2.1.0 admin@0.4.0 cms@0.1.0-beta.3
```

---

### T2 — Update middleware tests for per-area redirects (TDD first)

Update `apps/web/test/middleware.test.ts` to assert that `/admin` redirects to `/admin/login` and `/cms` redirects to `/cms/login`. The current test asserts `/signin` — that will fail after T4; update expectations now so the test is the gate that drives T4.

- [ ] Edit `apps/web/test/middleware.test.ts`, replacing the two existing test cases and adding a new admin one:

```typescript
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const LOCAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
})
afterAll(() => {
  vi.unstubAllEnvs()
})

async function loadMiddleware() {
  const mod = await import('../src/middleware')
  return mod.default
}

function makeReq(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3001${path}`), {
    headers: new Headers({ host: 'localhost:3001' }),
  })
}

describe('middleware', () => {
  it('redirects unauthenticated request to /cms → /cms/login', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/cms'))
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/cms\/login/)
  })

  it('redirects unauthenticated request to /admin → /admin/login', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/admin'))
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/admin\/login/)
  })

  it('lets anonymous GET / through', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/'))
    expect([200, 404, undefined]).toContain(res.status)
  })
})
```

- [ ] Run the middleware test to confirm it now **fails** (expected — middleware still points to `/signin`):

```bash
npm run test --workspace=apps/web -- --reporter=verbose middleware.test
# Expected: 2 failing assertions on /cms/login and /admin/login — this is intentional.
```

- [ ] Commit (failing test is intentional TDD gate):

```
test(sprint-4c): update middleware expectations to per-area login paths
```

---

### T3 — Add `/admin/login`, `/admin/forgot`, `/admin/reset` pages and actions

Create the three admin auth routes. Each route is a thin `'use client'` page that mounts the component from `@tn-figueiredo/admin/login`, paired with a `'use server'` actions file that re-exports from `@tn-figueiredo/auth-nextjs/actions`.

- [ ] Create `apps/web/src/app/admin/login/actions.ts`:

```typescript
'use server'
export { signInWithPassword, signInWithGoogle } from '@tn-figueiredo/auth-nextjs/actions'
```

- [ ] Create `apps/web/src/app/admin/login/page.tsx`:

```tsx
'use client'
import { AdminLogin } from '@tn-figueiredo/admin/login'
import { signInWithPassword, signInWithGoogle } from './actions'

export default function Page() {
  return (
    <AdminLogin
      actions={{ signInWithPassword, signInWithGoogle }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
    />
  )
}
```

- [ ] Create `apps/web/src/app/admin/forgot/actions.ts`:

```typescript
'use server'
export { forgotPassword } from '@tn-figueiredo/auth-nextjs/actions'
```

- [ ] Create `apps/web/src/app/admin/forgot/page.tsx`:

```tsx
'use client'
import { AdminForgotPassword } from '@tn-figueiredo/admin/login'
import { forgotPassword } from './actions'

export default function Page() {
  return (
    <AdminForgotPassword
      actions={{ forgotPassword }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
      loginHref="/admin/login"
    />
  )
}
```

- [ ] Create `apps/web/src/app/admin/reset/actions.ts`:

```typescript
'use server'
export { resetPassword } from '@tn-figueiredo/auth-nextjs/actions'
```

- [ ] Create `apps/web/src/app/admin/reset/page.tsx`:

```tsx
'use client'
import { AdminResetPassword } from '@tn-figueiredo/admin/login'
import { resetPassword } from './actions'

export default function Page() {
  return (
    <AdminResetPassword
      actions={{ resetPassword }}
      successHref="/admin"
    />
  )
}
```

- [ ] Run tests to verify the rest of the suite still passes (new pages have no test yet — that is fine at this step):

```bash
npm run test --workspace=apps/web
# Expected: all tests pass EXCEPT the 2 middleware.test assertions updated in T2 (still failing — intentional).
```

- [ ] Commit:

```
feat(sprint-4c): add /admin/login, /admin/forgot, /admin/reset pages + actions
```

---

### T4 — Add `/cms/login`, `/cms/forgot`, `/cms/reset` pages and actions

Mirror of T3 for the CMS area.

- [ ] Create `apps/web/src/app/cms/login/actions.ts`:

```typescript
'use server'
export { signInWithPassword, signInWithGoogle } from '@tn-figueiredo/auth-nextjs/actions'
```

- [ ] Create `apps/web/src/app/cms/login/page.tsx`:

```tsx
'use client'
import { CmsLogin } from '@tn-figueiredo/cms/login'
import { signInWithPassword, signInWithGoogle } from './actions'

export default function Page() {
  return (
    <CmsLogin
      actions={{ signInWithPassword, signInWithGoogle }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
    />
  )
}
```

- [ ] Create `apps/web/src/app/cms/forgot/actions.ts`:

```typescript
'use server'
export { forgotPassword } from '@tn-figueiredo/auth-nextjs/actions'
```

- [ ] Create `apps/web/src/app/cms/forgot/page.tsx`:

```tsx
'use client'
import { CmsForgotPassword } from '@tn-figueiredo/cms/login'
import { forgotPassword } from './actions'

export default function Page() {
  return (
    <CmsForgotPassword
      actions={{ forgotPassword }}
      turnstile={
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
          ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
          : undefined
      }
      loginHref="/cms/login"
    />
  )
}
```

- [ ] Create `apps/web/src/app/cms/reset/actions.ts`:

```typescript
'use server'
export { resetPassword } from '@tn-figueiredo/auth-nextjs/actions'
```

- [ ] Create `apps/web/src/app/cms/reset/page.tsx`:

```tsx
'use client'
import { CmsResetPassword } from '@tn-figueiredo/cms/login'
import { resetPassword } from './actions'

export default function Page() {
  return (
    <CmsResetPassword
      actions={{ resetPassword }}
      successHref="/cms"
    />
  )
}
```

- [ ] Run tests to verify no regression:

```bash
npm run test --workspace=apps/web
# Expected: same pass/fail as after T3.
```

- [ ] Commit:

```
feat(sprint-4c): add /cms/login, /cms/forgot, /cms/reset pages + actions
```

---

### T5 — Update middleware to dispatch per-area auth instances

Replace the single `authMiddleware` with two instances: `adminAuth` (signInPath `/admin/login`) and `cmsAuth` (signInPath `/cms/login`). Remove `/signin` from the public routes list.

- [ ] Edit `apps/web/src/middleware.ts` — replace the entire file content:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'
import { SupabaseRingContext } from '@tn-figueiredo/cms/ring'
import { getSupabaseServiceClient } from '../lib/supabase/service'

/**
 * Middleware responsibilities:
 * 1. Subdomain rewrite: dev.bythiagofigueiredo.com → /dev internally
 * 2. Auth gating: /admin protected by adminAuth (signInPath /admin/login)
 *                 /cms protected by cmsAuth (signInPath /cms/login)
 * 3. Site resolution: hostname → site_id/org_id/default_locale for public routes
 */

const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}

const adminAuth = createAuthMiddleware({
  publicRoutes: [
    /^\/admin\/login$/,
    /^\/admin\/forgot$/,
    /^\/admin\/reset/,
    /^\/auth\/callback$/,
    /^\/api\//,
    /^\/_next\//,
  ],
  protectedRoutes: [/^\/admin(\/.*)?$/],
  signInPath: '/admin/login',
  env,
})

const cmsAuth = createAuthMiddleware({
  publicRoutes: [
    /^\/cms\/login$/,
    /^\/cms\/forgot$/,
    /^\/cms\/reset/,
    /^\/auth\/callback$/,
    /^\/api\//,
    /^\/_next\//,
  ],
  protectedRoutes: [/^\/cms(\/.*)?$/],
  signInPath: '/cms/login',
  env,
})

export default async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const host = request.headers.get('host') ?? request.nextUrl.host ?? ''
  const hostname = host.split(':')[0] ?? ''
  const url = request.nextUrl.clone()
  const { pathname } = request.nextUrl

  // Dev subdomain rewrite (unchanged from Sprint 1a)
  const isDevSubdomain =
    hostname === 'dev.bythiagofigueiredo.com' ||
    hostname === 'dev.localhost'
  if (isDevSubdomain && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Auth gating — dispatch to area-specific instance
  if (pathname.startsWith('/admin')) return adminAuth(request)
  if (pathname.startsWith('/cms')) return cmsAuth(request)

  // Site resolution for public routes (Sprint 2).
  const res = NextResponse.next()
  try {
    const ring = new SupabaseRingContext(getSupabaseServiceClient())
    const site = await ring.getSiteByDomain(hostname)
    if (site) {
      res.headers.set('x-site-id', site.id)
      res.headers.set('x-org-id', site.org_id)
      res.headers.set('x-default-locale', site.default_locale)
    }
  } catch {
    // Resolution failed (DB down, service-role env missing in edge context).
    // Leave headers unset — server components will throw via getSiteContext().
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] Run the middleware tests — they should now **pass** (the T2 failing assertions become green):

```bash
npm run test --workspace=apps/web -- --reporter=verbose middleware.test
# Expected: 3/3 passing — "/cms/login", "/admin/login", and "/" assertions all green.
```

- [ ] Run the full web test suite:

```bash
npm run test --workspace=apps/web
# Expected: all tests pass (signin.test and forgot-reset.test still pass because /signin still exists).
```

- [ ] Commit:

```
feat(sprint-4c): dispatch per-area auth middleware for /admin and /cms
```

---

### T6 — Add `X-Frame-Options: DENY` on login pages via `next.config.ts`

The spec's Security section requires login pages to emit `X-Frame-Options: DENY` to prevent clickjacking. Implement via Next.js `headers()` config — no per-layout changes needed.

- [ ] Locate `apps/web/next.config.ts` and add a `headers` export inside the config. The pattern matches all six login/forgot/reset paths for both areas. Add the block inside the existing `withSentryConfig` wrapper without disturbing `transpilePackages` or any existing keys.

The new `headers` entry to add inside the Next.js config object (alongside `transpilePackages`):

```typescript
async headers() {
  const loginPaths = [
    '/admin/login',
    '/admin/forgot',
    '/admin/reset',
    '/cms/login',
    '/cms/forgot',
    '/cms/reset',
  ]
  return loginPaths.map((source) => ({
    source,
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ],
  }))
},
```

Both `X-Frame-Options: DENY` (legacy browsers) and `CSP frame-ancestors 'none'` (modern browsers) are set for defense in depth, matching the spec's Security section.

- [ ] Run typecheck:

```bash
npm run typecheck --workspace=apps/web
# Expected: exits 0.
```

- [ ] Commit:

```
security(sprint-4c): add X-Frame-Options DENY + CSP frame-ancestors on login pages
```

---

### T7 — Update `auth/callback/route.ts` and `invite/[token]/page.tsx` — purge `/signin` references

Two files outside `/signin/` still reference `/signin`. Update them to point to the appropriate area-specific paths, and update the `safeRedirect` import to use the new package subpath (Phase 1 moves `safe-redirect` from `apps/web/src/lib/auth/safe-redirect.ts` to `@tn-figueiredo/auth-nextjs/safe-redirect`).

**Note:** `apps/web/src/lib/auth/safe-redirect.ts` does **not exist** as a standalone file — it was always local to the signin module (`apps/web/src/app/signin/page.tsx` and `apps/web/src/app/signin/actions.ts` import it as `'../../../lib/auth/safe-redirect'`). After Phase 1, the canonical implementation lives in `@tn-figueiredo/auth-nextjs/safe-redirect`. The only consumer outside `/signin/` is `apps/web/src/app/auth/callback/route.ts`.

- [ ] Edit `apps/web/src/app/auth/callback/route.ts`:

```typescript
// Line 5: change
import { safeRedirect } from '../../../../lib/auth/safe-redirect'
// to
import { safeRedirect } from '@tn-figueiredo/auth-nextjs/safe-redirect'

// Line 14: change fallback error redirect
return NextResponse.redirect(`${url.origin}/signin?error=oauth_no_code`)
// to (admin is the primary OAuth entry point; error surfaced on admin login page)
return NextResponse.redirect(`${url.origin}/admin/login?error=oauth_no_code`)

// Line 37: change
return NextResponse.redirect(`${url.origin}/signin?error=oauth_exchange_failed`)
// to
return NextResponse.redirect(`${url.origin}/admin/login?error=oauth_exchange_failed`)
```

Full file after edit:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { safeRedirect } from '@tn-figueiredo/auth-nextjs/safe-redirect'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // C1 / I8: sanitise `next` param to block open-redirect attacks
  const next = safeRedirect(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${url.origin}/admin/login?error=oauth_no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${url.origin}/admin/login?error=oauth_exchange_failed`)
  }

  return NextResponse.redirect(`${url.origin}${next}`)
}
```

- [ ] Edit `apps/web/src/app/signup/invite/[token]/page.tsx` line ~144 — the existing-user redirect that sends the user to `/signin`:

```typescript
// Before
redirect(
  `/signin?redirect=${encodeURIComponent(`/signup/invite/${token}`)}&hint=${encodeURIComponent(inv.email)}`,
)

// After — invite flow goes to admin login (invitees are org members, not CMS-only editors)
redirect(
  `/admin/login?redirect=${encodeURIComponent(`/signup/invite/${token}`)}&hint=${encodeURIComponent(inv.email)}`,
)
```

- [ ] Run typecheck + tests:

```bash
npm run typecheck --workspace=apps/web && npm run test --workspace=apps/web
# Expected: exits 0 on both. All tests still pass.
```

- [ ] Commit:

```
fix(sprint-4c): update auth/callback + invite redirect from /signin to /admin/login
```

---

### T8 — Add consumer integration tests for new login pages

Add two test files covering that the new pages render their respective package components and wire actions correctly. These are consumer-level render tests (not a re-test of the package internals).

- [ ] Create `apps/web/test/app/admin-login.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the package component — test only that the consumer wires it correctly
const mockAdminLogin = vi.fn((_props: unknown) => (
  <div data-testid="admin-login-component">AdminLogin mounted</div>
))
vi.mock('@tn-figueiredo/admin/login', () => ({
  AdminLogin: (props: unknown) => mockAdminLogin(props),
  AdminForgotPassword: (_props: unknown) => <div data-testid="admin-forgot-component">AdminForgotPassword mounted</div>,
  AdminResetPassword: (_props: unknown) => <div data-testid="admin-reset-component">AdminResetPassword mounted</div>,
}))

// Mock the actions re-exports (these are 'use server' — cannot run in vitest)
vi.mock('../../src/app/admin/login/actions', () => ({
  signInWithPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('../../src/app/admin/forgot/actions', () => ({
  forgotPassword: vi.fn(),
}))
vi.mock('../../src/app/admin/reset/actions', () => ({
  resetPassword: vi.fn(),
}))

import AdminLoginPage from '../../src/app/admin/login/page'
import AdminForgotPage from '../../src/app/admin/forgot/page'
import AdminResetPage from '../../src/app/admin/reset/page'

describe('admin login pages', () => {
  it('mounts <AdminLogin> with actions and optional turnstile prop', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-key'
    render(<AdminLoginPage />)
    expect(screen.getByTestId('admin-login-component')).toBeTruthy()
    const callProps = mockAdminLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps).toHaveProperty('actions')
    expect(callProps).toHaveProperty('turnstile')
    expect((callProps.turnstile as { siteKey: string }).siteKey).toBe('test-key')
  })

  it('passes undefined turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset', () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    mockAdminLogin.mockClear()
    render(<AdminLoginPage />)
    const callProps = mockAdminLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps.turnstile).toBeUndefined()
  })

  it('mounts <AdminForgotPassword>', () => {
    render(<AdminForgotPage />)
    expect(screen.getByTestId('admin-forgot-component')).toBeTruthy()
  })

  it('mounts <AdminResetPassword>', () => {
    render(<AdminResetPage />)
    expect(screen.getByTestId('admin-reset-component')).toBeTruthy()
  })
})
```

- [ ] Create `apps/web/test/app/cms-login.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockCmsLogin = vi.fn((_props: unknown) => (
  <div data-testid="cms-login-component">CmsLogin mounted</div>
))
vi.mock('@tn-figueiredo/cms/login', () => ({
  CmsLogin: (props: unknown) => mockCmsLogin(props),
  CmsForgotPassword: (_props: unknown) => <div data-testid="cms-forgot-component">CmsForgotPassword mounted</div>,
  CmsResetPassword: (_props: unknown) => <div data-testid="cms-reset-component">CmsResetPassword mounted</div>,
}))

vi.mock('../../src/app/cms/login/actions', () => ({
  signInWithPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('../../src/app/cms/forgot/actions', () => ({
  forgotPassword: vi.fn(),
}))
vi.mock('../../src/app/cms/reset/actions', () => ({
  resetPassword: vi.fn(),
}))

import CmsLoginPage from '../../src/app/cms/login/page'
import CmsForgotPage from '../../src/app/cms/forgot/page'
import CmsResetPage from '../../src/app/cms/reset/page'

describe('cms login pages', () => {
  it('mounts <CmsLogin> with actions and optional turnstile prop', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-key'
    render(<CmsLoginPage />)
    expect(screen.getByTestId('cms-login-component')).toBeTruthy()
    const callProps = mockCmsLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps).toHaveProperty('actions')
    expect(callProps).toHaveProperty('turnstile')
    expect((callProps.turnstile as { siteKey: string }).siteKey).toBe('test-key')
  })

  it('passes undefined turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset', () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    mockCmsLogin.mockClear()
    render(<CmsLoginPage />)
    const callProps = mockCmsLogin.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callProps.turnstile).toBeUndefined()
  })

  it('mounts <CmsForgotPassword>', () => {
    render(<CmsForgotPage />)
    expect(screen.getByTestId('cms-forgot-component')).toBeTruthy()
  })

  it('mounts <CmsResetPassword>', () => {
    render(<CmsResetPage />)
    expect(screen.getByTestId('cms-reset-component')).toBeTruthy()
  })
})
```

- [ ] Run full test suite:

```bash
npm run test --workspace=apps/web
# Expected: all tests pass including the 8 new consumer tests.
```

- [ ] Commit:

```
test(sprint-4c): add admin-login + cms-login consumer render tests
```

---

### T9 — Manual QA checkpoint (pre-delete verification)

Before deleting `/signin`, verify the new routes work end-to-end in a dev server. No code changes in this task.

- [ ] Start the dev server:

```bash
npm run dev --workspace=apps/web
# Expected: server starts on http://localhost:3001
```

- [ ] Verify the following manually (checklist):

  - [ ] `GET http://localhost:3001/admin` (unauthenticated) → browser redirects to `http://localhost:3001/admin/login?next=%2Fadmin` (or similar). HTTP status 307.
  - [ ] `GET http://localhost:3001/admin/login` → page renders `<AdminLogin>` component (slate-900 background from default theme or whatever the current dev build renders).
  - [ ] `GET http://localhost:3001/cms` (unauthenticated) → browser redirects to `http://localhost:3001/cms/login?next=%2Fcms`.
  - [ ] `GET http://localhost:3001/cms/login` → page renders `<CmsLogin>` component.
  - [ ] Successful login via email/password on `/admin/login` → redirects back to `/admin`.
  - [ ] Successful login via email/password on `/cms/login` → redirects back to `/cms`.
  - [ ] `GET http://localhost:3001/admin/login` response headers contain `X-Frame-Options: DENY`.
  - [ ] `GET http://localhost:3001/signin` → still works (not yet deleted — should render old page, confirming rollback path is intact).

- [ ] Stop dev server once QA is complete.

> **Gate:** Do NOT proceed to T10 until all items above are checked. If any item fails, fix it in a new commit on top of the current task before continuing.

---

### T10 — Delete `/signin` directory and related test files

Only execute after T9 QA is fully passing.

- [ ] Delete the entire `/signin` directory:

```bash
rm -rf apps/web/src/app/signin
# Expected: directory removed; no output.
```

- [ ] Delete the two test files that exclusively covered `/signin` routes:

```bash
rm apps/web/test/app/signin.test.tsx
rm apps/web/test/app/forgot-reset.test.tsx
# Expected: files removed; no output.
```

- [ ] Run the full test suite immediately to catch any broken import:

```bash
npm run test --workspace=apps/web
# Expected: all tests pass. signin.test and forgot-reset.test are gone; remaining tests unaffected.
```

- [ ] Run typecheck to catch any stray import:

```bash
npm run typecheck --workspace=apps/web
# Expected: exits 0.
```

- [ ] Commit:

```
chore(sprint-4c): delete /signin route + related tests (replaced by per-area login)
```

---

### T11 — Final full test run + typecheck + lint gate

- [ ] Run the full monorepo test suite:

```bash
npm test
# Expected: all tests pass across api + web.
# web suite: signin.test and forgot-reset.test gone; new admin-login + cms-login tests green; middleware tests green.
```

- [ ] Run typecheck across all workspaces:

```bash
npm run typecheck --workspace=apps/web && npm run typecheck --workspace=apps/api
# Expected: both exit 0.
```

- [ ] Run the CI pinning audit to verify no unpinned `@tn-figueiredo/*` sneaked in:

```bash
# The pre-commit hook runs this; to verify manually:
node -e "
const pkg = JSON.parse(require('fs').readFileSync('apps/web/package.json', 'utf8'));
const tnDeps = Object.entries({...pkg.dependencies, ...pkg.devDependencies})
  .filter(([k]) => k.startsWith('@tn-figueiredo/'));
const unpinned = tnDeps.filter(([, v]) => v.startsWith('^') || v.startsWith('~') || v === '*');
if (unpinned.length) { console.error('UNPINNED:', unpinned); process.exit(1); }
console.log('All @tn-figueiredo/* pins are exact:', tnDeps.map(([k,v]) => k+'@'+v).join(', '));
"
# Expected: prints exact versions for admin@0.4.0, auth-nextjs@2.1.0, cms@0.1.0-beta.3 (and others).
```

- [ ] Commit:

```
chore(sprint-4c): verify full test + typecheck + pinning gate after login split
```

---

### T12 — Final manual QA (post-delete)

Repeat the critical paths from T9 to confirm no regression after `/signin` deletion.

- [ ] Start the dev server:

```bash
npm run dev --workspace=apps/web
```

- [ ] Verify:

  - [ ] `GET http://localhost:3001/signin` → 404 (page deleted — expected).
  - [ ] `GET http://localhost:3001/admin` (unauthenticated) → 307 redirect to `/admin/login`.
  - [ ] `GET http://localhost:3001/cms` (unauthenticated) → 307 redirect to `/cms/login`.
  - [ ] Login on `/admin/login` succeeds and lands on `/admin`.
  - [ ] Login on `/cms/login` succeeds and lands on `/cms`.
  - [ ] Forgot password on `/admin/forgot` → generic success message shown.
  - [ ] Forgot password on `/cms/forgot` → generic success message shown.
  - [ ] OAuth callback errors redirect to `/admin/login?error=…` (check network tab on a forced OAuth error).
  - [ ] Invite link for an existing user redirects to `/admin/login?redirect=…&hint=…`.

- [ ] Stop dev server.

---

## Summary of commits (in order)

| # | Task | Commit message |
|---|------|---------------|
| 1 | T1 | `chore(sprint-4c): bump auth-nextjs@2.1.0 admin@0.4.0 cms@0.1.0-beta.3` |
| 2 | T2 | `test(sprint-4c): update middleware expectations to per-area login paths` |
| 3 | T3 | `feat(sprint-4c): add /admin/login, /admin/forgot, /admin/reset pages + actions` |
| 4 | T4 | `feat(sprint-4c): add /cms/login, /cms/forgot, /cms/reset pages + actions` |
| 5 | T5 | `feat(sprint-4c): dispatch per-area auth middleware for /admin and /cms` |
| 6 | T6 | `security(sprint-4c): add X-Frame-Options DENY + CSP frame-ancestors on login pages` |
| 7 | T7 | `fix(sprint-4c): update auth/callback + invite redirect from /signin to /admin/login` |
| 8 | T8 | `test(sprint-4c): add admin-login + cms-login consumer render tests` |
| 9 | T9 | (manual QA — no commit) |
| 10 | T10 | `chore(sprint-4c): delete /signin route + related tests (replaced by per-area login)` |
| 11 | T11 | `chore(sprint-4c): verify full test + typecheck + pinning gate after login split` |
| 12 | T12 | (manual QA — no commit) |

---

## Invariants to maintain throughout

1. **No broken intermediate state.** Between T3 and T10, both `/signin` and the new `/admin/login` + `/cms/login` routes exist simultaneously. Tests pass throughout. `/signin` is only deleted after the new routes are verified live (T9 QA gate).
2. **Exact pins.** All `@tn-figueiredo/*` entries in `apps/web/package.json` must use exact version strings. The pre-commit hook rejects `^` or `~` prefixes.
3. **`'use server'` boundary.** Every `actions.ts` file starts with `'use server'`. The `page.tsx` files import from their co-located `actions.ts`, not from the package directly — this satisfies Next.js's server action boundary rule.
4. **`safeRedirect` source.** After T7, the only consumer of `safeRedirect` outside the deleted `/signin/` is `auth/callback/route.ts`, which imports from `@tn-figueiredo/auth-nextjs/safe-redirect`. There is no `apps/web/src/lib/auth/safe-redirect.ts` file to delete (it never existed as a standalone module; the old import path was relative from within the signin directory).
5. **OAuth error redirects.** Both error redirect paths in `auth/callback/route.ts` point to `/admin/login` — admin is the primary OAuth entry point (both admin and CMS users use the same Supabase auth provider; the OAuth callback is area-agnostic). If a CMS-only flow via Google is needed in the future, the `next` param in the OAuth URL builder already handles the post-login destination.
