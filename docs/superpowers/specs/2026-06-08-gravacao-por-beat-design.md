# Gravação por beat — recording status & performer surfaces (design spec)

**Status:** approved 2026-06-08 ("C feito direito"). Source of truth for the build.
**Goal:** Let the solo creator track *what's already in the can* per recording unit, per language, durably and offline-safe; give the performer a great print + a full-screen reader; let the Cowork see/set status via API.

**Why this shape (the criterioso verdict):** A durable ledger keyed on *derived sections* scored 34/100 — sections have no stable identity, and the Cowork overwrites the whole roteiro wholesale, so a section could show `✓ Gravada` over rewritten text and the creator skips it on a remote shoot. Server-only sync also dies offline exactly where the feature must work. So: **anchor durable status on BEATS (stable identity), keep fine granularity on PAPER (free), persist local-first with opportunistic sync.** Same features as scope C, robust substrate.

---

## Locked decisions

1. **Unit of durable status = the beat.** Beats get a stable `id`; status keys on `(pipeline_id, lang, beat_id)`. Want finer recording chunks? Split a beat (user-controlled; identity stays trivial). A `fala` beat ≈ one take.
2. **3-state status:** `pendente | gravada | refazer` + optional free-text retake note (≤500 chars). Click cycles.
3. **Fine per-section tick = print only.** The printed sheet shows derived sub-sections (run of `line` items, broken at action/dir/vis/ed, NOT at pause) with a pen tick-box each. No digital identity needed — it's paper.
4. **Local-first persistence.** Writes hit IndexedDB synchronously (survives offline remote shoot), sync opportunistically to the server table. Never a synchronous per-take server write.
5. **Cowork-overwrite contract:** a roteiro write that changes a beat's content flags that beat's status as **"roteiro mudou desde a gravação"** (loud, visible) — never a silent stale `✓`. Beat removed → orphan row, surfaced for explicit purge, never silently destroyed.
6. **Honest duration:** fold explicit `pause.duration` into the estimate, use per-language wpm, render as `~Xs` labeled "leitura, sem pausas de cena". No false precision.
7. **Single counter:** `x/N beats gravados · y refazer`. The line-level "spoken" teleprompter check stays ephemeral and is demoted/hidden behind the show/hide toggle (it's the read clock, not recording status).
8. **Speech clock untouched:** `videoLineKeys` / `videoLineSecsFlat` / `cursor` / the teleprompter keyboard stay strictly line-level. Status is a purely additive layer.

## Data model

- **Schema change** (`roteiro-schemas.ts`): add optional `id: z.string().min(1).optional()` to `RoteiroBeatSchemaV3`. Back-compat (old content parses). Lazily stamped via `ensureBeatIds(content)` on roteiro save; existing videos get ids on first save (+ optional `scripts/` backfill).
- **Server table** `video_recording_status` (migration via `npm run db:new video_recording_status`):
  - cols: `id uuid pk`, `site_id uuid → sites`, `pipeline_id uuid → content_pipeline`, `lang text check(pt|en)`, `beat_id text`, `status text check(pendente|gravada|refazer) default pendente`, `retake_note text(≤500)`, `beat_name text` (display + reconciliation), `content_hash text` (detect "changed since recorded"), `source text(user|cowork|cron)`, `updated_at timestamptz`, `modified_by uuid → auth.users`.
  - `unique (pipeline_id, lang, beat_id)`; index `(site_id, pipeline_id, lang)`.
  - RLS: SELECT `public.can_view_site(site_id)`, write `public.can_edit_site(site_id)`; idempotent `drop policy if exists`. No `version` col — per-row last-write-wins + optional `if_unmodified_since`.
  - **Not** inside roteiro JSONB content (would churn the item version-lock / blocked by published-freeze).
- **Reconciliation on load:** match stored rows to current beats by `beat_id`. Same id + same `content_hash` → carry status verbatim. Same id, different hash → carry status but flag `stale` ("roteiro mudou desde a gravação"). Id gone → orphan (surface count + one-click purge, never auto-delete).

## API & Cowork

- REST under pipeline namespace (inherits `X-Pipeline-Key`): `GET /items/[id]/recording?lang=` (derive+reconcile), `PUT .../recording` (upsert one beat), `PATCH .../recording/batch`, `DELETE .../recording/orphans`. Per-row concurrency (optional `if_unmodified_since` → 412). Does NOT touch `content_pipeline.version`.
- Pipeline Integrity: register routes in `api-registry.ts` (+ `endpoint_count`), document in `cowork-docs-*.md`, add MCP `manage_recording` (parity with `manage_links`). Use permanent `PIPELINE_COWORK_KEY` — never create/revoke keys.

## Surfaces

- **Editor** (`roteiro-stage` + `roteiro-beat`): per-beat 3-state control in `.rb-head`; retake note input when `refazer`; counter `.rot-secsum`; show/hide toggle mirroring "Notas do editor" (`TOGGLE_REC_STATUS`). Status/notes lifted to context (`VideoEditorState` + reducer actions) so the reader shares them. Keep per-line `.rb-mark` for the read clock, hidden behind the toggle.
- **Recording Mode** (extend `recording-sheet.tsx`, don't replace): `view: 'sheet' | 'reader'`. Reader = one section per view, true black/white contrast (`--rp-paper:#000`), huge `--rs-scale` text (widen clamp), thumb-reachable prev/next (≥56–64px, bottom corners), set `gravada`/`refazer` post-take + auto-advance + **undo-toast** (mistap insurance), status border tint (green/amber) for peripheral legibility, idle-dim chrome. Keyboard ←/→/g/r, Escape closes. Local-first writes.
- **Print** (the primary artifact, ~70% exists in `recording-sheet-data.ts`): per derived sub-section a left tick-box + `§N` + honest `~Xs` + dotted pen-note margin; `.rs-sec { break-inside: avoid }`, beat header `break-after: avoid`; `print-color-adjust: exact` on boxes.

## Build sequence (TDD, subagent per slice, commit to staging, no push until ok)

1. **Foundation (pure, no UI):** `beat.id` schema + `ensureBeatIds` + `beatSections()` + honest `sectionReadSecs`/`beatReadSecs` (fold pause + per-lang wpm) + `nextStatus()` + `content_hash` normalizer. Unit tests first.
2. **Print first-class:** per-section tick-box/§N/duration/pen-margin/pagination in the sheet. Highest value, zero identity/connectivity risk.
3. **Editor beat-status + counter + toggle:** context state + reducer, local component state only (no server yet).
4. **Persistence:** IndexedDB local-first + migration + server table + API routes + MCP + Cowork docs + overwrite-invalidation.
5. **Recording Mode reader:** extend overlay + undo-toast + tint + a11y.

## Out of scope / separate

- Roteiro **content** quality (the `pronto/Pronto` junk) = Cowork rewrites via API (docs now enable it). Not this feature.
- Sub-beat *digital* durable identity (rejected — fragile). Fine granularity is paper + beat-splitting.
