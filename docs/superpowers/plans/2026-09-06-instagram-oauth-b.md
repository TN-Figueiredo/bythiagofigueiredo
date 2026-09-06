# Commit B — `chore(oauth): extrair helpers para src/lib/oauth` + testes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair de `api/social/oauth/[provider]/{route,callback/route}.ts` os cinco módulos de `src/lib/oauth/` (`state`, `popup-result`, `consent`, `origin`, `errors`) que C3 vai consumir, e, no mesmo movimento, dar ao fluxo social vivo o que ele não tem hoje: `exp` de 30 min no `state`, sessão re-verificada no callback, `nonce` de CSP no HTML do popup e checagem de `origin` nos três listeners de `postMessage`.

**Architecture:** Cinco módulos-folha novos sob `apps/web/src/lib/oauth/` (nenhum importa outro, exceto `popup-result.ts` que consome `errors.ts` com `import type`). As duas rotas sociais passam a importá-los e perdem as cópias inline. `getCallbackUrl` **não** é extraído (fica duplicado nas duas rotas, por decisão do spec §3.0). Testes novos em `apps/web/test/api/oauth/` (todos `// @vitest-environment node`), mais a edição de `test/cms/social-oauth.test.tsx` (happy-dom, componente client).

**Tech Stack:** Next.js 16.3.4 (App Router, Route Handlers, `next/headers`), React 19, TypeScript 5 strict + `noUncheckedIndexedAccess`, `node:crypto` (`createHmac`, `timingSafeEqual`), Supabase (PostgREST via service client), `@tn-figueiredo/auth-nextjs@2.2.0` (`requireSiteScope`), `@sentry/nextjs`, Vitest (happy-dom default; `node` por pragma).

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **B**, §3.0 (integral), §3.5 (parágrafo "Listener"), §4, §6 "Commit B", §7 passo 1.

**Índice dos planos:** `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`

---

## Global Constraints

Herdadas verbatim do README dos planos — valem para **todas** as tasks abaixo.

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` (`lib/home/queries.ts`, `lib/cms/site-context.ts`, `lib/supabase/service.ts`) e `apps/web/src/lib/` (`src/lib/instagram/*`, `src/lib/notifications/*`, `src/lib/logger.ts`, `src/lib/cron-health.ts`, `src/lib/env.ts`, `src/lib/sentry-pii.ts`). Há dois `queries.ts` — sempre qualificar.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `@/lib/<domínio>/*` mapeia para `apps/web/lib/` só para 16 prefixos; `instagram`, `oauth`, `ops`, `notifications` caem no catch-all `@/*` → `src/`. **Consequência para esta entrega: `@/lib/oauth/*` resolve para `apps/web/src/lib/oauth/*`** — tanto em `tsconfig.json` quanto no catch-all do `vitest.config.ts:278`. Nenhuma entrada nova de alias é necessária.
- TypeScript: nunca `any`; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Ratchet Next 16 (`test/unit/use-server-exports.test.ts:20-23`): em arquivos `'use server'` só `export async function` / `export type` / `export interface` / `export { type … }`. **Nenhum arquivo desta entrega é `'use server'`.**
- Nunca passar `next/link` (ou componente importado num Server Component) como prop para client component.
- Server actions de escrita chamam `requireEditAccess()` no topo; `getSupabaseServiceClient()` só após guard de site.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; sanitizers nunca sob happy-dom; fixtures temporais relativas ou com `vi.useFakeTimers`; fix de teste vai no mesmo commit.
- Migrations: **sempre** `npm run db:new <nome>`; idempotentes; `db:reset` → `db:types` → commit → `db:push:prod`. **Esta entrega não cria migration nenhuma.**
- `revalidateTag(tag, { expire: 0 })` — segundo argumento obrigatório; `await cookies()`.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`reset`; **push só após verificação local completa**.
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- `SOCIAL_MASTER_KEY` fora de `env.ts`; `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` lidos de `process.env` direto.
- Definições nomeadas do spec valem por nome: `CAMPOS_DE_EPISÓDIO`, horários `"0 11 * * *"` / `"0 13 * * *"`, `REGRA-PII-NTFY`.
- Plano Vercel **Pro** confirmado (2026-09-06). Fuso do dono: `America/Sao_Paulo`.

### Constraints específicas de B

- **Série de commits, um por task.** O spec chama B de "um commit"; na prática a entrega é uma **série curta de commits sob o mesmo escopo `chore(oauth):`** em `staging`, porque `git reset --soft`/`--amend` para espremer é proibido (memória do projeto: dois ou mais terminais rodando em paralelo em `staging`; um reset descartaria trabalho alheio). Cada commit da série deixa a árvore **verde** (`npx vitest run` + `tsc --noEmit`). Rollback de B = `git revert` da série **em ordem inversa** (Task 7 → Task 1). A promoção `staging → main` acontece **uma vez**, depois do último commit e da CI verde.
- **Ordem obrigatória start → callback.** A Task 5 (start assina `typ`+`exp`) precede a Task 6 (callback exige `typ`+`exp`). Nessa janela o callback antigo ainda usa o `verifyState` inline (cast puro) e aceita o payload novo — a árvore fica funcional. Na ordem inversa, todo `state` em voo cairia em 400.
- **Corte declarado de fluxos em voo.** Depois da Task 6, um `state` social assinado antes da Task 5 (sem `typ`, sem `exp`) verifica como `null` ⇒ 400 `invalid_state` com a frase "Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS". Janela de exposição ≈ os minutos entre os dois deploys, para quem estava com a janela do Google/Meta aberta. Aceito: é exatamente o corte que B existe para instalar.
- **`getCallbackUrl` NÃO é extraído** (spec §3.0, frase explícita), mesmo duplicado em `route.ts:42-45` e `callback/route.ts:242-245`.
- **`assertSameOriginFetch` não é ligado nas rotas sociais** — o spec o reserva para o *início* do fluxo Instagram (§3.1 passo 1, C3). B só o entrega testado.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `apps/web/src/lib/oauth/state.ts` | Derivação de chave HMAC por rótulo, assinatura e verificação do `state` (forma + `typ` + `exp` comparado com o relógio). Folha: só `node:crypto`. | 1 |
| `apps/web/src/lib/oauth/errors.ts` | `OauthErrorCode` — união dos 13 códigos canônicos de §3.1. **Módulo só de tipo, zero runtime**, para que `src/lib/instagram/status-text.ts` (C2) possa re-exportá-lo sem import de runtime. | 2 |
| `apps/web/src/lib/oauth/popup-result.ts` | `oauthResultHtml` — a resposta HTML do popup: payload de `postMessage`, escape, `nonce` de CSP, allow-list de `backHref`, `status` configurável, auto-close só com opener. | 2 |
| `apps/web/src/lib/oauth/consent.ts` | `recordSocialConsent` — resolve `consent_text_id` pela `locale` do request e grava a linha em `consents` com `insert` (não `upsert`), em `try/catch` próprio. | 3 |
| `apps/web/src/lib/oauth/origin.ts` | `getSiteDomains` (allow-list de hosts do site, sem loopback, memoizada), `resolveOAuthOrigin` (loopback → allow-list → `null`) e `assertSameOriginFetch` (descritor de recusa, nunca `Response`). | 4 |
| `apps/web/src/app/api/social/oauth/[provider]/route.ts` | Início social: passa a usar `deriveHmacKey`/`signState` do lib e assina `{ typ:'state', siteId, userId, exp: now+30min }`. | 5 |
| `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts` | Callback social: passa a usar `verifyState`/`oauthResultHtml`/`recordSocialConsent` do lib, re-executa `requireSiteScope`, compara `user.id === state.userId` e injeta o `nonce` no HTML. | 6 |
| `apps/web/src/app/cms/(authed)/social/accounts/_components/oauth-button.tsx` | Listener 1 de `social-oauth-result` — ganha checagem de `origin`. | 7 |
| `apps/web/src/app/cms/(authed)/youtube/_components/youtube-shell.tsx` | Listener 2 — idem. | 7 |
| `apps/web/src/app/cms/(authed)/youtube/dashboard-connected.tsx` | Listener 3 — idem. | 7 |
| `apps/web/test/api/oauth/state.test.ts` | Round-trip, adulteração, forma, rótulo, `typ`, `exp` (fake timers). | 1 |
| `apps/web/test/api/oauth/popup-result.test.ts` | Contrato do HTML (nunca golden string): `nonce`, `JSON.parse` do payload, `</` escapado, `backHref` relativo e rotulado, `window.close` sse opener, `status`, headers. | 2 |
| `apps/web/test/api/oauth/consent.test.ts` | `effective_at`, ausência de texto ⇒ sem insert, exceção contida, `ip`/`user_agent` gravados, `23505` tolerado. | 3 |
| `apps/web/test/api/oauth/origin.test.ts` | Allow-list, porta, loopback, `production`, memoização, `assertSameOriginFetch`. | 4 |
| `apps/web/test/api/oauth/social-routes.test.ts` | Start assina `exp`; callback sem sessão ⇒ 401 e nada gravado; `state` sem `exp` ⇒ 400; `state` expirado ⇒ 400 sem consent; sucesso ⇒ `insert` de consent + HTML com `nonce`. | 5 e 6 |
| `apps/web/test/cms/social-oauth.test.tsx` | Editado: `MessageEvent` com `origin`; mais um `it` de origem estrangeira ignorada. | 7 |

---

### Task 1: `src/lib/oauth/state.ts` — assinatura e verificação do `state`

**Files:**
- Create: `apps/web/src/lib/oauth/state.ts`
- Create: `apps/web/test/api/oauth/state.test.ts`

**Interfaces:**
- Consumes: nada (módulo-folha; só `node:crypto`).
- Produces:
  - `export type OauthStateType = 'state' | 'rebind' | 'mismatch'`
  - `export interface IOauthStatePayload { typ: OauthStateType; siteId: string; userId?: string; accountId?: string; origin?: string; nonce?: string; allowRebindTo?: string; authorizedIgUserId?: string; authorizedHandle?: string; exp?: number }` — `exp` em **segundos** desde a época.
  - `export interface IVerifyStateOptions { typ?: OauthStateType; requireNonce?: boolean; requireExp?: boolean }`
  - `export const SOCIAL_STATE_LABEL = 'oauth-state-hmac'`
  - `export const INSTAGRAM_STATE_LABEL = 'instagram-oauth-state-hmac'`
  - `export const STATE_TTL_SECONDS = 1800`
  - `export function deriveHmacKey(masterKeyHex: string, label: string): string`
  - `export function signState(payload: IOauthStatePayload, key: string): string`
  - `export function verifyState(signed: string, key: string, opts?: IVerifyStateOptions): IOauthStatePayload | null`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/test/api/oauth/state.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  deriveHmacKey,
  signState,
  verifyState,
  SOCIAL_STATE_LABEL,
  INSTAGRAM_STATE_LABEL,
  STATE_TTL_SECONDS,
  type IOauthStatePayload,
} from '@/lib/oauth/state'

const MASTER = 'a'.repeat(64)
const KEY = deriveHmacKey(MASTER, SOCIAL_STATE_LABEL)
const IG_KEY = deriveHmacKey(MASTER, INSTAGRAM_STATE_LABEL)

const SITE = '11111111-2222-4333-8444-555555555555'
const USER = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const ACCOUNT = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0)

function base(overrides: Partial<IOauthStatePayload> = {}): IOauthStatePayload {
  return { typ: 'state', siteId: SITE, userId: USER, ...overrides }
}

/** Sign an arbitrary JSON string so malformed payloads can carry a VALID hmac. */
function signRaw(json: string, key: string = KEY): string {
  const hmac = createHmac('sha256', key).update(json).digest('hex')
  return `${Buffer.from(json).toString('base64')}.${hmac}`
}

afterEach(() => {
  vi.useRealTimers()
})

describe('deriveHmacKey', () => {
  it('returns 64 hex chars and differs per label', () => {
    expect(KEY).toMatch(/^[0-9a-f]{64}$/)
    expect(IG_KEY).toMatch(/^[0-9a-f]{64}$/)
    expect(KEY).not.toBe(IG_KEY)
  })
})

describe('verifyState — round trip', () => {
  it('returns the payload it signed', () => {
    const payload = base({ accountId: ACCOUNT, origin: 'https://example.com', nonce: 'deadbeef' })
    expect(verifyState(signState(payload, KEY), KEY)).toEqual(payload)
  })

  it('survives encodeURIComponent on the wire', () => {
    const signed = encodeURIComponent(signState(base(), KEY))
    expect(verifyState(signed, KEY)).toEqual(base())
  })
})

describe('verifyState — rejection', () => {
  it('rejects a tampered payload', () => {
    const signed = signState(base(), KEY)
    const [b64, hmac] = signed.split('.')
    const tampered = Buffer.from(
      JSON.stringify(base({ siteId: ACCOUNT })),
    ).toString('base64')
    expect(b64).not.toBe(tampered)
    expect(verifyState(`${tampered}.${hmac}`, KEY)).toBeNull()
  })

  it('rejects a signature signed with the other label', () => {
    expect(verifyState(signState(base(), IG_KEY), KEY)).toBeNull()
  })

  it('rejects garbage with no dot separator', () => {
    expect(verifyState('not-a-state', KEY)).toBeNull()
  })

  it('rejects a non-hex hmac without throwing', () => {
    const b64 = Buffer.from(JSON.stringify(base())).toString('base64')
    expect(verifyState(`${b64}.${'z'.repeat(64)}`, KEY)).toBeNull()
  })

  it('rejects a malformed percent-escape', () => {
    expect(verifyState('%E0%A4%A', KEY)).toBeNull()
  })

  it('rejects a validly signed payload that is not JSON', () => {
    expect(verifyState(signRaw('not json at all'), KEY)).toBeNull()
  })

  it.each([
    ['null siteId', '{"typ":"state","siteId":null}'],
    ['object siteId', '{"typ":"state","siteId":{}}'],
    ['array siteId', '{"typ":"state","siteId":[]}'],
    ['non-uuid siteId', '{"typ":"state","siteId":"not-a-uuid"}'],
    ['array root', '[]'],
    ['null root', 'null'],
    ['string root', '"nope"'],
  ])('rejects %s even with a valid hmac', (_label, json) => {
    expect(verifyState(signRaw(json), KEY)).toBeNull()
  })

  it('rejects a non-uuid userId', () => {
    expect(verifyState(signRaw(`{"typ":"state","siteId":"${SITE}","userId":"x"}`), KEY)).toBeNull()
  })

  it('rejects an empty-string nonce', () => {
    expect(verifyState(signRaw(`{"typ":"state","siteId":"${SITE}","nonce":""}`), KEY)).toBeNull()
  })

  it('rejects a payload with no typ at all', () => {
    expect(verifyState(signRaw(`{"siteId":"${SITE}","userId":"${USER}"}`), KEY)).toBeNull()
  })

  it('rejects an unknown typ', () => {
    expect(verifyState(signRaw(`{"typ":"bogus","siteId":"${SITE}"}`), KEY)).toBeNull()
  })

  it('rejects a typ different from opts.typ', () => {
    const signed = signState(base({ typ: 'rebind' }), KEY)
    expect(verifyState(signed, KEY, { typ: 'state' })).toBeNull()
    expect(verifyState(signed, KEY, { typ: 'rebind' })).not.toBeNull()
  })

  it('honours requireNonce', () => {
    const signed = signState(base(), KEY)
    expect(verifyState(signed, KEY, { requireNonce: true })).toBeNull()
    expect(verifyState(signState(base({ nonce: 'ab12' }), KEY), KEY, { requireNonce: true })).not.toBeNull()
  })

  it('honours requireExp when exp is absent', () => {
    expect(verifyState(signState(base(), KEY), KEY, { requireExp: true })).toBeNull()
  })
})

describe('verifyState — exp is compared against the clock', () => {
  it('accepts a state 29 minutes into its 30-minute window, payload intact', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const payload = base({ exp: Math.floor(NOW / 1000) + STATE_TTL_SECONDS })
    const signed = signState(payload, KEY)
    vi.setSystemTime(NOW + 29 * 60_000)
    expect(verifyState(signed, KEY, { typ: 'state', requireExp: true })).toEqual(payload)
  })

  it('rejects the same state at 31 minutes', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const signed = signState(base({ exp: Math.floor(NOW / 1000) + STATE_TTL_SECONDS }), KEY)
    vi.setSystemTime(NOW + 31 * 60_000)
    expect(verifyState(signed, KEY, { typ: 'state', requireExp: true })).toBeNull()
  })

  it('rejects exp one second in the past', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const signed = signState(base({ exp: Math.floor(NOW / 1000) - 1 }), KEY)
    expect(verifyState(signed, KEY, { typ: 'state', requireExp: true })).toBeNull()
  })

  it('rejects an expired exp even WITHOUT requireExp', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const signed = signState(base({ exp: Math.floor(NOW / 1000) - 1 }), KEY)
    expect(verifyState(signed, KEY)).toBeNull()
  })

  it.each<['state' | 'rebind' | 'mismatch']>([['state'], ['rebind'], ['mismatch']])(
    'rejects an expired exp for typ=%s',
    (typ) => {
      vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
      const signed = signState(base({ typ, exp: Math.floor(NOW / 1000) - 1 }), KEY)
      expect(verifyState(signed, KEY, { typ })).toBeNull()
      expect(verifyState(signed, KEY, { typ, requireExp: true })).toBeNull()
    },
  )

  it('rejects a non-finite exp', () => {
    expect(verifyState(signRaw(`{"typ":"state","siteId":"${SITE}","exp":"soon"}`), KEY)).toBeNull()
  })
})

describe('verifyState — never throws', () => {
  it.each(['', '.', '..', 'a.b', '%%%', 'AAAA.', '.AAAA', Buffer.from('{').toString('base64') + '.x'])(
    'returns null for %j',
    (input) => {
      expect(() => verifyState(input, KEY)).not.toThrow()
      expect(verifyState(input, KEY)).toBeNull()
    },
  )
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/api/oauth/state.test.ts
```
Expected: FAIL — `Failed to resolve import "@/lib/oauth/state"` (o módulo ainda não existe).

- [ ] **Step 3: Implementação mínima**

Criar `apps/web/src/lib/oauth/state.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Shared HMAC-signed `state` for every OAuth flow in the app.
 *
 * Extracted in commit B from `api/social/oauth/[provider]/route.ts:32-40` and
 * `.../callback/route.ts:43-46,76-94`, which had two copies of `deriveHmacKey`,
 * a payload with no `typ` and no `exp`, and a `verifyState` that cast the
 * parsed JSON without validating its shape.
 */

export type OauthStateType = 'state' | 'rebind' | 'mismatch'

export interface IOauthStatePayload {
  /** Which flow signed this. A payload with no valid `typ` never verifies. */
  typ: OauthStateType
  siteId: string
  userId?: string
  accountId?: string
  origin?: string
  nonce?: string
  allowRebindTo?: string
  authorizedIgUserId?: string
  authorizedHandle?: string
  /**
   * Expiry in SECONDS since the epoch — the same unit as `payload.expires` of
   * a Meta `signed_request`. Sign it as `Math.floor(Date.now() / 1000) + N`.
   * `verifyState` compares it against the wall clock unconditionally.
   */
  exp?: number
}

export interface IVerifyStateOptions {
  /** Reject any payload whose `typ` differs from this one (absent included). */
  typ?: OauthStateType
  /** Reject a payload with no `nonce`. */
  requireNonce?: boolean
  /** Reject a payload with no `exp`. Expiry itself is always enforced. */
  requireExp?: boolean
}

/** HMAC label of the social publishing flow (`social_connections`). */
export const SOCIAL_STATE_LABEL = 'oauth-state-hmac'
/** HMAC label of the Instagram feed flow (`instagram_accounts`) — used from C3. */
export const INSTAGRAM_STATE_LABEL = 'instagram-oauth-state-hmac'
/** 30 minutes. The Meta `code` is valid for 1 h; the state closes earlier. */
export const STATE_TTL_SECONDS = 1800

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX64_RE = /^[0-9a-f]{64}$/i
const STATE_TYPES: readonly OauthStateType[] = ['state', 'rebind', 'mismatch']
const STRING_FIELDS = [
  'origin',
  'nonce',
  'allowRebindTo',
  'authorizedIgUserId',
  'authorizedHandle',
] as const

/** Derive a purpose-specific HMAC key so the master key is never used directly for signing. */
export function deriveHmacKey(masterKeyHex: string, label: string): string {
  return createHmac('sha256', masterKeyHex).update(label).digest('hex')
}

export function signState(payload: IOauthStatePayload, key: string): string {
  const json = JSON.stringify(payload)
  const hmac = createHmac('sha256', key).update(json).digest('hex')
  return `${Buffer.from(json).toString('base64')}.${hmac}`
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isOptionalUuid(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && UUID_RE.test(value))
}

/**
 * Verify + validate. Returns `null` on ANY deviation and MUST NOT throw — a
 * thrown value here would surface as a 500 in a popup the user is staring at.
 */
export function verifyState(
  signed: string,
  key: string,
  opts: IVerifyStateOptions = {},
): IOauthStatePayload | null {
  try {
    let decoded: string
    try {
      decoded = decodeURIComponent(signed)
    } catch {
      return null
    }

    const dotIdx = decoded.lastIndexOf('.')
    if (dotIdx === -1) return null
    const b64 = decoded.substring(0, dotIdx)
    const hmac = decoded.substring(dotIdx + 1)
    if (!b64 || !HEX64_RE.test(hmac)) return null

    const json = Buffer.from(b64, 'base64').toString('utf-8')
    const expected = createHmac('sha256', key).update(json).digest('hex')
    const hmacBuf = Buffer.from(hmac, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (hmacBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(hmacBuf, expectedBuf)) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return null
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const p = parsed as Record<string, unknown>

    if (!isNonEmptyString(p.siteId) || !UUID_RE.test(p.siteId)) return null
    if (!isOptionalUuid(p.userId)) return null
    if (!isOptionalUuid(p.accountId)) return null

    for (const field of STRING_FIELDS) {
      if (p[field] !== undefined && !isNonEmptyString(p[field])) return null
    }

    if (!isNonEmptyString(p.typ) || !STATE_TYPES.includes(p.typ as OauthStateType)) return null

    // Expiry is compared against the clock whenever `exp` is present. Presence
    // itself is `requireExp`'s job — a captured state must stop working, and
    // the cookie `Max-Age` that mirrors it is enforced by the CLIENT.
    if (p.exp !== undefined) {
      if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return null
      if (p.exp * 1000 <= Date.now()) return null
    }

    if (opts.typ !== undefined && p.typ !== opts.typ) return null
    if (opts.requireNonce === true && !isNonEmptyString(p.nonce)) return null
    if (opts.requireExp === true && p.exp === undefined) return null

    return p as unknown as IOauthStatePayload
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/api/oauth/state.test.ts
```
Expected: PASS — 1 arquivo, todos os `it` verdes (inclusive os 3 `it.each` de `typ` expirado).

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: sem saída (exit 0).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/oauth/state.ts apps/web/test/api/oauth/state.test.ts
git commit -m "chore(oauth): extrair state.ts com typ e exp verificados

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 2: `src/lib/oauth/errors.ts` + `src/lib/oauth/popup-result.ts` — HTML do popup

**Files:**
- Create: `apps/web/src/lib/oauth/errors.ts`
- Create: `apps/web/src/lib/oauth/popup-result.ts`
- Create: `apps/web/test/api/oauth/popup-result.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores. `popup-result.ts` consome `OauthErrorCode` de `errors.ts` com `import type`.
- Produces:
  - `export type OauthErrorCode = 'not_configured' | 'vault_unavailable' | 'account_not_found' | 'exchange_failed' | 'origin_not_allowed' | 'invalid_state' | 'session_changed' | 'permission_denied' | 'cancelled' | 'identity_invalid' | 'write_failed' | 'cross_origin' | 'browser_changed'` (em `errors.ts`; módulo **só de tipo**)
  - `export type OauthResultExtra = { status: 'handle_mismatch' } | { code: OauthErrorCode }`
  - `export interface IOauthResultHtmlOptions { messageType: string; provider: string; success: boolean; error?: string; extra?: OauthResultExtra; backHref: string; targetOrigin: string; nonce: string; status?: number; headers?: { 'Cache-Control'?: string; 'Referrer-Policy'?: string } }`
  - `export function oauthResultHtml(opts: IOauthResultHtmlOptions): Response`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/test/api/oauth/popup-result.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { oauthResultHtml } from '@/lib/oauth/popup-result'

const BASE = {
  messageType: 'social-oauth-result',
  provider: 'youtube',
  success: true,
  backHref: '/cms/social/accounts',
  targetOrigin: 'https://bythiagofigueiredo.com',
  nonce: 'bm9uY2UtMTIz',
} as const

/** Pull the inline script body out — contract test, never a golden string. */
function scriptSourceOf(html: string): string {
  const match = /<script nonce="([^"]*)">([\s\S]*?)<\/script>/.exec(html)
  expect(match).not.toBeNull()
  return match![2]!
}

/** Extract the JSON literal handed to postMessage and parse it. */
function payloadOf(html: string): Record<string, unknown> {
  const src = scriptSourceOf(html)
  const match = /postMessage\((\{[\s\S]*?\}), /.exec(src)
  expect(match).not.toBeNull()
  return JSON.parse(match![1]!.replace(/<\\\//g, '</')) as Record<string, unknown>
}

/** Run the inline script against a stub window — this is the opener contract. */
function runScript(html: string, opener: { postMessage: (d: unknown, o: string) => void } | null) {
  const close = vi.fn()
  const timeouts: Array<() => void> = []
  const win = { opener, close }
  const fakeSetTimeout = (fn: () => void) => {
    timeouts.push(fn)
  }
  new Function('window', 'setTimeout', scriptSourceOf(html))(win, fakeSetTimeout)
  return { close, timeouts }
}

describe('oauthResultHtml — response shape', () => {
  it('defaults to 200 with the html content type', async () => {
    const res = oauthResultHtml({ ...BASE })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('Connected! This window will close.')
  })

  it('honours an explicit status', () => {
    const res = oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Session changed during authorization — sign in and try again',
      extra: { code: 'session_changed' },
      status: 401,
    })
    expect(res.status).toBe(401)
  })

  it('passes through Cache-Control and Referrer-Policy only', () => {
    const res = oauthResultHtml({
      ...BASE,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })
})

describe('oauthResultHtml — script contract, success branch', () => {
  it('carries the nonce attribute', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    expect(html).toContain('<script nonce="bm9uY2UtMTIz">')
  })

  it('posts a parseable payload', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    expect(payloadOf(html)).toEqual({
      type: 'social-oauth-result',
      success: true,
      provider: 'youtube',
    })
  })

  it('renders the allow-listed backHref label', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    expect(html).toContain('href="/cms/social/accounts"')
    expect(html).toContain('Back to social accounts')
  })
})

describe('oauthResultHtml — script contract, failure branch', () => {
  it('posts error and extra.code, and shows a human sentence', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Instagram did not grant the required permission',
      extra: { code: 'permission_denied' },
      backHref: '/cms/settings/instagram',
    }).text()
    expect(payloadOf(html)).toEqual({
      type: 'social-oauth-result',
      success: false,
      provider: 'youtube',
      error: 'Instagram did not grant the required permission',
      code: 'permission_denied',
    })
    expect(html).toContain('Error: Instagram did not grant the required permission')
    expect(html).toContain('Back to Instagram settings')
  })

  it('carries the nonce in the failure branch too', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Authorization cancelled',
      extra: { code: 'cancelled' },
    }).text()
    expect(html).toContain('<script nonce="bm9uY2UtMTIz">')
  })

  it('accepts the handle_mismatch status extra', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'You authorized a different account',
      extra: { status: 'handle_mismatch' },
      backHref: '/cms/settings/instagram',
    }).text()
    expect(payloadOf(html).status).toBe('handle_mismatch')
  })

  it('escapes html in the visible error text', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: '<img src=x onerror=1>',
      extra: { code: 'write_failed' },
    }).text()
    expect(html).toContain('&lt;img src=x onerror=1&gt;')
    expect(html).not.toContain('<img src=x')
  })
})

describe('oauthResultHtml — closing sequence escape', () => {
  it('escapes </ inside the json payload', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: '</script><script>alert(1)</script>',
      extra: { code: 'write_failed' },
    }).text()
    const src = scriptSourceOf(html)
    expect(src).not.toContain('</script>')
    expect(src).toContain('<\\/script>')
    expect(payloadOf(html).error).toBe('</script><script>alert(1)</script>')
  })
})

describe('oauthResultHtml — auto-close only with an opener', () => {
  it('posts the message and schedules window.close when an opener exists', async () => {
    const postMessage = vi.fn()
    const html = await oauthResultHtml({ ...BASE }).text()
    const { close, timeouts } = runScript(html, { postMessage })
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage.mock.calls[0]![1]).toBe('https://bythiagofigueiredo.com')
    expect(timeouts).toHaveLength(1)
    timeouts[0]!()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('never closes the page when there is no opener', async () => {
    const html = await oauthResultHtml({ ...BASE }).text()
    const { close, timeouts } = runScript(html, null)
    expect(timeouts).toHaveLength(0)
    expect(close).not.toHaveBeenCalled()
  })
})

describe('oauthResultHtml — backHref allow-list', () => {
  it('accepts the sign-in href with its own label', async () => {
    const html = await oauthResultHtml({
      ...BASE,
      success: false,
      error: 'Session changed during authorization — sign in and try again',
      extra: { code: 'session_changed' },
      backHref: '/cms/login?next=/cms/settings/instagram',
      status: 401,
    }).text()
    expect(html).toContain('href="/cms/login?next=/cms/settings/instagram"')
    expect(html).toContain('Sign in and try again')
  })

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'cms/settings/instagram',
  ])('throws on non-relative backHref %j', (backHref) => {
    expect(() => oauthResultHtml({ ...BASE, backHref })).toThrow()
  })

  it('throws on a relative href outside the allow-list', () => {
    expect(() => oauthResultHtml({ ...BASE, backHref: '/cms/settings' })).toThrow()
  })
})

describe('oauthResultHtml — extra is an enum', () => {
  it('throws on an unknown error code', () => {
    expect(() =>
      oauthResultHtml({
        ...BASE,
        success: false,
        extra: { code: 'made_up' } as never,
      }),
    ).toThrow()
  })

  it('throws on an unknown status', () => {
    expect(() =>
      oauthResultHtml({ ...BASE, extra: { status: 'whatever' } as never }),
    ).toThrow()
  })

  it('throws on an extra with two keys', () => {
    expect(() =>
      oauthResultHtml({
        ...BASE,
        extra: { code: 'cancelled', status: 'handle_mismatch' } as never,
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/api/oauth/popup-result.test.ts
```
Expected: FAIL — `Failed to resolve import "@/lib/oauth/popup-result"`.

- [ ] **Step 3: Implementação mínima — `errors.ts`**

Criar `apps/web/src/lib/oauth/errors.ts`:

```ts
/**
 * Canonical machine codes for every OAuth failure the user can be shown.
 *
 * TYPE-ONLY MODULE ON PURPOSE — no function, no const, no runtime import.
 * `src/lib/instagram/status-text.ts` (C2) re-exports this union and declares
 * `oauthErrorText(code) satisfies Record<OauthErrorCode, string>`; keeping this
 * file free of runtime code is what lets `status-text.ts` stay isomorphic and
 * be imported from a `'use client'` component.
 *
 * The user-facing sentence for each code lives in `oauthErrorText` (C2) — the
 * canonical map is spec §3.1.
 */
export type OauthErrorCode =
  | 'not_configured'
  | 'vault_unavailable'
  | 'account_not_found'
  | 'exchange_failed'
  | 'origin_not_allowed'
  | 'invalid_state'
  | 'session_changed'
  | 'permission_denied'
  | 'cancelled'
  | 'identity_invalid'
  | 'write_failed'
  | 'cross_origin'
  | 'browser_changed'
```

- [ ] **Step 4: Implementação mínima — `popup-result.ts`**

Criar `apps/web/src/lib/oauth/popup-result.ts`:

```ts
import type { OauthErrorCode } from './errors'

/**
 * The HTML a popup renders when an OAuth flow finishes.
 *
 * Extracted in commit B from `api/social/oauth/[provider]/callback/route.ts:48-74`,
 * which hard-coded status 200, had no CSP nonce, no back link and auto-closed
 * even with no opener (leaving the user on a blank page with no way back).
 */

/** Only two shapes may ride along in the postMessage payload. */
export type OauthResultExtra = { status: 'handle_mismatch' } | { code: OauthErrorCode }

export interface IOauthResultHtmlOptions {
  /** `'social-oauth-result'` or `'instagram-oauth-result'`. */
  messageType: string
  provider: string
  success: boolean
  /** Always a human sentence — never a machine string (spec §2). */
  error?: string
  extra?: OauthResultExtra
  /** Site-relative path; must be in the allow-list below. */
  backHref: string
  targetOrigin: string
  /** `(await headers()).get('x-nonce')` — `src/middleware.ts:169`. */
  nonce: string
  /** Defaults to 200. Transport failures pass 400/401/403/404/503. */
  status?: number
  headers?: { 'Cache-Control'?: string; 'Referrer-Policy'?: string }
}

/**
 * Allow-list of back destinations AND their labels. A value outside it throws:
 * the guard is written as an allow-list and has to behave like one.
 */
const BACK_HREF_LABELS: Record<string, string> = {
  '/cms/settings/instagram': 'Back to Instagram settings',
  '/cms/social/accounts': 'Back to social accounts',
  '/cms/login?next=/cms/settings/instagram': 'Sign in and try again',
}

/**
 * Runtime mirror of `OauthErrorCode`. Typed as `Record<OauthErrorCode, true>`
 * so TypeScript rejects both a missing key and an unknown one — the union in
 * `errors.ts` and this object cannot drift.
 */
const OAUTH_ERROR_CODE_SET: Record<OauthErrorCode, true> = {
  not_configured: true,
  vault_unavailable: true,
  account_not_found: true,
  exchange_failed: true,
  origin_not_allowed: true,
  invalid_state: true,
  session_changed: true,
  permission_denied: true,
  cancelled: true,
  identity_invalid: true,
  write_failed: true,
  cross_origin: true,
  browser_changed: true,
}

/** Note: does NOT escape `'` — every attribute below uses double quotes. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function assertRelativeHref(href: string): void {
  // `/\evil.com` starts with `/` and not with `//`, and every modern browser
  // normalises `\` to `/` while parsing — it must be refused explicitly.
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) {
    throw new Error(`oauthResultHtml: backHref must be a site-relative path (got ${href})`)
  }
}

function assertExtra(extra: OauthResultExtra | undefined): void {
  if (extra === undefined) return
  const keys = Object.keys(extra)
  if (keys.length !== 1) {
    throw new Error(`oauthResultHtml: extra must carry exactly one key (got ${keys.join(',')})`)
  }
  const [key] = keys
  if (key === 'status') {
    const value = (extra as { status: string }).status
    if (value !== 'handle_mismatch') {
      throw new Error(`oauthResultHtml: unknown extra.status (${value})`)
    }
    return
  }
  if (key === 'code') {
    const value = (extra as { code: string }).code
    if (!Object.prototype.hasOwnProperty.call(OAUTH_ERROR_CODE_SET, value)) {
      throw new Error(`oauthResultHtml: unknown extra.code (${value})`)
    }
    return
  }
  throw new Error(`oauthResultHtml: unknown extra key (${String(key)})`)
}

export function oauthResultHtml(opts: IOauthResultHtmlOptions): Response {
  const {
    messageType,
    provider,
    success,
    error,
    extra,
    backHref,
    targetOrigin,
    nonce,
    status = 200,
    headers,
  } = opts

  assertRelativeHref(backHref)
  const backLabel = BACK_HREF_LABELS[backHref]
  if (backLabel === undefined) {
    throw new Error(`oauthResultHtml: backHref is not allow-listed (${backHref})`)
  }
  assertExtra(extra)

  const payload = JSON.stringify({
    type: messageType,
    success,
    provider,
    ...(error !== undefined ? { error } : {}),
    ...extra,
  })
  // Escape `</` so nothing in the payload can close the script element.
  const safePayload = payload.replace(/<\//g, '<\\/')
  const safeTargetOrigin = JSON.stringify(targetOrigin).replace(/<\//g, '<\\/')
  const safeError = escapeHtml(error ?? 'unknown')

  const html = `<!DOCTYPE html>
<html><head><title>OAuth Complete</title></head>
<body>
<p>${success ? 'Connected! This window will close.' : `Error: ${safeError}`}</p>
<p><a href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a></p>
<script nonce="${escapeHtml(nonce)}">
  try { window.opener.postMessage(${safePayload}, ${safeTargetOrigin}) } catch {}
  if (window.opener != null) setTimeout(() => window.close(), 1500)
</script>
</body></html>`

  const responseHeaders = new Headers({ 'Content-Type': 'text/html; charset=utf-8' })
  const cacheControl = headers?.['Cache-Control']
  if (cacheControl !== undefined) responseHeaders.set('Cache-Control', cacheControl)
  const referrerPolicy = headers?.['Referrer-Policy']
  if (referrerPolicy !== undefined) responseHeaders.set('Referrer-Policy', referrerPolicy)

  return new Response(html, { status, headers: responseHeaders })
}
```

- [ ] **Step 5: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/api/oauth/popup-result.test.ts
```
Expected: PASS — inclusive `never closes the page when there is no opener` (o `new Function` roda o script com `opener: null`, o `try/catch` engole o `TypeError` do `postMessage` e o `if` impede o `setTimeout`).

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/oauth/errors.ts apps/web/src/lib/oauth/popup-result.ts apps/web/test/api/oauth/popup-result.test.ts
git commit -m "chore(oauth): extrair popup-result.ts com nonce, status e allow-list de backHref

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 3: `src/lib/oauth/consent.ts` — gravação do consentimento LGPD

**Files:**
- Create: `apps/web/src/lib/oauth/consent.ts`
- Create: `apps/web/test/api/oauth/consent.test.ts`

**Contexto de banco (conferido):** `consents` tem `consent_text_id text NOT NULL` (`supabase/migrations/20260507000001_schema.sql:249`), a categoria `social_integration` já é aceita pela CHECK (`20260524000002_social_consent_category.sql:18`) e os textos pt-BR/en já foram semeados por essa mesma migration. Os únicos índices únicos são **parciais** — `consents_auth_current` (`:5471`) e `consents_anon_current` (`:5461`) —, e é por isso que o `upsert onConflict:'user_id,category,site_id'` de `callback/route.ts:39` é inferido como `42P10` pelo PostgREST: **não existe constraint com esse nome**. A correção é `insert` puro, tolerando `23505` (a corrida perdida já gravou a linha).

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - `export interface IRecordSocialConsentArgs { userId: string; siteId: string; category: string; req: Request }`
  - `export async function recordSocialConsent(supabase: ReturnType<typeof getSupabaseServiceClient>, args: IRecordSocialConsentArgs): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/test/api/oauth/consent.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

import * as Sentry from '@sentry/nextjs'
import { recordSocialConsent } from '@/lib/oauth/consent'

type ServiceClient = Parameters<typeof recordSocialConsent>[0]

const SITE = '11111111-2222-4333-8444-555555555555'
const USER = '66666666-7777-4888-8999-aaaaaaaaaaaa'

function makeSupabase(opts: {
  textRow?: { id: string } | null
  textError?: { code: string; message: string } | null
  insertError?: { code?: string; message: string } | null
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.textRow === undefined ? { id: 'social_integration_v1_pt-BR' } : opts.textRow,
    error: opts.textError ?? null,
  })
  const chain: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
    insert,
  }
  for (const key of ['select', 'eq', 'is', 'order', 'limit']) {
    ;(chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  }
  const from = vi.fn().mockReturnValue(chain)
  return { client: { from } as unknown as ServiceClient, from, chain, insert, maybeSingle }
}

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('https://bythiagofigueiredo.com/api/social/oauth/google/callback', {
    headers: {
      'x-forwarded-for': '203.0.113.9, 70.41.3.18',
      'user-agent': 'Mozilla/5.0 (Test)',
      ...headers,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordSocialConsent', () => {
  it('reads the newest non-superseded text for the request locale', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq({ 'x-default-locale': 'en' }),
    })

    expect(sb.from).toHaveBeenCalledWith('consent_texts')
    expect(sb.chain.eq).toHaveBeenCalledWith('category', 'social_integration')
    expect(sb.chain.eq).toHaveBeenCalledWith('locale', 'en')
    expect(sb.chain.is).toHaveBeenCalledWith('superseded_at', null)
    expect(sb.chain.order).toHaveBeenCalledWith('effective_at', { ascending: false })
    expect(sb.chain.limit).toHaveBeenCalledWith(1)
  })

  it('falls back to pt-BR when the middleware set no locale', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.chain.eq).toHaveBeenCalledWith('locale', 'pt-BR')
  })

  it('inserts the consent row with ip and user_agent', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })

    expect(sb.from).toHaveBeenCalledWith('consents')
    expect(sb.insert).toHaveBeenCalledTimes(1)
    const row = sb.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(row.user_id).toBe(USER)
    expect(row.site_id).toBe(SITE)
    expect(row.category).toBe('social_integration')
    expect(row.consent_text_id).toBe('social_integration_v1_pt-BR')
    expect(row.granted).toBe(true)
    expect(row.ip).toBe('203.0.113.9')
    expect(row.user_agent).toBe('Mozilla/5.0 (Test)')
  })

  it('never uses upsert (the composite onConflict is not inferable)', async () => {
    const sb = makeSupabase()
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.chain.upsert).toBeUndefined()
  })

  it('does not insert when no consent text exists, and reports it', async () => {
    const sb = makeSupabase({ textRow: null })
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.insert).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('does not insert when the lookup itself errors', async () => {
    const sb = makeSupabase({ textError: { code: '42501', message: 'denied' } })
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(sb.insert).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('treats 23505 as already recorded and stays quiet', async () => {
    const sb = makeSupabase({ insertError: { code: '23505', message: 'duplicate key' } })
    await recordSocialConsent(sb.client, {
      userId: USER,
      siteId: SITE,
      category: 'social_integration',
      req: makeReq(),
    })
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('reports any other insert error without throwing', async () => {
    const sb = makeSupabase({ insertError: { code: '23514', message: 'check violation' } })
    await expect(
      recordSocialConsent(sb.client, {
        userId: USER,
        siteId: SITE,
        category: 'social_integration',
        req: makeReq(),
      }),
    ).resolves.toBeUndefined()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('contains a thrown client and never rejects the caller', async () => {
    const client = {
      from: () => {
        throw new Error('connection reset')
      },
    } as unknown as ServiceClient
    await expect(
      recordSocialConsent(client, {
        userId: USER,
        siteId: SITE,
        category: 'social_integration',
        req: makeReq(),
      }),
    ).resolves.toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/api/oauth/consent.test.ts
```
Expected: FAIL — `Failed to resolve import "@/lib/oauth/consent"`.

- [ ] **Step 3: Implementação mínima**

Criar `apps/web/src/lib/oauth/consent.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * LGPD consent row for an OAuth connection.
 *
 * Extracted in commit B from `api/social/oauth/[provider]/callback/route.ts:8-41`,
 * which took six positional arguments (one of them, `provider`, unused), hard-coded
 * `locale: 'pt-BR'`, and used `upsert({ onConflict: 'user_id,category,site_id' })` —
 * a constraint that does not exist. `consents` only carries the PARTIAL unique
 * indexes `consents_auth_current` / `consents_anon_current`, so PostgREST answers
 * 42P10 and the write was silently lost. A plain `insert` tolerating 23505 is the
 * shape those partial indexes actually support.
 */

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

export interface IRecordSocialConsentArgs {
  userId: string
  siteId: string
  /** e.g. `'social_integration'` — must satisfy `consents_category_check`. */
  category: string
  /** The callback request — `x-default-locale`, `x-forwarded-for`, `user-agent`. */
  req: Request
}

export async function recordSocialConsent(
  supabase: ServiceClient,
  { userId, siteId, category, req }: IRecordSocialConsentArgs,
): Promise<void> {
  try {
    const locale = req.headers.get('x-default-locale') ?? 'pt-BR'
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent')

    const { data: textRow, error: textError } = await supabase
      .from('consent_texts')
      .select('id')
      .eq('category', category)
      .eq('locale', locale)
      .is('superseded_at', null)
      .order('effective_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (textError) {
      Sentry.captureMessage(
        `recordSocialConsent: consent_texts lookup failed for ${category}/${locale}`,
        'warning',
      )
      return
    }

    const consentTextId = (textRow as { id?: unknown } | null)?.id
    if (typeof consentTextId !== 'string') {
      Sentry.captureMessage(
        `recordSocialConsent: no consent text for ${category}/${locale}`,
        'warning',
      )
      return
    }

    const { error: insertError } = await supabase.from('consents').insert({
      user_id: userId,
      category,
      site_id: siteId,
      consent_text_id: consentTextId,
      granted: true,
      granted_at: new Date().toISOString(),
      ip,
      user_agent: userAgent,
    })

    // 23505 = the partial unique index fired: the consent is already on record.
    if (insertError && insertError.code !== '23505') {
      Sentry.captureMessage(
        `recordSocialConsent: insert failed (${insertError.code ?? 'unknown'})`,
        'warning',
      )
    }
  } catch (err) {
    // Never take the OAuth callback down over a consent write.
    Sentry.captureException(err)
  }
}
```

- [ ] **Step 4: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/api/oauth/consent.test.ts
```
Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/oauth/consent.ts apps/web/test/api/oauth/consent.test.ts
git commit -m "chore(oauth): extrair consent.ts e trocar upsert nao-inferivel por insert

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 4: `src/lib/oauth/origin.ts` — allow-list de origem e Fetch Metadata

**Files:**
- Create: `apps/web/src/lib/oauth/origin.ts`
- Create: `apps/web/test/api/oauth/origin.test.ts`

**Contexto (conferido):** `sites.domains` é `text[] NOT NULL DEFAULT '{}'` (`20260507000001_schema.sql:1760`) e `supabase/seeds/dev.sql:76-79` acrescenta `['localhost','127.0.0.1']` a esse array em ambiente local — daí o filtro de loopback. `getSiteContext().primaryDomain` é **proibido** aqui (spec §3.0): ele deriva do header `host` e portanto do próprio atacante.

**Decisão registrada (memoização):** o spec pede "memoizado por request". `cache()` do React **não** memoiza fora de um escopo de request do React — medido neste repositório com `react@19.2.7`: três chamadas à função embrulhada produziram três execuções. Sob Vitest não haveria escopo nenhum, e a asserção "2 chamadas ⇒ 1 query" seria impossível. Implementação escolhida: `Map` de módulo com TTL de 60 s (superset de "uma query por request" — dentro de um request as chamadas distam microssegundos) e um `__resetSiteDomainsCache()` exportado só para teste. Resultados de erro **não** são cacheados.

**Interfaces:**
- Consumes: `getSupabaseServiceClient` de `@/lib/supabase/service` (já existente no repo).
- Produces:
  - `export interface IOauthDenyDescriptor { status: 403; code: 'cross_origin' }`
  - `export async function getSiteDomains(siteId: string): Promise<string[]>`
  - `export function resolveOAuthOrigin(req: Request, allowedHosts: string[]): string | null`
  - `export function assertSameOriginFetch(req: Request): IOauthDenyDescriptor | null`
  - `export function __resetSiteDomainsCache(): void` (test hook)

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/test/api/oauth/origin.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockChain = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  maybeSingle: mockMaybeSingle,
}
const mockFrom = vi.fn(() => mockChain)

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import {
  getSiteDomains,
  resolveOAuthOrigin,
  assertSameOriginFetch,
  __resetSiteDomainsCache,
} from '@/lib/oauth/origin'

const SITE = '11111111-2222-4333-8444-555555555555'

function req(headers: Record<string, string>): Request {
  return new Request('https://placeholder.invalid/api/instagram/oauth', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetSiteDomainsCache()
  mockMaybeSingle.mockResolvedValue({
    data: { domains: ['BYTHIAGOFIGUEIREDO.com', 'www.bythiagofigueiredo.com', 'localhost', '127.0.0.1'] },
    error: null,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getSiteDomains', () => {
  it('lower-cases and drops loopback entries the dev seed injects', async () => {
    await expect(getSiteDomains(SITE)).resolves.toEqual([
      'bythiagofigueiredo.com',
      'www.bythiagofigueiredo.com',
    ])
  })

  it('memoises: two calls, one query', async () => {
    await getSiteDomains(SITE)
    await getSiteDomains(SITE)
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('scopes the query to the site id', async () => {
    await getSiteDomains(SITE)
    expect(mockFrom).toHaveBeenCalledWith('sites')
    expect(mockChain.eq).toHaveBeenCalledWith('id', SITE)
  })

  it('fails closed on error and does not cache the failure', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(getSiteDomains(SITE)).resolves.toEqual([])
    await getSiteDomains(SITE)
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })

  it('returns [] when domains is not an array', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { domains: null }, error: null })
    await expect(getSiteDomains(SITE)).resolves.toEqual([])
  })
})

describe('resolveOAuthOrigin', () => {
  const ALLOWED = ['bythiagofigueiredo.com', 'www.bythiagofigueiredo.com']

  it('returns https origin for an allow-listed host', () => {
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com' }), ALLOWED)).toBe(
      'https://bythiagofigueiredo.com',
    )
  })

  it('drops the port for an allow-listed host', () => {
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com:8443' }), ALLOWED)).toBe(
      'https://bythiagofigueiredo.com',
    )
  })

  it('is case-insensitive on the host header', () => {
    expect(resolveOAuthOrigin(req({ host: 'WWW.BYTHIAGOFIGUEIREDO.com' }), ALLOWED)).toBe(
      'https://www.bythiagofigueiredo.com',
    )
  })

  it('keeps the port for loopback outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(resolveOAuthOrigin(req({ host: 'localhost:3997' }), ALLOWED)).toBe('http://localhost:3997')
  })

  it('honours x-forwarded-proto on loopback', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(
      resolveOAuthOrigin(req({ host: 'localhost:3997', 'x-forwarded-proto': 'https' }), ALLOWED),
    ).toBe('https://localhost:3997')
  })

  it('refuses loopback in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(resolveOAuthOrigin(req({ host: 'localhost:3997' }), ALLOWED)).toBeNull()
    expect(resolveOAuthOrigin(req({ host: '127.0.0.1:3000' }), ALLOWED)).toBeNull()
  })

  it('returns null for a host outside the allow-list', () => {
    expect(resolveOAuthOrigin(req({ host: 'evil.com' }), ALLOWED)).toBeNull()
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com.evil.com' }), ALLOWED)).toBeNull()
  })

  it('returns null with an empty allow-list', () => {
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com' }), [])).toBeNull()
  })
})

describe('assertSameOriginFetch', () => {
  it.each(['cross-site', 'same-site'])('denies %s with a descriptor, not a Response', (value) => {
    const deny = assertSameOriginFetch(req({ 'sec-fetch-site': value }))
    expect(deny).toEqual({ status: 403, code: 'cross_origin' })
    expect(deny).not.toBeInstanceOf(Response)
  })

  it.each(['same-origin', 'none'])('allows %s', (value) => {
    expect(assertSameOriginFetch(req({ 'sec-fetch-site': value }))).toBeNull()
  })

  it('allows a request with no Sec-Fetch-Site header at all', () => {
    // Decision (spec §3.0): in-app browsers and WebViews send no Fetch Metadata.
    // Refusing them would open a dead-end window on the phone the owner is holding.
    expect(assertSameOriginFetch(req({}))).toBeNull()
  })

  it('never throws', () => {
    expect(() => assertSameOriginFetch(req({ 'sec-fetch-site': 'garbage' }))).not.toThrow()
    expect(assertSameOriginFetch(req({ 'sec-fetch-site': 'garbage' }))).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/api/oauth/origin.test.ts
```
Expected: FAIL — `Failed to resolve import "@/lib/oauth/origin"`.

- [ ] **Step 3: Implementação mínima**

Criar `apps/web/src/lib/oauth/origin.ts`:

```ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * Where an OAuth flow is allowed to start and return.
 *
 * The allow-list comes from `sites.domains` (service client), NEVER from
 * `getSiteContext().primaryDomain` — that value derives from the `host` header
 * and would let the caller pick its own redirect target.
 */

export interface IOauthDenyDescriptor {
  status: 403
  code: 'cross_origin'
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1', '[::1]'])

/**
 * `supabase/seeds/dev.sql:76-79` appends `localhost` / `127.0.0.1` to the local
 * site's `domains`, so the allow-list branch must never see them: loopback is
 * decided by its own branch, which is closed in production.
 */
function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return LOOPBACK_HOSTNAMES.has(h) || h.endsWith('.localhost') || h.startsWith('127.')
}

function hostnameOf(hostHeader: string): string | null {
  const h = hostHeader.trim().toLowerCase()
  if (!h) return null
  if (h.startsWith('[')) {
    const end = h.indexOf(']')
    return end === -1 ? null : h.slice(0, end + 1)
  }
  const colon = h.indexOf(':')
  return colon === -1 ? h : h.slice(0, colon)
}

/**
 * Per-request memoisation. `cache()` from React is not usable here: outside a
 * React request scope it does not memoise at all (verified against react@19.2.7
 * — three calls, three executions), so the "two calls, one query" guarantee
 * would be false in every server context that is not a render, tests included.
 * A 60 s TTL is a superset of one-query-per-request; domains change only through
 * an admin action and are never attacker-controlled.
 */
const SITE_DOMAINS_TTL_MS = 60_000
const siteDomainsCache = new Map<string, { at: number; domains: string[] }>()

/** Test hook — clears the memo between cases. Not used by production code. */
export function __resetSiteDomainsCache(): void {
  siteDomainsCache.clear()
}

export async function getSiteDomains(siteId: string): Promise<string[]> {
  const cached = siteDomainsCache.get(siteId)
  if (cached && Date.now() - cached.at < SITE_DOMAINS_TTL_MS) return cached.domains

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('sites')
    .select('domains')
    .eq('id', siteId)
    .maybeSingle()

  // Fail closed and do NOT cache a failure — a transient error must not pin an
  // empty allow-list for a minute.
  if (error || !data) return []

  const raw = (data as { domains?: unknown }).domains
  if (!Array.isArray(raw)) return []

  const domains = raw
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .map((d) => d.toLowerCase())
    .filter((d) => !isLoopbackHostname(d))

  siteDomainsCache.set(siteId, { at: Date.now(), domains })
  return domains
}

export function resolveOAuthOrigin(req: Request, allowedHosts: string[]): string | null {
  const hostHeader = req.headers.get('host')
  if (!hostHeader) return null
  const hostname = hostnameOf(hostHeader)
  if (!hostname) return null

  // (i) loopback first — deliberately refused in production AND in preview
  //     (`NODE_ENV === 'production'` covers both on Vercel).
  if (isLoopbackHostname(hostname)) {
    if (process.env.NODE_ENV === 'production') return null
    const proto = req.headers.get('x-forwarded-proto') ?? 'http'
    return `${proto}://${hostHeader.trim().toLowerCase()}`
  }

  // (ii) allow-listed host — https, no port.
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()))
  if (allowed.has(hostname)) return `https://${hostname}`

  // (iii) anything else.
  return null
}

/**
 * Fetch Metadata guard for the START of a flow.
 *
 * Returns a DESCRIPTOR, never a `Response` and never a throw: the caller has to
 * render the refusal through `oauthResultHtml` (403 `text/html`), because the
 * route is opened in a window the user is looking at — JSON or a 500 there is a
 * dead end.
 *
 * Decision: a MISSING header ALLOWS. WebViews and in-app browsers send no Fetch
 * Metadata; refusing them would strand the owner on the device most likely to be
 * holding the alert. The real defence of the start is session + state HMAC +
 * origin + nonce.
 */
export function assertSameOriginFetch(req: Request): IOauthDenyDescriptor | null {
  const site = req.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') {
    return { status: 403, code: 'cross_origin' }
  }
  return null
}
```

- [ ] **Step 4: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/api/oauth/origin.test.ts
```
Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/oauth/origin.ts apps/web/test/api/oauth/origin.test.ts
git commit -m "chore(oauth): extrair origin.ts com allow-list de dominios e fetch metadata

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 5: Início social passa a assinar `typ` + `exp`

**Files:**
- Modify: `apps/web/src/app/api/social/oauth/[provider]/route.ts` (remove `deriveHmacKey` `:32-35` e `signState` `:37-40`; reescreve `:67-68`)
- Create: `apps/web/test/api/oauth/social-routes.test.ts` (só o `describe` do início nesta task)

**Interfaces:**
- Consumes: `deriveHmacKey`, `signState`, `SOCIAL_STATE_LABEL`, `STATE_TTL_SECONDS` de `@/lib/oauth/state` (Task 1).
- Produces: nada de novo para tasks posteriores — o contrato produzido é o **formato do `state` no fio**: `{ typ:'state', siteId, userId, exp }`, base64+`.`+hmac, `encodeURIComponent`-ado.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/test/api/oauth/social-routes.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { deriveHmacKey, verifyState, SOCIAL_STATE_LABEL } from '@/lib/oauth/state'
import { GET as START } from '../../../src/app/api/social/oauth/[provider]/route'

const SITE = '11111111-2222-4333-8444-555555555555'
const USER = '66666666-7777-4888-8999-aaaaaaaaaaaa'
const MASTER = 'f'.repeat(64)
const KEY = deriveHmacKey(MASTER, SOCIAL_STATE_LABEL)
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0)

function startReq(): NextRequest {
  return new NextRequest('https://bythiagofigueiredo.com/api/social/oauth/google')
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SOCIAL_MASTER_KEY = MASTER
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
  vi.mocked(getSiteContext).mockResolvedValue({
    siteId: SITE,
    orgId: 'org',
    defaultLocale: 'en',
    timezone: 'America/Sao_Paulo',
  })
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('social oauth start', () => {
  it('signs a state with typ, siteId, userId and a 30-minute exp', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })

    expect(res.status).toBe(307)
    const location = res.headers.get('location')
    expect(location).not.toBeNull()
    const stateParam = new URL(location!).searchParams.get('state')
    expect(stateParam).not.toBeNull()

    const payload = verifyState(stateParam!, KEY, { typ: 'state', requireExp: true })
    expect(payload).not.toBeNull()
    expect(payload!.siteId).toBe(SITE)
    expect(payload!.userId).toBe(USER)
    expect(payload!.exp).toBe(Math.floor(NOW / 1000) + 1800)
  })

  it('signs the same shape for meta', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    process.env.META_APP_ID = 'meta-app-id'
    const res = await START(
      new NextRequest('https://bythiagofigueiredo.com/api/social/oauth/meta'),
      { params: Promise.resolve({ provider: 'meta' }) },
    )
    const stateParam = new URL(res.headers.get('location')!).searchParams.get('state')
    expect(verifyState(stateParam!, KEY, { typ: 'state', requireExp: true })).not.toBeNull()
  })

  it('the signed state stops verifying 31 minutes later', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })
    const stateParam = new URL(res.headers.get('location')!).searchParams.get('state')
    vi.setSystemTime(NOW + 31 * 60_000)
    expect(verifyState(stateParam!, KEY, { typ: 'state', requireExp: true })).toBeNull()
  })

  it('still refuses an unauthorized caller with 401 json', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const res = await START(startReq(), { params: Promise.resolve({ provider: 'google' }) })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/api/oauth/social-routes.test.ts
```
Expected: FAIL — `verifyState(...)` devolve `null` no primeiro `it` ("expected null not to be null"), porque o `state` atual não tem `typ` nem `exp`.

- [ ] **Step 3: Implementação mínima**

Em `apps/web/src/app/api/social/oauth/[provider]/route.ts`:

1. Trocar o import de `node:crypto` pelo do lib. Substituir as linhas 1-4:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  deriveHmacKey,
  signState,
  SOCIAL_STATE_LABEL,
  STATE_TTL_SECONDS,
} from '@/lib/oauth/state'
```

2. Apagar `deriveHmacKey` (`:32-35`) e `signState` (`:37-40`) — o bloco inteiro entre o `META_SCOPES` e o `getCallbackUrl`, incluindo o comentário `/** Derive a purpose-specific HMAC key … */`. `getCallbackUrl` (`:42-45`) **permanece** (spec §3.0: não é extraído em B).

3. Substituir as duas linhas do `statePayload`/`signedState` (`:67-68`) por:

```ts
  const signedState = encodeURIComponent(
    signState(
      {
        typ: 'state',
        siteId,
        userId: auth.user.id,
        // Seconds since the epoch. The Meta/Google `code` lives ~1 h; the state
        // closes at 30 min so a captured URL stops being a completion token.
        exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
      },
      deriveHmacKey(masterKey, SOCIAL_STATE_LABEL),
    ),
  )
```

- [ ] **Step 4: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/api/oauth/social-routes.test.ts
```
Expected: PASS — 4 testes verdes.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/api/social/oauth/[provider]/route.ts" apps/web/test/api/oauth/social-routes.test.ts
git commit -m "chore(oauth): inicio social assina typ e exp de 30 min via lib/oauth/state

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 6: Callback social — helpers, `requireSiteScope`, `user.id === state.userId`, `nonce`

**Files:**
- Modify: `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts` (remove `recordSocialConsent` `:8-41`, `deriveHmacKey` `:43-46`, `escapeHtml` `:48-50`, `oauthResultHtml` `:52-74`, `verifyState` `:76-94`; reescreve o `GET` `:247-420`; mantém `getCallbackUrl` `:242-245` e os 6 fetchers da Meta/Google)
- Modify: `apps/web/test/api/oauth/social-routes.test.ts` (acrescenta o `describe` do callback)

**Interfaces:**
- Consumes: `deriveHmacKey`, `verifyState`, `SOCIAL_STATE_LABEL` (Task 1); `oauthResultHtml` (Task 2); `recordSocialConsent` (Task 3).
- Produces: nada para tasks posteriores. O contrato produzido é o **payload de `postMessage`** que a Task 7 valida do outro lado: `{ type:'social-oauth-result', success, provider, error?, code? }`, entregue com `targetOrigin = NEXT_PUBLIC_APP_URL`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `apps/web/test/api/oauth/social-routes.test.ts` (e completar os mocks no topo do arquivo — o bloco de `vi.mock` do topo passa a incluir os três abaixo, colocados **antes** dos imports estáticos):

```ts
// --- acrescentar ao bloco de mocks NO TOPO do arquivo, junto dos que já existem ---
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-nonce': 'test-nonce-abc', 'x-default-locale': 'pt-BR' }),
}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockServiceClient,
}))
vi.mock('@tn-figueiredo/social/vault', () => ({
  encrypt: (plain: string) => `v1:${plain}`,
  getMasterKey: () => Buffer.alloc(32),
}))
```

E, no bloco de imports do topo, estender a linha de `@/lib/oauth/state` e acrescentar o import do callback:

```ts
import {
  deriveHmacKey,
  signState,
  verifyState,
  SOCIAL_STATE_LABEL,
  STATE_TTL_SECONDS,
} from '@/lib/oauth/state'
import { GET as START } from '../../../src/app/api/social/oauth/[provider]/route'
import { GET as CALLBACK } from '../../../src/app/api/social/oauth/[provider]/callback/route'
```

```ts
// --- acrescentar ao fim do arquivo ---

function makeServiceClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const insert = vi.fn().mockResolvedValue({ error: null })
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: 'social_integration_v1_pt-BR' },
    error: null,
  })
  const chain: Record<string, unknown> = {
    upsert,
    insert,
    maybeSingle,
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }
  for (const key of ['select', 'eq', 'is', 'order', 'limit']) {
    ;(chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  }
  const from = vi.fn().mockReturnValue(chain)
  return { from, chain, upsert, insert, maybeSingle }
}

function callbackReq(state: string, code = 'meta-code'): NextRequest {
  return new NextRequest(
    `https://bythiagofigueiredo.com/api/social/oauth/google/callback?code=${code}&state=${encodeURIComponent(state)}`,
    { headers: { 'user-agent': 'Mozilla/5.0 (Test)', 'x-forwarded-for': '203.0.113.9' } },
  )
}

function validState(now: number) {
  return signState(
    { typ: 'state', siteId: SITE, userId: USER, exp: Math.floor(now / 1000) + STATE_TTL_SECONDS },
    KEY,
  )
}

describe('social oauth callback — state and session', () => {
  beforeEach(() => {
    mockServiceClient = makeServiceClient()
  })

  it('rejects a state with no exp as 400 invalid_state and writes nothing', async () => {
    const state = signState({ typ: 'state', siteId: SITE, userId: USER }, KEY)
    const res = await CALLBACK(callbackReq(state), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(400)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const html = await res.text()
    expect(html).toContain('Invalid or expired authorization')
    expect(html).toContain('"code":"invalid_state"')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
    expect(mockServiceClient.insert).not.toHaveBeenCalled()
  })

  it('rejects a well-signed but EXPIRED state as 400, with no consent write', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const state = validState(NOW)
    vi.setSystemTime(NOW + 31 * 60_000)
    const res = await CALLBACK(callbackReq(state), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid or expired authorization')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
    expect(mockServiceClient.insert).not.toHaveBeenCalled()
    expect(requireSiteScope).not.toHaveBeenCalled()
  })

  it('returns 401 session_changed when there is no session, and writes nothing', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(401)
    const html = await res.text()
    expect(html).toContain('"code":"session_changed"')
    expect(html).toContain('Session changed during authorization')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
    expect(mockServiceClient.insert).not.toHaveBeenCalled()
  })

  it('returns 403 session_changed for insufficient_access', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('"code":"session_changed"')
  })

  it('returns 401 when the signed-in user is not the one who started the flow', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({
      ok: true,
      user: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(res.status).toBe(401)
    expect(await res.text()).toContain('"code":"session_changed"')
    expect(mockServiceClient.upsert).not.toHaveBeenCalled()
  })

  it('re-checks the scope against the state siteId, in edit mode', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'edit' })
  })
})

describe('social oauth callback — success path', () => {
  beforeEach(() => {
    mockServiceClient = makeServiceClient()
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response(
          JSON.stringify({
            items: [{ id: 'ch1', snippet: { title: 'My Channel' }, statistics: {} }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connects, records consent with insert, and returns 200 html carrying the nonce', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    const res = await CALLBACK(callbackReq(validState(NOW)), {
      params: Promise.resolve({ provider: 'google' }),
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<script nonce="test-nonce-abc">')
    expect(html).toContain('"type":"social-oauth-result"')
    expect(html).toContain('"success":true')
    expect(html).toContain('href="/cms/social/accounts"')

    expect(mockServiceClient.upsert).toHaveBeenCalledTimes(1)
    expect(mockServiceClient.insert).toHaveBeenCalledTimes(1)
    const consentRow = mockServiceClient.insert.mock.calls[0]![0] as Record<string, unknown>
    expect(consentRow.category).toBe('social_integration')
    expect(consentRow.user_id).toBe(USER)
    expect(consentRow.site_id).toBe(SITE)
    expect(consentRow.ip).toBe('203.0.113.9')
  })
})
```

E, no topo do arquivo (antes dos `vi.mock`), declarar o holder mutável que os mocks fecham por cima:

```ts
let mockServiceClient: ReturnType<typeof makeServiceClient>
```

> Nota de ordenação: `vi.mock` é içado, mas a *factory* só roda no primeiro import — por isso a factory referencia `mockServiceClient` por closure (o prefixo `mock` no nome é o que faz o Vitest aceitar a referência a uma variável externa) e cada `beforeEach` reatribui a variável. `makeServiceClient` é uma *function declaration*, portanto também é içada e pode ser referenciada antes da definição textual.

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/api/oauth/social-routes.test.ts
```
Expected: FAIL — o callback atual devolve 200 em todos os ramos e o HTML não tem `nonce`; primeiro erro: `expected 200 to be 400` em `rejects a state with no exp`.

- [ ] **Step 3: Implementação — cabeçalho e remoção das cópias inline**

Em `apps/web/src/app/api/social/oauth/[provider]/callback/route.ts`, substituir as linhas 1-94 (imports + `recordSocialConsent` + `deriveHmacKey` + `escapeHtml` + `oauthResultHtml` + `verifyState`) por:

```ts
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { encrypt, getMasterKey } from '@tn-figueiredo/social/vault'
import { deriveHmacKey, verifyState, SOCIAL_STATE_LABEL } from '@/lib/oauth/state'
import { oauthResultHtml, type OauthResultExtra } from '@/lib/oauth/popup-result'
import { recordSocialConsent } from '@/lib/oauth/consent'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export const runtime = 'nodejs'

/** Where the popup sends the user when it cannot close itself. */
const SOCIAL_BACK_HREF = '/cms/social/accounts'

function getTargetOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function resultHtml(
  provider: string,
  success: boolean,
  nonce: string,
  opts: { error?: string; extra?: OauthResultExtra; status?: number } = {},
): Response {
  return oauthResultHtml({
    messageType: 'social-oauth-result',
    provider,
    success,
    error: opts.error,
    extra: opts.extra,
    backHref: SOCIAL_BACK_HREF,
    targetOrigin: getTargetOrigin(),
    nonce,
    status: opts.status,
  })
}
```

As funções `exchangeGoogleCode`, `fetchYouTubeChannel`, `exchangeMetaCode`, `fetchMetaPages`, `fetchInstagramAccount`, `fetchInstagramProfile`, as interfaces `YouTubeChannelInfo`/`MetaPage`/`MetaIgAccount` e `getCallbackUrl` (`:242-245`) **ficam intactas**.

- [ ] **Step 4: Implementação — o `GET`**

Substituir o corpo do `export async function GET` (hoje `:247-420`) por:

```ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')
  // `src/middleware.ts:169`. Under `getCspMode() === 'enforced'` an untagged
  // inline script would be blocked and the opener would never hear back.
  const nonce = (await headers()).get('x-nonce') ?? ''

  if (errorParam) {
    return resultHtml(provider, false, nonce, { error: errorParam })
  }

  if (!code || !stateRaw) {
    return resultHtml(provider, false, nonce, { error: 'Missing code or state' })
  }

  try {
    const masterKeyHex = process.env.SOCIAL_MASTER_KEY
    if (!masterKeyHex) {
      return resultHtml(provider, false, nonce, { error: 'SOCIAL_MASTER_KEY not configured' })
    }

    const stateData = verifyState(
      stateRaw,
      deriveHmacKey(masterKeyHex, SOCIAL_STATE_LABEL),
      { typ: 'state', requireExp: true },
    )
    if (!stateData || !stateData.userId) {
      return resultHtml(provider, false, nonce, {
        error: 'Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS',
        extra: { code: 'invalid_state' },
        status: 400,
      })
    }

    const { siteId, userId } = stateData

    // The callback used to write with the service client and NO session at all.
    const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!auth.ok) {
      return resultHtml(provider, false, nonce, {
        error: 'Session changed during authorization — sign in and try again',
        extra: { code: 'session_changed' },
        status: auth.reason === 'unauthenticated' ? 401 : 403,
      })
    }
    if (auth.user.id !== userId) {
      return resultHtml(provider, false, nonce, {
        error: 'Session changed during authorization — sign in and try again',
        extra: { code: 'session_changed' },
        status: 401,
      })
    }

    const supabase = getSupabaseServiceClient()
    const redirectUri = getCallbackUrl(provider)
    const encKey = getMasterKey()

    switch (provider) {
      case 'google': {
        const tokens = await exchangeGoogleCode(code, redirectUri)
        const channel = await fetchYouTubeChannel(tokens.access_token)
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

        const accessTokenEnc = encrypt(tokens.access_token, encKey)
        const refreshTokenEnc = tokens.refresh_token
          ? encrypt(tokens.refresh_token, encKey)
          : null

        const { error } = await supabase.from('social_connections').upsert(
          {
            site_id: siteId,
            provider: 'youtube' as const,
            account_id: channel.channelId,
            account_name: channel.customUrl ?? channel.channelTitle,
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc,
            token_expires_at: expiresAt,
            scopes: ['youtube.upload', 'youtube', 'yt-analytics.readonly'],
            metadata: {
              channel_id: channel.channelId,
              channel_title: channel.channelTitle,
              custom_url: channel.customUrl,
              thumbnail_url: channel.thumbnailUrl,
              subscriber_count: channel.subscriberCount,
              video_count: channel.videoCount,
              view_count: channel.viewCount,
            },
            revoked_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'site_id,provider,account_id' },
        )

        if (error) throw new Error(`DB upsert failed: ${error.message}`)
        await recordSocialConsent(supabase, {
          userId,
          siteId,
          category: 'social_integration',
          req,
        })
        return resultHtml('youtube', true, nonce)
      }

      case 'meta': {
        const tokens = await exchangeMetaCode(code, redirectUri)
        const expiresInMs = (tokens.expires_in ?? 5_184_000) * 1000
        const expiresAt = new Date(Date.now() + expiresInMs).toISOString()

        const userAccessTokenEnc = encrypt(tokens.access_token, encKey)

        const pages = await fetchMetaPages(tokens.access_token)
        if (pages.length === 0) {
          return resultHtml('facebook', false, nonce, {
            error: 'No Facebook Pages found for this account',
          })
        }

        // v1: use the first page
        const page = pages[0]!
        const pageTokenEnc = encrypt(page.access_token, encKey)

        const { error: fbError } = await supabase.from('social_connections').upsert(
          {
            site_id: siteId,
            provider: 'facebook' as const,
            account_id: page.id,
            account_name: page.name,
            access_token_enc: userAccessTokenEnc,
            refresh_token_enc: null,
            page_token_enc: pageTokenEnc,
            token_expires_at: expiresAt,
            scopes: [
              'pages_manage_posts',
              'pages_read_engagement',
              'pages_show_list',
              'read_insights',
              'instagram_basic',
              'instagram_content_publish',
              'instagram_manage_insights',
            ],
            metadata: {
              page_id: page.id,
              page_name: page.name,
              picture_url: page.picture?.data?.url ?? null,
              fan_count: page.fan_count ?? null,
              follower_count: page.followers_count ?? null,
            },
            revoked_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'site_id,provider,account_id' },
        )

        if (fbError) throw new Error(`Facebook DB upsert failed: ${fbError.message}`)

        const igAccount = await fetchInstagramAccount(page.id, tokens.access_token)

        if (igAccount) {
          const igProfile = await fetchInstagramProfile(igAccount.id, tokens.access_token)

          const { error: igError } = await supabase.from('social_connections').upsert(
            {
              site_id: siteId,
              provider: 'instagram' as const,
              account_id: igAccount.id,
              account_name: igAccount.username,
              access_token_enc: userAccessTokenEnc,
              refresh_token_enc: null,
              page_token_enc: pageTokenEnc,
              token_expires_at: expiresAt,
              scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
              metadata: {
                ig_user_id: igAccount.id,
                ig_username: igAccount.username,
                page_id: page.id,
                page_name: page.name,
                profile_picture_url: igProfile.profilePictureUrl,
                followers_count: igProfile.followersCount,
                media_count: igProfile.mediaCount,
              },
              revoked_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'site_id,provider,account_id' },
          )

          if (igError) throw new Error(`Instagram DB upsert failed: ${igError.message}`)
        }

        await recordSocialConsent(supabase, {
          userId,
          siteId,
          category: 'social_integration',
          req,
        })
        return resultHtml('facebook', true, nonce)
      }

      default:
        return resultHtml(provider, false, nonce, {
          error: `Unsupported provider: ${provider}`,
        })
    }
  } catch (err) {
    console.error('[oauth-callback]', provider, err)
    return resultHtml(provider, false, nonce, {
      error: 'OAuth authentication failed. Please try again.',
    })
  }
}
```

Notas de comportamento preservado deliberadamente: os ramos `errorParam`, `Missing code or state`, `SOCIAL_MASTER_KEY not configured`, `No Facebook Pages found`, `Unsupported provider` e o `catch` final continuam respondendo **200** — nenhum deles é asserido por §6 e mudar-lhes o status não faz parte de B. Os únicos status novos são 400 (`invalid_state`), 401 e 403 (`session_changed`).

- [ ] **Step 5: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/api/oauth/social-routes.test.ts
```
Expected: PASS — 4 testes do início + 6 do `state`/sessão + 1 do caminho de sucesso.

- [ ] **Step 6: Rodar a suíte inteira (o callback é consumido por outros testes)**

```bash
cd apps/web && npx vitest run
```
Expected: PASS em todos os arquivos (~1078 arquivos, ~160 s). Se algum teste de social/youtube quebrar por causa do `nonce` ou do `requireSiteScope`, o fix vai **neste** commit.

- [ ] **Step 7: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/api/social/oauth/[provider]/callback/route.ts" apps/web/test/api/oauth/social-routes.test.ts
git commit -m "chore(oauth): callback social usa lib/oauth, re-checa sessao e injeta nonce

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 7: Os 3 listeners de `social-oauth-result` ganham checagem de `origin`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/social/accounts/_components/oauth-button.tsx:55`
- Modify: `apps/web/src/app/cms/(authed)/youtube/_components/youtube-shell.tsx:57`
- Modify: `apps/web/src/app/cms/(authed)/youtube/dashboard-connected.tsx:170`
- Modify: `apps/web/test/cms/social-oauth.test.tsx:124-128,137-141`

**Interfaces:**
- Consumes: o payload de `postMessage` da Task 6 (`{ type:'social-oauth-result', success, provider, … }`, `targetOrigin = NEXT_PUBLIC_APP_URL`).
- Produces: nada — é o fim da cadeia.

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/web/test/cms/social-oauth.test.tsx`, substituir os dois `it` de `:120-145` por estes três:

```tsx
  it('calls router.refresh after successful oauth message from the same origin', async () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    // Simulate popup sending success message
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'social-oauth-result', success: true },
      }),
    )
    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
    })
  })

  it('does not call router.refresh on failed oauth result', async () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'social-oauth-result', success: false },
      }),
    )
    await waitFor(() => {
      expect(mockRouterRefresh).not.toHaveBeenCalled()
    })
  })

  it('ignores a success message from a foreign origin', async () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: 'social-oauth-result', success: true },
      }),
    )
    // Give the listener a tick to (not) run.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockRouterRefresh).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

```bash
cd apps/web && npx vitest run test/cms/social-oauth.test.tsx
```
Expected: FAIL — `ignores a success message from a foreign origin`: `expected "refresh" to not be called, but it was called 1 time` (o listener atual não olha `event.origin`).

- [ ] **Step 3: Implementação — `oauth-button.tsx`**

Em `apps/web/src/app/cms/(authed)/social/accounts/_components/oauth-button.tsx`, dentro de `const onMessage = (event: MessageEvent) => {`, inserir a checagem como **primeira** instrução, antes do `if (event.data?.type === 'social-oauth-result')` (linha 55):

```tsx
      const onMessage = (event: MessageEvent) => {
        // Anyone can postMessage into this window. The popup only ever speaks
        // from our own origin.
        if (event.origin !== window.location.origin) return
        if (event.data?.type === 'social-oauth-result') {
```

- [ ] **Step 4: Implementação — `youtube-shell.tsx`**

Em `apps/web/src/app/cms/(authed)/youtube/_components/youtube-shell.tsx`, mesma inserção antes do `if` da linha 57:

```tsx
      const onMessage = (event: MessageEvent) => {
        // Anyone can postMessage into this window. The popup only ever speaks
        // from our own origin.
        if (event.origin !== window.location.origin) return
        if (event.data?.type === 'social-oauth-result') {
```

- [ ] **Step 5: Implementação — `dashboard-connected.tsx`**

Em `apps/web/src/app/cms/(authed)/youtube/dashboard-connected.tsx`, mesma inserção antes do `if` da linha 170:

```tsx
      const onMessage = (event: MessageEvent) => {
        // Anyone can postMessage into this window. The popup only ever speaks
        // from our own origin.
        if (event.origin !== window.location.origin) return
        if (event.data?.type === 'social-oauth-result') {
```

- [ ] **Step 6: Rodar o teste e conferir que passa**

```bash
cd apps/web && npx vitest run test/cms/social-oauth.test.tsx
```
Expected: PASS — 3 testes do `OauthButton` verdes, incluindo o de origem estrangeira.

- [ ] **Step 7: Conferir que os 3 listeners foram tratados**

```bash
cd apps/web && grep -rn -B2 "event.data?.type === 'social-oauth-result'" src/ | grep -c "event.origin !== window.location.origin"
```
Expected: `3`.

- [ ] **Step 8: Suíte inteira + typecheck**

```bash
cd apps/web && npx vitest run && npx tsc --noEmit
```
Expected: PASS + exit 0.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/social/accounts/_components/oauth-button.tsx" \
        "apps/web/src/app/cms/(authed)/youtube/_components/youtube-shell.tsx" \
        "apps/web/src/app/cms/(authed)/youtube/dashboard-connected.tsx" \
        apps/web/test/cms/social-oauth.test.tsx
git commit -m "chore(oauth): checar event.origin nos 3 listeners de social-oauth-result

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s"
```

---

### Task 8: Gate de promoção de B (spec §7 passo 1)

**Files:** nenhum arquivo do repositório é modificado nesta task — é verificação em produção.

**Interfaces:**
- Consumes: a série de commits das Tasks 1-7 em `staging`, com CI verde.
- Produces: a decisão de promover B sozinho **ou** de segurá-lo para viajar junto de C3.

**Regra bloqueante (spec §0 linha B e §7 passo 1), escrita por extenso:**

> **Se a validação em produção do OAuth social não puder acontecer em até 30 minutos depois da promoção, B NÃO é promovido sozinho: os commits ficam em `staging` e B viaja junto de C3.**
>
> O motivo é que B muda o fluxo social **vivo** em três pontos que nenhum teste local exercita de ponta a ponta: o `state` passa a ter `typ`+`exp` (um descasamento entre início e callback derruba toda conexão social), o callback passa a exigir sessão (um `requireSiteScope` que se comporte diferente em produção derruba toda conexão social) e o HTML do popup passa a carregar `nonce` (se `getCspMode()` estiver `'enforced'` e o nonce não casar, o `<script>` é bloqueado e o opener nunca sai do estado "conectando"). Sem uma pessoa capaz de clicar "Connect" em produção logo depois do deploy, a regressão só apareceria na próxima vez que alguém reconectasse o YouTube — dias ou semanas depois.

- [ ] **Step 1: CI verde em `staging`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git log --oneline -7 && npm run test:web && npm run typecheck
```
Expected: os 7 commits `chore(oauth): …` no topo; `test:web` verde; `typecheck` exit 0.

- [ ] **Step 2: Decidir a janela ANTES de promover**

Confirmar com o dono que ele tem 30 minutos disponíveis logo após a promoção para abrir `/cms/social/accounts` em produção e clicar "Connect".

- **Não tem a janela** ⇒ **PARAR AQUI.** Não promover. Registrar no README dos planos que B está pronto em `staging` e viaja com C3. Seguir para o plano de C1.
- **Tem a janela** ⇒ seguir para o Step 3.

- [ ] **Step 3: Gate do `consent_texts` — semear se faltar em produção**

No SQL editor do projeto de produção (`novkqtvcnsiwhkxihurk`):

```sql
select id, locale, version, effective_at, superseded_at
  from public.consent_texts
 where category = 'social_integration'
 order by locale;
```
Expected: **2 linhas** (`social_integration_v1_pt-BR` e `social_integration_v1_en`), ambas com `superseded_at is null`.

Se vier **0 linhas** (a migration `20260524000002_social_consent_category.sql` não chegou a produção), aplicar as pendentes antes de qualquer coisa:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:link:prod && npx supabase migration list
```
Expected: nenhuma pendente. Se houver, `npm run db:push:prod` e repetir o `select` acima até dar 2 linhas.

> Sem essas linhas, `recordSocialConsent` sai pelo ramo "no consent text", registra um `captureMessage` e **não grava consentimento nenhum** — e a asserção do Step 6 abaixo devolveria `0`.

- [ ] **Step 4: Registrar o modo de CSP em produção**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vercel env ls production | grep -E 'CSP_NONCE_ENABLED|CSP_NONCE_REPORT_ONLY' || echo 'ambas ausentes => modo legacy'
```
Expected: uma das três saídas. Anotar qual. Se `CSP_NONCE_ENABLED=true` (modo `enforced`), o teste real do Step 5 é também a prova do `nonce` — é exatamente o caso que o spec §7 chama de "o OAuth social real de B prova o nonce".

- [ ] **Step 5: Promover e validar em ≤ 30 min**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git push origin staging
# aguardar CI verde, então:
git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

Assim que o deploy de produção terminar, no navegador:

1. Abrir `https://bythiagofigueiredo.com/cms/social/accounts` autenticado.
2. Clicar em **Connect** no card do YouTube (ou **Reconnect**, se já conectado).
3. Concluir a autorização do Google no popup.

Expected: o popup exibe **"Connected! This window will close."**, fecha sozinho em ~1,5 s, e a página do CMS se atualiza mostrando o canal conectado. Se o popup ficar aberto sem texto, ou o CMS não atualizar, abrir o console do navegador: um erro de CSP (`Refused to execute inline script`) aponta nonce; um HTML de "Invalid or expired authorization" aponta `state`; um de "Session changed during authorization" aponta `requireSiteScope`.

- [ ] **Step 6: Provar a gravação do consentimento**

No SQL editor de produção, **dentro de 10 minutos** do clique:

```sql
select count(*)
  from public.consents
 where category = 'social_integration'
   and granted_at > now() - interval '10 minutes';
```
Expected: **1**.

Se vier `0`, a conexão foi feita mas o consentimento LGPD não gravou — é o bug que B existe para corrigir e **precisa ser investigado antes de C3** (checar Sentry por `recordSocialConsent:` nos últimos minutos).

- [ ] **Step 7: Rollback, se o Step 5 ou o Step 6 falharem**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git log --oneline --grep='chore(oauth)' -7
# reverter em ORDEM INVERSA (Task 7 primeiro, Task 1 por último):
git revert --no-edit <sha-task7> <sha-task6> <sha-task5> <sha-task4> <sha-task3> <sha-task2> <sha-task1>
git push origin staging
```
Expected: árvore de volta ao estado pré-B; `npx vitest run` verde; o fluxo social volta ao comportamento de hoje (sem `exp`, sem sessão no callback, sem `nonce`).

- [ ] **Step 8: Registrar o desfecho**

Anotar no runbook de operação (ou no README dos planos, seção de status) qual host serviu o callback sem 308, o modo de CSP registrado no Step 4, e a hora do clique validado. Esses três fatos são consumidos pelos gates de C3.

---

## Notas de auto-revisão

**Cobertura do spec §3.0, item a item:**

| Requisito §3.0 | Onde |
|---|---|
| `deriveHmacKey(masterKeyHex, label)`, dois rótulos | Task 1 |
| `signState` inclui `typ` | Task 1 |
| `verifyState(signed, key, opts?)` com `typ`/`requireNonce`/`requireExp` | Task 1 |
| Forma validada sempre (objeto não-nulo não-array; UUIDs; strings não vazias) | Task 1 |
| `exp` em segundos, comparado com o relógio, incondicional, `MUST NOT throw` | Task 1 |
| `oauthResultHtml({...})` com `status?`, `nonce`, `headers?` | Task 2 |
| `extra` só enum; `backHref` relativo + allow-list de 3 rótulos | Task 2 |
| `window.close` só com opener; literais preservados; `</` escapado | Task 2 |
| `OauthErrorCode` em `errors.ts`, módulo só de tipo | Task 2 |
| `recordSocialConsent(supabase, { userId, siteId, category, req })`, locale, `insert`+`23505`, `try/catch` | Task 3 |
| `getSiteDomains` (service client, memoizado, filtra loopback) | Task 4 |
| `resolveOAuthOrigin` — loopback → allow-list → `null`; `production` recusa loopback | Task 4 |
| `assertSameOriginFetch` — descritor, ausente ⇒ ALLOW, nunca lança | Task 4 |
| Start social assina `exp: now+30min` | Task 5 |
| Callback `{ typ:'state', requireExp:true }` + `requireSiteScope` + `user.id === state.userId` | Task 6 |
| HTML do popup social com `nonce` | Task 6 |
| 3 listeners com `origin` (§3.5) | Task 7 |
| `test/cms/social-oauth.test.tsx:124-128,137-141` editado | Task 7 |
| `test/api/oauth/{state,popup-result,consent,origin}.test.ts` | Tasks 1-4 |
| Gate §7: OAuth social em produção ≤ 30 min; `consent_texts` `social_integration` | Task 8 |
</content>
</invoke>
