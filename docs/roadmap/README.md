# bythiagofigueiredo — Roadmap

> Hub Pessoal + CMS Engine ("OneRing") do ecossistema @tnf/*
> **Source of truth de execução:** este diretório.
> **Rationale de produto e scoring:** `~/Workspace/ideias/bythiagofigueiredo/` (docs 01–05, 2026-04-12).

**Versão:** 2026-04-17 · **Revisão:** 8 (CI hardening ✅ — PR #39+40, migrations 20260501000004-6 em prod)

## Visão macro

| Fase | Sprints | Horas | Semanas | Status | Arquivo |
|------|:-------:|:-----:|:-------:|:------:|---------|
| **1 — MVP** | 0–6 | ~242h | 10–11 | 🟡 in-progress (Sprints 0–4.5 + 5a ✅; 5b stacked PRs open; 5c/5d/6 pending) | [phase-1-mvp.md](phase-1-mvp.md) |
| **2 — Nice-to-Have** | 7–10 | 152h | 7 | ☐ not-started | [phase-2-nice-to-have.md](phase-2-nice-to-have.md) |
| **3 — CMS Hub Distribution** | 11–12 | 70h | 3 | ☐ not-started | [phase-3-cms-hub.md](phase-3-cms-hub.md) |
| **Total** | 12 | **~464h** | **20–21** | | |

> **Nota sobre totais (rev 3, 2026-04-16):** source doc original reportava 202h / Fase 1, assumindo Sprint 4 = "LGPD & Deployment" (38h). Durante execução, Sprint 4 shipou outro escopo (package extraction + observability + LGPD retention, ~40h realizados) e o trabalho de LGPD público/deploy foi re-slotted num novo Sprint 5 — "Public launch prep". Burnout/MVP Launch renumerado Sprint 5→6. Nova soma Fase 1: 12+40+42+40+40+38+30 = **242h** (+40h vs plano). Total global **~464h** (+40h). Sprints downstream da Fase 2/3 renumerados (+1). Este roadmap usa os valores per-sprint como autoridade de execução.

**Estimativa de timeline:** 20–21 semanas a partir de 2026-04-13 (~início de Setembro 2026, antes da viagem pra Ásia). Datas absolutas em cada fase são **estimativas**, sujeitas à velocidade real. (rev 3: +1–2 semanas vs plano original, por conta do scope shift do Sprint 4 e realocação do launch prep em Sprint 5.)

**Capacidade planejada:** 40h/week com burnout sprint (30h) a cada 4 sprints.

## Progresso global

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░  ~47% (218h / 464h — Sprints 0–5b + CI hardening ✅)
```

> Hours reconciled 2026-04-17: 12 (S0) + 40 (S1a+1b) + 42 (S2) + 40 (S3) + 40 (S4a+4b) + 10 (S4.5) + 13 (S5a) + 14 (S5b) + ~7 (S4.75 RBAC v3 — subset, já contabilizado em S4.75) = **~218h delivered**. Sprint 5c (~8h) + 5d (~3h) + Sprint 6 (30h) = ~41h restantes para MVP. Denominador 464h = Fase 1 (242h) + Fase 2 (152h) + Fase 3 (70h).

**Done até agora:**
- Sprint 0 ✅ — scaffold + CI + Supabase provisionado/linkado + Vercel/Sentry env vars + npm scripts de DB padrão TNG (~12h).
- Sprint 1a ✅ — blog schema, RLS, homepage, API setup, `site_visible` helper (2026-04-14).
- Sprint 1b ✅ — campaigns schema/RLS, Brevo+Turnstile libs, landing pages, cron, seed (2026-04-14, merged PR #3, 135 tests).
- Sprint 2 ✅ — `@tn-figueiredo/cms` package, multi-ring schema, blog MDX rendering, admin CRUD (2026-04-15, merged PR #4, 198 tests). T14 extraction deferred to Sprint 3.
- Sprint 3 ✅ — auth + invite flow, newsletter/contact forms + cron sync, campaign admin CRUD, PostEditor polish (autosave/meta SEO/cover/locale switcher/delete UI), rate limiting + cron locks. ~40 commits. Epic audit trajectory: Epic 3 82→98, Epic 4 62→99, Epic 5 82→99, sprint-wide 93→99. Package extraction (T14) + observability/LGPD carry-over ⇒ Sprint 4. Spec: [2026-04-16-sprint-3-design.md](../superpowers/specs/2026-04-16-sprint-3-design.md).
- **Sprint 4a ✅** — Epics 8+9+10 of sprint-4: DB-gated RPC integration tests (15 tests, gated `HAS_LOCAL_DB=1`), Sentry SDK wired web+api (`@sentry/nextjs` + `@sentry/node` + `captureServerActionError` + PII scrubber), structured cron logs (`logger.ts` + `withCronLock`), LGPD retention (unsubscribe anonymization via sha256, `anonymize_contact_submission` RPC, `purge_sent_emails` 90d cron). 263 web + 15 skipped + 4 api tests. 3 migrations `20260418000001-03` live em prod. Merged to main 2026-04-15. Spec: [sprint-4.md](../superpowers/specs/sprint-4.md).
- **Sprint 4b ✅** — Epics 6+7 of sprint-4: extracted `@tn-figueiredo/cms@0.1.0-beta.1/beta.2` (repo `TN-Figueiredo/cms`) + `@tn-figueiredo/email@0.1.0` (repo `TN-Figueiredo/email`) to own repos, published to GitHub Packages, apps/web consome versões pinadas. `transpilePackages: ['@tn-figueiredo/cms']` retido (contrato do package em v0.1.x — ESM + JSX preservado). Novo subpath Edge-safe `/ring` no cms permite middleware pular transpile. 263 web + 4 api tests. 12 commits merged to staging + auto-synced to main 2026-04-16. Spec: [sprint-4b.md](../superpowers/specs/sprint-4b.md).
- **Sprint 4.5 Phases 1-3 ✅ (2026-04-16)** — split do `/signin` monolítico preparado em 3 pacotes co-lançados:
  - `@tn-figueiredo/auth-nextjs@2.1.0` — new subpaths `/actions` (signInWithPassword, signInWithGoogle, signOutAction, forgot/reset + UI contract types `AuthPageProps`/`AuthTheme`/`AuthStrings`/`ActionResult`) + `/safe-redirect` (com overload `areaPrefix`); new helpers `buildAuthRegex` (middleware) + `requireArea('admin'|'cms')` (server, RPC-first + React-cache memoised, coexiste com `requireRole({resolver})` existente). 172 tests, 8 commits merged via PR #8 + `npm publish` manual (CI infra unrelated issue).
  - `@tn-figueiredo/admin@0.5.0` — new `/login` subpath: `<AdminLogin>`, `<AdminForgotPassword>`, `<AdminResetPassword>` + `getAdminAuthStrings` + `mergeTheme`/`buildThemeVars` utils + neutral slate preset. 227 tests, 9 commits merged via PR #9 + published manually.
  - `@tn-figueiredo/cms@0.1.0-beta.3` — new `/login` subpath: `<CmsLogin>`, `<CmsForgotPassword>`, `<CmsResetPassword>` + `getCmsAuthStrings` + neutral stone/zinc preset. 127 tests, 9 commits merged via PR #6 + tagged + auto-published.
  - Admin+cms shipam com UI types inlined + `TODO(phase4-consumer)` banner pointing to auth-nextjs/actions canonical; Phase 4 flip pendente.
  - Spec: [admin-cms-login-split-design](../superpowers/specs/2026-04-15-admin-cms-login-split-design.md) (99/100 round-2 review).
  - Plans: [auth-nextjs-2.1](../superpowers/plans/2026-04-15-auth-nextjs-2.1-actions.md) · [admin-0.4-login](../superpowers/plans/2026-04-15-admin-0.4-login.md) · [cms-beta3-login](../superpowers/plans/2026-04-15-cms-beta3-login.md).
  - Nota infra: tnf-ecosystem Release workflow falhou por `npm ci` 401 em `@tn-figueiredo/affiliate@0.1.0` (pré-existente, docs(adr) falhou mesma causa 5h antes) — destrave foi `npm publish` manual. Changesets Action precisa debug separado (lockfile orphan ou tarball removido do GH Packages).

- **Sprint 4.5 Phase 4 ✅ (2026-04-16)** — consumer wiring de `apps/web` landed em `staging` (13 commits, 253 tests passed + 25 skipped incluindo o novo RLS matrix DB-gated, typecheck green em ambos workspaces):
  - Pins bumped: auth-nextjs `2.0.0 → 2.1.1` (patch pra consertar 2 bugs de publish — `./server` subpath missing + UI types não re-exportados de `/actions`), admin `0.3.0 → 0.5.0`, cms `0.1.0-beta.2 → 0.1.0-beta.3`
  - Subpath smoke tests + type-equivalence test-d (AuthStrings + AuthTheme — ActionResult/AuthPageProps têm drift conhecido defer T10e)
  - Rotas criadas: `/admin/{login,forgot,reset,logout}`, `/cms/{login,forgot,reset,logout}` — logout POST-only com GET→405
  - Middleware com dual `createAuthMiddleware` dispatch por prefix
  - Route group `(authed)` split — authed content em `app/{admin,cms}/(authed)/`, públicas em `app/{admin,cms}/{login,forgot,reset,logout}/` — evita infinite redirect trap
  - `requireArea('admin'|'cms')` guards nos layouts `(authed)` — redirect hardcoded `/?error=insufficient_access`
  - Flash banner `insufficient_access` na home (`app/(public)/page.tsx`)
  - `/signin` tree + 27 tests antigos deletados; auth/callback com `areaLoginPath` helper; invite redirect purged
  - Security headers (`X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`) em todas 6 paths de auth
  - DB-gated 10-case RLS integration matrix (`test/integration/area-authorization.test.ts`) com HAS_LOCAL_DB=1 → 10/10 pass
  - Pré-existing typecheck errors em 5 test files corrigidos (`noUncheckedIndexedAccess` non-null asserts) — gate final truly green
  - Plan: [web-consumer-login-wiring](../superpowers/plans/2026-04-15-web-consumer-login-wiring.md). 13 commits: `02e9488`, `649686d`, `38e61c8`, `716645a`, `272808b`, `3bb126a`, `e0aa20d`, `adc5c45`, `106ad82`, `e106cfc`, `a743995`, `52d20e4`, `bed49f1`.
  - **Follow-ups pós-Phase 4 (2026-04-16)** — 3 patches adicionais landed na mesma data:
    - `@tn-figueiredo/cms@0.1.0-beta.4` — T10e executado: primitive types (`ActionResult`, `SignIn*`/`ForgotPassword`/`ResetPasswordInput`, `AuthTheme`, `AuthStrings`) flipados de inline pra imports de `@tn-figueiredo/auth-nextjs/actions`. `AuthPageProps`/`ForgotPasswordPageProps`/`ResetPasswordPageProps` ficam cms-local (narrower component-facing shapes pro padrão consumer-wraps-action). Published via `npm publish --tag beta`. PR #7 merged.
    - `@tn-figueiredo/auth-nextjs@2.1.1` — patch pra 2 bugs publish-time do 2.1.0: missing `./server` subpath no exports map + UI types não re-exportados de `/actions`. PR #10 merged, published manual.
    - `@tn-figueiredo/admin@0.5.1` — CHANGELOG.md + README.md agora shipam no tarball (antes só `dist/`). Types flip deferred pra 0.6.0 (workspace symlink complica DTS build). PR #11 merged, published manual.
    - Consumer bumps em `apps/web` (`a59dc4d`): admin 0.5.0→0.5.1, cms beta.3→beta.4. 255 tests, typecheck green em ambos workspaces.
    - Logout UI gap fechado (`2c03a0a`): POST forms em `/admin/(authed)/layout.tsx` + `/cms/(authed)/layout.tsx` (workaround até admin exportar `logoutPath` prop).
  - **Não-blocking, deferidos**: `requireArea` usa JWT-based `is_staff()` RPC (stale claim até refresh ~1h) — fix real requer nova RPC `is_member_staff()` lendo `organization_members`, schema work Sprint 5+; admin types flip → 0.6.0; CI Release workflows do tnf-ecosystem ainda bloqueados por `npm ci` 401 em `@tn-figueiredo/affiliate@0.1.0` (pré-existente).

- **Sprint 5a ✅ (2026-04-16)** — LGPD compliance: 26 migrations (lgpd_requests, consents, consent_texts v1+v2, 7 RPCs, storage bucket, FK ON DELETE SET NULL, audit_log skip-cascade guard), `@tn-figueiredo/lgpd@0.1.0` 6-adapter wiring (container + use-case glue), 9 API routes, 8 UI components, 6 account pages, consent-aware Sentry init, privacy+terms MDX (pt-BR+en), `/privacy` + `/terms` routes, CI DB-integration job, 4 feature flags (banner / delete / export / cron sweep), vitest coverage for `lib/lgpd/**` (90% thresholds). Prod DB on-schema; Vercel deploy via PR #24. Score 99/100. Spec: [2026-04-16-sprint-5a-lgpd-public-design.md](../superpowers/specs/2026-04-16-sprint-5a-lgpd-public-design.md).

- **Sprint 5b ✅ (2026-04-17)** — SEO hardening: 5 PRs merged em sequência A→B→C→D→E (#32-#36) + deploy PR #37 staging→main. Score 98/100. `apps/web/lib/seo/` wrapper sobre `@tn-figueiredo/seo@0.1.0` (16 módulos: config/page-metadata/jsonld/og/enumerator/cache-invalidation/etc), `app/sitemap.ts` + `app/robots.ts` + 3 OG routes (Node runtime, direct-host lookup per Next #58436), 7 archetypes wired com `<JsonLdScript>` @graph composition via schema-dts, 11 server actions com cache-invalidation tags + archivePost bug fix, admin site actions (branding/identity/defaults), Lighthouse CI (SEO ≥95 + mobile perf ≥80), `scripts/seo-smoke.sh` 8-check + `seo-post-deploy.yml` manual dispatch, `/api/health/seo` CRON_SECRET endpoint, `seo-incident.md` (6 scenarios + 8 known-limitations + follow-up tracker), `sprint-5b-post-deploy.md` 12-step checklist. 5 env-var feature flags (DB-driven refactor em Sprint 8.5). Prod verified: sitemap/robots/home/privacy/health green; OG dynamic falling back a static (Sentry investigation pending, non-blocking). Spec: [2026-04-16-sprint-5b-seo-hardening-design.md](../superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md). Plan: [2026-04-16-sprint-5b-seo-hardening.md](../superpowers/plans/2026-04-16-sprint-5b-seo-hardening.md) (72 tasks, 7796 linhas).

- **CI hardening ✅ (2026-04-17)** — PR #39 (5 fixes: API env, migration order, dev seed, health timeout, soft-gate) + PR #40 (drain 18 failing DB-gated tests + hard-gate Integration job). Correção de segurança: `lgpd_phase1_cleanup` guard usava `current_user` (no-op em SECURITY DEFINER) → migrado para `auth.role()`. Migrations `20260501000004-6` aplicadas em prod. CI 100% hard-gated.

**Sprint ativo:** nenhum.

**Próximo:** Sprint 5c (Playwright E2E, ~8h) — cobre auth + CMS critical paths ponta-a-ponta. Bloqueador de confiança para o MVP Launch.

## Legenda de status

```
☐ not-started    🟡 in-progress    ✅ done    ⏸ blocked    ❌ cancelled
```

Aplicada em 3 níveis: fase, sprint, epic.

## Packages novos a nascer deste projeto

Entregáveis de ecossistema — reutilizáveis em outros apps @tnf/*:

| Package | Sprint | Horas | Fase | Status | ROI estimado |
|---------|:------:|:-----:|:----:|:------:|:------------:|
| **@tn-figueiredo/cms** (NEW) | S2 + S4b extract + S4.5 /login | 24h + ~8h + ~3h | 1 | ✅ `v0.1.0-beta.4` published (canonical types) | ~60h poupadas em 5+ sites |
| **@tn-figueiredo/email** (NEW) | S3 setup + S4b extract | 6h + ~8h | 1 | ✅ `v0.1.0` published | ~48h em 6+ apps |
| **@tnf/storage** (NEW) | S9 (renumerado de S8) | 10h | 2 | ☐ | ~24h em 6+ apps |

## Como usar este roadmap (workflow superpowers)

Quando for hora de executar um sprint:

1. **Brainstorm** → `superpowers:brainstorming`
   - Gera spec em `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
2. **Plan** → `superpowers:writing-plans`
   - Gera plano em `docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md`
3. **Execute** → `superpowers:executing-plans` ou `superpowers:subagent-driven-development`
4. **Atualize o roadmap:**
   - Flip status do sprint/epic: ☐ → 🟡 → ✅
   - Adicione links `Spec:` e `Plan:` no campo do sprint
   - Commit: `docs(roadmap): close sprint N — <resumo>`

## Estrutura do diretório

```
docs/
├── roadmap/
│   ├── README.md              ← você está aqui
│   ├── phase-1-mvp.md
│   ├── phase-2-nice-to-have.md
│   └── phase-3-cms-hub.md
└── superpowers/
    ├── specs/                 ← design docs por milestone
    └── plans/                 ← implementation plans por milestone
```

## Context de produto (resumo)

**O que é:**
1. Site pessoal profissional (homepage, bio, portfolio, social)
2. Blog engine bilíngue (MDX + translations PT/EN)
3. Campaign & lead capture (newsletter, UTM tracking)
4. CMS Engine que distribui posts para N sites do ecossistema

**Stack:** Next.js 15, React 19, Tailwind 4, Fastify 5, Supabase, Brevo, Vercel, Turnstile, GTM.

**Reuso:** 9 de 13 packages @tnf/* aplicáveis (69%) + 3 packages novos (`@tnf/cms`, `@tnf/email`, `@tnf/storage`).

## Riscos globais (top 3 do source doc, Etapa 5)

| # | Risco | Prob | Impacto | Sprint | Mitigação |
|---|-------|:----:|:-------:|:------:|-----------|
| R1 | Sanity → Supabase migration complexity | 60% | 🔴 alto | S2–S3 | Script testado local; PortableText renderer como fallback; backup Sanity |
| R2 | @tnf/cms design first-time | 55% | 🟡 médio | S2+ | Interface-first; versionamento 0.x; TNG integration valida design |
| R5 | Thiago's availability (life events, YouTube) | 50% | 🔴 alto | transversal | Burnout sprint a cada 4; content batching; clear MVP finish line |

Lista completa de 9 riscos: `~/Workspace/ideias/bythiagofigueiredo/03-roadmap-creator.md` Etapa 5.

## Review cadence

- **Fim de cada sprint:** flip status, adicionar links Spec/Plan, commit `docs(roadmap): close sprint N`.
- **Fim de cada fase:** revalidar exit criteria, atualizar changelog abaixo, considerar se próxima fase precisa re-scoping.
- **Trimestral ou em mudança de contexto:** revisar riscos globais, confrontar estimativas vs realidade.

## Changelog

- **2026-04-17 rev8:** Sprint 5b ✅ + CI hardening ✅ (PR #39+40 — 18 integration test failures drained, Integration job hard-gated, security fix lgpd_phase1_cleanup guard, migrations 20260501000004-6 em prod). Progress ~47% (218h / 464h). Sprint ativo: nenhum. Próximo: Sprint 5c (Playwright E2E, ~8h).
- **2026-04-16 rev7:** Sprint 5a ✅ closed (LGPD pública — 26 migrations, 6-adapter wiring, 13h). Sprint 5b 🟡 in-progress (SEO hardening — 5 PRs stacked: A migrated; B/C/D/E pending merge + Vercel deploy + GSC/Bing submission). Progress ~42% (197h / 464h). Sprint 5 decomposto em 5a ✅ + 5b 🟡 + 5c ☐ + 5d ☐. Final ✅ flip para 5b pós-deploy via follow-up commit.
- **2026-04-16 rev3:** Sprint 4a + 4b fechados e documentados. Sprint 4 original (LGPD/deploy) re-slotted em Sprint 5 ("Public launch prep"). Progress bar atualizado para ~50%. Sprint ativo = inter-sprint "Login split + package coordination" em planejamento.
- **2026-04-13 rev2:** matemática de horas reconciliada, exit criteria por fase, rollup de packages, progresso corrigido, riscos linkados ao source.
- **2026-04-13 rev1:** versão inicial.

## Side-sprint update — 2026-04-13

- Package Ecosystem Migration iniciada
- Fase 0 (tnf-ecosystem hygiene): ✅ done
- Fase 1 (package migration): ✅ done — 23/24 packages em `@figueiredo-technology/*` (auth-expo mantido private)
- Spec: [2026-04-13-package-migration-to-figueiredo-technology-design.md](../superpowers/specs/2026-04-13-package-migration-to-figueiredo-technology-design.md)
- Fases restantes: 2 (bythiagofigueiredo) → 3 (TNG prod) → 3.5 (bright-tale) → 4 (kill NPM_TOKEN) → 5 (closeout)
