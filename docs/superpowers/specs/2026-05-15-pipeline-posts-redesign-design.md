# Pipeline → Posts Redesign

> Design spec for the complete UI redesign of the Pipeline and Posts flows in the CMS.

**Date:** 2026-05-15
**Status:** Ready
**Sprint:** 5h — Social Hub (phase 4: Pipeline/Posts UI unification)
**Pre-conditions:** Content Pipeline operational (content_pipeline table with sections JSONB, pipeline_workflows). Blog graduation route functional. Social Hub operational (social_connections, social_posts). Research Library operational.
**Mockups:** `brainstorm/62041-1778807735/content/` — 8 approved screens (v7/v6/v4/v4/v4/v3/v3/v2)

---

## Problem Statement

The current Pipeline → Posts flow has 4 structural problems:

1. **Sidebar pollution**: Social config, sections checklist, publication settings, and status are mixed together in the right sidebar without clear grouping or hierarchy.
2. **Entity separation causing data holes**: Pipeline items and blog posts are separate entities (`content_pipeline` vs `blog_posts`). When a pipeline item graduates to a post, the published post has empty fields that were only filled in the pipeline item. Users see blank content in published items.
3. **Tab disorder**: "Publicação" tab appears before Social tab, but logically you configure social before scheduling publication. The correct flow is: content → images → SEO → social → publication.
4. **Multi-language social flooding**: PT+EN content would trigger simultaneous social posts to all platforms, flooding followers with duplicate content. Needs 30-minute anti-flood interval between language versions.

---

## Design Overview

### Two-Zone Architecture

The redesign splits the CMS content flow into two distinct zones:

| Zone | Entity | Stages | Purpose |
|------|--------|--------|---------|
| **Pipeline** | `content_pipeline` | Ideia → Rascunho → Pronto | Content ideation and drafting |
| **Posts** | `blog_posts` + `blog_translations` | Pronto → Agendado → Publicado | Content editing, SEO, social, publication |

**Graduation bridge**: When a pipeline item reaches "Pronto," it graduates to a post. The post inherits title, hook, synopsis, body, images, and metadata. The pipeline item retains a `blog_post_id` FK for traceability.

### Key Principles

- **Post only exists publicly after publication** — no URL, no short link, no public visibility until the publish action fires.
- **Newsletter is a digest, not per-post** — posts are flagged for inclusion in the biweekly newsletter summary, never triggering individual sends.
- **Social posts fire per-language with 30-min offset** — PT posts first at scheduled time, EN posts 30 minutes later.
- **Manual save pattern** — all tabs use explicit Save button (⌘S) with dirty-state indicator, not auto-save.
- **Tabs reveal progressively** — Pipeline detail has no tabs (single editor view). Post detail has 5 tabs: Conteúdo, Imagens, SEO, Social, Publicação. Social and Publicação only become actionable after graduation to post.

---

## Screen-by-Screen Specification

### Tela 1: Pipeline Kanban (01-pipeline-kanban-v7)

Three-column kanban board for pipeline items.

**Columns:** Ideia | Rascunho | Pronto

**Card anatomy:**
- Format icon (video/blog/newsletter/course/campaign/collection) + code badge (e.g., `TG-86`)
- Title (bold, 1-line clamp)
- Hook (muted, 1-line clamp)
- Footer: language badge (PT/EN/PT+EN), priority stars, days-in-stage counter
- Graduation indicator: green glow + "Pronto para graduar" on Pronto column cards

**Header features:**
- Format filter tabs (Todos, Video, Blog, Newsletter, Course, Campaign)
- Search input
- "+ Nova Ideia" primary button
- View toggle (kanban/list) — kanban default

**Interactions:**
- Drag-and-drop between columns (stage change)
- Click card → opens Pipeline Detail (Tela 2)
- Right-click → context menu (Editar, Mover para..., Arquivar, Duplicar)

**Empty states:** Each column has format-specific placeholder with "+" button

### Tela 2: Pipeline Detail (02-pipeline-detail-v6)

Full detail view for a single pipeline item. Three-column layout: left sidebar (nav) + main content + right sidebar (metadata).

**Main content area:**
- Cover image with hover overlay (Trocar/Remover)
- Title input (24px, bold)
- Hook field (golden left border, labeled)
- Synopsis textarea (muted border, labeled)
- TipTap rich-text editor for body content
- Word count + reading time in editor footer

**Right sidebar groups:**

1. **Ações**: Status card (Ideia/Rascunho/Pronto) with stage progress dots, "Avançar" button, "Graduar para Post" (only in Pronto stage, green gradient button)
2. **Progresso**: Sections checklist (Conteúdo, Imagens, SEO — pipeline-only sections), readiness score ring
3. **Info**: Details (format, author, language, category, slug, word count, reading time), tags, research links, history timeline

**Key behaviors:**
- Stage transitions validated by readiness score
- "Graduar para Post" creates blog_post + blog_translations, copies all content
- Research links section shows connected Research Library items
- History tracks all events (created, stage_change, field updates)

### Tela 3: Posts Kanban (03-posts-kanban-v4)

Three-column kanban for blog posts (graduated from pipeline).

**Columns:** Pronto | Agendado | Publicado

**Card anatomy (richer than pipeline cards):**
- Cover image thumbnail (left, 48x48 rounded)
- Title + hook (clamped)
- Footer: language badges, social platform mini-icons (YT red, FB blue, IG pink, BS sky), schedule date/time
- Origin badge linking back to pipeline item (e.g., `← TG-86`)

**Agendado column cards:** Show countdown or scheduled date. Green left border.
**Publicado column cards:** Show publication date, view count. Muted appearance.

**Header:** Same filter/search pattern as pipeline, but format is always "Blog" (posts only)

### Tela 4: Post Detail — Conteúdo Tab (04-posts-detail-v4)

Full post editor, identical three-column layout. This is the default tab when opening a post.

**Tab bar order:** Conteúdo | Imagens | SEO | Social | Publicação

Each tab has a colored dot indicator:
- Green (done) = section complete
- Amber (warn) = section needs attention
- Gray (empty) = section not started

**Language toggle:** PT | EN buttons in tab bar (right-aligned). Switches content for the active translation.

**Section bar pattern (used in all tabs):**
- Left: section badge (teal) + status badge (contextual color)
- Right: dirty indicator (pulsing amber dot + "Alterações não salvas") + Save button (outline accent, ⌘S shortcut)

**Main content area:**
- Cover image with overlay
- Title input
- Hook + Synopsis fields
- TipTap editor (full toolbar)
- Inline stats (words, reading time, revision count)

**Right sidebar (consistent across all tabs):**
1. **Ações**: Status card (Pronto/Agendado/Publicado), stage dots, "Agendar" + "Publicar" buttons, "Devolver ao Pipeline" link
2. **Origin card**: Links back to pipeline item (TG-86)
3. **Publication summary card** (new): Quick glance at scheduling, social, newsletter, visibility status
4. **Progresso**: Sections list with dots, Checklist with progress bar, Readiness ring
5. **Info**: Details, tags, history

### Tela 5: Post Detail — Imagens Tab (05-posts-images-tab-v4)

Image management for the post.

**Cover section:**
- Current cover preview (if set)
- "Trocar" / "Remover" hover overlay
- Drag-and-drop upload zone (if no cover)

**Gallery section:**
- Grid of attached images (3 columns)
- Each image: thumbnail, filename, dimensions, file size
- Hover: "Usar como capa" / "Remover" buttons
- Upload button + drag-drop zone
- MediaGalleryDialog integration for picking from existing media

**AI features:**
- "Gerar alt text" sparkle button per image
- "Otimizar para web" bulk action

**Section bar:** "Imagens" badge + "3 imagens" status + dirty/save

### Tela 6: Post Detail — SEO Tab (06-posts-seo-tab-v3)

SEO configuration per language (PT/EN toggle applies).

**SEO Score section:**
- Circular score ring (0-100) with color coding
- Score breakdown: title length, description length, slug, OG image, headings, keyword density
- Each item: green dot (pass) or amber (needs work) with detail text

**Fields:**
- Meta Title input (with character counter, 50-60 optimal zone highlighted)
- Meta Description textarea (with character counter, 150-160 optimal zone)
- Focus Keyword input
- Slug editor (monospace, inline edit with pencil icon)

**OG Image section:**
- Current OG image preview
- 5-step precedence indicator: `seo_extras → cover_image → OG dinâmico → site default → /og-default.png`
- "Personalizar" button to override

**SERP Preview:**
- Google search result mockup showing how the page will appear
- Updates live as user edits title/description

**JSON-LD Preview:**
- Collapsible code block showing generated structured data
- Read-only, auto-generated from SEO fields

**AI features:**
- "Gerar meta description" sparkle button
- "Sugerir título SEO" sparkle button

### Tela 7: Post Detail — Social Tab (07-posts-social-tab-v3)

Social media configuration for post distribution. 4 platforms: YouTube Community, Facebook, Instagram, Bluesky.

**Platform overview strip:**
- Horizontal row of 4 platform cards (icon + name + status badge)
- Status badges: "Configurado" (green), "Não configurado" (dim), "Erro" (red)
- "Gerar todos com IA" bulk sparkle button

**Multi-language info banner:**
- Dismissable banner explaining: "Este post tem PT + EN. Cada idioma gera posts sociais separados com intervalo de 30 min para evitar flood."
- Dismiss X button

**Per-platform expandable cards:**
- Click platform card to expand editor section
- Header: platform icon (colored) + platform name + connected account name + kebab menu (Desconectar, Reconectar, Preview)
- Text editor with platform-specific character limit (YT: 5000, FB: 63206, IG: 2200, BS: 300)
- Character counter with progress bar (green → amber → red as limit approaches)
- Scheduling mode selector: "Com publicação" (synced to publish date) | "Agendar separado" (custom date/time) | "Não postar"
- AI button: "Gerar com IA" per platform

**Platform-specific preview sections:**
- **YouTube Community**: Inline native preview (profile pic, channel name, post text, engagement buttons)
- **Facebook**: OG link preview card (thumbnail, title, domain)
- **Instagram**: Square image preview with caption below
- **Bluesky**: Card preview with text + link card

**Data model:**
- Social tab data stored in `content_pipeline.social_config` JSONB
- On graduation, flows to `social_posts` table via pipeline-social unification
- Per-platform text is per-language (PT and EN versions)

### Tela 8: Post Detail — Publicação Tab (08-posts-publish-tab-v2)

Publication scheduling and final review. The culmination of the post workflow.

**Schedule Hero section:**
- Gradient border card with calendar icon (pulsing when date is set)
- Date input (dd/mm/aaaa) + Time input (hh:mm), both with icon prefixes
- Timezone selector (clickable, shows dropdown): `America/Sao_Paulo (BRT, UTC−3)`
- AI button: "Sugerir melhor horário" sparkle
- Impact flow diagram: `Blog post → 2 redes sociais → Resumo quinzenal`
- Action buttons: "Agendar para 20/05 às 09:00" (primary gradient) + "Publicar agora" (secondary green outline)

**Blog Listing Preview:**
- Compact card showing how the post will appear on `/blog`
- Thumbnail + category + title + hook + date + reading time + author

**Multi-Language Timeline:**
- Visual timeline showing PT (09:00) and EN (09:30) publication points
- Connector with "+30 min" label
- Social platform mini-icons on each timeline point (which platforms fire per language)
- "← Social tab" cross-tab indicator badge
- "30 min intervalo" interval badge

**Distribuição section (consolidated):**
- 4 social platform rows: icon + name + mode badge ("Com publicação" / "Não configurado")
- "Editar" link → navigates to Social tab
- Separator line
- Newsletter digest toggle: "Incluir na próxima newsletter" — biweekly digest, not individual send
- Next edition date + subscriber count
- Info note: "Vários posts podem ser incluídos na mesma edição"

**Pre-Publish Review:**
- 2×3 grid checking: Conteúdo (rev.8), Imagens (3 imgs), SEO (85/100), Social (2 de 4), Data (não salvo/saved), Newsletter (incluído)
- Each item: green (ok) or amber (warn) left border + dot
- Readiness ring (71%) matching sidebar score
- Warn items are clickable → navigate to relevant tab

**URL & Visibilidade section:**
- Preview URL (dimmed, with "Preview" badge) — URL only becomes real on publish
- Short link note: `go.bythiagofigueiredo.com` — generated on publish
- "O post só existe publicamente após a publicação" statement
- Toggles: RSS feed inclusion, Search engine indexing

**Advanced Settings (collapsed by default):**
- Canonical URL override
- JSON-LD override

---

## Data Model Decisions

### Post lifecycle: always hidden until published

Posts do not exist publicly before publication. There is no "draft visible" state. The URL (`/blog/{slug}`) and short link (`go.{domain}/{code}`) are created at publish time. This simplifies the mental model: unpublished = invisible.

### Newsletter: digest inclusion, not per-post dispatch

The newsletter is a biweekly digest. Multiple posts can be published between editions. The Publicação tab offers a toggle to include/exclude the post from the next newsletter edition. This toggle sets a flag on the post; the newsletter edition editor aggregates flagged posts.

No individual newsletter is dispatched per post. The existing newsletter system (`newsletter_editions` table, Resend integration) handles edition composition and sending separately.

### Social: 30-minute anti-flood per language

When a post has both PT and EN translations, social posts fire in sequence:
1. PT social posts at scheduled time (e.g., 09:00)
2. EN social posts 30 minutes later (e.g., 09:30)

This prevents flooding followers who may follow both language accounts. The 30-minute interval is configurable but defaults to 30 min.

Platform selection and text are per-language: each language version can have different captions, hashtags, and platform selections.

### Graduation: pipeline → post

When a pipeline item reaches "Pronto" stage and the user clicks "Graduar para Post":

1. Create `blog_posts` row with inherited metadata
2. Create `blog_translations` rows (PT, EN) with title, hook, synopsis, body
3. Copy cover image reference
4. Set `content_pipeline.blog_post_id` FK
5. Pipeline item stays in pipeline for traceability (not deleted)
6. Post appears in Posts kanban "Pronto" column

The pipeline item's `sections` JSONB is snapshotted into the post's metadata for audit.

---

## Layout System

### Three-Column Layout

All detail views use the same layout:

| Element | Width | Content |
|---------|-------|---------|
| Left sidebar | 194px fixed | Navigation (same as existing CMS sidebar) |
| Main content | Flexible | Tab content, scrollable |
| Right sidebar | 272px fixed | Status, progress, info cards |

### Design Tokens

```
--bg: #0b0f18          --accent: #818cf8
--surface: #0d1118     --accent-dim: rgba(99,102,241,.08)
--surface-hi: #111820  --done: #22c55e
--well: #0f1620        --done-dim: rgba(34,197,94,.08)
--border: #1a2030      --warn: #f59e0b
--border-hi: #252d3d   --warn-dim: rgba(245,158,11,.08)
--faint: #181e28       --danger: #ef4444
--dim: #3d4654         --danger-dim: rgba(239,68,68,.06)
--muted: #8b949e       --sky: #38bdf8
--text: #e2e8f0
```

### Platform Colors

| Platform | Color | CSS |
|----------|-------|-----|
| YouTube | Red | `#f87171` |
| Facebook | Blue | `#60a5fa` |
| Instagram | Pink | `#e879f9` |
| Bluesky | Sky | `var(--sky)` / `#38bdf8` |

---

## Component Inventory

### Shared Components (used across screens)

| Component | Description | Used in |
|-----------|-------------|---------|
| `StatusCard` | Stage progress with dots, action buttons | Telas 2, 4-8 |
| `OriginCard` | Pipeline item link with icon | Telas 4-8 |
| `PubSummaryCard` | Quick publication status summary | Telas 4-8 |
| `SectionsPanel` | Section list with colored dots | Telas 2, 4-8 |
| `ChecklistPanel` | Checklist items with progress bar | Telas 2, 4-8 |
| `ReadinessRing` | SVG circular progress indicator | Telas 2, 4-8 |
| `HistoryTimeline` | Event timeline with colored dots | Telas 2, 4-8 |
| `DetailsPanel` | Key-value metadata display | Telas 2, 4-8 |
| `SectionBar` | Tab section header with badge, dirty state, save button | Telas 4-8 |
| `CoverImage` | Cover with hover overlay (Trocar/Remover) | Telas 2, 4 |
| `TabBar` | Tab navigation with dot indicators + lang toggle | Telas 4-8 |
| `KanbanBoard` | Column-based drag-drop board | Telas 1, 3 |
| `KanbanCard` | Card component with format-specific rendering | Telas 1, 3 |

### Tab-Specific Components

| Component | Tab | Description |
|-----------|-----|-------------|
| `TipTapEditor` | Conteúdo | Rich text editor (already exists) |
| `ImageGallery` | Imagens | Grid of images with actions |
| `SEOScoreRing` | SEO | Score ring with breakdown items |
| `SERPPreview` | SEO | Google SERP mockup |
| `SocialPlatformCard` | Social | Expandable per-platform editor |
| `SocialPreview` | Social | Platform-native preview (YT/FB/IG/BS) |
| `ScheduleHero` | Publicação | Date/time inputs + flow diagram |
| `BlogListingPreview` | Publicação | Blog card preview |
| `MultiLangTimeline` | Publicação | PT/EN timeline visualization |
| `DistributionPanel` | Publicação | Social + newsletter consolidated |
| `PrePublishReview` | Publicação | 2×3 readiness grid |
| `URLVisibility` | Publicação | URL preview + toggles |

---

## State Management

### Save Pattern

All tabs use manual save with dirty-state tracking:

1. User edits a field → section enters "dirty" state
2. Dirty indicator appears: pulsing amber dot + "Alterações não salvas"
3. Save button becomes prominent (accent outline)
4. User clicks Save or presses ⌘S → API call → dirty state clears
5. Section dot in sidebar updates (amber → green if complete)

### Readiness Score

Calculated client-side from section completion:

| Section | Weight | Criteria |
|---------|--------|----------|
| Conteúdo | 20% | Title, hook, body all filled |
| Imagens | 15% | Cover image set |
| SEO | 20% | Meta title + description filled, score ≥ 70 |
| Social | 20% | At least 1 platform configured |
| Data | 15% | Publication date set and saved |
| Newsletter | 10% | Toggle decision made (on or off) |

Score displayed in both pre-publish review ring and sidebar readiness ring (always consistent).

---

## Navigation Flow

```
Pipeline Kanban ─── click card ──→ Pipeline Detail
       │                                  │
       │                          "Graduar para Post"
       │                                  │
       │                                  ▼
Posts Kanban ───── click card ──→ Post Detail (Conteúdo tab)
                                          │
                                   tab navigation
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                          Imagens       SEO      Social → Publicação
                                                          │
                                                   "Agendar" / "Publicar"
                                                          │
                                                          ▼
                                                 Post moves to Agendado/Publicado
```

Cross-navigation:
- Post detail → "Devolver ao Pipeline" → returns post to pipeline (reverse graduation)
- Post detail → Origin card → opens pipeline detail for the source item
- Publicação tab → "Editar" (social section) → navigates to Social tab
- Pre-publish review → click warn item → navigates to relevant tab

---

## Migration Path

This redesign touches the existing pipeline and blog post UIs. The implementation should:

1. **Reuse existing components** where they exist (TipTap editor, MediaGalleryDialog, sidebar nav)
2. **Build new tab system** as the central architectural change
3. **Preserve existing API routes** — the UI redesign doesn't change the data model (graduation, social_config, etc. already spec'd in prior specs)
4. **No new DB migrations** — all needed columns exist from content-pipeline-design and pipeline-social-unification-design specs

Existing specs that feed into this implementation:
- `2026-05-09-content-pipeline-design.md` — DB schema, API routes, graduation logic
- `2026-05-14-pipeline-social-unification-design.md` — Social config in pipeline, graduation to social_posts
- `2026-05-12-sprint-5h-social-hub-design.md` — Social Hub architecture
- `2026-05-14-social-posts-redesign-design.md` — Social posts data model

---

## Out of Scope

- Social Hub Composer (standalone social post creation — separate flow)
- Newsletter edition editor (existing, separate UI)
- Pipeline formats other than Blog (Video, Newsletter, Course, Campaign pipeline UIs use same kanban but different detail tabs — future spec)
- Mobile/responsive layout (desktop CMS only)
- Collaborative editing / real-time sync (single-user CMS)
