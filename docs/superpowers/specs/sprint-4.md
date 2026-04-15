# Sprint 4 — Package Extraction, Observability & LGPD Retention Design

**Data:** 2026-04-15 (kickoff)
**Sprint:** 4
**Horas estimadas (rough):** ~40h
**Depende de:** Sprint 3 ✅
**Desbloqueia:** Sprint 5 (SEO + deploy hardening), onboarding do 2º consumer do `@tn-figueiredo/cms`

## Goal

Fechar as dívidas técnicas que o Sprint 3 deixou em aberto para poder onboardear o 2º consumer do ecossistema (`tonagarantia` é candidato imediato) e subir o nível de operação em produção:

1. **Empire readiness** — extrair `@tn-figueiredo/cms` e `@tn-figueiredo/email` para repos próprios e publicar `v0.1.0` em GitHub Packages, removendo o workspace symlink + `transpilePackages`.
2. **Confiança em RPCs** — cobrir com testes de integração (gated em `HAS_LOCAL_DB=1`) os RPCs críticos que hoje só têm mock: `confirm_newsletter_subscription`, `unsubscribe_via_token`, `update_campaign_atomic`, `cron_try_lock` / `cron_unlock`.
3. **Observabilidade** — instrumentar Sentry (`SENTRY_*` já reservadas desde Sprint 0) em `apps/web` + `apps/api` e padronizar logs estruturados nos cron jobs (`console.error({job, err_code, site_id, ...})` JSON) para que o oncall pare de depender de `grep` em Vercel function logs.
4. **LGPD retention** — implementar anonymização em `unsubscribe` (hoje apenas flipa status) e cron de purge de `sent_emails` após 90 dias (documentado no Sprint 3 spec mas deferido).

## Exit criteria

- [ ] `@tn-figueiredo/email@0.1.0` publicado em `@tn-figueiredo` GitHub Packages, `apps/web` consome pinned, sem workspace symlink
- [ ] `@tn-figueiredo/cms@0.1.0` idem — repo `TN-Figueiredo/cms` criado via `git subtree split`, tag `v0.1.0`, CI publica via workflow
- [ ] `transpilePackages` removido do `next.config.ts` (ambos packages shipam `dist/` pré-buildado) — middleware Edge runtime OK
- [ ] `packages/cms` e `packages/email` removidos do monorepo (`git rm -r`)
- [ ] Novo suite `test/integration/rpcs.test.ts` (web) com `describe.skipIf(skipIfNoLocalDb())` cobrindo os 5 RPCs
- [ ] Sentry DSN configurado em Vercel + `@sentry/nextjs` + `@sentry/node` wired; erros dos cron jobs + server actions chegam no dashboard
- [ ] Todos `/api/cron/*` emitem logs JSON estruturados (`{job, run_id, status, err_code?, site_id?, duration_ms}`) — substituem `console.log` ad-hoc
- [ ] Unsubscribe anonymiza row: `email` → SHA-256 hash, `ip`/`user_agent` → `NULL`, mantém `site_id` + `unsubscribed_at` para accountability
- [ ] Cron `/api/cron/purge-sent-emails` roda diário, deleta `sent_emails` com `sent_at < now() - interval '90 days'`, emite contagem via log estruturado
- [ ] CI green em todos workspaces; pre-commit hook green; smoke test em scratch project importando ambos packages pinned

---

## Épicos

> Numeração dá continuidade ao sprint-3: **T46** começa onde Sprint 3 parou. Estimativas são rough (calibrar no kickoff).

### Epic 6 — `@tn-figueiredo/cms` extraction + publish (~10h)

Objetivo: mover `packages/cms/` para repo próprio, publicar `v0.1.0`, consumer (`apps/web`) passa a consumir pinned.

**Tasks:**
- **T46** — version bump `0.1.0-dev` → `0.1.0`, remover `"private": true`, auditar `exports` map e `files` do `package.json`
- **T47** — `gh repo create TN-Figueiredo/cms --private`; `git subtree split --prefix=packages/cms -b cms-extract` + push como `main`
- **T48** — setup `.npmrc` + `.github/workflows/publish.yml` (tag `v*` → `npm publish` para GitHub Packages) + `ci.yml` (typecheck + test) no repo extraído
- **T49** — LICENSE + README audit; tag `v0.1.0-beta.1` primeiro pra validar workflow, depois `v0.1.0`
- **T50** — smoke test: scratch project importa `@tn-figueiredo/cms@0.1.0`, compila Next 15 app vazio consumindo `PostEditor`
- **T51** — `apps/web/package.json`: `"@tn-figueiredo/cms": "*"` → `"0.1.0"`; remover entry de `transpilePackages` em `next.config.ts`; rodar `npm install` + web build + smoke `middleware` (Edge import)
- **T52** — `git rm -r packages/cms` + remover do `npm workspaces`; CI + todos os testes green

**Dependencies:** nenhuma (primeiro no sprint). Bloqueia T51 do Epic 7 (transpilePackages removal share the `next.config.ts`).

**Risco:** `transpilePackages` removal quebra Edge runtime no middleware (R1 herdado do Sprint 3). Mitigação: rodar `next dev` + request real em `/` antes de merge; rollback mantém `transpilePackages` temporário.

### Epic 7 — `@tn-figueiredo/email` extraction + publish (~6h)

Objetivo: mesmo pattern do Epic 6, para `packages/email/`. Menos arriscado (não tem Edge runtime dependency).

**Tasks:**
- **T53** — version bump + audit `exports` (esp. templates subpath + `helpers/unsubscribe-token`)
- **T54** — `gh repo create TN-Figueiredo/email --private`; subtree split + push
- **T55** — CI/publish workflows (mesmo shape do Epic 6)
- **T56** — tag `v0.1.0-beta.1` → `v0.1.0`
- **T57** — smoke test: scratch project importa `BrevoEmailAdapter` + 1 template, compila
- **T58** — swap `apps/web` para pinned + remover entry de `transpilePackages`
- **T59** — `git rm -r packages/email`; tests green

**Dependencies:** pode rodar em paralelo com Epic 6 até T51/T58. A remoção final do `transpilePackages` consolida numa PR.

### Epic 8 — DB-gated integration tests for RPCs (~8h)

Objetivo: cobrir com testes reais (local Supabase) os RPCs que hoje só têm mock, conforme carry-over CLAUDE.md.

**Tasks:**
- **T60** — `apps/web/test/integration/rpc-confirm-newsletter.test.ts` — seed pending subscription, call RPC, assert status flip + token invalidation
- **T61** — `apps/web/test/integration/rpc-unsubscribe.test.ts` — valid token path + expired/used token error paths
- **T62** — `apps/web/test/integration/rpc-update-campaign.test.ts` — atomic update (patch + translation_patch), concurrent update rejection, RLS enforcement (non-staff user → deny)
- **T63** — `apps/web/test/integration/cron-locks.test.ts` — `cron_try_lock` returns false on held lock, `cron_unlock` releases, TTL expiry path
- **T64** — helper `seedSite()` em `apps/web/test/helpers/db-seed.ts` (reutilizável entre suites)
- **T65** — documentar pattern em `CLAUDE.md` "Testes com DB local" section (append)

Todos usam `describe.skipIf(skipIfNoLocalDb())`. CI não roda (HAS_LOCAL_DB não está setado), mas `npm run db:start && HAS_LOCAL_DB=1 npm test` local roda.

**Dependencies:** nenhuma — pode rodar em paralelo com Epics 6/7. Não bloqueia ninguém mas dá confiança para refatorar os RPCs quando precisar.

### Epic 9 — Observability: Sentry + structured cron logs (~9h)

Objetivo: substituir grep-driven debugging por Sentry dashboard + logs JSON parseáveis em Vercel.

**Tasks:**
- **T66** — Sentry setup web: `npm install @sentry/nextjs` (pin), `sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`, wire `instrumentation.ts`
- **T67** — Sentry setup api: `@sentry/node` no Fastify bootstrap, capture `onError` hook
- **T68** — `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` configurados em Vercel (web) + api host; dev fallback (no-op if DSN empty)
- **T69** — `apps/web/lib/logger.ts` — helper `logCron(event: {job, run_id, status, err_code?, site_id?, duration_ms, ...})` que emite JSON single-line
- **T70** — refatorar cron handlers: `publish-scheduled`, `sync-newsletter-pending`, `purge-sent-emails` (Epic 10), `send-campaign-broadcast` se existir — todos usam `logCron`
- **T71** — server actions: wrap erros críticos com `Sentry.captureException(err, { tags: { site_id, action } })` — especialmente invite accept, campaign publish, newsletter confirm
- **T72** — sanity: gerar erro proposital em staging, verificar que chega no Sentry com `site_id` tag

**Dependencies:** Epics 6/7 idealmente antes (para evitar retrabalho — Sentry config toca `next.config.ts`). Pode sobrepor com Epic 10 (usa o mesmo `logCron`).

### Epic 10 — LGPD: unsubscribe anonymization + sent_emails 90-day purge cron (~7h)

Objetivo: fechar os dois gaps LGPD reconhecidos no Sprint 3 spec como "Sprint 4".

**Tasks:**
- **T73** — migration `20260418000001_newsletter_anonymize_on_unsubscribe.sql` — extend `unsubscribe_via_token` RPC para anonymizar: `email = encode(digest(email, 'sha256'), 'hex')`, `ip = NULL`, `user_agent = NULL`, mantém `site_id` + `unsubscribed_at`. Também anonymiza `newsletter_subscriptions` row correspondente (unique index em `(site_id, email_hash)` pra evitar re-subscribe loops).
- **T74** — migration `20260418000002_contact_submissions_anonymize_on_request.sql` — RPC `anonymize_contact_submission(p_id)` (admin-only) para right-to-be-forgotten pontual.
- **T75** — migration `20260418000003_sent_emails_purge_fn.sql` — função `purge_sent_emails(p_older_than_days int default 90)` `SECURITY DEFINER` que deleta e retorna contagem.
- **T76** — cron route `apps/web/src/app/api/cron/purge-sent-emails/route.ts` — auth `CRON_SECRET`, chama `purge_sent_emails(90)`, loga via `logCron` (Epic 9 T69). `vercel.json` agenda diário (03:00 America/Sao_Paulo).
- **T77** — testes: unit de RPCs + integration (gated, via Epic 8 helpers) + e2e do cron (chamar endpoint com mock clock)
- **T78** — docs: `CLAUDE.md` "Database RLS helpers" seção ganha anexo de retention policies (já documentado inline no sprint-3 spec — consolidar em CLAUDE.md)

**Dependencies:** Epic 9 T69 (logger) para cron estruturado. Epic 8 helpers úteis mas não bloqueante.

---

## Dependency order (resumo)

```
Epic 6 (cms extract) ─┐
Epic 7 (email extract) ┴─► Epic 9 (Sentry+logger) ─► Epic 10 (LGPD cron, usa logger)
Epic 8 (RPC integration tests) — paralelo, independente
```

Epics 6 e 7 compartilham o final (`next.config.ts` cleanup + `npm install`); podem ser mergeados numa PR ou duas sequenciais. Epic 8 pode rodar a qualquer momento. Epics 9 e 10 são seriais no logger.

---

## Out of scope (Sprint 5+)

- Supabase Auth Hooks para password-reset email branded (mencionado Sprint 3 fora-escopo)
- Privacy policy + Terms + cookie banner (UI)
- Right-to-be-forgotten self-service flow (T74 já deixa RPC pronta; UI admin/user é Sprint 5)
- MFA em login
- Admin observability dashboard (visualização de `cron_runs`, `sent_emails` metrics)
- Newsletter broadcast sending UI
- Sentry performance tracing (só errors em Sprint 4)

## Riscos

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| `transpilePackages` removal quebra middleware Edge runtime | 30% | alto | testar `next dev` com request real a rota protegida antes de merge; rollback path documentado |
| Publish workflow de package falha em produção (GitHub Packages perms) | 20% | médio | `v0.1.0-beta.1` dry run antes de `v0.1.0` |
| Sentry noise overwhelming em staging | 25% | baixo | `tracesSampleRate: 0.1`, `ignoreErrors` para erros conhecidos (ex: Turnstile timeout) |
| `purge_sent_emails` deleta rows ainda referenciadas por debug em produção | 15% | médio | arquivar em `sent_emails_archive` table antes de DELETE; TTL configurável |
| SHA-256 de email colide com consulta admin "qual foi o último email desse endereço?" | 20% | baixo | manter `email_hash` column + doc explicando; fluxo admin usa hash para lookups pós-anonymization |
| Integration tests flaky em CI caso alguém seta `HAS_LOCAL_DB=1` sem DB up | 10% | baixo | `skipIfNoLocalDb()` já protege; doc em CLAUDE.md reforça |

## Decisões de design a confirmar no kickoff

| Tópico | Proposta | Alternativa |
|---|---|---|
| Sprint 4 scope integral vs split | Integral ~40h | 4a (extract only) + 4b (obs+LGPD) |
| Sentry SDK pin version | latest stable (~8.x) | pin major atual do ecossistema @tn-figueiredo |
| Anonymization hash function | `sha256(email)` raw hex | HMAC com site-specific salt (mais privacy mas perde cross-site dedup) |
| Purge retention | 90d hard delete | soft-delete via `archived_at` + hard delete 365d |
| Package repo naming | `TN-Figueiredo/cms` + `TN-Figueiredo/email` | `TN-Figueiredo/packages-cms` (verbose) |
| Publish channel | GitHub Packages (já em uso) | npmjs público (rejeitado — private fica em GH) |

---

### Status (2026-04-15)

Partial ship — observability + LGPD infrastructure landed; package extraction deferred.

**Shipped:**
- Epic 8 (RPC integration tests) — `test/integration/rpc-*.test.ts` suites gated on `HAS_LOCAL_DB=1` (cron-locks, confirm-newsletter, unsubscribe, update-campaign).
- Epic 9 (Observability) — `@sentry/nextjs` wired in `instrumentation.ts` + `sentry.{server,edge,client}.config.ts`; `captureServerActionError` helper in `src/lib/sentry-wrap.ts` wired to invite/campaign/newsletter-confirm/newsletter-subscribe/contact-submit/unsubscribe/contact-mark-replied paths; `withSentryConfig` gated on full `SENTRY_AUTH_TOKEN`+`SENTRY_ORG`+`SENTRY_PROJECT` trifecta so local/branch builds don't noisily fail source-map upload; `sendDefaultPii: false` + `beforeSend: scrubEventPii` (regex email redaction) in all three init sites.
- Epic 10 (LGPD retention) — `unsubscribe_via_token` RPC anonymizes row (email→sha256 hex, ip/user_agent/locale→NULL); re-subscribe flow handles hashed-email rows via `.or()` filter + in-place update that restores raw email on double-opt-in; `sent_emails` 90d purge RPC + cron; `contact_submissions` anonymize-on-request RPC.

**Deferred → Sprint 4.1 (or next carry-over):**
- Epic 6 (`@tn-figueiredo/cms` extraction, T46–T52) — workspace package still consumed via `transpilePackages`; `git subtree split` + repo creation + publish pending.
- Epic 7 (`@tn-figueiredo/email` extraction, T53–T57) — same posture.

**Rationale:** extraction requires a clean bisect-friendly window (single atomic PR removing workspace + `transpilePackages` + flipping pinned versions) which doesn't fit a hardening round. Shipping observability+LGPD first keeps prod-safety high while the extraction window is scheduled.

**Test counts at ship:** 263 web tests passing (+15 integration skipped — gated on local DB), 4 api tests passing.
