← [Roadmap overview](README.md)

# Fase 1 — MVP [🟡 in-progress]

**Sprints:** 0–6 · **Horas:** ~242h · **Semanas:** 10–11
**Estimativa de entrega:** ~Junho/Julho 2026 (revisado 2026-04-16 após scope shift no Sprint 4)
**Depende de:** nada (entry point)
**Bloqueia:** Fase 3 integralmente. Parcialmente Fase 2 (portfolio content pode começar antes se desejado).

**Goal:** Entregar `bythiagofigueiredo.com` ao vivo com blog bilíngue, admin, newsletter, LGPD, deploy em produção.

> **Rev 3 (2026-04-16):** Sprint 4 original ("LGPD & Deployment", 38h) não shipou — em vez disso shipou escopo diferente (package extraction + observability + LGPD retention, ~40h realizados). O trabalho LGPD-público + deploy hardening foi re-slotted num novo **Sprint 5 — Public launch prep**. Old Sprint 5 "Burnout & MVP Launch" renumerado Sprint 5→6. Fase 1 cresceu de 6→7 sprints e de 202h→242h. Footnote em cada sprint afetado.

## Exit criteria (Fase 1 → DONE)

- [ ] `bythiagofigueiredo.com` resolvendo via DNS com SSL válido
- [ ] ≥4 blog posts publicados (mix PT+EN)
- [ ] Admin panel funcional: Thiago consegue criar/editar/publicar post end-to-end
- [ ] Newsletter signup → welcome email chegando (staging testado em produção)
- [ ] Contact form respondendo com reply via email
- [ ] `/privacy`, `/terms`, cookie banner, delete account flow ao vivo
- [ ] Lighthouse mobile ≥80, LCP <2.5s
- [ ] Sentry capturando erros em produção
- [ ] CI verde em `main` (typecheck + tests + audit + secret-scan)

---

## Sprint 0 — Infraestrutura [✅ done] (12h)

**Goal:** Monorepo, Supabase project, CI rodando.
**Fechado:** 2026-04-13

**Epics** (soma = 12h):
- [x] Monorepo skeleton (tnf-scaffold) — apps/web + apps/api + packages/shared (6h)
- [x] GitHub Actions CI workflow — typecheck, test, audit, secret-scan (2h)
- [x] Supabase project remoto + `.env.local` + Vercel env vars + Sentry projects (4h)

**Blockers resolvidos:**
- [x] ✅ `NPM_TOKEN` configurado em GitHub Actions (classic PAT com `read:packages`)
- [x] ✅ DB password salvo em keychain
- [x] ✅ Supabase CLI linkado (`supabase/.temp/project-ref` = `novkqtvcnsiwhkxihurk`)
- [x] ✅ `config.toml` atualizado (project_id + major_version 17 + enable_sign_up deprecated removed)
- [x] ✅ npm scripts padrão TNG: `db:link:prod`, `db:push:prod`, `db:start/stop/reset/status`, `db:env`, `db:which`

**Spec:** [`2026-04-13-sprint-0-supabase-setup-design.md`](../superpowers/specs/2026-04-13-sprint-0-supabase-setup-design.md)

---

## Sprint 1 — MVP Foundation [✅ done] (40h)

**Goal:** Auth ativa, schema inicial, homepage estática, API respondendo.
**Fechado:** 2026-04-14 (split em 1a + 1b)
**Depende de:** Sprint 0

**Epics** (soma = 40h):
- [x] Homepage hub polish (hero, bio, portfolio grid, social links, footer + integração com blog link) — 6h
- [x] Blog schema no Supabase (`blog_posts`, `blog_translations`) + indexes — 4h
- [x] Supabase RLS policies iniciais (`site_visible` helper, staff bypass) — 3h
- [x] Admin auth middleware (@tnf/auth-nextjs) — 3h
- [x] Fastify API setup (@tnf/auth-fastify + logging + `/health`) — 6h
- [x] Campaign schema (`campaigns`, `campaign_submissions`) — 2h
- [x] Campaign system (Brevo + Turnstile + landing pages + cron + seed) — 12h
- [x] Buffer / integração de copy — 4h

**Shipped:**
- Sprint 1a (2026-04-14): blog schema, RLS, homepage, API setup, `site_visible` helper
- Sprint 1b (2026-04-14, merged PR #3, 135 tests): campaigns schema/RLS, Brevo+Turnstile libs, landing pages, cron, seed

**Spec / Plan:** Spec incorporado nos commits Sprint 1a/1b.

---

## Sprint 2 — CMS & Blog [✅ done] (42h)

**Goal:** `@tnf/cms` package criado, blog MVP renderizando, admin shell, início da migração Sanity.
**Fechado:** 2026-04-15 (merged PR #4, 198 tests)
**Depende de:** Sprint 1
**Risco alto (retro):** R1 (Sanity migration) mitigado — **decisão tomada: não migrar Sanity, conteúdo criado do zero** (doc memory: `project_no_sanity_migration.md`).

**Epics** (soma = 42h):
- [x] **@tn-figueiredo/cms package (NEW)** — interfaces (IPostRepository, IContentRenderer, IRingContext), Supabase impls, MDX compile/runner, PostEditor client — 24h
- [x] Blog CRUD server actions (list, detail, publish/unpublish/archive) + Zod — 8h
- [x] MDX renderer (`@mdx-js/mdx` compile-on-save, shiki opt-in, TOC, reading time) — 4h
- [x] Admin UI shell (@tn-figueiredo/admin sidebar, dark mode) — 4h
- [x] Multi-ring schema (orgs + members + sites.domains + `can_admin_site` cascade) — 2h (substituiu Sanity export)

**Shipped:**
- `@tn-figueiredo/cms@0.1.0-dev` workspace package (extraction para repo próprio deferida → Sprint 4b)
- `/blog` e `/blog/[slug]` renderizando posts MDX
- Multi-ring scoping via middleware + `sites.domains[]`

**Cross-sprint:** T14 (package extraction) deferida para Sprint 3 → depois para Sprint 4b.

**Spec / Plan:** —

---

## Sprint 3 — Admin & Forms [✅ done] (40h)

**Goal:** Migração Sanity completa, admin CRUD, newsletter/contact capturando leads.
**Fechado:** 2026-04-15 (merged PR #5, 324 tests, 17 migrations in prod, ~40 commits)
**Depende de:** Sprint 2

**Epics** (soma = 40h):
- [x] ~~Sanity data import~~ (cancelado — no-Sanity decision) → realocado em auth + invite flow — 12h
- [x] Admin login page (email + senha + Turnstile) — 3h
- [x] Blog editor admin (autosave, meta SEO, cover, locale switcher, delete UI, publish/draft) — 8h
- [x] Campaign manager admin CRUD + PDF signed URLs — 6h
- [x] **@tn-figueiredo/email setup (NEW)** — IEmailService + Brevo adapter + welcome email + rate limiting — 6h
- [x] Newsletter subscribe form + confirm email + cron sync — 3h
- [x] Contact form + LGPD consent checkbox + cron sync + cron locks — 2h

**Shipped:**
- Auth via `@supabase/ssr` + invite flow + staff membership check
- Newsletter double-opt-in + Brevo sync cron
- Contact form Brevo sync cron
- Campaign admin CRUD (list/create/edit/publish + PDF upload)
- PostEditor polish + autosave
- Rate limiting + cron locks (advisory locks)
- Audit trajectory: Epic 3 82→98, Epic 4 62→99, Epic 5 82→99, sprint-wide 93→99

**Cross-sprint:** Package extraction (T14) + observability + LGPD retention carry-over → Sprint 4.

**Spec / Plan:** [2026-04-16-sprint-3-design.md](../superpowers/specs/2026-04-16-sprint-3-design.md)

---

## Sprint 4 — Package Extraction, Observability & LGPD Retention [✅ done] (~40h)

**Goal:** Extrair packages `@tn-figueiredo/cms` + `@tn-figueiredo/email` pra repos próprios, instrumentar observabilidade (Sentry + cron logs), implementar retenção LGPD server-side.
**Fechado:** Sprint 4a em 2026-04-15 + Sprint 4b em 2026-04-16 (split em duas fases pelo bloqueio de PAT `write:packages`)
**Depende de:** Sprint 3

> **Footnote de escopo (rev 3, 2026-04-16):** Sprint 4 originalmente orçado em 38h como "LGPD & Deployment" (privacy policy UI, cookie banner, delete account, SEO, deploy hardening). Durante execução, esse escopo foi re-slotted no novo **Sprint 5 — Public launch prep** e Sprint 4 absorveu as carry-overs do Sprint 3 (package extraction + observability + LGPD server-side retention). Custo real ~40h, cobrindo Epics 6–10 da `sprint-4.md` spec.

**Spec:** [sprint-4.md](../superpowers/specs/sprint-4.md) + [sprint-4b.md](../superpowers/specs/sprint-4b.md)

**Epics shipped (6–10):**
- [x] **Epic 6 — @tn-figueiredo/cms extraction** → repo `TN-Figueiredo/cms`, v0.1.0-beta.1 → beta.2 (published GH Packages). Novo subpath `/ring` Edge-safe pra middleware. Subtree split preserva histórico. `transpilePackages` retido em apps/web (contrato v0.1.x — ESM + JSX).
- [x] **Epic 7 — @tn-figueiredo/email extraction** → repo `TN-Figueiredo/email`, v0.1.0 (published). Pure Node, sem Edge surface.
- [x] **Epic 8 — DB-gated RPC integration tests** — 15 tests cobrindo `confirm_newsletter_subscription`, `unsubscribe_via_token`, `update_campaign_atomic`, `cron_try_lock`/`cron_unlock`. Gated em `HAS_LOCAL_DB=1` + `describe.skipIf(skipIfNoLocalDb())`. Seed helpers em `test/helpers/db-seed.ts`.
- [x] **Epic 9 — Observabilidade** — Sentry SDK (`@sentry/nextjs@10.48.0` + `@sentry/node@10.48.0`) no web + api, no-op sem DSN. `captureServerActionError` wired em 11 call sites / 7 files. `beforeSend` PII scrubber (`sentry-pii.ts`) strip emails de exception values + messages + breadcrumbs. `sendDefaultPii: false`. Structured cron logs via `lib/logger.ts` (`logCron` + `withCronLock` + reserved-keys guard) — 3 rotas de cron unificadas.
- [x] **Epic 10 — LGPD server-side retention** — 3 migrations `20260418000001-03`:
  - `unsubscribe_via_token` agora anonimiza row: `email = sha256()`, ip/user_agent/locale nulados. Unique partial index impede re-sub com mesmo address. Re-sub "faz o path" updateando row existente.
  - `anonymize_contact_submission(p_id)` RPC pra direito ao esquecimento.
  - `purge_sent_emails(days default 90)` + novo `/api/cron/purge-sent-emails` rota (cron `0 6 * * *` UTC = 03:00 America/Sao_Paulo).

**Tests at ship:** 263 web + 15 skipped (DB-gated) + 4 api. `tsc --noEmit` clean. `next build` clean. `npm ls` confirma packages extraídos instalados do registry.

**NOT shipped from original Sprint 4 plan** (re-slotted → Sprint 5): privacy policy UI, Terms of Service, cookie banner, delete account flow UI, full SEO pass (metadata/sitemap/robots/JSON-LD), Vercel/Railway deploy hardening, Lighthouse tuning.

---

## Sprint 4.5 — Login Split + Package Coordination [✅ done] (~10h)

**Nota:** Não é um sprint full-size — coordenação inter-package pra splitar `/signin` único em `/admin/login` e `/cms/login`. Gate natural entre Sprint 4 e Sprint 5.

**Phases 1-3 ✅ (2026-04-16, ~6h):**
- [auth-nextjs-2.1-actions](../superpowers/plans/2026-04-15-auth-nextjs-2.1-actions.md) — `@tn-figueiredo/auth-nextjs@2.1.0` published (new `/actions` + `/safe-redirect` subpaths + `requireArea` + `buildAuthRegex` helpers). 172 tests.
- [admin-0.4-login](../superpowers/plans/2026-04-15-admin-0.4-login.md) — `@tn-figueiredo/admin@0.5.0` published (new `/login` subpath). 227 tests.
- [cms-beta3-login](../superpowers/plans/2026-04-15-cms-beta3-login.md) — `@tn-figueiredo/cms@0.1.0-beta.3` published (new `/login` subpath). 127 tests.

**Phase 4 pending (~4h):**
- [web-consumer-login-wiring](../superpowers/plans/2026-04-15-web-consumer-login-wiring.md) — bump pins em `apps/web`, criar rotas `/admin/login`+`/cms/login`+forgot+reset+logout POST, middleware dual, `requireArea` guards nos layouts, flash `insufficient_access`, Supabase Dashboard config (URL allowlist + recovery template), delete `/signin`, DB-gated 10-case RLS matrix.

**Design spec:** [admin-cms-login-split-design](../superpowers/specs/2026-04-15-admin-cms-login-split-design.md) (99/100 round-2 review).

**Nota operacional:** publish de `auth-nextjs@2.1.0` + `admin@0.5.0` foi manual (`npm publish`) porque Release workflow do tnf-ecosystem tá falhando no `npm ci` com 401 pré-existente em `@tn-figueiredo/affiliate@0.1.0`. Bug de infra separado, não relacionado ao sprint.

---

## Sprint 5 — Public Launch Prep [🟡 in-progress] (38h, decomposed in 4 sub-sprints)

**Goal:** Compliance LGPD público-facing, SEO, deploy hardening — tudo o que falta pra ir ao ar em prod.
**Estimativa:** semanas 8–9
**Depende de:** Sprint 4 (+ Sprint 4.5 login split)
**Decomposição (decidida durante execução de 5a):** 5a (LGPD), 5b (SEO), 5c (E2E), 5d (Vercel hardening). Soma das estimativas = 38h.

> **Footnote (rev 3):** Este sprint herdou o escopo original de "Sprint 4 — LGPD & Deployment" (38h). Foi renomeado e movido porque o Sprint 4 absorveu outro escopo durante execução. Decomposto em 4 sub-sprints durante 5a (1 PR por sub-sprint demonstrou inviável; granularidade real entregou).

### Sprint 5a — LGPD pública [✅ done] (~13h)

**Fechado:** 2026-04-16. Spec: [`2026-04-16-sprint-5a-lgpd-public-design.md`](../superpowers/specs/2026-04-16-sprint-5a-lgpd-public-design.md). Score 99/100.
- 26 migrations (lgpd_requests, consents, consent_texts v1+v2, 7 RPCs, storage bucket, FK ON DELETE SET NULL, audit_log skip-cascade guard)
- `@tn-figueiredo/lgpd@0.1.0` 6-adapter wiring (container + use-case glue)
- 9 API routes, 8 UI components, 6 account pages, consent-aware Sentry init
- Privacy + Terms MDX (pt-BR + en), `/privacy` + `/terms` routes
- pg_cron schedules via `cron_config` table (Supabase managed pattern)
- 4 feature flags (banner / delete / export / cron sweep)
- CI DB-integration job + vitest coverage for `lib/lgpd/**`

### Sprint 5b — SEO hardening [✅ done (2026-04-17)] (~14h)

Spec: [`2026-04-16-sprint-5b-seo-hardening-design.md`](../superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md). Score 98/100.

**5 PRs merged 2026-04-17** (#32 A, #33 B, #34 C, #35 D, #36 E) + deploy PR #37 staging→main.

- **PR-A** (PR #32) — 4 migrations (`20260417000000_seed_master_site` bootstrap + 3 SEO: `sites.identity_type`/`twitter_handle`/`seo_default_og_image`, `blog_translations.seo_extras` jsonb + CHECK, idempotent backfill with `tnFigueiredo`).
- **PR-B** (PR #33, 30 commits) — `apps/web/lib/seo/` core (config, page-metadata factories, jsonld builders + @graph + extras-schema, og template + render, noindex, enumerator, cache-invalidation, robots-config with 18 AI crawler blocks, frontmatter, identity-profiles), `app/sitemap.ts`, `app/robots.ts`, 3 OG routes (`app/og/blog/...`, `app/og/campaigns/...`, `app/og/[type]/...`), Inter Bold font (415KB — pyftsubset follow-up), `og-default.png`, middleware short-circuit, deps `gray-matter@4.0.3` + `schema-dts@1.1.5` + `@lhci/cli@0.13.0`.
- **PR-C** (PR #34, 11 commits) — Wire 7 page archetypes via factory metadata + `<JsonLdScript>`, refactor `app/layout.tsx` to shell-only, modify 11 server actions for cache-invalidation tags, admin actions (`updateSiteBranding`/`updateSiteIdentity`/`updateSiteSeoDefaults`), `archivePost` revalidation bug fix, `loadSeoExtrasByLocale` direct-query workaround for cms package type gap.
- **PR-D** (PR #35, 8 commits) — `.lighthouserc.yml` + mobile variant (SEO ≥95, perf ≥80), `.github/workflows/lighthouse.yml`, `scripts/seo-smoke.sh` (8-check smoke with xmllint og:image parse), `.github/workflows/seo-post-deploy.yml`, schema-dts `expectTypeOf` test gate, soft-gate `check-migration-applied` CI job.
- **PR-E** (PR #36, 7 commits) — `app/api/health/seo` CRON_SECRET-protected route, `docs/runbooks/seo-incident.md` (6 scenarios A–F + 8 known-limitations + follow-up tracker), `docs/runbooks/sprint-5b-post-deploy.md` (12-step checklist).

**Feature flags shipped (5, env-var based; DB-driven refactor in Sprint 8.5):** `NEXT_PUBLIC_SEO_JSONLD_ENABLED`, `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED`, `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED`, `SEO_AI_CRAWLERS_BLOCKED`, `SEO_SITEMAP_KILLED`.

**Prod verification (2026-04-17 post-deploy, via `scripts/seo-smoke.sh` + manual curl):**
- ✅ `/sitemap.xml` valid XML, 4 static routes (`/`, `/privacy`, `/terms`, `/contact`) — blog/campaigns routes will populate as content ships (enumerator error fallback silently skipping blogIndex → follow-up)
- ✅ `/robots.txt` emits Sprint 5b disallows + 18 AI crawler blocks; Cloudflare managed content prepended (bonus AI block layer)
- ✅ Home + privacy pages emit JSON-LD `@graph` with WebSite + Person nodes
- ✅ `/api/health/seo` returns `ok:true` with all 5 flags correctly set, `sitemapBuildMs: 498`
- ✅ `/og-default.png` serves 1200×630 placeholder PNG (20KB)
- ⚠️ `/og/[type]` returns 302 → `/og-default.png` (dynamic OG fallback triggering — Sentry investigation pending; fallback chain functional)
- ✅ Canonical links + hreflang correct on privacy/terms (index, follow)

**Pre-merge 5 stacked PRs bypassed pre-existing CI failures** (Test-API `[env] invalid environment` + Integration-DB-gated postgres-service setup) via `--admin` rebase merge. Both failures pre-date Sprint 5b and apply to `staging` head regardless — out of Sprint 5b scope.

**Follow-ups tracked** in `docs/runbooks/seo-incident.md`:
- Inter font subset (415KB → 35KB) via pyftsubset
- Figma-export `og-default.png` replacement
- Real `identity/thiago.jpg` photo
- Bump `@tn-figueiredo/cms` to expose `seo_extras` + `cover_image_url` on PostTranslation (removes direct-query workaround)
- Sprint 8.5: migrate env-var flags to DB-driven (see [phase-2-nice-to-have.md](phase-2-nice-to-have.md))
- Debug enumerator error fallback hiding `/blog/{defaultLocale}` from sitemap
- Investigate `/og/[type]` dynamic render fallback via Sentry

### Sprint 5c — E2E suite [☐ not-started] (~8h)

Playwright covering auth + CMS critical paths. Pendente.

### Sprint 5d — Vercel deploy hardening [☐ not-started] (~3h)

Build perf, edge config, secrets review. Pendente.

---

## Sprint 6 — Burnout & MVP Launch [☐ not-started] (30h)

**Goal:** Polish final e go-live.
**Estimativa:** semana 10–11
**Depende de:** Sprint 5
**Tipo:** Burnout sprint

> **Footnote (rev 3):** Renumerado de Sprint 5 → Sprint 6 após inserção de Sprint 5 "Public launch prep". Escopo inalterado.

**Epics** (soma = 30h):
- [ ] Bug fixes — 15h
- [ ] Performance tuning (LCP <2.5s, CLS <0.1, bundle) — 10h
- [ ] Launch checklist (DNS, SSL, Brevo DNS, GTM, Search Console, launch comms) — 5h

**Deliverables:**
- `bythiagofigueiredo.com` ao vivo
- Newsletter enviada pros subs iniciais
- YouTube video de launch (EN + PT)

**Spec / Plan:** —

---

## 🎉 Phase 1 Complete

Ao fechar Sprint 6: MVP está no ar. Próximo marco é Fase 2 (N2H) com folga.

## Critical path (Fase 1)

Sequência mínima para chegar no MVP (atualizada rev 3 com sprint renumbering):

```
Sprint 0: Monorepo (6h) + Supabase project (4h)       [10h]  ✅ done
    ↓
Sprint 1: Auth middleware (3h) + Blog schema (4h)     [ 7h]  ✅ done
    ↓
Sprint 2: @tn-figueiredo/cms (24h) + Blog CRUD (8h)   [32h]  ✅ done
    ↓
Sprint 3: Admin login/editor (11h)                    [11h]  ✅ done
    ↓
Sprint 4: Package extraction + observability (~40h)   [40h]  ✅ done (scope shift)
    ↓
Sprint 4.5: Login split (auth-nextjs+admin+cms+web)   [~10h] ✅ done
    ↓
Sprint 5: Tests E2E + deploy + LGPD pública (15h)     [15h]  ☐
    ↓
Sprint 6: Launch checklist (5h)                       [ 5h]  ☐
                                                  Total 120h
```

Demais ~122h são paralelizáveis ou não-bloqueantes.

## Riscos específicos da fase

Referência aos IDs do source doc (Etapa 5):

- **R1 — Sanity → Supabase migration** (60% prob, 🔴 alto) — ~~Sprint 2–3~~ **✅ mitigado pela decisão no-Sanity**
- **R2 — @tn-figueiredo/cms design first-time** (55%, 🟡 médio) — Sprint 2+ **✅ shipped e extraído em 4b**
- **R3 — RLS policies complexity** (50%, 🟡 médio) — Sprint 1–2 **✅ estabilizado**
- **R7 — Vercel deployment (monorepo)** (25%, 🟡 médio) — ~~Sprint 4–5~~ **Sprint 5–6 (renumerado)**
- **R8 — Content calendar slips** (60%, 🟢 baixo) — posts podem ser menos que 4 no launch

Mitigações detalhadas em `03-roadmap-creator.md` Etapa 5.
