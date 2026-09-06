# C2 — `feat(instagram): renovação observável (backend)` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task, **in order**. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a renovação do token do Instagram deixar rastro: token cifrado em repouso, erro classificado, episódio aberto/fechado no banco, alerta que sai por ntfy + CMS + e-mail no mesmo dia, e dois crons diários (11:00/13:00 UTC) cujo canal de garantia é vigiado por eles mesmos e por um terceiro agendador fora da Vercel.

**Architecture:** C2 é o maior commit da entrega. Ele é implementado como **19 tarefas → 19 commits pequenos e sequenciais em `staging`** (18 antes do push — Tarefa 1 registra os gates no runbook e Tarefas 2-18 entregam o código; o 19º registra os gates pós-promoção), na ordem abaixo, **e o conjunto é empurrado uma única vez** (`git push`) depois que a Tarefa 19 (gates pós-C2 locais) fecha verde — cada push dispara builds na Vercel e o orçamento é limitado (memória `feedback_no_wasteful_pushes` / `feedback_cautious_pushes`). Dividir em commits pequenos é deliberado: cada um é bisectável e revisável isoladamente; o `git revert` de C2 continua sendo o revert do intervalo inteiro (`git revert --no-commit <primeiro>^..<último>`), e o **passo de banco obrigatório** de §7 acompanha o revert.

**Tech Stack:** Next.js 16.3.4 (App Router, `after()`, `revalidateTag(tag, { expire: 0 })`), React 19, TypeScript 5 strict, Supabase (PostgreSQL 17, PostgREST, RLS, `SECURITY DEFINER`), Vitest (happy-dom default; `// @vitest-environment node` para servidor), `@vercel/blob` 2.5.0, `@tn-figueiredo/social/vault` (AES-256-GCM), ntfy, Sentry, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **C2**, §2, §3.2, §3.3, §3.4, §3.5 (só a rota curta), §3.6, §4, §6, §7.

**Índice dos planos:** `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`

---

## Global Constraints

Herdadas do README (valem para toda tarefa deste plano):

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` (`lib/home/queries.ts`, `lib/cms/site-context.ts`, `lib/supabase/service.ts`) e `apps/web/src/lib/` (`src/lib/instagram/*`, `src/lib/notifications/*`, `src/lib/ops/*`, `src/lib/logger.ts`, `src/lib/cron-health.ts`, `src/lib/env.ts`, `src/lib/sentry-pii.ts`, `src/lib/redact-secrets.ts`). Há dois `queries.ts` — sempre qualificar.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `instagram`, `oauth`, `ops`, `notifications` caem no catch-all `@/*` → `src/`.
- TypeScript: **nunca `any`**; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Ratchet Next 16 (`test/unit/use-server-exports.test.ts:20-23`): em arquivos `'use server'` só `export async function` / `export type` / `export interface` / `export { type … }`.
- Nunca passar `next/link` (ou componente importado num Server Component) como prop para client component.
- Server actions de escrita chamam `requireEditAccess()` (→ `{ siteId, userId }` **a partir deste commit**) no topo; `getSupabaseServiceClient()` só após guard de site.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; sanitizers nunca sob happy-dom; fixtures temporais relativas ou com `vi.useFakeTimers`; **fix de teste vai no mesmo commit**.
- Migrations: **sempre** `npm run db:new <nome>`. **C2 NÃO cria migration** — M1 é de C1 e já tem de estar em produção (gate da Tarefa 1).
- `revalidateTag(tag, { expire: 0 })` — segundo argumento obrigatório; `await cookies()`.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`reset`; **push só depois da Tarefa 19**.
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- `SOCIAL_MASTER_KEY` fora de `env.ts`; `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` lidos de `process.env` direto (declarados `.optional()` em `serverSchema`).
- Definições nomeadas do spec valem **por nome**:
  - **`CAMPOS_DE_EPISÓDIO` (5):** `token_error`, `token_error_at`, `token_error_mode`, `token_alert_sent_at`, `token_alert_attempt_at`. `token_reprobe_at` **não** é campo de episódio, mas é zerado junto no sucesso/reconexão/disconnect.
  - **Horários:** refresh `"0 11 * * *"`, sync `"0 13 * * *"` (UTC) = 08:00 / 10:00 em `America/Sao_Paulo`.
  - **REGRA-PII-NTFY (MUST):** nenhum push ntfy carrega `@handle`, `token_error`, ids ou tokens — nem `title` nem `body`; o `title` identifica o site por `sites.slug`.
- Plano Vercel **Pro** confirmado (2026-09-06). Fuso do dono decidido: `America/Sao_Paulo`, horários mantidos.

### Comandos usados em todas as tarefas

```bash
# rodar UM arquivo de teste (rápido, ~1s)
npm test --workspace=apps/web -- test/<caminho>.test.ts

# typecheck web (o mesmo que o pre-commit roda)
npm run typecheck --workspace=apps/web

# suíte inteira (1078 arquivos, ~160s — NÃO trava; medido 2026-09-03)
npm test --workspace=apps/web
```

---

## Consumes de A e C1 (assinaturas exatas — não redeclarar)

De **A** (`fix(instagram)!: fechar vazamentos vivos + base de observabilidade`):

```ts
// src/lib/redact-secrets.ts
export function redactSecrets(s: string): string
export function registerSecretLiteral(v?: string): void

// src/lib/instagram/sync-log.ts
export function openSyncRow(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  mode: InstagramSyncMode,
  opts?: { detail?: string },
): Promise<string | null>
export function closeSyncRow(
  supabase: SupabaseClient,
  logId: string | null,
  result: SyncResult | null,
  errorMessage?: string,
): Promise<void>

// src/lib/instagram/sync.ts (assinatura final entregue por A; C2 torna accessToken obrigatório)
export function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  accessToken?: string,
  opts?: { deadlineAt?: number },
): Promise<SyncResult>

// src/lib/instagram/types.ts
export interface SyncResult {
  postsFound: number; postsInserted: number; postsUpdated: number
  mediaCached: number; partial: boolean; mediaFailed: number
}
```

De **C1** (`feat(instagram): schema de saúde do token (expand)`), já **em produção**:

- 9 colunas em `instagram_accounts`: `token_refreshed_at`, `token_error`, `token_error_at`, `token_error_mode`, `token_alert_sent_at`, `token_alert_attempt_at`, `token_reprobe_at`, `ig_professional_id`, `ig_user_id_source`.
- `public.instagram_mark_token_invalid(p_account uuid, p_site uuid, p_reason text, p_fatal boolean, p_force_reason boolean default false, p_mode text default null) returns table (out_token_error_at timestamptz)`.
- `public.ops_alert_claim(p_key text, p_min_interval interval default interval '1 day') returns boolean` + tabela `public.ops_alert_state (key text primary key, last_at timestamptz not null)`.
- `InstagramSyncMode` alargado: `'daily' | 'manual' | 'token_refresh' | 'deauthorize' | 'data_deletion' | 'rebind'`.
- `instagram_deletion_requests`, índice `idx_instagram_sync_log_account_mode`, `UNIQUE (account_id, ig_media_id)` em `instagram_posts`.

De **B** (`chore(oauth): extrair helpers para src/lib/oauth`), já na árvore:

```ts
// src/lib/oauth/errors.ts — módulo só de tipo
export type OauthErrorCode =
  | 'not_configured' | 'vault_unavailable' | 'account_not_found' | 'exchange_failed'
  | 'origin_not_allowed' | 'invalid_state' | 'session_changed' | 'permission_denied'
  | 'cancelled' | 'identity_invalid' | 'write_failed' | 'cross_origin' | 'browser_changed'
```

---

### Task 1: Gates pré-C2 (bloqueantes — nenhum código deste plano começa antes)

**Files:**
- Create: `docs/ops/instagram-token-alert-runbook.md` (esqueleto só com os fatos medidos aqui; C3 escreve o runbook completo)

**Interfaces:**
- Consumes: M1 (C1) aplicada em produção; `CRON_SECRET`; um token de teste do Instagram.
- Produces: três decisões que as Tarefas 5 e 3 consomem — (i) prefixo dos endpoints de token (`v25.0` ou sem prefixo), (ii) forma real de `/me?fields=id,user_id,username`, (iii) prefixo real do access token (caso extra em `sentry-pii.test.ts`).

**Por que é a Tarefa 1 e não a última:** o spec (§7, *Gates antes de C2*) chama estes gates de bloqueantes, e dois deles **decidem código** — o prefixo dos endpoints de token entra em `api-client.ts` (Tarefa 5) e o prefixo do access token entra numa asserção de `sentry-pii.test.ts` (Tarefa 3). Rodá-los depois seria descobrir na promoção que a Tarefa 5 está errada.

- [ ] **Step 1: Provar que M1 está em produção (3 `select` bloqueantes)**

```bash
npm run db:link:prod
# Rode os três no SQL editor do Supabase (projeto novkqtvcnsiwhkxihurk) ou via psql:
```

```sql
select 1 from information_schema.columns
  where table_name = 'instagram_accounts' and column_name = 'token_error_mode';
select public.ops_alert_claim('gate:c2', interval '0');
select 1 from pg_proc where proname = 'instagram_mark_token_invalid';
```

Expected: 1 linha / `true` / 1 linha. **Qualquer um vazio ⇒ PARE**: rode o `db:push:prod` pendente de C1 antes de continuar. Sem as colunas, sem `ops_alert_state`/`ops_alert_claim` e sem a RPC, toda escrita de episódio devolve `42703`/`PGRST202`, é classificada `infra`, incrementa `step_errors` e o run reporta `status:'ok'` — degradação indistinguível de ruído com todo o caminho de alerta morto.

- [ ] **Step 2: Confirmar `CRON_SECRET` nos repo secrets (o `health-watch.yml` da Tarefa 18 depende dele)**

```bash
gh secret list | grep -E '^CRON_SECRET'
```

Expected: uma linha com `CRON_SECRET`. Ausente ⇒ `gh secret set CRON_SECRET` com o mesmo valor da Vercel prod antes de seguir.

- [ ] **Step 3: Medir a forma real dos endpoints de token (decide o prefixo da Tarefa 5)**

```bash
TOKEN='<token de teste>'
curl -sS -o /dev/null -w 'refresh sem prefixo: %{http_code}\n' \
  "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=$TOKEN"
curl -sS -o /dev/null -w 'refresh com v25.0: %{http_code}\n' \
  "https://graph.instagram.com/v25.0/refresh_access_token?grant_type=ig_refresh_token&access_token=$TOKEN"
```

Expected: registre os dois códigos. **Se a forma sem prefixo responder qualquer erro de rota (400/404), mantenha `v25.0` nos dois endpoints de token** — um 404 seria classificado `permanent` e marcaria toda a frota no primeiro run. O default deste plano (Tarefa 5) é **manter `v25.0`**; só troque se as duas linhas acima forem 200.

- [ ] **Step 4: Medir a forma real de `/me` (gate bloqueante, sem ramo de fallback)**

```bash
curl -sS "https://graph.instagram.com/v25.0/me?fields=id,user_id,username&access_token=$TOKEN" | tee /tmp/me.json
```

Expected: JSON com `id`, `user_id` e `username` — envelopado (`{"data":[{...}]}`) ou plano. **Qualquer erro ⇒ C2 não avança até o `curl` ficar verde.** O `username` não pode virar opcional (§3.1 passo 7/8/10 e `sweepTokenAlerts` dependem dele). Anote no runbook qual das duas formas voltou.

- [ ] **Step 5: Colher o prefixo real do access token (alimenta a Tarefa 3)**

```bash
echo "$TOKEN" | cut -c1-6
```

Expected: os 6 primeiros caracteres (ex.: `IGAAX…`). Anote — a Tarefa 3 acrescenta um caso com esse prefixo em `test/lib/sentry-pii.test.ts`, como segunda rede; a rede primária (redação por **nome de parâmetro**) não depende dele.

- [ ] **Step 6: Registrar tudo no esqueleto do runbook e commitar**

```bash
cat > docs/ops/instagram-token-alert-runbook.md <<'MD'
# Instagram token alert — runbook

> Esqueleto criado em C2 com os fatos medidos nos gates de §7. O corpo completo
> ("o ntfy tocou — o que fazer") entra em C3, junto do resto da documentação.

## Fatos medidos no gate pré-C2 (data: <AAAA-MM-DD>)

| Fato | Valor medido |
|---|---|
| `refresh_access_token` sem prefixo | `<http_code>` |
| `refresh_access_token` com `v25.0` | `<http_code>` |
| Prefixo adotado nos endpoints de token | `v25.0` (trocar só com as duas linhas acima em 200) |
| Forma de `/me?fields=id,user_id,username` | `data`-wrapped \| plano — colar a saída |
| Prefixo real do access token | `<6 chars>` |
| Versão de `@sentry/nextjs` em que a forma dos spans foi conferida | `<versão do package.json>` |

## Saída verbatim do `/me`

```json
<colar /tmp/me.json>
```
MD
git add docs/ops/instagram-token-alert-runbook.md
git commit -m "docs(instagram): registrar fatos dos gates pre-C2 no runbook"
```

---

### Task 2: `status-text.ts` — textos isomórficos e `RECONNECT_CTA`

**Files:**
- Create: `apps/web/src/lib/instagram/status-text.ts`
- Test: `apps/web/test/instagram/status-text.test.ts`

**Interfaces:**
- Consumes: `OauthErrorCode` de `src/lib/oauth/errors.ts` (B) — **`import type` apenas**; o módulo não pode importar nada de runtime (é lido tanto por Server Components quanto por client components em C3).
- Produces:
  ```ts
  export type { OauthErrorCode }
  export type TokenKind = 'transient' | 'expired' | 'revoked' | 'invalid'
  export const RECONNECT_CTA: string                       // 'paste a new token' em C2
  export function kindFrom(row: { token_error?: string | null }): TokenKind
  export function oauthErrorText(code: OauthErrorCode): string
  export function previewDisabledText(): string
  ```

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/test/instagram/status-text.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import {
  RECONNECT_CTA,
  kindFrom,
  oauthErrorText,
  previewDisabledText,
} from '@/lib/instagram/status-text'

// Exaustividade em typecheck: se um código novo entrar no union e não entrar
// aqui, `Missing` deixa de ser `never` e o typecheck do arquivo quebra.
const ALL_CODES = [
  'not_configured', 'vault_unavailable', 'account_not_found', 'exchange_failed',
  'origin_not_allowed', 'invalid_state', 'session_changed', 'permission_denied',
  'cancelled', 'identity_invalid', 'write_failed', 'cross_origin', 'browser_changed',
] as const satisfies readonly OauthErrorCode[]
type Missing = Exclude<OauthErrorCode, (typeof ALL_CODES)[number]>
const _exhaustive: Missing extends never ? true : false = true
void _exhaustive

describe('kindFrom', () => {
  it('token_error nulo => transient', () => {
    expect(kindFrom({ token_error: null })).toBe('transient')
    expect(kindFrom({})).toBe('transient')
  })
  it("'expired' => expired", () => {
    expect(kindFrom({ token_error: 'expired' })).toBe('expired')
  })
  it("'deauthorized' e 'data_deletion_requested' => revoked", () => {
    expect(kindFrom({ token_error: 'deauthorized' })).toBe('revoked')
    expect(kindFrom({ token_error: 'data_deletion_requested' })).toBe('revoked')
  })
  it('qualquer outro motivo => invalid', () => {
    expect(kindFrom({ token_error: 'decrypt_failed' })).toBe('invalid')
    expect(kindFrom({ token_error: 'The session has been invalidated' })).toBe('invalid')
  })
})

describe('oauthErrorText', () => {
  it('devolve uma frase humana para TODOS os códigos, nunca undefined', () => {
    for (const code of ALL_CODES) {
      const text = oauthErrorText(code)
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(10)
    }
  })

  it('usa os textos canônicos do mapa de §3.1', () => {
    expect(oauthErrorText('not_configured'))
      .toBe("Instagram OAuth isn't configured yet — see the setup runbook")
    expect(oauthErrorText('vault_unavailable'))
      .toBe("Token storage isn't configured — see the Instagram setup runbook")
    expect(oauthErrorText('account_not_found'))
      .toBe('This Instagram account no longer exists — reload the page')
    expect(oauthErrorText('origin_not_allowed'))
      .toBe("This domain isn't allowed for Instagram authorization")
    expect(oauthErrorText('invalid_state'))
      .toBe('Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS')
    expect(oauthErrorText('session_changed'))
      .toBe('Session changed during authorization — sign in and try again')
    expect(oauthErrorText('permission_denied'))
      .toBe('Instagram did not grant the required permission')
    expect(oauthErrorText('cancelled')).toBe('Authorization cancelled')
    expect(oauthErrorText('identity_invalid'))
      .toBe('Instagram returned an unexpected account identity')
    expect(oauthErrorText('write_failed'))
      .toBe("Couldn't save the connection — try again in a minute")
    expect(oauthErrorText('cross_origin'))
      .toBe('This page must be opened from the CMS — go back and click Connect again')
    expect(oauthErrorText('browser_changed'))
      .toBe('Authorization finished in a different browser. Open the CMS in Safari or Chrome (not inside another app) and try again.')
  })

  it('exchange_failed é a frase SECA — o "(code N)" é anexado pelo call-site', () => {
    expect(oauthErrorText('exchange_failed')).toBe('Instagram rejected the authorization')
    expect(oauthErrorText('exchange_failed')).not.toContain('(')
  })
})

describe('previewDisabledText', () => {
  it('é a frase de preview', () => {
    expect(previewDisabledText())
      .toBe('Instagram authorization is disabled on preview deployments — use production.')
  })
})

describe('RECONNECT_CTA', () => {
  // Fixado POR COMMIT: C3 troca esta asserção para 'reconnect' no mesmo commit
  // que troca a constante. Aceitar as duas formas não ratcheta nada.
  it("em C2 é exatamente 'paste a new token'", () => {
    expect(RECONNECT_CTA).toBe('paste a new token')
  })
})

describe('status-text é isomórfico', () => {
  it('não importa nada de runtime (só import type)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      new URL('../../src/lib/instagram/status-text.ts', import.meta.url),
      'utf8',
    )
    const runtimeImports = src
      .split('\n')
      .filter((l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l))
    expect(runtimeImports).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/status-text.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/instagram/status-text"`.

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/instagram/status-text.ts
//
// Isomórfico: lido por Server Components, por client components (C3) e pelos
// crons. MUST NOT importar nada de runtime — só `import type`. É o que permite
// que o card do CMS e o popup do OAuth compartilhem exatamente as mesmas
// frases sem arrastar `node:crypto` para o bundle do cliente.
import type { OauthErrorCode } from '@/lib/oauth/errors'

export type { OauthErrorCode }

/**
 * Verbo do call-to-action do alerta de token, fixado POR COMMIT.
 * C2: 'paste a new token' (a UI de OAuth só existe em C3).
 * C3: 'reconnect' — trocado no MESMO commit que troca a asserção de §6.
 * Único consumidor: `deliverTokenAlert` (src/lib/instagram/token.ts).
 */
export const RECONNECT_CTA = 'paste a new token'

export type TokenKind = 'transient' | 'expired' | 'revoked' | 'invalid'

export function kindFrom(row: { token_error?: string | null }): TokenKind {
  const reason = row.token_error
  if (reason == null) return 'transient'
  if (reason === 'expired') return 'expired'
  if (reason === 'deauthorized' || reason === 'data_deletion_requested') return 'revoked'
  return 'invalid'
}

// `satisfies` dá exaustividade em typecheck: um código novo em OauthErrorCode
// sem entrada aqui quebra o build, nunca vira `undefined` na janela do dono.
const OAUTH_ERROR_TEXT = {
  not_configured: "Instagram OAuth isn't configured yet — see the setup runbook",
  vault_unavailable: "Token storage isn't configured — see the Instagram setup runbook",
  account_not_found: 'This Instagram account no longer exists — reload the page',
  // Frase SECA. O call-site anexa ' (code N)' quando o corpo de erro plano da
  // Meta traz `code`; o `error_message` da Meta NUNCA chega ao popup (§3.1).
  exchange_failed: 'Instagram rejected the authorization',
  origin_not_allowed: "This domain isn't allowed for Instagram authorization",
  invalid_state:
    'Invalid or expired authorization (it expires after 30 minutes) — start again from the CMS',
  session_changed: 'Session changed during authorization — sign in and try again',
  permission_denied: 'Instagram did not grant the required permission',
  cancelled: 'Authorization cancelled',
  identity_invalid: 'Instagram returned an unexpected account identity',
  write_failed: "Couldn't save the connection — try again in a minute",
  cross_origin: 'This page must be opened from the CMS — go back and click Connect again',
  browser_changed:
    'Authorization finished in a different browser. Open the CMS in Safari or Chrome (not inside another app) and try again.',
} satisfies Record<OauthErrorCode, string>

export function oauthErrorText(code: OauthErrorCode): string {
  return OAUTH_ERROR_TEXT[code]
}

export function previewDisabledText(): string {
  return 'Instagram authorization is disabled on preview deployments — use production.'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/instagram/status-text.test.ts`
Expected: PASS (todos os `it`).

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/status-text.ts apps/web/test/instagram/status-text.test.ts
git commit -m "feat(instagram): status-text isomorfico (kindFrom, oauthErrorText, RECONNECT_CTA)"
```

---

### Task 3: Wiring de `redact-secrets` no Sentry (§4)

**Files:**
- Modify: `apps/web/src/lib/sentry-pii.ts` (`ScrubbableRequest` `:64-67`, `ScrubbableEvent` `:68-75`, `scrubPiiString` `:48-55`, `scrubEventPii` `:93-113`)
- Modify: `apps/web/sentry.server.config.ts`
- Modify: `apps/web/sentry.edge.config.ts`
- Test: `apps/web/test/lib/sentry-pii.test.ts` (estendido)

**Interfaces:**
- Consumes: `redactSecrets(s: string): string` e `registerSecretLiteral(v?: string): void` de `@/lib/redact-secrets` (A).
- Produces: `scrubPiiString` passa a redigir segredos; `scrubEventPii` passa a cobrir `event.request.url`, `event.request.query_string` e `event.spans[*].description` / `event.spans[*].data`; `beforeSendTransaction` existe nas duas configs.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `apps/web/test/lib/sentry-pii.test.ts` (e amplie o `import` do topo com `scrubEventPii` — já está lá):

```ts
// ── C2: redação de segredos (spec §4) ────────────────────────────────────────
// 64 chars hex, SEM o prefixo `IG…` — a redação primária é por NOME de
// parâmetro, nunca pela forma do valor.
const RAW = 'a'.repeat(64)

describe('redação de segredos em query string (por nome de parâmetro)', () => {
  it('redige access_token sem prefixo IG', () => {
    expect(scrubPiiString(`GET https://graph.instagram.com/v25.0/me?fields=id&access_token=${RAW}`))
      .toContain('access_token=[REDACTED]')
    expect(scrubPiiString(`?access_token=${RAW}`)).not.toContain(RAW)
  })

  it('redige signed_request, code, client_secret, state e rebind', () => {
    for (const name of ['signed_request', 'code', 'client_secret', 'state', 'rebind']) {
      const s = scrubPiiString(`https://x/y?a=1&${name}=${RAW}&z=2`)
      expect(s, name).toContain(`${name}=[REDACTED]`)
      expect(s, name).not.toContain(RAW)
      expect(s, name).toContain('z=2')
    }
  })

  it('redige a forma NUA (sem ? nem & antes) numa mensagem de exceção', () => {
    expect(scrubPiiString(`refresh failed access_token=${RAW} after 3 tries`))
      .not.toContain(RAW)
  })

  it('redige a forma de ATRIBUIÇÃO/JSON de um corpo de troca ecoado', () => {
    expect(scrubPiiString(`{"access_token":"${RAW}","token_type":"bearer"}`))
      .not.toContain(RAW)
    expect(scrubPiiString(`client_secret: ${RAW}`)).not.toContain(RAW)
  })
})

describe('scrubEventPii — request.url e query_string', () => {
  it('redige request.url e request.query_string', () => {
    const event = {
      request: {
        url: `https://bythiagofigueiredo.com/api/instagram/oauth?account_id=1&rebind=${RAW}`,
        query_string: `code=${RAW}`,
      },
    }
    scrubEventPii(event)
    expect(event.request.url).not.toContain(RAW)
    expect(event.request.query_string).not.toContain(RAW)
  })

  it('redige o breadcrumb undici (data.url)', () => {
    const event = {
      breadcrumbs: [
        { message: 'http', data: { url: `https://graph.instagram.com/v25.0/me?access_token=${RAW}` } },
      ],
    }
    scrubEventPii(event)
    expect(String(event.breadcrumbs[0]!.data!.url)).not.toContain(RAW)
  })
})

describe('scrubEventPii — spans de transaction (beforeSendTransaction)', () => {
  it('redige span.description e as strings de span.data', () => {
    const url = `GET https://graph.instagram.com/v25.0/me?fields=id&access_token=${RAW}`
    const event = {
      spans: [{ description: url, data: { url, 'http.url': url, status: 'ok' } }],
    }
    scrubEventPii(event)
    expect(event.spans[0]!.description).not.toContain(RAW)
    expect(String(event.spans[0]!.data!.url)).not.toContain(RAW)
    expect(String(event.spans[0]!.data!['http.url'])).not.toContain(RAW)
    expect(event.spans[0]!.data!.status).toBe('ok')
  })
})

describe('registerSecretLiteral', () => {
  it('redige um literal registrado (SOCIAL_MASTER_KEY) em qualquer posição', async () => {
    const { registerSecretLiteral } = await import('@/lib/redact-secrets')
    const key = 'f'.repeat(64)
    registerSecretLiteral(key)
    expect(scrubPiiString(`createDecipheriv failed with key ${key}`)).not.toContain(key)
  })

  it('é no-op para valores curtos (< 16 chars) e para undefined', async () => {
    const { registerSecretLiteral } = await import('@/lib/redact-secrets')
    registerSecretLiteral('short')
    registerSecretLiteral(undefined)
    expect(scrubPiiString('short and sweet')).toBe('short and sweet')
  })
})

describe('redact-secrets é livre de process.env', () => {
  it('o fonte não lê process.env (os literais entram por registerSecretLiteral)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      new URL('../../src/lib/redact-secrets.ts', import.meta.url),
      'utf8',
    )
    expect(src).not.toContain('process.env')
  })
})

describe('rede secundária: prefixo real do token (gate §7)', () => {
  // Substitua 'IGAAX' pelo prefixo colhido no Step 5 da Tarefa 1.
  it('redige um token com o prefixo real fora de query string', () => {
    const prefixed = `IGAAX${'b'.repeat(59)}`
    expect(scrubPiiString(`stored token ${prefixed} rejected`)).not.toContain(prefixed)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/lib/sentry-pii.test.ts`
Expected: FAIL — `scrubPiiString` não redige `access_token=…`; `event.spans` e `event.request.url` intactos.

- [ ] **Step 3: Implementar — `src/lib/sentry-pii.ts`**

Aplique estas quatro edições ao arquivo:

```ts
// (1) topo do arquivo, ao lado dos outros imports
import { redactSecrets } from './redact-secrets'
```

```ts
// (2) scrubPiiString (:48-55) — redactSecrets PRIMEIRO: um token com dígitos
// pode casar PHONE_RE/CPF_RE e sair meio-redigido se a ordem for invertida.
export function scrubPiiString(value: string): string {
  return redactSecrets(value)
    .replace(CPF_RE, '[REDACTED_CPF]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(EMAIL_RE, '<email>')
    .replace(IPV4_RE, '[REDACTED_IP]')
    .replace(IPV6_RE, '[REDACTED_IP]')
}
```

```ts
// (3) as duas interfaces (:64-75)
interface ScrubbableRequest {
  headers?: Record<string, unknown>
  data?: unknown
  // C2: o token de 60 d viaja em query string (api-client.ts) e chega aqui
  // pelo evento de request e pelo breadcrumb undici.
  url?: string
  query_string?: unknown
}
interface ScrubbableSpan {
  description?: string
  data?: Record<string, unknown>
}
interface ScrubbableEvent {
  message?: string
  exception?: {
    values?: Array<{ value?: string }>
  }
  breadcrumbs?: Array<ScrubbableBreadcrumb>
  request?: ScrubbableRequest
  // C2: forma de *transaction*. Num evento de transaction a chamada HTTP é um
  // span `http.client` cuja description e cujo data carregam a URL inteira —
  // sem isto, `beforeSendTransaction` só troca o caminho pelo qual os 10 % de
  // tracesSampleRate sobem o token.
  spans?: Array<ScrubbableSpan>
}
```

```ts
// (4) scrubEventPii (:93-113) — acrescente ANTES do `return event`
  if (event.request) {
    scrubRecordStrings(event.request.headers)
    if (typeof event.request.data === 'string') {
      event.request.data = scrubPiiString(event.request.data)
    }
    if (typeof event.request.url === 'string') {
      event.request.url = scrubPiiString(event.request.url)
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubPiiString(event.request.query_string)
    }
  }
  if (event.spans) {
    for (const span of event.spans) {
      if (span.description) span.description = scrubPiiString(span.description)
      scrubRecordStrings(span.data)
    }
  }
  return event
```

- [ ] **Step 4: Implementar — as duas configs do Sentry**

Em `apps/web/sentry.server.config.ts`, troque as linhas 4-24 por:

```ts
import * as Sentry from '@sentry/nextjs'
import { scrubBreadcrumbPii, scrubEventPii } from './src/lib/sentry-pii'
import { registerSecretLiteral } from './src/lib/redact-secrets'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
const release = commitSha ? `s4.75-rbac-${commitSha.slice(0, 7)}` : undefined

// C2 (§4): segredos estáticos que podem ecoar em exceções — parseSchema do
// env.ts imprime o valor, createDecipheriv imprime a chave. redact-secrets não
// lê process.env por si (é folha e testado como tal); o registro é aqui.
registerSecretLiteral(process.env.INSTAGRAM_APP_SECRET)
registerSecretLiteral(process.env.META_APP_SECRET)
registerSecretLiteral(process.env.SOCIAL_MASTER_KEY)

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'dev',
    release,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEventPii,
    // ADIÇÃO de C2: não existia. Sem ele, todo evento de transaction (10 % das
    // requisições) sobe os spans http.client crus.
    beforeSendTransaction: scrubEventPii,
    beforeBreadcrumb: scrubBreadcrumbPii,
  })
}
```

Em `apps/web/sentry.edge.config.ts`, aplique exatamente a mesma mudança (import de `registerSecretLiteral`, os três registros antes do `if (dsn)`, e `beforeSendTransaction: scrubEventPii` dentro do `Sentry.init`).

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/lib/sentry-pii.test.ts`
Expected: PASS.

- [ ] **Step 6: Registrar a versão do `@sentry/nextjs` no runbook (premissa MUST de §4)**

```bash
node -e "console.log(require('./apps/web/package.json').dependencies['@sentry/nextjs'])"
# cole o valor na tabela criada na Tarefa 1
```

- [ ] **Step 7: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/sentry-pii.ts apps/web/sentry.server.config.ts \
        apps/web/sentry.edge.config.ts apps/web/test/lib/sentry-pii.test.ts \
        docs/ops/instagram-token-alert-runbook.md
git commit -m "fix(sentry): redigir segredos em url/query/spans e ligar beforeSendTransaction"
```

---

### Task 4: `token.ts` — helpers puros (vault + classificação)

**Files:**
- Create: `apps/web/src/lib/instagram/token.ts`
- Test: `apps/web/test/instagram/token.test.ts`

**Interfaces:**
- Consumes: `encrypt`/`decrypt` de `@tn-figueiredo/social/vault`; `redactSecrets` de `@/lib/redact-secrets` (A).
- Produces:
  ```ts
  export const redact: typeof redactSecrets          // re-export exigido por §3.2
  export class VaultUnavailableError extends Error
  export function getVaultKeyOrNull(): Buffer | null
  export function readAccessToken(row: { access_token: string | null }): { token: string | null; legacy: boolean }
  export function writeAccessToken(plain: string): string          // lança VaultUnavailableError sem chave
  export type ErrorClass = 'infra' | 'transient' | 'permanent'
  export function classifyInstagramError(err: unknown): ErrorClass
  ```

**Nota de arquitetura:** `token.ts` é **server-only** (importa `@tn-figueiredo/social/vault`, que importa `node:crypto`). **MUST NOT** ser importado de nenhum arquivo `'use client'` — é por isso que `status-text.ts` (Tarefa 2) existe como módulo separado.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/test/instagram/token.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

import { encrypt } from '@tn-figueiredo/social/vault'
import {
  VaultUnavailableError,
  classifyInstagramError,
  getVaultKeyOrNull,
  readAccessToken,
  writeAccessToken,
} from '@/lib/instagram/token'

const KEY_HEX = '0'.repeat(64)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SOCIAL_MASTER_KEY', KEY_HEX)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getVaultKeyOrNull', () => {
  it('devolve Buffer de 32 bytes com 64 hex minúsculos', () => {
    const key = getVaultKeyOrNull()
    expect(Buffer.isBuffer(key)).toBe(true)
    expect(key!.length).toBe(32)
  })

  it('aceita hex MAIÚSCULO', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', 'A'.repeat(64))
    expect(getVaultKeyOrNull()!.length).toBe(32)
  })

  it('devolve null com 64 caracteres NÃO-hex (o regex roda antes do Buffer.from)', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', 'z'.repeat(64))
    expect(getVaultKeyOrNull()).toBeNull()
  })

  it('devolve null com comprimento errado e com a env ausente', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '0'.repeat(63))
    expect(getVaultKeyOrNull()).toBeNull()
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    expect(getVaultKeyOrNull()).toBeNull()
  })
})

describe('readAccessToken', () => {
  it('nunca lança: v1: corrompido devolve { token: null }', () => {
    expect(() => readAccessToken({ access_token: 'v1:not-base64-at-all' })).not.toThrow()
    expect(readAccessToken({ access_token: 'v1:AAAA' }).token).toBeNull()
  })

  it('decifra um valor v1: válido', () => {
    const stored = `v1:${encrypt('IGAAplain', Buffer.from(KEY_HEX, 'hex'))}`
    expect(readAccessToken({ access_token: stored })).toEqual({ token: 'IGAAplain', legacy: false })
  })

  it('devolve o texto puro com legacy:true quando não há prefixo v1:', () => {
    expect(readAccessToken({ access_token: 'IGAAlegacy' })).toEqual({ token: 'IGAAlegacy', legacy: true })
  })

  it('access_token nulo => { token: null, legacy: false } (o chamador chama isso de "not connected")', () => {
    expect(readAccessToken({ access_token: null })).toEqual({ token: null, legacy: false })
  })

  it('sem chave, um valor v1: devolve token null e não lança', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    expect(readAccessToken({ access_token: 'v1:whatever' }).token).toBeNull()
  })
})

describe('writeAccessToken', () => {
  it('cifra com prefixo v1: e faz round-trip', () => {
    const stored = writeAccessToken('IGAAsecret')
    expect(stored.startsWith('v1:')).toBe(true)
    expect(readAccessToken({ access_token: stored }).token).toBe('IGAAsecret')
  })

  it('LANÇA VaultUnavailableError sem chave', () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    expect(() => writeAccessToken('x')).toThrow(VaultUnavailableError)
  })
})

describe('classifyInstagramError — sequência ordenada de §3.2', () => {
  it('(1) infra: 23505', () => {
    expect(classifyInstagramError({ code: '23505', message: 'duplicate key value violates unique constraint' }))
      .toBe('infra')
  })

  it('(1) infra: erro do PostgREST/Supabase', () => {
    expect(classifyInstagramError({ code: 'PGRST202', message: 'Could not find the function', details: null, hint: null }))
      .toBe('infra')
    expect(classifyInstagramError({ code: '42703', message: 'column does not exist', details: null, hint: null }))
      .toBe('infra')
  })

  it('(1) infra vence permanent: code 100 com "Tried accessing nonexisting field"', () => {
    expect(classifyInstagramError({
      code: 100, type: 'OAuthException', httpStatus: 400,
      message: '(#100) Tried accessing nonexisting field (foo) on node type (User)',
    })).toBe('infra')
  })

  it('(2) transient: códigos 1, 2, 4, 17, 32, 341, 613', () => {
    for (const code of [1, 2, 4, 17, 32, 341, 613]) {
      expect(classifyInstagramError({ code, message: 'x' }), String(code)).toBe('transient')
    }
  })

  it('(2) transient: is_transient === true', () => {
    expect(classifyInstagramError({ code: 999, is_transient: true, message: 'x' })).toBe('transient')
  })

  it('(2) transient vence OAuthException: 429, 500 e 503', () => {
    expect(classifyInstagramError({ httpStatus: 429, type: 'OAuthException', message: 'rate limited' })).toBe('transient')
    expect(classifyInstagramError({ httpStatus: 500, type: 'OAuthException', message: 'oops' })).toBe('transient')
    expect(classifyInstagramError({ httpStatus: 503, type: 'OAuthException', message: 'oops' })).toBe('transient')
  })

  it('(2) transient: 429 sem type', () => {
    expect(classifyInstagramError({ code: 429, httpStatus: 429, type: 'HttpError', message: 'Instagram API 429' }))
      .toBe('transient')
  })

  it('(2) transient: frases de janela e limite', () => {
    expect(classifyInstagramError({ message: 'The token is less than 24 hours old' })).toBe('transient')
    expect(classifyInstagramError({ message: 'Application request limit reached: too many calls' })).toBe('transient')
  })

  it('(2) transient: rede e timeout', () => {
    expect(classifyInstagramError(new TypeError('fetch failed'))).toBe('transient')
    const abort = new Error('The operation was aborted'); abort.name = 'TimeoutError'
    expect(classifyInstagramError(abort)).toBe('transient')
  })

  it('(3) permanent: 400 COM OAuthException', () => {
    expect(classifyInstagramError({ httpStatus: 400, type: 'OAuthException', code: 190, message: 'Invalid OAuth access token' }))
      .toBe('permanent')
  })

  it('(3) permanent: httpStatus 403 e 401', () => {
    expect(classifyInstagramError({ httpStatus: 403, type: 'HttpError', code: 403, message: 'Instagram API 403' }))
      .toBe('permanent')
    expect(classifyInstagramError({ httpStatus: 401, type: 'HttpError', code: 401, message: 'Instagram API 401' }))
      .toBe('permanent')
  })

  it('(3) permanent: 190 e a faixa 200..299', () => {
    expect(classifyInstagramError({ code: 190, message: 'x' })).toBe('permanent')
    expect(classifyInstagramError({ code: 200, message: 'x' })).toBe('permanent')
    expect(classifyInstagramError({ code: 299, message: 'x' })).toBe('permanent')
  })

  it('(3) permanent: decrypt_failed e as mensagens de conta desconectada', () => {
    expect(classifyInstagramError(new Error('decrypt_failed'))).toBe('permanent')
    expect(classifyInstagramError(new Error('The session has been invalidated because the user changed their password')))
      .toBe('permanent')
  })

  it('(4) default: 400 SEM type => transient', () => {
    expect(classifyInstagramError({ httpStatus: 400, type: 'HttpError', code: 400, message: 'Instagram API 400' }))
      .toBe('transient')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/token.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/instagram/token"`.

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/instagram/token.ts
//
// SERVER-ONLY. Importa @tn-figueiredo/social/vault (=> node:crypto).
// MUST NOT ser importado de nenhum arquivo 'use client' — as frases da UI
// vivem em ./status-text.ts, que é isomórfico de propósito.
import * as Sentry from '@sentry/nextjs'
import { decrypt, encrypt } from '@tn-figueiredo/social/vault'
import { redactSecrets } from '@/lib/redact-secrets'

/** Re-export exigido por §3.2 — `p_reason` chega sempre redigido. */
export const redact = redactSecrets

export class VaultUnavailableError extends Error {
  constructor() {
    super('SOCIAL_MASTER_KEY missing or malformed')
    this.name = 'VaultUnavailableError'
  }
}

// O regex roda ANTES do Buffer.from: `Buffer.from('zz…','hex')` não lança, só
// devolve um buffer curto/vazio, e a checagem de comprimento depois fecha o
// caso residual.
const HEX_64 = /^[0-9a-fA-F]{64}$/

export function getVaultKeyOrNull(): Buffer | null {
  const hex = process.env.SOCIAL_MASTER_KEY
  if (!hex || !HEX_64.test(hex)) return null
  const buf = Buffer.from(hex, 'hex')
  return buf.length === 32 ? buf : null
}

/**
 * MUST NOT throw. A marcação da conta é do CHAMADOR:
 *  - vault caído (getVaultKeyOrNull() === null) => não toca a conta;
 *  - row.access_token != null e token === null => markTokenInvalid('decrypt_failed');
 *  - row.access_token == null => "not connected".
 */
export function readAccessToken(row: { access_token: string | null }): {
  token: string | null
  legacy: boolean
} {
  const raw = row.access_token
  if (raw == null) return { token: null, legacy: false }
  // `v1:` é marcador de FORMATO, não domínio criptográfico (§8).
  if (!raw.startsWith('v1:')) return { token: raw, legacy: true }
  const key = getVaultKeyOrNull()
  if (key === null) return { token: null, legacy: false }
  try {
    return { token: decrypt(raw.slice(3), key), legacy: false }
  } catch {
    return { token: null, legacy: false }
  }
}

export function writeAccessToken(plain: string): string {
  const key = getVaultKeyOrNull()
  if (key === null) throw new VaultUnavailableError()
  return `v1:${encrypt(plain, key)}`
}

// ── Classificação de erro ────────────────────────────────────────────────────

export type ErrorClass = 'infra' | 'transient' | 'permanent'

interface IErrorShape {
  code?: unknown
  error_subcode?: unknown
  type?: unknown
  httpStatus?: unknown
  is_transient?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613])
const PERMANENT_CODES = new Set([10, 102, 190])

function isPostgrestShape(err: unknown): boolean {
  if (!err || typeof err !== 'object' || err instanceof Error) return false
  const o = err as Record<string, unknown>
  return typeof o.code === 'string' && ('details' in o || 'hint' in o)
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const name = err instanceof Error ? err.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  const msg = err instanceof Error ? err.message : ''
  return /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(msg)
}

/**
 * Sequência ORDENADA (MUST): avaliada de cima para baixo, devolve no primeiro
 * casamento. Nenhuma cláusula vence por prosa.
 */
export function classifyInstagramError(err: unknown): ErrorClass {
  const e = (err && typeof err === 'object' ? err : {}) as IErrorShape
  const message = typeof e.message === 'string' ? e.message : String(err)
  const type = typeof e.type === 'string' ? e.type : ''
  const numericCode = typeof e.code === 'number' ? e.code : undefined
  const httpStatus = typeof e.httpStatus === 'number' ? e.httpStatus : undefined

  const result = ((): ErrorClass => {
    // (1) infra — bug nosso, nunca token do usuário. Vem ANTES do permanente
    // para tornar o modo de falha "nome de campo errado marca a frota inteira"
    // estruturalmente impossível.
    if (
      e.code === '23505' ||
      /duplicate key value/i.test(message) ||
      /PGRST/.test(String(e.code ?? '')) ||
      /PGRST/.test(message) ||
      isPostgrestShape(err) ||
      (numericCode === 100 && /nonexisting field|tried accessing nonexisting/i.test(message))
    ) return 'infra'

    // (2) transient — inclui 5xx/429 SOB OAuthException, por estar antes de (3).
    if (
      (numericCode !== undefined && TRANSIENT_CODES.has(numericCode)) ||
      e.is_transient === true ||
      /less than 24 hours|too soon|rate limit|too many calls/i.test(message) ||
      (httpStatus !== undefined && (httpStatus >= 500 || httpStatus === 429)) ||
      isNetworkFailure(err)
    ) return 'transient'

    // (3) permanent
    if (
      type === 'OAuthException' ||
      httpStatus === 401 ||
      httpStatus === 403 ||
      (numericCode !== undefined &&
        (PERMANENT_CODES.has(numericCode) || (numericCode >= 200 && numericCode <= 299))) ||
      (numericCode === 100 &&
        /access.?token|does not exist|unsupported get request/i.test(message) &&
        !/nonexisting field/i.test(message)) ||
      /invalidated|expired|revoked|invalid.*token|decrypt_failed|No Instagram user ID|No access token/i.test(message)
    ) return 'permanent'

    // (4) default
    return 'transient'
  })()

  // Telemetria de calibração (MUST, §3.2): a tupla, redigida, sem token.
  try {
    Sentry.addBreadcrumb({
      category: 'instagram.classify',
      level: 'info',
      message: redact(message).slice(0, 200),
      data: {
        code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : null,
        error_subcode:
          typeof e.error_subcode === 'string' || typeof e.error_subcode === 'number'
            ? e.error_subcode
            : null,
        type: type || null,
        httpStatus: httpStatus ?? null,
        result,
      },
    })
  } catch {
    // telemetria nunca altera o desfecho da classificação
  }

  return result
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/instagram/token.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/token.ts apps/web/test/instagram/token.test.ts
git commit -m "feat(instagram): vault helpers e classifyInstagramError ordenado"
```

---

### Task 5: `api-client.ts` (v25.0, httpStatus, timeout, paging, `/me` de 3 campos) + `probeToken`

**Files:**
- Modify: `apps/web/src/lib/instagram/api-client.ts` (arquivo inteiro)
- Modify: `apps/web/src/lib/instagram/token.ts` (acrescenta `probeToken`)
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts` (`setInstagramToken` — só o guard de `profile.id` nulo; o resto da action é a Tarefa 14)
- Test: `apps/web/test/instagram/api-client.test.ts` (estendido)

**Interfaces:**
- Consumes: nada de novo.
- Produces:
  ```ts
  // api-client.ts
  export const GRAPH_API_BASE: string                                  // 'https://graph.instagram.com/v25.0'
  export const TOKEN_API_BASE: string                                  // === GRAPH_API_BASE salvo decisão do gate
  export class InstagramApiError extends Error {
    readonly code: number; readonly type: string; readonly httpStatus: number
  }
  export function instagramErrorFromResponse(res: Response): Promise<InstagramApiError>
  export function fetchInstagramProfile(accessToken: string):
    Promise<{ id: string | null; userId: string | null; username: string | null }>
  // token.ts
  export function probeToken(token: string): Promise<{ ok: true } | { ok: false; error: unknown }>
  ```

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `apps/web/test/instagram/api-client.test.ts`:

```ts
// ── C2 ───────────────────────────────────────────────────────────────────────
import { GRAPH_API_BASE } from '@/lib/instagram/api-client'
import { probeToken } from '@/lib/instagram/token'

describe('C2 — versão e transporte', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GRAPH_API_BASE é v25.0', () => {
    expect(GRAPH_API_BASE).toBe('https://graph.instagram.com/v25.0')
  })

  it('todo fetch leva AbortSignal.timeout(10_000)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], paging: {} }) })
    await fetchInstagramMedia('123', 'tok')
    const init = mockFetch.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('InstagramApiError carrega httpStatus além de code/type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } }),
    })
    await expect(fetchInstagramMedia('123', 'tok')).rejects.toMatchObject({
      code: 190, type: 'OAuthException', httpStatus: 400,
    })
  })

  it('paging.next fora de graph.instagram.com é IGNORADO (nenhum 2º fetch)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: '1', media_type: 'IMAGE', media_url: null, thumbnail_url: null, caption: null,
                 permalink: 'p', like_count: 0, comments_count: 0, timestamp: 't' }],
        paging: { next: 'https://evil.com/steal?access_token=tok' },
      }),
    })
    const out = await fetchInstagramMedia('123', 'tok', 50)
    expect(out).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('paging.next em graph.instagram.com é seguido', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        data: [{ id: '1', media_type: 'IMAGE', media_url: null, thumbnail_url: null, caption: null,
                 permalink: 'p', like_count: 0, comments_count: 0, timestamp: 't' }],
        paging: { next: 'https://graph.instagram.com/v25.0/123/media?after=x' },
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], paging: {} }) })
    await fetchInstagramMedia('123', 'tok', 50)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('fetchInstagramProfile — 3 campos, duas formas', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('pede fields=id,user_id,username', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', user_id: '2', username: 'a' }) })
    await fetchInstagramProfile('tok')
    expect(String(mockFetch.mock.calls[0]![0])).toContain('fields=id,user_id,username')
  })

  it('desembrulha a forma data-wrapped', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ data: [{ id: '178', user_id: '17841', username: 'thiago.figueiredo' }] }),
    })
    expect(await fetchInstagramProfile('tok'))
      .toEqual({ id: '178', userId: '17841', username: 'thiago.figueiredo' })
  })

  it('desembrulha a forma plana', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ id: '178', user_id: '17841', username: 'thiago.figueiredo' }),
    })
    expect(await fetchInstagramProfile('tok'))
      .toEqual({ id: '178', userId: '17841', username: 'thiago.figueiredo' })
  })

  it('sem id => id null; sem user_id => userId null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ user_id: '17841', username: 'a' }) })
    expect(await fetchInstagramProfile('tok')).toEqual({ id: null, userId: '17841', username: 'a' })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '178', username: 'a' }) })
    expect(await fetchInstagramProfile('tok')).toEqual({ id: '178', userId: null, username: 'a' })
  })
})

describe('probeToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('chama /me?fields=id com timeout de 10 s', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: '1' }) })
    expect(await probeToken('tok')).toEqual({ ok: true })
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/me?fields=id')
    expect(String(url)).not.toContain('username')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('4xx devolve { ok:false, error } com httpStatus e NÃO lança', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } }),
    })
    const out = await probeToken('tok')
    expect(out.ok).toBe(false)
    expect(out).toMatchObject({ error: expect.objectContaining({ code: 190, httpStatus: 400 }) })
  })

  it('5xx devolve { ok:false } e nunca lança', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    await expect(probeToken('tok')).resolves.toMatchObject({ ok: false })
  })

  it('fetch lançando devolve { ok:false, error } em vez de propagar', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    const out = await probeToken('tok')
    expect(out).toMatchObject({ ok: false, error: expect.any(TypeError) })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/api-client.test.ts`
Expected: FAIL — `GRAPH_API_BASE` não é exportado; `httpStatus` `undefined`; `probeToken` não existe.

- [ ] **Step 3: Implementar `api-client.ts`**

Substitua as linhas 1-94 de `apps/web/src/lib/instagram/api-client.ts` por:

```ts
// v21.0 expira 2027-01-21; v25.0 expira 2028-07-29 (data no runbook).
export const GRAPH_API_BASE = 'https://graph.instagram.com/v25.0'
// Endpoints de token (access_token / refresh_access_token): o prefixo FICA,
// porque é a única forma com prova em produção. Só troque para
// 'https://graph.instagram.com' se as DUAS linhas do Step 3 da Tarefa 1
// tiverem respondido 200 — um 404 seria classificado `permanent` e marcaria
// toda a frota no primeiro run das 11:00.
export const TOKEN_API_BASE = GRAPH_API_BASE

const MEDIA_FIELDS =
  'id,media_type,media_url,thumbnail_url,caption,permalink,like_count,comments_count,timestamp'
const FETCH_TIMEOUT_MS = 10_000

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly type: string,
    public readonly httpStatus: number,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

export interface InstagramMediaItem {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string | null
  thumbnail_url?: string | null
  caption: string | null
  permalink: string
  like_count: number
  comments_count: number
  timestamp: string
}

/** Constrói o erro tipado a partir de uma resposta não-ok. Nunca lança. */
export async function instagramErrorFromResponse(res: Response): Promise<InstagramApiError> {
  let errMsg = `Instagram API ${res.status}`
  let errCode: number = res.status
  let errType = 'HttpError'
  try {
    const body = (await res.json()) as {
      error?: { message?: string; code?: number; type?: string }
    }
    if (body?.error) {
      errMsg = body.error.message ?? errMsg
      errCode = body.error.code ?? errCode
      errType = body.error.type ?? errType
    }
  } catch {
    // corpo não-JSON: ficamos com o status
  }
  return new InstagramApiError(errMsg, errCode, errType, res.status)
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await instagramErrorFromResponse(res)
  return res.json() as Promise<T>
}

const MAX_PAGES = 5

/** `paging.next` vem da Meta por cast puro — só https em graph.instagram.com. */
function isGraphInstagramUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate)
    return u.protocol === 'https:' && u.hostname === 'graph.instagram.com'
  } catch {
    return false
  }
}

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 50,
): Promise<InstagramMediaItem[]> {
  const all: InstagramMediaItem[] = []
  let url: string | null =
    `${GRAPH_API_BASE}/${igUserId}/media?fields=${MEDIA_FIELDS}&access_token=${accessToken}&limit=${Math.min(limit, 50)}`
  let pages = 0

  while (url && all.length < limit && pages < MAX_PAGES) {
    const data: { data: InstagramMediaItem[]; paging?: { next?: string } } =
      await handleApiResponse<{ data: InstagramMediaItem[]; paging?: { next?: string } }>(
        await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
      )

    all.push(...data.data)
    const next = data.paging?.next
    url = typeof next === 'string' && isGraphInstagramUrl(next) ? next : null
    pages++
  }

  return all.slice(0, limit)
}

/**
 * UMA chamada, três campos documentados no *get-started* do Instagram Login.
 * MUST — os dois ids não se misturam:
 *   `id`      = app-scoped, o espaço que GET /{id}/media aceita  => ig_user_id
 *   `user_id` = id da conta profissional (o mesmo do webhook)    => ig_professional_id
 * MUST NOT pedir OUTRO campo sem `curl` verde no gate de §7: um campo
 * inexistente volta como `(#100) Tried accessing nonexisting field` dentro de
 * um OAuthException em HTTP 400.
 */
export async function fetchInstagramProfile(
  accessToken: string,
): Promise<{ id: string | null; userId: string | null; username: string | null }> {
  const url = `${GRAPH_API_BASE}/me?fields=id,user_id,username&access_token=${accessToken}`
  const json = await handleApiResponse<unknown>(
    await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
  )
  const envelope = json as { data?: unknown }
  const raw = Array.isArray(envelope?.data) ? envelope.data[0] : json
  const d = (raw ?? {}) as { id?: unknown; user_id?: unknown; username?: unknown }

  const asId = (v: unknown): string | null =>
    typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null

  return {
    id: asId(d.id),
    userId: asId(d.user_id),
    username: typeof d.username === 'string' ? d.username : null,
  }
}

export async function refreshAccessToken(
  currentToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = `${TOKEN_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  const data = await handleApiResponse<{
    access_token: string
    token_type: string
    expires_in: number
  }>(await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }))

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
```

- [ ] **Step 4: Implementar `probeToken` em `token.ts`**

Acrescente ao topo dos imports de `apps/web/src/lib/instagram/token.ts`:

```ts
import { GRAPH_API_BASE, instagramErrorFromResponse } from './api-client'
```

e ao fim do arquivo:

```ts
/**
 * Sonda de VIDA do token — nenhum campo de perfil. É ela que dá a detecção em
 * ≤ 24 h (§3.4): roda para TODA conta com token, com timeout duro de 10 s, e
 * nunca lança (um throw aqui mataria o run e perderia os alertas do dia).
 */
export async function probeToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/me?fields=id&access_token=${token}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: await instagramErrorFromResponse(res) }
  } catch (err) {
    return { ok: false, error: err }
  }
}
```

- [ ] **Step 5: Consertar o único call-site que quebra no typecheck (`setInstagramToken`)**

`fetchInstagramProfile` passou a devolver `id: string | null`. Em `apps/web/src/app/cms/(authed)/settings/actions.ts`, dentro de `setInstagramToken`, troque

```ts
    const profile = await fetchInstagramProfile(parsed.data.accessToken)
    igUserId = profile.id
```

por

```ts
    const profile = await fetchInstagramProfile(parsed.data.accessToken)
    if (!profile.id) {
      return { ok: false, error: 'Invalid token — could not fetch Instagram profile' }
    }
    igUserId = profile.id
```

(O resto de `setInstagramToken` — cifra, `ig_user_id_source`, zeragem de episódio — é a **Tarefa 14**.)

- [ ] **Step 6: Rodar os testes tocados**

```bash
npm test --workspace=apps/web -- test/instagram/api-client.test.ts
npm test --workspace=apps/web -- test/instagram/token.test.ts
npm test --workspace=apps/web -- test/instagram/actions.test.ts
npm test --workspace=apps/web -- test/api/cron/instagram-token-refresh.test.ts
```
Expected: PASS nos quatro.

- [ ] **Step 7: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/api-client.ts apps/web/src/lib/instagram/token.ts \
        "apps/web/src/app/cms/(authed)/settings/actions.ts" \
        apps/web/test/instagram/api-client.test.ts
git commit -m "feat(instagram): api-client v25.0 com httpStatus, timeout, paging travado e probeToken"
```

---

### Task 6: `src/lib/ops/ntfy.ts` + dedupe fail-open do `uptime-probe`

**Files:**
- Create: `apps/web/src/lib/ops/ntfy.ts`
- Create: `apps/web/src/lib/ops/alert-state.ts`
- Modify: `apps/web/src/app/api/cron/uptime-probe/route.ts` (`sendAlert` `:32-57`, chamada `:82`)
- Test: `apps/web/test/api/cron/ntfy.test.ts` (novo)
- Test: `apps/web/test/api/cron/uptime-probe.test.ts` (estendido)

**Interfaces:**
- Consumes: `ops_alert_claim` (C1).
- Produces:
  ```ts
  // src/lib/ops/ntfy.ts
  export type NtfyPriority = 'min' | 'low' | 'default' | 'high' | 'urgent'
  export interface INtfyAlert { title: string; body: string; priority: NtfyPriority; tags?: string[]; click?: string }
  export interface INtfyResult { alerted: boolean; ntfyStatus?: number; reason?: string; alertError?: string }
  export function sendNtfyAlert(alert: INtfyAlert): Promise<INtfyResult>
  export function sendNtfyHeartbeat(): Promise<INtfyResult>
  export function isTerminalRefusal(r: INtfyResult): boolean

  // src/lib/ops/alert-state.ts
  export function claimAlert(supabase: SupabaseClient, key: string, interval: string): Promise<boolean>
  export function releaseAlert(supabase: SupabaseClient, key: string): Promise<void>
  export function readAlertStamp(supabase: SupabaseClient, key: string): Promise<Date | null>
  export function touchAlert(supabase: SupabaseClient, key: string): Promise<void>
  ```

**Nota (ambiguidade resolvida):** o spec nomeia só `src/lib/ops/ntfy.ts`, mas os dois crons (§3.3 e §3.4) precisam do mesmo trio `claim` / `select last_at` / `delete` sobre `ops_alert_state` e do mesmo cálculo de episódio de canal. `alert-state.ts` existe para não duplicar isso entre dois arquivos de rota — nenhuma regra nova, só o mesmo SQL num lugar.

- [ ] **Step 1: Escrever `test/api/cron/ntfy.test.ts` (falha)**

```ts
// apps/web/test/api/cron/ntfy.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { sendNtfyAlert, sendNtfyHeartbeat, isTerminalRefusal } from '@/lib/ops/ntfy'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NTFY_URL', 'https://ntfy.example/topico')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function ok(status = 200) {
  return Promise.resolve(new Response(null, { status }))
}

const BASE = { title: 'T', body: 'B', priority: 'default' as const }

describe('sendNtfyAlert — contrato do resultado', () => {
  it('sem NTFY_URL devolve { alerted:false, reason:"NTFY_URL unset" } e não chama fetch', async () => {
    vi.stubEnv('NTFY_URL', '')
    expect(await sendNtfyAlert(BASE)).toEqual({ alerted: false, reason: 'NTFY_URL unset' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('o campo é ntfyStatus, NUNCA status (uptime-probe espalha isso num objeto com `status`)', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    const r = await sendNtfyAlert(BASE)
    expect(r).toEqual({ alerted: true, ntfyStatus: 200 })
    expect(r).not.toHaveProperty('status')
  })

  it('alerted = res.ok — um 404 não é sucesso', async () => {
    fetchMock.mockReturnValueOnce(ok(404))
    expect(await sendNtfyAlert(BASE)).toMatchObject({ alerted: false, ntfyStatus: 404 })
  })

  it('nunca lança quando o fetch rejeita', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    const r = await sendNtfyAlert(BASE)
    expect(r.alerted).toBe(false)
    expect(r.alertError).toContain('network down')
  })
})

describe('sendNtfyAlert — headers', () => {
  it('mapeia title/priority/tags/click para Title/Priority/Tags/Click', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert({ ...BASE, tags: ['rotating_light'], click: 'https://x/cms/settings/instagram' })
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const h = init.headers as Record<string, string>
    expect(h.Title).toBe('T')
    expect(h.Priority).toBe('default')
    expect(h.Tags).toBe('rotating_light')
    expect(h.Click).toBe('https://x/cms/settings/instagram')
    expect(init.body).toBe('B')
  })

  it('AbortSignal.timeout(4_000) por tentativa', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('sendNtfyAlert — credenciais na própria URL (MUST)', () => {
  it('extrai basic-auth do userinfo e manda no header, com a URL limpa', async () => {
    vi.stubEnv('NTFY_URL', 'https://u:p@ntfy.example/topico')
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('https://ntfy.example/topico')
    expect(String(url)).not.toContain('u:p@')
    const h = (init.headers as Record<string, string>)
    expect(h.Authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`)
  })

  it('sem userinfo NÃO manda header Authorization', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    const h = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(h.Authorization).toBeUndefined()
  })

  it('a URL com userinfo nunca aparece em nenhum argumento passado ao fetch', async () => {
    vi.stubEnv('NTFY_URL', 'https://u:p@ntfy.example/topico')
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyAlert(BASE)
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('u:p@')
  })
})

describe('sendNtfyAlert — re-tentativa', () => {
  it('429 => 2 tentativas, resultado transitório', async () => {
    fetchMock.mockReturnValue(ok(429))
    const r = await sendNtfyAlert(BASE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(r.alerted).toBe(false)
    expect(isTerminalRefusal(r)).toBe(false)
  })

  it('503 => 2 tentativas, transitório', async () => {
    fetchMock.mockReturnValue(ok(503))
    const r = await sendNtfyAlert(BASE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(isTerminalRefusal(r)).toBe(false)
  })

  it('403 => 1 tentativa, TERMINAL', async () => {
    fetchMock.mockReturnValue(ok(403))
    const r = await sendNtfyAlert(BASE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(isTerminalRefusal(r)).toBe(true)
  })

  it('401 e 404 também são terminais', async () => {
    for (const status of [401, 404]) {
      fetchMock.mockClear()
      fetchMock.mockReturnValue(ok(status))
      expect(isTerminalRefusal(await sendNtfyAlert(BASE)), String(status)).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  })

  it('sucesso na 2ª tentativa devolve alerted:true', async () => {
    fetchMock.mockReturnValueOnce(ok(429)).mockReturnValueOnce(ok(200))
    expect(await sendNtfyAlert(BASE)).toMatchObject({ alerted: true, ntfyStatus: 200 })
  })
})

describe('sendNtfyHeartbeat', () => {
  it('priority low, tag white_check_mark e SEM Click', async () => {
    fetchMock.mockReturnValueOnce(ok(200))
    await sendNtfyHeartbeat()
    const h = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(h.Priority).toBe('low')
    expect(h.Tags).toBe('white_check_mark')
    expect(h.Click).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/api/cron/ntfy.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ops/ntfy"`.

- [ ] **Step 3: Implementar `src/lib/ops/ntfy.ts`**

```ts
// apps/web/src/lib/ops/ntfy.ts
//
// Transporte único do canal de garantia. Antes de C2 o único emissor mandava
// process.env.NTFY_URL cru para o fetch (uptime-probe/route.ts:44) e não olhava
// res.ok — endurecer o tópico ("põe atrás de auth") exigiria mudança de código
// no meio de um incidente. Com isto, endurecer o tópico é mudança de VALOR DE
// ENV: basic-auth na própria URL é extraída e vira header.
//
// REGRA-PII-NTFY (§0): o tópico é compartilhado e não autenticado. Nenhum
// `title` nem `body` que passe por aqui pode carregar @handle, token_error,
// ids ou tokens. A regra é imposta pelos emissores; este módulo é o transporte.

export type NtfyPriority = 'min' | 'low' | 'default' | 'high' | 'urgent'

export interface INtfyAlert {
  title: string
  /** Obrigatório e de forma fixa — nunca texto vindo da Meta. */
  body: string
  priority: NtfyPriority
  /** Valor FIXO por emissor (MUST) — literal, nunca calculado. */
  tags?: string[]
  /** Vira o header `Click`. */
  click?: string
}

export interface INtfyResult {
  alerted: boolean
  /** MUST: `ntfyStatus`, nunca `status` — o uptime-probe espalha isto num
   *  objeto que já tem `status` ('ok'|'degraded'|'down'). */
  ntfyStatus?: number
  reason?: string
  alertError?: string
}

const NTFY_TIMEOUT_MS = 4_000
const RETRY_BACKOFF_MS = 1_000
const MAX_ATTEMPTS = 2

/** Terminal = o tópico recusou por configuração (auth/inexistente), não por carga. */
export function isTerminalRefusal(r: INtfyResult): boolean {
  if (r.alerted) return false
  if (r.ntfyStatus === undefined) return false // rede/timeout => transitório
  return r.ntfyStatus !== 429 && r.ntfyStatus < 500
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function splitCredentials(raw: string): { url: string; authorization: string | null } | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const user = u.username
  const pass = u.password
  u.username = ''
  u.password = ''
  if (!user) return { url: u.toString(), authorization: null }
  const pair = `${decodeURIComponent(user)}:${decodeURIComponent(pass)}`
  return { url: u.toString(), authorization: `Basic ${Buffer.from(pair).toString('base64')}` }
}

export async function sendNtfyAlert(alert: INtfyAlert): Promise<INtfyResult> {
  const raw = process.env.NTFY_URL
  if (!raw) return { alerted: false, reason: 'NTFY_URL unset' }

  const parsed = splitCredentials(raw)
  if (!parsed) return { alerted: false, reason: 'NTFY_URL malformed' }

  const headers: Record<string, string> = {
    Title: alert.title,
    Priority: alert.priority,
  }
  if (alert.tags && alert.tags.length > 0) headers.Tags = alert.tags.join(',')
  if (alert.click) headers.Click = alert.click
  if (parsed.authorization) headers.Authorization = parsed.authorization

  let last: INtfyResult = { alerted: false, reason: 'not attempted' }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS))
    try {
      const res = await fetch(parsed.url, {
        method: 'POST',
        headers,
        body: alert.body,
        signal: AbortSignal.timeout(NTFY_TIMEOUT_MS),
      })
      if (res.ok) return { alerted: true, ntfyStatus: res.status }
      last = { alerted: false, ntfyStatus: res.status }
      // Terminal não re-tenta: 401/403/404 não melhoram em 1 s.
      if (!isTransientStatus(res.status)) return last
    } catch (err) {
      last = { alerted: false, alertError: err instanceof Error ? err.message : String(err) }
    }
  }

  return last
}

export async function sendNtfyHeartbeat(): Promise<INtfyResult> {
  return sendNtfyAlert({
    title: 'Instagram ops heartbeat',
    body: 'alert channel alive',
    priority: 'low',
    tags: ['white_check_mark'],
  })
}
```

- [ ] **Step 4: Implementar `src/lib/ops/alert-state.ts`**

```ts
// apps/web/src/lib/ops/alert-state.ts
//
// Acesso ao rate limiter `ops_alert_state` / `ops_alert_claim` (C1).
// `ops_alert_claim` é RATE LIMITER (comparação estrita), NUNCA contador de
// sequência — e variável de módulo é proibida como contador (reseta em todo
// cold start).
import type { SupabaseClient } from '@supabase/supabase-js'

/** `true` = a janela abriu e o carimbo foi renovado; `false` = ainda na janela. */
export async function claimAlert(
  supabase: SupabaseClient,
  key: string,
  interval: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('ops_alert_claim', {
    p_key: key,
    p_min_interval: interval,
  })
  if (error) throw new Error(`ops_alert_claim(${key}) failed: ${error.message}`)
  if (typeof data !== 'boolean') throw new Error(`ops_alert_claim(${key}) returned a non-boolean`)
  return data
}

/** Libera a janela — usado quando uma etapa opcional é PULADA por prazo. */
export async function releaseAlert(supabase: SupabaseClient, key: string): Promise<void> {
  await supabase.from('ops_alert_state').delete().eq('key', key)
}

export async function readAlertStamp(
  supabase: SupabaseClient,
  key: string,
): Promise<Date | null> {
  const { data } = await supabase
    .from('ops_alert_state')
    .select('last_at')
    .eq('key', key)
    .maybeSingle()
  const lastAt = (data as { last_at?: string } | null)?.last_at
  return lastAt ? new Date(lastAt) : null
}

/** Repõe o carimbo para agora sem passar pela janela (episódio contínuo/fóssil). */
export async function touchAlert(supabase: SupabaseClient, key: string): Promise<void> {
  await supabase
    .from('ops_alert_state')
    .upsert({ key, last_at: new Date().toISOString() }, { onConflict: 'key' })
}
```

- [ ] **Step 5: Rodar `ntfy.test.ts` e ver passar**

Run: `npm test --workspace=apps/web -- test/api/cron/ntfy.test.ts`
Expected: PASS.

- [ ] **Step 6: Escrever os testes novos do `uptime-probe` (falham)**

No topo de `apps/web/test/api/cron/uptime-probe.test.ts`, troque o mock do Sentry por:

```ts
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))
```

e, dentro de `makeSupabase()`, troque a linha do `rpc` por:

```ts
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args })
    return Promise.resolve({ data: true, error: null })
  })
  return { from, rpc, _upserts: upserts, _rpcCalls: rpcCalls }
```

Depois acrescente ao fim do arquivo:

```ts
import * as Sentry from '@sentry/nextjs'

describe('GET /api/cron/uptime-probe — dedupe por status (C2)', () => {
  it('chave uptime:down com 14 minutes quando down', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(supabase._rpcCalls).toContainEqual({
      fn: 'ops_alert_claim',
      args: { p_key: 'uptime:down', p_min_interval: '14 minutes' },
    })
  })

  it('chave uptime:degraded com 59 minutes quando degraded — chaves SEPARADAS', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 5000])
    const { fn } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(supabase._rpcCalls).toContainEqual({
      fn: 'ops_alert_claim',
      args: { p_key: 'uptime:degraded', p_min_interval: '59 minutes' },
    })
  })

  it('claim false => nenhum POST ao ntfy (o 2º degraded em 59 min é suprimido)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.resolve({ data: false, error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 5000])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    const body = await (await GET(req())).json()
    expect(ntfyCalls).toHaveLength(0)
    expect(body.alerted).toBe(false)
    expect(body.reason).toBe('deduped')
  })

  it('degraded e, 5 min depois, down => 2 pushes (a escalada nunca fica retida)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    // simula ops_alert_state real: uma janela por chave
    const stamped = new Set<string>()
    supabase.rpc.mockImplementation((_fn: string, args: Record<string, unknown>) => {
      const key = String(args.p_key)
      const first = !stamped.has(key)
      stamped.add(key)
      return Promise.resolve({ data: first, error: null })
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    stubPerformanceNow([0, 5000])
    let mocked = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', mocked.fn)
    await GET(req())
    expect(mocked.ntfyCalls).toHaveLength(1)

    stubPerformanceNow([0, 100])
    mocked = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', mocked.fn)
    await GET(req())
    expect(mocked.ntfyCalls).toHaveLength(1)
  })

  it('claim lançando => FAIL-OPEN: alerta assim mesmo + captureMessage', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.reject(new Error('pg down')))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const body = await (await GET(req())).json()
    expect(ntfyCalls).toHaveLength(1)
    expect(body.alerted).toBe(true)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      'uptime dedupe claim failed — alerting anyway', 'warning',
    )
  })

  it('claim devolvendo não-booleano também é fail-open', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(ntfyCalls).toHaveLength(1)
  })

  it('o POST ao ntfy leva AbortSignal (timeout de 4 s)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(ntfyCalls[0]?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('body.status continua "ok" | "degraded" | "down" (nunca sombreado por ntfyStatus)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const body = await (await GET(req())).json()
    expect(body.status).toBe('down')
    expect(body.ntfyStatus).toBe(200)
  })
})
```

Ajuste também o `mockFetch` já existente para devolver `ok: true` no POST do ntfy (ele já devolve `new Response(null, { status: 200 })`, cujo `.ok` é `true` — nenhuma mudança necessária) e o `it('POSTs to NTFY_URL with Priority urgent…')` continua válido: `Tags` passa a ser `'rotating_light'` (string única) e `Priority` `'urgent'`.

- [ ] **Step 7: Implementar a mudança no `uptime-probe`**

Em `apps/web/src/app/api/cron/uptime-probe/route.ts`, troque as linhas 1-2 por:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { sendNtfyAlert, type INtfyResult } from '@/lib/ops/ntfy'
import { claimAlert } from '@/lib/ops/alert-state'
```

e substitua `sendAlert` (`:32-57`) por:

```ts
async function sendAlert(
  supabase: SupabaseClient,
  status: ProbeStatus,
  httpCode: number,
  elapsedMs: number,
  target: string,
): Promise<INtfyResult> {
  // Dedupe POR STATUS (MUST): com chave única, um `degraded` em t=0 carimbava
  // e calava um `down` genuíno em t=5 e t=10. Intervalos abaixo da grade
  // porque a comparação do claim é estrita. 288/dia => ≤ 96/dia em down,
  // ≤ 24/dia em degraded.
  let shouldSend = true
  try {
    shouldSend = await claimAlert(
      supabase,
      status === 'down' ? 'uptime:down' : 'uptime:degraded',
      status === 'down' ? '14 minutes' : '59 minutes',
    )
  } catch {
    // FAIL-OPEN: o dedupe existe para reduzir ruído, nunca para calar o sinal
    // mais rápido do projeto quando o banco está ruim.
    Sentry.captureMessage('uptime dedupe claim failed — alerting anyway', 'warning')
    shouldSend = true
  }
  if (!shouldSend) return { alerted: false, reason: 'deduped' }

  const elapsedS = (elapsedMs / 1000).toFixed(1)
  return sendNtfyAlert({
    title: `bythiagofigueiredo ${status}`,
    body: `${status} · ${httpCode} · ${elapsedS}s · ${target}`,
    priority: status === 'down' ? 'urgent' : 'high',
    tags: [status === 'down' ? 'rotating_light' : 'warning'],
  })
}
```

e a chamada (`:82`) por:

```ts
    const alertResult: INtfyResult =
      status !== 'ok'
        ? await sendAlert(supabase, status, httpCode, elapsedMs, target)
        : { alerted: false }
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/api/cron/uptime-probe.test.ts`
Expected: PASS (os antigos e os novos).

- [ ] **Step 9: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/ops/ntfy.ts apps/web/src/lib/ops/alert-state.ts \
        apps/web/src/app/api/cron/uptime-probe/route.ts \
        apps/web/test/api/cron/ntfy.test.ts apps/web/test/api/cron/uptime-probe.test.ts
git commit -m "feat(ops): transporte ntfy unico com basic-auth e dedupe por status no uptime-probe"
```

---

### Task 7: `sync.ts` — token obrigatório, `onConflict` composto, portão de URL, teto de tamanho, re-tentativa

**Files:**
- Modify: `apps/web/src/lib/instagram/sync.ts` (arquivo inteiro)
- Modify: `apps/web/src/lib/instagram/types.ts` (`ig_user_id_source` deixa de ser `?:`)
- Modify: `apps/web/src/app/api/cron/instagram-sync/route.ts:58` (ponte temporária de tipo — a rota é reescrita na Tarefa 13)
- Test: `apps/web/test/instagram/sync.test.ts` (estendido)
- Test: `apps/web/test/instagram/cron-route.test.ts`, `apps/web/test/instagram/token-refresh.test.ts` (fixtures de `InstagramAccountRow`)

**Interfaces:**
- Consumes: `SyncResult` com `partial`/`mediaFailed` e `cacheImagesInBatches` com `deadlineAt` (A); `claimAlert` (Tarefa 6).
- Produces:
  ```ts
  export function syncInstagramAccount(
    supabase: SupabaseClient,
    account: InstagramAccountRow,
    accessToken: string,                     // C2: OBRIGATÓRIO
    opts?: { deadlineAt?: number },
  ): Promise<SyncResult>
  export function checkImageCacheHealth(supabase: SupabaseClient, accountId: string): Promise<void>
  export const MAX_IMAGE_BYTES: number       // 10 * 1024 * 1024
  ```

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `apps/web/test/instagram/sync.test.ts`:

```ts
// ── C2 ───────────────────────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'
import { checkImageCacheHealth } from '@/lib/instagram/sync'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

function mediaItem(over: Partial<InstagramMediaItem> = {}): InstagramMediaItem {
  return {
    id: '17890123456789',
    media_type: 'IMAGE',
    media_url: 'https://scontent.cdninstagram.com/a.jpg',
    thumbnail_url: null,
    caption: null,
    permalink: 'https://www.instagram.com/p/abc/',
    like_count: 0,
    comments_count: 0,
    timestamp: '2026-05-01T12:00:00+0000',
    ...over,
  }
}

function imageResponse(opts: { contentType?: string; contentLength?: string | null; bytes?: number } = {}) {
  const headers = new Headers()
  headers.set('content-type', opts.contentType ?? 'image/jpeg')
  if (opts.contentLength !== null) headers.set('content-length', opts.contentLength ?? '1000')
  return {
    ok: true,
    headers,
    arrayBuffer: async () => new ArrayBuffer(opts.bytes ?? 1000),
    body: null,
  }
}

describe('cacheImage — portão de forma do item.id (MUST, antes de qualquer put)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it.each(['../x', 'a1', '9'.repeat(33)])('id %s => nenhum fetch e nenhum put', async (badId) => {
    mockFetchMedia.mockResolvedValue([mediaItem({ id: badId })])
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
  })
})

describe('cacheImage — portão de destino de rede (SSRF de leitura)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it('media_url em 169.254.169.254 => nenhum fetch, nenhum put, mediaFailed++', async () => {
    mockFetchMedia.mockResolvedValue([
      mediaItem({ media_url: 'http://169.254.169.254/latest/meta-data/' }),
    ])
    const r = await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(r.mediaFailed).toBe(1)
  })

  it.each([
    'https://evil.com/a.jpg',
    'https://cdninstagram.com.evil.com/a.jpg',
    'http://scontent.cdninstagram.com/a.jpg',
  ])('host/protocolo fora da allow-list (%s) => null sem fetch', async (url) => {
    mockFetchMedia.mockResolvedValue([mediaItem({ media_url: url })])
    const r = await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(r.mediaCached).toBe(0)
  })

  it('thumbnail_url hostil num VIDEO cai na mesma recusa', async () => {
    mockFetchMedia.mockResolvedValue([
      mediaItem({ media_type: 'VIDEO', thumbnail_url: 'https://evil.com/t.jpg',
                  media_url: 'https://scontent.cdninstagram.com/v.mp4' }),
    ])
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('URL legítima => fetch com redirect:"error"', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse())
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect((mockFetch.mock.calls[0]![1] as RequestInit).redirect).toBe('error')
  })

  it('rejeição de redirect vira null (nenhum put)', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockRejectedValue(new TypeError('unexpected redirect'))
    const r = await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(r.mediaFailed).toBe(1)
  })

  it('3 URLs recusadas no MESMO run => exatamente 1 captureMessage', async () => {
    mockFetchMedia.mockResolvedValue([
      mediaItem({ id: '1', media_url: 'https://evil.com/1.jpg' }),
      mediaItem({ id: '2', media_url: 'https://evil.com/2.jpg' }),
      mediaItem({ id: '3', media_url: 'https://evil.com/3.jpg' }),
    ])
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    const calls = vi.mocked(Sentry.captureMessage).mock.calls
      .filter(([m]) => m === 'instagram media url rejected')
    expect(calls).toHaveLength(1)
  })
})

describe('cacheImage — teto de tamanho e content-type', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it('content-length 20 MB => null SEM ler o corpo', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    const res = imageResponse({ contentLength: '20000000' })
    const spy = vi.spyOn(res, 'arrayBuffer')
    mockFetch.mockResolvedValue(res)
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(spy).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('sem content-length e corpo acima de 10 MB => leitura abortada e null', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    const cancel = vi.fn(() => Promise.resolve())
    let served = 0
    const headers = new Headers({ 'content-type': 'image/jpeg' })
    mockFetch.mockResolvedValue({
      ok: true,
      headers,
      body: {
        getReader: () => ({
          read: () => {
            served++
            return Promise.resolve({ done: false, value: new Uint8Array(6 * 1024 * 1024) })
          },
          cancel,
        }),
      },
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(cancel).toHaveBeenCalled()
    expect(served).toBeLessThanOrEqual(3)
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('content-type text/html => null (ext fora da allow-list)', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse({ contentType: 'text/html' }))
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('content-type image/webp => put com contentType derivado do ext, nunca o header cru', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse({ contentType: 'image/webp; charset=binary' }))
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockBlobPut).toHaveBeenCalledWith(
      'instagram/acc-1/17890123456789.webp',
      expect.anything(),
      expect.objectContaining({ contentType: 'image/webp', addRandomSuffix: false, access: 'public' }),
    )
  })
})

describe('C2 — contrato do sync', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it('accessToken é obrigatório: o token vem do 3º argumento, nunca de account.access_token', async () => {
    mockFetchMedia.mockResolvedValue([])
    await syncInstagramAccount(
      mockSupabase().supabase,
      makeAccount({ access_token: 'v1:cifrado' }),
      'PLAIN-TOKEN',
    )
    expect(mockFetchMedia).toHaveBeenCalledWith('ig-user-1', 'PLAIN-TOKEN')
  })

  it('upsert usa onConflict composto account_id,ig_media_id', async () => {
    const { supabase, upsertFn } = mockSupabase()
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse())
    await syncInstagramAccount(supabase, makeAccount(), 'tok')
    expect(upsertFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: 'account_id,ig_media_id' }),
    )
  })

  it('re-tentativa: post existente com cached_image_url NULL volta para newItems', async () => {
    const { supabase, setExisting } = mockSupabase()
    setExisting([{ ig_media_id: '17890123456789', cached_image_url: null }])
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse())
    const r = await syncInstagramAccount(supabase, makeAccount(), 'tok')
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
    expect(r.mediaCached).toBe(1)
    // já existia => não conta como inserção
    expect(r.postsInserted).toBe(0)
  })

  it('post existente COM cached_image_url não é re-baixado', async () => {
    const { supabase, setExisting } = mockSupabase()
    setExisting([{ ig_media_id: '17890123456789', cached_image_url: 'https://blob/x.jpg' }])
    mockFetchMedia.mockResolvedValue([mediaItem()])
    const r = await syncInstagramAccount(supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(r.mediaFailed).toBe(0)
  })

  it("conta sem ig_user_id lança a frase humana, nunca 'No Instagram user ID'", async () => {
    await expect(
      syncInstagramAccount(mockSupabase().supabase, makeAccount({ ig_user_id: null }), 'tok'),
    ).rejects.toThrow("This account isn't connected — use Connect with Instagram")
  })
})

describe('checkImageCacheHealth — 3 execuções consecutivas com mediaFailed > 0', () => {
  function logSupabase(rows: Array<{ error_message: string | null }>) {
    const rpc = vi.fn(() => Promise.resolve({ data: true, error: null }))
    const limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
    const order = vi.fn(() => ({ limit }))
    const eqStatus = vi.fn(() => ({ order }))
    const inMode = vi.fn(() => ({ eq: eqStatus }))
    const eqAccount = vi.fn(() => ({ in: inMode }))
    const select = vi.fn(() => ({ eq: eqAccount }))
    return { from: vi.fn(() => ({ select })), rpc } as never
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('as 3 linhas mais recentes com mediaFailed > 0 => 1 captureMessage/dia', async () => {
    await checkImageCacheHealth(
      logSupabase([
        { error_message: 'detail: x mediaFailed:2' },
        { error_message: ' mediaFailed:1' },
        { error_message: 'partial mediaFailed:3' },
      ]),
      'acc-1',
    )
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram image cache persistently failing', 'warning')
  })

  it('a mais recente SEM mediaFailed => nenhum captureMessage', async () => {
    await checkImageCacheHealth(
      logSupabase([
        { error_message: null },
        { error_message: ' mediaFailed:1' },
        { error_message: ' mediaFailed:3' },
      ]),
      'acc-1',
    )
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('menos de 3 linhas => nenhum captureMessage', async () => {
    await checkImageCacheHealth(logSupabase([{ error_message: ' mediaFailed:1' }]), 'acc-1')
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })
})
```

> O helper `mockSupabase()` já existe no arquivo (A). Estenda-o para expor `upsertFn` e um `setExisting(rows)` que alimenta o `select('ig_media_id, cached_image_url')`, e para o `from('instagram_sync_log')` devolver a cadeia `select().eq().in().eq().order().limit()`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/sync.test.ts`
Expected: FAIL — `checkImageCacheHealth` não existe; `onConflict` ainda é `'ig_media_id'`; nenhum portão de URL.

- [ ] **Step 3: Implementar `sync.ts`**

Substitua `apps/web/src/lib/instagram/sync.ts` inteiro por:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { fetchInstagramMedia, type InstagramMediaItem } from './api-client'
import { claimAlert } from '@/lib/ops/alert-state'
import type { InstagramAccountRow, SyncResult } from './types'

const IMAGE_CACHE_CONCURRENCY = 5
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_FETCH_MAX_MS = 8_000
const IMAGE_FETCH_MIN_MS = 1_000

// Todo identificador vindo da Meta chega por cast puro (api-client.ts) — o
// mesmo portão de forma que §3.1 passo 7 dá aos ids da conexão.
const MEDIA_ID_RE = /^[0-9]{1,32}$/
// Sufixo ancorado: 'cdninstagram.com.evil.com' NÃO casa.
const CDN_HOST_RE = /(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/

const EXT_CONTENT_TYPE = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const
type AllowedExt = keyof typeof EXT_CONTENT_TYPE

/** Variável de RUN (nunca de módulo — módulo reseta em cold start). */
interface IRunFlags {
  urlRejected: boolean
}

function extFor(contentType: string | null): AllowedExt | null {
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpg'
  if (ct.includes('image/png')) return 'png'
  if (ct.includes('image/webp')) return 'webp'
  return null
}

/** Lê o corpo em stream com corte rígido. `null` = passou do teto. */
async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const body = res.body
  if (!body) {
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.byteLength > max ? null : buf
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

async function cacheImage(
  accountId: string,
  item: InstagramMediaItem,
  deadlineAt: number | undefined,
  flags: IRunFlags,
): Promise<string | null> {
  // (i) forma do id — antes de tocar a rede ou o Blob. Hoje o valor da Meta
  // determinaria sozinho a chave do objeto (addRandomSuffix:false).
  if (!MEDIA_ID_RE.test(item.id)) return null

  const urlToCache =
    item.media_type === 'VIDEO' ? (item.thumbnail_url ?? item.media_url) : item.media_url
  if (!urlToCache) return null

  // (iv) destino de rede validado ANTES do fetch. Este é o único valor vindo da
  // Meta usado como DESTINO, e o corpo vai para um Blob `public` — um
  // media_url hostil seria exfiltração, não SSRF cega.
  const parsed = (() => {
    try {
      return new URL(urlToCache)
    } catch {
      return null
    }
  })()
  if (!parsed || parsed.protocol !== 'https:' || !CDN_HOST_RE.test(parsed.hostname)) {
    flags.urlRejected = true
    return null
  }

  const budget =
    deadlineAt === undefined
      ? IMAGE_FETCH_MAX_MS
      : Math.max(IMAGE_FETCH_MIN_MS, Math.min(IMAGE_FETCH_MAX_MS, deadlineAt - Date.now()))

  try {
    // redirect:'error' — re-checar imgRes.url depois seria tarde demais para um
    // 302 de scontent.cdninstagram.com para endereço interno.
    const imgRes = await fetch(urlToCache, {
      redirect: 'error',
      signal: AbortSignal.timeout(budget),
    })
    if (!imgRes.ok) return null

    // (iii) ext da allow-list; contentType DERIVADO dele, nunca ecoado.
    const ext = extFor(imgRes.headers.get('content-type'))
    if (ext === null) return null

    // (ii) teto de tamanho.
    const declared = imgRes.headers.get('content-length')
    let buffer: Buffer | null
    if (declared !== null) {
      const n = Number(declared)
      if (!Number.isFinite(n) || n > MAX_IMAGE_BYTES) return null
      buffer = Buffer.from(await imgRes.arrayBuffer())
      if (buffer.byteLength > MAX_IMAGE_BYTES) return null
    } else {
      buffer = await readCapped(imgRes, MAX_IMAGE_BYTES)
    }
    if (buffer === null) return null

    const blobResult = await put(`instagram/${accountId}/${item.id}.${ext}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: EXT_CONTENT_TYPE[ext],
    })
    return blobResult.url
  } catch {
    return null
  }
}

async function cacheImagesInBatches(
  accountId: string,
  items: InstagramMediaItem[],
  deadlineAt: number | undefined,
  flags: IRunFlags,
): Promise<{ cached: Map<string, string>; partial: boolean }> {
  const cached = new Map<string, string>()
  let partial = false

  for (let i = 0; i < items.length; i += IMAGE_CACHE_CONCURRENCY) {
    if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
      partial = true
      break
    }
    const batch = items.slice(i, i + IMAGE_CACHE_CONCURRENCY)
    const work = Promise.allSettled(
      batch.map((item) => cacheImage(accountId, item, deadlineAt, flags)),
    )

    // Cada lote corre contra o prazo restante: os downloads em voo são
    // abortados pelos próprios AbortSignal, e `partial` fica apoiado em lotes
    // que de fato terminam.
    const results =
      deadlineAt === undefined
        ? await work
        : await Promise.race([
            work,
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), Math.max(0, deadlineAt - Date.now())),
            ),
          ])

    if (results === null) {
      partial = true
      break
    }
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) cached.set(batch[idx]!.id, r.value)
    })
  }

  return { cached, partial }
}

export async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  accessToken: string,
  opts?: { deadlineAt?: number },
): Promise<SyncResult> {
  if (!accessToken) throw new Error("This account isn't connected — use Connect with Instagram")
  if (!account.ig_user_id) {
    throw new Error("This account isn't connected — use Connect with Instagram")
  }

  const result: SyncResult = {
    postsFound: 0,
    postsInserted: 0,
    postsUpdated: 0,
    mediaCached: 0,
    partial: false,
    mediaFailed: 0,
  }

  const media = await fetchInstagramMedia(account.ig_user_id, accessToken)
  result.postsFound = media.length
  if (media.length === 0) return result

  const mediaIds = media.map((m) => m.id)
  const { data: existing } = await supabase
    .from('instagram_posts')
    .select('ig_media_id, cached_image_url')
    .eq('account_id', account.id)
    .in('ig_media_id', mediaIds)

  const existingMap = new Map(
    (existing ?? []).map(
      (r: { ig_media_id: string; cached_image_url: string | null }) =>
        [r.ig_media_id, r.cached_image_url] as const,
    ),
  )

  const brandNew = media.filter((m) => !existingMap.has(m.id))
  // Re-tentativa (MUST): a linha existe mas nunca conseguiu cache => tenta de novo.
  const newItems = media.filter((m) => !existingMap.has(m.id) || existingMap.get(m.id) == null)

  const flags: IRunFlags = { urlRejected: false }
  const { cached, partial } = await cacheImagesInBatches(
    account.id,
    newItems,
    opts?.deadlineAt,
    flags,
  )
  result.mediaCached = cached.size
  result.partial = partial
  result.mediaFailed = newItems.length - cached.size

  // 1× por RUN — silêncio total esconderia uma mudança de CDN da Meta.
  if (flags.urlRejected) Sentry.captureMessage('instagram media url rejected', 'warning')

  const rows = media.map((item) => ({
    account_id: account.id,
    ig_media_id: item.id,
    media_type: item.media_type,
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url ?? null,
    cached_image_url: cached.get(item.id) ?? existingMap.get(item.id) ?? null,
    caption: item.caption,
    permalink: item.permalink,
    like_count: item.like_count,
    comments_count: item.comments_count,
    ig_timestamp: item.timestamp,
  }))

  const { error, count } = await supabase
    .from('instagram_posts')
    .upsert(rows, { onConflict: 'account_id,ig_media_id', count: 'exact' })

  // Erro do upsert é LANÇADO (A) — engolir escondia a falha e ainda carimbava
  // last_synced_at.
  if (error) throw error

  result.postsInserted = brandNew.length
  result.postsUpdated = (count ?? rows.length) - brandNew.length

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}

/**
 * Fonte da verdade das "3 execuções consecutivas com mediaFailed > 0", sem
 * coluna nova: as 3 linhas `completed` mais recentes de `daily`/`manual`
 * (índice idx_instagram_sync_log_account_mode). `ops_alert_claim` é rate
 * limiter, nunca contador de sequência — daí a derivação em tempo de execução.
 * Chamado pelo cron do sync depois do closeSyncRow.
 */
export async function checkImageCacheHealth(
  supabase: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { data } = await supabase
    .from('instagram_sync_log')
    .select('error_message')
    .eq('account_id', accountId)
    .in('mode', ['daily', 'manual'])
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  const rows = (data ?? []) as Array<{ error_message: string | null }>
  if (rows.length < 3) return

  const failing = rows.every((r) => {
    const match = / mediaFailed:(\d+)/.exec(r.error_message ?? '')
    return match !== null && Number(match[1]) > 0
  })
  if (!failing) return

  if (await claimAlert(supabase, `imgcache:${accountId}`, '23 hours')) {
    Sentry.captureMessage('instagram image cache persistently failing', 'warning')
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test --workspace=apps/web -- test/instagram/sync.test.ts
npm test --workspace=apps/web -- test/instagram/cron-route.test.ts
```
Expected: PASS. O `cron-route.test.ts` só passa depois de você acrescentar o 3º argumento ao mock — **é a Tarefa 13** que reescreve a rota; até lá, ajuste apenas o typecheck: a rota `instagram-sync` chama `syncInstagramAccount(supabase, account)`. Passe `account.access_token ?? ''` **temporariamente nesta tarefa** e deixe a Tarefa 13 substituir pela decifra real:

```ts
// src/app/api/cron/instagram-sync/route.ts (:58) — ponte temporária desta tarefa
const result = await syncInstagramAccount(supabase, account, account.access_token ?? '')
```

- [ ] **Step 5: `ig_user_id_source` deixa de ser opcional em `InstagramAccountRow`**

C1 entregou as 9 colunas **opcionais** (`?:`) só para que os literais de `InstagramAccountRow` já existentes nos testes continuassem compilando um commit antes de qualquer código que as escrevesse. C2 escreve `ig_user_id_source` (aqui, nos dois crons e em `setInstagramToken`), então o `?` sai — é ele que decide o alcance do data-deletion (§3.1 passo 7) e a `identityKey` da varredura, e um `undefined` silencioso ali é o caminho para apagar dados de terceiro.

Em `apps/web/src/lib/instagram/types.ts`:

```ts
  // C1 entregou como `ig_user_id_source?: 'oauth' | 'legacy'`; C2 escreve a
  // coluna, e o schema a tem `not null default 'legacy'`.
  ig_user_id_source: 'oauth' | 'legacy'
```

Depois acrescente `ig_user_id_source: 'legacy',` a **todo** literal de `InstagramAccountRow` dos testes até o typecheck fechar:

```bash
npm run typecheck --workspace=apps/web 2>&1 | grep "ig_user_id_source"
# arquivos esperados: test/instagram/sync.test.ts (makeAccount),
# test/instagram/cron-route.test.ts, test/instagram/token-refresh.test.ts
```

- [ ] **Step 6: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/sync.ts apps/web/src/lib/instagram/types.ts \
        apps/web/test/instagram/sync.test.ts apps/web/test/instagram/cron-route.test.ts \
        apps/web/test/instagram/token-refresh.test.ts \
        apps/web/src/app/api/cron/instagram-sync/route.ts
git commit -m "fix(instagram): portao de URL, teto de tamanho e re-tentativa no cache de imagens"
```

---

### Task 8: `token.ts` — `markTokenInvalid` e `evaluateTransientStreak`

**Files:**
- Modify: `apps/web/src/lib/instagram/token.ts`
- Test: `apps/web/test/instagram/token.test.ts` (estendido)

**Interfaces:**
- Consumes: RPC `instagram_mark_token_invalid` (C1); `redact` (Tarefa 4).
- Produces:
  ```ts
  export interface IMarkTokenInvalidOpts { fatal: boolean; forceReason?: boolean; mode?: 'daily' | 'token_refresh' }
  export class MarkTokenInvalidError extends Error
  export function markTokenInvalid(
    supabase: SupabaseClient,
    account: { id: string; site_id: string },
    reason: string,
    opts: IMarkTokenInvalidOpts,
  ): Promise<void>                                   // lança MarkTokenInvalidError se a RPC falhar
  export function evaluateTransientStreak(
    supabase: SupabaseClient,
    account: { id: string; site_id: string },
    mode: 'daily' | 'token_refresh',
  ): Promise<boolean>                                // true = episódio aberto agora
  ```

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `apps/web/test/instagram/token.test.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { MarkTokenInvalidError, evaluateTransientStreak, markTokenInvalid } from '@/lib/instagram/token'
import type { SupabaseClient } from '@supabase/supabase-js'

const ACC = { id: 'acc-1', site_id: 'site-1' }

function rpcClient(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }))
  const eqSite = vi.fn(() => Promise.resolve({ error: null }))
  const eqId = vi.fn(() => ({ eq: eqSite }))
  const update = vi.fn(() => ({ eq: eqId }))
  const from = vi.fn(() => ({ update }))
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, update }
}

describe('markTokenInvalid', () => {
  it('encaminha os 6 parâmetros da RPC, com p_mode', async () => {
    const { client, rpc } = rpcClient({ data: [{ out_token_error_at: '2026-09-06T11:00:00Z' }] })
    await markTokenInvalid(client, ACC, 'transient', { fatal: false, mode: 'token_refresh' })
    expect(rpc).toHaveBeenCalledWith('instagram_mark_token_invalid', {
      p_account: 'acc-1', p_site: 'site-1', p_reason: 'transient',
      p_fatal: false, p_force_reason: false, p_mode: 'token_refresh',
    })
  })

  it('REDIGE o motivo antes de mandar ao banco', async () => {
    const { client, rpc } = rpcClient({ data: [] })
    await markTokenInvalid(client, ACC, `failed: access_token=${'a'.repeat(64)}`, { fatal: true })
    const reason = String((rpc.mock.calls[0]![1] as Record<string, unknown>).p_reason)
    expect(reason).not.toContain('a'.repeat(64))
    expect(reason).toContain('[REDACTED]')
  })

  it('trunca o motivo em 500 caracteres', async () => {
    const { client, rpc } = rpcClient({ data: [] })
    await markTokenInvalid(client, ACC, 'x'.repeat(900), { fatal: true })
    expect(String((rpc.mock.calls[0]![1] as Record<string, unknown>).p_reason)).toHaveLength(500)
  })

  it('forceReason:true é repassado', async () => {
    const { client, rpc } = rpcClient({ data: [] })
    await markTokenInvalid(client, ACC, 'deauthorized', { fatal: true, forceReason: true })
    expect((rpc.mock.calls[0]![1] as Record<string, unknown>).p_force_reason).toBe(true)
  })

  it('RPC com error => captureException, episódio FORÇADO por update direto e throw', async () => {
    const { client, update } = rpcClient({ error: { message: 'PGRST202 not found' } })
    await expect(markTokenInvalid(client, ACC, 'expired', { fatal: true }))
      .rejects.toBeInstanceOf(MarkTokenInvalidError)
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      token_error: expect.stringContaining('expired'),
      token_alert_sent_at: null,
      token_alert_attempt_at: null,
      token_reprobe_at: null,
    }))
  })
})

describe('evaluateTransientStreak — POR MODO', () => {
  const DAY = 86_400_000
  function logClient(rows: Array<{ started_at: string; mode: string; status: string; error_message: string | null }>) {
    const rpc = vi.fn(() => Promise.resolve({ data: [], error: null }))
    const gt = vi.fn(() => Promise.resolve({ data: rows, error: null }))
    const inStatus = vi.fn(() => ({ gt }))
    const inMode = vi.fn(() => ({ in: inStatus }))
    const eq = vi.fn(() => ({ in: inMode }))
    const select = vi.fn(() => ({ eq }))
    const eqSite = vi.fn(() => Promise.resolve({ error: null }))
    const eqId = vi.fn(() => ({ eq: eqSite }))
    const update = vi.fn(() => ({ eq: eqId }))
    const from = vi.fn(() => ({ select, update }))
    return { client: { rpc, from } as unknown as SupabaseClient, rpc }
  }
  function fail(daysAgo: number, mode: string, hour = 11) {
    const d = new Date(Date.now() - daysAgo * DAY)
    d.setUTCHours(hour, 0, 5, 0)
    return { started_at: d.toISOString(), mode, status: 'failed', error_message: 'transient: 429' }
  }
  function done(daysAgo: number, mode: string, hour = 13) {
    const d = new Date(Date.now() - daysAgo * DAY)
    d.setUTCHours(hour, 0, 5, 0)
    return { started_at: d.toISOString(), mode, status: 'completed', error_message: null }
  }

  it('3 dias UTC de token_refresh falhando + daily completed diário => ABRE com mode token_refresh', async () => {
    const { client, rpc } = logClient([
      fail(2, 'token_refresh'), fail(1, 'token_refresh'), fail(0, 'token_refresh'),
      done(2, 'daily'), done(1, 'daily'), done(0, 'daily'),
    ])
    expect(await evaluateTransientStreak(client, ACC, 'token_refresh')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('instagram_mark_token_invalid', expect.objectContaining({
      p_fatal: false, p_mode: 'token_refresh',
    }))
  })

  it('2 falhas no MESMO dia UTC + 1 em outro => nada (2 dias distintos)', async () => {
    const { client, rpc } = logClient([
      fail(1, 'token_refresh', 11), fail(1, 'token_refresh', 13), fail(0, 'token_refresh'),
    ])
    expect(await evaluateTransientStreak(client, ACC, 'token_refresh')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('dias 1/3/5 => nada (fora da janela de 4 dias)', async () => {
    const { client, rpc } = logClient([fail(5, 'daily'), fail(3, 'daily'), fail(1, 'daily')])
    // a query já filtra > now - 4 days; aqui o retorno simula só o que passou
    const filtered = logClient([fail(3, 'daily'), fail(1, 'daily')])
    expect(await evaluateTransientStreak(filtered.client, ACC, 'daily')).toBe(false)
    expect(filtered.rpc).not.toHaveBeenCalled()
    void client; void rpc
  })

  it('completed DO MESMO MODO mais novo que a falha mais antiga => nada', async () => {
    const { client, rpc } = logClient([
      fail(2, 'daily'), fail(1, 'daily'), fail(0, 'daily'), done(1, 'daily', 20),
    ])
    expect(await evaluateTransientStreak(client, ACC, 'daily')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('linhas timeout / never_connected / infra: / permanent: / detail: são ignoradas', async () => {
    const { client, rpc } = logClient([
      { ...fail(2, 'daily'), error_message: 'timeout' },
      { ...fail(1, 'daily'), error_message: 'never_connected' },
      { ...fail(0, 'daily'), error_message: 'infra: duplicate key value' },
      { ...fail(0, 'daily'), error_message: 'permanent: expired' },
      { ...fail(0, 'daily'), error_message: 'detail: recovered' },
    ])
    expect(await evaluateTransientStreak(client, ACC, 'daily')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/token.test.ts`
Expected: FAIL — `markTokenInvalid`/`evaluateTransientStreak` não exportados.

- [ ] **Step 3: Implementar (acrescentar a `src/lib/instagram/token.ts`)**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface IMarkTokenInvalidOpts {
  /** false = abre episódio transitório (nunca grava token_error). */
  fatal: boolean
  /** true = sobrescreve o motivo e re-arma o alerta (só Meta: deauthorize / data-deletion). */
  forceReason?: boolean
  mode?: 'daily' | 'token_refresh'
}

export class MarkTokenInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarkTokenInvalidError'
  }
}

export async function markTokenInvalid(
  supabase: SupabaseClient,
  account: { id: string; site_id: string },
  reason: string,
  opts: IMarkTokenInvalidOpts,
): Promise<void> {
  const pReason = redact(String(reason)).slice(0, 500)

  const { error } = await supabase.rpc('instagram_mark_token_invalid', {
    p_account: account.id,
    p_site: account.site_id,
    p_reason: pReason,
    p_fatal: opts.fatal,
    p_force_reason: opts.forceReason ?? false,
    p_mode: opts.mode ?? null,
  })

  if (!error) return

  // `error` (a RPC não existe / permissão / coluna faltando) é diferente de
  // "0 linhas casadas": aqui o episódio é FORÇADO por update direto para que a
  // conta não morra em silêncio, e o throw faz o cron contar step_errors.
  Sentry.captureException(
    new Error(`instagram_mark_token_invalid failed: ${error.message}`),
    { tags: { component: 'instagram-token', account_id: account.id } },
  )
  await supabase
    .from('instagram_accounts')
    .update({
      token_error: opts.fatal ? pReason : null,
      token_error_at: new Date().toISOString(),
      token_error_mode: opts.mode ?? null,
      token_alert_sent_at: null,
      token_alert_attempt_at: null,
      token_reprobe_at: null,
    })
    .eq('id', account.id)
    .eq('site_id', account.site_id)

  throw new MarkTokenInvalidError(error.message)
}

const STREAK_WINDOW_MS = 4 * 24 * 60 * 60 * 1000
const STREAK_DAYS_REQUIRED = 3

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * Avaliada POR MODO. Um `completed` de `daily` prova que a LEITURA funciona,
 * não que a RENOVAÇÃO funciona — deixá-lo zerar a sequência do `token_refresh`
 * reintroduz exatamente a morte silenciosa de §1.
 * Predicado semântico em TS (select largo + filtro), conforme a nota de execução.
 */
export async function evaluateTransientStreak(
  supabase: SupabaseClient,
  account: { id: string; site_id: string },
  mode: 'daily' | 'token_refresh',
): Promise<boolean> {
  const since = new Date(Date.now() - STREAK_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('instagram_sync_log')
    .select('started_at, mode, status, error_message')
    .eq('account_id', account.id)
    .in('mode', ['daily', 'token_refresh'])
    .in('status', ['completed', 'failed'])
    .gt('started_at', since)

  if (error) throw new Error(`transient streak query failed: ${error.message}`)

  const rows = (data ?? []) as Array<{
    started_at: string
    mode: string
    status: string
    error_message: string | null
  }>

  // Só linhas `failed` com prefixo `transient:` contam. As demais não contam
  // NEM zeram.
  const failures = rows.filter(
    (r) =>
      r.mode === mode &&
      r.status === 'failed' &&
      (r.error_message ?? '').startsWith('transient:'),
  )
  if (failures.length === 0) return false

  const days = new Set(failures.map((r) => utcDay(r.started_at)))
  if (days.size < STREAK_DAYS_REQUIRED) return false

  const oldestFailure = failures.reduce((a, b) => (a.started_at <= b.started_at ? a : b)).started_at
  const recovered = rows.some(
    (r) => r.mode === mode && r.status === 'completed' && r.started_at > oldestFailure,
  )
  if (recovered) return false

  await markTokenInvalid(supabase, account, 'transient', { fatal: false, mode })
  return true
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/instagram/token.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/token.ts apps/web/test/instagram/token.test.ts
git commit -m "feat(instagram): markTokenInvalid e streak transitorio avaliado por modo"
```

---

### Task 9: `defaultChannels` em `createNotification` + `fanOutToSiteAdminsDetailed`

**Files:**
- Modify: `apps/web/src/lib/notifications/schemas.ts:48` (ao lado de `channels`)
- Modify: `apps/web/src/lib/notifications/create.ts:168` (`if (!prefs) return []`)
- Modify: `apps/web/src/lib/notifications/fan-out-to-admins.ts`
- Test: `apps/web/test/youtube/fan-out-to-admins.test.ts` (estendido)

**Interfaces:**
- Consumes: `createNotification`, `getSiteAdminUserIds`.
- Produces:
  ```ts
  export const NO_SITE_ADMINS_ERROR = 'no site admins to email'
  export interface IFanOutDetailedResult { total: number; sent: number; suppressed: number; errors: string[] }
  export function fanOutToSiteAdminsDetailed(opts: {
    siteId: string; domain: NotificationDomain; type: string; priority: number
    title: string; message: string; dedupKey: string
    payload?: Record<string, unknown>; suggestedAction?: string; actionHref?: string
    groupKey?: string; defaultChannels?: DeliveryChannel[]
  }): Promise<IFanOutDetailedResult>
  // fanOutToSiteAdmins mantém Promise<number> e a semântica atual (11 call-sites)
  ```

**Por que a mudança em `createNotification` é de duas linhas:** hoje `resolveChannels` devolve `data.channels` no primeiro `if` (`:155`), **antes** de ler `notification_preferences` — então `channels:['email']` entregaria e-mail a um `org_admin` com `channel_email:false` (e sem `notification_email` consentido). Por isso esta feature usa **`defaultChannels`** (default só quando o admin nunca configurou) e **nunca `channels`**. **MUST NOT** acrescentar `'in_app'`: a linha em `notifications` é criada sempre; os canais só governam `notification_deliveries`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `apps/web/test/youtube/fan-out-to-admins.test.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { NO_SITE_ADMINS_ERROR, fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

function detailedOpts() {
  return {
    siteId: 'site-1',
    domain: 'system' as const,
    type: 'system.token_expired',
    priority: 5,
    title: 'Instagram token expired · @thiago.figueiredo',
    message: 'expired — paste a new token at https://x/cms/settings/instagram',
    dedupKey: 'system.token_expired:instagram:site-1:o:1784:2026-09-06:expired',
    actionHref: '/cms/settings/instagram',
    defaultChannels: ['email'] as const,
  }
}

describe('fanOutToSiteAdminsDetailed', () => {
  it('passa defaultChannels (NUNCA channels) para createNotification', async () => {
    mockGetAdmins.mockResolvedValue(['user-a'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-1' })

    await fanOutToSiteAdminsDetailed({ ...detailedOpts(), defaultChannels: ['email'] })
    const arg = mockCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(arg.defaultChannels).toEqual(['email'])
    expect(arg).not.toHaveProperty('channels')
    expect(arg.action_href).toBe('/cms/settings/instagram')
  })

  it('invariante: sent + suppressed + errors.length === total', async () => {
    mockGetAdmins.mockResolvedValue(['a', 'b', 'c'])
    mockCreate
      .mockResolvedValueOnce({ success: true, notificationId: 'n-1' })
      .mockResolvedValueOnce({ success: true, suppressed: true })
      .mockResolvedValueOnce({ success: false, error: 'boom' })

    const r = await fanOutToSiteAdminsDetailed(detailedOpts())
    expect(r).toEqual({ total: 3, sent: 1, suppressed: 1, errors: ['boom'] })
    expect(r.sent + r.suppressed + r.errors.length).toBe(r.total)
  })

  it('errors.length > 0 => captureMessage("partial fan-out","warning")', async () => {
    mockGetAdmins.mockResolvedValue(['a'])
    mockCreate.mockResolvedValue({ success: false, error: 'boom' })
    await fanOutToSiteAdminsDetailed(detailedOpts())
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith('partial fan-out', 'warning')
  })

  it('total === 0 é CONDIÇÃO DE ERRO: captureMessage level error, invariante preservada', async () => {
    mockGetAdmins.mockResolvedValue([])
    const r = await fanOutToSiteAdminsDetailed(detailedOpts())
    expect(r).toEqual({ total: 0, sent: 0, suppressed: 0, errors: [] })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(NO_SITE_ADMINS_ERROR, 'error')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('fanOutToSiteAdmins (a irmã antiga) continua devolvendo number e sem canais', async () => {
    mockGetAdmins.mockResolvedValue(['a', 'b'])
    mockCreate.mockResolvedValue({ success: true, notificationId: 'n-1' })
    const count = await fanOutToSiteAdmins(baseOpts())
    expect(count).toBe(2)
    const arg = mockCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(arg).not.toHaveProperty('defaultChannels')
    expect(arg).not.toHaveProperty('channels')
  })
})
```

E crie `apps/web/test/lib/notifications/default-channels.test.ts`:

```ts
// apps/web/test/lib/notifications/default-channels.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows: Record<string, unknown> = {}
const inserted: Array<Record<string, unknown>> = []
let globalPrefs: { channel_email: boolean; channel_push: boolean; channel_telegram: boolean } | null = null

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: vi.fn(() => Promise.resolve({ data: 0, error: null })),
    from: (table: string) => {
      if (table === 'notification_preferences') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({ maybeSingle: () => Promise.resolve({ data: globalPrefs }) }),
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
              }),
            }),
          }),
        }
      }
      if (table === 'notification_deliveries') {
        return { insert: (r: Array<Record<string, unknown>>) => { inserted.push(...r); return Promise.resolve({ error: null }) } }
      }
      return {
        select: () => ({
          eq: () => ({ gte: () => Promise.resolve({ count: 0, error: null }) }),
        }),
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'n-1' }, error: null }) }),
        }),
      }
    },
  }),
}))

import { createNotification } from '@/lib/notifications/create'

const BASE = {
  site_id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000002',
  type: 'system.token_expired',
  domain: 'system' as const,
  priority: 5,
  title: 'Instagram token expired',
  message: 'reconnect',
}

beforeEach(() => { inserted.length = 0; globalPrefs = null; void rows })

describe('defaultChannels', () => {
  it('SEM linha em notification_preferences: o e-mail SAI', async () => {
    const r = await createNotification({ ...BASE, defaultChannels: ['email'] })
    expect(r.success).toBe(true)
    expect(inserted.map((d) => d.channel)).toEqual(['email'])
  })

  it('COM linha global channel_email:false: o e-mail é SUPRIMIDO e a linha em notifications é escrita', async () => {
    globalPrefs = { channel_email: false, channel_push: false, channel_telegram: false }
    const r = await createNotification({ ...BASE, defaultChannels: ['email'] })
    expect(r.success).toBe(true)
    expect(r.notificationId).toBe('n-1')
    expect(inserted).toHaveLength(0)
  })

  it('sem defaultChannels e sem prefs: comportamento antigo (nenhuma entrega externa)', async () => {
    const r = await createNotification(BASE)
    expect(r.success).toBe(true)
    expect(inserted).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace=apps/web -- test/youtube/fan-out-to-admins.test.ts
npm test --workspace=apps/web -- test/lib/notifications/default-channels.test.ts
```
Expected: FAIL — `fanOutToSiteAdminsDetailed` não existe; `defaultChannels` é rejeitado pelo Zod / ignorado.

- [ ] **Step 3: Implementar as duas linhas de `create.ts` + `schemas.ts`**

Em `apps/web/src/lib/notifications/schemas.ts`, logo depois de `channels: z.array(z.enum(VALID_CHANNELS)).optional(),`:

```ts
  // C2: canais usados SÓ quando o usuário nunca configurou preferências.
  // Diferente de `channels`, que é OVERRIDE e passaria por cima de
  // notification_preferences e, transitivamente, do consentimento
  // notification_email (LGPD).
  defaultChannels: z.array(z.enum(VALID_CHANNELS)).optional(),
```

Em `apps/web/src/lib/notifications/create.ts`, troque a linha 168:

```ts
  // Sem preferência configurada: os defaults do emissor valem. Havendo linha
  // global, ela manda — inclusive quando é `[]`.
  // Limite declarado: este `return` antecede o override por domínio (:175-191),
  // então quem tem linha de DOMÍNIO com channel_email:false mas nenhuma linha
  // global recebe o e-mail assim mesmo. Estado não produzível pela UI
  // (src/lib/notifications/actions.ts:74-97 grava a global junto).
  if (!prefs) return data.defaultChannels ?? []
```

- [ ] **Step 4: Implementar `fanOutToSiteAdminsDetailed`**

Acrescente a `apps/web/src/lib/notifications/fan-out-to-admins.ts` (mantendo `fanOutToSiteAdmins` intacto):

```ts
import * as Sentry from '@sentry/nextjs'
import type { DeliveryChannel } from './types'

/** Razão que o cron põe no `error` do `status:'error'` quando `total === 0`. */
export const NO_SITE_ADMINS_ERROR = 'no site admins to email'

export interface IFanOutDetailedResult {
  total: number
  sent: number
  suppressed: number
  errors: string[]
}

/**
 * Irmã detalhada de `fanOutToSiteAdmins`. Existe porque o segundo canal
 * (e-mail) é justamente o que precisa funcionar quando o ntfy morre — e a
 * versão que devolve só `number` não distingue "0 admins" de "0 falhas".
 *
 * `total === 0` é CONDIÇÃO DE ERRO (MUST): getSiteAdminUserIds devolve [] tanto
 * quando o site não existe quanto quando o Supabase engole um erro, e a
 * invariante `0 + 0 + 0 === 0` seria satisfeita com ninguém avisado.
 */
export async function fanOutToSiteAdminsDetailed(opts: {
  siteId: string
  domain: NotificationDomain
  type: string
  priority: number
  title: string
  message: string
  dedupKey: string
  payload?: Record<string, unknown>
  suggestedAction?: string
  actionHref?: string
  groupKey?: string
  defaultChannels?: readonly DeliveryChannel[]
}): Promise<IFanOutDetailedResult> {
  const userIds = await getSiteAdminUserIds(opts.siteId)
  const total = userIds.length

  if (total === 0) {
    Sentry.captureMessage(NO_SITE_ADMINS_ERROR, 'error')
    return { total: 0, sent: 0, suppressed: 0, errors: [] }
  }

  let sent = 0
  let suppressed = 0
  const errors: string[] = []

  for (const userId of userIds) {
    const result = await createNotification({
      site_id: opts.siteId,
      user_id: userId,
      domain: opts.domain,
      type: opts.type,
      priority: opts.priority,
      title: opts.title,
      message: opts.message,
      dedup_key: opts.dedupKey,
      payload: opts.payload ?? null,
      suggested_action: opts.suggestedAction ?? null,
      action_href: opts.actionHref ?? null,
      group_key: opts.groupKey ?? null,
      ...(opts.defaultChannels ? { defaultChannels: [...opts.defaultChannels] } : {}),
    })

    if (!result.success) errors.push(result.error ?? 'unknown error')
    else if (result.suppressed) suppressed++
    else sent++
  }

  // create.ts:120 detecta supressão por match de string — dívida registrada em §8.
  if (errors.length > 0) Sentry.captureMessage('partial fan-out', 'warning')

  return { total, sent, suppressed, errors }
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test --workspace=apps/web -- test/youtube/fan-out-to-admins.test.ts
npm test --workspace=apps/web -- test/lib/notifications/default-channels.test.ts
npm test --workspace=apps/web -- test/lib/notifications
```
Expected: PASS (inclusive as suítes de notificação já existentes — `channels` ficou intocado para os 11 call-sites).

- [ ] **Step 6: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/notifications/schemas.ts apps/web/src/lib/notifications/create.ts \
        apps/web/src/lib/notifications/fan-out-to-admins.ts \
        apps/web/test/youtube/fan-out-to-admins.test.ts \
        apps/web/test/lib/notifications/default-channels.test.ts
git commit -m "feat(notifications): defaultChannels e fanOutToSiteAdminsDetailed"
```

---

### Task 10: `sweepTokenAlerts` e `deliverTokenAlert` — a única porta de saída do alerta

**Files:**
- Modify: `apps/web/src/lib/instagram/token.ts`
- Test: `apps/web/test/instagram/token.test.ts` (estendido)

**Interfaces:**
- Consumes: `sendNtfyAlert`/`isTerminalRefusal` (Tarefa 6); `fanOutToSiteAdminsDetailed` (Tarefa 9); `kindFrom`/`RECONNECT_CTA` (Tarefa 2).
- Produces:
  ```ts
  export interface ITokenAlertRow { id: string; site_id: string; handle: string; ig_user_id: string | null
    ig_user_id_source: 'oauth' | 'legacy'; token_error: string | null; token_error_at: string | null
    token_error_mode: 'daily' | 'token_refresh' | null
    token_alert_sent_at: string | null; token_alert_attempt_at: string | null }
  export interface ITokenAlertGroup { siteId: string; identityKey: string; handle: string
    slug: string | null; subject: 'feed sync' | 'auto-renewal' | 'sync'; rows: ITokenAlertRow[] }
  export type NtfyOutcome = 'sent' | 'skipped' | 'failed_transient' | 'failed_terminal'
  export interface ITokenAlertResult { siteId: string; identityKey: string; notifications: number; ntfy: NtfyOutcome }
  export function identityKeyOf(row: Pick<ITokenAlertRow,'ig_user_id_source'|'ig_user_id'|'handle'>): string
  export function loadSiteSlugs(supabase: SupabaseClient, siteIds: string[]): Promise<Map<string, string>>
  export function deliverTokenAlert(supabase, group, kind, errorDay, opts: { reminder: boolean; longOpen: boolean }): Promise<ITokenAlertResult>
  export function sweepTokenAlerts(supabase, filter?: { siteId?: string; identityKey?: string }): Promise<ITokenAlertResult[]>
  ```

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `apps/web/test/instagram/token.test.ts`:

```ts
import { deliverTokenAlert, identityKeyOf, sweepTokenAlerts } from '@/lib/instagram/token'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'

vi.mock('@/lib/ops/ntfy', async (orig) => ({
  ...(await orig<typeof import('@/lib/ops/ntfy')>()),
  sendNtfyAlert: vi.fn(),
}))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  NO_SITE_ADMINS_ERROR: 'no site admins to email',
  fanOutToSiteAdminsDetailed: vi.fn(),
}))

const mockNtfy = vi.mocked(sendNtfyAlert)
const mockFanOut = vi.mocked(fanOutToSiteAdminsDetailed)
const HOUR = 3_600_000

function alertRow(over: Partial<ITokenAlertRow> = {}): ITokenAlertRow {
  return {
    id: 'r-pt', site_id: 'site-1', handle: 'thiago.figueiredo',
    ig_user_id: '17841400000000000', ig_user_id_source: 'oauth',
    token_error: 'expired',
    token_error_at: new Date(Date.now() - 2 * HOUR).toISOString(),
    token_error_mode: null, token_alert_sent_at: null, token_alert_attempt_at: null,
    ...over,
  }
}

/** Supabase mock que serve o select largo de contas + slugs + os updates de marca-passo. */
function sweepClient(rows: ITokenAlertRow[]) {
  const updates: Array<Record<string, unknown>> = []
  const notEq = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  const accountsSelect = vi.fn(() => ({
    not: vi.fn(() => ({ eq: notEq, then: undefined })),
  }))
  const client = {
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
    from: vi.fn((table: string) => {
      if (table === 'sites') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 'site-1', slug: 'bythiagofigueiredo' }], error: null }) }) }
      }
      return {
        select: vi.fn(() => ({ not: vi.fn(() => Promise.resolve({ data: rows, error: null })) })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updates.push(patch)
          return { in: vi.fn(() => Promise.resolve({ error: null })) }
        }),
      }
    }),
  } as unknown as SupabaseClient
  void accountsSelect
  return { client, updates }
}

beforeEach(() => {
  mockNtfy.mockReset()
  mockFanOut.mockReset()
  mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  mockNtfy.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://bythiagofigueiredo.com')
})

describe('identityKeyOf', () => {
  it('oauth com ig_user_id => "o:<id>"', () => {
    expect(identityKeyOf({ ig_user_id_source: 'oauth', ig_user_id: '12345', handle: 'X' })).toBe('o:12345')
  })
  it('legacy => "h:<handle minúsculo>"', () => {
    expect(identityKeyOf({ ig_user_id_source: 'legacy', ig_user_id: '12345', handle: 'Foo.Bar' })).toBe('h:foo.bar')
  })
  it('handle "12345" e id "12345" produzem chaves DIFERENTES', () => {
    expect(identityKeyOf({ ig_user_id_source: 'legacy', ig_user_id: null, handle: '12345' }))
      .not.toBe(identityKeyOf({ ig_user_id_source: 'oauth', ig_user_id: '12345', handle: 'x' }))
  })
})

describe('deliverTokenAlert — REGRA-PII-NTFY e forma do payload', () => {
  const group = {
    siteId: 'site-1', identityKey: 'o:17841400000000000', handle: 'thiago.figueiredo',
    slug: 'bythiagofigueiredo', subject: 'auto-renewal' as const,
    rows: [alertRow(), alertRow({ id: 'r-en' })],
  }

  it('o título entregue a CMS/e-mail mantém "· @handle"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const arg = mockFanOut.mock.calls[0]![0]
    expect(arg.title).toBe('Instagram token expired · @thiago.figueiredo')
  })

  it('o push usa ntfyTitle com o SLUG e nunca "@"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const push = mockNtfy.mock.calls[0]![0]
    expect(push.title).toBe('Instagram token expired · bythiagofigueiredo')
    expect(push.title).not.toContain('@')
  })

  it('body é fixo: "<N> account(s) · open since <dia>. Open the CMS for the reason."', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockNtfy.mock.calls[0]![0].body)
      .toBe('2 account(s) · open since 2026-09-04. Open the CMS for the reason.')
  })

  it('nem title nem body do push carregam handle, ids ou token_error', async () => {
    const { client } = sweepClient([])
    const dirty = { ...group, rows: [alertRow({
      token_error: 'The session has been invalidated because the user changed their password' })] }
    await deliverTokenAlert(client, dirty, 'invalid', '2026-09-04', { reminder: false, longOpen: false })
    const { title, body } = mockNtfy.mock.calls[0]![0]
    expect(`${title} ${body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${title} ${body}`).not.toMatch(/[0-9]{6,}/)
    expect(`${title} ${body}`).not.toContain('invalidated')
  })

  it('priority default (nunca high) com tag rotating_light e Click', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const push = mockNtfy.mock.calls[0]![0]
    expect(push.priority).toBe('default')
    expect(push.tags).toEqual(['rotating_light'])
    expect(push.click).toBe('https://bythiagofigueiredo.com/cms/settings/instagram')
  })

  it('message termina em "— <RECONNECT_CTA> at <APP_URL>/cms/settings/instagram"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].message)
      .toMatch(/— paste a new token at https:\/\/bythiagofigueiredo\.com\/cms\/settings\/instagram$/)
  })

  it('message escapa & < > " \' (adapters/email.ts:30 interpola cru)', async () => {
    const { client } = sweepClient([])
    const xss = { ...group, rows: [alertRow({ token_error: '<img src=x onerror=1>' })] }
    await deliverTokenAlert(client, xss, 'invalid', '2026-09-04', { reminder: false, longOpen: false })
    const msg = mockFanOut.mock.calls[0]![0].message
    expect(msg).toContain('&lt;img src=x onerror=1&gt;')
    expect(msg).not.toContain('<img')
  })

  it('sempre defaultChannels:["email"], nunca channels', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    const arg = mockFanOut.mock.calls[0]![0] as Record<string, unknown>
    expect(arg.defaultChannels).toEqual(['email'])
    expect(arg).not.toHaveProperty('channels')
  })

  it('nunca lança, mesmo com o ntfy explodindo', async () => {
    mockNtfy.mockRejectedValue(new Error('boom'))
    const { client } = sweepClient([])
    await expect(deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false }))
      .resolves.toBeTruthy()
  })
})

describe('deliverTokenAlert — títulos por kind e precedência longOpen > reminder > primeiro', () => {
  const g = (subject: 'feed sync' | 'auto-renewal' | 'sync') => ({
    siteId: 'site-1', identityKey: 'o:1', handle: 'h', slug: 's', subject, rows: [alertRow()],
  })
  it.each([
    ['transient', { reminder: false, longOpen: false }, 'Instagram auto-renewal failing · @h'],
    ['transient', { reminder: true, longOpen: false }, 'Instagram auto-renewal still retrying · @h'],
    ['transient', { reminder: false, longOpen: true }, 'Instagram auto-renewal still failing · @h'],
    ['transient', { reminder: true, longOpen: true }, 'Instagram auto-renewal still failing · @h'],
    ['expired', { reminder: false, longOpen: false }, 'Instagram token expired · @h'],
    ['revoked', { reminder: false, longOpen: false }, 'Instagram access revoked · @h'],
    ['invalid', { reminder: false, longOpen: false }, 'Instagram token invalid · @h'],
    ['expired', { reminder: true, longOpen: false }, 'Instagram still disconnected · @h'],
    ['revoked', { reminder: true, longOpen: false }, 'Instagram still disconnected · @h'],
    ['invalid', { reminder: true, longOpen: false }, 'Instagram still disconnected · @h'],
  ])('%s %o => %s', async (kind, opts, expected) => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, g('auto-renewal'), kind as never, '2026-09-04', opts as never)
    expect(mockFanOut.mock.calls[0]![0].title).toBe(expected)
  })

  it('subject "feed sync" quando o modo é daily', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, g('feed sync'), 'transient', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].title).toBe('Instagram feed sync failing · @h')
  })

  it('subject "sync" em grupo misto', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, g('sync'), 'transient', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].title).toBe('Instagram sync failing · @h')
  })
})

describe('deliverTokenAlert — desfecho do ntfy e marca-passo', () => {
  const group = {
    siteId: 'site-1', identityKey: 'o:1', handle: 'h', slug: 's', subject: 'auto-renewal' as const,
    rows: [alertRow()],
  }

  it('aceito => ntfy "sent" e sent_at gravado', async () => {
    const { client, updates } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('sent')
    expect(updates.some((u) => 'token_alert_attempt_at' in u)).toBe(true)
    expect(updates.some((u) => 'token_alert_sent_at' in u)).toBe(true)
  })

  it('429 => failed_transient e sent_at NÃO gravado (attempt_at sim)', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 429 })
    const { client, updates } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('failed_transient')
    expect(updates.some((u) => 'token_alert_sent_at' in u)).toBe(false)
    expect(updates.some((u) => 'token_alert_attempt_at' in u)).toBe(true)
  })

  it('403 => failed_terminal e e-mail de fallback "Instagram alert channel down"', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 403 })
    const { client } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('failed_terminal')
    expect(mockFanOut).toHaveBeenCalledTimes(2)
    expect(mockFanOut.mock.calls[1]![0]).toMatchObject({
      type: 'system.cron_failure',
      title: 'Instagram alert channel down',
      defaultChannels: ['email'],
    })
    expect(String(mockFanOut.mock.calls[1]![0].dedupKey)).toMatch(/^instagram-alert-channel-down:\d{4}-\d{2}-\d{2}$/)
  })

  it('NTFY_URL ausente => "skipped" (o e-mail sai assim mesmo)', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, reason: 'NTFY_URL unset' })
    const { client } = sweepClient([])
    const r = await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(r.ntfy).toBe('skipped')
    expect(mockFanOut).toHaveBeenCalledTimes(1)
  })
})

describe('sweepTokenAlerts — agrupamento, cadência e teto', () => {
  it('3 linhas pt/en/all da mesma identidade => 1 push, 1 fan-out, attempt_at nas 3', async () => {
    const rows = [alertRow({ id: 'pt' }), alertRow({ id: 'en' }), alertRow({ id: 'all' })]
    const { client, updates } = sweepClient(rows)
    const out = await sweepTokenAlerts(client)
    expect(out).toHaveLength(1)
    expect(mockNtfy).toHaveBeenCalledTimes(1)
    expect(mockFanOut).toHaveBeenCalledTimes(1)
    expect(updates.filter((u) => 'token_alert_attempt_at' in u)).toHaveLength(1) // um update .in([3 ids])
  })

  it('mesma conta em oauth X e legacy X => 2 grupos', async () => {
    const rows = [
      alertRow({ id: 'a', ig_user_id_source: 'oauth', ig_user_id: '999' }),
      alertRow({ id: 'b', ig_user_id_source: 'legacy', ig_user_id: '999' }),
    ]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(2)
  })

  it('attempt_at de 11:00 com sent_at null => cadência 1 h, entrega às 13:00', async () => {
    const rows = [alertRow({
      token_alert_attempt_at: new Date(Date.now() - 2 * HOUR).toISOString(),
      token_alert_sent_at: null,
    })]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(1)
  })

  it('sent_at presente e episódio de 2 dias => cadência 23 h (1×/dia)', async () => {
    const rows = [alertRow({
      token_error_at: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
      token_alert_sent_at: new Date(Date.now() - 2 * HOUR).toISOString(),
      token_alert_attempt_at: new Date(Date.now() - 2 * HOUR).toISOString(),
    })]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(0)
  })

  it('episódio de 15 dias => cadência semanal (6 d 23 h): 2 dias depois NÃO entrega', async () => {
    const rows = [alertRow({
      token_error_at: new Date(Date.now() - 15 * 24 * HOUR).toISOString(),
      token_alert_sent_at: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
      token_alert_attempt_at: new Date(Date.now() - 2 * 24 * HOUR).toISOString(),
    })]
    const { client } = sweepClient(rows)
    expect(await sweepTokenAlerts(client)).toHaveLength(0)
  })

  it('teto verificado no FIM do grupo e relativo a sweepStart, nunca a runStart', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    // grupo iniciado aos 14 s: 14_000 + 12_000 > 25_000 => NÃO inicia
    const rows = [alertRow({ id: 'a', ig_user_id: '1' }), alertRow({ id: 'b', ig_user_id: '2' })]
    mockFanOut.mockImplementation(async () => {
      vi.advanceTimersByTime(14_000)
      return { total: 1, sent: 1, suppressed: 0, errors: [] }
    })
    const { client } = sweepClient(rows)
    const out = await sweepTokenAlerts(client)
    expect(out).toHaveLength(1) // o segundo grupo não inicia
    vi.useRealTimers()
  })

  it('filtro por identityKey só processa aquele grupo', async () => {
    const rows = [
      alertRow({ id: 'a', ig_user_id: '111' }),
      alertRow({ id: 'b', ig_user_id: '222' }),
    ]
    const { client } = sweepClient(rows)
    const out = await sweepTokenAlerts(client, { identityKey: 'o:222' })
    expect(out).toHaveLength(1)
    expect(out[0]!.identityKey).toBe('o:222')
  })

  it('longOpen: transitório aberto há 70 h => título "still failing"', async () => {
    const rows = [alertRow({
      token_error: null,
      token_error_at: new Date(Date.now() - 70 * HOUR).toISOString(),
      token_error_mode: 'token_refresh',
    })]
    const { client } = sweepClient(rows)
    await sweepTokenAlerts(client)
    expect(mockFanOut.mock.calls[0]![0].title).toContain('still failing')
  })
})

describe('dedupKey — aritmética das 6 varreduras (§3.2)', () => {
  it('ntfy nunca aceito em 6 varreduras (3 dias UTC) => 6 pushes, 4 chaves distintas', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 429 })
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })

    const state = alertRow({ token_error_at: '2026-09-06T10:00:00Z' })
    const keys: string[] = []
    mockFanOut.mockImplementation(async (o) => {
      keys.push(o.dedupKey)
      return { total: 1, sent: 1, suppressed: 0, errors: [] }
    })

    for (const [dayOffset, hour] of [[0, 11], [0, 13], [1, 11], [1, 13], [2, 11], [2, 13]] as const) {
      vi.setSystemTime(new Date(Date.UTC(2026, 8, 6 + dayOffset, hour, 0, 0)))
      const { client } = sweepClient([{ ...state }])
      await sweepTokenAlerts(client)
      // depois da 1ª entrega o attempt_at existe e o sent_at continua nulo
      state.token_alert_attempt_at = new Date().toISOString()
    }

    expect(mockNtfy).toHaveBeenCalledTimes(6)
    expect(new Set(keys).size).toBe(4)
    const base = keys[0]!
    expect(base).not.toMatch(/:d\d{4}-\d{2}-\d{2}$/)
    expect(keys[1]).toBe(`${base}:d2026-09-06`)
    expect(keys[2]).toBe(`${base}:d2026-09-07`)
    expect(keys[4]).toBe(`${base}:d2026-09-08`)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/token.test.ts`
Expected: FAIL — `sweepTokenAlerts`/`deliverTokenAlert`/`identityKeyOf` não exportados.

- [ ] **Step 3: Implementar (acrescentar a `src/lib/instagram/token.ts`)**

```ts
import { isTerminalRefusal, sendNtfyAlert } from '@/lib/ops/ntfy'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import { RECONNECT_CTA, kindFrom, type TokenKind } from './status-text'

export type TokenAlertKind = TokenKind

export interface ITokenAlertRow {
  id: string
  site_id: string
  handle: string
  ig_user_id: string | null
  ig_user_id_source: 'oauth' | 'legacy'
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_alert_sent_at: string | null
  token_alert_attempt_at: string | null
}

export interface ITokenAlertGroup {
  siteId: string
  identityKey: string
  handle: string
  slug: string | null
  subject: 'feed sync' | 'auto-renewal' | 'sync'
  rows: ITokenAlertRow[]
}

export type NtfyOutcome = 'sent' | 'skipped' | 'failed_transient' | 'failed_terminal'

export interface ITokenAlertResult {
  siteId: string
  identityKey: string
  notifications: number
  ntfy: NtfyOutcome
}

const HOUR_MS = 3_600_000
const SWEEP_BUDGET_MS = 25_000
/** Medido no gate pós-C2 (§7). Se o p99 real passar disto, sobe aqui. */
const WORST_GROUP_MS = 12_000
const SEVERITY: Record<TokenAlertKind, number> = { transient: 0, expired: 1, invalid: 2, revoked: 3 }
const LONG_OPEN_MS = 69 * HOUR_MS

const TOKEN_ALERT_COLUMNS =
  'id, site_id, handle, ig_user_id, ig_user_id_source, token_error, token_error_at, token_error_mode, token_alert_sent_at, token_alert_attempt_at'

export function identityKeyOf(
  row: Pick<ITokenAlertRow, 'ig_user_id_source' | 'ig_user_id' | 'handle'>,
): string {
  return row.ig_user_id_source === 'oauth' && row.ig_user_id
    ? `o:${row.ig_user_id}`
    : `h:${row.handle.toLowerCase()}`
}

/** Resolvido 1× por run e compartilhado com o `expiring_clean` do cron (§3.3). */
export async function loadSiteSlugs(
  supabase: SupabaseClient,
  siteIds: string[],
): Promise<Map<string, string>> {
  if (siteIds.length === 0) return new Map()
  const { data } = await supabase.from('sites').select('id, slug').in('id', siteIds)
  return new Map(
    ((data ?? []) as Array<{ id: string; slug: string }>).map((s) => [s.id, s.slug]),
  )
}

function cadenceMs(row: ITokenAlertRow, now: number): number {
  if (row.token_alert_attempt_at != null && row.token_alert_sent_at == null) return HOUR_MS
  if (
    row.token_alert_sent_at != null &&
    row.token_error_at != null &&
    Date.parse(row.token_error_at) > now - 14 * 24 * HOUR_MS
  ) {
    return 23 * HOUR_MS
  }
  return (6 * 24 + 23) * HOUR_MS
}

function subjectFor(rows: ITokenAlertRow[]): 'feed sync' | 'auto-renewal' | 'sync' {
  // token_error_mode nulo = episódio fatal, cujo sujeito natural é a renovação.
  const modes = new Set(rows.map((r) => r.token_error_mode ?? 'token_refresh'))
  if (modes.size > 1) return 'sync'
  return modes.has('daily') ? 'feed sync' : 'auto-renewal'
}

function titleBase(
  kind: TokenAlertKind,
  subject: string,
  opts: { reminder: boolean; longOpen: boolean },
): string {
  if (kind === 'transient') {
    if (opts.longOpen) return `Instagram ${subject} still failing`
    if (opts.reminder) return `Instagram ${subject} still retrying`
    return `Instagram ${subject} failing`
  }
  if (opts.reminder) return 'Instagram still disconnected'
  if (kind === 'expired') return 'Instagram token expired'
  if (kind === 'revoked') return 'Instagram access revoked'
  return 'Instagram token invalid'
}

function escapeForEmail(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const week =
    1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${t.getUTCFullYear()}-${String(week).padStart(2, '0')}`
}

export async function deliverTokenAlert(
  supabase: SupabaseClient,
  group: ITokenAlertGroup,
  kind: TokenAlertKind,
  errorDay: string,
  opts: { reminder: boolean; longOpen: boolean },
): Promise<ITokenAlertResult> {
  // Nunca lança: é a última perna antes do dono, e um throw aqui derrubaria a
  // varredura inteira do run.
  try {
    const now = new Date()
    const nowIso = now.toISOString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
    const settingsUrl = `${appUrl}/cms/settings/instagram`

    const base = titleBase(kind, group.subject, opts)
    // CMS + e-mail são superfícies AUTENTICADAS: o handle fica.
    const title = `${base} · @${group.handle.toLowerCase()}`
    // ntfy é tópico compartilhado e não autenticado: só o slug do site.
    const ntfyTitle = group.slug ? `${base} · ${group.slug}` : base
    // body FIXO — MUST NOT conter token_error, reason, tokens, ids.
    const body = `${group.rows.length} account(s) · open since ${errorDay}. Open the CMS for the reason.`

    const rawReason =
      group.rows.find((r) => r.token_error != null)?.token_error ??
      `${group.subject} keeps failing`
    const message = `${escapeForEmail(rawReason)} — ${RECONNECT_CTA} at ${settingsUrl}`

    // dedupKey: base na PRIMEIRA entrega do episódio; sufixo pela CADÊNCIA,
    // nunca por sent_at (senão um ntfy nunca aceito congelaria a chave e o
    // índice UNIQUE parcial suprimiria CMS/e-mail a partir da segunda).
    const nowMs = now.getTime()
    const groupCadence = Math.min(...group.rows.map((r) => cadenceMs(r, nowMs)))
    const firstOfEpisode = group.rows.every((r) => r.token_alert_attempt_at == null)
    const baseKey = `system.token_expired:instagram:${group.siteId}:${group.identityKey}:${errorDay}:${kind}`
    const dedupKey = firstOfEpisode
      ? baseKey
      : groupCadence <= 23 * HOUR_MS
        ? `${baseKey}:d${nowIso.slice(0, 10)}`
        : `${baseKey}:w${isoWeekKey(now)}`

    // (a) CMS + e-mail. O `title` EN explícito vence o title_template PT do registry.
    const fan = await fanOutToSiteAdminsDetailed({
      siteId: group.siteId,
      domain: 'system',
      type: 'system.token_expired',
      priority: 5,
      title,
      message,
      dedupKey,
      actionHref: '/cms/settings/instagram',
      defaultChannels: ['email'],
    })

    // (b) ntfy — `default`, nunca `high`: `high` fura o Não Perturbe e fica
    // reservado a canal caído / segundo cron.
    const ntfyRes = await sendNtfyAlert({
      title: ntfyTitle,
      body,
      priority: 'default',
      tags: ['rotating_light'],
      click: settingsUrl,
    })

    const ntfy: NtfyOutcome = ntfyRes.alerted
      ? 'sent'
      : ntfyRes.reason === 'NTFY_URL unset'
        ? 'skipped'
        : isTerminalRefusal(ntfyRes)
          ? 'failed_terminal'
          : 'failed_transient'

    if (ntfy === 'failed_terminal') {
      await fanOutToSiteAdminsDetailed({
        siteId: group.siteId,
        domain: 'system',
        type: 'system.cron_failure',
        priority: 5,
        title: 'Instagram alert channel down',
        message: `ntfy rejected (HTTP ${ntfyRes.ntfyStatus ?? 'unknown'})`,
        dedupKey: `instagram-alert-channel-down:${nowIso.slice(0, 10)}`,
        defaultChannels: ['email'],
      })
    }
    if (ntfy === 'failed_terminal' || ntfy === 'failed_transient') {
      Sentry.captureMessage('instagram token alert: ntfy not accepted', 'error')
    }

    // (c) marcas-passo: attempt_at em TODAS as linhas; sent_at nas que ainda
    // estão nulas, e só quando a entrega foi aceita.
    const ids = group.rows.map((r) => r.id)
    await supabase
      .from('instagram_accounts')
      .update({ token_alert_attempt_at: nowIso })
      .in('id', ids)

    if (ntfyRes.alerted) {
      const unsent = group.rows.filter((r) => r.token_alert_sent_at == null).map((r) => r.id)
      if (unsent.length > 0) {
        await supabase
          .from('instagram_accounts')
          .update({ token_alert_sent_at: nowIso })
          .in('id', unsent)
      }
    }

    return {
      siteId: group.siteId,
      identityKey: group.identityKey,
      notifications: fan.sent,
      ntfy,
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-token-alert' } })
    return {
      siteId: group.siteId,
      identityKey: group.identityKey,
      notifications: 0,
      ntfy: 'failed_transient',
    }
  }
}

/** ÚNICA porta de saída do alerta de token. */
export async function sweepTokenAlerts(
  supabase: SupabaseClient,
  filter?: { siteId?: string; identityKey?: string },
): Promise<ITokenAlertResult[]> {
  // MUST: `sweepStart` na PRIMEIRA linha. Medido a partir do runStart do cron,
  // `elapsed + 12_000 > 25_000` valeria para todo grupo, nada iniciaria,
  // attempt_at ficaria nulo e um token morreria sem ninguém ser avisado.
  const sweepStart = Date.now()

  const base = supabase
    .from('instagram_accounts')
    .select(TOKEN_ALERT_COLUMNS)
    .not('token_error_at', 'is', null)
  const { data, error } = await (filter?.siteId ? base.eq('site_id', filter.siteId) : base)
  if (error) throw new Error(`sweep select failed: ${error.message}`)

  const rows = (data ?? []) as ITokenAlertRow[]

  const buckets = new Map<string, ITokenAlertRow[]>()
  for (const row of rows) {
    const identityKey = identityKeyOf(row)
    if (filter?.identityKey && identityKey !== filter.identityKey) continue
    const key = `${row.site_id}|${identityKey}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  const slugs = await loadSiteSlugs(
    supabase,
    [...new Set([...buckets.values()].map((g) => g[0]!.site_id))],
  )

  const results: ITokenAlertResult[] = []

  for (const groupRows of buckets.values()) {
    // Teto verificado ANTES de iniciar cada grupo, com `elapsed` relativo a
    // sweepStart. Grupos não iniciados ficam com attempt_at intocado => a
    // cadência permanece 1 h e eles saem na varredura seguinte.
    if (Date.now() - sweepStart + WORST_GROUP_MS > SWEEP_BUDGET_MS) break

    const now = Date.now()
    const due = groupRows.some(
      (r) =>
        r.token_alert_attempt_at == null ||
        Date.parse(r.token_alert_attempt_at) < now - cadenceMs(r, now),
    )
    if (!due) continue

    const first = groupRows[0]!
    const kind = groupRows
      .map((r) => kindFrom(r))
      .reduce((a, b) => (SEVERITY[a] >= SEVERITY[b] ? a : b))
    const errorDayMs = Math.min(
      ...groupRows.map((r) => (r.token_error_at ? Date.parse(r.token_error_at) : now)),
    )
    const errorDay = new Date(errorDayMs).toISOString().slice(0, 10)

    const group: ITokenAlertGroup = {
      siteId: first.site_id,
      identityKey: identityKeyOf(first),
      handle: first.handle,
      slug: slugs.get(first.site_id) ?? null,
      subject: subjectFor(groupRows),
      rows: groupRows,
    }

    results.push(
      await deliverTokenAlert(supabase, group, kind, errorDay, {
        reminder: groupRows.some((r) => r.token_alert_sent_at != null),
        longOpen: kind === 'transient' && errorDayMs < now - LONG_OPEN_MS,
      }),
    )
  }

  return results
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/instagram/token.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/token.ts apps/web/test/instagram/token.test.ts
git commit -m "feat(instagram): varredura e entrega do alerta de token (ntfy + CMS + email)"
```

---

### Task 11: `deletion.ts` — retomada idempotente de um pedido travado (§3.3 passo 3)

**Files:**
- Create: `apps/web/src/lib/instagram/deletion.ts`
- Test: `apps/web/test/instagram/deletion.test.ts`

**Interfaces:**
- Consumes: tabela `instagram_deletion_requests` (C1); `@vercel/blob` `list`/`del`.
- Produces:
  ```ts
  export const DELETION_BLOB_BUDGET_MS: number     // 45_000
  export function runDeletionEffects(
    supabase: SupabaseClient,
    request: { id: string; ig_user_id: string },
    deadlineAt: number,
  ): Promise<void>                                 // efeitos (d)–(h) de §3.1 passo 7, idempotentes
  export function resumeStuckDeletionRequest(
    supabase: SupabaseClient,
    deadlineAt: number,
  ): Promise<boolean>                              // UM pedido por run; false = nenhum pendente
  ```

**Ambiguidade resolvida:** §3.3 passo 3 exige (MUST) que o cron das 11:00 retome um pedido de deleção com `completed_at is null` há mais de 10 min, executando os efeitos (d)–(h) de §3.1 passo 7 — mas a rota `POST /api/instagram/data-deletion` só nasce em C3. Extrair (d)–(h) para `deletion.ts` **em C2** satisfaz o MUST do cron sem duplicação: C3 importa a mesma função na rota. Enquanto C3 não estiver na árvore a tabela fica vazia e a retomada é um `select` que devolve 0 linhas.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/test/instagram/deletion.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
const listMock = vi.fn()
const delMock = vi.fn()
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a), del: (...a: unknown[]) => delMock(...a) }))

import { revalidateTag } from 'next/cache'
import { resumeStuckDeletionRequest, runDeletionEffects } from '@/lib/instagram/deletion'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ICall { table: string; op: string; arg?: unknown }

function client(opts: {
  pending?: Array<{ id: string; ig_user_id: string }>
  accounts?: Array<{ id: string; site_id: string }>
}) {
  const calls: ICall[] = []
  const accounts = opts.accounts ?? [{ id: 'acc-1', site_id: 'site-1' }]
  const from = vi.fn((table: string) => {
    if (table === 'instagram_deletion_requests') {
      return {
        select: () => ({
          is: () => ({
            lt: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: opts.pending ?? [], error: null }) }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          calls.push({ table, op: 'update', arg: patch })
          return { eq: () => Promise.resolve({ error: null }) }
        },
      }
    }
    if (table === 'instagram_accounts') {
      return {
        select: () => ({ or: () => ({ eq: () => Promise.resolve({ data: accounts, error: null }) }) }),
        update: (patch: Record<string, unknown>) => {
          calls.push({ table, op: 'update', arg: patch })
          return { in: () => Promise.resolve({ error: null }) }
        },
      }
    }
    return {
      delete: () => {
        calls.push({ table, op: 'delete' })
        return { in: () => Promise.resolve({ error: null }), eq: () => Promise.resolve({ error: null }) }
      },
      insert: (row: Record<string, unknown>) => {
        calls.push({ table, op: 'insert', arg: row })
        return Promise.resolve({ error: null })
      },
    }
  })
  return { client: { from } as unknown as SupabaseClient, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined })
  delMock.mockResolvedValue(undefined)
})

describe('runDeletionEffects', () => {
  it('apaga slots, posts, blobs e sync_log; anonimiza; invalida o cache; completed_at por ÚLTIMO', async () => {
    listMock.mockResolvedValueOnce({ blobs: [{ url: 'https://b/1.jpg' }], hasMore: true, cursor: 'c1' })
    listMock.mockResolvedValueOnce({ blobs: [{ url: 'https://b/2.jpg' }], hasMore: false, cursor: undefined })
    const { client: c, calls } = client({})

    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)

    const order = calls.map((x) => `${x.table}:${x.op}`)
    expect(order).toContain('instagram_feed_slots:delete')
    expect(order).toContain('instagram_posts:delete')
    expect(order).toContain('instagram_sync_log:delete')
    expect(order).toContain('instagram_sync_log:insert')
    // del recebe URLs, NUNCA prefixo
    expect(delMock).toHaveBeenCalledWith(['https://b/1.jpg'])
    expect(delMock).toHaveBeenCalledWith(['https://b/2.jpg'])
    // anonimização
    expect(calls.find((x) => x.table === 'instagram_accounts' && x.op === 'update')!.arg)
      .toEqual({ ig_user_id: null, ig_professional_id: null, ig_user_id_source: 'legacy' })
    // completed_at é a última escrita
    expect(order[order.length - 1]).toBe('instagram_deletion_requests:update')
    expect(revalidateTag).toHaveBeenCalledWith('instagram-feed', { expire: 0 })
  })

  it('a linha de trilha é mode=data_deletion / completed', async () => {
    const { client: c, calls } = client({})
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)
    const row = calls.find((x) => x.table === 'instagram_sync_log' && x.op === 'insert')!
      .arg as Record<string, unknown>
    expect(row.mode).toBe('data_deletion')
    expect(row.status).toBe('completed')
  })

  it('laço de blobs cortado pelo deadline => completed_at continua NULL', async () => {
    listMock.mockResolvedValue({ blobs: [{ url: 'https://b/x.jpg' }], hasMore: true, cursor: 'c' })
    const { client: c, calls } = client({})
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() - 1)
    expect(calls.some((x) => x.table === 'instagram_deletion_requests' && x.op === 'update')).toBe(false)
  })

  it('sem contas casadas ainda conclui (idempotente: já foi anonimizado num run anterior)', async () => {
    const { client: c, calls } = client({ accounts: [] })
    await runDeletionEffects(c, { id: 'req-1', ig_user_id: '17841' }, Date.now() + 60_000)
    expect(calls.some((x) => x.table === 'instagram_deletion_requests' && x.op === 'update')).toBe(true)
    expect(delMock).not.toHaveBeenCalled()
  })
})

describe('resumeStuckDeletionRequest', () => {
  it('nenhum pedido pendente => false, nenhum efeito', async () => {
    const { client: c, calls } = client({ pending: [] })
    expect(await resumeStuckDeletionRequest(c, Date.now() + 60_000)).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('UM pedido por run (o 2º pendente fica para o run seguinte)', async () => {
    const { client: c } = client({ pending: [{ id: 'req-1', ig_user_id: '1' }] })
    expect(await resumeStuckDeletionRequest(c, Date.now() + 60_000)).toBe(true)
    expect(delMock.mock.calls.length + 1).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/instagram/deletion.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/instagram/deletion"`.

- [ ] **Step 3: Implementar**

```ts
// apps/web/src/lib/instagram/deletion.ts
//
// Efeitos (d)–(h) de §3.1 passo 7, extraídos para que o cron das 11:00 possa
// RETOMAR um pedido cuja rota morreu (§3.3 passo 3) e para que a rota
// POST /api/instagram/data-deletion (C3) use exatamente o mesmo código.
// TODA etapa é idempotente: um `del` de blob já apagado é no-op, os `delete`
// são por account_id e a anonimização escreve valores fixos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { del, list } from '@vercel/blob'
import { revalidateTag } from 'next/cache'

export const DELETION_BLOB_BUDGET_MS = 45_000

export async function runDeletionEffects(
  supabase: SupabaseClient,
  request: { id: string; ig_user_id: string },
  deadlineAt: number,
): Promise<void> {
  // Alcance (MUST): (ig_user_id = X OU ig_professional_id = X) E source = 'oauth'.
  // Linhas `legacy` NUNCA casam — o id delas veio do /me de outro app.
  // A string de filtro é segura: o chamador já validou ^[0-9]{1,32}$.
  const { data: accountsData } = await supabase
    .from('instagram_accounts')
    .select('id, site_id')
    .or(`ig_user_id.eq.${request.ig_user_id},ig_professional_id.eq.${request.ig_user_id}`)
    .eq('ig_user_id_source', 'oauth')

  const accounts = (accountsData ?? []) as Array<{ id: string; site_id: string }>
  const ids = accounts.map((a) => a.id)

  if (ids.length > 0) {
    // (d) slots, posts e blobs
    await supabase.from('instagram_feed_slots').delete().in('account_id', ids)
    await supabase.from('instagram_posts').delete().in('account_id', ids)

    for (const account of accounts) {
      let cursor: string | undefined
      for (;;) {
        if (Date.now() >= deadlineAt) {
          // Corte controlado: `completed_at` fica NULL de propósito e o run
          // seguinte (replay da Meta ou o cron das 11:00) retoma daqui.
          return
        }
        const page = await list({ prefix: `instagram/${account.id}/`, cursor, limit: 1000 })
        if (page.blobs.length > 0) await del(page.blobs.map((b) => b.url))
        if (!page.hasMore) break
        cursor = page.cursor
      }
    }

    // (e) anonimizar a identidade (o handle fica — é configuração do site)
    await supabase
      .from('instagram_accounts')
      .update({ ig_user_id: null, ig_professional_id: null, ig_user_id_source: 'legacy' })
      .in('id', ids)

    // (f) trilha
    await supabase.from('instagram_sync_log').delete().in('account_id', ids)
    for (const account of accounts) {
      await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: 'data_deletion',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }
  }

  // (g) invalidação real do feed público (unstable_cache tag)
  revalidateTag('instagram-feed', { expire: 0 })

  // (h) ÚLTIMA escrita — `completed_at` é O sinal de "terminou". Nenhum caminho
  // o escreve antes, e nenhum responde afirmando conclusão enquanto for null.
  await supabase
    .from('instagram_deletion_requests')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', request.id)
}

/**
 * UM pedido por run — para não transformar a limpeza numa etapa sem teto.
 * Sem isto, um pedido cuja rota morreu depende inteiramente de a Meta
 * re-tentar, e a obrigação legal fica pendurada num evento que não controlamos.
 */
export async function resumeStuckDeletionRequest(
  supabase: SupabaseClient,
  deadlineAt: number,
): Promise<boolean> {
  const { data } = await supabase
    .from('instagram_deletion_requests')
    .select('id, ig_user_id')
    .is('completed_at', null)
    .lt('requested_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('requested_at', { ascending: true })
    .limit(1)

  const pending = (data ?? []) as Array<{ id: string; ig_user_id: string }>
  const first = pending[0]
  if (!first) return false

  await runDeletionEffects(supabase, first, deadlineAt)
  return true
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/instagram/deletion.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/instagram/deletion.ts apps/web/test/instagram/deletion.test.ts
git commit -m "feat(instagram): efeitos de data-deletion retomaveis e idempotentes"
```

---

### Task 12: Cron de renovação (`api/cron/instagram-token-refresh`)

**Files:**
- Modify: `apps/web/src/app/api/cron/instagram-token-refresh/route.ts` (arquivo inteiro)
- Test: `apps/web/test/api/cron/instagram-token-refresh.test.ts` (reescrito)
- Test: `apps/web/test/instagram/token-refresh.test.ts` (estendido — pragma `// @vitest-environment node` no topo)

**Interfaces:**
- Consumes: tudo das Tarefas 4, 5, 6, 8, 9, 10, 11 + `openSyncRow`/`closeSyncRow` (A).
- Produces: resposta
  ```ts
  {
    status: 'ok' | 'error'
    error?: string
    refreshed: number; skipped_fresh: number; reprobed: number
    failed_permanent: number; failed_transient: number; failed_infra: number
    still_broken: number; deferred: number; step_errors: number
    heartbeat?: NtfyOutcome
    alert_channels: { probe: NtfyOutcome | 'not_due'; heartbeat: NtfyOutcome | 'not_due'; alerts: NtfyOutcome[] }
  }
  ```

- [ ] **Step 1: Escrever os testes que falham**

Reescreva `apps/web/test/api/cron/instagram-token-refresh.test.ts` com este cabeçalho e acrescente os `it` abaixo (o arquivo já tem o esqueleto de mocks; troque-o pelo bloco a seguir):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'

const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(
    (_sb: unknown, _key: string, _runId: string, _tag: string, fn: () => Promise<unknown>) =>
      fn().then((r: unknown) => Response.json(r)),
  ),
  newRunId: vi.fn(() => 'test-run-id'),
}))
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), setTag: vi.fn(),
}))
const mockRefresh = vi.fn()
vi.mock('@/lib/instagram/api-client', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/api-client')>()),
  refreshAccessToken: (...a: unknown[]) => mockRefresh(...a),
}))
const mockSweep = vi.fn()
const mockMark = vi.fn()
const mockStreak = vi.fn()
vi.mock('@/lib/instagram/token', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/token')>()),
  sweepTokenAlerts: (...a: unknown[]) => mockSweep(...a),
  markTokenInvalid: (...a: unknown[]) => mockMark(...a),
  evaluateTransientStreak: (...a: unknown[]) => mockStreak(...a),
}))
const mockNtfy = vi.fn()
const mockHeartbeat = vi.fn()
vi.mock('@/lib/ops/ntfy', async (orig) => ({
  ...(await orig<typeof import('@/lib/ops/ntfy')>()),
  sendNtfyAlert: (...a: unknown[]) => mockNtfy(...a),
  sendNtfyHeartbeat: (...a: unknown[]) => mockHeartbeat(...a),
}))
const mockFanOut = vi.fn()
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({
  NO_SITE_ADMINS_ERROR: 'no site admins to email',
  fanOutToSiteAdminsDetailed: (...a: unknown[]) => mockFanOut(...a),
}))
vi.mock('@/lib/instagram/deletion', () => ({
  DELETION_BLOB_BUDGET_MS: 45_000,
  resumeStuckDeletionRequest: vi.fn(() => Promise.resolve(false)),
  runDeletionEffects: vi.fn(),
}))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: vi.fn(() => Promise.resolve('log-1')),
  closeSyncRow: vi.fn(() => Promise.resolve()),
}))

import * as Sentry from '@sentry/nextjs'
import { GET, maxDuration } from '@/app/api/cron/instagram-token-refresh/route'
import { closeSyncRow } from '@/lib/instagram/sync-log'
import { resumeStuckDeletionRequest } from '@/lib/instagram/deletion'

/** Harness: um mock de `from` que serve todas as tabelas do cron. */
function harness(opts: {
  accounts?: Array<Record<string, unknown>>
  selectError?: { message: string } | null
  claims?: Record<string, boolean>
  stamps?: Record<string, string>
  deadEmails?: number
} = {}) {
  const claims = opts.claims ?? {}
  const stamps = opts.stamps ?? {}
  const claimed: string[] = []
  const released: string[] = []
  const updates: Array<Record<string, unknown>> = []

  mockRpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn === 'ops_alert_claim') {
      const key = String(args.p_key)
      claimed.push(key)
      return Promise.resolve({ data: claims[key] ?? true, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'instagram_accounts') {
      const rows = opts.accounts ?? []
      const terminal = Promise.resolve({ data: rows, error: opts.selectError ?? null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, or: () => chain, eq: () => chain,
        in: () => chain, order: () => terminal, then: terminal.then.bind(terminal),
        update: (patch: Record<string, unknown>) => { updates.push(patch); return chain },
      }
      return chain
    }
    if (table === 'ops_alert_state') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        delete: () => ({
          // releaseAlert(key)
          eq: (_col: string, key: string) => { released.push(key); return Promise.resolve({ error: null }) },
          // retenção: .delete().like('key','ddpage:%').lt('last_at', …)
          like: () => ({ lt: () => Promise.resolve({ error: null }) }),
        }),
        upsert: () => Promise.resolve({ error: null }),
      }
    }
    if (table === 'notification_deliveries') {
      return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: opts.deadEmails ?? 0, error: null }) }) }) }) }
    }
    if (table === 'sites') {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 'site-1', slug: 'bythiagofigueiredo' }], error: null }) }) }
    }
    // Cadeia genérica THENABLE: toda etapa do cron (retenção, órfãs, logs)
    // termina num `await`, e um objeto sem `then` faria o destructuring
    // devolver `undefined` em vez de `{ data, error }`.
    const settled = Promise.resolve({ data: [], error: null, count: 0 })
    const generic: Record<string, unknown> = {
      select: () => generic, eq: () => generic, in: () => generic, is: () => generic,
      lt: () => generic, gt: () => generic, like: () => generic, order: () => generic,
      limit: () => settled,
      delete: () => generic, update: () => generic,
      insert: () => Promise.resolve({ error: null }),
      then: settled.then.bind(settled),
    }
    return generic
  })
  void stamps
  return { claimed, released, updates }
}

function req(auth = `Bearer ${CRON_SECRET}`): NextRequest {
  const headers = new Headers({ authorization: auth })
  return { headers, nextUrl: new URL('http://x/api/cron/instagram-token-refresh') } as unknown as NextRequest
}

function account(over: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: 'thiago.figueiredo',
    ig_user_id: '17841400000000000', access_token: 'v1:cifrado',
    token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    token_refreshed_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    token_error: null, token_error_at: null, token_error_mode: null,
    token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
    ig_professional_id: null, ig_user_id_source: 'oauth',
    sync_enabled: true, display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null, section_subtitle_pt: null,
    section_subtitle_en: null, last_synced_at: null, created_at: '', updated_at: '',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', CRON_SECRET)
  vi.stubEnv('NTFY_URL', 'https://ntfy.example/t')
  vi.stubEnv('SOCIAL_MASTER_KEY', '0'.repeat(64))
  vi.stubEnv('VERCEL_ENV', 'development')
  mockSweep.mockResolvedValue([])
  mockNtfy.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
  mockHeartbeat.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
  mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
  mockStreak.mockResolvedValue(false)
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })
```

Agora os `it` (cole todos):

```ts
describe('config', () => {
  it('maxDuration === 180', () => { expect(maxDuration).toBe(180) })
  it('401 sem CRON_SECRET', async () => {
    harness({})
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
  })
})

describe('passo 0 vazio (regressão H3): nada de rede antes do passo 1', () => {
  it('a PRIMEIRA chamada ao ntfy do run acontece depois da varredura', async () => {
    const order: string[] = []
    mockNtfy.mockImplementation(async () => { order.push('ntfy'); return { alerted: true, ntfyStatus: 200 } })
    mockHeartbeat.mockImplementation(async () => { order.push('ntfy'); return { alerted: true, ntfyStatus: 200 } })
    mockSweep.mockImplementation(async () => { order.push('sweep'); return [] })
    harness({ accounts: [] })
    await GET(req())
    expect(order[0]).toBe('sweep')
  })
})

describe('passo 2 — select com erro é o ÚNICO retorno cedo', () => {
  it('status error com a causa nomeada', async () => {
    harness({ accounts: [], selectError: { message: 'boom' } })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('select failed')
  })
})

describe('passo 3 — etapas independentes', () => {
  it('retenção roda mesmo com seleção vazia', async () => {
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('ok')
    expect(vi.mocked(resumeStuckDeletionRequest)).toHaveBeenCalled()
  })

  it('expiring_clean dispara com episódio transitório ABERTO (predicado = token_error is null)', async () => {
    harness({ accounts: [account({
      token_error: null,
      token_error_at: new Date(Date.now() - 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })] })
    await GET(req())
    const push = mockNtfy.mock.calls.find(([a]) => String(a.title).includes('expiring'))
    expect(push).toBeTruthy()
    expect(String(push![0].title)).toContain('bythiagofigueiredo')
    expect(String(push![0].title)).not.toContain('@')
    expect(push![0].tags).toEqual(['warning'])
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalled()
  })

  it('expiring_clean com Date.now() - runStart acima de 8 s => PULADO e chave liberada', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    const h = harness({ accounts: [account({
      token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(9_000); return false
    })
    await GET(req())
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('expiring'))).toBe(false)
    expect(h.released).toContain('expiring_clean:acc-1')
  })

  it('ORDEM (regressão H3): ntfy respondendo em 9 s no passo 5b NÃO fecha o portão do passo 3', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockNtfy.mockImplementation(async () => { vi.advanceTimersByTime(9_000); return { alerted: true, ntfyStatus: 200 } })
    mockHeartbeat.mockImplementation(async () => { vi.advanceTimersByTime(9_000); return { alerted: true, ntfyStatus: 200 } })
    harness({ accounts: [account({
      token_expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    })] })
    await GET(req())
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('expiring'))).toBe(true)
  })

  it('órfã: linha started há mais de 30 min vira failed/timeout, e mode=manual gera captureMessage', async () => {
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ lt: () => Promise.resolve({ data: [{ id: 'l1', mode: 'manual' }], error: null }) }) }),
      update: () => ({ in: () => Promise.resolve({ error: null }) }),
    }))
    harness({ accounts: [] })
    await GET(req())
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram manual sync timed out', 'warning')
  })

  it('nenhum censo de Blob neste cron', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).not.toContain('blobsize')
  })
})

describe('passo 4 — deadline relativo à FASE, seleção e reprova', () => {
  it('30 s de relógio falso nos passos 1-3 => o passo 4 ainda dispõe dos 35 s inteiros', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(30_000); return false
    })
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.refreshed).toBe(1)
    expect(body.deferred).toBe(0)
  })

  it('conta não iniciada por prazo => deferred + captureMessage 1×/dia no PRIMEIRO deferral', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockRefresh.mockImplementation(async () => { vi.advanceTimersByTime(36_000); return { accessToken: 'x', expiresIn: 1 } })
    harness({ accounts: [account({ id: 'acc-1' }), account({ id: 'acc-2' })] })
    const body = await (await GET(req())).json()
    expect(body.deferred).toBe(1)
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram cron budget starving an account', 'warning')
  })

  it('24 h 10 min => too_fresh, sem chamada e sem log', async () => {
    harness({ accounts: [account({
      token_refreshed_at: new Date(Date.now() - (24 * 3_600_000 + 600_000)).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(body.skipped_fresh).toBe(1)
    expect(body).not.toHaveProperty('skipped')
  })

  it('25 h 10 min => chamada à Meta', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account({
      token_refreshed_at: new Date(Date.now() - (25 * 3_600_000 + 600_000)).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(body.refreshed).toBe(1)
  })

  it('token_refreshed_at NULL entra na seleção (braço IS NULL do portão de 25 h)', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account({ token_refreshed_at: null, token_expires_at: null })] })
    expect((await (await GET(req())).json()).refreshed).toBe(1)
  })

  it('token legado (sem v1:) é renovado e regravado CIFRADO', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    const h = harness({ accounts: [account({ access_token: 'IGlegacyPlain' })] })
    await GET(req())
    expect(mockRefresh).toHaveBeenCalledWith('IGlegacyPlain')
    const patch = h.updates.find((u) => 'access_token' in u)!
    expect(String(patch.access_token).startsWith('v1:')).toBe(true)
  })

  it('token expirado: failed/"expired" SEM chamada + markTokenInvalid fatal', async () => {
    harness({ accounts: [account({ token_expires_at: new Date(Date.now() - 3_600_000).toISOString() })] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'expired', { fatal: true })
    expect(body.failed_permanent).toBe(1)
    expect(vi.mocked(closeSyncRow)).toHaveBeenCalledWith(expect.anything(), 'log-1', null, 'expired')
  })

  it('falha permanente => markTokenInvalid fatal + linha permanent:', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('Invalid OAuth access token'),
      { code: 190, type: 'OAuthException', httpStatus: 400 }))
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_permanent).toBe(1)
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), expect.anything(),
      expect.stringContaining('Invalid OAuth access token'), { fatal: true })
    expect(vi.mocked(closeSyncRow).mock.calls.at(-1)![3]).toMatch(/^permanent: /)
  })

  it('falha transitória => linha transient: + evaluateTransientStreak("token_refresh")', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('rate limit'), { code: 4, httpStatus: 400 }))
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_transient).toBe(1)
    expect(vi.mocked(closeSyncRow).mock.calls.at(-1)![3]).toMatch(/^transient: /)
    expect(mockStreak).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'token_refresh')
  })

  it('infra => linha infra: + step_errors, sem markTokenInvalid', async () => {
    mockRefresh.mockRejectedValue({ code: 'PGRST202', message: 'not found', details: null, hint: null })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_infra).toBe(1)
    expect(body.step_errors).toBeGreaterThan(0)
    expect(mockMark).not.toHaveBeenCalled()
  })

  it('23505 na janela C2→C4: infra SEM step_errors, SEM push, captureMessage info 1×/dia', async () => {
    mockRefresh.mockRejectedValue({
      code: '23505', message: 'duplicate key value violates unique constraint "instagram_posts_ig_media_id_key"',
      details: null, hint: null,
    })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.step_errors).toBe(0)
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram duplicate media in C2→C4 window', 'info')
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('degraded'))).toBe(false)
  })

  it('RPC lançando => run continua ok, step_errors++ e push 1×/dia', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('expired'), { httpStatus: 401 }))
    mockMark.mockRejectedValue(new Error('PGRST202'))
    const h = harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('ok')
    expect(body.step_errors).toBeGreaterThan(0)
    expect(h.claimed).toContain('step_errors:instagram-token-refresh')
  })
})

describe('reprova (contas já em episódio)', () => {
  it('token_expires_at ≤ 10 d => intervalo de 23 h', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    const h = harness({ accounts: [account({
      token_error: 'expired',
      token_error_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_reprobe_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(body.reprobed).toBe(1)
    const patch = h.updates.find((u) => 'token_error' in u && u.token_error === null)!
    expect(patch).toMatchObject({
      token_error: null, token_error_at: null, token_error_mode: null,
      token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
    })
    expect(patch.token_refreshed_at).toBeTruthy()
    expect(vi.mocked(closeSyncRow).mock.calls.at(-1)![2]).not.toBeNull()
    expect(body.step_errors).toBe(0)
  })

  it('token_expires_at a 20 d => intervalo de 167 h (não reprova com 24 h)', async () => {
    const h = harness({ accounts: [account({
      token_error: 'expired',
      token_error_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_reprobe_at: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    })] })
    const body = await (await GET(req())).json()
    expect(body.reprobed).toBe(0)
    expect(h.updates.some((u) => u.token_error === null)).toBe(false)
  })

  it('qualquer desfecho grava token_reprobe_at', async () => {
    mockRefresh.mockRejectedValue(Object.assign(new Error('still dead'), { httpStatus: 401 }))
    const h = harness({ accounts: [account({
      token_error: 'expired',
      token_error_at: new Date(Date.now() - 200 * 3_600_000).toISOString(),
      token_reprobe_at: new Date(Date.now() - 200 * 3_600_000).toISOString(),
      token_expires_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    })] })
    await GET(req())
    expect(h.updates.some((u) => 'token_reprobe_at' in u && u.token_reprobe_at !== null)).toBe(true)
  })
})

describe('passo 5 e 5b — varredura antes do canal', () => {
  it('30 s de relógio falso nos passos 0-3 => a varredura AINDA entrega (elapsed é de sweepStart)', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(30_000); return false
    })
    mockSweep.mockResolvedValue([{ siteId: 's', identityKey: 'o:1', notifications: 1, ntfy: 'sent' }])
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(mockSweep).toHaveBeenCalledTimes(1)
    expect(body.alert_channels.alerts).toEqual(['sent'])
  })

  it('varredura consumindo os 25 s => sonda e heartbeat ainda são emitidos no mesmo run', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockSweep.mockImplementation(async () => { vi.advanceTimersByTime(25_000); return [] })
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(mockNtfy.mock.calls.some(([a]) => a.priority === 'min')).toBe(true)
    expect(mockHeartbeat).toHaveBeenCalledTimes(1)
    expect(body.alert_channels.probe).toBe('sent')
  })

  it('sonda diária: claim de 23 h, priority min, tag mag, SEM Click', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_probe_due')
    const probe = mockNtfy.mock.calls.find(([a]) => a.priority === 'min')![0]
    expect(probe.tags).toEqual(['mag'])
    expect(probe.click).toBeUndefined()
    expect(probe.title).toBe('Instagram ops probe')
    expect(probe.body).toBe('channel probe')
  })

  it('entrega aceita da SONDA carimba ntfy_heartbeat_ok mesmo sem heartbeat visível', async () => {
    const h = harness({ accounts: [], claims: { ntfy_heartbeat_due: false } })
    await GET(req())
    expect(mockHeartbeat).not.toHaveBeenCalled()
    expect(h.claimed).toContain('ntfy_heartbeat_ok')
  })

  it('403 na sonda => recusa TERMINAL => error no MESMO run (em produção)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 403 })
    mockHeartbeat.mockResolvedValue({ alerted: false, ntfyStatus: 403 })
    harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('terminal refusal (HTTP 403)')
  })

  it('5xx na sonda => episódio de canal: ok no 1º run, error no 2º (24 h depois)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.useFakeTimers({ now: new Date('2026-09-06T11:00:00Z'), toFake: ['Date'] })
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
    mockHeartbeat.mockResolvedValue({ alerted: false, ntfyStatus: 503 })

    let stamp: string | null = null
    mockRpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
      if (fn !== 'ops_alert_claim') return Promise.resolve({ data: null, error: null })
      if (args.p_key === 'ntfy_transient:instagram-token-refresh') {
        if (stamp === null) { stamp = new Date().toISOString(); return Promise.resolve({ data: true, error: null }) }
        return Promise.resolve({ data: false, error: null })
      }
      return Promise.resolve({ data: true, error: null })
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: stamp ? { last_at: stamp } : null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          upsert: () => Promise.resolve({ error: null }),
        }
      }
      if (table === 'notification_deliveries') {
        return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
      }
      const t = Promise.resolve({ data: [], error: null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
        lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
        update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
      }
      return chain
    })

    expect((await (await GET(req())).json()).status).toBe('ok')
    vi.setSystemTime(new Date('2026-09-07T11:00:00Z'))
    const second = await (await GET(req())).json()
    expect(second.status).toBe('error')
    expect(second.error).toContain('transient for 2 runs')
  })

  it('heartbeat: primeiro run emite (claim de 5 dias) e é priority low', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_heartbeat_due')
    expect(mockHeartbeat).toHaveBeenCalledTimes(1)
  })
})

describe('passo 7 — status e segundo canal', () => {
  it('produção sem NTFY_URL => trabalho executado + error com a causa + 1 e-mail', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NTFY_URL', '')
    mockRefresh.mockResolvedValue({ accessToken: 'IGnew', expiresIn: 5_184_000 })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.refreshed).toBe(1)
    expect(body.status).toBe('error')
    expect(body.error).toContain('NTFY_URL unset')
    expect(mockFanOut).toHaveBeenCalledTimes(1)
    expect(mockFanOut.mock.calls[0]![0]).toMatchObject({
      type: 'system.cron_failure', title: 'Instagram alert channel down', defaultChannels: ['email'],
    })
  })

  it('fora de produção a mesma condição devolve ok', async () => {
    vi.stubEnv('NTFY_URL', '')
    harness({ accounts: [] })
    expect((await (await GET(req())).json()).status).toBe('ok')
  })

  it('vaultDown: contas intocadas + error + 1 e-mail só em produção', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SOCIAL_MASTER_KEY', 'nope')
    const h = harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(h.updates.some((u) => 'access_token' in u)).toBe(false)
    expect(body.status).toBe('error')
    expect(body.error).toContain('vault unavailable')
  })

  it('vaultDown + NTFY_URL ausente => UM só e-mail com as duas causas', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SOCIAL_MASTER_KEY', 'nope')
    vi.stubEnv('NTFY_URL', '')
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(mockFanOut).toHaveBeenCalledTimes(1)
    expect(body.error).toContain('NTFY_URL unset')
    expect(body.error).toContain('vault unavailable')
    expect(mockFanOut.mock.calls[0]![0].title).toBe('Instagram token storage unavailable')
  })

  it('e-mail de fallback morto nos últimos 2 dias => error com a causa', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    harness({ accounts: [], deadEmails: 1 })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('fallback email dead')
  })

  it('carimbo ntfy_heartbeat_ok de D-6 e D-8 => ok; D-9 => error', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    for (const [days, expected] of [[6, 'ok'], [8, 'ok'], [9, 'error']] as const) {
      vi.clearAllMocks()
      mockSweep.mockResolvedValue([]); mockNtfy.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
      mockHeartbeat.mockResolvedValue({ alerted: true, ntfyStatus: 200 })
      mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
      const stampIso = new Date(Date.now() - days * 86_400_000).toISOString()
      mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ops_alert_state') {
          return {
            select: () => ({ eq: (_c: string, k: string) => ({ maybeSingle: () => Promise.resolve({ data: k === 'ntfy_heartbeat_ok' ? { last_at: stampIso } : null }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
            upsert: () => Promise.resolve({ error: null }),
          }
        }
        if (table === 'notification_deliveries') {
          return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
        }
        const t = Promise.resolve({ data: [], error: null })
        const chain: Record<string, unknown> = {
          select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
          lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
          update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
        }
        return chain
      })
      const body = await (await GET(req())).json()
      expect(body.status, `D-${days}`).toBe(expected)
    }
  })

  it('sem carimbo e sem recusa => ok (o run de estreia é o caso esperado)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    harness({ accounts: [] })
    expect((await (await GET(req())).json()).status).toBe('ok')
  })

  it('chave de 31 h e de 60 h => FÓSSIL: re-carimbada, status ok', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    for (const hours of [31, 60]) {
      vi.clearAllMocks()
      mockSweep.mockResolvedValue([])
      mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
      mockHeartbeat.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
      mockFanOut.mockResolvedValue({ total: 1, sent: 1, suppressed: 0, errors: [] })
      const stampIso = new Date(Date.now() - hours * 3_600_000).toISOString()
      mockRpc.mockImplementation(() => Promise.resolve({ data: false, error: null }))
      mockFrom.mockImplementation((table: string) => {
        if (table === 'ops_alert_state') {
          return {
            select: () => ({ eq: (_c: string, k: string) => ({ maybeSingle: () => Promise.resolve({ data: k.startsWith('ntfy_transient') ? { last_at: stampIso } : null }) }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
            upsert: () => Promise.resolve({ error: null }),
          }
        }
        if (table === 'notification_deliveries') {
          return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
        }
        const t = Promise.resolve({ data: [], error: null })
        const chain: Record<string, unknown> = {
          select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
          lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
          update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
        }
        return chain
      })
      const body = await (await GET(req())).json()
      expect(body.status, `${hours}h`).toBe('ok')
    }
  })

  it('run limpo sem entrega => a chave do episódio é apagada', async () => {
    const h = harness({ accounts: [], claims: { ntfy_probe_due: false, ntfy_heartbeat_due: false } })
    await GET(req())
    expect(h.released).toContain('ntfy_transient:instagram-token-refresh')
  })

  it('still_broken conta as contas com token_error_at ao fim; alert_channels é asserido', async () => {
    harness({ accounts: [account({ token_error: 'expired', token_error_at: new Date().toISOString() })] })
    const body = await (await GET(req())).json()
    expect(body.still_broken).toBe(1)
    expect(body.alert_channels).toEqual({ probe: 'sent', heartbeat: 'sent', alerts: [] })
  })
})

describe('fake timers — 69 h e a fronteira do longOpen', () => {
  it('token_error_at em D 11:00:05 e D 13:00:05, lido em D+3 11:00 => longOpen com token_error NULL', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-09T11:00:00Z'), toFake: ['Date'] })
    mockSweep.mockImplementation(async () => [])
    harness({ accounts: [
      account({ id: 'a', token_error: null, token_error_at: '2026-09-06T11:00:05Z', token_error_mode: 'token_refresh' }),
      account({ id: 'b', token_error: null, token_error_at: '2026-09-06T13:00:05Z', token_error_mode: 'token_refresh' }),
    ] })
    const body = await (await GET(req())).json()
    // episódio transitório aberto NÃO retira a conta da seleção
    expect(body.still_broken).toBe(2)
    expect(mockSweep).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/api/cron/instagram-token-refresh.test.ts`
Expected: FAIL — `maxDuration` é 30; a resposta não tem `still_broken`/`alert_channels`.

- [ ] **Step 3: Implementar a rota**

Substitua `apps/web/src/app/api/cron/instagram-token-refresh/route.ts` inteiro por:

```ts
import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { refreshAccessToken } from '@/lib/instagram/api-client'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import {
  classifyInstagramError,
  evaluateTransientStreak,
  getVaultKeyOrNull,
  loadSiteSlugs,
  markTokenInvalid,
  readAccessToken,
  redact,
  sweepTokenAlerts,
  writeAccessToken,
  type NtfyOutcome,
} from '@/lib/instagram/token'
import { resumeStuckDeletionRequest, DELETION_BLOB_BUDGET_MS } from '@/lib/instagram/deletion'
import { sendNtfyAlert, sendNtfyHeartbeat, isTerminalRefusal, type INtfyResult } from '@/lib/ops/ntfy'
import { claimAlert, readAlertStamp, releaseAlert, touchAlert } from '@/lib/ops/alert-state'
import {
  NO_SITE_ADMINS_ERROR,
  fanOutToSiteAdminsDetailed,
} from '@/lib/notifications/fan-out-to-admins'
import type { InstagramAccountRow, SyncResult } from '@/lib/instagram/types'

export const runtime = 'nodejs'
// 180: o projeto já entrega quatro crons com 300 no plano Pro.
export const maxDuration = 180

const HOUR = 3_600_000
const CRON_TAG = 'instagram-token-refresh'
const WORK_PHASE_BUDGET_MS = 35_000
const OPTIONAL_GATE_MS = 8_000
const REFRESH_MIN_AGE_MS = 25 * HOUR
const SELECT_STALE_MS = 167 * HOUR
const SELECT_EXPIRY_MS = 15 * 24 * HOUR
const REPROBE_SOON_MS = 23 * HOUR
const REPROBE_LATE_MS = 167 * HOUR
const EXPIRING_WINDOW_MS = 7 * 24 * HOUR
const RETENTION_MS = 180 * 24 * HOUR
const ORPHAN_MS = 30 * 60_000
const EPISODE_KEY = `ntfy_transient:${CRON_TAG}`
const HEARTBEAT_STALE_MS = 8 * 24 * HOUR

const EMPTY_RESULT: SyncResult = {
  postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
}

function ms(iso: string | null): number | null {
  return iso ? Date.parse(iso) : null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, CRON_TAG, runId, CRON_TAG, async () => {
    const runStart = Date.now()

    let stepErrors = 0
    let refreshed = 0
    let skippedFresh = 0
    let reprobed = 0
    let failedPermanent = 0
    let failedTransient = 0
    let failedInfra = 0
    let deferred = 0

    // Cada recusa alimenta o passo 7. `alerts` guarda o desfecho de cada grupo.
    const refusals: INtfyResult[] = []
    let acceptedAny = false
    const alertOutcomes: NtfyOutcome[] = []

    /** Toda etapa em try/catch: exceção => captureException + step_errors++, nunca propaga. */
    async function step(name: string, fn: () => Promise<void>): Promise<void> {
      try {
        await fn()
      } catch (err) {
        stepErrors++
        Sentry.captureException(err, { tags: { component: CRON_TAG, step: name } })
      }
    }

    function noteDelivery(result: INtfyResult): void {
      if (result.alerted) acceptedAny = true
      else if (result.reason !== 'NTFY_URL unset') refusals.push(result)
    }

    // ── passo 0: DELIBERADAMENTE VAZIO ──────────────────────────────────────
    // As duas emissões de canal viraram o passo 5b. NADA de rede roda antes do
    // passo 1 — é essa invariante que torna o portão de 8 s do passo 3
    // alcançável e devolve os 35 s inteiros ao trabalho de token.
    // MUST: um patch que reintroduza sendNtfyAlert/sendNtfyHeartbeat aqui é
    // recusado; §6 tem o teste de regressão.

    // ── passo 1: flags ──────────────────────────────────────────────────────
    const isProduction = process.env.VERCEL_ENV === 'production'
    const alertChannelUnset = !process.env.NTFY_URL
    const vaultDown = getVaultKeyOrNull() === null

    // ── passo 2: select inicial (ÚNICO retorno cedo) ────────────────────────
    const { data: accountsData, error: selectError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .order('last_synced_at', { ascending: true, nullsFirst: true })

    if (selectError) {
      return { status: 'error' as const, error: `select failed: ${selectError.message}` }
    }
    const accounts = (accountsData ?? []) as InstagramAccountRow[]

    // ── passo 3: independentes da seleção ───────────────────────────────────
    await step('orphans', async () => {
      const cutoff = new Date(Date.now() - ORPHAN_MS).toISOString()
      const { data: orphans } = await supabase
        .from('instagram_sync_log')
        .select('id, mode')
        .eq('status', 'started')
        .lt('started_at', cutoff)
      const rows = (orphans ?? []) as Array<{ id: string; mode: string }>
      if (rows.length === 0) return
      await supabase
        .from('instagram_sync_log')
        .update({ status: 'failed', error_message: 'timeout', completed_at: new Date().toISOString() })
        .in('id', rows.map((r) => r.id))
      if (rows.some((r) => r.mode === 'manual')) {
        Sentry.captureMessage('instagram manual sync timed out', 'warning')
      }
    })

    await step('retention', async () => {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
      await supabase.from('instagram_sync_log').delete().lt('created_at', cutoff)
      await supabase.from('instagram_deletion_requests').delete().lt('requested_at', cutoff)
      // MUST: a retenção de ops_alert_state roda nos DOIS crons — com uma só
      // varredora, um mês de cron parado deixa as linhas por-IP-por-dia de
      // /data-deletion acumulando numa base de 500 MB.
      const twoDays = new Date(Date.now() - 2 * 24 * HOUR).toISOString()
      await supabase.from('ops_alert_state').delete().like('key', 'ddpage:%').lt('last_at', twoDays)
      await supabase.from('ops_alert_state').delete().like('key', 'sigreq:%').lt('last_at', twoDays)
    })

    await step('resume-deletion', async () => {
      await resumeStuckDeletionRequest(supabase, runStart + DELETION_BLOB_BUDGET_MS)
    })

    const slugs = await loadSiteSlugs(supabase, [...new Set(accounts.map((a) => a.site_id))])

    await step('expiring-clean', async () => {
      const horizon = Date.now() + EXPIRING_WINDOW_MS
      // MUST: dispara TAMBÉM com episódio transitório aberto — o predicado é
      // `token_error is null`, não "episódio limpo". O predicado antigo
      // desligava o único aviso de expiração justamente quando a renovação já
      // estava falhando.
      const expiring = accounts.filter((a) => {
        const exp = ms(a.token_expires_at ?? null)
        return a.token_error == null && exp !== null && exp <= horizon
      })
      for (const account of expiring) {
        const key = `expiring_clean:${account.id}`
        // Portão medido ANTES de qualquer chamada ao ntfy do run.
        if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
          await releaseAlert(supabase, key)
          continue
        }
        if (!(await claimAlert(supabase, key, '23 hours'))) continue
        if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
          await releaseAlert(supabase, key)
          continue
        }
        const days = Math.max(0, Math.ceil((ms(account.token_expires_at ?? null)! - Date.now()) / (24 * HOUR)))
        Sentry.captureMessage(
          `instagram token expiring without renewal: @${account.handle} in ${days}d`,
          'warning',
        )
        const slug = slugs.get(account.site_id)
        // REGRA-PII-NTFY (§0): nunca `· @handle` aqui — só o slug do site.
        const result = await sendNtfyAlert({
          title: `Instagram token expiring without renewal${slug ? ` · ${slug}` : ''}`,
          body: `${days} day(s) left. Open the CMS to reconnect.`,
          priority: 'default',
          tags: ['warning'],
          click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
        })
        noteDelivery(result)
      }
    })

    // ── passo 4: seleção + reprova sob o deadline DA FASE ────────────────────
    const workPhaseStart = Date.now()
    const deadline = workPhaseStart + WORK_PHASE_BUDGET_MS

    function needsRefresh(a: InstagramAccountRow): boolean {
      if (a.access_token == null || a.token_error != null) return false
      const exp = ms(a.token_expires_at ?? null)
      const refreshedAt = ms(a.token_refreshed_at ?? null) ?? Date.parse(a.created_at)
      return (
        (exp !== null && exp < Date.now() + SELECT_EXPIRY_MS) ||
        exp === null ||
        refreshedAt < Date.now() - SELECT_STALE_MS
      )
    }

    function needsReprobe(a: InstagramAccountRow): boolean {
      if (a.access_token == null || a.token_error == null) return false
      const last = ms(a.token_reprobe_at ?? null) ?? ms(a.token_error_at ?? null)
      if (last === null) return true
      const exp = ms(a.token_expires_at ?? null)
      const interval = exp !== null && exp <= Date.now() + 10 * 24 * HOUR ? REPROBE_SOON_MS : REPROBE_LATE_MS
      return last < Date.now() - interval
    }

    const work = accounts.filter((a) => needsRefresh(a) || needsReprobe(a))

    for (const account of work) {
      if (Date.now() >= deadline) {
        deferred++
        await step('deferred-signal', async () => {
          if (await claimAlert(supabase, `deferred:${account.id}`, '23 hours')) {
            Sentry.captureMessage('instagram cron budget starving an account', 'warning')
          }
        })
        continue
      }
      if (vaultDown) {
        // Nenhuma conta é marcada, em nenhum ambiente.
        deferred++
        continue
      }

      const isReprobe = needsReprobe(account)

      await step(`account:${account.id}`, async () => {
        const { token } = readAccessToken(account)
        if (token === null) {
          await markTokenInvalid(supabase, account, 'decrypt_failed', { fatal: true })
          const logId = await openSyncRow(supabase, account, 'token_refresh')
          await closeSyncRow(supabase, logId, null, 'permanent: decrypt_failed')
          failedPermanent++
          return
        }

        // Token já expirado: linha `failed`/'expired' SEM chamada à Meta.
        const exp = ms(account.token_expires_at ?? null)
        if (exp !== null && exp <= Date.now()) {
          const logId = await openSyncRow(supabase, account, 'token_refresh')
          await markTokenInvalid(supabase, account, 'expired', { fatal: true })
          await closeSyncRow(supabase, logId, null, 'expired')
          failedPermanent++
          return
        }

        // A Meta exige "at least 24 hours old" — 25 h por causa do jitter.
        const refreshedAt = ms(account.token_refreshed_at ?? null)
        if (refreshedAt !== null && refreshedAt > Date.now() - REFRESH_MIN_AGE_MS) {
          skippedFresh++
          return
        }

        const logId = await openSyncRow(supabase, account, 'token_refresh')
        try {
          const { accessToken, expiresIn } = await refreshAccessToken(token)
          await supabase
            .from('instagram_accounts')
            .update({
              access_token: writeAccessToken(accessToken),
              token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
              token_refreshed_at: new Date().toISOString(),
              // Sucesso em QUALQUER caminho zera o episódio + o marca-passo.
              token_error: null,
              token_error_at: null,
              token_error_mode: null,
              token_alert_sent_at: null,
              token_alert_attempt_at: null,
              token_reprobe_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', account.id)
            .eq('site_id', account.site_id)

          if (isReprobe) {
            reprobed++
            await closeSyncRow(supabase, logId, EMPTY_RESULT)
            await supabase
              .from('instagram_sync_log')
              .update({ error_message: 'detail: recovered' })
              .eq('id', logId ?? '')
          } else {
            refreshed++
            await closeSyncRow(supabase, logId, EMPTY_RESULT)
          }
        } catch (err) {
          const kind = classifyInstagramError(err)
          const message = redact(err instanceof Error ? err.message : String(err))

          if (kind === 'infra') {
            await closeSyncRow(supabase, logId, null, `infra: ${message}`)
            failedInfra++
            // Exclusão explícita da janela C2→C4 (REMOVIDA EM C4): a segunda
            // linha de locale colide com instagram_posts_ig_media_id_key.
            if (/duplicate key value.*instagram_posts_ig_media_id_key/.test(message)) {
              if (await claimAlert(supabase, `c2c4dup:${account.id}`, '23 hours')) {
                Sentry.captureMessage('instagram duplicate media in C2→C4 window', 'info')
              }
            } else {
              stepErrors++
              Sentry.captureException(err, { tags: { component: CRON_TAG, account_id: account.id } })
            }
          } else if (kind === 'permanent') {
            await closeSyncRow(supabase, logId, null, `permanent: ${message}`)
            await markTokenInvalid(supabase, account, message, { fatal: true })
            failedPermanent++
          } else {
            await closeSyncRow(supabase, logId, null, `transient: ${message}`)
            await evaluateTransientStreak(supabase, account, 'token_refresh')
            failedTransient++
          }
        } finally {
          if (isReprobe) {
            await supabase
              .from('instagram_accounts')
              .update({ token_reprobe_at: new Date().toISOString() })
              .eq('id', account.id)
              .eq('site_id', account.site_id)
          }
        }
      })
    }

    // ── passo 5: varredura ──────────────────────────────────────────────────
    await step('sweep', async () => {
      const results = await sweepTokenAlerts(supabase)
      for (const r of results) {
        alertOutcomes.push(r.ntfy)
        if (r.ntfy === 'sent') acceptedAny = true
        else if (r.ntfy === 'failed_terminal') refusals.push({ alerted: false, ntfyStatus: 403 })
        else if (r.ntfy === 'failed_transient') refusals.push({ alerted: false, ntfyStatus: 503 })
      }
    })

    // ── passo 5b: canal (era o passo 0) ─────────────────────────────────────
    let probeOutcome: NtfyOutcome | 'not_due' = 'not_due'
    let heartbeatOutcome: NtfyOutcome | 'not_due' = 'not_due'

    function outcomeOf(r: INtfyResult): NtfyOutcome {
      if (r.alerted) return 'sent'
      if (r.reason === 'NTFY_URL unset') return 'skipped'
      return isTerminalRefusal(r) ? 'failed_terminal' : 'failed_transient'
    }

    await step('probe', async () => {
      // Chave COMPARTILHADA com o cron do sync — quem chegar primeiro emite.
      if (!(await claimAlert(supabase, 'ntfy_probe_due', '23 hours'))) return
      const result = await sendNtfyAlert({
        title: 'Instagram ops probe',
        body: 'channel probe',
        priority: 'min', // prioridade 1 entra na gaveta e não notifica o aparelho
        tags: ['mag'],
      })
      probeOutcome = outcomeOf(result)
      noteDelivery(result)
      if (result.alerted) await claimAlert(supabase, 'ntfy_heartbeat_ok', '0')
      else await releaseAlert(supabase, 'ntfy_probe_due')
    })

    await step('heartbeat', async () => {
      // Heartbeat visível é EXCLUSIVO deste cron.
      if (!(await claimAlert(supabase, 'ntfy_heartbeat_due', '5 days'))) return
      const result = await sendNtfyHeartbeat()
      heartbeatOutcome = outcomeOf(result)
      noteDelivery(result)
      if (result.alerted) await claimAlert(supabase, 'ntfy_heartbeat_ok', '0')
      else await releaseAlert(supabase, 'ntfy_heartbeat_due')
    })

    // ── passo 6: step_errors ────────────────────────────────────────────────
    if (stepErrors > 0) {
      await step('step-errors-push', async () => {
        if (!(await claimAlert(supabase, `step_errors:${CRON_TAG}`, '23 hours'))) return
        const result = await sendNtfyAlert({
          title: 'Instagram cron degraded',
          body: `${stepErrors} step(s) failed — see Sentry`,
          priority: 'default',
          tags: ['warning'],
          click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
        })
        noteDelivery(result)
      })
    }

    // ── passo 7: canal, status e segundo canal ──────────────────────────────
    const terminalRefusal = refusals.find((r) => isTerminalRefusal(r))
    let transientPersistent = false

    await step('channel-episode', async () => {
      if (refusals.length === 0) {
        // Todo run sem NENHUMA recusa (inclusive sem entrega) apaga a chave.
        await releaseAlert(supabase, EPISODE_KEY)
        return
      }
      if (await claimAlert(supabase, EPISODE_KEY, '365 days')) return // abre, não persistente
      const stamp = await readAlertStamp(supabase, EPISODE_KEY)
      if (!stamp) return
      const age = Date.now() - stamp.getTime()
      // "persistente" = o SEGUNDO run consecutivo do MESMO cron com recusa.
      // 24 h ± jitter; > 30 h é fóssil (cron parado, deploy longo).
      if (age >= 20 * HOUR && age <= 30 * HOUR) {
        transientPersistent = true
        await touchAlert(supabase, EPISODE_KEY)
      } else if (age > 30 * HOUR) {
        await touchAlert(supabase, EPISODE_KEY)
      }
    })

    let heartbeatStale = false
    await step('heartbeat-watch', async () => {
      const stamp = await readAlertStamp(supabase, 'ntfy_heartbeat_ok')
      // Carimbo AUSENTE não conta — o run de estreia é o caso esperado.
      if (stamp && Date.now() - stamp.getTime() > HEARTBEAT_STALE_MS) heartbeatStale = true
    })

    let fallbackEmailDead = false
    await step('dead-fallback-email', async () => {
      const { count } = await supabase
        .from('notification_deliveries')
        .select('id, notifications!inner(dedup_key)', { count: 'exact', head: true })
        .eq('status', 'dead')
        .gt('created_at', new Date(Date.now() - 2 * 24 * HOUR).toISOString())
        .like('notifications.dedup_key', 'instagram-alert-channel-down:%')
      if ((count ?? 0) > 0) fallbackEmailDead = true
    })

    const causes: string[] = []
    if (alertChannelUnset) causes.push('alert channel down: NTFY_URL unset')
    if (terminalRefusal) {
      causes.push(`alert channel down: terminal refusal (HTTP ${terminalRefusal.ntfyStatus ?? 'unknown'})`)
    }
    if (transientPersistent) causes.push('alert channel down: transient for 2 runs')
    if (heartbeatStale) {
      causes.push(
        `alert channel down: no heartbeat accepted for ${Math.floor(HEARTBEAT_STALE_MS / (24 * HOUR))}d`,
      )
    }
    if (fallbackEmailDead) causes.push('alert channel down: fallback email dead')
    if (vaultDown) causes.push('vault unavailable: SOCIAL_MASTER_KEY missing/malformed')

    const alertChannelPersistentlyDown =
      alertChannelUnset || Boolean(terminalRefusal) || transientPersistent || heartbeatStale || fallbackEmailDead

    const shouldEscalate = isProduction && (alertChannelPersistentlyDown || vaultDown)

    if (shouldEscalate) {
      await step('second-channel', async () => {
        const siteIds = [...new Set(accounts.map((a) => a.site_id))]
        for (const siteId of siteIds) {
          const fan = await fanOutToSiteAdminsDetailed({
            siteId,
            domain: 'system',
            type: 'system.cron_failure',
            priority: 5,
            title: vaultDown ? 'Instagram token storage unavailable' : 'Instagram alert channel down',
            message: causes.join(' · '),
            dedupKey: `instagram-alert-channel-down:${new Date().toISOString().slice(0, 10)}`,
            defaultChannels: ['email'],
          })
          if (fan.total === 0) {
            stepErrors++
            causes.push(NO_SITE_ADMINS_ERROR)
          }
        }
      })
    }

    const stillBroken = accounts.filter((a) => a.token_error_at != null).length
    const status = shouldEscalate ? ('error' as const) : ('ok' as const)

    return {
      status,
      ...(status === 'error' ? { error: causes.join(' · ') } : {}),
      refreshed,
      skipped_fresh: skippedFresh,
      reprobed,
      failed_permanent: failedPermanent,
      failed_transient: failedTransient,
      failed_infra: failedInfra,
      still_broken: stillBroken,
      deferred,
      step_errors: stepErrors,
      ...(heartbeatOutcome !== 'not_due' ? { heartbeat: heartbeatOutcome } : {}),
      alert_channels: { probe: probeOutcome, heartbeat: heartbeatOutcome, alerts: alertOutcomes },
    }
  })
}
```

- [ ] **Step 4: Ajustar `test/instagram/token-refresh.test.ts`**

Acrescente `// @vitest-environment node` na primeira linha e substitua as asserções que ainda esperam a forma antiga (`{ status:'ok', refreshed, failed }`) pela nova (`refreshed`, `failed_permanent`, `failed_transient`, `failed_infra`, `still_broken`, `step_errors`, `alert_channels`). Nenhuma asserção nova é necessária além das já escritas no Step 1 — este arquivo cobre o mesmo cron por outro ângulo, então basta alinhar os campos.

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test --workspace=apps/web -- test/api/cron/instagram-token-refresh.test.ts
npm test --workspace=apps/web -- test/instagram/token-refresh.test.ts
```
Expected: PASS.

- [ ] **Step 6: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/app/api/cron/instagram-token-refresh/route.ts \
        apps/web/test/api/cron/instagram-token-refresh.test.ts \
        apps/web/test/instagram/token-refresh.test.ts
git commit -m "feat(instagram): cron de renovacao observavel (episodio, varredura, canal vigiado)"
```

---

### Task 13: Cron do sync diário (`api/cron/instagram-sync`)

**Files:**
- Modify: `apps/web/src/app/api/cron/instagram-sync/route.ts` (arquivo inteiro)
- Test: `apps/web/test/api/cron/instagram-sync.test.ts` (estendido)
- Test: `apps/web/test/instagram/cron-route.test.ts` (alinhado)

**Interfaces:**
- Consumes: `probeToken`, `readAccessToken`, `classifyInstagramError`, `markTokenInvalid`, `evaluateTransientStreak`, `sweepTokenAlerts`, `loadSiteSlugs` (Tarefas 4/5/8/10); `syncInstagramAccount`, `checkImageCacheHealth` (Tarefa 7); `sendNtfyAlert` (Tarefa 6); `claimAlert`/`releaseAlert`/`readAlertStamp`/`touchAlert` (Tarefa 6); `resumeStuckDeletionRequest` (Tarefa 11); `fanOutToSiteAdminsDetailed` (Tarefa 9).
- Produces: resposta `{ status, error?, probed, synced, inserted, updated, cached, never_connected, token_invalid, failed_permanent, failed_transient, failed_infra, still_broken, deferred, step_errors, alert_channels }`.

**Sobre `mode`/`accountId`:** a rota **mantém** os dois parâmetros e o lock atual nesta tarefa. Removê-los é conteúdo de **A5** (`chore(instagram): drop manual mode from sync cron`), **nunca de C2** — e A5 já terá decidido isso antes de C2 começar. Se A5 tiver caído no ramo aprovado, o `mode`/`accountId` já não existem quando você chegar aqui: nesse caso, **omita** o bloco `mode`/`accountId` do Step 3 e use `withCronLock(supabase, 'instagram-sync', runId, 'instagram-sync', …)`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `apps/web/test/api/cron/instagram-sync.test.ts` (mesmo harness da Tarefa 12, adaptado — cole o cabeçalho de mocks daquele arquivo trocando a rota importada e acrescentando os mocks abaixo):

```ts
const mockProbe = vi.fn()
const mockSync = vi.fn()
const mockImgHealth = vi.fn()
vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: (...a: unknown[]) => mockSync(...a),
  checkImageCacheHealth: (...a: unknown[]) => mockImgHealth(...a),
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
}))
const listMock = vi.fn()
vi.mock('@vercel/blob', () => ({ list: (...a: unknown[]) => listMock(...a), del: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { GET, maxDuration } from '@/app/api/cron/instagram-sync/route'
```

e no `vi.mock('@/lib/instagram/token', …)` da Tarefa 12 acrescente `probeToken: (...a: unknown[]) => mockProbe(...a)`.

Os `it`:

```ts
describe('cron do sync — configuração', () => {
  it('maxDuration === 180', () => { expect(maxDuration).toBe(180) })
})

describe('probes: TODA conta com token, isentas de orçamento', () => {
  beforeEach(() => { mockProbe.mockResolvedValue({ ok: true }); mockSync.mockResolvedValue({
    postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
  }) })

  it('conta com sync_enabled=false ainda recebe /me', async () => {
    harness({ accounts: [account({ sync_enabled: false })] })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(1)
    expect(mockSync).not.toHaveBeenCalled()
    expect(body.probed).toBe(1)
  })

  it('conta em deferred na fase de syncs AINDA foi probada', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T13:00:00Z'), toFake: ['Date'] })
    mockSync.mockImplementation(async () => { vi.advanceTimersByTime(101_000); return {
      postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0 } })
    harness({ accounts: [account({ id: 'a' }), account({ id: 'b' })] })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(2)
    expect(body.deferred).toBe(1)
  })

  it('30 s de relógio falso nos passos 0-3 => todas as contas ainda probadas e a varredura entrega', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T13:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(30_000); return false
    })
    harness({ accounts: [account({ id: 'a' }), account({ id: 'b' }), account({ id: 'c' })] })
    await GET(req())
    expect(mockProbe).toHaveBeenCalledTimes(3)
    expect(mockSweep).toHaveBeenCalledTimes(1)
  })

  it('probe que estoura 10 s vira FALHA CLASSIFICADA, nunca probe pulado', async () => {
    const abort = new Error('The operation was aborted'); abort.name = 'TimeoutError'
    mockProbe.mockResolvedValue({ ok: false, error: abort })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_transient).toBe(1)
    expect(mockStreak).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'daily')
  })

  it('6 contas com token => 6 probes, nenhum deferred e NENHUM probe_starved', async () => {
    const h = harness({ accounts: Array.from({ length: 6 }, (_, i) => account({ id: `a${i}`, sync_enabled: false })) })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(6)
    expect(body.deferred).toBe(0)
    expect(h.claimed).not.toContain('probe_starved')
  })

  it('7 contas => 6 probes + deferred da 7ª + captureMessage 1×/dia', async () => {
    const h = harness({ accounts: Array.from({ length: 7 }, (_, i) => account({ id: `a${i}`, sync_enabled: false })) })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(6)
    expect(body.deferred).toBe(1)
    expect(h.claimed).toContain('probe_starved')
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram probe fleet exceeds design point', 'warning')
  })

  it('probe com OAuthException 400 => permanent + alerta no MESMO run', async () => {
    mockProbe.mockResolvedValue({ ok: false, error: Object.assign(new Error('Invalid OAuth access token'),
      { code: 190, type: 'OAuthException', httpStatus: 400 }) })
    mockSweep.mockResolvedValue([{ siteId: 'site-1', identityKey: 'o:1', notifications: 1, ntfy: 'sent' }])
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_permanent).toBe(1)
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), expect.anything(),
      expect.stringContaining('Invalid OAuth access token'), { fatal: true })
    expect(mockSweep).toHaveBeenCalledTimes(1)
    expect(body.alert_channels.alerts).toEqual(['sent'])
  })
})

describe('por conta', () => {
  it('access_token nulo => 1 linha/semana never_connected, SEM alerta', async () => {
    const h = harness({ accounts: [account({ access_token: null })] })
    const body = await (await GET(req())).json()
    expect(h.claimed).toContain('never_connected:acc-1')
    expect(body.never_connected).toBe(1)
    expect(mockProbe).not.toHaveBeenCalled()
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('Instagram token'))).toBe(false)
  })

  it('token_error presente => linha token_invalid: <motivo> e o probe AINDA roda', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    harness({ accounts: [account({ token_error: 'expired', token_error_at: new Date().toISOString() })] })
    const body = await (await GET(req())).json()
    expect(mockProbe).toHaveBeenCalledTimes(1)
    expect(body.token_invalid).toBe(1)
    expect(vi.mocked(closeSyncRow).mock.calls.some(([, , , m]) => String(m).startsWith('token_invalid: '))).toBe(true)
  })

  it('sync transitório => streak com modo daily', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockRejectedValue(Object.assign(new Error('rate limit'), { code: 4 }))
    harness({ accounts: [account()] })
    await GET(req())
    expect(mockStreak).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'daily')
  })

  it('23505 => infra: sem streak e sem markTokenInvalid', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint "instagram_posts_ig_media_id_key"', details: null, hint: null })
    harness({ accounts: [account()] })
    const body = await (await GET(req())).json()
    expect(body.failed_infra).toBe(1)
    expect(mockStreak).not.toHaveBeenCalled()
    expect(mockMark).not.toHaveBeenCalled()
    expect(body.step_errors).toBe(0)
  })

  it('checkImageCacheHealth é chamado depois de cada sync concluído', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockResolvedValue({ postsFound: 1, postsInserted: 1, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 1 })
    harness({ accounts: [account()] })
    await GET(req())
    expect(mockImgHealth).toHaveBeenCalledWith(expect.anything(), 'acc-1')
  })

  it('mediaFailed > 0 entra no error_message via closeSyncRow (result completo)', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    const result = { postsFound: 1, postsInserted: 1, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 2 }
    mockSync.mockResolvedValue(result)
    harness({ accounts: [account()] })
    await GET(req())
    expect(vi.mocked(closeSyncRow)).toHaveBeenCalledWith(expect.anything(), 'log-1', result)
  })

  it('revalidateTag só com posts novos ou atualizados', async () => {
    mockProbe.mockResolvedValue({ ok: true })
    mockSync.mockResolvedValue({ postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0 })
    harness({ accounts: [account()] })
    await GET(req())
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
  })
})

describe('censo de Blob semanal (veio de §3.3)', () => {
  it('> 400 MB => 1 push low com tag package e Click', async () => {
    listMock.mockResolvedValue({ blobs: [{ size: 500 * 1024 * 1024 }], hasMore: false, cursor: undefined })
    harness({ accounts: [] })
    await GET(req())
    const push = mockNtfy.mock.calls.find(([a]) => String(a.title).includes('blob store'))![0]
    expect(push.priority).toBe('low')
    expect(push.tags).toEqual(['package'])
    expect(push.click).toBeTruthy()
    expect(`${push.title} ${push.body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
  })

  it('abaixo da linha => nenhum push de censo', async () => {
    listMock.mockResolvedValue({ blobs: [{ size: 1024 }], hasMore: false, cursor: undefined })
    harness({ accounts: [] })
    await GET(req())
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('blob'))).toBe(false)
  })

  it('teto de 10 páginas => push de TRUNCAMENTO e NENHUMA comparação com o limiar', async () => {
    listMock.mockResolvedValue({ blobs: Array.from({ length: 1000 }, () => ({ size: 1 })), hasMore: true, cursor: 'c' })
    harness({ accounts: [] })
    await GET(req())
    expect(listMock).toHaveBeenCalledTimes(10)
    const push = mockNtfy.mock.calls.find(([a]) => String(a.title).includes('truncated'))![0]
    expect(push.title).toMatch(/^Instagram blob census truncated at \d+ objects$/)
    expect(push.tags).toEqual(['package'])
    expect(mockNtfy.mock.calls.some(([a]) => String(a.title).includes('blob store at'))).toBe(false)
  })

  it('elapsed > 8 s => censo pulado e chave blobsize LIBERADA', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-06T13:00:00Z'), toFake: ['Date'] })
    vi.mocked(resumeStuckDeletionRequest).mockImplementation(async () => {
      vi.advanceTimersByTime(9_000); return false
    })
    const h = harness({ accounts: [] })
    await GET(req())
    expect(listMock).not.toHaveBeenCalled()
    expect(h.released).toContain('blobsize')
  })
})

describe('canal neste cron', () => {
  it('emite a SONDA (chave compartilhada) e NUNCA o heartbeat de 5 dias', async () => {
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_probe_due')
    expect(h.claimed).not.toContain('ntfy_heartbeat_due')
    expect(mockHeartbeat).not.toHaveBeenCalled()
  })

  it('vigilância do carimbo: D-9 => error', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const stampIso = new Date(Date.now() - 9 * 86_400_000).toISOString()
    mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: (_c: string, k: string) => ({ maybeSingle: () => Promise.resolve({ data: k === 'ntfy_heartbeat_ok' ? { last_at: stampIso } : null }) }) }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          upsert: () => Promise.resolve({ error: null }),
        }
      }
      if (table === 'notification_deliveries') {
        return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
      }
      const t = Promise.resolve({ data: [], error: null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
        lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
        update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
      }
      return chain
    })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('error')
    expect(body.error).toContain('no heartbeat accepted')
  })

  it('as chaves de episódio e de step_errors são POR CRON', async () => {
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
    const h = harness({ accounts: [] })
    await GET(req())
    expect(h.claimed).toContain('ntfy_transient:instagram-sync')
    expect(h.claimed).not.toContain('ntfy_transient:instagram-token-refresh')
  })

  it('refresh às 11:00 e sync às 13:00 são DOIS episódios independentes (chaves diferentes, 2 h)', async () => {
    // Prova de forma: as chaves são distintas, então nenhum claim do sync
    // encontra o carimbo do refresh e nenhum run vira "persistente" por isso.
    mockNtfy.mockResolvedValue({ alerted: false, ntfyStatus: 503 })
    const h = harness({ accounts: [] })
    const body = await (await GET(req())).json()
    expect(body.status).toBe('ok')
    expect(h.claimed.filter((k) => k.startsWith('ntfy_transient:'))).toEqual(['ntfy_transient:instagram-sync'])
  })

  it('a retenção de ops_alert_state (ddpage:%/sigreq:%) também roda AQUI', async () => {
    const deleted: string[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ops_alert_state') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
            like: (_c: string, pattern: string) => { deleted.push(pattern); return { lt: () => Promise.resolve({ error: null }) } },
          }),
          upsert: () => Promise.resolve({ error: null }),
        }
      }
      if (table === 'notification_deliveries') {
        return { select: () => ({ eq: () => ({ gt: () => ({ like: () => Promise.resolve({ count: 0, error: null }) }) }) }) }
      }
      const t = Promise.resolve({ data: [], error: null })
      const chain: Record<string, unknown> = {
        select: () => chain, not: () => chain, eq: () => chain, in: () => chain, is: () => chain,
        lt: () => chain, gt: () => chain, order: () => t, limit: () => t, delete: () => chain,
        update: () => chain, insert: () => Promise.resolve({ error: null }), then: t.then.bind(t),
      }
      return chain
    })
    mockRpc.mockImplementation(() => Promise.resolve({ data: true, error: null }))
    await GET(req())
    expect(deleted).toContain('ddpage:%')
    expect(deleted).toContain('sigreq:%')
  })
})

describe('refresh + sync no mesmo dia', () => {
  it('a varredura dedupa: uma notificação e um push por perfil', async () => {
    mockSweep.mockResolvedValue([{ siteId: 'site-1', identityKey: 'o:1', notifications: 1, ntfy: 'sent' }])
    harness({ accounts: [account({ token_error: 'expired', token_error_at: new Date().toISOString() })] })
    const body = await (await GET(req())).json()
    expect(body.alert_channels.alerts).toEqual(['sent'])
    expect(mockSweep).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/api/cron/instagram-sync.test.ts`
Expected: FAIL — `maxDuration` é 120; a rota não faz probes nem censo.

- [ ] **Step 3: Implementar a rota**

Substitua `apps/web/src/app/api/cron/instagram-sync/route.ts` inteiro por:

```ts
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { list } from '@vercel/blob'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { syncInstagramAccount, checkImageCacheHealth } from '@/lib/instagram/sync'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import {
  classifyInstagramError,
  evaluateTransientStreak,
  getVaultKeyOrNull,
  markTokenInvalid,
  probeToken,
  readAccessToken,
  redact,
  sweepTokenAlerts,
  type NtfyOutcome,
} from '@/lib/instagram/token'
import { resumeStuckDeletionRequest, DELETION_BLOB_BUDGET_MS } from '@/lib/instagram/deletion'
import { sendNtfyAlert, isTerminalRefusal, type INtfyResult } from '@/lib/ops/ntfy'
import { claimAlert, readAlertStamp, releaseAlert, touchAlert } from '@/lib/ops/alert-state'
import { NO_SITE_ADMINS_ERROR, fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import type { InstagramAccountRow, InstagramSyncMode } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 180

const HOUR = 3_600_000
const CRON_TAG = 'instagram-sync'
// Absoluto POR DECISÃO: os probes que o precedem são isentos de orçamento e não
// podem empurrar o fim do run. 100 s (era 110) devolvem 17 s de folga contra os
// 180 s, agora que a sonda diária divide este cron.
const SYNC_DEADLINE_MS = 100_000
// Guarda contra RUNAWAY, nunca orçamento: 6 é o ponto de projeto que a
// aritmética de §3.4 fecha (12 × 10 s = 197 s > maxDuration => função morta,
// cron_health mudo e alertas do dia perdidos).
const MAX_PROBES_PER_RUN = 6
const OPTIONAL_GATE_MS = 8_000
const BLOB_WATCH_BYTES = 400 * 1024 * 1024
const BLOB_MAX_PAGES = 10
const BLOB_MAX_MS = 15_000
const RETENTION_MS = 180 * 24 * HOUR
const EPISODE_KEY = `ntfy_transient:${CRON_TAG}`
const HEARTBEAT_STALE_MS = 8 * 24 * HOUR

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // MANTIDO por A/A5 — apagar `mode`/`accountId` é conteúdo de A5, nunca de C2.
  const mode = (req.nextUrl.searchParams.get('mode') ?? 'daily') as InstagramSyncMode
  if (!['daily', 'manual'].includes(mode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }
  const accountId = req.nextUrl.searchParams.get('accountId')

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, `instagram-sync-${mode}`, runId, CRON_TAG, async () => {
    const runStart = Date.now()

    let stepErrors = 0
    let probed = 0
    let synced = 0
    let totalInserted = 0
    let totalUpdated = 0
    let totalCached = 0
    let neverConnected = 0
    let tokenInvalid = 0
    let failedPermanent = 0
    let failedTransient = 0
    let failedInfra = 0
    let deferred = 0

    const refusals: INtfyResult[] = []
    const alertOutcomes: NtfyOutcome[] = []

    async function step(name: string, fn: () => Promise<void>): Promise<void> {
      try {
        await fn()
      } catch (err) {
        stepErrors++
        Sentry.captureException(err, { tags: { component: CRON_TAG, step: name } })
      }
    }

    function noteDelivery(result: INtfyResult): void {
      if (!result.alerted && result.reason !== 'NTFY_URL unset') refusals.push(result)
    }

    // passo 0: vazio (ver §3.3 — nada de rede antes do passo 1)

    // passo 1: flags
    const isProduction = process.env.VERCEL_ENV === 'production'
    const alertChannelUnset = !process.env.NTFY_URL
    const vaultDown = getVaultKeyOrNull() === null

    // passo 2: select
    let query = supabase
      .from('instagram_accounts')
      .select('*')
      .order('last_synced_at', { ascending: true, nullsFirst: true })
    if (accountId) query = query.eq('id', accountId)
    const { data: accountsData, error: selectError } = await query
    if (selectError) {
      return { status: 'error' as const, error: `select failed: ${selectError.message}` }
    }
    const accounts = (accountsData ?? []) as InstagramAccountRow[]

    // passo 3: independentes (retenção + retomada + CENSO DE BLOB)
    await step('retention', async () => {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
      await supabase.from('instagram_sync_log').delete().lt('created_at', cutoff)
      await supabase.from('instagram_deletion_requests').delete().lt('requested_at', cutoff)
      const twoDays = new Date(Date.now() - 2 * 24 * HOUR).toISOString()
      await supabase.from('ops_alert_state').delete().like('key', 'ddpage:%').lt('last_at', twoDays)
      await supabase.from('ops_alert_state').delete().like('key', 'sigreq:%').lt('last_at', twoDays)
    })

    await step('resume-deletion', async () => {
      await resumeStuckDeletionRequest(supabase, runStart + DELETION_BLOB_BUDGET_MS)
    })

    await step('blob-census', async () => {
      if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
        await releaseAlert(supabase, 'blobsize')
        return
      }
      if (!(await claimAlert(supabase, 'blobsize', '6 days 23 hours'))) return
      if (Date.now() - runStart >= OPTIONAL_GATE_MS) {
        await releaseAlert(supabase, 'blobsize')
        return
      }

      const censusStart = Date.now()
      const click = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`
      let total = 0
      let objects = 0
      let pages = 0
      let cursor: string | undefined
      let truncated = false

      for (;;) {
        if (pages >= BLOB_MAX_PAGES || Date.now() - censusStart >= BLOB_MAX_MS) {
          truncated = true
          break
        }
        const page = await list({ prefix: 'instagram/', cursor, limit: 1000 })
        pages++
        for (const blob of page.blobs) {
          total += blob.size
          objects++
        }
        if (!page.hasMore) break
        cursor = page.cursor
      }

      if (truncated) {
        // MUST: comparar uma soma sabidamente parcial faria o monitor emudecer
        // exatamente quando o que ele vigia cresce.
        noteDelivery(
          await sendNtfyAlert({
            title: `Instagram blob census truncated at ${objects} objects`,
            body: 'The instagram/ census hit its page/time cap — no size comparison was made. See the runbook.',
            priority: 'low',
            tags: ['package'],
            click,
          }),
        )
        return
      }
      if (total > BLOB_WATCH_BYTES) {
        noteDelivery(
          await sendNtfyAlert({
            title: `Instagram blob store at ${Math.round(total / (1024 * 1024))} MB`,
            body: 'Prefix instagram/ is above the 400 MB watch line. See the runbook.',
            priority: 'low',
            tags: ['package'],
            click,
          }),
        )
      }
    })

    // ── PROBES: toda conta com token, ISENTAS de deadline e de orçamento ────
    const withToken = accounts.filter((a) => a.access_token != null)

    if (withToken.length > MAX_PROBES_PER_RUN) {
      // Condição de FROTA, nunca de descarte: é acima do ponto de projeto que a
      // aritmética de maxDuration MUST ser refeita.
      await step('probe-starved', async () => {
        if (await claimAlert(supabase, 'probe_starved', '23 hours')) {
          Sentry.captureMessage('instagram probe fleet exceeds design point', 'warning')
        }
      })
    }

    const probeTargets = withToken.slice(0, MAX_PROBES_PER_RUN)
    const skippedProbes = withToken.slice(MAX_PROBES_PER_RUN)
    deferred += skippedProbes.length

    for (const account of accounts.filter((a) => a.access_token == null)) {
      await step(`never-connected:${account.id}`, async () => {
        if (!(await claimAlert(supabase, `never_connected:${account.id}`, '6 days 23 hours'))) return
        neverConnected++
        const logId = await openSyncRow(supabase, account, 'daily')
        await closeSyncRow(supabase, logId, null, 'never_connected')
      })
    }

    for (const account of probeTargets) {
      if (vaultDown) continue
      await step(`probe:${account.id}`, async () => {
        const { token } = readAccessToken(account)
        if (token === null) {
          await markTokenInvalid(supabase, account, 'decrypt_failed', { fatal: true })
          failedPermanent++
          return
        }

        // `token_error` OU expirado => linha token_invalid; o probe roda assim
        // mesmo (é ele que confirma a recuperação em ≤ 24 h).
        const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : null
        const isExpired = expiresAt !== null && expiresAt <= Date.now()
        if (account.token_error != null || isExpired) {
          tokenInvalid++
          const reason = account.token_error ?? 'expired'
          const logId = await openSyncRow(supabase, account, 'daily')
          await closeSyncRow(supabase, logId, null, `token_invalid: ${redact(reason)}`)
        }

        probed++
        const result = await probeToken(token)
        if (result.ok) return

        const kind = classifyInstagramError(result.error)
        const message = redact(
          result.error instanceof Error ? result.error.message : String(result.error),
        )
        const logId = await openSyncRow(supabase, account, 'daily')
        if (kind === 'infra') {
          await closeSyncRow(supabase, logId, null, `infra: ${message}`)
          failedInfra++
          stepErrors++
        } else if (kind === 'permanent') {
          await closeSyncRow(supabase, logId, null, `permanent: ${message}`)
          await markTokenInvalid(supabase, account, message, { fatal: true })
          failedPermanent++
        } else {
          await closeSyncRow(supabase, logId, null, `transient: ${message}`)
          await evaluateTransientStreak(supabase, account, 'daily')
          failedTransient++
        }
      })
    }

    // ── SYNCS completos, sob deadline. `deferred` custa posts frescos, nunca detecção.
    const deadline = runStart + SYNC_DEADLINE_MS
    const syncTargets = accounts.filter(
      (a) => a.sync_enabled && a.access_token != null && a.token_error == null,
    )

    for (const account of syncTargets) {
      if (Date.now() >= deadline || vaultDown) {
        deferred++
        continue
      }
      await step(`sync:${account.id}`, async () => {
        const { token } = readAccessToken(account)
        if (token === null) return

        const logId = await openSyncRow(supabase, account, mode)
        try {
          const result = await syncInstagramAccount(supabase, account, token, { deadlineAt: deadline })
          synced++
          totalInserted += result.postsInserted
          totalUpdated += result.postsUpdated
          totalCached += result.mediaCached
          await closeSyncRow(supabase, logId, result)
          await checkImageCacheHealth(supabase, account.id)
        } catch (err) {
          const kind = classifyInstagramError(err)
          const message = redact(err instanceof Error ? err.message : String(err))
          if (kind === 'infra') {
            await closeSyncRow(supabase, logId, null, `infra: ${message}`)
            failedInfra++
            if (/duplicate key value.*instagram_posts_ig_media_id_key/.test(message)) {
              // Janela C2→C4 — ramo REMOVIDO em C4.
              if (await claimAlert(supabase, `c2c4dup:${account.id}`, '23 hours')) {
                Sentry.captureMessage('instagram duplicate media in C2→C4 window', 'info')
              }
            } else {
              stepErrors++
              Sentry.captureException(err, { tags: { component: CRON_TAG, account_id: account.id } })
            }
          } else if (kind === 'permanent') {
            await closeSyncRow(supabase, logId, null, `permanent: ${message}`)
            await markTokenInvalid(supabase, account, message, { fatal: true })
            failedPermanent++
          } else {
            await closeSyncRow(supabase, logId, null, `transient: ${message}`)
            await evaluateTransientStreak(supabase, account, 'daily')
            failedTransient++
          }
        }
      })
    }

    if (totalInserted > 0 || totalUpdated > 0) revalidateTag('instagram-feed', { expire: 0 })

    // passo 5: varredura — executa em TODO run
    await step('sweep', async () => {
      for (const r of await sweepTokenAlerts(supabase)) {
        alertOutcomes.push(r.ntfy)
        if (r.ntfy === 'failed_terminal') refusals.push({ alerted: false, ntfyStatus: 403 })
        else if (r.ntfy === 'failed_transient') refusals.push({ alerted: false, ntfyStatus: 503 })
      }
    })

    // passo 5b: só a SONDA (o heartbeat visível é exclusivo do refresh)
    let probeOutcome: NtfyOutcome | 'not_due' = 'not_due'
    await step('ntfy-probe', async () => {
      if (!(await claimAlert(supabase, 'ntfy_probe_due', '23 hours'))) return
      const result = await sendNtfyAlert({
        title: 'Instagram ops probe',
        body: 'channel probe',
        priority: 'min',
        tags: ['mag'],
      })
      probeOutcome = result.alerted
        ? 'sent'
        : result.reason === 'NTFY_URL unset'
          ? 'skipped'
          : isTerminalRefusal(result)
            ? 'failed_terminal'
            : 'failed_transient'
      noteDelivery(result)
      if (result.alerted) await claimAlert(supabase, 'ntfy_heartbeat_ok', '0')
      else await releaseAlert(supabase, 'ntfy_probe_due')
    })

    // passo 6
    if (stepErrors > 0) {
      await step('step-errors-push', async () => {
        if (!(await claimAlert(supabase, `step_errors:${CRON_TAG}`, '23 hours'))) return
        noteDelivery(
          await sendNtfyAlert({
            title: 'Instagram cron degraded',
            body: `${stepErrors} step(s) failed — see Sentry`,
            priority: 'default',
            tags: ['warning'],
            click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
          }),
        )
      })
    }

    // passo 7 — idêntico ao do refresh, com as chaves DESTE cron
    const terminalRefusal = refusals.find((r) => isTerminalRefusal(r))
    let transientPersistent = false

    await step('channel-episode', async () => {
      if (refusals.length === 0) {
        await releaseAlert(supabase, EPISODE_KEY)
        return
      }
      if (await claimAlert(supabase, EPISODE_KEY, '365 days')) return
      const stamp = await readAlertStamp(supabase, EPISODE_KEY)
      if (!stamp) return
      const age = Date.now() - stamp.getTime()
      if (age >= 20 * HOUR && age <= 30 * HOUR) {
        transientPersistent = true
        await touchAlert(supabase, EPISODE_KEY)
      } else if (age > 30 * HOUR) {
        await touchAlert(supabase, EPISODE_KEY)
      }
    })

    let heartbeatStale = false
    await step('heartbeat-watch', async () => {
      const stamp = await readAlertStamp(supabase, 'ntfy_heartbeat_ok')
      if (stamp && Date.now() - stamp.getTime() > HEARTBEAT_STALE_MS) heartbeatStale = true
    })

    let fallbackEmailDead = false
    await step('dead-fallback-email', async () => {
      const { count } = await supabase
        .from('notification_deliveries')
        .select('id, notifications!inner(dedup_key)', { count: 'exact', head: true })
        .eq('status', 'dead')
        .gt('created_at', new Date(Date.now() - 2 * 24 * HOUR).toISOString())
        .like('notifications.dedup_key', 'instagram-alert-channel-down:%')
      if ((count ?? 0) > 0) fallbackEmailDead = true
    })

    const causes: string[] = []
    if (alertChannelUnset) causes.push('alert channel down: NTFY_URL unset')
    if (terminalRefusal) {
      causes.push(`alert channel down: terminal refusal (HTTP ${terminalRefusal.ntfyStatus ?? 'unknown'})`)
    }
    if (transientPersistent) causes.push('alert channel down: transient for 2 runs')
    if (heartbeatStale) causes.push('alert channel down: no heartbeat accepted for 8d')
    if (fallbackEmailDead) causes.push('alert channel down: fallback email dead')
    if (vaultDown) causes.push('vault unavailable: SOCIAL_MASTER_KEY missing/malformed')

    const shouldEscalate =
      isProduction &&
      (alertChannelUnset ||
        Boolean(terminalRefusal) ||
        transientPersistent ||
        heartbeatStale ||
        fallbackEmailDead ||
        vaultDown)

    if (shouldEscalate) {
      await step('second-channel', async () => {
        for (const siteId of [...new Set(accounts.map((a) => a.site_id))]) {
          const fan = await fanOutToSiteAdminsDetailed({
            siteId,
            domain: 'system',
            type: 'system.cron_failure',
            priority: 5,
            title: vaultDown ? 'Instagram token storage unavailable' : 'Instagram alert channel down',
            message: causes.join(' · '),
            dedupKey: `instagram-alert-channel-down:${new Date().toISOString().slice(0, 10)}`,
            defaultChannels: ['email'],
          })
          if (fan.total === 0) {
            stepErrors++
            causes.push(NO_SITE_ADMINS_ERROR)
          }
        }
      })
    }

    const status = shouldEscalate ? ('error' as const) : ('ok' as const)

    return {
      status,
      ...(status === 'error' ? { error: causes.join(' · ') } : {}),
      mode,
      probed,
      synced,
      inserted: totalInserted,
      updated: totalUpdated,
      cached: totalCached,
      never_connected: neverConnected,
      token_invalid: tokenInvalid,
      failed_permanent: failedPermanent,
      failed_transient: failedTransient,
      failed_infra: failedInfra,
      still_broken: accounts.filter((a) => a.token_error_at != null).length,
      deferred,
      step_errors: stepErrors,
      alert_channels: { probe: probeOutcome, alerts: alertOutcomes },
    }
  })
}
```

- [ ] **Step 4: Alinhar `test/instagram/cron-route.test.ts`**

Acrescente `// @vitest-environment node` na primeira linha, troque as asserções de resposta (`inserted`/`updated`/`cached` continuam; acrescente `probed`/`synced`) e faça o mock de `@/lib/instagram/sync` exportar também `checkImageCacheHealth` e `MAX_IMAGE_BYTES`. **Não** mexa no `?mode=` da linha 30 — isso é conteúdo de A5.

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test --workspace=apps/web -- test/api/cron/instagram-sync.test.ts
npm test --workspace=apps/web -- test/instagram/cron-route.test.ts
```
Expected: PASS.

- [ ] **Step 6: REGRA-PII-NTFY — a asserção ÚNICA e emissor-agnóstica (MUST, §4/§6)**

O último emissor de C2 (censo de Blob) acabou de nascer, então a tabela dos **7** pode ser escrita agora. Acrescente ao fim de `apps/web/test/api/cron/ntfy.test.ts`:

```ts
// ── REGRA-PII-NTFY (§0) — asserção ÚNICA, emissor-agnóstica ────────────────
// MUST: substitui qualquer checagem por emissor. Um emissor novo sem entrada
// aqui derruba o teste pela asserção de tamanho.
//
// As fixtures usam handle:'thiago.figueiredo', ig_user_id:'17841400000000000' e
// token_error:'The session has been invalidated because the user changed their
// password', de modo que a asserção falha se qualquer campo voltar a carregá-los.
describe('REGRA-PII-NTFY: nenhum dos 7 emissores carrega @handle nem ids', () => {
  const HANDLE = 'thiago.figueiredo'
  const IG_USER_ID = '17841400000000000'
  const SLUG = 'bythiagofigueiredo'

  const EMITTERS: Array<{ emitter: string; title: string; body: string }> = [
    // §3.1 passo 4 — signature mismatch (rota de C3; a string é fixada aqui)
    {
      emitter: 'signature-mismatch',
      title: 'Instagram callback signature mismatch',
      body: 'Check Sentry for the route and secret tag.',
    },
    // §3.1 passo 7 — ddmismatch (rota de C3; a string é fixada aqui)
    {
      emitter: 'ddmismatch',
      title: 'Instagram deletion request matched no account',
      body: 'possible ID-space mismatch — see the runbook',
    },
    // §3.2 — deliverTokenAlert (ntfyTitle usa o SLUG, nunca `· @h`)
    {
      emitter: 'deliverTokenAlert',
      title: `Instagram auto-renewal still failing · ${SLUG}`,
      body: '3 account(s) · open since 2026-09-04. Open the CMS for the reason.',
    },
    // §3.3 passo 5b — sonda diária
    { emitter: 'daily-probe', title: 'Instagram ops probe', body: 'channel probe' },
    // §3.3 passo 3 — expiring_clean
    {
      emitter: 'expiring_clean',
      title: `Instagram token expiring without renewal · ${SLUG}`,
      body: '3 day(s) left. Open the CMS to reconnect.',
    },
    // §3.3 passo 6 — step_errors
    {
      emitter: 'step_errors',
      title: 'Instagram cron degraded',
      body: '2 step(s) failed — see Sentry',
    },
    // §3.4 passo 3 — censo de Blob (acima da linha)
    {
      emitter: 'blob-census-over',
      title: 'Instagram blob store at 512 MB',
      body: 'Prefix instagram/ is above the 400 MB watch line. See the runbook.',
    },
    // §3.4 passo 3 — censo de Blob (truncado)
    {
      emitter: 'blob-census-truncated',
      title: 'Instagram blob census truncated at 10000 objects',
      body: 'The instagram/ census hit its page/time cap — no size comparison was made. See the runbook.',
    },
  ]

  it('a tabela cobre exatamente os 7 emissores (o censo conta como UM, nas duas formas)', () => {
    expect(new Set(EMITTERS.map((e) => e.emitter.replace(/^blob-census-.*/, 'blob-census'))).size)
      .toBe(7)
  })

  it.each(EMITTERS)('$emitter não carrega @handle nem sequência de 6+ dígitos', ({ title, body }) => {
    expect(`${title} ${body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${title} ${body}`).not.toMatch(/[0-9]{6,}/)
  })

  it('as fixtures de PII realmente casariam os regexes (o teste não é vácuo)', () => {
    expect(`x @${HANDLE}`).toMatch(/@[a-z0-9._]{1,30}/)
    expect(`x ${IG_USER_ID}`).toMatch(/[0-9]{6,}/)
  })

  it('nenhum título/corpo contém texto vindo da Meta', () => {
    const metaError = 'The session has been invalidated because the user changed their password'
    for (const { title, body } of EMITTERS) {
      expect(`${title} ${body}`).not.toContain(metaError)
      expect(`${title} ${body}`).not.toContain('invalidated')
    }
  })
})

describe('Click: presente nos 7 emissores que o passam, ausente nos 2 que não', () => {
  beforeEach(() => { fetchMock.mockReset(); fetchMock.mockReturnValue(ok(200)) })

  it('a sonda diária e o heartbeat NÃO mandam Click', async () => {
    await sendNtfyAlert({ title: 'Instagram ops probe', body: 'channel probe', priority: 'min', tags: ['mag'] })
    await sendNtfyHeartbeat()
    for (const call of fetchMock.mock.calls) {
      const h = (call[1] as RequestInit).headers as Record<string, string>
      expect(h.Click).toBeUndefined()
    }
  })

  it('todo emissor que passa `click` produz o header Click', async () => {
    await sendNtfyAlert({
      title: 'Instagram cron degraded', body: 'x', priority: 'default', tags: ['warning'],
      click: 'https://bythiagofigueiredo.com/cms/settings/instagram',
    })
    const h = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(h.Click).toBe('https://bythiagofigueiredo.com/cms/settings/instagram')
  })
})
```

Run: `npm test --workspace=apps/web -- test/api/cron/ntfy.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/app/api/cron/instagram-sync/route.ts \
        apps/web/test/api/cron/instagram-sync.test.ts apps/web/test/instagram/cron-route.test.ts \
        apps/web/test/api/cron/ntfy.test.ts
git commit -m "feat(instagram): cron do sync com probe de toda conta e censo semanal de blob"
```

---

### Task 14: Server actions — `requireEditAccess`, `setInstagramToken`, `triggerInstagramSync`, `normalizeHandle`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts` (`requireEditAccess` `:18-27`, os 24 `const siteId = await requireEditAccess()`, `normalizeHandle`, `addInstagramAccount`, `setInstagramToken`, `triggerInstagramSync`)
- Test: `apps/web/test/instagram/actions.test.ts` (estendido; pragma `node`)
- Test: `apps/web/test/app/contact-settings-actions.test.ts` (mock de `requireSiteScope` com `user`)

**Interfaces:**
- Consumes: `getVaultKeyOrNull`, `readAccessToken`, `writeAccessToken`, `markTokenInvalid` (Tarefas 4/8); `oauthErrorText` (Tarefa 2); `syncInstagramAccount` (Tarefa 7); `openSyncRow`/`closeSyncRow` (A).
- Produces:
  ```ts
  async function requireEditAccess(): Promise<{ siteId: string; userId: string }>   // module-private
  // (C3 consome a MESMA forma em disconnectInstagramAccount / authorizeInstagramRebind)
  ```

- [ ] **Step 1: Escrever os testes que falham**

Troque o mock de `requireSiteScope` no topo de `apps/web/test/instagram/actions.test.ts` por (forma literal de `test/cms/settings-actions.test.ts:48`):

```ts
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) },
  }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))
```

e o mesmo em `apps/web/test/app/contact-settings-actions.test.ts:11`:

```ts
  requireSiteScope: () => Promise.resolve({ ok: true, user: { id: 'u1' } }),
```

Depois acrescente ao fim de `test/instagram/actions.test.ts`:

```ts
// ── C2 ───────────────────────────────────────────────────────────────────────
import { encrypt } from '@tn-figueiredo/social/vault'

vi.mock('@/lib/instagram/sync', () => ({
  syncInstagramAccount: vi.fn().mockResolvedValue({
    postsFound: 1, postsInserted: 1, postsUpdated: 0, mediaCached: 1, partial: false, mediaFailed: 0,
  }),
  checkImageCacheHealth: vi.fn(),
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
}))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: vi.fn(() => Promise.resolve('log-1')),
  closeSyncRow: vi.fn(() => Promise.resolve()),
}))
const mockMarkInvalid = vi.fn()
vi.mock('@/lib/instagram/token', async (orig) => ({
  ...(await orig<typeof import('@/lib/instagram/token')>()),
  markTokenInvalid: (...a: unknown[]) => mockMarkInvalid(...a),
}))
vi.mock('@/lib/instagram/api-client', () => ({
  fetchInstagramProfile: vi.fn().mockResolvedValue({ id: '178', userId: '17841', username: 'foo.bar' }),
}))

const KEY_HEX = '0'.repeat(64)

function accountRowClient(row: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = []
  const single = vi.fn(() => Promise.resolve({ data: row, error: row ? null : { message: 'no rows' } }))
  const chain: Record<string, unknown> = {
    select: () => chain, eq: () => chain, single,
    update: (patch: Record<string, unknown>) => { updates.push(patch); return chain },
  }
  return { client: { from: vi.fn(() => chain), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }, updates }
}

describe('requireEditAccess devolve { siteId, userId }', () => {
  it('as actions continuam funcionando com a desestruturação', async () => {
    const { client } = accountRowClient({ id: 'acc-1', site_id: 'site-1' })
    mockGetClient.mockReturnValue(client as never)
    const { removeInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const r = await removeInstagramAccount({ accountId: '00000000-0000-0000-0000-000000000001' })
    expect(r.ok).toBe(true)
  })
})

describe('setInstagramToken (C2)', () => {
  beforeEach(() => { vi.stubEnv('SOCIAL_MASTER_KEY', KEY_HEX) })

  it('cifra com v1:, marca legacy, zera expiry/refreshed e o episódio', async () => {
    const { client, updates } = accountRowClient({ id: 'acc-1', site_id: 'site-1' })
    mockGetClient.mockReturnValue(client as never)
    const { setInstagramToken } = await import('@/app/cms/(authed)/settings/actions')
    const r = await setInstagramToken({
      accountId: '00000000-0000-0000-0000-000000000001', accessToken: 'IGplain',
    })
    expect(r.ok).toBe(true)
    const patch = updates[0]!
    expect(String(patch.access_token).startsWith('v1:')).toBe(true)
    expect(patch.ig_user_id_source).toBe('legacy')
    expect(patch.token_expires_at).toBeNull()
    expect(patch.token_refreshed_at).toBeNull()
    expect(patch).toMatchObject({
      token_error: null, token_error_at: null, token_error_mode: null,
      token_alert_sent_at: null, token_alert_attempt_at: null, token_reprobe_at: null,
    })
  })

  it('sem chave => erro, sem escrita', async () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    const { client, updates } = accountRowClient({ id: 'acc-1', site_id: 'site-1' })
    mockGetClient.mockReturnValue(client as never)
    const { setInstagramToken } = await import('@/app/cms/(authed)/settings/actions')
    const r = await setInstagramToken({
      accountId: '00000000-0000-0000-0000-000000000001', accessToken: 'IGplain',
    })
    expect(r.ok).toBe(false)
    expect(updates).toHaveLength(0)
  })
})

describe('triggerInstagramSync (C2)', () => {
  beforeEach(() => { vi.stubEnv('SOCIAL_MASTER_KEY', KEY_HEX) })

  it('vault ausente => vault_unavailable, sem tocar a conta', async () => {
    vi.stubEnv('SOCIAL_MASTER_KEY', '')
    const { client, updates } = accountRowClient({ id: 'acc-1', site_id: 'site-1', access_token: 'v1:x' })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const r = await triggerInstagramSync({ accountId: '00000000-0000-0000-0000-000000000001' })
    expect(r).toEqual({ ok: false, error: "Token storage isn't configured — see the Instagram setup runbook" })
    expect(updates).toHaveLength(0)
    expect(mockMarkInvalid).not.toHaveBeenCalled()
  })

  it('access_token nulo => "not connected", sem tocar a conta', async () => {
    const { client, updates } = accountRowClient({ id: 'acc-1', site_id: 'site-1', access_token: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const r = await triggerInstagramSync({ accountId: '00000000-0000-0000-0000-000000000001' })
    expect(r.ok).toBe(false)
    expect(String((r as { error: string }).error))
      .toBe("This account isn't connected — use Connect with Instagram")
    expect(updates).toHaveLength(0)
  })

  it('v1: corrompido => markTokenInvalid decrypt_failed + mensagem própria', async () => {
    const { client } = accountRowClient({ id: 'acc-1', site_id: 'site-1', access_token: 'v1:AAAA' })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const r = await triggerInstagramSync({ accountId: '00000000-0000-0000-0000-000000000001' })
    expect(mockMarkInvalid).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'decrypt_failed', { fatal: true },
    )
    expect(String((r as { error: string }).error)).toBe("Stored token can't be read — reconnect")
  })

  it('token válido => syncInstagramAccount recebe o token DECIFRADO no 3º argumento', async () => {
    const stored = `v1:${encrypt('IGplain', Buffer.from(KEY_HEX, 'hex'))}`
    const { client } = accountRowClient({
      id: 'acc-1', site_id: 'site-1', ig_user_id: '178', access_token: stored,
    })
    mockGetClient.mockReturnValue(client as never)
    const { syncInstagramAccount } = await import('@/lib/instagram/sync')
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const r = await triggerInstagramSync({ accountId: '00000000-0000-0000-0000-000000000001' })
    expect(r.ok).toBe(true)
    expect(vi.mocked(syncInstagramAccount).mock.calls[0]![2]).toBe('IGplain')
  })
})

describe('normalizeHandle antes do Zod (ordem invertida)', () => {
  it.each([
    ['@Foo.Bar', 'foo.bar'],
    ['https://www.instagram.com/Foo.Bar/', 'foo.bar'],
    ['Foo.Bar', 'foo.bar'],
  ])('%s => %s', async (input, expected) => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a' }, error: null }) }),
    })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: insertFn }) } as never)
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const r = await addInstagramAccount({ handle: input, locale: 'pt' })
    expect(r.ok).toBe(true)
    expect((insertFn.mock.calls[0]![0] as { handle: string }).handle).toBe(expected)
  })

  it('URL LONGA (antes rejeitada pelo max(50)) passa a ser aceita', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'a' }, error: null }) }),
    })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: insertFn }) } as never)
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const long = 'https://www.instagram.com/thiago.figueiredo/?hl=pt-br&utm_source=ig_web_button_share_sheet'
    const r = await addInstagramAccount({ handle: long, locale: 'pt' })
    expect(r.ok).toBe(true)
    expect((insertFn.mock.calls[0]![0] as { handle: string }).handle).toBe('thiago.figueiredo')
  })

  it('handle fora de ^[a-z0-9._]{1,30}$ após normalizar => erro', async () => {
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    expect((await addInstagramAccount({ handle: 'foo bar!', locale: 'pt' })).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test --workspace=apps/web -- test/instagram/actions.test.ts
```
Expected: FAIL — `setInstagramToken` grava texto puro; `triggerInstagramSync` faz `fetch`; `normalizeHandle` não abaixa a caixa.

- [ ] **Step 3: `requireEditAccess` → `{ siteId, userId }`**

Em `apps/web/src/app/cms/(authed)/settings/actions.ts`, troque `:18-27` por:

```ts
async function requireEditAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  // Forma de src/lib/social/actions/_shared.ts:17,25 — C3 consome `userId` em
  // authorizeInstagramRebind (assinatura do cookie de rebind).
  return { siteId, userId: res.user.id }
}
```

E atualize os **24** call-sites com uma substituição mecânica (confira o `git diff` depois):

```bash
cd apps/web && perl -pi -e 's/const siteId = await requireEditAccess\(\)/const { siteId } = await requireEditAccess()/g' "src/app/cms/(authed)/settings/actions.ts"
grep -c 'const { siteId } = await requireEditAccess()' "src/app/cms/(authed)/settings/actions.ts"   # esperado: 24 (ou 26 depois de A)
```

- [ ] **Step 4: `normalizeHandle` + ordem invertida em `addInstagramAccount`**

```ts
const instagramAccountSchema = z.object({
  // Depois de normalizar, o handle já está minúsculo e sem URL — o regex é a
  // mesma forma que §3.1 passo 7 exige do /me.
  handle: z.string().regex(/^[a-z0-9._]{1,30}$/, 'Invalid Instagram handle'),
  locale: z.enum(['pt', 'en', 'all']),
})

function normalizeHandle(raw: string): string {
  const stripped = raw.replace(/^@/, '').trim()
  try {
    const url = new URL(stripped.startsWith('http') ? stripped : `https://${stripped}`)
    if (url.hostname.includes('instagram.com')) {
      return url.pathname.replace(/^\//, '').replace(/\/$/, '').toLowerCase()
    }
  } catch { /* not a URL */ }
  return stripped.toLowerCase()
}
```

e no corpo de `addInstagramAccount`, **normalizar antes do `safeParse`** (MUST — inverte a ordem atual):

```ts
export async function addInstagramAccount(input: {
  handle: string
  locale: string
}): Promise<ActionResult> {
  // MUST: normalizar PRIMEIRO. Com a ordem antiga, o max(50) rejeitava URLs
  // longas legítimas antes de a extração de path acontecer.
  const parsed = instagramAccountSchema.safeParse({
    handle: normalizeHandle(input.handle),
    locale: input.locale,
  })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('instagram_accounts')
    .insert({ site_id: siteId, handle: parsed.data.handle, locale: parsed.data.locale })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}
```

- [ ] **Step 5: `setInstagramToken` cifrando**

```ts
export async function setInstagramToken(input: {
  accountId: string
  accessToken: string
}): Promise<ActionResult> {
  const parsed = instagramTokenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { getVaultKeyOrNull, writeAccessToken } = await import('@/lib/instagram/token')
  const { oauthErrorText } = await import('@/lib/instagram/status-text')
  if (getVaultKeyOrNull() === null) {
    return { ok: false, error: oauthErrorText('vault_unavailable') }
  }

  let igUserId: string
  try {
    const { fetchInstagramProfile } = await import('@/lib/instagram/api-client')
    const profile = await fetchInstagramProfile(parsed.data.accessToken)
    if (!profile.id) {
      return { ok: false, error: 'Invalid token — could not fetch Instagram profile' }
    }
    igUserId = profile.id
  } catch {
    return { ok: false, error: 'Invalid token — could not fetch Instagram profile' }
  }

  const { error } = await supabase
    .from('instagram_accounts')
    .update({
      access_token: writeAccessToken(parsed.data.accessToken),
      ig_user_id: igUserId,
      // O id vem do /me do app que emitiu o token COLADO — outro espaço de ids.
      ig_user_id_source: 'legacy',
      // A vida restante de um token colado é desconhecida.
      token_expires_at: null,
      // MUST NULL: a regra das 24 h da Meta é sobre a idade do TOKEN, não da
      // nossa coluna. Carimbar now() criava um blecaute de renovação de ~48 h
      // no caminho que a spec chama de fallback permanente.
      token_refreshed_at: null,
      token_error: null,
      token_error_at: null,
      token_error_mode: null,
      token_alert_sent_at: null,
      token_alert_attempt_at: null,
      token_reprobe_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.accountId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/settings')
  return { ok: true }
}
```

- [ ] **Step 6: `triggerInstagramSync` decifrando**

```ts
export async function triggerInstagramSync(input: {
  accountId: string
}): Promise<SyncActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const { siteId } = await requireEditAccess()

  const { getVaultKeyOrNull, readAccessToken, markTokenInvalid } =
    await import('@/lib/instagram/token')
  const { oauthErrorText } = await import('@/lib/instagram/status-text')
  if (getVaultKeyOrNull() === null) {
    return { ok: false, error: oauthErrorText('vault_unavailable') }
  }

  const supabase = getSupabaseServiceClient()
  // A2: a linha inteira, tipada, com escopo de site provado.
  const { data: row, error: rowError } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('id', parsed.data.accountId)
    .eq('site_id', siteId)
    .single()
  if (rowError || !row) return { ok: false, error: 'Account not found' }

  const account = row as InstagramAccountRow
  if (account.access_token == null) {
    return { ok: false, error: "This account isn't connected — use Connect with Instagram" }
  }

  const { token } = readAccessToken(account)
  if (token === null) {
    await markTokenInvalid(supabase, account, 'decrypt_failed', { fatal: true })
    return { ok: false, error: "Stored token can't be read — reconnect" }
  }

  const { syncInstagramAccount } = await import('@/lib/instagram/sync')
  const { openSyncRow, closeSyncRow } = await import('@/lib/instagram/sync-log')
  const start = Date.now()
  const logId = await openSyncRow(supabase, account, 'manual')
  try {
    const result = await syncInstagramAccount(supabase, account, token, {
      deadlineAt: start + 90_000,
    })
    // closeSyncRow SEMPRE — nunca Promise.race.
    await closeSyncRow(supabase, logId, result)
    if (result.postsInserted > 0 || result.postsUpdated > 0) {
      revalidateTag('instagram-feed', { expire: 0 })
    }
    revalidatePath('/cms/settings')
    return result.partial ? { ok: true, partial: true } : { ok: true }
  } catch (err) {
    const { redact } = await import('@/lib/instagram/token')
    await closeSyncRow(supabase, logId, null, redact(String(err)))
    return { ok: false, error: err instanceof Error ? err.message : 'Sync failed' }
  }
}
```

> **Ramo A5 = `fix(instagram): restore HTTP transport for Sync Now`:** se o gate de herança de `maxDuration` tiver REPROVADO, A5 já devolveu o `fetch` autenticado a esta action. Nesse caso mantenha **tudo acima até a linha do `readAccessToken` inclusive** (o portão de vault e a mensagem de `decrypt_failed` continuam sendo desta action) e substitua o bloco `syncInstagramAccount(...)`/`openSyncRow`/`closeSyncRow` pelo `fetch` que A5 entregou — o token em claro **não** viaja no HTTP; a rota do cron decifra a própria linha.

`SyncActionResult` já foi introduzido por A (`actions.ts:11`); o `ActionResult` normal não admite `partial`.

- [ ] **Step 7: Rodar e ver passar**

```bash
npm test --workspace=apps/web -- test/instagram/actions.test.ts
npm test --workspace=apps/web -- test/app/contact-settings-actions.test.ts
npm test --workspace=apps/web -- test/cms
npm test --workspace=apps/web -- test/unit/use-server-exports.test.ts
```
Expected: PASS nos quatro (o último é o ratchet Next 16 — `requireEditAccess` continua module-private, então nenhum export novo entra no arquivo `'use server'`).

- [ ] **Step 8: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add "apps/web/src/app/cms/(authed)/settings/actions.ts" \
        apps/web/test/instagram/actions.test.ts apps/web/test/app/contact-settings-actions.test.ts
git commit -m "feat(instagram): cifrar token colado, decifrar no Sync Now e requireEditAccess com userId"
```

---

### Task 15: Rota curta `/cms/settings/instagram`

**Files:**
- Create: `apps/web/src/app/cms/(authed)/settings/instagram/page.tsx`
- Test: `apps/web/test/cms/settings/instagram-short-route.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: a rota que o header `Click` do ntfy e o `action_href` das notificações (Tarefa 10) já apontam.

**Por que em C2 e não em C3:** `deliverTokenAlert` já emite `click: ${APP_URL}/cms/settings/instagram` e `actionHref: '/cms/settings/instagram'` neste commit. Sem a rota, o primeiro alerta real leva o dono a um 404.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// apps/web/test/cms/settings/instagram-short-route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn((href: string) => { throw new Error(`NEXT_REDIRECT:${href}`) })
vi.mock('next/navigation', () => ({ redirect: (href: string) => redirectMock(href) }))

beforeEach(() => { redirectMock.mockClear() })

describe('/cms/settings/instagram', () => {
  it('redireciona para /cms/settings?section=instagram', async () => {
    const mod = await import('@/app/cms/(authed)/settings/instagram/page')
    expect(() => (mod.default as () => unknown)()).toThrow(/NEXT_REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/cms/settings?section=instagram')
  })

  it('o middleware de auth guarda só o pathname, então o next= aponta para a rota curta', () => {
    // create-auth-middleware.js:21,42,51-54 grava `next` sem a query — é por
    // isto que a rota curta existe em vez de o Click apontar para
    // /cms/settings?section=instagram direto.
    expect('/cms/settings/instagram').not.toContain('?')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/cms/settings/instagram-short-route.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```tsx
// apps/web/src/app/cms/(authed)/settings/instagram/page.tsx
import { redirect } from 'next/navigation'

// Rota CURTA de propósito: o middleware de auth grava `next` só com o pathname
// (create-auth-middleware.js:21,42,51-54), então um Click para
// /cms/settings?section=instagram perderia a seção depois do login.
// settings-connected.tsx:1244 lê `section`.
export const dynamic = 'force-dynamic'

export default function InstagramSettingsShortcut(): never {
  redirect('/cms/settings?section=instagram')
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/cms/settings/instagram-short-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add "apps/web/src/app/cms/(authed)/settings/instagram/page.tsx" \
        apps/web/test/cms/settings/instagram-short-route.test.ts
git commit -m "feat(cms): rota curta /cms/settings/instagram para o Click do alerta"
```

---

### Task 16: `vercel.json` — agenda diária + ratchet por path

**Files:**
- Modify: `apps/web/vercel.json:16-17`
- Test: `apps/web/test/api/cron/vercel-get-export-guard.test.ts` (estendido)

**Interfaces:**
- Consumes: `loadCrons()` já existente no teste.
- Produces: nada em código de app.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao fim de `apps/web/test/api/cron/vercel-get-export-guard.test.ts`, **fora** do `describe` existente:

```ts
describe('Ratchet de agenda dos crons do Instagram (C2)', () => {
  const crons = loadCrons()

  function scheduleFor(path: string): string | undefined {
    return crons.find((c) => c.path === path)?.schedule
  }

  // Aceitar também o valor antigo deixaria passar VERDE um revert acidental de
  // vercel.json — a única linha que C2 edita — e o "≤ 24 h" do objetivo 2
  // viraria "≤ 7 dias" em silêncio. Por PATH, porque '0 11 * * *' já existe em
  // outra entrada (/api/cron/ab-backfill).
  it("instagram-token-refresh roda '0 11 * * *' (08:00 America/Sao_Paulo)", () => {
    expect(scheduleFor('/api/cron/instagram-token-refresh')).toBe('0 11 * * *')
  })

  it("instagram-sync roda '0 13 * * *' (10:00 America/Sao_Paulo)", () => {
    expect(scheduleFor('/api/cron/instagram-sync')).toBe('0 13 * * *')
  })

  it('nenhum dos dois ficou com a agenda antiga', () => {
    expect(scheduleFor('/api/cron/instagram-token-refresh')).not.toBe('0 6 * * 1')
    expect(scheduleFor('/api/cron/instagram-sync')).not.toBe('0 8 * * *')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/api/cron/vercel-get-export-guard.test.ts`
Expected: FAIL — recebido `'0 8 * * *'` e `'0 6 * * 1'`.

- [ ] **Step 3: Implementar**

Em `apps/web/vercel.json`, troque as linhas 16-17 por:

```json
    { "path": "/api/cron/instagram-sync", "schedule": "0 13 * * *" },
    { "path": "/api/cron/instagram-token-refresh", "schedule": "0 11 * * *" },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/api/cron/vercel-get-export-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/vercel.json apps/web/test/api/cron/vercel-get-export-guard.test.ts
git commit -m "chore(cron): instagram refresh 11:00 e sync 13:00 UTC com ratchet por path"
```

> **Saída de emergência (§7):** reverter `vercel.json` para `"0 6 * * 1"` exige editar **estas asserções no mesmo commit** — é deliberado: o ratchet força um push de código consciente em vez de um revert silencioso.

---

### Task 17: `env.ts`, arquivos de exemplo e o ratchet de 5 chaves

**Files:**
- Modify: `apps/web/src/lib/env.ts` (`serverSchema`)
- Modify: `apps/web/.env.example`
- Modify: `apps/web/.env.local.example`
- Test: `apps/web/test/lib/env.test.ts` (estendido)

**Interfaces:**
- Consumes: nada.
- Produces: `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` declarados `.optional()` em `serverSchema` (paridade — são lidos de `process.env` direto pelas rotas de C3).

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `apps/web/test/lib/env.test.ts`:

```ts
describe('env examples documentam as 5 chaves do Instagram OAuth (C2)', () => {
  const files = [
    resolve(__dirname, '../../.env.example'),
    resolve(__dirname, '../../.env.local.example'),
  ];

  const KEYS = [
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'INSTAGRAM_ALLOW_META_SECRET_FALLBACK',
    'NTFY_URL',
    'SOCIAL_MASTER_KEY',
  ];

  it('os dois arquivos existem', () => {
    for (const f of files) expect(existsSync(f), f).toBe(true);
  });

  it('as 5 chaves aparecem nos DOIS arquivos', () => {
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const key of KEYS) {
        expect(new RegExp(`^${key}=`, 'm').test(s), `${key} em ${f}`).toBe(true);
      }
    }
  });

  it('nenhum arquivo de exemplo traz VALOR para as chaves secretas', () => {
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const key of ['INSTAGRAM_APP_SECRET', 'SOCIAL_MASTER_KEY']) {
        const line = s.split('\n').find((l) => l.startsWith(`${key}=`)) ?? '';
        const value = line.slice(key.length + 1).split('#')[0]!.trim();
        expect(value, `${key} em ${f}`).toBe('');
      }
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/web -- test/lib/env.test.ts`
Expected: FAIL — nenhuma das 5 chaves está em `.env.local.example`; só `SOCIAL_MASTER_KEY` está em `.env.example`.

- [ ] **Step 3: Implementar — `serverSchema`**

Em `apps/web/src/lib/env.ts`, logo depois de `UPTIME_PROBE_TARGET`:

```ts
  // Instagram Login (feed da home). Lidos de process.env DIRETO pelas rotas de
  // OAuth — getServerEnv() lançaria em qualquer ambiente sem as obrigatórias.
  // Declarados aqui só por paridade de schema. SOCIAL_MASTER_KEY fica FORA
  // deste schema de propósito (é lido por @tn-figueiredo/social/vault).
  INSTAGRAM_APP_ID: z.string().min(1).optional(),
  INSTAGRAM_APP_SECRET: z.string().min(1).optional(),
  INSTAGRAM_ALLOW_META_SECRET_FALLBACK: z.string().optional(),
```

- [ ] **Step 4: Implementar — os dois arquivos de exemplo**

Acrescente este bloco ao fim de **`apps/web/.env.example`** e de **`apps/web/.env.local.example`** (em `.env.example` a linha `SOCIAL_MASTER_KEY=` já existe em `:98` — não duplique, só mova o comentário se quiser):

```bash
# ── Instagram feed: OAuth + renovação observável ─────────────────────────────
# App Dashboard > Instagram > API setup with Instagram login > 3. Set up
# Instagram business login > Business login settings (Instagram App ID = client_id).
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
# Rollout only: aceita META_APP_SECRET na verificação do signed_request até
# 2026-10-06 (META_SECRET_FALLBACK_DEADLINE_MS). Desligue depois.
INSTAGRAM_ALLOW_META_SECRET_FALLBACK=
# Tópico ntfy do canal de garantia (alerta de token, sonda diária, heartbeat,
# uptime-probe). Pode trazer basic-auth na própria URL
# (https://user:senha@ntfy.example/topico) — sendNtfyAlert extrai e manda em header.
NTFY_URL=
# 32 bytes hex (openssl rand -hex 32) — cifra o access_token em repouso.
# Deliberadamente FORA de src/lib/env.ts.
SOCIAL_MASTER_KEY=
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test --workspace=apps/web -- test/lib/env.test.ts`
Expected: PASS.

- [ ] **Step 6: Confirmar que nenhum segredo real entrou**

```bash
git diff --cached -- apps/web/.env.example apps/web/.env.local.example | grep -E '^\+[A-Z_]+=.+' || echo 'OK: nenhuma chave com valor'
```
Expected: `OK: nenhuma chave com valor`.

- [ ] **Step 7: Typecheck e commit**

```bash
npm run typecheck --workspace=apps/web
git add apps/web/src/lib/env.ts apps/web/.env.example apps/web/.env.local.example \
        apps/web/test/lib/env.test.ts
git commit -m "chore(env): declarar INSTAGRAM_* e ratchetar as 5 chaves nos dois exemplos"
```

---

### Task 18: Terceira perna — `.github/workflows/health-watch.yml` + `check.sh`

**Files:**
- Create: `.github/workflows/health-watch.yml`
- Modify: `docs/ops/cron-watchdog/check.sh`
- **NÃO TOCAR:** `.github/workflows/uptime.yml`

**Interfaces:**
- Consumes: `GET /api/health` (campos `status`, `crons[].status`, `crons[].name`, `unknownNames` — conferidos em `health/route.ts:340-347`); `secrets.CRON_SECRET`, `secrets.NTFY_URL`.
- Produces: um terceiro agendador, fora da Vercel **e** fora do home-lab.

**Por que arquivo NOVO (MUST):** a supressão de alerta de `uptime.yml` lê a **conclusão da run**, não a do job (`:111-113`, laço `:116-122`). Um segundo job que falha marca a run inteira como `failure` e (a) infla o `prior_streak` do job `check` — uma queda **real** de `/robots.txt` cairia em `new_streak = N+1`, que não é `1` nem múltiplo de `REALERT_EVERY_N_RUNS=6` ⇒ **nenhum push de queda** — e (b) na recuperação dispara um `uptime-watchdog: recuperado` falso. O terceiro agendador **MUST NOT** custar o segundo.

- [ ] **Step 1: Criar o workflow**

```yaml
# .github/workflows/health-watch.yml
#
# Terceira perna do canal de garantia (spec §2, objetivo 6): um agendador fora
# da Vercel E fora do home-lab, para a classe "o cron parou de rodar" — morte
# por maxDuration, CRON_SECRET rotacionado, crons desabilitados pela Vercel.
#
# MUST: arquivo NOVO. Um job a mais em uptime.yml quebraria a supressão de lá,
# que lê a conclusão da RUN (uptime.yml:111-113) e não a do job.
name: Health Watch

on:
  schedule:
    # */15 e não */5: o alvo é "o cron parou", cuja menor grace é 15 min
    # (computeGraceMinutes, piso MIN_GRACE_MINUTES = 15). Sondar a cada 5 min
    # não antecipa nada e triplica o ruído.
    - cron: '*/15 * * * *'
  workflow_dispatch: {}

permissions:
  actions: read
  contents: read

concurrency:
  group: health-watch
  cancel-in-progress: false

env:
  HEALTH_URL: https://bythiagofigueiredo.com/api/health
  REALERT_AFTER_SECONDS: 21600 # 6 h => teto de 4 pushes/dia enquanto "not ok"

jobs:
  watch:
    name: Probe /api/health and alert on transitions
    runs-on: ubuntu-latest
    steps:
      - name: Restore previous state
        id: cache
        uses: actions/cache@v4
        with:
          path: .health-watch-state
          key: health-watch-state-${{ github.run_id }}
          restore-keys: health-watch-state-

      - name: Probe /api/health
        id: probe
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
        run: |
          set -uo pipefail
          # O corpo NUNCA é ecoado: repositório público, logs de Actions
          # mundialmente legíveis, e `lastError` carrega strings como
          # 'alert channel down: terminal refusal (HTTP <n>)'.
          http_code="$(curl --silent --show-error --max-time 20 \
            -H "Authorization: Bearer ${CRON_SECRET}" \
            -o "$RUNNER_TEMP/health.json" \
            -w '%{http_code}' "$HEALTH_URL" || echo '000')"

          status="$(jq -r '.status // "unknown"' "$RUNNER_TEMP/health.json" 2>/dev/null || echo 'unknown')"
          late="$(jq -r '[.crons[]? | select(.status=="late") | .name] | join(", ")' "$RUNNER_TEMP/health.json" 2>/dev/null || echo '')"
          unknown="$(jq -r '(.unknownNames // []) | join(", ")' "$RUNNER_TEMP/health.json" 2>/dev/null || echo '')"

          # not ok = http != 200 (inclui 000 de timeout/DNS/TLS e 401 de
          # CRON_SECRET rotacionado) OU status != ok. /api/health responde 503
          # só em `down`, 200 no resto.
          if [ "$http_code" != "200" ] || [ "$status" != "ok" ]; then
            state="not-ok"
          else
            state="ok"
          fi

          {
            echo "http_code=$http_code"
            echo "status=$status"
            echo "late=$late"
            echo "unknown=$unknown"
            echo "state=$state"
          } | tee -a "$GITHUB_OUTPUT"

          {
            echo "### health-watch"
            echo "- HTTP: \`$http_code\`"
            echo "- status: \`$status\`"
            echo "- crons late: \`${late:-none}\`"
            echo "- unknown: \`${unknown:-none}\`"
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Resolve previous state
        id: prev
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -uo pipefail
          if [ -f .health-watch-state ]; then
            prev_state="$(head -n1 .health-watch-state)"
            prev_alert="$(sed -n '2p' .health-watch-state)"
          else
            # Cache miss: deriva SÓ das runs DESTE workflow, nunca das de uptime.yml.
            conclusion="$(gh api \
              "repos/${{ github.repository }}/actions/workflows/health-watch.yml/runs?status=completed&per_page=1" \
              --jq '.workflow_runs[0].conclusion' 2>/dev/null || echo '')"
            if [ "$conclusion" = "failure" ]; then prev_state="not-ok"; else prev_state="ok"; fi
            prev_alert=""
          fi
          echo "prev_state=$prev_state" | tee -a "$GITHUB_OUTPUT"
          echo "prev_alert=$prev_alert" | tee -a "$GITHUB_OUTPUT"

      - name: Decide and alert
        id: alert
        env:
          NTFY_URL: ${{ secrets.NTFY_URL }}
          STATE: ${{ steps.probe.outputs.state }}
          PREV_STATE: ${{ steps.prev.outputs.prev_state }}
          PREV_ALERT: ${{ steps.prev.outputs.prev_alert }}
          STATUS: ${{ steps.probe.outputs.status }}
          HTTP_CODE: ${{ steps.probe.outputs.http_code }}
          LATE: ${{ steps.probe.outputs.late }}
          UNKNOWN: ${{ steps.probe.outputs.unknown }}
        run: |
          set -uo pipefail
          now="$(date -u +%s)"
          alerted_at="$PREV_ALERT"

          if [ -z "${NTFY_URL:-}" ]; then
            echo "::warning::secrets.NTFY_URL não configurado — health-watch está medindo mas não consegue alertar."
            printf '%s\n%s\n' "$STATE" "$alerted_at" > .health-watch-state
            exit 0
          fi

          send() {
            # $1=priority $2=title $3=body. Entrega VERIFICADA: qualquer não-2xx
            # falha o passo. `curl -sS` sai 0 num 403/429, e runners do GitHub
            # compartilham IP de saída — exatamente a população que o ntfy.sh
            # limita por IP.
            curl -fsS -o /dev/null -w '%{http_code}' \
              --max-time 15 \
              -H "Title: $2" \
              -H "Priority: $1" \
              -H "Tags: warning" \
              -d "$3" \
              "$NTFY_URL"
          }

          body="Crons late: ${LATE:-none} · unknown: ${UNKNOWN:-none}"

          should_alert="no"
          if [ "$STATE" = "not-ok" ] && [ "$PREV_STATE" = "ok" ]; then
            should_alert="transition-down"
          elif [ "$STATE" = "ok" ] && [ "$PREV_STATE" = "not-ok" ]; then
            should_alert="recovered"
          elif [ "$STATE" = "not-ok" ] && [ -n "$alerted_at" ] \
               && [ $((now - alerted_at)) -ge "$REALERT_AFTER_SECONDS" ]; then
            should_alert="re-alert"
          fi

          # Prioridade por status; `high` segue reservado a canal caído/segundo cron.
          if [ "$STATUS" = "degraded" ] && [ "$HTTP_CODE" = "200" ]; then
            priority="default"
          else
            priority="urgent"
          fi

          case "$should_alert" in
            recovered)
              send "default" "health-watch: recuperado" "$body"
              alerted_at=""
              ;;
            transition-down|re-alert)
              send "$priority" "health-watch: ${STATUS}" "$body"
              alerted_at="$now"
              ;;
            *)
              echo "health-watch: sem transição (state=$STATE prev=$PREV_STATE)"
              ;;
          esac

          printf '%s\n%s\n' "$STATE" "$alerted_at" > .health-watch-state

      - name: Save state
        if: always()
        uses: actions/cache/save@v4
        with:
          path: .health-watch-state
          key: health-watch-state-${{ github.run_id }}

      - name: Fail the run if not ok (segundo sinal na aba Actions)
        if: steps.probe.outputs.state != 'ok'
        run: |
          echo "state=not-ok http_code=${{ steps.probe.outputs.http_code }} status=${{ steps.probe.outputs.status }}"
          exit 1
```

- [ ] **Step 2: Validar a sintaxe do workflow localmente**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/health-watch.yml')); print('yaml ok')"
grep -c 'cat \|echo "\$body"\|-o -' .github/workflows/health-watch.yml || echo 'OK: o corpo nunca e ecoado'
grep -c 'lastError' .github/workflows/health-watch.yml || echo 'OK: lastError nunca e lido'
git diff --stat -- .github/workflows/uptime.yml
```
Expected: `yaml ok`; as duas linhas `OK:`; `git diff --stat` **vazio** para `uptime.yml`.

- [ ] **Step 3: Modificar `docs/ops/cron-watchdog/check.sh`**

Aplique estas cinco edições:

**(a)** logo abaixo de `set -euo pipefail` (`:52`):

```bash
# Marcador de versão: o runbook compara este valor com o de
# /opt/cron-watchdog/check.sh. Antes de C2 não havia NENHUMA checagem de que o
# arquivo do repo e o que roda no home-lab eram o mesmo.
CHECK_SH_VERSION="c2-2026-09-06"
echo "cron-watchdog: CHECK_SH_VERSION=${CHECK_SH_VERSION}"
```

**(b)** no bloco de template do cabeçalho (`:27-33`), acrescente a variável nova com a restrição escrita:

```bash
#   NTFY_URL=https://ntfy.sh/<pick-a-private-unguessable-topic-name>
#   # Optional, only if self-hosting ntfy behind auth:
#   # NTFY_AUTH_TOKEN=tk_xxxxx
#   # Optional second channel, used ONLY when the ntfy delivery above fails.
#   # MUST NOT point at ntfy.sh nor at the same host as NTFY_URL — use a
#   # DIFFERENT PROVIDER (Telegram bot, Pushover, Gotify, your own webhook).
#   # A second ntfy.sh topic survives a refusal but NOT an ntfy.sh outage,
#   # which is half the reason this variable exists.
#   # WATCHDOG_FALLBACK_URL=https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>&text=
```

**(c)** substitua `send_alert` (`:79-96`) por:

```bash
send_alert() {
  # $1 = ntfy priority (min|low|default|high|urgent), $2 = title, $3 = message
  local priority="$1" title="$2" message="$3"
  local auth_args=()
  if [ -n "${NTFY_AUTH_TOKEN:-}" ]; then
    auth_args=(-H "Authorization: Bearer ${NTFY_AUTH_TOKEN}")
  fi
  # Portable empty-array expansion under `set -u` (bash 3.2 e bash 5.x).
  if curl -fsS --max-time "$TIMEOUT_SECONDS" \
    "${auth_args[@]+"${auth_args[@]}"}" \
    -H "Title: ${title}" \
    -H "Priority: ${priority}" \
    -H "Tags: warning" \
    -d "${message} [${CHECK_SH_VERSION}]" \
    "$NTFY_URL" >/dev/null; then
    return 0
  fi
  echo "cron-watchdog: failed to deliver ntfy alert" >&2
  # Segundo canal, fora do ntfy.sh. `${VAR:-}` e nunca `${VAR:?}`: a ausência
  # do fallback não pode derrubar o watchdog.
  if [ -n "${WATCHDOG_FALLBACK_URL:-}" ]; then
    curl -fsS --max-time "$TIMEOUT_SECONDS" \
      --data-urlencode "text=${title}: ${message} [${CHECK_SH_VERSION}]" \
      "${WATCHDOG_FALLBACK_URL}" >/dev/null \
      || echo "cron-watchdog: fallback delivery also failed" >&2
  fi
  return 1
}
```

**(d)** substitua o bloco `status == degraded | down` (`:146-164`) por:

```bash
# --- status == degraded | down ----------------------------------------------
# MUST: o conjunto persistido é `select(.status == "late")`, NUNCA
# `select(.status != "ok")` — `unknown` é o estado de todo cron recém-implantado
# até o primeiro run, e paginar nele reabre o alarme-desde-o-dia-1 que
# health/route.ts:295-306 argumenta contra. `unknown` continua ROTULADO.
late_names="$(jq -r '[.crons[]? | select(.status == "late") | .name] | join(", ")' "$body_file" 2>/dev/null || echo "?")"
unknown_names="$(jq -r '(.unknownNames // []) | join(", ")' "$body_file" 2>/dev/null || echo "")"
message="late: ${late_names:-none} · unknown: ${unknown_names:-none}"
priority="high"
[ "$status" = "down" ] && priority="urgent"

LATE_FILE="$STATE_DIR/late_names"
new_names=""
if [ -f "$LATE_FILE" ]; then
  for name in $(echo "$late_names" | tr ',' ' '); do
    [ -z "$name" ] && continue
    grep -qxF "$name" "$LATE_FILE" || new_names="${new_names}${name} "
  done
else
  # PRIMEIRO RUN após C2: o arquivo não existe e TODO nome é "novo". Semear em
  # silêncio e só alertar a partir da execução seguinte.
  new_names=""
fi
echo "$late_names" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' > "$LATE_FILE" || true

if [ -n "$new_names" ]; then
  # Alerta IMEDIATO, com título próprio, independentemente de
  # REALERT_EVERY_N_RUNS: durante um episódio de canal (que a spec estaciona em
  # `degraded` de propósito, possivelmente por dias) um cron novo caindo virava
  # só uma string mais longa no mesmo alerta de sempre.
  send_alert "$priority" "cron-watchdog: new cron failing" "new: ${new_names}· ${message}"
  echo 0 > "$COUNT_FILE"
elif [ "$previous_status" != "$status" ]; then
  send_alert "$priority" "cron-watchdog: status=${status}" "$message"
  echo 0 > "$COUNT_FILE"
else
  count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  count=$((count + 1))
  if [ "$count" -ge "$REALERT_EVERY_N_RUNS" ]; then
    send_alert "$priority" "cron-watchdog: still ${status}" "$message"
    count=0
  fi
  echo "$count" > "$COUNT_FILE"
fi

echo "$status" > "$STATE_FILE"
# MUST: exit 1 quando não-ok — segundo sinal para o systemd (o unit é oneshot e
# propaga o código) e para o `journalctl` do runbook.
exit 1
```

**(e)** no ramo `status == ok` (`:136-144`), zere também o conjunto de nomes antes do `exit 0`:

```bash
if [ "$status" = "ok" ]; then
  if [ -n "$previous_status" ] && [ "$previous_status" != "ok" ]; then
    send_alert "default" "cron-watchdog: recovered" \
      "GET /api/health is back to status=ok (was: ${previous_status})."
  fi
  echo "ok" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  : > "$STATE_DIR/late_names"
  exit 0
fi
```

E acrescente ao topo, junto dos outros HTTP checks (depois do bloco `401`, `:117-123`):

```bash
# Status HTTP inesperado (502/503 da borda, 404 de rota removida): o endpoint
# respondeu, mas não com algo que se possa interpretar.
if [ "$http_code" != "200" ] && [ "$http_code" != "503" ]; then
  send_alert "urgent" "cron-watchdog: /api/health HTTP ${http_code}" \
    "Endpoint answered with an unexpected status. Check the Vercel deployment."
  echo "http_${http_code}" > "$STATE_FILE"
  echo 0 > "$COUNT_FILE"
  exit 1
fi
```

- [ ] **Step 4: Validar o script**

```bash
bash -n docs/ops/cron-watchdog/check.sh && echo 'sintaxe ok'
grep -c 'select(.status != "ok")' docs/ops/cron-watchdog/check.sh || echo 'OK: nenhum select(!= ok) sobrou'
grep -n 'CHECK_SH_VERSION' docs/ops/cron-watchdog/check.sh
grep -n 'WATCHDOG_FALLBACK_URL:-' docs/ops/cron-watchdog/check.sh   # nunca :?
```
Expected: `sintaxe ok`; `OK: nenhum select(!= ok) sobrou`; `CHECK_SH_VERSION` em pelo menos 3 linhas; `${WATCHDOG_FALLBACK_URL:-}`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/health-watch.yml docs/ops/cron-watchdog/check.sh
git commit -m "ci(ops): terceira perna health-watch e watchdog com nome novo, versao e fallback"
```

---

### Task 19: Verificação local completa, gates pós-C2 e o ÚNICO push

**Files:** nenhum arquivo novo. Esta tarefa é o portão antes do `git push` e a execução dos gates de §7 depois da promoção.

**Interfaces:**
- Consumes: os 18 commits das Tarefas 1-18.
- Produces: C2 em produção, com os gates de §7 registrados no runbook — pré-requisito bloqueante de **C4** e de **C3**.

- [ ] **Step 1: Suíte inteira, local, antes de qualquer push**

```bash
npm run build:packages
npm run typecheck --workspace=apps/web
npm run typecheck --workspace=apps/api
npm test --workspace=apps/web
```
Expected: typechecks limpos; suíte completa verde (~160 s, 1078 arquivos). **Vermelho aqui ⇒ conserte antes do push**: cada push dispara 4 builds na Vercel e o orçamento é limitado.

- [ ] **Step 2: `next build` local (paridade com a Vercel)**

```bash
npm run build:web
```
Expected: build completo. É a única forma de pegar antes do deploy um `'use server'` inválido ou um import de `token.ts` (server-only) escorrendo para o bundle do cliente.

- [ ] **Step 3: Conferir que `uptime.yml` continua intocado**

```bash
git diff main --stat -- .github/workflows/uptime.yml
```
Expected: **vazio**.

- [ ] **Step 4: Push único (staging) e promoção**

```bash
git log --oneline main..staging          # confira: 18 commits de C2 (Tarefas 1-18)
git push origin staging
# aguarde a CI verde, depois promova staging -> main pelo fluxo do projeto
```

- [ ] **Step 5: MESMO MINUTO da promoção — o `curl` nos DOIS crons (MUST, não é opcional)**

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/instagram-token-refresh
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/instagram-sync
```
Expected: dois JSON com `status:"ok"`. **Por quê:** `evaluateCron` calcula `lastRun` pela agenda NOVA no instante em que o deploy pousa; com `last_success_at` da agenda velha, `isStale` vira verdadeiro e o watchdog paginaria ~12×. Só o `curl` grava `last_success_at = now()`, posterior a `lastRun` sob qualquer das duas agendas. **Não existe janela de promoção que evite isso.**

- [ ] **Step 6: Heartbeat no aparelho + as 3 chaves de canal**

O heartbeat (`priority: low`) **toca**; a sonda (`priority: min`) **não**. Depois dos dois `curl`:

```sql
select key, last_at from public.ops_alert_state where key like 'ntfy_%';
```
Expected: **3** linhas — `ntfy_probe_due`, `ntfy_heartbeat_due`, `ntfy_heartbeat_ok`.

- [ ] **Step 7: `health-watch.yml` verde, e o ramo de ALERTA exercitado uma vez**

```bash
gh secret list | grep CRON_SECRET
gh workflow run health-watch.yml && sleep 40 && gh run list --workflow=health-watch.yml --limit 1
```

Uma run verde prova só que o agregado estava `ok`. Force o outro ramo:

```sql
update public.cron_health set consecutive_failures = 1 where cron_name = 'instagram-token-refresh';
-- confira 1 linha; se 0, faça insert ... on conflict do update
```
```bash
gh workflow run health-watch.yml
# Expected: push "health-watch: degraded" no aparelho, com a lista de nomes
```
```sql
update public.cron_health set consecutive_failures = 0 where cron_name = 'instagram-token-refresh';
```
```bash
gh workflow run health-watch.yml   # Expected: push "health-watch: recuperado"
gh run view --log | grep -c 'lastError'
```
Expected da última linha: **0** (repositório público — nenhuma run pôde imprimir o corpo).

- [ ] **Step 8: `check.sh` no home-lab — fallback, host e marcador**

```bash
sudo tee -a /etc/cron-watchdog/watchdog.env <<< 'WATCHDOG_FALLBACK_URL=<provedor DIFERENTE de ntfy.sh>'
sudo chmod 600 /etc/cron-watchdog/watchdog.env
sudo chown cron-watchdog:cron-watchdog /etc/cron-watchdog/watchdog.env

# Gate BLOQUEANTE: o fallback não pode ser ntfy.sh (um segundo tópico lá
# sobrevive a uma recusa, mas NÃO a uma queda do provedor).
grep -E '^WATCHDOG_FALLBACK_URL=' /etc/cron-watchdog/watchdog.env | grep -qi 'ntfy\.sh' && echo FALHA

sudo cp docs/ops/cron-watchdog/check.sh /opt/cron-watchdog/check.sh
sudo systemctl restart cron-watchdog.timer
sudo systemctl start cron-watchdog.service; journalctl -u cron-watchdog -n 20 --no-pager

grep CHECK_SH_VERSION /opt/cron-watchdog/check.sh
```
Expected: nada impresso pelo `grep ... && echo FALHA`; o `journalctl` mostrando `CHECK_SH_VERSION=c2-2026-09-06`, igual ao do repo. (O `;` antes do `journalctl` é deliberado: o service é `oneshot` e propaga `exit 1`.)

Prove o fallback: aponte o `NTFY_URL` do watchdog para um tópico inválido por um run, confirme que o fallback chegou, e devolva o valor.

- [ ] **Step 9: Recusa terminal e `vaultDown` sintéticos ⇒ e-mail**

```bash
# 1) Recusa terminal: aponte NTFY_URL da Vercel para um tópico com credencial
#    inválida, dispare o cron por curl, confirme status:'error' + e-mail, e
#    devolva o valor.
# 2) vaultDown: remova SOCIAL_MASTER_KEY do ambiente de produção por um run,
#    dispare o cron, confirme 'vault unavailable' + e-mail, e devolva.
```
Expected: `status:"error"` com a causa nomeada nos dois casos, e **um** e-mail por dia.

- [ ] **Step 10: Medir `WORST_GROUP_MS` (MUST — medido, não presumido)**

```sql
update public.instagram_accounts
   set token_error = 'expired', token_error_at = now(), token_alert_attempt_at = null
 where site_id = '<site>';
```
```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/instagram-token-refresh
# leia a duração da função no log da Vercel e registre o tempo REAL do grupo no runbook
```
Se o medido passar de 12 s: **ou** `WORST_GROUP_MS` sobe para o p99 observado, **ou** a re-tentativa de ntfy **dentro** da varredura cai para 1 tentativa (a cadência já re-tenta no run seguinte). Um grupo iniciado aos 12,9 s que leve 20 s põe a varredura em 33 s e come a folga declarada.

- [ ] **Step 11: Primeiro ciclo real das 13:00**

Confira no dia seguinte:
- `refreshed` / `still_broken` coerentes na resposta do cron;
- push chegando às **10:00 BRT** com o `Click` funcionando (a rota curta é da Tarefa 15) e o `RECONNECT_CTA` transitório (`paste a new token`);
- nenhuma linha `transient:`/`permanent:` inesperada em `instagram_sync_log` — **uma `infra: duplicate key…` com 2+ linhas de locale é esperada e não alerta** (janela C2→C4).

- [ ] **Step 12: Registrar tudo no runbook e commitar**

```bash
git add docs/ops/instagram-token-alert-runbook.md
git commit -m "docs(instagram): registrar gates pos-C2 (canal, watchdog, WORST_GROUP_MS)"
git push origin staging
```

> **A partir daqui:** **C4** (`chore(instagram): drop da unique global de ig_media_id`) em até 2 dias e após o primeiro ciclo das 13:00; **C3** depois. Rollback de C2 = reverter C3 (se na árvore) → `git revert` do intervalo → **passo de banco obrigatório de §7** (o `update` que zera `access_token`/`ig_user_id_source`/`ig_professional_id` das linhas `v1:` **e** o `delete` das chaves fósseis de `ops_alert_state`). **"Só reverter o deploy" está proibido para C2.**

---
