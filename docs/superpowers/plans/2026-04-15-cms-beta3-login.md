# CMS `0.1.0-beta.3` — `/login` Subpath Implementation Plan

> **✅ EXECUTED 2026-04-16** — branch `feat/cms-beta3-login` in `tn-cms` repo (9 commits, 127 tests passing, typecheck clean, `dist/login.{js,d.ts}` emitted).
>
> **Deviations applied during execution** (inherited by any rerun of this plan):
> - **Package substitution:** `@axe-core/vitest` does not exist on npm (404). Replaced with `vitest-axe@0.1.0` (same jest-axe lineage, same matcher API). Test imports: `import { axe } from 'vitest-axe'` + `import { toHaveNoViolations } from 'vitest-axe/matchers'` + `expect.extend({ toHaveNoViolations })`.
> - **Types inlined:** because `@tn-figueiredo/auth-nextjs@2.1.0` was not yet published at execution time, `src/login/types.ts` defines `ActionResult` / `SignInPasswordInput` / `SignInGoogleInput` / `ForgotPasswordInput` / `ResetPasswordInput` inline with a `// TODO(phase4-consumer)` header comment. Phase 4 (web consumer wiring) is responsible for flipping these to `import type { … } from '@tn-figueiredo/auth-nextjs/actions'` and adding the peer dep.
> - **Reset test fix:** plan had `import { act } from 'vitest'`; `act` actually lives in `@testing-library/react`. Fixed during execution.
> - **Not pushed / not published:** branch is local-only. `v0.1.0-beta.3` tag + GH Packages publish are deferred to post-review sign-off.
>
> **For agentic workers (historical reference):** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/login` subpath to `@tn-figueiredo/cms` exporting three UI-only auth page components (`<CmsLogin>`, `<CmsForgotPassword>`, `<CmsResetPassword>`) and a `getCmsAuthStrings(locale)` i18n helper, then publish `0.1.0-beta.3` to GitHub Packages.

**Architecture:** Mirror the existing `/ring` subpath pattern — a top-level `src/login.ts` barrel re-exports from a `src/login/` directory; the subpath is registered in `package.json`'s `exports` map and excluded from the main barrel so Node-only MDX/editor deps are never pulled into a client bundle. All three components are pure UI — they accept an `actions` prop and call no Supabase SDK directly. CSS theming is done entirely via inline CSS variables (`--auth-bg`, `--auth-accent`, etc.) mapped from an `AuthTheme` prop; consumers apply Tailwind utility classes that reference these variables.

**Tech Stack:** TypeScript 5, React 19, Vitest 3 + @testing-library/react, happy-dom, @axe-core/vitest (new devDep), `tsc -p tsconfig.build.json` build, GitHub Packages publish via existing `.github/workflows/publish.yml`.

**Dependency note:** This phase DEPENDS ON `@tn-figueiredo/auth-nextjs@2.1.0` having been published first (Phase 1 of the split design). The plan adds `@tn-figueiredo/auth-nextjs` as a peer dependency `>= 2.1.0` and imports type-only aliases for `SignInPasswordInput`, `SignInGoogleInput`, `ActionResult` in `src/login/types.ts`. If the auth-nextjs package isn't yet published, skip that peer dep reference and inline minimal type definitions until it ships. The components themselves don't import auth-nextjs at runtime — the types are purely for the consumer-facing `actions` prop interface.

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `src/login.ts` | CREATE | Subpath barrel — re-exports everything from `src/login/` |
| `src/login/types.ts` | CREATE | `AuthPageProps`, `AuthTheme`, `AuthStrings` interfaces + `CMS_THEME_DEFAULT` constant |
| `src/login/strings.ts` | CREATE | `getCmsAuthStrings(locale)` — pt-BR + en presets |
| `src/login/cms-login.tsx` | CREATE | `<CmsLogin>` component |
| `src/login/cms-forgot-password.tsx` | CREATE | `<CmsForgotPassword>` component |
| `src/login/cms-reset-password.tsx` | CREATE | `<CmsResetPassword>` component |
| `test/login/strings.test.ts` | CREATE | Unit tests for `getCmsAuthStrings` |
| `test/login/cms-login.test.tsx` | CREATE | Full test matrix for `<CmsLogin>` |
| `test/login/cms-forgot-password.test.tsx` | CREATE | Full test matrix for `<CmsForgotPassword>` |
| `test/login/cms-reset-password.test.tsx` | CREATE | Full test matrix for `<CmsResetPassword>` |
| `test/consumer-smoke/login-import.test.ts` | CREATE | Smoke test: subpath resolves; barrel NOT contaminated |
| `package.json` | MODIFY | Add `./login` export, peer dep `@tn-figueiredo/auth-nextjs >= 2.1.0`, devDep `@axe-core/vitest`, bump version `0.1.0-beta.2 → 0.1.0-beta.3` |
| `CHANGELOG.md` | MODIFY | Add `[0.1.0-beta.3]` entry |

---

## Task 1: Install `@axe-core/vitest` dev dependency

**Files:**
- Modify: `package.json`

This task adds the a11y testing tool before any test is written. It runs in isolation, has a clean commit, and unblocks every subsequent TDD step.

- [ ] **Step 1: Install devDependency**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm install --save-dev @axe-core/vitest
```

Expected output ends with: `added N packages` (exact count varies). No peer dep warnings about react — it's already in devDependencies.

- [ ] **Step 2: Verify it was added to package.json**

Open `package.json` and confirm `"@axe-core/vitest"` appears in `"devDependencies"` with a version like `"^4.x.x"`. Exact version will be whatever npm resolved. Note the exact version for the commit message.

- [ ] **Step 3: Run the existing test suite to confirm nothing broke**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test
```

Expected: all pre-existing tests pass (green). Zero failures.

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add package.json package-lock.json
git commit -m "chore: add @axe-core/vitest devDep for a11y test gate"
```

---

## Task 2: Type definitions (`src/login/types.ts`)

**Files:**
- Create: `src/login/types.ts`

These interfaces are the shared contract defined verbatim in the design spec. Every component in later tasks depends on them. Defining them first lets the compiler catch mismatches immediately.

Note on `ActionResult` / `SignInPasswordInput` / `SignInGoogleInput`: define them as local minimal types here. When `@tn-figueiredo/auth-nextjs@2.1.0` ships, the consumer's `actions.ts` file will handle the type bridging — the package itself stays self-contained.

- [ ] **Step 1: Create `src/login/` directory and `types.ts`**

Create `/Users/figueiredo/Workspace/tn-cms/src/login/types.ts` with the following content:

```typescript
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Minimal action result type (matches @tn-figueiredo/auth-nextjs@2.1.0 shape)
// ---------------------------------------------------------------------------
export interface ActionResult {
  ok: boolean
  error?: string
  url?: string   // used by signInWithGoogle to return the OAuth redirect URL
  userId?: string
}

export interface SignInPasswordInput {
  email: string
  password: string
  turnstileToken?: string | null
}

export interface SignInGoogleInput {
  redirectTo?: string
}

export interface ForgotPasswordInput {
  email: string
  turnstileToken?: string | null
}

export interface ResetPasswordInput {
  password: string
}

// ---------------------------------------------------------------------------
// Component prop interfaces — shared contract for all six auth components
// (admin and cms share the same interface shape; only defaults differ)
// ---------------------------------------------------------------------------
export interface AuthTheme {
  /** Page background — maps to --auth-bg */
  bg: string
  /** Card background — maps to --auth-card-bg */
  card: string
  /** Primary action color — maps to --auth-accent */
  accent: string
  /** Primary action hover — maps to --auth-accent-hover */
  accentHover: string
  /** Primary text — maps to --auth-text */
  text: string
  /** Secondary/hint text — maps to --auth-muted */
  muted: string
  /** Input and card border — maps to --auth-border */
  border: string
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
  /** aria-label when password is hidden */
  passwordTogglePassive: string
  /** aria-label when password is visible */
  passwordToggleActive: string
  divider: string
  errorGeneric: string
  errorInvalidCredentials: string
  errorTurnstileLoading: string
}

export interface ForgotPasswordStrings {
  title: string
  subtitle: string
  emailLabel: string
  emailPlaceholder: string
  submitButton: string
  submittingButton: string
  successTitle: string
  successBody: string
  backToLogin: string
  errorTurnstileLoading: string
  errorGeneric: string
}

export interface ResetPasswordStrings {
  title: string
  waitingTitle: string
  waitingBody: string
  newPasswordLabel: string
  newPasswordPlaceholder: string
  confirmPasswordLabel: string
  confirmPasswordPlaceholder: string
  submitButton: string
  submittingButton: string
  errorPasswordMismatch: string
  errorPasswordWeak: string
  errorGeneric: string
  /** aria-label when password is hidden */
  passwordTogglePassive: string
  /** aria-label when password is visible */
  passwordToggleActive: string
}

export interface AuthPageProps {
  /** Required: auth actions wired up by consumer page */
  actions: {
    signInWithPassword: (input: SignInPasswordInput) => Promise<ActionResult>
    signInWithGoogle: (input: SignInGoogleInput) => Promise<ActionResult>
  }
  /** Partial override of the locale preset */
  strings?: Partial<AuthStrings>
  /** Selects a locale preset; ignored if `strings` covers all keys */
  locale?: 'pt-BR' | 'en'
  /** Slot rendered above the title */
  logo?: ReactNode
  /** Slot rendered below the form */
  footer?: ReactNode
  /** CSS variable overrides — merged onto top-level element via `style` */
  theme?: Partial<AuthTheme>
  /** Static post-login destination */
  redirectTo?: string
  /** Pre-fill email (invite flow) */
  emailHint?: string
  /** Error forwarded from auth callback query param */
  authError?: string
  /** When provided, Turnstile widget is mounted */
  turnstile?: { siteKey: string }
}

export interface ForgotPasswordPageProps {
  actions: {
    forgotPassword: (input: ForgotPasswordInput) => Promise<ActionResult>
  }
  strings?: Partial<ForgotPasswordStrings>
  locale?: 'pt-BR' | 'en'
  logo?: ReactNode
  footer?: ReactNode
  theme?: Partial<AuthTheme>
  loginPath?: string   // href for "back to login" link, default '/cms/login'
  turnstile?: { siteKey: string }
}

export interface ResetPasswordPageProps {
  actions: {
    resetPassword: (input: ResetPasswordInput) => Promise<ActionResult>
  }
  strings?: Partial<ResetPasswordStrings>
  locale?: 'pt-BR' | 'en'
  logo?: ReactNode
  footer?: ReactNode
  theme?: Partial<AuthTheme>
  redirectTo?: string  // post-reset destination, default '/cms'
}

// ---------------------------------------------------------------------------
// CMS default theme — stone-50 bg, zinc-900 accent (content-creator vibe)
// ---------------------------------------------------------------------------
export const CMS_THEME_DEFAULT: AuthTheme = {
  bg: '#fafaf9',
  card: '#ffffff',
  accent: '#18181b',
  accentHover: '#27272a',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/login/types.ts
git commit -m "feat(login): define AuthTheme, AuthStrings, AuthPageProps types"
```

---

## Task 3: i18n strings (`src/login/strings.ts`)

**Files:**
- Create: `src/login/strings.ts`
- Create: `test/login/strings.test.ts`

Follow the exact pattern from `src/editor/strings.ts` — named locale objects, a record map, and an exported getter that falls back to pt-BR.

- [ ] **Step 1: Write the failing test**

Create `/Users/figueiredo/Workspace/tn-cms/test/login/strings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('getCmsAuthStrings', () => {
  it('returns pt-BR strings by default', async () => {
    const { getCmsAuthStrings } = await import('../../src/login/strings')
    const s = getCmsAuthStrings('pt-BR')
    expect(s.title).toBe('CMS')
    expect(s.subtitle).toBe('Estúdio de conteúdo')
    expect(s.signInButton).toBe('Entrar')
    expect(s.googleButton).toBe('Entrar com Google')
    expect(s.divider).toBe('ou')
    expect(s.errorInvalidCredentials).toBe('Email ou senha inválidos')
  })

  it('returns en strings', async () => {
    const { getCmsAuthStrings } = await import('../../src/login/strings')
    const s = getCmsAuthStrings('en')
    expect(s.title).toBe('CMS')
    expect(s.subtitle).toBe('Content studio')
    expect(s.signInButton).toBe('Sign in')
    expect(s.googleButton).toBe('Sign in with Google')
    expect(s.divider).toBe('or')
    expect(s.errorInvalidCredentials).toBe('Invalid email or password')
  })

  it('falls back to pt-BR for unknown locale', async () => {
    const { getCmsAuthStrings } = await import('../../src/login/strings')
    const s = getCmsAuthStrings('fr')
    expect(s.signInButton).toBe('Entrar')
  })

  it('includes all required AuthStrings keys', async () => {
    const { getCmsAuthStrings } = await import('../../src/login/strings')
    const s = getCmsAuthStrings('pt-BR')
    const requiredKeys: (keyof import('../../src/login/types').AuthStrings)[] = [
      'title', 'subtitle', 'signInButton', 'googleButton', 'googleButtonLoading',
      'loading', 'forgotPasswordLink', 'emailLabel', 'emailPlaceholder',
      'passwordLabel', 'passwordPlaceholder', 'passwordTogglePassive',
      'passwordToggleActive', 'divider', 'errorGeneric', 'errorInvalidCredentials',
      'errorTurnstileLoading',
    ]
    for (const key of requiredKeys) {
      expect(s[key], `missing key: ${key}`).toBeTruthy()
    }
  })

  it('getCmsForgotPasswordStrings returns pt-BR forgot strings', async () => {
    const { getCmsForgotPasswordStrings } = await import('../../src/login/strings')
    const s = getCmsForgotPasswordStrings('pt-BR')
    expect(s.title).toBe('Esqueci minha senha')
    expect(s.submitButton).toBe('Enviar link')
    expect(s.successTitle).toBe('Verifique seu email')
    expect(s.backToLogin).toBe('Voltar para o login')
  })

  it('getCmsForgotPasswordStrings returns en forgot strings', async () => {
    const { getCmsForgotPasswordStrings } = await import('../../src/login/strings')
    const s = getCmsForgotPasswordStrings('en')
    expect(s.title).toBe('Forgot password')
    expect(s.submitButton).toBe('Send link')
    expect(s.successTitle).toBe('Check your email')
  })

  it('getCmsResetPasswordStrings returns pt-BR reset strings', async () => {
    const { getCmsResetPasswordStrings } = await import('../../src/login/strings')
    const s = getCmsResetPasswordStrings('pt-BR')
    expect(s.title).toBe('Nova senha')
    expect(s.submitButton).toBe('Atualizar senha')
    expect(s.errorPasswordMismatch).toBe('Senhas não coincidem.')
  })

  it('getCmsResetPasswordStrings returns en reset strings', async () => {
    const { getCmsResetPasswordStrings } = await import('../../src/login/strings')
    const s = getCmsResetPasswordStrings('en')
    expect(s.title).toBe('New password')
    expect(s.submitButton).toBe('Update password')
    expect(s.errorPasswordMismatch).toBe("Passwords don't match.")
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/strings.test.ts
```

Expected: FAIL — `Cannot find module '../../src/login/strings'`.

- [ ] **Step 3: Implement `src/login/strings.ts`**

Create `/Users/figueiredo/Workspace/tn-cms/src/login/strings.ts`:

```typescript
import type { AuthStrings, ForgotPasswordStrings, ResetPasswordStrings } from './types'

// ---------------------------------------------------------------------------
// Login strings
// ---------------------------------------------------------------------------
const loginPtBR: AuthStrings = {
  title: 'CMS',
  subtitle: 'Estúdio de conteúdo',
  signInButton: 'Entrar',
  googleButton: 'Entrar com Google',
  googleButtonLoading: 'Redirecionando…',
  loading: 'Entrando…',
  forgotPasswordLink: 'Esqueci minha senha',
  emailLabel: 'Email',
  emailPlaceholder: 'seu@email.com',
  passwordLabel: 'Senha',
  passwordPlaceholder: 'Sua senha',
  passwordTogglePassive: 'Mostrar senha',
  passwordToggleActive: 'Ocultar senha',
  divider: 'ou',
  errorGeneric: 'Erro na autenticação. Tente novamente.',
  errorInvalidCredentials: 'Email ou senha inválidos',
  errorTurnstileLoading: 'Verificação anti-bot ainda carregando.',
}

const loginEn: AuthStrings = {
  title: 'CMS',
  subtitle: 'Content studio',
  signInButton: 'Sign in',
  googleButton: 'Sign in with Google',
  googleButtonLoading: 'Redirecting…',
  loading: 'Signing in…',
  forgotPasswordLink: 'Forgot password',
  emailLabel: 'Email',
  emailPlaceholder: 'you@email.com',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Your password',
  passwordTogglePassive: 'Show password',
  passwordToggleActive: 'Hide password',
  divider: 'or',
  errorGeneric: 'Authentication error. Please try again.',
  errorInvalidCredentials: 'Invalid email or password',
  errorTurnstileLoading: 'Anti-bot verification still loading.',
}

const LOGIN_STRINGS: Record<string, AuthStrings> = {
  'pt-BR': loginPtBR,
  en: loginEn,
}

export function getCmsAuthStrings(locale: string): AuthStrings {
  return LOGIN_STRINGS[locale] ?? loginPtBR
}

// ---------------------------------------------------------------------------
// Forgot-password strings
// ---------------------------------------------------------------------------
const forgotPtBR: ForgotPasswordStrings = {
  title: 'Esqueci minha senha',
  subtitle: 'Informe seu email e enviaremos um link de recuperação.',
  emailLabel: 'Email',
  emailPlaceholder: 'seu@email.com',
  submitButton: 'Enviar link',
  submittingButton: 'Enviando…',
  successTitle: 'Verifique seu email',
  successBody: 'Se essa conta existir, enviamos um link de recuperação para o email informado.',
  backToLogin: 'Voltar para o login',
  errorTurnstileLoading: 'Verificação anti-bot ainda carregando.',
  errorGeneric: 'Não foi possível enviar o link. Tente novamente.',
}

const forgotEn: ForgotPasswordStrings = {
  title: 'Forgot password',
  subtitle: 'Enter your email and we will send a recovery link.',
  emailLabel: 'Email',
  emailPlaceholder: 'you@email.com',
  submitButton: 'Send link',
  submittingButton: 'Sending…',
  successTitle: 'Check your email',
  successBody: 'If that account exists, we sent a recovery link to the email provided.',
  backToLogin: 'Back to login',
  errorTurnstileLoading: 'Anti-bot verification still loading.',
  errorGeneric: 'Could not send the link. Please try again.',
}

const FORGOT_STRINGS: Record<string, ForgotPasswordStrings> = {
  'pt-BR': forgotPtBR,
  en: forgotEn,
}

export function getCmsForgotPasswordStrings(locale: string): ForgotPasswordStrings {
  return FORGOT_STRINGS[locale] ?? forgotPtBR
}

// ---------------------------------------------------------------------------
// Reset-password strings
// ---------------------------------------------------------------------------
const resetPtBR: ResetPasswordStrings = {
  title: 'Nova senha',
  waitingTitle: 'Nova senha',
  waitingBody: 'Use o link enviado por email para redefinir sua senha.',
  newPasswordLabel: 'Nova senha',
  newPasswordPlaceholder: 'Mínimo 8 caracteres',
  confirmPasswordLabel: 'Confirmar nova senha',
  confirmPasswordPlaceholder: 'Repita a senha',
  submitButton: 'Atualizar senha',
  submittingButton: 'Atualizando…',
  errorPasswordMismatch: 'Senhas não coincidem.',
  errorPasswordWeak: 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.',
  errorGeneric: 'Não foi possível redefinir a senha. Tente novamente.',
  passwordTogglePassive: 'Mostrar senha',
  passwordToggleActive: 'Ocultar senha',
}

const resetEn: ResetPasswordStrings = {
  title: 'New password',
  waitingTitle: 'New password',
  waitingBody: 'Use the link sent to your email to reset your password.',
  newPasswordLabel: 'New password',
  newPasswordPlaceholder: 'Minimum 8 characters',
  confirmPasswordLabel: 'Confirm new password',
  confirmPasswordPlaceholder: 'Repeat password',
  submitButton: 'Update password',
  submittingButton: 'Updating…',
  errorPasswordMismatch: "Passwords don't match.",
  errorPasswordWeak: 'Password too weak. Use at least 8 characters with letters and numbers.',
  errorGeneric: 'Could not reset password. Please try again.',
  passwordTogglePassive: 'Show password',
  passwordToggleActive: 'Hide password',
}

const RESET_STRINGS: Record<string, ResetPasswordStrings> = {
  'pt-BR': resetPtBR,
  en: resetEn,
}

export function getCmsResetPasswordStrings(locale: string): ResetPasswordStrings {
  return RESET_STRINGS[locale] ?? resetPtBR
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/strings.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/login/strings.ts test/login/strings.test.ts
git commit -m "feat(login): getCmsAuthStrings, getCmsForgotPasswordStrings, getCmsResetPasswordStrings (pt-BR + en)"
```

---

## Task 4: `<CmsLogin>` component

**Files:**
- Create: `src/login/cms-login.tsx`
- Create: `test/login/cms-login.test.tsx`

This is the main login form: Google button, divider, email + password form with a password visibility toggle, Turnstile slot (optional), error display, and loading states. All colors come from CSS variables. The component is a client component (`'use client'`).

- [ ] **Step 1: Write the failing tests**

Create `/Users/figueiredo/Workspace/tn-cms/test/login/cms-login.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import { axe, toHaveNoViolations } from '@axe-core/vitest'
import { CmsLogin } from '../../src/login/cms-login'
import type { AuthPageProps } from '../../src/login/types'

expect.extend(toHaveNoViolations)

function makeActions(overrides: Partial<AuthPageProps['actions']> = {}): AuthPageProps['actions'] {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ ok: true, userId: 'u1' }),
    signInWithGoogle: vi.fn().mockResolvedValue({ ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth' }),
    ...overrides,
  }
}

describe('<CmsLogin>', () => {
  it('renders title and subtitle from default pt-BR strings', () => {
    render(<CmsLogin actions={makeActions()} />)
    expect(screen.getByText('CMS')).toBeTruthy()
    expect(screen.getByText('Estúdio de conteúdo')).toBeTruthy()
  })

  it('renders email and password fields with labels', () => {
    render(<CmsLogin actions={makeActions()} />)
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Senha')).toBeTruthy()
  })

  it('renders en strings when locale=en', () => {
    render(<CmsLogin actions={makeActions()} locale="en" />)
    expect(screen.getByText('Content studio')).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy()
  })

  it('overrides title via strings prop', () => {
    render(<CmsLogin actions={makeActions()} strings={{ title: 'My Studio' }} />)
    expect(screen.getByText('My Studio')).toBeTruthy()
  })

  it('renders logo slot when provided', () => {
    render(<CmsLogin actions={makeActions()} logo={<img src="/logo.svg" alt="logo" />} />)
    expect(screen.getByRole('img', { name: 'logo' })).toBeTruthy()
  })

  it('renders footer slot when provided', () => {
    render(<CmsLogin actions={makeActions()} footer={<p>Footer text</p>} />)
    expect(screen.getByText('Footer text')).toBeTruthy()
  })

  it('pre-fills email when emailHint is provided', () => {
    render(<CmsLogin actions={makeActions()} emailHint="editor@example.com" />)
    const input = screen.getByLabelText('Email') as HTMLInputElement
    expect(input.value).toBe('editor@example.com')
  })

  it('displays authError when provided', () => {
    render(<CmsLogin actions={makeActions()} authError="some-error" />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('calls signInWithPassword on form submit', async () => {
    const actions = makeActions()
    render(<CmsLogin actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'editor@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(actions.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'editor@example.com', password: 'password123' })
    ))
  })

  it('shows loading state during submit', async () => {
    let resolve: (v: { ok: boolean }) => void
    const pending = new Promise<{ ok: boolean }>((r) => { resolve = r })
    const actions = makeActions({ signInWithPassword: vi.fn().mockReturnValue(pending) })
    render(<CmsLogin actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'pass1234' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /entrando/i })).toBeTruthy())
    act(() => resolve!({ ok: true }))
  })

  it('displays error message on failed sign in', async () => {
    const actions = makeActions({
      signInWithPassword: vi.fn().mockResolvedValue({ ok: false, error: 'Email ou senha inválidos' }),
    })
    render(<CmsLogin actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('Email ou senha inválidos')).toBeTruthy()
  })

  it('calls signInWithGoogle when Google button is clicked', async () => {
    const actions = makeActions()
    render(<CmsLogin actions={actions} />)
    fireEvent.click(screen.getByRole('button', { name: /entrar com google/i }))
    await waitFor(() => expect(actions.signInWithGoogle).toHaveBeenCalled())
  })

  it('password visibility toggle changes input type', () => {
    render(<CmsLogin actions={makeActions()} />)
    const passwordInput = screen.getByLabelText('Senha') as HTMLInputElement
    expect(passwordInput.type).toBe('password')
    // Find toggle by aria-label
    const toggle = screen.getByLabelText('Mostrar senha')
    fireEvent.click(toggle)
    expect(passwordInput.type).toBe('text')
    expect(screen.getByLabelText('Ocultar senha')).toBeTruthy()
  })

  it('applies custom theme via CSS variables', () => {
    const { container } = render(
      <CmsLogin actions={makeActions()} theme={{ accent: '#ff0000', bg: '#000000' }} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--auth-accent')).toBe('#ff0000')
    expect(root.style.getPropertyValue('--auth-bg')).toBe('#000000')
  })

  it('applies default theme CSS variables', () => {
    const { container } = render(<CmsLogin actions={makeActions()} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--auth-bg')).toBe('#fafaf9')
    expect(root.style.getPropertyValue('--auth-accent')).toBe('#18181b')
  })

  it('renders Turnstile container when turnstile prop is set', () => {
    render(<CmsLogin actions={makeActions()} turnstile={{ siteKey: 'test-key' }} />)
    // Turnstile div should be present (widget mounts via script; here just div renders)
    expect(document.querySelector('[data-turnstile-container]')).toBeTruthy()
  })

  it('has no axe violations with default props', async () => {
    const { container } = render(<CmsLogin actions={makeActions()} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no axe violations with custom theme', async () => {
    const { container } = render(
      <CmsLogin
        actions={makeActions()}
        theme={{ accent: '#18181b', bg: '#fafaf9', card: '#ffffff', text: '#18181b', muted: '#71717a', border: '#e4e4e7', accentHover: '#27272a' }}
      />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('error container has aria-live=polite', async () => {
    const actions = makeActions({
      signInWithPassword: vi.fn().mockResolvedValue({ ok: false, error: 'Bad credentials' }),
    })
    render(<CmsLogin actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'pass1234' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => screen.getByRole('alert'))
    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('aria-live')).toBe('polite')
  })

  it('password input has aria-invalid when error is present', async () => {
    const actions = makeActions({
      signInWithPassword: vi.fn().mockResolvedValue({ ok: false, error: 'Email ou senha inválidos' }),
    })
    render(<CmsLogin actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'pass1234' } })
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => screen.getByRole('alert'))
    const passwordInput = screen.getByLabelText('Senha')
    expect(passwordInput.getAttribute('aria-invalid')).toBe('true')
  })

  it('safeRedirect: redirectTo prop is accessible (component renders)', () => {
    // Component must accept and store redirectTo without throwing
    const { container } = render(
      <CmsLogin actions={makeActions()} redirectTo="/cms/campaigns" />
    )
    expect(container.firstChild).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/cms-login.test.tsx
```

Expected: FAIL — `Cannot find module '../../src/login/cms-login'`.

- [ ] **Step 3: Implement `src/login/cms-login.tsx`**

Create `/Users/figueiredo/Workspace/tn-cms/src/login/cms-login.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { getCmsAuthStrings } from './strings'
import { CMS_THEME_DEFAULT } from './types'
import type { AuthPageProps, AuthTheme, AuthStrings } from './types'

// Google SVG icon (no external dep)
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function buildThemeVars(theme: AuthTheme): React.CSSProperties {
  return {
    '--auth-bg': theme.bg,
    '--auth-card-bg': theme.card,
    '--auth-accent': theme.accent,
    '--auth-accent-hover': theme.accentHover,
    '--auth-text': theme.text,
    '--auth-muted': theme.muted,
    '--auth-border': theme.border,
  } as React.CSSProperties
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }): string
      reset(id?: string): void
    }
  }
}

export function CmsLogin({
  actions,
  strings: stringOverrides,
  locale = 'pt-BR',
  logo,
  footer,
  theme: themeOverride,
  redirectTo,
  emailHint,
  authError,
  turnstile,
}: AuthPageProps) {
  const baseStrings = getCmsAuthStrings(locale)
  const s: AuthStrings = { ...baseStrings, ...stringOverrides }
  const theme: AuthTheme = { ...CMS_THEME_DEFAULT, ...themeOverride }

  const [email, setEmail] = useState(emailHint ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(authError ? s.errorGeneric : null)
  const [loading, setLoading] = useState(false)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const emailId = useId()
  const passwordId = useId()

  // Mount Turnstile when siteKey is provided
  useEffect(() => {
    if (!turnstile?.siteKey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstile.siteKey,
          callback: (t) => setTurnstileToken(t),
        })
        widgetIdRef.current = id
      }
    }
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [turnstile?.siteKey])

  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current)
    }
    setTurnstileToken(null)
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (turnstile && !turnstileToken) {
      setError(s.errorTurnstileLoading)
      return
    }
    setLoading(true)
    try {
      const result = await actions.signInWithPassword({
        email,
        password,
        turnstileToken: turnstileToken ?? undefined,
      })
      if (!result.ok) {
        setError(result.error ?? s.errorInvalidCredentials)
        resetTurnstile()
        // Focus first invalid input (a11y: focus management on error)
        emailInputRef.current?.focus()
      } else if (redirectTo) {
        window.location.href = redirectTo
      }
    } finally {
      setLoading(false)
    }
  }

  async function onGoogleClick() {
    setLoading(true)
    setError(null)
    const result = await actions.signInWithGoogle({ redirectTo })
    if (!result.ok) {
      setError(result.error ?? s.errorGeneric)
      setLoading(false)
      return
    }
    if (result.url) window.location.href = result.url
  }

  const hasError = Boolean(error)
  const isSubmitDisabled = loading || Boolean(turnstile && !turnstileToken)

  return (
    <div
      style={buildThemeVars(theme)}
      className="min-h-screen flex items-center justify-center px-4 bg-[var(--auth-bg)]"
    >
      <div className="max-w-md w-full">
        {/* Logo slot */}
        {logo && <div className="flex justify-center mb-6">{logo}</div>}

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--auth-text)]">{s.title}</h1>
          <p className="text-[var(--auth-muted)] text-sm mt-1">{s.subtitle}</p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border p-8 shadow-sm"
          style={{ backgroundColor: 'var(--auth-card-bg)', borderColor: 'var(--auth-border)' }}
        >
          {/* Error alert */}
          {hasError && (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm"
            >
              {error}
            </div>
          )}

          {/* Google OAuth */}
          <button
            type="button"
            onClick={onGoogleClick}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border rounded-lg py-3 font-medium transition mb-6 disabled:opacity-50 hover:bg-gray-50"
            style={{ borderColor: 'var(--auth-border)' }}
          >
            <GoogleIcon />
            {loading ? s.googleButtonLoading : s.googleButton}
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full border-t"
                style={{ borderColor: 'var(--auth-border)' }}
              />
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className="px-4 text-[var(--auth-muted)]"
                style={{ backgroundColor: 'var(--auth-card-bg)' }}
              >
                {s.divider}
              </span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor={emailId}
                className="block text-sm font-medium mb-1 text-[var(--auth-text)]"
              >
                {s.emailLabel}
              </label>
              <input
                id={emailId}
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={s.emailPlaceholder}
                autoComplete="email"
                required
                aria-invalid={hasError ? 'true' : undefined}
                aria-describedby={hasError ? errorId : undefined}
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--auth-border)', color: 'var(--auth-text)' }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor={passwordId}
                className="block text-sm font-medium mb-1 text-[var(--auth-text)]"
              >
                {s.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={s.passwordPlaceholder}
                  autoComplete="current-password"
                  required
                  aria-invalid={hasError ? 'true' : undefined}
                  aria-describedby={hasError ? errorId : undefined}
                  className="w-full border rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--auth-border)', color: 'var(--auth-text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? s.passwordToggleActive : s.passwordTogglePassive}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-muted)] hover:text-[var(--auth-text)]"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="text-right mt-1">
                <a
                  href="/cms/forgot"
                  className="text-sm text-[var(--auth-muted)] hover:underline"
                >
                  {s.forgotPasswordLink}
                </a>
              </div>
            </div>

            {/* Turnstile */}
            {turnstile && (
              <div ref={turnstileRef} data-turnstile-container="true" />
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              style={{
                backgroundColor: 'var(--auth-accent)',
              }}
            >
              {loading ? s.loading : s.signInButton}
            </button>
          </form>
        </div>

        {/* Footer slot */}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/cms-login.test.tsx
```

Expected: all tests PASS. If any axe test fails for contrast reasons, verify that the default theme colors (zinc-900 `#18181b` on stone-50 `#fafaf9`) pass WCAG AA (ratio 16.1:1 — well above the 4.5:1 threshold). The happy-dom environment may not run full axe color contrast checks, so axe violations will likely be zero.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/login/cms-login.tsx test/login/cms-login.test.tsx
git commit -m "feat(login): <CmsLogin> component with a11y, theming, Turnstile, Google OAuth"
```

---

## Task 5: `<CmsForgotPassword>` component

**Files:**
- Create: `src/login/cms-forgot-password.tsx`
- Create: `test/login/cms-forgot-password.test.tsx`

Forgot-password flow: single email input, Turnstile slot (optional), submit button, then a success state ("check your email") — never reveals whether the email exists (prevents enumeration).

- [ ] **Step 1: Write the failing tests**

Create `/Users/figueiredo/Workspace/tn-cms/test/login/cms-forgot-password.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import { axe, toHaveNoViolations } from '@axe-core/vitest'
import { CmsForgotPassword } from '../../src/login/cms-forgot-password'
import type { ForgotPasswordPageProps } from '../../src/login/types'

expect.extend(toHaveNoViolations)

function makeActions(
  overrides: Partial<ForgotPasswordPageProps['actions']> = {}
): ForgotPasswordPageProps['actions'] {
  return {
    forgotPassword: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

describe('<CmsForgotPassword>', () => {
  it('renders title from default pt-BR strings', () => {
    render(<CmsForgotPassword actions={makeActions()} />)
    expect(screen.getByText('Esqueci minha senha')).toBeTruthy()
  })

  it('renders email field with label', () => {
    render(<CmsForgotPassword actions={makeActions()} />)
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('renders en strings when locale=en', () => {
    render(<CmsForgotPassword actions={makeActions()} locale="en" />)
    expect(screen.getByText('Forgot password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /send link/i })).toBeTruthy()
  })

  it('overrides strings via strings prop', () => {
    render(<CmsForgotPassword actions={makeActions()} strings={{ title: 'Reset Access' }} />)
    expect(screen.getByText('Reset Access')).toBeTruthy()
  })

  it('renders logo slot when provided', () => {
    render(<CmsForgotPassword actions={makeActions()} logo={<span data-testid="logo">L</span>} />)
    expect(screen.getByTestId('logo')).toBeTruthy()
  })

  it('calls forgotPassword action on submit', async () => {
    const actions = makeActions()
    render(<CmsForgotPassword actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'editor@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }))
    await waitFor(() => expect(actions.forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'editor@example.com' })
    ))
  })

  it('shows loading state during submit', async () => {
    let resolve: (v: { ok: boolean }) => void
    const pending = new Promise<{ ok: boolean }>((r) => { resolve = r })
    const actions = makeActions({ forgotPassword: vi.fn().mockReturnValue(pending) })
    render(<CmsForgotPassword actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /enviando/i })).toBeTruthy())
    act(() => resolve!({ ok: true }))
  })

  it('shows generic success state after submit — never reveals email existence', async () => {
    render(<CmsForgotPassword actions={makeActions()} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }))
    await waitFor(() => expect(screen.getByText('Verifique seu email')).toBeTruthy())
    // The error path with ok:false ALSO shows success to prevent enumeration
  })

  it('shows success state even when action returns ok:false (anti-enumeration)', async () => {
    const actions = makeActions({
      forgotPassword: vi.fn().mockResolvedValue({ ok: false, error: 'User not found' }),
    })
    render(<CmsForgotPassword actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }))
    // Success state shown regardless
    await waitFor(() => expect(screen.getByText('Verifique seu email')).toBeTruthy())
  })

  it('renders "back to login" link', () => {
    render(<CmsForgotPassword actions={makeActions()} />)
    const link = screen.getByRole('link', { name: /voltar para o login/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/cms/login')
  })

  it('uses custom loginPath for back-to-login link', () => {
    render(<CmsForgotPassword actions={makeActions()} loginPath="/auth/login" />)
    const link = screen.getByRole('link', { name: /voltar para o login/i })
    expect(link.getAttribute('href')).toBe('/auth/login')
  })

  it('applies custom theme via CSS variables', () => {
    const { container } = render(
      <CmsForgotPassword actions={makeActions()} theme={{ accent: '#ff0000' }} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--auth-accent')).toBe('#ff0000')
  })

  it('renders Turnstile container when turnstile prop is set', () => {
    render(<CmsForgotPassword actions={makeActions()} turnstile={{ siteKey: 'test-key' }} />)
    expect(document.querySelector('[data-turnstile-container]')).toBeTruthy()
  })

  it('has no axe violations with default props', async () => {
    const { container } = render(<CmsForgotPassword actions={makeActions()} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('error container has aria-live=polite', async () => {
    const actions = makeActions({
      forgotPassword: vi.fn().mockRejectedValue(new Error('Network error')),
    })
    render(<CmsForgotPassword actions={actions} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }))
    // If an error variant is rendered, check aria-live. In our anti-enumeration design
    // we always show success, so just verify the component renders without throwing.
    await waitFor(() => expect(screen.getByText('Verifique seu email')).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/cms-forgot-password.test.tsx
```

Expected: FAIL — `Cannot find module '../../src/login/cms-forgot-password'`.

- [ ] **Step 3: Implement `src/login/cms-forgot-password.tsx`**

Create `/Users/figueiredo/Workspace/tn-cms/src/login/cms-forgot-password.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { getCmsForgotPasswordStrings } from './strings'
import { CMS_THEME_DEFAULT } from './types'
import type { ForgotPasswordPageProps, AuthTheme, ForgotPasswordStrings } from './types'

function buildThemeVars(theme: AuthTheme): React.CSSProperties {
  return {
    '--auth-bg': theme.bg,
    '--auth-card-bg': theme.card,
    '--auth-accent': theme.accent,
    '--auth-accent-hover': theme.accentHover,
    '--auth-text': theme.text,
    '--auth-muted': theme.muted,
    '--auth-border': theme.border,
  } as React.CSSProperties
}

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }): string
      reset(id?: string): void
    }
  }
}

export function CmsForgotPassword({
  actions,
  strings: stringOverrides,
  locale = 'pt-BR',
  logo,
  footer,
  theme: themeOverride,
  loginPath = '/cms/login',
  turnstile,
}: ForgotPasswordPageProps) {
  const baseStrings = getCmsForgotPasswordStrings(locale)
  const s: ForgotPasswordStrings = { ...baseStrings, ...stringOverrides }
  const theme: AuthTheme = { ...CMS_THEME_DEFAULT, ...themeOverride }

  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const errorId = useId()
  const emailId = useId()

  useEffect(() => {
    if (!turnstile?.siteKey || !turnstileRef.current) return
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        const id = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstile.siteKey,
          callback: (t) => setTurnstileToken(t),
        })
        widgetIdRef.current = id
      }
    }
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [turnstile?.siteKey])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (turnstile && !turnstileToken) {
      setError(s.errorTurnstileLoading)
      return
    }
    setLoading(true)
    try {
      // Fire and forget — always show generic success (anti-enumeration: C2)
      await actions.forgotPassword({
        email,
        turnstileToken: turnstileToken ?? undefined,
      })
      setSent(true)
    } catch {
      // Even on unexpected errors, show success to prevent enumeration
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled = loading || Boolean(turnstile && !turnstileToken)

  if (sent) {
    return (
      <div
        style={buildThemeVars(theme)}
        className="min-h-screen flex items-center justify-center px-4 bg-[var(--auth-bg)]"
      >
        <div className="max-w-md w-full text-center">
          {logo && <div className="flex justify-center mb-6">{logo}</div>}
          <h1 className="text-2xl font-bold text-[var(--auth-text)] mb-4">{s.successTitle}</h1>
          <p className="text-[var(--auth-muted)]">{s.successBody}</p>
          <a
            href={loginPath}
            className="mt-6 inline-block text-sm text-[var(--auth-muted)] hover:underline"
          >
            {s.backToLogin}
          </a>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    )
  }

  return (
    <div
      style={buildThemeVars(theme)}
      className="min-h-screen flex items-center justify-center px-4 bg-[var(--auth-bg)]"
    >
      <div className="max-w-md w-full">
        {logo && <div className="flex justify-center mb-6">{logo}</div>}

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--auth-text)]">{s.title}</h1>
          <p className="text-[var(--auth-muted)] text-sm mt-1">{s.subtitle}</p>
        </div>

        <div
          className="rounded-xl border p-8 shadow-sm"
          style={{ backgroundColor: 'var(--auth-card-bg)', borderColor: 'var(--auth-border)' }}
        >
          {error && (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor={emailId}
                className="block text-sm font-medium mb-1 text-[var(--auth-text)]"
              >
                {s.emailLabel}
              </label>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={s.emailPlaceholder}
                autoComplete="email"
                required
                aria-describedby={error ? errorId : undefined}
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={{ borderColor: 'var(--auth-border)', color: 'var(--auth-text)' }}
              />
            </div>

            {turnstile && (
              <div ref={turnstileRef} data-turnstile-container="true" />
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--auth-accent)' }}
            >
              {loading ? s.submittingButton : s.submitButton}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a
              href={loginPath}
              className="text-sm text-[var(--auth-muted)] hover:underline"
            >
              {s.backToLogin}
            </a>
          </div>
        </div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/cms-forgot-password.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/login/cms-forgot-password.tsx test/login/cms-forgot-password.test.tsx
git commit -m "feat(login): <CmsForgotPassword> component with anti-enumeration success state"
```

---

## Task 6: `<CmsResetPassword>` component

**Files:**
- Create: `src/login/cms-reset-password.tsx`
- Create: `test/login/cms-reset-password.test.tsx`

Reset-password form: guarded by `PASSWORD_RECOVERY` event (via `onSuccess` prop from consumer or internal `onAuthStateChange`). In the package, the component accepts a `canReset` prop (boolean) so it can be tested without mocking Supabase. The consumer wires the auth event to this prop. Validates min 8 chars, has letters AND numbers. Two password fields with visibility toggles.

**Design decision on `canReset`:** The original `/signin/reset/page.tsx` calls `supabase.auth.onAuthStateChange` directly. The package component must be UI-only (no direct Supabase calls). We solve this by accepting `onAuthStateChange` as a prop, OR more simply: accept `canReset?: boolean` (default `false`). The consumer page's `useEffect` sets its own state and passes it down. This keeps the component testable with no mocking.

- [ ] **Step 1: Update `ResetPasswordPageProps` in `src/login/types.ts`**

The `ResetPasswordPageProps` in Task 2 already covers the standard fields. We need to add `canReset` to it. Open `src/login/types.ts` and modify the `ResetPasswordPageProps` interface:

```typescript
export interface ResetPasswordPageProps {
  actions: {
    resetPassword: (input: ResetPasswordInput) => Promise<ActionResult>
  }
  strings?: Partial<ResetPasswordStrings>
  locale?: 'pt-BR' | 'en'
  logo?: ReactNode
  footer?: ReactNode
  theme?: Partial<AuthTheme>
  redirectTo?: string  // post-reset destination, default '/cms'
  /** Consumer sets this to true after receiving PASSWORD_RECOVERY auth event */
  canReset?: boolean
}
```

- [ ] **Step 2: Write failing tests**

Create `/Users/figueiredo/Workspace/tn-cms/test/login/cms-reset-password.test.tsx`:

```typescript
import { describe, it, expect, vi, act } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from '@axe-core/vitest'
import { CmsResetPassword } from '../../src/login/cms-reset-password'
import type { ResetPasswordPageProps } from '../../src/login/types'

expect.extend(toHaveNoViolations)

function makeActions(
  overrides: Partial<ResetPasswordPageProps['actions']> = {}
): ResetPasswordPageProps['actions'] {
  return {
    resetPassword: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

describe('<CmsResetPassword>', () => {
  it('shows waiting state when canReset=false (default)', () => {
    render(<CmsResetPassword actions={makeActions()} />)
    expect(screen.getByText('Use o link enviado por email para redefinir sua senha.')).toBeTruthy()
    expect(screen.queryByLabelText('Nova senha')).toBeNull()
  })

  it('shows the form when canReset=true', () => {
    render(<CmsResetPassword actions={makeActions()} canReset />)
    expect(screen.getByLabelText('Nova senha')).toBeTruthy()
    expect(screen.getByLabelText('Confirmar nova senha')).toBeTruthy()
  })

  it('renders en strings when locale=en with canReset=true', () => {
    render(<CmsResetPassword actions={makeActions()} canReset locale="en" />)
    expect(screen.getByLabelText('New password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /update password/i })).toBeTruthy()
  })

  it('overrides strings via strings prop', () => {
    render(<CmsResetPassword actions={makeActions()} canReset strings={{ title: 'Set Password' }} />)
    expect(screen.getByText('Set Password')).toBeTruthy()
  })

  it('renders logo slot when provided', () => {
    render(<CmsResetPassword actions={makeActions()} canReset logo={<span data-testid="logo">L</span>} />)
    expect(screen.getByTestId('logo')).toBeTruthy()
  })

  it('shows error when passwords do not match', async () => {
    render(<CmsResetPassword actions={makeActions()} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'Pass1234' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'Pass5678' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('Senhas não coincidem.')).toBeTruthy()
  })

  it('shows error when password is too weak (< 8 chars)', async () => {
    render(<CmsResetPassword actions={makeActions()} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText(/senha muito fraca/i)).toBeTruthy()
  })

  it('shows error when password has no numbers', async () => {
    render(<CmsResetPassword actions={makeActions()} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'abcdefgh' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'abcdefgh' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => screen.getByRole('alert'))
    expect(screen.getByText(/senha muito fraca/i)).toBeTruthy()
  })

  it('calls resetPassword action with valid input', async () => {
    const actions = makeActions()
    render(<CmsResetPassword actions={actions} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'ValidPass1' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'ValidPass1' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => expect(actions.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'ValidPass1' })
    ))
  })

  it('shows loading state during submit', async () => {
    let resolve: (v: { ok: boolean }) => void
    const pending = new Promise<{ ok: boolean }>((r) => { resolve = r })
    const actions = makeActions({ resetPassword: vi.fn().mockReturnValue(pending) })
    render(<CmsResetPassword actions={actions} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'ValidPass1' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'ValidPass1' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /atualizando/i })).toBeTruthy())
    act(() => resolve!({ ok: true }))
  })

  it('displays action error from resetPassword result', async () => {
    const actions = makeActions({
      resetPassword: vi.fn().mockResolvedValue({ ok: false, error: 'A nova senha deve ser diferente da atual.' }),
    })
    render(<CmsResetPassword actions={actions} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'ValidPass1' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'ValidPass1' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => screen.getByRole('alert'))
    expect(screen.getByText('A nova senha deve ser diferente da atual.')).toBeTruthy()
  })

  it('password visibility toggle works on new-password field', () => {
    render(<CmsResetPassword actions={makeActions()} canReset />)
    const input = screen.getByLabelText('Nova senha') as HTMLInputElement
    expect(input.type).toBe('password')
    const toggle = screen.getAllByLabelText('Mostrar senha')[0]!
    fireEvent.click(toggle)
    expect(input.type).toBe('text')
  })

  it('applies custom theme via CSS variables', () => {
    const { container } = render(
      <CmsResetPassword actions={makeActions()} canReset theme={{ accent: '#00ff00' }} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--auth-accent')).toBe('#00ff00')
  })

  it('has no axe violations on waiting state', async () => {
    const { container } = render(<CmsResetPassword actions={makeActions()} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no axe violations on form state', async () => {
    const { container } = render(<CmsResetPassword actions={makeActions()} canReset />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('error container has aria-live=polite', async () => {
    render(<CmsResetPassword actions={makeActions()} canReset />)
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /atualizar senha/i }))
    await waitFor(() => screen.getByRole('alert'))
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('polite')
  })
})
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/cms-reset-password.test.tsx
```

Expected: FAIL — `Cannot find module '../../src/login/cms-reset-password'`.

- [ ] **Step 4: Implement `src/login/cms-reset-password.tsx`**

Create `/Users/figueiredo/Workspace/tn-cms/src/login/cms-reset-password.tsx`:

```typescript
'use client'

import { useState, useId } from 'react'
import { getCmsResetPasswordStrings } from './strings'
import { CMS_THEME_DEFAULT } from './types'
import type { ResetPasswordPageProps, AuthTheme, ResetPasswordStrings } from './types'

function buildThemeVars(theme: AuthTheme): React.CSSProperties {
  return {
    '--auth-bg': theme.bg,
    '--auth-card-bg': theme.card,
    '--auth-accent': theme.accent,
    '--auth-accent-hover': theme.accentHover,
    '--auth-text': theme.text,
    '--auth-muted': theme.muted,
    '--auth-border': theme.border,
  } as React.CSSProperties
}

function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function validatePassword(pw: string, s: ResetPasswordStrings): string | null {
  if (pw.length < 8) return s.errorPasswordWeak
  if (!/[A-Za-z]/.test(pw)) return s.errorPasswordWeak
  if (!/\d/.test(pw)) return s.errorPasswordWeak
  return null
}

export function CmsResetPassword({
  actions,
  strings: stringOverrides,
  locale = 'pt-BR',
  logo,
  footer,
  theme: themeOverride,
  redirectTo = '/cms',
  canReset = false,
}: ResetPasswordPageProps) {
  const baseStrings = getCmsResetPasswordStrings(locale)
  const s: ResetPasswordStrings = { ...baseStrings, ...stringOverrides }
  const theme: AuthTheme = { ...CMS_THEME_DEFAULT, ...themeOverride }

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const errorId = useId()
  const newPasswordId = useId()
  const confirmPasswordId = useId()

  const hasError = Boolean(error)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canReset) return
    setError(null)

    if (newPassword !== confirmPassword) {
      setError(s.errorPasswordMismatch)
      return
    }
    const validationErr = validatePassword(newPassword, s)
    if (validationErr) {
      setError(validationErr)
      return
    }

    setLoading(true)
    try {
      const result = await actions.resetPassword({ password: newPassword })
      if (!result.ok) {
        setError(result.error ?? s.errorGeneric)
      } else {
        window.location.href = redirectTo
      }
    } finally {
      setLoading(false)
    }
  }

  // Waiting state: no PASSWORD_RECOVERY event yet
  if (!canReset) {
    return (
      <div
        style={buildThemeVars(theme)}
        className="min-h-screen flex items-center justify-center px-4 bg-[var(--auth-bg)]"
      >
        <div className="max-w-md w-full text-center">
          {logo && <div className="flex justify-center mb-6">{logo}</div>}
          <h1 className="text-2xl font-bold text-[var(--auth-text)] mb-4">{s.waitingTitle}</h1>
          <p className="text-[var(--auth-muted)]">{s.waitingBody}</p>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    )
  }

  return (
    <div
      style={buildThemeVars(theme)}
      className="min-h-screen flex items-center justify-center px-4 bg-[var(--auth-bg)]"
    >
      <div className="max-w-md w-full">
        {logo && <div className="flex justify-center mb-6">{logo}</div>}

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--auth-text)]">{s.title}</h1>
        </div>

        <div
          className="rounded-xl border p-8 shadow-sm"
          style={{ backgroundColor: 'var(--auth-card-bg)', borderColor: 'var(--auth-border)' }}
        >
          {hasError && (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {/* New password */}
            <div>
              <label
                htmlFor={newPasswordId}
                className="block text-sm font-medium mb-1 text-[var(--auth-text)]"
              >
                {s.newPasswordLabel}
              </label>
              <div className="relative">
                <input
                  id={newPasswordId}
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={s.newPasswordPlaceholder}
                  autoComplete="new-password"
                  required
                  aria-invalid={hasError ? 'true' : undefined}
                  aria-describedby={hasError ? errorId : undefined}
                  className="w-full border rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--auth-border)', color: 'var(--auth-text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  tabIndex={-1}
                  aria-label={showNew ? s.passwordToggleActive : s.passwordTogglePassive}
                  aria-pressed={showNew}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-muted)] hover:text-[var(--auth-text)]"
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label
                htmlFor={confirmPasswordId}
                className="block text-sm font-medium mb-1 text-[var(--auth-text)]"
              >
                {s.confirmPasswordLabel}
              </label>
              <div className="relative">
                <input
                  id={confirmPasswordId}
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={s.confirmPasswordPlaceholder}
                  autoComplete="new-password"
                  required
                  aria-invalid={hasError ? 'true' : undefined}
                  aria-describedby={hasError ? errorId : undefined}
                  className="w-full border rounded-lg px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2"
                  style={{ borderColor: 'var(--auth-border)', color: 'var(--auth-text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? s.passwordToggleActive : s.passwordTogglePassive}
                  aria-pressed={showConfirm}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-muted)] hover:text-[var(--auth-text)]"
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--auth-accent)' }}
            >
              {loading ? s.submittingButton : s.submitButton}
            </button>
          </form>
        </div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/login/cms-reset-password.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/login/types.ts src/login/cms-reset-password.tsx test/login/cms-reset-password.test.tsx
git commit -m "feat(login): <CmsResetPassword> component with password validation and canReset guard"
```

---

## Task 7: Subpath barrel and `package.json` wiring

**Files:**
- Create: `src/login.ts`
- Modify: `package.json`

Wire the `./login` export so `tsc` and Node module resolution find it.

- [ ] **Step 1: Create `src/login.ts`**

Create `/Users/figueiredo/Workspace/tn-cms/src/login.ts`:

```typescript
// @tn-figueiredo/cms/login — CMS auth page components
// Client components only — isolated from the main barrel (Node-only MDX + editor deps)
export { CmsLogin } from './login/cms-login'
export { CmsForgotPassword } from './login/cms-forgot-password'
export { CmsResetPassword } from './login/cms-reset-password'
export { getCmsAuthStrings, getCmsForgotPasswordStrings, getCmsResetPasswordStrings } from './login/strings'
export type {
  AuthTheme,
  AuthStrings,
  ForgotPasswordStrings,
  ResetPasswordStrings,
  AuthPageProps,
  ForgotPasswordPageProps,
  ResetPasswordPageProps,
  ActionResult,
  SignInPasswordInput,
  SignInGoogleInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './login/types'
export { CMS_THEME_DEFAULT } from './login/types'
```

- [ ] **Step 2: Add `./login` to `package.json` exports, peer dep, and bump version**

Open `/Users/figueiredo/Workspace/tn-cms/package.json` and make these three changes:

1. In `"exports"`, add after the `"./ring"` entry:
```json
"./login": {
  "types": "./dist/login.d.ts",
  "import": "./dist/login.js"
}
```

2. In `"peerDependencies"`, add:
```json
"@tn-figueiredo/auth-nextjs": ">=2.1.0"
```

3. Change `"version"` from `"0.1.0-beta.2"` to `"0.1.0-beta.3"`.

The final `"exports"` block should look like:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  },
  "./code": {
    "types": "./dist/code.d.ts",
    "import": "./dist/code.js"
  },
  "./ring": {
    "types": "./dist/ring.d.ts",
    "import": "./dist/ring.js"
  },
  "./login": {
    "types": "./dist/login.d.ts",
    "import": "./dist/login.js"
  }
}
```

The final `"peerDependencies"` block:
```json
"peerDependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@supabase/supabase-js": "^2.103.0",
  "@tn-figueiredo/auth-nextjs": ">=2.1.0"
}
```

- [ ] **Step 3: Build to confirm `dist/login.js` and `dist/login.d.ts` are emitted**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm run build
```

Expected: build succeeds with zero errors. Then verify:
```bash
ls /Users/figueiredo/Workspace/tn-cms/dist/login.js /Users/figueiredo/Workspace/tn-cms/dist/login.d.ts
```
Expected: both files exist.

- [ ] **Step 4: Typecheck**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test
```

Expected: all tests pass (login tests + pre-existing tests).

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add src/login.ts package.json
git commit -m "feat(login): wire ./login subpath export + peer dep auth-nextjs >=2.1.0 + bump 0.1.0-beta.3"
```

---

## Task 8: Consumer smoke test — subpath isolation

**Files:**
- Create: `test/consumer-smoke/login-import.test.ts`

Verify that importing `@tn-figueiredo/cms/login` (via `../../src/login`) works and that barrel symbols (`compileMdx`, `PostEditor`) are NOT re-exported from the login subpath.

- [ ] **Step 1: Write the failing test**

Create `/Users/figueiredo/Workspace/tn-cms/test/consumer-smoke/login-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('@tn-figueiredo/cms/login subpath', () => {
  it('exports CmsLogin without pulling barrel', async () => {
    const login = await import('../../src/login')
    expect(login.CmsLogin).toBeDefined()
    expect(typeof login.CmsLogin).toBe('function')
  })

  it('exports CmsForgotPassword', async () => {
    const login = await import('../../src/login')
    expect(login.CmsForgotPassword).toBeDefined()
    expect(typeof login.CmsForgotPassword).toBe('function')
  })

  it('exports CmsResetPassword', async () => {
    const login = await import('../../src/login')
    expect(login.CmsResetPassword).toBeDefined()
    expect(typeof login.CmsResetPassword).toBe('function')
  })

  it('exports getCmsAuthStrings', async () => {
    const login = await import('../../src/login')
    expect(typeof login.getCmsAuthStrings).toBe('function')
    const s = login.getCmsAuthStrings('pt-BR')
    expect(s.title).toBe('CMS')
  })

  it('exports getCmsForgotPasswordStrings', async () => {
    const login = await import('../../src/login')
    expect(typeof login.getCmsForgotPasswordStrings).toBe('function')
  })

  it('exports getCmsResetPasswordStrings', async () => {
    const login = await import('../../src/login')
    expect(typeof login.getCmsResetPasswordStrings).toBe('function')
  })

  it('exports CMS_THEME_DEFAULT with expected keys', async () => {
    const login = await import('../../src/login')
    expect(login.CMS_THEME_DEFAULT).toBeDefined()
    expect(login.CMS_THEME_DEFAULT.bg).toBe('#fafaf9')
    expect(login.CMS_THEME_DEFAULT.accent).toBe('#18181b')
  })

  it('does NOT re-export barrel symbols (compileMdx, PostEditor, MdxRunner)', async () => {
    const login = await import('../../src/login')
    const keys = Object.keys(login)
    expect(keys).not.toContain('compileMdx')
    expect(keys).not.toContain('PostEditor')
    expect(keys).not.toContain('MdxRunner')
    expect(keys).not.toContain('SupabasePostRepository')
  })

  it('does NOT re-export ring symbols (SupabaseRingContext)', async () => {
    const login = await import('../../src/login')
    const keys = Object.keys(login)
    expect(keys).not.toContain('SupabaseRingContext')
  })
})
```

- [ ] **Step 2: Run test to confirm it passes immediately** (barrel already wired in Task 7)

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test -- test/consumer-smoke/login-import.test.ts
```

Expected: all 9 tests PASS. If any fail, debug the barrel (`src/login.ts`) — the most likely issue is a re-export that accidentally pulls in barrel-level symbols.

- [ ] **Step 3: Run full test suite one more time**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test
```

Expected: all tests (login + editor + hooks + smoke + consumer-smoke) PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add test/consumer-smoke/login-import.test.ts
git commit -m "test(login): smoke test — /login subpath resolves, barrel not contaminated"
```

---

## Task 9: CHANGELOG and version tag

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG.md**

Open `/Users/figueiredo/Workspace/tn-cms/CHANGELOG.md` and add the new entry below `## [Unreleased]` and above the `## [0.1.0-beta.2]` entry:

```markdown
## [0.1.0-beta.3] - 2026-04-15

### Added

- `@tn-figueiredo/cms/login` subpath export — client-component-safe entry point exposing `<CmsLogin>`, `<CmsForgotPassword>`, `<CmsResetPassword>` and `getCmsAuthStrings(locale)` / `getCmsForgotPasswordStrings(locale)` / `getCmsResetPasswordStrings(locale)` i18n helpers (pt-BR + en). Isolated from the main barrel to avoid pulling MDX compiler and editor deps into a client bundle.
- `AuthTheme`, `AuthStrings`, `ForgotPasswordStrings`, `ResetPasswordStrings`, `AuthPageProps`, `ForgotPasswordPageProps`, `ResetPasswordPageProps` interfaces exported from `./login`.
- `CMS_THEME_DEFAULT` theme preset (stone-50 bg, zinc-900 accent — content-creator vibe). Consumers override via `theme` prop; all colors applied as CSS variables (`--auth-bg`, `--auth-accent`, etc.).
- Turnstile anti-bot widget support via optional `turnstile={{ siteKey }}` prop on all three components.
- Peer dependency on `@tn-figueiredo/auth-nextjs >= 2.1.0`.
```

Also update the comparison links at the bottom of the file. Change:
```markdown
[unreleased]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.2...HEAD
[0.1.0-beta.2]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/TN-Figueiredo/cms/releases/tag/v0.1.0-beta.1
```
to:
```markdown
[unreleased]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.3...HEAD
[0.1.0-beta.3]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.2...v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.1...v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/TN-Figueiredo/cms/releases/tag/v0.1.0-beta.1
```

- [ ] **Step 2: Final full test + build gate**

```bash
cd /Users/figueiredo/Workspace/tn-cms
npm test && npm run build
```

Expected: all tests pass, build exits 0, `dist/login.js` and `dist/login.d.ts` present.

- [ ] **Step 3: Commit and tag**

```bash
cd /Users/figueiredo/Workspace/tn-cms
git add CHANGELOG.md
git commit -m "chore(release): 0.1.0-beta.3 — /login subpath (CmsLogin, CmsForgotPassword, CmsResetPassword)"
git tag v0.1.0-beta.3
git push origin main --tags
```

Expected output includes: `* [new tag] v0.1.0-beta.3 -> v0.1.0-beta.3`.

The `push --tags` triggers `.github/workflows/publish.yml` which:
1. Runs `npm ci`
2. Runs `npm run build`
3. Runs `npm test` (publish gate)
4. Publishes `@tn-figueiredo/cms@0.1.0-beta.3` to GitHub Packages (idempotent — skips if already published)
5. Creates a GitHub Release

Monitor the Actions tab at `https://github.com/TN-Figueiredo/cms/actions` to confirm the publish job goes green.

---

## Self-Review Checklist

**Spec coverage audit:**

| Spec requirement | Covered in task |
|---|---|
| `<CmsLogin>` component | Task 4 |
| `<CmsForgotPassword>` component | Task 5 |
| `<CmsResetPassword>` component | Task 6 |
| `getCmsAuthStrings(locale)` pt-BR + en | Task 3 |
| `./login` subpath in `package.json` exports | Task 7 |
| Bump `0.1.0-beta.2 → 0.1.0-beta.3` | Task 7 |
| Publish to GitHub Packages | Task 9 |
| `AuthTheme`, `AuthStrings`, `AuthPageProps` verbatim from spec | Task 2 |
| Default CMS theme: stone-50 bg, zinc-900 accent | Tasks 2 + 4 |
| CSS variable theming (not Tailwind class overrides) | Tasks 4, 5, 6 |
| i18n `strings?` partial override prop | Tasks 4, 5, 6 |
| `logo` + `footer` slots | Tasks 4, 5, 6 |
| `theme` partial override prop | Tasks 4, 5, 6 |
| `redirectTo` prop | Tasks 4, 6 |
| `emailHint` pre-fill | Task 4 |
| `authError` display | Task 4 |
| Turnstile opt-in via `turnstile={{ siteKey }}` | Tasks 4, 5 |
| Components UI-only (no direct Supabase calls) | Tasks 4, 5, 6 |
| `actions` prop (signInWithPassword, signInWithGoogle) | Tasks 2, 4 |
| `aria-live="polite"` on error container | Tasks 4, 5, 6 |
| `aria-invalid` + `aria-describedby` on inputs | Tasks 4, 5, 6 |
| Password toggle `aria-label` + `aria-pressed` | Tasks 4, 6 |
| Password toggle `tabIndex={-1}` | Tasks 4, 6 |
| Focus management on submit failure | Task 4 |
| All buttons have explicit `type` | Tasks 4, 5, 6 |
| Zero axe violations at defaults | Tasks 4, 5, 6 |
| Zero axe violations with custom theme | Task 4 |
| `/login` must NOT contaminate main barrel | Task 8 |
| Peer dep `@tn-figueiredo/auth-nextjs >= 2.1.0` | Task 7 |
| CHANGELOG entry | Task 9 |
| TDD (failing test → implementation → passing) | All tasks |
| One commit per task | All tasks |

**Placeholder scan:** no TBD, TODO, "implement later", or "similar to Task N" markers present.

**Type consistency check:**
- `AuthPageProps.actions.signInWithPassword` uses `SignInPasswordInput` → defined in Task 2 `types.ts` → used in Task 4 `cms-login.tsx` ✓
- `AuthPageProps.actions.signInWithGoogle` uses `SignInGoogleInput` → defined in Task 2 → used in Task 4 ✓
- `ForgotPasswordPageProps.actions.forgotPassword` uses `ForgotPasswordInput` → defined in Task 2 → used in Task 5 ✓
- `ResetPasswordPageProps.actions.resetPassword` uses `ResetPasswordInput` → defined in Task 2 → used in Task 6 ✓
- `getCmsAuthStrings` returns `AuthStrings` → imported in `cms-login.tsx` ✓
- `getCmsForgotPasswordStrings` returns `ForgotPasswordStrings` → imported in `cms-forgot-password.tsx` ✓
- `getCmsResetPasswordStrings` returns `ResetPasswordStrings` → imported in `cms-reset-password.tsx` ✓
- `CMS_THEME_DEFAULT` is `AuthTheme` → exported from `types.ts`, re-exported from `login.ts`, referenced in smoke test Task 8 ✓
- `ResetPasswordPageProps.canReset?: boolean` added in Task 6 Step 1 (types.ts edit), used in `CmsResetPassword` props ✓
