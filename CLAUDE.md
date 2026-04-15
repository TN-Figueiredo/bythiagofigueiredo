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

## Database RLS helpers

- Helpers ficam em `public` (ownership do `auth` pertence a `supabase_admin`): `public.user_role()`, `public.is_staff()`, `public.is_admin()`, `public.site_visible(uuid)`.
- Policies de leitura pública de tabelas site-scoped DEVEM usar `public.site_visible(site_id)` — nunca duplicar a regra de três ramos inline.
- Contrato do GUC `app.site_id`: Next middleware executa `select set_config('app.site_id', '<uuid>', true)` por request. Valor vazio/unset = sem filtro (admin/cross-site). Valor inválido (não-uuid) = fail closed (esconde rows site-scoped).
- Staff (`editor|admin|super_admin`) bypassa o filtro via policies `_staff_read_all` — OR com a policy pública.
- **Idempotência em migrations de RLS:** sempre prefixe `create policy` com `drop policy if exists "<name>" on <table>;` e `create trigger` com `drop trigger if exists <name> on <table>;`. `create or replace function` já é idempotente. Pattern canônico: `supabase/migrations/20260414000008_rls_site_helper.sql` e `…000018_submissions_published_guard.sql`.

## Multi-ring (CMS conglomerate)

Conglomerado multi-site onde cada "ring" (organização) controla seus sites filhos. `bythiagofigueiredo.com` é o master ring — pode administrar child rings via cascade-up de `public.can_admin_site()`.

**Schema (Sprint 2):**
- `organizations` — rings, com `parent_org_id` (NULL = master ring). Slug global unique.
- `organization_members` — per-org roles: `owner | admin | editor | author`. Staff = `owner|admin|editor`. Unique `(org_id, user_id)`.
- `sites` — belong to an org. `domains text[]` pra hostname resolution. Slug unique per `(org_id, slug)`.
- `blog_posts.site_id` e `campaigns.site_id` — FK para `sites.id` (nullable até seed backfill; NOT NULL em migration futura).

**Helpers RLS (além dos do Sprint 1a):**
- `public.org_role(p_org_id)` — role do current user no org (via `auth.uid()`), ou NULL.
- `public.is_org_staff(p_org_id)` — `org_role IN ('owner','admin','editor')`, coalesce → false.
- `public.can_admin_site(p_site_id)` — staff do site's org OR staff do parent org (cascade up).
- `is_staff()` global (Sprint 1) permanece como "god mode" pra backward compat.

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
- `SENTRY_*` (vazio até Sprint 4)
- `CRON_SECRET`
- `BREVO_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (Sprint 1b)
- `CAMPAIGN_PDF_SIGNED_URL_TTL` (opcional, default 86400 = 24h — TTL em segundos dos signed URLs de PDFs de campanha)
- Sprint 2: nenhuma env var nova — multi-ring scoping resolve via middleware + `sites.domains` array no DB

### API (`apps/api/.env.local`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `PORT`, `WEB_URL`
- `SENTRY_*` (vazio até Sprint 4)

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
- **Sprint 3** next — Admin login UI, newsletter/contact forms, campaign admin CRUD, package extraction
- Spec de cada sprint em `docs/superpowers/specs/`

### Sprint 2 → Sprint 3 carry-over

Items from Sprint 2 spec exit criteria that were defensibly deferred:

- **localStorage autosave with restore prompt** — `PostEditor` has `onSave` callback but no debounced auto-persist. Implement before Sprint 3 admin login UI ships.
- **Meta SEO fields in editor** — `meta_title`, `meta_description`, `og_image_url` columns exist in `blog_translations` but `<PostEditor>` doesn't expose them.
- **Cover image picker** — `<AssetPicker>` exists but isn't wired into the editor's cover field.
- **Locale switcher on `/blog/[locale]/[slug]`** — `available_locales` is on `PostListItem` but not displayed.
- **Delete button in `/cms/blog`** — `deletePost` server action exists but no UI trigger.
- **`@tn-figueiredo/cms` extraction** (T14 of Sprint 2) — workspace package needs to move to own repo + publish v0.1.0 before second consumer arrives.

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
