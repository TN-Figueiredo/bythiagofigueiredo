# Instagram OAuth — C3 (`feat(instagram): OAuth de um clique (rotas + UI)`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task, **in order**. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o commit **C3** — as quatro rotas de `src/app/api/instagram/`, a página pública `/data-deletion`, as três server actions novas + guardas de locale, e toda a UI do card de Instagram (6 estados × 8 modificadores, botões de OAuth, banner de mismatch, `In progress`), de modo que o dono conecte/reconecte o feed com **um clique**, sem colar token.

**Architecture:** C3 é o **oitavo e último** commit da entrega (`A → A4 → A5 → B → C1 → C2 → C4 → C3`). Ele **não** cria nenhum helper de OAuth (vêm de B), nenhum helper de token/cifra/classificação (vêm de C2), nenhuma coluna (vem de C1) e nenhum cron (vem de C2/C3 não toca crons). C3 é composição: rotas HTTP que chamam os helpers de B/C2, escritas `.eq('site_id')`-escopadas, e um card de UI que renderiza estado derivado de props. O trabalho é feito em **N commits pequenos em `staging` (um por task) e UM único push ao final** — ver "Formato de commit" abaixo.

**Tech Stack:** Next.js 16.3.4 (App Router, Route Handlers, `after()` de `next/server`, `revalidateTag(tag, { expire: 0 })`, `await cookies()`), React 19 (client components), TypeScript 5 `strict` + `noUncheckedIndexedAccess`, Zod, Supabase (PostgREST via service client), `@vercel/blob` 2.5.0 (`list`/`del`), `@tn-figueiredo/auth-nextjs@2.2.0` (`requireSiteScope`), Vitest (`happy-dom` default; `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client), Sentry.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14) — linha C3 de §0; §3.1 (rotas), §3.2 (actions/escritores), §3.5 (UI inteira), §3.6 (runbook), §4 (segurança), §5 (mensagens EN), §6 (testes), §7 (gates + rollout), §8 (docs).

**Índice dos planos:** `docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`

## Formato de commit (decisão explícita)

**C3 é entregue como N commits pequenos em `staging` — um por task, cada um com testes verdes — e UM único push ao final.** Motivos:

1. `CLAUDE.md` proíbe `git stash`/`git reset` (2+ terminais trabalham em `staging` em paralelo); um `reset --soft` para esmagar os commits engoliria trabalho de outro terminal. Portanto **não há squash**.
2. `CLAUDE.md`/memória proíbem push desperdiçado (cada push dispara 4 builds na Vercel) ⇒ **um push só**, depois da Task 17.
3. O contrato de rollback de §7 (`git revert` de C3 antes de C2) continua valendo como **um** comando sobre o intervalo contíguo: `git revert --no-commit <primeiro_sha_C3>^..<último_sha_C3> && git commit -m "revert(instagram): C3 — OAuth de um clique"`. A Task 18 grava o intervalo de shas no runbook para que o rollback continue sendo um comando só.
4. O **primeiro** commit do intervalo usa a mensagem canônica da spec — `feat(instagram): OAuth de um clique (rotas + UI)` — e os demais usam `feat(instagram): …`/`test(instagram): …`/`docs(instagram): …` com escopo da task, para que `git log --oneline` mostre o commit nomeado pela spec no topo do intervalo.

Rodapé obrigatório em **todo** commit desta entrega:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
```

## Global Constraints

Herdadas do README (`docs/superpowers/plans/2026-09-06-instagram-oauth-README.md`, seção *Global Constraints*) — valem para **todas** as tasks:

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` (`lib/home/queries.ts`, `lib/cms/site-context.ts`, `lib/supabase/service.ts`, `lib/seo/enumerator.ts`) e `apps/web/src/lib/` (`src/lib/instagram/*`, `src/lib/oauth/*`, `src/lib/notifications/*`, `src/lib/ops/*`). Há dois `queries.ts` — sempre qualificar.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `@/lib/<domínio>/*` mapeia para `apps/web/lib/` só para 16 prefixos; `instagram`, `oauth`, `ops`, `notifications` caem no catch-all `@/*` → `src/`.
- TypeScript: nunca `any`; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Ratchet Next 16 (`test/unit/use-server-exports.test.ts:20-23`): em arquivos `'use server'` só `export async function` / `export type` / `export interface` / `export { type … }`.
- Nunca passar `next/link` (ou componente importado num Server Component) como prop para client component.
- Server actions de escrita chamam `requireEditAccess()` (→ `{ siteId, userId }` desde C2) no topo; `getSupabaseServiceClient()` só após o guard de site.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; sanitizers nunca sob happy-dom; fixtures temporais relativas ou com `vi.useFakeTimers`; **fix que exige mudança em teste vai no MESMO commit**.
- `revalidateTag(tag, { expire: 0 })` — segundo argumento obrigatório; `await cookies()`.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`reset`; **push só após verificação local completa**.
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- `SOCIAL_MASTER_KEY` fora de `env.ts`; `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` lidos de `process.env` direto.
- Definições nomeadas do spec valem por nome: **`CAMPOS_DE_EPISÓDIO`** = `token_error`, `token_error_at`, `token_error_mode`, `token_alert_sent_at`, `token_alert_attempt_at` (5 campos; `token_reprobe_at` **não** é campo de episódio e é zerado junto); horários `"0 11 * * *"` (refresh) / `"0 13 * * *"` (sync); **REGRA-PII-NTFY** (nenhum push ntfy carrega `@handle`, `token_error`, ids ou tokens; o `title` identifica o site por `sites.slug`).
- Plano Vercel **Pro** confirmado (2026-09-06). Fuso do site: `America/Sao_Paulo`.

Constraints adicionais **específicas de C3**:

- **Idioma da UI: inglês.** Nunca strings de máquina no card ou no popup — `kindFrom` no card, `oauthErrorText` no popup/erro inline. Exceções registradas: os rótulos "Título (PT-BR)" e "Subtítulo (PT-BR)" dos campos de texto da seção **ficam em PT** (§8).
- **Cola manual nunca é removida** (fallback permanente, objetivo 4).
- **O sync pós-OAuth NUNCA marca token inválido nem alerta** (§3.1 passo 11, objetivo 5).
- Toda falha das rotas de OAuth responde `oauthResultHtml` (`text/html`), **nunca** JSON e **nunca** 302 para login.
- Todo `click`/`action_href`/`backHref` aponta para **`/cms/settings/instagram`** (rota curta entregue em C2).
  **Sem exceções** — o push `ddmismatch` (Task 6) inclusive: o `body` dele manda ler o runbook, mas o
  `click` é o card, como em todos os outros emissores. Um link de GitHub no celular não é destino
  acionável, e a entrada `ddmismatch` da seção "O ntfy tocou — o que fazer" (Task 17) é o que traduz o
  push em ação.

---

## File Structure

**Criados (C3):**

| Arquivo | Responsabilidade |
|---|---|
| `src/app/api/instagram/oauth/route.ts` | `GET` início do fluxo: sessão, config, conta, origem, `rebind`, cookie de nonce, 302 para a Meta |
| `src/app/api/instagram/oauth/callback/route.ts` | `GET` retorno: `state`, sessão, troca de código, troca longa, identidade, mismatch, escrita, sync pós-OAuth em `after()` |
| `src/lib/instagram/signed-request.ts` | Leitura+verificação do `signed_request` da Meta (passos 1–5 de §3.1) compartilhada pelas duas rotas públicas, incluindo o alerta de assinatura com guarda de 60 s |
| `src/app/api/instagram/deauthorize/route.ts` | `POST` callback de desautorização da Meta |
| `src/app/api/instagram/data-deletion/route.ts` | `POST` callback de pedido de exclusão da Meta |
| `src/app/(public)/data-deletion/page.tsx` | Página pública de status do pedido (bilíngue, `noindex`, fora do sitemap) |
| `src/lib/instagram/locale-rules.ts` | Regra isomórfica `pt`/`en`/`all` usada pelo servidor (actions) **e** pelo cliente (form/`<select>`) |
| `src/app/cms/(authed)/settings/_sections/instagram-status.ts` | Lógica pura do card: estado resolvido, textos, `Stale`, `Syncing`, precedência |

**Modificados (C3):**

| Arquivo | Mudança |
|---|---|
| `src/components/legal/legal-shell.tsx` | `showLocaleSwitcher?`, `relatedDocs?`, `localeSwitcherHref?` (defaults preservam `/privacy`+`/terms`) + `relatedDocs` também abaixo do `<article>` em `< lg` |
| `src/app/cms/(authed)/settings/actions.ts` | `disconnectInstagramAccount`, `authorizeInstagramRebind`, `dismissInstagramHandleMismatch`, guardas de locale em `addInstagramAccount`/`updateInstagramSettings` |
| `src/app/cms/(authed)/settings/page.tsx` | 7 colunas novas na projeção, `connectedIds`, props `instagramOAuthConfigured`/`isPreview`/`handleMismatch`/`siteTimezone`/`missingInstagramEnv` |
| `src/app/cms/(authed)/settings/settings-connected.tsx` | Tipos + passagem das props novas para `<InstagramSection>` |
| `src/app/cms/(authed)/settings/_sections/instagram.tsx` | Reescrita do card (estado derivado de props, matriz de estados/modificadores, botões de OAuth, listener, mismatch, `Disconnect`, `AddInstagramForm`) |
| `src/app/cms/(authed)/_shared/notification-row.tsx` | `'Abrir'` → `'Open'` nas duas ocorrências (`aria-label` e rótulo) |
| `src/app/cms/(authed)/notifications/_components/inbox-client.tsx` | Botão de `action_href` no `NotificationRow` do inbox |
| `src/lib/instagram/status-text.ts` | `RECONNECT_CTA = 'reconnect'` (era `'paste a new token'` em C2) |
| ~~`src/lib/instagram/api-client.ts`~~ | **NÃO é modificado.** C2 Task 5 já exporta `GRAPH_API_BASE` **e** `TOKEN_API_BASE`; C3 só consome (`TOKEN_API_BASE` na troca longa). A Task 3 apenas confere por `grep`. |
| `src/middleware.ts` | `skipSiteResolution` += `/api/instagram/deauthorize` e `/api/instagram/data-deletion` |
| `next.config.ts` | Entrada `{ source: '/data-deletion', headers: [Referrer-Policy: no-referrer] }` depois do bloco `/(.*)` |
| `apps/web/package.json` | `jsdom` em `devDependencies` |
| `CLAUDE.md`, `docs/ops/*`, `docs/superpowers/specs/2026-05-07-*`, `src/content/legal/privacy.{en,pt-BR}.mdx` | Docs de §8 |

**Testes criados:** `test/api/instagram/oauth-start.test.ts`, `test/api/instagram/oauth-callback.test.ts`, `test/api/instagram/deauthorize.test.ts`, `test/api/instagram/data-deletion.test.ts`, `test/app/(public)/data-deletion-page.test.tsx`, `test/cms/instagram-status.test.ts`, `test/cms/instagram-section.test.tsx`, `test/cms/notification-action-href.test.tsx`, `test/cms/settings/page-no-token-leak.test.ts`, `test/middleware/instagram-public-routes.test.ts`, `test/instagram/locale-rules.test.ts`.

**Testes estendidos:** `test/instagram/actions.test.ts` (parte C3), `test/components/legal-shell.test.tsx`, `test/instagram/status-text.test.ts` (`RECONNECT_CTA`).

---

## Interfaces consumidas de A / B / C1 / C2 (contrato — não reimplementar)

Estas assinaturas já estão na árvore quando C3 começa. Task 1 as verifica.

```ts
// ── B — src/lib/oauth/errors.ts ────────────────────────────────────────────
export type OauthErrorCode =
  | 'not_configured' | 'vault_unavailable' | 'account_not_found' | 'exchange_failed'
  | 'origin_not_allowed' | 'invalid_state' | 'session_changed' | 'permission_denied'
  | 'cancelled' | 'identity_invalid' | 'write_failed' | 'cross_origin' | 'browser_changed'

// ── B — src/lib/oauth/state.ts ─────────────────────────────────────────────
export type OauthStateType = 'state' | 'rebind' | 'mismatch'
export interface IOauthStatePayload {
  typ: OauthStateType
  siteId: string
  userId?: string; accountId?: string
  origin?: string; nonce?: string
  allowRebindTo?: string; authorizedIgUserId?: string; authorizedHandle?: string
  exp?: number            // SEGUNDOS desde a época
}
export interface IVerifyStateOptions { typ?: OauthStateType; requireNonce?: boolean; requireExp?: boolean }
export const SOCIAL_STATE_LABEL = 'oauth-state-hmac'
export const INSTAGRAM_STATE_LABEL = 'instagram-oauth-state-hmac'
export const STATE_TTL_SECONDS = 1800
export function deriveHmacKey(masterKeyHex: string, label: string): string
export function signState(payload: IOauthStatePayload, key: string): string
export function verifyState(signed: string, key: string, opts?: IVerifyStateOptions): IOauthStatePayload | null
// MUST (C3): `requireNonce` é BOOLEANO — só exige que o campo exista. A comparação
// do `payload.nonce` com o cookie é do CHAMADOR (callback, §3.1 passo 2a).

// ── B — src/lib/oauth/popup-result.ts ──────────────────────────────────────
export type OauthResultExtra = { status: 'handle_mismatch' } | { code: OauthErrorCode }
export interface IOauthResultHtmlOptions {
  messageType: string; provider: string; success: boolean; error?: string
  extra?: OauthResultExtra
  backHref: string; targetOrigin: string; nonce: string
  status?: number                       // default 200
  headers?: { 'Cache-Control'?: string; 'Referrer-Policy'?: string }
}
export function oauthResultHtml(opts: IOauthResultHtmlOptions): Response

// ── B — src/lib/oauth/consent.ts ───────────────────────────────────────────
export interface IRecordSocialConsentArgs { userId: string; siteId: string; category: string; req: Request }
export async function recordSocialConsent(
  supabase: ReturnType<typeof getSupabaseServiceClient>, args: IRecordSocialConsentArgs,
): Promise<void>                        // try/catch próprio — nunca derruba o chamador

// ── B — src/lib/oauth/origin.ts ────────────────────────────────────────────
export async function getSiteDomains(siteId: string): Promise<string[]>
export function resolveOAuthOrigin(req: Request, allowedHosts: string[]): string | null
export interface IOauthDenyDescriptor { status: 403; code: 'cross_origin' }
export function assertSameOriginFetch(req: Request): IOauthDenyDescriptor | null

// ── C2 — src/lib/instagram/token.ts (server-only) ──────────────────────────
export function readAccessToken(row: { access_token: string | null }): { token: string | null; legacy: boolean }
export function writeAccessToken(plain: string): string           // lança VaultUnavailableError sem chave
export function getVaultKeyOrNull(): Buffer | null
export function classifyInstagramError(err: unknown): 'infra' | 'transient' | 'permanent'
export interface IMarkTokenInvalidOpts { fatal: boolean; forceReason?: boolean; mode?: 'daily' | 'token_refresh' }
export class MarkTokenInvalidError extends Error
export async function markTokenInvalid(
  supabase: SupabaseClient, account: { id: string; site_id: string }, reason: string,
  opts: IMarkTokenInvalidOpts,
): Promise<void>                        // lança MarkTokenInvalidError se a RPC falhar
export async function sweepTokenAlerts(
  supabase: SupabaseClient, filter?: { siteId?: string; identityKey?: string },
): Promise<ITokenAlertResult[]>
// MUST (C3): a chave que `sweepTokenAlerts` compara é a que ESTA função produz a
// partir da LINHA — `o:<ig_user_id da linha>` para `oauth`, `h:<handle>` para
// `legacy`. Uma linha casada por `ig_professional_id` tem `ig_user_id` DIFERENTE
// do `payload.user_id` da Meta, então montar `o:${payload.user_id}` na mão não
// encontraria o grupo. As rotas de deauthorize/data-deletion IMPORTAM daqui.
export function identityKeyOf(
  row: { ig_user_id_source: 'oauth' | 'legacy'; ig_user_id: string | null; handle: string },
): string
export class VaultUnavailableError extends Error       // lançada por writeAccessToken
export const redact: (s: string) => string

// ── C2 — src/lib/instagram/status-text.ts (isomórfico) ─────────────────────
export type TokenKind = 'transient' | 'expired' | 'revoked' | 'invalid'
export function kindFrom(row: { token_error?: string | null }): TokenKind
export function oauthErrorText(code: OauthErrorCode): string
export function previewDisabledText(): string
export const RECONNECT_CTA: string                                 // C3 troca para 'reconnect'

// ── C2 — src/lib/instagram/api-client.ts ───────────────────────────────────
export const GRAPH_API_BASE: string                                // 'https://graph.instagram.com/v25.0'
export const TOKEN_API_BASE: string                                // === GRAPH_API_BASE salvo decisão do gate de §7
export async function fetchInstagramProfile(token: string):
  Promise<{ id: string | null; userId: string | null; username: string | null }>

// ── C2 — src/lib/ops/ntfy.ts ───────────────────────────────────────────────
export async function sendNtfyAlert(a: {
  title: string; body: string; priority: 'min' | 'low' | 'default' | 'high' | 'urgent'
  tags?: string[]; click?: string
}): Promise<{ alerted: boolean; ntfyStatus?: number; reason?: string; alertError?: string }>

// ── A2 — src/lib/instagram/sync-log.ts ─────────────────────────────────────
// `SupabaseClient` é o tipo de `@supabase/supabase-js`, como A o declarou.
// Nenhum apelido de tipo alternativo para o client existe na árvore — não o cite na Task 1.
export async function openSyncRow(
  supabase: SupabaseClient, account: InstagramAccountRow,
  mode: InstagramSyncMode, opts?: { detail?: string },
): Promise<string | null>
export async function closeSyncRow(
  supabase: SupabaseClient, logId: string | null,
  result: SyncResult | null, errorMessage?: string,
): Promise<void>

// ── A/C2 — src/lib/instagram/sync.ts ───────────────────────────────────────
export async function syncInstagramAccount(
  supabase: SupabaseClient, account: InstagramAccountRow,
  accessToken: string, opts?: { deadlineAt?: number },
): Promise<SyncResult>   // SyncResult += partial: boolean, mediaFailed: number

// ── C2 — src/lib/instagram/deletion.ts (efeitos (d)–(h) de §3.1 passo 7) ───
export const DELETION_BLOB_BUDGET_MS: number     // 45_000
export async function runDeletionEffects(
  supabase: SupabaseClient, request: { id: string; ig_user_id: string }, deadlineAt: number,
): Promise<void>   // carrega as contas por (ig_user_id OR ig_professional_id) AND source='oauth',
                   // apaga slots/posts/blobs, anonimiza, troca a trilha, revalida a tag e escreve
                   // `completed_at` por ÚLTIMO — e retorna cedo, deixando `completed_at` NULL,
                   // quando o laço de blobs bate no `deadlineAt`.
export async function resumeStuckDeletionRequest(supabase: SupabaseClient, deadlineAt: number): Promise<boolean>

// ── C2 — src/app/cms/(authed)/settings/actions.ts ──────────────────────────
async function requireEditAccess(): Promise<{ siteId: string; userId: string }>
```

---

### Task 1: Gates bloqueantes de §7 antes de C3 + evidência no runbook

Nenhuma linha de código de produção nasce antes destes gates: a **precedência de identidade** (`ig_user_id = me.id`) é a única coisa que separa "Connected" de um feed congelado em silêncio, e o gate `/media` é quem a prova.

**Files:**
- Modify: `docs/ops/instagram-token-alert-runbook.md` (criado em C2 — C3 acrescenta a seção "Gates de C3")

**Interfaces:**
- Consumes: nada (gates operacionais).
- Produces: a seção `## Gates de C3 (2026-09-06)` do runbook, com as saídas coladas verbatim; a lista de Redirect URIs registrada; a confirmação de que `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` existem em produção.

- [ ] **Step 1: Confirmar que os módulos de B/C2/A estão na árvore com as assinaturas do contrato**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
grep -n "export function\|export async function\|export type\|export interface\|export const" \
  src/lib/oauth/state.ts src/lib/oauth/popup-result.ts src/lib/oauth/consent.ts \
  src/lib/oauth/origin.ts src/lib/oauth/errors.ts \
  src/lib/instagram/token.ts src/lib/instagram/status-text.ts src/lib/instagram/sync-log.ts \
  src/lib/ops/ntfy.ts
grep -n "requireEditAccess" src/app/cms/\(authed\)/settings/actions.ts
```

Esperado: todos os nomes do bloco "Interfaces consumidas" aparecem. `requireEditAccess` devolve `Promise<{ siteId: string; userId: string }>`. Se algum faltar, **pare**: o commit anterior (B ou C2) não está na árvore e C3 não pode começar (§7, ordem de rollback).

- [ ] **Step 2: Gate de identidade (bloqueante) — `/me` e a aresta `/media`**

```bash
# <token> = token de teste longo colhido no gate de C2
curl -s "https://graph.instagram.com/v25.0/me?fields=id,user_id,username&access_token=<token>"
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://graph.instagram.com/v25.0/<me.id>/media?fields=id&limit=1&access_token=<token>"
```

Esperado: a primeira devolve os **três** campos; a segunda responde **200**.
**Ramo de falha (MUST):** `/media` recusando o `me.id` ⇒ **C3 não promove** e a precedência de identidade de §3.1 passo 7 é corrigida antes de qualquer código. `user_id` ausente na resposta ⇒ `ig_professional_id` fica `null`, o casamento de callbacks passa a depender só de `ig_user_id`, e a conexão segue (registrar no runbook).

- [ ] **Step 3: Gate de URIs, envs, consentimento e conta**

```bash
# 0. Conta no app — App Dashboard > Roles > Instagram Testers: a conta profissional do dono
#    aparece como tester ACEITO (convite pendente falha a autorização sem mensagem útil)
# 1. Redirect URIs — copiar do App Dashboard > Instagram > Business login settings, VERBATIM
#    (a doc avisa que o Dashboard "might have added a trailing slash")
# 2. Envs em produção:
vercel env ls production | grep -E 'INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET|SOCIAL_MASTER_KEY'
# 3. Texto de consentimento semeado em M1:
#    select count(*) from consent_texts where category='social_feed_read';   -- esperado: 2
# 4. Qual host serve sem 308:
curl -sI https://bythiagofigueiredo.com/cms/settings/instagram | head -1
curl -sI https://www.bythiagofigueiredo.com/cms/settings/instagram | head -1
```

Esperado: as duas envs `INSTAGRAM_*` presentes em production; `consent_texts` com 2 linhas; o host sem 308 anotado.

- [ ] **Step 4: Registrar tudo no runbook**

Acrescentar ao fim de `docs/ops/instagram-token-alert-runbook.md`:

```markdown
## Gates de C3 (2026-09-06)

### Identidade (bloqueante)
`GET /v25.0/me?fields=id,user_id,username` →
```json
<colar a saída verbatim>
```
`GET /v25.0/<me.id>/media?fields=id&limit=1` → HTTP `<colar>`
Conclusão: `ig_user_id = me.id` (app-scoped) é aceito pela aresta que o feed usa.
`ig_professional_id = me.user_id` → `<presente | ausente ⇒ null>`.

### Redirect URIs registradas no App Dashboard (verbatim)
```
<colar as URIs, incluindo eventual barra final>
```
Host que serve sem 308: `<apex | www>`.

### Envs de produção
`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `SOCIAL_MASTER_KEY` presentes em `production`.

### Consentimento
`select count(*) from consent_texts where category='social_feed_read'` = 2.

### Gate móvel de ponta a ponta
Executado na Task 18 (exige o código promovido): é **bloqueante para manter C3 em produção** —
se falhar, rollback pelo §7. Procedimento e resultado ficam registrados abaixo, na seção
"Pós-deploy C3".
```

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add docs/ops/instagram-token-alert-runbook.md
git commit -m "$(cat <<'EOF'
feat(instagram): OAuth de um clique (rotas + UI)

Primeiro commit do intervalo C3. Registra no runbook os gates bloqueantes
de §7 antes de C3: identidade (/me + aresta /media), Redirect URIs verbatim,
envs de producao e consent_texts social_feed_read.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
git rev-parse HEAD   # anotar: este e o PRIMEIRO sha do intervalo C3 (Task 18 usa)
```

---

### Task 2: Rota de início — `GET /api/instagram/oauth`

**Files:**
- Create: `src/app/api/instagram/oauth/route.ts`
- Test: `test/api/instagram/oauth-start.test.ts`

**Interfaces:**
- Consumes: `getSiteContext()` (`@/lib/cms/site-context`), `requireSiteScope` (`@tn-figueiredo/auth-nextjs/server`), `assertSameOriginFetch`/`resolveOAuthOrigin`/`getSiteDomains` (`@/lib/oauth/origin`), `deriveHmacKey`/`signState`/`verifyState` (`@/lib/oauth/state`), `oauthResultHtml` (`@/lib/oauth/popup-result`), `OauthErrorCode` (`@/lib/oauth/errors`), `oauthErrorText` (`@/lib/instagram/status-text`), `getVaultKeyOrNull` (`@/lib/instagram/token`), `getSupabaseServiceClient` (`@/lib/supabase/service`).
- Produces: `GET(req: NextRequest): Promise<Response>` em `/api/instagram/oauth`; o cookie `__Secure-ig_oauth_nonce` (`ig_oauth_nonce` em loopback) com `Path=/api/instagram/oauth`, `Max-Age=1800`; um `state` assinado `{ typ:'state', siteId, userId, accountId, origin, allowRebindTo?, nonce, exp }` que a Task 3 verifica.

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/api/instagram/oauth-start.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

const MASTER = 'a'.repeat(64)

const cookieSet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-nonce': 'csp-nonce-1' })),
  cookies: vi.fn(async () => ({ set: cookieSet, get: vi.fn(), delete: vi.fn() })),
}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/oauth/origin', () => ({
  getSiteDomains: vi.fn(async () => ['bythiagofigueiredo.com']),
  resolveOAuthOrigin: vi.fn(() => 'https://bythiagofigueiredo.com'),
  assertSameOriginFetch: vi.fn(() => null),
}))
vi.mock('@/lib/instagram/token', () => ({ getVaultKeyOrNull: vi.fn(() => Buffer.alloc(32)) }))

import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveOAuthOrigin, assertSameOriginFetch } from '@/lib/oauth/origin'
import { getVaultKeyOrNull } from '@/lib/instagram/token'
import { deriveHmacKey, signState, verifyState } from '@/lib/oauth/state'
import { GET } from '@/app/api/instagram/oauth/route'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const SITE = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'

function accountFound(found: boolean) {
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: found ? { id: ACCOUNT } : null, error: null })),
          })),
        })),
      })),
    })),
  } as never)
}

function req(qs = `?account_id=${ACCOUNT}`, headers: Record<string, string> = {}) {
  return new NextRequest(`https://bythiagofigueiredo.com/api/instagram/oauth${qs}`, { headers })
}

describe('GET /api/instagram/oauth (start)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INSTAGRAM_APP_ID = 'ig-app-id'
    process.env.INSTAGRAM_APP_SECRET = 'ig-app-secret'
    process.env.SOCIAL_MASTER_KEY = MASTER
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    vi.mocked(getSiteContext).mockResolvedValue({
      siteId: SITE, orgId: 'org', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo',
    } as never)
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER } } as never)
    vi.mocked(resolveOAuthOrigin).mockReturnValue('https://bythiagofigueiredo.com')
    vi.mocked(assertSameOriginFetch).mockReturnValue(null)
    vi.mocked(getVaultKeyOrNull).mockReturnValue(Buffer.alloc(32))
    accountFound(true)
  })

  it('redirects to Instagram without force_reauth on a normal connect', async () => {
    const res = await GET(req())
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.origin + loc.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(loc.searchParams.get('client_id')).toBe('ig-app-id')
    expect(loc.searchParams.get('redirect_uri')).toBe('https://bythiagofigueiredo.com/api/instagram/oauth/callback')
    expect(loc.searchParams.get('response_type')).toBe('code')
    expect(loc.searchParams.get('scope')).toBe('instagram_business_basic')
    expect(loc.searchParams.get('enable_fb_login')).toBe('false')
    expect(loc.searchParams.get('force_reauth')).toBeNull()
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('sets the nonce cookie with __Secure- prefix, 30 min and the OAuth path', async () => {
    await GET(req())
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: '__Secure-ig_oauth_nonce', httpOnly: true, secure: true,
      sameSite: 'lax', maxAge: 1800, path: '/api/instagram/oauth',
    }))
  })

  it('signs a state carrying typ, ids, origin, nonce and a future exp', async () => {
    const res = await GET(req())
    const state = new URL(res.headers.get('location') ?? '').searchParams.get('state') ?? ''
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    const nonce = vi.mocked(cookieSet).mock.calls[0]?.[0].value as string
    // `requireNonce` é BOOLEANO (só exige que o campo exista) — quem compara com o
    // cookie é o callback (Task 3). Passar a string aqui é erro de typecheck.
    const p = verifyState(state, key, { typ: 'state', requireNonce: true, requireExp: true })
    expect(p).not.toBeNull()
    expect(p?.nonce).toBe(nonce)
    expect(p?.siteId).toBe(SITE)
    expect(p?.userId).toBe(USER)
    expect(p?.accountId).toBe(ACCOUNT)
    expect(p?.origin).toBe('https://bythiagofigueiredo.com')
    expect((p?.exp ?? 0) * 1000).toBeGreaterThan(Date.now())
  })

  it('adds force_reauth only for different=1', async () => {
    const res = await GET(req(`?account_id=${ACCOUNT}&different=1`))
    expect(new URL(res.headers.get('location') ?? '').searchParams.get('force_reauth')).toBe('true')
  })

  it('never adds force_reauth on a rebind and carries allowRebindTo into the state', async () => {
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    const rebind = signState({
      typ: 'rebind', siteId: SITE, userId: USER, accountId: ACCOUNT,
      allowRebindTo: '17841400000000000', exp: Math.floor(Date.now() / 1000) + 300,
    }, key)
    const res = await GET(req(`?account_id=${ACCOUNT}&rebind=${encodeURIComponent(rebind)}`))
    const loc = new URL(res.headers.get('location') ?? '')
    expect(loc.searchParams.get('force_reauth')).toBeNull()
    const p = verifyState(loc.searchParams.get('state') ?? '', key, { typ: 'state', requireExp: true })
    expect(p?.allowRebindTo).toBe('17841400000000000')
  })

  it('returns 400 for a rebind signed with the wrong typ', async () => {
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    const bad = signState({
      typ: 'state', siteId: SITE, userId: USER, accountId: ACCOUNT,
      allowRebindTo: '1', exp: Math.floor(Date.now() / 1000) + 300,
    }, key)
    const res = await GET(req(`?account_id=${ACCOUNT}&rebind=${encodeURIComponent(bad)}`))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid or expired authorization')
  })

  it('answers unauthenticated with 401 HTML, postMessage and the sign-in back link', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    const html = await res.text()
    expect(html).toContain('"code":"session_changed"')
    expect(html).toContain('postMessage')
    expect(html).toContain('/cms/login?next=/cms/settings/instagram')
    // Caixa exata do mapa de C2 (`OAUTH_ERROR_TEXT.session_changed`):
    // 'Session changed during authorization — sign in and try again'.
    expect(html).toContain('sign in and try again')
  })

  it('answers insufficient_access with 403 HTML, never JSON', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'insufficient_access' } as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('"code":"session_changed"')
  })

  it('answers a cross-site fetch with 403 HTML cross_origin', async () => {
    vi.mocked(assertSameOriginFetch).mockReturnValue({ status: 403, code: 'cross_origin' })
    const res = await GET(req(`?account_id=${ACCOUNT}`, { 'Sec-Fetch-Site': 'cross-site' }))
    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('This page must be opened from the CMS')
  })

  it('answers 503 not_configured without the Instagram app credentials', async () => {
    delete process.env.INSTAGRAM_APP_ID
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('"code":"not_configured"')
  })

  it('answers 503 vault_unavailable without a usable vault key', async () => {
    vi.mocked(getVaultKeyOrNull).mockReturnValue(null)
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('"code":"vault_unavailable"')
  })

  it('answers 404 account_not_found for an account of another site', async () => {
    accountFound(false)
    const res = await GET(req())
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('"code":"account_not_found"')
  })

  it('answers 400 origin_not_allowed when getSiteContext throws', async () => {
    vi.mocked(getSiteContext).mockRejectedValue(new Error('Site context not set'))
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"origin_not_allowed"')
  })

  it('answers 400 origin_not_allowed when the origin does not resolve', async () => {
    vi.mocked(resolveOAuthOrigin).mockReturnValue(null)
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"origin_not_allowed"')
  })

  it('uses the unprefixed cookie name on loopback', async () => {
    vi.mocked(resolveOAuthOrigin).mockReturnValue('http://localhost:3997')
    await GET(new NextRequest('http://localhost:3997/api/instagram/oauth?account_id=' + ACCOUNT))
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'ig_oauth_nonce', secure: false }))
  })

  it('keeps the HMAC label separate from the social one', () => {
    expect(deriveHmacKey(MASTER, 'instagram-oauth-state-hmac'))
      .not.toBe(createHmac('sha256', MASTER).update('oauth-state-hmac').digest('hex'))
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd apps/web && npx vitest run test/api/instagram/oauth-start.test.ts`
Expected: FAIL — `Failed to load url .../src/app/api/instagram/oauth/route.ts` (arquivo não existe).

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/instagram/oauth/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  INSTAGRAM_STATE_LABEL, STATE_TTL_SECONDS, deriveHmacKey, signState, verifyState,
} from '@/lib/oauth/state'
import { oauthResultHtml } from '@/lib/oauth/popup-result'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import { assertSameOriginFetch, getSiteDomains, resolveOAuthOrigin } from '@/lib/oauth/origin'
import { getVaultKeyOrNull } from '@/lib/instagram/token'
import { oauthErrorText } from '@/lib/instagram/status-text'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SETTINGS_HREF = '/cms/settings/instagram'
const LOGIN_HREF = '/cms/login?next=/cms/settings/instagram'
const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const

/**
 * MUST (§3.1): toda falha do início responde `oauthResultHtml` — nunca JSON e
 * nunca 302 para o login. A rota é aberta por `window.open`; um 302 renderiza o
 * login DENTRO da janela do OAuth, o opener nunca recebe `postMessage` e o card
 * fica em `In progress` até o teto de 10 min.
 */
async function fail(
  code: OauthErrorCode,
  status: number,
  targetOrigin: string,
  backHref: string = SETTINGS_HREF,
): Promise<Response> {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return oauthResultHtml({
    messageType: 'instagram-oauth-result',
    provider: 'instagram',
    success: false,
    error: oauthErrorText(code),
    extra: { code },
    backHref,
    targetOrigin,
    nonce,
    status,
    headers: NO_STORE,
  })
}

export async function GET(req: NextRequest): Promise<Response> {
  let targetOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // 1 — site + sessão + Fetch Metadata
  let siteId: string
  try {
    ({ siteId } = await getSiteContext())
  } catch {
    return fail('origin_not_allowed', 400, targetOrigin)
  }

  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return auth.reason === 'unauthenticated'
      ? fail('session_changed', 401, targetOrigin, LOGIN_HREF)
      : fail('session_changed', 403, targetOrigin)
  }

  const deny = assertSameOriginFetch(req)
  if (deny) return fail(deny.code, deny.status, targetOrigin)

  // 2 — configuração
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) return fail('not_configured', 503, targetOrigin)
  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey || getVaultKeyOrNull() === null) {
    return fail('vault_unavailable', 503, targetOrigin)
  }

  // 3 — a conta pertence a este site
  const accountId = req.nextUrl.searchParams.get('account_id') ?? ''
  if (!UUID_RE.test(accountId)) return fail('account_not_found', 404, targetOrigin)
  const supabase = getSupabaseServiceClient()
  const { data: account } = await supabase
    .from('instagram_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('site_id', siteId)
    .maybeSingle()
  if (!account) return fail('account_not_found', 404, targetOrigin)

  // 4 — origem
  const origin = resolveOAuthOrigin(req, await getSiteDomains(siteId))
  if (!origin) return fail('origin_not_allowed', 400, targetOrigin)
  targetOrigin = origin
  const redirectUri = `${origin}/api/instagram/oauth/callback`
  const igKey = deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL)

  // 5 — rebind (opcional): `allowRebindTo` só vem de um cookie já verificado
  let allowRebindTo: string | undefined
  const rebind = req.nextUrl.searchParams.get('rebind')
  if (rebind) {
    const p = verifyState(rebind, igKey, { typ: 'rebind', requireExp: true })
    if (
      !p || p.siteId !== siteId || p.userId !== auth.user.id ||
      p.accountId !== accountId || !p.allowRebindTo
    ) {
      return fail('invalid_state', 400, targetOrigin)
    }
    allowRebindTo = p.allowRebindTo
  }

  // 6 — state + cookie de nonce
  const isHttps = origin.startsWith('https:')
  const cookieName = isHttps ? '__Secure-ig_oauth_nonce' : 'ig_oauth_nonce'
  const nonceValue = randomBytes(16).toString('hex')
  const jar = await cookies()
  jar.set({
    name: cookieName,
    value: nonceValue,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS,
    path: '/api/instagram/oauth',
  })

  const state = signState({
    typ: 'state',
    siteId,
    userId: auth.user.id,
    accountId,
    origin,
    ...(allowRebindTo ? { allowRebindTo } : {}),
    nonce: nonceValue,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  }, igKey)

  // 7 — 302 para a Meta. `force_reauth` SÓ em "Connect a different account":
  // no rebind o dono já autorizou @X e exigir senha+2FA reabriria a seleção de
  // conta, produzindo um terceiro mismatch (§3.1 passo 7).
  const authorize = new URL(AUTHORIZE_URL)
  authorize.searchParams.set('client_id', appId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('scope', 'instagram_business_basic')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('enable_fb_login', 'false')
  if (req.nextUrl.searchParams.get('different') === '1') {
    authorize.searchParams.set('force_reauth', 'true')
  }

  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), ...NO_STORE },
  })
}
```

- [ ] **Step 4: Rodar o teste e conferir que passa**

Run: `cd apps/web && npx vitest run test/api/instagram/oauth-start.test.ts`
Expected: PASS (14 testes).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/api/instagram/oauth/route.ts apps/web/test/api/instagram/oauth-start.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): rota de inicio do OAuth (GET /api/instagram/oauth)

Sessao + assertSameOriginFetch + config + conta escopada por site + origem
allow-listed; cookie de nonce __Secure- com Path=/api/instagram/oauth e 30 min;
state assinado com typ/exp; force_reauth apenas em different=1. Toda falha
responde oauthResultHtml (text/html), nunca JSON e nunca 302 para o login.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 3: Rota de retorno — `GET /api/instagram/oauth/callback` (state → sessão → troca → identidade → escrita)

Esta task entrega os passos **1–10 e 12** de §3.1. O passo 11 (sync pós-OAuth em `after()`) e a trilha `mode='rebind'` são a Task 4.

**Files:**
- Create: `src/app/api/instagram/oauth/callback/route.ts`
- Test: `test/api/instagram/oauth-callback.test.ts`

**Interfaces:**
- Consumes: `verifyState`/`signState`/`deriveHmacKey`, `oauthResultHtml`, `getSiteDomains`/`resolveOAuthOrigin`, `requireSiteScope`, `recordSocialConsent`, `writeAccessToken`/`getVaultKeyOrNull`/`redact` (`@/lib/instagram/token`), `fetchInstagramProfile`/`GRAPH_API_BASE` (`@/lib/instagram/api-client`), `oauthErrorText`.
- Produces: `GET(req: NextRequest): Promise<Response>`; `export const maxDuration = 120`; o cookie de mismatch `__Secure-ig_handle_mismatch` (`ig_handle_mismatch` em loopback) com `Path=/cms/settings`, `Max-Age=600` e payload `{ typ:'mismatch', siteId, userId, accountId, authorizedHandle, authorizedIgUserId, exp }` — consumido pela Task 9 (`authorizeInstagramRebind`) e pela Task 10 (`page.tsx`); as linhas gravadas com `ig_user_id_source='oauth'` que as Tasks 5/6 usam como alcance dos callbacks da Meta.

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/api/instagram/oauth-callback.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MASTER = 'b'.repeat(64)
const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const SITE = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'
const ORIGIN = 'https://bythiagofigueiredo.com'

const cookieGet = vi.fn()
const cookieSet = vi.fn()
const cookieDelete = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-nonce': 'csp-nonce-1' })),
  cookies: vi.fn(async () => ({ get: cookieGet, set: cookieSet, delete: cookieDelete })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/oauth/origin', () => ({
  getSiteDomains: vi.fn(async () => ['bythiagofigueiredo.com']),
  resolveOAuthOrigin: vi.fn(() => 'https://bythiagofigueiredo.com'),
  assertSameOriginFetch: vi.fn(() => null),
}))
vi.mock('@/lib/oauth/consent', () => ({ recordSocialConsent: vi.fn(async () => undefined) }))
vi.mock('@/lib/instagram/token', () => ({
  getVaultKeyOrNull: vi.fn(() => Buffer.alloc(32)),
  writeAccessToken: vi.fn((plain: string) => `v1:${plain}`),
  redact: vi.fn((s: string) => s),
}))
vi.mock('@/lib/instagram/api-client', () => ({
  GRAPH_API_BASE: 'https://graph.instagram.com/v25.0',
  TOKEN_API_BASE: 'https://graph.instagram.com/v25.0',
  fetchInstagramProfile: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveOAuthOrigin } from '@/lib/oauth/origin'
import { recordSocialConsent } from '@/lib/oauth/consent'
import { writeAccessToken } from '@/lib/instagram/token'
import { fetchInstagramProfile } from '@/lib/instagram/api-client'
import { deriveHmacKey, signState, verifyState } from '@/lib/oauth/state'
import { GET, maxDuration } from '@/app/api/instagram/oauth/callback/route'

const key = () => deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')

function validState(over: Record<string, unknown> = {}) {
  return signState({
    typ: 'state', siteId: SITE, userId: USER, accountId: ACCOUNT, origin: ORIGIN,
    nonce: 'nonce-abc', exp: Math.floor(Date.now() / 1000) + 1800, ...over,
  }, key())
}

interface TargetRow {
  id: string; site_id: string; handle: string
  ig_user_id: string | null; ig_user_id_source: 'oauth' | 'legacy'
}

const updateSpy = vi.fn()
const orSpy = vi.fn()
const insertSpy = vi.fn()

function mockDb(opts: {
  target: TargetRow | null
  updated?: Record<string, unknown>[]
  updateError?: { message: string } | null
}) {
  updateSpy.mockReset(); orSpy.mockReset(); insertSpy.mockReset()
  insertSpy.mockResolvedValue({ error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'instagram_sync_log') return { insert: insertSpy }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: opts.target, error: opts.target ? null : { message: 'no rows' } })),
            })),
          })),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updateSpy(patch)
          return {
            eq: vi.fn(() => ({
              or: vi.fn((filter: string) => {
                orSpy(filter)
                return {
                  select: vi.fn(async () => ({
                    data: opts.updated ?? [{ id: ACCOUNT, site_id: SITE }],
                    error: opts.updateError ?? null,
                  })),
                }
              }),
            })),
          }
        }),
      }
    }),
  } as never)
}

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function exchangeOk(permissions = 'instagram_business_basic') {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ access_token: 'short', user_id: 17841400000000000, permissions }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'long-lived-token', expires_in: 5_184_000 }) })
}

function req(qs: string) {
  return new NextRequest(`${ORIGIN}/api/instagram/oauth/callback${qs}`)
}

describe('GET /api/instagram/oauth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INSTAGRAM_APP_ID = 'ig-app-id'
    process.env.INSTAGRAM_APP_SECRET = 'ig-app-secret'
    process.env.SOCIAL_MASTER_KEY = MASTER
    process.env.NEXT_PUBLIC_APP_URL = ORIGIN
    cookieGet.mockImplementation((name: string) =>
      name === '__Secure-ig_oauth_nonce' ? { name, value: 'nonce-abc' } : undefined)
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: USER } } as never)
    vi.mocked(resolveOAuthOrigin).mockReturnValue(ORIGIN)
    vi.mocked(fetchInstagramProfile).mockResolvedValue({
      id: '17841400000000000', userId: '9988776655', username: 'thiago.figueiredo',
    })
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' } })
    exchangeOk()
  })

  it('declares maxDuration = 120 (plano Pro)', () => {
    expect(maxDuration).toBe(120)
  })

  it('connects, writes v1: token + identity, zeroes the episode and answers success', async () => {
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('"success":true')
    expect(html).toContain('Connected!')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    const patch = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.access_token).toBe('v1:long-lived-token')
    expect(patch.ig_user_id).toBe('17841400000000000')
    expect(patch.ig_professional_id).toBe('9988776655')
    expect(patch.ig_user_id_source).toBe('oauth')
    expect(patch.handle).toBe('thiago.figueiredo')
    expect(patch.token_error).toBeNull()
    expect(patch.token_error_at).toBeNull()
    expect(patch.token_error_mode).toBeNull()
    expect(patch.token_alert_sent_at).toBeNull()
    expect(patch.token_alert_attempt_at).toBeNull()
    expect(patch.token_reprobe_at).toBeNull()
    expect(typeof patch.token_refreshed_at).toBe('string')
    expect(writeAccessToken).toHaveBeenCalledWith('long-lived-token')
    expect(recordSocialConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: USER, siteId: SITE, category: 'social_feed_read' }),
    )
  })

  it('deletes the nonce cookie with the same Path on every response', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(cookieDelete).toHaveBeenCalledWith({ name: '__Secure-ig_oauth_nonce', path: '/api/instagram/oauth' })
  })

  it('reconnects every profile row of the site in one click (pt + en)', async () => {
    mockDb({
      target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' },
      updated: [{ id: ACCOUNT, site_id: SITE }, { id: 'other-row', site_id: SITE }],
    })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('answers write_failed when the update matches 0 rows', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' }, updated: [] })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"write_failed"')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram oauth write matched 0 rows', 'warning')
  })

  it('answers write_failed when the update errors', async () => {
    mockDb({
      target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' },
      updateError: { message: 'boom' },
    })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"write_failed"')
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('answers write_failed when writeAccessToken throws', async () => {
    vi.mocked(writeAccessToken).mockImplementation(() => { throw new Error('VaultUnavailableError') })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"write_failed"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers 400 browser_changed when the nonce cookie is absent, before verifyState', async () => {
    cookieGet.mockReturnValue(undefined)
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('"code":"browser_changed"')
    expect(html).toContain('Authorization finished in a different browser')
  })

  it('answers 400 invalid_state when the nonce is present but diverges', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === '__Secure-ig_oauth_nonce' ? { name, value: 'other-nonce' } : undefined)
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"invalid_state"')
  })

  it('answers 400 invalid_state for a well-signed but expired state, writing nothing', async () => {
    const now = Date.parse('2026-09-06T12:00:00Z')
    vi.useFakeTimers({ now, toFake: ['Date'] })
    const stale = validState({ exp: Math.floor(now / 1000) - 1 })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(stale)}`))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('Invalid or expired authorization')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(recordSocialConsent).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('answers 400 when the request origin does not match state.origin (site A on host B)', async () => {
    vi.mocked(resolveOAuthOrigin).mockReturnValue('https://other-site.com')
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('"code":"invalid_state"')
  })

  it('answers cancelled with targetOrigin = state.origin and writes nothing', async () => {
    const res = await GET(req(`?error=access_denied&error_reason=user_denied&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('"code":"cancelled"')
    expect(html).toContain(ORIGIN)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers 401 session_changed when the session is gone or belongs to another user', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: false, reason: 'unauthenticated' } as never)
    const a = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(a.status).toBe(401)
    expect(await a.text()).toContain('"code":"session_changed"')

    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true, user: { id: 'someone-else' } } as never)
    const b = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(b.status).toBe(401)
    expect(await b.text()).toContain('"code":"session_changed"')
  })

  it('is NOT subject to assertSameOriginFetch (cross-site is not 403 here)', async () => {
    const res = await GET(new NextRequest(
      `${ORIGIN}/api/instagram/oauth/callback?code=abc&state=${encodeURIComponent(validState())}`,
      { headers: { 'Sec-Fetch-Site': 'cross-site' } },
    ))
    expect(res.status).toBe(200)
  })

  it('shows only the numeric code from a flat Meta error, never its error_message', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_type: 'OAuthException', code: 400, error_message: 'redirect_uri does not match' }),
    })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const html = await res.text()
    expect(html).toContain('Instagram rejected the authorization (code 400)')
    expect(html).not.toContain('redirect_uri does not match')
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('falls back to the bare sentence when the Meta error body has no code', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error_message: 'nope' }) })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('Instagram rejected the authorization')
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .not.toContain('(code')
  })

  it('answers permission_denied when instagram_business_basic is missing from permissions', async () => {
    mockFetch.mockReset()
    exchangeOk('instagram_business_manage_messages')
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"code":"permission_denied"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers exchange_failed when the long-lived exchange or /me throws', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ access_token: 'short', user_id: 1, permissions: 'instagram_business_basic' }] }) })
      .mockRejectedValueOnce(new Error('timeout'))
    const a = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await a.text()).toContain('"code":"exchange_failed"')

    mockFetch.mockReset(); exchangeOk()
    vi.mocked(fetchInstagramProfile).mockRejectedValue(new Error('boom'))
    const b = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await b.text()).toContain('"code":"exchange_failed"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('uses me.id for ig_user_id and warns once when the exchange user_id differs', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841499999999999', userId: '9988776655', username: 'thiago.figueiredo' })
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '17841499999999999', ig_user_id_source: 'oauth' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_user_id).toBe('17841499999999999')
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram id spaces differ', 'warning')
  })

  it('falls back to the exchange user_id when /me has no id, without warning', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: null, userId: '9988776655', username: 'thiago.figueiredo' })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_user_id).toBe('17841400000000000')
    expect(Sentry.captureMessage).not.toHaveBeenCalledWith('instagram id spaces differ', 'warning')
  })

  it('stores ig_professional_id = null when /me returns no user_id', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841400000000000', userId: null, username: 'thiago.figueiredo' })
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_professional_id).toBeNull()
  })

  it('stores ig_professional_id = null (never fails) when it is malformed', async () => {
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841400000000000', userId: 'not-a-number', username: 'thiago.figueiredo' })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
    expect((updateSpy.mock.calls[0]?.[0] as Record<string, unknown>).ig_professional_id).toBeNull()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram professional id malformed', 'warning')
  })

  it('answers identity_invalid when both ids are absent, when the id is malformed and when the username is malformed', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ access_token: 'short', permissions: 'instagram_business_basic' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'long-lived-token', expires_in: 5_184_000 }) })
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: null, userId: null, username: 'thiago.figueiredo' })
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .toContain('"code":"identity_invalid"')

    mockFetch.mockReset(); exchangeOk()
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '178414000000000000000000000000000', userId: null, username: 'thiago.figueiredo' })
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .toContain('"code":"identity_invalid"')

    mockFetch.mockReset(); exchangeOk()
    vi.mocked(fetchInstagramProfile).mockResolvedValue({ id: '17841400000000000', userId: null, username: 'Not A Handle!' })
    expect(await (await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))).text())
      .toContain('"code":"identity_invalid"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('offers a mismatch banner (no write) when an oauth row has a different id and there is no rebind', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'other.handle', ig_user_id: '17840000000000001', ig_user_id_source: 'oauth' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('"status":"handle_mismatch"')
    expect(updateSpy).not.toHaveBeenCalled()
    expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: '__Secure-ig_handle_mismatch', httpOnly: true, sameSite: 'lax',
      maxAge: 600, path: '/cms/settings',
    }))
    const cookieValue = vi.mocked(cookieSet).mock.calls[0]?.[0].value as string
    const p = verifyState(cookieValue, key(), { typ: 'mismatch', requireExp: true })
    expect(p?.authorizedIgUserId).toBe('17841400000000000')
    expect(p?.authorizedHandle).toBe('thiago.figueiredo')
    expect(p?.accountId).toBe(ACCOUNT)
  })

  it('writes when allowRebindTo matches the authorized id', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'other.handle', ig_user_id: '17840000000000001', ig_user_id_source: 'oauth' } })
    const st = validState({ allowRebindTo: '17841400000000000' })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(st)}`))
    expect(await res.text()).toContain('"success":true')
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('reconnects a legacy row whose handle matches even with an ig_user_id from another app', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'thiago.figueiredo', ig_user_id: '999', ig_user_id_source: 'legacy' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"success":true')
  })

  it('offers a mismatch (no write) for a legacy row with a different handle', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'someone.else', ig_user_id: '17841400000000000', ig_user_id_source: 'legacy' } })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(await res.text()).toContain('"status":"handle_mismatch"')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('never rewrites oauth rows by handle nor legacy rows by id (or-filter shape)', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const filter = orSpy.mock.calls[0]?.[0] as string
    expect(filter).toContain(`id.eq.${ACCOUNT}`)
    expect(filter).toContain('and(ig_user_id.eq.17841400000000000,ig_user_id_source.eq.oauth)')
    expect(filter).toContain('and(handle.eq.thiago.figueiredo,ig_user_id_source.eq.legacy)')
  })

  it('answers 404 account_not_found when the target row is gone', async () => {
    mockDb({ target: null })
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('"code":"account_not_found"')
  })

  it('gates on configuration before anything else', async () => {
    delete process.env.INSTAGRAM_APP_SECRET
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('"code":"not_configured"')
  })

  it('carries the CSP nonce, message type, provider, targetOrigin and backHref in the HTML', async () => {
    const res = await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const html = await res.text()
    expect(html).toContain('csp-nonce-1')
    expect(html).toContain('"type":"instagram-oauth-result"')
    expect(html).toContain('"provider":"instagram"')
    expect(html).toContain(ORIGIN)
    expect(html).toContain('/cms/settings/instagram')
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd apps/web && npx vitest run test/api/instagram/oauth-callback.test.ts`
Expected: FAIL — `Failed to load url .../src/app/api/instagram/oauth/callback/route.ts`.

- [ ] **Step 3: Conferir as constantes de base da API (não editar `api-client.ts`)**

```bash
cd apps/web && grep -n "export const GRAPH_API_BASE\|export const TOKEN_API_BASE" src/lib/instagram/api-client.ts
```
Esperado: as duas exportadas por C2 (`TOKEN_API_BASE === GRAPH_API_BASE` salvo decisão do gate de §7 sobre a forma sem prefixo). A rota usa **`TOKEN_API_BASE`** na troca longa.

- [ ] **Step 4: Implementar a rota (passos 1–10 e 12)**

Criar `src/app/api/instagram/oauth/callback/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { cookies, headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  INSTAGRAM_STATE_LABEL, deriveHmacKey, signState, verifyState,
} from '@/lib/oauth/state'
import type { IOauthStatePayload } from '@/lib/oauth/state'
import { oauthResultHtml } from '@/lib/oauth/popup-result'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import { getSiteDomains, resolveOAuthOrigin } from '@/lib/oauth/origin'
import { recordSocialConsent } from '@/lib/oauth/consent'
import { getVaultKeyOrNull, redact, writeAccessToken } from '@/lib/instagram/token'
import { TOKEN_API_BASE, fetchInstagramProfile } from '@/lib/instagram/api-client'
import { oauthErrorText } from '@/lib/instagram/status-text'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Plano Pro (§7). O sync pós-OAuth roda em `after()` dentro desta janela. */
export const maxDuration = 120

const SETTINGS_HREF = '/cms/settings/instagram'
const LOGIN_HREF = '/cms/login?next=/cms/settings/instagram'
const TOKEN_EXCHANGE_URL = 'https://api.instagram.com/oauth/access_token'
const EXCHANGE_TIMEOUT_MS = 10_000
const MISMATCH_TTL_SECONDS = 600
const NONCE_COOKIES = ['__Secure-ig_oauth_nonce', 'ig_oauth_nonce'] as const
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const
const HANDLE_RE = /^[a-z0-9._]{1,30}$/
const IG_ID_RE = /^[0-9]{1,32}$/
const PERMISSION_ENUM = new Set([
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
])

interface FlatExchange {
  access_token?: string
  user_id?: string | number
  permissions?: string
  code?: number
  error_type?: string
  error_message?: string
}

function normalizeHandle(raw: string | null): string {
  return String(raw ?? '').trim().replace(/^@/, '').toLowerCase()
}

export async function GET(req: NextRequest): Promise<Response> {
  const nonce = (await headers()).get('x-nonce') ?? ''
  const jar = await cookies()
  const fallbackOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  /**
   * Toda resposta apaga o cookie de nonce com o MESMO `Path` do `Set-Cookie` do
   * início — `cookies().delete(name)` assume `path:'/'` e não limparia nada.
   */
  const finish = (opts: {
    success: boolean
    code?: OauthErrorCode
    mismatch?: boolean
    error?: string
    status?: number
    targetOrigin?: string
    /** Ambos allow-listados por `popup-result.ts` (B). Default: o card. */
    backHref?: string
  }): Response => {
    for (const name of NONCE_COOKIES) jar.delete({ name, path: '/api/instagram/oauth' })
    const extra = opts.mismatch
      ? ({ status: 'handle_mismatch' } as const)
      : opts.code
        ? ({ code: opts.code } as const)
        : undefined
    return oauthResultHtml({
      messageType: 'instagram-oauth-result',
      provider: 'instagram',
      success: opts.success,
      error: opts.success ? undefined : (opts.error ?? (opts.code ? oauthErrorText(opts.code) : 'unknown')),
      extra,
      backHref: opts.backHref ?? SETTINGS_HREF,
      targetOrigin: opts.targetOrigin ?? fallbackOrigin,
      nonce,
      status: opts.status ?? 200,
      headers: NO_STORE,
    })
  }

  // 1 — configuração
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) return finish({ success: false, code: 'not_configured', status: 503 })
  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey || getVaultKeyOrNull() === null) {
    return finish({ success: false, code: 'vault_unavailable', status: 503 })
  }
  const igKey = deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL)

  // 2a — nonce ausente é decidível AQUI e quase sempre é o retorno caindo num
  // navegador in-app: `browser_changed` diz o que fazer; `invalid_state` mandaria
  // o dono repetir exatamente o que acabou de falhar.
  const cookieNonce =
    jar.get('__Secure-ig_oauth_nonce')?.value ?? jar.get('ig_oauth_nonce')?.value ?? ''
  if (!cookieNonce) return finish({ success: false, code: 'browser_changed', status: 400 })

  const rawState = req.nextUrl.searchParams.get('state') ?? ''
  // `requireNonce` de B é BOOLEANO (só exige o campo). A comparação com o cookie
  // é desta rota — é ela que torna o `state` inutilizável noutro navegador.
  const state: IOauthStatePayload | null = verifyState(rawState, igKey, {
    typ: 'state', requireNonce: true, requireExp: true,
  })
  if (
    !state || !state.siteId || !state.userId || !state.accountId || !state.origin ||
    state.nonce !== cookieNonce
  ) {
    return finish({ success: false, code: 'invalid_state', status: 400 })
  }

  // 2b — a origem do retorno tem de ser a mesma que assinou o `state`.
  const allowed = await getSiteDomains(state.siteId)
  if (resolveOAuthOrigin(req, allowed) !== state.origin) {
    return finish({ success: false, code: 'invalid_state', status: 400 })
  }
  const targetOrigin = state.origin

  // 3 — a Meta recusou/o dono cancelou
  if (req.nextUrl.searchParams.get('error') || req.nextUrl.searchParams.get('error_reason')) {
    return finish({ success: false, code: 'cancelled', targetOrigin })
  }

  // 4 — sessão re-verificada no retorno
  const auth = await requireSiteScope({ area: 'cms', siteId: state.siteId, mode: 'edit' })
  if (!auth.ok || auth.user.id !== state.userId) {
    return finish({ success: false, code: 'session_changed', status: 401, targetOrigin, backHref: LOGIN_HREF })
  }

  const code = req.nextUrl.searchParams.get('code') ?? ''
  const supabase = getSupabaseServiceClient()

  // 5–7 — troca de código, troca longa e identidade. Qualquer throw/timeout aqui
  // é `exchange_failed`: nada gravado, nenhuma marcação de token.
  let plainToken: string
  let expiresIn: number
  let igId: string
  let igProfessionalId: string | null
  let handle: string
  let grantedPermissions: string
  try {
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: `${state.origin}/api/instagram/oauth/callback`,
      code,
    })
    const exRes = await fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    })
    const exJson = (await exRes.json()) as { data?: FlatExchange[] } & FlatExchange
    const d: FlatExchange = Array.isArray(exJson.data) ? (exJson.data[0] ?? {}) : exJson

    if (!d.access_token) {
      // MUST: só o `code` numérico chega ao dono; o `error_message` da Meta vai
      // redigido ao Sentry e NUNCA para o popup (§2 proíbe string de máquina).
      Sentry.captureMessage(
        `instagram code exchange rejected: ${redact(JSON.stringify({ code: d.code, error_type: d.error_type, error_message: d.error_message }))}`,
        'warning',
      )
      const text = typeof d.code === 'number'
        ? `Instagram rejected the authorization (code ${d.code})`
        : 'Instagram rejected the authorization'
      return finish({ success: false, code: 'exchange_failed', error: text, targetOrigin })
    }

    const perms = (d.permissions ?? '').split(',').map((p) => p.trim()).filter(Boolean)
    if (perms.length > 0 && !perms.includes('instagram_business_basic')) {
      return finish({ success: false, code: 'permission_denied', targetOrigin })
    }
    grantedPermissions = perms.filter((p) => PERMISSION_ENUM.has(p)).join(',')

    // `TOKEN_API_BASE` (C2) é `GRAPH_API_BASE` salvo se o gate de §7 provar a
    // forma sem prefixo — a escolha é de C2, não desta rota.
    const longUrl = new URL(`${TOKEN_API_BASE}/access_token`)
    longUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('access_token', d.access_token)
    const longRes = await fetch(longUrl.toString(), { signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS) })
    const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number }
    if (!longJson.access_token) {
      return finish({ success: false, code: 'exchange_failed', targetOrigin })
    }
    plainToken = longJson.access_token
    expiresIn = typeof longJson.expires_in === 'number' ? longJson.expires_in : 60 * 24 * 60 * 60

    // MUST — dois ids de espaços diferentes, nunca misturados:
    //   ig_user_id          = me.id ?? String(exchange.user_id)   (app-scoped)
    //   ig_professional_id  = me.user_id ?? null                  (só casa callbacks)
    const me = await fetchInstagramProfile(plainToken)
    const exchangeUserId = d.user_id != null ? String(d.user_id) : null
    if (me.id && exchangeUserId && exchangeUserId !== me.id) {
      Sentry.captureMessage('instagram id spaces differ', 'warning')
    }
    const chosenId = me.id ?? exchangeUserId
    handle = normalizeHandle(me.username)
    if (!chosenId || !IG_ID_RE.test(chosenId) || !HANDLE_RE.test(handle)) {
      return finish({ success: false, code: 'identity_invalid', targetOrigin })
    }
    igId = chosenId
    igProfessionalId = me.userId
    if (igProfessionalId !== null && !IG_ID_RE.test(igProfessionalId)) {
      Sentry.captureMessage('instagram professional id malformed', 'warning')
      igProfessionalId = null
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-oauth-exchange' } })
    return finish({ success: false, code: 'exchange_failed', targetOrigin })
  }

  // 8 — identidade da linha-alvo (leitura SEMPRE escopada por site)
  const { data: target } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('id', state.accountId)
    .eq('site_id', state.siteId)
    .single()
  if (!target) return finish({ success: false, code: 'account_not_found', status: 404, targetOrigin })

  const isOauthRow = target.ig_user_id_source === 'oauth'
  const identityMatches = isOauthRow
    ? target.ig_user_id === igId
    : normalizeHandle(target.handle) === handle
  const rebindAllowed = state.allowRebindTo === igId

  // 9 — mismatch: nada gravado; cookie assinado alimenta o banner de 1 clique
  if (!identityMatches && !rebindAllowed) {
    const isHttps = state.origin.startsWith('https:')
    jar.set({
      name: isHttps ? '__Secure-ig_handle_mismatch' : 'ig_handle_mismatch',
      value: signState({
        typ: 'mismatch',
        siteId: state.siteId,
        userId: state.userId,
        accountId: state.accountId,
        authorizedHandle: handle,
        authorizedIgUserId: igId,
        exp: Math.floor(Date.now() / 1000) + MISMATCH_TTL_SECONDS,
      }, igKey),
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: MISMATCH_TTL_SECONDS,
      path: '/cms/settings',
    })
    return finish({
      success: false,
      mismatch: true,
      error: 'You authorized a different Instagram account',
      targetOrigin,
    })
  }

  // 10 — escrita única: a linha-alvo + toda linha do MESMO perfil no site
  let updatedRows: Record<string, unknown>[]
  try {
    const cipher = writeAccessToken(plainToken)
    const nowIso = new Date().toISOString()
    const orFilter =
      `id.eq.${state.accountId},` +
      `and(ig_user_id.eq.${igId},ig_user_id_source.eq.oauth),` +
      `and(handle.eq.${handle},ig_user_id_source.eq.legacy)`

    const { data, error } = await supabase
      .from('instagram_accounts')
      .update({
        access_token: cipher,
        ig_user_id: igId,
        ig_professional_id: igProfessionalId,
        ig_user_id_source: 'oauth',
        handle,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        token_refreshed_at: nowIso,
        token_error: null,
        token_error_at: null,
        token_error_mode: null,
        token_alert_sent_at: null,
        token_alert_attempt_at: null,
        token_reprobe_at: null,
        updated_at: nowIso,
      })
      .eq('site_id', state.siteId)
      .or(orFilter)
      .select('*')

    if (error) {
      Sentry.captureException(error, { tags: { component: 'instagram-oauth-write' } })
      return finish({ success: false, code: 'write_failed', targetOrigin })
    }
    updatedRows = (data ?? []) as Record<string, unknown>[]
    if (updatedRows.length === 0) {
      Sentry.captureMessage('instagram oauth write matched 0 rows', 'warning')
      return finish({ success: false, code: 'write_failed', targetOrigin })
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-oauth-write' } })
    return finish({ success: false, code: 'write_failed', targetOrigin })
  }

  await recordSocialConsent(supabase, {
    userId: state.userId,
    siteId: state.siteId,
    category: 'social_feed_read',
    req,
  })

  // 11 — sync pós-OAuth: Task 4.

  // 12 — sucesso
  void grantedPermissions
  return finish({ success: true, targetOrigin })
}
```

- [ ] **Step 5: Rodar o teste e conferir que passa**

Run: `cd apps/web && npx vitest run test/api/instagram/oauth-callback.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
# `api-client.ts` NÃO entra: C2 já exporta GRAPH_API_BASE/TOKEN_API_BASE e o Step 3
# só confere por grep. Adicioná-lo arrastaria trabalho de outro terminal.
git add apps/web/src/app/api/instagram/oauth/callback/route.ts \
        apps/web/test/api/instagram/oauth-callback.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): callback do OAuth — state, sessao, troca e escrita

Nonce ausente => browser_changed antes de verifyState; state com typ/exp/nonce
e origem casada; sessao re-verificada; troca de codigo + troca longa com
timeout de 10s; identidade ig_user_id = me.id ?? user_id da troca e
ig_professional_id = me.user_id ?? null; mismatch grava cookie assinado sem
escrever nada; escrita unica .or(...).select('*') zerando CAMPOS_DE_EPISODIO
e token_reprobe_at.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 4: Sync pós-OAuth em `after()` + trilha `mode='rebind'`

**Files:**
- Modify: `src/app/api/instagram/oauth/callback/route.ts` (passos 10 e 11)
- Test: `test/api/instagram/oauth-callback.test.ts` (acrescentar o `describe` abaixo)

**Interfaces:**
- Consumes: `openSyncRow`/`closeSyncRow` (`@/lib/instagram/sync-log`, A2), `syncInstagramAccount` (`@/lib/instagram/sync`, A/C2), `after` (`next/server`), `revalidateTag` (`next/cache`), `redact` (`@/lib/instagram/token`).
- Produces: a linha `instagram_sync_log` `mode='manual'` `status='started'` com `error_message='detail: <permissões>'` que a Task 11/12 lê para o modificador **`Syncing`** e para o texto "Connected, but the first sync failed"; a linha `mode='rebind'` `status='completed'` com `error_message='identity: @old/oldid → @new/newid'`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `test/api/instagram/oauth-callback.test.ts` (e, no topo do arquivo, os mocks novos):

```ts
// ── acrescentar aos mocks do topo do arquivo ────────────────────────────────
const afterCallbacks: Array<() => Promise<void> | void> = []
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn((cb: () => Promise<void> | void) => { afterCallbacks.push(cb) }) }
})
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/instagram/sync-log', () => ({
  openSyncRow: vi.fn(async () => 'log-1'),
  closeSyncRow: vi.fn(async () => undefined),
}))
vi.mock('@/lib/instagram/sync', () => ({ syncInstagramAccount: vi.fn() }))

import { revalidateTag } from 'next/cache'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import { syncInstagramAccount } from '@/lib/instagram/sync'
```

```ts
// ── acrescentar ao fim do arquivo ───────────────────────────────────────────
describe('GET /api/instagram/oauth/callback — post-OAuth sync', () => {
  beforeEach(() => {
    afterCallbacks.length = 0
    vi.mocked(openSyncRow).mockResolvedValue('log-1')
    vi.mocked(syncInstagramAccount).mockResolvedValue({
      postsFound: 12, postsInserted: 12, postsUpdated: 0, mediaCached: 12,
      partial: false, mediaFailed: 0,
    } as never)
  })

  it('opens the started row with the filtered permissions BEFORE scheduling after()', async () => {
    exchangeOk('instagram_business_basic,instagram_business_manage_comments,bogus_scope')
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(openSyncRow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: ACCOUNT }),
      'manual',
      { detail: 'instagram_business_basic,instagram_business_manage_comments' },
    )
    expect(afterCallbacks).toHaveLength(1)
    expect(syncInstagramAccount).not.toHaveBeenCalled()   // só roda dentro do after()
  })

  it('runs the sync with a deadline, closes the row and revalidates when posts changed', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    await afterCallbacks[0]?.()
    expect(syncInstagramAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: ACCOUNT }),
      'long-lived-token',
      expect.objectContaining({ deadlineAt: expect.any(Number) }),
    )
    expect(closeSyncRow).toHaveBeenCalledWith(expect.anything(), 'log-1', expect.objectContaining({ postsInserted: 12 }))
    expect(revalidateTag).toHaveBeenCalledWith('instagram-feed', { expire: 0 })
  })

  it('does not revalidate when nothing changed', async () => {
    vi.mocked(syncInstagramAccount).mockResolvedValue({
      postsFound: 12, postsInserted: 0, postsUpdated: 0, mediaCached: 0, partial: false, mediaFailed: 0,
    } as never)
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    await afterCallbacks[0]?.()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('MUST NOT mark the token invalid nor alert when the post-OAuth sync fails', async () => {
    vi.mocked(syncInstagramAccount).mockRejectedValue(
      Object.assign(new Error('Invalid OAuth access token'), { type: 'OAuthException', code: 190 }),
    )
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    await afterCallbacks[0]?.()
    expect(closeSyncRow).toHaveBeenCalledWith(expect.anything(), 'log-1', null, expect.stringContaining('Invalid OAuth access token'))
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      { tags: { component: 'instagram-oauth-postsync' } },
    )
    expect(updateSpy).toHaveBeenCalledTimes(1)   // só a escrita de conexão
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('warns when the sync log row could not be opened', async () => {
    vi.mocked(openSyncRow).mockResolvedValue(null)
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram oauth: sync log row missing', 'warning')
  })

  it('writes the rebind audit trail when the identity changed', async () => {
    mockDb({ target: { id: ACCOUNT, site_id: SITE, handle: 'old.handle', ig_user_id: '17840000000000001', ig_user_id_source: 'oauth' } })
    const st = validState({ allowRebindTo: '17841400000000000' })
    await GET(req(`?code=abc&state=${encodeURIComponent(st)}`))
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      account_id: ACCOUNT, site_id: SITE, mode: 'rebind', status: 'completed',
      error_message: 'identity: @old.handle/17840000000000001 → @thiago.figueiredo/17841400000000000',
    }))
  })

  it('writes no rebind trail when the identity is unchanged', async () => {
    await GET(req(`?code=abc&state=${encodeURIComponent(validState())}`))
    const calls = insertSpy.mock.calls.filter((c) => (c[0] as { mode?: string }).mode === 'rebind')
    expect(calls).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd apps/web && npx vitest run test/api/instagram/oauth-callback.test.ts -t "post-OAuth sync"`
Expected: FAIL — `expected "openSyncRow" to be called` / `afterCallbacks` vazio.

- [ ] **Step 3: Implementar o passo 11 e a trilha de rebind**

Em `src/app/api/instagram/oauth/callback/route.ts`, acrescentar aos imports:

```ts
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import type { InstagramAccountRow } from '@/lib/instagram/types'
```

Substituir o bloco final (de `await recordSocialConsent(...)` até o `return finish({ success: true, targetOrigin })`) por:

```ts
  // Trilha de auditoria quando a identidade mudou (rebind ou reconexão de legado)
  const identityChanged =
    target.ig_user_id !== igId || normalizeHandle(target.handle) !== handle
  if (identityChanged) {
    const trailNow = new Date().toISOString()
    await supabase.from('instagram_sync_log').insert({
      site_id: state.siteId,
      account_id: state.accountId,
      mode: 'rebind',
      status: 'completed',
      posts_found: 0,
      posts_inserted: 0,
      posts_updated: 0,
      media_cached: 0,
      error_message:
        `identity: @${normalizeHandle(target.handle)}/${target.ig_user_id ?? 'null'} → @${handle}/${igId}`,
      started_at: trailNow,
      completed_at: trailNow,
    })
  }

  await recordSocialConsent(supabase, {
    userId: state.userId,
    siteId: state.siteId,
    category: 'social_feed_read',
    req,
  })

  // 11 — sync pós-OAuth da linha `accountId`. A linha `started` é aberta ANTES
  // do `after()` para que o card mostre "Syncing your feed…" no `router.refresh()`
  // que o listener dispara ~8 s depois do sucesso (§3.5, modificador `Syncing`).
  const account = (updatedRows.find((r) => r.id === state.accountId) ?? updatedRows[0]) as unknown as InstagramAccountRow
  const logId = await openSyncRow(supabase, account, 'manual', { detail: grantedPermissions })
  if (logId === null) Sentry.captureMessage('instagram oauth: sync log row missing', 'warning')
  const runStart = Date.now()
  after(async () => {
    try {
      const r = await syncInstagramAccount(supabase, account, plainToken, { deadlineAt: runStart + 100_000 })
      await closeSyncRow(supabase, logId, r)
      if (r.postsInserted > 0 || r.postsUpdated > 0) revalidateTag('instagram-feed', { expire: 0 })
    } catch (err) {
      await closeSyncRow(supabase, logId, null, redact(String(err)))
      Sentry.captureException(err, { tags: { component: 'instagram-oauth-postsync' } })
      // MUST: o sync pós-OAuth NUNCA marca token inválido nem alerta — o token
      // acabou de ser emitido; uma falha aqui é quase sempre configuração
      // (Standard Access, conta não-profissional, id errado no /me). A
      // confirmação fica com o probe do cron das 13:00 (§3.4).
    }
  })

  // 12 — sucesso
  return finish({ success: true, targetOrigin })
```

Remover o `void grantedPermissions` (agora é consumido).

- [ ] **Step 4: Rodar o arquivo inteiro e conferir que passa**

Run: `cd apps/web && npx vitest run test/api/instagram/oauth-callback.test.ts`
Expected: PASS (todos os `describe`).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/api/instagram/oauth/callback/route.ts apps/web/test/api/instagram/oauth-callback.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): sync pos-OAuth em after() + trilha de rebind

Linha started com 'detail: <permissoes>' aberta antes do after(); sync com
deadlineAt = runStart + 100s; closeSyncRow sempre; revalidateTag apenas com
posts novos; falha vira linha failed + captureException e NUNCA marca token
invalido nem alerta (§3.1 passo 11). Identidade alterada grava linha
mode='rebind' completed com o texto identity: @old/old_id -> @new/new_id.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 5: `signed-request.ts` + `POST /api/instagram/deauthorize` + `skipSiteResolution`

**Files:**
- Create: `src/lib/instagram/signed-request.ts`
- Create: `src/app/api/instagram/deauthorize/route.ts`
- Modify: `src/middleware.ts:309-315` (`skipSiteResolution`)
- Test: `test/api/instagram/deauthorize.test.ts`
- Test: `test/middleware/instagram-public-routes.test.ts`

**Interfaces:**
- Consumes: `sendNtfyAlert` (`@/lib/ops/ntfy`), `claimAlert` (`@/lib/ops/alert-state`, C2 — **é ele quem reivindica a chave de anti-replay; nunca chamar `ops_alert_claim` cru daqui**), `identityKeyOf`/`markTokenInvalid`/`sweepTokenAlerts` (`@/lib/instagram/token`), `getSupabaseServiceClient`.
- Produces:
  ```ts
  // src/lib/instagram/signed-request.ts
  export const MAX_BODY_BYTES = 8192
  export const META_SECRET_FALLBACK_DEADLINE_MS: number      // Date.parse('2026-10-06T00:00:00Z')
  export const RUNBOOK_URL: string
  export interface ISignedRequestPayload { user_id: string; algorithm: string; issued_at: number; expires?: number }
  export type SignedRequestResult =
    | { ok: true; payload: ISignedRequestPayload; raw: string }
    | { ok: false; status: 400 | 200 }
  export async function readSignedRequest(
    req: Request, supabase: ServiceClient, route: 'deauthorize' | 'data-deletion',
  ): Promise<SignedRequestResult>
  export function matchedAccountsFilter(userId: string): string   // 'ig_user_id.eq.<id>,ig_professional_id.eq.<id>'
  ```
  A Task 6 (`data-deletion`) consome os mesmos exports.

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/api/instagram/deauthorize.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const APP_SECRET = 'ig-app-secret'
const IG_ID = '17841400000000000'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/ops/ntfy', () => ({ sendNtfyAlert: vi.fn(async () => ({ alerted: true })) }))
vi.mock('@/lib/instagram/token', async () => {
  // `identityKeyOf` fica REAL (nao mockada): a asserção de sweep abaixo deriva a
  // chave a partir da LINHA, em vez de hardcodar `o:${IG_ID}` — o que não
  // distinguiria a implementação certa (identityKeyOf(row)) de uma errada
  // (`o:${payload.user_id}`) quando os dois ids coincidem no fixture.
  const actual = await vi.importActual<typeof import('@/lib/instagram/token')>('@/lib/instagram/token')
  return {
    ...actual,
    markTokenInvalid: vi.fn(async () => undefined),
    sweepTokenAlerts: vi.fn(async () => undefined),
  }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { GET, POST, maxDuration } from '@/app/api/instagram/deauthorize/route'

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signedRequest(payload: Record<string, unknown>, secret = APP_SECRET): string {
  const encoded = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', secret).update(encoded).digest()
  return `${b64url(sig)}.${encoded}`
}

function validPayload(over: Record<string, unknown> = {}) {
  return {
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000),
    user_id: IG_ID,
    ...over,
  }
}

function post(sr: string, headers: Record<string, string> = {}) {
  const body = new URLSearchParams({ signed_request: sr }).toString()
  return new Request('https://bythiagofigueiredo.com/api/instagram/deauthorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body,
  })
}

const rpc = vi.fn()
const updateSpy = vi.fn()
const insertSpy = vi.fn()

function mockDb(accounts: Record<string, unknown>[], claim: boolean | null = true) {
  rpc.mockReset(); updateSpy.mockReset(); insertSpy.mockReset()
  rpc.mockResolvedValue({ data: claim, error: null })
  insertSpy.mockResolvedValue({ error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'instagram_sync_log') return { insert: insertSpy }
      return {
        select: vi.fn(() => ({
          or: vi.fn(() => ({ eq: vi.fn(async () => ({ data: accounts, error: null })) })),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          updateSpy(patch)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
        delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }),
  } as never)
}

const ACCOUNT = {
  id: 'acc-1', site_id: 'site-1', handle: 'thiago.figueiredo',
  ig_user_id: IG_ID, ig_professional_id: '9988776655', ig_user_id_source: 'oauth' as const,
  access_token: 'v1:x', locale: 'pt',
}

describe('POST /api/instagram/deauthorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    process.env.INSTAGRAM_APP_SECRET = APP_SECRET
    delete process.env.META_APP_SECRET
    delete process.env.INSTAGRAM_ALLOW_META_SECRET_FALLBACK
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    mockDb([ACCOUNT])
  })

  it('declares maxDuration = 60 and answers 405 to GET', async () => {
    expect(maxDuration).toBe(60)
    expect((await GET()).status).toBe(405)
  })

  it('clears the token, logs the mode and sweeps the alerts of that identity', async () => {
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
    expect(markTokenInvalid).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ id: 'acc-1' }), 'deauthorized',
      { fatal: true, forceReason: true },
    )
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ access_token: null, token_expires_at: null }))
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ mode: 'deauthorize' }))
    expect(sweepTokenAlerts).toHaveBeenCalledWith(expect.anything(), { identityKey: identityKeyOf(ACCOUNT) })
  })

  it('matches ig_user_id OR ig_professional_id, and only oauth rows', async () => {
    const orSpy = vi.fn(() => ({ eq: vi.fn(async () => ({ data: [ACCOUNT], error: null })) }))
    const eqSpy = vi.fn(async () => ({ data: [ACCOUNT], error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      rpc: rpc.mockResolvedValue({ data: true, error: null }),
      from: vi.fn((t: string) => t === 'instagram_sync_log'
        ? { insert: insertSpy.mockResolvedValue({ error: null }) }
        : {
            select: vi.fn(() => ({ or: (f: string) => { orSpy(f as never); return { eq: eqSpy } } })),
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          }),
    } as never)
    await POST(post(signedRequest(validPayload())))
    expect(orSpy).toHaveBeenCalledWith(`ig_user_id.eq.${IG_ID},ig_professional_id.eq.${IG_ID}`)
    expect(eqSpy).toHaveBeenCalledWith('ig_user_id_source', 'oauth')
  })

  it('answers 200 with no effects and warns when nothing matched', async () => {
    mockDb([])
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(200)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram deauthorize matched 0 accounts', 'warning')
  })

  it('rejects a body larger than 8192 bytes declared by content-length, without parsing', async () => {
    const res = await POST(post(signedRequest(validPayload()), { 'content-length': '9000' }))
    expect(res.status).toBe(400)
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('streams and aborts a chunked body over the cap', async () => {
    const cancel = vi.fn(async () => undefined)
    const big = 'x'.repeat(9000)
    let sent = false
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent) { c.close(); return }
        sent = true
        c.enqueue(new TextEncoder().encode(big))
      },
      cancel,
    })
    const req = new Request('https://bythiagofigueiredo.com/api/instagram/deauthorize', {
      method: 'POST', body, duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    Object.defineProperty(req.body, 'getReader', {
      value: () => { const r = (body as ReadableStream).getReader(); return { read: () => r.read(), cancel } },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(cancel).toHaveBeenCalled()
  })

  it('accepts a chunked body under the cap with no content-length', async () => {
    const sr = signedRequest(validPayload())
    const req = new Request('https://bythiagofigueiredo.com/api/instagram/deauthorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ signed_request: sr }).toString(),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('rejects a missing signed_request, a wrong algorithm, a 31-byte signature and a non-JSON payload', async () => {
    const noSr = new Request('https://x/api/instagram/deauthorize', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=b',
    })
    expect((await POST(noSr)).status).toBe(400)
    expect((await POST(post(signedRequest(validPayload({ algorithm: 'HMAC-SHA1' }))))).status).toBe(400)

    const encoded = Buffer.from(JSON.stringify(validPayload())).toString('base64url')
    const short = `${Buffer.alloc(31).toString('base64url')}.${encoded}`
    expect((await POST(post(short))).status).toBe(400)

    const notJson = `${Buffer.alloc(32).toString('base64url')}.${Buffer.from('not-json').toString('base64url')}`
    expect((await POST(post(notJson))).status).toBe(400)
  })

  it('rejects a stale issued_at and an already-expired payload, with Sentry but no ntfy', async () => {
    const stale = validPayload({ issued_at: Math.floor(Date.now() / 1000) - 25 * 3600 })
    expect((await POST(post(signedRequest(stale)))).status).toBe(400)
    expect(sendNtfyAlert).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('ops_alert_claim', expect.objectContaining({ p_key: expect.stringContaining('sigreq:') }))

    const expired = validPayload({ expires: Math.floor(Date.now() / 1000) - 10 })
    expect((await POST(post(signedRequest(expired)))).status).toBe(400)
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('answers 200 with no effects for a malformed user_id', async () => {
    const res = await POST(post(signedRequest(validPayload({ user_id: 'not-numeric' }))))
    expect(res.status).toBe(200)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('alerts at most once per 60 s and at most once per claim over 50 bad signatures', async () => {
    const bad = signedRequest(validPayload(), 'wrong-secret')
    for (let i = 0; i < 50; i++) expect((await POST(post(bad))).status).toBe(400)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.filter(
      (c) => c[0] === 'signed_request signature mismatch').length).toBe(1)
    expect(sendNtfyAlert).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls.filter((c) => c[0] === 'ops_alert_claim' &&
      (c[1] as { p_key: string }).p_key === 'signature_alert:deauthorize').length).toBeLessThanOrEqual(1)
  })

  it('claims a second time only after the 60 s in-memory guard', async () => {
    const bad = signedRequest(validPayload(), 'wrong-secret')
    const t0 = Date.parse('2026-09-06T10:00:00Z')
    vi.useFakeTimers({ now: t0, toFake: ['Date'] })
    await POST(post(bad))
    vi.setSystemTime(t0 + 61_000)
    await POST(post(bad))
    expect(rpc.mock.calls.filter((c) => c[0] === 'ops_alert_claim' &&
      (c[1] as { p_key: string }).p_key === 'signature_alert:deauthorize').length).toBe(2)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.filter(
      (c) => c[0] === 'signed_request signature mismatch').length).toBe(1)   // 1 claim => 1 emissão
    vi.useRealTimers()
  })

  it('accepts META_APP_SECRET only behind the flag and before the deadline', async () => {
    process.env.META_APP_SECRET = 'meta-secret'
    const sr = signedRequest(validPayload(), 'meta-secret')
    expect((await POST(post(sr))).status).toBe(400)          // flag off

    process.env.INSTAGRAM_ALLOW_META_SECRET_FALLBACK = '1'
    vi.useFakeTimers({ now: Date.parse('2026-09-20T00:00:00Z'), toFake: ['Date'] })
    const before = signedRequest(validPayload({ issued_at: Math.floor(Date.parse('2026-09-20T00:00:00Z') / 1000) }), 'meta-secret')
    expect((await POST(post(before))).status).toBe(200)

    vi.setSystemTime(Date.parse('2026-10-07T00:00:00Z'))
    const after = signedRequest(validPayload({ issued_at: Math.floor(Date.parse('2026-10-07T00:00:00Z') / 1000) }), 'meta-secret')
    expect((await POST(post(after))).status).toBe(400)
    vi.useRealTimers()
  })

  it('answers 500 (never 200) when the anti-replay claim itself errors', async () => {
    // `claimAlert` LANÇA quando a RPC devolve `error`; a chamada está dentro do
    // `try`, então o throw cai no `catch` => captureException + 500 e a Meta
    // re-tenta. Se a rota lesse só `data`, isto viraria 200 {} sem efeito nenhum.
    mockDb([ACCOUNT])
    rpc.mockResolvedValue({ data: null, error: { message: 'PGRST202 not found' } })
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(500)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('replays are 200 {} with no effects and the sigreq claim is not released', async () => {
    mockDb([ACCOUNT], false)     // ops_alert_claim => false (já visto)
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('releases the sigreq claim and answers 500 when an effect throws', async () => {
    vi.mocked(markTokenInvalid).mockRejectedValueOnce(new Error('db down'))
    const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      rpc: rpc.mockResolvedValue({ data: true, error: null }),
      from: vi.fn((t: string) => t === 'ops_alert_state'
        ? { delete: del }
        : t === 'instagram_sync_log'
          ? { insert: insertSpy.mockResolvedValue({ error: null }) }
          : {
              select: vi.fn(() => ({ or: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [ACCOUNT], error: null })) })) })),
              update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
            }),
    } as never)
    const res = await POST(post(signedRequest(validPayload())))
    expect(res.status).toBe(500)
    expect(del).toHaveBeenCalled()
  })
})
```

Criar `test/middleware/instagram-public-routes.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

describe('middleware — Meta public callbacks skip site resolution', () => {
  it('lists both Instagram callback routes in skipSiteResolution', () => {
    const block = src.slice(src.indexOf('const skipSiteResolution'), src.indexOf('if (skipSiteResolution)'))
    expect(block).toContain("pathname.startsWith('/api/instagram/deauthorize')")
    expect(block).toContain("pathname.startsWith('/api/instagram/data-deletion')")
  })

  it('keeps the pre-existing skips intact', () => {
    const block = src.slice(src.indexOf('const skipSiteResolution'), src.indexOf('if (skipSiteResolution)'))
    expect(block).toContain("pathname.startsWith('/api/cron/')")
    expect(block).toContain("pathname.startsWith('/api/webhooks/')")
    expect(block).toContain("pathname.startsWith('/auth/callback')")
  })
})
```

- [ ] **Step 2: Rodar os testes e conferir que falham**

Run: `cd apps/web && npx vitest run test/api/instagram/deauthorize.test.ts test/middleware/instagram-public-routes.test.ts`
Expected: FAIL — módulo `@/app/api/instagram/deauthorize/route` inexistente; `skipSiteResolution` sem as duas rotas.

- [ ] **Step 3: Implementar `src/lib/instagram/signed-request.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

export const MAX_BODY_BYTES = 8192
/** Depois disto o `META_APP_SECRET` é ignorado (+ `captureMessage` 1×/dia). */
export const META_SECRET_FALLBACK_DEADLINE_MS = Date.parse('2026-10-06T00:00:00Z')
export const RUNBOOK_URL =
  'https://github.com/TN-Figueiredo/bythiagofigueiredo/blob/main/docs/ops/instagram-token-alert-runbook.md'

const SIG_ALERT_GUARD_MS = 60_000
const ISSUED_AT_MAX_AGE_S = 24 * 3600
const ISSUED_AT_SKEW_S = 10 * 60
const USER_ID_RE = /^[0-9]{1,32}$/

/** Guarda em memória (por instância) antes do claim — teto real = instâncias × 1/min. */
let lastSigAlertAt = 0

export interface ISignedRequestPayload {
  user_id: string
  algorithm: string
  issued_at: number
  expires?: number
}

export type SignedRequestResult =
  | { ok: true; payload: ISignedRequestPayload; raw: string }
  | { ok: false; status: 400 | 200 }

function fromBase64Url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** Lê o corpo com corte rígido; `null` = acima do teto (o reader é cancelado). */
async function readBodyCapped(req: Request): Promise<string | null> {
  const body = req.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
}

function parseSignedRequestField(text: string): string | null {
  try {
    const fromForm = new URLSearchParams(text).get('signed_request')
    if (fromForm) return fromForm
  } catch { /* not urlencoded */ }
  try {
    const json = JSON.parse(text) as { signed_request?: unknown }
    if (typeof json.signed_request === 'string') return json.signed_request
  } catch { /* not JSON */ }
  return null
}

async function alertSignatureMismatch(
  supabase: ServiceClient,
  route: 'deauthorize' | 'data-deletion',
): Promise<void> {
  const now = Date.now()
  if (now - lastSigAlertAt < SIG_ALERT_GUARD_MS) return
  lastSigAlertAt = now
  const { data } = await supabase.rpc('ops_alert_claim', {
    p_key: `signature_alert:${route}`,
    p_min_interval: '1 day',
  })
  if (data !== true) return
  Sentry.captureMessage('signed_request signature mismatch', {
    level: 'warning',
    tags: { route, component: 'instagram-signed-request' },
    fingerprint: ['instagram-signed-request-signature'],
  })
  // REGRA-PII-NTFY (§0): nem `title` nem `body` carregam handle, ids ou tokens.
  await sendNtfyAlert({
    title: 'Instagram callback signature mismatch',
    body: 'Check Sentry for the route and secret tag.',
    priority: 'default',
    tags: ['warning'],
    click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
  })
}

/**
 * Passos 1–5 de §3.1 na ordem exata: nenhuma etapa roda se a anterior falhou, e
 * o anti-replay (passo 6) só é alcançado pelo chamador DEPOIS deste retorno.
 */
export async function readSignedRequest(
  req: Request,
  supabase: ServiceClient,
  route: 'deauthorize' | 'data-deletion',
): Promise<SignedRequestResult> {
  // 2 — tamanho
  const declared = req.headers.get('content-length')
  if (declared !== null) {
    const n = Number(declared)
    if (!Number.isInteger(n) || n < 0 || n > MAX_BODY_BYTES) return { ok: false, status: 400 }
  }
  const text = await readBodyCapped(req)
  if (text === null) return { ok: false, status: 400 }

  // 3 — parse
  const raw = parseSignedRequestField(text)
  if (!raw) return { ok: false, status: 400 }

  const dot = raw.indexOf('.')
  if (dot <= 0) return { ok: false, status: 400 }
  const sigPart = raw.slice(0, dot)
  const payloadPart = raw.slice(dot + 1)

  let payload: ISignedRequestPayload
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8')) as ISignedRequestPayload
  } catch {
    return { ok: false, status: 400 }
  }
  if (!payload || typeof payload !== 'object' || payload.algorithm !== 'HMAC-SHA256') {
    return { ok: false, status: 400 }
  }

  // 4 — assinatura
  const sigBuf = fromBase64Url(sigPart)
  if (sigBuf.length !== 32) {
    await alertSignatureMismatch(supabase, route)
    return { ok: false, status: 400 }
  }
  const secrets: string[] = []
  if (process.env.INSTAGRAM_APP_SECRET) secrets.push(process.env.INSTAGRAM_APP_SECRET)
  if (
    process.env.META_APP_SECRET &&
    process.env.INSTAGRAM_ALLOW_META_SECRET_FALLBACK === '1' &&
    Date.now() < META_SECRET_FALLBACK_DEADLINE_MS
  ) {
    secrets.push(process.env.META_APP_SECRET)
  }
  let matched = false
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(payloadPart).digest()
    if (expected.length === sigBuf.length && timingSafeEqual(expected, sigBuf)) matched = true
  }
  if (!matched) {
    await alertSignatureMismatch(supabase, route)
    return { ok: false, status: 400 }
  }

  // 5 — janela temporal e forma do id
  const nowS = Math.floor(Date.now() / 1000)
  const issuedAt = payload.issued_at
  const issuedOk =
    typeof issuedAt === 'number' && Number.isFinite(issuedAt) &&
    issuedAt >= nowS - ISSUED_AT_MAX_AGE_S && issuedAt <= nowS + ISSUED_AT_SKEW_S
  const expiresOk =
    typeof payload.expires !== 'number' || payload.expires <= 0 || payload.expires >= nowS
  if (!issuedOk || !expiresOk) {
    const now = Date.now()
    if (now - lastSigAlertAt >= SIG_ALERT_GUARD_MS) {
      lastSigAlertAt = now
      Sentry.captureMessage('signed_request outside the accepted time window', {
        level: 'warning',
        tags: { route, component: 'instagram-signed-request' },
      })
    }
    return { ok: false, status: 400 }
  }
  if (typeof payload.user_id !== 'string' || !USER_ID_RE.test(payload.user_id)) {
    Sentry.captureMessage('signed_request user_id malformed', {
      level: 'warning',
      tags: { route, component: 'instagram-signed-request' },
    })
    return { ok: false, status: 200 }
  }

  return { ok: true, payload, raw }
}

/**
 * Alcance dos callbacks: `ig_user_id` OU `ig_professional_id`. Seguro por
 * construção — `user_id` já casou `^[0-9]{1,32}$` (alfabeto sem `,`/`(`/`)`/`"`).
 * O chamador conjuga com `.eq('ig_user_id_source','oauth')`: linhas `legacy`
 * NUNCA casam (o id delas veio de outro app — §3.1 passo 7).
 */
export function matchedAccountsFilter(userId: string): string {
  return `ig_user_id.eq.${userId},ig_professional_id.eq.${userId}`
}
```

- [ ] **Step 4: Implementar `src/app/api/instagram/deauthorize/route.ts`**

```ts
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { claimAlert } from '@/lib/ops/alert-state'
import { matchedAccountsFilter, readSignedRequest } from '@/lib/instagram/signed-request'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(req: Request): Promise<Response> {
  const supabase = getSupabaseServiceClient()

  const parsed = await readSignedRequest(req, supabase, 'deauthorize')
  if (!parsed.ok) {
    return parsed.status === 200
      ? Response.json({}, { status: 200 })
      : new Response('Bad Request', { status: 400 })
  }
  const igUserId = parsed.payload.user_id

  const replayKey = `sigreq:${createHash('sha256').update(parsed.raw).digest('hex')}`

  try {
    // 6 — anti-replay SÓ depois de assinatura + janela. `false` = já processado:
    // 200 {} incondicional, sem efeitos e sem liberar o claim.
    //
    // INTERVALO = `'2 days'`, e não um intervalo "permanente", porque a retenção
    // manda: o passo `retention` dos DOIS crons de C2 apaga `ops_alert_state` com
    // `like('key','sigreq:%')` e `last_at < now-2d`, então uma chave declarada
    // "permanente" evaporaria de qualquer jeito em 2 dias e o plano estaria
    // afirmando uma garantia que o banco não sustenta.
    // INVARIANTE: retenção (2 d) > janela de `issued_at` (24 h). Um replay que
    // sobrevive à retenção já é recusado no passo 5 de `readSignedRequest`
    // (`issuedAt >= nowS - ISSUED_AT_MAX_AGE_S`, 24 h) — nunca chega até aqui.
    // Quem mudar um dos dois números tem de mudar o outro.
    //
    // MUST: usar `claimAlert` (C2, src/lib/ops/alert-state.ts), que LANÇA quando a
    // RPC devolve `error` ou algo que não é boolean. Ler só `data` faria um banco
    // fora do ar ou a RPC ausente virarem `data: null` ⇒ "já processado" ⇒ 200 {}
    // sem NENHUM efeito: a Meta considera o callback entregue, nunca re-tenta, e a
    // desautorização se perde em silêncio. Dentro do `try`, como em
    // `data-deletion`: o throw vira `captureException` + 500 e a Meta re-tenta.
    if (!(await claimAlert(supabase, replayKey, '2 days'))) {
      return Response.json({}, { status: 200 })
    }

    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .or(matchedAccountsFilter(igUserId))
      .eq('ig_user_id_source', 'oauth')

    const rows = (accounts ?? []) as InstagramAccountRow[]
    if (rows.length === 0) {
      Sentry.captureMessage('instagram deauthorize matched 0 accounts', 'warning')
      return Response.json({}, { status: 200 })
    }

    const nowIso = new Date().toISOString()
    for (const account of rows) {
      await markTokenInvalid(supabase, account, 'deauthorized', { fatal: true, forceReason: true })
      await supabase
        .from('instagram_accounts')
        .update({ access_token: null, token_expires_at: null, updated_at: nowIso })
        .eq('id', account.id)
      await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: 'deauthorize',
        status: 'completed',
        posts_found: 0,
        posts_inserted: 0,
        posts_updated: 0,
        media_cached: 0,
        error_message: 'detail: deauthorized by Meta callback',
        started_at: nowIso,
        completed_at: nowIso,
      })
    }

    // MUST: a identidade de um alerta é `identityKeyOf(row)` (C2), não
    // `o:${payload.user_id}`. Uma linha casada por `ig_professional_id` tem
    // `ig_user_id` diferente do id da Meta — varrer a chave montada à mão não
    // encontraria o grupo e o episódio recém-aberto ficaria sem alerta nenhum.
    for (const identityKey of new Set(rows.map(identityKeyOf))) {
      await sweepTokenAlerts(supabase, { identityKey })
    }
    return Response.json({}, { status: 200 })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-deauthorize' } })
    await supabase.from('ops_alert_state').delete().eq('key', replayKey)
    return new Response('Internal Server Error', { status: 500 })
  }
}
```

- [ ] **Step 5: Acrescentar as duas rotas ao `skipSiteResolution`**

Em `src/middleware.ts`, trocar

```ts
  const skipSiteResolution =
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/auth/callback')
```

por

```ts
  const skipSiteResolution =
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/auth/callback') ||
    // Callbacks públicos da Meta: chegam sem Host do site e sem sessão; a
    // autenticação é o `signed_request` assinado, não a resolução de site.
    pathname.startsWith('/api/instagram/deauthorize') ||
    pathname.startsWith('/api/instagram/data-deletion')
```

- [ ] **Step 6: Rodar os testes e conferir que passam**

Run: `cd apps/web && npx vitest run test/api/instagram/deauthorize.test.ts test/middleware/instagram-public-routes.test.ts test/middleware/`
Expected: PASS (inclusive `forged-site-headers.test.ts` e `go-subdomain.test.ts`, intactos).

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/instagram/signed-request.ts \
        apps/web/src/app/api/instagram/deauthorize/route.ts \
        apps/web/src/middleware.ts \
        apps/web/test/api/instagram/deauthorize.test.ts \
        apps/web/test/middleware/instagram-public-routes.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): callback de desautorizacao da Meta + signed_request

Modulo signed-request com a ordem numerada de §3.1 (405, content-length/stream
com corte em 8192, parse, assinatura com timingSafeEqual sobre os dois segredos
sem early-return, janela de issued_at/expires, forma do user_id), guarda em
memoria de 60 s antes do claim de alerta e REGRA-PII-NTFY no push. Rota
deauthorize com anti-replay apos a assinatura, alcance (ig_user_id OR
ig_professional_id) AND source='oauth', sweep por identityKey e liberacao do
claim em excecao. Middleware pula resolucao de site nas duas rotas publicas.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 6: `POST /api/instagram/data-deletion` (orquestra os efeitos de C2)

Os efeitos (d)–(h) **já existem**: C2 os extraiu para `src/lib/instagram/deletion.ts`
(`runDeletionEffects`) porque o cron das 11:00 precisa retomar um pedido travado (§3.3 passo 3) e a
rota só nasce agora. C3 **não** duplica nada — orquestra (a), (b), (c) e delega (d)–(h).

**Files:**
- Create: `src/app/api/instagram/data-deletion/route.ts`
- Test: `test/api/instagram/data-deletion.test.ts`

**Interfaces:**
- Consumes: `readSignedRequest`/`matchedAccountsFilter`/`RUNBOOK_URL` (Task 5); `runDeletionEffects` e `DELETION_BLOB_BUDGET_MS` (`@/lib/instagram/deletion`, C2 — carregam as contas, apagam slots/posts/blobs, anonimizam, trocam a trilha, revalidam a tag e escrevem `completed_at` **por último**, retornando cedo e deixando `completed_at` NULL quando o laço de blobs bate no prazo); `markTokenInvalid`/`sweepTokenAlerts`; `sendNtfyAlert`.
- Produces: a linha `instagram_deletion_requests` (`confirmation_code`) que a página pública da Task 8 lê, e a resposta `{ url, confirmation_code }` que a Meta recebe.

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/api/instagram/data-deletion.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const APP_SECRET = 'ig-app-secret'
const IG_ID = '17841400000000000'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/ops/ntfy', () => ({ sendNtfyAlert: vi.fn(async () => ({ alerted: true })) }))
vi.mock('@/lib/instagram/token', async () => {
  // `identityKeyOf` fica REAL (nao mockada) — mesma razão do teste de deauthorize:
  // a asserção deriva a chave da LINHA em vez de hardcodar `o:${IG_ID}`.
  const actual = await vi.importActual<typeof import('@/lib/instagram/token')>('@/lib/instagram/token')
  return {
    ...actual,
    markTokenInvalid: vi.fn(async () => undefined),
    sweepTokenAlerts: vi.fn(async () => []),
  }
})
vi.mock('@/lib/instagram/deletion', () => ({
  DELETION_BLOB_BUDGET_MS: 45_000,
  runDeletionEffects: vi.fn(async () => undefined),
}))
// MUST: a rota usa `claimAlert` (C2) para o anti-replay, nunca `supabase.rpc`
// cru — um `error` da RPC tem de LANÇAR e virar 500, nunca "já processado".
vi.mock('@/lib/ops/alert-state', () => ({ claimAlert: vi.fn(async () => true) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { runDeletionEffects } from '@/lib/instagram/deletion'
import { claimAlert } from '@/lib/ops/alert-state'
import { GET, POST, maxDuration } from '@/app/api/instagram/data-deletion/route'

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function signedRequest(payload: Record<string, unknown>, secret = APP_SECRET): string {
  const encoded = b64url(JSON.stringify(payload))
  return `${b64url(createHmac('sha256', secret).update(encoded).digest())}.${encoded}`
}
function post(over: Record<string, unknown> = {}) {
  const sr = signedRequest({
    algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: IG_ID, ...over,
  })
  return new Request('https://bythiagofigueiredo.com/api/instagram/data-deletion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ signed_request: sr }).toString(),
  })
}

const OAUTH_ROW = {
  id: 'acc-1', site_id: 'site-1', handle: 'thiago.figueiredo', locale: 'pt',
  ig_user_id: IG_ID, ig_professional_id: '9988776655', ig_user_id_source: 'oauth' as const,
  access_token: 'v1:x', created_at: '2026-01-01T00:00:00Z',
}

const rpc = vi.fn()
const requestInsert = vi.fn()
const accountUpdate = vi.fn()
const opsDelete = vi.fn()
const orSpy = vi.fn()
const sourceSpy = vi.fn()

function mockDb(opts: {
  oauthRows?: Record<string, unknown>[]
  legacyRows?: Record<string, unknown>[]
  claim?: boolean
  lastRequest?: { id: string; confirmation_code: string; requested_at: string; completed_at: string | null } | null
  sigreqLastAt?: string | null
}) {
  rpc.mockReset(); requestInsert.mockReset(); accountUpdate.mockReset()
  opsDelete.mockReset(); orSpy.mockReset(); sourceSpy.mockReset()
  // O anti-replay do sigreq passa por `claimAlert` (mockado acima), não por
  // `rpc` cru — só o claim do push `ddmismatch:` (23h) ainda usa `rpc` direto.
  vi.mocked(claimAlert).mockReset()
  vi.mocked(claimAlert).mockResolvedValue(opts.claim ?? true)
  rpc.mockImplementation(async () => ({ data: true, error: null }))
  requestInsert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: 'req-new' }, error: null }) }),
  })

  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'instagram_deletion_requests') {
        return {
          insert: requestInsert,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: opts.lastRequest ?? null, error: null })),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'ops_alert_state') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: opts.sigreqLastAt ? { last_at: opts.sigreqLastAt } : null, error: null,
              })),
            })),
          })),
          delete: vi.fn(() => ({ eq: vi.fn(async () => { opsDelete(); return { error: null } }) })),
        }
      }
      // instagram_accounts
      return {
        select: vi.fn(() => ({
          or: vi.fn((filter: string) => {
            orSpy(filter)
            return {
              eq: vi.fn(async (col: string, val: string) => {
                sourceSpy(col, val)
                return {
                  data: val === 'oauth' ? (opts.oauthRows ?? [OAUTH_ROW]) : (opts.legacyRows ?? []),
                  error: null,
                }
              }),
            }
          }),
        })),
        update: vi.fn((patch: Record<string, unknown>) => {
          accountUpdate(patch)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
      }
    }),
  } as never)
}

describe('POST /api/instagram/data-deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    process.env.INSTAGRAM_APP_SECRET = APP_SECRET
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    mockDb({})
  })

  it('declares maxDuration = 60 and answers 405 to GET', async () => {
    expect(maxDuration).toBe(60)
    expect((await GET()).status).toBe(405)
  })

  it('inserts the request, clears the tokens, sweeps BEFORE anonymising and delegates (d)-(h)', async () => {
    const res = await POST(post())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; confirmation_code: string }
    expect(body.confirmation_code).toMatch(/^[0-9a-f]{32}$/)
    expect(body.url).toBe(`https://bythiagofigueiredo.com/data-deletion?code=${body.confirmation_code}`)

    expect(requestInsert).toHaveBeenCalledWith(expect.objectContaining({
      ig_user_id: IG_ID, site_id: 'site-1', completed_at: null,
    }))
    expect(markTokenInvalid).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ id: 'acc-1' }), 'data_deletion_requested',
      { fatal: true, forceReason: true },
    )
    expect(accountUpdate).toHaveBeenCalledWith(expect.objectContaining({
      access_token: null, token_expires_at: null,
    }))
    // (c) a varredura corre ANTES de (e): a anonimização é feita por
    // `runDeletionEffects`, e depois dela o grupo não casaria mais.
    expect(vi.mocked(sweepTokenAlerts).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(runDeletionEffects).mock.invocationCallOrder[0] ?? Infinity)
    expect(sweepTokenAlerts).toHaveBeenCalledWith(expect.anything(), { identityKey: identityKeyOf(OAUTH_ROW) })
    expect(runDeletionEffects).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'req-new', ig_user_id: IG_ID },
      expect.any(Number),
    )
  })

  it('matches ig_user_id OR ig_professional_id, and only oauth rows', async () => {
    await POST(post())
    expect(orSpy).toHaveBeenCalledWith(`ig_user_id.eq.${IG_ID},ig_professional_id.eq.${IG_ID}`)
    expect(sourceSpy).toHaveBeenCalledWith('ig_user_id_source', 'oauth')
  })

  it('answers 200 with url + code and a null site_id when nothing matched', async () => {
    mockDb({ oauthRows: [] })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect((await res.json()).confirmation_code).toMatch(/^[0-9a-f]{32}$/)
    expect(requestInsert).toHaveBeenCalledWith(expect.objectContaining({
      site_id: null, completed_at: expect.any(String),
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram data-deletion matched 0 accounts', 'warning')
    expect(runDeletionEffects).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(sendNtfyAlert).not.toHaveBeenCalled()
  })

  it('pushes an ID-space suspicion when a legacy row carries the same id — and touches nothing', async () => {
    mockDb({ oauthRows: [], legacyRows: [{ id: 'legacy-1', ig_user_id: IG_ID, ig_user_id_source: 'legacy' }] })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(sendNtfyAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Instagram deletion request matched no account',
      body: 'possible ID-space mismatch — see the runbook',
      priority: 'default',
      tags: ['warning'],
    }))
    const push = vi.mocked(sendNtfyAlert).mock.calls[0]?.[0]
    expect(`${push?.title} ${push?.body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${push?.title} ${push?.body}`).not.toMatch(/[0-9]{6,}/)
    expect(accountUpdate).not.toHaveBeenCalled()
    expect(runDeletionEffects).not.toHaveBeenCalled()
  })

  it('matches a row by ig_professional_id and refuses a legacy row with the same id', async () => {
    mockDb({ oauthRows: [{ ...OAUTH_ROW, ig_user_id: '11112222', ig_professional_id: IG_ID }] })
    expect((await POST(post())).status).toBe(200)
    expect(markTokenInvalid).toHaveBeenCalled()

    mockDb({ oauthRows: [], legacyRows: [{ id: 'legacy-1', ig_professional_id: IG_ID, ig_user_id_source: 'legacy' }] })
    vi.mocked(markTokenInvalid).mockClear()
    expect((await POST(post())).status).toBe(200)
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith('instagram data-deletion matched 0 accounts', 'warning')
  })

  it('returns the same confirmation_code on a completed replay, with no destructive call', async () => {
    mockDb({
      claim: false,
      lastRequest: { id: 'req-1', confirmation_code: 'f'.repeat(32), requested_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-01T00:01:00Z' },
    })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect((await res.json()).confirmation_code).toBe('f'.repeat(32))
    expect(runDeletionEffects).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('answers 202 with no body while a fresh unfinished request is in flight', async () => {
    mockDb({
      claim: false,
      lastRequest: {
        id: 'req-1', confirmation_code: 'f'.repeat(32),
        requested_at: new Date(Date.now() - 30_000).toISOString(), completed_at: null,
      },
    })
    const res = await POST(post())
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
    expect(runDeletionEffects).not.toHaveBeenCalled()
  })

  it('resumes (d)-(h) for a stalled request older than 90 s and keeps the original code', async () => {
    mockDb({
      claim: false,
      lastRequest: {
        id: 'req-1', confirmation_code: 'f'.repeat(32),
        requested_at: new Date(Date.now() - 100_000).toISOString(), completed_at: null,
      },
    })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect((await res.json()).confirmation_code).toBe('f'.repeat(32))
    expect(runDeletionEffects).toHaveBeenCalledWith(
      expect.anything(), { id: 'req-1', ig_user_id: IG_ID }, expect.any(Number),
    )
    expect(requestInsert).not.toHaveBeenCalled()
    // Retomada NÃO repete (a)-(c): a linha já existe e o token já foi limpo.
    expect(markTokenInvalid).not.toHaveBeenCalled()
  })

  it('with no row: a fresh sigreq claim answers 202, a 100 s old one is released and processed', async () => {
    mockDb({ claim: false, lastRequest: null, sigreqLastAt: new Date(Date.now() - 30_000).toISOString() })
    expect((await POST(post())).status).toBe(202)
    expect(opsDelete).not.toHaveBeenCalled()

    mockDb({ claim: false, lastRequest: null, sigreqLastAt: new Date(Date.now() - 100_000).toISOString() })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(opsDelete).toHaveBeenCalled()
    expect(requestInsert).toHaveBeenCalled()
  })

  it('passes a deadline of runStart + DELETION_BLOB_BUDGET_MS so a truncated run keeps completed_at null', async () => {
    const t0 = Date.parse('2026-09-06T10:00:00Z')
    vi.useFakeTimers({ now: t0, toFake: ['Date'] })
    await POST(post({ issued_at: Math.floor(t0 / 1000) }))
    const deadline = vi.mocked(runDeletionEffects).mock.calls[0]?.[2] as number
    expect(deadline).toBe(t0 + 45_000)
    vi.useRealTimers()
  })

  it('releases the sigreq claim and answers 500 when an effect throws', async () => {
    vi.mocked(markTokenInvalid).mockRejectedValueOnce(new Error('db down'))
    const res = await POST(post())
    expect(res.status).toBe(500)
    expect(opsDelete).toHaveBeenCalled()
  })

  it('answers 500 (never 200/202) when the anti-replay claim itself errors', async () => {
    // `claimAlert` LANÇA quando a RPC devolve `error`; a chamada está dentro do
    // `try`, então o throw cai no `catch` => captureException + 500 e a Meta
    // re-tenta. Sem isto, um banco fora do ar viraria "já processado" e a
    // exclusão se perderia em silêncio (mesma classe de bug do `deauthorize`).
    vi.mocked(claimAlert).mockRejectedValueOnce(new Error('ops_alert_claim(key) failed: PGRST202 not found'))
    const res = await POST(post())
    expect(res.status).toBe(500)
    expect(requestInsert).not.toHaveBeenCalled()
    expect(markTokenInvalid).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e conferir que falha**

Run: `cd apps/web && npx vitest run test/api/instagram/data-deletion.test.ts`
Expected: FAIL — módulo `@/app/api/instagram/data-deletion/route` inexistente.

- [ ] **Step 3: Conferir que `deletion.ts` (C2) está na árvore com a assinatura do contrato**

```bash
cd apps/web && grep -n "export const DELETION_BLOB_BUDGET_MS\|export async function runDeletionEffects\|export async function resumeStuckDeletionRequest" src/lib/instagram/deletion.ts
```
Esperado: as três. **Se o arquivo não existir, pare** — C2 não está na árvore e a rota duplicaria os efeitos (d)–(h), que é exatamente o que a ambiguidade resolvida de C2 evitou.

- [ ] **Step 4: Implementar a rota**

Criar `src/app/api/instagram/data-deletion/route.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { claimAlert } from '@/lib/ops/alert-state'
import { DELETION_BLOB_BUDGET_MS, runDeletionEffects } from '@/lib/instagram/deletion'
import {
  RUNBOOK_URL, matchedAccountsFilter, readSignedRequest,
} from '@/lib/instagram/signed-request'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Acima disto o run anterior está morto (o teto da função é 60 s). */
const IN_FLIGHT_MS = 90_000

function statusUrl(code: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/data-deletion?code=${code}`
}

export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(req: Request): Promise<Response> {
  const runStart = Date.now()
  const supabase = getSupabaseServiceClient()

  const parsed = await readSignedRequest(req, supabase, 'data-deletion')
  if (!parsed.ok) {
    return parsed.status === 200
      ? Response.json({}, { status: 200 })
      : new Response('Bad Request', { status: 400 })
  }
  const igUserId = parsed.payload.user_id
  const replayKey = `sigreq:${createHash('sha256').update(parsed.raw).digest('hex')}`

  let confirmationCode: string
  let requestId: string | null = null
  let resuming = false

  try {
    // 6 — anti-replay. Aqui a idempotência é RETOMADA, nunca confirmação cega: um
    // run morto no meio deixava a linha inserida e o claim reivindicado, e
    // responder sucesso a toda re-tentativa produzia uma declaração de compliance
    // fabricada por um timeout.
    //
    // INTERVALO = `'2 days'`, casado com a retenção: o passo `retention` dos DOIS
    // crons de C2 apaga `ops_alert_state` com `like('key','sigreq:%')` e
    // `last_at < now-2d`. Declarar um intervalo de séculos prometeria uma
    // permanência que o banco apaga em 2 dias — o número aqui é o mesmo da
    // retenção, de propósito.
    // INVARIANTE: retenção (2 d) > janela de `issued_at` (24 h). Um replay que
    // sobrevive à retenção já é recusado no passo 5 de `readSignedRequest`
    // (`ISSUED_AT_MAX_AGE_S = 24 * 3600`), então nunca reabre esta chave. Mexer em
    // um dos dois números obriga a mexer no outro e nesta nota.
    //
    // MUST: usar `claimAlert` (C2, src/lib/ops/alert-state.ts) — mesma garantia da
    // rota `deauthorize`. `claimAlert` LANÇA quando a RPC devolve `error` ou algo
    // que não é boolean; o throw cai no `catch` abaixo (captureException + 500,
    // Meta re-tenta) em vez de um banco fora do ar virar "já processado" e a
    // exclusão se perder em silêncio.
    const claimed = await claimAlert(supabase, replayKey, '2 days')

    if (claimed !== true) {
      const { data: last } = await supabase
        .from('instagram_deletion_requests')
        .select('id, confirmation_code, requested_at, completed_at')
        .eq('ig_user_id', igUserId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (last) {
        if (last.completed_at !== null) {
          return Response.json({ url: statusUrl(last.confirmation_code), confirmation_code: last.confirmation_code })
        }
        if (Date.parse(last.requested_at) >= Date.now() - IN_FLIGHT_MS) {
          return new Response(null, { status: 202 })      // o run anterior ainda pode estar vivo
        }
        confirmationCode = last.confirmation_code
        requestId = last.id
        resuming = true
      } else {
        const { data: state } = await supabase
          .from('ops_alert_state')
          .select('last_at')
          .eq('key', replayKey)
          .maybeSingle()
        if (state && Date.parse(state.last_at) >= Date.now() - IN_FLIGHT_MS) {
          return new Response(null, { status: 202 })
        }
        await supabase.from('ops_alert_state').delete().eq('key', replayKey)
        confirmationCode = randomBytes(16).toString('hex')
      }
    } else {
      confirmationCode = randomBytes(16).toString('hex')
    }

    if (!resuming) {
      // Alcance (MUST): (ig_user_id = X OU ig_professional_id = X) E source='oauth'.
      const { data: accountsData } = await supabase
        .from('instagram_accounts')
        .select('*')
        .or(matchedAccountsFilter(igUserId))
        .eq('ig_user_id_source', 'oauth')
      const accounts = (accountsData ?? []) as InstagramAccountRow[]

      // Zero casamentos: obrigação legal cumprida, mas nunca em silêncio.
      if (accounts.length === 0) {
        Sentry.captureMessage('instagram data-deletion matched 0 accounts', 'warning')
        const { data: legacy } = await supabase
          .from('instagram_accounts')
          .select('id')
          .or(matchedAccountsFilter(igUserId))
          .eq('ig_user_id_source', 'legacy')
        if ((legacy ?? []).length > 0) {
          const { data: pushClaim } = await supabase.rpc('ops_alert_claim', {
            p_key: `ddmismatch:${igUserId}`,
            p_min_interval: '23 hours',
          })
          if (pushClaim === true) {
            // REGRA-PII-NTFY (§0): sem handle, sem ids, sem token. Nenhuma ação
            // destrutiva sobre a linha `legacy` — o push existe só para o dono
            // decidir manualmente.
            // `click` é o MESMO de todos os outros emissores — a rota curta do card
            // (Global Constraints: "todo click/action_href/backHref aponta para
            // /cms/settings/instagram"). O runbook citado no `body` é leitura, não
            // destino de clique: no celular o link do GitHub não leva a lugar
            // acionável. O `body` NÃO muda — ele é fixado byte a byte pela tabela
            // REGRA-PII-NTFY de C2 (`test/api/cron/ntfy.test.ts`).
            await sendNtfyAlert({
              title: 'Instagram deletion request matched no account',
              body: 'possible ID-space mismatch — see the runbook',
              priority: 'default',
              tags: ['warning'],
              click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
            })
          }
        }
        const nowIso = new Date().toISOString()
        await supabase.from('instagram_deletion_requests').insert({
          confirmation_code: confirmationCode,
          ig_user_id: igUserId,
          site_id: null,
          requested_at: nowIso,
          completed_at: nowIso,
        })
        return Response.json({ url: statusUrl(confirmationCode), confirmation_code: confirmationCode })
      }

      // (a) a linha nasce com `completed_at` NULL — é O sinal de "não terminou".
      const sorted = [...accounts].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      const { data: inserted } = await supabase
        .from('instagram_deletion_requests')
        .insert({
          confirmation_code: confirmationCode,
          ig_user_id: igUserId,
          site_id: sorted[0]?.site_id ?? null,
          requested_at: new Date().toISOString(),
          completed_at: null,
        })
        .select('id')
        .single()
      requestId = inserted?.id ?? null

      // (b) token fora, motivo gravado
      const nowIso = new Date().toISOString()
      for (const account of accounts) {
        await markTokenInvalid(supabase, account, 'data_deletion_requested', { fatal: true, forceReason: true })
        await supabase
          .from('instagram_accounts')
          .update({ access_token: null, token_expires_at: null, updated_at: nowIso })
          .eq('id', account.id)
      }

      // (c) varredura ANTES de anonimizar — `runDeletionEffects` anonimiza em (e)
      // e depois disso o grupo não casaria: nenhum alerta sairia.
      // A chave é `identityKeyOf(row)` (C2), NUNCA `o:${payload.user_id}`: uma
      // linha casada por `ig_professional_id` tem `ig_user_id` diferente do id da
      // Meta e a chave montada à mão não encontraria grupo nenhum.
      for (const identityKey of new Set(accounts.map(identityKeyOf))) {
        await sweepTokenAlerts(supabase, { identityKey })
      }
    }

    // (d)–(h), idempotentes e retomáveis (C2). Escreve `completed_at` por último
    // e retorna cedo, deixando-o NULL, quando o laço de blobs bate no prazo.
    if (requestId) {
      await runDeletionEffects(
        supabase,
        { id: requestId, ig_user_id: igUserId },
        runStart + DELETION_BLOB_BUDGET_MS,
      )
    }

    return Response.json({ url: statusUrl(confirmationCode), confirmation_code: confirmationCode })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-data-deletion' } })
    await supabase.from('ops_alert_state').delete().eq('key', replayKey)
    return new Response('Internal Server Error', { status: 500 })
  }
}
```

- [ ] **Step 5: Rodar o teste e conferir que passa**

Run: `cd apps/web && npx vitest run test/api/instagram/data-deletion.test.ts test/instagram/deletion.test.ts`
Expected: PASS nos dois (o de C2 continua provando os efeitos (d)–(h); o de C3 prova a orquestração).

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/api/instagram/data-deletion/route.ts \
        apps/web/test/api/instagram/data-deletion.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): callback de pedido de exclusao da Meta

Retomada em vez de confirmacao cega: completed_at NULL e o sinal de "nao
terminou", o replay apos 90 s retoma (d)-(h) e um pedido fresco responde 202
sem corpo. Alcance (ig_user_id OR ig_professional_id) AND source='oauth';
varredura de alertas antes da anonimizacao; zero casamentos ainda responde
{ url, confirmation_code } com captureMessage e, havendo linha legacy de id
igual, push de suspeita de espaco de ids sem nenhuma acao destrutiva. Os
efeitos (d)-(h) sao os de src/lib/instagram/deletion.ts (C2) — sem duplicacao.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 7: `LegalShell` estendido (`showLocaleSwitcher`, `relatedDocs`, `localeSwitcherHref`)

**Files:**
- Modify: `src/components/legal/legal-shell.tsx`
- Test: `test/components/legal-shell.test.tsx` (estender; ganha o pragma `jsdom`)

**Interfaces:**
- Consumes: `localePath` (`@/lib/i18n/locale-path`).
- Produces:
  ```ts
  export interface LegalShellProps {
    locale: 'pt-BR' | 'en'
    lastUpdated: string
    children: ReactNode
    showLocaleSwitcher?: boolean                                   // default true
    relatedDocs?: { href: string; label: string }[]                // default: privacy + terms
    localeSwitcherHref?: (other: 'pt-BR' | 'en') => string          // default: `?lang=${other}`
  }
  ```
  A Task 8 passa `localeSwitcherHref={(other) => `?code=${code}&lang=${other}`}` e `relatedDocs={[]}`.

- [ ] **Step 1: Escrever os testes que falham**

No topo de `test/components/legal-shell.test.tsx`, acrescentar a primeira linha:

```tsx
// @vitest-environment jsdom
```

e, ao fim do `describe('<LegalShell>')`, acrescentar:

```tsx
  it('keeps /privacy and /terms as the default related documents', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16"><p>content</p></LegalShell>
    )
    const toc = getByTestId('legal-shell-toc')
    expect(toc.querySelector('a[href="/privacy"]')?.textContent).toBe('Privacy Policy')
    expect(toc.querySelector('a[href="/terms"]')?.textContent).toBe('Terms of Service')
  })

  it('keeps the default locale switcher href at ?lang=<other>', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16"><p>content</p></LegalShell>
    )
    expect(getByTestId('legal-shell-locale-other-pt-BR').getAttribute('href')).toBe('?lang=pt-BR')
  })

  it('lets the caller rewrite the locale switcher href (preserving query params)', () => {
    const { getByTestId } = render(
      <LegalShell
        locale="en"
        lastUpdated="2026-04-16"
        localeSwitcherHref={(other) => `?code=abc&lang=${other}`}
      >
        <p>content</p>
      </LegalShell>
    )
    expect(getByTestId('legal-shell-locale-other-pt-BR').getAttribute('href')).toBe('?code=abc&lang=pt-BR')
  })

  it('hides the locale switcher when showLocaleSwitcher is false', () => {
    const { queryByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16" showLocaleSwitcher={false}>
        <p>content</p>
      </LegalShell>
    )
    expect(queryByTestId('legal-shell-locale-switcher')).toBeNull()
  })

  it('renders a custom relatedDocs list and drops the aside entirely when it is empty', () => {
    const { getByTestId, queryByTestId } = render(
      <LegalShell
        locale="en"
        lastUpdated="2026-04-16"
        relatedDocs={[{ href: '/privacy', label: 'Privacy Policy' }]}
      >
        <p>content</p>
      </LegalShell>
    )
    const toc = getByTestId('legal-shell-toc')
    expect(toc.querySelectorAll('a')).toHaveLength(1)

    const empty = render(
      <LegalShell locale="en" lastUpdated="2026-04-16" relatedDocs={[]}><p>content</p></LegalShell>
    )
    expect(empty.queryByTestId('legal-shell-toc')).toBeNull()
    expect(queryByTestId('legal-shell-toc')).not.toBeNull()
  })

  it('repeats the related documents below the article for small screens', () => {
    const { getByTestId } = render(
      <LegalShell locale="en" lastUpdated="2026-04-16"><p>content</p></LegalShell>
    )
    const inline = getByTestId('legal-shell-related-inline')
    expect(inline.className).toContain('lg:hidden')
    expect(inline.querySelectorAll('a')).toHaveLength(2)
  })
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/components/legal-shell.test.tsx`
Expected: FAIL — `legal-shell-related-inline` não existe; `localeSwitcherHref` ignorado.

- [ ] **Step 3: Implementar**

Em `src/components/legal/legal-shell.tsx`:

1. Estender a interface (logo depois de `children: ReactNode`):

```ts
  /**
   * Renderiza o alternador pt-BR ⇄ en no cabeçalho. `false` para páginas que
   * negociam o idioma por outro caminho. Default `true` (comportamento atual).
   */
  showLocaleSwitcher?: boolean
  /**
   * Lista de documentos relacionados. Default = Política de Privacidade +
   * Termos de Uso, exatamente como antes desta prop existir. `[]` remove a
   * coluna lateral e a lista inline.
   */
  relatedDocs?: { href: string; label: string }[]
  /**
   * Monta o `href` do alternador de idioma. Default `?lang=<other>` — o mesmo
   * de sempre. Páginas com query string própria (ex.: `?code=`) passam a sua,
   * senão o parâmetro seria descartado na troca de idioma.
   */
  localeSwitcherHref?: (other: 'pt-BR' | 'en') => string
```

2. Assinatura e derivações:

```tsx
export function LegalShell({
  locale,
  lastUpdated,
  children,
  showLocaleSwitcher = true,
  relatedDocs,
  localeSwitcherHref,
}: LegalShellProps) {
  const t = LABELS[locale]
  const otherLocale: 'pt-BR' | 'en' = locale === 'pt-BR' ? 'en' : 'pt-BR'
  const docs = relatedDocs ?? [
    { href: localePath('/privacy', locale), label: t.privacy },
    { href: localePath('/terms', locale), label: t.terms },
  ]
  const switcherHref = localeSwitcherHref
    ? localeSwitcherHref(otherLocale)
    : `?lang=${otherLocale}`
```

3. Substituir o `<nav>` do switcher (dentro do `<header>`) por:

```tsx
          {showLocaleSwitcher && (
            <nav
              aria-label={t.languageSwitcher}
              data-testid="legal-shell-locale-switcher"
              className="flex items-center gap-2 text-sm"
            >
              <span className="text-slate-500">{t.languageSwitcher}:</span>
              <span
                aria-current="true"
                lang={locale}
                className="font-semibold text-slate-900"
                data-testid={`legal-shell-locale-current-${locale}`}
              >
                {t.languageShort[locale]}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                |
              </span>
              <Link
                href={switcherHref}
                hrefLang={otherLocale}
                lang={otherLocale}
                className="text-slate-600 underline hover:text-slate-900"
                data-testid={`legal-shell-locale-other-${otherLocale}`}
              >
                {t.languageShort[otherLocale]}
              </Link>
            </nav>
          )}
```

4. Trocar a `<aside>` por uma versão dirigida por `docs` e acrescentar a lista inline:

```tsx
        {docs.length > 0 && (
          <aside
            aria-label="Table of contents"
            data-testid="legal-shell-toc"
            className="hidden lg:block"
          >
            <div className="sticky top-8 border-l border-slate-200 pl-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{t.related}</p>
              <ul className="mt-2 space-y-1">
                {docs.map((d) => (
                  <li key={d.href}>
                    <Link href={d.href} className="hover:text-slate-900">{d.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      {docs.length > 0 && (
        <div
          data-testid="legal-shell-related-inline"
          className="mx-auto max-w-4xl px-4 pb-8 text-sm text-slate-600 lg:hidden"
        >
          <p className="font-semibold text-slate-900">{t.related}</p>
          <ul className="mt-2 space-y-1">
            {docs.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="hover:text-slate-900">{d.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
```

(A `</div>` fechada acima é a do grid `mx-auto grid max-w-6xl …`; a lista inline vem **depois** dele e **antes** do `<footer>`.)

- [ ] **Step 4: Rodar e conferir que passa**

Run: `cd apps/web && npx vitest run test/components/legal-shell.test.tsx`
Expected: PASS (11 testes — os 5 originais intactos).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/components/legal/legal-shell.tsx apps/web/test/components/legal-shell.test.tsx
git commit -m "$(cat <<'EOF'
feat(legal): LegalShell com switcher, relatedDocs e href customizaveis

Tres props opcionais com defaults que preservam /privacy e /terms e o
href ?lang=<other>; relatedDocs tambem abaixo do article em < lg (a aside
e hidden lg:block). Necessario para a pagina publica /data-deletion, cujo
switcher precisa preservar o ?code=.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 8: Página pública `/data-deletion` + `Referrer-Policy` dedicado

**Files:**
- Create: `src/app/(public)/data-deletion/page.tsx`
- Modify: `next.config.ts` (entrada de headers depois do bloco `/(.*)`)
- Test: `test/app/(public)/data-deletion-page.test.tsx`

**Interfaces:**
- Consumes: `LegalShell` (Task 7), `getSupabaseServiceClient`, `headers()`, `ops_alert_claim` RPC.
- Produces: a página que o `url` devolvido pela Task 6 aponta (`/data-deletion?code=<32 hex>`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/app/(public)/data-deletion-page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { createHash } from 'node:crypto'

vi.mock('next/link', () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...p}>{children}</a>,
}))
vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { headers } from 'next/headers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import DataDeletionPage, { metadata } from '@/app/(public)/data-deletion/page'

const CODE = 'a'.repeat(32)
const rpc = vi.fn()
const selectSpy = vi.fn()

function mockDb(row: { requested_at: string; completed_at: string | null } | null) {
  rpc.mockReset(); selectSpy.mockReset()
  rpc.mockResolvedValue({ data: true, error: null })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({
    rpc,
    from: vi.fn(() => ({
      select: vi.fn((cols: string) => {
        selectSpy(cols)
        return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })) }
      }),
    })),
  } as never)
}

function setHeaders(h: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(h) as never)
}

async function renderPage(params: Record<string, string>) {
  const el = await DataDeletionPage({ searchParams: Promise.resolve(params) })
  return render(el)
}

describe('/data-deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    setHeaders({ 'accept-language': 'en-US,en;q=0.9', 'x-forwarded-for': '203.0.113.7' })
    mockDb({ requested_at: '2026-09-06T10:00:00Z', completed_at: '2026-09-06T10:00:30Z' })
  })

  it('is noindex and out of the sitemap enumerator', async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    const { enumerateSiteRoutes } = await import('@/lib/seo/enumerator')
    expect(String(enumerateSiteRoutes)).not.toContain('/data-deletion')
  })

  it('renders both dates and the exact English sentence for a completed request', async () => {
    const { container } = await renderPage({ code: CODE })
    const text = container.textContent ?? ''
    expect(text).toContain('Request received on')
    expect(text).toContain('were deleted on')
    expect(text).toContain('If the site held no data for that account, nothing was stored to delete.')
    expect(text).toContain('The account handle configured in the CMS is kept as site configuration and is not personal data of the requester.')
    expect(text).toContain('A record of this request (account identifier and date) is retained for up to 180 days as proof of processing.')
    expect(selectSpy).toHaveBeenCalledWith('requested_at, completed_at')
  })

  it('says "in progress" — never a date — while completed_at is null', async () => {
    mockDb({ requested_at: '2026-09-06T10:00:00Z', completed_at: null })
    const { container } = await renderPage({ code: CODE })
    const text = container.textContent ?? ''
    expect(text).toContain('Deletion is in progress — this page will show the completion date once it finishes. Please check back in a few minutes.')
    expect(text).not.toContain('were deleted on')
  })

  it('renders the pt-BR text when asked by ?lang and by Accept-Language', async () => {
    const byParam = await renderPage({ code: CODE, lang: 'pt-BR' })
    expect(byParam.container.textContent).toContain('Pedido recebido em')

    setHeaders({ 'accept-language': 'pt-BR,pt;q=0.9' })
    const byHeader = await renderPage({ code: CODE })
    expect(byHeader.container.textContent).toContain('Pedido recebido em')
  })

  it('keeps ?code= when switching languages and shows no related documents', async () => {
    const { getByTestId, queryByTestId } = await renderPage({ code: CODE })
    expect(getByTestId('legal-shell-locale-other-pt-BR').getAttribute('href')).toBe(`?code=${CODE}&lang=pt-BR`)
    expect(queryByTestId('legal-shell-toc')).toBeNull()
  })

  it('answers generically WITHOUT touching the database for a malformed code', async () => {
    const { container } = await renderPage({ code: 'not-a-code' })
    expect(selectSpy).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(container.textContent).toContain('If the site held no data for that account, nothing was stored to delete.')
    expect(container.textContent).not.toContain('Request received on')
  })

  it('answers generically for an unknown code', async () => {
    mockDb(null)
    const { container } = await renderPage({ code: 'b'.repeat(32) })
    expect(container.textContent).not.toContain('Request received on')
  })

  it('salts the rate-limit key with CRON_SECRET, per IP and per UTC day', async () => {
    await renderPage({ code: CODE })
    const key = (rpc.mock.calls[0]?.[1] as { p_key: string }).p_key
    const day = new Date().toISOString().slice(0, 10)
    const salted = createHash('sha256').update(`cron-secret|203.0.113.7|${day}`).digest('hex')
    const unsalted = createHash('sha256').update(`203.0.113.7|${day}`).digest('hex')
    expect(key).toBe(`ddpage:${salted}`)
    expect(key).not.toContain(unsalted)
    expect((rpc.mock.calls[0]?.[1] as { p_min_interval: string }).p_min_interval).toBe('2 seconds')

    setHeaders({ 'x-forwarded-for': '198.51.100.9' })
    await renderPage({ code: CODE })
    expect((rpc.mock.calls[1]?.[1] as { p_key: string }).p_key).not.toBe(key)
  })

  it('answers generically when the rate limit denies, and fails open when the claim throws', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const denied = await renderPage({ code: CODE })
    expect(denied.container.textContent).not.toContain('Request received on')
    expect(selectSpy).not.toHaveBeenCalled()

    mockDb({ requested_at: '2026-09-06T10:00:00Z', completed_at: '2026-09-06T10:00:30Z' })
    rpc.mockRejectedValue(new Error('rpc down'))
    const open = await renderPage({ code: CODE })
    expect(open.container.textContent).toContain('Request received on')
  })

  it('skips the claim entirely (and still serves the page) without CRON_SECRET', async () => {
    delete process.env.CRON_SECRET
    const { container } = await renderPage({ code: CODE })
    expect(rpc).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Request received on')
  })
})
```

Acrescentar ao teste de `next.config.ts` — criar o arquivo `test/app/(public)/data-deletion-page.test.tsx` já cobre a página; a entrada de headers é asserida aqui mesmo, no mesmo arquivo:

```tsx
describe('next.config.ts — /data-deletion headers', () => {
  it('declares a dedicated Referrer-Policy: no-referrer entry after the global block', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../../../next.config.ts', import.meta.url), 'utf8')
    const globalIdx = src.indexOf("source: '/(.*)'")
    const entryIdx = src.indexOf("source: '/data-deletion'")
    expect(entryIdx).toBeGreaterThan(globalIdx)
    const entry = src.slice(entryIdx, entryIdx + 320)
    expect(entry).toContain('no-referrer')
    expect(entry).toContain('Referrer-Policy')
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run "test/app/(public)/data-deletion-page.test.tsx"`
Expected: FAIL — módulo `@/app/(public)/data-deletion/page` inexistente.

- [ ] **Step 3: Implementar a página**

Criar `src/app/(public)/data-deletion/page.tsx`:

```tsx
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { LegalShell } from '@/components/legal/legal-shell'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Data deletion request',
  robots: { index: false, follow: false },
}

const CODE_RE = /^[0-9a-f]{32}$/

interface Props {
  searchParams: Promise<{ code?: string; lang?: string }>
}

const COPY = {
  en: {
    heading: 'Data deletion request',
    received: (d: string) => `Request received on ${d}.`,
    deleted: (d: string) =>
      `Any Instagram access token, cached posts and cached images that this site held for the account identified in the request were deleted on ${d}.`,
    inProgress:
      'Deletion is in progress — this page will show the completion date once it finishes. Please check back in a few minutes.',
    none: 'If the site held no data for that account, nothing was stored to delete.',
    handle:
      'The account handle configured in the CMS is kept as site configuration and is not personal data of the requester.',
    retention:
      'A record of this request (account identifier and date) is retained for up to 180 days as proof of processing.',
  },
  'pt-BR': {
    heading: 'Pedido de exclusão de dados',
    received: (d: string) => `Pedido recebido em ${d}.`,
    deleted: (d: string) =>
      `Todo token de acesso do Instagram, posts em cache e imagens em cache que este site mantinha para a conta identificada no pedido foram excluídos em ${d}.`,
    inProgress:
      'A exclusão está em andamento — esta página mostrará a data de conclusão assim que terminar. Volte em alguns minutos.',
    none: 'Se o site não mantinha dados dessa conta, não havia nada armazenado para excluir.',
    handle:
      'O nome de usuário configurado no CMS é mantido como configuração do site e não é dado pessoal do solicitante.',
    retention:
      'Um registro deste pedido (identificador da conta e data) é mantido por até 180 dias como prova do tratamento.',
  },
} as const

function pickLocale(lang: string | undefined, acceptLanguage: string | null, fallback: string): 'pt-BR' | 'en' {
  if (lang === 'pt-BR' || lang === 'en') return lang
  const accept = (acceptLanguage ?? '').toLowerCase()
  if (accept.startsWith('pt')) return 'pt-BR'
  if (accept.startsWith('en')) return 'en'
  return fallback.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? '').trim() || (h.get('x-real-ip') ?? 'unknown')
}

function formatDate(iso: string, locale: 'pt-BR' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(iso))
}

export default async function DataDeletionPage({ searchParams }: Props) {
  const params = await searchParams
  const h = await headers()
  const locale = pickLocale(params.lang, h.get('accept-language'), h.get('x-default-locale') ?? 'en')
  const t = COPY[locale]
  const code = params.code ?? ''

  let row: { requested_at: string; completed_at: string | null } | null = null

  // `code` MUST casar a forma ANTES de qualquer query. Rate limit por (IP × dia
  // UTC) salgado com CRON_SECRET: `sha256(ip + dia)` puro é reversível em
  // segundos sobre ~4·10⁹ IPv4, e cada linha seria dado pessoal pseudonimizado
  // de alguém exercendo um direito LGPD.
  if (CODE_RE.test(code)) {
    const supabase = getSupabaseServiceClient()
    const salt = process.env.CRON_SECRET
    let allowed = true
    if (salt) {
      try {
        const day = new Date().toISOString().slice(0, 10)
        const digest = createHash('sha256').update(`${salt}|${clientIp(h)}|${day}`).digest('hex')
        const { data } = await supabase.rpc('ops_alert_claim', {
          p_key: `ddpage:${digest}`,
          p_min_interval: '2 seconds',
        })
        allowed = data === true
      } catch {
        allowed = true                                   // fail-open, deliberado
      }
    }
    if (allowed) {
      const { data } = await supabase
        .from('instagram_deletion_requests')
        .select('requested_at, completed_at')
        .eq('confirmation_code', code)
        .maybeSingle()
      row = data ?? null
    }
  }

  return (
    <LegalShell
      locale={locale}
      lastUpdated={new Date().toISOString().slice(0, 10)}
      relatedDocs={[]}
      localeSwitcherHref={(other) => `?code=${encodeURIComponent(code)}&lang=${other}`}
    >
      <h1>{t.heading}</h1>
      {row && <p>{t.received(formatDate(row.requested_at, locale))}</p>}
      {row && (
        <p>{row.completed_at ? t.deleted(formatDate(row.completed_at, locale)) : t.inProgress}</p>
      )}
      <p>{t.none}</p>
      <p>{t.handle}</p>
      <p>{t.retention}</p>
    </LegalShell>
  )
}
```

- [ ] **Step 4: Acrescentar a entrada de headers em `next.config.ts`**

Logo **depois** do bloco `{ source: '/(.*)', headers: [...] }` (o que traz HSTS/X-Content-Type-Options/Referrer-Policy/Permissions-Policy), inserir:

```ts
      // A página pública de status de exclusão de dados carrega o
      // `confirmation_code` na query. `strict-origin-when-cross-origin` (bloco
      // acima) enviaria a origem a terceiros; aqui nada sai.
      {
        source: '/data-deletion',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
```

- [ ] **Step 5: Rodar e conferir que passa**

Run: `cd apps/web && npx vitest run "test/app/(public)/data-deletion-page.test.tsx" test/app/sitemap.test.ts test/app/robots.test.ts`
Expected: PASS. `lib/seo/enumerator.ts` continua com a lista fechada de 10 rotas — `/data-deletion` **não** entra.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/(public)/data-deletion/page.tsx" apps/web/next.config.ts \
        "apps/web/test/app/(public)/data-deletion-page.test.tsx"
git commit -m "$(cat <<'EOF'
feat(instagram): pagina publica de status do pedido de exclusao

code validado por ^[0-9a-f]{32}$ antes de qualquer query; rate limit por
(IP x dia UTC) salgado com CRON_SECRET, fail-open e ausente sem CRON_SECRET;
projecao so de requested_at/completed_at; texto bilingue com "in progress"
enquanto completed_at for null (nunca renderiza requested_at no lugar da
conclusao); noindex, fora do sitemap e Referrer-Policy: no-referrer dedicado.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 9: `locale-rules.ts` + server actions (`disconnect`, `rebind`, `dismiss`) + guardas de locale

**Files:**
- Create: `src/lib/instagram/locale-rules.ts`
- Modify: `src/app/cms/(authed)/settings/actions.ts`
- Test: `test/instagram/locale-rules.test.ts`
- Test: `test/instagram/actions.test.ts` (parte C3)

**Interfaces:**
- Consumes: `requireEditAccess()` (C2 → `{ siteId, userId }`), `deriveHmacKey`/`signState`/`verifyState`, `oauthErrorText`, `cookies()`.
- Produces:
  ```ts
  // src/lib/instagram/locale-rules.ts  (isomórfico: servidor E cliente)
  export type InstagramLocale = 'all' | 'pt' | 'en'
  export const LOCALE_CONFLICT_ERROR: string
  export function allowedLocales(taken: readonly string[], own?: string): InstagramLocale[]

  // src/app/cms/(authed)/settings/actions.ts
  export async function disconnectInstagramAccount(input: { accountId: string }): Promise<ActionResult>
  export async function authorizeInstagramRebind(input: { accountId: string }):
    Promise<{ ok: true; rebind: string } | { ok: false; error: string }>
  export async function dismissInstagramHandleMismatch(): Promise<ActionResult>
  ```
  As Tasks 12–14 chamam as três a partir do card.

- [ ] **Step 1: Escrever os testes que falham**

Criar `test/instagram/locale-rules.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { allowedLocales } from '@/lib/instagram/locale-rules'

describe('allowedLocales', () => {
  it('offers every locale when nothing is taken', () => {
    expect(allowedLocales([])).toEqual(['all', 'pt', 'en'])
  })

  it('drops "all" once pt or en exists', () => {
    expect(allowedLocales(['pt'])).toEqual(['en'])
    expect(allowedLocales(['en'])).toEqual(['pt'])
  })

  it('offers nothing else once "all" exists', () => {
    expect(allowedLocales(['all'])).toEqual([])
  })

  it('always keeps the row own locale selectable', () => {
    expect(allowedLocales(['pt', 'en'], 'pt')).toEqual(['pt'])
    expect(allowedLocales(['all', 'pt'], 'pt')).toEqual(['pt'])
    expect(allowedLocales(['pt'], 'pt')).toEqual(['all', 'pt', 'en'])
  })
})
```

Acrescentar ao fim de `test/instagram/actions.test.ts` (e ajustar o `vi.mock` de `@tn-figueiredo/auth-nextjs/server` para a forma de C2, `{ ok: true, user: { id: 'u1' } }`, se ainda não estiver):

```ts
const cookieGet = vi.fn()
const cookieDelete = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet, set: vi.fn(), delete: cookieDelete })),
  headers: vi.fn(async () => new Headers()),
}))

import { deriveHmacKey, signState, verifyState } from '@/lib/oauth/state'
import { revalidateTag } from 'next/cache'

const MASTER = 'c'.repeat(64)
const ACC = '00000000-0000-4000-8000-000000000001'

describe('Instagram server actions — C3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    process.env.SOCIAL_MASTER_KEY = MASTER
    cookieGet.mockReturnValue(undefined)
  })

  it('disconnectInstagramAccount clears the token and the whole episode, keeps posts, revalidates', async () => {
    const updatePatch = vi.fn()
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((t: string) => t === 'instagram_sync_log'
        ? { insert }
        : {
            update: (patch: Record<string, unknown>) => {
              updatePatch(patch)
              return { eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ id: ACC }], error: null }) })) })) }
            },
          }),
    } as never)
    const { disconnectInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const res = await disconnectInstagramAccount({ accountId: ACC })
    expect(res.ok).toBe(true)
    const patch = updatePatch.mock.calls[0]?.[0] as Record<string, unknown>
    expect(patch.access_token).toBeNull()
    expect(patch.token_expires_at).toBeNull()
    expect(patch.token_error).toBeNull()
    expect(patch.token_error_at).toBeNull()
    expect(patch.token_error_mode).toBeNull()
    expect(patch.token_alert_sent_at).toBeNull()
    expect(patch.token_alert_attempt_at).toBeNull()
    expect(patch.token_reprobe_at).toBeNull()
    expect(patch).not.toHaveProperty('handle')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'manual', status: 'completed', error_message: 'detail: disconnected by owner',
    }))
    expect(revalidateTag).toHaveBeenCalledWith('instagram-feed', { expire: 0 })
  })

  it('authorizeInstagramRebind refuses without a cookie and with mismatching ids', async () => {
    const { authorizeInstagramRebind } = await import('@/app/cms/(authed)/settings/actions')
    expect((await authorizeInstagramRebind({ accountId: ACC })).ok).toBe(false)

    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    cookieGet.mockReturnValue({ value: signState({
      typ: 'mismatch', siteId: 'another-site', userId: 'u1', accountId: ACC,
      authorizedIgUserId: '178414', authorizedHandle: 'x',
      exp: Math.floor(Date.now() / 1000) + 600,
    }, key) })
    expect((await authorizeInstagramRebind({ accountId: ACC })).ok).toBe(false)
  })

  it('authorizeInstagramRebind refuses an expired mismatch cookie and emits no rebind', async () => {
    const now = Date.parse('2026-09-06T12:00:00Z')
    vi.useFakeTimers({ now: now - 11 * 60_000, toFake: ['Date'] })
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    cookieGet.mockReturnValue({ value: signState({
      typ: 'mismatch', siteId: 'site-1', userId: 'u1', accountId: ACC,
      authorizedIgUserId: '178414', authorizedHandle: 'x',
      exp: Math.floor((now - 11 * 60_000) / 1000) + 600,
    }, key) })
    vi.setSystemTime(now)
    const { authorizeInstagramRebind } = await import('@/app/cms/(authed)/settings/actions')
    const res = await authorizeInstagramRebind({ accountId: ACC })
    expect(res.ok).toBe(false)
    expect(res).not.toHaveProperty('rebind')
    vi.useRealTimers()
  })

  it('authorizeInstagramRebind emits a 5-min rebind from the verified cookie and deletes it with the same Path', async () => {
    const key = deriveHmacKey(MASTER, 'instagram-oauth-state-hmac')
    cookieGet.mockReturnValue({ value: signState({
      typ: 'mismatch', siteId: 'site-1', userId: 'u1', accountId: ACC,
      authorizedIgUserId: '17841400000000000', authorizedHandle: 'thiago.figueiredo',
      exp: Math.floor(Date.now() / 1000) + 600,
    }, key) })
    const { authorizeInstagramRebind } = await import('@/app/cms/(authed)/settings/actions')
    const res = await authorizeInstagramRebind({ accountId: ACC })
    expect(res.ok).toBe(true)
    if (res.ok) {
      const p = verifyState(res.rebind, key, { typ: 'rebind', requireExp: true })
      expect(p?.allowRebindTo).toBe('17841400000000000')
      expect((p?.exp ?? 0) * 1000).toBeLessThanOrEqual(Date.now() + 300_000)
    }
    expect(cookieDelete).toHaveBeenCalledWith({ name: '__Secure-ig_handle_mismatch', path: '/cms/settings' })
    expect(mockGetClient).not.toHaveBeenCalled()      // não escreve em instagram_accounts
  })

  it('dismissInstagramHandleMismatch deletes the cookie with the same Path', async () => {
    const { dismissInstagramHandleMismatch } = await import('@/app/cms/(authed)/settings/actions')
    expect((await dismissInstagramHandleMismatch()).ok).toBe(true)
    expect(cookieDelete).toHaveBeenCalledWith({ name: '__Secure-ig_handle_mismatch', path: '/cms/settings' })
    expect(cookieDelete).toHaveBeenCalledWith({ name: 'ig_handle_mismatch', path: '/cms/settings' })
  })

  it('rejects locale combinations that would let "all" shadow pt/en', async () => {
    const siblings = (rows: { id: string; locale: string }[]) => {
      mockGetClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: rows, error: null }) })),
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null }) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [{ id: ACC }], error: null }) })) })) })),
        })),
      } as never)
    }
    const { addInstagramAccount, updateInstagramSettings } =
      await import('@/app/cms/(authed)/settings/actions')

    siblings([{ id: 'other', locale: 'pt' }])
    expect((await addInstagramAccount({ handle: '@x', locale: 'all' })).ok).toBe(false)
    expect((await updateInstagramSettings({ accountId: ACC, locale: 'all' })).ok).toBe(false)

    siblings([{ id: 'other', locale: 'all' }])
    expect((await addInstagramAccount({ handle: '@x', locale: 'pt' })).ok).toBe(false)
    expect((await updateInstagramSettings({ accountId: ACC, locale: 'pt' })).ok).toBe(false)

    siblings([{ id: ACC, locale: 'all' }])
    expect((await updateInstagramSettings({ accountId: ACC, locale: 'all' })).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/instagram/locale-rules.test.ts test/instagram/actions.test.ts`
Expected: FAIL — `@/lib/instagram/locale-rules` inexistente; `disconnectInstagramAccount` não exportado.

- [ ] **Step 3: Implementar `src/lib/instagram/locale-rules.ts`**

```ts
export type InstagramLocale = 'all' | 'pt' | 'en'

/**
 * `UNIQUE (site_id, locale)` permite `pt` + `all` na mesma coluna, e
 * `src/lib/instagram/queries.ts:17-19` faria a linha `all` sombrear a `pt`.
 * A defesa é impedir a combinação — servidor e cliente usam ESTA função.
 */
export const LOCALE_CONFLICT_ERROR =
  'Locale conflict — an "All (PT + EN)" account cannot coexist with a PT-BR or EN account'

export function allowedLocales(taken: readonly string[], own?: string): InstagramLocale[] {
  const others = new Set(taken.filter((l) => l !== own))
  const keepOwn = (list: InstagramLocale[]): InstagramLocale[] => {
    if (own && (own === 'all' || own === 'pt' || own === 'en') && !list.includes(own)) {
      return [own, ...list]
    }
    return list
  }
  if (others.has('all')) return keepOwn([])
  const free = (['all', 'pt', 'en'] as const).filter((l) => !others.has(l))
  return keepOwn(free.filter((l) => l !== 'all' || (!others.has('pt') && !others.has('en'))))
}
```

- [ ] **Step 4: Implementar as três actions e as guardas em `actions.ts`**

Acrescentar aos imports do topo de `src/app/cms/(authed)/settings/actions.ts`:

```ts
import { cookies } from 'next/headers'
import { INSTAGRAM_STATE_LABEL, deriveHmacKey, signState, verifyState } from '@/lib/oauth/state'
import { oauthErrorText } from '@/lib/instagram/status-text'
import { allowedLocales, LOCALE_CONFLICT_ERROR } from '@/lib/instagram/locale-rules'
```

Em `addInstagramAccount`, depois de `const supabase = getSupabaseServiceClient()` e **antes** do `insert`:

```ts
  const { data: siblings } = await supabase
    .from('instagram_accounts')
    .select('id, locale')
    .eq('site_id', siteId)
  const taken = (siblings ?? []).map((r) => r.locale)
  if (!allowedLocales(taken).includes(parsed.data.locale)) {
    return { ok: false, error: LOCALE_CONFLICT_ERROR }
  }
```

Em `updateInstagramSettings`, depois de `const { accountId, ...updates } = parsed.data` e **antes** do `update`:

```ts
  if (parsed.data.locale) {
    const { data: siblings } = await supabase
      .from('instagram_accounts')
      .select('id, locale')
      .eq('site_id', siteId)
    const taken = (siblings ?? []).filter((r) => r.id !== accountId).map((r) => r.locale)
    if (!allowedLocales(taken, parsed.data.locale).includes(parsed.data.locale)) {
      return { ok: false, error: LOCALE_CONFLICT_ERROR }
    }
  }
```

(`updateInstagramSettings` passa a usar `const { siteId } = await requireEditAccess()` — em C2 a chamada já devolve o objeto; se ainda estiver como `await requireEditAccess()` sem destruturação, trocar aqui.)

Acrescentar ao fim da seção Instagram do arquivo:

```ts
/**
 * Corta a ligação sem apagar conteúdo: token fora, episódio zerado, posts e
 * slots preservados. A Meta não oferece revogação pelo servidor, então o app
 * continua autorizado lá (o texto do `confirm` diz isso ao dono).
 */
export async function disconnectInstagramAccount(input: {
  accountId: string
}): Promise<ActionResult> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('instagram_accounts')
    .update({
      access_token: null,
      token_expires_at: null,
      token_error: null,
      token_error_at: null,
      token_error_mode: null,
      token_alert_sent_at: null,
      token_alert_attempt_at: null,
      token_reprobe_at: null,
      updated_at: nowIso,
    })
    .eq('id', parsed.data.accountId)
    .eq('site_id', siteId)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'Account not found' }

  await supabase.from('instagram_sync_log').insert({
    site_id: siteId,
    account_id: parsed.data.accountId,
    mode: 'manual',
    status: 'completed',
    posts_found: 0,
    posts_inserted: 0,
    posts_updated: 0,
    media_cached: 0,
    error_message: 'detail: disconnected by owner',
    started_at: nowIso,
    completed_at: nowIso,
  })

  revalidatePath('/cms/settings')
  revalidateTag('instagram-feed', { expire: 0 })
  return { ok: true }
}

/**
 * Converte o cookie de mismatch (assinado pelo callback) num `rebind` de 5 min.
 * `allowRebindTo` vem SÓ do cookie verificado — nunca do cliente —, e a action
 * não escreve nada em `instagram_accounts`.
 */
export async function authorizeInstagramRebind(input: {
  accountId: string
}): Promise<{ ok: true; rebind: string } | { ok: false; error: string }> {
  const parsed = z.object({ accountId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
  const { siteId, userId } = await requireEditAccess()

  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey) return { ok: false, error: oauthErrorText('vault_unavailable') }

  const jar = await cookies()
  const raw =
    jar.get('__Secure-ig_handle_mismatch')?.value ?? jar.get('ig_handle_mismatch')?.value ?? null
  const expired = { ok: false as const, error: oauthErrorText('invalid_state') }
  if (!raw) return expired

  const key = deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL)
  const p = verifyState(raw, key, { typ: 'mismatch', requireExp: true })
  if (
    !p || p.siteId !== siteId || p.userId !== userId ||
    p.accountId !== parsed.data.accountId || !p.authorizedIgUserId
  ) {
    return expired
  }

  const rebind = signState({
    typ: 'rebind',
    siteId,
    userId,
    accountId: parsed.data.accountId,
    allowRebindTo: p.authorizedIgUserId,
    exp: Math.floor(Date.now() / 1000) + 300,
  }, key)

  // MUST: o mesmo `Path` do `Set-Cookie` — `delete(name)` assume `path:'/'` e
  // não limparia um cookie de `Path=/cms/settings`.
  jar.delete({ name: '__Secure-ig_handle_mismatch', path: '/cms/settings' })
  jar.delete({ name: 'ig_handle_mismatch', path: '/cms/settings' })
  return { ok: true, rebind }
}

/** "Cancel" do banner de mismatch: só apaga o cookie (mesmo `Path`). */
export async function dismissInstagramHandleMismatch(): Promise<ActionResult> {
  await requireEditAccess()
  const jar = await cookies()
  jar.delete({ name: '__Secure-ig_handle_mismatch', path: '/cms/settings' })
  jar.delete({ name: 'ig_handle_mismatch', path: '/cms/settings' })
  return { ok: true }
}
```

- [ ] **Step 5: Rodar e conferir que passa**

Run: `cd apps/web && npx vitest run test/instagram/locale-rules.test.ts test/instagram/actions.test.ts test/cms/settings-actions.test.ts test/app/contact-settings-actions.test.ts test/unit/use-server-exports.test.ts`
Expected: PASS — inclusive o ratchet de `'use server'` (as três actions são `export async function`).

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/lib/instagram/locale-rules.ts \
        "apps/web/src/app/cms/(authed)/settings/actions.ts" \
        apps/web/test/instagram/locale-rules.test.ts apps/web/test/instagram/actions.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): disconnect, rebind, dismiss e guardas de locale

disconnectInstagramAccount zera token + CAMPOS_DE_EPISODIO + token_reprobe_at
preservando posts/slots/textos e invalida o feed; authorizeInstagramRebind
converte o cookie de mismatch verificado num rebind de 5 min sem escrever no
banco; dismiss apaga o cookie. Os dois apagam com { name, path:'/cms/settings' }.
add/updateInstagramSettings recusam 'all' com pt/en existente e vice-versa.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 10: `settings/page.tsx` — dados, props e o ratchet anti-vazamento

**Files:**
- Modify: `src/app/cms/(authed)/settings/page.tsx`
- Modify: `src/app/cms/(authed)/settings/settings-connected.tsx`
- Modify: `src/app/cms/(authed)/settings/_sections/instagram.tsx` (só a interface de props)
- Test: `test/cms/settings/page-no-token-leak.test.ts`

**Interfaces:**
- Consumes: `getVaultKeyOrNull` (C2), `deriveHmacKey`/`verifyState` (B).
- Produces, para as Tasks 12–14:
  ```ts
  interface InstagramAccountData {
    // campos já existentes: id, locale, handle, sync_enabled, display_slots, layout_type,
    // section_title_pt, section_title_en, section_subtitle_pt, section_subtitle_en,
    // last_synced_at, token_expires_at, posts, sync_logs, slots
    // + os 8 campos novos:
    token_error: string | null
    token_error_at: string | null
    token_error_mode: 'daily' | 'token_refresh' | null
    token_refreshed_at: string | null
    token_alert_sent_at: string | null
    ig_user_id: string | null
    ig_user_id_source: 'oauth' | 'legacy'
    connected: boolean
  }
  interface InstagramSectionProps {
    accounts: InstagramAccountData[]
    readOnly: boolean
    oauthConfigured?: boolean
    isPreview?: boolean
    missingInstagramEnv?: string[]
    handleMismatch?: { accountId: string; authorizedHandle: string } | null
    siteTimezone?: string
  }
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/cms/settings/page-no-token-leak.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/settings/page.tsx'), 'utf8')

describe('settings/page.tsx — the access token never reaches the client', () => {
  it('never projects access_token nor * from instagram_accounts', () => {
    const projections = [...src.matchAll(/instagram_accounts'\)\s*\n?\s*\.select\((['"`])([\s\S]*?)\1/g)]
      .map((m) => m[2] ?? '')
    expect(projections.length).toBeGreaterThan(0)
    for (const p of projections) {
      expect(p).not.toContain('access_token')
      expect(p.trim()).not.toBe('*')
    }
  })

  it('derives `connected` from a dedicated query instead of shipping the token', () => {
    expect(src).toContain(".not('access_token', 'is', null)")
    expect(src).toContain('connectedIds')
  })

  it('projects the seven health columns the card needs', () => {
    for (const col of [
      'token_error', 'token_error_at', 'token_error_mode', 'token_refreshed_at',
      'token_alert_sent_at', 'ig_user_id', 'ig_user_id_source',
    ]) {
      expect(src).toContain(col)
    }
  })

  it('passes the OAuth props down to the section', () => {
    expect(src).toContain('instagramOAuthConfigured')
    expect(src).toContain('isPreview')
    expect(src).toContain('instagramHandleMismatch')
    expect(src).toContain('siteTimezone')
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/cms/settings/page-no-token-leak.test.ts`
Expected: FAIL — `connectedIds` ausente.

- [ ] **Step 3: Implementar `page.tsx`**

Em `src/app/cms/(authed)/settings/page.tsx`:

1. Acrescentar aos imports:

```ts
import { cookies } from 'next/headers'
import { INSTAGRAM_STATE_LABEL, deriveHmacKey, verifyState } from '@/lib/oauth/state'
import { getVaultKeyOrNull } from '@/lib/instagram/token'
```

2. Guardar o `user.id` (a chamada já existe):

```ts
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')
  const userId = authRes.user.id
```

3. Trocar a projeção do bloco `instagram_accounts` do `Promise.all` por:

```ts
    supabase.from('instagram_accounts')
      .select('id, locale, handle, sync_enabled, display_slots, layout_type, section_title_pt, section_title_en, section_subtitle_pt, section_subtitle_en, last_synced_at, token_expires_at, token_error, token_error_at, token_error_mode, token_refreshed_at, token_alert_sent_at, ig_user_id, ig_user_id_source')
      .eq('site_id', siteId)
      .order('locale'),
```

4. Logo **depois** do `Promise.all` (antes do `const instagramData = …`), acrescentar:

```ts
  // `connected` por linha sem trazer o token para o cliente: uma segunda query
  // cita `access_token` num filtro, nunca numa projeção (ratchet em
  // test/cms/settings/page-no-token-leak.test.ts).
  const { data: connectedRows } = await supabase
    .from('instagram_accounts')
    .select('id')
    .eq('site_id', siteId)
    .not('access_token', 'is', null)
  const connectedIds = new Set((connectedRows ?? []).map((r) => r.id))
```

5. No `map` que monta `instagramData`, acrescentar `connected` ao objeto devolvido:

```ts
      return {
        ...acc,
        connected: connectedIds.has(acc.id),
        posts,
        sync_logs: logsRes.data ?? [],
        slots: rawSlots.map(s => ({
          ...s,
          thumbnail_url: s.post_id ? postMap.get(s.post_id)?.cached_image_url ?? null : null,
          caption: s.post_id ? postMap.get(s.post_id)?.caption ?? null : null,
        })),
      }
```

6. Antes do `return`, calcular as props de OAuth:

```ts
  const missingInstagramEnv = (['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'] as const)
    .filter((k) => !process.env[k])
  if (getVaultKeyOrNull() === null) missingInstagramEnv.push('SOCIAL_MASTER_KEY' as never)
  const instagramOAuthConfigured = missingInstagramEnv.length === 0
  const isPreview = process.env.VERCEL_ENV === 'preview'

  // Banner de mismatch: só quando o cookie assinado casa site, usuário E linha.
  let instagramHandleMismatch: { accountId: string; authorizedHandle: string } | null = null
  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (masterKey) {
    const jar = await cookies()
    const rawMismatch =
      jar.get('__Secure-ig_handle_mismatch')?.value ?? jar.get('ig_handle_mismatch')?.value ?? null
    if (rawMismatch) {
      const p = verifyState(rawMismatch, deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL), {
        typ: 'mismatch', requireExp: true,
      })
      if (p?.siteId === siteId && p.userId === userId && p.accountId && p.authorizedHandle) {
        instagramHandleMismatch = { accountId: p.accountId, authorizedHandle: p.authorizedHandle }
      }
    }
  }
```

7. Passar as props novas ao `<SettingsConnected>`:

```tsx
        instagramAccounts={instagramData}
        instagramOAuthConfigured={instagramOAuthConfigured}
        missingInstagramEnv={missingInstagramEnv}
        isPreview={isPreview}
        instagramHandleMismatch={instagramHandleMismatch}
        siteTimezone={timezone}
```

e trocar a desestruturação do contexto por `const { siteId, timezone } = await getSiteContext()`.

- [ ] **Step 4: Implementar `settings-connected.tsx`**

1. Estender `InstagramAccountData` (linhas 89-105) com os 8 campos novos:

```ts
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_refreshed_at: string | null
  token_alert_sent_at: string | null
  ig_user_id: string | null
  ig_user_id_source: 'oauth' | 'legacy'
  connected: boolean
```

2. Estender `Props`:

```ts
  instagramOAuthConfigured?: boolean
  missingInstagramEnv?: string[]
  isPreview?: boolean
  instagramHandleMismatch?: { accountId: string; authorizedHandle: string } | null
  siteTimezone?: string
```

3. Desestruturar no componente (ao lado de `instagramAccounts`):

```ts
  instagramOAuthConfigured = false,
  missingInstagramEnv = [],
  isPreview = false,
  instagramHandleMismatch = null,
  siteTimezone = 'America/Sao_Paulo',
```

4. Passar ao `<InstagramSection>`:

```tsx
            <InstagramSection
              accounts={instagramAccounts ?? []}
              readOnly={readOnly}
              oauthConfigured={instagramOAuthConfigured}
              missingInstagramEnv={missingInstagramEnv}
              isPreview={isPreview}
              handleMismatch={instagramHandleMismatch}
              siteTimezone={siteTimezone}
            />
```

- [ ] **Step 5: Estender a interface de props da seção (sem consumir ainda)**

Em `src/app/cms/(authed)/settings/_sections/instagram.tsx`, acrescentar os 8 campos novos a `InstagramAccountData` (mesma forma do passo 4.1) e trocar a assinatura por:

```tsx
export interface InstagramSectionProps {
  accounts: InstagramAccountData[]
  readOnly: boolean
  oauthConfigured?: boolean
  missingInstagramEnv?: string[]
  isPreview?: boolean
  handleMismatch?: { accountId: string; authorizedHandle: string } | null
  siteTimezone?: string
}

export function InstagramSection({ accounts: initialAccounts, readOnly }: InstagramSectionProps) {
```

(As props extras são declaradas agora — o `settings-connected.tsx` já as passa — e passam a ser consumidas nas Tasks 12–14.)

- [ ] **Step 6: Rodar teste + typecheck**

Run: `cd apps/web && npx vitest run test/cms/settings/page-no-token-leak.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS + typecheck limpo.

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/page.tsx" \
        "apps/web/src/app/cms/(authed)/settings/settings-connected.tsx" \
        "apps/web/src/app/cms/(authed)/settings/_sections/instagram.tsx" \
        apps/web/test/cms/settings/page-no-token-leak.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): saude do token e props de OAuth no /cms/settings

page.tsx projeta as 7 colunas de saude, deriva connected por linha numa
segunda query que cita access_token so em filtro, e calcula
instagramOAuthConfigured/isPreview/handleMismatch/siteTimezone. Ratchet novo
falha se access_token ou '*' voltarem a aparecer numa projecao.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 11: `instagram-status.ts` — estado resolvido e textos do card (lógica pura)

**Files:**
- Create: `src/app/cms/(authed)/settings/_sections/instagram-status.ts`
- Test: `test/cms/instagram-status.test.ts`

**Interfaces:**
- Consumes: `kindFrom` (`@/lib/instagram/status-text`, isomórfico).
- Produces (consumido pelas Tasks 12–14):
  ```ts
  export type CardState = 'invalid' | 'never-connected' | 'expiring' | 'retrying' | 'renewal-pending' | 'connected'
  export interface InstagramCardAccount { /* subconjunto de InstagramAccountData */ }
  export const STALE_MS: number
  export const LONG_OPEN_MS: number
  export function daysUntilExpiry(iso: string | null, now: number): number | null
  export function expiresLabel(days: number): string
  export function formatDate(iso: string | null): string
  export function relativeTime(iso: string | null, now: number): string
  export function nextDailyCheckLabel(now: number, timeZone: string): string
  export function isHumanReason(reason: string): boolean
  export function hasFailedFirstSync(a: InstagramCardAccount): boolean
  export function hasOpenSyncRow(a: InstagramCardAccount): boolean
  export function resolveCardState(a: InstagramCardAccount, now: number): CardState
  export function cardText(a, state, now, opts: { siteTimezone: string; syncing: boolean }): { text: string; rawReason?: string }
  export function isStale(a: InstagramCardAccount, now: number, state: CardState): boolean
  export function reconnectIsPrimary(state: CardState, a: InstagramCardAccount, now: number): boolean
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/cms/instagram-status.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  cardText, daysUntilExpiry, expiresLabel, hasFailedFirstSync, hasOpenSyncRow,
  isHumanReason, isStale, nextDailyCheckLabel, reconnectIsPrimary, relativeTime,
  resolveCardState, type InstagramCardAccount,
} from '@/app/cms/(authed)/settings/_sections/instagram-status'

const NOW = Date.parse('2026-09-06T12:00:00Z')
const iso = (msFromNow: number) => new Date(NOW + msFromNow).toISOString()
const DAY = 86_400_000

function acc(over: Partial<InstagramCardAccount> = {}): InstagramCardAccount {
  return {
    handle: 'thiago.figueiredo',
    connected: true,
    sync_enabled: true,
    last_synced_at: iso(-3600_000),
    token_expires_at: iso(40 * DAY),
    token_error: null,
    token_error_at: null,
    token_error_mode: null,
    token_refreshed_at: iso(-2 * DAY),
    sync_logs: [],
    ...over,
  }
}

describe('resolveCardState — precedence', () => {
  it('Invalid wins over everything when token_error is set', () => {
    expect(resolveCardState(acc({ token_error: 'expired', connected: false, token_expires_at: null }), NOW)).toBe('invalid')
  })
  it('Invalid also covers an expired token with no episode yet', () => {
    expect(resolveCardState(acc({ token_expires_at: iso(-1000) }), NOW)).toBe('invalid')
  })
  it('Never connected comes next', () => {
    expect(resolveCardState(acc({ connected: false, token_expires_at: null }), NOW)).toBe('never-connected')
  })
  it('Expiring beats Retrying', () => {
    expect(resolveCardState(acc({ token_expires_at: iso(3 * DAY), token_error_at: iso(-4 * DAY) }), NOW)).toBe('expiring')
  })
  it('Retrying comes before Renewal pending', () => {
    expect(resolveCardState(acc({ token_expires_at: null, token_error_at: iso(-4 * DAY) }), NOW)).toBe('retrying')
  })
  it('Renewal pending when the expiry is unknown', () => {
    expect(resolveCardState(acc({ token_expires_at: null }), NOW)).toBe('renewal-pending')
  })
  it('Connected otherwise', () => {
    expect(resolveCardState(acc(), NOW)).toBe('connected')
  })
})

describe('expiresLabel / daysUntilExpiry', () => {
  it('renders 0, 1 and >= 2 days without "in 1 days"', () => {
    expect(expiresLabel(0)).toBe('Expires today')
    expect(expiresLabel(1)).toBe('Expires tomorrow')
    expect(expiresLabel(2)).toBe('Expires in 2 days')
    expect(expiresLabel(-3)).toBe('Expires today')
  })
  it('returns null for an absent or unparseable date instead of NaN', () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull()
    expect(daysUntilExpiry('not-a-date', NOW)).toBeNull()
  })
})

describe('nextDailyCheckLabel — the 11:00 UTC run in the site timezone', () => {
  it('says "today" before the run and "tomorrow" after it', () => {
    expect(nextDailyCheckLabel(Date.parse('2026-09-06T09:00:00Z'), 'America/Sao_Paulo')).toBe('08:00 today')
    expect(nextDailyCheckLabel(Date.parse('2026-09-06T19:00:00Z'), 'America/Sao_Paulo')).toBe('08:00 tomorrow')
  })
})

describe('relativeTime', () => {
  it('says never for null and never renders NaN or "in 1 days"', () => {
    expect(relativeTime(null, NOW)).toBe('never')
    expect(relativeTime('not-a-date', NOW)).toBe('never')
    expect(relativeTime(iso(-DAY), NOW)).toBe('1 day ago')
    expect(relativeTime(iso(-3 * DAY), NOW)).toBe('3 days ago')
    expect(relativeTime(iso(-3600_000), NOW)).toBe('1 hour ago')
  })
})

describe('cardText', () => {
  it('Invalid/transient points at the next daily check with a day word', () => {
    const a = acc({ token_expires_at: iso(-1000), token_error: null })
    expect(cardText(a, 'invalid', NOW, { siteTimezone: 'America/Sao_Paulo', syncing: false }).text)
      .toBe('Token expired — the daily check will confirm this by 08:00 tomorrow')
  })
  it('renders each known token_error reason in English', () => {
    const at = iso(-2 * DAY)
    const t = (reason: string) =>
      cardText(acc({ token_error: reason, token_error_at: at }), 'invalid', NOW,
        { siteTimezone: 'UTC', syncing: false }).text
    expect(t('expired')).toContain('Token expired (since ')
    expect(t('deauthorized')).toContain('Instagram access was revoked (since ')
    expect(t('data_deletion_requested')).toContain('A data-deletion request was received (since ')
    expect(t('data_deletion_requested')).toContain('— the cached feed was deleted')
    expect(t('decrypt_failed')).toBe("Stored token can't be read — reconnect")
    expect(t('The session has been invalidated because the user changed their password'))
      .toContain('Token invalid — The session has been invalidated')
  })
  it('hides machine strings behind the generic sentence and exposes them via rawReason', () => {
    const at = iso(-2 * DAY)
    for (const machine of ['Instagram API 403', 'fetch failed', 'TypeError: bad', 'permanent: nope']) {
      const r = cardText(acc({ token_error: machine, token_error_at: at }), 'invalid', NOW,
        { siteTimezone: 'UTC', syncing: false })
      expect(r.text).toContain('Token invalid (since ')
      expect(r.text).toContain('— reconnect')
      expect(r.text).not.toContain(machine)
      expect(r.rawReason).toBe(machine)
    }
  })
  it('Retrying names the subject and flips wording at 69 h', () => {
    const short = acc({ token_error_at: iso(-68 * 3600_000), token_error_mode: 'daily', token_expires_at: null })
    expect(cardText(short, 'retrying', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toContain('Feed sync has been failing since ')
    expect(cardText(short, 'retrying', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toContain('it keeps retrying daily')
    const long = acc({ token_error_at: iso(-70 * 3600_000), token_error_mode: 'token_refresh', token_expires_at: null })
    const text = cardText(long, 'retrying', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).toContain('Auto-renewal has been failing since ')
    expect(text).toContain("hasn't recovered — reconnect")
  })
  it('Expiring keeps the countdown and appends the open episode', () => {
    const a = acc({ token_expires_at: iso(3 * DAY), token_error_at: iso(-4 * DAY) })
    const text = cardText(a, 'expiring', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).toContain('Expires in 3 days')
    expect(text).toContain("auto-renewal hasn't succeeded (last successful renewal: 2 days ago)")
    expect(text).toContain(' (auto-renewal has been failing since ')
    expect(reconnectIsPrimary('expiring', a, NOW)).toBe(true)
  })
  it('Connected carries last renewal, expiry and last sync', () => {
    const text = cardText(acc(), 'connected', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).toBe('Connected · renews automatically · last renewal 2 days ago · Expires in 40 days · last sync 1 hour ago')
  })
  it('Syncing replaces ONLY the last-sync tail', () => {
    const text = cardText(acc(), 'connected', NOW, { siteTimezone: 'UTC', syncing: true }).text
    expect(text).toContain('Syncing your feed…')
    expect(text).toContain('last renewal 2 days ago')
    expect(text).not.toContain('last sync 1 hour')
  })
  it('Connected reports a failed first sync', () => {
    const a = acc({
      last_synced_at: null,
      sync_logs: [{ mode: 'manual', status: 'failed', created_at: iso(-60_000), error_message: 'x' }],
    })
    expect(cardText(a, 'connected', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toBe('Connected, but the first sync failed — the daily check will retry. See the runbook.')
    expect(hasFailedFirstSync(a)).toBe(true)
  })
  it('never renders NaN or Invalid Date for garbage timestamps', () => {
    const a = acc({ token_error: 'expired', token_error_at: 'garbage', token_expires_at: 'garbage' })
    const text = cardText(a, 'invalid', NOW, { siteTimezone: 'UTC', syncing: false }).text
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Invalid Date')
  })
  it('Never connected and Renewal pending have fixed sentences', () => {
    expect(cardText(acc({ connected: false }), 'never-connected', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toBe('Not connected')
    expect(cardText(acc({ token_expires_at: null }), 'renewal-pending', NOW, { siteTimezone: 'UTC', syncing: false }).text)
      .toBe('Connected · expiry unknown — the daily check will renew it within two days')
  })
})

describe('isStale', () => {
  it('shows at 49 h and hides at 47 h', () => {
    expect(isStale(acc({ last_synced_at: iso(-49 * 3600_000) }), NOW, 'connected')).toBe(true)
    expect(isStale(acc({ last_synced_at: iso(-47 * 3600_000) }), NOW, 'connected')).toBe(false)
  })
  it('hides with an open episode, with auto-sync off, when disconnected and in Invalid/Retrying/Never connected', () => {
    const stale = { last_synced_at: iso(-49 * 3600_000) }
    expect(isStale(acc({ ...stale, token_error_at: iso(-3 * DAY) }), NOW, 'connected')).toBe(false)
    expect(isStale(acc({ ...stale, sync_enabled: false }), NOW, 'connected')).toBe(false)
    expect(isStale(acc({ ...stale, connected: false }), NOW, 'connected')).toBe(false)
    expect(isStale(acc(stale), NOW, 'invalid')).toBe(false)
    expect(isStale(acc(stale), NOW, 'retrying')).toBe(false)
    expect(isStale(acc(stale), NOW, 'never-connected')).toBe(false)
    expect(isStale(acc({ ...stale, last_synced_at: null }), NOW, 'connected')).toBe(false)
  })
})

describe('hasOpenSyncRow — the Syncing sub-case of §3.1 step 11', () => {
  it('is true for a started row newer than the connection and false otherwise', () => {
    const a = acc({
      token_refreshed_at: iso(-60_000),
      sync_logs: [{ mode: 'manual', status: 'started', created_at: iso(-30_000), error_message: 'detail: x' }],
    })
    expect(hasOpenSyncRow(a)).toBe(true)
    const b = acc({
      token_refreshed_at: iso(-60_000),
      sync_logs: [{ mode: 'daily', status: 'started', created_at: iso(-90_000), error_message: null }],
    })
    expect(hasOpenSyncRow(b)).toBe(false)
  })
})

describe('isHumanReason', () => {
  it('accepts Meta sentences and rejects machine strings', () => {
    expect(isHumanReason('The session has been invalidated because the user changed their password')).toBe(true)
    expect(isHumanReason('Instagram API 403')).toBe(false)
    expect(isHumanReason('fetch failed')).toBe(false)
    expect(isHumanReason('TypeError: Failed to fetch')).toBe(false)
    expect(isHumanReason('transient: rate limit')).toBe(false)
  })
})

describe('reconnectIsPrimary', () => {
  it('is primary in Invalid and Expiring, and in Retrying only past 69 h', () => {
    expect(reconnectIsPrimary('invalid', acc(), NOW)).toBe(true)
    expect(reconnectIsPrimary('retrying', acc({ token_error_at: iso(-68 * 3600_000) }), NOW)).toBe(false)
    expect(reconnectIsPrimary('retrying', acc({ token_error_at: iso(-70 * 3600_000) }), NOW)).toBe(true)
    expect(reconnectIsPrimary('connected', acc(), NOW)).toBe(false)
    expect(reconnectIsPrimary('renewal-pending', acc(), NOW)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/cms/instagram-status.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o módulo**

Criar `src/app/cms/(authed)/settings/_sections/instagram-status.ts`:

```ts
import { kindFrom } from '@/lib/instagram/status-text'

export type CardState =
  | 'invalid' | 'never-connected' | 'expiring' | 'retrying' | 'renewal-pending' | 'connected'

export interface InstagramCardAccount {
  handle: string
  connected: boolean
  sync_enabled: boolean
  last_synced_at: string | null
  token_expires_at: string | null
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_refreshed_at: string | null
  sync_logs: { mode: string; status: string; created_at: string; error_message: string | null }[]
}

/** Dois ciclos diários perdidos. */
export const STALE_MS = 48 * 3600_000
/** Acima disto o lembrete transitório muda de tom e Reconnect vira primário. */
export const LONG_OPEN_MS = 69 * 3600_000
/** O cron de renovação roda `"0 11 * * *"` (UTC) — §0. */
const DAILY_CHECK_UTC_HOUR = 11

function ms(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

export function daysUntilExpiry(iso: string | null, now: number): number | null {
  const t = ms(iso)
  return t === null ? null : Math.ceil((t - now) / 86_400_000)
}

export function expiresLabel(days: number): string {
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

export function formatDate(iso: string | null): string {
  const t = ms(iso)
  if (t === null) return 'an unknown date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(t))
}

export function relativeTime(iso: string | null, now: number): string {
  const t = ms(iso)
  if (t === null) return 'never'
  const mins = Math.floor((now - t) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/**
 * "08:00 today" / "08:00 tomorrow" — a próxima ocorrência das 11:00 UTC no fuso
 * do site. Um "by 08:00" seco, lido às 19:00, é lido como promessa já vencida.
 */
export function nextDailyCheckLabel(now: number, timeZone: string): string {
  const d = new Date(now)
  const todaysRun = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAILY_CHECK_UTC_HOUR, 0, 0)
  const runAt = now < todaysRun ? todaysRun : todaysRun + 86_400_000
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone,
  }).format(new Date(runAt))
  const dayOf = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(t))
  return `${hhmm} ${dayOf(runAt) === dayOf(now) ? 'today' : 'tomorrow'}`
}

/**
 * Allow-list do card: mensagens humanas da Meta passam; strings de máquina
 * (`Instagram API 403`, `fetch failed`, `TypeError: …`, prefixos internos) não —
 * §2 proíbe string de máquina nesta superfície.
 */
export function isHumanReason(reason: string): boolean {
  if (/^Instagram API \d+$/.test(reason)) return false
  if (/^fetch failed$/i.test(reason)) return false
  if (/^[A-Za-z]*Error\b/.test(reason)) return false
  if (/^(transient|permanent|infra|timeout|never_connected|decrypt_failed)\b/.test(reason)) return false
  return reason.trim().split(/\s+/).length >= 4 && /[a-z]{3}/.test(reason)
}

function since(a: InstagramCardAccount): number {
  return ms(a.token_refreshed_at) ?? 0
}

export function hasFailedFirstSync(a: InstagramCardAccount): boolean {
  if (a.last_synced_at !== null) return false
  return a.sync_logs.some((l) => l.status === 'failed' && (ms(l.created_at) ?? 0) > since(a))
}

export function hasOpenSyncRow(a: InstagramCardAccount): boolean {
  return a.sync_logs.some((l) => l.status === 'started' && (ms(l.created_at) ?? 0) > since(a))
}

/** Precedência MUST: Invalid > Never connected > Expiring > Retrying > Renewal pending > Connected. */
export function resolveCardState(a: InstagramCardAccount, now: number): CardState {
  const expiresAt = ms(a.token_expires_at)
  if (a.token_error !== null || (expiresAt !== null && expiresAt <= now)) return 'invalid'
  if (!a.connected) return 'never-connected'
  const days = daysUntilExpiry(a.token_expires_at, now)
  if (days !== null && days <= 7) return 'expiring'
  if (a.token_error_at !== null) return 'retrying'
  if (a.token_expires_at === null) return 'renewal-pending'
  return 'connected'
}

export function cardText(
  a: InstagramCardAccount,
  state: CardState,
  now: number,
  opts: { siteTimezone: string; syncing: boolean },
): { text: string; rawReason?: string } {
  const days = daysUntilExpiry(a.token_expires_at, now)

  switch (state) {
    case 'invalid': {
      const at = formatDate(a.token_error_at ?? a.token_expires_at)
      const kind = kindFrom({ token_error: a.token_error })
      if (kind === 'transient') {
        return { text: `Token expired — the daily check will confirm this by ${nextDailyCheckLabel(now, opts.siteTimezone)}` }
      }
      if (a.token_error === 'expired') return { text: `Token expired (since ${at})` }
      if (a.token_error === 'deauthorized') return { text: `Instagram access was revoked (since ${at})` }
      if (a.token_error === 'data_deletion_requested') {
        return { text: `A data-deletion request was received (since ${at}) — the cached feed was deleted` }
      }
      if (a.token_error === 'decrypt_failed') return { text: "Stored token can't be read — reconnect" }
      const reason = a.token_error ?? ''
      if (isHumanReason(reason)) return { text: `Token invalid — ${reason} (since ${at})` }
      return { text: `Token invalid (since ${at}) — reconnect`, rawReason: reason }
    }
    case 'never-connected':
      return { text: 'Not connected' }
    case 'expiring': {
      const base =
        `${expiresLabel(days ?? 0)} — auto-renewal hasn't succeeded ` +
        `(last successful renewal: ${relativeTime(a.token_refreshed_at, now)}). ` +
        'Reconnect now; waiting risks losing the connection.'
      const openEpisode = a.token_error === null && a.token_error_at !== null
        ? ` (auto-renewal has been failing since ${formatDate(a.token_error_at)})`
        : ''
      return { text: base + openEpisode }
    }
    case 'retrying': {
      const subject = a.token_error_mode === 'daily' ? 'Feed sync' : 'Auto-renewal'
      const at = formatDate(a.token_error_at)
      const openedAt = ms(a.token_error_at)
      const longOpen = openedAt !== null && now - openedAt >= LONG_OPEN_MS
      return {
        text: longOpen
          ? `${subject} has been failing since ${at} and hasn't recovered — reconnect`
          : `${subject} has been failing since ${at} — it keeps retrying daily`,
      }
    }
    case 'renewal-pending':
      return { text: 'Connected · expiry unknown — the daily check will renew it within two days' }
    case 'connected': {
      if (hasFailedFirstSync(a)) {
        return { text: 'Connected, but the first sync failed — the daily check will retry. See the runbook.' }
      }
      const tail = opts.syncing
        ? 'Syncing your feed…'
        : `last sync ${relativeTime(a.last_synced_at, now)}`
      return {
        text:
          `Connected · renews automatically · last renewal ${relativeTime(a.token_refreshed_at, now)} · ` +
          `${expiresLabel(days ?? 0)} · ${tail}`,
      }
    }
  }
}

/** O badge só é decidível nos três estados saudáveis (§3.5). */
export function isStale(a: InstagramCardAccount, now: number, state: CardState): boolean {
  if (state !== 'renewal-pending' && state !== 'expiring' && state !== 'connected') return false
  if (!a.connected || !a.sync_enabled) return false
  if (a.token_error !== null || a.token_error_at !== null) return false
  const last = ms(a.last_synced_at)
  return last !== null && now - last > STALE_MS
}

export function reconnectIsPrimary(state: CardState, a: InstagramCardAccount, now: number): boolean {
  if (state === 'invalid' || state === 'expiring') return true
  if (state === 'retrying') {
    const openedAt = ms(a.token_error_at)
    return openedAt !== null && now - openedAt >= LONG_OPEN_MS
  }
  return false
}
```

- [ ] **Step 4: Rodar e conferir que passa**

Run: `cd apps/web && npx vitest run test/cms/instagram-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/_sections/instagram-status.ts" \
        apps/web/test/cms/instagram-status.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): logica pura do card (estados, textos, Stale e Syncing)

Precedencia Invalid > Never connected > Expiring > Retrying > Renewal pending
> Connected; Expiring vence Retrying e ganha o sufixo do episodio; allow-list
de reason (string de maquina cai na frase generica com o valor cru so no
title=); "by 08:00 today/tomorrow" derivado das 11:00 UTC no fuso do site;
nunca NaN, Invalid Date nem "in 1 days".

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 12: Card — 6 estados, badges, `readOnly`/`Preview`/`Not configured`/`Auto-sync off`/`Stale`/`Syncing`, estado derivado de props

**Files:**
- Modify: `src/app/cms/(authed)/settings/_sections/instagram.tsx` (reescrita)
- Modify: `apps/web/package.json` (`jsdom` em `devDependencies`)
- Test: `test/cms/instagram-section.test.tsx`

**Interfaces:**
- Consumes: `instagram-status.ts` (Task 11), `allowedLocales` (Task 9), `oauthErrorText`/`previewDisabledText` (C2), props da Task 10.
- Produces: os `data-testid` que as Tasks 13–14 estendem — `ig-card`, `ig-status-text`, `ig-badge-preview`, `ig-badge-not-configured`, `ig-badge-autosync-off`, `ig-badge-stale`, `ig-readonly-note`, `ig-paste-details`, `ig-enable-autosync`.

- [ ] **Step 1: Declarar `jsdom` como devDependency**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
npm pkg set devDependencies.jsdom="$(node -p "require('jsdom/package.json').version")"
npm install
```

(§6: hoje só `happy-dom@20.8.9` está declarado e o `jsdom` resolve por hoisting da raiz; C3 acrescenta vários consumidores.)

- [ ] **Step 2: Escrever o teste que falha**

Criar `test/cms/instagram-section.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'

const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: routerRefresh }) }))
vi.mock('@/components/instagram/slot-manager', () => ({ SlotManager: () => <div data-testid="slot-manager" /> }))
vi.mock('@/lib/instagram/status-text', () => ({
  kindFrom: (row: { token_error: string | null }) =>
    row.token_error === null ? 'transient'
      : row.token_error === 'expired' ? 'expired'
      : row.token_error === 'deauthorized' || row.token_error === 'data_deletion_requested' ? 'revoked'
      : 'invalid',
  oauthErrorText: (code: string) =>
    code === 'not_configured'
      ? "Instagram OAuth isn't configured yet — see the setup runbook"
      : `error:${code}`,
  previewDisabledText: () => 'Instagram authorization is disabled on preview deployments — use production.',
  RECONNECT_CTA: 'reconnect',
}))

import { InstagramSection } from '@/app/cms/(authed)/settings/_sections/instagram'

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()

function account(over: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', locale: 'pt' as const, handle: 'thiago.figueiredo',
    sync_enabled: true, display_slots: 6, layout_type: 'grid' as const,
    section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: ago(3600_000), token_expires_at: ahead(40 * DAY),
    token_error: null, token_error_at: null, token_error_mode: null,
    token_refreshed_at: ago(2 * DAY), token_alert_sent_at: null,
    ig_user_id: '17841400000000000', ig_user_id_source: 'oauth' as const,
    connected: true, posts: [], sync_logs: [], slots: [],
    ...over,
  }
}

function renderSection(over: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  return render(
    <InstagramSection
      accounts={[account(over)] as never}
      readOnly={false}
      oauthConfigured
      isPreview={false}
      missingInstagramEnv={[]}
      handleMismatch={null}
      siteTimezone="America/Sao_Paulo"
      {...props}
    />,
  )
}

const statusText = () => screen.getByTestId('ig-status-text').textContent ?? ''

describe('<InstagramSection> — the six states', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Never connected', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    expect(statusText()).toBe('Not connected')
  })
  it('Invalid — expired', () => {
    renderSection({ token_error: 'expired', token_error_at: ago(2 * DAY) })
    expect(statusText()).toContain('Token expired (since ')
  })
  it('Invalid — revoked', () => {
    renderSection({ token_error: 'deauthorized', token_error_at: ago(DAY) })
    expect(statusText()).toContain('Instagram access was revoked (since ')
  })
  it('Invalid — data deletion', () => {
    renderSection({ token_error: 'data_deletion_requested', token_error_at: ago(DAY) })
    expect(statusText()).toContain('the cached feed was deleted')
  })
  it('Invalid — machine reason falls back and keeps the raw value only in title=', () => {
    renderSection({ token_error: 'Instagram API 403', token_error_at: ago(DAY) })
    expect(statusText()).toContain('Token invalid (since ')
    expect(statusText()).not.toContain('Instagram API 403')
    expect(screen.getByTestId('ig-status-text').getAttribute('title')).toBe('Instagram API 403')
  })
  it('Retrying — subject and the 69 h flip', () => {
    renderSection({ token_expires_at: null, token_error_at: ago(68 * 3600_000), token_error_mode: 'daily' })
    expect(statusText()).toContain('Feed sync has been failing since ')
    expect(statusText()).toContain('it keeps retrying daily')
  })
  it('Renewal pending', () => {
    renderSection({ token_expires_at: null })
    expect(statusText()).toBe('Connected · expiry unknown — the daily check will renew it within two days')
  })
  it('Expiring beats Retrying and appends the open episode', () => {
    renderSection({ token_expires_at: ahead(3 * DAY), token_error_at: ago(4 * DAY) })
    expect(statusText()).toContain('Expires in 3 days')
    expect(statusText()).toContain(' (auto-renewal has been failing since ')
  })
  it('Connected — with last renewal, expiry and last sync', () => {
    renderSection()
    expect(statusText()).toContain('Connected · renews automatically · last renewal 2 days ago')
    expect(statusText()).toContain('Expires in 40 days')
    expect(statusText()).toContain('last sync 1 hour ago')
  })
  it('Connected — first sync failed', () => {
    renderSection({
      last_synced_at: null,
      token_refreshed_at: ago(120_000),
      sync_logs: [{ mode: 'manual', status: 'failed', posts_found: 0, posts_inserted: 0, posts_updated: 0, created_at: ago(60_000), error_message: 'boom' }],
    })
    expect(statusText()).toBe('Connected, but the first sync failed — the daily check will retry. See the runbook.')
  })
  it('never renders NaN, Invalid Date or "in 1 days"', () => {
    for (const over of [{}, { token_expires_at: null }, { token_error: 'expired', token_error_at: null }]) {
      const { unmount } = renderSection(over)
      const t = statusText()
      expect(t).not.toContain('NaN')
      expect(t).not.toContain('Invalid Date')
      expect(t).not.toMatch(/in 1 days/)
      unmount()
    }
  })
})

describe('<InstagramSection> — modifiers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Syncing replaces only the last-sync tail and suppresses Stale', () => {
    renderSection({
      last_synced_at: ago(60 * 3600_000),
      token_refreshed_at: ago(120_000),
      sync_logs: [{ mode: 'manual', status: 'started', posts_found: 0, posts_inserted: 0, posts_updated: 0, created_at: ago(60_000), error_message: 'detail: instagram_business_basic' }],
    })
    expect(statusText()).toContain('Syncing your feed…')
    expect(statusText()).toContain('last renewal')
    expect(screen.queryByTestId('ig-badge-stale')).toBeNull()
  })

  it('Stale shows at 49 h and hides at 47 h, with an episode, with auto-sync off and when disconnected', () => {
    renderSection({ last_synced_at: ago(49 * 3600_000) })
    expect(screen.getByTestId('ig-badge-stale')).toBeTruthy()
    for (const over of [
      { last_synced_at: ago(47 * 3600_000) },
      { last_synced_at: ago(49 * 3600_000), token_error_at: ago(3 * DAY), token_expires_at: null },
      { last_synced_at: ago(49 * 3600_000), sync_enabled: false },
      { last_synced_at: ago(49 * 3600_000), connected: false },
    ]) {
      const { unmount } = renderSection(over)
      expect(screen.queryByTestId('ig-badge-stale')).toBeNull()
      unmount()
    }
  })

  it('Stale never renders in Invalid, Retrying or Never connected', () => {
    for (const over of [
      { last_synced_at: ago(49 * 3600_000), token_error: 'expired', token_error_at: ago(DAY) },
      { last_synced_at: ago(49 * 3600_000), token_error_at: ago(DAY), token_expires_at: null },
      { last_synced_at: ago(49 * 3600_000), connected: false },
    ]) {
      const { unmount } = renderSection(over)
      expect(screen.queryByTestId('ig-badge-stale')).toBeNull()
      unmount()
    }
  })

  it('Auto-sync off shows the badge plus the enable button, and ONLY the badge in Never connected', () => {
    renderSection({ sync_enabled: false })
    expect(screen.getByTestId('ig-badge-autosync-off').textContent).toBe('Auto-sync off')
    expect(screen.getByTestId('ig-enable-autosync').textContent).toBe('Enable auto-sync')

    const { unmount } = renderSection({ sync_enabled: false, connected: false, token_expires_at: null })
    expect(screen.getByTestId('ig-badge-autosync-off')).toBeTruthy()
    expect(screen.queryByTestId('ig-enable-autosync')).toBeNull()
    unmount()
  })

  it('Preview wins over Not configured and disables the OAuth buttons with that title', () => {
    renderSection({}, { isPreview: true, oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_ID'] })
    expect(screen.getByTestId('ig-badge-preview').textContent).toBe('Preview')
    expect(screen.getByText('Instagram authorization is disabled on preview deployments — use production.')).toBeTruthy()
    expect(screen.queryByTestId('ig-badge-not-configured')).toBeNull()
    expect(screen.getByTestId('ig-paste-details').hasAttribute('open')).toBe(true)
    expect(within(screen.getByTestId('ig-paste-details')).getByText('Paste token manually')).toBeTruthy()
  })

  it('Not configured names the missing envs (names only) and makes pasting primary', () => {
    renderSection({}, { oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_SECRET', 'SOCIAL_MASTER_KEY'] })
    const badge = screen.getByTestId('ig-badge-not-configured')
    expect(badge.textContent).toContain("Instagram OAuth isn't configured yet — see the setup runbook")
    expect(badge.getAttribute('title')).toBe('INSTAGRAM_APP_SECRET, SOCIAL_MASTER_KEY')
    expect(screen.getByTestId('ig-paste-details').hasAttribute('open')).toBe(true)
  })

  it('keeps the paste fallback closed and labelled "(fallback)" when OAuth works', () => {
    renderSection()
    const details = screen.getByTestId('ig-paste-details')
    expect(details.hasAttribute('open')).toBe(false)
    expect(within(details).getByText('Paste token manually (fallback)')).toBeTruthy()
  })

  it('readOnly hides every control, keeps badges and adds the permission note in Invalid/Retrying', () => {
    renderSection({ token_error: 'expired', token_error_at: ago(DAY), sync_enabled: false }, { readOnly: true })
    expect(screen.getByTestId('ig-badge-autosync-off')).toBeTruthy()
    expect(screen.getByTestId('ig-readonly-note').textContent)
      .toBe("You don't have permission to reconnect — ask a site admin.")
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByTestId('ig-paste-details')).toBeNull()
    expect(screen.getByTestId('ig-locale-select').hasAttribute('disabled')).toBe(true)
  })

  it('readOnly with zero accounts renders no add form', () => {
    render(<InstagramSection accounts={[]} readOnly oauthConfigured siteTimezone="UTC" />)
    expect(screen.queryByTestId('ig-add-form')).toBeNull()
  })

  it('derives `connected` per row instead of per site', () => {
    render(
      <InstagramSection
        accounts={[account({ id: 'a', locale: 'pt', connected: true }), account({ id: 'b', locale: 'en', connected: false, token_expires_at: null, last_synced_at: null })] as never}
        readOnly={false}
        oauthConfigured
        siteTimezone="UTC"
      />,
    )
    const texts = screen.getAllByTestId('ig-status-text').map((n) => n.textContent)
    expect(texts[0]).toContain('Connected · renews automatically')
    expect(texts[1]).toBe('Not connected')
  })

  it('offers only non-conflicting locales in the row select', () => {
    render(
      <InstagramSection
        accounts={[account({ id: 'a', locale: 'pt' }), account({ id: 'b', locale: 'en' })] as never}
        readOnly={false}
        oauthConfigured
        siteTimezone="UTC"
      />,
    )
    const first = screen.getAllByTestId('ig-locale-select')[0] as HTMLSelectElement
    expect([...first.options].map((o) => o.value)).toEqual(['pt'])
  })
})

/**
 * Alcançabilidade da matriz de §3.5: 6 estados × 8 modificadores = 48 células,
 * 44 alcançáveis (o texto do estado fica INALTERADO e o modificador aparece),
 * 4 inalcançáveis viram asserções negativas nomeadas e 1 das 44 é a exceção
 * `Auto-sync off` × *Never connected* (só o badge).
 */
describe('<InstagramSection> — reachability matrix (44 + 4 negatives + 1 exception)', () => {
  const STATES = {
    invalid: { token_error: 'expired', token_error_at: ago(2 * DAY) },
    'never-connected': { connected: false, token_expires_at: null, last_synced_at: null },
    expiring: { token_expires_at: ahead(3 * DAY) },
    retrying: { token_expires_at: null, token_error_at: ago(4 * DAY), token_error_mode: 'daily' },
    'renewal-pending': { token_expires_at: null },
    connected: {},
  } as const
  const MODIFIERS = [
    'none', 'readOnly', 'preview', 'not-configured', 'autosync-off', 'stale', 'syncing', 'in-progress',
  ] as const

  const overridesFor = (mod: typeof MODIFIERS[number]) => {
    if (mod === 'autosync-off') return { sync_enabled: false }
    if (mod === 'stale') return { last_synced_at: ago(49 * 3600_000) }
    if (mod === 'syncing') return {
      token_refreshed_at: ago(120_000),
      sync_logs: [{ mode: 'manual', status: 'started', posts_found: 0, posts_inserted: 0, posts_updated: 0, created_at: ago(60_000), error_message: 'detail: instagram_business_basic' }],
    }
    return {}
  }
  const propsFor = (mod: typeof MODIFIERS[number]) => {
    if (mod === 'readOnly') return { readOnly: true }
    if (mod === 'preview') return { isPreview: true }
    if (mod === 'not-configured') return { oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_ID'] }
    return {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', vi.fn(() => ({ closed: false, close: vi.fn(), location: { href: '' } })))
  })

  it('renders all 48 cells without crashing and keeps the state text unchanged in the 44 reachable ones', () => {
    let reachable = 0
    for (const [state, stateOver] of Object.entries(STATES)) {
      const baseline = (() => {
        const r = renderSection(stateOver as never)
        const t = statusText()
        r.unmount()
        return t
      })()
      for (const mod of MODIFIERS) {
        const r = renderSection({ ...stateOver, ...overridesFor(mod) } as never, propsFor(mod))
        if (mod === 'in-progress' && !r.queryByTestId('ig-reconnect') && !r.queryByTestId('ig-connect')) {
          r.unmount(); continue
        }
        if (mod === 'in-progress') {
          fireEvent.click((r.queryByTestId('ig-reconnect') ?? r.getByTestId('ig-connect')) as HTMLElement)
          expect(r.getByTestId('ig-inprogress')).toBeTruthy()
        }
        // O texto do estado é preservado; só a cauda "last sync" muda sob `Syncing`.
        if (mod !== 'syncing' && mod !== 'stale') expect(statusText()).toBe(baseline)
        reachable++
        r.unmount()
      }
      void state
    }
    expect(reachable).toBe(44)
  })

  it('names the 4 unreachable cells: Stale in Invalid/Retrying/Never connected and Syncing in Never connected', () => {
    for (const state of ['invalid', 'retrying', 'never-connected'] as const) {
      const r = renderSection({ ...STATES[state], last_synced_at: ago(49 * 3600_000) } as never)
      expect(r.queryByTestId('ig-badge-stale')).toBeNull()
      r.unmount()
    }
    const never = renderSection({ ...STATES['never-connected'], ...overridesFor('syncing') } as never)
    expect(statusText()).toBe('Not connected')
    expect(statusText()).not.toContain('Syncing your feed…')
    expect(never.queryByTestId('ig-sync-now')).toBeNull()
    never.unmount()
  })

  it('names the 1 exception: Auto-sync off × Never connected is badge-only', () => {
    renderSection({ ...STATES['never-connected'], sync_enabled: false } as never)
    expect(screen.getByTestId('ig-badge-autosync-off')).toBeTruthy()
    expect(screen.queryByTestId('ig-enable-autosync')).toBeNull()
  })

  it('readOnly across every state renders no button, no paste block, no banner and no spinner', () => {
    for (const stateOver of Object.values(STATES)) {
      const r = renderSection(stateOver as never, {
        readOnly: true, handleMismatch: { accountId: 'acc-1', authorizedHandle: 'x' },
      })
      expect(r.queryAllByRole('button')).toHaveLength(0)
      expect(r.queryByTestId('ig-paste-details')).toBeNull()
      expect(r.queryByTestId('ig-mismatch-banner')).toBeNull()
      expect(r.queryByTestId('ig-inprogress')).toBeNull()
      r.unmount()
    }
  })

  it('Expiring with an open episode keeps the countdown AND makes Reconnect primary', () => {
    renderSection({ token_expires_at: ahead(3 * DAY), token_error_at: ago(4 * DAY) })
    expect(statusText()).toContain('Expires in 3 days')
    expect(statusText()).toContain(' (auto-renewal has been failing since ')
    expect(screen.getByTestId('ig-reconnect').className).toContain('bg-indigo-500')
  })

  it('Retrying under 69 h keeps Reconnect secondary', () => {
    renderSection({ token_expires_at: null, token_error_at: ago(68 * 3600_000), token_error_mode: 'daily' })
    expect(screen.getByTestId('ig-reconnect').className).not.toContain('bg-indigo-500')
  })
})
```

> **Nota de execução:** os quatro últimos `it` deste bloco dependem dos botões da **Task 13** e do
> `Sync Now` condicional da **Task 14**. Escreva o `describe` inteiro agora (é o teste que falha) e
> aceite que ele só fica verde ao fim da Task 14 — as Tasks 12, 13 e 14 editam o mesmo arquivo e o
> comando de verificação de cada uma nomeia o subconjunto que já deve passar (`-t` nos `describe`
> anteriores). O gate "suíte inteira verde" é a Task 16.

- [ ] **Step 3: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/cms/instagram-section.test.tsx`
Expected: FAIL — `ig-status-text` não existe.

- [ ] **Step 4: Reescrever `_sections/instagram.tsx`**

Substituir o arquivo inteiro por:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SlotManager } from '@/components/instagram/slot-manager'
import { useSaveState, SaveButton, labelCls, sectionCls } from './_shared'
import { oauthErrorText, previewDisabledText } from '@/lib/instagram/status-text'
import { allowedLocales, type InstagramLocale } from '@/lib/instagram/locale-rules'
import {
  cardText, hasOpenSyncRow, isStale, reconnectIsPrimary, resolveCardState,
} from './instagram-status'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface InstagramAccountData {
  id: string
  locale: InstagramLocale
  handle: string
  sync_enabled: boolean
  display_slots: number
  layout_type: 'grid' | 'scatter'
  section_title_pt: string | null
  section_title_en: string | null
  section_subtitle_pt: string | null
  section_subtitle_en: string | null
  last_synced_at: string | null
  token_expires_at: string | null
  token_error: string | null
  token_error_at: string | null
  token_error_mode: 'daily' | 'token_refresh' | null
  token_refreshed_at: string | null
  token_alert_sent_at: string | null
  ig_user_id: string | null
  ig_user_id_source: 'oauth' | 'legacy'
  connected: boolean
  posts: { id: string; cached_image_url: string | null; caption: string | null }[]
  sync_logs: { mode: string; status: string; posts_found: number; posts_inserted: number; posts_updated: number; created_at: string; error_message: string | null }[]
  slots: { id: string; position: number; post_id: string | null; thumbnail_url: string | null; caption: string | null }[]
}

export interface InstagramSectionProps {
  accounts: InstagramAccountData[]
  readOnly: boolean
  oauthConfigured?: boolean
  missingInstagramEnv?: string[]
  isPreview?: boolean
  handleMismatch?: { accountId: string; authorizedHandle: string } | null
  siteTimezone?: string
}

/* ------------------------------------------------------------------ */
/*  InstagramSection                                                  */
/* ------------------------------------------------------------------ */

export function InstagramSection({
  accounts,
  readOnly,
  oauthConfigured = false,
  missingInstagramEnv = [],
  isPreview = false,
  handleMismatch = null,
  siteTimezone = 'America/Sao_Paulo',
}: InstagramSectionProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Estado derivado de props: `router.refresh()` no lugar de `setAccounts`.
  // O `handleAdd` antigo injetava `id: crypto.randomUUID()` e o card recém-criado
  // apontava para uma conta inexistente.
  const handleRemove = (accountId: string) => {
    startTransition(async () => {
      const { removeInstagramAccount } = await import('../actions')
      const res = await removeInstagramAccount({ accountId })
      if (res.ok) router.refresh()
      else alert(res.error)
    })
  }

  const existingLocales = accounts.map((a) => a.locale)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-100">Instagram Feed</h2>

      {accounts.length === 0 && (
        <p className="text-sm text-slate-400">No Instagram account configured.</p>
      )}

      {accounts.map((account) => (
        <InstagramAccountCard
          key={account.id}
          account={account}
          readOnly={readOnly}
          oauthConfigured={oauthConfigured}
          missingInstagramEnv={missingInstagramEnv}
          isPreview={isPreview}
          mismatch={handleMismatch?.accountId === account.id ? handleMismatch : null}
          siteTimezone={siteTimezone}
          existingLocales={existingLocales}
          onRemove={() => handleRemove(account.id)}
        />
      ))}

      {accounts.length < 2 && !readOnly && (
        <AddInstagramForm existingLocales={existingLocales} onAdded={() => router.refresh()} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  InstagramAccountCard                                              */
/* ------------------------------------------------------------------ */

function InstagramAccountCard({
  account,
  readOnly,
  oauthConfigured,
  missingInstagramEnv,
  isPreview,
  mismatch,
  siteTimezone,
  existingLocales,
  onRemove,
}: {
  account: InstagramAccountData
  readOnly: boolean
  oauthConfigured: boolean
  missingInstagramEnv: string[]
  isPreview: boolean
  mismatch: { accountId: string; authorizedHandle: string } | null
  siteTimezone: string
  existingLocales: string[]
  onRemove: () => void
}) {
  const router = useRouter()
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const [accountLocale, setAccountLocale] = useState<InstagramLocale>(account.locale)
  const [syncEnabled, setSyncEnabled] = useState(account.sync_enabled)
  const [displaySlots, setDisplaySlots] = useState(account.display_slots)
  const [layoutType, setLayoutType] = useState(account.layout_type)
  const [titlePt, setTitlePt] = useState(account.section_title_pt ?? '')
  const [titleEn, setTitleEn] = useState(account.section_title_en ?? '')
  const [subtitlePt, setSubtitlePt] = useState(account.section_subtitle_pt ?? '')
  const [subtitleEn, setSubtitleEn] = useState(account.section_subtitle_en ?? '')
  const [token, setToken] = useState('')
  const [syncing, setSyncing] = useState(false)

  const now = Date.now()
  const state = resolveCardState(account, now)
  const isSyncing = hasOpenSyncRow(account)
  const showStale = !isSyncing && isStale(account, now, state)
  const status = cardText(account, state, now, { siteTimezone, syncing: isSyncing })
  const reconnectPrimary = reconnectIsPrimary(state, account, now)
  // `Preview` vence `Not configured`; nos dois a cola manual é primária.
  const pastePrimary = isPreview || !oauthConfigured
  const localeOptions = allowedLocales(existingLocales, account.locale)

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      const { updateInstagramSettings } = await import('../actions')
      const res = await updateInstagramSettings({
        accountId: account.id,
        locale: accountLocale,
        sync_enabled: syncEnabled,
        display_slots: displaySlots,
        layout_type: layoutType,
        section_title_pt: titlePt.trim() || null,
        section_title_en: titleEn.trim() || null,
        section_subtitle_pt: subtitlePt.trim() || null,
        section_subtitle_en: subtitleEn.trim() || null,
      })
      setSaveState(res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    })
  }

  const handleEnableAutoSync = () => {
    startTransition(async () => {
      const { updateInstagramSettings } = await import('../actions')
      const res = await updateInstagramSettings({ accountId: account.id, sync_enabled: true })
      if (res.ok) { setSyncEnabled(true); router.refresh() }
      else alert(res.error)
    })
  }

  const handleSetToken = () => {
    if (!token.trim()) return
    startTransition(async () => {
      const { setInstagramToken } = await import('../actions')
      const res = await setInstagramToken({ accountId: account.id, accessToken: token.trim() })
      if (res.ok) { setToken(''); router.refresh() }
      else alert(res.error)
    })
  }

  const handleSync = () => {
    setSyncing(true)
    startTransition(async () => {
      const { triggerInstagramSync } = await import('../actions')
      const res = await triggerInstagramSync({ accountId: account.id })
      setSyncing(false)
      if (!res.ok) alert(res.error)
      else router.refresh()
    })
  }

  const effectiveSlots = account.slots.length > 0
    ? account.slots
    : Array.from({ length: account.display_slots }, (_, i) => ({
        id: `virtual-${i + 1}`,
        position: i + 1,
        post_id: null as string | null,
        thumbnail_url: null as string | null,
        caption: null as string | null,
      }))

  const handleSlotReorder = (slots: { position: number; postId: string | null }[]) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('../actions')
      await updateInstagramSlots({ accountId: account.id, slots })
    })
  }

  const handlePinPost = (position: number, postId: string | null) => {
    startTransition(async () => {
      const { updateInstagramSlots } = await import('../actions')
      const currentSlots = effectiveSlots.map(s => ({
        position: s.position,
        postId: s.position === position ? postId : s.post_id,
      }))
      await updateInstagramSlots({ accountId: account.id, slots: currentSlots })
    })
  }

  void mismatch   // banner de mismatch: Task 13

  return (
    <div className="space-y-4" data-testid="ig-card">
      <form onSubmit={handleSaveSettings} className={sectionCls()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-slate-200">{account.handle}</h3>
            <select
              data-testid="ig-locale-select"
              value={accountLocale}
              onChange={e => setAccountLocale(e.target.value as InstagramLocale)}
              disabled={readOnly}
              className="rounded-md border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300"
            >
              {localeOptions.map(l => (
                <option key={l} value={l}>
                  {l === 'all' ? 'All (PT + EN)' : l === 'pt' ? 'PT-BR' : 'EN'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {!readOnly && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
            {!readOnly && (
              <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Connection */}
        <div className="space-y-2 rounded-md border border-slate-700 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-slate-300">Connection</h4>
            {isPreview && (
              <span data-testid="ig-badge-preview" className="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-200">
                Preview
              </span>
            )}
            {!account.sync_enabled && (
              <span data-testid="ig-badge-autosync-off" className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-300">
                Auto-sync off
              </span>
            )}
            {showStale && (
              <span data-testid="ig-badge-stale" className="rounded bg-slate-700 px-1.5 py-0.5 text-[11px] text-slate-300">
                Stale
              </span>
            )}
          </div>

          <p data-testid="ig-status-text" className="text-sm text-slate-300" title={status.rawReason}>
            {status.text}
          </p>

          {isPreview && (
            <p className="text-xs text-slate-400">{previewDisabledText()}</p>
          )}
          {!isPreview && !oauthConfigured && (
            <p
              data-testid="ig-badge-not-configured"
              className="text-xs text-amber-300"
              title={missingInstagramEnv.join(', ')}
            >
              {oauthErrorText('not_configured')}
            </p>
          )}

          {readOnly && (state === 'invalid' || state === 'retrying') && (
            <p data-testid="ig-readonly-note" className="text-xs text-slate-400">
              You don&apos;t have permission to reconnect — ask a site admin.
            </p>
          )}

          {!readOnly && !account.sync_enabled && state !== 'never-connected' && (
            <button
              type="button"
              data-testid="ig-enable-autosync"
              onClick={handleEnableAutoSync}
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Enable auto-sync
            </button>
          )}

          {/* Botões de OAuth e banner de mismatch: Task 13 */}
          {reconnectPrimary && <span className="sr-only" data-testid="ig-reconnect-primary" />}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={readOnly}
              className="accent-indigo-500"
            />
            Auto-sync enabled
          </label>

          <div className="space-y-1">
            <label className={labelCls()}>Layout</label>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as 'grid' | 'scatter')}
              disabled={readOnly}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="grid">Grid</option>
              <option value="scatter">Scatter</option>
            </select>
          </div>
        </div>

        {(accountLocale === 'pt' || accountLocale === 'all') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls()}>Título (PT-BR)</label>
              <input
                type="text"
                value={titlePt}
                onChange={e => setTitlePt(e.target.value)}
                disabled={readOnly}
                placeholder="do iPhone, sem filtro"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls()}>Subtítulo (PT-BR)</label>
              <input
                type="text"
                value={subtitlePt}
                onChange={e => setSubtitlePt(e.target.value)}
                disabled={readOnly}
                placeholder="últimos cliques"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {(accountLocale === 'en' || accountLocale === 'all') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelCls()}>Title (EN)</label>
              <input
                type="text"
                value={titleEn}
                onChange={e => setTitleEn(e.target.value)}
                disabled={readOnly}
                placeholder="from the iPhone, no filter"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls()}>Subtitle (EN)</label>
              <input
                type="text"
                value={subtitleEn}
                onChange={e => setSubtitleEn(e.target.value)}
                disabled={readOnly}
                placeholder="latest shots"
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className={labelCls()}>Display Slots ({displaySlots})</label>
          <input
            type="range"
            min={1}
            max={12}
            value={displaySlots}
            onChange={(e) => setDisplaySlots(Number(e.target.value))}
            disabled={readOnly}
            className="w-full"
          />
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <SaveButton state={saveState} />
          </div>
        )}
      </form>

      {/* Cola manual — fallback permanente (objetivo 4), nunca removida */}
      {!readOnly && (
        <details data-testid="ig-paste-details" open={pastePrimary} className={sectionCls()}>
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            {pastePrimary ? 'Paste token manually' : 'Paste token manually (fallback)'}
          </summary>
          <div className="mt-3 flex items-end gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste long-lived access token"
              className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={handleSetToken}
              disabled={!token.trim()}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </details>
      )}

      {account.posts.length > 0 && (
        <div className={sectionCls()}>
          <h4 className="text-sm font-medium text-slate-300">Pin Management</h4>
          <SlotManager
            slots={effectiveSlots.map(s => ({
              id: s.id,
              position: s.position,
              postId: s.post_id,
              thumbnailUrl: s.thumbnail_url,
              caption: s.caption,
            }))}
            allPosts={account.posts.map(p => ({
              id: p.id,
              cachedImageUrl: p.cached_image_url,
              caption: p.caption,
            }))}
            onReorder={handleSlotReorder}
            onPinPost={handlePinPost}
            disabled={readOnly}
          />
        </div>
      )}

      {account.sync_logs.length > 0 && (
        <div className={sectionCls()}>
          <h4 className="text-sm font-medium text-slate-300">Sync History</h4>
          <div className="space-y-1">
            {account.sync_logs.slice(0, 5).map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{new Date(log.created_at).toLocaleDateString()}</span>
                <span className={log.status === 'completed' ? 'text-green-400' : log.status === 'failed' ? 'text-red-400' : 'text-slate-400'}>
                  {log.status}
                </span>
                {log.status === 'completed' && (
                  <span className="text-slate-500">{log.posts_inserted} new, {log.posts_updated} updated</span>
                )}
                {log.error_message && (
                  <span className="text-red-400">{log.error_message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AddInstagramForm                                                  */
/* ------------------------------------------------------------------ */

function AddInstagramForm({
  existingLocales,
  onAdded,
}: {
  existingLocales: string[]
  onAdded: () => void
}) {
  const availableLocales = allowedLocales(existingLocales)
  const [handle, setHandle] = useState('')
  const [locale, setLocale] = useState<InstagramLocale>(availableLocales[0] ?? 'all')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!handle.trim()) return
    setAdding(true)
    setError(null)
    const { addInstagramAccount } = await import('../actions')
    const res = await addInstagramAccount({ handle: handle.trim(), locale })
    setAdding(false)
    if (!res.ok) { setError(res.error); return }
    setHandle('')
    onAdded()
  }

  if (availableLocales.length === 0) return null

  return (
    <div className={sectionCls()} data-testid="ig-add-form">
      <h3 className="text-sm font-medium text-slate-300">Add Instagram Account</h3>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className={labelCls()}>Handle</label>
          <input
            type="text"
            value={handle}
            onChange={e => { setHandle(e.target.value); setError(null) }}
            placeholder="@bythiagofigueiredo"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls()}>Locale</label>
          <select
            data-testid="ig-add-locale"
            value={locale}
            onChange={e => setLocale(e.target.value as InstagramLocale)}
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableLocales.map(l => (
              <option key={l} value={l}>{l === 'all' ? 'All (PT + EN)' : l === 'pt' ? 'PT-BR' : 'EN'}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !handle.trim()}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Connect'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Rodar e conferir que passa (os dois primeiros `describe`)**

Run: `cd apps/web && npx vitest run test/cms/instagram-section.test.tsx -t "the six states" && npx vitest run test/cms/instagram-section.test.tsx -t "modifiers" && npx vitest run test/cms/instagram-status.test.ts`
Expected: PASS. O `describe` da matriz de alcançabilidade continua vermelho até a Task 14 (depende dos botões das Tasks 13 e 14) — é o teste que guia as duas.

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/_sections/instagram.tsx" \
        apps/web/test/cms/instagram-section.test.tsx apps/web/package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(instagram): card de conexao com os 6 estados e os modificadores

Estado derivado de props (fim do setAccounts com id de cliente); badges
Preview/Auto-sync off/Stale; Preview vence Not configured; cola manual em
<details> aberto e sem "(fallback)" quando e o unico controle que funciona;
readOnly some com controles e acrescenta a linha de permissao em
Invalid/Retrying com o <select> de locale disabled. jsdom declarado.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 13: Botões de OAuth, listener, `In progress` e banner de mismatch

**Files:**
- Modify: `src/app/cms/(authed)/settings/_sections/instagram.tsx`
- Test: `test/cms/instagram-section.test.tsx` (acrescentar o `describe`)

**Interfaces:**
- Consumes: `authorizeInstagramRebind`/`dismissInstagramHandleMismatch` (Task 9), a rota de início (Task 2), o `postMessage` do callback (Task 3).
- Produces: `data-testid` `ig-connect`, `ig-reconnect`, `ig-different`, `ig-rebind`, `ig-mismatch-banner`, `ig-mismatch-cancel`, `ig-inprogress`, `ig-cancel`, `ig-inline-error`, `ig-try-again`, `ig-dismiss-error` — a Task 14 desabilita os mesmos botões.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `test/cms/instagram-section.test.tsx`:

```tsx
// (`fireEvent`/`act` já estão importados no topo do arquivo, desde a Task 12)
const mockRebind = vi.fn()
const mockDismiss = vi.fn()
const mockDisconnect = vi.fn()
const mockTriggerSync = vi.fn()
const mockRemove = vi.fn()
const mockUpdateSettings = vi.fn()
const mockSetToken = vi.fn()
const mockUpdateSlots = vi.fn()
vi.mock('@/app/cms/(authed)/settings/actions', () => ({
  authorizeInstagramRebind: (...a: unknown[]) => mockRebind(...a),
  dismissInstagramHandleMismatch: (...a: unknown[]) => mockDismiss(...a),
  disconnectInstagramAccount: (...a: unknown[]) => mockDisconnect(...a),
  triggerInstagramSync: (...a: unknown[]) => mockTriggerSync(...a),
  removeInstagramAccount: (...a: unknown[]) => mockRemove(...a),
  updateInstagramSettings: (...a: unknown[]) => mockUpdateSettings(...a),
  setInstagramToken: (...a: unknown[]) => mockSetToken(...a),
  updateInstagramSlots: (...a: unknown[]) => mockUpdateSlots(...a),
  addInstagramAccount: vi.fn(async () => ({ ok: true })),
}))

function fakeWindow() {
  return { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window & {
    closed: boolean; close: ReturnType<typeof vi.fn>; location: { href: string }
  }
}

function postResult(data: Record<string, unknown>, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }))
  })
}

describe('<InstagramSection> — OAuth actions', () => {
  let win: ReturnType<typeof fakeWindow>

  beforeEach(() => {
    vi.clearAllMocks()
    win = fakeWindow()
    vi.stubGlobal('open', vi.fn(() => win))
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('offers Connect with Instagram once in Never connected, with no force_reauth', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    const btn = screen.getByTestId('ig-connect')
    expect(screen.getAllByTestId('ig-connect')).toHaveLength(1)
    expect(btn.textContent).toBe('Connect with Instagram')
    fireEvent.click(btn)
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1')
    expect(win.location.href).not.toContain('force_reauth')
  })

  it('offers Reconnect once connected and "Connect a different account" with different=1', () => {
    renderSection({ token_error: 'expired', token_error_at: ago(DAY) })
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1')

    const { unmount } = renderSection()
    fireEvent.click(screen.getAllByTestId('ig-different')[0] as HTMLElement)
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1&different=1')
    unmount()
  })

  it('opens the window BEFORE awaiting and enters In progress, disabling the six named actions', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    expect(window.open).toHaveBeenCalledWith('about:blank', 'ig-oauth', expect.any(String))
    expect(screen.getByTestId('ig-inprogress').textContent).toContain('Still waiting for Instagram.')
    for (const id of ['ig-reconnect', 'ig-different', 'ig-sync-now', 'ig-disconnect']) {
      const el = screen.queryByTestId(id) as HTMLButtonElement | null
      if (el) expect(el.disabled).toBe(true)
    }
    expect((screen.getByTestId('ig-remove') as HTMLButtonElement).disabled).toBe(false)
  })

  it('two clicks on Connect with Instagram start a single flow', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    const btn = screen.getByTestId('ig-connect')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(window.open).toHaveBeenCalledTimes(1)
  })

  it('navigates the current tab when the popup is blocked, confirming only when the texts are dirty', () => {
    vi.stubGlobal('open', vi.fn(() => null))
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, get href() { return '' }, set href(v: string) { hrefSetter(v) } },
      writable: true,
    })
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    expect(vi.mocked(confirm)).not.toHaveBeenCalled()
    expect(hrefSetter).toHaveBeenCalledWith('/api/instagram/oauth?account_id=acc-1')

    fireEvent.change(screen.getByPlaceholderText('do iPhone, sem filtro'), { target: { value: 'novo' } })
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Leave this page to authorize with Instagram? Unsaved changes to the section texts will be lost.',
    )
  })

  it('clears In progress and refreshes on a success message from the same origin', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({ type: 'instagram-oauth-result', success: true, provider: 'instagram' })
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
    expect(routerRefresh).toHaveBeenCalled()
  })

  it('ignores messages from another origin and of another type', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({ type: 'instagram-oauth-result', success: true }, 'https://evil.com')
    postResult({ type: 'social-oauth-result', success: true })
    expect(screen.getByTestId('ig-inprogress')).toBeTruthy()
    expect(routerRefresh).not.toHaveBeenCalled()
  })

  it('shows a persistent inline error with Try again and Dismiss, and does not refresh', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({
      type: 'instagram-oauth-result', success: false, provider: 'instagram',
      error: 'Instagram rejected the authorization (code 400)', code: 'exchange_failed',
    })
    expect(screen.getByTestId('ig-inline-error').textContent).toBe('Instagram rejected the authorization (code 400)')
    expect(routerRefresh).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('ig-try-again'))
    expect(window.open).toHaveBeenCalledTimes(2)

    postResult({ type: 'instagram-oauth-result', success: false, code: 'write_failed' })
    fireEvent.click(screen.getByTestId('ig-dismiss-error'))
    expect(screen.queryByTestId('ig-inline-error')).toBeNull()
  })

  it('falls back to oauthErrorText for a missing or oversized server message', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    postResult({ type: 'instagram-oauth-result', success: false, error: 'x'.repeat(201), code: 'invalid_state' })
    expect(screen.getByTestId('ig-inline-error').textContent).toBe('error:invalid_state')
  })

  it('enforces the 10-minute ceiling even with w.closed === false', () => {
    vi.useFakeTimers()
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    act(() => { vi.advanceTimersByTime(10 * 60_000 + 1000) })
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
    expect(screen.getByTestId('ig-inline-error').textContent).toBe("Authorization didn't finish — try again")
    vi.useRealTimers()
  })

  it('clears early on visibilitychange when the window was closed', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    win.closed = true
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
  })

  it('Cancel clears immediately and closes the window, with no error text', () => {
    renderSection()
    fireEvent.click(screen.getByTestId('ig-reconnect'))
    fireEvent.click(screen.getByTestId('ig-cancel'))
    expect(win.close).toHaveBeenCalled()
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
    expect(screen.queryByTestId('ig-inline-error')).toBeNull()
  })

  it('renders the mismatch banner with both handles and one button', async () => {
    mockRebind.mockResolvedValue({ ok: true, rebind: 'signed-rebind' })
    renderSection({}, { handleMismatch: { accountId: 'acc-1', authorizedHandle: 'other.account' } })
    expect(screen.getByTestId('ig-mismatch-banner').textContent)
      .toContain('You authorized @other.account; this CMS account is @thiago.figueiredo')
    const btn = screen.getByTestId('ig-rebind')
    expect(btn.textContent).toBe('Use @other.account for this account and reconnect')

    await act(async () => { fireEvent.click(btn) })
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(mockRebind).toHaveBeenCalledWith({ accountId: 'acc-1' })
    expect(win.location.href).toBe('/api/instagram/oauth?account_id=acc-1&rebind=signed-rebind')
    expect(win.location.href).not.toContain('force_reauth')
  })

  it('closes the window and shows the error when the rebind action fails', async () => {
    mockRebind.mockResolvedValue({ ok: false, error: 'error:invalid_state' })
    renderSection({}, { handleMismatch: { accountId: 'acc-1', authorizedHandle: 'other.account' } })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-rebind')) })
    expect(win.close).toHaveBeenCalled()
    expect(screen.getByTestId('ig-inline-error').textContent).toBe('error:invalid_state')
  })

  it('Cancel on the banner dismisses the cookie', async () => {
    mockDismiss.mockResolvedValue({ ok: true })
    renderSection({}, { handleMismatch: { accountId: 'acc-1', authorizedHandle: 'other.account' } })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-mismatch-cancel')) })
    expect(mockDismiss).toHaveBeenCalled()
  })

  it('renders no banner for a cookie that belongs to another row', () => {
    renderSection({}, { handleMismatch: { accountId: 'other-acc', authorizedHandle: 'x' } })
    expect(screen.queryByTestId('ig-mismatch-banner')).toBeNull()
  })

  it('renders no banner and no OAuth buttons under readOnly', () => {
    renderSection({}, { readOnly: true, handleMismatch: { accountId: 'acc-1', authorizedHandle: 'x' } })
    expect(screen.queryByTestId('ig-mismatch-banner')).toBeNull()
    expect(screen.queryByTestId('ig-reconnect')).toBeNull()
    expect(screen.queryByTestId('ig-inprogress')).toBeNull()
  })

  it('disables the OAuth buttons on preview and when not configured, with the right title', () => {
    renderSection({}, { isPreview: true })
    expect((screen.getByTestId('ig-reconnect') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('ig-reconnect').getAttribute('title'))
      .toBe('Instagram authorization is disabled on preview deployments — use production.')

    const { unmount } = renderSection({}, { oauthConfigured: false, missingInstagramEnv: ['INSTAGRAM_APP_ID'] })
    expect((screen.getByTestId('ig-reconnect') as HTMLButtonElement).disabled).toBe(true)
    unmount()
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/cms/instagram-section.test.tsx -t "OAuth actions"`
Expected: FAIL — `ig-connect` não existe.

- [ ] **Step 3: Implementar no card**

1. Imports do arquivo:

```tsx
import { useEffect, useRef, useState, useTransition } from 'react'
import type { OauthErrorCode } from '@/lib/oauth/errors'
```

2. Constantes de módulo (abaixo dos tipos):

```tsx
const OAUTH_TIMEOUT_MS = 10 * 60_000
const OAUTH_WINDOW_FEATURES = 'width=600,height=700'
```

3. Estado novo no `InstagramAccountCard` (junto dos demais `useState`):

```tsx
  const [inProgress, setInProgress] = useState<{ origin: 'oauth' | 'sync'; startedAt: number } | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [lastOauthQuery, setLastOauthQuery] = useState('')
  const winRef = useRef<Window | null>(null)
  const busy = inProgress !== null
  const oauthDisabled = readOnly || isPreview || !oauthConfigured
  const oauthTitle = isPreview
    ? previewDisabledText()
    : !oauthConfigured
      ? oauthErrorText('not_configured')
      : undefined
```

4. Trocar o `void mismatch` pelos handlers e efeitos:

```tsx
  // Listener único do resultado do popup. `origin` é conferido SEMPRE.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      // MUST: `oauthResultHtml` (B) faz `...extra` no payload — `code` e `status`
      // chegam no TOPO do objeto, NUNCA aninhados sob `extra`.
      const data = e.data as {
        type?: string; success?: boolean; error?: unknown
        status?: string; code?: OauthErrorCode
      } | null
      if (!data || data.type !== 'instagram-oauth-result') return

      setInProgress(null)
      winRef.current = null

      if (data.success) {
        setInlineError(null)
        router.refresh()
        // O `after()` do callback ainda está rodando: um segundo refresh troca
        // "last sync never" por "Syncing your feed…" sem recarga manual.
        window.setTimeout(() => router.refresh(), 8000)
        return
      }
      if (data.status === 'handle_mismatch') {
        router.refresh()
        return
      }
      const fromServer = typeof data.error === 'string' && data.error.length <= 200 ? data.error : null
      setInlineError(fromServer ?? oauthErrorText(data.code ?? 'write_failed'))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router])

  // Teto incondicional de 10 min; `w.closed` só ANTECIPA. No celular a "janela"
  // é uma aba que o dono abandona sem fechar: sem o teto o spinner ficaria para
  // sempre e as seis ações travadas até um reload que ninguém tem motivo de dar.
  useEffect(() => {
    if (!inProgress) return
    const settle = () => {
      const elapsed = Date.now() - inProgress.startedAt
      if (winRef.current?.closed !== true && elapsed < OAUTH_TIMEOUT_MS) return
      winRef.current?.close()
      winRef.current = null
      setInProgress(null)
      if (elapsed >= OAUTH_TIMEOUT_MS) {
        setInlineError(inProgress.origin === 'oauth'
          ? "Authorization didn't finish — try again"
          : 'The sync is taking too long — try again')
      }
    }
    const timer = window.setTimeout(settle, Math.max(0, OAUTH_TIMEOUT_MS - (Date.now() - inProgress.startedAt)))
    const onVisible = () => { if (document.visibilityState === 'visible') settle() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [inProgress])

  const isDirty =
    titlePt !== (account.section_title_pt ?? '') ||
    titleEn !== (account.section_title_en ?? '') ||
    subtitlePt !== (account.section_subtitle_pt ?? '') ||
    subtitleEn !== (account.section_subtitle_en ?? '')

  /** `window.open` SÍNCRONO antes de qualquer `await` — senão o navegador bloqueia. */
  const openOauth = (query: string) => {
    if (oauthDisabled || busy) return
    const url = `/api/instagram/oauth?account_id=${account.id}${query}`
    setLastOauthQuery(query)
    const w = window.open('about:blank', 'ig-oauth', OAUTH_WINDOW_FEATURES)
    if (w === null) {
      if (isDirty && !confirm('Leave this page to authorize with Instagram? Unsaved changes to the section texts will be lost.')) return
      window.location.href = url
      return
    }
    winRef.current = w
    setInlineError(null)
    setInProgress({ origin: 'oauth', startedAt: Date.now() })
    w.location.href = url
  }

  const handleRebind = () => {
    if (oauthDisabled || busy) return
    const w = window.open('about:blank', 'ig-oauth', OAUTH_WINDOW_FEATURES)
    if (w !== null) winRef.current = w
    setInlineError(null)
    setInProgress({ origin: 'oauth', startedAt: Date.now() })
    startTransition(async () => {
      const { authorizeInstagramRebind } = await import('../actions')
      const res = await authorizeInstagramRebind({ accountId: account.id })
      if (!res.ok) {
        w?.close()
        winRef.current = null
        setInProgress(null)
        setInlineError(res.error)
        return
      }
      const url = `/api/instagram/oauth?account_id=${account.id}&rebind=${encodeURIComponent(res.rebind)}`
      if (w) w.location.href = url
      else window.location.href = url
    })
  }

  const handleDismissMismatch = () => {
    startTransition(async () => {
      const { dismissInstagramHandleMismatch } = await import('../actions')
      await dismissInstagramHandleMismatch()
      router.refresh()
    })
  }

  const cancelInProgress = () => {
    winRef.current?.close()
    winRef.current = null
    setInProgress(null)
  }
```

5. Trocar o marcador `{reconnectPrimary && <span className="sr-only" data-testid="ig-reconnect-primary" />}` pelo bloco de ações:

```tsx
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {state === 'never-connected' ? (
                <button
                  type="button"
                  data-testid="ig-connect"
                  onClick={() => openOauth('')}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  Connect with Instagram
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="ig-reconnect"
                  onClick={() => openOauth('')}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className={
                    reconnectPrimary
                      ? 'rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50'
                      : 'rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50'
                  }
                >
                  Reconnect
                </button>
              )}

              {account.connected && (
                <button
                  type="button"
                  data-testid="ig-different"
                  onClick={() => openOauth('&different=1')}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Connect a different account
                </button>
              )}
            </div>
          )}

          {!readOnly && busy && (
            <p data-testid="ig-inprogress" className="flex items-center gap-2 text-xs text-slate-400">
              <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-transparent" />
              Still waiting for Instagram.{' '}
              <button
                type="button"
                data-testid="ig-cancel"
                onClick={cancelInProgress}
                className="underline hover:text-slate-200"
              >
                Cancel
              </button>
            </p>
          )}

          {!readOnly && inlineError && (
            <div className="space-y-1 rounded-md border border-red-500/40 bg-red-500/10 p-2">
              <p data-testid="ig-inline-error" className="text-xs text-red-300">{inlineError}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="ig-try-again"
                  onClick={() => openOauth(lastOauthQuery)}
                  disabled={oauthDisabled || busy}
                  className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Try again
                </button>
                <button
                  type="button"
                  data-testid="ig-dismiss-error"
                  onClick={() => setInlineError(null)}
                  className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {!readOnly && mismatch && (
            <div data-testid="ig-mismatch-banner" className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="text-xs text-amber-200">
                You authorized @{mismatch.authorizedHandle}; this CMS account is @{account.handle}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="ig-rebind"
                  onClick={handleRebind}
                  disabled={oauthDisabled || busy}
                  title={oauthTitle}
                  className="rounded-md bg-indigo-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  Use @{mismatch.authorizedHandle} for this account and reconnect
                </button>
                <button
                  type="button"
                  data-testid="ig-mismatch-cancel"
                  onClick={handleDismissMismatch}
                  className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
```

6. Marcar `Sync Now` como parte do conjunto desabilitado e dar `data-testid` ao `Remove` (que **não**
   é desabilitado — não fala com a Meta). No cabeçalho do card, o par de botões vira:

```tsx
            <button
              type="button"
              data-testid="ig-sync-now"
              onClick={handleSync}
              disabled={syncing || busy}
              className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            {!readOnly && (
              <button
                type="button"
                data-testid="ig-remove"
                onClick={onRemove}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
```

(A Task 14 troca `onRemove` por `handleRemoveClick`, esconde `Sync Now` sem token e acrescenta
`Disconnect`.)

- [ ] **Step 4: Rodar e conferir que passa**

Run: `cd apps/web && npx vitest run test/cms/instagram-section.test.tsx -t "the six states" && npx vitest run test/cms/instagram-section.test.tsx -t "modifiers" && npx vitest run test/cms/instagram-section.test.tsx -t "OAuth actions"`
Expected: PASS nos três. A matriz de alcançabilidade ainda depende do `Sync Now` condicional e do `Disconnect` da Task 14.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/_sections/instagram.tsx" apps/web/test/cms/instagram-section.test.tsx
git commit -m "$(cat <<'EOF'
feat(instagram): botoes de OAuth, listener, In progress e banner de mismatch

window.open sincrono antes de qualquer await, com confirm de saida so quando os
4 textos da secao estao sujos; listener confere origin e tipo, limpa In progress
sempre, refaz o refresh 8 s depois do sucesso (superficie do sync pos-OAuth) e
mostra erro inline persistente com Try again/Dismiss; teto incondicional de
10 min com w.closed apenas antecipando, mais visibilitychange/focus e Cancel;
banner de mismatch reconecta em 1 clique sem force_reauth.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 14: `Sync Now`, `Remove`, `Disconnect` e `AddInstagramForm`

**Files:**
- Modify: `src/app/cms/(authed)/settings/_sections/instagram.tsx`
- Test: `test/cms/instagram-section.test.tsx` (acrescentar o `describe`)

**Interfaces:**
- Consumes: `disconnectInstagramAccount` (Task 9), `triggerInstagramSync` (`SyncActionResult` de A: `{ ok: true; partial?: boolean } | { ok: false; error: string }`), `allowedLocales` (Task 9).
- Produces: `data-testid` `ig-sync-now`, `ig-remove`, `ig-disconnect`, `ig-sync-note`, `ig-add-form`, `ig-add-submit`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `test/cms/instagram-section.test.tsx`:

```tsx
describe('<InstagramSection> — row actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', vi.fn(() => fakeWindow()))
    vi.stubGlobal('confirm', vi.fn(() => true))
    mockTriggerSync.mockResolvedValue({ ok: true })
    mockDisconnect.mockResolvedValue({ ok: true })
    mockRemove.mockResolvedValue({ ok: true })
  })

  it('hides Sync Now without a token and shows it once connected', () => {
    renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    expect(screen.queryByTestId('ig-sync-now')).toBeNull()
    const { unmount } = renderSection()
    expect(screen.getByTestId('ig-sync-now')).toBeTruthy()
    unmount()
  })

  it('reports a partial sync inline', async () => {
    mockTriggerSync.mockResolvedValue({ ok: true, partial: true })
    renderSection()
    await act(async () => { fireEvent.click(screen.getByTestId('ig-sync-now')) })
    expect(screen.getByTestId('ig-sync-note').textContent)
      .toBe('Synced part of the feed — run Sync Now again to finish')
  })

  it('uses the two Disconnect confirm texts and hides it only in Never connected with no episode', async () => {
    renderSection()
    await act(async () => { fireEvent.click(screen.getByTestId('ig-disconnect')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Disconnect this Instagram account? Alerts stop and the feed keeps the posts already synced, but it stops receiving new ones until you reconnect. This does not revoke the app on Instagram.',
    )
    expect(mockDisconnect).toHaveBeenCalledWith({ accountId: 'acc-1' })

    vi.mocked(confirm).mockClear()
    const never = renderSection({ last_synced_at: null })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-disconnect')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Disconnect this Instagram account? Alerts stop and the account stays configured with no posts until you reconnect. This does not revoke the app on Instagram.',
    )
    never.unmount()

    vi.mocked(confirm).mockClear()
    const deleted = renderSection({ token_error: 'data_deletion_requested', token_error_at: ago(DAY), connected: false })
    expect(screen.getByTestId('ig-disconnect')).toBeTruthy()   // Invalid sem token ainda mostra
    await act(async () => { fireEvent.click(screen.getByTestId('ig-disconnect')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(expect.stringContaining('stays configured with no posts'))
    deleted.unmount()

    const hidden = renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    expect(screen.queryByTestId('ig-disconnect')).toBeNull()
    hidden.unmount()
  })

  it('mentions Disconnect in the Remove confirm only while Disconnect is visible', async () => {
    renderSection()
    await act(async () => { fireEvent.click(screen.getByTestId('ig-remove')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith(
      'Remove this Instagram account and all synced posts? To keep the posts and only stop the alerts, use Disconnect.',
    )

    vi.mocked(confirm).mockClear()
    const never = renderSection({ connected: false, token_expires_at: null, last_synced_at: null })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-remove')) })
    expect(vi.mocked(confirm)).toHaveBeenCalledWith('Remove this Instagram account and all synced posts?')
    never.unmount()
  })

  it('offers the add form up to three accounts, labelled "Add account", with a safe initial locale', () => {
    render(
      <InstagramSection accounts={[account({ id: 'a', locale: 'pt' })] as never} readOnly={false} oauthConfigured siteTimezone="UTC" />,
    )
    expect((screen.getByTestId('ig-add-locale') as HTMLSelectElement).value).toBe('en')
    expect(screen.getByTestId('ig-add-submit').textContent).toBe('Add account')

    const two = render(
      <InstagramSection
        accounts={[account({ id: 'a', locale: 'pt' }), account({ id: 'b', locale: 'en' })] as never}
        readOnly={false} oauthConfigured siteTimezone="UTC"
      />,
    )
    expect(two.queryByTestId('ig-add-form')).toBeNull()      // nenhum locale livre
    two.unmount()
  })

  it('refreshes from the server after adding instead of inventing a client id', async () => {
    render(<InstagramSection accounts={[]} readOnly={false} oauthConfigured siteTimezone="UTC" />)
    fireEvent.change(screen.getByPlaceholderText('@bythiagofigueiredo'), { target: { value: '@x' } })
    await act(async () => { fireEvent.click(screen.getByTestId('ig-add-submit')) })
    expect(routerRefresh).toHaveBeenCalled()
    expect(screen.getAllByTestId('ig-card')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/cms/instagram-section.test.tsx -t "row actions"`
Expected: FAIL — `ig-disconnect` não existe.

- [ ] **Step 3: Implementar**

1. No card, remover o `const [syncing, setSyncing] = useState(false)` e trocar `handleSync` por:

```tsx
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const syncing = inProgress?.origin === 'sync'

  const handleSync = () => {
    if (busy) return
    setSyncNote(null)
    setInlineError(null)
    setInProgress({ origin: 'sync', startedAt: Date.now() })
    startTransition(async () => {
      const { triggerInstagramSync } = await import('../actions')
      const res = await triggerInstagramSync({ accountId: account.id })
      setInProgress(null)
      if (!res.ok) { setInlineError(res.error); return }
      if (res.partial) setSyncNote('Synced part of the feed — run Sync Now again to finish')
      router.refresh()
    })
  }
```

2. Visibilidade e confirms:

```tsx
  // Visível em todo estado com token, mais Invalid/Retrying mesmo sem ele;
  // oculto só em Never connected sem episódio.
  const disconnectVisible = account.connected || state === 'invalid' || state === 'retrying'

  const handleDisconnect = () => {
    const message = account.last_synced_at !== null && account.token_error !== 'data_deletion_requested'
      ? 'Disconnect this Instagram account? Alerts stop and the feed keeps the posts already synced, but it stops receiving new ones until you reconnect. This does not revoke the app on Instagram.'
      : 'Disconnect this Instagram account? Alerts stop and the account stays configured with no posts until you reconnect. This does not revoke the app on Instagram.'
    if (!confirm(message)) return
    startTransition(async () => {
      const { disconnectInstagramAccount } = await import('../actions')
      const res = await disconnectInstagramAccount({ accountId: account.id })
      if (!res.ok) { setInlineError(res.error); return }
      router.refresh()
    })
  }

  const handleRemoveClick = () => {
    const message = disconnectVisible
      ? 'Remove this Instagram account and all synced posts? To keep the posts and only stop the alerts, use Disconnect.'
      : 'Remove this Instagram account and all synced posts?'
    if (!confirm(message)) return
    onRemove()
  }
```

3. Cabeçalho do card — `Sync Now` oculto sem token, `Remove` chamando o confirm local:

```tsx
          <div className="flex items-center gap-3">
            {!readOnly && account.connected && (
              <button
                type="button"
                data-testid="ig-sync-now"
                onClick={handleSync}
                disabled={busy}
                className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                data-testid="ig-remove"
                onClick={handleRemoveClick}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
```

4. `Disconnect` no bloco de ações da Connection (depois de "Connect a different account"):

```tsx
              {disconnectVisible && (
                <button
                  type="button"
                  data-testid="ig-disconnect"
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  Disconnect
                </button>
              )}
```

5. Nota de sync parcial, logo abaixo do bloco de ações:

```tsx
          {syncNote && (
            <p data-testid="ig-sync-note" className="text-xs text-amber-300">{syncNote}</p>
          )}
```

6. `InstagramSection`: o formulário passa a aparecer até 3 contas —

```tsx
      {accounts.length < 3 && !readOnly && (
        <AddInstagramForm existingLocales={existingLocales} onAdded={() => router.refresh()} />
      )}
```

7. `AddInstagramForm`: o botão vira `Add account` e ganha `data-testid`:

```tsx
        <button
          type="button"
          data-testid="ig-add-submit"
          onClick={handleAdd}
          disabled={adding || !handle.trim()}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add account'}
        </button>
```

(`availableLocales` já está hoisted antes do `useState` e o valor inicial já é `availableLocales[0] ?? 'all'` desde a Task 12.)

- [ ] **Step 4: Rodar a suíte de UI inteira**

Run: `cd apps/web && npx vitest run test/cms/instagram-section.test.tsx test/cms/instagram-status.test.ts test/cms/settings/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/settings/_sections/instagram.tsx" apps/web/test/cms/instagram-section.test.tsx
git commit -m "$(cat <<'EOF'
feat(instagram): Sync Now, Remove, Disconnect e AddInstagramForm

Sync Now oculto sem token e com nota de sync parcial; Remove cita Disconnect
so quando ele esta visivel; Disconnect com as duas formas de confirm, visivel
em todo estado com token mais Invalid/Retrying e oculto so em Never connected
sem episodio; formulario ate 3 contas, rotulo "Add account" e locale inicial
seguro.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 15: As duas superfícies de `action_href` (sino + inbox)

O `actionHref: '/cms/settings/instagram'` que C2 já emite é **invisível** na única página de notificações — contra o objetivo 1 ("CMS + e-mail **sempre**").

**Files:**
- Modify: `src/app/cms/(authed)/_shared/notification-row.tsx` (duas ocorrências de `'Abrir'`)
- Modify: `src/app/cms/(authed)/notifications/_components/inbox-client.tsx`
- Test: `test/cms/notification-action-href.test.tsx`

**Interfaces:**
- Consumes: `INotification.action_href`/`suggested_action` (`@/lib/notifications/types`, já existentes), `markRead` (`@/lib/notifications/actions`).
- Produces: o botão `Open` nas duas superfícies.

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/cms/notification-action-href.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { INotification } from '@/lib/notifications/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a>,
}))
const markRead = vi.fn(async () => undefined)
vi.mock('@/lib/notifications/actions', () => ({
  markRead: (...a: unknown[]) => markRead(...(a as [])),
  markUnread: vi.fn(async () => undefined),
  dismiss: vi.fn(async () => undefined),
  markAllRead: vi.fn(async () => undefined),
  bulkDismiss: vi.fn(async () => undefined),
}))

import { NotificationRow } from '@/app/cms/(authed)/_shared/notification-row'
import { InboxClient } from '@/app/cms/(authed)/notifications/_components/inbox-client'

function notification(over: Partial<INotification> = {}): INotification {
  return {
    id: 'n1', site_id: 's1', user_id: 'u1', type: 'system.token_expired', domain: 'system',
    priority: 5, title: 'Instagram token expired · @thiago.figueiredo',
    message: 'expired — reconnect at https://bythiagofigueiredo.com/cms/settings/instagram',
    payload: null, dedup_key: 'k', group_key: null, read_at: null, dismissed_at: null,
    expired_at: null, snoozed_until: null, suggested_action: null,
    action_href: '/cms/settings/instagram', created_at: new Date().toISOString(),
    ...over,
  }
}

describe('(a) bell popover — _shared/notification-row.tsx', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels the action button "Open" in English, never "Abrir"', () => {
    render(<NotificationRow notification={notification()} onAction={vi.fn()} />)
    const btn = screen.getByLabelText('Open')
    expect(btn.textContent).toContain('Open')
    expect(screen.queryByLabelText('Abrir')).toBeNull()
  })

  it('still honours suggested_action when the notification carries one', () => {
    render(<NotificationRow notification={notification({ suggested_action: 'Reconnect' })} onAction={vi.fn()} />)
    expect(screen.getByLabelText('Reconnect')).toBeTruthy()
  })
})

describe('(b) inbox — notifications/_components/inbox-client.tsx', () => {
  const domainCounts = { system: 1 } as never

  beforeEach(() => vi.clearAllMocks())

  it('renders an Open button that marks read and navigates', async () => {
    render(
      <InboxClient
        initialNotifications={[notification()]}
        totalCount={1}
        unreadCount={1}
        domainCounts={domainCounts}
        siteId="s1"
      />,
    )
    const btn = screen.getByLabelText('Open')
    expect(btn.textContent).toContain('Open')
    await act(async () => { fireEvent.click(btn) })
    expect(markRead).toHaveBeenCalledWith('n1')
    expect(push).toHaveBeenCalledWith('/cms/settings/instagram')
  })

  it('renders no Open button when action_href is null', () => {
    render(
      <InboxClient
        initialNotifications={[notification({ action_href: null })]}
        totalCount={1}
        unreadCount={1}
        domainCounts={domainCounts}
        siteId="s1"
      />,
    )
    expect(screen.queryByLabelText('Open')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/cms/notification-action-href.test.tsx`
Expected: FAIL — `getByLabelText('Open')` não encontra nada (o sino diz `Abrir`; o inbox não renderiza `action_href`).

- [ ] **Step 3: Trocar `'Abrir'` por `'Open'` no popover do sino**

Em `src/app/cms/(authed)/_shared/notification-row.tsx`, no bloco `{n.action_href && (`:

```tsx
                aria-label={n.suggested_action ?? 'Open'}
              >
                {n.suggested_action ?? 'Open'}
```

(As **duas** ocorrências — `aria-label` e rótulo.)

- [ ] **Step 4: Acrescentar o mesmo botão ao `NotificationRow` do inbox**

Em `src/app/cms/(authed)/notifications/_components/inbox-client.tsx`:

1. Imports:

```tsx
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
```

(acrescentar `ChevronRight` à lista já importada de `lucide-react`.)

2. Dentro de `InboxClient`, ao lado dos outros callbacks:

```tsx
  const router = useRouter()

  const handleAction = useCallback((id: string, href: string | null) => {
    if (!href) return
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
    )
    void markRead(id)
    if (href.startsWith('/')) router.push(href)
    else window.location.href = href
  }, [router])
```

3. Passar ao row:

```tsx
                <NotificationRow
                  key={n.id}
                  notification={n}
                  isSelected={selected.has(n.id)}
                  onToggleSelect={() => toggleSelect(n.id)}
                  onAction={() => handleAction(n.id, n.action_href)}
                  onMarkRead={() => handleMarkRead(n.id)}
                  onMarkUnread={() => handleMarkUnread(n.id)}
                  onDismiss={() => handleDismiss(n.id)}
                />
```

4. Na assinatura do `NotificationRow` local, acrescentar `onAction: () => void` ao tipo de props e desestruturar.

5. Como **primeiro** filho do bloco `{/* Action buttons */}` (antes do toggle de lida):

```tsx
        {n.action_href && (
          <button
            type="button"
            onClick={onAction}
            aria-label={n.suggested_action ?? 'Open'}
            className="flex items-center gap-0.5 rounded-md px-1.5 h-7
                       text-[11px] font-medium text-cms-accent
                       hover:bg-cms-accent-subtle transition-colors"
          >
            {n.suggested_action ?? 'Open'}
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
```

- [ ] **Step 5: Rodar e conferir que passa**

Run: `cd apps/web && npx vitest run test/cms/notification-action-href.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add "apps/web/src/app/cms/(authed)/_shared/notification-row.tsx" \
        "apps/web/src/app/cms/(authed)/notifications/_components/inbox-client.tsx" \
        apps/web/test/cms/notification-action-href.test.tsx
git commit -m "$(cat <<'EOF'
feat(cms): action_href visivel nas duas superficies de notificacao

Popover do sino passa a dizer "Open" (aria-label e rotulo) e a pagina
/cms/notifications ganha o mesmo botao, que marca lida e navega — sem ele o
actionHref para /cms/settings/instagram emitido pelo alerta de token era
invisivel na unica pagina de notificacoes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 16: `RECONNECT_CTA = 'reconnect'` + verificação da fiação

**Files:**
- Modify: `src/lib/instagram/status-text.ts`
- Test: `test/instagram/status-text.test.ts` (a asserção do CTA muda **no mesmo commit** da constante)

**Interfaces:**
- Consumes: nada novo.
- Produces: `RECONNECT_CTA = 'reconnect'` — único consumidor é `deliverTokenAlert` (C2), que monta `message` = `<reason escapado> — ${RECONNECT_CTA} at ${APP_URL}/cms/settings/instagram`.

- [ ] **Step 1: Escrever o teste que falha**

Em `test/instagram/status-text.test.ts`, substituir a asserção de C2 por:

```ts
  it('tells the owner to reconnect now that the OAuth UI is live (C3)', () => {
    // Aceitar as duas formas não ratcheta nada: uma regressão para o texto de C2
    // passaria verde depois de C3.
    expect(RECONNECT_CTA).toBe('reconnect')
  })
```

- [ ] **Step 2: Rodar e conferir que falha**

Run: `cd apps/web && npx vitest run test/instagram/status-text.test.ts`
Expected: FAIL — `expected 'paste a new token' to be 'reconnect'`.

- [ ] **Step 3: Trocar a constante — e, no MESMO commit, a asserção do consumidor**

Em `src/lib/instagram/status-text.ts`:

```ts
/**
 * Fecha o e-mail/CMS de alerta de token. Era `'paste a new token'` enquanto a UI
 * de OAuth não existia (C2); a partir de C3 o dono reconecta em um clique.
 */
export const RECONNECT_CTA = 'reconnect'
```

`test/instagram/token.test.ts` (C2) fixa o texto **literal** no `it` de `deliverTokenAlert` — a regra
do `CLAUDE.md` manda o fix de teste viajar no mesmo commit:

```ts
  it('message termina em "— <RECONNECT_CTA> at <APP_URL>/cms/settings/instagram"', async () => {
    const { client } = sweepClient([])
    await deliverTokenAlert(client, group, 'expired', '2026-09-04', { reminder: false, longOpen: false })
    expect(mockFanOut.mock.calls[0]![0].message)
      .toMatch(/— reconnect at https:\/\/bythiagofigueiredo\.com\/cms\/settings\/instagram$/)
  })
```

- [ ] **Step 4: Rodar e conferir que passa (incluindo o consumidor)**

Run: `cd apps/web && npx vitest run test/instagram/status-text.test.ts test/instagram/token.test.ts`
Expected: PASS nos dois.

- [ ] **Step 5: Fechar a tabela emissor-agnóstica de REGRA-PII-NTFY com os dois emissores de C3**

`test/api/cron/ntfy.test.ts` (C2) tem a tabela `EMITTERS` com os `{ title, body }` dos **7** emissores
de `sendNtfyAlert` e a asserção de tamanho (`=== 7`, com o censo de Blob contando como um nas duas
formas). Dois deles são emitidos por código que só nasce em C3 — *signature mismatch* (§3.1 passo 4,
`src/lib/instagram/signed-request.ts`) e *ddmismatch* (§3.1 passo 7, a rota de data-deletion). C2 já
fixou as strings; **conferir que as do código batem byte a byte** com a tabela (se divergirem, a
verdade é a tabela — corrigir o código **neste commit**):

```ts
  // ── as duas linhas de C3 na tabela dos 7 emissores ────────────────────────
  { title: 'Instagram callback signature mismatch', body: 'Check Sentry for the route and secret tag.' },
  { title: 'Instagram deletion request matched no account', body: 'possible ID-space mismatch — see the runbook' },
```

A asserção emissor-agnóstica continua valendo para as 7 linhas, com as fixtures
`handle:'thiago.figueiredo'`, `ig_user_id:'17841400000000000'` e
`token_error:'The session has been invalidated because the user changed their password'`:

```ts
    expect(`${title} ${body}`).not.toMatch(/@[a-z0-9._]{1,30}/)
    expect(`${title} ${body}`).not.toMatch(/[0-9]{6,}/)
```

Run: `cd apps/web && npx vitest run test/api/cron/ntfy.test.ts`
Expected: PASS com `=== 7`.

- [ ] **Step 6: Rodar a suíte inteira antes do push (é barata: ~160 s)**

Run: `cd apps/web && npx vitest run`
Expected: PASS. Conferir explicitamente os arquivos tocados por C3 e seus vizinhos: `test/api/instagram/*`, `test/cms/instagram-*`, `test/cms/notification-action-href.test.tsx`, `test/cms/settings/*`, `test/components/legal-shell.test.tsx`, `test/instagram/*`, `test/middleware/*`, `test/app/(public)/data-deletion-page.test.tsx`, `test/unit/use-server-exports.test.ts`, `test/app/sitemap.test.ts`.

- [ ] **Step 7: Typecheck + build**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run build:packages
cd apps/web && npx tsc --noEmit -p tsconfig.json && npm run build
```
Expected: typecheck limpo e `next build` verde (paridade com a Vercel; §7 exige verificação local completa antes do push único).

- [ ] **Step 8: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
# MUST: `test/instagram/token.test.ts` (C2 Task 10) fixa o texto LITERAL do CTA no
# `it('message termina em …')`. O Step 3 corrigiu a asserção — ela viaja NESTE
# commit, senão a árvore fica com teste vermelho e a bisectabilidade morre.
git add apps/web/src/lib/instagram/status-text.ts \
        apps/web/test/instagram/status-text.test.ts \
        apps/web/test/instagram/token.test.ts
git commit -m "$(cat <<'EOF'
feat(instagram): RECONNECT_CTA passa a ser 'reconnect'

A UI de OAuth existe a partir de C3, entao o e-mail/CMS de alerta deixa de
mandar colar token. Constante e asserção mudam no MESMO commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 17: Docs de §8 + política de privacidade v1.4

**Files:**
- Modify: `CLAUDE.md`
- Modify: `apps/web/.env.example`, `apps/web/.env.local.example`
- Modify: `docs/ops/instagram-token-alert-runbook.md`
- Modify: `docs/ops/social-api-reviews-runbook.md`
- Modify: `docs/ops/runbook-cms-e2e-local.md`
- Modify: `docs/ops/plano-custo-zero.md`
- Modify: `docs/superpowers/specs/2026-05-07-instagram-feed-design.md` (bloco de `vercel.json`, ~`:590,596`)
- Modify: `docs/superpowers/plans/2026-05-07-instagram-feed.md` (bloco de `vercel.json`, ~`:1914`)
- Modify: `apps/web/src/content/legal/privacy.en.mdx`, `apps/web/src/content/legal/privacy.pt-BR.mdx`

**Interfaces:**
- Consumes: nada (documentação).
- Produces: a seção do runbook que a Task 18 completa com a evidência pós-deploy.

- [ ] **Step 1: `CLAUDE.md` — envs, ordem dos commits, rollback e espelho de versão**

1. Na tabela de *Ecosystem Packages*, trocar `auth-nextjs@2.0.0` por **`auth-nextjs@2.2.0`** (a versão instalada; a divergência estava registrada como dívida).
2. Em *Environment Variables → Web*, acrescentar à lista: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_ALLOW_META_SECRET_FALLBACK`, `SOCIAL_MASTER_KEY` — **`NTFY_URL` já está na lista** (entre `YT_ANALYTICS_SYNC_WINDOW_DAYS` e `UPTIME_PROBE_TARGET`); não duplicar. E o parágrafo:

```markdown
`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` (App Dashboard > Instagram > API setup with Instagram login >
Business login settings): habilitam `Connect with Instagram` em `/cms/settings/instagram`. Lidos de
`process.env` direto (declarados `.optional()` no `serverSchema`) — `getServerEnv()` lançaria e derrubaria
a rota inteira. Sem eles a UI mostra "Instagram OAuth isn't configured yet" e a cola manual continua
funcionando. `INSTAGRAM_ALLOW_META_SECRET_FALLBACK=1` aceita `META_APP_SECRET` na verificação do
`signed_request` até **2026-10-06** (`META_SECRET_FALLBACK_DEADLINE_MS`); depois é ignorado.
`SOCIAL_MASTER_KEY` (32 bytes hex) cifra o token em repouso — sem ela o OAuth responde 503
`vault_unavailable`.
```

3. Acrescentar a seção:

```markdown
## Instagram OAuth (entrega de 2026-09-06)

Oito commits sequenciais em `staging`, nesta ordem: **A → A4 → A5 → B → C1 → C2 → C4 → C3**
(A5 tem dois corpos possíveis, decididos pelo gate de herança de `maxDuration` depois de A).
Rollback obrigatoriamente na ordem inversa **C3 → C4 → C2 → C1 → B → A5 → A4 → A**.

- **Depois de promover C2:** `curl -fsS -H "Authorization: Bearer $CRON_SECRET"` nos **dois** crons
  (`/api/cron/instagram-token-refresh` **e** `/api/cron/instagram-sync`) **no mesmo minuto** — os dois
  mudam de agenda (`"0 11 * * *"` e `"0 13 * * *"`) e sem isso o `/api/health` fica `degraded` por
  ~12 h e o watchdog pagina ~1×/h.
- **Rollback de C2 = `git revert` + passo de banco obrigatório** (zerar `access_token like 'v1:%'`,
  `ig_user_id_source='legacy'`, `ig_professional_id=null` e limpar as chaves de `ops_alert_state`).
  "Só reverter o deploy" está **proibido** para C2. Detalhe em
  `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` §7.
- **C3** acrescenta as rotas `/api/instagram/oauth`, `/api/instagram/oauth/callback`,
  `/api/instagram/deauthorize`, `/api/instagram/data-deletion` e a página pública `/data-deletion`.
  Runbook: `docs/ops/instagram-token-alert-runbook.md`.
```

- [ ] **Step 2: `.env.example` e `.env.local.example`**

Conferir e, se faltar, acrescentar as cinco chaves aos **dois** arquivos (C2 já deveria tê-las posto; o `it` de `test/lib/env.test.ts` é o ratchet):

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web
for f in .env.example .env.local.example; do
  # C2 (Tarefa 17) já escreveu as CINCO chaves nos dois arquivos; este bloco é rede
  # de segurança e só roda se C2 tiver sido revertido. MUST: cada chave tem SEU
  # PRÓPRIO guard `grep -q '^KEY=' file || echo 'KEY=' >> file` — nenhuma depende
  # da presença de outra (a forma antiga agrupava 3 chaves atrás do guard de
  # `INSTAGRAM_APP_ID`, então rodar com só essa faltando duplicava as outras 4).
  # Comentários em LINHA PRÓPRIA, nunca coladas na chave: o gate do Step 6 de C2
  # (`git diff --cached | grep -E '^\+[A-Z_]+=.+'`) lê `CHAVE=  # texto` como
  # "chave com valor" e acusa segredo commitado.
  if ! grep -q '^INSTAGRAM_APP_ID=' "$f" && ! grep -q '^INSTAGRAM_APP_SECRET=' "$f" \
    && ! grep -q '^INSTAGRAM_ALLOW_META_SECRET_FALLBACK=' "$f"; then
    printf '\n# ── Instagram feed OAuth ──────────────────────────────────────────────────\n' >> "$f"
  fi
  grep -q '^INSTAGRAM_APP_ID=' "$f" || echo 'INSTAGRAM_APP_ID=' >> "$f"
  grep -q '^INSTAGRAM_APP_SECRET=' "$f" || echo 'INSTAGRAM_APP_SECRET=' >> "$f"
  grep -q '^INSTAGRAM_ALLOW_META_SECRET_FALLBACK=' "$f" || echo 'INSTAGRAM_ALLOW_META_SECRET_FALLBACK=' >> "$f"
  # `SOCIAL_MASTER_KEY` já existe em `.env.example:98` desde antes de C2 — o guard
  # evita duplicar (quebraria `find((l) => l.startsWith(key))` de `test/lib/env.test.ts`).
  grep -q '^SOCIAL_MASTER_KEY=' "$f" || echo 'SOCIAL_MASTER_KEY=' >> "$f"
  grep -q '^NTFY_URL=' "$f" || echo 'NTFY_URL=' >> "$f"
done
npx vitest run test/lib/env.test.ts
```

- [ ] **Step 3: `docs/ops/instagram-token-alert-runbook.md` — seção de C3**

Acrescentar (depois da seção "Gates de C3" da Task 1):

```markdown
## O ntfy tocou — o que fazer

> Corpo prometido pelo esqueleto criado em C2 ("o corpo completo entra em C3"). Nenhum push carrega
> handle, id, token ou motivo (REGRA-PII-NTFY, §0), então a triagem é sempre: abrir o CMS ou o Sentry.

São **7** títulos (a contagem `=== 7` de `test/api/cron/ntfy.test.ts`, C2): os 4 abaixo agrupam variantes
do mesmo emissor por texto (`expired`/`access revoked`/`token invalid`/`still disconnected` são um só
título parametrizado por `token_error`), então a tabela lista **9 linhas** para as **7** entradas.

| Título do push | Emissor | Primeiro comando | O que fazer |
|---|---|---|---|
| `Instagram token expired · <slug>` · `… access revoked …` · `… token invalid …` · `… still disconnected …` | `deliverTokenAlert` (§3.2) | `select handle, token_error, token_error_at, token_error_mode, token_alert_sent_at, token_alert_attempt_at from instagram_accounts where id = '<uuid>';` (`CAMPOS_DE_EPISÓDIO`, §0) | Abrir `/cms/settings/instagram` (o header `Click` já leva) e usar **Reconnect**. O motivo real está no card e no e-mail, nunca no push. |
| `Instagram auto-renewal failing` / `still retrying` / `still failing · <slug>` | idem, episódio transitório | mesmo `select` acima — `token_error_mode`/`token_alert_attempt_at` mostram há quanto tempo o cron tenta | Até 69 h o cron continua tentando sozinho. Só agir quando o texto virar `still failing` (aí o **Reconnect** do card em `/cms/settings/instagram` já é primário). |
| `Instagram token expiring without renewal · <slug>` | `expiring_clean` (§3.3 passo 3) | mesmo `select` acima, conferir `token_error is null` | A renovação automática não pegou e o token vence em ≤ 7 dias: **Reconnect** em `/cms/settings/instagram` agora, não esperar o próximo ciclo. |
| `Instagram cron degraded` | `step_errors` (§3.3/§3.4 passo 6) | `curl -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health` (mesma chamada do `health-watch.yml`, C2) | Sentry com `component: instagram-token-refresh` ou `instagram-sync` e a tag `step`. O run terminou; alguma etapa não. Máximo 1 push/dia por cron. |
| `Instagram blob store at <N> MB` | censo semanal (§3.4 passo 3) | — | Prefixo `instagram/` acima da linha de 400 MB. Rodar a limpeza de blobs órfãos descrita em **Superfície de OAuth (C3) → Blob store**. |
| `Instagram blob census truncated at <N> objects` | idem, teto de páginas/tempo | — | **Nenhuma comparação de tamanho foi feita.** Paginar `list({ prefix: 'instagram/', cursor, limit: 1000 })` à mão antes de concluir qualquer coisa. |
| `Instagram callback signature mismatch` | `signed-request.ts` (§3.1 passo 4) | — | Sentry → tag `route` (`deauthorize` \| `data-deletion`) e o segredo usado. Quase sempre `INSTAGRAM_APP_SECRET` divergindo do App Dashboard. Guarda de 60 s em memória + 1 claim/dia. |
| `Instagram deletion request matched no account` | `ddmismatch` (§3.1 passo 7) | — | **Nada foi apagado.** Ver a entrada `ddmismatch` em *Superfície de OAuth (C3)* antes de qualquer ação manual — casar por igualdade apagaria dados de terceiro. |
| `Instagram ops probe` (priority `min`) · `Instagram ops heartbeat` (priority `low`) | sonda diária / heartbeat de 5 d | `curl -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health` | Sinal de vida do canal, não incidente. O alarme é a **ausência**: `no heartbeat accepted for 8d` aparece no `status:'error'` dos crons. |

**Nenhum push chegou e você suspeita do canal.** Primeiro comando: `curl -H "Authorization: Bearer
$CRON_SECRET" https://bythiagofigueiredo.com/api/health` — os dois crons devolvem `alert_channels: {
probe, heartbeat, alerts }` e, quando escalam, `status:'error'` com a causa nomeada: `NTFY_URL unset`,
`terminal refusal (HTTP n)`, `transient for 2 runs`, `no heartbeat accepted for 8d`, `fallback email
dead`, `vault unavailable: SOCIAL_MASTER_KEY missing/malformed`. O e-mail **"Instagram alert channel
down"** (ou **"Instagram token storage unavailable"**) é o segundo canal. Se `/api/health` não responde
nada (timeout/DNS/000) e o e-mail também não chegou, o suspeito é o watchdog do home-lab, não o
Instagram: `journalctl -u cron-watchdog -n 50 --no-pager` no host (`.github/workflows/health-watch.yml`
e o `check.sh` do home-lab são a terceira perna).

## Superfície de OAuth (C3)

- **Rotas:** `GET /api/instagram/oauth` (início, auth-gated), `GET /api/instagram/oauth/callback`
  (retorno, `maxDuration = 120`), `POST /api/instagram/deauthorize` e
  `POST /api/instagram/data-deletion` (públicas, autenticadas pelo `signed_request`, `maxDuration = 60`),
  e a página pública `/data-deletion?code=<32 hex>`.
- **Onde registrar os callbacks na Meta:** App Dashboard > Instagram > *API setup with Instagram login* >
  *3. Set up Instagram business login* > *Business login settings* (Instagram App ID = `client_id`);
  o *Data Deletion Request URL* também aparece em *App Dashboard → Settings*. As Redirect URIs
  registradas estão coladas verbatim na seção "Gates de C3" — a doc avisa que o Dashboard "might have
  added a trailing slash", e um descasamento falha no passo 5 com `exchange_failed`, mensagem sobre a
  qual o dono não tem ação nenhuma.
- **`enable_fb_login=false`** esconde a opção de entrar pelo Facebook. Se a conta profissional só for
  alcançável pela conta do Facebook vinculada, a tela de login não oferece caminho: repetir a URL de
  autorização **sem** `enable_fb_login`.
- **iOS / navegador in-app:** o retorno caindo num WebView chega sem cookie de sessão nem nonce ⇒ a
  rota responde **400 `browser_changed`** ("Authorization finished in a different browser…"). Abrir o
  CMS no Safari/Chrome e repetir.
- **Mismatch de conta:** o banner "You authorized @X; this CMS account is @Y" reconecta em **um clique**
  (segunda autorização **sem** senha, fixada por `allowRebindTo`). O cookie de mismatch vale 10 min.
- **Cola manual** continua sendo fallback permanente (`Paste token manually`), inclusive em preview e
  quando `INSTAGRAM_*`/`SOCIAL_MASTER_KEY` faltam.
- **Blob store:** `Remove` apaga a conta e os posts, **não** os blobs. Limpeza (comando pronto):
  paginar `list({ prefix: 'instagram/', cursor, limit: 1000 })`, agrupar por `instagram/<accountId>/`,
  `del(urls)` dos prefixos cujo `<accountId>` já não existe em `instagram_accounts`.
- **Pedido de exclusão travado:** linha em `instagram_deletion_requests` com `completed_at is null` há
  mais de 10 min é retomada pelos **dois** crons — `instagram-token-refresh` (11:00 UTC) e
  `instagram-sync` (13:00 UTC), um pedido por run cada — e pelo replay da Meta após 90 s.
  A página pública diz "in progress" até `completed_at` — **nunca** afirma conclusão com base no
  `requested_at`.
- **`ddmismatch`:** push "Instagram deletion request matched no account" = o `payload.user_id` da Meta
  não casou nenhuma linha `oauth`, mas existe uma linha `legacy` com o mesmo id. Nada foi apagado —
  decidir manualmente (a linha `legacy` veio de outro app e casar por igualdade apagaria dados de
  terceiro).
```

- [ ] **Step 4: `docs/ops/social-api-reviews-runbook.md`**

Acrescentar ao fim:

```markdown
## Instagram feed (Instagram API with Instagram Login) — desde 2026-09-06

- Escopo pedido no OAuth: **`instagram_business_basic`** apenas. O callback recusa a conexão com
  `permission_denied` quando a permissão não volta em `permissions`.
- Consentimento registrado por conexão: categoria **`social_feed_read`** (texto em `consent_texts`,
  versão 1.0, pt-BR + en).
- Callbacks registrados na Meta: `POST /api/instagram/deauthorize` e `POST /api/instagram/data-deletion`
  (verificação por `signed_request`, HMAC-SHA256 com o `INSTAGRAM_APP_SECRET`).
- URL pública de status do pedido de exclusão: `/data-deletion?code=<confirmation_code>` — `noindex`,
  fora do sitemap, `Referrer-Policy: no-referrer`.
```

- [ ] **Step 5: `docs/ops/runbook-cms-e2e-local.md` — E2E local do OAuth**

Acrescentar ao fim:

```markdown
## Instagram OAuth — E2E local (5 min, autenticado)

Pré-requisito: túnel HTTPS local (o `http://localhost` é recusado como Redirect URI) **ou** o host de
loopback declarado em `sites.domains` (o `resolveOAuthOrigin` aceita loopback fora de produção).

1. `npm run dev -w apps/web`, entrar no CMS e abrir `/cms/settings/instagram`.
2. Clicar em **Connect with Instagram** e conferir, no DevTools (aba Network, "Preserve log"), que a
   resposta é **302** para `https://www.instagram.com/oauth/authorize?...` com
   `scope=instagram_business_basic`, `enable_fb_login=false` e **sem** `force_reauth`.
3. Sem completar na Meta, abrir manualmente
   `/api/instagram/oauth/callback?code=fake&state=<o state da URL do passo 2>` na MESMA janela
   (o cookie de nonce está no navegador): a página do popup mostra
   **"Instagram rejected the authorization"** e o opener sai de `In progress`.
4. Conferir que o card voltou ao estado anterior e que `/cms/settings/instagram` redireciona para
   `/cms/settings?section=instagram`.
```

- [ ] **Step 6: `plano-custo-zero.md` e os dois docs de 2026-05-07**

1. Em `docs/ops/plano-custo-zero.md`, no item 3, registrar a divergência em vez de herdá-la:

```markdown
3. **Conferir no dashboard** se há aviso de cota: o banco esteve em 884 MB e o Free tier limita
   500 MB. **Divergência registrada:** a linha 6 deste documento diz **93 MB** e esta dizia
   "hoje está em 363 MB" — as duas não foram reconciliadas. A aritmética da entrega de Instagram
   OAuth (< 10 MB por commit: `instagram_sync_log` ≤ ~1,5 k linhas, `ops_alert_state` ~15 chaves +
   `sigreq:`/`ddpage:` com retenção de 2 d, `instagram_deletion_requests` 180 d) fecha com qualquer
   um dos dois números.
```

2. No item 4 do mesmo documento, substituir a descrição do incidente do Instagram por:

```markdown
4. **Instagram** — o token expirou 2026-09-04 porque a renovação falhava em silêncio desde
   2026-08-31. Fechado pela entrega de 2026-09-06: refresh diário `"0 11 * * *"`, probe de toda conta
   às `"0 13 * * *"`, alerta por ntfy + CMS + e-mail e reconexão de um clique em
   `/cms/settings/instagram`.
```

3. Em `docs/superpowers/specs/2026-05-07-instagram-feed-design.md` e
   `docs/superpowers/plans/2026-05-07-instagram-feed.md`, atualizar os blocos de `vercel.json` (as duas
   linhas idênticas) para a agenda em vigor e anotar o motivo:

```json
{ "path": "/api/cron/instagram-sync", "schedule": "0 13 * * *" },
{ "path": "/api/cron/instagram-token-refresh", "schedule": "0 11 * * *" }
```

```markdown
> **Atualizado em 2026-09-06:** a renovação deixou de ser semanal (`0 6 * * 1`) e passou a ser
> **diária às 11:00 UTC**; o sync passou de `0 8 * * *` para **13:00 UTC**. 08:00/10:00 em
> `America/Sao_Paulo`. Motivo: um token que morre no domingo ficava invisível por até 7 dias.
```

Também trocar a linha `**Schedule:** \`0 6 * * 1\` (weekly, Mondays at 06:00 UTC)` do design doc por
`**Schedule:** \`0 11 * * *\` (daily, 11:00 UTC = 08:00 America/Sao_Paulo)`.

- [ ] **Step 7: Política de privacidade v1.4 (en + pt-BR)**

Nos **dois** arquivos:

1. Front-matter e cabeçalho: `version: "1.4"`, `effectiveDate: "2026-09-06"`, e a linha
   `**Version 1.4 — effective since September 6, 2026.**` / `**Versão 1.4 — em vigor desde 6 de setembro de 2026.**`.

2. Na Seção 2 (dados coletados), acrescentar um item logo depois do de *Social media management* /
   *Gestão de redes sociais*:

   *en:*
```markdown
- **Instagram feed on the home page (site configuration):** when the site owner connects an Instagram professional account with one click, we store an OAuth access token (encrypted at rest), the account's numeric identifiers, its public username, and a copy of the public posts and images displayed on the home page. Consent is recorded under the `social_feed_read` category. Data comes from Meta Platforms, Inc. (USA, under standard contractual clauses) and images are cached on Vercel while the account stays connected.
```

   *pt-BR:*
```markdown
- **Feed do Instagram na página inicial (configuração do site):** quando o dono do site conecta uma conta profissional do Instagram com um clique, armazenamos um token de acesso OAuth (cifrado em repouso), os identificadores numéricos da conta, o nome de usuário público e uma cópia dos posts e imagens públicos exibidos na página inicial. O consentimento é registrado na categoria `social_feed_read`. Os dados são obtidos da Meta Platforms, Inc. (EUA, sob cláusulas contratuais-padrão) e as imagens ficam copiadas na Vercel enquanto a conta estiver conectada.
```

3. Na Seção 7 (*How to exercise your rights* / *Como exercer seus direitos*), acrescentar como último
   item da lista, antes do parágrafo de e-mail:

   *en:*
```markdown
- **Instagram data deletion (no login):** a deletion request sent by Meta for a connected Instagram account is executed immediately (token, cached posts, cached images and sync history) and the status is published at [**/data-deletion**](/data-deletion), reachable by the confirmation code Meta receives. A record of the request (account identifier and date) is retained for up to 180 days as proof of processing.
```

   *pt-BR:*
```markdown
- **Exclusão de dados do Instagram (sem login):** um pedido de exclusão enviado pela Meta para uma conta do Instagram conectada é executado imediatamente (token, posts em cache, imagens em cache e histórico de sincronização) e o status fica publicado em [**/data-deletion**](/data-deletion), acessível pelo código de confirmação que a Meta recebe. O registro do pedido (identificador da conta e data) é mantido por até 180 dias como prova do tratamento.
```

4. Na Seção 13 (histórico de versões), acrescentar como **primeiro** item da lista:

   *en:*
```markdown
  - v1.4 — 2026-09-06 — documentation of the **Instagram feed** connection (one-click OAuth, `social_feed_read` consent category, encrypted token at rest, cached posts and images on Vercel) and of the **Instagram data-deletion callback** with its public status page `/data-deletion` (180-day record of the request).
```

   *pt-BR:*
```markdown
  - v1.4 — 2026-09-06 — documentação da conexão do **feed do Instagram** (OAuth de um clique, categoria de consentimento `social_feed_read`, token cifrado em repouso, posts e imagens copiados na Vercel) e do **callback de exclusão de dados do Instagram** com a página pública de status `/data-deletion` (registro do pedido por 180 dias).
```

- [ ] **Step 8: Conferir que os testes de conteúdo legal continuam verdes**

Run: `cd apps/web && npx vitest run test/app/lgpd test/lib/env.test.ts test/components/legal-shell.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add CLAUDE.md apps/web/.env.example apps/web/.env.local.example \
        docs/ops/instagram-token-alert-runbook.md docs/ops/social-api-reviews-runbook.md \
        docs/ops/runbook-cms-e2e-local.md docs/ops/plano-custo-zero.md \
        docs/superpowers/specs/2026-05-07-instagram-feed-design.md \
        docs/superpowers/plans/2026-05-07-instagram-feed.md \
        apps/web/src/content/legal/privacy.en.mdx apps/web/src/content/legal/privacy.pt-BR.mdx
git commit -m "$(cat <<'EOF'
docs(instagram): runbooks, CLAUDE.md e politica de privacidade v1.4

Ordem dos oito commits e rollback inverso, curl obrigatorio nos dois crons
apos C2, envs INSTAGRAM_*, espelho auth-nextjs 2.2.0; runbook de OAuth
(callbacks na Meta, enable_fb_login, in-app browser, mismatch, limpeza de
blobs, ddmismatch), E2E local, agenda diaria nos docs de 2026-05-07 e
divergencia de tamanho do banco registrada; privacidade v1.4 com o feed do
Instagram e a pagina /data-deletion.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
```

---

### Task 18: Push único, promoção e verificação pós-deploy (incl. o gate móvel)

**Files:**
- Modify: `docs/ops/instagram-token-alert-runbook.md` (seção "Pós-deploy C3" com as evidências)

**Interfaces:**
- Consumes: tudo que as Tasks 2–17 entregaram.
- Produces: o intervalo de shas de C3 registrado (o rollback de §7 continua sendo **um** comando).

- [ ] **Step 1: Verificação local completa antes do push (é o único push)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
npm run build:packages
cd apps/web && npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run build
cd .. && npx tsc --noEmit -p apps/api/tsconfig.json
```
Expected: suíte inteira verde (~160 s), typechecks limpos, `next build` verde.
**Se qualquer um falhar, NÃO empurrar** — cada push dispara 4 builds na Vercel.

- [ ] **Step 2: Push único e promoção**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git log --oneline origin/staging..staging          # confirmar que só os commits de C3 estão aqui
git push origin staging
# esperar a CI de `staging` ficar verde (typecheck + test + audit + secret-scan + seo-smoke)
gh run watch
git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

- [ ] **Step 3: Registrar o intervalo de shas de C3**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
FIRST=$(git log --format='%H %s' staging | grep 'OAuth de um clique (rotas + UI)' | tail -1 | cut -d' ' -f1)
LAST=$(git rev-parse staging)
echo "C3 range: $FIRST..$LAST"
```

Acrescentar ao runbook:

```markdown
## Pós-deploy C3

**Intervalo de commits (rollback é um comando só):**
```
C3 = <FIRST>..<LAST>
git revert --no-commit <FIRST>^..<LAST> && git commit -m "revert(instagram): C3 — OAuth de um clique"
```
Ordem obrigatória de rollback: **C3 → C4 → C2 → C1 → B → A5 → A4 → A**. Reverter C2 **exige** o passo
de banco descrito em §7 do design doc — "só reverter o deploy" está proibido para C2.
```

- [ ] **Step 4: Checagens pós-deploy de §7 passo 5**

```bash
# (a) Referrer-Policy efetivo (o valor do bloco global é strict-origin-when-cross-origin)
curl -sI 'https://bythiagofigueiredo.com/api/instagram/oauth/callback' | grep -i -E 'referrer-policy|cache-control'
curl -sI 'https://bythiagofigueiredo.com/data-deletion?code=00000000000000000000000000000000' | grep -i referrer-policy
# esperado: no-referrer nos dois; no-store no callback

# (b) 302 do início, SEM force_reauth (com o cookie de sessão do CMS)
curl -sI -b "<cookie de sessão>" 'https://bythiagofigueiredo.com/api/instagram/oauth?account_id=<uuid>' \
  | grep -i location
# esperado: .../oauth/authorize?...&scope=instagram_business_basic&...&enable_fb_login=false  (sem force_reauth)

# (c) 405 nas rotas públicas via GET
curl -s -o /dev/null -w '%{http_code}\n' https://bythiagofigueiredo.com/api/instagram/deauthorize
curl -s -o /dev/null -w '%{http_code}\n' https://bythiagofigueiredo.com/api/instagram/data-deletion
# esperado: 405 405
```

- [ ] **Step 5: Gate móvel de ponta a ponta (bloqueante — §7 "Gates antes de C3")**

Executado agora porque exige o código promovido; **se falhar, rollback pelo Step 3**.

1. Forçar um alerta de teste numa conta de teste:
   ```sql
   update instagram_accounts
      set token_error = 'expired', token_error_at = now() - interval '1 day', token_alert_attempt_at = null
    where id = '<conta de teste>';
   ```
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/instagram-token-refresh`
2. **No aparelho do dono**, tocar o `Click` do push e completar até **"Connected!"**:
   - **iOS Safari** com o app do Instagram instalado;
   - **Android Chrome**.
3. Se o iOS abrir o app do Instagram e o retorno cair no navegador in-app (sem cookie de sessão nem
   nonce ⇒ **400 `browser_changed`**), registrar a mitigação no runbook (deep link que force o
   navegador padrão) — o texto já orienta a abrir no Safari/Chrome.
4. Conferir no card: `Connected · renews automatically · last renewal just now · Expires in 59 days ·
   Syncing your feed…` e, depois do segundo `router.refresh()`, `last sync just now`.
5. Conferir a trilha: `select mode, status, error_message from instagram_sync_log
   where account_id = '<conta>' order by created_at desc limit 3` ⇒ a primeira linha é
   `manual` / `completed` com `detail: instagram_business_basic`.

- [ ] **Step 6: Callbacks da Meta e desligamento do flag**

1. Desautorizar o app em *Instagram → Configurações → Apps e sites* e conferir no Sentry a tag do
   segredo usado na verificação do `signed_request` (`INSTAGRAM_APP_SECRET` esperado).
2. Confirmando que o `INSTAGRAM_APP_SECRET` é o correto, **remover** `INSTAGRAM_ALLOW_META_SECRET_FALLBACK`
   das envs de produção (ele expira sozinho em 2026-10-06, mas o desligamento manual é o gate).
3. Reautorizar pelo CMS e conferir que a conta volta a `Connected`.
4. Pedido de exclusão de teste (pela Meta): conferir
   `select requested_at, completed_at from instagram_deletion_requests order by requested_at desc limit 1`
   com `completed_at` preenchido, `list({ prefix: 'instagram/<accountId>/' })` **vazio**, e a página
   `/data-deletion?code=<code>` bilíngue (`?lang=pt-BR` preserva o `?code=`).
5. Um pedido para um `user_id` desconhecido responde **200 com `{ url, confirmation_code }`** mesmo
   sem casar conta nenhuma.

- [ ] **Step 7: Conferir o CTA no alerta**

```sql
select message from notifications
 where type = 'system.token_expired' and created_at > now() - interval '1 day'
 order by created_at desc limit 1;
```
Esperado: termina em `— reconnect at https://bythiagofigueiredo.com/cms/settings/instagram`.

- [ ] **Step 8: Commit da evidência**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add docs/ops/instagram-token-alert-runbook.md
git commit -m "$(cat <<'EOF'
docs(instagram): evidencia pos-deploy de C3

Intervalo de shas de C3 (rollback em um comando), Referrer-Policy efetivo no
callback e em /data-deletion, 302 sem force_reauth, 405 nas rotas publicas,
gate movel iOS/Android concluido ate "Connected!", callbacks da Meta
exercitados e INSTAGRAM_ALLOW_META_SECRET_FALLBACK desligado.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0138fFUQirKdQhpc5vY92G4s
EOF
)"
git push origin staging && git checkout main && git merge --ff-only staging && git push origin main && git checkout staging
```

---

## Ordem de execução e dependências

```
1  gates §7 ──────────────────────────────────────────────┐
2  start route                                            │
3  callback (state → escrita)  ← 2 (state assinado)       │
4  after() + trilha rebind     ← 3                        │
5  signed-request + deauthorize + middleware              │
6  data-deletion route           ← 5, deletion.ts (C2)     │
7  LegalShell                                             │
8  /data-deletion page + next.config  ← 6, 7              │
9  locale-rules + actions             ← 3 (cookie)        │
10 page.tsx + props                   ← 3 (cookie), 9     │
11 instagram-status.ts                                    │
12 card: estados + modificadores      ← 10, 11            │
13 OAuth buttons + listener + mismatch ← 12, 9, 2         │
14 Sync Now/Remove/Disconnect/Add     ← 13, 9             │
15 notificações                                           │
16 RECONNECT_CTA + suíte + build      ← todas             │
17 docs + privacidade                                     │
18 push único + promoção + pós-deploy ← 16, 17 ───────────┘
```
