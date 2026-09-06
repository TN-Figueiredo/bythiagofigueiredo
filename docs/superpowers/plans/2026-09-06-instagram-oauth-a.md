# Instagram OAuth — Commit A: fechar vazamentos vivos + base de observabilidade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os três vazamentos vivos de escrita/leitura do feed do Instagram (writes sem `site_id`, `access_token` legível por qualquer editor/`anon`, `Sync Now` falsificando `cron_health`) e entregar os dois módulos-folha (`sync-log`, `redact-secrets`) de que C2/C3 dependem.

**Architecture:** Três sub-itens do spec §0 linha **A**. **A1** põe `.eq('site_id', siteId)` nas escritas de `settings/actions.ts` e faz `updateInstagramSlots` provar posse do `account_id` e dos `postId`. **A2** transforma `triggerInstagramSync` numa chamada **em processo** a `syncInstagramAccount` (nada de `fetch` para o cron ⇒ o `cron_health['instagram-sync']` deixa de ser carimbado por um clique manual), dá a `syncInstagramAccount` a **assinatura final** `(supabase, account, accessToken?, opts?)` com prazo (`deadlineAt`) e timeout de download, e cria `src/lib/instagram/sync-log.ts` + `src/lib/redact-secrets.ts`. **A3** é a migration que põe `security_invoker` na view pública e troca o grant de **tabela** de `instagram_accounts` por **allow-list de colunas** para `authenticated` (16 colunas, sem `access_token`) e para `anon` (`{id, site_id}`).

**Tech Stack:** Next.js 16.3.4 (App Router, segment config `maxDuration`, `revalidateTag(tag, { expire: 0 })`), React 19, TypeScript 5 strict, Supabase (PostgreSQL 17, PostgREST, RLS), Vitest (happy-dom default; `// @vitest-environment node` para código de servidor), `@vercel/blob`, `AbortSignal.timeout`, Sentry.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — §0 linha **A**, §1, §3.2, §4, §6 "Commit A/A3/A4", §7 "Gates antes de A" / "Gate depois de A".

## Global Constraints

Valem **integralmente** as *Global Constraints* de `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md` — leia-as antes de qualquer passo; não estão repetidas aqui. Além delas, restrições **específicas de A**, copiadas verbatim do spec:

- **§0 linha A, item (iii):** "**porque o transporte HTTP restaurável é `/api/cron/instagram-sync?mode=manual&accountId=<uuid>`, o item (iii) MUST NOT rodar dentro de A**: os dois parâmetros só podem ser apagados **depois** do gate e **só** no ramo em que ele passa". ⇒ **`src/app/api/cron/instagram-sync/route.ts` NÃO é editado neste commit.** `mode`, `accountId` e o lock `instagram-sync-${mode}` ficam exatamente como estão.
- **§6:** "`test/api/cron/instagram-{sync,token-refresh}.test.ts` (**não é de A**: a remoção do `it('returns 400 for invalid mode')` de `instagram-sync.test.ts:106-111` viaja no commit que executar o item (iii)…)" e "`test/instagram/cron-route.test.ts` (o `?mode=` de `:30` é reescrito no mesmo commit de (iii) — A5 ou C2, **nunca A**)". ⇒ **esses três arquivos de teste NÃO são editados neste commit.**
- **§0 linha A, item (ii), MUST no mesmo commit:** "`cacheImage` ganha timeout: … passa a ser `fetch(urlToCache, { signal: AbortSignal.timeout(Math.max(1_000, Math.min(8_000, deadlineAt - Date.now()))) })`, **e cada lote corre contra o prazo restante** (`Promise.race` entre o `Promise.allSettled` do lote e o tempo que falta; os downloads já em voo são abortados pelos próprios sinais)".
- **§3.2 (`sync.ts` (C2))** — o **portão de URL/SSRF**, o `MAX_IMAGE_BYTES`, o `contentType` derivado do `ext`, o `redirect:'error'`, a regex `^[0-9]{1,32}$` do `item.id`, o `onConflict: 'account_id,ig_media_id'` e o `accessToken` **obrigatório** são de **C2**. **MUST NOT** entrar em A.
- **§0 linha A, item (i):** "`export const maxDuration = 120` em `settings/page.tsx` (hoje só `dynamic`, `:8`)".
- **§0 linha A, item (iv):** "`last_synced_at` só em upsert sem erro; erro do upsert **lançado** (`sync.ts:97-104` hoje engole)".
- **§0 linha A, item (vi):** "`'No access token'`/`'No Instagram user ID'` (`sync.ts:58-59`) viram \"This account isn't connected — use Connect with Instagram\"".
- **§3.2:** "`openSyncRow`: insert `status='started'`, `site_id`, **`error_message = opts.detail ? 'detail: ' + redact(detail).slice(0,500) : null`**"; "`closeSyncRow`: `completed` **preserva** `error_message` (+ ` partial` quando `result.partial`; **+ ` mediaFailed:<N>` quando `> 0`** — **Decisão:** sem coluna nova); `failed` sobrescreve; `logId === null` ⇒ no-op na escrita e o chamador registra".
- **§4:** "`redactSecrets` … **redação de query dirigida por nome de parâmetro (MUST, não por forma do valor)**"; "`registerSecretLiteral` (no-op < 16 chars, escapa metacaracteres, dedupe; só `replace`; **sem `process.env`** no módulo)".
- **§0 linha A, A3, Racional (MUST):** "manter o grant de tabela deixava `access_token` protegido só por RLS — e RLS não filtra colunas (§1(b))… O ratchet de §6 fixa as duas allow-lists."
- **Entrega:** **A é entregue como 6 commits pequenos e contíguos em `staging`** (`A 1/6` … `A 6/6`), com **um único `git push`** ao final (Tarefa 8). Não há squash — a Global Constraint do README proíbe `git reset`/`git stash` (há 2+ terminais trabalhando em `staging`). O "tudo-ou-nada" do `git revert` de §0 é preservado revertendo o **intervalo contíguo**: `git revert --no-commit <sha de A 1/6>^..<sha de A 6/6> && git commit -m "revert: commit A (instagram)"`.

---

## Ledger (preencher na Tarefa 9 — decide o corpo de A5)

| Campo | Valor |
|---|---|
| SHA de `A 1/6` | _(preencher)_ |
| SHA de `A 6/6` | _(preencher)_ |
| Duração-padrão de função do projeto (painel Vercel) | _(preencher — hoje 60 s no Pro)_ |
| Duração medida do `Sync Now` real (log da Vercel, segmento `/cms/settings`) | _(preencher)_ |
| HTTP / corpo devolvido | _(preencher — 200 `{ok:true}` / 200 `{ok:true,partial:true}` / 504)_ |
| Veredito | _(preencher — **herdou** / **não herdou** / **inconclusivo**)_ |
| ⇒ Corpo de A5 | _(preencher — `chore(instagram): drop manual mode from sync cron` **ou** `fix(instagram): restore HTTP transport for Sync Now`)_ |

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `apps/web/src/lib/redact-secrets.ts` **(novo)** | Módulo-folha, sem imports e sem `process.env`. Redige query strings e atribuições por **nome de parâmetro**, mais a rede secundária `IG…` e literais registrados. | 2 |
| `apps/web/test/lib/redact-secrets.test.ts` **(novo)** | Canária dos dois regexes de §4 + `registerSecretLiteral`. | 2 |
| `apps/web/src/lib/instagram/types.ts` | `SyncResult` += `partial: boolean`, `mediaFailed: number`. | 3 |
| `apps/web/src/lib/instagram/sync-log.ts` **(novo)** | `openSyncRow` / `closeSyncRow` — a escrita de `instagram_sync_log` que hoje está inline em duas rotas de cron. | 3 |
| `apps/web/test/instagram/sync-log.test.ts` **(novo)** | Forma exata das duas escritas, incl. `detail:`, ` partial`, ` mediaFailed:<N>` e o no-op de `logId === null`. | 3 |
| `apps/web/src/lib/instagram/sync.ts` | Assinatura final, prazo por lote, timeout de download, upsert que lança, texto humano. | 4 |
| `apps/web/test/instagram/sync.test.ts` | Estendido (ganha o pragma `node`). | 4 |
| `apps/web/src/app/cms/(authed)/settings/actions.ts` | A1 (escopo de site) e A2 (`triggerInstagramSync` em processo). | 5, 6 |
| `apps/web/test/instagram/actions.test.ts` | Estendido (ganha o pragma `node`). | 5, 6 |
| `apps/web/src/app/cms/(authed)/settings/page.tsx` | `export const maxDuration = 120`. | 6 |
| `supabase/migrations/20260906000001_instagram_public_view_lockdown.sql` **(novo)** | A3. | 7 |
| `apps/web/test/integration/instagram-accounts-public-view.test.ts` **(novo)** | DB-gated: 42501 nos dois papéis + **ratchet duplo** das allow-lists. | 7 |

---

### Task 1: Pre-flight — gates de §7 "Gates antes de A" (bloqueantes, sem código)

**Files:**
- Create: nenhum
- Modify: nenhum
- Test: nenhum (esta tarefa é um gate operacional)

**Interfaces:**
- Consumes: nada
- Produces: um banco local limpo (`npm run db:reset`) e a confirmação de que não há migration pendente em produção — pré-requisito do `db:push:prod` da Tarefa 7.

- [ ] **Step 1: Confirmar o plano Vercel Pro**

Já **confirmado pelo dono em 2026-09-06** (README, última linha das Global Constraints). Nenhum comando. Se houver dúvida, `vercel project ls` / painel → *Settings → General → Plan*.
Expected: `Pro`. Se for `Hobby`, **PARE**: `maxDuration = 120` não é permitido e A não pode ser implementado como está.

- [ ] **Step 2: Conferir que não há migration pendente em produção**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:link:prod
npx supabase@2.98.2 migration list
```

Expected: todas as linhas com marca nas duas colunas (`Local` e `Remote`), **incluindo `20260905000003`**. Se alguma linha aparecer só em `Local`, rode `npm run db:push:prod` **antes** de começar — o `db:push:prod` da Tarefa 7 aplica todas as pendentes de uma vez e não pode ser a primeira vez que migrations de terceiros chegam em prod.

- [ ] **Step 3: Conferir que nenhum handle está fora da forma**

```bash
npx supabase@2.98.2 db execute --linked --command "select id, handle, length(handle) from public.instagram_accounts where handle !~ '^[a-z0-9._]{1,30}\$';"
```

Expected: `0 rows`. (Se vier linha, registre no runbook — o `lower(handle)` de M1/C1 é irreversível e depende disso.)

- [ ] **Step 4: Conferir os domínios do site**

```bash
npx supabase@2.98.2 db execute --linked --command "select slug, domains from public.sites;"
```

Expected: para `bythiagofigueiredo`, apex + `www` (ex.: `{bythiagofigueiredo.com,www.bythiagofigueiredo.com}`). Cole a saída no runbook.

- [ ] **Step 5: Registrar o modo do CSP**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
sed -n '45,60p' src/lib/security/csp.ts
grep -rn "CSP_NONCE_ENABLED" ../../.env* apps 2>/dev/null || echo "CSP_NONCE_ENABLED ausente => modo legacy"
```

Expected: registrar no runbook se `getCspMode()` é `legacy` (default) ou `enforced`. Nada em A depende disso; o registro é para B.

- [ ] **Step 6: Resetar o banco local (obrigatório — resíduo de rodadas de revisão)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:start
npm run db:reset
```

Expected: `Finished supabase db reset.` e **nenhuma** das tabelas/funções de rodadas anteriores presente:

```bash
npx supabase@2.98.2 db execute --local --command "select to_regclass('public.ops_alert_state') as t, to_regproc('public.ops_alert_claim') as f, to_regproc('public.instagram_mark_token_invalid') as g;"
```

Expected: `t | f | g` todos `NULL` (essas três nascem em M1/C1, não em A).

- [ ] **Step 7: Baseline verde da suíte**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram test/api/cron/instagram-sync.test.ts test/api/cron/instagram-token-refresh.test.ts
```

Expected: todos os arquivos **passam** (`7 passed` em `test/instagram/*` + os 2 de cron). Se algo já estiver vermelho, conserte/registre **antes** de A — o plano assume árvore verde.

- [ ] **Step 8: Sem commit**

Esta tarefa não produz commit. Registre as saídas dos passos 2–5 em `docs/ops/instagram-token-alert-runbook.md` **só em C2** (o arquivo nasce lá); por ora, cole-as no Ledger desta tarefa em uma nota local.

---

### Task 2: `src/lib/redact-secrets.ts` — módulo-folha de redação (A2, item v)

**Files:**
- Create: `apps/web/src/lib/redact-secrets.ts`
- Create: `apps/web/test/lib/redact-secrets.test.ts`
- Modify: nenhum

**Interfaces:**
- Consumes: nada (módulo-folha: **zero** imports, **sem** `process.env`).
- Produces:
  - `export function redactSecrets(input: string): string`
  - `export function registerSecretLiteral(value?: string): void`

  Consumidores futuros: `src/lib/instagram/sync-log.ts` (Tarefa 3, deste commit); `src/lib/instagram/token.ts` re-exporta como `redact` e `sentry.server.config.ts` / `sentry.edge.config.ts` registram `INSTAGRAM_APP_SECRET`, `META_APP_SECRET` e `SOCIAL_MASTER_KEY` — **ambos em C2**.

- [ ] **Step 1: Write the failing test**

Crie `apps/web/test/lib/redact-secrets.test.ts`:

```ts
// @vitest-environment node
// Canária de §4: a redação é dirigida por NOME DE PARÂMETRO, nunca pela forma
// do valor — o token de 60 d da Meta viaja em query string (api-client.ts:56,76,83)
// e chega ao Sentry pelo breadcrumb undici (`data.url`). Apostar no prefixo `IG…`
// é a única premissa Meta-dependente sem gate empírico; ele fica só como 2ª rede.
import { describe, it, expect } from 'vitest'
import { redactSecrets, registerSecretLiteral } from '@/lib/redact-secrets'

const SIXTY_FOUR = 'a'.repeat(64)

describe('redactSecrets — query string por nome de parâmetro', () => {
  it('redige access_token numa URL, sem depender do prefixo IG', () => {
    const url = `https://graph.instagram.com/v25.0/me?fields=id&access_token=${SIXTY_FOUR}`
    const out = redactSecrets(url)
    expect(out).toContain('access_token=[REDACTED]')
    expect(out).not.toContain(SIXTY_FOUR)
    expect(out).toContain('fields=id')
  })

  it.each(['client_secret', 'code', 'signed_request', 'state', 'rebind'])(
    'redige %s em query string',
    (param) => {
      const out = redactSecrets(`https://x.test/cb?${param}=${SIXTY_FOUR}&keep=1`)
      expect(out).toContain(`${param}=[REDACTED]`)
      expect(out).not.toContain(SIXTY_FOUR)
      expect(out).toContain('keep=1')
    },
  )

  it('redige a forma nua no meio de uma mensagem de exceção', () => {
    const out = redactSecrets(`upstream rejected access_token=${SIXTY_FOUR} for /me`)
    expect(out).toContain('access_token=[REDACTED]')
    expect(out).not.toContain(SIXTY_FOUR)
  })

  it('redige a forma nua ancorada em início de string', () => {
    const out = redactSecrets(`access_token=${SIXTY_FOUR}`)
    expect(out).toBe('access_token=[REDACTED]')
  })
})

describe('redactSecrets — forma de atribuição/JSON', () => {
  it('redige um corpo de troca de código ecoado', () => {
    const body = `{"access_token":"${SIXTY_FOUR}","token_type":"bearer"}`
    const out = redactSecrets(body)
    expect(out).toContain('"access_token":"[REDACTED]"')
    expect(out).not.toContain(SIXTY_FOUR)
    expect(out).toContain('"token_type":"bearer"')
  })

  it('redige client_secret e signed_request em atribuição', () => {
    const out = redactSecrets(`client_secret: ${SIXTY_FOUR}, signed_request = ${SIXTY_FOUR}`)
    expect(out).not.toContain(SIXTY_FOUR)
    expect(out.match(/\[REDACTED\]/g)).toHaveLength(2)
  })
})

describe('redactSecrets — 2ª rede: prefixo IG fora de query string', () => {
  it('redige um token IG solto', () => {
    const tok = `IGQVJ${'X'.repeat(40)}`
    expect(redactSecrets(`stored token ${tok} failed`)).not.toContain(tok)
  })

  it('não toca palavras curtas que começam com IG', () => {
    expect(redactSecrets('IGNORE this IG line')).toBe('IGNORE this IG line')
  })
})

describe('registerSecretLiteral', () => {
  it('é no-op para valores com menos de 16 caracteres', () => {
    registerSecretLiteral('short')
    expect(redactSecrets('the word short stays')).toBe('the word short stays')
  })

  it('é no-op para undefined', () => {
    registerSecretLiteral(undefined)
    expect(redactSecrets('nothing changes')).toBe('nothing changes')
  })

  it('redige todas as ocorrências de um literal registrado', () => {
    const secret = 'sup3r-s3cret-value-0123456789'
    registerSecretLiteral(secret)
    expect(redactSecrets(`a=${secret} b=${secret}`)).toBe('a=[REDACTED] b=[REDACTED]')
  })

  it('escapa metacaracteres de regex no literal', () => {
    const secret = 'a+b.c*d(efg)hij12345'
    registerSecretLiteral(secret)
    expect(redactSecrets(`k=${secret}`)).toBe('k=[REDACTED]')
    // O literal escapado NÃO vira um padrão que casa outra coisa.
    expect(redactSecrets('k=aab_cddefghij12345')).toBe('k=aab_cddefghij12345')
  })

  it('deduplica registros repetidos (uma substituição, não duas)', () => {
    const secret = 'dup-literal-0123456789'
    registerSecretLiteral(secret)
    registerSecretLiteral(secret)
    expect(redactSecrets(`v=${secret}`)).toBe('v=[REDACTED]')
  })
})

describe('redactSecrets — idempotência', () => {
  it('rodar duas vezes não altera o resultado', () => {
    const once = redactSecrets(`https://x.test/a?access_token=${SIXTY_FOUR}`)
    expect(redactSecrets(once)).toBe(once)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/lib/redact-secrets.test.ts
```

Expected: **FAIL** com `Failed to resolve import "@/lib/redact-secrets"` (o módulo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Crie `apps/web/src/lib/redact-secrets.ts`:

```ts
/**
 * Redação de segredos para telemetria (spec §4, commit A2).
 *
 * Módulo-folha: NENHUM import e NENHUM acesso a `process.env`. Quem conhece os
 * segredos estáticos (`INSTAGRAM_APP_SECRET`, `META_APP_SECRET`,
 * `SOCIAL_MASTER_KEY`) os registra por `registerSecretLiteral` — isso acontece
 * em `sentry.server.config.ts` / `sentry.edge.config.ts`, no commit C2.
 *
 * MUST: a redação de query é dirigida por NOME DE PARÂMETRO, não pela forma do
 * valor. O token longo da Meta viaja em query string (`api-client.ts:56,76,83`)
 * e sobe ao Sentry pelo breadcrumb undici (`data.url`) e, com
 * `beforeSendTransaction` (C2), pelo `description`/`data` de um span
 * `http.client`. O prefixo `IG…` é apenas a SEGUNDA rede.
 */

const REDACTED = '[REDACTED]'

/** `?access_token=…`, `&code=…`, e a forma nua ancorada em início/espaço. */
const QUERY_PARAM_RE =
  /(^|[?&\s])((?:access_token|client_secret|code|signed_request|state|rebind)=)[^&\s]+/gi

/** `"access_token":"…"`, `client_secret: …`, `signed_request = …`. */
const ASSIGNMENT_RE =
  /("?(?:access_token|client_secret|signed_request)"?\s*[:=]\s*"?)([^"'&\s,}]+)/gi

/** 2ª rede: token com o prefixo `IG` fora de query string. */
const IG_TOKEN_RE = /\bIG[A-Za-z0-9_-]{16,}/g

const seenLiterals = new Set<string>()
const literalPatterns: RegExp[] = []

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Registra um segredo estático. No-op abaixo de 16 caracteres (evita transformar
 * uma palavra comum em padrão global), escapa metacaracteres e deduplica.
 * O literal só é usado em `String.prototype.replace` — nunca é logado nem comparado.
 */
export function registerSecretLiteral(value?: string): void {
  if (!value || value.length < 16) return
  if (seenLiterals.has(value)) return
  seenLiterals.add(value)
  literalPatterns.push(new RegExp(escapeRegExp(value), 'g'))
}

/** Redige segredos conhecidos de uma string arbitrária. Nunca lança. */
export function redactSecrets(input: string): string {
  let out = input
    .replace(QUERY_PARAM_RE, `$1$2${REDACTED}`)
    .replace(ASSIGNMENT_RE, `$1${REDACTED}`)
    .replace(IG_TOKEN_RE, REDACTED)
  for (const pattern of literalPatterns) {
    pattern.lastIndex = 0
    out = out.replace(pattern, REDACTED)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/lib/redact-secrets.test.ts
```

Expected: **PASS** — `Test Files 1 passed`, `Tests 18 passed`.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx tsc --noEmit
```

Expected: sem saída (exit 0).

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/redact-secrets.ts apps/web/test/lib/redact-secrets.test.ts
git commit -m "chore(instagram): add redact-secrets leaf module (A 1/6)"
```

---

### Task 3: `SyncResult` estendido + `src/lib/instagram/sync-log.ts` (A2, itens ii e v)

**Files:**
- Modify: `apps/web/src/lib/instagram/types.ts:96-101` (`SyncResult`)
- Create: `apps/web/src/lib/instagram/sync-log.ts`
- Create: `apps/web/test/instagram/sync-log.test.ts`

**Interfaces:**
- Consumes: `redactSecrets(input: string): string` de `@/lib/redact-secrets` (Tarefa 2).
- Produces:
  - ```ts
    export interface SyncResult {
      postsFound: number
      postsInserted: number
      postsUpdated: number
      mediaCached: number
      partial: boolean
      mediaFailed: number
    }
    ```
  - `export async function openSyncRow(supabase: SupabaseClient, account: InstagramAccountRow, mode: InstagramSyncMode, opts?: { detail?: string }): Promise<string | null>`
  - `export async function closeSyncRow(supabase: SupabaseClient, logId: string | null, result: SyncResult | null, errorMessage?: string): Promise<void>`

  Consumidores futuros: `triggerInstagramSync` (Tarefa 6, deste commit); os dois crons de §3.3/§3.4 e o callback de OAuth de §3.1 (C2/C3).

- [ ] **Step 1: Write the failing test**

Crie `apps/web/test/instagram/sync-log.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstagramAccountRow, SyncResult } from '@/lib/instagram/types'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'

function makeAccount(): InstagramAccountRow {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: 'thiago.figueiredo',
    ig_user_id: 'ig-user-1', access_token: 'tok-abc',
    token_expires_at: null, sync_enabled: true, display_slots: 6,
    layout_type: 'grid', section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: null, created_at: '', updated_at: '',
  }
}

function makeResult(over: Partial<SyncResult> = {}): SyncResult {
  return {
    postsFound: 3, postsInserted: 2, postsUpdated: 1, mediaCached: 2,
    partial: false, mediaFailed: 0, ...over,
  }
}

/** Mock mínimo do supabase-js para `insert().select().single()` e `update().eq()`. */
function mockSupabase(opts: {
  insertResult?: { data: { id: string } | null; error: unknown }
  existingMessage?: string | null
} = {}) {
  const insertResult = opts.insertResult ?? { data: { id: 'log-1' }, error: null }
  const single = vi.fn().mockResolvedValue(insertResult)
  const insertSelect = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  const readSingle = vi.fn().mockResolvedValue({
    data: { error_message: opts.existingMessage ?? null },
    error: null,
  })
  const readEq = vi.fn().mockReturnValue({ single: readSingle })
  const select = vi.fn().mockReturnValue({ eq: readEq })

  const supabase = { from: vi.fn().mockReturnValue({ insert, select, update }) }
  return { supabase, insert, update, updateEq }
}

describe('openSyncRow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('insere started com site_id e devolve o id', async () => {
    const { supabase, insert } = mockSupabase()
    const id = await openSyncRow(supabase as never, makeAccount(), 'manual')
    expect(id).toBe('log-1')
    expect(insert).toHaveBeenCalledWith({
      site_id: 'site-1',
      account_id: 'acc-1',
      mode: 'manual',
      status: 'started',
      error_message: null,
    })
  })

  it('grava o detail com prefixo e redigido', async () => {
    const { supabase, insert } = mockSupabase()
    await openSyncRow(supabase as never, makeAccount(), 'manual', {
      detail: `granted: instagram_business_basic access_token=${'a'.repeat(64)}`,
    })
    const row = insert.mock.calls[0]![0] as { error_message: string }
    expect(row.error_message).toMatch(/^detail: granted: instagram_business_basic /)
    expect(row.error_message).toContain('access_token=[REDACTED]')
    expect(row.error_message).not.toContain('a'.repeat(64))
  })

  it('trunca o detail redigido em 500 chars antes do prefixo', async () => {
    const { supabase, insert } = mockSupabase()
    await openSyncRow(supabase as never, makeAccount(), 'daily', { detail: 'x'.repeat(900) })
    const row = insert.mock.calls[0]![0] as { error_message: string }
    expect(row.error_message).toBe(`detail: ${'x'.repeat(500)}`)
  })

  it('devolve null quando o insert falha (o chamador é quem registra)', async () => {
    const { supabase } = mockSupabase({ insertResult: { data: null, error: { message: 'boom' } } })
    expect(await openSyncRow(supabase as never, makeAccount(), 'manual')).toBeNull()
  })

  it('devolve null e não lança quando o cliente explode', async () => {
    const supabase = { from: vi.fn(() => { throw new Error('offline') }) }
    await expect(openSyncRow(supabase as never, makeAccount(), 'manual')).resolves.toBeNull()
  })
})

describe('closeSyncRow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completed preserva o error_message existente', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: disconnected by owner' })
    await closeSyncRow(supabase as never, 'log-1', makeResult())
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      posts_found: 3,
      posts_inserted: 2,
      posts_updated: 1,
      media_cached: 2,
      error_message: 'detail: disconnected by owner',
    }))
  })

  it('completed acrescenta " partial" e " mediaFailed:<N>"', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: ok' })
    await closeSyncRow(supabase as never, 'log-1', makeResult({ partial: true, mediaFailed: 2 }))
    const patch = update.mock.calls[0]![0] as { error_message: string }
    expect(patch.error_message).toBe('detail: ok partial mediaFailed:2')
  })

  it('não acrescenta mediaFailed quando é zero', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: ok' })
    await closeSyncRow(supabase as never, 'log-1', makeResult({ partial: true, mediaFailed: 0 }))
    const patch = update.mock.calls[0]![0] as { error_message: string }
    expect(patch.error_message).toBe('detail: ok partial')
  })

  it('sem detail e sem sufixos, error_message fica null', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: null })
    await closeSyncRow(supabase as never, 'log-1', makeResult())
    const patch = update.mock.calls[0]![0] as { error_message: string | null }
    expect(patch.error_message).toBeNull()
  })

  it('sem detail mas com mediaFailed, o sufixo mantém o espaço à esquerda', async () => {
    // O espaço é deliberado: §3.2 (C2) deriva "3 execuções com falha" procurando
    // a substring " mediaFailed:" no error_message.
    const { supabase, update } = mockSupabase({ existingMessage: null })
    await closeSyncRow(supabase as never, 'log-1', makeResult({ mediaFailed: 4 }))
    const patch = update.mock.calls[0]![0] as { error_message: string }
    expect(patch.error_message).toBe(' mediaFailed:4')
    expect(patch.error_message).toContain(' mediaFailed:')
  })

  it('failed sobrescreve o error_message, redigido e truncado', async () => {
    const { supabase, update } = mockSupabase({ existingMessage: 'detail: ok' })
    await closeSyncRow(supabase as never, 'log-1', null, `boom access_token=${'a'.repeat(64)}`)
    const patch = update.mock.calls[0]![0] as { status: string; error_message: string }
    expect(patch.status).toBe('failed')
    expect(patch.error_message).toBe('boom access_token=[REDACTED]')
  })

  it('é no-op de escrita quando logId é null', async () => {
    const { supabase, update } = mockSupabase()
    await closeSyncRow(supabase as never, null, makeResult())
    expect(supabase.from).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('nunca lança quando a escrita falha', async () => {
    const supabase = { from: vi.fn(() => { throw new Error('offline') }) }
    await expect(closeSyncRow(supabase as never, 'log-1', makeResult())).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/sync-log.test.ts
```

Expected: **FAIL** com `Failed to resolve import "@/lib/instagram/sync-log"`.

- [ ] **Step 3: Estender `SyncResult`**

Em `apps/web/src/lib/instagram/types.ts`, substitua o bloco de `:96-101`:

```ts
export interface SyncResult {
  postsFound: number
  postsInserted: number
  postsUpdated: number
  mediaCached: number
  /** true quando o prazo (`opts.deadlineAt`) cortou o cache de imagens antes do fim. */
  partial: boolean
  /** `newItems.length - cachedUrls.size` — imagens novas que não viraram blob neste run. */
  mediaFailed: number
}
```

- [ ] **Step 4: Write minimal implementation**

Crie `apps/web/src/lib/instagram/sync-log.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { redactSecrets } from '@/lib/redact-secrets'
import type { InstagramAccountRow, InstagramSyncMode, SyncResult } from './types'

/**
 * Escrita de `instagram_sync_log` (spec §3.2, commit A2).
 *
 * Hoje isso está inline em `api/cron/instagram-sync/route.ts:48-53,63-72,76-82`
 * e em `api/cron/instagram-token-refresh/route.ts:39-46,58-63,69-75`. C2 troca
 * as duas rotas por estes helpers; A já os entrega porque `triggerInstagramSync`
 * (A2) passa a abrir e fechar a própria linha.
 *
 * `instagram_sync_log` não tem coluna de detalhe (`20260507190000:70-89`), então
 * `openSyncRow` usa `error_message` com o prefixo `'detail: '`, que NÃO contamina
 * a janela de `evaluateTransientStreak` (ela só conta prefixo `transient:`).
 *
 * Nenhuma das duas funções lança: `logId === null` é o sinal de falha e o
 * chamador é quem registra (crons: `step_errors++` + `captureException`;
 * callback: `captureMessage`).
 */

const MAX_MESSAGE = 500

export async function openSyncRow(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  mode: InstagramSyncMode,
  opts?: { detail?: string },
): Promise<string | null> {
  const detail = opts?.detail
  const errorMessage = detail
    ? `detail: ${redactSecrets(detail).slice(0, MAX_MESSAGE)}`
    : null

  try {
    const { data, error } = await supabase
      .from('instagram_sync_log')
      .insert({
        site_id: account.site_id,
        account_id: account.id,
        mode,
        status: 'started',
        error_message: errorMessage,
      })
      .select('id')
      .single()

    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}

export async function closeSyncRow(
  supabase: SupabaseClient,
  logId: string | null,
  result: SyncResult | null,
  errorMessage?: string,
): Promise<void> {
  if (logId === null) return

  const completedAt = new Date().toISOString()

  try {
    if (result) {
      // `completed` PRESERVA o `detail:` escrito por `openSyncRow` e só acrescenta
      // sufixos — Decisão de §3.2: nenhuma coluna nova.
      const { data: existing } = await supabase
        .from('instagram_sync_log')
        .select('error_message')
        .eq('id', logId)
        .single()

      const base = (existing as { error_message: string | null } | null)?.error_message ?? ''
      let message = base
      if (result.partial) message += ' partial'
      if (result.mediaFailed > 0) message += ` mediaFailed:${result.mediaFailed}`

      await supabase
        .from('instagram_sync_log')
        .update({
          status: 'completed',
          posts_found: result.postsFound,
          posts_inserted: result.postsInserted,
          posts_updated: result.postsUpdated,
          media_cached: result.mediaCached,
          error_message: message === '' ? null : message.slice(0, MAX_MESSAGE),
          completed_at: completedAt,
        })
        .eq('id', logId)
      return
    }

    await supabase
      .from('instagram_sync_log')
      .update({
        status: 'failed',
        error_message: errorMessage
          ? redactSecrets(errorMessage).slice(0, MAX_MESSAGE)
          : null,
        completed_at: completedAt,
      })
      .eq('id', logId)
  } catch {
    // Nunca lança: a trilha é best-effort e não pode derrubar o run.
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/sync-log.test.ts
```

Expected: **PASS** — `Tests 13 passed`.

- [ ] **Step 6: Conferir que `SyncResult` não quebrou outros consumidores**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
grep -rn "SyncResult" src test | grep -v sync-log
npx tsc --noEmit
```

Expected: `tsc` **falha** em `src/lib/instagram/sync.ts:61` — `Property 'partial' is missing in type '{ postsFound: number; … }'`. Isso é esperado e é consertado na Tarefa 4, **no mesmo commit lógico A**. Para manter a árvore compilando neste sub-commit, aplique já o mínimo em `sync.ts:61`:

```ts
  const result: SyncResult = {
    postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0,
    partial: false, mediaFailed: 0,
  }
```

Rode `npx tsc --noEmit` de novo. Expected: sem saída (exit 0).

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/instagram/types.ts apps/web/src/lib/instagram/sync-log.ts \
        apps/web/src/lib/instagram/sync.ts apps/web/test/instagram/sync-log.test.ts
git commit -m "chore(instagram): add sync-log helpers and SyncResult partial/mediaFailed (A 2/6)"
```

---

### Task 4: `syncInstagramAccount` — assinatura final, prazo, timeout, upsert que lança (A2, itens ii/iv/vi)

**Files:**
- Modify: `apps/web/src/lib/instagram/sync.ts:6-33` (`cacheImage`), `:35-52` (`cacheImagesInBatches`), `:54-112` (`syncInstagramAccount`)
- Test: `apps/web/test/instagram/sync.test.ts` (estendido; ganha `// @vitest-environment node`)

**Interfaces:**
- Consumes: `SyncResult` (Tarefa 3).
- Produces:
  - ```ts
    export async function syncInstagramAccount(
      supabase: SupabaseClient,
      account: InstagramAccountRow,
      accessToken?: string,
      opts?: { deadlineAt?: number },
    ): Promise<SyncResult>
    ```
    **Esta é a assinatura FINAL** (§0 linha A, item ii). C2 apenas torna `accessToken` obrigatório e troca o `onConflict`; nenhum outro commit mexe na forma.
  - Constante de mensagem (não exportada, mas contratual — §5/§0 item vi):
    `"This account isn't connected — use Connect with Instagram"`.

- [ ] **Step 1: Write the failing test**

Em `apps/web/test/instagram/sync.test.ts`: (a) acrescente o pragma na **primeira linha**; (b) complete `makeAccount` com as 4 colunas de texto de seção; (c) acrescente os testes abaixo ao fim do `describe`; (d) troque as duas asserções de mensagem crua.

Primeira linha do arquivo:

```ts
// @vitest-environment node
```

Substitua `makeAccount` (`:26-34`) por:

```ts
function makeAccount(overrides: Partial<InstagramAccountRow> = {}): InstagramAccountRow {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test',
    ig_user_id: 'ig-user-1', access_token: 'tok-abc',
    token_expires_at: '2026-07-01T00:00:00Z', sync_enabled: true,
    display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: null, created_at: '', updated_at: '', ...overrides,
  }
}
```

Substitua os dois testes de `:110-118` por:

```ts
  it('reports a human message when the account has no token', async () => {
    const { supabase } = mockSupabase()
    await expect(
      syncInstagramAccount(supabase as never, makeAccount({ access_token: null })),
    ).rejects.toThrow("This account isn't connected — use Connect with Instagram")
  })

  it('reports a human message when the account has no ig_user_id', async () => {
    const { supabase } = mockSupabase()
    await expect(
      syncInstagramAccount(supabase as never, makeAccount({ ig_user_id: null })),
    ).rejects.toThrow("This account isn't connected — use Connect with Instagram")
  })
```

Acrescente ao fim do `describe('syncInstagramAccount', …)`:

```ts
  it('prefers the explicit accessToken over the row value', async () => {
    mockFetchMedia.mockResolvedValueOnce([])
    const { supabase } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount(), 'explicit-token')
    expect(mockFetchMedia).toHaveBeenCalledWith('ig-user-1', 'explicit-token')
  })

  it('falls back to account.access_token when accessToken is omitted', async () => {
    mockFetchMedia.mockResolvedValueOnce([])
    const { supabase } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount())
    expect(mockFetchMedia).toHaveBeenCalledWith('ig-user-1', 'tok-abc')
  })

  it('reports partial: false and mediaFailed: 0 on a clean run', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'media-1', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: null, permalink: 'https://instagram.com/p/1/',
      like_count: 0, comments_count: 0, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount())
    expect(result.partial).toBe(false)
    expect(result.mediaFailed).toBe(0)
  })

  it('passes an AbortSignal to every image download', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'media-1', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: null, permalink: 'https://instagram.com/p/1/',
      like_count: 0, comments_count: 0, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount())
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const init = mockFetch.mock.calls[0]![1] as { signal: AbortSignal }
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('starts no batch after the deadline and reports partial with mediaFailed', async () => {
    mockFetchMedia.mockResolvedValueOnce([
      { id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg', caption: null, permalink: 'p1', like_count: 0, comments_count: 0, timestamp: '2026-05-01T00:00:00+0000' },
      { id: 'm2', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/2.jpg', caption: null, permalink: 'p2', like_count: 0, comments_count: 0, timestamp: '2026-05-02T00:00:00+0000' },
    ])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(
      supabase as never, makeAccount(), undefined, { deadlineAt: Date.now() - 1 },
    )
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.partial).toBe(true)
    expect(result.mediaCached).toBe(0)
    expect(result.mediaFailed).toBe(2)
    expect(result.postsFound).toBe(2)
  })

  it('aborts a hung download and closes the batch on the remaining deadline', async () => {
    // Prova que o prazo limita o LOTE, não só o intervalo entre lotes: o fetch
    // nunca resolve e só termina pelo próprio AbortSignal.timeout.
    mockFetch.mockImplementation((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('TimeoutError')))
      }),
    )
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg',
      caption: null, permalink: 'p1', like_count: 0, comments_count: 0,
      timestamp: '2026-05-01T00:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(
      supabase as never, makeAccount(), undefined, { deadlineAt: Date.now() + 1_000 },
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.partial).toBe(true)
    expect(result.mediaFailed).toBe(1)
  }, 10_000)

  it('throws when the posts upsert fails', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg',
      caption: null, permalink: 'p1', like_count: 0, comments_count: 0,
      timestamp: '2026-05-01T00:00:00+0000',
    }])
    const { supabase, upsertFn, updateFn } = mockSupabase()
    upsertFn.mockReturnValue({ data: null, error: { message: 'duplicate key value', code: '23505' }, count: null })
    await expect(syncInstagramAccount(supabase as never, makeAccount()))
      .rejects.toThrow('duplicate key value')
    // (iv): last_synced_at só em upsert sem erro.
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('keeps the postgres code on the thrown upsert error', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg',
      caption: null, permalink: 'p1', like_count: 0, comments_count: 0,
      timestamp: '2026-05-01T00:00:00+0000',
    }])
    const { supabase, upsertFn } = mockSupabase()
    upsertFn.mockReturnValue({ data: null, error: { message: 'duplicate key value', code: '23505' }, count: null })
    await expect(syncInstagramAccount(supabase as never, makeAccount()))
      .rejects.toMatchObject({ code: '23505' })
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/sync.test.ts
```

Expected: **FAIL** — entre outros, `expected [Error: No access token] to match "This account isn't connected…"`, `expected "spy" to be called 0 times, but got 1` (o `fetch` do prazo vencido) e `promise resolved instead of rejecting` no teste do upsert.

- [ ] **Step 3: Write minimal implementation**

Substitua `apps/web/src/lib/instagram/sync.ts:6-112` inteiro por:

```ts
const IMAGE_CACHE_CONCURRENCY = 5
const IMAGE_FETCH_TIMEOUT_MS = 8_000
const IMAGE_FETCH_MIN_TIMEOUT_MS = 1_000

/** §5/§0(vi): erro cru da Meta nunca chega ao dono. */
const NOT_CONNECTED = "This account isn't connected — use Connect with Instagram"

/**
 * §0 linha A, item (ii): o `fetch` do Node não tem timeout padrão, então uma
 * conexão pendurada em `scontent.cdninstagram.com` prende o run
 * indefinidamente e a checagem ENTRE lotes nunca é alcançada.
 */
function imageTimeoutMs(deadlineAt: number | undefined): number {
  if (deadlineAt === undefined) return IMAGE_FETCH_TIMEOUT_MS
  return Math.max(
    IMAGE_FETCH_MIN_TIMEOUT_MS,
    Math.min(IMAGE_FETCH_TIMEOUT_MS, deadlineAt - Date.now()),
  )
}

async function cacheImage(
  accountId: string,
  item: InstagramMediaItem,
  deadlineAt?: number,
): Promise<string | null> {
  const urlToCache = item.media_type === 'VIDEO'
    ? (item.thumbnail_url ?? item.media_url)
    : item.media_url

  if (!urlToCache) return null

  try {
    const imgRes = await fetch(urlToCache, {
      signal: AbortSignal.timeout(imageTimeoutMs(deadlineAt)),
    })
    if (!imgRes.ok) return null
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const blobResult = await put(
      `instagram/${accountId}/${item.id}.${ext}`,
      buffer,
      { access: 'public', addRandomSuffix: false, contentType },
    )
    return blobResult.url
  } catch {
    return null
  }
}

async function cacheImagesInBatches(
  accountId: string,
  items: InstagramMediaItem[],
  deadlineAt?: number,
): Promise<{ cached: Map<string, string>; partial: boolean }> {
  const cached = new Map<string, string>()

  for (let i = 0; i < items.length; i += IMAGE_CACHE_CONCURRENCY) {
    if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
      return { cached, partial: true }
    }

    const batch = items.slice(i, i + IMAGE_CACHE_CONCURRENCY)
    const settle = Promise.allSettled(
      batch.map((item) => cacheImage(accountId, item, deadlineAt)),
    )

    let results: PromiseSettledResult<string | null>[] | null
    if (deadlineAt === undefined) {
      results = await settle
    } else {
      // Cada LOTE corre contra o prazo restante; os downloads em voo são
      // abortados pelos próprios `AbortSignal.timeout`.
      let timer: ReturnType<typeof setTimeout> | undefined
      const remaining = Math.max(0, deadlineAt - Date.now())
      const deadlinePromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), remaining)
      })
      results = await Promise.race([settle, deadlinePromise])
      if (timer !== undefined) clearTimeout(timer)
    }

    if (results === null) return { cached, partial: true }

    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        cached.set(batch[idx]!.id, r.value)
      }
    })
  }

  return { cached, partial: false }
}

export async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  accessToken?: string,
  opts?: { deadlineAt?: number },
): Promise<SyncResult> {
  const token = accessToken ?? account.access_token
  if (!token) throw new Error(NOT_CONNECTED)
  if (!account.ig_user_id) throw new Error(NOT_CONNECTED)

  const result: SyncResult = {
    postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0,
    partial: false, mediaFailed: 0,
  }

  const media = await fetchInstagramMedia(account.ig_user_id, token)
  result.postsFound = media.length

  if (media.length === 0) return result

  const mediaIds = media.map((m) => m.id)
  const { data: existing } = await supabase
    .from('instagram_posts')
    .select('ig_media_id, cached_image_url')
    .eq('account_id', account.id)
    .in('ig_media_id', mediaIds)

  const existingMap = new Map(
    (existing ?? []).map((r: { ig_media_id: string; cached_image_url: string | null }) => [r.ig_media_id, r.cached_image_url]),
  )

  const newItems = media.filter((m) => !existingMap.has(m.id))
  const { cached: cachedUrls, partial } = await cacheImagesInBatches(
    account.id, newItems, opts?.deadlineAt,
  )
  result.mediaCached = cachedUrls.size
  result.partial = partial
  result.mediaFailed = newItems.length - cachedUrls.size

  const rows = media.map((item) => ({
    account_id: account.id,
    ig_media_id: item.id,
    media_type: item.media_type,
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url ?? null,
    cached_image_url: cachedUrls.get(item.id) ?? existingMap.get(item.id) ?? null,
    caption: item.caption,
    permalink: item.permalink,
    like_count: item.like_count,
    comments_count: item.comments_count,
    ig_timestamp: item.timestamp,
  }))

  const { error, count } = await supabase
    .from('instagram_posts')
    .upsert(rows, { onConflict: 'ig_media_id', count: 'exact' })

  // (iv): o erro do upsert era engolido (`if (!error)`), o que fazia um run
  // que não gravou nada carimbar `last_synced_at` e reportar sucesso.
  if (error) {
    const upsertError = new Error(error.message) as Error & { code?: string }
    if (typeof error.code === 'string') upsertError.code = error.code
    throw upsertError
  }

  result.postsInserted = newItems.length
  result.postsUpdated = (count ?? rows.length) - newItems.length

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/sync.test.ts
```

Expected: **PASS** — `Tests 14 passed` (6 originais + 8 novos).

- [ ] **Step 5: Conferir que os testes das rotas de cron continuam verdes (elas NÃO são editadas em A)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/cron-route.test.ts test/api/cron/instagram-sync.test.ts test/api/cron/instagram-token-refresh.test.ts
npx tsc --noEmit
```

Expected: todos **PASS** (as três suítes mockam `@/lib/instagram/sync`, então a assinatura nova não as alcança) e `tsc` sem saída.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/instagram/sync.ts apps/web/test/instagram/sync.test.ts
git commit -m "fix(instagram): deadline-aware sync with image timeout and thrown upsert errors (A 3/6)"
```

---

### Task 5: A1 — escopo de site nas escritas de `settings/actions.ts`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts:570-598` (`updateInstagramSettings`), `:601-633` (`setInstagramToken`), `:661-685` (`updateInstagramSlots`)
- Test: `apps/web/test/instagram/actions.test.ts` (estendido; ganha `// @vitest-environment node`)

**Interfaces:**
- Consumes: `requireEditAccess(): Promise<string>` (`actions.ts:18-27`, inalterado em A — vira `Promise<{ siteId, userId }>` só em C2).
- Produces: nenhuma assinatura pública nova (as três actions mantêm `Promise<ActionResult>`).

- [ ] **Step 1: Write the failing test**

Substitua `apps/web/test/instagram/actions.test.ts` inteiro por:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/instagram/api-client', () => ({ fetchInstagramProfile: vi.fn().mockResolvedValue({ id: 'ig-1' }) }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
const mockGetClient = vi.mocked(getSupabaseServiceClient)

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'
const POST_ID = '00000000-0000-0000-0000-000000000010'

describe('Instagram server actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('addInstagramAccount inserts row with handle and locale', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'acc-1' }, error: null }) }),
    })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: insertFn }) } as never)
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'pt' })
    expect(result.ok).toBe(true)
    expect(insertFn).toHaveBeenCalledTimes(1)
    // Regressão A1: o insert carrega o site do contexto, nunca um site do input.
    expect(insertFn.mock.calls[0]![0]).toMatchObject({ site_id: 'site-1' })
  })

  it('addInstagramAccount rejects invalid locale', async () => {
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'fr' as never })
    expect(result.ok).toBe(false)
  })

  it('removeInstagramAccount scopes the delete to the session site', async () => {
    const eqSite = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ delete: deleteFn }) } as never)
    const { removeInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await removeInstagramAccount({ accountId: ACCOUNT_ID })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSettings scopes the update to the session site', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [{ id: ACCOUNT_ID }], error: null })
    const eqSite = vi.fn().mockReturnValue({ select: selectFn })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const updateFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: updateFn }) } as never)
    const { updateInstagramSettings } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSettings({ accountId: ACCOUNT_ID, display_slots: 9 })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSettings reports not found when no row matches the site', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqSite = vi.fn().mockReturnValue({ select: selectFn })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqId }) }),
    } as never)
    const { updateInstagramSettings } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSettings({ accountId: ACCOUNT_ID, display_slots: 9 })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
  })

  it('setInstagramToken scopes the update to the session site', async () => {
    const eqSite = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const updateFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: updateFn }) } as never)
    const { setInstagramToken } = await import('@/app/cms/(authed)/settings/actions')
    const result = await setInstagramToken({ accountId: ACCOUNT_ID, accessToken: 'tok-abc' })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSlots updates positions in batch when the account belongs to the site', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsIn = vi.fn().mockResolvedValue({ data: [{ id: POST_ID }], error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: postsIn }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID,
      slots: [{ position: 1, postId: POST_ID }, { position: 2, postId: null }],
    })
    expect(result.ok).toBe(true)
    expect(upsertFn).toHaveBeenCalledTimes(1)
  })

  it('updateInstagramSlots refuses an account owned by another site', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-2' }, error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: null }],
    })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('updateInstagramSlots refuses a postId that belongs to another account', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsIn = vi.fn().mockResolvedValue({ data: [], error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: postsIn }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: POST_ID }],
    })
    expect(result).toEqual({ ok: false, error: 'Post not found for this account' })
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('updateInstagramSlots skips the post lookup when every slot is empty', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsSelect = vi.fn()
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') return { select: postsSelect }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: null }],
    })
    expect(result.ok).toBe(true)
    expect(postsSelect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/actions.test.ts
```

Expected: **FAIL** — `updateInstagramSettings scopes the update…` quebra com `eqId(...).eq is not a function` (hoje o encadeamento é `.eq('id').select('id')`), e as três de `updateInstagramSlots` quebram porque a action ainda não lê `instagram_accounts`.

- [ ] **Step 3: Write minimal implementation — `updateInstagramSettings`**

Em `apps/web/src/app/cms/(authed)/settings/actions.ts`, na função `updateInstagramSettings`, troque:

```ts
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { accountId, ...updates } = parsed.data

  const { error, data } = await supabase
    .from('instagram_accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .select('id')
```

por:

```ts
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { accountId, ...updates } = parsed.data

  // A1 (§0/§3.2): `getSupabaseServiceClient()` ignora RLS — sem `.eq('site_id')`
  // um editor de outro ring reescreve as configurações deste site.
  const { error, data } = await supabase
    .from('instagram_accounts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('site_id', siteId)
    .select('id')
```

- [ ] **Step 4: Write minimal implementation — `setInstagramToken`**

Na função `setInstagramToken`, troque `await requireEditAccess()` por `const siteId = await requireEditAccess()` e o `update` final por:

```ts
  const { error } = await supabase
    .from('instagram_accounts')
    .update({
      access_token: parsed.data.accessToken,
      ig_user_id: igUserId,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.accountId)
    .eq('site_id', siteId)
```

- [ ] **Step 5: Write minimal implementation — `updateInstagramSlots`**

Substitua o corpo de `updateInstagramSlots` (de `await requireEditAccess()` até o `upsert`) por:

```ts
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // `instagram_feed_slots` não tem `site_id` (20260507190000:56-68): a posse é
  // provada pela conta antes de qualquer escrita (§3.2, Commit A).
  const { data: account, error: accountError } = await supabase
    .from('instagram_accounts')
    .select('site_id')
    .eq('id', parsed.data.accountId)
    .single()

  if (accountError || !account) return { ok: false, error: 'Account not found' }
  if ((account as { site_id: string }).site_id !== siteId) {
    return { ok: false, error: 'Account not found' }
  }

  // `postId` (input) ↔ `post_id` (coluna): todo post fixado tem de pertencer a
  // ESTA conta — a FK só garante que o uuid existe em `instagram_posts`.
  const postIds = parsed.data.slots
    .map((s) => s.postId)
    .filter((id): id is string => id !== null)

  if (postIds.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from('instagram_posts')
      .select('id')
      .eq('account_id', parsed.data.accountId)
      .in('id', postIds)

    if (postsError) return { ok: false, error: postsError.message }
    const owned = new Set((posts ?? []).map((p: { id: string }) => p.id))
    if (postIds.some((id) => !owned.has(id))) {
      return { ok: false, error: 'Post not found for this account' }
    }
  }

  const rows = parsed.data.slots.map((s) => ({
    account_id: parsed.data.accountId,
    position: s.position,
    post_id: s.postId,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('instagram_feed_slots')
    .upsert(rows, { onConflict: 'account_id,position' })
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/actions.test.ts
npx tsc --noEmit
```

Expected: **PASS** — `Tests 10 passed`; `tsc` sem saída.

- [ ] **Step 7: Conferir o ratchet de `'use server'`**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/unit/use-server-exports.test.ts
```

Expected: **PASS** (`has no non-function exports`).

- [ ] **Step 8: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/actions.ts" apps/web/test/instagram/actions.test.ts
git commit -m "fix(instagram)!: scope instagram settings writes to the session site (A 4/6)"
```

---

### Task 6: A2 — `Sync Now` em processo + `maxDuration = 120`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts:11` (tipo) e `:636-659` (`triggerInstagramSync`)
- Modify: `apps/web/src/app/cms/(authed)/settings/page.tsx:8`
- Test: `apps/web/test/instagram/actions.test.ts` (estendido)

**Interfaces:**
- Consumes:
  - `syncInstagramAccount(supabase, account, accessToken?, opts?: { deadlineAt?: number }): Promise<SyncResult>` (Tarefa 4)
  - `openSyncRow(supabase, account, mode, opts?): Promise<string | null>` e `closeSyncRow(supabase, logId, result, errorMessage?): Promise<void>` (Tarefa 3)
- Produces:
  - `export type SyncActionResult = { ok: true; partial?: boolean } | { ok: false; error: string }` (em `settings/actions.ts` — `export type` é permitido pelo ratchet de `'use server'`)
  - `export async function triggerInstagramSync(input: { accountId: string }): Promise<SyncActionResult>`

- [ ] **Step 1: Write the failing test**

Acrescente ao fim de `apps/web/test/instagram/actions.test.ts` (dentro do mesmo arquivo, **fora** do `describe` existente):

```ts
// `vi.hoisted` porque `vi.mock` é içado para o topo do arquivo: sem ele, a
// fábrica referenciaria um `const` ainda em TDZ.
const { syncMock, openSyncRowMock, closeSyncRowMock } = vi.hoisted(() => ({
  syncMock: vi.fn(),
  openSyncRowMock: vi.fn(),
  closeSyncRowMock: vi.fn(),
}))
vi.mock('@/lib/instagram/sync', () => ({ syncInstagramAccount: syncMock }))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: openSyncRowMock,
  closeSyncRow: closeSyncRowMock,
}))

function accountRow(siteId = 'site-1') {
  return {
    id: ACCOUNT_ID, site_id: siteId, locale: 'pt', handle: 'thiago.figueiredo',
    ig_user_id: 'ig-1', access_token: 'tok-abc', token_expires_at: null,
    sync_enabled: true, display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: null, created_at: '', updated_at: '',
  }
}

/** `select('*').eq('id').eq('site_id').single()` */
function clientReturning(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eqSite = vi.fn().mockReturnValue({ single })
  const eqId = vi.fn().mockReturnValue({ eq: eqSite })
  const select = vi.fn().mockReturnValue({ eq: eqId })
  return {
    client: { from: vi.fn().mockReturnValue({ select }) },
    select, eqId, eqSite,
  }
}

describe('triggerInstagramSync (A2 — in-process)', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchSpy)
    openSyncRowMock.mockResolvedValue('log-1')
    closeSyncRowMock.mockResolvedValue(undefined)
    syncMock.mockResolvedValue({
      postsFound: 2, postsInserted: 1, postsUpdated: 1, mediaCached: 1,
      partial: false, mediaFailed: 0,
    })
  })

  it('reads the row scoped to the site and calls the sync IN PROCESS', async () => {
    const { client, select, eqId, eqSite } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({ ok: true })
    expect(select).toHaveBeenCalledWith('*')
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
    expect(syncMock).toHaveBeenCalledTimes(1)
    // Nenhuma chamada HTTP ao cron: é ela que carimbava cron_health['instagram-sync'].
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes the full row and a 90s deadline to syncInstagramAccount', async () => {
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const before = Date.now()
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    await triggerInstagramSync({ accountId: ACCOUNT_ID })

    const [, account, token, opts] = syncMock.mock.calls[0] as [
      unknown, { id: string; ig_user_id: string }, unknown, { deadlineAt: number },
    ]
    expect(account.id).toBe(ACCOUNT_ID)
    expect(account.ig_user_id).toBe('ig-1')
    expect(token).toBeUndefined()
    expect(opts.deadlineAt).toBeGreaterThanOrEqual(before + 90_000)
    expect(opts.deadlineAt).toBeLessThanOrEqual(Date.now() + 90_000)
  })

  it('errors when the account belongs to another site', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'no rows' } })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
    expect(syncMock).not.toHaveBeenCalled()
    expect(openSyncRowMock).not.toHaveBeenCalled()
  })

  it('opens a manual sync row and always closes it as completed', async () => {
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(openSyncRowMock).toHaveBeenCalledTimes(1)
    expect(openSyncRowMock.mock.calls[0]![2]).toBe('manual')
    expect(closeSyncRowMock).toHaveBeenCalledTimes(1)
    const [, logId, result] = closeSyncRowMock.mock.calls[0] as [unknown, string, { partial: boolean }]
    expect(logId).toBe('log-1')
    expect(result.partial).toBe(false)
  })

  // §6 descreve este caso como "fake timers + cacheImage de 91 s". `vi.useFakeTimers`
  // NÃO controla o relógio interno de `AbortSignal.timeout` (API nativa do Node),
  // então o cenário de 91 s é dividido: aqui, o plumbing da action com o `partial`
  // que `syncInstagramAccount` devolve; em `test/instagram/sync.test.ts`, o prazo
  // real cortando o lote ("aborts a hung download…", relógio de verdade, 1 s).
  // As duas asserções observáveis de §6 — `{ ok:true, partial:true }`,
  // `closeSyncRow` `completed`, nenhuma `started` aberta — ficam cobertas.
  it('returns { ok: true, partial: true } and still closes the row when the deadline cut the run', async () => {
    syncMock.mockResolvedValue({
      postsFound: 9, postsInserted: 4, postsUpdated: 0, mediaCached: 2,
      partial: true, mediaFailed: 2,
    })
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({ ok: true, partial: true })
    // Nunca `Promise.race` no closeSyncRow: nenhuma linha `started` fica aberta.
    expect(closeSyncRowMock).toHaveBeenCalledTimes(1)
    const [, , closed] = closeSyncRowMock.mock.calls[0] as [unknown, unknown, { partial: boolean }]
    expect(closed.partial).toBe(true)
  })

  it('closes the row as failed and surfaces the human message on throw', async () => {
    syncMock.mockRejectedValue(new Error("This account isn't connected — use Connect with Instagram"))
    const { client } = clientReturning({ data: accountRow(), error: null })
    mockGetClient.mockReturnValue(client as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: ACCOUNT_ID })

    expect(result).toEqual({
      ok: false,
      error: "This account isn't connected — use Connect with Instagram",
    })
    const [, , closedResult, message] = closeSyncRowMock.mock.calls[0] as [unknown, unknown, null, string]
    expect(closedResult).toBeNull()
    expect(message).toContain("isn't connected")
  })

  it('rejects a non-uuid accountId before touching the database', async () => {
    mockGetClient.mockReturnValue({ from: vi.fn() } as never)
    const { triggerInstagramSync } = await import('@/app/cms/(authed)/settings/actions')
    const result = await triggerInstagramSync({ accountId: 'not-a-uuid' })
    expect(result.ok).toBe(false)
    expect(syncMock).not.toHaveBeenCalled()
  })
})

describe('settings segment config', () => {
  it('declares maxDuration = 120 (the Sync Now runs in this segment)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(
      join(__dirname, '..', '..', 'src', 'app', 'cms', '(authed)', 'settings', 'page.tsx'),
      'utf8',
    )
    expect(src).toMatch(/^export const maxDuration = 120$/m)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/actions.test.ts
```

Expected: **FAIL** — `expected "spy" to not be called` (a action ainda faz `fetch` para `/api/cron/instagram-sync`), `openSyncRowMock` com 0 chamadas e `expected src to match /^export const maxDuration = 120$/m`.

- [ ] **Step 3: Write minimal implementation — `SyncActionResult` e `triggerInstagramSync`**

Em `apps/web/src/app/cms/(authed)/settings/actions.ts`, logo abaixo de `type ActionResult = …` (`:11`), acrescente:

```ts
/**
 * `ActionResult` não admite `partial`; `Sync Now` precisa dizer que o prazo de
 * 90 s cortou o cache de imagens sem chamar o run de falho (§0 linha A, item ii).
 */
export type SyncActionResult = { ok: true; partial?: boolean } | { ok: false; error: string }
```

Substitua a função `triggerInstagramSync` inteira por:

```ts
export async function triggerInstagramSync(input: {
  accountId: string
}): Promise<SyncActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // A2: a linha INTEIRA, escopada ao site. `syncInstagramAccount` exige o row
  // (`sync.ts` assinatura + os dois guardas de token/ig_user_id).
  const { data: row, error: rowError } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('id', parsed.data.accountId)
    .eq('site_id', siteId)
    .single()

  if (rowError || !row) return { ok: false, error: 'Account not found' }

  const account = row as import('@/lib/instagram/types').InstagramAccountRow
  const { openSyncRow, closeSyncRow } = await import('@/lib/instagram/sync-log')
  const { syncInstagramAccount } = await import('@/lib/instagram/sync')

  const start = Date.now()
  const logId = await openSyncRow(supabase, account, 'manual')

  try {
    // Chamada EM PROCESSO: o `fetch` para `/api/cron/instagram-sync?mode=manual`
    // carimbava `cron_health['instagram-sync']` (route.ts:27 passa
    // tag='instagram-sync' a withCronLock independentemente do mode), o que
    // fazia um clique manual mascarar um cron diário morto.
    const result = await syncInstagramAccount(supabase, account, undefined, {
      deadlineAt: start + 90_000,
    })
    await closeSyncRow(supabase, logId, result)
    revalidatePath('/cms/settings')
    revalidateTag('instagram-feed', { expire: 0 })
    return result.partial ? { ok: true, partial: true } : { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    await closeSyncRow(supabase, logId, null, message)
    return { ok: false, error: message }
  }
}
```

- [ ] **Step 4: Write minimal implementation — `maxDuration` na page**

Em `apps/web/src/app/cms/(authed)/settings/page.tsx`, logo depois da linha 8 (`export const dynamic = 'force-dynamic'`):

```ts
export const dynamic = 'force-dynamic'
// `Sync Now` (triggerInstagramSync) roda EM PROCESSO neste segmento: um feed
// grande passa da duração-padrão de função do projeto (60 s no Pro).
// A herança do segment config pela server action é a premissa medida pelo
// gate depois de A (spec §7) — precedentes: social/stories/new/page.tsx:21,
// youtube/competitors/page.tsx:27.
export const maxDuration = 120
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run test/instagram/actions.test.ts
```

Expected: **PASS** — `Tests 18 passed`.

- [ ] **Step 6: Conferir o consumidor client e o ratchet**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx tsc --noEmit
npx vitest run test/unit/use-server-exports.test.ts
sed -n '150,162p' "src/app/cms/(authed)/settings/_sections/instagram.tsx"
```

Expected: `tsc` sem saída (o `if (!res.ok) alert(res.error)` de `_sections/instagram.tsx:159` estreita `SyncActionResult` corretamente — **nenhuma edição é necessária ali**); ratchet **PASS**.

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/actions.ts" \
        "apps/web/src/app/cms/(authed)/settings/page.tsx" \
        apps/web/test/instagram/actions.test.ts
git commit -m "fix(instagram)!: run Sync Now in process and stop forging cron_health (A 5/6)"
```

---

### Task 7: A3 — migration `instagram_public_view_lockdown` + ratchet DB-gated

**Files:**
- Create: `supabase/migrations/20260906000001_instagram_public_view_lockdown.sql` (gerado por `npm run db:new`)
- Create: `apps/web/test/integration/instagram-accounts-public-view.test.ts`

**Interfaces:**
- Consumes: `skipIfNoLocalDb()` de `apps/web/test/helpers/db-skip.ts`; `SUPABASE_URL`, `ANON_KEY`, `SERVICE_KEY`, `signUserJwt`, `seedRbacScenario`, `cleanupRbacScenario`, `type RbacScenario` de `apps/web/test/helpers/db-seed.ts`.
- Produces: as **duas allow-lists** que M1 (C1) é obrigada a manter — `authenticated` = as 16 colunas de `instagram_accounts` **menos** `access_token`; `anon` = **exatamente** `{id, site_id}`.

- [ ] **Step 1: Write the failing test**

Crie `apps/web/test/integration/instagram-accounts-public-view.test.ts`:

```ts
// @vitest-environment node
/**
 * DB-gated (A3, spec §0 linha A / §4 / §6).
 *
 * Dois vazamentos vivos:
 *  (a) `instagram_accounts_public` sem `security_invoker` + `ALTER DEFAULT
 *      PRIVILEGES … GRANT ALL ON TABLES TO "anon"` (schema.sql:7460) ⇒ a anon
 *      key lê a view de TODOS os sites.
 *  (b) `instagram_accounts_staff_read FOR SELECT TO authenticated`
 *      (20260507190000:98-101) + grant de TABELA herdado (schema.sql:7462) ⇒
 *      qualquer editor lê `access_token` em claro por PostgREST. RLS não filtra
 *      colunas — só derrubando o grant de tabela e re-concedendo a allow-list
 *      o PostgREST devolve 42501.
 *
 * O ratchet duplo do fim do arquivo é o que impede que um `add column` futuro
 * (M1/C1) reabra o buraco ou que um `grant` reabra `anon`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL, ANON_KEY, SERVICE_KEY,
  signUserJwt, seedRbacScenario, cleanupRbacScenario, type RbacScenario,
} from '../helpers/db-seed'

const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** As 16 colunas da view (20260507220000:41-49) — tudo menos `access_token`. */
const AUTHENTICATED_ALLOW_LIST = [
  'created_at', 'display_slots', 'handle', 'id', 'ig_user_id', 'last_synced_at',
  'layout_type', 'locale', 'section_subtitle_en', 'section_subtitle_pt',
  'section_title_en', 'section_title_pt', 'site_id', 'sync_enabled',
  'token_expires_at', 'updated_at',
].sort()

const ANON_ALLOW_LIST = ['id', 'site_id']

function clientFor(userId: string): SupabaseClient {
  const { jwt } = signUserJwt(userId)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

describe.skipIf(skipIfNoLocalDb())('instagram_accounts column lockdown (A3)', () => {
  let admin: SupabaseClient
  let anon: SupabaseClient
  let pg: Client
  let s: RbacScenario
  let accountId: string

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    s = await seedRbacScenario(admin)

    const ins = await admin.from('instagram_accounts').insert({
      site_id: s.siteAId,
      locale: 'pt',
      handle: 'thiago.figueiredo',
      access_token: 'super-secret-token-value',
    }).select('id').single()
    expect(ins.error).toBeNull()
    accountId = (ins.data as { id: string }).id
  })

  afterAll(async () => {
    await admin.from('instagram_accounts').delete().eq('id', accountId)
    await cleanupRbacScenario(admin, s)
    await pg.end()
  })

  // ── View pública ────────────────────────────────────────────────
  it('anon cannot read instagram_accounts_public', async () => {
    const { error } = await anon.from('instagram_accounts_public').select('id').limit(1)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('the service client still reads the view (home feed + /go linktree)', async () => {
    const { data, error } = await admin
      .from('instagram_accounts_public')
      .select('id, handle, site_id')
      .eq('id', accountId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('the view carries no access_token column', async () => {
    const { rows } = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'instagram_accounts_public'`,
    )
    expect(rows.map((r) => r.column_name)).not.toContain('access_token')
  })

  it('the view runs with security_invoker', async () => {
    const { rows } = await pg.query<{ opts: string[] | null }>(
      `select c.reloptions as opts from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'instagram_accounts_public'`,
    )
    expect(rows[0]?.opts ?? []).toContain('security_invoker=true')
  })

  // ── Tabela-base: authenticated ──────────────────────────────────
  it('authenticated with can_edit_site reads the allowed columns', async () => {
    const c = clientFor(s.editorAId)
    const { data, error } = await c
      .from('instagram_accounts').select('id, handle').eq('id', accountId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('authenticated CANNOT read access_token', async () => {
    const c = clientFor(s.editorAId)
    const { error } = await c.from('instagram_accounts').select('access_token').eq('id', accountId)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('authenticated select("*") is 42501 (observable API change — deliberate)', async () => {
    // O `select=*` do PostgREST expande para `SELECT *` no banco e bate no grant
    // de coluna. Fixar isto aqui é o que impede que uma feature futura
    // "conserte" o 42501 com um bypass por service client (§1(b)).
    const c = clientFor(s.editorAId)
    const { error } = await c.from('instagram_accounts').select('*').eq('id', accountId)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  // ── Tabela-base: anon ───────────────────────────────────────────
  it('anon CANNOT read access_token', async () => {
    const { error } = await anon.from('instagram_accounts').select('access_token').limit(1)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('anon still reads posts through the public policy EXISTS (id, site_id)', async () => {
    // As policies *_public_read dereferenciam só `a.id` e `a.site_id`
    // (20260507190000:111-119 e :139-147) — o EXISTS continua executando.
    const { error } = await anon.from('instagram_posts').select('id').limit(1)
    expect(error).toBeNull()
  })

  // ── Ratchet duplo ───────────────────────────────────────────────
  it('ratchet (i): authenticated holds SELECT on every column EXCEPT access_token', async () => {
    const { rows } = await pg.query<{ column_name: string }>(
      `select distinct column_name from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'instagram_accounts'
          and grantee = 'authenticated' and privilege_type = 'SELECT'
        order by column_name`,
    )
    const granted = rows.map((r) => r.column_name)
    expect(granted).not.toContain('access_token')
    // Falha assim que um `add column` (M1/C1) chegar sem o `grant select (…)`.
    expect(granted).toEqual(AUTHENTICATED_ALLOW_LIST)
  })

  it('ratchet (ii): anon holds SELECT on EXACTLY {id, site_id}', async () => {
    const { rows } = await pg.query<{ column_name: string }>(
      `select distinct column_name from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'instagram_accounts'
          and grantee = 'anon' and privilege_type = 'SELECT'
        order by column_name`,
    )
    expect(rows.map((r) => r.column_name)).toEqual(ANON_ALLOW_LIST)
  })

  it('ratchet (iii): neither role holds SELECT on the public view', async () => {
    const { rows } = await pg.query<{ grantee: string }>(
      `select distinct grantee from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'instagram_accounts_public'
          and grantee in ('anon', 'authenticated')`,
    )
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:start
cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-accounts-public-view.test.ts --reporter=verbose
```

Expected: **FAIL** — `anon cannot read instagram_accounts_public` recebe `error === null` (a view é `security_definer` e `anon` tem grant herdado); `authenticated CANNOT read access_token` recebe `error === null`; os três ratchets falham (`granted` traz `access_token`, `anon` traz as 17 colunas, a view aparece para os dois papéis).

- [ ] **Step 3: Gerar o arquivo de migration (NUNCA à mão)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:new instagram_public_view_lockdown
```

Expected: `Created: supabase/migrations/20260906000001_instagram_public_view_lockdown.sql` (a última existente é `20260905000003`; hoje é 2026-09-06 ⇒ `20260906000001`). Se o nome vier diferente, use o que o script imprimiu em todos os comandos seguintes.

- [ ] **Step 4: Write the migration SQL**

Substitua o conteúdo do arquivo gerado por:

```sql
-- =============================================================================
-- MIGRATION: instagram_public_view_lockdown  (spec §0 linha A / A3)
--
-- (a) A view `instagram_accounts_public` roda hoje como SECURITY DEFINER (o
--     default do Postgres) e `anon` tem SELECT herdado do
--     `ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
--      GRANT ALL ON TABLES TO "anon"` de 20260507000001_schema.sql:7460 —
--     não existe GRANT literal sobre a tabela para grepar. Resultado: a anon
--     key pública lê a view de TODOS os sites.
--
-- (b) `instagram_accounts_staff_read` é `FOR SELECT TO authenticated`
--     (20260507190000:98-101) e RLS NÃO filtra colunas: qualquer editor lê
--     `access_token` em claro por PostgREST.
--     `revoke select (access_token)` sozinho é NO-OP — privilégio de TABELA
--     implica todas as colunas e não há grant de coluna a revogar. Só
--     derrubando o de tabela e re-concedendo a allow-list o PostgREST devolve
--     42501 (verificado localmente).
--
-- `anon` também sai do grant de tabela e recebe exatamente {id, site_id}: são
-- as duas colunas que o EXISTS das policies *_public_read dereferencia
-- (20260507190000:111-119 e :139-147), então o EXISTS continua executando sem
-- 42501 e continua devolvendo 0 linhas para `anon` (a única policy de SELECT
-- sobre a tabela é `instagram_accounts_staff_read TO authenticated`).
--
-- Racional (MUST): manter o grant de tabela deixaria `access_token` protegido
-- só por RLS; bastaria alguém acrescentar o `instagram_accounts_public_read`
-- que o CLAUDE.md manda usar (`public.site_visible(site_id)`) para a anon key
-- pública ler o token de todos os sites.
--
-- Idempotente: `alter view … set`, `revoke` e `grant` podem rodar N vezes.
-- MANUTENÇÃO: toda coluna nova de `instagram_accounts` (M1/C1) MUST ser
-- re-concedida a `authenticated`; `anon` NUNCA ganha coluna nova. O ratchet
-- DB-gated `test/integration/instagram-accounts-public-view.test.ts` falha se
-- qualquer das duas regras for quebrada.
-- =============================================================================

alter view public.instagram_accounts_public set (security_invoker = true);

revoke all on public.instagram_accounts_public from anon, authenticated;

-- authenticated: allow-list de 16 colunas = a view inteira (tudo menos access_token)
revoke select on public.instagram_accounts from authenticated;
grant select (
  id, site_id, locale, handle, ig_user_id, token_expires_at, sync_enabled,
  display_slots, layout_type, section_title_pt, section_title_en,
  section_subtitle_pt, section_subtitle_en, last_synced_at, created_at, updated_at
) on public.instagram_accounts to authenticated;

-- anon: exatamente o que o EXISTS das policies *_public_read dereferencia
revoke select on public.instagram_accounts from anon;
grant select (id, site_id) on public.instagram_accounts to anon;

notify pgrst, 'reload schema';
```

- [ ] **Step 5: Aplicar localmente e rodar o teste**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:reset
cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-accounts-public-view.test.ts --reporter=verbose
```

Expected: **PASS** — `Tests 12 passed`, `skipped 0`. Confira no log verbose que o nome do arquivo aparece com testes **passados** (o gate de §7 exige exatamente isso: suíte pulada com exit 0 **não** cumpre o gate).

- [ ] **Step 6: Conferir que os leitores por service client continuam funcionando**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration --reporter=dot
npx tsc --noEmit
```

Expected: nenhuma regressão nas outras suítes de integração; `tsc` sem saída.

- [ ] **Step 7: Regenerar os tipos (grants não mudam o schema, mas o gate manda conferir)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:types
git diff --stat apps/web/src/types/database.types.ts
```

Expected: **diff vazio** (A3 só mexe em privilégios). Se houver diff, é resíduo de outra rodada — **não** commite junto; investigue antes.

- [ ] **Step 8: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add supabase/migrations/20260906000001_instagram_public_view_lockdown.sql \
        apps/web/test/integration/instagram-accounts-public-view.test.ts
git commit -m "fix(instagram)!: lock down instagram_accounts columns and public view (A 6/6)"
```

---

### Task 8: Verificação local completa, push único e `db:push:prod`

**Files:**
- Create: nenhum
- Modify: nenhum (só verificação e deploy)
- Test: a suíte inteira

**Interfaces:**
- Consumes: os 6 commits `A 1/6` … `A 6/6`.
- Produces: commit A em `staging` e em `main`, com A3 aplicada em produção.

- [ ] **Step 1: Conferir que o commit A é exatamente 6 commits contíguos**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git log --oneline -8
git log --oneline --grep='(A [1-6]/6)' | cat
```

Expected: os 6 na ordem `A 6/6` (mais novo) → `A 1/6`, sem commit de terceiros entre eles. Se outro terminal intercalou um commit, **não** rebase — registre os SHAs no Ledger e use `git revert <sha> <sha> …` explícito no rollback em vez do intervalo.

- [ ] **Step 2: Conferir que nada fora do escopo de A foi tocado**

```bash
git diff --name-only $(git log --format=%H --grep='(A 1/6)' -1)^..HEAD
```

Expected — **exatamente** estes 12 caminhos, nem um a mais:

```
apps/web/src/lib/redact-secrets.ts
apps/web/test/lib/redact-secrets.test.ts
apps/web/src/lib/instagram/types.ts
apps/web/src/lib/instagram/sync-log.ts
apps/web/test/instagram/sync-log.test.ts
apps/web/src/lib/instagram/sync.ts
apps/web/test/instagram/sync.test.ts
apps/web/src/app/cms/(authed)/settings/actions.ts
apps/web/src/app/cms/(authed)/settings/page.tsx
apps/web/test/instagram/actions.test.ts
supabase/migrations/20260906000001_instagram_public_view_lockdown.sql
apps/web/test/integration/instagram-accounts-public-view.test.ts
```

Em particular **MUST NOT** aparecer: `apps/web/src/app/api/cron/instagram-sync/route.ts`, `apps/web/test/instagram/cron-route.test.ts`, `apps/web/test/api/cron/instagram-sync.test.ts`, `apps/web/test/api/cron/instagram-token-refresh.test.ts` (todos são de A5/C2).

- [ ] **Step 3: Suíte inteira (é barata — ~160 s, medido 2026-09-03)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npx vitest run
```

Expected: **0 failed**. Se algo vermelho não for de A, confirme com `git stash list` vazio e com o baseline da Tarefa 1 antes de mexer.

- [ ] **Step 4: Suíte DB-gated**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
HAS_LOCAL_DB=1 npx vitest run test/integration --reporter=verbose
```

Expected: **0 failed**, e `instagram-accounts-public-view` com `skipped: 0`.

- [ ] **Step 5: Build real (paridade com a Vercel — obrigatório antes do push, orçamento de builds)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run build:packages
npm run build:web
```

Expected: build concluído sem erro. Confirme no output que a rota `/cms/settings` aparece como `ƒ (Dynamic)`.

- [ ] **Step 6: Push único**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git push origin staging
```

Expected: pre-push (ecosystem + pinning + typechecks, ~60 s) verde; push aceito. Acompanhe `ci.yml` até verde **antes** de promover.

- [ ] **Step 7: Promover para produção**

```bash
git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

Expected: fast-forward; build da Vercel verde.

- [ ] **Step 8: `db:push:prod` (aplica TODAS as pendentes — é gate)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run db:push:prod
```

Expected: aplica `20260906000001_instagram_public_view_lockdown`. Confirme:

```bash
npx supabase@2.98.2 db execute --linked --command "set role authenticated; select access_token from public.instagram_accounts limit 1;"
```

Expected: erro **42501** (`permission denied for table instagram_accounts` / coluna). Se vier linha, **PARE** e reabra A3.

```bash
npx supabase@2.98.2 db execute --linked --command "select distinct column_name from information_schema.column_privileges where table_schema='public' and table_name='instagram_accounts' and grantee='anon' and privilege_type='SELECT' order by column_name;"
```

Expected: exatamente `id` e `site_id`.

- [ ] **Step 9: Smoke do `Sync Now` em produção**

Abra `https://bythiagofigueiredo.com/cms/settings` (seção Instagram), clique **Sync Now** e confirme que a home continua servindo o feed. Isto é só fumaça — a **medição** é a Tarefa 9.

- [ ] **Step 10: Sem commit novo**

Esta tarefa não cria commit.

---

### Task 9: Gate depois de A — medir um `Sync Now` real e registrar no Ledger (decide A5)

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-instagram-oauth-a.md` (a tabela **Ledger** no topo deste arquivo)
- Create: nenhum
- Test: nenhum (medição em produção)

**Interfaces:**
- Consumes: commit A promovido (Tarefa 8) — portanto a chamada em processo de A2 no ar.
- Produces: o veredito que escolhe o **corpo** de `docs/superpowers/plans/2026-09-06-instagram-oauth-a5.md`.

- [ ] **Step 1: Registrar a duração-padrão de função do projeto**

Painel da Vercel → projeto → *Settings → Functions → Function Max Duration*.
Expected: um número (hoje **60 s** no Pro). Anote-o no Ledger. **Este número define o alvo do passo 3** — o run tem de ficar **acima** dele e abaixo de 120 s (alvo ≈ 70 s).

- [ ] **Step 2: Abrir o log de funções**

```bash
vercel logs https://bythiagofigueiredo.com --follow
```

(ou painel → *Functions*, filtrando o segmento `/cms/settings`). Deixe rodando.

- [ ] **Step 3: Disparar um `Sync Now` sobre a conta REAL de produção**

Em `https://bythiagofigueiredo.com/cms/settings`, seção Instagram, clique **Sync Now** na conta real — **com o volume de imagens que ela tem hoje**. **MUST NOT**: atraso sintético, variável de ambiente nova, conta de teste vazia.

Expected: um dos dois desfechos, lido na **duração da função** do log:
- **≈ 70 s ou mais, terminando em 200** (`{"ok":true}` ou `{"ok":true,"partial":true}`) ⇒ a `maxDuration = 120` da page **FOI herdada** pela server action.
- **504 / timeout em ~60 s** ⇒ **NÃO** foi herdada.

- [ ] **Step 4: Tratar o resultado inconclusivo**

Se o run terminar **abaixo de 60 s**, o gate é **INCONCLUSIVO** e **MUST** ser repetido com o run mais pesado disponível (ex.: apagar as linhas de `instagram_posts` da conta para forçar o re-cache de todas as imagens — `delete from public.instagram_posts where account_id = '<uuid>'` — e clicar de novo). **Nunca** dê o gate por aprovado por omissão.

- [ ] **Step 5: Conferir a trilha no banco**

```bash
npx supabase@2.98.2 db execute --linked --command "select mode, status, posts_found, media_cached, error_message, started_at, completed_at from public.instagram_sync_log order by started_at desc limit 3;"
```

Expected: uma linha `mode='manual'` com `status='completed'` (ou `failed` com mensagem humana) — **nunca** uma `started` sem `completed_at`. Se o run foi parcial, `error_message` traz ` partial` (e ` mediaFailed:<N>` se houve falha de imagem).

- [ ] **Step 6: Conferir que `cron_health` NÃO foi carimbado pelo clique**

```bash
npx supabase@2.98.2 db execute --linked --command "select cron_name, last_success_at, consecutive_failures from public.cron_health where cron_name = 'instagram-sync';"
```

Expected: `last_success_at` **inalterado** pelo clique (só o cron diário das 13:00 o move). Este é o efeito de A2 — se mudou, a action ainda está passando pela rota do cron.

- [ ] **Step 7: Preencher o Ledger e escolher o corpo de A5**

Edite a tabela **Ledger** no topo deste arquivo com: os dois SHAs (`git log --format=%H --grep='(A 1/6)' -1` e `... '(A 6/6)' -1`), a duração-padrão, a duração medida, o HTTP/corpo e o veredito. Então:

- **Veredito "herdou"** ⇒ `A5 = chore(instagram): drop manual mode from sync cron` — a rota perde `mode`/`accountId`, o lock vira `'instagram-sync'`, e as **duas** edições de §6 viajam nesse mesmo commit (`it('returns 400 for invalid mode')` de `test/api/cron/instagram-sync.test.ts:106-111` removido; `?mode=` de `test/instagram/cron-route.test.ts:30` reescrito).
- **Veredito "não herdou"** ⇒ `A5 = fix(instagram): restore HTTP transport for Sync Now` — `triggerInstagramSync` volta ao `fetch` autenticado (`Authorization: Bearer <CRON_SECRET>`) para `/api/cron/instagram-sync?mode=manual&accountId=<uuid>`; a rota **mantém** os dois parâmetros; **nenhuma** das duas edições de §6 acontece; e o `select('*').eq('id').eq('site_id').single()` de A2 **permanece**. Registre no Ledger a **dívida declarada**: o modo manual volta a carimbar `cron_health['instagram-sync']`.

Em nenhum dos dois ramos A é reeditado, e em nenhum deles o conteúdo de A5 migra para C2.

- [ ] **Step 8: Commit do Ledger**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add docs/superpowers/plans/2026-09-06-instagram-oauth-a.md
git commit --no-verify -m "docs(instagram): record the post-A maxDuration gate result (decides A5)"
git push origin staging
```

(`--no-verify` é permitido para commits só de plano/spec — regra do projeto para docs em árvore multi-terminal.)

---

## Rollback deste commit

`git revert` **tudo-ou-nada**, sobre o intervalo contíguo, e só é limpo enquanto C2/C3 não estiverem na árvore (§7):

```bash
git revert --no-commit <sha de A 1/6>^..<sha de A 6/6>
git commit -m "revert: commit A (instagram) — fecha vazamentos + sync-log/redact"
```

A3 reverte por SQL (nova migration, nunca editando a de A):

```sql
grant select on public.instagram_accounts to authenticated, anon;
grant select on public.instagram_accounts_public to anon, authenticated;
alter view public.instagram_accounts_public set (security_invoker = false);
notify pgrst, 'reload schema';
```

(Reverter A exige C3, C4, C2, C1, B e A5 revertidos antes — ordem obrigatória `C3 → C4 → C2 → C1 → B → A5 → A4 → A`.)
