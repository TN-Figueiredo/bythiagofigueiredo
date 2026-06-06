# Handoff: Research — Pesquisas, Decisões & Foco (CMS)

## Overview

A new **Research** section for the ByThiagoFigueiredo CMS. It turns ad-hoc deep-research docs (written with Claude Cowork) into a navigable, editable system where strategic **decisions** and a quarterly **Foco** (focus) frame everything — so research feeds scripts, newsletters, and video content with clear intent.

The module has three lenses (tabs) plus a full-screen document editor:

1. **Foco** — the strategic layer. A pinned hero (the current 3-month bet), a Now/Next/Later horizon board, and the decisions + research that sustain the focus.
2. **Pesquisas** — the research library, organized by theme, with a status lifecycle and authorship (Cowork / Você).
3. **Decisões** — a decision log grouped by horizon; each card opens a **fullscreen decision view** (statement, context, consequences, success metric, revisit date, source research, and a status/provenance timeline) and links back to source research and forward to the content it drives.
4. **Document view** — open any research doc in a **TipTap** rich-text reader/editor with a metadata inspector.

Core product principle, made explicit in the UI: **você decide, o Cowork propõe.** The AI proposes a focus; the human confirms it. Nothing becomes the focus automatically.

---

## About the Design Files

The files in `design_files/` are **design references built in HTML/React-via-Babel** — runnable prototypes that show the intended look and behavior. They are **not** meant to be copied into production as-is. The task is to **recreate these designs in the target codebase's environment** (the real app is Next.js + React + Supabase, per the project) using its established components, data layer, and patterns.

Specifically:
- The prototype renders React 18 through an in-browser Babel transformer and stores state in `localStorage`. In production, replace that with real components and a real datastore (Supabase tables).
- The prototype loads **TipTap from a CDN (esm.sh)**. In production, install the TipTap npm packages and bundle them.
- Styling is plain CSS with CSS custom properties (design tokens). Map these tokens onto the codebase's existing token system / Tailwind config rather than pasting the CSS wholesale.

To run the prototype: open `index.html` (it expects the sibling files alongside it) and click **Research** in the sidebar.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, interactions, empty states, and motion are all specified. Recreate pixel-accurately using the codebase's component library, then wire to real data.

---

## Architecture of the prototype (map to production)

| Prototype file | Responsibility | Production equivalent |
|---|---|---|
| `research-data.js` | Seed data + enums (themes, statuses, horizons, focus states). Exposes `window.RESEARCH`. | Supabase schema + seed; enums as TS unions. |
| `views-research.jsx` | The module: tabs, cards, drawers, all state + mutations. | A `ResearchModule` feature with components + server actions. |
| `research-editor.jsx` | TipTap wrapper (`TipTapEditor`), toolbar, the research document view (`ResearchDoc`), and the decision fullscreen (`DecisionDoc`) + inspectors. | `<RichEditor>`, `<ResearchDoc>`, `<DecisionDoc>` components. |
| `research.css` | All module-specific styles + TipTap prose styling. | Component styles using existing tokens. |
| `index.html` | Loads the TipTap ES module and registers `window.TipTap`; script order. | npm import of TipTap; normal bundling. |
| `styles.css`, `views.css`, `blog.css`, `components.jsx`, `shell.jsx` | **Existing CMS** design system (tokens, primitives, icons, drawer, tabs, routing). Included for context — do not re-implement; reuse what the codebase already has. | Existing app design system. |

### Wiring into the CMS shell (what changed in `shell.jsx`)
- Added `research` to `CORE` (routes that render a real view) and to `ROUTES` (valid hash routes).
- Added `research: ["Research", null]` to `TITLES`.
- Rendered `{route === "research" && <ResearchView />}` in the content area.
- Added a `hashchange` listener so `#research` is deep-linkable and back/forward works.
- Sidebar already had a `research` nav item (Library group, icon `research`).

### TipTap loading (`index.html`)
A `<script type="module">` imports TipTap and exposes it globally, then dispatches a `tiptap-ready` event:
```html
<script type="module">
  const V = '2.11.5';
  const u = (n) => `https://esm.sh/@tiptap/${n}@${V}`;
  const core = await import(u('core'));
  const [SK, Underline, Highlight, Link, TaskList, TaskItem, Placeholder] = await Promise.all([
    import(u('starter-kit')), import(u('extension-underline')), import(u('extension-highlight')),
    import(u('extension-link')), import(u('extension-task-list')), import(u('extension-task-item')),
    import(u('extension-placeholder')),
  ]);
  window.TipTap = { Editor: core.Editor, StarterKit: SK.default, Underline: Underline.default,
    Highlight: Highlight.default, Link: Link.default, TaskList: TaskList.default,
    TaskItem: TaskItem.default, Placeholder: Placeholder.default };
  window.dispatchEvent(new Event('tiptap-ready'));
</script>
```
**Production:** `npm i @tiptap/react @tiptap/starter-kit @tiptap/extension-{underline,highlight,link,task-list,task-item,placeholder}` and use `useEditor` from `@tiptap/react`. The CDN dance and the `useTipTapStatus` polling hook exist only because the prototype has no bundler.

---

## Data model

All on `window.RESEARCH` in `research-data.js`. Suggested Supabase tables in parentheses.

### Tema (theme) — `temas`
Cross-theme DNA of the channel. `{ id, label, short, color (hex), icon }`
Seeded: `asia` (#22b8d6), `ia` (#8b8cf6), `dev` (#22c55e), `games` (#ec4899), `grana` (#f59e0b), `canal` (#a855f7).

### Pesquisa (research doc) — `pesquisas`
```
{
  id, tema (theme id), status, source,
  title, summary, updated (relative-time string), readMin (int), pinned (bool),
  takeaways: string[],          // key points; each can become a decision
  decisions: string[],          // ids of linked decisions (back-link)
  html: string                  // rich body (TipTap-compatible HTML)
}
```
- **status** (lifecycle): `fresca` → `analise` → `aplicada` → `arquivada`. Meta in `RESEARCH.STATUS` (label + kind + dot color).
- **source** (authorship): `cowork` (Claude wrote it), `thiago` (you), `dupla` (both). Meta in `RESEARCH.SOURCE` (label, short, icon, tone). **Editing a doc flips source → `thiago` and `updated` → "agora".**

### Decisão (decision) — `decisoes`
```
{
  id, statement, horizon, status, tema, rationale,
  date (string),
  context: string,          // the scenario that makes the decision necessary (fullscreen)
  consequences: string[],   // concrete implications — "what this decides" (fullscreen)
  metric: string,           // success metric (inspector)
  revisit: string,          // when to revisit, e.g. "Fim de ago 2026" (inspector)
  from: string[],           // research ids it derives from
  drives: string[],         // content it feeds: "Roteiros" | "Newsletter" | "Thumbnails" | "Script de vídeo"
  history: [{ label, date, note }]   // status/provenance timeline (fullscreen inspector)
}
```
- **horizon**: `agora` | `proximo` | `explorar` (see Horizons).
- **status**: `decidido` | `testando` | `revisar` | `arquivado`. Meta in `RESEARCH.DECISION_STATUS` (label, kind, icon).
- `context`, `consequences`, `metric`, `revisit`, `history` are all **optional** — the fullscreen `DecisionDoc` and the list `DecisionCard` render gracefully when they're absent (the card needs only statement + rationale + from/drives).

### Foco (focus) — `focos`
The strategic bet. **A focus is essentially a promoted decision with a time window.**
```
{
  id, horizon, active (bool), state, author, created (string),
  title, window (e.g. "Jun – Ago 2026"), thesis (long text),
  temas: string[], metric (string),
  basedOn: string[],   // research ids that ground the bet
  archived?: bool
}
```
- **state**: `ativo` (you confirmed it) | `proposto` (Cowork suggested, awaiting confirmation) | `rascunho` (draft) | `arquivado`. Meta in `RESEARCH.FOCO_STATE` (label + tone).
- **author**: `thiago` | `cowork`. Drives the "Definido por você" vs "Proposto pelo Cowork" line.
- **active**: exactly **one** focus may be active at a time, and it must be `horizon: "agora"` + `state: "ativo"`. Activating one demotes any other active `agora` focus to `rascunho`/`proximo`.

### Horizon — `RESEARCH.HORIZONS`
`{ id, label, sub, icon, color }`:
- `agora` — "Agora" / "Próximos 3 meses" / icon `target` / color `var(--accent)`
- `proximo` — "Próximo" / "3 a 6 meses" / icon `arrowright` / color `var(--c-pipeline)`
- `explorar` — "Explorar" / "Apostas / backlog" / icon `flask` / color `var(--c-courses)`

---

## Screens / Views

### 1. Module header + tabs (all tabs)
- **Header** (`.mod-head`): title "Research" (22px/600/-0.5px), a live pill `.mod-live` ("Cowork + você", 7px green dot), spacer, and a context action button on the right:
  - Foco tab: ghost **"Como funciona"** (toggles explainer) + primary **"Definir foco"**.
  - Pesquisas tab: primary **"Nova pesquisa"**.
  - Decisões tab: primary **"Nova decisão"**.
- **Tabs** (`.tabs` / `.tab`): Foco (icon `target`), Pesquisas (icon `research`), Decisões (icon `checkcheck`). Active tab uses accent text + underline marker; 13.5px/500.

### 2. Foco tab

**a) Explainer strip** (`.explainer`) — dismissible (persists dismissal), teaches the loop. Subtle accent-tinted gradient card.
- Head: info icon + "Como o Foco funciona — **você decide, o Cowork propõe**".
- Flow: 3 steps (`.ex-step`) separated by `arrowright` icons:
  1. **Pesquisas** (icon `research`, color `var(--c-courses)`) — "O Cowork investiga e escreve. Você edita."
  2. **Decisões** (icon `checkcheck`, color `var(--c-pipeline)`) — "Você transforma takeaways em decisões."
  3. **Foco** (icon `target`, color `var(--accent)`) — "Uma decisão estratégica com prazo vira o foco do trimestre."
  - Each step: 30px rounded icon tile tinted with its color at 14%, 13px/600 title, 11.5px/dim subtitle.
- Foot: dim note "Nada vira foco automaticamente — o Cowork só sugere; a confirmação é sempre sua." + a small **"Pedir proposta ao Cowork"** button.
- Close "×" top-right (`.explainer-x`).

**b) Focus hero** (`.focus-hero`) — shown when an active focus exists. Rounded-20 card, warm accent gradient, **5px accent left bar** (`.fh-bar`).
- Eyebrow (`.fh-eyebrow`, 11.5px/700/uppercase/1px tracking, accent text): `target` icon + "Foco · agora" + a window chip (`.fh-window`, mono 10.5px, surface-2 pill) + right-aligned **provenance** (`.fh-prov`): "Definido por você" (accent, icon `edit`) or "Proposto pelo Cowork" (color `var(--c-courses)`, icon `sparkles`).
- Title (`.fh-title`): 30px/700/-0.8px, max 22ch.
- Thesis (`.fh-thesis`): 14.5px/1.62 line-height, `var(--text-muted)`, max 70ch.
- **"Com base em"** row (`.fh-based`): tiny uppercase label + clickable research chips (`.based-chip`, surface-2 pill, `research` icon in `var(--c-courses)`); opens that doc.
- Bottom row (`.fh-bottom`): theme dots (`.fh-temas`), metric pill (`.fh-metric`, `gauge` icon), decisions-count pill (`target` icon, "N decisões ligadas"), spacer, **"Editar foco"** button (`btn sm`).
- Decorative `.fh-stamp` on the right: rotated "FOCO" text + dashed ring + accent dot (hidden < 980px).

**c) Focus empty / zero state** (`.focus-empty`) — shown when no active focus (first run, or after ending a focus). Centered, **1.5px dashed border**, rounded-20.
- 56px accent-soft icon tile (`target`), title "Você ainda não definiu um foco" (19px/600), explanatory subtitle (13.5px/1.6, max 52ch).
- Actions: primary **"Pedir proposta ao Cowork"** (`sparkles`) + secondary **"Definir foco manualmente"** (`plus`).
- Note: "A proposta do Cowork chega como rascunho — você revisa e confirma antes de virar o foco." (`info` icon in `var(--c-courses)`).

**d) Horizon board** (`.hz-board`) — 3-column grid (single column < 1100px). Each column (`.hz-col`, surface-2 panel):
- Head (`.hz-col-head`): colored 30px icon tile (`--hc` = horizon color), name (13.5px/600) + sub (11px/dim), and a **"+" add button** (`.hz-add`) on the right.
- Cards (`.hz-card`), styled by `state`:
  - `.st-ativo`: accent border (55%) + accent gradient. Head shows pulsing dot + "NO AR".
  - `.st-proposto`: **dashed** `var(--c-courses)` border + faint purple gradient. Head shows `sparkles` + "PROPOSTO PELO COWORK". Foot shows a small primary **"Confirmar"** button (`.hz-confirm`).
  - `.st-rascunho`: default surface, head shows `edit` + "RASCUNHO".
  - Card content: state row (`.hz-card-head` with `.hz-state` 10px/700/uppercase + an edit icon button revealed on hover), window (mono 10.5px), title (14px/600), thesis (12px, clamped 4 lines), foot with theme dots (+ Confirmar if proposed).
- Empty column: a dashed **"+ Adicionar aposta"** button (`.hz-empty`).

**e) Foco split** (`.foco-split`) — 2-column grid (single < 1100px):
- **Decisões em vigor** — `DecisionCard`s for decisions with `horizon === "agora"` and not archived; "Todas →" link to Decisões tab. Empty → `EmptyState`.
- **Pesquisa que sustenta o foco** — `ResearchCard`s for `pinned && status !== "arquivada"`; "Biblioteca →" link to Pesquisas tab. Empty → `EmptyState`.

### 3. Pesquisas tab
- **Theme rail** (`.cat-rail` / `.cat-chip`): "Todas" + one chip per theme (color dot + label + count).
- **Toolbar**: search box (`.search-box`, max 320px, normalizes accents) + status filter chips (`.chip.sm`): Todas / Frescas / Em análise / Aplicadas / Arquivadas.
- **Grid** (`.rgrid`, `repeat(auto-fill, minmax(304px, 1fr))`, 14px gap) of `ResearchCard`s. Empty → `EmptyState` with a "Nova pesquisa" action.

**`ResearchCard`** (`.rcard`): top row = theme tag + spacer + `StatusBadge`; title (15px/600); summary (12.5px/muted, clamped 3 lines); foot = `SourceTag` + takeaway count (`zap`) + decision count (`target`, if any) + spacer + updated time. `pinned` adds an accent-tinted border and a `pin` icon top-right. Whole card is a button → opens the doc.

### 4. Decisões tab
- **Horizon filter chips**: "Todos os horizontes" + one per horizon.
- **Groups** by horizon (`.dec-group`): head with horizon icon (in its color) + label + sub + count; a 2-column grid (`.dec-list`, single < 980px) of `DecisionCard`s.
- Empty → `EmptyState`.

**`DecisionCard`** (`.dcard`, **clickable** — `role="button"`, opens the decision fullscreen on click): top row = status pill (`.dstat`, tinted by status kind, with icon) + `HorizonChip` + theme tag + spacer + date (mono) + edit icon (revealed on hover; `stopPropagation` so it opens the drawer, not the fullscreen); statement (14.5px/600); rationale (12.5px/muted); links row (`.dcard-links`) = "deriva de" research chips (`.link-chip`, clickable → opens doc, `stopPropagation`) + "alimenta" drive chips (`.drive-chip`, accent-soft) + a hover-revealed **"Abrir →"** affordance (`.dcard-open`). Archived decisions render at 0.6 opacity.

### 5. Decision fullscreen (`DecisionDoc`, `.dec-view`)
Opens when a `DecisionCard` body is clicked. Reuses the `ResearchDoc` shell (`.doc-view` / `.doc-grid` / `.doc-main` 760px / `.doc-insp`) for visual consistency.
- **Top bar** (`.doc-bar`): "‹ Decisões" back, horizon crumb (icon in its color), theme crumb (color dot), spacer, a large status pill (`.dstat.lg`), and a **"Editar"** button (opens `DecisionDrawer`).
- **Hero** (`.dec-hero`): eyebrow (`.dec-eyebrow`, "DECISÃO · {horizon}" + date), the **statement** as an `<h1>` (`.dec-statement`, 30px/700/-0.8px, balanced wrap), and the **rationale** as a lead (`.dec-rationale`, 16.5px, 3px accent left border — same lead treatment as the research reader).
- **Sections** (rendered only if present): **Contexto** (`.dec-section` → `.dec-prose`, 15.5px) and **O que isso decide** (`.dec-conseq` — list with rotated-square accent marks). End-mark with a `checkcheck` icon.
- **Inspector** (`.doc-insp`, sticky):
  - **Status** — `.dec-status-pick`: the 4 statuses as selectable rows (`.dsp-opt`, current one `.on`, tinted by kind). Clicking patches the decision live.
  - **Métrica de sucesso** (`.dec-metric`), **Revisitar** (`.dec-revisit`, calendar pill) — each only if set.
  - **Pesquisa que fundamenta** — `.insp-dec` buttons listing the `from` research; click → opens that research doc.
  - **Alimenta** — `.drive-chip`s for `drives`.
  - **Histórico** — `.dec-timeline` vertical timeline of `history` rows (dot + connector line, label + mono date + note).

### 6. Decision drawer (`DecisionDrawer`, `.drawer`)
Right-side drawer (scrim + `.drawer`), mirrors `FocusDrawer`. Opened by **"Nova decisão"**, a card's edit pencil, the fullscreen **"Editar"**, or a takeaway→decision conversion. Fields: **A decisão** (textarea), **Por quê — o racional** (textarea), **Contexto · opcional** (textarea), **Status** (4-option segmented), **Métrica** + **Revisitar** (inputs, side by side), **Horizonte** (segmented), **Tema** (single-select chips), **Alimenta** (multi chips from `DRIVES`), and **Pesquisa que fundamenta** (`.pick-row` multi-select of non-archived research). Editing also shows an **Arquivar decisão** action. Foot: Cancelar + **Registrar decisão** / **Salvar**. On save: builds the full decision object (assigns `id = "d-"+Date.now()` when new, defaults `date: "hoje"`, seeds a one-row `history` if absent) and upserts into `decisoes`.

> **Implementation note (a bug we fixed):** `DecisionDrawer` must actually exist — it's referenced from four call sites (new / edit / fullscreen-edit / takeaway-conversion). A missing definition crashes the whole module to a blank screen. Make sure the component is defined and in scope.

### 7. Document view (`ResearchDoc`, `.doc-view`)
Replaces the module content when a research doc is open.
- **Top bar** (`.doc-bar`): "‹ Pesquisas" back button, theme breadcrumb (color dot + label), spacer, `SourceTag`, and a **read/edit segmented control** (`.doc-mode`): "Ler" (`eye`) / "Editar" (`edit`).
- **Grid** (`.doc-grid`): main column `minmax(0,1fr)` + inspector `320px` (single column < 1080px); `.doc-main` capped at 760px for a comfortable reading measure.
- **Main**:
  - Head: a **theme kicker** (`.doc-kicker`, uppercase label + colored square dot) above the eyebrow; status badge + "N min de leitura · {updated}"; **title** — an `<h1>` (34px/700/-0.9px, balanced wrap) in read mode, a wrapping `contentEditable` h1 in edit mode (commits on blur); **summary as a lead** (`.doc-summary`, 16.5px, 3px accent left border — matches the decision rationale).
  - **TipTap editor** (`TipTapEditor`). Read mode = non-editable prose, no toolbar. Edit mode = sticky toolbar + editable prose in a subtly bordered box.
  - End-mark (`.doc-endmark`): two short accent rules around a `sparkles` icon.
- **Inspector** (`.doc-insp`, sticky): blocks separated by hairlines, each with an uppercase header (`.insp-h`, accent icon):
  - **Takeaways** — each (`.takeaway`) = accent dot + text + a hover "→" button (`.tk-act`) that **turns the takeaway into a decision** (opens the decision drawer prefilled).
  - **Decisões ligadas** — buttons (`.insp-dec`) listing linked decisions (status icon + 2-line-clamped statement); click → Decisões tab. Empty hint otherwise.
  - **Status** — a `<select>` (`.finput.sm`) to change the doc status.
  - **Usar em** — three buttons (`.use-btn`): "Roteiros" (`blog`), "Newsletter" (`mail`), "Script de vídeo" (`video`) → toast (production: push to the relevant module).
  - **Foot** (`.insp-foot`): authorship line ("Escrito pelo Claude Cowork" / "Você editou" / "Cowork + você" + updated time).

---

## TipTap editor spec

- **Extensions**: `StarterKit` (configured `heading: { levels: [2,3] }`), `Underline`, `Highlight`, `Link` (`openOnClick:false`, `autolink:true`, opens in new tab), `TaskList`, `TaskItem` (`nested:true`), `Placeholder`.
- **Toolbar** (`.tt-toolbar`, sticky, blurred): Bold, Italic, Underline, **Highlight** (on-brand orange marker), separator, H2, H3, Blockquote, separator, Bullet list, Ordered list, **Task list (checklist)**, Link (prompts for URL), separator, Undo, Redo. Buttons are 32px; active state uses accent-soft. Each button calls `editor.chain().focus().<cmd>().run()`; the highlight button toggles `toggleHighlight`.
- **Provenance guard (important):** the `onUpdate` handler only persists when `editor.isEditable` is true. TipTap fires `onUpdate` once on load (HTML normalization); without this guard, merely *reading* a doc would flip its author to "Você". Keep this behavior.
- **Prose styling** (`.tt-prose .ProseMirror`): 16px/1.72, max 70ch. H2 22px/700, H3 17.5px/600. Links use accent underline. `<strong>` 700. `<mark>` = accent at 26% with clone box-decoration. Blockquote = 3px accent left border, muted text. Task list = custom 17px checkboxes (accent when checked, ✓ glyph); checked items go dim + strikethrough. Inline `code` and `pre` use the mono font on surface-2/elev.
- **Empty placeholder**: `p.is-editor-empty:first-child::before` shows `data-placeholder` in `--text-faint`.
- **Fallback**: if TipTap fails to load (offline/CDN blocked), `TipTapEditor` renders the stored HTML read-only inside `.tt-prose` plus a warning note (`.tt-fallback`). In production with bundling this branch is effectively dead but harmless.

---

## Interactions & Behavior

- **Open doc**: click a `ResearchCard` → `ResearchDoc` (read mode). "Nova pesquisa" creates a blank doc (`source: "thiago"`, `status: "fresca"`) and opens it in **edit** mode.
- **Edit doc**: toggle "Editar"; typing persists `html`, sets `source: "thiago"`, `updated: "agora"`.
- **Takeaway → decision**: inspector "→" opens the decision drawer prefilled with `statement = takeaway`, `tema`, `horizon: "agora"`, `status: "testando"`, `from: [docId]`. Saving links the decision back into the doc's `decisions[]`.
- **Foco — propose**: "Pedir proposta ao Cowork" creates a `state: "proposto"`, `author: "cowork"` focus (grounded in current research) in `proximo` (or `agora` if none active) and toasts. (Prototype uses a fixed template; production should generate from real research.)
- **Foco — confirm**: "Confirmar" on a proposed card → activates it (`state: "ativo"`, `active: true`, `horizon: "agora"`) and demotes the previous active focus.
- **Foco — author/edit**: "Definir foco" / "Editar foco" / column "+" open `FocusDrawer`. Footer offers "Salvar como rascunho/proposta" and **"Tornar foco ativo" / "Confirmar foco"**.
- **Foco — end**: editing the active focus shows "Encerrar este foco" (archives it) → returns to the empty state.
- **Navigation**: hash routing (`#research`); deep-linkable; back/forward works.
- **Persistence (prototype)**: full module state in `localStorage["tf-research-v3"]`; explainer dismissal in `localStorage["tf-research-explainer-v1"]`. Replace with Supabase in production.

### Motion
- Page/tab enter: `.fade-in` — `translateY(8px) → 0`, 0.32s `cubic-bezier(.2,.7,.2,1)` (slide only, no opacity).
- Cards: 1px hover lift, border brightens; buttons lift on hover, scale 0.97 on press; chips lift + scale 0.96 on press (shared tokens `--t-fast`, `--ease`, `--ease-back`).
- "No ar" / active dot: `hzpulse` 2s box-shadow pulse.
- Drawers: scrim fades; panel slides in from the right 28px.
- Toolbar/topbar: `backdrop-filter: blur`.

### State management (prototype → production)
`ResearchView` owns: `st` (`{ v, pesquisas, decisoes, focos }`), `tab`, `activeTema`, `statusFilter`, `q`, `openDocId`, `docStartMode`, `hzFilter`, `drawer` (`{ kind: "decision"|"focus", initial }`), `explain`. Mutations: `patchDoc`, `saveDecision`, `saveFoco`, `onActivateFoco`/`confirmFoco`, `proposeFoco`, `newPesquisa`. In production these become server actions / mutations against Supabase, with the single-active-focus invariant enforced server-side.

---

## Design Tokens

Defined in `styles.css` (dark default + `[data-theme="light"]`). **Reuse the codebase's tokens; this is the source of truth for intended values.**

### Colors (dark)
- Surfaces: `--bg #0b0c10`, `--elev #101117`, `--surface #15161d`, `--surface-2 #1a1c24`, `--surface-hover #1f212b`
- Borders: `--border #24262f`, `--border-soft #1c1e26`, `--border-strong #333645`
- Text: `--text #ececf1`, `--text-muted #9a9ca8`, `--text-dim #686a76`, `--text-faint #4a4c57`
- **Accent (warm coral):** `--accent #fb7a52`, `--accent-hover #ff8e6a`, `--accent-press #e9663d`, `--accent-text #fb7a52`, `--on-accent #1a0d07`, `--accent-soft rgba(251,122,82,.14)`, `--accent-soft-2 rgba(251,122,82,.22)`
- Domain colors used by themes/states: `--c-pipeline #22b8d6`, `--c-newsletter #a855f7`, `--c-courses #8b8cf6`, `--c-links #22c55e`, `--c-social #f59e0b`, `--c-youtube #ef4444`
- Semantic: `--ok #22c55e`, `--warn #f59e0b`, `--danger #f43f5e`, `--info #22b8d6` (+ `*-s` soft fills)
- Theme palette hexes (cards/dots): asia `#22b8d6`, ia `#8b8cf6`, dev `#22c55e`, games `#ec4899`, grana `#f59e0b`, canal `#a855f7`

> Brand rule (see project `BRAND_GUIDE.md`): the orange is the anchor color, used in ≤10% of any screen. Keep accent usage restrained.

### Light theme deltas
`--bg #f4f3f0`, `--surface #fff`, `--surface-2 #faf9f6`, `--border #e6e4de`, `--text #1b1c20`, `--accent #ef6a3d` / `--accent-text #d9572c` / `--on-accent #fff`. The module is fully theme-aware via tokens.

### Typography
- Sans/UI: **Geist** (`--font-sans`), weights 400–700. Mono: **Geist Mono** (`--font-mono`, used for windows/dates/labels with `tnum`).
- Scale (module): hero title 30/700/-0.8px; doc title 34/700/-0.9px; section/H2 22/700; H3 17.5/600; card titles 14–15/600; body/prose 16/1.72; meta 11–12.5; uppercase labels 10–11/700 with ~0.8–1px tracking.

### Spacing, radius, shadow
- Radii: `--radius 14px`, `--radius-sm 9px`, `--radius-lg 20px`; pills/chips 7–999px.
- Gaps: 6/8/10/12/14/16/24px scale; card padding 15–18px; grid gaps 12–14px.
- Shadows: `--shadow` (soft elevation), `--shadow-pop` (drawers/popovers).

---

## Components reused from the existing CMS (do not rebuild)
From `components.jsx`: `Icon` (lucide-style set — note `research`, `target`, `sparkles`, `flask`, `pin`, `checkcheck`, `gauge` are used), `Card`, `EmptyState`, `Badge`, `SourceTag` (defined in `research-editor.jsx`). From CSS: `.btn`(`.primary`/`.ghost`/`.sm`), `.chip`(`.sm`/`.on`), `.seg`, `.badge`, `.tabs`/`.tab`, `.cat-rail`/`.cat-chip`, `.search-box`, `.drawer`/`.drawer-scrim`/`.drawer-head`/`.drawer-body`/`.drawer-foot`, `.fgroup`/`.flabel`/`.finput`/`.fhint`/`.fsection`, and layout utilities (`.row`/`.col`/`.between`/`.grow`/`.gap-*`/`.dim`/`.fs1x`/`.mono`/`.truncate`). The toast helper is `pushToast({ kind, icon, title, msg })`.

## Assets
No images. All iconography is inline SVG (lucide-style) from the existing `Icon` set; a few editor-only glyphs are defined inline in `research-editor.jsx` (`EXTRA_ICONS`). TipTap is the only third-party dependency.

## Files in this bundle
- `design_files/research-data.js` — data model + enums (the spec for the schema), incl. enriched decisions (context, consequences, metric, revisit, history)
- `design_files/views-research.jsx` — module: tabs, cards, the `DecisionDrawer` + `FocusDrawer`, decision-fullscreen routing, state + mutations
- `design_files/research-editor.jsx` — TipTap wrapper + research document view (`ResearchDoc`) + decision fullscreen (`DecisionDoc`) + inspectors
- `design_files/research.css` — module + prose styles (intended visual values)
- `design_files/index.html` — TipTap module loader + script order
- `design_files/styles.css`, `views.css`, `blog.css` — existing CMS tokens/primitives (context)
- `design_files/components.jsx`, `shell.jsx` — existing icons/primitives + routing wiring (context)

## Open items (not yet built)
- The Cowork "propose a focus" action is a fixed template in the prototype — wire it to real model output over the user's research.
- The decision fullscreen renders a `history` timeline, but the app doesn't yet append to it automatically on status changes — in production, push a row whenever status/provenance changes.
- Decisions don't yet show per-item authorship the way Foco does (a "Você"/"Cowork" line) — add for consistency if desired.
- In production, enforce the single-active-focus invariant and the read-mode provenance guard server-side.
