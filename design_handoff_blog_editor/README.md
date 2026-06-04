# Handoff: Blog Post Editor (ByThiagoFigueiredo CMS)

## Overview
This is the **Blog module's post editor** for the ByThiagoFigueiredo CMS — the screen an author opens when they click a post card in the Blog board. It replaces a confusing earlier version where a pipeline item and its "blog post" were two separate, separately-titled entities (which produced the "Título do post → Sem título" / "/blog/pt/---" problem).

The redesign unifies them: **the pipeline item *is* the post.** There is one title (the document H1), the slug derives from it, and the whole post lifecycle (Ideia → Rascunho → Imagens → SEO → Publicação) flows through one clean, document-first canvas. A post can have independent **PT-BR and/or EN versions** (separate content, not auto-translations), and published posts can be **edited and re-published with an "updated" indicator** that the public site would surface.

> Scope of this handoff: **the Blog post editor only.** The Blog listing (Editorial kanban + Agenda) and other CMS modules are out of scope here.

## About the Design Files
The files in `reference/` are a **design reference built in HTML/React+Babel** — a working prototype that demonstrates the intended look, layout, and behavior. They are **not production code to ship as-is.** Babel-in-the-browser, the `window.*` global wiring, and the mock `DATA` object are prototype scaffolding.

Your task: **recreate this editor in the target codebase using its existing environment and conventions** (component model, state management, styling system, icon set, data layer). If the project has no front-end yet, choose an appropriate framework (React + TypeScript is the natural fit given the source) and implement it there. Match the visuals precisely (see Fidelity) but use the host app's primitives.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, transitions, and interactions are all specified here and in `reference/blog.css` + `reference/styles.css`. Recreate the UI pixel-accurately using the codebase's existing component library, then wire it to real data.

---

## Layout (the editor shell)

The editor is a full-height view inside the CMS content area (the app has a left sidebar + topbar; those are outside this scope). Top to bottom:

1. **Action bar** (`.ed-bar`) — sticky, `position: sticky; top: 0`, blurred background. Left: breadcrumb (`Voltar / Blog / <code>`). Right cluster (flex, gap 12px): the **language toggle**, the **status badge**, a **Focus toggle** icon button, and the **Salvar** primary button.
2. **Stage segmented control** (`.ed-stages`) — a 5-segment pill bar: Ideia · Rascunho · Imagens · SEO · Publicação. Free navigation, no locks. Hidden in Focus mode.
3. **Two-column grid** (`.draft-grid.v3`) — `grid-template-columns: minmax(0,1fr) 340px; gap: 28px`. Collapses to one column below 1080px. In Focus mode the second column collapses to 0.
   - **Left = document canvas** (`.ed-doc`, `max-width: 720px`, centered). This is the hero. Content depends on the active stage (below).
   - **Right = inspector** (`.insp.v3`) — calm, low-chrome cards. Hidden in Focus mode.

> NOTE ON INSPECTOR PLACEMENT: in the current reference the inspector renders inline as the second grid column. In an earlier discussion it was also explored as a slide-in "Detalhes" drawer (open/close via button, scrim, and Esc). **Implement it as the inline right column** per the shipped `views-draft.jsx`; the drawer is optional polish. Either way, on screens < 1080px it should stack below or become a drawer.

### Active-stage content (left canvas)

- **Ideia** — read-only briefing rendered as prose: a "Hook" label + the hook text (large), then a "Sinopse" label + synopsis. Editable title (`.doc-title`) and meta line above.
- **Rascunho** — the writing surface. Editable `.doc-title` (38px), a meta line (`.doc-meta`: language flag · category · read time · word count), a slim borderless **writing toolbar** (`.doc-tools`: B, i, H2, quote, list, link, image), then the editable body (`.doc-prose`, 17px / line-height 1.78). Body supports paragraphs, `<blockquote>`, and **inline image blocks** (see Images).
- **Imagens** — the image manager (see Images & the publish gate).
- **SEO** — meta-title + meta-description inputs with live character counters (`.charcount`, ideal ranges: title 40–60, description 120–160) and a Google **SERP preview** (`.serp`).
- **Publicação** — title field (read-only mirror) + testable title alternatives (`.title-alt`), description, tags, the **publish gate** box (when blocked), and the publish/schedule actions (or, when published, the **update** flow).

For SEO/Imagens/Publicação, the canvas shows a compact header instead of the big title: a mono kicker (`.doc-kicker`, e.g. `IMAGENS · PT-BR`) + a 20px subtitle (`.doc-title-sm`) of the current title.

---

## Core behaviors (the important part)

### 1. One title → derived slug
- The `.doc-title` (contentEditable H1) is the single source of truth.
- The slug auto-derives from the title via `deriveSlug()` (lowercase, strip accents/quotes, non-alphanumerics → `-`, trim, max 60 chars) **until the user edits the slug manually**, after which it stops following the title. A "↻ regenerar do título" link re-syncs it. The slug lives in the inspector's **Detalhes** card (`.slug-wrap`), prefixed with `/blog/<lang>/`, NOT under the title.

### 2. Language versions (PT-BR / EN) — separate, not translations
- A post starts with **one language** (whatever it was created in). The toggle shows a single label (`.lang-current`, e.g. `🇧🇷 PT-BR`) plus a discreet **`+ EN`** add affordance (`.ver-add`).
- Clicking **`+ EN`** creates a fresh, empty EN version and the control becomes a real two-option toggle (`.lang-toggle` with two `.lang-opt`). Each version has its own title, slug, excerpt, body, cover, images, and published state — switching the toggle swaps the entire editing context.
- **Removing a version (undo +EN):** each segment has a hover-revealed `×` (`.lang-x`). If the version is **empty** (`isEmptyVersion()` — no title, body content, or excerpt, and not published) it removes instantly. If it has content or is published, a **confirmation popover** (`.lang-confirm`, dismissable via scrim) appears first; the published case warns that removing the draft here doesn't unpublish the live site. **The last remaining version can never be removed.**

### 3. Free stage navigation; the only lock is publish
- Any stage tab is clickable at any time. There is **no readiness meter and no checklist** (those were removed as noise — the stages are inherently sequential).
- The **publish gate** (`publishGate()`) is the single real lock, evaluated on the Publicação stage. It requires: **Título**, **Conteúdo** (body has text), and **Imagens** (cover + every inline content image marked done). When unmet, a `.gate-box` lists the missing items as chips (`.gate-chip`) that jump to the relevant stage, and the **Agendar / Publicar** buttons are disabled.

### 4. Images are defined by the draft
- The body can contain **inline image blocks** (`{ t: "img", id, alt, status }`, e.g. `img-1`, `img-2`, `img-3`). In Rascunho they render as `.doc-img` placeholders (id badge, "sem imagem" state, alt/prompt, and an arrow that jumps to Imagens).
- The **Imagens** stage aggregates **cover/thumbnail (1200×675) + every inline content image** sourced from the draft. A summary shows `done/total`. Each image row (`.img-row`) supports an interactive produce flow: **Gerar → "gerando…" (spinner) → choose among 3 variant thumbnails → "no ar"**, with **Trocar** to revert, and **Gerar todas** to fill everything. Content-image **alt text is editable inline**. Image state feeds the publish gate.

### 5. Updating a published post
- Editing any field of a **published** version sets `dirty = true`; the status badge flips from **Publicado** (green, `.ed-status.live`) to **Alterações pendentes** (amber, `.ed-status.pending`).
- On Publicação, a published+dirty version shows an **update box** ("Alterações não publicadas") with an **Atualizar no site** button, plus dates ("Publicado em <date>"). Re-publishing clears `dirty` and stamps **Atualizado em <date>** — the indicator the public front-end would render to signal the post changed.
- The inspector's **No site / Distribuição** card mirrors this: live/pending status, the URL, published + updated dates, and an "Atualizar no site" button while dirty.

### 6. Focus mode
- The Focus toggle (`.ed-iconbtn`, eye icon) hides the stage bar and the inspector, widening the document to ~760px for distraction-free writing. A floating `.focus-exit` pill and the **Esc** key exit it.

---

## Per-version data model

Each post (pipeline item) carries shared metadata plus one entry per language. A language version object:

```
{
  lang: "pt" | "en",
  title: string,
  slug: string,
  slugTouched: boolean,    // has the user hand-edited the slug?
  excerpt: string,         // the dek / summary; also seeds SEO meta description
  body: Block[],           // see below
  published: boolean,
  coverReady: boolean,     // is the cover/thumbnail produced?
  words: number,
  readTime: string,        // e.g. "6 min"
  publishedAt: string|null,
  updatedAt: string|null,
  dirty: boolean,          // edited since last publish
}
```

`Block` (body) is one of:
- `{ t: "p", html }` — paragraph (inline `<b>`, `<span class="lk">` links allowed)
- `{ t: "quote", html }` — blockquote
- `{ t: "img", id, alt, status }` — inline image; `status: "pending" | "done"`

Shared post-level fields (not per-language in the prototype, but reasonable to make per-language in production): `code`, `cat` (category id), `tags: string[]`, `hook`, `sinopse`, `seo: { metaTitle, metaDesc }`, `titleAlts: string[]`, `history: [{ to, date }]`, `versions: [{ lang, code, status, title }]`, `plevel` (priority label).

Categories come from `DATA.blog.categories` (`{ id, pt, color, dark? }`); the category color tints the meta dot and the Detalhes chip. See `reference/data.js` for fully-populated examples (`tg-01` = PT-only draft, no images yet; `ta-01` = published with a real published EN sibling).

---

## Key state (left to the implementer's framework)

- `content`: map of `lang → version object` (seeded from the post + any sibling version).
- `activeLang`: which version is being edited.
- `activeStage`: `"ideia" | "rascunho" | "imagens" | "seo" | "publicacao"` (initialized from the post's kanban stage via `STAGE_MAP`).
- `focus`: boolean.
- Derived (no stored state): `deriveSlug(title)`, `publishGate(post, version)`, `isEmptyVersion(version)`.

Helper functions to port (see `reference/views-draft-stages.jsx`): `deriveSlug`, `publishGate`, `EDITOR_STAGES`, `STAGE_MAP`.

---

## Design tokens

All tokens are CSS custom properties defined in `reference/styles.css` (`:root` = dark default, `[data-theme="light"]` = light). The app is **dark by default** and fully themeable — read both blocks. Key values (dark):

**Typography**
- Sans: `Geist` (`--font-sans`) · Mono: `Geist Mono` (`--font-mono`)
- Document title 38px / 600 / -1px tracking / 1.1 lh · tool subtitle (`.doc-title-sm`) 20px/600 · prose 17px / 1.78 lh · blockquote 18px · labels (`.flabel`) 11px uppercase 600 · mono kicker 11px uppercase

**Color (dark)**
- Backgrounds: `--bg #0b0c10` (+ radial `--bg-grad`), `--elev #101117`, `--surface #15161d`, `--surface-2 #1a1c24`, `--surface-hover #1f212b`
- Borders: `--border #24262f`, `--border-soft #1c1e26`, `--border-strong` (see file)
- Text: `--text #ececf1`, `--text-muted #9a9ca8`, `--text-dim #686a76`, `--text-faint #4a4c57`
- Accent (coral): `--accent #fb7a52`, `--accent-hover #ff8e6a`, `--accent-press #e9663d`, `--accent-text #fb7a52`, soft fills `--accent-soft` (.14), `--accent-soft-2` (.22)
- Semantic: `--ok #22c55e`, `--warn #f59e0b`, `--danger #f43f5e`, `--info #22b8d6` (+ `-s` soft variants ~.13 alpha)
- Domain colors (used as category/section accents): `--c-pipeline #22b8d6`, `--c-youtube #ef4444`, `--c-newsletter #a855f7` (the "Cowork"/AI accent), `--c-social #f59e0b`, `--c-links #22c55e` (the "live/published" green), `--c-system #f43f5e`, `--c-courses #8b8cf6` (+ `-s` soft variants)

**Radius scale** — `--radius 14px` (cards), `--radius-sm 9px` (controls), `--radius-lg 20px`. In-editor usage: small controls 7–9px · medium controls 9–10px · cards/panels 11–14px · pills `999px`.

**Control heights** — pills/inputs `38px` (`.finput`), bar pills/buttons `30–32px`, toggle segments `26–30px`, small chips `26–28px`.

**Shadows** — `--shadow` (card), `--shadow-pop` (popovers/drawers).

**Motion** — `--t-fast` / `--t` durations with `--ease` and `--ease-back` (back-out) curves; standard transitions ~.12s. Image generation mock uses a ~700ms "generating" delay. Spinner: `@keyframes imgspin` 0.7s linear. Popover entrance: `@keyframes pop` (.12s back-out).

**Focus-visible** — global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`.

---

## Icons
The prototype uses a small inline-SVG icon set (Lucide-style 24px stroke paths) defined in `reference/components.jsx` as `ICONS` + an `<Icon name size>` component. Names used in this editor include: `chevronl`, `chevrond`, `plus`, `x`, `check`, `checkcircle`, `warn`, `info`, `edit`, `media`, `search`, `rss`, `globe`, `posts`, `calendar`, `refresh`, `sparkles`, `archive`, `clock`, `layers`, `eye`, `arrowright`, `link`, `upnext`, `sliders`, `gauge`, `dot`. **In production, map these to the codebase's existing icon library** (Lucide React is a drop-in match).

## Assets
No raster/image assets are required. Cover and inline images are placeholders (CSS gradients / hatch patterns) standing in for user-produced images — wire these to the real image pipeline (upload or generation). Fonts: Geist + Geist Mono (load from the app's font setup or Google Fonts/Vercel).

---

## Files in this bundle (`reference/`)
- `views-draft.jsx` — the editor shell: action bar, language toggle (+ add/remove + confirm), stage control, document canvas (Ideia/Rascunho incl. inline images), Focus mode, and the per-version content model + slug/dirty/publish logic.
- `views-draft-stages.jsx` — shared helpers (`EDITOR_STAGES`, `STAGE_MAP`, `deriveSlug`, `publishGate`) and the SEO, Imagens (interactive generate→choose flow), and Publicação (incl. update flow) stage panels.
- `views-draft-inspector.jsx` — the inspector cards: Detalhes (slug, excerpt, category & tags), Distribuição (site status + dates + social), Histórico, Arquivar.
- `blog.css` — all editor-specific styles (search `DRAFT EDITOR v3/v4`, `IMAGES`, `lang-`, `ed-`, `doc-`, `img-`, `gate-`, `update-`, `insp`).
- `styles.css` — global design tokens (dark + light), base elements, sidebar/topbar primitives, buttons (`.btn`, `.btn.sm`, `.btn.primary`).
- `data.js` — the mock `DATA.blog` with fully-populated example posts (`tg-01`, `ta-01`) showing every field including inline images, versions, history, and publish dates.
- `components.jsx` — shared primitives: `Icon`/`ICONS`, `Ring`, toasts (`pushToast`), etc.

## How to read the prototype locally
Open `cms/index.html` in the running project, go to **Blog**, and click a post card (e.g. "AI Empire" = draft with pending images; "Aprendi Inglês" = published with an EN sibling). The editor opens with everything wired.
