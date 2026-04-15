# Sprint 2 — CMS & Blog Design

**Data:** 2026-04-15
**Sprint:** 2 (CMS & Blog)
**Horas estimadas:** 38h
**Depende de:** Sprint 1a ✅ + Sprint 1b ✅
**Desbloqueia:** Sprint 3 (Admin & Forms)

## Goal

Entregar `@tn-figueiredo/cms` package reutilizável com interfaces genéricas + implementação Supabase, blog público renderizando MDX, admin CRUD com editor toolbar+preview, e multi-ring schema fundacional pro modelo conglomerado.

## Exit criteria

- [ ] Tabelas `organizations`, `organization_members`, `sites` existem com RLS ring-scoped
- [ ] `blog_posts.site_id` e `campaigns.site_id` são NOT NULL com FK → `sites.id`
- [ ] `@tn-figueiredo/cms@0.1.0` publicado no GitHub Packages com interfaces, MDX compiler, editor components, e unit tests
- [ ] `/blog/pt-BR` renderiza lista de posts publicados com paginação
- [ ] `/blog/pt-BR/primeiro-post` renderiza MDX com TOC, reading time, metadata
- [ ] `/cms/blog` lista posts com filtros de status/locale/search
- [ ] `/cms/blog/new` cria draft e redireciona ao editor
- [ ] `/cms/blog/{id}/edit` permite editar título, slug, content MDX, excerpt, cover, meta SEO
- [ ] Toolbar insere formatting + componentes MDX no cursor
- [ ] Preview recompila via server action (shiki server-side only)
- [ ] [Salvar] persiste draft + compila + extrai TOC + reading time
- [ ] [Publicar] / [Despublicar] / [Arquivar] / [Deletar] funcionam com confirmação
- [ ] Autosave localStorage com restore prompt
- [ ] On-demand ISR revalidation ao publicar/despublicar
- [ ] `canAdminSite()` protege todas as write actions (ring-scoped)
- [ ] `npm test` verde em ambos workspaces + `@tn-figueiredo/cms` tests
- [ ] Seed inclui org + site + membership + blog posts com site_id NOT NULL

---

## Arquitetura

### Multi-ring schema ("One Ring" pattern)

O projeto é um conglomerado multi-site onde cada "ring" (organização) controla seus sites filhos. `bythiagofigueiredo.com` é o master ring — pode administrar todos os outros. Outros rings controlam apenas a si mesmos mas podem ser controlados pelo master.

```
organizations (rings)
  ├─ id uuid PK
  ├─ name text NOT NULL
  ├─ slug text UNIQUE NOT NULL
  ├─ parent_org_id uuid FK → organizations (NULL = master ring)
  ├─ created_at / updated_at

organization_members
  ├─ id uuid PK
  ├─ org_id uuid FK → organizations
  ├─ user_id uuid FK → auth.users
  ├─ role text NOT NULL CHECK (role IN ('owner','admin','editor','author'))
  ├─ created_at
  ├─ UNIQUE(org_id, user_id)

sites
  ├─ id uuid PK
  ├─ org_id uuid FK → organizations
  ├─ name text NOT NULL
  ├─ slug text UNIQUE NOT NULL
  ├─ domains text[] NOT NULL DEFAULT '{}'
  ├─ default_locale text NOT NULL DEFAULT 'pt-BR'
  ├─ supported_locales text[] NOT NULL DEFAULT '{pt-BR}'
  ├─ created_at / updated_at
```

**Ring hierarchy:** `parent_org_id` permite N níveis. Staff do parent ring pode administrar sites dos child rings (cascade up). Sprint 2 suporta 2 níveis (master + direct children).

**Existing FK enforcement:** `blog_posts.site_id` e `campaigns.site_id` (hoje `uuid NULL` sem FK) ganham:
1. UPDATE existing rows → set site_id to the default site
2. ALTER to NOT NULL
3. ADD FK → sites.id

### RLS helpers (novos + backward compat)

```sql
-- Existing (unchanged for backward compat)
public.is_staff()         -- reads app_metadata.role, returns true for editor|admin|super_admin
public.site_visible(uuid) -- public read scoping (unchanged)

-- New
public.org_role(p_org_id uuid)
  -- Returns role from organization_members for current user (JWT sub)
  -- NULL if not a member

public.is_org_staff(p_org_id uuid)
  -- org_role(p_org_id) IN ('owner','admin','editor')

public.can_admin_site(p_site_id uuid)
  -- 1. Get site's org_id from sites table
  -- 2. If user is member of that org with staff role → true
  -- 3. If user is member of the PARENT org (master ring) with staff role → true
  -- 4. Else → false
```

**Backward compat:** `is_staff()` permanece e funciona como "god mode bypass" — qualquer usuário com `app_metadata.role IN (editor,admin,super_admin)` bypassa ring scoping. Os 135 testes existentes continuam verdes sem mudança. Novos write policies ADICIONAM `can_admin_site()` como refinamento; não substituem `is_staff()`. Quando o segundo ring aparecer, `is_staff()` passa a checar membership no master ring.

### Blog schema evolution

```sql
-- Rename: plain markdown column → MDX source
ALTER TABLE blog_translations RENAME COLUMN content_md TO content_mdx;

-- New columns for pre-compiled output
ALTER TABLE blog_translations
  ADD COLUMN content_compiled jsonb,          -- serialized MDX (pre-compiled on save)
  ADD COLUMN content_toc jsonb DEFAULT '[]',  -- [{depth, text, slug}] headings
  ADD COLUMN reading_time_min int DEFAULT 0;  -- ceil(word_count / 200)

-- Title search index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX blog_translations_title_trgm
  ON blog_translations USING gin (title gin_trgm_ops);
```

**Backward compat:** existing `content_md` values are plain markdown which IS valid MDX (superset). `content_compiled` starts NULL — public pages fall back to runtime compile when compiled is NULL (handles legacy posts not yet re-saved through admin).

---

## @tn-figueiredo/cms package

### Responsabilidade

Camada de abstração entre o storage (Supabase) e o consumer (Next.js app). Exporta interfaces, tipos, componentes React (editor/preview), MDX compilation, e component registry. Não conhece routing nem layout — isso é do consumer.

### Estrutura

```
@tn-figueiredo/cms/
  src/
    interfaces/
      content-repository.ts    -- IContentRepository<T> (generic CRUD + status)
      post-repository.ts       -- IPostRepository extends IContentRepository<Post>
      content-renderer.ts      -- compileMdx, MdxRenderer, ComponentRegistry
      ring-context.ts          -- IRingContext (org/site resolution)

    supabase/
      content-repository.ts    -- SupabaseContentRepository<T> (base impl)
      post-repository.ts       -- SupabasePostRepository (blog-specific)
      ring-context.ts          -- SupabaseRingContext
      asset-upload.ts          -- uploadContentAsset()

    mdx/
      compiler.ts              -- compileMdx(source, registry) → CompiledMdx
      renderer.tsx             -- <MdxRenderer compiled={} registry={} />
      default-components.ts    -- Callout, YouTube, Image (no shiki)
      shiki-code-block.ts      -- opt-in heavy dep (separate export: @tn-figueiredo/cms/code)
      toc.ts                   -- extractToc(compiled) → TocEntry[]
      reading-time.ts          -- calculateReadingTime(source) → number

    editor/
      toolbar.tsx              -- <EditorToolbar onAction={} />
      preview.tsx              -- <EditorPreview /> (calls server action for compile)
      editor.tsx               -- <PostEditor /> (textarea + toolbar + preview)
      asset-picker.tsx         -- file upload → insert in editor

    types/
      content.ts               -- ContentStatus, ContentListOpts, CompiledMdx, TocEntry
      post.ts                  -- Post, PostTranslation, PostListItem
      schemas.ts               -- zod schemas matching DB types

    index.ts                   -- barrel exports (excl shiki)
    code.ts                    -- shiki entry point
```

### Interfaces principais

```ts
// Generic content repository — shared across ALL content types
interface IContentRepository<T, TCreate, TUpdate, TListItem> {
  list(opts: ContentListOpts): Promise<TListItem[]>
  getById(id: string): Promise<T | null>
  getBySlug(opts: { siteId: string; locale: string; slug: string }): Promise<T | null>
  create(input: TCreate): Promise<T>
  update(id: string, patch: TUpdate): Promise<T>
  publish(id: string): Promise<T>
  unpublish(id: string): Promise<T>
  schedule(id: string, scheduledFor: Date): Promise<T>
  delete(id: string): Promise<void>
  count(opts: ContentCountOpts): Promise<number>
  // Future-ready: save draft revision without affecting published version
  saveDraft?(id: string, patch: TUpdate): Promise<T>
}

// Blog-specific
interface IPostRepository extends IContentRepository<Post, CreatePostInput, UpdatePostInput, PostListItem> {
  getByAuthor(authorId: string, opts: ContentListOpts): Promise<PostListItem[]>
  listWithReadingTime(opts: ContentListOpts): Promise<(PostListItem & { readingTimeMin: number })[]>
}

// Content renderer
interface IContentRenderer {
  compile(source: string, registry: ComponentRegistry): Promise<CompiledMdx>
}

// Ring context
interface IRingContext {
  getOrg(orgId: string): Promise<Organization | null>
  getSite(siteId: string): Promise<Site | null>
  getSitesForOrg(orgId: string): Promise<Site[]>
  canAdminSite(userId: string, siteId: string): Promise<boolean>
}
```

### Types

```ts
type ComponentRegistry = Record<string, React.ComponentType<Record<string, unknown>>>

interface CompiledMdx {
  serialized: MDXRemoteSerializeResult  // from next-mdx-remote
  toc: TocEntry[]
  readingTimeMin: number
}

interface TocEntry {
  depth: number  // 1-6
  text: string
  slug: string   // kebab-case from text
}

type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived'
```

### Component registry

Default components (safe, no heavy deps):

```ts
const defaultComponents = {
  Callout: CalloutComponent,     // tip/warning/error boxes
  YouTube: YouTubeEmbed,         // iframe with sandbox
  Image: OptimizedImage,         // next/image wrapper
}
```

Opt-in shiki (separate export path `@tn-figueiredo/cms/code`):

```ts
import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'
const registry = { ...defaultComponents, CodeBlock: ShikiCodeBlock }
```

Consumer estende com componentes site-specific:

```ts
const myRegistry = { ...defaultComponents, PricingTable: MyPricingTable }
```

A allowlist do MDX compiler usa `Object.keys(registry)` — só componentes registrados ficam disponíveis.

### Dependencies

```json
{
  "dependencies": {
    "next-mdx-remote": "5.0.0",
    "zod": "3.x"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0"
  },
  "optionalDependencies": {
    "@shikijs/rehype": "3.x"
  }
}
```

### Testes do package

- Interfaces: type-level (TS compiles = contracts ok)
- `SupabasePostRepository`: unit tests with mocked Supabase client
- MDX compiler: real compilation snapshot tests
- Editor: `@testing-library/react` — toolbar inserts, preview calls, onSave fires
- TOC extraction + reading time: pure function unit tests

---

## Páginas públicas

### Rotas

```
/blog                     → redirect 308 → /blog/{site.default_locale}
/blog/[locale]            → lista paginada (ISR revalidate=3600)
/blog/[locale]/[slug]     → post individual (MDX rendered, ISR revalidate=3600)
```

### `/blog/[locale]` — lista

Server component:
1. `postRepository.list({ siteId, locale, status: 'published', page, perPage: 12 })`
2. Grid de cards: título, excerpt, cover_image, author, reading_time_min, published_at
3. Paginação via query param `?page=2` (server-side)
4. `generateMetadata`: title "Blog — {site.name}", description, canonical, hreflang alternates

### `/blog/[locale]/[slug]` — detalhe

Server component:
1. `postRepository.getBySlug({ siteId, locale, slug })`
2. Se null → `notFound()`
3. Se `content_compiled` exists → `<MdxRenderer compiled={} registry={} />` (fast path)
4. Se `content_compiled` is null → runtime `compileMdx(content_mdx, registry)` (legacy fallback)
5. Layout: 2 colunas desktop (content + TOC sidebar), 1 coluna mobile (TOC dropdown)
6. Footer: published_at, reading_time_min, share links
7. `generateMetadata`: meta_title, meta_description, og_image_url, JSON-LD `BlogPosting`, hreflang alternates

Locale switching: header mostra toggle entre locales disponíveis pra o mesmo post (`availableLocales` derivado das translations do mesmo post_id).

### Cache / ISR

```tsx
export const revalidate = 3600 // ISR: rebuild every 1h

// On-demand revalidation on publish/unpublish:
import { revalidatePath } from 'next/cache'
revalidatePath(`/blog/${locale}/${slug}`)
revalidatePath(`/blog/${locale}`)
```

---

## Admin blog CRUD

### Rotas

```
/cms/blog                 → lista de posts (todos os status, filtros)
/cms/blog/new             → criar draft + redirect
/cms/blog/[id]/edit       → editor completo
```

### `/cms/blog` — lista admin

```
┌──────────────────────────────────────────────────────────────┐
│ Blog Posts                                        [+ Novo]   │
├──────────────────────────────────────────────────────────────┤
│ Filtros: [Todos ▾] [pt-BR ▾] [Buscar...          ]          │
├──────────────────────────────────────────────────────────────┤
│ ● Primeiro post          published   pt-BR, en    14 Abr     │
│ ○ Rascunho               draft       pt-BR        14 Abr     │
│ ◐ Agendado               scheduled   pt-BR        21 Abr     │
│                                                 [...] menu   │
└──────────────────────────────────────────────────────────────┘
```

- Server component pra data, client component pros filtros
- Badges de status coloridos (draft=gray, scheduled=yellow, published=green, archived=red)
- `[Buscar...]`: title search via `ilike '%term%'` (trigram index)
- `[...]` menu: Arquivar / Deletar (com regras — ver Delete flow)
- `[+ Novo]` → server action cria draft → redirect `/cms/blog/{id}/edit`

### `/cms/blog/[id]/edit` — editor

```
┌──────────────────────────────────────────────────────────────┐
│ ← Blog Posts    Editando: Primeiro post      [Salvar] [Pub]  │
├──────────────────────────────────────────────────────────────┤
│ Locale: [pt-BR ▾] [+ Adicionar en]                           │
├──────────────────────────────────────────────────────────────┤
│ Título:  [Primeiro post                              ]       │
│ Slug:    [primeiro-post                              ] 🔒    │
│ Excerpt: [Olá mundo                                  ]       │
│ Cover:   [📎 Escolher imagem]  preview.jpg                   │
├──────────────────────────────────────────────────────────────┤
│ [B] [I] [H1] [H2] [``] [```] [Link] [Img] [+Comp]          │
├────────────────────────┬─────────────────────────────────────┤
│  # Olá                 │  Olá (h1 rendered)                  │
│                        │                                     │
│  Conteúdo pt-BR.       │  Conteúdo pt-BR.                    │
│                        │                                     │
│  <Callout type="tip">  │  ┌─────────────────────────┐       │
│  Dica importante       │  │ 💡 Dica importante      │       │
│  </Callout>            │  └─────────────────────────┘       │
│                        │                                     │
│  textarea (raw MDX)    │  preview (server action)            │
├────────────────────────┴─────────────────────────────────────┤
│ Meta SEO                                                     │
│ meta_title:       [Primeiro post — ByThiagoFigueiredo    ]   │
│ meta_description: [Olá mundo — primeiro post do blog     ]   │
│ og_image_url:     [https://...                           ]   │
└──────────────────────────────────────────────────────────────┘
```

### Editor behaviors

**Locale tabs:** cada translation editada independentemente. `[+ Adicionar en]` cria translation row pro mesmo post.

**Slug:** auto-gerado do título (kebab-case), editável, lock icon pós-publish. Validado contra trigger de uniqueness per (site, locale).

**Toolbar:** insere snippets no cursor. `[+Comp]` abre dropdown com keys do registry pra inserir `<ComponentName />`.

**Preview:** server action `compilePreview(source)` debounced 500ms. Shiki roda server-side only. Preview pane mostra MDX compilado ou parse error com line number.

**[Salvar]:** server action `savePost`:
1. `compileMdx(content_mdx, registry)` → `CompiledMdx`
2. `extractToc()` + `calculateReadingTime()`
3. `supabase.update({ content_mdx, content_compiled, content_toc, reading_time_min })`
4. Clear localStorage draft

**[Publicar]:** `postRepository.publish(postId)` + `revalidatePath()`.

**Cover image:** upload via `uploadContentAsset()` → bucket `content-files` → insere URL.

### Autosave

- On content change, debounce 30s → save to localStorage key `cms-draft-${postId}-${locale}`
- On mount: if localStorage draft exists AND newer than DB → prompt "Restore unsaved changes?"
- On explicit [Salvar]: clear localStorage entry
- On navigate away with unsaved changes: `beforeunload` warning

### Error states

```ts
type SaveResult =
  | { ok: true; post: Post }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }
```

- Campo com borda vermelha + mensagem pra validation errors
- Toast pra erros de rede
- Preview pane mostra parse error do MDX com line number

### Creation flow

```
[+ Novo] click
  → server action createPost():
    1. insert blog_posts (status: 'draft', site_id, author_id)
    2. insert blog_translations (locale: default, title: 'Sem título', slug: auto, content_mdx: '')
    3. return id
  → redirect /cms/blog/{id}/edit
```

Post sempre existe no DB antes de editar — autosave funciona, URL bookmarkable.

### Delete flow

```
[...] menu → "Arquivar": status → archived (reversível, sai do público)
[...] menu → "Deletar": confirmation modal → hard delete (CASCADE translations)
  - Só disponível pra draft/archived (published deve ser archived primeiro)
  - revalidatePath pra limpar cache público
```

### Data flow

```
Editor (client)                        Server Actions                 DB
  │                                       │                            │
  ├─ onChange(source) ─debounce 500ms──→ compilePreview(source)         │
  │  ←── CompiledMdx ────────────────     └─ compileMdx()              │
  │                                                                    │
  ├─ [Salvar] ──────────────────────→ savePost(id, fields)             │
  │                                       ├─ compileMdx()              │
  │                                       ├─ extractToc()              │
  │                                       ├─ readingTime()             │
  │                                       └─ supabase.update() ──→ blog_translations
  │                                                                    │
  ├─ [Publicar] ────────────────────→ publishPost(id)                  │
  │                                       ├─ supabase.update() ──→ blog_posts.status
  │                                       └─ revalidatePath()          │
  │                                                                    │
  ├─ [Img] upload ──────────────────→ uploadAsset(file)                │
  │                                       └─ supabase.storage ───→ content-files
  │  ←── signed URL ────────────────                                   │
  └─ inserts ![](url) at cursor                                       │
```

### Proteção de rotas

- `/cms/*` gated pelo middleware `createAuthMiddleware`
- Server actions de CRUD: `canAdminSite(userId, siteId)` check (ring-scoped)
- Public routes: `site_visible(site_id)` via RLS (unchanged)

---

## Épicos e estimativas

```
Epic 1 — Multi-ring schema (6h)
  ├─ Migration: organizations + organization_members + sites
  ├─ Migration: FK blog_posts.site_id → sites.id (UPDATE → NOT NULL → FK)
  ├─ Migration: FK campaigns.site_id → sites.id (same)
  ├─ Migration: content-files storage bucket (NEW — coexists with campaign-files from Sprint 1b)
  ├─ RLS helpers: org_role(), is_org_staff(), can_admin_site()
  ├─ Update staff write policies to use can_admin_site()
  ├─ Seed: org + site + membership
  ├─ Tests: RLS ring-scoped

Epic 2 — Blog schema evolution (3h)
  ├─ Migration: content_md → content_mdx rename
  ├─ Migration: add content_compiled, content_toc, reading_time_min
  ├─ Migration: pg_trgm + title trigram index
  ├─ Update seed + existing tests

Epic 3 — @tn-figueiredo/cms package (14h)
  ├─ Repo setup: TS, vitest, build, publish config
  ├─ interfaces/: IContentRepository<T>, IPostRepository, IContentRenderer, IRingContext
  ├─ types/ + schemas/
  ├─ supabase/: SupabaseContentRepository<T>, SupabasePostRepository, asset upload
  ├─ mdx/: compileMdx, MdxRenderer, extractToc, readingTime, defaultComponents
  ├─ mdx/shiki-code-block (opt-in export)
  ├─ editor/: EditorToolbar, EditorPreview, PostEditor, AssetPicker
  ├─ Tests
  ├─ Extract from packages/cms/ to own repo TN-Figueiredo/cms
  ├─ Publish v0.1.0 to GitHub Packages
  ├─ Install @tn-figueiredo/cms@0.1.0 in apps/web (pinned, no ^)

Epic 4 — Public blog pages (6h)
  ├─ /blog redirect + /blog/[locale] list + /blog/[locale]/[slug] detail
  ├─ MDX rendering with fallback compile
  ├─ ISR + on-demand revalidation
  ├─ generateMetadata + JSON-LD + hreflang
  ├─ Tests

Epic 5 — Admin blog CRUD (9h)
  ├─ /cms/blog list + /cms/blog/new + /cms/blog/[id]/edit
  ├─ Server actions: save, publish, unpublish, archive, delete, compilePreview, uploadAsset
  ├─ Editor: toolbar + preview + locale tabs + meta SEO
  ├─ Autosave localStorage
  ├─ Error states + validation
  ├─ canAdminSite protection
  ├─ Tests
```

**Total: 38h**

### Dependências entre épicos

```
Epic 1 (schema) → Epic 2 (blog evolution) → Epic 3 (package) → Epic 4 (public)
                                                    │                    │
                                                    └─→ Epic 5 (admin) ←┘
```

Epic 4 e 5 são parcialmente paralelizáveis depois do Epic 3.

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| MDX compiler + shiki setup complexo | 40% | médio | `next-mdx-remote` abstrai; shiki é opt-in via export separado |
| Package dev loop lento (repo separado) | 30% | médio | Develop em `packages/cms/` via workspace → extrair no final |
| Ring RLS quebra testes existentes | 25% | alto | `is_staff()` mantido como backward compat; `can_admin_site()` adicionado incrementalmente |
| Editor preview debounce causa UX ruim | 20% | baixo | Server action < 200ms (shiki warm); fallback: increase debounce |

## Fora do escopo (Sprint 3+)

- Admin login page UI (Sprint 3)
- Campaign manager admin CRUD (Sprint 3)
- Newsletter/contact forms (Sprint 3)
- Full-text search no conteúdo (future)
- Draft revisions (interface preparada com `saveDraft?`, implementação future)
- Dark mode admin wiring (Sprint 3)
- Keyboard shortcuts na toolbar (Sprint 3)

## Decisões de design tomadas

| Decisão | Escolha | Alternativas consideradas |
|---|---|---|
| CMS package location | Repo próprio `@tn-figueiredo/cms` (empire pattern) | (a) queries diretas, (c) lib interna |
| Content rendering | MDX via `next-mdx-remote` + allowlist | (a) markdown+plugins, (c) markdown+blocks |
| Editor UX | Textarea + toolbar + preview server action | (a) textarea+preview only, (b) WYSIWYG rich editor |
| Dev workflow Sprint 2 | Workspace interno `packages/cms/` → extrai no final | (a) repo separado desde início, (c) npm link |
| Multi-ring | Desde já — `organizations` + `sites` + membership | (a) single-ring agora |
| Sanity migration | Descartada — conteúdo do zero | — |

## Notes & caveats

- **Backward compat com Sprint 1:** `is_staff()` mantido como god-mode fallback. `can_admin_site()` é additive, não substitutivo. Testes existentes (135) devem continuar verdes sem mudança.
- **content_compiled NULL fallback:** posts antigos (seed, Sprint 1) têm `content_compiled = NULL`. Public pages fazem runtime compile como fallback — performance degrada mas não quebra. First admin re-save popula o compiled output.
- **Shiki bundle:** opt-in via `@tn-figueiredo/cms/code`. Sites sem code blocks não pagam o custo (~2MB grammars).
- **localStorage autosave:** Sprint 2 scope. DB-based draft sync (cross-device) fica pra quando houver autores colaborando.
