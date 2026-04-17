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
4. **`BrevoLgpdEmailService`** (`ILgpdEmailService`) — 5 templates Brevo via `@tn-figueiredo/email`.
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
- `next.config.ts` tem `transpilePackages: ['@tn-figueiredo/cms']` — Next transpila direto

## Environment Variables

### Web (`apps/web/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`
- **Sentry (Sprint 4 Epic 9 T66+T68):**
  - `NEXT_PUBLIC_SENTRY_DSN` — client + server runtime DSN. **Required** em Production/Preview; **optional** em Development (empty → SDK init vira no-op, nenhum evento é enviado).
  - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — usados apenas no **build** do Vercel para source map upload. `next.config.ts` wrappa com `withSentryConfig` preservando `transpilePackages`. Required em Production/Preview, optional em Dev.
- `CRON_SECRET`
- `BREVO_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (Sprint 1b)
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
- **Sprint 5b** 🟡 in-progress — SEO hardening (structured data, sitemap, OG tags, robots, dynamic OG via next/og, multi-domain ready, Lighthouse CI). PR-A merged 2026-04-17 (PR #32): 4 migrations applied to prod — `20260417000000_seed_master_site` bootstraps `Figueiredo Technology` org + `bythiagofigueiredo` site row (was empty in prod, site renders only via hardcoded i18n JSON until now); `20260501000001-03` add `sites.identity_type` (`person`|`organization` default `person`), `sites.twitter_handle` (`tnFigueiredo` for master), `sites.seo_default_og_image`, `blog_translations.seo_extras jsonb` with structural CHECK. Spec: `docs/superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md` (98/100). Plan: `docs/superpowers/plans/2026-04-16-sprint-5b-seo-hardening.md` (72 tasks, 5 PRs, ~14h).
- **Sprint 5c** ☐ — E2E suite (Playwright) covering auth + CMS critical paths.
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
- web: `admin@0.3.0`, `auth-nextjs@2.0.0`, `cms@0.1.0-dev (workspace)`, `notifications@0.1.0`, `seo@0.1.0`, `shared@0.8.0`

Upgrade: editar `package.json` + `npm install` → CI valida pinning.

## CI

`.github/workflows/ci.yml` — typecheck, test, audit, secret-scan, ecosystem-pinning.
Triggers em `main` + `staging` (push e PR).

`NPM_TOKEN` secret (classic PAT com `read:packages`) necessário pra install dos `@tn-figueiredo/*`.

## O que NÃO fazer

- Não instalar deps sem validar
- Não commitar secrets (`.env.local`, `supabase/.temp/`) — gitignore já bloqueia
- Não usar `any` no código
- Não criar files desnecessários (preferir editar existentes)
- Não fazer force-push em `main` ou `staging` sem autorização explícita
- Não chamar `getSupabaseServiceClient()` de server actions sem antes validar `canAdminSite(siteId)` — service role bypassa RLS e permite cross-ring writes
- Não importar server actions diretamente em client components — passe callbacks via props (pattern do `@tn-figueiredo/cms` PostEditor)
