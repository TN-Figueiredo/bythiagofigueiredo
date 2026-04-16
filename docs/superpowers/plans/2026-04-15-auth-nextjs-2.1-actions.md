# auth-nextjs 2.1.0 — `/actions` + `/safe-redirect` Subpaths

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `signInWithPassword`, `signInWithGoogle`, `forgotPassword`, and `resetPassword` as published server actions in `@tn-figueiredo/auth-nextjs/actions`, plus expose `safeRedirect` in `@tn-figueiredo/auth-nextjs/safe-redirect`. Bump `2.0.0 → 2.1.0`. No breaking changes to existing exports.

**Architecture:** Two new subpath directories (`src/actions/`, `src/safe-redirect/`), each with its own `tsconfig.actions.json` / `tsconfig.safe-redirect.json` mirroring the server tsconfig pattern. The actions file carries `'use server'` at the top. Release via changesets (the repo uses `changesets/action` on main).

**Tech Stack:** TypeScript 5, Vitest 4, `@supabase/ssr`, `@tn-figueiredo/audit@0.1.0` (fire-and-forget audit trail), npm workspaces / changesets.

**Repo:** `/Users/figueiredo/Workspace/tnf-ecosystem` — package at `packages/auth-nextjs/`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/auth-nextjs/src/safe-redirect/index.ts` | **Create** | `safeRedirect(url, fallback?)` — returns sanitised relative path or fallback |
| `packages/auth-nextjs/src/actions/index.ts` | **Create** | `'use server'` module: `signInWithPassword`, `signInWithGoogle`, `forgotPassword`, `resetPassword` |
| `packages/auth-nextjs/src/actions/types.ts` | **Create** | `ActionResult`, `SignInPasswordInput`, `SignInGoogleInput`, `ForgotPasswordInput`, `ResetPasswordInput` |
| `packages/auth-nextjs/tsconfig.safe-redirect.json` | **Create** | Compiles `src/safe-redirect/` → `dist/safe-redirect/` (mirrors server tsconfig) |
| `packages/auth-nextjs/tsconfig.actions.json` | **Create** | Compiles `src/actions/` → `dist/actions/` (same options as server tsconfig) |
| `packages/auth-nextjs/tsconfig.json` | **Modify** | Add two new project references |
| `packages/auth-nextjs/package.json` | **Modify** | Add `./actions` + `./safe-redirect` subpath exports; bump version to `2.1.0`; add `@tn-figueiredo/audit` to peerDependencies / devDependencies |
| `packages/auth-nextjs/src/__tests__/safe-redirect/safe-redirect.test.ts` | **Create** | Unit tests for `safeRedirect` |
| `packages/auth-nextjs/src/__tests__/actions/sign-in-password.test.ts` | **Create** | Unit tests: happy path, bad creds, Turnstile missing, Turnstile invalid, enum-resistance |
| `packages/auth-nextjs/src/__tests__/actions/sign-in-google.test.ts` | **Create** | Unit tests: happy path, OAuth error, missing URL |
| `packages/auth-nextjs/src/__tests__/actions/forgot-password.test.ts` | **Create** | Unit tests: happy path, Turnstile failure, always-generic-success |
| `packages/auth-nextjs/src/__tests__/actions/reset-password.test.ts` | **Create** | Unit tests: happy path, weak password, session missing |
| `.changeset/<slug>.md` | **Create** | Changeset declaring `@tn-figueiredo/auth-nextjs` minor bump |
| `packages/auth-nextjs/CHANGELOG.md` | **Modify** | Document `2.1.0` entry |

---

## Task 1: Add `/safe-redirect` subpath (TDD)

**Commit message:** `feat(auth-nextjs): add /safe-redirect subpath`

### Step 1.1 — Write failing tests first

Create `packages/auth-nextjs/src/__tests__/safe-redirect/safe-redirect.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { safeRedirect } from '../../safe-redirect/index.js';

describe('safeRedirect', () => {
  // Happy path
  it('returns the path unchanged when it is a safe relative URL', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard');
    expect(safeRedirect('/admin/users')).toBe('/admin/users');
    expect(safeRedirect('/cms/blog')).toBe('/cms/blog');
  });

  it('accepts a custom fallback', () => {
    expect(safeRedirect(null, '/admin')).toBe('/admin');
    expect(safeRedirect(undefined, '/admin')).toBe('/admin');
  });

  it('defaults fallback to /cms when none provided', () => {
    expect(safeRedirect(null)).toBe('/cms');
  });

  // Rejection cases
  it('returns fallback for empty string', () => {
    expect(safeRedirect('', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for protocol-relative URL (//)', () => {
    expect(safeRedirect('//evil.com', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for /\\ edge case', () => {
    expect(safeRedirect('/\\evil', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for absolute https URL', () => {
    expect(safeRedirect('https://evil.com', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for absolute http URL', () => {
    expect(safeRedirect('http://evil.com', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for paths not starting with /', () => {
    expect(safeRedirect('relative/path', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for javascript: scheme', () => {
    expect(safeRedirect('javascript:alert(1)', '/fallback')).toBe('/fallback');
  });
});
```

Run to confirm tests fail (source file does not exist yet):

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run test --workspace=packages/auth-nextjs 2>&1 | grep -E "FAIL|safe-redirect"
```

Expected output: test file errors with `Cannot find module '../../safe-redirect/index.js'`.

### Step 1.2 — Create `tsconfig.safe-redirect.json`

Create `packages/auth-nextjs/tsconfig.safe-redirect.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist/safe-redirect",
    "rootDir": "./src/safe-redirect",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "lib": ["ES2022"]
  },
  "include": ["src/safe-redirect/**/*"]
}
```

### Step 1.3 — Implement `src/safe-redirect/index.ts`

```typescript
/**
 * Returns a sanitised relative path or `fallback` when the input is unsafe.
 *
 * Rules (aligned with isSafeRedirect in server/helpers/safe-redirect.ts):
 *   - Must be a non-empty string starting with /
 *   - No protocol-relative URLs (//)
 *   - No /\ edge case
 *   - No absolute URLs (http://, https://, javascript:, etc.)
 *
 * Safe for embedding in Next.js router.push() and OAuth redirectTo params.
 * Moved from apps/web/lib/auth/safe-redirect.ts.
 */
export function safeRedirect(input: string | null | undefined, fallback = '/cms'): string {
  if (!input) return fallback;
  if (!input.startsWith('/')) return fallback;
  if (input.startsWith('//')) return fallback;
  if (input.startsWith('/\\')) return fallback;
  return input;
}
```

### Step 1.4 — Add project reference in `tsconfig.json`

In `packages/auth-nextjs/tsconfig.json`, add the new reference:

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [
    { "path": "./tsconfig.server.json" },
    { "path": "./tsconfig.client.json" },
    { "path": "./tsconfig.middleware.json" },
    { "path": "./tsconfig.safe-redirect.json" }
  ]
}
```

### Step 1.5 — Update `package.json` exports (safe-redirect only)

In `packages/auth-nextjs/package.json`, add the subpath to `exports`:

```json
"./safe-redirect": {
  "types": "./dist/safe-redirect/index.d.ts",
  "default": "./dist/safe-redirect/index.js"
}
```

### Step 1.6 — Update build script

In `packages/auth-nextjs/package.json`, update `scripts.build`:

```json
"build": "tsc -p tsconfig.server.json && tsc -p tsconfig.client.json && tsc -p tsconfig.middleware.json && tsc -p tsconfig.safe-redirect.json"
```

Also update `scripts.typecheck`:

```json
"typecheck": "tsc -p tsconfig.server.json --noEmit && tsc -p tsconfig.client.json --noEmit && tsc -p tsconfig.middleware.json --noEmit && tsc -p tsconfig.safe-redirect.json --noEmit"
```

### Step 1.7 — Run tests to confirm they pass

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run test --workspace=packages/auth-nextjs 2>&1 | grep -E "PASS|FAIL|safe-redirect"
```

Expected: all safe-redirect tests pass. All pre-existing tests still pass.

### Step 1.8 — Build and verify dist output

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run build --workspace=packages/auth-nextjs 2>&1
ls packages/auth-nextjs/dist/safe-redirect/
```

Expected output from `ls`: `index.js  index.d.ts  index.d.ts.map  index.js.map`

### Step 1.9 — Commit

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add packages/auth-nextjs/src/safe-redirect/ \
        packages/auth-nextjs/src/__tests__/safe-redirect/ \
        packages/auth-nextjs/tsconfig.safe-redirect.json \
        packages/auth-nextjs/tsconfig.json \
        packages/auth-nextjs/package.json
git commit -m "feat(auth-nextjs): add /safe-redirect subpath"
```

---

## Task 2: Audit SDK API verification

**Commit message:** `chore(auth-nextjs): verify audit SDK API for login-attempt event`

This task is a pure investigation — no new source files if the API matches. It must complete before Task 3 so the actions implementation wires audit correctly.

### Step 2.1 — Read audit package public surface

```bash
cat /Users/figueiredo/Workspace/tnf-ecosystem/packages/audit/src/interfaces.ts
cat /Users/figueiredo/Workspace/tnf-ecosystem/packages/audit/src/index.ts
cat /Users/figueiredo/Workspace/tnf-ecosystem/packages/audit/src/logger.ts
```

**Finding (from pre-plan read):** `@tn-figueiredo/audit@0.1.0` exposes `PinoLogger` (implements `ILogger`) and `InMemoryRateLimiter` / `UpstashRateLimiter`. There is **no structured audit-trail / event-log API** — the package is a logging + rate-limiting + profanity SDK, not an event store. It does not accept `{event: 'login_attempt', ...}` structured events.

### Step 2.2 — Decision

Because the audit SDK does not offer an event-store API, the actions will use `ILogger` (injected via parameter, defaulting to `console` in the absence of a logger) to emit a structured JSON log line on each login attempt. This is fire-and-forget and never blocks the auth path.

Pattern in actions:

```typescript
// fire-and-forget — never awaited, never throws
void Promise.resolve().then(() =>
  logger.info('login_attempt', {
    event: 'login_attempt',
    success,
    email_hash: sha256hex(email),
    ip,
    ua,
    ts: new Date().toISOString(),
  })
);
```

`logger` is an optional parameter of type `ILogger` from `@tn-figueiredo/audit/interfaces` — defaulting to a `ConsoleLogger` shim so the actions work without any injection. This keeps the audit integration zero-cost for consumers who don't need it.

A `TODO` comment is added to every action noting: "When `@tn-figueiredo/audit` gains an event-store API, replace `ILogger` call with `auditClient.record('login_attempt', payload)`."

### Step 2.3 — Commit (comment-only change in a placeholder file if no code exists yet; otherwise skip)

If no source files were modified, this task is documentation-only. Create a brief note in `packages/auth-nextjs/src/actions/AUDIT_TODO.md` is **not** created (no extra files per codebase convention). The TODO lives as a comment in the source file written in Task 3.

Commit:

```bash
# No files to commit — investigation complete, findings recorded in plan.
# Task 3 will embed the audit pattern directly in actions/index.ts.
```

---

## Task 3: Add `/actions` subpath (TDD)

**Commit message:** `feat(auth-nextjs): add /actions subpath (signInWithPassword, signInWithGoogle, forgotPassword, resetPassword)`

### Step 3.1 — Write failing tests first

#### `packages/auth-nextjs/src/__tests__/actions/sign-in-password.test.ts`

```typescript
// @vitest-environment node
/**
 * Tests for signInWithPassword server action.
 *
 * Mocking strategy: vi.mock('@supabase/ssr') so createServerClient returns
 * a controlled auth object. next/headers is mocked to provide cookies().
 * Turnstile verification is mocked via the verifyTurnstileToken parameter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers before importing the module under test
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { signInWithPassword } from '../../actions/index.js';

const makeAuthClient = (overrides?: { signInWithPassword?: ReturnType<typeof vi.fn> }) => ({
  auth: {
    signInWithPassword: overrides?.signInWithPassword ?? vi.fn().mockResolvedValue({ error: null }),
  },
});

beforeEach(() => {
  vi.mocked(createServerClient).mockReturnValue(makeAuthClient() as never);
});

describe('signInWithPassword', () => {
  // Happy path
  it('returns { ok: true } on valid credentials with valid Turnstile token', async () => {
    const result = await signInWithPassword({
      email: 'user@example.com',
      password: 'Correct1234',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });
    expect(result).toEqual({ ok: true });
  });

  // Turnstile missing (empty string treated as missing)
  it('returns error when turnstileToken is empty string', async () => {
    const result = await signInWithPassword({
      email: 'user@example.com',
      password: 'Correct1234',
      turnstileToken: '',
      verifyTurnstile: async () => false,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/anti-bot/i);
  });

  // Turnstile present but invalid
  it('returns error when Turnstile verification fails', async () => {
    const result = await signInWithPassword({
      email: 'user@example.com',
      password: 'Correct1234',
      turnstileToken: 'bad-token',
      verifyTurnstile: async () => false,
    });
    expect(result.ok).toBe(false);
  });

  // Email enumeration resistance — bad password
  it('returns same generic error message for invalid credentials', async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeAuthClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid login credentials' },
        }),
      }) as never,
    );
    const result = await signInWithPassword({
      email: 'user@example.com',
      password: 'WrongPass1',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe('Email ou senha incorretos.');
  });

  // Email enumeration resistance — unknown email must return identical message
  it('returns identical error message for unknown email as for bad password', async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeAuthClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid login credentials' },
        }),
      }) as never,
    );
    const badPasswordResult = await signInWithPassword({
      email: 'user@example.com',
      password: 'WrongPass1',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });

    vi.mocked(createServerClient).mockReturnValue(
      makeAuthClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid login credentials' },
        }),
      }) as never,
    );
    const unknownEmailResult = await signInWithPassword({
      email: 'nobody@example.com',
      password: 'AnyPass1',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });

    expect((badPasswordResult as { ok: false; error: string }).error).toBe(
      (unknownEmailResult as { ok: false; error: string }).error,
    );
  });

  // Generic error path (non-credential error)
  it('returns generic error on unexpected Supabase error', async () => {
    vi.mocked(createServerClient).mockReturnValue(
      makeAuthClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Too many requests' },
        }),
      }) as never,
    );
    const result = await signInWithPassword({
      email: 'user@example.com',
      password: 'Correct1234',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe('Erro ao entrar. Tente novamente.');
  });

  // Turnstile is optional when not configured (verifyTurnstile not passed)
  it('skips Turnstile check when no verifyTurnstile fn is provided', async () => {
    const result = await signInWithPassword({
      email: 'user@example.com',
      password: 'Correct1234',
      turnstileToken: undefined,
    });
    expect(result).toEqual({ ok: true });
  });
});
```

#### `packages/auth-nextjs/src/__tests__/actions/sign-in-google.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { signInWithGoogle } from '../../actions/index.js';

beforeEach(() => {
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?...' },
        error: null,
      }),
    },
  } as never);
});

describe('signInWithGoogle', () => {
  it('returns { ok: true, url } on success', async () => {
    const result = await signInWithGoogle({
      redirectTo: '/cms',
      appUrl: 'https://example.com',
    });
    expect(result.ok).toBe(true);
    expect((result as { ok: true; url: string }).url).toContain('google');
  });

  it('returns error when signInWithOAuth returns an error', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { url: null },
          error: { message: 'provider disabled' },
        }),
      },
    } as never);
    const result = await signInWithGoogle({
      redirectTo: '/cms',
      appUrl: 'https://example.com',
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/google/i);
  });

  it('returns error when OAuth returns no URL', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { url: null },
          error: null,
        }),
      },
    } as never);
    const result = await signInWithGoogle({
      redirectTo: '/cms',
      appUrl: 'https://example.com',
    });
    expect(result.ok).toBe(false);
  });

  it('sanitises the redirectTo with safeRedirect before embedding in OAuth URL', async () => {
    let capturedUrl = '';
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        signInWithOAuth: vi.fn().mockImplementation(async ({ options }: { options: { redirectTo: string } }) => {
          capturedUrl = options.redirectTo;
          return { data: { url: 'https://accounts.google.com/...' }, error: null };
        }),
      },
    } as never);

    await signInWithGoogle({
      redirectTo: 'https://evil.com/steal',
      appUrl: 'https://example.com',
    });

    // The next param embedded in the redirectTo should have fallen back to /cms
    expect(decodeURIComponent(capturedUrl)).toContain('next=/cms');
  });
});
```

#### `packages/auth-nextjs/src/__tests__/actions/forgot-password.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('1.2.3.4'),
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { forgotPassword } from '../../actions/index.js';

beforeEach(() => {
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
  } as never);
});

describe('forgotPassword', () => {
  // Happy path
  it('returns { ok: true } on success', async () => {
    const result = await forgotPassword({
      email: 'user@example.com',
      appUrl: 'https://example.com',
      resetPath: '/admin/reset',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });
    expect(result).toEqual({ ok: true });
  });

  // Turnstile failure
  it('returns error when Turnstile verification fails', async () => {
    const result = await forgotPassword({
      email: 'user@example.com',
      appUrl: 'https://example.com',
      resetPath: '/admin/reset',
      turnstileToken: 'bad-token',
      verifyTurnstile: async () => false,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/anti-bot/i);
  });

  // Email enumeration resistance — always generic success even when Supabase errors
  it('still returns { ok: true } when Supabase resetPasswordForEmail fails (enum-resistance)', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({
          error: { message: 'Email not found' },
        }),
      },
    } as never);
    const result = await forgotPassword({
      email: 'nobody@example.com',
      appUrl: 'https://example.com',
      resetPath: '/admin/reset',
      turnstileToken: 'valid-token',
      verifyTurnstile: async () => true,
    });
    // Must always return ok: true to prevent email enumeration
    expect(result).toEqual({ ok: true });
  });

  // Turnstile optional
  it('skips Turnstile check when no verifyTurnstile fn provided', async () => {
    const result = await forgotPassword({
      email: 'user@example.com',
      appUrl: 'https://example.com',
      resetPath: '/admin/reset',
      turnstileToken: undefined,
    });
    expect(result).toEqual({ ok: true });
  });
});
```

#### `packages/auth-nextjs/src/__tests__/actions/reset-password.test.ts`

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { resetPassword } from '../../actions/index.js';

beforeEach(() => {
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  } as never);
});

describe('resetPassword', () => {
  // Happy path
  it('returns { ok: true } when password update succeeds', async () => {
    const result = await resetPassword({ password: 'NewSecure1234' });
    expect(result).toEqual({ ok: true });
  });

  // Weak password — client-side validation surfaced as error
  it('returns error when password is shorter than 8 chars', async () => {
    const result = await resetPassword({ password: 'abc' });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/8 caracteres/);
  });

  it('returns error when password has no digits', async () => {
    const result = await resetPassword({ password: 'NoDigitsHere' });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/fraca/i);
  });

  it('returns error when password has no letters', async () => {
    const result = await resetPassword({ password: '12345678' });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/fraca/i);
  });

  // Supabase error
  it('returns error when updateUser fails', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        updateUser: vi.fn().mockResolvedValue({
          error: { message: 'should be different from the old password' },
        }),
      },
    } as never);
    const result = await resetPassword({ password: 'OldPass1234' });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/diferente/i);
  });

  it('maps weak-password Supabase error to Portuguese message', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        updateUser: vi.fn().mockResolvedValue({
          error: { message: 'weak password' },
        }),
      },
    } as never);
    const result = await resetPassword({ password: 'Secure1234' });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/fraca/i);
  });
});
```

Run to confirm all 4 test files fail (no implementation yet):

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run test --workspace=packages/auth-nextjs 2>&1 | grep -E "FAIL|actions/"
```

Expected: all four action test files error with module-not-found.

### Step 3.2 — Create `tsconfig.actions.json`

Create `packages/auth-nextjs/tsconfig.actions.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist/actions",
    "rootDir": "./src/actions",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "lib": ["ES2022"]
  },
  "include": ["src/actions/**/*"]
}
```

Note: no `"DOM"` lib because server actions run in Node.js only (no `window`, `document`). No `jsx` option needed — actions are pure functions.

### Step 3.3 — Create `src/actions/types.ts`

```typescript
/**
 * Shared types for @tn-figueiredo/auth-nextjs/actions.
 *
 * All actions return ActionResult — a discriminated union of success and error.
 * Consumer UI reads `result.ok` to branch, then reads `result.error` on failure
 * or action-specific fields (e.g., `result.url`) on success.
 */

/** Generic action result used across all four auth server actions. */
export type ActionResult<TExtra = Record<string, never>> =
  | ({ ok: true } & TExtra)
  | { ok: false; error: string };

/** Input for signInWithPassword. */
export interface SignInPasswordInput {
  email: string;
  password: string;
  /** Cloudflare Turnstile token. Omit when Turnstile is not configured. */
  turnstileToken?: string;
  /**
   * Injection point for Turnstile verification — allows test isolation.
   * Defaults to no-op (always passes) when not provided.
   * Production consumers pass their own verifyTurnstileToken fn here.
   */
  verifyTurnstile?: (token: string) => Promise<boolean>;
}

/** Input for signInWithGoogle. */
export interface SignInGoogleInput {
  /** Relative path to redirect to after OAuth callback (sanitised by safeRedirect). */
  redirectTo: string;
  /** Consumer app URL (e.g., process.env.NEXT_PUBLIC_APP_URL). Used to build OAuth redirectTo. */
  appUrl: string;
  /** Callback path on the consumer app that handles the OAuth token exchange. Default: /auth/callback */
  callbackPath?: string;
}

/** Input for forgotPassword. */
export interface ForgotPasswordInput {
  email: string;
  /** Consumer app URL — used to build the password-reset redirect link. */
  appUrl: string;
  /** Path on the consumer app that handles the reset link (e.g., /admin/reset). */
  resetPath: string;
  turnstileToken?: string;
  verifyTurnstile?: (token: string) => Promise<boolean>;
}

/** Input for resetPassword. */
export interface ResetPasswordInput {
  password: string;
}
```

### Step 3.4 — Implement `src/actions/index.ts`

```typescript
'use server'

/**
 * @tn-figueiredo/auth-nextjs/actions
 *
 * Server actions for email/password + Google OAuth auth flows.
 * Mark `'use server'` at the top — required by Next.js to recognise this
 * module as a server action boundary.
 *
 * Consumers re-export from their own `actions.ts` files (also `'use server'`):
 *
 *   'use server'
 *   export { signInWithPassword, signInWithGoogle } from '@tn-figueiredo/auth-nextjs/actions'
 *
 * Audit trail:
 *   Actions log login attempts via ILogger (injected or defaulting to console).
 *   TODO: when @tn-figueiredo/audit gains an event-store API, replace logger.info
 *   call with auditClient.record('login_attempt', payload).
 */

import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { safeRedirect } from '../safe-redirect/index.js';
import type {
  SignInPasswordInput,
  SignInGoogleInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ActionResult,
} from './types.js';
import type { ILogger } from '@tn-figueiredo/audit/interfaces';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a Supabase browser client from env vars (reads cookies for session). */
async function getAnonClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** Minimal sha-256 hex hash for audit logging (email). Not suitable for secrets. */
async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** ConsoleLogger shim — used when no ILogger is injected. */
const consoleLogger: ILogger = {
  info: (msg, data) => console.info(msg, data ?? ''),
  warn: (msg, data) => console.warn(msg, data ?? ''),
  error: (msg, data) => console.error(msg, data ?? ''),
};

/** Fire-and-forget audit log. Never throws, never blocks. */
function auditLoginAttempt(
  email: string,
  success: boolean,
  ip: string | null,
  ua: string | null,
  logger: ILogger,
): void {
  void sha256hex(email)
    .then((email_hash) =>
      logger.info('login_attempt', {
        event: 'login_attempt',
        success,
        email_hash,
        ip,
        ua,
        ts: new Date().toISOString(),
      }),
    )
    .catch(() => {
      /* never surface audit errors */
    });
}

/** Default Supabase env (reads process.env at call time — supports Next.js edge). */
function defaultEnv() {
  return {
    supabaseUrl: process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '',
    supabaseAnonKey: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
  };
}

// ---------------------------------------------------------------------------
// Exported server actions
// ---------------------------------------------------------------------------

/**
 * Sign in with email + password.
 *
 * Security:
 * - Turnstile verification (opt-in via `verifyTurnstile` fn).
 * - Email enumeration resistance: "invalid login credentials" and
 *   "email not confirmed" both collapse to the same generic message.
 * - Audit log (fire-and-forget).
 *
 * Rate limiting: not implemented in the package — Supabase enforces per-IP
 * baseline. Consumer-side: add Upstash Ratelimit before calling this action.
 */
export async function signInWithPassword(
  input: SignInPasswordInput,
  opts?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    logger?: ILogger;
  },
): Promise<ActionResult> {
  const env = { ...defaultEnv(), ...opts };
  const logger = opts?.logger ?? consoleLogger;

  // Turnstile check (opt-in)
  if (input.verifyTurnstile) {
    const tokenOk = await input.verifyTurnstile(input.turnstileToken ?? '');
    if (!tokenOk) return { ok: false, error: 'Verificação anti-bot falhou' };
  }

  // Request IP for audit
  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = headerStore.get('user-agent') ?? null;

  const supabase = await getAnonClient(env.supabaseUrl, env.supabaseAnonKey);
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    auditLoginAttempt(input.email, false, ip, ua, logger);
    // I7: collapse credential errors to prevent email enumeration
    if (
      /invalid login credentials/i.test(error.message) ||
      /email not confirmed/i.test(error.message)
    ) {
      return { ok: false, error: 'Email ou senha incorretos.' };
    }
    return { ok: false, error: 'Erro ao entrar. Tente novamente.' };
  }

  auditLoginAttempt(input.email, true, ip, ua, logger);
  return { ok: true };
}

/**
 * Initiate Google OAuth flow.
 *
 * Security:
 * - safeRedirect sanitises the `redirectTo` before embedding in OAuth URL.
 * - Errors logged server-side; only generic message surfaced to client.
 */
export async function signInWithGoogle(
  input: SignInGoogleInput,
  opts?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    logger?: ILogger;
  },
): Promise<ActionResult<{ url: string }>> {
  const env = { ...defaultEnv(), ...opts };
  const logger = opts?.logger ?? consoleLogger;

  const safeNext = safeRedirect(input.redirectTo, '/cms');
  const callbackPath = input.callbackPath ?? '/auth/callback';
  const supabase = await getAnonClient(env.supabaseUrl, env.supabaseAnonKey);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${input.appUrl}${callbackPath}?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    logger.error('[signInWithGoogle] OAuth error', { message: error.message });
    return { ok: false, error: 'Falha ao iniciar login com Google' };
  }
  if (!data.url) {
    logger.error('[signInWithGoogle] OAuth returned no URL', {});
    return { ok: false, error: 'Falha ao iniciar login com Google' };
  }

  return { ok: true, url: data.url };
}

/**
 * Send a password-reset email.
 *
 * Security:
 * - Turnstile check (opt-in).
 * - Always returns { ok: true } after Turnstile passes — prevents email
 *   enumeration via timing or response shape differences.
 * - Real errors logged server-side only.
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
  opts?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    logger?: ILogger;
  },
): Promise<ActionResult> {
  const env = { ...defaultEnv(), ...opts };
  const logger = opts?.logger ?? consoleLogger;

  // Turnstile check (opt-in)
  if (input.verifyTurnstile) {
    const tokenOk = await input.verifyTurnstile(input.turnstileToken ?? '');
    if (!tokenOk) return { ok: false, error: 'Verificação anti-bot falhou' };
  }

  const supabase = await getAnonClient(env.supabaseUrl, env.supabaseAnonKey);
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${input.appUrl}${input.resetPath}`,
  });

  if (error) {
    // Log internally — never expose to user (prevents email enumeration)
    logger.error('[forgotPassword] resetPasswordForEmail error', {
      message: error.message,
      email: input.email.replace(/@.*/, '@…'),
    });
  }

  // Always return generic success regardless of outcome
  return { ok: true };
}

/**
 * Update the current user's password (used from /reset page after PASSWORD_RECOVERY event).
 *
 * This is a server action wrapping `supabase.auth.updateUser`. The reset page
 * component must ensure the user has gone through the PASSWORD_RECOVERY auth
 * event before calling this action (client-side gate via onAuthStateChange).
 *
 * Password rules (mirrors current consumer app validation):
 * - Minimum 8 characters
 * - At least one letter
 * - At least one digit
 */
export async function resetPassword(
  input: ResetPasswordInput,
  opts?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    logger?: ILogger;
  },
): Promise<ActionResult> {
  const env = { ...defaultEnv(), ...opts };
  const logger = opts?.logger ?? consoleLogger;

  // Client-side-style validation — run server-side too for defence in depth
  if (input.password.length < 8) {
    return { ok: false, error: 'Senha deve ter pelo menos 8 caracteres.' };
  }
  if (!/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) {
    return { ok: false, error: 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.' };
  }

  const supabase = await getAnonClient(env.supabaseUrl, env.supabaseAnonKey);
  const { error } = await supabase.auth.updateUser({ password: input.password });

  if (error) {
    logger.error('[resetPassword] updateUser error', { message: error.message });
    if (/should be different/i.test(error.message)) {
      return { ok: false, error: 'A nova senha deve ser diferente da atual.' };
    }
    if (/weak password/i.test(error.message)) {
      return { ok: false, error: 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.' };
    }
    return { ok: false, error: 'Não foi possível redefinir a senha. Tente novamente.' };
  }

  return { ok: true };
}
```

### Step 3.5 — Add `@tn-figueiredo/audit` to peerDependencies

In `packages/auth-nextjs/package.json`:

```json
"peerDependencies": {
  "next": ">=14",
  "react": ">=18",
  "@supabase/ssr": ">=0.5",
  "@supabase/supabase-js": ">=2.40",
  "@tn-figueiredo/auth": ">=1.0.1",
  "@tn-figueiredo/audit": ">=0.1.0",
  "@tn-figueiredo/shared": ">=0.8.0",
  "zod": "^3.22.0"
},
"devDependencies": {
  ...existing entries...,
  "@tn-figueiredo/audit": "*"
}
```

### Step 3.6 — Add `./actions` subpath to `package.json` exports

```json
"./actions": {
  "types": "./dist/actions/index.d.ts",
  "default": "./dist/actions/index.js"
}
```

### Step 3.7 — Add `tsconfig.actions.json` project reference in `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [
    { "path": "./tsconfig.server.json" },
    { "path": "./tsconfig.client.json" },
    { "path": "./tsconfig.middleware.json" },
    { "path": "./tsconfig.safe-redirect.json" },
    { "path": "./tsconfig.actions.json" }
  ]
}
```

### Step 3.8 — Update build and typecheck scripts

In `package.json`:

```json
"build": "tsc -p tsconfig.server.json && tsc -p tsconfig.client.json && tsc -p tsconfig.middleware.json && tsc -p tsconfig.safe-redirect.json && tsc -p tsconfig.actions.json",
"typecheck": "tsc -p tsconfig.server.json --noEmit && tsc -p tsconfig.client.json --noEmit && tsc -p tsconfig.middleware.json --noEmit && tsc -p tsconfig.safe-redirect.json --noEmit && tsc -p tsconfig.actions.json --noEmit"
```

### Step 3.9 — Run tests to confirm they pass

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run test --workspace=packages/auth-nextjs
```

Expected output:

```
✓ src/__tests__/safe-redirect/safe-redirect.test.ts (11 tests)
✓ src/__tests__/actions/sign-in-password.test.ts (7 tests)
✓ src/__tests__/actions/sign-in-google.test.ts (4 tests)
✓ src/__tests__/actions/forgot-password.test.ts (4 tests)
✓ src/__tests__/actions/reset-password.test.ts (6 tests)
... (all pre-existing tests also pass)
```

Zero failures.

### Step 3.10 — Build and inspect

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run build --workspace=packages/auth-nextjs
ls packages/auth-nextjs/dist/actions/
```

Expected: `index.js  index.d.ts  index.d.ts.map  index.js.map  types.js  types.d.ts  types.d.ts.map  types.js.map`

### Step 3.11 — Typecheck all subpaths

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run typecheck --workspace=packages/auth-nextjs
```

Expected: no errors.

### Step 3.12 — Commit

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add packages/auth-nextjs/src/actions/ \
        packages/auth-nextjs/src/__tests__/actions/ \
        packages/auth-nextjs/tsconfig.actions.json \
        packages/auth-nextjs/tsconfig.json \
        packages/auth-nextjs/package.json
git commit -m "feat(auth-nextjs): add /actions subpath (signInWithPassword, signInWithGoogle, forgotPassword, resetPassword)"
```

---

## Task 4: Regression — verify existing exports unchanged

**Commit message:** none (verification only — no new files committed if clean)

### Step 4.1 — Run full test suite

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run test --workspace=packages/auth-nextjs
```

Expected: all tests pass, including all pre-existing tests for `/`, `/client`, `/middleware`.

### Step 4.2 — Verify subpath resolution by importing from each entry point

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && node --input-type=module <<'EOF'
// Verify all published subpaths resolve from dist
import { requireUser } from './packages/auth-nextjs/dist/server/index.js';
import { createBrowserClient } from './packages/auth-nextjs/dist/client/index.js';
import { createAuthMiddleware } from './packages/auth-nextjs/dist/middleware/index.js';
import { safeRedirect } from './packages/auth-nextjs/dist/safe-redirect/index.js';
import { signInWithPassword, signInWithGoogle, forgotPassword, resetPassword } from './packages/auth-nextjs/dist/actions/index.js';
console.log('All subpaths resolved OK');
EOF
```

Expected output: `All subpaths resolved OK`

---

## Task 5: Version bump to 2.1.0

**Commit message:** `chore(auth-nextjs): bump version to 2.1.0`

### Step 5.1 — Update `version` in `package.json`

In `packages/auth-nextjs/package.json`, change:

```json
"version": "2.0.0"
```

to:

```json
"version": "2.1.0"
```

### Step 5.2 — Commit

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add packages/auth-nextjs/package.json
git commit -m "chore(auth-nextjs): bump version to 2.1.0"
```

---

## Task 6: CHANGELOG entry

**Commit message:** `docs(auth-nextjs): add 2.1.0 CHANGELOG entry`

### Step 6.1 — Prepend 2.1.0 block to `CHANGELOG.md`

Prepend the following block at the top of `packages/auth-nextjs/CHANGELOG.md` (before the existing `## 2.0.0` heading):

```markdown
## 2.1.0

### Minor Changes

- Add `/actions` subpath export with four server actions: `signInWithPassword`,
  `signInWithGoogle`, `forgotPassword`, `resetPassword`. Each carries `'use server'`
  at the module boundary — consumers re-export from their own `'use server'` file.

  Actions are injection-friendly: `verifyTurnstile` is an optional parameter (not
  a hard dependency on any specific Turnstile client), and a `logger` option of
  type `ILogger` from `@tn-figueiredo/audit/interfaces` can be injected for audit
  trails. Without injection, actions fall back to `console.*` and skip Turnstile.

  Security properties preserved from apps/web Sprint 3 hardening:
  - Email enumeration resistance: "invalid login credentials" and "email not
    confirmed" collapse to the same generic message.
  - Open-redirect guard: `signInWithGoogle` runs `safeRedirect()` on the
    `redirectTo` param before embedding it in the OAuth URL.
  - Audit logging (fire-and-forget): every `signInWithPassword` attempt emits a
    structured `{event, success, email_hash, ip, ua, ts}` log line.

  **Turnstile note:** Turnstile verification is **opt-in**. Pass `verifyTurnstile`
  to enable it. When absent, the token check is skipped — allowing Turnstile-free
  deploys (e.g., admin tools on internal networks).

  **Audit note:** `@tn-figueiredo/audit@0.1.0` does not expose an event-store API.
  The current implementation calls `ILogger.info('login_attempt', payload)`. When
  the audit package gains a structured event API, update the actions to call
  `auditClient.record(...)` instead.

- Add `/safe-redirect` subpath export with `safeRedirect(url, fallback?)`.
  Moved from `apps/web/lib/auth/safe-redirect.ts`. Returns the input unchanged
  if it is a safe relative path, or `fallback` (default: `/cms`) otherwise.
  Protects against open-redirect via protocol-relative URLs, absolute URLs, and
  the `/\` edge case.

### Peer Dependencies

- Added `@tn-figueiredo/audit >= 0.1.0` (optional — only needed if injecting
  `ILogger`; the `ILogger` type is imported from `@tn-figueiredo/audit/interfaces`
  which is a type-only import and tree-shaken in production builds).

```

### Step 6.2 — Commit

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add packages/auth-nextjs/CHANGELOG.md
git commit -m "docs(auth-nextjs): add 2.1.0 CHANGELOG entry"
```

---

## Task 7: Create changeset for publish

**Commit message:** `chore(auth-nextjs): add changeset for 2.1.0 minor bump`

### Step 7.1 — Create changeset file

The repo uses `@changesets/cli`. Run:

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npx changeset add
```

When prompted:
- Select package: `@tn-figueiredo/auth-nextjs`
- Bump type: `minor`
- Summary: `Add /actions and /safe-redirect subpath exports (signInWithPassword, signInWithGoogle, forgotPassword, resetPassword, safeRedirect). No breaking changes.`

Alternatively, create the changeset file manually. Changesets CLI generates a file like `.changeset/some-random-name.md`:

```markdown
---
"@tn-figueiredo/auth-nextjs": minor
---

Add `/actions` and `/safe-redirect` subpath exports.

New server actions: `signInWithPassword`, `signInWithGoogle`, `forgotPassword`,
`resetPassword` — each `'use server'`, Turnstile-optional, with fire-and-forget
audit logging via `ILogger`.

New helper: `safeRedirect(url, fallback?)` — open-redirect guard, moved from
apps/web into the package for shared use by admin and CMS login components.

No breaking changes to existing `/`, `/client`, `/middleware` exports.
```

The exact filename does not matter — changesets generates a random slug. Confirm the file was created:

```bash
ls /Users/figueiredo/Workspace/tnf-ecosystem/.changeset/ | grep -v config.json
```

Expected: one new `.md` file.

### Step 7.2 — Commit

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git add .changeset/
git commit -m "chore(auth-nextjs): add changeset for 2.1.0 minor bump"
```

---

## Task 8: Publish via release pipeline

**Commit message:** `chore(auth-nextjs): trigger 2.1.0 release`

### Step 8.1 — Final test run (full suite)

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem && npm run test --workspace=packages/auth-nextjs
```

Expected: all tests pass. Zero failures.

### Step 8.2 — Push to main to trigger the release workflow

```bash
cd /Users/figueiredo/Workspace/tnf-ecosystem
git push origin main
```

The `release.yml` workflow triggers on push to `main`. It runs `changesets/action` which:
1. Detects the changeset file.
2. Opens a "Version Packages" PR (or applies it directly if already opened).
3. On merge of that PR, runs `npm run publish-packages` → `turbo run build && changeset publish`.
4. Publishes `@tn-figueiredo/auth-nextjs@2.1.0` to `https://npm.pkg.github.com`.

### Step 8.3 — Verify publish succeeded

```bash
# Wait for the release workflow to complete, then verify the version is available
curl -s -H "Authorization: Bearer $NPM_TOKEN" \
  "https://npm.pkg.github.com/@tn-figueiredo/auth-nextjs" \
  | grep '"latest"'
```

Expected output contains `"2.1.0"`.

Alternatively, verify via GitHub UI: `https://github.com/TN-Figueiredo/tnf-ecosystem/packages` → `auth-nextjs` → should show `2.1.0`.

---

## Summary table

| # | Task | Files touched | Commit |
|---|------|--------------|--------|
| 1 | `/safe-redirect` subpath (TDD) | `src/safe-redirect/index.ts`, tests, `tsconfig.safe-redirect.json`, `tsconfig.json`, `package.json` | `feat(auth-nextjs): add /safe-redirect subpath` |
| 2 | Audit SDK verification | No code — findings inform Task 3 | (no commit) |
| 3 | `/actions` subpath (TDD) | `src/actions/index.ts`, `src/actions/types.ts`, 4 test files, `tsconfig.actions.json`, `tsconfig.json`, `package.json` | `feat(auth-nextjs): add /actions subpath ...` |
| 4 | Regression check | Verification only | (no commit if clean) |
| 5 | Version bump | `package.json` | `chore(auth-nextjs): bump version to 2.1.0` |
| 6 | CHANGELOG | `CHANGELOG.md` | `docs(auth-nextjs): add 2.1.0 CHANGELOG entry` |
| 7 | Changeset | `.changeset/<slug>.md` | `chore(auth-nextjs): add changeset for 2.1.0 minor bump` |
| 8 | Publish | Push to main → CI | `chore(auth-nextjs): trigger 2.1.0 release` |
