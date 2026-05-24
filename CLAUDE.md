# bythiagofigueiredo

Hub pessoal + CMS Engine do ecossistema `@tnf/*`.

## REGRA OBRIGATÓRIA: Build & Test antes de commitar

O pre-commit hook roda `next build` — **idêntico ao que Vercel executa**. Se passar local, passa no Vercel. Mas rodar o hook inteiro a cada tentativa desperdiça tempo. A regra é fazer tudo certo ANTES de commitar:

### Se mexeu em `packages/*/src/` (workspace packages):
1. Rodar `npm run build:packages` IMEDIATAMENTE após salvar as mudanças
2. Isso recompila `dist/` que `apps/web` e `apps/api` consomem
3. Sem isso, imports vão quebrar typecheck e next build

### Antes de commitar (SEMPRE):
1. `npm run build:packages` (se tocou em packages/ — na dúvida, rode)
2. `npm run test:web` ou `npm run test:api` (conforme o que mudou)
3. Se qualquer teste falhar → corrigir ANTES de tentar commit
4. O pre-commit hook é a rede de segurança final, não o fluxo principal

### Garantia Vercel:
O pre-commit roda `next build` (mesmo comando que Vercel usa). Se o commit passou, o deploy vai passar. **Nunca faça push esperando que "vai funcionar" — o hook local já provou que funciona.**

### O que NÃO fazer:
- NÃO commitar sem ter rodado `build:packages` se mexeu em packages/
- NÃO ignorar falha de hook e tentar de novo sem corrigir a causa
- NÃO usar `--no-verify` em commits de código (apenas docs/plans permitido)
- NÃO fazer push se o pre-commit falhou — cada push gasta 4 builds Vercel

## Tech Stack

| Camada | Stack |
|--------|-------|
| Web | Next.js 15 + React 19 + Tailwind 4 + TypeScript 5 |
| API | Fastify 5 + TypeScript 5 + Zod |
| DB | Supabase (PostgreSQL 17 + Auth + Storage) |
| Monorepo | npm workspaces |
| Tests | Vitest |
| Error tracking | Sentry |

## Database — Supabase CLI

**Single project (prod):** `novkqtvcnsiwhkxihurk` em org `ByThiagoFigueiredo` (region: São Paulo).

```bash
npm run db:link:prod         # Link CLI ao project remoto (uma vez)
npm run db:push:prod         # Push migrations pra prod (com confirmação YES)
npm run db:which             # Mostra qual project linkado
npm run db:start             # Sobe Supabase local via Docker
npm run db:stop              # Para containers
npm run db:reset             # Reset schema local
npm run db:status            # Status + endpoints locais
npm run db:env               # Gera .env.local-db com keys locais
```

### Nova migration

```bash
npm run db:new <nome_descritivo>   # OBRIGATÓRIO — gera timestamp sequencial correto
# Edita o arquivo em supabase/migrations/
npm run db:push:prod               # Push pra prod
```

**NUNCA criar arquivos de migration manualmente nem usar `npx supabase migration new`.**
O script `npm run db:new` garante que o timestamp é sempre posterior à última migration existente,
evitando erro de "out of order" que exigiria `--include-all`.

DB password salvo em keychain/1Password. Recuperar via Supabase Dashboard → Project Settings → Database.

## Testes com DB local

Tests que dependem de Supabase local gated em `process.env.HAS_LOCAL_DB`. Helper: `apps/{api,web}/test/helpers/db-skip.ts`.

```bash
npm run db:start && HAS_LOCAL_DB=1 npm test   # Completa
npm test                                        # Sem DB (CI default)
```

Convenção: `describe.skipIf(skipIfNoLocalDb())('<suite>', () => { ... })`. Integration tests em `apps/web/test/integration/`. Seed helpers em `apps/web/test/helpers/db-seed.ts`.

## Database RLS helpers

- Helpers em `public`: `user_role()`, `is_staff()`, `is_admin()`, `site_visible(uuid)`.
- Policies de leitura pública DEVEM usar `public.site_visible(site_id)` — nunca duplicar inline.
- GUC `app.site_id`: middleware seta por request. Vazio = sem filtro (admin). Inválido = fail closed.
- **Idempotência em migrations:** sempre `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`.

## Multi-ring RBAC v3

4 roles: `super_admin` (master ring org_admin), `org_admin`, `editor`, `reporter` (read/edit own only, no publish).

**Key RLS helpers (SECURITY DEFINER):** `is_super_admin()`, `is_org_admin(uuid)`, `can_view_site(uuid)`, `can_edit_site(uuid)`, `can_publish_site(uuid)`, `can_admin_site_users(uuid)`, `is_member_staff()` (DB-checked, closes JWT staleness).

**Publish guard:** trigger `enforce_publish_permission` blocks publish when `NOT can_publish_site(site_id)`.

**Audit log:** `audit_log` table with triggers. GUC `app.client_ip` + `app.user_agent` via `set_audit_context(ip, ua)` RPC.

**Site resolution:** middleware resolves `Host → site` via `SupabaseRingContext.getSiteByDomain()`, sets `x-site-id`, `x-org-id`, `x-default-locale`. Server components read via `getSiteContext()`.

**Server actions security:** write actions DEVEM chamar `requireSiteAdmin(postId)` no topo. `getSupabaseServiceClient()` bypassa RLS — sem guard explícito, cross-ring writes possíveis.

## @tn-figueiredo/cms package

Workspace em `packages/cms/`, consumido via `"@tn-figueiredo/cms": "*"` + `transpilePackages` no `next.config.ts`.

**MDX strategy:** `compile()` on save → `content_compiled` column → `run()` at render. Fallback runtime compile se `content_compiled IS NULL`.

**Dev loop:** após mudança em `packages/cms/src/*`: `npm run build -w packages/cms` ou `npm install`.

`transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/newsletter', '@tn-figueiredo/newsletter-admin']`

## Feature modules (completed — read code for details)

| Sprint | Module | Key paths |
|--------|--------|-----------|
| 5a | LGPD compliance | `lib/lgpd/`, `app/api/cron/lgpd-*`, `app/account/`, `content/legal/` |
| 5b | SEO hardening | `lib/seo/`, `app/sitemap.ts`, `app/robots.ts`, `app/og/` |
| 5e | Newsletter CMS | `lib/newsletter/`, `app/cms/newsletters/`, `app/api/webhooks/resend` |
| 5f | Links Engine | `lib/links/`, `app/cms/links/`, `app/go/`, `packages/links*/` |
| 5g | Media System | `lib/media/`, `app/cms/media/` |

### Key architectural patterns

- **LGPD:** 3-phase deletion (phase1 instant+ban → phase2 no-op → phase3 D+15 hard delete). Cookie banner only in `app/(public)/layout.tsx`, never in `/admin`, `/cms`, `/account`. 6 adapters wired in `lib/lgpd/container.ts`. Sentry error tracking = legítimo interesse LGPD Art. 7 VIII; Replay/Tracing need analytics consent.
- **SEO:** `app/sitemap.ts` + `app/robots.ts` do direct host lookup (NOT middleware-dependent — Next.js #58436). JSON-LD `@graph` composition via `schema-dts`. Identity profiles committed as JSON (not DB) — security-grade. OG image 5-step precedence: seo_extras → cover_image → dynamic OG → site default → `/og-default.png`.
- **Newsletter:** Resend-only (Brevo fully removed). CAS for edition status transitions. Crash recovery via `ON CONFLICT DO NOTHING`. RFC 8058 one-click unsubscribe. Svix webhook verification. React Email templates in `src/emails/`.
- **Links:** `go.{domain}` subdomain routing via middleware rewrite to `/go/${code}`. Daily-rotating visitor ID `SHA-256(ip|ua|date)`. Partitioned `link_clicks` table. Watermark-based hourly aggregation.
- **Media:** Vercel Blob storage (`@vercel/blob`). SHA-256 dedup. EXIF strip (LGPD). 7-day orphan grace → 30-day hard delete. SVG sanitization via DOMPurify. `<MediaGalleryDialog>` reusable picker wired into blog/author/newsletter/campaign editors.

### Remaining operational flags (boolean feature flags removed 2026-05-07)

LGPD: `LGPD_CRON_SWEEP_ENABLED` (safety valve — irreversible data deletion cron)
SEO: `SEO_AI_CRAWLERS_BLOCKED` (controls robots.txt AI crawler rules)
Links: `LINKS_SHORT_DOMAIN` (string)
Tracking: `GEO_PROVIDER` (string — default `auto`, set `stub` for dev/test)
Ads: `AD_GOOGLE_ENABLED`, `AD_TRACKING_ENABLED`, `AD_REVENUE_SYNC_ENABLED` (require external Google setup)

## Pipeline Integrity

Ao criar/deletar routes em `apps/web/src/app/api/pipeline/`:
1. Atualizar `apps/web/src/lib/pipeline/api-registry.ts` — add/remove endpoint entry **e** ajustar `endpoint_count` do domain
2. Atualizar `apps/web/data/pipeline-docs/cowork-docs-{domain}.md` com documentação do endpoint
3. Se o JSON schema de uma section (ideia, roteiro, postprod, etc.) mudou, atualizar `docs/cowork-pipeline-reference.md`
4. Domain novo (raro): criar domain const + `DomainId` + `DOMAIN_LABELS` + `capabilities[]` + doc file — testes guiam o resto
Tests validam estrutura (registry ↔ route files, endpoint_count, doc files, métodos exportados) mas NÃO conteúdo dos docs.
Chave permanente: `PIPELINE_COWORK_KEY` em `.env.local`. **Nunca criar/revogar keys.**

## Environment Variables

### Web (`apps/web/.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NEWSLETTER_FROM_DOMAIN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `CAMPAIGN_PDF_SIGNED_URL_TTL`, `YOUTUBE_API_KEY`, `BLOB_READ_WRITE_TOKEN` + operational flags above.

Sentry: `NEXT_PUBLIC_SENTRY_DSN` required em prod/preview, optional em dev (empty → no-op). `SENTRY_ORG/PROJECT/AUTH_TOKEN` build-only (source map upload).

### API (`apps/api/.env.local`)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `WEB_URL`, `SENTRY_DSN`

### Production (Vercel)
`NEXT_PUBLIC_APP_URL=https://bythiagofigueiredo.com`, `NEXT_PUBLIC_API_URL=https://bythiagofigueiredo-api.vercel.app`

## Roadmap

**Done:** Sprints 0, 1a, 1b, 2, 3, 4a, 4b, 4.5, 4.75, 5a, 5b, 5c, 5e, 5f, 5g
**Next:** Sprint 5h (Social Hub, ~78h) → Sprint 5d (Vercel deploy hardening) → Sprint 6 (MVP Launch, 30h)
Source of truth: `docs/roadmap/README.md`

## Code Standards

- **TypeScript:** `strict: true`, nunca `any`, Zod para validação
- **Arquivos:** kebab-case. **Classes:** PascalCase. **Interfaces:** `I` prefix. **DB columns:** snake_case.
- **Commits:** `tipo: descrição curta` — tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `ci`
- **Branches:** `staging` = dev, `main` = production. Feature: `feat/xxx`, `fix/xxx`, `chore/xxx`

## Ecosystem Packages (@tn-figueiredo/*)

Consumidos via `.npmrc` → `npm.pkg.github.com`. Versões exatas (sem `^`) — pre-commit hook valida.

- **api:** `auth@1.3.0`, `auth-fastify@1.1.0`, `auth-supabase@1.1.0`, `audit@0.1.0`, `lgpd@0.1.0`, `shared@0.8.0`
- **web:** `admin@0.3.0`, `auth-nextjs@2.0.0`, `cms@0.1.0-dev`, `email@0.2.0`, `links@0.1.0-dev`, `links-admin@0.1.0-dev`, `newsletter@0.1.0`, `newsletter-admin@0.1.0`, `notifications@0.1.0`, `seo@0.1.0`, `shared@0.8.0`, `social@0.1.0-dev`

## CI

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push/PR `staging` | typecheck, test, audit, secret-scan, ecosystem-pinning, seo-smoke |
| `lighthouse.yml` | PR on `apps/web/**` | LHCI: SEO ≥95 error, perf ≥80 warn |
| `seo-post-deploy.yml` | manual | `scripts/seo-smoke.sh` against prod |

Secrets: `NPM_TOKEN` (read:packages), `CRON_SECRET` (health checks), `LHCI_GITHUB_APP_TOKEN` (optional).

## Workspace Package Build Confidence

Automated pipeline that guarantees zero CI failures from stale workspace packages. All gates are automatic — no manual checklist.

### How it works

| Gate | When | What it checks | Cost |
|------|------|----------------|------|
| `postinstall` | `npm ci`/`npm install` | Builds workspace packages | +5-8s |
| Pre-commit | Every commit | build:packages → tests → next build → api typecheck | +5-8s |
| Post-merge | After `git pull` | Auto-rebuilds if `packages/*/src/` changed | +5-8s |
| Pre-push | Every push | Full ecosystem: rebuild + pinning + imports + typecheck | +45-60s |

### Single source of truth

`npm run build:packages` — defined once in root `package.json`, consumed by all gates and CI. Adding a new package = edit this one line.

### Package categories

- **Need build (dist/ export):** `@tn-figueiredo/links`, `@tn-figueiredo/social` — must be in `build:packages`
- **No build (src/ export):** `@tn-figueiredo/links-admin` — in `transpilePackages`. In `build:packages` for consistency.
- **Exception:** `@app/shared` (`packages/shared`) — raw TS, `transpilePackages`, NodeNext incompatible with workspace build
- **Published:** All other `@tn-figueiredo/*` — from GitHub Packages, pinned exact versions

### Decision tree

- **Created new workspace package with dist/ export?** → Add to `build:packages` in root package.json. Test blocks commit if you forget.
- **Modified workspace package source?** → Nothing manual. Pre-commit auto-rebuilds.
- **After git pull and something broken?** → Run `npm run build:packages`. Post-merge should have done this.
- **CI typecheck fails on @tn-figueiredo/* types?** → Verify package is in `build:packages`.
- **Import works locally but not CI?** → Declare it in consuming app's package.json.

## O que NÃO fazer

- Não instalar deps sem validar
- Não commitar secrets (`.env.local`, `supabase/.temp/`)
- Não usar `any` no código
- Não criar files desnecessários (preferir editar existentes)
- Não fazer force-push em `main` ou `staging` sem autorização explícita
- Não chamar `getSupabaseServiceClient()` sem antes validar `canAdminSite(siteId)`
- Não importar server actions diretamente em client components — passe callbacks via props
- Não criar arquivos de migration manualmente — usar **`npm run db:new <nome>`** (garante timestamp sequencial)
