# Instagram OAuth Reconnect — Índice dos planos de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each plan task-by-task, **in the order below**. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar/reconectar o feed do Instagram com um clique (OAuth), renovar o token automaticamente e alertar o dono no mesmo dia quando algo quebra — sem colar token.

**Architecture:** Oito commits sequenciais em `staging`, cada um entregável e revertível por si (`git revert`), na ordem **A → A4 → A5 (condicional) → B → C1 → C2 → C4 → C3**. Cada commit passa pela CI antes do seguinte. Detalhe em `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md` (Revisão 14), §0.

**Tech Stack:** Next.js 16.3.4 (App Router, `after()`, `revalidateTag(tag, { expire: 0 })`), React 19, TypeScript 5 strict, Supabase (PostgreSQL 17, PostgREST, RLS, `SECURITY DEFINER`), Vitest (happy-dom default; `// @vitest-environment node` para código de servidor), `@vercel/blob` 2.5.0, `@tn-figueiredo/social/vault` (AES), ntfy, Sentry, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-instagram-oauth-reconnect-design.md`

## Planos (ordem de execução)

| # | Commit | Plano | Depende de |
|---|---|---|---|
| 1 | **A** — `fix(instagram)!: fechar vazamentos vivos + base de observabilidade (sync-log, redact)` | `2026-09-06-instagram-oauth-a.md` | — |
| 2 | **A4** — `fix(middleware): strip trusted headers` | `2026-09-06-instagram-oauth-a4.md` | — |
| 3 | **A5** (condicional) — transporte do Sync Now conforme gate pós-A | `2026-09-06-instagram-oauth-a5.md` | A (gate medido) |
| 4 | **B** — `chore(oauth): extrair helpers para src/lib/oauth` + testes | `2026-09-06-instagram-oauth-b.md` | — |
| 5 | **C1** — `feat(instagram): schema de saúde do token (expand)` | `2026-09-06-instagram-oauth-c1.md` | — |
| 6 | **C2** — `feat(instagram): renovação observável (backend)` | `2026-09-06-instagram-oauth-c2.md` | A, C1 |
| 7 | **C4** — `chore(instagram): drop da unique global de ig_media_id (contract)` | `2026-09-06-instagram-oauth-c4.md` | C2 (≥ 1 ciclo das 13:00) |
| 8 | **C3** — `feat(instagram): OAuth de um clique (rotas + UI)` | `2026-09-06-instagram-oauth-c3.md` | A, B, C2 |

Rollback: ordem inversa obrigatória `C3 → C4 → C2 → C1 → B → A5 → A4 → A`; C2 exige passo de banco (spec §7).

## Global Constraints (valem para todos os planos)

- Caminhos relativos a `apps/web/` salvo `docs/`, `supabase/`, `packages/`, `scripts/`, `.github/`, `CLAUDE.md` (raiz). **Dois** diretórios de lib: `apps/web/lib/` (`lib/home/queries.ts` cacheia o feed público; `lib/cms/site-context.ts`; `lib/supabase/service.ts`) e `apps/web/src/lib/` (`src/lib/instagram/*`, `src/lib/notifications/*`, `src/lib/logger.ts`, `src/lib/cron-health.ts`, `src/lib/env.ts`, `src/lib/sentry-pii.ts`). Há dois `queries.ts` — sempre qualificar.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`; `@/lib/<domínio>/*` mapeia para `apps/web/lib/` só para 16 prefixos; `instagram`, `oauth`, `ops`, `notifications` caem no catch-all `@/*` → `src/`.
- TypeScript: nunca `any`; Zod para validação; arquivos kebab-case; interfaces com prefixo `I`; colunas snake_case.
- Ratchet Next 16 (`test/unit/use-server-exports.test.ts:20-23`): em arquivos `'use server'` só `export async function` / `export type` / `export interface` / `export { type … }`.
- Nunca passar `next/link` (ou componente importado num Server Component) como prop para client component.
- Server actions de escrita chamam `requireEditAccess()` (→ `{ siteId, userId }` a partir de C2) no topo; `getSupabaseServiceClient()` só após guard de site.
- Testes: `// @vitest-environment node` para rota/lib de servidor; `jsdom` para componente client; sanitizers nunca sob happy-dom; fixtures temporais relativas ou com `vi.useFakeTimers`; fix de teste vai no mesmo commit.
- Migrations: **sempre** `npm run db:new <nome>`; idempotentes (`drop … if exists` antes de `create`); `db:reset` → `db:types` → commit → `db:push:prod`. Banco local tem resíduo de rodadas de revisão: `npm run db:reset` antes de validar M1.
- `revalidateTag(tag, { expire: 0 })` — segundo argumento obrigatório; `await cookies()`.
- Commits: `tipo: descrição curta` (`feat`, `fix`, `chore`, `refactor`, `docs`, `ci`); trabalhar direto em `staging`; sem force-push; sem `git stash`/`reset`; **push só após verificação local completa** (cada push dispara builds na Vercel).
- Pré-commit roda `build:packages` + typecheck web/api (~60 s). CI roda testes. Vercel roda `next build`.
- `SOCIAL_MASTER_KEY` fora de `env.ts`; `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` lidos de `process.env` direto (declarados `.optional()` em `serverSchema`).
- Definições nomeadas do spec valem por nome: `CAMPOS_DE_EPISÓDIO` (5 campos), horários `"0 11 * * *"` / `"0 13 * * *"`, `REGRA-PII-NTFY` (nenhum push carrega `@handle`, ids, tokens; título identifica o site por `sites.slug`).
- Plano Vercel **Pro** confirmado (2026-09-06). Fuso do dono decidido: `America/Sao_Paulo`, horários mantidos.
