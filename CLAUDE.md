# bythiagofigueiredo

Hub pessoal + CMS Engine do ecossistema `@tnf/*`.

## REGRA OBRIGATÓRIA: Testes antes de finalizar

ANTES de dizer que uma tarefa está completa:
1. Rodar `npm test` (api + web)
2. Se só mexeu em uma parte, rodar specifically: `npm run test:api` ou `npm run test:web`
3. Se qualquer teste falhar → corrigir ANTES de reportar
4. Se correção quebrar outro teste → corrigir
5. Pre-commit hook bloqueia commits se testes falham — nada está "pronto" até passar.

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
- **web:** `admin@0.3.0`, `auth-nextjs@2.0.0`, `cms@0.1.0-dev`, `email@0.2.0`, `links@0.1.0-dev`, `links-admin@0.1.0-dev`, `newsletter@0.1.0`, `newsletter-admin@0.1.0`, `notifications@0.1.0`, `seo@0.1.0`, `shared@0.8.0`

## CI

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push/PR `staging` | typecheck, test, audit, secret-scan, ecosystem-pinning, seo-smoke |
| `lighthouse.yml` | PR on `apps/web/**` | LHCI: SEO ≥95 error, perf ≥80 warn |
| `seo-post-deploy.yml` | manual | `scripts/seo-smoke.sh` against prod |

Secrets: `NPM_TOKEN` (read:packages), `CRON_SECRET` (health checks), `LHCI_GITHUB_APP_TOKEN` (optional).

## O que NÃO fazer

- Não instalar deps sem validar
- Não commitar secrets (`.env.local`, `supabase/.temp/`)
- Não usar `any` no código
- Não criar files desnecessários (preferir editar existentes)
- Não fazer force-push em `main` ou `staging` sem autorização explícita
- Não chamar `getSupabaseServiceClient()` sem antes validar `canAdminSite(siteId)`
- Não importar server actions diretamente em client components — passe callbacks via props
- Não criar arquivos de migration manualmente — usar **`npm run db:new <nome>`** (garante timestamp sequencial)
