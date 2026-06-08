# Design Spec — CMS Video Module + `/cms/pipeline` Dissolution

**Status:** Implementation-ready. **Owner:** Lead architect. **Date:** 2026-06-07. **Approach:** A (build `/cms/video` alongside, swap the existing rewrite facade, relink progressively, delete `/cms/pipeline` last). **Source handoff:** `/Users/figueiredo/Workspace/bythiagofigueiredo/design_handoff_video_module/` (README.md, video-data.js, views-video.jsx, views-video-record.jsx, video.css).

> **Cardinal decisions up front (read these first; the rest of the spec elaborates):**
> 1. **DB stage tokens stay `idea`/`published` — never `ideia`/`publicado`.** The 4 handoff lifecycle columns are a **UI projection** over the existing 7-stage `pipeline_workflows` rows. **Zero workflow/FK migration.** The handoff's `ideia`/`publicado` strings are display labels only.
> 2. **`/api/pipeline/*` (84 routes) STAYS, untouched.** `content_pipeline` is format-agnostic. Dissolution is **UI/routing only**. No API rename, no `api-registry.ts`/`endpoint_count` churn, registry-parity tests stay green by construction.
> 3. **A/B SSOT = the existing ab-lab** (`ab_tests`/`ab_test_variants`). **`content_pipeline.youtube_video_id` is ALREADY the internal `youtube_videos.id` UUID** (`20260509000001_content_pipeline.sql:48` — `youtube_video_id uuid REFERENCES public.youtube_videos(id)`), the **same** column type that `ab_tests.youtube_video_id` (`20260517000001_ab_testing.sql:10`) references. **There is no external-string id and no resolve/upsert step** — the FK is passed directly to `createAbTest`'s `youtube_video_id` argument. The Publicação stage is a **two-phase** surface: pre-publish drafts live in the `publish` section JSONB; at publish they **materialize** into ab-lab rows. No parallel A/B store. **Materialization has two hard data preconditions on the *referenced* `youtube_videos` row — `thumbnail_hq_url` non-null and `duration_seconds > 60` — checked via a single join in `load-video-detail.ts`; §3.8 specifies the gating and disabled-CTA paths.**
> 4. **Script model SSOT = `roteiro-schemas.ts`, bumped to v3.** The 5 handoff item types map onto an **extended** discriminated union (no fork). A read adapter + v2→v3 migration handles legacy data; the read-adapter order is **version-aware and non-destructive for already-v3 rows** (§3.4).
> 5. **Rich Pós (timeline / music-sfx / crossref / speedramp) is RETIRED behind a read-only legacy fallback.** New Pós is the lightweight brief; Momentos/B-roll **derive** from script `vis`/`key` items.
> 6. **The facade already exists** in `next.config.ts` (redirects + `beforeFiles` rewrites for `/cms/up-next`, `/cms/video`, `/cms/courses`, `/cms/library/*`). **Every** graduated destination — not just `/cms/video` — must have a real route AND its inbound `beforeFiles` rewrite removed in the same commit, or the new route is shadowed and a redirect↔rewrite loop forms (§8.2, §8.6).

---

## 1. Goal & Scope

### In scope
- A purpose-built `/cms/video` section: **Hub** (stat cards + pillar rail + 4-column lifecycle kanban + live channel header), **staged Editor** (`/cms/video/[id]/edit` — Ideia · Roteiro · Pós · Publicação), and **create** (`/cms/video/new`).
- Three overlays: **Modo Gravação** (printable recording sheet), **Exportar pro editor** (printable post-prod handoff), **Cowork popover** (context-aware AI request box).
- A bilingual (PT/EN) independent-version model, teleprompter, two print paths, published read-only freeze, lifecycle gating, **focus mode**.
- **Dissolution of `/cms/pipeline` UI** via swapping the existing rewrite facade to real routes + progressive relink + final deletion gate, applied uniformly to **all** graduated destinations (video, library/research, library/reference, library/audio, courses, up-next).
- Data reconciliation: lifecycle-stage projection, script-item v3 union, pillar home, **format-aware** bilingual storage, A/B materialization, retirement of rich Pós.

### Explicitly OUT / deferred
- **`/api/pipeline/*` namespace rename** — OUT. Stays format-agnostic. (Decision 2.)
- **Rich timeline / music-sfx / speedramp / crossref editors** — RETIRED (read-only legacy fallback only). (§4, §5.4.)
- **Thumbnail generation** ("Claude Design") — external, OUT. A/B cards hold brief + title only. **(But A/B materialization still requires the referenced `youtube_videos` row to carry a synced `thumbnail_hq_url` — §3.8.)**
- **Distribution chips** (Instagram/Bluesky/Comunidade YT/Newsletter) — wire to existing `/cms/social` + schedule **or** explicitly stub with a "Agendar" deep-link; default = deep-link to `/cms/social` create with `source_pipeline_id` prefilled (deferred wiring acceptable for P3).
- **Up Next / week-grid / pins / Schedule** — folded out of `/cms/pipeline` into **their own real routes** (`/cms/up-next` graduates a real route; `/cms/schedule` already separate); NOT folded into the video hub. (§8.)
- **Pillar-based RLS** — not needed; pillar is a display/filter axis, not a security boundary.

---

## 2. Information Architecture & Routes

All routes live under `apps/web/src/app/cms/(authed)/video/`.

| Route | File | Purpose | Guard |
|---|---|---|---|
| `/cms/video` | `video/page.tsx` | Hub: live channel header, stat cards, pillar rail, 4-col kanban | `requireSiteScope({area:'cms',siteId,mode:'edit'})` |
| `/cms/video/[id]/edit` | `video/[id]/edit/page.tsx` | Staged editor shell | same + `notFound()` if id not visible to site |
| `/cms/video/new` | `video/new/route.ts` (Route Handler, POST/GET) | Insert `content_pipeline` row, redirect to editor | same + publish-irrelevant |
| `video/[id]/edit/loading.tsx` | — | Editor skeleton | — |
| `video/[id]/edit/error.tsx` | — | Section error boundary (mirror blog `error.tsx`) | — |
| `video/loading.tsx` | — | Kanban skeleton | — |
| `video/error.tsx` | — | Hub error boundary | — |

**Nav:** `cms-sections.ts:34` already points the "Pipeline" item at `/cms/video` with `minRole:'editor'`. **Rename the label "Pipeline" → "Vídeos"** and keep `icon(Video)`; this is a 1-line nav edit in the same isolated commit as the hub. No new nav item.

**Hub header** (`.mod-head`, README §80): see §3.7a — title "Vídeos", a **live channel label** (`.mod-live` with a pulsing `<i/>` indicator and per-language channel names), and a right-pushed primary **"Novo Vídeo"** button wired to `/cms/video/new`.

**Editor shell IA** (mirrors blog `editor-client.tsx`):
- **Breadcrumb bar** (`.ed-bar`, reused class — see §4 scoping): `Voltar` / `Vídeos` / `CODE` · lang toggle (`VidLang`) · status pill · focus toggle · Cowork button · "Modo Gravação".
- **Stage tabs** (`.ed-stages`, segmented): Ideia · Roteiro · Pós · Publicação. Pós + Publicação locked until lifecycle ≥ `gravacao`. Locked tabs are **clickable** and render `LockedStage`. **In focus mode `.ed-stages` is hidden** (§5.6).
- **Overlays** (portaled to `document.body`): `RecordingSheet`, `HandoffSheet`, `CoworkPopover`.
- **Focus-exit button** (`.focus-exit`): persistent, present only in focus mode (§5.6).

**Opening behavior:** the editor opens at `OPEN_AT[stage]` derived from the **projected lifecycle stage** (§3.2): `idea→ideia`, `roteiro→roteiro`, `{gravacao|edicao|pos_producao}→pos`, `{scheduled|published}→publicacao`.

---

## 3. Data-Model Reconciliation

`content_pipeline` is the single backing table. Video persists into: `stage` (DB workflow token), `language`, `title_pt`/`title_en`, `format_metadata` JSONB, `sections` JSONB (per the section PATCH contract), `youtube_video_id` (**internal `youtube_videos.id` UUID FK** — `content_pipeline.sql:48`), `version` (int optimistic lock). **No new table is required** except optional pillar column (§3.5 chooses `format_metadata.pillar` — zero migration). One **idempotent backfill migration** is required only for the `ideia` shared→per-language flip (§3.3).

### 3.1 Canonical token decision

| Concept | Handoff token | **Canonical (DB) token** | Notes |
|---|---|---|---|
| Lifecycle: idea | `ideia` | **`idea`** | DB seed `20260509000001:558`. UI label "Ideia". |
| Lifecycle: published | `publicado` | **`published`** | DB seed `:564`. UI label "Publicado". |
| Editor stage tab "Pós" | `pos` | `pos` (UI-only, not a DB stage) | maps to section key `postprod`. |
| Section keys | — | `ideia_*`, `roteiro_*`, `postprod_*`, `publish_*` | from `sections.ts:22-27`. |

**Rule:** `idea`/`published` everywhere in code, DB, and tests. The strings `ideia`/`publicado` appear only as UI labels via a lookup `LIFECYCLE_LABELS`.

### 3.2 Lifecycle-stage mapping (4 columns ↔ 7 DB stages) — UI projection, ZERO migration

The video workflow stays 7 stages (`workflows.ts:11-19`, `idea/roteiro/gravacao/edicao/pos_producao/scheduled/published`). Add a pure, tested helper `lib/pipeline/video-lifecycle.ts`:

```ts
export type VideoColumn = 'idea' | 'roteiro' | 'gravacao' | 'published'
const COLUMN_OF: Record<string, VideoColumn> = {
  idea: 'idea', roteiro: 'roteiro',
  gravacao: 'gravacao', edicao: 'gravacao', pos_producao: 'gravacao',
  scheduled: 'published', published: 'published',
}
export function videoColumn(stage: string): VideoColumn { return COLUMN_OF[stage] ?? 'idea' }
// gating predicate: Pós/Publicação unlocked once the DB stage position ≥ position('gravacao')
export function isRecorded(stage: string): boolean {
  return getStagePosition('video', stage) >= getStagePosition('video', 'gravacao') // ≥3
}
export const REACHED_BY = (stage: string) => ({ idea:0, roteiro:1, gravacao:2, published:3 }[videoColumn(stage)])
export const OPEN_AT = (stage: string): 'ideia'|'roteiro'|'pos'|'publicacao' =>
  ({ idea:'ideia', roteiro:'roteiro', gravacao:'pos', published:'publicacao' }[videoColumn(stage)] as any)
```

- **Kanban columns:** group items by `videoColumn(stage)`. `edicao`+`pos_producao` fold into "Gravação"; `scheduled`+`published` fold into "Publicado".
- **"Marcar como gravado"** writes DB stage = `gravacao` (the entry stage of the Gravação column) via the advance action, **only if** current position < 3. It never downgrades. Unlocks Pós + Publicação. This is an **edit-scope** transition (not publish): `requireSiteScope({mode:'edit'})` suffices. **However**, the general advance action MUST upgrade its scope check to `mode:'publish'` for any transition whose target is `scheduled` or `published` (the publish-equivalent stages) — `requireEditAccess` alone, as `advancePipelineItem` uses today (`pipeline/actions.ts:140`), would let a reporter advance an item all the way into `published`. The video advance/marcar-gravado action computes the target stage first, then selects `mode:'publish'` when `videoColumn(target)==='published'`, else `mode:'edit'`. (§5.5, §9.)
- **Publish** transitions DB stage to `published`. Authorization is enforced **explicitly in the server action** via `requireSiteScope({area:'cms',siteId,mode:'publish'})` (or an equivalent `can_publish_site(site_id)` RPC) **before** the `stage→'published'` update — **NOT** by `enforce_publish_permission`. That trigger is attached only to `blog_posts`/`campaigns`, gates on a `status` column `content_pipeline` doesn't have (it has `stage`), and short-circuits for `service_role` (which the module writes as) — so it provides **zero** DB-level publish authorization for video. (§5.4, §9.)
- **`workflows.ts` is NOT changed.** `DEFAULT_CHECKLISTS.video`, `getNextStage`, `generateCode` all unchanged — preserves Up Next, schedule, and every existing consumer.

### 3.3 Bilingual Ideia: flip `shared:true` → `shared:false` (the one required migration) — **format-aware everywhere**

The handoff requires per-language `direction`/`title`/`siblings`/`logline`/`angles`/`framework` (README:13, 209-211 "never a machine translation"). Current `sections.ts:23` marks video `ideia` as `shared:true` → single `ideia_shared` key, **and `SHARED_SECTIONS` (`sections.ts:13`) globally contains `'ideia'`.** This violates the core bilingual requirement.

#### 3.3.1 The split-brain problem (and why a per-format override alone is insufficient)

`getSectionKey(sectionType, lang)` today takes **no `format`**. A naïve `FORMAT_SHARED_OVERRIDE[format]` only takes effect for callers that pass `format='video'` — but **every existing caller passes no format**. Because the spec keeps the legacy `/cms/pipeline` detail view and **all** Cowork/MCP writes alive throughout the migration, a video ideia authored or read through those paths would resolve `ideia_shared` while the new `/cms/video` editor resolves `ideia_pt`/`ideia_en` — a **silent split-brain**. In particular, §3.8's Cowork ideia/title suggestions flow through `BatchSectionUpdateSchema`, and the batch path (`items.ts:1995/2010`) never passes format — so without the fix below, Cowork writes go to the wrong key.

#### 3.3.2 Decision — **make `getSectionKey` require `format` and thread it through all 9 call sites (4 files)**

Change the signature so the format axis is **mandatory** (no silently-wrong default). New `sections.ts`:

```ts
// 'ideia' is removed from the GLOBAL shared set — sharedness is now decided per (format, section).
const SHARED_SECTIONS = new Set(['images', 'curriculum', 'launch']) // ideia no longer global
// Per-format override: which section types are SHARED (single _shared key) for this format.
// Exhaustive over the real 5-member Format union (FORMATS in schemas.ts:4 — no 'social' format exists;
// the Sprint-5h @tn-figueiredo/social PACKAGE is unrelated to content_pipeline FORMATS).
// Typed ReadonlySet<string> so Record-exhaustiveness is enforced at compile time.
const FORMAT_SHARED_SECTIONS: Record<Format, ReadonlySet<string>> = {
  video:      new Set([]),                          // ideia PER-LANGUAGE; nothing video-shared
  blog_post:  new Set(['ideia', 'images']),         // blog keeps shared ideia + images
  newsletter: new Set(['ideia']),                   // PRESERVE pre-existing shared-ideia behavior
  course:     new Set(['ideia', 'curriculum', 'launch']),
  campaign:   new Set(['ideia']),
}
export function getSectionKey(sectionType: string, lang: string, format: Format): string {
  const sharedSet = FORMAT_SHARED_SECTIONS[format] ?? SHARED_SECTIONS
  if (sharedSet.has(sectionType)) return `${sectionType}_shared`
  const normLang = lang === 'pt-br' ? 'pt' : lang === 'pt' ? 'pt' : 'en'
  return `${sectionType}_${normLang}`
}
```

> **Why `newsletter` and not `social`:** the live `Format` union is exactly `['video','blog_post','newsletter','course','campaign']` (`schemas.ts:4`). `'social'` is **not** a `Format` (it only exists as a `campaign_type` enum value); a `Record<Format, …>` literal with a `social` key and a missing `newsletter` key is a **hard TS error** (TS2353 excess-property on `social` + TS2741 missing `newsletter`), which would make P0's typecheck gate fail for a misleading, unrelated reason and **mask the real caller-audit signal**. `newsletter` previously got its shared `ideia` from the global `SHARED_SECTIONS`; it MUST remain `Set(['ideia'])` here, or newsletter ideia silently flips to per-language and creates a **second split-brain**. `format` is now a **required** parameter, forcing a compile-time audit of every caller. `SECTION_DEFINITIONS.video[0]` is also flipped to `shared:false` to keep the per-format table and the definition consistent (blog/newsletter/course/campaign keep `shared:true` for `ideia`).

**Exact caller audit — 9 call sites across 4 files (checkable completion criterion).** The `format`-required signature change MUST thread the item's `format` into **all nine**; the typecheck gate fails until every one compiles. Do **not** stop at eight — `tab-container.tsx:329` (computed `isShared ? 'en' : l` lang) is the easy-to-miss ninth.

| # | Call site | Edit |
|---|---|---|
| 1 | `items.ts:1586` `getSection` | The fetch **already selects `format`** (`.select('id, format, language, version, sections')`, verified). **Only MOVE** the `getSectionKey` call from above the query (line 1586) to **below** `.single()` so `item.format` is in scope, then call `getSectionKey(params.section, lang, item.format as Format)`. **Do NOT add `format` to the select — it is already there.** |
| 2 | `items.ts:1643` `patchSection` | The fetch currently selects `.select('id, version, sections')` (verified — **no `format`**). **ADD `format`**: `.select('id, version, format, sections')`, **and MOVE** the `getSectionKey` call below the fetch, then call `getSectionKey(params.section, lang, item.format as Format)`. |
| 3 | `items.ts:1995` (batch not-found-results branch) | The per-item fetch (`.select('id, version, sections')`) gains `format`: `.select('id, version, format, sections')`. Compute `getSectionKey(u.section, u.lang, item.format as Format)`. For the **not-found branch** (item missing → no `item.format`), fall back to the **format carried on the update** if present, else default the key without sharedness (this write goes nowhere; the key is only the error `section_key` label). |
| 4 | `items.ts:2010` (batch write loop) | Same fetched `item.format`: `getSectionKey(update.section, update.lang, item.format as Format)`. |
| 5 | `mcp/prompts.ts:315` | Thread the already-loaded `item.format`; the discriminator conversion stays (`lang === 'pt' ? 'pt-br' : lang`). Add `format` to the prompt's item select if not already loaded. |
| 6 | `mcp/prompts.ts:406` | Thread `def`/item `format` (add to select where not loaded): `getSectionKey(def.type, 'pt-br', format)`. |
| 7 | `pipeline-item-detail.tsx:129` | Component already receives the item (with `format`) as a prop; pass `item.format`: `getSectionKey('draft', lang, item.format)`. |
| 8 | `pipeline-item-detail.tsx:150` | `getSectionKey(sectionType, lang, item.format)`. |
| 9 | `tab-container.tsx:44`, `:46`, `:329` | Three calls in one file — all receive the item (with `format`) as a prop. `:44` `getSectionKey(key, 'en', item.format)`; `:46` the two `getSectionKey(key, 'pt'|'en', item.format)`; **`:329` (computed lang)** `getSectionKey(activeTab, isShared ? 'en' : l, item.format)`. (`tab-container.tsx` holds **two** of the nine sites at lines 44/46 plus the computed-lang site at 329 — count this file as **three** distinct calls when verifying completion.) |

The legacy detail components (sites 7–9) die at P5 but must stay correct until then.

**Unit test (required, in §10):** assert `getSectionKey('ideia','pt','video') === 'ideia_pt'` AND `getSectionKey('ideia','en','video') === 'ideia_en'` AND `getSectionKey('ideia','pt','blog_post') === 'ideia_shared'` AND `getSectionKey('ideia','pt','newsletter') === 'ideia_shared'` (newsletter unchanged); AND an **integration assertion that the batch/MCP write path for a video item writes `ideia_pt` (not `ideia_shared`)** — seed a video item, run a `BatchSectionUpdateSchema` update with `source:'cowork'` for section `ideia` lang `pt`, and assert the resulting `sections` object has key `ideia_pt` and no new `ideia_shared`. Until every read + write path agrees, the backfill migration cannot guarantee a single source of truth.

#### 3.3.3 Backfill migration (`npm run db:new video_ideia_per_language`, idempotent)

For every `content_pipeline` row where `format='video'`, seed the per-language ideia key(s) from the legacy `ideia_shared` blob, **explicitly handling all three `content_pipeline.language` values** (`'pt-br'` | `'en'` | `'both'`, per `content_pipeline.sql:36`). One-way, additive, safe; `ideia_shared` is left in place (read adapter ignores it). Exact lang→key mapping:

```sql
-- pt-br items: seed ideia_pt from ideia_shared
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_pt}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'pt-br'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_pt');

-- en items: seed ideia_en from ideia_shared
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_en}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'en'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_en');

-- BOTH items: seed BOTH ideia_pt AND ideia_en from ideia_shared, each guarded independently
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_pt}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'both'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_pt');
UPDATE content_pipeline
SET sections = jsonb_set(sections, '{ideia_en}', sections->'ideia_shared')
WHERE format = 'video' AND language = 'both'
  AND sections ? 'ideia_shared' AND NOT (sections ? 'ideia_en');
```

A `language='both'` video therefore gets **both** `ideia_pt` and `ideia_en` populated (never silently one-sided); `pt-br`→`ideia_pt` only; `en`→`ideia_en` only. Each statement is independently guarded by `NOT (sections ? '<key>')`, so re-running is a no-op (idempotent).

- **Card title source of truth:** `content_pipeline.title_pt` / `title_en` columns are the SoT for the hub card title (already indexed, already used by Up Next). The Ideia section payload `title` field **mirrors** them: saving the Ideia title writes both the section payload `title` and the corresponding `title_<lang>` column (in the same server action). Hub card reads `title_<primary>`.

**Ideia payload schema** (new, in `lib/pipeline/video-schemas.ts`):
```ts
export const IdeiaSectionSchema = z.object({
  title: z.string().max(500).default(''),
  direction: z.string().max(4000).default(''),
  siblings: z.array(z.string().max(500)).max(20).default([]),
  logline: z.string().max(1000).default(''),
  angles: z.string().max(200).default(''),
  framework: z.string().max(200).default(''),
}).strict()
```
(Production fields — `duration`, `location`, `recorded`, `pillar` — live in `format_metadata`, see §3.6, because they are cross-language or display-derived.)

### 3.4 ScriptItem grammar unification — RoteiroContent v3

Current v2 union (`roteiro-schemas.ts:4-31`): `line{accent?}` / `pause{duration}` / `note{tag:VISUAL|DIRECTION|NARRACAO}` / `ref`. Handoff prototype: `line{key?}` / `pause{s}` / `dir` / `vis` / `ed`, with the discriminator on field **`t`** (`{t:'line'}`, `{t:'pause',s:0.5}`, `{t:'vis'}`). Conflicts: `accent`≠`key`; emphasis is inline `**word**` (keep, it's already inline in v2 text); `dir`/`vis`/`ed` ≠ 3-tag note; the v3 union discriminates on **`type`** (not `t`); `s`≠`duration`; Pós must distinguish `vis` (b-roll) from `ed` (editor-only).

**Decision — bump to v3, extend the union (no fork):**

```ts
// v3 line: add `key` boolean (anchor) — supersedes the `accent:'key'` convention
export const ScriptLineLineSchemaV3 = z.object({
  type: z.literal('line'), text: z.string().min(1),
  key: z.boolean().optional(),          // anchor line (Pós "Momentos-chave", orange accent)
  accent: z.string().optional(),         // kept for back-compat; deprecated
})
export const ScriptLinePauseSchema = z.object({ type: z.literal('pause'), duration: z.number().min(0).max(30) })
// dir / vis / ed become first-class so Pós can filter cleanly
export const ScriptLineDirSchema = z.object({ type: z.literal('dir'), text: z.string().min(1) }) // schema member kept for fwd-compat; NOT a migration target and renders in NO surface (talent direction = beat.tone — §5.2/§6)
export const ScriptLineVisSchema = z.object({ type: z.literal('vis'), text: z.string().min(1) }) // editor → b-roll
export const ScriptLineEdSchema  = z.object({ type: z.literal('ed'),  text: z.string().min(1) }) // editor-only
export const ScriptLineSchemaV3 = z.discriminatedUnion('type', [
  ScriptLineLineSchemaV3, ScriptLinePauseSchema, ScriptLineDirSchema, ScriptLineVisSchema, ScriptLineEdSchema,
])
export const RoteiroBeatSchemaV3 = z.object({
  idx: z.number().int().min(0), name: z.string().min(1),
  status: z.enum(['PENDING','DONE']).default('PENDING'),
  duration: z.number().int().min(0).optional(),     // beat target seconds (handoff `dur`)
  tone: z.string().optional(),                       // handoff `tone` — NEW home
  script: z.array(ScriptLineSchemaV3).default([]),
})
export const RoteiroContentSchemaV3 = z.object({
  version: z.literal(3), meta: RoteiroMetaSchema.default({}), beats: z.array(RoteiroBeatSchemaV3).default([]),
})
```

**Read-adapter order (non-destructive, version-aware) — REQUIRED.** `migrateV1toV2` (`roteiro-schemas.ts:154-184`) only short-circuits on `version === 2`; a v3 object (`version:3`) misses that branch, falls through to the legacy mapper, and is mangled into a single-beat v2. **Therefore the read adapter MUST detect version FIRST and never feed v3 data through the v1 step:**

```ts
export function readRoteiro(raw: unknown): RoteiroContentV3 {
  const v = (raw as { version?: number })?.version
  if (v === 3) return RoteiroContentSchemaV3.parse(raw)   // already v3 → pass through untouched
  // version < 3 (1, 2, legacy/string): run the full chain
  const v2 = migrateV1toV2(raw)        // handles v1/string/legacy → v2 (idempotent on v2)
  return migrateV2toV3(v2)             // v2 → v3
}
```

Equivalently (belt-and-suspenders), patch `migrateV1toV2` to short-circuit on `version >= 2` rather than `=== 2`. The spec mandates the version-first dispatch in `readRoteiro` as the canonical order; the `>= 2` patch is an additional safety net. **No call site may invoke `migrateV1toV2` directly on a possibly-v3 row.**

**`migrateV2toV3`** (idempotent; only runs for `version < 3` via `readRoteiro`):
- `note{tag:'VISUAL'}` → `vis`; `note{tag:'NARRACAO'}` → `ed`.
- **`note{tag:'DIRECTION'}` and `ref` → coalesced into the beat's `tone` (NOT an inline `dir` item).** Rationale (corrected): inline `dir` script items render in **no surface** — the prototype's `RoteiroBeat` (`views-video.jsx`) and recording-sheet `RecLine` (`views-video-record.jsx:10-18`) both render only `line`/`pause`/`vis`/`ed`; talent direction is shown exclusively as the **beat-level** `.rb-tone` (Roteiro, §5.2) and `.rs-tone` "Direção" (recording sheet, §6), both driven by `beat.tone`. Migrating legacy DIRECTION/ref notes into an inline `dir` item would silently hide that content. Therefore the migration **concatenates** each beat's legacy `DIRECTION`/`ref` note texts (joined, dedup-trimmed) **into `beat.tone`** (appending to any existing `tone`), so migrated talent direction remains visible in both the Roteiro and the recording sheet. The `dir` member stays in the v3 union schema (forward-compatible) but is **not a migration target and renders nowhere** (§5.2, §6).
- `line{accent:'key'|truthy}` → `line{key:true}`; other `accent` values dropped (deprecated).
- `pause{duration}` unchanged (the **v3 canonical field is `duration`**).
- `beat.tone` defaults to `undefined` when absent (unless populated from migrated DIRECTION/ref above).
- Already-v3 → returned as-is (and never reaches this function via `readRoteiro`).

**Prototype-import / seed adapter (`t`→`type` AND `s`→`duration`).** When importing from the handoff prototype data shape (`video-data.js`), the discriminator field is **`t`** and pause length is **`s`**. The import path MUST rename BOTH:
- `{t:'line', text, key?}` → `{type:'line', text, key?}`
- `{t:'pause', s}` → `{type:'pause', duration: s}`
- `{t:'dir', text}` → `{type:'dir', text}`
- `{t:'vis', text}` → `{type:'vis', text}`
- `{t:'ed', text}` → `{type:'ed', text}`

i.e. rename the discriminator `t`→`type` for every item AND rename `s`→`duration` for pauses. State this in the `migrateV2toV3`/import note so the seed path has no literal gap.

**Reading cadence — video surfaces use `READ_WPS = 2.6` (matching the hifi reference exactly).** The existing blog helper `beatReadTime` (`roteiro-schemas.ts:215`) divides by `2.5`; the handoff (`views-video.jsx:28,339`) divides by **`2.6`** for both `beatRead` and per-line `lineSecs`. The reading clock (`0:00 / 2:08`) and the orange `.rot-readbar` scrubber fill are **visible hifi values** rendered on the centerpiece surface; using `/2.5` would produce a visible fidelity regression. **Decision: export a video-specific `export const VIDEO_READ_WPS = 2.6` in `video-schemas.ts`, distinct from the blog helper's `2.5`.** All video reading surfaces (Roteiro clock/scrubber, per-beat "~Ns de fala", recording sheet, handoff read estimates) use `2.6`:
- per-line secs `= max(1, round(words/2.6))`, `words = text.replace(/\*\*/g,'').split(/\s+/).filter(Boolean).length`.
- `videoBeatRead(beat) = ceil(beatWordCount/2.6 + sum(pause.duration))`.
The blog `beatReadTime` (`/2.5`) is left untouched (no churn for blog). **AC:** the HERO totals recomputed at `/2.6` match the prototype's rendered clock (e.g. HERO `2:08` total) exactly; a unit test pins `videoBeatRead` and per-line secs against the prototype's expected values so the divergence from blog's `/2.5` is provably intentional.

### 3.5 Pillar data home — `format_metadata.pillar` (zero migration)

Options weighed: (a) new `pillar` column (indexed, cleanest but a migration + RLS surface), (b) `format_metadata.pillar`, (c) `content_collections`. **Decision: (b) `format_metadata.pillar`** — no migration, fits the existing JSONB, hub counts computed in a single server query.

- Static lookup in **new** `lib/pipeline/pillars.ts`:
```ts
export const PILLARS = [
  { id:'viagem', label:'Viagem', color:'#22b8d6' }, { id:'ia', label:'IA', color:'#8b8cf6' },
  { id:'codigo', label:'Código', color:'#fb7a52' }, { id:'games', label:'Games', color:'#f43f5e' },
  { id:'nas', label:'NAS', color:'#22c55e' },
] as const
export type PillarId = (typeof PILLARS)[number]['id']
```
- `VideoMetadataSchema` gains `pillar: z.enum(['viagem','ia','codigo','games','nas']).optional()` (it's `.strict()`, so add explicitly — see §3.6).
- **Orthogonal to `BLOG_CATEGORIES`** (`stories/building/money/bts`): those are blog-only (set via `PipelineItemUpdateSchema.category`, blog editorial taxonomy). Pillar is video-only and lives in metadata; no overlap, no migration of category.
- Legacy video items with no pillar render under **"Todos"** only (no pillar pill on card; filterable but not counted in any pillar chip). Hub counts: `GROUP BY format_metadata->>'pillar'` (see §3.7).

### 3.6 `VideoMetadataSchema` extension (`.strict()` — every field explicit)

| Handoff `Version` field | Home | Shared / per-lang | Storage |
|---|---|---|---|
| `title` | `title_pt`/`title_en` cols + Ideia payload `title` | per-lang | columns (SoT) |
| `direction`, `siblings`, `logline`, `angles`, `framework` | Ideia section payload | **per-lang** | `sections.ideia_<lang>` |
| `pillar` | `format_metadata.pillar` | **shared** | metadata |
| `duration` (string range "14–17 min") | `format_metadata.duration_range` (NEW) + keep `duration_estimate_min:number` | shared | metadata |
| `location` | `format_metadata.recording_location` (existing) | shared | metadata |
| `recorded` (date/"—") | `format_metadata.recorded_at` (NEW, nullable string) | shared | metadata |
| `beats` | `sections.roteiro_<lang>` (v3) | per-lang | section |
| `ab` | `sections.publish_<lang>` (pre) → ab-lab (post) | per-lang | §3.8 |

Extended schema:
```ts
export const VideoMetadataSchema = z.object({
  playlist_letter: z.string().max(2).optional(),
  episode_number: z.number().int().positive().optional(),
  duration_estimate_min: z.number().positive().optional(),
  duration_range: z.string().max(40).optional(),          // NEW — "14–17 min"
  thumbnail_concept: z.string().optional(),
  recording_location: z.string().optional(),
  recorded_at: z.string().max(40).optional(),             // NEW — "23 abr 2026" | "—"
  equipment_notes: z.string().optional(),
  pillar: z.enum(['viagem','ia','codigo','games','nas']).optional(), // NEW
}).strict()
```

### 3.7 Hub derived-field projection (bounded query, no N+1)

Hub data comes from **one server query** (`lib/pipeline/load-video-hub.ts`) for `format='video'` + site scope. **To bound the payload, the query does NOT select the full `sections` JSONB.** Instead it projects only the cheap fields plus a **server-side beats-count expression**, so the full roteiro v3 (every beat + every script line for every card on the board) is never shipped to the client:

```sql
SELECT id, code, title_pt, title_en, language, stage, format_metadata, version, updated_at,
       -- beats count for the primary language, computed in SQL (no client transfer of script bodies):
       coalesce(jsonb_array_length(sections #> ARRAY['roteiro_' || primary_lang(language), 'beats']), 0) AS beats_count,
       -- direction-present flag (cheap key existence check, no body transfer):
       (sections ? ('ideia_' || primary_lang(language))) AS has_direction,
       -- language presence flags, cheap key existence checks:
       (sections ? ('ideia_pt')) OR (sections ? 'roteiro_pt') AS has_pt,
       (sections ? ('ideia_en')) OR (sections ? 'roteiro_en') AS has_en
FROM content_pipeline
WHERE format = 'video' AND site_id = $1
```

(`primary_lang(language)` maps `'pt-br'|'both'→'pt'`, `'en'→'en'`.) Per-card derivations (pure helpers, tested) consume **only** the projected scalars:
- **beats count** = `beats_count`; `0` → foot shows `"sem roteiro"` (or `"direção"` if `has_direction` — derived from the cheap key flag, not the body). Else `"N beats"`. The summed target duration footer is computed lazily in the editor (full sections loaded there), **not** on the hub.
- **language flags** = `has_pt`/`has_en`.
- **duration** mono = `format_metadata.duration_range` ?? `—`.
- **stat-card counts** = grouped count by `videoColumn(stage)`: Total / "Em roteiro" (`roteiro` col) / "Prontos p/ gravar" (`gravacao` col) / "Publicados" (`published` col).
- **pillar chip counts** = `GROUP BY format_metadata->>'pillar'` computed once server-side and passed down (avoid re-filtering all cards on every chip change beyond the cheap client array filter for the kanban view).

**Bounded-payload requirement (launch gate, not a deferred escape hatch):** the hub query MUST use the `jsonb_array_length(... #> ...)` beats-count expression above (or a generated/materialized `beats_count` + `pillar` projection) so that **script/roteiro bodies are never transferred to the hub**. The "one server query, no N+1" claim is preserved AND the per-card payload stays O(scalars). If profiling later shows even key-existence checks on large `sections` are heavy, the generated `beats_count`/`pillar` view is the next step — but the jsonb-length projection (no body transfer) is the **P1 requirement**, not an optional fallback. The full `sections` JSONB is loaded only in `load-video-detail.ts` for the single open editor item (the `load-pipeline-detail.ts` pattern), never for the board.

### 3.7a Hub header (`.mod-head` / `.mod-live`) — README §80

The hub renders a header band above the stat cards:
- **Title** "Vídeos" (left).
- **Live channel label** `.mod-live`: a small **pulsing `<i/>` indicator** (CSS keyframe `pulse`, suppressed under `prefers-reduced-motion`) followed by the text `Canal {pt.name} · {en.name}` — the per-language channel display names. **Data source for channel names/flags/labels (`VID.channels`):** a typed constant `CHANNELS` in `lib/pipeline/channels.ts` (site-level config, e.g. `[{ lang:'pt', name:'…', flag:'🇧🇷' }, { lang:'en', name:'…', flag:'🇬🇧' }]`), seeded from site settings; it is NOT per-video and lives in the data layer (not hardcoded in JSX), consistent with the "Cowork docs are living / never hardcode strategy" memory.
- **Right-pushed primary "Novo Vídeo" button** (`margin-left:auto`), a real `<a href="/cms/video/new">`/`<button>` wired to the create route handler (§2). Primary button styling (34–42px, focus-visible ring, §11).

**AC:** header renders the pulsing dot + `Canal {pt} · {en}` from `CHANNELS`; "Novo Vídeo" is right-aligned and navigates to `/cms/video/new`; pulse animation suppressed under reduced-motion.

### 3.7b Stat cards — accent token mapping (README §83)

`StatRow` renders **four** cards, each with a colored top accent bound to an exact CSS var (`--bc`). The mapping is fixed (not implementer-chosen):

| Card | Count source | Top accent (`--bc`) |
|---|---|---|
| **Total** | all video items | `--text` |
| **Em roteiro** | `roteiro` column count | `--c-pipeline` |
| **Prontos p/ gravar** | `gravacao` column count | `--warn` |
| **Publicados** | `published` column count | `--c-links` |

**AC:** each stat card's top accent uses exactly `--text` / `--c-pipeline` / `--warn` / `--c-links` in that order, in both themes.

### 3.7c VideoCard visual anatomy (`.vcard`) — README §91-95

The hub's primary surface is `.vcard`, a **full-width `<button>`** (real button for keyboard/cursor semantics) navigating to `/cms/video/[id]/edit`:

- **Container:** `background: var(--surface-2)`; `1px solid var(--border-soft)`; `border-radius: 12px`; padding `11–12px`.
- **Top row** (3 elements, space-between): (1) **mono code** (`code`, e.g. `V-A07`); (2) **pillar pill** — colored, uppercase, `10px`, dot + label, bound to `PILLARS[pillar].color` (absent when no pillar — legacy "Todos" cards show no pill); (3) **language flag(s)** (🇧🇷/🇬🇧 from `has_pt`/`has_en`).
- **Title:** `13.5px / weight 600`, **clamped to 2 lines** (`-webkit-line-clamp:2`). **Empty-title fallback = `'Sem título'`** (when `title_<primary>` is blank).
- **Foot row:** **duration** (mono, `format_metadata.duration_range` ?? `—`) + the beats label: `"N beats · {Xm}"` when `beats_count>0` (Xm = summed-target if available, else omit the `· Xm`), else **dim** `"direção"` (when `has_direction`) / `"sem roteiro"` (when neither beats nor direction). Foot logic is per §3.7.
- **Hover:** lifts `transform: translateY(-2px)` + shadow. **Press (`:active`):** settles to `translateY(-1px) scale(.992)`. Both suppressed under `prefers-reduced-motion`.

**AC:** `.vcard` renders surface-2/border-soft/12px-radius/11–12px-padding; the 3-element top row (mono code + colored uppercase-10px pillar pill + language flags); a 2-line-clamped `13.5px/600` title with `'Sem título'` fallback on blank; the foot duration + beats/`direção`/`sem roteiro` logic; hover `-2px`+shadow and press `-1px scale .992` (motion suppressed under reduced-motion).

### 3.7d Pillar rail (`PillarRail`) — README §86

The pillar filter rail is a horizontally **scrollable/wrapping** chip row above the kanban:
- A leading **"Todos"** chip (always present, count = total) plus **one chip per pillar** (`PILLARS`).
- Each chip = **colored dot** (`PILLARS[id].color`) + label + **count badge**. **The count badge is hidden when the count is 0 for non-"Todos" chips** (prototype `c>0 &&`); "Todos" always shows its count.
- The **active** chip is **filled** (solid background); inactive chips are outline/ghost. Clicking a chip filters all kanban columns to that pillar (cheap client array filter); "Todos" clears the filter.

**AC:** `PillarRail` renders "Todos" + one chip per pillar, each with a colored dot and a count badge (badge hidden when count is 0 for non-Todos chips); the active chip is filled; the rail scrolls/wraps; selecting a chip narrows all columns and counts match.

### 3.8 A/B integration — two-phase, ab-lab is SSOT (no string→UUID resolution)

`ab_tests` (`20260517000001_ab_testing.sql`) requires `youtube_video_id UUID NOT NULL REFERENCES public.youtube_videos(id)` (line 10), `original_thumbnail_url TEXT NOT NULL` (line 16), and the `ab_tests_one_active_per_video` partial unique index — a row **cannot** exist pre-publish. **`content_pipeline.youtube_video_id` is ALREADY the internal `youtube_videos.id` UUID** (`content_pipeline.sql:48` — `youtube_video_id uuid REFERENCES public.youtube_videos(id)`), i.e. the **same FK type** as `ab_tests.youtube_video_id`. **There is no external YouTube string id anywhere on `content_pipeline`, and no string→UUID resolution or upsert step exists or is needed** — the column is passed **directly** to `createAbTest`'s `youtube_video_id` argument. `source_pipeline_id → content_pipeline(id)` FK already exists; `ab_test_variants.title_text` already holds per-variant titles.

`createAbTest` (`youtube/ab-lab/actions.ts`) additionally: looks up the `youtube_videos` row by `input.youtube_video_id` (the same internal UUID we pass) at `actions.ts:109-110`, **rejects Shorts** (`duration_seconds <= 60` → error, `:119`), **rejects missing thumbnail** (`!thumbnail_hq_url` → error, `:123`), derives `original_thumbnail_url` from `thumbnail_hq_url` (preserve/immutable, `:127-130`, `:188`), seeds the original variant `is_original: true` (`:204`), and creates the `ab_tests` row with `status:'draft'`. **The 4-variant ceiling is NOT enforced inside `createAbTest`** — challengers are added via `createTextVariant`, which enforces `count >= 4` **total** (`:1047`), requires `test.status==='draft'` (`:1038`), and rejects `test_type==='thumbnail'` (`:1039`). The `:316` `>= 3` guard belongs to a *different* function that is **not on this path** — do not cite it as the ceiling.

**Materialization actions — exact ab-lab functions + ORDER (every variant write happens while the test is still `status:'draft'`, before any activate/publish flip):**
1. **`createAbTest`** (`actions.ts:201`, `test_type:'title'`) — creates the `ab_tests` row (`status:'draft'`) **+ the single `is_original` variant row only** (`:203-208` writes only `label/is_original/blob_url/blob_key/sort_order`). It does **NOT** set that variant's `title_text`, and it does **NOT** insert challengers. The test-level `original_title` is captured separately from **live YouTube metadata** (`:165-180`) — that is the *current* published title, **not** the draft's authored "original" title. `createAbTest` returns the **test id only**.
2. **`updateTextVariant`** (`actions.ts:1099`, `{ title_text?, metadata? }`) — write the **original** variant's authored title (otherwise it is silently dropped): resolve the original variant id (`SELECT id FROM ab_test_variants WHERE test_id = <id> AND is_original = true`), then `updateTextVariant(originalVariantId, { title_text: draft.original.title, metadata:{ visual_description: draft.original.brief } })`.
3. **`createTextVariant`** (`actions.ts:1018`, `{ title_text }`) **×3** — materialize the 3 **non-original** challengers (`title_text ← variant.title`, `metadata.visual_description ← variant.brief`). Each call **requires `test.status==='draft'`** (`:1038` — satisfied: no activation yet), **rejects `test_type==='thumbnail'`** (`:1039` — ours is `'title'`), and is bounded by **`count >= 4` total** (`:1047`). Result: 1 original + 3 challengers = **exactly 4 `ab_test_variants` rows, all with non-null `title_text`**.
4. **`uploadVariant`** (`actions.ts:294-303`) is **NOT used** — it hard-requires a JPEG/PNG `File` ≤ 2 MB, which the title-only flow has no file for. Thumbnails are set later, externally (Claude Design), via ab-lab's own upload path; the video module never calls `uploadVariant`.

**Phase 1 — pre-publish (draft in section JSONB):**
```ts
export const ABDraftSchema = z.object({
  leader: z.enum(['A','B','C','D']),
  variants: z.array(z.object({
    id: z.enum(['A','B','C','D']),
    tag: z.string().max(40).optional(),     // "original"
    title: z.string().max(500).default(''),
    brief: z.string().max(1000).default(''), // thumb brief (handoff `thumb`)
  })).length(4),
}).strict().refine(
  (d) => d.variants.filter(v => v.tag === 'original').length === 1,
  { message: 'Exactly one variant must be tagged "original"' },
)
```
**Variant-count / originality invariant (enforced by the `.refine` above):** the draft has **exactly 4 variants** and **exactly one** carries `tag==='original'`. This maps cleanly onto ab-lab's ceiling: **1 original (`is_original=true`, via `createAbTest`; its `title_text` set by `updateTextVariant`) + 3 challengers (via 3× `createTextVariant`) = 4 `ab_test_variants` rows**, bounded by `createTextVariant`'s `count >= 4` **total** ceiling (`actions.ts:1047`), each call requiring `test.status==='draft'` (`:1038`). A draft with zero or two `'original'` tags is rejected at schema level. A unit test in §10's "ABDraft→ab-lab mapping" suite asserts: 4 variants, exactly one `is_original`, that materialization calls `createAbTest` 1×, `updateTextVariant` 1× (original title), and `createTextVariant` **3×**, that **all 4 rows end with non-null `title_text`** (the original's equals the draft original title — not dropped), and that the result is exactly 4 rows.

Persisted at `sections.publish_<lang>` via the section PATCH contract. The Publicação grid reads/writes this draft. "Sugerir títulos com Cowork" fills empty `title`s (wire to Cowork, §7).

**Phase 2 — at publish/upload (materialize into ab-lab):**

Materialization has **two hard data preconditions** that mirror `createAbTest`'s existing checks. **No FK resolution step** — `content_pipeline.youtube_video_id` is already the internal UUID and is passed straight through:

1. **FK already set (`content_pipeline.youtube_video_id IS NOT NULL`).** Because the column is already `youtube_videos.id`, the publish action passes it **directly** as the `youtube_video_id` argument to `createAbTest`. The only gate is that the FK is set (a YouTube video is linked).
2. **Thumbnail + non-Short preconditions on the *referenced* `youtube_videos` row (`original_thumbnail_url NOT NULL`).** ab-lab derives the test-level `original_thumbnail_url` from `youtube_videos.thumbnail_hq_url`, so materialization requires the **referenced** `youtube_videos` row to (a) have `thumbnail_hq_url` populated and (b) `duration_seconds > 60` (not a Short). Both are evaluated via a **single join** in `load-video-detail.ts` (`content_pipeline LEFT JOIN youtube_videos ON content_pipeline.youtube_video_id = youtube_videos.id`) — **not a string lookup** — and both flow through `createAbTest`'s existing guards (`actions.ts:119`, `:123`). The video module does **not** set `original_thumbnail_url` itself; it relies on the synced thumbnail. `test_type='title'` is correct (thumbnails external) but **does not waive `original_thumbnail_url`** — the column is NOT NULL regardless, and is satisfied by the synced thumbnail. (No migration to nullify the column; the synced-thumbnail path is the chosen, possible path.)

**Mapping (Phase-2 INSERT):**

| Source | ab-lab target | Action |
|---|---|---|
| `content_pipeline.youtube_video_id` (already internal `youtube_videos.id` UUID) | `ab_tests.youtube_video_id` (FK, NOT NULL) | passed directly to `createAbTest` |
| referenced `youtube_videos.thumbnail_hq_url` (preserved) | `ab_tests.original_thumbnail_url` (NOT NULL) | derived by `createAbTest`, not set by us |
| `content_pipeline.id` | `ab_tests.source_pipeline_id` | `createAbTest` |
| `ABDraft.variants[tag==='original'].title` | original `ab_test_variants.title_text` | **`updateTextVariant` on the `is_original` row** — `createAbTest` does **NOT** set it; resolve the `is_original` id first |
| `ABDraft.variants[tag==='original'].brief` | original `ab_test_variants.metadata.visual_description` | `updateTextVariant` (same call) |
| `ABDraft.variants[non-original]` ×3: `.title` | `ab_test_variants.title_text` | **`createTextVariant` ×3** |
| `ABDraft.variants[non-original]` ×3: `.brief` | `ab_test_variants.metadata.visual_description` | **`createTextVariant` ×3** |
| `ABDraft.variants[].tag==='original'` (exactly one) | `ab_test_variants.is_original=true` | `createAbTest` |
| `ABDraft.leader` | informational seed; the **winner is owned by ab-lab** (`winner_variant_id`/`result_metadata`) | — |
| thumbnails | `ab_test_variants.blob_url` (external, set in ab-lab/Claude Design) | not via video module |
| `test_type` | `'title'` initially (thumbnails external) | `createAbTest` |

- **After materialization the title SoT is `ab_test_variants.title_text`**, not the draft. The Publicação stage becomes **read-only over the ab-lab row** once `ab_tests.status IN ('active','paused')`: titles/briefs `contentEditable=false`, leader → "liderando" trophy on the **winner only** (`winner_variant_id`), "Sugerir títulos" → "no ar — títulos travados". Unpublishing (ab-lab archive + stage retreat) lifts the freeze. (§5.4.)

- **Disabled-CTA + tooltip paths (mirroring the existing "Vincule o vídeo do YouTube primeiro" pattern), all derived from the single `content_pipeline ⋈ youtube_videos` join in `load-video-detail.ts`:**
  - **`content_pipeline.youtube_video_id IS NULL` (no linked video):** "Publicar + iniciar teste" disabled, tooltip "Vincule o vídeo do YouTube primeiro"; offer **"Abrir no A/B Lab"** deep-link (`/cms/youtube/ab-lab/new?pipeline=<id>`) reusing `pipeline-picker-dialog.tsx`.
  - **FK set but the referenced `youtube_videos.thumbnail_hq_url IS NULL`:** "Publicar + iniciar teste" disabled, tooltip "Sincronize a thumbnail do YouTube primeiro"; offer the same "Abrir no A/B Lab" deep-link (where the sync can complete). The publish action surfaces the failure path gracefully rather than letting the INSERT fail the NOT NULL constraint.
  - **The referenced video is a Short (`youtube_videos.duration_seconds <= 60`):** "Publicar + iniciar teste" disabled, tooltip "Testes A/B não se aplicam a Shorts (≤60s)". (Mirrors `createAbTest`'s `<= 60` rejection at the UI layer so the user never hits a data-layer error.)

  All three preconditions are evaluated server-side from the join in the hub/editor loader (`load-video-detail.ts`), so the CTA state is correct on first paint, and re-checked in the publish action before any `createAbTest`/`createTextVariant` call.

### 3.9 Optimistic locking / rev contract

All four payloads (Ideia, Roteiro v3, Pós brief, AB draft) are written **only** through the existing `/api/pipeline/items/[id]/sections/[section]` PATCH (`SectionPatchSchema`, rev-checked CAS — `sections.ts:79`). Rules:
- Each payload carries `rev`; the autosave layer sends `rev`, server rejects stale `rev` → **409** → surface `conflict-banner` (reuse pipeline's). `cowork_rev` is used when Cowork generates content (direction/titles), exactly like blog.
- **Item-level `content_pipeline.version`** guards stage transitions (advance/publish/marcar-gravado) — sent and checked on those actions; stale → 409.
- **Published read-only is enforced at the data layer, not just UI:** the section PATCH server wrapper rejects writes to `roteiro_*`/`ideia_*`/`publish_*` when the item's DB stage position ≥ `published`. (Teleprompter `spoken`/`cursor` are session-only and never PATCH, so they're unaffected — see §5.2.) Unpublish (retreat below `published`) re-enables writes.

### 3.10 Rich Pós data fate (§4/§5.4 reference)

`postprod-schemas.ts` (Timeline/Beat/MusicAsset/SFX/CrossRef, `schema_version 2.0`) currently backs `sections.postprod_<lang>`. **Decision: retire the rich editors; keep data readable.**
- New lightweight `PosBriefSchema` (§5.3) becomes the **authoring** payload, persisted under the same `postprod_<lang>` section key but discriminated by `kind:'brief'`.
- A read adapter inspects `postprod` payload: if it parses as legacy Timeline (`schema_version` present / no `kind`), render a **read-only `<LegacyPostprodFallback>`** (a thin wrapper over the retained `post-production-view.tsx` in display mode) with a banner "Pós legado (somente leitura) — recrie o brief para editar." No destructive migration; legacy rows remain renderable. New/edited Pós writes the brief shape.
- `editorDefaults` (channel DNA in `video-data.js`) is **promoted to per-video** Pós brief data (stored in `postprod_<lang>`), seeded from a site-level default constant on first open.

---

## 4. Component Plan — Reuse / Build-New / Retire

**Reuse (generic, decoupled — from `_shared/editor/`):**
- `use-autosave.ts`, `navigation-guard.tsx`, `autosave-indicator.tsx`, `read-only-overlay.tsx` — generic, table-agnostic. Reuse as-is.
- Blog **UI shells** `ed-bar` / `ed-stages` / `lang-toggle.tsx` (ConfirmPopover remove-version guard) / `stage-bar.tsx` patterns — reuse the **interaction patterns**, port classes under a shared scope (below).
- `roteiro-schemas.ts` (extended to v3 + `readRoteiro` dispatcher), `script-serializer.ts` (extend to v3 round-trip) — reuse, do not fork.
- `editor-routing.ts` `resolvePipelineEditorTarget` — extend (§8.3).
- ab-lab `actions.ts` (**`createAbTest` + `createTextVariant`** — §3.8; **NOT** `uploadVariant`) / `queries.ts` / `pipeline-picker-dialog.tsx` — reuse for A/B materialization (§3.8). **No `lib/youtube/*` resolution needed** — `content_pipeline.youtube_video_id` is already the internal FK; the thumbnail/duration preconditions come from a single join in `load-video-detail.ts`.
- Pipeline `conflict-banner.tsx` — reuse for 409s.

**CSS scoping decision:** blog editor styles are scoped under `.blog-editor` (`editor-theme.css:182,626`). **Extract a shared base selector `.staged-editor`** carrying the common `ed-bar`/`ed-stages`/`ed-stage.{on,locked,done}`/`lang-toggle`/`focus-exit`/`ed-status`/`ed-iconbtn` rules; `.blog-editor` and a new **`.video-editor`** both compose it. The video module ships `video/[id]/edit/video-theme.css` for video-specific pieces (`.vcard`, `.vkanban`, `.rb-*`, `.rot-readbar`, `.vi-*`, `.pp-*`, `.ab-*`, `.rec-overlay`, `.mod-live`, both print blocks). This prevents specificity bleed if both ever co-render and avoids literal class collisions.

**Build-new (own context/reducer — DO NOT import blog's blog-table-coupled context):**
- `video/[id]/edit/context.tsx` + `reducer.ts` — video editor state machine, persisting to `content_pipeline.sections`/`format_metadata` via section PATCH (NOT blog's `buildSavePayload`/`createPostAction`, which write `content_mdx`/`slug`/`tag_id`).
- `VideoHub`, `VideoCard`, `VideoKanban`, `PillarRail`, `StatRow`, `HubHeader` (`.mod-live`).
- `IdeiaStage`, `RoteiroStage` (+ `RoteiroBeat`, `ScriptLine`, teleprompter controller), `PosStage`, `PublicacaoStage`, `LockedStage`.
- `VidLang` (reusing blog `lang-toggle` ConfirmPopover for remove-version), `CoworkPopover`, `RecordingSheet`, `HandoffSheet`, **`FocusExit`** (§5.6).
- `lib/pipeline/video-lifecycle.ts`, `pillars.ts`, `channels.ts`, `video-schemas.ts`, `load-video-hub.ts`, `load-video-detail.ts`, server `actions.ts`.

**RETIRE (read-only fallback, no new editing surface):**
- `_timeline/post-production-view.tsx` → retained **display-only** behind `<LegacyPostprodFallback>`.
- `_music-sfx/*`, `broll-renderer.tsx` (extraction logic **reused** by Pós derive), `crossref-renderer.tsx`, `speedramp-renderer.tsx`, `script-edit-mode.tsx` (TipTap beat editor) → **not wired into the new editor.** Files remain until `/cms/pipeline` deletion (P5), then removed if unreferenced. Their tests move to "legacy" describe blocks or are deleted with the files. **No `sections.postprod` row is destroyed** (read adapter, §3.10).
- `script-view-mode.tsx` → superseded by the new teleprompter Roteiro view.

**Authoring-model decision:** the **teleprompter contentEditable Roteiro is the single authoring surface** for video scripts. The TipTap beat editor (`script-edit-mode.tsx`) is NOT used for video. `readRoteiro` (`migrateV1toV2`→`migrateV2toV3`, version-first) runs at read so legacy scripts load. (Editing in the teleprompter writes back v3 beats via section PATCH on blur — §5.2.)

---

## 5. Stage Editors

### 5.1 Ideia (max-width 720px, centered)
- Kicker "✨ Direção · {LANG}". Editable `title` (contentEditable, writes `title_<lang>` col + payload; **empty-title placeholder 'Sem título'**). Seed card "A direção" → editable `direction`. Cowork alternatives (`siblings[]`) with "Gerar mais" (wires to Cowork, §7; prototype's local pool is the loading-state placeholder). Metadata chips: pillar (dot), Ângulos, Framework, Duração. CTA "Destrinchar em roteiro" / "Abrir o roteiro" → switch to Roteiro tab.
- Empty state "Sem alternativas ainda — peça ao Cowork pra gerar algumas."
- **Under `published`:** title/direction become read-only (data-layer §3.9); edit only via Cowork or unpublish.

### 5.2 Roteiro — the centerpiece (max-width 760px)

**Persisted vs ephemeral:**
- **Persisted (section PATCH on blur):** beat `name`, `tone`, `duration`, and each `line.text`/`key`, `dir`/`vis`/`ed` text, `pause.duration`. Editing a line's contentEditable commits the v3 beat array. **Roteiro title empty → placeholder 'Sem título'.**
- **Ephemeral (session `useState`, NEVER persisted):** `spoken` Set (`"beatIdx-lineIdx"`), `cursor`, reading clock, scrubber. These are reading aids.

**Teleprompter scroll model (fixes the `.content` no-op):** the Roteiro view wraps its scroll region in a **ref'd container** `const scrollRef = useRef<HTMLDivElement>(null)` (the editor canvas wrapper), passed via context — **no `document.querySelector('.content')`**. Auto-scroll math on cursor change:
```
const el = scrollRef.current!.querySelector(`[data-k="${key}"]`)
const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top
          + container.scrollTop - container.clientHeight * 0.35
container.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
```
Data attribute contract: `data-k="{beatIdx}-{lineIdx}"`, stable across reconciliation (keyed by beat+line index).

**Reading math (canonical for video, `VIDEO_READ_WPS=2.6` — §3.4):**
- per-line secs `= max(1, round(words/2.6))` (words = `text.replace(/\*\*/g,'').split(/\s+/).filter(Boolean).length`).
- `videoBeatRead = ceil(beatWordCount/2.6 + sum(pause.duration))`.
- clock `elapsed = sum(lineSecs[0..cursor-1])`; `readPct = elapsed/total*100` (drives the `.rot-readbar` width).
- per-beat "x/N faladas" bar → green (`--ok`) at 100%; per-beat info shows `~{videoBeatRead}s de fala`.

**Roteiro summary row (`.rot-readbar` + full label set):** the summary row pins, in order:
- **beats count** `"N beats"`;
- **`alvo <dur>`** — the summed beat-target duration ("alvo" target);
- **`~M de fala`** — the read estimate (sum of `videoBeatRead`, computed at `/2.6`);
- the **live reading clock** (`elapsed / total`, e.g. `0:00 / 2:08`);
- the **spoken `x/total` counter** (lines marked across the whole script);
- the **"Notas do editor" toggle** — **default OFF** (reveals `vis`/`ed` lines when on);
- the **`.rot-readbar`** scrubber and the **"limpar"** button (below).

- **`.rot-readbar`** is a **3px orange-gradient** fill bound to `readPct` (e.g. `height:3px; background:linear-gradient(90deg, var(--accent), var(--accent-2)); width:{readPct}%`). It is the visible scrubber fill; its value uses the `/2.6` clock.
- **"limpar"** button **renders only when `spoken.size > 0`** (conditional render) and clears all marks (`setSpoken(new Set())`, `setCursor(0)`). When no lines are marked, the button is absent.
- **AC:** the summary row shows "N beats · alvo <dur> · ~M de fala" + the live clock + spoken `x/total` counter + the "Notas do editor" toggle (default OFF); "limpar" appears only after at least one line is marked and removes all marks + resets the clock/scrubber to 0; `.rot-readbar` is a 3px orange-gradient bar whose width tracks `readPct`; empty Roteiro title shows 'Sem título'.

**Keyboard precedence (single stack, one owner per key) — resolves blog/video collision:**
The editor mounts **exactly one** window keydown listener (the precedence resolver). Order:
1. **Overlay open** (RecordingSheet/HandoffSheet): `Escape` closes it; all other keys inert (teleprompter listener early-returns).
2. **Cowork popover open:** `Escape` closes it; `⌘/Ctrl+Enter` submits within the textarea; other keys inert globally.
3. **Focus mode (no overlay/popover):** `Escape` exits focus.
4. **Else teleprompter active** *only* when `activeElement` is NOT `contentEditable`/`input`/`textarea`/`button`: `Space`/`ArrowDown`/`Enter` → mark current line + advance; `ArrowUp` → step back + unmark.
- **Inherited blog `⌘S` (save) and `Escape`:** the video editor reimplements its own resolver (it does not import blog's `editor-client` handlers). `⌘S` = force-flush autosave (no-op if clean). Document: blog and video never co-render, so no cross-module handler conflict.
- The teleprompter listener is **removed/early-returned while any overlay or the Cowork popover is mounted** (gated by a `keyboardOwner` state: `'teleprompter'|'overlay'|'cowork'|'focus'`).

**Rendering:** `**word**` → `<b class="emph">` (reuse `emphHtml` logic, server-safe sanitized); `key:true` line → 2px orange left accent; marked line dims to `--text-faint` (not opacity, AA). Mark control = `<button aria-pressed={spoken}>` with `markPop` spring. Current line: orange-soft bg + accent bar, stays bright even if marked. Breath = "respira 0,5s" (decimal comma). Editor notes (`vis`/`ed`) shown only when "Notas do editor" on (default OFF).
- **Beat talent direction (`.rb-tone`) — REQUIRED.** When `beat.tone` is set, render a **beat-level** talent-performance note `<div className="rb-tone"><Icon eye 14/> {beat.tone}</div>` directly after the per-beat progress bar and before the script lines — italic, quiet, with the **eye icon** (prototype `views-video.jsx:320`, README §134 ".rb-tone: italic, quiet, eye icon. Talent performance note"). This is the in-app home for the talent direction migrated from legacy `note{DIRECTION}`/`ref` (§3.4 routes those to **beat `tone`**, not to an inline `dir` item — see §6 reconciliation). It is **not** gated by the "Notas do editor" toggle (that toggle only reveals `vis`/`ed`); the talent direction is always shown. Inline `dir` script items, if present, render **nowhere** in the Roteiro (prototype `RoteiroBeat` renders only line/pause/vis/ed) — talent direction lives at the beat level via `tone`. **AC:** a beat with `tone` set renders an italic quiet `.rb-tone` line with an eye icon, regardless of the "Notas do editor" toggle; matches `views-video.jsx:320`.
- **Sticky beat header:** `.rb-head { position: sticky; top: var(--ed-bar-h) }` where `--ed-bar-h` is the **measured** ed-bar height (+ robanner height when `published`), set via a `ResizeObserver`/CSS var — NOT a hardcoded 56px (the real shell differs). An opaque masking band covers the scroll gap. AC: no text bleeds above the header in either theme, robanner present or not.
- **Empty (idea-only):** "Ainda é só uma ideia" + "Ver a direção" → Ideia.

### 5.3 Pós — lightweight brief

```ts
export const PosBriefSchema = z.object({
  kind: z.literal('brief'),
  deliverables: z.object({ editor:z.string(), deadline:z.string(), turnaround:z.string(), drive:z.string(), energy:z.string(), references:z.array(z.string()).default([]) }).partial(),
  style: z.array(z.object({ k:z.string(), v:z.string() })).default([]),
  ctas: z.object({ note:z.string().default(''), rows:z.array(z.object({ k:z.string(), pt:z.string(), en:z.string() })).default([]), display:z.string().default('') }),
}).strict()
```
- **Momentos-chave** and **B-roll por beat** are **DERIVED from the roteiro, not stored**: `keyLineText(beat)` (first `key` line, fallback first line) and `visNotes(beat)` (all `vis` items) — **reuse `broll-renderer.tsx` extraction logic**. #1-indexed.
- Entrega/Estilo/CTAs fields editable via contentEditable→section PATCH. CTAs table highlights active-language column; warns QR differs per language. "Exportar pro editor" → `HandoffSheet`.
- No beats → empty card "Destrinche o roteiro" → Roteiro.
- Legacy rich postprod → `<LegacyPostprodFallback>` read-only (§3.10).

### 5.4 Publicação — 4-up A/B (two-phase, §3.8)
- Pre-publish: reads/writes `ABDraftSchema` in `publish_<lang>`. 4 cards (`repeat(4,1fr)`→2-up ≤1240px), each: 16:9 placeholder (1280×720) + variant badge (A/B/C/D, `AB_COLORS`), "original" tag (exactly one — schema invariant), "Claude Design" hover button (deep-link/stub), leader toggle, editable Título + Brief.
- "Sugerir títulos com Cowork" fills empty titles (§7).
- **Publish CTA gating:** "Publicar + iniciar teste" disabled with the appropriate tooltip when (a) `content_pipeline.youtube_video_id IS NULL`, (b) the referenced `youtube_videos` row has null `thumbnail_hq_url`, or (c) the referenced video is a Short — each with the "Abrir no A/B Lab" deep-link where applicable (§3.8, all from the single `load-video-detail.ts` join). Enabled only when all three preconditions pass.
- **Materialization (ordered, all while `status:'draft'`):** on publish, call `createAbTest({ youtube_video_id: content_pipeline.youtube_video_id, source_pipeline_id, test_type:'title', … })` (passes the FK directly, seeds the `is_original` row), then **`updateTextVariant`** on the resolved `is_original` row to set the original variant's `title_text` (createAbTest does not), then `createTextVariant` **3×** for the three non-original draft variants (§3.8).
- **Publish freeze (post-materialize):** entire stage `vid-ro`; `robanner` "Publicado · no ar"; titles/briefs `contentEditable=false`; leader control → **"liderando" trophy on the winner only** (`winner_variant_id`); "Sugerir títulos" → "no ar — títulos travados". Ideia title/direction also read-only (§5.1); **Roteiro teleprompter marking stays interactive** (ephemeral, doesn't write — confirmed intended). Unpublish lifts freeze.
- **Publish authorization is an explicit server-side check, not `enforce_publish_permission`** (§9): both the publish action AND the A/B materialize path call `requireSiteScope({area:'cms',siteId,mode:'publish'})` **before** the `stage→'published'` update and **before** any `createAbTest`/`createTextVariant` call. A non-`ok` result returns 403 from the action itself — hiding the CTA from reporters is UX only, never the authorization backstop. The `enforce_publish_permission` trigger does not attach to `content_pipeline`, gates a `status` column it lacks, and is bypassed for service_role, so it enforces nothing here. Distribution chips deep-link to `/cms/social`/schedule or stub.

### 5.5 Lifecycle gating
- Locked tabs (Pós/Publicação when position < `gravacao`) are **clickable** → `LockedStage` with per-stage copy + "Marcar como gravado" CTA. CTA = server action `advanceToRecorded(id, version)` → sets DB stage `gravacao` (if below), unlocks both, success toast, re-renders with `OPEN_AT`. Persisted, `requireSiteScope({mode:'edit'})`, version-checked. Reporter role: the CTA is hidden in the UI, **but the authorization is the server-side scope check in the action** — `marcar-gravado` itself enforces edit scope, and any advance whose target is publish-equivalent (`scheduled`/`published`) escalates to `mode:'publish'` (§3.2), so a reporter invoking the action directly receives 403 rather than relying on a hidden button.
- **Kanban empty column:** a column with no cards renders the **"Vazio"** empty-column state (README §90). **AC:** an empty lifecycle column shows the "Vazio" label.

### 5.6 Focus mode (README §216)
Focus mode is a distraction-free reading state toggled from the `.ed-bar` focus button:
- Toggling focus **hides `.ed-stages`** (the stage tabs) — prototype `{!focus && <ed-stages>}`.
- When the item is `published`, focus **also hides the `robanner`** — prototype `{ro && !focus && <robanner>}`.
- A **persistent `.focus-exit` button** appears (copy: **"Modo foco — clique para sair · esc"**); clicking it or pressing **Esc** (precedence level 3, §5.2) exits focus.
- The in-app ⌘P print already hides `.focus-exit` via `body:not(.recording) .focus-exit{display:none}` — preserve this so the focus-exit chrome never prints.

**AC:** toggling focus hides `.ed-stages` (and the published `robanner`) and shows the persistent `.focus-exit` "Modo foco — clique para sair · esc" button; Esc and clicking the button exit focus; `.focus-exit` does not render in the printed sheet.

---

## 6. Print & Recording Sheet

**Two print paths, mutually exclusive via body class:**
1. **In-app ⌘P on Roteiro** (`@media print body:not(.recording)`): hide all app chrome + teleprompter UI (incl. `.focus-exit`); reflow roteiro to serif ink-on-white; lines render with **empty hand-tick circles** + orange key/emphasis accents; `print-color-adjust:exact` on accents.
2. **Modo Gravação → Imprimir** (`body.recording`, overlay portaled): print the paper sheet (warm ink on cream, `.rec-overlay` local palette).

**Paper economy (ACs):** beats `break-inside:auto`; lines/pauses `break-inside:avoid`; beat headers `break-inside:avoid; break-after:avoid`. No large gaps, no mid-line/header splits. Both blocks scoped so they never clobber each other.

**Recording sheet behaviors (matching the prototype `RecBeat`/`RecLine`, `views-video-record.jsx:10-32`):**
- **Per-line layer (`RecLine`):** renders **only** `line` (with hand-tick circle + `key` accent), `pause` ("respira"), and — **behind the "Notas do editor" toggle** (`showEd`) — `vis` ("Visual") and `ed` ("Editor"). **Inline `dir` items render NOWHERE on the sheet** (the prototype `RecLine` has no `dir` branch). This is intentional, not an omission.
- **Beat-level talent direction (`.rs-tone` "Direção") — REQUIRED, always shown.** When `beat.tone` is set, render the beat-level direction note `<div className="rs-tone"><span className="rst-k">Direção</span><span>{beat.tone}</span></div>` immediately after the beat header and before the lines (prototype `views-video-record.jsx:30`, README §196 "italic Direção note"). This — driven by `beat.tone` — is where the sheet's talent direction lives (and the destination of the §3.4 DIRECTION/`ref`→`tone` migration), **not** an inline `dir` item. It is **not** gated by the "Notas do editor" toggle (that toggle gates only `vis`/`ed`).
- A−/A+ stepper scales spoken text via `--rs-scale` (clamp 0.85–1.4) and **must not break tick-circle vertical alignment** (tick alignment depends on `--rs-scale`). Overlay-local PT/EN segmented control (independent of editor `activeLang`). Idea-only → empty state CTA back to Ideia. Meta row: Canal/Pilar/Duração/Fala/Beats/Local. Escape closes (precedence §5.2). Read estimates on the sheet use `VIDEO_READ_WPS=2.6` (§3.4) to match the in-app clock.
- **AC:** the recording sheet renders the beat-level `.rs-tone` "Direção" (from `beat.tone`) when set, always visible; per-line shows `line`/`pause` always and `vis`/`ed` only when "Notas do editor" is on; **no inline `dir` item is rendered** (parity with `views-video-record.jsx:10-18`); migrated legacy DIRECTION/`ref` direction content surfaces via `beat.tone` here and in the Roteiro `.rb-tone`.

**HandoffSheet:** same paper system; deliverables, beat-by-beat anchor + visual cue, style, per-language QR/CTA warning, cross-promo PT-only. **Fix the prototype off-by-one bug:** HandoffSheet must render `#{i+1}` (prototype `views-video-record.jsx:176` uses `#{i}`). **All surfaces 1-indexed.** One duration convention: surfaces showing target use beat `duration`; reading surfaces show `videoBeatRead` (`/2.6`). Roteiro + recording sheet + handoff all consistent (read-estimate where "de fala" is shown; target where "alvo"/`dur` shown).

---

## 7. Cowork Integration
- `CoworkPopover`: portaled to `document.body`, `position:fixed` under trigger, reposition on scroll/resize, `z-index:400`, Escape + outside-click close (slotted into precedence §5.2 at level 2), send disabled when empty, `⌘/Ctrl+Enter` submits.
- **Context-aware prompt chips per stage** (`CW_PROMPTS`): ideia/roteiro/pos/publicacao arrays from `views-video.jsx:39-44`.
- **Wire to the real AI endpoint, not a toast.** Cowork writes through the **batch section update / Cowork API** path that sets `cowork_rev` (`BatchSectionUpdateSchema`, source `'cowork'`). **This path now threads the item's `format` into `getSectionKey` (§3.3.2),** so a video Cowork write for `ideia`/`publish` lands on `ideia_pt`/`ideia_en` / `publish_<lang>` — NOT `ideia_shared`. Pre-publish A/B title suggestions and Ideia alternatives flow through this. The prototype's `pushToast` + simulated pools are the loading-state placeholders only.
- **Deep-link compatibility:** Cowork may emit `/cms/pipeline/items/[id]` URLs (copy-pasteable, MEMORY) for items of **any** format (video, research, reference, audio). The **format-aware** `items/[id]/route.ts` handler (§8.2a) — NOT a blanket redirect — preserves these: it loads each item's `format` and dispatches video→`/cms/video/:id/edit`, research/reference/audio/broll→`/cms/library/*`, blog→`/cms/blog/*`, course→`/cms/courses`. A single static `→ /cms/video/:id/edit` redirect would 404 every non-video Cowork deep-link (the video editor's `notFound()`, §2). **Do NOT touch `PIPELINE_COWORK_KEY`** (HMAC, `mcp/safety.ts`). Re-seed the Cowork reference docs (§8) so newly-emitted URLs point at `/cms/video` (and the library/courses homes for non-video formats).

---

## 8. `/cms/pipeline` Dissolution

**The facade already exists** in `next.config.ts` (`redirects()` lines 74-89 + `beforeFiles rewrites()` lines 91-99). **Verified current state:** `/cms/up-next`, `/cms/video`, `/cms/courses`, `/cms/library/{research,reference,audio}` are **all** `beforeFiles` rewrites **into** `/cms/pipeline/*` (lines 94-99), and **none of them has a real route dir** under `app/cms/(authed)/` (no `library/`, `courses/`, `up-next/`, `video/` directories exist yet). Each also has a permanent redirect **out** of `/cms/pipeline/*` → its new home (lines 78-84). This is the staged facade; building a real route for **any** of these requires removing its matching rewrite **in the same commit**, else the real route is shadowed (`beforeFiles` runs before filesystem routing) AND a redirect↔rewrite loop forms (the redirect sends `/cms/pipeline/X → /cms/X` while the rewrite sends `/cms/X → /cms/pipeline/X`).

### 8.1 Sub-path → destination map (every sub-route gets a home before deletion)

| `/cms/pipeline` sub-path | Destination | Owner |
|---|---|---|
| `/cms/pipeline` (Up Next overview: week-grid/pins/today/velocity) | `/cms/up-next` (real route, graduate `page.tsx` + overview components) | **NOT the video hub** |
| `/cms/pipeline/video` ([format] board) | `/cms/video` (new hub) | this spec |
| `/cms/pipeline/items/[id]` | **format-aware** via the surviving `items/[id]/route.ts` handler (§8.2a): video→`/cms/video/[id]/edit`, blog→`/cms/blog/*`, research/reference/audio/broll→`/cms/library/*`, course→`/cms/courses` — **NOT** a single static redirect | this spec + §8.2a + §8.3 |
| `/cms/pipeline/items/[id]/edit` | `/cms/video/[id]/edit` | this spec |
| `/cms/pipeline/research`, `/topics/[code]` | `/cms/library/research` | library |
| `/cms/pipeline/brolls` | `/cms/library/` (broll home) or keep under library | library |
| `/cms/pipeline/audio` | `/cms/library/audio` | library |
| `/cms/pipeline/reference` | `/cms/library/reference` | library |
| `/cms/pipeline/course` | `/cms/courses` | courses |
| `/cms/pipeline/list` | `/cms/up-next?view=list` or `/cms/video` (video list) | per surface |

**Up Next, library, and courses ALL graduate to real routes before deletion** (not just video). Up Next graduates its `page.tsx` + `pipeline-overview.tsx`, `up-next-this-week`, `pinned-queue`, `today-action-cards`, week-slot-picker; library graduates `library/{research,reference,audio}`; courses graduates `courses`. Each queries `content_pipeline` format-agnostically and survives deletion. **All `lib/pipeline/*` helpers (up-next-*, generate-week-slots, suggest-for-slots) are KEPT — they are format-agnostic backend, not retired with the UI.** `/cms/schedule` (read-only, MEMORY) stays separate.

### 8.2 next.config swap (per route, atomic) + final table — **applies to ALL graduated destinations**

**The atomic graduation rule (uniform across video, library/research, library/reference, library/audio, courses, up-next):** for each destination, in the **same commit** that lands its real route: **remove its `beforeFiles` rewrite, keep its permanent redirect.** A real route MUST exist AND its inbound rewrite MUST be removed together — otherwise the real route is shadowed and the `/cms/pipeline/X → /cms/X` redirect + `/cms/X → /cms/pipeline/X` rewrite form an infinite bounce.

After all graduations + `/cms/pipeline` deletion, the final config has:
- **Redirects (kept, permanent 308):** `/cms/pipeline → /cms/up-next`, `/cms/pipeline/video → /cms/video`, `/cms/pipeline/course → /cms/courses`, `/cms/pipeline/{research,reference,audio} → /cms/library/*`, `/cms/pipeline/blog_post → /cms/blog`.
- **`/cms/pipeline/items/:id` is NOT a static next.config redirect — it is a format-aware route handler (§8.2a).** A blanket `next.config` redirect cannot read `item.format`; a single permanent destination would force **every** `items/:id` deep-link — including research, reference, and audio items — into `/cms/video/:id/edit`, where the editor's `notFound()` for non-video ids (§2) fires and **404s every non-video Cowork deep-link** (Cowork emits exactly these URLs — §7). The per-format dispatch that lives in the deleted `pipeline/items/[id]/page.tsx` today **must be preserved** by a thin surviving route at `/cms/pipeline/items/[id]` that loads the item, reads `format`, and dispatches like the current page.
- **Rewrites:** **ZERO `beforeFiles` rewrites whose destination is under `/cms/pipeline`.** (All six removed: up-next, video, courses, library/research, library/reference, library/audio.)
- **Loop guard (all six paths, not just video):** for every graduated path X ∈ {video, courses, library/research, library/reference, library/audio, up-next}, the `/cms/pipeline/Y → /cms/X` redirect coexists today with a `/cms/X → /cms/pipeline/Y` rewrite; the rewrite **must** be removed when the real `/cms/X` lands. **Test:** no `beforeFiles` rewrite destination references `/cms/pipeline` for **any** of these paths; each `/cms/pipeline/Y` resolves to its real home without bouncing.

### 8.2a `/cms/pipeline/items/[id]` — format-aware dispatch route (survives deletion; NOT a next.config redirect)

The `/cms/pipeline/items/:id` deep-link target is **computed per-format**, never a single static destination for all items. The current dispatch logic lives in the server component `pipeline/items/[id]/page.tsx` (verified): it loads the item, runs `resolvePipelineEditorTarget(item.format, …)`, and redirects **per format** — blog→blog editor, video→video, research/broll/audio/reference→detail/library. **That page is deleted at P5**, and a `next.config` redirect cannot read `item.format`, so a blanket `/cms/pipeline/items/:id → /cms/video/:id/edit` redirect would force research/reference/audio deep-links into the video editor, where `notFound()` (item not visible as video, §2) fires → **404 on every non-video Cowork deep-link**.

**Decision: keep a thin, surviving server route at `apps/web/src/app/cms/(authed)/pipeline/items/[id]/route.ts` (Route Handler, GET) — the ONLY part of the `/cms/pipeline` tree that is NOT deleted at P5.** It does the format-aware dispatch the deleted page did, mapping each format to its real graduated home:

```ts
// /cms/pipeline/items/[id]  — format-aware redirect handler (replaces the deleted page.tsx dispatch)
const { siteId } = await getSiteContext()
await requireSiteScope({ area:'cms', siteId, mode:'edit' })
const { item } = await loadPipelineItemDetail(id, siteId)         // already loads format
const target = resolvePipelineEditorTarget({ id: item.id, blog_post_id: item.blog_post_id ?? null, format: item.format })
switch (target.kind) {
  case 'edit-video': return redirect(`/cms/video/${target.pipelineId}/edit`)   // video
  case 'edit':       return redirect(`/cms/blog/${target.postId}/edit`)        // linked blog
  case 'create':     return redirect(`/cms/blog/from-pipeline/${id}`)          // unlinked blog
  case 'detail':     return redirect(libraryHomeFor(item.format))             // research/reference/audio/broll → /cms/library/* | /cms/courses
}
```

`libraryHomeFor(format)` maps the non-editor formats to their graduated library/courses homes (research/reference/audio → `/cms/library/{research,reference,audio}`; broll → library broll home; course → `/cms/courses`) — i.e. the same destinations §8.1 assigns. This route is **format-aware by construction**, so video items reach `/cms/video/:id/edit` while research/reference/audio/broll/course items reach their real homes and **never** hit the video editor's `notFound()`.

- **This route stays in the codebase after P5** (it is the deep-link compatibility shim for Cowork-emitted `/cms/pipeline/items/[id]` URLs, §7). It is excluded from the §8.6/P5 "delete `/cms/pipeline`" sweep, and the §8.4 CI grep gate must whitelist this single redirect handler (it legitimately references `/cms/video`, `/cms/blog`, `/cms/library/*` as redirect targets — not as a stale `/cms/pipeline` link).
- **Alternative (equivalent, also acceptable):** a `next.config` redirect set that is **format-segmented at the source** — but since `items/:id` carries no format in the URL, the format must be loaded at request time, which is exactly a route handler. The blanket single-destination redirect is **rejected**.
- **AC / test:** a `GET /cms/pipeline/items/<video-id>` 30x-redirects to `/cms/video/<id>/edit`; `GET /cms/pipeline/items/<research-id>` redirects to `/cms/library/research` (NOT the video editor); `<reference-id>`/`<audio-id>` redirect to their library homes; no non-video `items/:id` deep-link lands on the video editor's `notFound()`.

### 8.3 `resolvePipelineEditorTarget` realignment
Extend `editor-routing.ts` (keep blog branches intact). The function gains an `edit-video` branch keyed off `content_pipeline.id`, which requires a new `id` field on the param:

```ts
export type PipelineEditorTarget =
  | { kind:'edit'; postId:string } | { kind:'create' }
  | { kind:'edit-video'; pipelineId:string } | { kind:'detail' }
export function resolvePipelineEditorTarget(item:{ id:string; blog_post_id:string|null; format:string }) {
  if (item.format === 'video') return { kind:'edit-video', pipelineId:item.id } // → /cms/video/[id]/edit
  if (item.blog_post_id) return { kind:'edit', postId:item.blog_post_id }
  if (item.format === 'blog_post') return { kind:'create' }
  return { kind:'detail' } // research/broll/audio → library homes via redirect
}
```

**Existing-caller compatibility (the directory is deleted only at P5, so both callers must keep compiling in the interim):**
- **`pipeline/items/[id]/page.tsx:26`** currently calls `resolvePipelineEditorTarget({ blog_post_id: item.blog_post_id ?? null, format: item.format })` — **no `id`**. Because `id` is now **required**, this caller MUST be updated in the same touch to pass `id: item.id` (it already has `item.id` in scope from `loadPipelineItemDetail`). Add a `kind === 'edit-video'` branch here that `redirect(`/cms/video/${target.pipelineId}/edit`)`. This caller lives in the directory deleted at P5; until then it must compile and behave. (This is explicitly added to the touch-list below.)
- **`blog/from-pipeline/[pipelineId]/route.ts:39`** already passes the item object; add `id` and the `edit-video` branch.

(Chosen approach: keep `id` **required** for a single source of truth and force the compile-time audit; both call sites are updated. Making `id` optional was rejected because it would silently allow the `id`-less video path to fall through to `detail`.)

**Update the `from-pipeline` bridge fallback** (`blog/from-pipeline/[pipelineId]/route.ts:45`): replace `redirect('/cms/pipeline/items/${pipelineId}')` with `edit-video → /cms/video/${pipelineId}/edit`; non-video legacy → `/cms/library/*`.

### 8.4 Straggler href inventory (relink checklist; fragment-preserving)
Enumerated call sites (confirmed by grep) — relink to `/cms/video/[id]/edit` (video) or library/courses/up-next homes:
- `pipeline/items/[id]/page.tsx:26` (`resolvePipelineEditorTarget` caller — pass `id`, add `edit-video` redirect). **The page is replaced at P5 by the thin format-aware `pipeline/items/[id]/route.ts` handler (§8.2a), which survives deletion** as the Cowork deep-link shim; the dispatch logic moves there 1:1.
- `playlists/[id]/_components/playlist-canvas.tsx`
- `blog/[id]/edit/pipeline-pill.tsx`, `blog/_hub/hub-client.tsx`, `blog/new/post-edition-editor.tsx`, `blog/_tabs/editorial/editorial-tab.tsx`
- `pipeline/research/_components/research-detail.tsx:546` (`/cms/pipeline/${link.format}#${link.pipeline_item_id}` — **fragment `#...` must be preserved**; redirect rule keeps the hash by default on client-nav; for video, link directly to `/cms/video/${id}/edit`).
- `youtube/analytics/_components/yt-search-terms.tsx`, `social/[id]/_components/pipeline-context-panel.tsx`, `_components/dashboard-queries.ts`, `components/cms/sidebar-badges.tsx`, `api/cron/pipeline-deadline-digest/route.ts`, `lib/pipeline/select-suggestion.ts`, `lib/pipeline/research-digest.ts`, plus the `pipeline/_components/*` set (these die with the directory).
- **CI grep gate:** add a check (like ecosystem-pinning) that fails if any `/cms/pipeline` href remains in `apps/web/src` **once the migration phase is declared done** (P5). **Whitelist the surviving `pipeline/items/[id]/route.ts` (§8.2a)** — it legitimately *targets* `/cms/video`/`/cms/blog`/`/cms/library/*` as redirect destinations and is the deep-link shim, so the gate must exclude this one file (the rest of `/cms/pipeline/**` is deleted).

### 8.5 Cowork docs re-seed
Grep `docs/cowork-pipeline-reference.md` + `apps/web/data/pipeline-docs/cowork-docs-*.md` + api-registry summaries for `/cms/pipeline` URLs; update to `/cms/video` (and library/courses/up-next homes); **re-run the seed script** (Cowork reads from DB, MEMORY). Permanent redirects cover any already-emitted deep links. **No API route changes**, so `api-registry.ts`/`endpoint_count`/registry-parity tests untouched.

### 8.6 Deletion gate (per-destination prerequisites)
`/cms/pipeline` directory deleted **only** when, **for every graduated destination** (video, library/research, library/reference, library/audio, courses, up-next):
1. The destination has a **real route dir** that renders (not a rewrite shadow);
2. The destination's inbound `beforeFiles` rewrite into `/cms/pipeline/*` has been **removed**;

…AND globally:
3. all `/cms/pipeline` sub-paths have real homes (incl. `items/[id]` via the surviving format-aware handler, §8.2a);
4. `grep -r '/cms/pipeline' apps/web/src` returns 0 (excluding redirect strings in `next.config` **and the whitelisted surviving `pipeline/items/[id]/route.ts` deep-link handler, §8.2a/§8.4**);
5. no `beforeFiles` rewrite targets `/cms/pipeline` (asserted by the loop test for all six paths, §8.2);
6. route-migration test green;
7. soak period in prod elapsed.

Deletion is a **final, separate commit** — and a `/cms/pipeline/X` source may not be deleted, nor its redirect activated, before BOTH its real route exists AND its inbound rewrite is removed.

---

## 9. RBAC & Security
- **Every new page** (`video/page.tsx`, `video/[id]/edit/page.tsx`, `video/new`) calls `getSiteContext()` + `requireSiteScope({area:'cms',siteId,mode:'edit'})` at the top (mirror `pipeline/items/[id]/page.tsx:18-19`). Editor page additionally `notFound()` if the item isn't visible to the site.
- **Every write server action** — save section (ideia/roteiro/pos/ab-draft), advance stage, `advanceToRecorded`, create, publish, A/B materialize (`createAbTest` + the 3× `createTextVariant`) — calls `requireSiteScope`/`requireSiteAdminForRow('content_pipeline', id)` **before** any `getSupabaseServiceClient()` (CLAUDE.md). No service-client call without a guard.
- **Publish authorization is an EXPLICIT server-side scope check — there is NO DB-level publish guard to inherit.** `enforce_publish_permission` is attached **only** to `blog_posts`/`campaigns` (`schema.sql:6820,6823`), gates on `NEW.status IN ('published','scheduled')` — but `content_pipeline` has no `status` column, it uses **`stage`** (`content_pipeline.sql:34`) — and it **short-circuits for `service_role`** (`auth.role() IN ('service_role','supabase_admin') → RETURN NEW`, `20260507160000_fix_publish_trigger_service_role.sql:14`). The module writes via `getSupabaseServiceClient()` (service role), so even if the trigger were attached and column-correct it would be a no-op. The existing `publishItem` (`items.ts:1393`) hard-rejects non-blog formats, so there is no `content_pipeline` publish guard to reuse either. **Therefore:**
  - The **publish action** (stage → `published`) and the **A/B materialize action** MUST call `requireSiteScope({area:'cms',siteId,mode:'publish'})` (already a real mode — see `youtube/content/actions.ts:21`; equivalently an explicit `can_publish_site(site_id)` RPC check) **BEFORE** the `stage→'published'` update and **BEFORE** any `createAbTest`/`createTextVariant` call. A non-`ok` result → 403 from the action.
  - The **general advance action** escalates to `mode:'publish'` for any transition whose target stage is publish-equivalent (`scheduled`/`published`); `advanceToRecorded`/marcar-gravado (target `gravacao`) stays `mode:'edit'`. (Note: `advancePipelineItem` today uses only `requireEditAccess` even when advancing into `published` — the video advance action MUST close this.)
  - **Reporter cannot publish:** this is enforced by the scope check inside the action itself (returns 403), **not** by hiding the "Publicar + iniciar teste" / "Marcar como gravado" CTAs. Hiding the CTA is UX only; a reporter holding edit scope who invokes the publish/materialize/advance action directly is rejected by the server-side `mode:'publish'` gate before any `stage→'published'` write or `createAbTest`.
- Audit context (`set_audit_context`) set on transitions (reuse pipeline path).

---

## 10. Testing Strategy (TDD — write helpers first)

**(1) Pure-helper unit tests — FIRST, mirror `apps/web/test/unit/pipeline-*`:**
- `video-lifecycle.ts`: `videoColumn` (all 7→4), `isRecorded`, `REACHED_BY`, `OPEN_AT`, idea/published token correctness.
- **`getSectionKey` format-awareness (REQUIRED):** `getSectionKey('ideia','pt','video')==='ideia_pt'`, `('ideia','en','video')==='ideia_en'`, `('ideia','pt','blog_post')==='ideia_shared'`, `('ideia','pt','newsletter')==='ideia_shared'` (newsletter unchanged), `('roteiro','pt','video')==='roteiro_pt'`. **Plus a batch/MCP write-path assertion:** seeding a video item and running a `BatchSectionUpdateSchema` cowork update for `ideia`/`pt` writes key `ideia_pt` (NOT `ideia_shared`). **Plus a compile-time guard:** the `FORMAT_SHARED_SECTIONS` literal is exhaustive over the 5 `Format` members (a `Record<Format, ReadonlySet<string>>` type test catches any missing/extra key).
- Reading math (video): `videoBeatRead` and per-line secs at `/2.6`, `vidTotals`, `readPct`, clock format; **pin HERO totals against the prototype's rendered values** (e.g. HERO total `2:08`) to prove the `/2.6` divergence from blog's `/2.5` is intentional.
- Script migration: **version-first `readRoteiro` dispatch (v3 passes through untouched; v1/v2 run the chain)**; `migrateV2toV3` mapping (`note(VISUAL)→vis`, `note(NARRACAO)→ed`, `accent:'key'→key:true`); **`note(DIRECTION)` and `ref` → coalesced into `beat.tone`** (NOT an inline `dir` item — §3.4): assert a beat carrying legacy DIRECTION/`ref` notes ends up with that text in `beat.tone` (visible in `.rb-tone`/`.rs-tone`) and produces **no `dir` script item**; assert `beat.tone` renders in both the Roteiro `.rb-tone` and the recording-sheet `.rs-tone`; **prototype import `t→type` AND `s→duration`** (`{t:'pause',s:0.5}→{type:'pause',duration:0.5}`, `{t:'vis',text}→{type:'vis',text}`); idempotency on v3 (assert a `version:3` object is byte-identical after `readRoteiro`, NOT mangled into single-beat v2).
- Backfill migration: `language='both'` seeds BOTH `ideia_pt` and `ideia_en`; `'pt-br'`→`ideia_pt` only; `'en'`→`ideia_en` only; re-run is a no-op (idempotent).
- Pós derive: `keyLineText`, `visNotes` (#1-indexed).
- **A/B mapping (REQUIRED count/originality invariant + action audit):** ABDraft→ab-lab variant rows (`title_text`, `is_original`, winner ownership); **exactly 4 variants and exactly one `tag==='original'`**; materialization calls **`createAbTest` once** (inserts the `is_original` row, `status:'draft'`) **+ `updateTextVariant` once** (sets the original variant's `title_text`/`visual_description` from the draft) **+ `createTextVariant` exactly 3×** (each while `status==='draft'`, `test_type='title'`) **→ exactly 4 `ab_test_variants` rows, all with non-null `title_text`** (bounded by `createTextVariant`'s `count >= 4` total ceiling, `actions.ts:1047` — **not** the unrelated `:316`); assert the original variant's `title_text` equals the draft's original title (not silently dropped); assert `uploadVariant` is **never** called; ABDraftSchema `.refine` rejects 0 or 2 `'original'` tags.
- **A/B preconditions (no string→UUID resolution):** assert the publish action passes `content_pipeline.youtube_video_id` (already internal UUID) **directly** to `createAbTest` — no resolve/upsert call; the CTA-state helper, fed by the `content_pipeline ⋈ youtube_videos` join, returns disabled+correct-tooltip for (FK null) / (referenced row `thumbnail_hq_url` null) / (referenced row `duration_seconds<=60` Short).
- Pillar lookup + hub counts grouping; hub query projects `beats_count` via `jsonb_array_length` without transferring script bodies.

**(2) Component tests (Vitest + Testing Library, axe) — mirror `test/cms/blog/editor/*`:**
- Hub header: `.mod-live` renders pulsing dot + `Canal {pt} · {en}` from `CHANNELS`; "Novo Vídeo" right-aligned → `/cms/video/new`; pulse suppressed under reduced-motion.
- Stat cards: four cards, accents `--text`/`--c-pipeline`/`--warn`/`--c-links` in order.
- **VideoCard:** surface-2/border-soft/12px-radius/11–12px-padding; 3-element top row (code + colored uppercase-10px pillar pill + flags); 2-line-clamped 13.5px/600 title; **'Sem título' fallback** on blank; foot duration + `N beats`/`direção`/`sem roteiro`; hover `-2px`+shadow / press `-1px scale .992`; motion suppressed under reduced-motion.
- **PillarRail:** "Todos" + per-pillar chips with colored dot + count badge; **badge hidden when count 0 for non-Todos**; active chip filled; scroll/wrap; selecting narrows columns.
- Kanban: column bucketing, pillar filter narrows all columns, counts match; **empty column shows "Vazio"**.
- `LockedStage` render + "Marcar como gravado" unlock.
- `VidLang`: add-version creates **blank** (assert not a copy), single↔both morph, remove-version confirm.
- Roteiro: summary row shows "N beats · alvo <dur> · ~M de fala" + clock + spoken `x/total` + "Notas do editor" toggle (default OFF); `.rot-readbar` is a 3px gradient bar bound to `readPct`; **"limpar" appears only when `spoken.size>0`** and clears all marks + resets clock; empty title → 'Sem título'.
- **Focus mode:** toggling focus hides `.ed-stages` (and the published `robanner`), shows the persistent `.focus-exit` "Modo foco — clique para sair · esc" button; Esc and click exit; `.focus-exit` absent in print.
- Publicação: leader toggle, published read-only freeze (winner-only trophy, gen-button swap, contentEditable=false); CTA disabled+tooltip for each precondition (no link / no thumbnail / Short).
- Teleprompter keyboard: `Space/↓/↑` advance/mark; **ignored** when focus in contentEditable/input/textarea/button; overlay open ⇒ keys inert; Escape precedence stack.
- Empty states (idea-only Roteiro, no-beats Pós, empty column "Vazio", no-alternatives Ideia).
- a11y: `aria-pressed` on mark, focus-visible ring, breadcrumb `<button>`/`<a>`, reduced-motion suppresses entrances.

**(3) Responsive tests (component + CSS snapshot):**
- `.vhub-grid` (stat row): `repeat(4,1fr)` wide → `repeat(2,1fr)` at **≤1080px** (16px gap).
- `.vkanban`: `repeat(4,minmax(0,1fr))` wide → `repeat(2,1fr)` at **≤1280px** (14px gap).
- `.ab-grid`: `repeat(4,1fr)` wide → `repeat(2,1fr)` at **≤1240px** (canonical — assert the stale ≤1080px CSS A/B rule is NOT the active breakpoint).
- Editor canvases stay centered max-width 720–760px and go fluid below.
- `.ed-bar`/`.ed-stages` stay single-line flex with `flex-shrink` on action buttons (no wrap at mid widths).

**(4) Redirect/route-migration test — mirror `test/cms/blog/editor/route-migration.test.ts`:** every `/cms/pipeline/*` path resolves to its mapped home; **no `beforeFiles` rewrite destination references `/cms/pipeline` for ANY of {video, courses, library/research, library/reference, library/audio, up-next}** (loop test across all six, not just video); `resolvePipelineEditorTarget('video')` → `edit-video`; bridge fallback → `/cms/video/[id]/edit`; smoke test `GET /cms/video` renders the new hub (not the old board). **Format-aware `items/[id]` dispatch (§8.2a):** `GET /cms/pipeline/items/<video-id>` → `/cms/video/<id>/edit`; `<research-id>`/`<reference-id>`/`<audio-id>` → their `/cms/library/*` homes (NOT the video editor); `<course-id>` → `/cms/courses` — i.e. assert **no non-video `items/:id` lands on the video editor's `notFound()`**, proving the dispatch is per-format and not a blanket redirect.

**(5) Guard-coverage test:**
- **Reporter receives 403 from the publish ACTION itself** (not merely a hidden CTA): invoke the publish server action as a reporter (edit-own, no-publish) holding edit scope and assert it returns 403 / throws `forbidden` **before** any `stage→'published'` write — i.e. the `requireSiteScope({mode:'publish'})` gate fires, and `createAbTest`/`createTextVariant` are **never** reached (assert the ab-lab functions are not called and no `ab_tests` row is created).
- **A/B materialize is publish-gated:** the materialize action calls `requireSiteScope({mode:'publish'})` before any `getSupabaseServiceClient()`/`createAbTest`/`createTextVariant`; a reporter is rejected with 403.
- **Advance is publish-gated where it crosses a publish-equivalent transition:** a reporter invoking the advance action with a target stage of `scheduled`/`published` gets 403 (the action escalated to `mode:'publish'`); `advanceToRecorded`/marcar-gravado (target `gravacao`) passes for an editor under `mode:'edit'`.
- **No reliance on `enforce_publish_permission`:** assert (or document via a comment-test) that the guard is the server-side scope check, since the trigger neither attaches to `content_pipeline` nor checks `stage` and is bypassed for service_role.
- Section PATCH rejected when stage ≥ published; every A/B materialize / write action guarded before any `getSupabaseServiceClient()`.

---

## 11. Accessibility (testable ACs)
- Mark control = `<button aria-pressed={spoken}>`; replicate pressed state.
- Unified 2px `:focus-visible` accent ring on **all** recreated controls (incl. "Novo Vídeo", "limpar", `.focus-exit`, stat cards if interactive, pillar chips); `cursor:pointer` on every clickable **including breadcrumb buttons and `.vcard`** (real `<button>`/`<a href>`, not divs).
- Targets ≥24px; primary buttons 34–42px.
- Spoken-line dimming via `--text-faint` (not opacity) — verify AA both themes.
- Locked tabs reachable, announce locked (`aria-disabled` + visible reason).
- Teleprompter handler ignores keystrokes in editable/input/textarea/button.
- SR live-region announces autosave state + "marcado como falado".
- Reduced-motion suppresses **all** entrances + `markPop` + `.mod-live` pulse + `.vcard` hover/press + scroll smoothing; motion `animation:none` under print.

---

## 12. Responsive (testable ACs — mirrors handoff README §425-434)

Consolidated responsive contract. The handoff CSS has a **stale conflicting A/B rule** (line 425 ≤1080px vs line 524 ≤1240px); **lock 1240px for the A/B grid** (matches the README table) and ignore the ≤1080px A/B cascade.

| Element | Class | Wide | Collapse | Gap |
|---|---|---|---|---|
| Hub stat row | `.vhub-grid` | `repeat(4,1fr)` | `repeat(2,1fr)` at **≤1080px** | 16px |
| Kanban | `.vkanban` | `repeat(4,minmax(0,1fr))` | `repeat(2,1fr)` at **≤1280px** | 14px |
| A/B grid | `.ab-grid` | `repeat(4,1fr)` | `repeat(2,1fr)` at **≤1240px** (canonical) | — |
| Editor canvases | (Ideia/Roteiro/Pós) | centered max-width **720–760px** | **fluid** below max-width | — |

- `.ed-bar` / `.ed-stages` stay **single-line flex**; action buttons keep `flex-shrink` so they never wrap at mid widths.

**AC:** `.vhub-grid` collapses 4→2-up at ≤1080px (16px gap); `.vkanban` 4→2-col at ≤1280px (14px gap); `.ab-grid` 4→2-up at ≤1240px (the ≤1080px A/B CSS rule is dead and must NOT be the active breakpoint); editor canvases stay centered 720–760px and go fluid below; ed-bar/ed-stages never wrap.

---

## 13. Performance
- Memoize `lineKeys`/`lineSecs`/`videoBeatRead` (already `useMemo`). Marking a single line must **not** re-render all beats: key the `spoken` granularly (per-line memo) or use a ref-based current-line highlight; debounce scroll.
- Cap/virtualize if a script exceeds ~N lines (threshold ~300) — flagged, not required for launch (HERO has 4 beats × ~7 lines).
- **Hub query is bounded by construction (§3.7):** it selects `beats_count` via `jsonb_array_length(... #> ...)` and key-existence flags — **never the full `sections` body** — so the board payload is O(scalars per card) regardless of script size. This is a P1 launch requirement, not a deferred escape hatch. Pillar/column counts precomputed once server-side; client filter is a cheap array filter.
- Code-split overlays (`RecordingSheet`/`HandoffSheet`/`CoworkPopover`) via `dynamic(() => …, { ssr:false })` so the hub/editor bundle stays lean.
- Hub route must satisfy LHCI (`lighthouse.yml`: SEO ≥95 error, perf ≥80 warn).

---

## 14. Phasing (ordered, each independently shippable with an exit gate)

| Phase | Deliverable | Exit gate (verifiable) |
|---|---|---|
| **P0** | Schema + helpers + facade swap for `/cms/video` | `video-schemas`, `video-lifecycle`, `pillars`, `channels`, v3 `readRoteiro` (version-first), **`getSectionKey` format-required + all 9 callers (4 files) threaded** land; `FORMAT_SHARED_SECTIONS` exhaustive over the 5 Format members (compiles — no `social` key, has `newsletter`); `ideia` per-language backfill (incl. `both`) pushed; **remove `/cms/video → /cms/pipeline/video` rewrite**; nav label "Vídeos". Helper unit tests green (incl. format-aware `getSectionKey` + batch write-path); typecheck green (compile-time audit of all 9 `getSectionKey` callers passes). |
| **P1** | Hub (header + stats + pillar rail + kanban) | `.mod-live` header + "Novo Vídeo"; stat-card accents; `.vcard` anatomy; `PillarRail` chips; kanban buckets 7→4, pillar filter, counts, empty-column "Vazio"; **bounded hub query (beats_count via jsonb_array_length, no body transfer)**; responsive (stat ≤1080 / kanban ≤1280); `GET /cms/video` renders new hub (smoke test); `requireSiteScope` guard test. |
| **P2** | Editor shell + Ideia + Roteiro (teleprompter + autosave) + focus mode | Section PATCH persistence (format-aware keys); teleprompter keyboard + scroll tests; Roteiro summary row (beats·alvo·~de fala·clock·x/total·notas-off); `.rot-readbar` 3px gradient + conditional "limpar"; focus mode hides `.ed-stages`/`robanner` + `.focus-exit`; `/2.6` reading math pinned to HERO; autosave/NavigationGuard; sticky-header no-bleed AC; conflict 409 banner. |
| **P3** | Pós + Publicação + gating + Cowork wiring | Pós derive tests; LockedStage unlock + empty-column "Vazio"; ABDraft persist (one-original invariant) + publish read-only freeze; **A/B materialize: pass `content_pipeline.youtube_video_id` directly to `createAbTest` + 3× `createTextVariant` (no resolve/upsert, no `uploadVariant`) + thumbnail/Short preconditions via join + disabled-CTA tooltips**; A/B grid ≤1240; Cowork batch-section wire (format-aware); **publish + A/B-materialize actions gated by explicit `requireSiteScope({mode:'publish'})` (not `enforce_publish_permission`); reporter gets 403 from the action itself (§10(5) guard test)**. |
| **P4** | Print + Modo Gravação + HandoffSheet | Both print paths clean (paper-economy ACs); `.focus-exit` absent in print; recording sheet talent/editor layers + scale; `#{i+1}` fix; `/2.6` read estimates; reduced-motion/print suppression. |
| **P5** | Relink stragglers + library/courses/up-next graduation + format-aware `items/[id]` shim + delete `/cms/pipeline` | **All six destinations have real routes AND their inbound rewrites removed**; **format-aware `pipeline/items/[id]/route.ts` handler (§8.2a) replaces the deleted page and SURVIVES deletion** (video→`/cms/video/:id/edit`, non-video→library/courses — test asserts a research `items/:id` does NOT 404 in the video editor); `grep /cms/pipeline` = 0 in `apps/web/src` (whitelisting that one handler); route-migration test green; **rewrite-loop test across all six paths**; CI grep gate added (handler whitelisted); Cowork docs re-seeded. **Deletion is the final commit after prod soak.** |

**Coordination (parallel terminal, MEMORY):** `next.config.ts`, `cms-sections.ts`, and `sections.ts`/`items.ts` (the `getSectionKey` signature change touches 4 files / 9 sites) are merge hotspots — keep edits to small, isolated commits; **never stash/reset others' work**; rebuild packages (`npm run build:packages`) **locally only**; budget-conscious pushes (verify locally, push once). Each rewrite-removal is an atomic, reviewable commit.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Bilingual ideia split-brain** (legacy/Cowork/MCP paths write `ideia_shared` while new editor reads `ideia_pt`) | **`getSectionKey` takes a REQUIRED `format`** (compile-time forces all 9 callers across 4 files to thread it); batch/MCP/legacy-detail fetch `format`; unit test asserts video batch write → `ideia_pt`. (§3.3.2) |
| **`FORMAT_SHARED_SECTIONS` literal does not compile** (`social` not a Format; `newsletter` missing) | Literal is **exactly** the 5 Format members: `video/blog_post/newsletter/course/campaign`; `social` dropped (not a Format — the Sprint-5h package is unrelated); `newsletter:Set(['ideia'])` preserves pre-existing shared-ideia; typed `Record<Format, ReadonlySet<string>>` enforces exhaustiveness so the P0 typecheck gate fails only for the *real* caller audit. (§3.3.2) |
| **getSection vs patchSection select conflation** | Split edits: getSection (1586) already selects `format` → only MOVE the call below `.single()`; patchSection (1643) → ADD `format` to `.select('id, version, format, sections')` AND move the call below the fetch. (§3.3.2) |
| **Caller off-by-one** (audit "done" at 8, missing `tab-container.tsx:329`) | Exact count stated: **9 sites in 4 files** (items.ts:1586/1643/1995/2010; mcp/prompts.ts:315/406; pipeline-item-detail.tsx:129/150; tab-container.tsx:44/46/329) — completion is checkable, incl. the computed-lang site at 329. (§3.3.2) |
| Real `/cms/video` (and library/courses/up-next) shadowed by existing `beforeFiles` rewrite | Remove the matching rewrite in the **same commit** as each real route (P0/P5); smoke + loop test per destination. |
| **Redirect↔rewrite loop on ANY graduated path** (not just video) | Uniform atomic rule (§8.2) + loop test across all six paths. |
| Mass-renaming `/api/pipeline` breaks 30 files / registry tests | **Decision 2 prominent**: API stays. No registry/endpoint_count churn. |
| **v3 corruption via v1 step** (migrateV1toV2 only short-circuits on `===2`) | **`readRoteiro` dispatches on version FIRST**: v3 pass-through untouched, only v<3 runs the chain; (optional) patch `migrateV1toV2` to `>=2`. Idempotency test on v3. (§3.4) |
| **A/B FK assumed external string** (dead resolve/upsert step) | **`content_pipeline.youtube_video_id` IS already the internal `youtube_videos.id` UUID FK** (`content_pipeline.sql:48`) — passed **directly** to `createAbTest`; no resolve/upsert exists or is needed. (Decision #3, §3.8) |
| **A/B challenger insert under-specified** (only `createAbTest`/`uploadVariant` named) | **`createTextVariant` (`actions.ts:1018`) ×3** materializes the 3 challengers from `ABDraft.variants` (title_text ← title, metadata.visual_description ← brief); `uploadVariant` (JPEG/2MB) is **NOT used** for title-only tests. (§3.8) |
| **A/B `original_thumbnail_url NOT NULL` impossible** with title-only thumbnails | `createAbTest` derives it from the referenced `youtube_videos.thumbnail_hq_url`; materialization gated (via single join) on thumbnail present + non-Short; disabled-CTA "Sincronize a thumbnail" path. No nullable migration. (§3.8) |
| **A/B variant-count ceiling** (draft 4 vs ab-lab cap `>= 3` additional) | ABDraftSchema `.refine`: exactly one `tag==='original'` → 1 original + 3 challengers = 4 rows; unit test asserts `createTextVariant` called 3×. (§3.8) |
| `'both'` video silently one-sided after backfill | Backfill seeds BOTH `ideia_pt` and `ideia_en` for `language='both'`, each independently guarded; idempotent. (§3.3.3) |
| **Reading-clock fidelity regression** (helper `/2.5` vs hifi `/2.6`) | Video-specific `VIDEO_READ_WPS=2.6` distinct from blog's `2.5`; HERO totals pinned to prototype values in tests. (§3.4) |
| **Responsive cascade copy of stale A/B rule** (≤1080 vs ≤1240) | §12 locks A/B at **≤1240px** (matches README), declares the ≤1080px A/B CSS rule dead; stat-row ≤1080 + kanban ≤1280 consolidated with ACs. |
| **Hub large-payload regression** (full `sections` per card) | Bounded query: `jsonb_array_length` beats projection, no body transfer — P1 launch requirement, not deferred. (§3.7) |
| Legacy rich postprod data orphaned | Read-only `<LegacyPostprodFallback>`; no destructive migration. |
| `resolvePipelineEditorTarget` required-`id` breaks existing caller | `pipeline/items/[id]/page.tsx:26` updated to pass `id: item.id` (already in scope) in the same touch; lives in P5-deleted dir but compiles until then. (§8.3) |
| **Video publish has ZERO DB-level authorization** (`enforce_publish_permission` not on `content_pipeline`, gates a nonexistent `status` column, bypassed for service_role; `advancePipelineItem` uses edit-scope even into `published`) — a reporter with edit scope could invoke publish/materialize/advance directly | **Explicit server-side `requireSiteScope({mode:'publish'})` in the publish AND A/B-materialize actions, before `stage→'published'` and before `createAbTest`/`createTextVariant`**; advance escalates to `mode:'publish'` for `scheduled`/`published` targets; CTA-hide is UX only. Guard-coverage test asserts reporter 403 from the action (not a hidden button). (§9, §3.2, §10(5)) |
| Rollback after rewrite removal | **Re-add the `beforeFiles` rewrite(s) + revert nav label** = instant config-only rollback; **keep `/cms/pipeline` physically present until soak passes** (deletion is the very last commit). |
| Teleprompter scroll no-op | Ref'd container, no magic selector (§5.2). |
| Keyboard collisions | Single precedence resolver, one owner per key (§5.2). |
| **Cowork deep-links 404 post-deletion** — a blanket `/cms/pipeline/items/:id → /cms/video/:id/edit` redirect is **format-blind**: it forces research/reference/audio `items/:id` URLs into the video editor, where `notFound()` (§2) 404s them | **Surviving format-aware `items/[id]/route.ts` handler (§8.2a), NOT a static redirect** — loads `format`, dispatches video→`/cms/video/:id/edit` and non-video→`/cms/library/*`\|`/cms/courses`; this single route is excluded from the P5 `/cms/pipeline` deletion and whitelisted from the grep gate; re-seed docs; never touch `PIPELINE_COWORK_KEY`. (§8.2a, §7) |

---

## 16. Acceptance Criteria (maps to handoff DoD §436-459)
- [ ] Hub header: `.mod-live` shows pulsing dot + `Canal {pt} · {en}` from `CHANNELS`; "Novo Vídeo" right-aligned → `/cms/video/new`.
- [ ] Stat cards: Total/Em roteiro/Prontos p/ gravar/Publicados with accents `--text`/`--c-pipeline`/`--warn`/`--c-links` exactly.
- [ ] **VideoCard:** surface-2 / 1px border-soft / 12px radius / 11–12px padding; top row mono code + colored uppercase-10px pillar pill + flags; 2-line-clamped 13.5px/600 title with 'Sem título' fallback; foot duration + `N beats`/`direção`/`sem roteiro`; hover −2px+shadow / press −1px scale .992.
- [ ] **PillarRail:** "Todos" + per-pillar chips (colored dot + count badge, badge hidden when 0 for non-Todos); active filled; scroll/wrap; filter narrows all columns.
- [ ] Hub: 4 lifecycle columns (7→4 projection); pillar filter narrows all; counts match; **empty column shows "Vazio"**; hub query transfers no script bodies (beats_count projection).
- [ ] Open lands on `OPEN_AT(stage)`; Pós/Publicação locked until DB position ≥ `gravacao`, showing "Marcar como gravado".
- [ ] **Focus mode:** hides `.ed-stages` (+ published `robanner`), shows persistent `.focus-exit` "Modo foco — clique para sair · esc"; Esc/click exit; `.focus-exit` absent in print.
- [ ] `getSectionKey` is format-aware: video ideia resolves `ideia_pt`/`ideia_en` on **every** read+write path (editor, batch, Cowork/MCP, legacy detail across all 9 sites); newsletter ideia stays `ideia_shared`; video batch cowork write lands on `ideia_pt`.
- [ ] Ideia: per-language title ('Sem título' placeholder) + direction editable (write `title_<lang>` + section); "Gerar mais" appends; CTA → Roteiro.
- [ ] Roteiro: beats **#1**-indexed; each line markable (orange dot + `markPop` + dim); per-beat "x/N faladas" + green bar; summary row "N beats · alvo <dur> · ~M de fala" + clock + spoken x/total + "Notas do editor" toggle (default OFF); `.rot-readbar` (3px orange gradient, `/2.6`); "limpar" only when marks exist; `Space/↓/↑` works, never fires while editing; "Notas do editor" reveals `vis`/`ed`; breath "respira 0,5s"; sticky header below ed-bar, no bleed; empty title 'Sem título'; HERO clock matches prototype (`/2.6`).
- [ ] Script: already-v3 rows pass through `readRoteiro` untouched; v1/v2 migrate; prototype import renames `t→type` and `s→duration`.
- [ ] Pós: Entrega/Estilo editable; Momentos/B-roll derive from script (#1-indexed); CTAs flag per-language QR; Exportar prints.
- [ ] Publicação: 4 A/B cards, exactly one "original"; titles+briefs editable; leader selectable; "Sugerir títulos" fills empties; **published** → editing locked, winner-only "liderando", "títulos travados"; A/B materializes into ab-lab via **`createAbTest` (FK passed directly, seeds original) + 3× `createTextVariant`** = 4 rows (1 original + 3 challengers), `original_thumbnail_url` from synced thumbnail; CTA disabled + correct tooltip when link/thumbnail missing or Short.
- [ ] Backfill: `both` video has both `ideia_pt` and `ideia_en`; `pt-br`→`ideia_pt`; `en`→`ideia_en`; re-run no-op.
- [ ] Print clean from BOTH ⌘P (serif ink-on-white, hand-tick circles) and Modo Gravação; beats flow, no large gaps, no line/header split; `#{i+1}` everywhere.
- [ ] **Responsive:** `.vhub-grid` 4→2 ≤1080px (16px gap); `.vkanban` 4→2 ≤1280px (14px gap); `.ab-grid` 4→2 ≤1240px (NOT ≤1080); editor canvases centered 720–760px → fluid; ed-bar/ed-stages never wrap.
- [ ] Motion: pointer cursor everywhere; press feedback; staggered entrances; **all** (incl. `.mod-live` pulse + `.vcard` hover/press) suppressed under reduced-motion + print.
- [ ] No console errors; dark + light themes.
- [ ] `/cms/pipeline/*` redirects resolve; **no `beforeFiles` rewrite targets `/cms/pipeline` for any of the six graduated paths**; `grep /cms/pipeline` = 0 in `apps/web/src`.
- [ ] RBAC: reporter 403 on publish + marcar-gravado; section PATCH rejected when published; A/B materialize (`createAbTest`/`createTextVariant`) guarded before service client.

---

## 17. Open Questions (external/product only)
1. **Distribution chips** (Instagram/Bluesky/Comunidade YT/Newsletter): full wiring to `/cms/social` + schedule in P3, or ship as deep-link stubs and wire in a later sprint? (Default chosen: deep-link stubs with `source_pipeline_id` prefill.)
2. **`/cms/pipeline/brolls` + `/list`** final homes — library broll home exists? Confirm the exact library sub-route so the redirect target is correct (does not block P1–P4).
3. **`recorded_at` / `duration_range`** format — confirm free-text display strings are acceptable (no date parsing/validation) vs. structured (chosen: free-text display, no parsing).
4. **Channel-level Pós defaults** (`editorDefaults`) — site-level constant vs. an editable site setting? (Default: constant seed, per-video override persisted.)
5. **`CHANNELS` source** (§3.7a) — site-settings JSONB vs. committed constant? (Default: typed constant in `lib/pipeline/channels.ts` seeded from site settings; revisit if multi-site needs per-site channel names.)

**Files this spec creates/touches (paths):** `apps/web/src/app/cms/(authed)/video/**` (new); `apps/web/src/lib/pipeline/{video-lifecycle,pillars,channels,video-schemas,load-video-hub,load-video-detail}.ts` (new); `apps/web/src/lib/pipeline/{roteiro-schemas.ts (v3 + readRoteiro version-first),script-serializer.ts (v3),sections.ts (getSectionKey REQUIRED format + per-format shared table over the 5 Format members),services/items.ts (thread format into getSection [move call only] / patchSection [add format to select + move call] / batch 1995/2010 [add format to select]),mcp/prompts.ts (thread format at 315/406),schemas.ts (VideoMetadataSchema),editor-routing.ts (edit-video + required id)}` (edit); `apps/web/src/app/cms/(authed)/pipeline/_components/{pipeline-item-detail.tsx (129/150),detail/tab-container.tsx (44/46/329)}` (pass `format` to getSectionKey; die at P5); `apps/web/src/app/cms/(authed)/pipeline/items/[id]/page.tsx` (pass `id`, add edit-video redirect; **replaced at P5 by** `apps/web/src/app/cms/(authed)/pipeline/items/[id]/route.ts` — the format-aware deep-link shim, §8.2a, which SURVIVES the `/cms/pipeline` deletion and is whitelisted from the grep gate); `apps/web/next.config.ts` (rewrite swap for all six destinations); `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` (label); `apps/web/src/app/cms/(authed)/blog/from-pipeline/[pipelineId]/route.ts` (fallback + edit-video); one new migration via `npm run db:new video_ideia_per_language`; reuse `_shared/editor/{use-autosave,navigation-guard,autosave-indicator,read-only-overlay}.ts` and ab-lab `actions.ts` (**`createAbTest` + `createTextVariant`**, NOT `uploadVariant`) / `queries.ts` / `pipeline-picker-dialog.tsx`. **No `lib/youtube/*` resolve/upsert** — `content_pipeline.youtube_video_id` is already the internal FK; thumbnail/duration preconditions come from a single `content_pipeline ⋈ youtube_videos` join in `load-video-detail.ts`.