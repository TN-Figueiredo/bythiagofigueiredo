# Pipeline-Blog Unification Design Spec

**Date:** 2026-05-22
**Status:** Approved
**Score:** 125/130 (96/100) — 4 rounds of independent architect review
**Estimated scope:** 65-80h

## Problem Statement

The CMS has two separate editing experiences for blog content:

1. **`/cms/blog`** — Kanban board with 6 mixed-source lanes (pipeline + blog_posts) and a dedicated blog editor with TipTap, structured fields, and blog-specific extensions.
2. **`/cms/pipeline`** — Workflow hub with stages (Idea/Draft/Ready/Scheduled/Published), section tabs, VVS Score, Cowork AI integration, social config, and production checklist.

The experiences are disconnected. Blog posts created in pipeline have a rich workflow but lose blog-specific capabilities (SEO fields, slug, excerpt, key points, social planning). Blog posts in the editor have content richness but no structured workflow. Current rating: **15/100**.

## Architecture Decision: "Pipeline is Everything"

**Chosen approach: Materialization-only sync (Option A)**

Pipeline becomes the single editing interface for blog posts. `blog_translations` becomes a materialized cache — generated atomically at stage transitions via Supabase RPC, never edited directly.

```
Pipeline JSONB (source of truth)
    ↓ [atomic RPC at stage transition or "Re-publicar"]
blog_posts + blog_translations (materialized cache for public site)
```

### Why not continuous write-through?

Write-through without transactions is unsound — partial failures create split-brain state where pipeline and blog disagree. Materialization is explicit, transactional, and user-initiated.

## Workflow Stages

Stage keys are **unchanged** — only labels change. This avoids FK constraint migrations, hardcoded string literal changes in 6+ files, and data migration of 44 existing items.

| Position | Key | Label (PT) | Label (EN) | Purpose |
|----------|-----|-----------|-----------|---------|
| 1 | `idea` | Ideia | Idea | Hook, synopsis, references, target audience |
| 2 | `draft` | Rascunho | Draft | Full blog content: title, slug, excerpt, TipTap body, structured fields |
| 3 | `ready` | **Entrega** | **Delivery** | SEO, images, social planning, final polishing |
| 4 | `scheduled` | Agendado | Scheduled | Date/time confirmed, materialized to blog_posts |
| 5 | `published` | Publicado | Published | Live on public site, editable with "Re-publicar" |

**Label-only change:** `ready` → "Entrega"/"Delivery" via UPDATE in `pipeline_workflows` table + `workflows.ts` label. Zero FK breaks, zero data migration.

## Section Tabs

5 section tabs for `blog_post` format. Social config stays in the sidebar (existing architecture — `social_config` is a top-level JSONB field on `content_pipeline`, not in `sections` JSONB).

### Tab 1: Ideia (Stage: idea)
- Hook, synopsis, references, target audience
- Scope: shared (not per-locale)
- Cowork skill: Ideator (refs: content-angles, scoring-rubrics)

### Tab 2: Rascunho (Stage: draft)
- **Sidebar collapses** from 272px to 48px (icon-only rail)
- TipTap editor with **"blog" preset** (see TipTap Compatibility below)
- Fields above TipTap: cover image (16:9, 1200x630), title, slug (auto-generated from title), excerpt
- Fields below TipTap (collapsible "Campos Estruturados"): key_points, pull_quote, tag_id (uuid FK to blog_tags), hashtag_ids (uuid[] for hashtag_blog_post), notes, colophon
- Scope: per-locale (draft_pt, draft_en)
- Autosave: debounced 3s (same as current blog editor)
- Cowork skill: Writer (refs: voice-guide, article-craft, blog-craft)

### Tab 3: SEO (Stage: delivery)
- meta_title (60/70 char limits), meta_description (155/170 limits), focus keyword, OG image (upload/auto-generate), canonical URL
- Scope: per-locale (seo_pt, seo_en)
- Save: on blur/navigate
- Cowork skill: Writer (refs: seo-metadata, article-craft)

### Tab 4: Imagens (Stage: delivery)
- Cover image (primary, 16:9 1200x675), OG image (if different), gallery/inline images, alt texts
- Midjourney prompt support (existing), chosen images with status tracking
- Scope: shared (images are universal)
- Media Gallery picker integration (existing `<MediaGalleryDialog>`)
- Cowork skill: Producer (refs: visual-style)

### Tab 5: Publicacao (Stage: scheduled/published)
- **Scheduling modal with date/time picker** (required — no auto-advance without scheduling)
- Locale selection checkboxes (which locales to publish)
- Pre-publish checklist summary
- VVS gate: score must be >= 80 to schedule/publish
- Preview link to public site
- "Publicar Agora" toggle (immediate publish vs scheduled)
- Triggers materialization + social graduation

### Progressive disclosure
Tabs are always visible but disabled based on current stage:
- **Idea:** Only Ideia tab enabled
- **Draft:** Ideia + Rascunho enabled
- **Delivery:** Ideia + Rascunho + SEO + Imagens enabled
- **Scheduled/Published:** All tabs enabled

Disabled tabs show tooltip "Avance para [stage] para desbloquear".

## Sidebar — Stage-Adaptive Design (v4)

The sidebar answers "onde estou e o que posso fazer?" — tabs answer "o que estou editando?"

### Collapsed mode (48px) — when Rascunho tab active
Icon-only rail with: VVS ring (mini), checklist icon, stage icon, details icon, cowork AI icon, expand button (>>). Click any icon to show a popover with that card's content.

### Expanded mode (272px) — stage-adaptive content

The sidebar renders **different blocks per stage**. No more static card list.

#### State 0: Ideia
- Stage label + progress bar (1/5)
- No VVS ring (meaningless at this stage)
- Single CTA: "Promover para Rascunho →" (always enabled, no gates)
- Minimal metadata: idioma, categoria
- Menu ⋯

#### State 1: Rascunho (Draft)
- Stage label + progress bar (2/5) + VVS ring
- **Gate panel**: "Para → Entrega (min 80%)" — lists VVS factors with ✓/✗ status and point values
- Gate shows: current score / 100 · "precisa N+"
- Avançar button **disabled** when VVS < 80, with tooltip showing score
- ← Ideia (retreat, always enabled)
- Metadata: idioma (+EN/+PT button), categoria, prioridade
- Checklist compact: progress bar + pending items only
- Menu ⋯

#### State 2: Entrega (Ready) — blog_post only
- Stage label + progress bar (3/5) + VVS ring
- Readiness confirmation: "✓ Pronto para publicar" (VVS + blog post linked)
- **Primary actions** (moved FROM BlogPublishPanel in Publicação tab):
  - 🚀 Publicar Agora (calls materializeBlogPost with targetStage: 'published')
  - 📅 Agendar... (opens schedule modal, calls materializeBlogPost with targetStage: 'scheduled')
- Blog Post link card (if linked)
- Auto-posting: "configurar →" link to Publicação tab social config
- ← Voltar p/ Rascunho (retreat)
- Menu ⋯

#### State 3: Agendado (Scheduled)
- Stage label + progress bar (4/5) + VVS ring
- Schedule display: date + time + "daqui a N dias" relative
- "Publicar agora (antecipar)" button
- "Cancelar agendamento" button (red, moves back to Entrega)
- Auto-posting status: platforms with active/inactive badges
- ← Cancelar → Entrega
- Menu ⋯

#### State 4: Publicado (Published)
- Stage label + progress bar (5/5, all green) + VVS ring
- "🌐 No ar desde [date]" + live URL link (/blog/slug →)
- **Pending changes badge** (if updated_at > materialized_rev): "⚡ Mudanças pendentes" + Re-publicar button
- Auto-posting status per platform: ✓ postado / ⏳ na fila / ✗ falhou
- "Ver posts sociais →" link
- ← Despublicar (with confirmation dialog — moves to Entrega, sets blog_post status to draft)
- Menu ⋯

#### Video stages (idea through pós-produção)
- All advance/retreat freely (no VVS gates — stages are tracking)
- Progress bar shows 7 segments
- Retreat/Advance buttons labeled with previous/next stage name
- VVS ring shown but purely informational
- Video published: YouTube URL + social posting status

### Bilingual gate panel
When `language === 'both'`, the gate panel shows per-locale sections:
- 🇧🇷 Português: per-field ✓/✗ status
- 🇺🇸 English: per-field ✓/✗ status
Both locales must pass for the gate to clear.

### Menu ⋯ (secondary actions)
Accessed via ⋯ button in sidebar footer. Contains:
- 📦 Arquivar / Restaurar
- 🕐 Histórico (N entradas)
- 🔢 Versão: vN
- 🏷️ Editar tags
- 📋 Checklist completo (expand) — if checklist exists
- 🔗 Blog post: ver/desvincular — if linked

**Note:** Checklist in menu ≠ Gate panel. Gate = automated VVS requirements. Checklist = manual user tasks.

### Loading & error states
- Avançar/Recuar: button shows spinner, both buttons disabled
- Publicar: "Publicando..." with spinner, all actions disabled
- Agendar: "Agendando..." with spinner
- Re-publicar: "Atualizando..." with spinner
- Publish failure: toast.error with server message
- Schedule failure: toast.error, stays in Ready
- VVS below threshold: button disabled + tooltip with score

### Accessibility
- VVS ring: `aria-label="Prontidão N de 100"`
- Gate items: `role="list"` + `aria-label="Requisitos para avançar"`
- Disabled Avançar: `aria-disabled="true"` + `title` with score reason
- Colors never sole indicator: ✓/✗/△ icons accompany green/red/amber
- Progress bar segments: `aria-label="Estágio N de M: [name]"`
- Menu ⋯: `aria-haspopup="menu"` + `aria-expanded`

### Tab impact from sidebar changes
- **BlogPublishPanel removed from Publicação tab** — publish/schedule actions now in sidebar
- **SocialConfigEditor moves TO Publicação tab** — full editor (platforms, captions, hashtags)
- Social **status** (read-only) stays in sidebar
- VVS display only in sidebar (no duplication in tabs)
- Reporter role: sidebar is read-only (status visible, action buttons hidden)

Transition: 200ms ease animation between collapsed and expanded.

## Social Integration

Social config data lives in `content_pipeline.social_config` (top-level JSONB field, not in sections). The `social-config-editor.tsx` already renders in the sidebar.

### Instagram Story (primary blog promotion format)
- Instagram does not allow links in feed posts — Story slides with link sticker are the primary format
- Multi-slide Story editor: hook slide, key point slides, CTA slide
- Each slide: text (280 chars max), background image from Media Gallery, template (minimal/card/bold)
- Feed caption (2200 chars) with "Link na bio" warning

### Other platforms
- Facebook: link share post with caption
- Bluesky: link card (300 chars)
- Platform toggles, hashtags per post
- Per-locale captions

### Graduation flow
Existing `graduation.ts` auto-graduates to Social Hub if `social_config` is complete, stays as draft if not.

## Cowork AI Integration

### Per-section "Pedir atualizacao"
- Button already exists in `section-toolbar.tsx` (line 48)
- `CoworkRequestPanel` receives full item context (code, title, format, stage, section data)
- `buildPrompt()` generates multi-step prompt with API workflow steps

### "Cowork: Preencher Tudo" macro
- Button in pipeline item detail header
- Generates prompt that instructs Claude to sequentially read and update all sections
- Order: Ideia -> Draft -> SEO -> Social (natural flow)
- Includes item metadata + all Writer skill references

### Cowork docs expansion needed
1. **Draft section schema** — expand from `{ body }` to `{ title, slug, excerpt, content_json, content_html, key_points, pull_quote, notes, colophon, tag_id, hashtag_ids, cover_image_url }`
2. **New "Writer Blog Craft" reference** — blog-specific structure, tone, SEO practices. Seed via `seed-pipeline-reference.ts`
3. **API catalog** — update `cowork-docs-items-and-sections.md` with expanded blog schemas

## Materialization

### When it happens
1. Stage transition to `scheduled` (via scheduling modal with date/time)
2. Stage transition to `published` (via "Publicar Agora")
3. "Re-publicar" button (for editing published posts)

### What the atomic RPC does
All in a single SQL transaction:

1. **Permission check**: `can_publish_site(site_id)` before any UPSERT
2. **MDX compile** (pure, done before transaction — no side effects): `compile()` each locale's content
3. **UPSERT `blog_posts`**: status, published_at, scheduled_for, slot_date, queue_position, category, cover_image_url
4. **UPSERT `blog_translations`** (per active locale): title, slug, excerpt, content_json, content_html, content_compiled (MDX), content_toc, reading_time_min, meta_title, meta_description, og_image_url, key_points, pull_quote, notes, colophon, tag_id
5. **UPDATE `content_pipeline`**: stage + stamp `materialized_rev_pt`/`materialized_rev_en`

If ANY step fails -> entire transaction rolls back -> stage does NOT advance -> toast with specific error + "Retry" button.

### Pending changes detection
New columns on `content_pipeline`:
- `materialized_rev_pt: integer | null`
- `materialized_rev_en: integer | null`

Each section save increments `sections.draft_pt.rev` (already exists). Materialization stamps `materialized_rev_pt = sections.draft_pt.rev`.

Badge check (O(1)): `sections.draft_pt.rev > materialized_rev_pt` -> "Mudancas pendentes" badge + "Re-publicar" button appears.

### Post-publish editing
When item is in stage `published`, all sections remain editable:
- Autosave saves ONLY to pipeline JSONB (same as any other stage)
- "Re-publicar" button appears when pending changes detected
- Clicking "Re-publicar" -> re-materializes (same atomic RPC) -> toast "Post atualizado no site"
- NOT continuous write-through — user-initiated, explicit, transactional

## TipTap Editor Compatibility

### The problem
Blog editor has 4 extensions + H1 headings that pipeline "full" preset lacks:

| Extension | Blog Editor | Pipeline "full" | Risk |
|-----------|------------|-----------------|------|
| StarterKit headings | H1, H2, H3, H4 | H2, H3, H4 | H1 nodes stripped |
| MergeTag | Yes | No | Node silently removed |
| CTAButton | Yes | No | Node silently removed |
| PlaylistEmbed | Yes | No | Node silently removed |
| SlashCommand | Yes | No | No slash commands |

Loading existing blog content with preset "full" would **silently strip nodes = data loss**.

### Solution: "blog" preset
New `getBlogExtensions()` in `pipeline-extensions.ts`:
- Inherits everything from `getFullExtensions()`
- Adds: MergeTag, CTAButton, PlaylistEmbed, SlashCommand (already exist in `_shared/editor/`)
- Heading levels: [1, 2, 3, 4] (includes H1)

`DraftRenderer` for format `blog_post` uses `preset="blog"` instead of `preset="full"`. Other formats (video, newsletter) continue with "full".

**Impact:** 1 file (pipeline-extensions.ts) + imports of 4 existing extensions.

## Kanban Board

### Current: 6 lanes, mixed sources
- Ideia (pipeline), Rascunho (pipeline), Pronto (pipeline) | DIVIDER | Em Edicao (blog), Agendado (blog), Publicado (blog)
- 2 card types (PipelineCard + PostCard), 2 data sources

### Proposed: 5 lanes, pipeline-only
- Ideia, Rascunho, Entrega, Agendado, Publicado
- 1 card type (UnifiedCard), 1 data source (pipeline)
- No divider, no mixed sources
- Drag-n-drop with materialization on drop to scheduled/published

### UnifiedCard design (extends GemCard)
Stage-conditional rendering:
- **Ideia:** code, locale flags, priority, VVS ring (mini), checklist progress bar
- **Rascunho:** + hook snippet (truncated excerpt from synopsis)
- **Entrega:** + sub-status badges (SEO checkmark/pending, IMG checkmark/pending, Social checkmark/pending)
- **Publicado:** + cover image thumbnail, tag color badge, reading time, publish date

Always visible: code, locale flags, priority, VVS ring, checklist progress bar.

### LANE_DEFS update
All 5 lanes: `dataSource: 'pipeline'`. Remove `editing` lane and `PROMOCAO` divider. Rename `ready` label to "Entrega".

## VVS Score Rebalancing

Current VVS has 7 factors totaling 100%. Blog needs 4 new factors with format-specific weights.

| Factor | Before | After | What it checks |
|--------|--------|-------|---------------|
| has_title | 20% | 12% | title_pt or title_en filled |
| has_hook | 15% | 10% | hook filled |
| has_synopsis | 10% | 8% | synopsis filled |
| has_body | 20% | 15% | body_content (TipTap) filled |
| has_tags | 10% | 10% | tags.length > 0 |
| checklist_pct | 15% | 15% | production checklist % |
| metadata | 10% | 10% | format_metadata passes schema |
| **has_slug** (NEW) | — | **5%** | slug filled in draft section |
| **has_excerpt** (NEW) | — | **5%** | excerpt filled in draft section |
| **has_seo** (NEW) | — | **5%** | meta_title + meta_description filled in SEO section |
| **has_cover** (NEW) | — | **5%** | cover_image_url filled |
| **TOTAL** | 100% | **100%** | Rebalanced with blog-specific gates |

New factors (slug, excerpt, seo, cover) only apply when `format = 'blog_post'`. Other formats keep current weights.

## Data Model Changes

### Category enum unification
- `blog_posts.category` CHECK constraint: `['tech','vida','viagem','crescimento','code','negocio']`
- Pipeline `BLOG_CATEGORIES`: `['stories','building','money','bts']`

Migration: ALTER `blog_posts` CHECK constraint to accept pipeline category values. Pipeline categories become the canonical enum. UPDATE existing 2 posts to new enum values.

### Tag mapping
- Pipeline: `tags: text[]` (free text, generic)
- Blog: `tag_id: uuid` FK to `blog_tags`, `hashtag_blog_post` join table

Solution: Blog-specific fields in draft section JSONB: `{ ..., tag_id: uuid, hashtag_ids: uuid[] }`. Draft UI shows dropdowns for tag and hashtags using `blog_tags` and `hashtags` tables as source. Pipeline `tags: text[]` continues for generic/cross-format use.

### Slug uniqueness
- `blog_translations` has trigger `validate_translation_slug_unique_per_site`
- Draft section: slug field validates async on-blur: `blog_translations WHERE slug = $1 AND site_id = $2 AND post_id != $3`
- Conflict: red border + "Slug ja existe" + auto-suggestion (append -2, -3...)
- Materialization: if slug invalid despite check (race condition) -> transaction fails, stage doesn't advance
- Auto-generate: `slugify(title)` if empty (same as current blog editor)

### New columns on content_pipeline
- `materialized_rev_pt: integer | null` — stamped at materialization time
- `materialized_rev_en: integer | null` — stamped at materialization time

### blog_posts fields populated by materialization
- `status` ('scheduled' or 'published')
- `published_at` (now() if publishing)
- `scheduled_for` (user-selected datetime if scheduling)
- `slot_date` (date_part of scheduled_for)
- `queue_position`
- `category` (from pipeline)
- `cover_image_url`

Schedule calendar continues reading from `blog_posts` unchanged — materialization populates the fields.

### blog_translations fields populated by materialization (per locale)
- `title`, `slug`, `excerpt`
- `content_json`, `content_html`, `content_compiled` (MDX)
- `content_toc`, `reading_time_min`
- `meta_title`, `meta_description`, `og_image_url`
- `key_points`, `pull_quote`, `notes`, `colophon`
- `tag_id` (FK)

### Publish permission
`enforce_publish_permission` trigger fires on `blog_posts` UPSERT. The materialization RPC (SECURITY DEFINER) checks `can_publish_site(site_id)` explicitly at the start, before the UPSERT. Alternative: RPC runs with `auth.uid()` of the caller so trigger works naturally.

## Migration Strategy

### Phase 1: Pipeline as primary editor
- Expand draft section JSONB to support all blog fields
- Create "blog" TipTap preset in `pipeline-extensions.ts`
- Expand `DraftRenderer` to show all fields
- Update VVS score with blog-specific factors
- Update kanban to 5 pipeline-only lanes
- Implement materialization RPC
- Add scheduling modal with date/time picker
- Blog editor (`/cms/blog/[id]/edit`) becomes **read-only view** with link "Editar no Pipeline ->"

### Phase 2: Remove blog editor
- After confirming pipeline works for all blog editing needs
- Remove blog editor code
- Redirect `/cms/blog/[id]/edit` -> `/cms/pipeline/items/[pipeline_id]` (lookup via blog_post_id FK)

### Existing data
- 44/46 items already in pipeline
- 2 published blog posts already linked to pipeline items
- Content JSON migrated to draft section JSONB loads correctly with "blog" preset (all extensions present)

## Key Files to Modify

| File | Change |
|------|--------|
| `pipeline-extensions.ts` | Add `getBlogExtensions()` preset |
| `draft-renderer.tsx` | Expand to 12+ fields, use preset="blog" for blog_post |
| `validation.ts` | Add 4 new VVS factors, format-specific weights |
| `draft-to-blog.ts` | Expand `BlogContentPatch` interface + extraction logic |
| `hub-utils.ts` | 5 lanes, all `dataSource: 'pipeline'`, rename ready label |
| `unified-board.tsx` | Single UnifiedCard component, remove PostCard usage |
| `pipeline-item-detail.tsx` | Sidebar collapse state + conditional className |
| `workflows.ts` | Update `ready` stage label to "Entrega"/"Delivery" |
| `schedule-modal.tsx` | Reuse with props adaptation for pipeline context |
| `cowork-docs-items-and-sections.md` | Expand draft schema, add social schema |
| `seed-pipeline-reference.ts` | Add "Writer Blog Craft" reference |
| New migration | Category unification, materialized_rev columns |
| New RPC | `materialize_blog_post()` atomic function |

## Performance

- TipTap loaded lazily per section (not all sections at once)
- Materialization async (~1-2s for MDX compile + transaction)
- JSONB bloat: ~15KB for 3000-word post (PostgreSQL JSONB compresses well, limit warning at 50KB)
- Pending changes check: O(1) integer comparison (rev stamps)
- Schedule calendar: unchanged, reads from `blog_posts` (materialized)

## Error Handling

- Materialization failure: stage does NOT advance, toast with specific error, "Retry" button
- Persistent failure: modal with error details + option "Forcar publicacao sem compilacao" (runtime compile fallback)
- Slug conflict at materialization: transaction fails, toast "Slug conflitante"
- CAS conflict (concurrent editing): toast with conflict notification (existing `rev` tracking)
- Logs: all errors to Sentry

## Score Breakdown (v6 Final — 13 Dimensions)

| # | Dimension | Score | Notes |
|---|-----------|-------|-------|
| 1 | Single editing experience | 10/10 | Pipeline only + Re-publicar |
| 2 | Rascunho section UX | 9/10 | TipTap inline, sidebar collapse (-1: needs real testing) |
| 3 | Data consistency | 10/10 | Atomic materialization |
| 4 | Locale management | 10/10 | Pipeline-native per-locale |
| 5 | Migration safety | 10/10 | Stage keys unchanged, blog editor read-only first |
| 6 | Kanban unification | 10/10 | 5 lanes pipeline-only |
| 7 | Social integration | 10/10 | Sidebar, IG Story, graduation |
| 8 | Scheduling UX | 10/10 | Date/time picker + cadence slots |
| 9 | Cowork AI | 10/10 | Existing infra + expanded docs |
| 10 | Data model | 10/10 | Category unified, tag mapping, materialized_rev |
| 11 | Post-publish editing | 10/10 | Pending detection via rev comparison |
| 12 | Editor compatibility | 9/10 | "blog" preset (-1: needs integration test) |
| 13 | Scope honesty | 7/10 | 65-80h range, not a point estimate |
| | **TOTAL** | **125/130** | **96/100** |

## Design Evolution

| Version | Architect Score | Key Issue | Resolution |
|---------|----------------|-----------|------------|
| v3 | 4.9/10 | Write-through sync unsound, overlay UX, 120h scope | Pivoted to materialization-only |
| v4A | 4.5/10 | No post-publish editing, JSONB expansion gaps, stage migration complexity | 7 structural gaps fixed |
| v5 | 7.0/10 | No pending changes detection, TipTap extension mismatch, schedule query gap | 4 final gaps fixed |
| v6 | **8.5+/10** | Only implementation-time concerns remain | Design complete |
