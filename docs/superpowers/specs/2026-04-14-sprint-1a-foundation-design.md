# Sprint 1a — Foundation Design

**Data:** 2026-04-14
**Sprint:** 1a (Foundation — épicos 1–5 do Sprint 1 no roadmap)
**Horas estimadas:** 22h
**Depende de:** Sprint 0 (✅ done)
**Desbloqueia:** Sprint 1b (Campaigns)

## Goal

Entregar a fundação técnica do Sprint 1: auth ativa (Fastify + Next), schema inicial de blog com i18n N-locale, RLS policies, admin/CMS shells, API Fastify respondendo.

## Exit criteria

- [ ] `POST /auth/signin` e `/auth/signup` respondendo no Fastify
- [ ] Middleware Next valida JWT e decora `request.userId`; `/cms/*` e `/admin/*` redirecionam anônimos
- [ ] Schema `blog_posts` + `blog_translations` + `authors` criado via migration, passando nos testes de RLS
- [ ] `GET /health` do Fastify responde 200 com deps check (Supabase ping OK)
- [ ] Homepage portada do `~/Workspace/personal/bythiagofigueiredo` (só PT-BR)
- [ ] `/cms` e `/admin` renderizam shell via `createAdminLayout` do `@tn-figueiredo/admin`
- [ ] `npm test` verde (api + web)

## Arquitetura

### Camadas

```
apps/web (Next.js 15 App Router)
  ├─ app/(public)/          → homepage, futuros posts públicos
  ├─ app/cms/               → content management (blog, campaigns, newsletter)
  │   └─ layout.tsx         → createAdminLayout({ sections: cmsSections })
  ├─ app/admin/             → system management (users, settings)
  │   └─ layout.tsx         → createAdminLayout({ sections: adminSections })
  ├─ middleware.ts          → createAuthMiddleware (edge, valida Bearer)
  └─ lib/supabase/          → server + browser clients (@supabase/ssr)

apps/api (Fastify 5)
  ├─ src/server.ts          → bootstrap + plugins
  ├─ src/plugins/
  │   ├─ auth.ts            → registerAuthRoutes() do @tn-figueiredo/auth-fastify
  │   ├─ health.ts          → GET /health com Supabase ping
  │   └─ sentry.ts          → stub (Sprint 4 completa)
  └─ src/hooks/
      └─ on-signup.ts       → cria row em authors ao criar user

supabase/migrations/
  0001_blog_schema.sql
  0002_authors.sql
  0003_blog_rls.sql
  0004_homepage_seed.sql    → opcional, dev only
```

### Fluxo de auth

1. Usuário POST `/auth/signin` em `api.bythiagofigueiredo.com` (Fastify).
2. Fastify chama `SupabaseAuthService.signIn()` → Supabase retorna JWT.
3. Cliente armazena token via `@supabase/ssr` cookies.
4. Requisições a `/cms/*` no Next passam pelo middleware edge → `createAuthMiddleware` valida token → se inválido, redireciona `/signin`.
5. Route handlers de `/cms/*` usam `requireUser()` + `requireRole('editor'|'admin'|'super_admin')`.
6. Role lida de `auth.users.app_metadata.role` (string).

**Sprint 1a expõe `signup` publicamente** para dev. Em produção (Sprint 5 antes do launch) a rota é desabilitada via config (`prefix: false` ou feature flag), e usuários novos entram via convite no `/admin`. Single super_admin (Thiago) criado via seed + SQL `update auth.users set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data,'{}'::jsonb), '{role}', '"super_admin"')`.

## Schema (blog)

### `authors`

```sql
create table authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null unique,
  name text not null,
  slug text not null unique,
  bio_md text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on authors (user_id);
```

Hook `onPostSignUp` (Fastify) cria `authors` row automaticamente (`user_id`, `name=email local-part`, `slug=generated`). Thiago pode editar depois.

### `blog_posts`

```sql
create type post_status as enum ('draft','scheduled','published','archived');

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,                                      -- null = bythiagofigueiredo
  author_id uuid not null references authors(id) on delete restrict,
  status post_status not null default 'draft',
  published_at timestamptz,
  scheduled_for timestamptz,
  cover_image_url text,                              -- default; override em translations
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index on blog_posts (status, published_at desc);
create index on blog_posts (site_id, status);
create index on blog_posts (status, scheduled_for) where status = 'scheduled';
```

### `blog_translations`

```sql
create table blog_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  locale text not null,                              -- 'pt-BR','en','vi','fr','zh-CN','ru', etc
  title text not null,
  slug text not null,
  excerpt text,
  content_md text not null,
  cover_image_url text,                              -- override (null = usar do post)
  meta_title text,
  meta_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on blog_translations (post_id, locale);
-- slug único por (site, locale) — via função que busca site_id do post pai
create unique index blog_translations_site_locale_slug
  on blog_translations (post_id, locale, slug);
-- nota: unicidade real por (site_id, locale, slug) exige trigger ou view materializada.
-- S1: adicionar trigger before insert/update que valida contra blog_posts.site_id.
```

**Formato de conteúdo: Markdown (`content_md`).** Renderer vem do `@tn-figueiredo/shared` (se expor) ou `react-markdown` + `remark-gfm` direto. Portabilidade > riqueza de blocos custom. Decisão irreversível sem migration pesada.

### Triggers

- `updated_at` auto-update via trigger genérico `tg_set_updated_at()`.
- `validate_translation_slug_unique_per_site()`: before insert/update em `blog_translations`, join em `blog_posts.site_id` e raise exception se `(site_id, locale, slug)` já existe.

## RLS

### Helper functions

```sql
create function auth.user_role() returns text language sql stable as $$
  select coalesce(auth.jwt()->'app_metadata'->>'role', 'anon')
$$;

create function auth.is_staff() returns boolean language sql stable as $$
  select auth.user_role() in ('editor','admin','super_admin')
$$;

create function auth.is_admin() returns boolean language sql stable as $$
  select auth.user_role() in ('admin','super_admin')
$$;
```

### Policies

**`blog_posts`** (RLS enabled):
- `select` pública: `using (status = 'published' and published_at <= now())`
- `select` staff: `using (auth.is_staff())`
- `insert/update/delete`: `using (auth.is_staff()) with check (auth.is_staff())`

**`blog_translations`**: mesma lógica, validando via join em `blog_posts.status`.

**`authors`**: `select` pública (published posts expõem autor); `insert/update/delete` só staff.

### Role matrix

| Role         | blog read         | blog write | authors write | users admin |
|--------------|-------------------|------------|---------------|-------------|
| anon         | published only    | —          | —             | —           |
| author       | published + own   | own drafts | own profile   | —           |
| editor       | all               | all        | all           | —           |
| admin        | all               | all        | all           | read        |
| super_admin  | all               | all        | all           | all         |

**Sprint 1a RLS scope:** só `anon` e `super_admin` realmente testados. Demais roles ficam no enum + helpers (estrutura pronta, policies aplicam corretamente quando roles forem atribuídas).

## API (Fastify)

### Dependências + init

```typescript
// apps/api/src/server.ts (shape)
const app = fastify({ logger: true });
await app.register(sentryPlugin);
await app.register(healthPlugin);
await app.register(authPlugin);  // usa registerAuthRoutes

app.listen({ port: process.env.PORT ?? 3333 });
```

### `authPlugin`

```typescript
import { registerAuthRoutes } from '@tn-figueiredo/auth-fastify';
import { SupabaseAuthService } from '@tn-figueiredo/auth-supabase';
import { SignUpUseCase, /* ... */ } from '@tn-figueiredo/auth';

const authService = new SupabaseAuthService({
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
});

await registerAuthRoutes(fastify, {
  authService,
  signUpUseCase: new SignUpUseCase({ authService, /* repos stub */ }),
  // ... demais use cases
  hooks: {
    onPostSignUp: async ({ userId, email }) => {
      // cria row em authors via supabase client
    },
  },
});
```

Endpoints ativos S1: `/auth/signup`, `/auth/signin`, `/auth/refresh`, `/auth/signout`, `/auth/verify-otp`, `/auth/resend-otp`, `/account/change-password`, `/account/change-email`.

**Stubs aceitáveis S1:** `forgotPassword`, `deleteAccount` (retornam 501) — ativados em sprint LGPD.

### `/health`

```typescript
app.get('/health', async () => {
  const dbOk = await supabaseService.from('authors').select('id').limit(1);
  return { status: 'ok', db: dbOk.error ? 'fail' : 'ok', time: new Date().toISOString() };
});
```

## Web (Next)

### Middleware (edge)

```typescript
// apps/web/middleware.ts
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware';

export default createAuthMiddleware({
  protectedPaths: ['/cms/:path*', '/admin/:path*'],
  signInPath: '/signin',
});

export const config = { matcher: ['/cms/:path*', '/admin/:path*'] };
```

### CMS shell

```typescript
// apps/web/app/cms/layout.tsx
import { createAdminLayout } from '@tn-figueiredo/admin';

const CmsLayout = createAdminLayout({
  appName: 'CMS',
  sections: [
    { group: 'Content', items: [
      { label: 'Blog posts', path: '/cms/blog', icon: 'pencil' },
      { label: 'Authors', path: '/cms/authors', icon: 'user' },
    ]},
    { group: 'Campaigns', items: [
      { label: 'Landing pages', path: '/cms/campaigns', icon: 'target' },
      { label: 'Submissions', path: '/cms/submissions', icon: 'inbox' },
    ]},
  ],
});

export default async function Layout({ children }) {
  const user = await requireUser();
  return <CmsLayout userEmail={user.email}>{children}</CmsLayout>;
}
```

### Admin shell

`/admin/layout.tsx` segue mesmo padrão com `sections` de system (S1: placeholder com "System settings — coming soon"). `requireRole('admin' | 'super_admin')` aplicado.

### Homepage

Portar `~/Workspace/personal/bythiagofigueiredo/src/app/page.tsx` (e dependências diretas: hero, bio, portfolio grid, footer) para `apps/web/app/(public)/page.tsx`. Sem refatoração — copiar + ajustar imports. Só PT-BR no S1. Posts no grid: hardcoded ou `select from blog_posts where status='published' limit 3`.

## Testes

### RLS (obrigatório)

`apps/api/test/rls/blog.test.ts` — Vitest + dois Supabase clients (anon JWT, super_admin JWT):
- anon lê apenas `status=published AND published_at<=now()`
- anon não consegue insert em `blog_posts`
- super_admin lê tudo
- super_admin insere/atualiza/deleta
- trigger de slug único por site falha corretamente em duplicado

### API

- `GET /health` → 200 com shape esperado
- `POST /auth/signup` com email válido → 200; com email inválido → 400
- `POST /auth/signin` com credenciais válidas → 200 com token; inválidas → 401
- Middleware: request sem token em `/cms` → redirect `/signin`

### Web

- Homepage renderiza sem erros (snapshot simples)
- `/cms` sem token redireciona para `/signin`

## Seed (dev only)

`supabase/seeds/dev.sql`:
- 1 user (Thiago, super_admin) — usa `auth.admin.createUser` via SQL helper
- 1 author ligado ao user
- 2 blog posts pt-BR (1 published, 1 draft)
- 1 blog post com tradução pt-BR + en (published)
- 1 blog post scheduled

## Migrations (ordem)

```
supabase/migrations/
  20260414000001_authors.sql
  20260414000002_blog_schema.sql
  20260414000003_triggers_updated_at.sql
  20260414000004_rls_helpers.sql
  20260414000005_blog_rls.sql
  20260414000006_translation_slug_trigger.sql
```

`npm run db:push:prod` após validação local via `db:reset`.

## ADRs embutidos (decisões pendentes)

- **ADR-1a-1: Markdown renderer** — `react-markdown + remark-gfm` default; trocar só se `@tn-figueiredo/shared` já expor um.
- **ADR-1a-2: Homepage posts source** — hardcoded no S1; pluga DB quando `/cms/blog` permitir publicar (final do S1a).

## Out of scope (vai pra 1b ou depois)

- Campaigns (schema, form, submissions, Brevo) → **Sprint 1b**
- Scheduling cron (`/api/cron/publish-scheduled`) → **Sprint 1b** (agrupa com scheduling de campaigns)
- Homepage i18n → Sprint 3+
- LGPD wiring completo → Sprint 4+
- `@tn-figueiredo/notifications` → Sprint 3 (newsletter)

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| API do `@tn-figueiredo/auth-*` mudar entre leitura e implementação | Baixa | Médio | Versões pinned (já no `.npmrc`) |
| RLS com JWT app_metadata não propagar em Edge middleware | Média | Alto | Testar isolado antes de compor layout |
| Hook `onPostSignUp` rodar fora de transação cria row órfã em authors | Baixa | Baixo | Try/catch + log Sentry; Thiago re-cria manual se falhar |
| Trigger de slug único por site vazar em concorrência | Baixa | Baixo | `for update` no trigger + serializable em admin save |
