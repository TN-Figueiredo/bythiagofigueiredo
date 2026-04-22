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
| Error tracking | Sentry (integrado no Sprint 4) |

## Database — Supabase CLI (scripts padrão TNG)

**Single project (prod):** `novkqtvcnsiwhkxihurk` em org `ByThiagoFigueiredo` (region: São Paulo).

### Comandos

```bash
# Remote (prod)
npm run db:link:prod         # Link CLI ao project remoto (uma vez)
npm run db:push:prod         # Push migrations pra prod (com confirmação YES)
npm run db:which             # Mostra qual project está linkado

# Local (Docker)
npm run db:start             # Sobe Supabase local via Docker
npm run db:stop              # Para containers
npm run db:reset             # Reset schema local
npm run db:status            # Status + endpoints locais
npm run db:env               # Gera .env.local-db com keys locais
```

### Fluxo: criar nova migration

```bash
npx supabase migration new <nome_descritivo>
# Edita o arquivo em supabase/migrations/
npm run db:push:prod          # Pra prod (pede YES)
# OU
npm run db:start && npm run db:reset  # Valida local primeiro
```

### DB password

Salvo em keychain/1Password. Recuperar via: Supabase Dashboard → Project Settings → Database → Reset database password (se perdido).

## Testes com DB local

Tests que dependem de Supabase local (RLS, migrations, seed, integration) são gated em `process.env.HAS_LOCAL_DB`. Helper: `apps/{api,web}/test/helpers/db-skip.ts`.

```bash
# Suite completa (local, com DB rodando)
npm run db:start
HAS_LOCAL_DB=1 npm test

# Suite "sem DB" (o que CI faz) — describe.skipIf(skipIfNoLocalDb()) pula os gated
npm test
```

Convenção nos testes:

```typescript
import { skipIfNoLocalDb, getLocalJwtSecret } from './helpers/db-skip'
describe.skipIf(skipIfNoLocalDb())('<suite que precisa de DB>', () => { ... })
```

Override do JWT secret: `SUPABASE_JWT_SECRET=xxx HAS_LOCAL_DB=1 npm test`.

### Integration tests: `apps/web/test/integration/*.test.ts`

Suítes de integração contra Supabase local vivem em `apps/web/test/integration/` e cobrem RPCs críticos (`confirm_newsletter_subscription`, `unsubscribe_via_token`, `update_campaign_atomic`, `cron_try_lock`/`cron_unlock`). Todas usam service-role client (RLS bypass para seed) + `describe.skipIf(skipIfNoLocalDb())` — CI sem `HAS_LOCAL_DB=1` pula silenciosamente.

Seed helpers reutilizáveis em `apps/web/test/helpers/db-seed.ts`: `seedSite()`, `seedStaffUser()`, `seedPendingNewsletterSub()`, `seedUnsubscribeToken()`, `seedCampaign()`, além de `signUserJwt()` para exercitar branches de `permission denied` via JWT de usuário não-membro. Tokens são hasheados com `sha256(raw).digest('hex')` para bater com o app.

Para o cron-locks test (advisory locks session-scoped), duas conexões `pg.Client` independentes simulam invocações concorrentes — supabase-js não serve porque compartilha pool REST.

## Database RLS helpers

- Helpers ficam em `public` (ownership do `auth` pertence a `supabase_admin`): `public.user_role()`, `public.is_staff()`, `public.is_admin()`, `public.site_visible(uuid)`.
- Policies de leitura pública de tabelas site-scoped DEVEM usar `public.site_visible(site_id)` — nunca duplicar a regra de três ramos inline.
- Contrato do GUC `app.site_id`: Next middleware executa `select set_config('app.site_id', '<uuid>', true)` por request. Valor vazio/unset = sem filtro (admin/cross-site). Valor inválido (não-uuid) = fail closed (esconde rows site-scoped).
- Staff (`editor|admin|super_admin`) bypassa o filtro via policies `_staff_read_all` — OR com a policy pública.
- **Idempotência em migrations de RLS:** sempre prefixe `create policy` com `drop policy if exists "<name>" on <table>;` e `create trigger` com `drop trigger if exists <name> on <table>;`. `create or replace function` já é idempotente. Pattern canônico: `supabase/migrations/20260414000008_rls_site_helper.sql` e `…000018_submissions_published_guard.sql`.

### LGPD retention policies (Sprint 4 / Epic 10)

- **Unsubscribe anonymization** — `unsubscribe_via_token(p_token_hash)` RPC (migration `20260418000001_newsletter_anonymize_on_unsubscribe.sql`) flipa status para `unsubscribed` E anonymiza a row: `email = encode(sha256(email::bytea), 'hex')`, `ip = null`, `user_agent = null`, `locale = null`. Mantém `site_id`, `unsubscribed_at`, e versões de consent aceitas para accountability LGPD. Unique partial index `newsletter_subscriptions_anon_unique on (site_id, email) where status='unsubscribed'` impede re-subscribe com o mesmo endereço (sha256 é determinístico).
- **Contact right-to-be-forgotten** — `anonymize_contact_submission(p_id uuid)` RPC (migration `…000002`) zera `name/email/ip/user_agent/message` da submissão e grava `anonymized_at`. Guardado por `is_staff() OR can_admin_site(site_id) OR service_role`. Server action do admin UI deve re-validar staff status antes de chamar.
- **Sent emails 90-day purge** — `purge_sent_emails(p_older_than_days int default 90)` RPC (migration `…000003`) deleta rows de `sent_emails` com `sent_at < now() - interval`, retorna contagem. Execute só para `service_role`. Invocado diariamente via `/api/cron/purge-sent-emails` (03:00 America/Sao_Paulo = `0 6 * * *` UTC).

## LGPD compliance (Sprint 5a) — `@tn-figueiredo/lgpd@0.1.0` wiring

Sprint 5a implementa os fluxos user-facing de LGPD/GDPR (privacy page, cookie banner, account deletion 3-fase, data export, consents).

### 6-adapter wiring pattern

`apps/web/src/lib/lgpd/container.ts` monta o `LgpdConfig` a partir de 6 adapters concretos que implementam as interfaces de `@tn-figueiredo/lgpd@0.1.0`:

1. **`BythiagoLgpdDomainAdapter`** (`ILgpdDomainAdapter`) — implementa `collectUserData`, `phase1Cleanup`, `phase2Cleanup` (no-op), `phase3Cleanup`, `checkDeletionSafety`.
2. **`SupabaseLgpdRequestRepository`** (`ILgpdRequestRepository`) — CRUD sobre a tabela `lgpd_requests`.
3. **`AuditLogLgpdRepository`** (`ILgpdAuditLogRepository`) — reusa `audit_log` do Sprint 4.75 (trigger-driven).
4. **`LgpdEmailService`** (`ILgpdEmailService`) — 5 templates via `@tn-figueiredo/email` (Resend adapter).
5. **`DirectQueryAccountStatusCache`** (`IAccountStatusCache`) — null-object shim que consulta `auth.admin.getUserById().banned_until` direto (sem cache).
6. **`SupabaseInactiveUserFinder`** (`IInactiveUserFinder`) — query em `auth.users` por `last_sign_in_at < now - 365d`.

Config:

```typescript
{
  ...adapters,
  phase2DelayDays: 0,   // phase 2 é no-op (hybrid C)
  phase3DelayDays: 15,  // hard delete no D+15 (≤ LGPD 45d)
  exportExpiryDays: 7,
  inactiveWarningDays: 365,
}
```

### 3-phase deletion model

LGPD Art. 18 V — deletion com grace period cancelável:

- **Phase 1 (instant no confirm via email):** `lgpd_phase1_cleanup(user_id, pre_capture)` em transação atômica — anonymize newsletter_subs (via pre-capture dos emails), anonymize contact_submissions, reassign content ao master_admin (via `reassign_authors`), null em `authors.user_id`, cancel pending invitations, null em `audit_log.actor_user_id`, delete orphaned export blobs. Usa `SET LOCAL app.skip_cascade_audit='1'` pra evitar noise de audit. Em seguida, app chama `auth.admin.updateUserById(id, {ban_duration: 'infinite'})`.
- **Phase 2:** no-op (hybrid C — `phase2DelayDays: 0`).
- **Phase 3 (D+15):** cron `/api/cron/lgpd-cleanup-sweep` advance para phase 3 → `auth.admin.deleteUser(id)` OR (se FK bloquear) mantém anonymized permanentemente como "effective deletion". `scheduled_purge_at = phase1_completed_at + 15d`. Cancel dentro do grace period via `cancel_account_deletion_in_grace(token_hash)` — app unbana via `auth.admin.updateUserById(id, {ban_duration: null})`.

### Export format — schema version `v1`

`collectUserData()` retorna JSON versionado com `version: "v1"` no top-level. Schema inclui `$schema` URI + blog MDX completo (translations[].content_mdx), campaigns com submissions, consent_texts inlined, audit_log.as_actor com IP + user_agent, e PII de terceiros redacted por regex (`EMAIL_RE`, `PHONE_RE` → `[REDACTED_EMAIL]`/`[REDACTED_PHONE]`) com flag `redaction_applied: true`. Upload em `lgpd-exports/{user_id}/{request_id}.json` com signed URL (TTL 7d).

### Cookie banner integration contract

- **Render site:** apenas em `app/(public)/layout.tsx` via `<CookieBanner />` + `<CookieBannerTrigger />` gated por `NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'`. Nunca em `/admin`, `/cms`, `/account`.
- **Granularidade (opt-in):** 3 toggles (Functional ON-locked, Analytics OFF default, Marketing OFF default). Accept/Reject com prominência igual (anti-dark-pattern LGPD).
- **Anonymous flow:** `crypto.randomUUID()` v4 gerado client-side e armazenado em `localStorage.lgpd_anon_id` + POST `/api/consents/anonymous` (service-role insert, rate-limited por IP).
- **Sign-in merge:** `/api/consents/merge` chama `merge_anonymous_consents(anonymous_id)` com `FOR UPDATE` lock pra segurança contra sign-ins concorrentes. Consentimentos anônimos viram consentimentos do `user_id` autenticado.
- **Expiry:** 30d pré-auth, 1y pós-auth. Re-prompt em version bump via `X-Lgpd-Consent-Fingerprint` header.
- **`<ConsentGate>`:** wrapper client-only (nunca SSR-render) pra analytics scripts. `window.addEventListener('storage', ...)` para multi-tab sync.
- **Sentry:** error tracking sempre ligado (legítimo interesse LGPD Art. 7 **VIII** — NÃO IX, que não existe). Replay + performance tracing só com consent de analytics.

### Feature flags

4 flags permitem rollback granular:

- **`NEXT_PUBLIC_LGPD_BANNER_ENABLED`** — renderização do cookie banner.
- **`NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED`** — UI de `/account/delete`.
- **`NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED`** — UI de `/account/export`.
- **`LGPD_CRON_SWEEP_ENABLED`** — toggle server-side do cron de cleanup.

Configurar em `apps/web/.env.local` e em Vercel Environment Variables. Estado inicial de prod: todos `true`.

### MDX content

Política de Privacidade + Termos de Uso em `apps/web/src/content/legal/` (pt-BR + en). 14 seções na privacy (DPO exemption via Resolução CD/ANPD 2/2022, SCCs para Vercel/Sentry/Cloudflare nos EUA, teste de balanceamento Sentry LGPD Art. 7 VIII + nota sobre Tracing/Replay sob consentimento, ANPD + EDPB complaint paths). 12 seções no terms (jurisdição Foro SP/Brasil, cap de responsabilidade R$ 500). MDX compilado via `@next/mdx@15.5.15` (wrapped em `next.config.ts`). Versões ficam em `consent_texts (category, locale, version)` pra accountability de consentimento.

**consent_texts versions:**
- **v1.0** (migration `20260430000012_consent_texts.sql`) — seed inicial, descrições curtas. Mantidas permanentemente como accountability record para consentimentos já coletados com esse texto. Marcadas como `superseded_at = now()` pela migração 022.
- **v2.0** (migration `20260430000022_consent_texts_v2_seed.sql`) — texto expandido para atender o bar "livre, informada, inequívoca" do LGPD Art. 8: cada texto agora explicita categorias de dados, processadores + país + base de transferência, retenção e canal de revogação. Usado para todos os consentimentos novos a partir do deploy dessa migração. App lê a maior versão não-superseded de `(category, locale)`.

## SEO hardening (Sprint 5b) — `lib/seo/` wrapper over `@tn-figueiredo/seo@0.1.0`

Sprint 5b implementa o stack SEO completo: indexability + discoverability + rich results + brand share previews + multi-domain ready, com Lighthouse CI gate e runbook operacional.

> **Status (2026-04-16):** 🟡 in-progress. PR-A merged 2026-04-17 (3 migrations + `seed_master_site` em prod). PR-B/C/D/E stacked on `feat/sprint-5b-pr-e-ops` pending merge + Vercel prod deploy green. Final ✅ flip no phase-1-mvp.md / README.md / aqui acontece em follow-up commit pós-`seo-post-deploy.yml` all-8-pass + sitemap submitted to GSC + Bing + Sentry 24h watch clean. Ver `docs/runbooks/sprint-5b-post-deploy.md` para o checklist completo.

### Layer overview

`apps/web/lib/seo/` é o wrapper local sobre `@tn-figueiredo/seo@0.1.0` (que provê primitives `generateMetadata`/`buildSitemap`/`buildRobots`). Wrapper local resolve gaps:
- `alternates.languages` (hreflang per-route) — package só emite canonical
- Sitemap manual (não usa `buildSitemap`) — package faz blanket hreflang que quebra paths locale-prefixed
- `keywords/authors/publishedTime/modifiedTime` no Metadata
- Validação JSON-LD via `schema-dts@1.1.5` (Google-maintained types)

```
lib/seo/
├── config.ts                  getSiteSeoConfig() per-request, unstable_cache key=[siteId,host]
├── host.ts                    resolveSiteByHost, isPreviewOrDevHost
├── identity-profiles.ts       PROFILES Record<siteSlug, PersonProfile|OrgProfile> (committed JSON)
├── page-metadata.ts           7 factories — generateXxxMetadata por archetype
├── jsonld/
│   ├── builders.ts            buildPersonNode/OrgNode/WebSiteNode/BlogPostingNode/ArticleNode/BreadcrumbNode/FaqNode/HowToNode/VideoNode
│   ├── graph.ts               composeGraph({nodes}) → @graph + dedupeBy_id
│   ├── extras-schema.ts       SeoExtrasSchema (Zod) para FAQ/HowTo/Video frontmatter
│   ├── render.tsx             <JsonLdScript graph={...}/> com escapeJsonForScript
│   └── types.ts               schema-dts re-exports
├── og/
│   ├── template.tsx           BlogOgTemplate + CampaignOgTemplate + GenericOgTemplate
│   └── render.ts              generateOgImage({variant, params}) → ImageResponse
├── noindex.ts                 NOINDEX_PATTERNS + isPathIndexable + PROTECTED_DISALLOW_PATHS
├── enumerator.ts              enumerateSiteRoutes(siteId, config) — RLS-mirroring filters
├── cache-invalidation.ts      revalidateBlogPostSeo/CampaignSeo/SiteBranding
├── robots-config.ts           buildRobotsRules({config, host, aiCrawlersBlocked, protectedPaths})
└── frontmatter.ts             parseMdxFrontmatter wrap gray-matter@4.0.3
```

### Multi-domain pattern — direct host lookup, NÃO middleware-dependent

`app/sitemap.ts` e `app/robots.ts` fazem sua própria resolução `host → site` via `SupabaseRingContext.getSiteByDomain(host)` em vez de ler `headers().get('x-site-id')` do middleware. Razão: Next.js [discussion #58436](https://github.com/vercel/next.js/discussions/58436) confirma que middleware-injected headers NÃO são confiáveis em MetadataRoute handlers (mesmo com matcher cobrindo `.xml`/`.txt`). Duplica ~5 linhas de lógica mas é bulletproof.

`isPreviewOrDevHost(host)` short-circuita pra noindex (Disallow:/) em:
- `dev.bythiagofigueiredo.com`
- `*.vercel.app`
- `localhost*` / `dev.localhost`

Middleware (`apps/web/src/middleware.ts`) tem short-circuit pra `/sitemap.xml` + `/robots.txt` — pula o rewrite `dev.bythiagofigueiredo.com/x → /dev/x` pra essas rotas dinâmicas rodarem com host original.

### JSON-LD `@graph` composition

Cada página renderiza UM `<script type="application/ld+json">` contendo `{'@context':'https://schema.org', '@graph': [...nodes]}`. Nós linkam via `@id` (URLs como identifiers).

Por archetype:
- `app/(public)/layout.tsx` (root) → `WebSite` (com `potentialAction: SearchAction`) + (`Person` ou `Organization` per `identityType`)
- `/blog/[locale]/[slug]` → `BlogPosting` + `BreadcrumbList` + extras de `seo_extras` (`FAQPage`/`HowTo`/`VideoObject`)
- `/blog/[locale]` → `BreadcrumbList`
- `/campaigns/[locale]/[slug]` → `Article` + `BreadcrumbList`
- `/privacy`, `/terms` → `BreadcrumbList`
- `/contact` → `BreadcrumbList` + `ContactPage`

Layout root nodes aparecem em toda página; per-page nodes empilham; `composeGraph` deduplica por `@id` (priority: nó com mais keys vence, deterministic).

`<JsonLdScript>` SSR-safe via `escapeJsonForScript` (escapa `<`, `>`, `&`, U+2028, U+2029). Renderizado dentro de `<body>` (App Router não permite `<script>` custom em `<head>` via Metadata API). Googlebot lê do body sem problema.

Type safety: `expectTypeOf().toMatchTypeOf<BlogPosting>()` em vitest pega regression compile-time.

### OG image precedence chain

Per blog/campaign:
1. `seo_extras.og_image_url` (per-translation explicit override via frontmatter)
2. `cover_image_url` from `blog_translations` (existing column, surfaced em Sprint 5b)
3. Dynamic OG via `/og/blog/{locale}/{slug}` (gated por `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=true`)
4. `sites.seo_default_og_image` (NEW column, site-wide static fallback)
5. `/og-default.png` (committed em `apps/web/public/`, last-resort)

OG routes: `app/og/blog/[locale]/[slug]/route.tsx`, `app/og/campaigns/[locale]/[slug]/route.tsx`, `app/og/[type]/route.tsx`. Cache `public, max-age=3600, s-maxage=86400, swr=604800`. Inter font subset latin-only ~35KB. Erro → redirect 302 pra `/og-default.png` + `Sentry.captureException` com `tags: { component: 'og-route', type: 'blog' }`.

### Identity profiles — committed JSON, NÃO em DB

`apps/web/lib/seo/identity-profiles.ts` exporta `IDENTITY_PROFILES: Record<siteSlug, PersonProfile|OrgProfile>` com `name/jobTitle/imageUrl/sameAs[]`. Edits triggam code review intencional — identity é security-grade (sameAs links impactam Google Knowledge Graph). Sprint 11 (CMS Hub) pode mover pra DB se non-dev editing virar need.

`apps/web/public/identity/thiago.jpg` (1:1 ratio, ≥400×400, JPEG <100KB) committed em PR-B.

### Cache invalidation — tag taxonomy

| Tag | Invalida | Set por |
|---|---|---|
| `seo-config` | `getSiteSeoConfig` (todos sites) | admin actions: `updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults` |
| `blog:post:${postId}` | per-post fetches (metadata + OG) | blog `savePost`/`publishPost`/`unpublishPost`/`archivePost`/`deletePost` |
| `og:blog:${postId}` | OG image route cache | mesmas blog actions |
| `campaign:${campaignId}` | per-campaign fetches | campaign save/publish/etc |
| `og:campaign:${campaignId}` | OG image route cache | mesmas campaign actions |
| `sitemap:${siteId}` | enumerator query | qualquer post/campaign mutation |

Helper canônico: `revalidateBlogPostSeo(siteId, postId, locale, slug)` em `lib/seo/cache-invalidation.ts`. **archivePost teve bug fix em PR-C** — antes só revalidava `/blog/${locale}` index, missing slug page.

### RLS-aware sitemap enumerator

`enumerateSiteRoutes(siteId, config)` consulta `blog_translations` + `campaign_translations` via service-role client mas aplica WHERE filters explicitos espelhando RLS public-read policies (`status='published'`, `published_at <= now()`, `published_at is not null`). DB-gated integration test cria draft + future-scheduled post + verifica que neither leaks. Static routes sempre incluídas: `/`, `/privacy`, `/terms`, `/contact`, `/blog/${defaultLocale}`. Ordenação: `lastModified DESC`.

### Frontmatter — `gray-matter@4.0.3`

`@tn-figueiredo/cms` `compileMdx` NÃO expõe frontmatter (verificado: retorna só `{compiledSource, toc, readingTimeMin}`). `lib/seo/frontmatter.ts` wrappa `gray-matter` (~30KB), valida `seo_extras` via `SeoExtrasSchema` (Zod), strip do conteúdo antes de `compileMdx`. Save action (`cms/(authed)/blog/[id]/edit/actions.ts`) chama `parseMdxFrontmatter(input.content_mdx)` antes de compilar, persiste `seo_extras` em `blog_translations.seo_extras` jsonb.

Sprint 6+: extrair `parseFrontmatter` upstream pra `@tn-figueiredo/cms@0.3.0` se segundo consumer aparecer.

### Schema migrations (3 + 1 seed, 2026-04-16, PR-A merged)

- `20260417000000_seed_master_site.sql` — bootstrap `Figueiredo Technology` org + `bythiagofigueiredo` site row (was empty in prod, site renders only via hardcoded i18n JSON until now)
- `20260501000001_sites_seo_columns.sql` — `sites.identity_type` text NOT NULL DEFAULT 'person' check IN ('person','organization'); `sites.twitter_handle` text check ~ '^[A-Za-z0-9_]{1,15}$'; `sites.seo_default_og_image` text check ~ '^https://'
- `20260501000002_blog_translations_seo_extras.sql` — `blog_translations.seo_extras` jsonb + structural CHECK (object shape, faq array, howTo object, video object, og_image_url string)
- `20260501000003_seo_backfill.sql` (idempotent) — `update sites set twitter_handle='tnFigueiredo' where slug='bythiagofigueiredo'`; backfill `supported_locales=array['pt-BR','en']`

**Reuso:** `sites.supported_locales` já existia (Sprint 4.75), Sprint 5b consome — não duplica.

### Feature flags (5)

Granular rollback per-surface:

- `NEXT_PUBLIC_SEO_JSONLD_ENABLED` — `<JsonLdScript>` returns null quando `false` (default true)
- `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED` — pula step 3 da precedence chain (default true)
- `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED` — drop FAQ/HowTo/Video nodes (default true)
- `SEO_AI_CRAWLERS_BLOCKED` — adiciona Disallow para GPTBot/CCBot/anthropic-ai/Google-Extended/PerplexityBot/ClaudeBot/Bytespider/Amazonbot (default false; decisão do usuário per spec Open Decisions #1)
- `SEO_SITEMAP_KILLED` — emergency `app/sitemap.ts` retorna `[]` (default false)

Configurar em `apps/web/.env.local` + Vercel Environment Variables. Estado inicial prod: 4 first true, AI blocker false, kill switch false. Ver `docs/runbooks/seo-incident.md` pra triggers de cada flag.

### CI quality gates (PR-D)

- `.lighthouserc.yml` (LHCI) — SEO ≥95 (error), perf ≥80 mobile (warn), `uses-rel-canonical: error`, `hreflang: error`, `structured-data: warn`. Roda em `.github/workflows/lighthouse.yml` em PRs tocando `apps/web/**`, espera Vercel preview, `lhci autorun`.
- `scripts/seo-smoke.sh $HOST` — 8 checks (sitemap valid XML, robots Sitemap line, robots disallow protected paths, JSON-LD `@graph` em blog post, OG content-type=image/png, hreflang alternates, dev subdomain `Disallow:/`, health endpoint `ok:true`).
- `.github/workflows/seo-post-deploy.yml` — manual dispatch após deploy verde, roda smoke contra prod.
- Vitest schema-dts `expectTypeOf` gate — pega schema regressions compile-time.

### Health endpoint + runbook (PR-E)

- `apps/web/src/app/api/health/seo/route.ts` — GET `Authorization: Bearer ${CRON_SECRET}` retorna `{ok, siteId, siteSlug, identityType, seoConfigCachedMs, sitemapBuildMs, sitemapRouteCount, schemaVersion: 'v1', flags: {jsonLd, dynamicOg, extendedSchemas, aiCrawlersBlocked, sitemapKilled}}`. 401 sem auth, 503 quando site não resolve.
- `docs/runbooks/seo-incident.md` — 6 scenarios (A: sitemap empty, B: OG broken, C: Rich Results fail, D: hreflang wrong, E: AI crawler spike, F: drafts leaked CRITICAL).
- `docs/runbooks/sprint-5b-post-deploy.md` — 12-step verification checklist.

### Sentry tag conventions (Sprint 5b)

Toda exceção SEO-layer taggeada com `seo: true` + `component`:
- `component: 'sitemap'`, `'robots'`, `'og-route'` (sub-tag `type: 'blog'|'campaign'|'generic'`), `'jsonld'`, `'seo-config'`

Filtro Sentry: `seo:true component:og-route last:24h`.

### Server actions modificadas em PR-C (12 sites)

`apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` (5 funções) + `apps/web/src/app/cms/(authed)/campaigns/{new,[id]/edit}/actions.ts` (5 funções) + `apps/web/src/app/cms/(authed)/blog/new/page.tsx` (1 server component) + admin actions novos em `apps/web/src/app/admin/(authed)/sites/actions.ts` (`updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults`). Cada site chama `revalidateBlogPostSeo`/`revalidateCampaignSeo`/`revalidateTag('seo-config')` conforme operação.

## Newsletter CMS Engine (Sprint 5e) — Resend + self-hosted email

Sprint 5e replaces Brevo entirely with Resend as the sole email provider and adds a full newsletter authoring/sending/analytics pipeline inside the CMS.

### Brevo removal

All Brevo references removed: `lib/brevo.ts` deleted, `brevo_contact_id`/`brevo_list_id`/`brevo_template_id` columns dropped, sync-newsletter-pending cron removed. Email now routes through `@tn-figueiredo/email@0.2.0` which includes native Resend support (provider union widened). Bridge in `apps/web/lib/email/resend.ts` cleaned to consume the package directly.

### New tables

| Table | Purpose |
|---|---|
| `newsletter_editions` | Email issues: subject, preheader, content_mdx, content_html, status lifecycle (draft→ready→queued→scheduled→sending→sent→failed), stats columns, slot_date |
| `newsletter_sends` | Per-recipient send log: resend_message_id, status, opened_at, open_ip/user_agent, bounced_at, bounce_type |
| `newsletter_click_events` | Click tracking: send_id FK, url, ip, user_agent, clicked_at |
| `webhook_events` | Resend webhook dedup: svix_id UNIQUE, event_type, payload, processed_at |
| `blog_cadence` | Per-locale publishing cadence: cadence_days, preferred_send_time, cadence_paused |

### Modified tables

- `newsletter_types` — gained `cadence_days`, `cadence_start_date`, `cadence_paused`, `last_sent_at`, `sender_name`, `sender_email`, `reply_to`, `color`, `sort_order`
- `newsletter_subscriptions` — gained `welcome_sent boolean`, `tracking_consent boolean`; dropped `brevo_contact_id`
- `campaigns` — dropped `brevo_list_id`, `brevo_template_id`
- `blog_posts` — gained `queue_position int`, `slot_date date` (content queue)
- `post_status` enum — gained `'ready'`, `'queued'` values

### Content queue model

`lib/content-queue/slots.ts` exports `generateSlots(config, opts)` — pure function computing future slot dates from cadence config. Blog posts flow: draft → ready → queued (with slot_date) → published. Newsletter editions have parallel lifecycle. CMS content queue page (`/cms/content-queue`) shows backlog + scheduled timeline.

### Email sending pipeline

1. Author creates edition in CMS (`/cms/newsletters/new` → `/cms/newsletters/[id]/edit`)
2. Edition scheduled via `scheduleEdition` server action (CAS: `UPDATE SET status='scheduled' WHERE status='ready'`)
3. Cron `/api/cron/send-scheduled-newsletters` (daily `0 8 * * *`) picks up scheduled editions, renders React Email template, batch-sends via Resend with 100ms throttle
4. Crash recovery: `ON CONFLICT (edition_id, subscriber_email) DO NOTHING` + skip sends with `resend_message_id IS NOT NULL`
5. Bounce auto-pause: ≥5% bounce rate pauses the newsletter type
6. RFC 8058 one-click unsubscribe via `List-Unsubscribe` + `List-Unsubscribe-Post` headers

### Webhook processing

`/api/webhooks/resend` — Svix signature verification, idempotent via `webhook_events.svix_id` UNIQUE. Routes: `email.delivered` → mark delivered, `email.opened` → record open with IP/UA, `email.clicked` → insert click event, `email.bounced`/`email.complained` → update send status + subscriber status, `email.delivery_delayed` → log only. Sets `stats_stale=true` on edition for debounced refresh.

### React Email templates

`apps/web/src/emails/newsletter.tsx` + `components/email-header.tsx` + `components/email-footer.tsx`. Rendered server-side via `@react-email/render`. Footer includes unsubscribe link + tracking pixel (gated by `tracking_consent`). Web archive link per edition.

### CMS pages

| Route | Purpose |
|---|---|
| `/cms/newsletters` | Dashboard: type cards, edition list with filters |
| `/cms/newsletters/new` | Creates draft edition + redirects to editor |
| `/cms/newsletters/[id]/edit` | Subject/preheader/MDX editor + live preview iframe |
| `/cms/newsletters/[id]/analytics` | KPI cards (delivered/opens/clicks/bounces), top links, email client breakdown |
| `/cms/newsletters/subscribers` | Filterable subscriber list with pagination |
| `/cms/newsletters/settings` | Per-type cadence, send time, pause toggle |
| `/cms/content-queue` | Backlog (ready posts) + scheduled timeline (blog + newsletter) |
| `/newsletter/archive/[id]` | Public web archive for sent editions (in sitemap) |

### Cron jobs (3 new)

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/send-scheduled-newsletters` | `0 8 * * *` | Batch send scheduled editions |
| `/api/cron/anonymize-newsletter-tracking` | `0 4 * * *` | 90-day PII anonymization of open_ip/user_agent |
| `/api/cron/purge-webhook-events` | `0 5 * * 0` | 30-day hard delete of processed webhook events |

### Environment variables (3 new)

- `RESEND_API_KEY` — Resend API key for sending
- `RESEND_WEBHOOK_SECRET` — Svix signing secret for webhook verification
- `NEWSLETTER_FROM_DOMAIN` — verified domain for From: header (e.g. `bythiagofigueiredo.com`)

### Stats refresh

`refresh_newsletter_stats()` RPC (migration `20260421000004`) recalculates `stats_delivered/opens/clicks/bounces/complaints` from `newsletter_sends` aggregate, clears `stats_stale` flag. Called on-demand when analytics page detects stale edition, not on every webhook.

### LGPD compliance

- `consent_texts` seed for `newsletter_analytics` category (migration `20260421000005`)
- Tracking pixel + click tracking gated by subscriber's `tracking_consent`
- 90-day anonymization cron for IP/user_agent in sends + clicks
- Webhook events purged after 30 days

### Package wiring (Sprint 5e extraction)

Local code replaced with `@tn-figueiredo/*` package imports:
- `lib/content-queue/slots.ts` → re-exports `generateSlots` from `@tn-figueiredo/newsletter`
- `lib/newsletter/stats.ts` → re-exports `parseUserAgent` from `@tn-figueiredo/newsletter`
- `lib/email/resend.ts` → cleaned for `@tn-figueiredo/email@0.2.0` (provider union widened)
- CMS pages: analytics, subscribers, settings → wired to `@tn-figueiredo/newsletter-admin/client` components
- Brevo sync cron removed, all Brevo references purged from tests

## Multi-ring (CMS conglomerate) — Sprint 4.75 RBAC v3

Conglomerado multi-site com 4 papéis derivados. `bythiagofigueiredo.com` é o master ring.

**Roles (RBAC v3):**
- `super_admin` — `organization_members.role='org_admin'` do master ring (`parent_org_id IS NULL`). Bypassa tudo. Revogável via DELETE.
- `org_admin` — `organization_members.role='org_admin'` de uma org. Gerencia usuários + conteúdo + sites da org.
- `editor` — `site_memberships.role='editor'` de um site. CRUD completo + publish naquele site.
- `reporter` — `site_memberships.role='reporter'` de um site. Cria/edita apenas próprio conteúdo; publish bloqueado por trigger DB.

**Schema (v3, migrações `20260420000001`–`20260420000009`):**
- `organizations` — `parent_org_id` (NULL = master ring, único via `organizations_single_master` index).
- `organization_members(org_id, user_id, role)` — role check `= 'org_admin'` apenas (legacy owner/admin migrados).
- `site_memberships(site_id, user_id, role)` — NOVA tabela; role check IN `('editor','reporter')`.
- `sites` — ganhou `primary_domain NOT NULL`, `cms_enabled boolean`, `logo_url`, `primary_color`.
- `blog_posts.owner_user_id`, `campaigns.owner_user_id` — NOVA coluna FK→`auth.users`, backfilled.
- `invitations` — ganhou `site_id uuid NULL`, `role_scope text ('org'|'site')` + CHECK constraint.
- `audit_log(id, actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data, ip, user_agent, created_at)` — NOVA tabela com triggers em `organization_members`, `site_memberships`, `invitations`.

**Helpers RLS (v3, SECURITY DEFINER + `SET search_path = public`):**
- `public.is_super_admin()` — member of master ring.
- `public.is_org_admin(uuid)` — super_admin OR org_admin of org.
- `public.can_view_site(uuid)` — super_admin OR org_admin OR site member (any role).
- `public.can_edit_site(uuid)` — super_admin OR org_admin OR site editor.
- `public.can_publish_site(uuid)` — same as edit (reporters não publicam).
- `public.can_admin_site_users(uuid)` — super_admin OR org_admin.
- `public.is_member_staff()` — DB-checked (NÃO usa JWT claim) — usado por `requireArea()` em `@tn-figueiredo/auth-nextjs@2.2.0+`. Fecha JWT staleness gap do Sprint 4.5 T10d.
- `is_staff()` legacy — mantido pra backward compat mas NÃO é usado em policies v3. Dropped das policies de conteúdo.

**Publish review trigger (`enforce_publish_permission`):**
BEFORE INSERT OR UPDATE em `blog_posts` e `campaigns` — bloqueia transição para `status IN ('published','scheduled')` quando `NOT can_publish_site(site_id)`. Raises `ERRCODE P0001` + `HINT = 'requires_editor_role'`. Reporter pode mover draft → `pending_review` (novo enum value).

**Audit log GUC injection (migration 9):**
Trigger lê `current_setting('app.client_ip')` e `current_setting('app.user_agent')` setados pela RPC `public.set_audit_context(ip, ua)`. Server actions chamam no início da request pra LGPD accountability. Fallback: `inet_client_addr()` se GUC não setado.

**Invitation scope (Sprint 4.75 extension):**
- `role_scope='org'` + `site_id IS NULL` + `role='org_admin'` — convite organizacional.
- `role_scope='site'` + `site_id NOT NULL` + `role IN ('editor','reporter')` — convite scoped a site.
- `accept_invitation_atomic(p_token_hash, p_user_id)` branch-a em `role_scope` e retorna `redirect_url` cross-domain (primário do site ou `bythiagofigueiredo.com`).

**Site resolution (middleware):**
Request com `Host: bythiagofigueiredo.com` → middleware chama `SupabaseRingContext.getSiteByDomain()` → seta headers `x-site-id`, `x-org-id`, `x-default-locale`. Server components leem via `getSiteContext()` em `apps/web/lib/cms/site-context.ts`.

**Server actions:**
Write actions (save/publish/unpublish/archive/delete/upload) DEVEM chamar `requireSiteAdmin(postId)` no topo. Esse helper resolve o user via `@supabase/ssr` + cookies e chama RPC `can_admin_site`. Service-role client (`getSupabaseServiceClient`) bypassa RLS — sem esse guard explícito, cross-ring writes seriam possíveis.

## @tn-figueiredo/cms package

CMS reutilizável publicado em `@tn-figueiredo/cms` (extração pra repo próprio fica pro Sprint 3 quando segundo consumer aparecer). Durante Sprint 2: workspace em `packages/cms/`, consumido via `apps/web/package.json "@tn-figueiredo/cms": "*"` + `transpilePackages` no `next.config.ts`.

**Exports principais:**
- Interfaces: `IContentRepository<T>`, `IPostRepository`, `IContentRenderer`, `IRingContext`
- Supabase impls: `SupabasePostRepository`, `SupabaseRingContext`, `uploadContentAsset`
- MDX: `compileMdx`, `MdxRunner`, `defaultComponents`, `extractToc`, `calculateReadingTime`
- Editor (client): `PostEditor`, `EditorToolbar`, `EditorPreview`, `AssetPicker`
- i18n: `getEditorStrings(locale)` — pt-BR + en, extensível
- Opt-in shiki: `import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'` (lazy)

**MDX strategy:** `@mdx-js/mdx@3.x compile()` on save → `content_compiled text` column no DB → `run()` at render time. Public pages caem em runtime compile se `content_compiled IS NULL` (legacy posts).

**Dev loop:**
- Package tem `prepare` hook que roda `tsc` em `npm install` → `dist/` sempre atualizado
- Após mudança em `packages/cms/src/*`: rodar `npm run build -w packages/cms` (ou `npm install` pra trigger prepare)
- `next.config.ts` tem `transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/newsletter', '@tn-figueiredo/newsletter-admin']` — Next transpila direto

## Environment Variables

### Web (`apps/web/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`
- **Sentry (Sprint 4 Epic 9 T66+T68):**
  - `NEXT_PUBLIC_SENTRY_DSN` — client + server runtime DSN. **Required** em Production/Preview; **optional** em Development (empty → SDK init vira no-op, nenhum evento é enviado).
  - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — usados apenas no **build** do Vercel para source map upload. `next.config.ts` wrappa com `withSentryConfig` preservando `transpilePackages`. Required em Production/Preview, optional em Dev.
- `CRON_SECRET`
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NEWSLETTER_FROM_DOMAIN` (Sprint 1b — Brevo removed)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (Sprint 1b)
- `CAMPAIGN_PDF_SIGNED_URL_TTL` (opcional, default 86400 = 24h — TTL em segundos dos signed URLs de PDFs de campanha)
- Sprint 2: nenhuma env var nova — multi-ring scoping resolve via middleware + `sites.domains` array no DB

### API (`apps/api/.env.local`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `PORT`, `WEB_URL`
- **Sentry (Sprint 4 Epic 9 T67+T68):**
  - `SENTRY_DSN` — required em Production, optional em Development (empty → `initSentry()` vira no-op). `onError` hook captura exceções com tag `route`.

### Production (Vercel)
- Mesmos valores do `.env.local` mas com URLs de prod
- `NEXT_PUBLIC_APP_URL=https://bythiagofigueiredo.com`
- `NEXT_PUBLIC_API_URL=https://bythiagofigueiredo-api.vercel.app` (até api.bythiagofigueiredo.com propagar)

## Roadmap

`docs/roadmap/README.md` — 3 fases, 424h, 19 semanas.

- **Sprint 0** ✅ done — infra + env + db link
- **Sprint 1a** ✅ done — blog schema, RLS, homepage, API setup, site_visible helper
- **Sprint 1b** ✅ done — campaigns schema/RLS, Brevo+Turnstile libs, landing pages, cron, seed
- **Sprint 2** ✅ done — @tn-figueiredo/cms package, multi-ring schema, blog MDX rendering, admin CRUD
- **Sprint 3** ✅ done — auth + invite flow, newsletter/contact forms, campaign admin CRUD, PostEditor polish, cron locks (~40 commits, audit 93→99)
- **Sprint 4a** ✅ done (2026-04-15) — Epics 8+9+10: DB-gated RPC integration tests, Sentry observability (web+api) + PII scrubber, structured cron logs (`lib/logger.ts`), LGPD retention (unsubscribe anonymization, contact anonymize RPC, `purge_sent_emails` 90d cron). 263 web + 4 api tests. 3 migrations em prod.
- **Sprint 4b** ✅ done (2026-04-16) — Epics 6+7: `@tn-figueiredo/cms@0.1.0-beta.2` + `@tn-figueiredo/email@0.1.0` published to GitHub Packages (repos `TN-Figueiredo/cms` + `TN-Figueiredo/email`). apps/web consome pinned. `transpilePackages: ['@tn-figueiredo/cms']` retido (contrato v0.1.x — ESM + JSX preservado); `/ring` subpath Edge-safe. Spec: [sprint-4b.md](docs/superpowers/specs/sprint-4b.md)
- **Sprint 4.5** ✅ done — login split (admin/cms).
- **Sprint 4.75** ✅ done (2026-04-16) — RBAC v3 + multi-site hardening: 4 roles (super_admin/org_admin/editor/reporter), `site_memberships` table, DB-checked role helpers (`is_member_staff()` closes JWT staleness gap), `audit_log` + triggers + IP/UA GUC, publish-review trigger, invitation role_scope, cross-domain redirects. 5 parallel tracks, ~70 migrations.
- **Sprint 5a** ✅ done (2026-04-16) — LGPD compliance: 18 migrations (`lgpd_requests`, `consents`, `consent_texts`, 7 RPCs, storage bucket, FK ON DELETE SET NULL, audit_log skip-cascade guard), `@tn-figueiredo/lgpd@0.1.0` wiring (6 adapters + container + use-case glue), 9 API routes, 8 UI components, 6 account pages, consent-aware Sentry init, privacy+terms MDX (pt-BR+en), `/privacy` + `/terms` routes, CI DB-integration job, 4 feature flags, vitest coverage for `lib/lgpd/**`. Prod DB on-schema; Vercel deploy pending via PR #24.
- **Sprint 5b** ✅ done (2026-04-17) — SEO hardening: 5 PRs merged A→B→C→D→E (#32-#36) + deploy PR #37 staging→main. 4 migrations, 16 `lib/seo/` modules (config/page-metadata/jsonld/og/enumerator/cache-invalidation/frontmatter/identity-profiles/etc), `app/sitemap.ts` + `app/robots.ts` + 3 OG routes (Node runtime, direct-host lookup per Next #58436), 7 archetypes wired com `<JsonLdScript>` @graph via schema-dts (WebSite + Person + BlogPosting/Article/Breadcrumb/FAQ/HowTo/Video), 11 server actions com cache-invalidation tags + archivePost bug fix, admin site actions (branding/identity/defaults), Lighthouse CI (SEO ≥95, perf ≥80 mobile), `scripts/seo-smoke.sh`, `/api/health/seo` CRON endpoint, `docs/runbooks/seo-incident.md` (6 scenarios + 8 known-limitations) + `sprint-5b-post-deploy.md` (12-step). 5 env-var feature flags (`NEXT_PUBLIC_SEO_*` + `SEO_SITEMAP_KILLED` + `SEO_AI_CRAWLERS_BLOCKED=true`; DB-driven refactor em Sprint 8.5 pós-pre-study). Twitter handle `tnFigueiredo`; supported_locales `{pt-BR,en}`. Prod verified 2026-04-17: sitemap/robots/home/privacy/health green. Follow-ups: Figma-export og-default.png, real identity/thiago.jpg photo, pyftsubset Inter font (415KB→35KB), debug enumerator blogIndex missing, investigate OG dynamic 302 fallback via Sentry. Spec: `docs/superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md` (98/100). Plan: `docs/superpowers/plans/2026-04-16-sprint-5b-seo-hardening.md` (72 tasks, 7796 linhas).
- **Sprint 5c** ✅ done (2026-04-20) — Playwright E2E suite: 77 tests across 13 spec files, 6 POMs, 5 fixture modules (global-setup/teardown, auth.setup, seed-helpers, index), CI workflow (`e2e.yml` with `supabase/setup-cli` + secrets validation). Quality audit 75→98/100: 18 fixes. Testid audit: 20/20 present. A11y: AxeBuilder on 5/5 areas. 777 vitest tests passing.
- **Sprint 5e** ✅ done (2026-04-22) — Newsletter CMS Engine: Brevo fully removed, Resend as sole email provider, 5 new tables (newsletter_editions/sends/click_events/webhook_events/blog_cadence), content queue model, React Email templates, 8 CMS pages (dashboard/editor/analytics/subscribers/settings/content-queue/web-archive), batch send cron with CAS + crash recovery + bounce auto-pause, RFC 8058 one-click unsubscribe, Svix webhook verification, LGPD tracking anonymization cron, webhook purge cron. 3 migrations, 750 tests, 20 commits. Package extraction: `@tn-figueiredo/email@0.2.0`, `@tn-figueiredo/newsletter@0.1.0`, `@tn-figueiredo/newsletter-admin@0.1.0` published. App wired to consume packages. Spec: `docs/superpowers/specs/2026-04-20-newsletter-cms-engine-design.md`. Plan: `docs/superpowers/plans/2026-04-20-newsletter-cms-engine.md`.
- **Sprint 5d** ☐ — Vercel deploy hardening (build perf, edge config).
- **Sprint 6** ☐ — Burnout & MVP Launch (30h)
- Roadmap source of truth: [docs/roadmap/README.md](docs/roadmap/README.md)

## Code Standards

### TypeScript
- `strict: true`
- Nunca `any` — usar tipos específicos ou `unknown`
- Zod para validação de schemas da API

### Naming
- Arquivos: kebab-case (`blog-post.ts`)
- Classes: PascalCase (`CreatePostUseCase`)
- Interfaces: PascalCase com I (`IPostRepository`)
- DB columns: snake_case (`published_at`)

### Commits
Formato: `tipo: descrição curta`
Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `ci`

### Branches
- `staging` = default/dev
- `main` = production
- `feat/xxx`, `fix/xxx`, `chore/xxx`

## Ecosystem Packages (@tn-figueiredo/*)

Apps consomem `@tn-figueiredo/*` via `.npmrc` → `npm.pkg.github.com`.
Versões exatas (sem `^`) — pre-commit hook valida pinning.

Packages instalados (conforme `package.json`):
- api: `auth@1.3.0`, `auth-fastify@1.1.0`, `auth-supabase@1.1.0`, `audit@0.1.0`, `lgpd@0.1.0`, `shared@0.8.0`
- web: `admin@0.3.0`, `auth-nextjs@2.0.0`, `cms@0.1.0-dev (workspace)`, `email@0.2.0`, `newsletter@0.1.0`, `newsletter-admin@0.1.0`, `notifications@0.1.0`, `seo@0.1.0`, `shared@0.8.0`

Upgrade: editar `package.json` + `npm install` → CI valida pinning.

## CI

### Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push/PR `staging` | typecheck, test (api+web), audit, secret-scan, ecosystem-pinning, seo-smoke (preview, SKIP_HEALTH=1), check-migration-applied |
| `lighthouse.yml` | PR `staging`/`main` on apps/web/packages/cms changes | LHCI desktop + mobile; SEO ≥95 error, perf ≥80 warn |
| `seo-post-deploy.yml` | manual dispatch | Run `scripts/seo-smoke.sh` against any host (typically prod post-deploy) |

### Secrets

| Secret | Required | Used by |
|---|---|---|
| `NPM_TOKEN` | yes | classic PAT `read:packages` for `@tn-figueiredo/*` |
| `GITHUB_TOKEN` | auto | wait-for-vercel-preview, gh CLI |
| `CRON_SECRET` | yes | seo-smoke check #8 (`/api/health/seo`) |
| `LHCI_GITHUB_APP_TOKEN` | optional | Lighthouse CI PR comments |

### SEO post-deploy smoke (manual)

`scripts/seo-smoke.sh` runs 8 checks. Invocation:

```bash
# Local against prod:
CRON_SECRET=$(grep CRON_SECRET apps/web/.env.local | cut -d= -f2) \
  ./scripts/seo-smoke.sh https://bythiagofigueiredo.com

# Pre-PR-E (skip health check):
SKIP_HEALTH=1 ./scripts/seo-smoke.sh https://bythiagofigueiredo.com
```

Manual flow: Actions → SEO Post-Deploy Smoke → Run workflow → enter `host` + `skip_health`.

## O que NÃO fazer

- Não instalar deps sem validar
- Não commitar secrets (`.env.local`, `supabase/.temp/`) — gitignore já bloqueia
- Não usar `any` no código
- Não criar files desnecessários (preferir editar existentes)
- Não fazer force-push em `main` ou `staging` sem autorização explícita
- Não chamar `getSupabaseServiceClient()` de server actions sem antes validar `canAdminSite(siteId)` — service role bypassa RLS e permite cross-ring writes
- Não importar server actions diretamente em client components — passe callbacks via props (pattern do `@tn-figueiredo/cms` PostEditor)
