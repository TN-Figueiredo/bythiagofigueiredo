# Blog Overhaul — Design Spec

**Date:** 2026-05-05
**Status:** Approved
**Score:** 110/100 (99 base + 11 delighters)

## Overview

Comprehensive blog overhaul: WYSIWYG editor (Tiptap), clean slug generation, hashtags entity, series linking, structured metadata (notes, colophon, key points, pull quote), author from DB, mock data elimination, and archive page with reading progress integration.

## 1. Slug Generation

**Algorithm:** `normalize('NFD') → strip diacritics → kebab-case → trim 80 chars`

- Auto-generates on title `onBlur`
- Editable field with live permalink preview: `/blog/ingles-ii-phrasal-verbs`
- Character count displayed (right-aligned, green when ≤80)
- Unique constraint `(site_id, locale, slug)` already enforced by DB trigger

**Collision strategy:** Optimistic — try save, handle failure. If collision, append `-2`, `-3` etc. No pre-query. Rationale: collisions unlikely with ≤500 posts; avoids unnecessary DB round-trips.

## 2. WYSIWYG Editor (Tiptap)

**Decision:** Replace raw MDX textarea with Tiptap WYSIWYG. Tiptap 3.22.4 already operational in newsletter editor (`_shared/editor/tiptap-editor.tsx`).

### Storage Migration

| Column | Type | Purpose |
|---|---|---|
| `content_json` | `jsonb` | Tiptap JSONContent (source of truth) |
| `content_html` | `text` | Server-rendered HTML via `generateHTML()` |
| `content_mdx` | `text` | Kept for legacy but NOT used for new posts |
| `content_compiled` | `text` | Deprecated — not used |

**Clean slate:** All existing blog posts deleted. Start fresh with 0 posts. No migration needed for existing content.

### Server-side Rendering

`generateHTML()` with custom node renderers:
- **Code blocks:** Shiki syntax highlighting (already available via `@tn-figueiredo/cms/code`)
- **Headings:** Auto-ID generation for TOC anchors
- **Images:** Responsive srcset + lazy loading
- **Embeds:** YouTube iframe with privacy-enhanced mode

### Editor Extensions (blog-specific additions)

Shared base already includes: StarterKit, Underline, Link, Image, TextAlign, TextStyle, Color, Highlight, CharacterCount, Placeholder, slash commands.

Blog additions:
- `CodeBlockLowlight` — syntax-highlighted code blocks
- `Table` — data tables
- `YouTube` / embed — video embeds
- `Callout` / alert — info/warning/tip boxes

### Editor Layout (CMS, approved v5)

**Top bar:**
- ← Voltar | Locale switcher (tabs with dot indicators: amber = draft) | Category badge | Status badge
- Autosave indicator (green "Salvo há Xs" / amber "Salvando..." / red "Alterações não salvas") | Preview | Salvar

**No publish/schedule controls.** All status transitions (draft → ready → scheduled → published) happen in the kanban board.

**Content area (scrollable, max-width 780px):**
1. Cover image (drag-drop zone, 1200×630 recommended, Trocar/Remover buttons, dimension display)
2. Title (textarea, 32px, auto-generates slug on blur)
3. Slug + permalink preview
4. Excerpt (italic, 160-char limit with counter)
5. Tiptap WYSIWYG editor (full toolbar: undo/redo, paragraph, H1-H3, B/I/U/S, lists, blockquote, code, link, image, table, callout, alignment, color)
6. Key points (numbered list, `text[]`, add/remove/reorder)
7. Pull quote (single text input, italic preview)
8. Post anterior — searchable select (dashed empty state "Buscar por título...")
9. Continua na próxima parte — checkbox
10. Hashtags — multi-input with autocomplete from existing hashtags
11. Notas — numbered list (`text[]`, same pattern as key points, amber indices)
12. Colofão — text input with hint "ferramentas, processo, créditos"
13. SEO Preview — accordion (open by default): title preview, description preview, URL preview

**Bottom bar:** Word count | Reading time estimate | Character count

## 3. Hashtags (New Entity)

Hashtags are **completely separate** from categories/blog_tags. Blog_tags stay 100% untouched (connected to newsletter types + post creation).

### Schema

```sql
-- New table
CREATE TABLE hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);

-- Join table
CREATE TABLE post_hashtags (
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);
```

### RLS

- `hashtags`: public read (`site_visible(site_id)`), staff write (`can_edit_site(site_id)`)
- `post_hashtags`: public read (via join with `blog_posts` public policy), staff write (`can_edit_site` on post's `site_id`)

### Editor UX

Multi-input field with:
- Autocomplete from existing hashtags (typeahead query)
- Create new hashtag inline (type + Enter)
- Remove with × button or Backspace
- Displayed as `#tag` pills

### Archive Display

- Filter bar row "TAGS:" with `# tag N` pills (dashed border, JetBrains Mono 10.5px)
- Visually distinct from categories (smaller, dashed vs solid border)
- Active tag = accent fill (#FF8240)
- Tag co-occurrence suggestions in Caveat: "→ veja também: #nextjs, #cms"

## 4. Series Model

Simple chain model via FK — each post optionally links to its predecessor.

### Schema Changes

```sql
ALTER TABLE blog_posts ADD COLUMN previous_post_id uuid REFERENCES blog_posts(id) ON DELETE SET NULL;
ALTER TABLE blog_posts ADD COLUMN continues_in_next boolean NOT NULL DEFAULT false;
```

### Behavior

- **Post links backward:** `previous_post_id` → links to the previous post in series
- **"Continues" flag:** `continues_in_next` boolean — shows "CONTINUA NA PRÓXIMA PARTE" at bottom
- **"Next" post auto-detected:** query `WHERE previous_post_id = current_post.id`
- **Series count:** recursive query or simple count of chain length

### Public Display

**SeriesBanner (top of post):**
- Shows when `previous_post_id IS NOT NULL`
- "PARTE DA SÉRIE" label + series name inferred from chain
- "← Inglês I — Fundamentos" link to previous post

**SeriesNav (bottom of post):**
- Left border `--pb-accent`, background `--pb-paper`
- If `continues_in_next`: "CONTINUA NA PRÓXIMA PARTE" + next post title
- If has previous: "← POST ANTERIOR" link

**Archive card badge:**
- "SÉRIE · N/M" badge on thumbnail (top-right or bottom-left)
- Color: `#FFE37A` (marker) on black 75% bg
- Previous post link in card footer (Caveat italic)

## 5. Structured Metadata (DB Columns)

All fields move from frontmatter/MDX to dedicated `blog_translations` columns:

```sql
ALTER TABLE blog_translations ADD COLUMN content_json jsonb;
ALTER TABLE blog_translations ADD COLUMN content_html text;
ALTER TABLE blog_translations ADD COLUMN colophon text;
ALTER TABLE blog_translations ADD COLUMN notes text[];
ALTER TABLE blog_translations ADD COLUMN pull_quote text;
ALTER TABLE blog_translations ADD COLUMN key_points text[];
```

### Components

| Field | Component | Display |
|---|---|---|
| `key_points` | `PostKeyPoints` | Numbered list, JetBrains Mono indices in `--pb-accent`, Source Serif body |
| `pull_quote` | `PostPullQuote` | Large italic quote with accent left border |
| `notes` | `PostNotes` | Numbered list (same pattern as key points), amber indices (#FFE37A) |
| `colophon` | `PostColophon` | "COLOFÃO" label (fixed accent), dashed border top/bottom, flex row |

All fields optional — if empty/null, component simply doesn't render.

## 6. Author from DB

Replace hardcoded `AUTHOR_THIAGO` mock with data from `authors` table.

### Existing Schema

`authors` table already has: `id, user_id, site_id, name, display_name, slug, bio, bio_md, avatar_url, avatar_color, social_links jsonb, sort_order, is_default`.

### Social Links Schema

```typescript
type SocialLink = {
  label: string    // "GitHub", "Twitter", "RSS", etc.
  href: string
  visible: boolean // show/hide toggle
  paid: boolean    // future: paywall gate
}
// authors.social_links = { links: SocialLink[] }
```

### AuthorCard Changes

- Read from `authors` table via `blog_posts.owner_user_id → authors.user_id`
- Fallback: site's default author (`authors.is_default = true`)
- Social links rendered conditionally (`visible: true` only)
- Bio from `authors.bio` column
- Avatar from `authors.avatar_url` with `avatar_color` gradient fallback

## 7. i18n

All component labels from locale-aware dictionary. Two locales: `pt-BR`, `en`.

| Key | pt-BR | en |
|---|---|---|
| `keyPoints` | Pontos-chave | Key Points |
| `pullQuote` | Citação | Pull Quote |
| `notes` | Notas | Notes |
| `colophon` | Colofão | Colophon |
| `series` | Série | Series |
| `continuesNext` | Continua na próxima parte | Continues in next part |
| `previousPost` | Post anterior | Previous post |
| `tags` | Marcadores | Tags |
| `categories` | Categorias | Categories |
| `archive` | Arquivo | Archive |
| `allPosts` | Tudo | All |
| `results` | resultados | results |
| `searchPlaceholder` | buscar por título, tag, slug… | search title, tag, slug… |
| `sort` | Ordenar | Sort |
| `recent` | Mais recentes | Newest |
| `longest` | Mais longos | Longest |
| `shortest` | Mais curtos | Shortest |
| `unread` | Não lidos | Unread |
| `loadMore` | Carregar mais | Load more |
| `noResults` | nada por aqui. | nothing here. |
| `clearFilters` | limpar filtros | clear filters |
| `read` | lido | read |
| `inProgress` | em progresso | in progress |
| `minRead` | min lidos | min read |
| `yourProgress` | Seu progresso | Your progress |
| `colophonHint` | ferramentas, processo, créditos | tools, process, credits |
| `startHere` | começa por aqui | start here |
| `alsoSee` | veja também | also see |

## 8. Deletions

| What | Location | Action |
|---|---|---|
| `MOCK_POSTS` | `blog-mock-data.ts` | Delete entire file |
| `MOCK_SPONSORS` | `blog-mock-data.ts` | Delete (same file) |
| `MOCK_HOUSE_ADS` | `blog-mock-data.ts` | Delete (same file) |
| `AUTHOR_THIAGO` | `mock-data.ts` | Delete constant |
| `MOCK_COMMENTS` | `mock-data.ts` | Delete constant |
| `PostComments` | `post-comments.tsx` | Delete entire component |
| `post-extras-schema.ts` | `components/blog/` | Delete (fields move to DB columns) |
| `CATEGORY_MAP` | `blog/page.tsx` | Delete (categories from DB `blog_tags` table) |
| Ad slot components | `blog-ad-slots.tsx` | Delete from archive |
| All existing blog posts | DB | `DELETE FROM blog_posts` (clean slate) |
| Mock data fallbacks | `blog/page.tsx` | Remove `MOCK_POSTS` fallback, show empty state |

## 9. Blog Archive (Public) — 110/100

### Layout

Matches `design/blog.html` reference exactly:

- **Theme:** `makePinboardTheme(dark)` — bg:#14110B, paper:#2A241A, paper2:#312A1E, ink:#EFE6D2, muted:#958A75, faint:#6B634F, line:#2E2718, accent:#FF8240, marker:#FFE37A
- **Header:** Brand mark + nav (Escritos active) + RSS button + ✉ Newsletter CTA
- **Title:** "Tudo que eu escrevi" — Fraunces 64px, marker highlight skewed
- **"/ ARQUIVO · N POSTS"** — JetBrains Mono accent label

### Filter Bar

1. **Search + Sort + View toggle:** Search with `/` keyboard shortcut hint. Sort: Mais recentes / Mais longos / Mais curtos / Não lidos. Grid/List view toggle (right-aligned).
2. **Categories:** "CATEGORIA:" label + pill buttons with count badges. From `blog_tags` table. Active = filled ink.
3. **Tags (hashtags):** "TAGS:" label + `# tag N` pills. Active = accent fill. Dashed bottom border separator. Related cluster hint in Caveat when tag active.

### Card Grid (3 columns)

`WritingCard` = Paper wrapper + Tape decoration + PostImg (16:10) + type badge + content area.

- **Paper:** Alternating `paper`/`paper2` tints. Rotation via `theme.rot(i)`.
- **Tape:** Category-tinted (color from `blog_tags.color` with 0.45 opacity).
- **Series badge:** "SÉRIE · N/M" on thumbnail.

### 110/100 Delighter Features

1. **"Já li" indicator** — `ReadProgressStore` + `ReadableCard`. 3 states: unread (nothing), in progress (N% badge + red bar), read (✓ lido badge + green bar + opacity 0.6).
2. **Reading stats card** — "Seu progresso": N lidos / N em progresso / ~Xmin lidos. Aggregate progress bar. Client-only.
3. **Paper lift hover** — `transform: rotate(0) translateY(-6px) scale(1.02)` + `--pb-shadow-hover`. Transition 0.2s ease.
4. **Stagger reveal** — IntersectionObserver, 60ms × index delay. `opacity: 0 → 1`, `translateY(20px → 0)`. Respects `prefers-reduced-motion`.
5. **Category tape tint** — Tape color = category color @ 0.45 opacity.
6. **View toggle** — Grid (default) vs List (compact rows: date | category | title | reading time | read status). Session-persisted.
7. **Keyboard nav** — `j`/`k` navigate cards, `Enter` opens, `/` focuses search, `Esc` unfocuses. Active card gets accent outline ring.
8. **Search highlight** — `<mark>` wrapper (#FFE37A) on matching substring in title and tags.
9. **"Não lidos" sort** — Unread first (by date desc), then read. Uses `ReadProgressStore.isRead()`. Branch already exists in code.
10. **Related tag cluster** — Tag co-occurrence suggestions. Caveat "→ veja também: #x, #y". Max 3.
11. **RSS link** — Button in header. SVG icon + "RSS" text. Links to `/feed.xml`.

### Empty State

Caveat handwritten "nada por aqui." + subtitle + accent "limpar filtros" button.

### Footer

Dashed top border, "← voltar pra home · vídeos →" links.

## 10. Post Detail (Public)

### Component Order (top to bottom)

1. **SeriesBanner** — "PARTE DA SÉRIE" + previous post link (conditional: `previous_post_id IS NOT NULL`)
2. **Cover image** — full-width hero
3. **Title + metadata** — Fraunces title, category tag, date, reading time
4. **Excerpt** — italic, muted
5. **Key points** — `PostKeyPoints` numbered list (conditional)
6. **Pull quote** — `PostPullQuote` large italic (conditional)
7. **Content** — Tiptap `content_html` rendered
8. **Hashtags** — `PostTags` with `#tag` pills from `post_hashtags` join
9. **SeriesNav** — "CONTINUA NA PRÓXIMA PARTE" / previous post link (conditional)
10. **Notes** — `PostNotes` numbered list, amber indices (conditional)
11. **Colophon** — `PostColophon` with "COLOFÃO" label (conditional)
12. **AuthorCard** — from `authors` table, configurable social links

**Comments removed entirely** (PostComments component deleted).

## 11. Data Model Summary

### New Tables

| Table | Columns |
|---|---|
| `hashtags` | `id, site_id, name, slug, created_at` |
| `post_hashtags` | `post_id, hashtag_id` (PK pair) |

### Modified Tables

| Table | Changes |
|---|---|
| `blog_posts` | `+previous_post_id uuid FK`, `+continues_in_next boolean DEFAULT false` |
| `blog_translations` | `+content_json jsonb`, `+content_html text`, `+colophon text`, `+notes text[]`, `+pull_quote text`, `+key_points text[]` |

### Untouched Tables

| Table | Reason |
|---|---|
| `blog_tags` | Categories — linked to newsletter types. Zero changes. |
| `authors` | Already has all needed columns (social_links jsonb, is_default, etc.) |

## 12. Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editor | Tiptap WYSIWYG | Already operational in newsletter editor. Shared base reusable. |
| Storage | `content_json` + `content_html` | JSONContent as source of truth, HTML for rendering. No MDX pipeline. |
| Slug collision | Optimistic (try save, handle) | Unlikely with ≤500 posts. Avoids unnecessary DB queries. |
| Series model | `previous_post_id` FK chain | Simpler than full `blog_series` table. Auto-detects "next" via reverse query. |
| Hashtags vs categories | Separate entities | Categories (blog_tags) connected to newsletter types. Hashtags are freeform user tags. |
| Publish controls | Kanban only | Editor is for content + metadata. Status transitions in kanban board. |
| Existing posts | Delete all | Clean slate. 0 posts. No migration complexity. |
| Reading progress | `ReadProgressStore` (existing) | localStorage-based. Already has `isRead()`, `getProgress()`, `getAllRead()`. |

## 13. Files Affected

### New Files
- Migration: `hashtags` + `post_hashtags` tables
- Migration: `blog_posts` + `blog_translations` column additions
- Migration: Delete all existing blog posts
- `PostNotes` component (new, pattern mirrors `PostKeyPoints`)
- Blog-specific Tiptap extensions (callout, etc.)
- Archive list view component
- Blog i18n dictionary

### Modified Files
- `blog/page.tsx` — remove MOCK_POSTS fallback, add real-only data path
- `blog-archive-client.tsx` — add view toggle, keyboard nav, stagger reveal, search highlight, related tags, reading stats card
- `post-colophon.tsx` — fix "COLOFAO" → "COLOFÃO", add i18n
- `post-tags.tsx` — rewire from frontmatter to `post_hashtags` join table
- `author-card.tsx` — connect to `authors` table instead of `AUTHOR_THIAGO`
- `series-nav.tsx` — adapt for `previous_post_id` + `continues_in_next`
- `series-banner.tsx` — adapt for chain model
- `post-key-points.tsx` — read from `key_points text[]` column
- CMS blog editor page — add Tiptap, structured fields below editor
- CMS blog new page — slug generation on title blur
- Server actions — save `content_json`/`content_html`/metadata columns
- `writing-card.tsx` — wrap in `ReadableCard`, add category tape tint

### Deleted Files
- `blog-mock-data.ts`
- `mock-data.ts` (or remove AUTHOR_THIAGO + MOCK_COMMENTS)
- `post-comments.tsx`
- `post-extras-schema.ts`
- `blog-ad-slots.tsx` (archive ad slots)

## 14. Open Decisions

None — all decisions approved during brainstorming.

## 15. Visual References

Mockups approved in brainstorm companion (`http://localhost:57339`, session `9576-1778029960`):

1. `04-post-layout-v2.html` — Post detail public layout (98+)
2. `10-cms-editor-v5.html` — CMS blog editor (99/100)
3. `12-blog-archive-v3.html` — Blog archive 110/100 (all delighters)
