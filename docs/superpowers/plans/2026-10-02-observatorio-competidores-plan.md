# Observatório de Competidores v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/cms/youtube/competitors` observatory with the approved v2. It shows before → after for title, thumbnail and description, measures each change's effect against what the video's age predicts, keeps every video's full history, adds age-windowed outliers and phases, turns the forja into a typed, quota-bound reading queue with frozen readings, and raises the limit to 75 channels synced every 6 h in batches.

**Architecture:** The approved mockup engine `dados.js` becomes a pure TypeScript engine in `apps/web/src/lib/youtube/observatorio/`. It is parameterised by `now` and a `Dataset`, and it has no globals. The engine is verified three ways:
1. The mockup's own suite (`dados-teste.html`, 190 assertions) runs **verbatim** against the engine's facade.
2. A parity diff compares the engine with the frozen `dados.js` oracle on the same data.
3. Hand-written TDD tests cover each rule.

The DB grows version tables, a daily views record, a channel-limit setting, typed forja tasks, frozen readings and a heartbeat. A loader turns DB rows into a `Dataset`, so screens, the pipeline API and the forja snapshot all read ONE calculation layer. The screens are new App Router routes under a shared layout that ports `chrome.js`/`chrome.css`. Each screen is checked side by side with its mockup through a Playwright fidelity harness. That harness seeds the oracle's data and freezes the clock, so the texts must match exactly.

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript 5 (strict) · Supabase Postgres 17 (migrations via `npm run db:new`) · Vitest (happy-dom/node/jsdom) · Playwright (`apps/web/e2e`) · YouTube Data API v3 · `@vercel/blob` · forja worker in Python (`~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py`, installed by the owner).

**Spec:** `docs/superpowers/specs/2026-10-02-observatorio-competidores-design.md`. Binding companions: `docs/superpowers/mockups/2026-10-02-observatorio/CONVENCOES.md` (where it diverges from the spec, its latest line wins), `BRIEF.md`, `PEDIDOS-API.md`, `DADOS.md`, `CHROME.md`, `dados.js`, `dados-teste.html`. Executors read the spec + CONVENCOES before every screen task.

---

## Global Constraints

Copied from the spec, CONVENCOES, CLAUDE.md and the owner's memory. Every task implicitly includes this section.

- **Branch/git:** work on `staging`. Never `git stash`, `git reset`, `git checkout -- <file>` or force-push. Other terminals edit in parallel. Commit **by explicit path**: `git add <paths>` then `git commit`. Before committing, `git diff --cached --name-only` must list only this task's files; if another terminal staged something, commit with `git commit -m … -- <paths>`. Never `git add -A`/`git add .`.
- **Commit message:** `tipo: descrição curta` (`feat|fix|chore|refactor|docs|test|ci`), ending with the attribution trailer:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- **Hooks:** normal pre-commit (build:packages + typecheck, ~60 s). `--no-verify` only for plan/spec commits, OR when the hook fails only on another terminal's in-progress files and this task's own change was verified and staged by explicit path (memory: feedback_no_verify_plans).
- **Migrations:** only `npm run db:new <nome>` (from repo root). Idempotent: `create table if not exists`, `add column if not exists`, `drop policy if exists` before `create policy`, `drop trigger if exists` before `create trigger`, `drop index if exists`/`create index if not exists`. **`npm run db:push:prod` only after the owner says yes in the conversation** — every migration task ends by ASKING, never pushing.
- **Packages:** this plan does not touch `packages/*/src`. If a task ever does, run `npm run build:packages` immediately.
- **Pipeline keys:** never create or revoke keys. Every new or changed forja endpoint requires only the `intelligence` scope (`authenticateIntel`), so the forja's existing narrow key needs no change. Use `PIPELINE_COWORK_KEY` from `.env.local` for manual API checks.
- **Forja machine:** only the owner writes to it. Agents may run **read-only** `ssh forja '<read cmd>'`. Worker/cron changes are prepared as short commands, **one per line**, appended to `~/Workspace/forja/LEIAME-COMANDOS.md` (one command per block) for the owner to paste. Kit changes end with `git -C ~/Workspace/forja/ferramentas commit -- <paths>`.
- **Coupled budget (CLAUDE.md):** 20 min from claim to the last site request (`ORCAMENTO_S`) < 25 min cron `timeout -k 30s 25m` < 30 min watchdog `STALE_THRESHOLD_MINUTES`; the pulse cuts at 70 min. The global queue must never lengthen one request: **one request = one type × one target**, one claim per tick.
- **No wasteful pushes:** verify locally (typecheck + the affected tests; for big batches the full `npx vitest run`, ~160 s). Push only verified work; each push = 4 Vercel builds. Before promotion to `main`: authenticated `/cms` validation per `docs/ops/runbook-cms-e2e-local.md`.
- **Tests:** Vitest; server-side code that touches sanitizers → `// @vitest-environment node`; client components → `// @vitest-environment jsdom`. Temporal fixtures relative or with fake timers (never a hardcoded future year/quarter compared with the wall clock). An env var read with a fallback gets a test that **deletes** the var and asserts the default.
- **TypeScript:** `strict`, never `any`, Zod at boundaries. Files kebab-case, interfaces `I`-prefixed **only for abstract ports** (existing code style for data shapes is plain `interface Foo`; follow `observatory-types.ts`).
- **Server actions:** writes call `requireSiteScope({area:'cms', siteId, mode:'edit'})` before `getSupabaseServiceClient()`. Admin-only actions also check the caller's `site_users.role ∈ {super_admin, org_admin}`.
- **Next 16:** never pass `next/link` (or any component imported in a Server Component) as a prop to a client component; use `src/app/cms/(authed)/_shared/cms-link.tsx`.
- **Pipeline Integrity:** a route created/deleted under `apps/web/src/app/api/pipeline/` → update `apps/web/src/lib/pipeline/api-registry.ts` (entry + `endpoint_count`) and `apps/web/data/pipeline-docs/cowork-docs-youtube.md`.
- **Text rules (CONVENCOES, verbatim, non-negotiable):**
  - pp always integer (`fmt.pp`); minus sign U+2212 `−`; age via `fmt.age` (whole days, same as the bands); numbers pt-BR ("1,5 mil", "207,6 mil", "1,9 mi", "8,2×").
  - Times always `America/Sao_Paulo`, declared once per screen as "Horários em São Paulo"; never "horário de Brasília".
  - Forja header status, the ONLY format: "na fila · pedido 14:58", "trabalhando desde 14:45", "atrasado · pedido 14:33", "sem máquina desde 12:55", "nova tentativa · 15:05", "liberado pelo vigia · 15:05", "falhou às 14:21", "recusado às 14:56", "publicado às 14:50".
  - No machine: "Seu pedido das HH:MM está na fila e roda quando a máquina voltar." (with Todos: "Seus pedidos das HH:MM (IA e Viagem) estão na fila e rodam quando a máquina voltar.").
  - Canonical engine texts, never paraphrased: `problemPhrase`, `noBaseText`, `waitText`, `since.shortText`/`text`/`textNoAsk`, `statusLines`/`statusText`, `readyText`.
  - Under the forja seal ("forja · Gemma 12B · <tipo>, <janela> · DD/MM HH:MM (SP)") only the reading's LITERAL text. Site notes go in "Do site", outside the seal.
  - "Desde então": capitalised, no final period, on its own line. Stalled channel: "até o registro diário de DD/MM HH:MM".
  - Vocabulary: "vigia" (never "watchdog" in UI), "sincronização" (never "sync"), "comparação linha a linha" (never "diff"), "dados enviados à forja" (never "snapshot"), "detectada pela mudança do arquivo da imagem" (never "ETag"), "Testar e comparar (teste A/B do YouTube)" at first mention, "Thumbnail"/"Descrição" spelled out.
  - Forja colour is teal (`#5CC3B2` dark / `#17695C` light), never orange. At most ONE filled button per view; forja-solid only in Insights, Histórico and the forja drawer.
  - Action names: "Pedir leitura à forja" / "Pedir nova leitura à forja", "Salvar no swipe file" ↔ "Salvo no swipe file", "Ver histórico do vídeo", "Abrir no YouTube", "Sincronizar concorrentes", "Adicionar canal", menu ⋯ → "Copiar pedido para o Cowork". Toasts: "Pedido enviado à forja" → "Leitura publicada"; "Salvo no swipe file"; "Tirado do swipe file"; "Pedido cancelado"; "Sincronização iniciada" → "Concorrentes sincronizados".
- **Rules (engine RULES, verbatim from `dados.js:113-126`):** outlier ≥ 2×; base fraca n < 3; effect `{afterDays 7, maxBeforeDays 7, minBeforeDays 3, minN 5, pp 10, simultHours 48}`; pattern `{minN 10, minDiff 0.3}`; attribution `{solo 0.6, second 0.2}`; theme trend `{minDelta 3, minPct 0.25}`; habit `{minCount 3, minShare 0.3, weeks 13}`; tiers `{2, 5, 10}`; testCompareMaxDays 14; staleSyncHours 24; videoLimitMax 200; **channelLimit 75** (competitors only; own channel does not occupy a slot; admin unlocks +25).
- **Age bands:** 0–7, 8–30, 31–90, 91–365, 365+ (multiplier/effect). **Outlier windows (exclusive):** 0–30, 31–90, 91–180, 181–365, mais de 1 ano, + Todos; default "Até 90 dias" = first two.
- **Out of scope** (spec §6 and §8): Instagram/other networks; competitor CTR/retention; automatic title recommendation; "Criar ideia no pipeline"; audit items S1–S6, CI, forja F1–F7 (listed in "Next" at the end).

## Review Focus

These are the input classes the spec implies but no task's happy path exercises. Each line names the test that pins it and the task that owns it.

1. **The series started on the deploy day, not on 03/10.** In production every "desde 03/10" text, `preSeries` cut and "thumbnail vista desde 03/10" must use the real `series_started_at`. If any text is hardcoded to "03/10" the site lies from day one. → Task 13 `time.test.ts` "labels follow dataset.seriesStart", Task 15 `effect.test.ts` "pre-series change says the real series start date", Task 20 `load.test.ts` case 4.
2. **A brand-new site with zero series points, zero versions and zero readings.** Every screen must render honest empty states: no `NaN`, no `undefined`, no "há −", no 0 posing as a measurement. → Task 20 `load.test.ts` case 1 (empty rows) + the `noJunkText` audit in every screen task (Tasks 22–27) + Task 27 "empty dataset" view-model test.
3. **The forja worker has not been updated yet** (old worker claims only `channel_ids`). Observatory requests would sit "na fila" forever while the heartbeat says the machine is alive. The UI must say the forja does not read observatory requests yet, and must not let the request turn "atrasado" in silence. → Task 30 `claim-capabilities.test.ts` + integration case 4, Task 31 session test, Task 35 view-model "capabilities [] → disabled".
4. **A day with no daily record** (a failed sync day, a deploy gap). The mockup's fixture has no holes; real data will. The engine reads series by position (`series[i − firstIdx]`), so a hole would silently shift every later point. The effect ratio would then read the wrong days, or crash on `ob.r`. → Task 14: `pointViews` looks points up by `idx` (Map), never by position, with the test "a hole returns null, later points keep their idx". Task 15: the guarded `ob` null branch and the "missing daily record" test.
5. **A thumbnail fingerprint changes with no visual change** (CDN re-encode). A raw ETag flip would invent a "troca" and an effect verdict. → Task 6 `thumb-fingerprint.test.ts` "ETag changed but perceptual hash equal → NOT a new version" (and the inverse).

(The fixed-clock override `OBS_NOW_OVERRIDE` must never leak into production. It is pinned by Task 20 `now.test.ts` even though it is not in this top five.)

---

## File structure (decomposition locked here)

### Engine — `apps/web/src/lib/youtube/observatorio/` (pure, no I/O, no `Date.now()`)
| File | Responsibility | Ported from `dados.js` |
|---|---|---|
| `types.ts` | `Dataset`, `ObsChannel`, `ObsVideo`, versions, `SeriesPoint`, `ObsChange`, `EffectResult`, `MultiplierResult`, `Phase`, forja types | shapes in DADOS.md |
| `rules.ts` | `RULES`, `AGE_BANDS`, `OUT_WINDOWS`, `DEFAULT_AGES`, `PHASES`, `NICHES`, `bandOf`, `winOf`, `tierOf` | 113-133, 805-812 |
| `time.ts` | `createClock(now, seriesStart, snap0)` → `date.*` (SP formatting, `ago`, `windowText`, `dur`, `snapTime`, `snapIdxAtOrAfter/Before`, `weekday`) | 20-79 |
| `fmt.ts` | `createFmt(clock)` → `num, subs, int, mult, pct, pp, dec1, plural, verVideos, age, lcfirst, labelReason` | 81-105 |
| `stats.ts` | `median`, `quant` | 109-110 |
| `series.ts` | `pointViews`, `pointTime`, `earliestIdx`, `rate`, `vpdSince`, `vpd7`, `viewsAtAge`, `periodRate`, `expectedCurve` | 555-597, 743-750, 1088-1130 |
| `text-diff.ts` | `stripUtm`, `diffLines`, `titleDiff` | 598-613, 1293-1320 |
| `changes.ts` | `deriveChanges(videos, clock)` (events, `sameWindow`, `within48h`, `revertTo`, `testCompare`, `rewriteGroup`), `changesIn`, `caveats` | 614-655, 736-741, 843-846, 1321-1330 |
| `effect.ts` | `effectAt(ctx, changeId, Lcap)` incl. `waitText`, `noBaseText`, `readyText`, `daily`, `inconclusiveKind` | 656-735 |
| `multiplier.ts` | `multiplierAt(ctx, video, t)` (same life day → band fallback, `ageAtRead`) | 752-786 |
| `outliers.ts` | `phaseOf`, `outliers(query)` (+ `orderedIds/orderedGroups`, `byAge`, `byPhase`, weak), `tabCounts`, `TAB_TITLES` | 787-857 |
| `channels.ts` | `cadence`, `channelStats` (+ `maxMultBelowMin`, `vpd7Median`, `engagement`, `growth30` rounding, `pctOutliers`), `syncLabel`, `problemPhrase`, `channelSlots`, `syncRunText` | 858-935, 1035-1058, 1966-1985 |
| `insights.ts` | `FORMULAS`, `formulasOf`, `heatmap`, `nicheStats`, `ownVsNiche`, `themeTrend`, `ownCoverage`, `analyzePatterns`, `attribution`, `patternsNow` | 137-151, 937-991, 1131-1219 |
| `forja/states.ts` | request states, `statusLabel`, `statusText`, `summarize`, `queueOrder`, `aheadNote`, `compose` | 1450-1692, 1841-1864 |
| `forja/quota.ts` | per niche+type per SP-day quota (failure/refusal don't count) | 1827-1840 |
| `forja/since.ts` | `since(reading, ctx)` → `shortText/text/textNoAsk/countsText…` | 1252-1275, 1355-1422 |
| `forja/scope.ts` | `eligibleChannels`, `preview`, `readingScope`, `timing`, `READING_TYPES` | 992-1034, 1423-1449, 1865-1915 |
| `links.ts` | route builders (`/cms/youtube/competitors/...`) with the CONVENCOES param names | 1939-1960 |
| `index.ts` | `createObservatory(dataset, opts)` → facade with the `OBS` API surface the screens and the verbatim suite use | 1985-2005 |

### Data + sync (server)
| File | Responsibility |
|---|---|
| `apps/web/src/lib/youtube/observatorio/load.ts` | DB rows → `Dataset` (server-only) |
| `apps/web/src/lib/youtube/observatorio/now.ts` | `observatoryNow()` (honours `OBS_NOW_OVERRIDE` only under `NODE_ENV==='test'`) |
| `apps/web/src/lib/youtube/thumb-fingerprint.ts` | HEAD `i.ytimg.com` ETag + perceptual-hash confirm + Blob archive |
| `apps/web/src/lib/youtube/competitor-versions.ts` | pure `reconcileVideoVersions(prev, observed, syncWindow)` |
| `apps/web/src/lib/youtube/competitor-sync.ts` | (rewrite) uses the above; description text; daily record |
| `apps/web/src/lib/youtube/competitor-sync-batch.ts` | `selectDueChannels`, `runCompetitorBatch` (cursor by `last_synced_at`) |
| `apps/web/src/lib/youtube/competitor-slots.ts` | `getChannelSlots(siteId)` → `{used, limit, free}` |
| `apps/web/src/app/api/cron/sync-youtube/route.ts` | competitors branch → batch |
| `apps/web/src/app/api/cron/ab-watchdog/route.ts` | stop pruning `competitor_changes` |

### Screens — `apps/web/src/app/cms/(authed)/youtube/competitors/`
| Path | Mockup |
|---|---|
| `layout.tsx`, `_chrome/*` (`observatory-chrome.tsx`, `chrome.css`, `forja-status.tsx`, `freshness.tsx`, `tabs.tsx`, `niche-bar.tsx`, `forja-drawer.tsx`) | `chrome.js`/`chrome.css`/`moldura-forja.html` |
| `page.tsx` + `_canais/*` | `canais.html` |
| `mudancas/page.tsx` + `_mudancas/*` | `mudancas.html` |
| `outliers/page.tsx` + `_outliers/*` | `outliers.html` |
| `video/[id]/page.tsx` + `_historico/*` | `historico-video.html` |
| `insights/page.tsx` + `_insights/*` | `insights.html` |
| `actions.ts` (+ `forja-actions.ts`, `niche-actions.ts`, `slots-actions.ts`) | server actions |

### Forja queue + pipeline API
| File | Responsibility |
|---|---|
| `apps/web/src/lib/pipeline/services/forja-queue.ts` | ask/cancel/claim(types)/refuse/complete + heartbeat |
| `apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts` | + optional `task_types`, heartbeat |
| `apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts` | + `refuse` |
| `apps/web/src/app/api/pipeline/youtube/competitors/readings/route.ts` (new) | `GET ?task_id=` (data sent to the forja) · `POST` (frozen reading) |
| `apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts` | observatory types: release → back to queue (attempt n of 3) |

### Tests
| Path | What |
|---|---|
| `apps/web/test/fixtures/observatorio/{dados.cjs,dados-teste.html,README.md}` | frozen oracle (copied, never edited) |
| `apps/web/test/youtube/observatorio/oracle.ts` | load oracle, `datasetFromOracle()`, `runMockupSuite(facade)` |
| `apps/web/test/youtube/observatorio/*.test.ts` | unit + parity + verbatim suite |
| `apps/web/test/youtube/observatorio/audits.ts` | DOM audits (contrast AA, targets ≥ 32 px, no overflow at 768, no junk text, equal card heights, link N = destination N, one filled button) |
| `apps/web/e2e/tests/cms/observatorio/*.spec.ts` | fidelity: mockup vs implementation, 2 viewports × 2 themes × every mockup state |
| `apps/web/e2e/fixtures/observatorio-seed.ts` | seeds the oracle dataset + forja scenarios into the local DB |

---

## How to run things (used by every task)

```bash
# unit tests (from repo root)
cd apps/web && npx vitest run test/youtube/observatorio/<file>.test.ts
# typecheck web
cd apps/web && npx tsc --noEmit
# full suite before a push batch (~160 s)
cd apps/web && npx vitest run
# local DB
npm run db:start && npm run db:reset && npm run db:env
# DB-gated tests
cd apps/web && HAS_LOCAL_DB=1 npx vitest run <file>
# e2e (needs local DB + api, see runbook-cms-e2e-local.md)
cd apps/web && npx playwright test e2e/tests/cms/observatorio/<file>.spec.ts
# mockups
cd docs/superpowers/mockups/2026-10-02-observatorio && python3 -m http.server 8800
```

---
# Phase P0 — Spikes (throwaway code, committed findings)

The spike scripts live in the session scratchpad and are **not** committed. Only the findings document is committed: `docs/superpowers/plans/2026-10-02-observatorio-spikes.md`. Tasks 6 and 9 read their decisions from it.

### Task 1: Spike — is the `i.ytimg.com` ETag a usable thumbnail fingerprint?

**Files:**
- Create (throwaway, NOT committed): `$SCRATCH/spike-etag.mjs` (`$SCRATCH` = the session scratchpad dir)
- Create: `docs/superpowers/plans/2026-10-02-observatorio-spikes.md` (section "S1 — thumbnail fingerprint")

**Interfaces:**
- Produces: decision `FINGERPRINT = 'etag+dhash' | 'dhash'`, the image variant to use (`maxresdefault` | `hqdefault` | `mqdefault`), whether `Last-Modified` gives the upload minute (→ `precision: 'min'` allowed or not), and the observed false-flip rate. Tasks 6 and 9 consume these.

Ground truth: the owner's own A/B Lab rotates thumbnails on schedule (`ab_tests` with `status='active'`, cycles in `ab_test_cycles`). Rotation instants are known exactly, so they show whether ETag/Last-Modified/dHash change exactly then and only then.

- [ ] **Step 1: Collect video ids (read-only, local service key)**

```bash
cd apps/web && set -a && source .env.local && set +a && node -e '
const { createClient } = require("@supabase/supabase-js");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const ab = await s.from("ab_tests").select("id, youtube_videos!inner(youtube_video_id)").eq("status","active");
  const comp = await s.from("competitor_videos").select("video_id").order("published_at",{ascending:false}).limit(60);
  console.log(JSON.stringify({ ab: (ab.data??[]).map(r=>r.youtube_videos.youtube_video_id), comp: (comp.data??[]).map(r=>r.video_id) }));
})();' > "$SCRATCH/spike-ids.json"
```
Expected: JSON with ≥ 1 A/B id (if 0, use the competitor `nomade-raiz`-like channel that runs "Testar e comparar"; note it in the findings).

- [ ] **Step 2: Write the probe** (`$SCRATCH/spike-etag.mjs`)

```js
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(process.env.REPO + '/apps/web/package.json') // resolve sharp from the repo
const sharp = require('sharp')
const ids = JSON.parse(fs.readFileSync(process.env.SCRATCH + '/spike-ids.json', 'utf8'))
const VARIANTS = ['maxresdefault', 'hqdefault', 'mqdefault']
async function dhash(buf) {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0'
  return BigInt('0b' + bits).toString(16).padStart(16, '0')
}
const out = []
for (const id of [...ids.ab, ...ids.comp]) for (const v of VARIANTS) {
  const url = `https://i.ytimg.com/vi/${id}/${v}.jpg`
  const head = await fetch(url, { method: 'HEAD' })
  const get = head.ok ? await fetch(url) : null
  const buf = get ? Buffer.from(await get.arrayBuffer()) : null
  out.push({ at: new Date().toISOString(), id, v, ab: ids.ab.includes(id), status: head.status,
    etag: head.headers.get('etag'), lastModified: head.headers.get('last-modified'),
    length: head.headers.get('content-length'), dhash: buf ? await dhash(buf) : null })
}
fs.appendFileSync(process.env.SCRATCH + '/spike-etag.jsonl', out.map(o => JSON.stringify(o)).join('\n') + '\n')
console.log(out.length, 'rows')
```

- [ ] **Step 3: Run it at T0, then again after each A/B rotation and at T+6 h and T+24 h**

Run: `SCRATCH=$SCRATCH REPO=$(git rev-parse --show-toplevel) node $SCRATCH/spike-etag.mjs`
Expected: `N rows` per run. Get the rotation instants from `ab_test_cycles.started_at` for the A/B videos.

- [ ] **Step 4: Analyse and write the findings**

For each `(id, variant)`, list the distinct `etag`, `lastModified` and `dhash` across the runs. Fill this table in `2026-10-02-observatorio-spikes.md`:

```markdown
## S1 — thumbnail fingerprint (runs: T0 … T+24 h)
| question | answer | evidence |
|---|---|---|
| ETag changes on every A/B rotation? | yes/no | n rotations, n ETag flips |
| ETag changes WITHOUT a rotation (false flip)? | k of N video-days | ids |
| dHash Hamming distance on a real rotation (min) | d | |
| dHash distance on a false ETag flip (max) | d | |
| Last-Modified = rotation minute (± min)? | yes/no | deltas |
| variant with 200 for every video | hqdefault/… | maxres 404 count |
**Decision:** FINGERPRINT = … · VARIANT = … · DHASH_MAX_SAME = … · precision 'min' from Last-Modified: allowed/not.
```

Decision rule:
- `etag+dhash` if ETag flips on every rotation. A version change is then recorded only when the ETag changed AND the dHash distance is > `DHASH_MAX_SAME` (= the max distance seen on false flips + 2).
- `dhash` alone if the ETag misses rotations.
- Without a reliable `Last-Modified`, thumbnail precision is the sync window (`6h`), not `min`. CONVENCOES "thumbnail com minuto" then becomes a spec deviation to raise with the owner.

- [ ] **Step 5: Commit the findings only**

```bash
git add docs/superpowers/plans/2026-10-02-observatorio-spikes.md
git commit --no-verify -m "docs: spike S1 — fingerprint de thumbnail pelo arquivo da imagem

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Spike — real YouTube Data API cost and wall time per channel sync

**Files:**
- Create (throwaway): `$SCRATCH/spike-quota.ts`
- Modify: `docs/superpowers/plans/2026-10-02-observatorio-spikes.md` (section "S2 — cost and time")

**Interfaces:**
- Produces: `UNITS_PER_CHANNEL_6H` (median, p90), `UNITS_DAILY_RECORD` (the extra cost of the 12:00 record for all tracked videos), `SECONDS_PER_CHANNEL` (p90), `BATCH_SIZE` and the cron cadence (Task 9), and the daily total for 75 channels.

- [ ] **Step 1: Write the probe**

The probe wraps `fetch` to count calls per endpoint, then runs the CURRENT `syncCompetitorChannel` against 5 real channels (2 with `video_limit=200`) on a **local** DB seeded with those channels. Prod is never written.

```ts
// $SCRATCH/spike-quota.ts — run with: cd apps/web && npx tsx --env-file=.env.local-db $SCRATCH/spike-quota.ts
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
const COST: Record<string, number> = { channels: 1, playlistItems: 1, videos: 1, search: 100 }
const calls: string[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = String(input); const m = u.match(/youtube\/v3\/(\w+)/); if (m) calls.push(m[1]!)
  return realFetch(input, init)
}) as typeof fetch
const sb = getSupabaseServiceClient()
const { data: chans } = await sb.from('competitor_channels').select('id, channel_id, site_id, video_limit').limit(5)
for (const ch of chans ?? []) {
  for (const pass of ['first', 'incremental']) {
    calls.length = 0; const t0 = performance.now()
    await syncCompetitorChannel(ch, process.env.YOUTUBE_API_KEY!)
    const units = calls.reduce((s, c) => s + (COST[c] ?? 1), 0)
    console.log(JSON.stringify({ ch: ch.channel_id, limit: ch.video_limit, pass, units, calls: calls.length, seconds: ((performance.now() - t0) / 1000).toFixed(1) }))
  }
}
```

- [ ] **Step 2: Seed 5 real channel ids into the local DB and run**

Run: `npm run db:start` then insert 5 rows into local `competitor_channels` (ids taken from prod read-only: `select channel_id, video_limit from competitor_channels limit 5`), then run the probe twice (`first`, `incremental`).
Expected: one JSON line per channel × pass.

- [ ] **Step 3: Compute the daily record cost**

Daily record = `ceil(tracked/50)` `videos.list` calls (part `statistics,snippet,contentDetails`) per channel. Compute it for `video_limit` 50 and 200.

- [ ] **Step 4: Write findings and the decisions**

```markdown
## S2 — Data API cost and time (5 channels, local DB)
| pass | units median | units p90 | seconds p90 |
|---|---|---|---|
| first (backfill) | | | |
| incremental 6 h | | | |
| daily 12:00 record (+) | | | |
75 channels × 4 syncs/day + 1 daily record each = … units/day (quota 10 000).
**Decision:** BATCH_SIZE = floor(200 s / seconds p90) capped at 15 · cron `*/20 * * * *` (3 runs/h × 6 h = 18 runs per slot ≥ ceil(75 / BATCH_SIZE)) · change detection on every sync only for videos < 90 d; older videos checked once per day (spec §7).
```
If the units/day exceed 6 000, set `video_limit` daily-record coverage to 1×/day only and say so.

- [ ] **Step 5: Commit the findings**

```bash
git add docs/superpowers/plans/2026-10-02-observatorio-spikes.md
git commit --no-verify -m "docs: spike S2 — custo e tempo da sincronização por canal

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Phase P1 — Data + sync

P1 ships on its own: the current UI keeps working (only columns and tables are added), and the sync starts collecting versions, description text, thumbnails and the daily record.

### Task 3: Migration — channels (niche, sync health), settings (limit, series start), user niche preference

**Files:**
- Create: `supabase/migrations/<ts>_observatorio_canais.sql` (via `npm run db:new observatorio_canais`)
- Test: `apps/web/test/integration/observatorio-canais-migration.test.ts`

**Interfaces:**
- Produces:
  - `competitor_channels.niche` (`'viagem'|'ia'|null`), `.last_ok_synced_at timestamptz`, `.sync_error_since timestamptz`
  - table `competitor_settings(site_id pk, channel_limit int default 75, series_started_at timestamptz, updated_by uuid, updated_at)`
  - table `competitor_user_prefs(user_id, site_id, niche 'todos'|'viagem'|'ia')`

- [ ] **Step 1: Write the failing DB-gated test**

```ts
// apps/web/test/integration/observatorio-canais-migration.test.ts
import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('migration observatorio_canais', () => {
  const sb = getSupabaseServiceClient()
  it('competitor_channels has niche, last_ok_synced_at, sync_error_since', async () => {
    const { error } = await sb.from('competitor_channels').select('niche, last_ok_synced_at, sync_error_since').limit(1)
    expect(error).toBeNull()
  })
  it('niche rejects unknown values', async () => {
    const { data: site } = await sb.from('sites').select('id').limit(1).single()
    const { error } = await sb.from('competitor_channels').insert({ site_id: site!.id, channel_id: 'UCnichetest', niche: 'culinaria' })
    expect(error?.message).toMatch(/check/i)
  })
  it('competitor_settings defaults channel_limit to 75', async () => {
    const { data: site } = await sb.from('sites').select('id').limit(1).single()
    await sb.from('competitor_settings').delete().eq('site_id', site!.id)
    const { data, error } = await sb.from('competitor_settings').insert({ site_id: site!.id }).select('channel_limit').single()
    expect(error).toBeNull()
    expect(data!.channel_limit).toBe(75)
  })
  it('competitor_user_prefs accepts todos|viagem|ia only', async () => {
    const { error } = await sb.from('competitor_user_prefs').insert({ user_id: '00000000-0000-0000-0000-000000000001', site_id: (await sb.from('sites').select('id').limit(1).single()).data!.id, niche: 'x' })
    expect(error?.message).toMatch(/check/i)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run db:start && cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-canais-migration.test.ts`
Expected: FAIL (`column competitor_channels.niche does not exist`).

- [ ] **Step 3: Create and write the migration**

Run: `npm run db:new observatorio_canais`, then write:

```sql
-- Observatório v2 — canais: nicho, saúde da sincronização, limite por site, nicho por usuário.
-- Idempotente. Não apaga nem reescreve dados.

alter table competitor_channels
  add column if not exists niche text,
  add column if not exists last_ok_synced_at timestamptz,
  add column if not exists sync_error_since timestamptz;

alter table competitor_channels drop constraint if exists competitor_channels_niche_check;
alter table competitor_channels add constraint competitor_channels_niche_check
  check (niche is null or niche in ('viagem', 'ia'));

-- last_synced_at era gravado no INÍCIO da sincronização; o "último sucesso" passa a ter coluna própria.
update competitor_channels set last_ok_synced_at = last_synced_at
  where last_ok_synced_at is null and sync_status = 'idle';

create index if not exists idx_competitor_channels_sync_cursor
  on competitor_channels (site_id, last_synced_at nulls first);

create table if not exists competitor_settings (
  site_id uuid primary key references sites(id) on delete cascade,
  channel_limit integer not null default 75 check (channel_limit between 1 and 500),
  series_started_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table competitor_settings enable row level security;
drop policy if exists "competitor_settings_select" on competitor_settings;
create policy "competitor_settings_select" on competitor_settings
  for select using (public.can_view_site(site_id));

create table if not exists competitor_user_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  niche text not null default 'todos' check (niche in ('todos', 'viagem', 'ia')),
  updated_at timestamptz not null default now(),
  primary key (user_id, site_id)
);
alter table competitor_user_prefs enable row level security;
drop policy if exists "competitor_user_prefs_own" on competitor_user_prefs;
create policy "competitor_user_prefs_own" on competitor_user_prefs
  for all using (user_id = auth.uid() and public.can_view_site(site_id))
  with check (user_id = auth.uid() and public.can_view_site(site_id));
```

- [ ] **Step 4: Apply locally, regenerate types, run the test**

Run: `npm run db:reset && npm run db:types 2>/dev/null || (cd apps/web && npx supabase gen types typescript --local > src/types/database.types.ts)` then `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-canais-migration.test.ts`
Expected: PASS (4 tests).
(If `npm run db:types` does not exist, the second command is the fallback. Confirm which one the repo uses with `grep -n "db:types\|gen types" package.json` and keep it.)

- [ ] **Step 5: Commit, then ASK before prod**

```bash
git add supabase/migrations/*_observatorio_canais.sql apps/web/src/types/database.types.ts apps/web/test/integration/observatorio-canais-migration.test.ts
git commit -m "feat: observatório — nicho por canal, saúde da sincronização, limite por site e nicho por usuário

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
Then tell the owner: "Migration `observatorio_canais` is ready. Should I run `npm run db:push:prod`?" Do NOT push without a yes.

### Task 4: Migration — video versions, daily record, change windows

**Files:**
- Create: `supabase/migrations/<ts>_observatorio_versoes.sql` (via `npm run db:new observatorio_versoes`)
- Test: `apps/web/test/integration/observatorio-versoes-migration.test.ts`

**Interfaces:**
- Produces:
  - `competitor_video_versions(id, video_id, field 'title'|'thumb'|'desc', value_text, value_hash, has_text, thumb_etag, thumb_dhash, thumb_blob_url, thumb_last_modified, first_seen_at, last_seen_at, window_start, precision 'min'|'6h'|'1d'|'first', is_current)`, at most one current version per (video, field)
  - `competitor_video_daily(video_id, snap_date, views, likes, comments, taken_at)`, primary key (video_id, snap_date)
  - `competitor_changes.{from_version_id, to_version_id, window_start, window_end, precision}`

- [ ] **Step 1: Write the failing DB-gated test**

```ts
// apps/web/test/integration/observatorio-versoes-migration.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('migration observatorio_versoes', () => {
  const sb = getSupabaseServiceClient()
  let videoId = ''
  beforeAll(async () => {
    const { data: site } = await sb.from('sites').select('id').limit(1).single()
    const { data: ch } = await sb.from('competitor_channels').upsert({ site_id: site!.id, channel_id: 'UCversoes' }, { onConflict: 'site_id,channel_id' }).select('id').single()
    const { data: v } = await sb.from('competitor_videos').upsert({ competitor_channel_id: ch!.id, video_id: 'vidversoes1' }, { onConflict: 'competitor_channel_id,video_id' }).select('id').single()
    videoId = v!.id
    await sb.from('competitor_video_versions').delete().eq('video_id', videoId)
  })
  it('allows only one current version per (video, field)', async () => {
    const base = { video_id: videoId, field: 'title', value_text: 'A', value_hash: 'a', first_seen_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), precision: 'first', is_current: true }
    expect((await sb.from('competitor_video_versions').insert(base)).error).toBeNull()
    const dup = await sb.from('competitor_video_versions').insert({ ...base, value_text: 'B', value_hash: 'b' })
    expect(dup.error?.message).toMatch(/duplicate|unique/i)
  })
  it('daily record is unique per (video, date)', async () => {
    const row = { video_id: videoId, snap_date: '2026-10-03', views: 10, taken_at: new Date().toISOString() }
    await sb.from('competitor_video_daily').delete().eq('video_id', videoId)
    expect((await sb.from('competitor_video_daily').insert(row)).error).toBeNull()
    expect((await sb.from('competitor_video_daily').insert(row)).error?.message).toMatch(/duplicate|unique/i)
  })
  it('competitor_changes has version and window columns', async () => {
    const { error } = await sb.from('competitor_changes').select('from_version_id, to_version_id, window_start, window_end, precision').limit(1)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-versoes-migration.test.ts`
Expected: FAIL (`relation "competitor_video_versions" does not exist`).

- [ ] **Step 3: Create and write the migration**

Run: `npm run db:new observatorio_versoes`, then:

```sql
-- Observatório v2 — versões de título/thumbnail/descrição, registro diário de views por vídeo,
-- janela de cada troca. Histórico NÃO é podado (o ab-watchdog deixa de apagar competitor_changes).

create table if not exists competitor_video_versions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references competitor_videos(id) on delete cascade,
  field text not null check (field in ('title', 'thumb', 'desc')),
  value_text text,
  value_hash text not null,
  has_text boolean not null default true,
  thumb_etag text,
  thumb_dhash text,
  thumb_blob_url text,
  thumb_last_modified timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,
  precision text not null check (precision in ('min', '6h', '1d', 'first')),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_cvv_one_current
  on competitor_video_versions (video_id, field) where is_current;
create index if not exists idx_cvv_video_field_seen
  on competitor_video_versions (video_id, field, first_seen_at);

create table if not exists competitor_video_daily (
  video_id uuid not null references competitor_videos(id) on delete cascade,
  snap_date date not null,
  views bigint not null,
  likes bigint,
  comments bigint,
  taken_at timestamptz not null,
  primary key (video_id, snap_date)
);
create index if not exists idx_cvd_date on competitor_video_daily (snap_date);

alter table competitor_changes
  add column if not exists from_version_id uuid references competitor_video_versions(id) on delete set null,
  add column if not exists to_version_id uuid references competitor_video_versions(id) on delete set null,
  add column if not exists window_start timestamptz,
  add column if not exists window_end timestamptz,
  add column if not exists precision text;
alter table competitor_changes drop constraint if exists competitor_changes_precision_check;
alter table competitor_changes add constraint competitor_changes_precision_check
  check (precision is null or precision in ('min', '6h', '1d'));

alter table competitor_video_versions enable row level security;
drop policy if exists "competitor_video_versions_select" on competitor_video_versions;
create policy "competitor_video_versions_select" on competitor_video_versions for select
  using (exists (select 1 from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id
                 where v.id = video_id and public.can_view_site(c.site_id)));

alter table competitor_video_daily enable row level security;
drop policy if exists "competitor_video_daily_select" on competitor_video_daily;
create policy "competitor_video_daily_select" on competitor_video_daily for select
  using (exists (select 1 from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id
                 where v.id = video_id and public.can_view_site(c.site_id)));
```

- [ ] **Step 4: Apply, regenerate types, run**

Run: `npm run db:reset`, regenerate `database.types.ts` (same command as Task 3), then `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-versoes-migration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit, then ASK before prod**

```bash
git add supabase/migrations/*_observatorio_versoes.sql apps/web/src/types/database.types.ts apps/web/test/integration/observatorio-versoes-migration.test.ts
git commit -m "feat: observatório — versões por vídeo, registro diário de views e janela das trocas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
Ask: "Migration `observatorio_versoes` is ready. `npm run db:push:prod`?"

### Task 5: Keep change history — stop the 90-day prune

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-watchdog/route.ts:189-196`
- Test: `apps/web/test/cron/ab-watchdog-competitor-history.test.ts`

**Interfaces:**
- Consumes: nothing new. Produces: `competitor_changes` is never deleted by any cron. `competitor_channel_snapshots` keeps its 365-day prune (it is granular, spec D3).

- [ ] **Step 1: Write the failing test**

Look at how `test/ab-cron-watchdog.test.ts` mocks the service client (`vi.mock('@/lib/supabase/service', …)`) and reuse that mock builder. The new test asserts that no `.from('competitor_changes')` call is followed by `.delete()`:

```ts
// apps/web/test/cron/ab-watchdog-competitor-history.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const deletes: string[] = []
function chain(table: string): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'lt', 'gt', 'in', 'is', 'order', 'limit', 'update', 'insert', 'upsert', 'maybeSingle', 'single']) c[m] = vi.fn(self)
  c.delete = vi.fn(() => { deletes.push(table); return c })
  c.then = (r: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(r)
  return c
}
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => chain(t), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }) }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))

describe('ab-watchdog keeps competitor change history', () => {
  beforeEach(() => { deletes.length = 0; process.env.CRON_SECRET = 's' })
  it('never deletes competitor_changes', async () => {
    const { GET } = await import('@/app/api/cron/ab-watchdog/route')
    await GET(new Request('http://x/api/cron/ab-watchdog', { headers: { authorization: 'Bearer s' } }) as never)
    expect(deletes).not.toContain('competitor_changes')
    expect(deletes).toContain('competitor_channel_snapshots')
  })
})
```
(If the route exports `POST` instead of `GET`, or needs other mocks, copy them from `test/ab-cron-watchdog.test.ts`; the assertion stays the same.)

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/web && npx vitest run test/cron/ab-watchdog-competitor-history.test.ts`
Expected: FAIL — `deletes` contains `competitor_changes`.

- [ ] **Step 3: Remove the prune block**

Delete lines 189-196 (`// Prune old competitor changes (90-day retention)` through `if (competitorPruneError) …`) and add in their place:

```ts
    // competitor_changes is the observatory's history (Histórico por vídeo depends on it):
    // never pruned. Only granular channel snapshots below have a retention window.
```

- [ ] **Step 4: Run the test and the existing watchdog tests**

Run: `cd apps/web && npx vitest run test/cron/ab-watchdog-competitor-history.test.ts test/ab-cron-watchdog.test.ts test/ab-watchdog-drift.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/ab-watchdog/route.ts apps/web/test/cron/ab-watchdog-competitor-history.test.ts
git commit -m "fix: o histórico de trocas dos concorrentes deixa de ser apagado após 90 dias

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 6: Thumbnail fingerprint + archive

**Files:**
- Create: `apps/web/src/lib/youtube/thumb-fingerprint.ts`
- Test: `apps/web/test/youtube/thumb-fingerprint.test.ts`

**Interfaces:**
- Consumes: S1 decisions (`FINGERPRINT`, `VARIANT`, `DHASH_MAX_SAME`, `LAST_MODIFIED_MINUTE`).
- Produces:
```ts
export interface ThumbProbe { etag: string | null; lastModified: string | null; dhash: string | null; bytes: Buffer | null; url: string }
export interface ThumbPrev { etag: string | null; dhash: string | null }
export function thumbUrl(youtubeId: string): string
export async function probeThumb(youtubeId: string, prev: ThumbPrev | null, f?: typeof fetch): Promise<ThumbProbe>
export function isNewThumb(prev: ThumbPrev | null, probe: ThumbProbe): boolean
export function hamming(a: string, b: string): number
export async function dhashOf(bytes: Buffer): Promise<string>
export async function archiveThumb(videoUuid: string, probe: ThumbProbe): Promise<string | null> // Blob URL
export const DHASH_MAX_SAME: number
```

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment node
// apps/web/test/youtube/thumb-fingerprint.test.ts
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { isNewThumb, hamming, dhashOf, probeThumb, DHASH_MAX_SAME } from '@/lib/youtube/thumb-fingerprint'

async function png(color: [number, number, number], stripe = false): Promise<Buffer> {
  const img = sharp({ create: { width: 64, height: 36, channels: 3, background: { r: color[0], g: color[1], b: color[2] } } })
  return stripe
    ? img.composite([{ input: { create: { width: 32, height: 36, channels: 3, background: { r: 255, g: 255, b: 255 } } }, left: 0, top: 0 }]).png().toBuffer()
    : img.png().toBuffer()
}

describe('thumb fingerprint', () => {
  it('hamming counts differing hex bits', () => {
    expect(hamming('0000000000000000', '0000000000000003')).toBe(2)
  })
  it('first observation is always a new version', () => {
    expect(isNewThumb(null, { etag: 'a', lastModified: null, dhash: 'ff', bytes: null, url: 'u' })).toBe(true)
  })
  it('ETag changed but perceptual hash equal → NOT a new version (CDN re-encode)', () => {
    expect(isNewThumb({ etag: 'a', dhash: '00ff00ff00ff00ff' }, { etag: 'b', lastModified: null, dhash: '00ff00ff00ff00ff', bytes: null, url: 'u' })).toBe(false)
  })
  it('ETag changed and image changed → new version', () => {
    expect(isNewThumb({ etag: 'a', dhash: '0000000000000000' }, { etag: 'b', lastModified: null, dhash: 'ffffffffffffffff', bytes: null, url: 'u' })).toBe(true)
  })
  it('ETag unchanged → no download needed and no new version', async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => new Response(null, { status: 200, headers: { etag: '"a"' } }))
    const p = await probeThumb('abc', { etag: '"a"', dhash: '00' }, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1) // HEAD only
    expect(isNewThumb({ etag: '"a"', dhash: '00' }, p)).toBe(false)
  })
  it('dhash distinguishes different images and matches identical ones', async () => {
    const a = await dhashOf(await png([20, 20, 20], true)), b = await dhashOf(await png([20, 20, 20], true)), c = await dhashOf(await png([20, 20, 20]))
    expect(hamming(a, b)).toBe(0)
    expect(hamming(a, c)).toBeGreaterThan(DHASH_MAX_SAME)
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/web && npx vitest run test/youtube/thumb-fingerprint.test.ts`
Expected: FAIL (`Cannot find module '@/lib/youtube/thumb-fingerprint'`).

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/youtube/thumb-fingerprint.ts
import sharp from 'sharp'
import { put } from '@vercel/blob'

/** From spike S1 (docs/superpowers/plans/2026-10-02-observatorio-spikes.md). */
const VARIANT = 'hqdefault' // replace with S1's VARIANT
export const DHASH_MAX_SAME = 6 // replace with S1's DHASH_MAX_SAME

export interface ThumbProbe { etag: string | null; lastModified: string | null; dhash: string | null; bytes: Buffer | null; url: string }
export interface ThumbPrev { etag: string | null; dhash: string | null }

export function thumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/${VARIANT}.jpg`
}

export function hamming(a: string, b: string): number {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0
  while (x) { n += Number(x & 1n); x >>= 1n }
  return n
}

export async function dhashOf(bytes: Buffer): Promise<string> {
  const px = await sharp(bytes).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let v = 0n
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) v = (v << 1n) | (px[y * 9 + x]! > px[y * 9 + x + 1]! ? 1n : 0n)
  return v.toString(16).padStart(16, '0')
}

/** HEAD first; downloads the image only when the ETag moved (or there is no previous one). */
export async function probeThumb(youtubeId: string, prev: ThumbPrev | null, f: typeof fetch = fetch): Promise<ThumbProbe> {
  const url = thumbUrl(youtubeId)
  const head = await f(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })
  const etag = head.headers.get('etag'), lastModified = head.headers.get('last-modified')
  if (!head.ok) return { etag: null, lastModified: null, dhash: null, bytes: null, url }
  if (prev && prev.etag && etag === prev.etag) return { etag, lastModified, dhash: prev.dhash, bytes: null, url }
  const get = await f(url, { signal: AbortSignal.timeout(15_000) })
  if (!get.ok) return { etag, lastModified, dhash: null, bytes: null, url }
  const bytes = Buffer.from(await get.arrayBuffer())
  return { etag, lastModified, dhash: await dhashOf(bytes), bytes, url }
}

/** A new version needs the image to look different, not just a new ETag (spec §7 risk). */
export function isNewThumb(prev: ThumbPrev | null, probe: ThumbProbe): boolean {
  if (!prev) return probe.etag !== null || probe.dhash !== null
  if (probe.etag !== null && probe.etag === prev.etag) return false
  if (!probe.dhash || !prev.dhash) return false // cannot confirm → never invent a change
  return hamming(prev.dhash, probe.dhash) > DHASH_MAX_SAME
}

export async function archiveThumb(videoUuid: string, probe: ThumbProbe): Promise<string | null> {
  if (!probe.bytes || !probe.dhash) return null
  const blob = await put(`observatorio/thumbs/${videoUuid}/${probe.dhash}.jpg`, probe.bytes, {
    access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true,
  })
  return blob.url
}
```
Set `VARIANT`/`DHASH_MAX_SAME` to the S1 values. If S1 chose `dhash` alone, change `probeThumb` to always download, and `isNewThumb` to ignore the ETag. The tests on ETag-unchanged then flip: update them in this same commit, and record the decision in the commit message.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/youtube/thumb-fingerprint.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/thumb-fingerprint.ts apps/web/test/youtube/thumb-fingerprint.test.ts
git commit -m "feat: thumbnail de concorrente detectada pela mudança do arquivo da imagem, confirmada por hash perceptual

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 7: Version reconciliation (pure)

**Files:**
- Create: `apps/web/src/lib/youtube/competitor-versions.ts`
- Test: `apps/web/test/youtube/competitor-versions.test.ts`

**Interfaces:**
- Consumes: `isNewThumb`, `ThumbProbe` (Task 6).
- Produces:
```ts
export type VersionField = 'title' | 'thumb' | 'desc'
export interface StoredVersion { id: string; field: VersionField; value_hash: string; thumb_etag: string | null; thumb_dhash: string | null; first_seen_at: string; last_seen_at: string }
export interface ObservedVideo { title: string; description: string; thumb: ThumbProbe | null }
export interface SyncWindow { prevOkAt: string | null; now: string }
export interface VersionPlan {
  touch: string[]                                   // ids whose last_seen_at := now
  close: string[]                                   // ids whose is_current := false
  open: Array<{ field: VersionField; value_text: string | null; value_hash: string; has_text: boolean; precision: 'min' | '6h' | '1d' | 'first'; window_start: string | null; first_seen_at: string; thumb?: ThumbProbe }>
  changes: Array<{ field: VersionField; fromId: string; precision: 'min' | '6h' | '1d'; window_start: string | null; window_end: string }>
}
export function normalizeDescription(text: string): string   // trims trailing spaces per line, \r\n → \n
export function hashValue(text: string): string              // sha256 first 16 hex
export function reconcileVideoVersions(current: StoredVersion[], observed: ObservedVideo, w: SyncWindow, opts: { lastModifiedMinute: boolean }): VersionPlan
```

Rules (CONVENCOES "Precisão temporal das trocas"):
- First sighting of a field → `open` with `precision: 'first'` and no change.
- Same value → `touch`.
- Title or description differs → `close` the old one and `open` the new one with `precision: '6h'`. The window is `[prevOkAt, now]`. If `prevOkAt` is more than 7 h before now, precision is `'1d'` (the window is wider than one slot), never `min`.
- Thumbnail: `isNewThumb` true → change. Precision `'min'` and `first_seen_at` = `Last-Modified` only when `opts.lastModifiedMinute` and `Last-Modified` falls inside the window. Otherwise the same window rule as title.
- A description only changes when `hashValue(normalizeDescription(...))` differs. UTM-only edits ARE versions; the UI hides them as noise (`stripUtm`), the data keeps them.

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment node
// apps/web/test/youtube/competitor-versions.test.ts
import { describe, it, expect } from 'vitest'
import { reconcileVideoVersions, hashValue, normalizeDescription, type StoredVersion } from '@/lib/youtube/competitor-versions'

const T0 = '2026-10-24T09:00:00.000Z', T1 = '2026-10-24T15:00:00.000Z'
const v = (field: StoredVersion['field'], text: string, id = field + '1'): StoredVersion =>
  ({ id, field, value_hash: hashValue(text), thumb_etag: null, thumb_dhash: null, first_seen_at: T0, last_seen_at: T0 })

describe('reconcileVideoVersions', () => {
  it('first sighting opens versions with precision "first" and records no change', () => {
    const p = reconcileVideoVersions([], { title: 'A', description: 'd', thumb: null }, { prevOkAt: null, now: T1 }, { lastModifiedMinute: true })
    expect(p.open.map(o => [o.field, o.precision])).toEqual([['title', 'first'], ['desc', 'first']])
    expect(p.changes).toEqual([])
  })
  it('same values only touch', () => {
    const p = reconcileVideoVersions([v('title', 'A'), v('desc', 'd')], { title: 'A', description: 'd', thumb: null }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.touch.sort()).toEqual(['desc1', 'title1'])
    expect(p.open).toEqual([]); expect(p.changes).toEqual([])
  })
  it('title change in a 6 h window → 6h precision with window [prevOk, now]', () => {
    const p = reconcileVideoVersions([v('title', 'A')], { title: 'B', description: '', thumb: null }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.close).toEqual(['title1'])
    expect(p.changes).toEqual([{ field: 'title', fromId: 'title1', precision: '6h', window_start: T0, window_end: T1 }])
  })
  it('a wider gap than one slot (missed syncs) degrades to 1d, never invents minutes', () => {
    const p = reconcileVideoVersions([v('title', 'A')], { title: 'B', description: '', thumb: null }, { prevOkAt: '2026-10-23T09:00:00.000Z', now: T1 }, { lastModifiedMinute: true })
    expect(p.changes[0]!.precision).toBe('1d')
  })
  it('description CRLF and trailing spaces are not a change', () => {
    expect(hashValue(normalizeDescription('a  \r\nb'))).toBe(hashValue(normalizeDescription('a\nb')))
  })
  it('thumbnail with Last-Modified inside the window gets minute precision', () => {
    const cur = { ...v('thumb', ''), thumb_etag: 'e1', thumb_dhash: '0000000000000000' }
    const p = reconcileVideoVersions([cur], { title: '', description: '', thumb: { etag: 'e2', dhash: 'ffffffffffffffff', lastModified: 'Sat, 24 Oct 2026 12:14:00 GMT', bytes: null, url: 'u' } }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    const ch = p.changes.find(c => c.field === 'thumb')!
    expect(ch.precision).toBe('min')
    expect(p.open.find(o => o.field === 'thumb')!.first_seen_at).toBe('2026-10-24T12:14:00.000Z')
  })
  it('thumbnail without a usable Last-Modified falls back to the window', () => {
    const cur = { ...v('thumb', ''), thumb_etag: 'e1', thumb_dhash: '0000000000000000' }
    const p = reconcileVideoVersions([cur], { title: '', description: '', thumb: { etag: 'e2', dhash: 'ffffffffffffffff', lastModified: null, bytes: null, url: 'u' } }, { prevOkAt: T0, now: T1 }, { lastModifiedMinute: true })
    expect(p.changes.find(c => c.field === 'thumb')!.precision).toBe('6h')
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/web && npx vitest run test/youtube/competitor-versions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/youtube/competitor-versions.ts
import crypto from 'crypto'
import { isNewThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'

export type VersionField = 'title' | 'thumb' | 'desc'
export interface StoredVersion { id: string; field: VersionField; value_hash: string; thumb_etag: string | null; thumb_dhash: string | null; first_seen_at: string; last_seen_at: string }
export interface ObservedVideo { title: string; description: string; thumb: ThumbProbe | null }
export interface SyncWindow { prevOkAt: string | null; now: string }
type Precision = 'min' | '6h' | '1d'
export interface VersionPlan {
  touch: string[]
  close: string[]
  open: Array<{ field: VersionField; value_text: string | null; value_hash: string; has_text: boolean; precision: Precision | 'first'; window_start: string | null; first_seen_at: string; thumb?: ThumbProbe }>
  changes: Array<{ field: VersionField; fromId: string; precision: Precision; window_start: string | null; window_end: string }>
}

const SLOT_MS = 7 * 3_600_000 // one 6 h slot + 1 h of batch slack

export function normalizeDescription(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim()
}
export function hashValue(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function windowPrecision(w: SyncWindow): Precision {
  if (!w.prevOkAt) return '1d'
  return Date.parse(w.now) - Date.parse(w.prevOkAt) <= SLOT_MS ? '6h' : '1d'
}

export function reconcileVideoVersions(current: StoredVersion[], observed: ObservedVideo, w: SyncWindow, opts: { lastModifiedMinute: boolean }): VersionPlan {
  const plan: VersionPlan = { touch: [], close: [], open: [], changes: [] }
  const cur = (f: VersionField) => current.find(v => v.field === f) ?? null

  const textField = (field: 'title' | 'desc', raw: string) => {
    const value = field === 'desc' ? normalizeDescription(raw) : raw
    const hash = hashValue(value), prev = cur(field)
    if (!prev) { plan.open.push({ field, value_text: value, value_hash: hash, has_text: true, precision: 'first', window_start: null, first_seen_at: w.now }); return }
    if (prev.value_hash === hash) { plan.touch.push(prev.id); return }
    const precision = windowPrecision(w)
    plan.close.push(prev.id)
    plan.open.push({ field, value_text: value, value_hash: hash, has_text: true, precision, window_start: w.prevOkAt, first_seen_at: w.now })
    plan.changes.push({ field, fromId: prev.id, precision, window_start: w.prevOkAt, window_end: w.now })
  }
  textField('title', observed.title)
  textField('desc', observed.description)

  const t = observed.thumb
  if (t) {
    const prev = cur('thumb')
    const prevFp = prev ? { etag: prev.thumb_etag, dhash: prev.thumb_dhash } : null
    if (!isNewThumb(prevFp, t)) { if (prev) plan.touch.push(prev.id) }
    else {
      const hash = t.dhash ?? hashValue(t.etag ?? t.url)
      if (!prev) plan.open.push({ field: 'thumb', value_text: null, value_hash: hash, has_text: false, precision: 'first', window_start: null, first_seen_at: w.now, thumb: t })
      else {
        const lm = t.lastModified ? Date.parse(t.lastModified) : NaN
        const inWindow = Number.isFinite(lm) && w.prevOkAt !== null && lm > Date.parse(w.prevOkAt) && lm <= Date.parse(w.now)
        const precision: Precision = opts.lastModifiedMinute && inWindow ? 'min' : windowPrecision(w)
        const firstSeen = precision === 'min' ? new Date(lm).toISOString() : w.now
        plan.close.push(prev.id)
        plan.open.push({ field: 'thumb', value_text: null, value_hash: hash, has_text: false, precision, window_start: w.prevOkAt, first_seen_at: firstSeen, thumb: t })
        plan.changes.push({ field: 'thumb', fromId: prev.id, precision, window_start: w.prevOkAt, window_end: firstSeen })
      }
    }
  }
  return plan
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/youtube/competitor-versions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/competitor-versions.ts apps/web/test/youtube/competitor-versions.test.ts
git commit -m "feat: reconciliação pura de versões de título, descrição e thumbnail com janela e precisão

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 8: Rewrite `syncCompetitorChannel` — versions, description text, thumbnails, daily record, honest sync health

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts` (whole file)
- Test: `apps/web/test/youtube/competitor-sync.test.ts` (unit, fetch + supabase mocked) and `apps/web/test/integration/competitor-sync-versions.test.ts` (DB-gated, fetch mocked)

**Interfaces:**
- Consumes: `reconcileVideoVersions`, `hashValue`, `normalizeDescription` (Task 7), `probeThumb`, `archiveThumb` (Task 6), tables from Tasks 3–4.
- Produces:
```ts
export interface SyncResult { videosChecked: number; changesDetected: number; dailyRecorded: number; unitsUsed: number; skipped?: boolean }
export function isDailyRecordDue(nowIso: string, lastRecordDate: string | null): { due: boolean; snapDate: string } // SP 12:00 rule
export async function syncCompetitorChannel(channelRow: { id: string; channel_id: string; site_id: string }, apiKey: string, opts?: { now?: Date; fetchImpl?: typeof fetch }): Promise<SyncResult>
```

Behaviour changes (keep the CAS lock, notifications, full-sync mode and backfill logic as they are):
1. `last_synced_at` is set at the START (the cursor, unchanged meaning). On success, `last_ok_synced_at = now` and `sync_error_since = null`. On error, `sync_error_since = coalesce(sync_error_since, now)`.
2. `SyncWindow.prevOkAt` = the row's `last_ok_synced_at` read under the lock.
3. For each video, reconciliation runs for `title`, `description` (full `snippet.description`) and the thumbnail (`probeThumb` with the current thumb version's etag/dhash), but only when (a) the video was published < 90 days ago, or (b) the daily record is due (old videos are checked once per day — spec §7). Apply the plan: `update last_seen_at` for touch, `update is_current=false` for close, `insert` the open versions (thumb: `thumb_blob_url = archiveThumb(...)`), and insert one `competitor_changes` row per change with `from_version_id`, `to_version_id`, `window_start`, `window_end`, `precision`, `old_title`/`new_title` for titles, and `detected_at = now`.
4. Daily record: `isDailyRecordDue` is true when SP local time is ≥ 12:00 and no record exists for today's SP date. When due, call `videos.list` for ALL tracked ids (the first `video_limit` by `published_at desc`, in pages of 50) and `upsert` into `competitor_video_daily` with `ignoreDuplicates: true`. Then set `competitor_settings.series_started_at = now` where it is null (upsert on `site_id`).
5. Count units (1 per Data API call) into `unitsUsed`.

- [ ] **Step 1: Write the failing unit tests (pure helpers + call plan)**

```ts
// @vitest-environment node
// apps/web/test/youtube/competitor-sync.test.ts
import { describe, it, expect } from 'vitest'
import { isDailyRecordDue } from '@/lib/youtube/competitor-sync'

describe('isDailyRecordDue (12:00 São Paulo)', () => {
  it('before 12:00 SP is not due', () => {
    expect(isDailyRecordDue('2026-10-24T14:59:00.000Z', null)).toEqual({ due: false, snapDate: '2026-10-24' }) // 11:59 SP
  })
  it('at/after 12:00 SP with no record today is due', () => {
    expect(isDailyRecordDue('2026-10-24T15:00:00.000Z', '2026-10-23')).toEqual({ due: true, snapDate: '2026-10-24' })
  })
  it('already recorded today is not due', () => {
    expect(isDailyRecordDue('2026-10-24T20:00:00.000Z', '2026-10-24').due).toBe(false)
  })
  it('uses the SP date even when UTC already rolled over', () => {
    expect(isDailyRecordDue('2026-10-25T02:30:00.000Z', '2026-10-23')).toEqual({ due: true, snapDate: '2026-10-24' }) // 23:30 SP on 24/10
  })
})
```

- [ ] **Step 2: Write the failing DB-gated integration test**

The test seeds one channel and one video with current versions (title "A", description "d", thumbnail with ETag `"e1"` and dHash `0000000000000000`). It freezes the clock at 24/10 18:00 SP, with `last_ok_synced_at` at 24/10 12:00 SP. It mocks `fetch`: the Data API returns the title "B", and the thumbnail HEAD/GET returns a new ETag and a gradient image whose dHash is `ffffffffffffffff`.

```ts
// @vitest-environment node
// apps/web/test/integration/competitor-sync-versions.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import sharp from 'sharp'
import { skipIfNoLocalDb } from '../helpers/db-skip'
vi.mock('@vercel/blob', () => ({ put: vi.fn(async () => ({ url: 'https://blob.test/x.jpg' })) }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { hashValue } from '@/lib/youtube/competitor-versions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const sp = (iso: string) => new Date(iso + '-03:00').toISOString()
/** Horizontal gradient, bright → dark: every dHash comparison is 1 → "ffffffffffffffff". */
async function gradient(): Promise<Buffer> {
  const w = 90, h = 80, raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.fill(255 - x * 2, (y * w + x) * 3, (y * w + x) * 3 + 3)
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}
function apiFetch(newTitle: string, thumbBytes: Buffer): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input)
    if (u.includes('/channels?')) return Response.json({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUx' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '1000', videoCount: '1', viewCount: '10' } }] })
    if (u.includes('/playlistItems?')) return Response.json({ items: [{ snippet: { resourceId: { videoId: 'vidsync1' } } }] })
    if (u.includes('/videos?')) return Response.json({ items: [{ id: 'vidsync1', snippet: { title: newTitle, description: 'd', publishedAt: '2026-10-20T15:00:00Z', thumbnails: { high: { url: 'https://i.ytimg.com/vi/vidsync1/hqdefault.jpg' } } }, statistics: { viewCount: '500', likeCount: '5', commentCount: '1' }, contentDetails: { duration: 'PT10M' } }] })
    if (u.includes('i.ytimg.com') && init?.method === 'HEAD') return new Response(null, { status: 200, headers: { etag: '"e2"' } })
    if (u.includes('i.ytimg.com')) return new Response(thumbBytes, { status: 200, headers: { etag: '"e2"' } })
    return new Response('unexpected ' + u, { status: 500 })
  }) as typeof fetch
}

describe.skipIf(skipIfNoLocalDb())('syncCompetitorChannel versions', () => {
  const sb = getSupabaseServiceClient()
  let siteId = '', chId = '', vidId = ''
  beforeAll(async () => {
    siteId = (await sb.from('sites').select('id').limit(1).single()).data!.id
    await sb.from('competitor_channels').delete().eq('site_id', siteId).eq('channel_id', 'UCsync')
    chId = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCsync', channel_name: 'Canal', video_limit: 50, last_ok_synced_at: sp('2026-10-24T12:00:00'), last_synced_at: sp('2026-10-24T12:00:00') }).select('id').single()).data!.id
    vidId = (await sb.from('competitor_videos').insert({ competitor_channel_id: chId, video_id: 'vidsync1', title: 'A', published_at: '2026-10-20T15:00:00Z' }).select('id').single()).data!.id
    const seen = sp('2026-10-24T12:00:00')
    await sb.from('competitor_video_versions').insert([
      { video_id: vidId, field: 'title', value_text: 'A', value_hash: hashValue('A'), first_seen_at: seen, last_seen_at: seen, precision: 'first' },
      { video_id: vidId, field: 'desc', value_text: 'd', value_hash: hashValue('d'), first_seen_at: seen, last_seen_at: seen, precision: 'first' },
      { video_id: vidId, field: 'thumb', value_hash: '0000000000000000', has_text: false, thumb_etag: '"e1"', thumb_dhash: '0000000000000000', first_seen_at: seen, last_seen_at: seen, precision: 'first' },
    ])
    await sb.from('competitor_settings').upsert({ site_id: siteId, series_started_at: null }, { onConflict: 'site_id' })
  })

  it('records title + thumbnail changes with windows, the daily record, series start and sync health', async () => {
    const now = new Date(sp('2026-10-24T18:00:00'))
    const r = await syncCompetitorChannel({ id: chId, channel_id: 'UCsync', site_id: siteId }, 'k', { now, fetchImpl: apiFetch('B', await gradient()) })
    expect(r.changesDetected).toBe(2)
    expect(r.dailyRecorded).toBe(1)

    const { data: titles } = await sb.from('competitor_video_versions').select('value_text, is_current, precision').eq('video_id', vidId).eq('field', 'title').order('first_seen_at')
    expect(titles).toEqual([{ value_text: 'A', is_current: false, precision: 'first' }, { value_text: 'B', is_current: true, precision: '6h' }])

    const { data: chg } = await sb.from('competitor_changes').select('change_type, precision, window_start, window_end, from_version_id, to_version_id, old_title, new_title').eq('video_id', vidId).order('change_type')
    expect(chg).toHaveLength(2)
    const [thumb, title] = chg!
    expect(title).toMatchObject({ change_type: 'title', precision: '6h', old_title: 'A', new_title: 'B' })
    expect(new Date(title!.window_start!).toISOString()).toBe(sp('2026-10-24T12:00:00'))
    expect(title!.from_version_id).not.toBeNull(); expect(title!.to_version_id).not.toBeNull()
    expect(thumb).toMatchObject({ change_type: 'thumbnail' })
    expect(['6h', 'min']).toContain(thumb!.precision)

    const { data: newThumb } = await sb.from('competitor_video_versions').select('thumb_blob_url, thumb_dhash').eq('video_id', vidId).eq('field', 'thumb').eq('is_current', true).single()
    expect(newThumb).toEqual({ thumb_blob_url: 'https://blob.test/x.jpg', thumb_dhash: 'ffffffffffffffff' })

    const { data: daily } = await sb.from('competitor_video_daily').select('snap_date, views').eq('video_id', vidId)
    expect(daily).toEqual([{ snap_date: '2026-10-24', views: 500 }])

    const { data: settings } = await sb.from('competitor_settings').select('series_started_at').eq('site_id', siteId).single()
    expect(settings!.series_started_at).not.toBeNull()

    const { data: ch } = await sb.from('competitor_channels').select('last_ok_synced_at, sync_error_since, sync_status').eq('id', chId).single()
    expect(new Date(ch!.last_ok_synced_at!).toISOString()).toBe(now.toISOString())
    expect(ch).toMatchObject({ sync_error_since: null, sync_status: 'idle' })
  })
})
```
(`competitor_changes.change_type` keeps its existing values `'title' | 'description' | 'thumbnail'`. The version field names `'title' | 'desc' | 'thumb'` are mapped when inserting the change row.)

- [ ] **Step 3: Run both to see them fail**

Run: `cd apps/web && npx vitest run test/youtube/competitor-sync.test.ts && HAS_LOCAL_DB=1 npx vitest run test/integration/competitor-sync-versions.test.ts`
Expected: FAIL (`isDailyRecordDue` not exported; integration assertions fail).

- [ ] **Step 4: Implement**

Add these to `competitor-sync.ts`:

```ts
const SP_OFFSET_MS = 3 * 3_600_000 // America/Sao_Paulo is UTC−3 with no DST since 2019
export function spDate(ms: number): string { return new Date(ms - SP_OFFSET_MS).toISOString().slice(0, 10) }
export function isDailyRecordDue(nowIso: string, lastRecordDate: string | null): { due: boolean; snapDate: string } {
  const now = Date.parse(nowIso), snapDate = spDate(now)
  const spHour = new Date(now - SP_OFFSET_MS).getUTCHours()
  return { due: spHour >= 12 && lastRecordDate !== snapDate, snapDate }
}
```
Then refactor `syncCompetitorChannel` per items 1–5 above:
- Thread `opts.fetchImpl ?? fetch` through every call.
- Replace the inline title/description/thumbnail comparison block (current lines 202-239) with: load current versions for the page's video ids in one query (`competitor_video_versions` where `video_id in (...)` and `is_current`), then `reconcileVideoVersions` per video, then apply the plan.
- Keep `description_hash` and `thumbnail_url` updates on `competitor_videos` (other readers still use them).
- The per-video change insert must also keep writing `old_title`/`new_title`/`view_count_at_change`; the notification code stays as is.
- `lastRecordDate` = `max(snap_date)` of `competitor_video_daily` for this channel's videos (one query with `.order('snap_date',{ascending:false}).limit(1)` joined through `competitor_videos!inner(competitor_channel_id)`).

- [ ] **Step 5: Run the tests**

Run: `cd apps/web && npx vitest run test/youtube/competitor-sync.test.ts && HAS_LOCAL_DB=1 npx vitest run test/integration/competitor-sync-versions.test.ts && npx tsc --noEmit`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/integration/competitor-sync-versions.test.ts
git commit -m "feat: sincronização guarda versões, texto da descrição, thumbnail arquivada e registro diário de views

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 9: Batched sync every 6 h with a cursor

**Files:**
- Create: `apps/web/src/lib/youtube/competitor-sync-batch.ts`
- Modify: `apps/web/src/app/api/cron/sync-youtube/route.ts:128-170` (competitors branch)
- Modify: `apps/web/vercel.json` (competitors schedule)
- Test: `apps/web/test/youtube/competitor-sync-batch.test.ts`

**Interfaces:**
- Consumes: `syncCompetitorChannel` (Task 8), S2 `BATCH_SIZE`.
- Produces:
```ts
export const SLOT_HOURS_SP = [0, 6, 12, 18] as const
export function currentSlotStart(nowMs: number): number                    // last 00/06/12/18 SP boundary ≤ now
export function isDue(lastSyncedAt: string | null, nowMs: number): boolean // never synced, or synced before the current slot
export interface BatchResult { synced: number; errors: number; skipped: number; remainingDue: number; stoppedForTime: boolean }
export async function runCompetitorBatch(opts: { apiKey: string; batchSize: number; budgetMs: number; now?: () => number }): Promise<BatchResult>
```
Cursor = `last_synced_at` (oldest first, nulls first), over ALL sites, filtered by `isDue`. A run stops starting new channels after `budgetMs` (200 000 ms; route `maxDuration` stays 300).

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment node
// apps/web/test/youtube/competitor-sync-batch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { currentSlotStart, isDue } from '@/lib/youtube/competitor-sync-batch'

const sp = (iso: string) => Date.parse(iso + '-03:00')
describe('6 h slots in São Paulo', () => {
  it('slot start is the last 00/06/12/18 SP', () => {
    expect(currentSlotStart(sp('2026-10-24T15:02:00'))).toBe(sp('2026-10-24T12:00:00'))
    expect(currentSlotStart(sp('2026-10-24T00:00:00'))).toBe(sp('2026-10-24T00:00:00'))
    expect(currentSlotStart(sp('2026-10-24T05:59:59'))).toBe(sp('2026-10-24T00:00:00'))
  })
  it('due when never synced or synced before the slot', () => {
    const now = sp('2026-10-24T15:02:00')
    expect(isDue(null, now)).toBe(true)
    expect(isDue(new Date(sp('2026-10-24T11:59:00')).toISOString(), now)).toBe(true)
    expect(isDue(new Date(sp('2026-10-24T12:01:00')).toISOString(), now)).toBe(false)
  })
})
describe('runCompetitorBatch', () => {
  it('syncs at most batchSize channels, oldest first, and reports what is still due', async () => {
    vi.resetModules()
    const synced: string[] = []
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { synced.push(r.id); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: '2026-10-24T13:00:00.000Z' }, { id: 'c', channel_id: 'C', site_id: 's', last_synced_at: '2026-10-24T14:00:00.000Z' }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 2, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    expect(synced).toEqual(['a', 'b'])
    expect(r).toMatchObject({ synced: 2, errors: 0, remainingDue: 1, stoppedForTime: false })
  })
  it('one failing channel does not stop the batch', async () => {
    vi.resetModules()
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { if (r.id === 'a') throw new Error('404'); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    expect(await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })).toMatchObject({ synced: 1, errors: 1 })
  })
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/web && npx vitest run test/youtube/competitor-sync-batch.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/youtube/competitor-sync-batch.ts
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'

export const SLOT_HOURS_SP = [0, 6, 12, 18] as const
const H = 3_600_000, SP_OFFSET = 3 * H

export function currentSlotStart(nowMs: number): number {
  const local = nowMs - SP_OFFSET
  const dayStart = Math.floor(local / (24 * H)) * 24 * H
  const hour = Math.floor((local - dayStart) / H)
  const slot = [...SLOT_HOURS_SP].reverse().find(h => h <= hour) ?? 0
  return dayStart + slot * H + SP_OFFSET
}
export function isDue(lastSyncedAt: string | null, nowMs: number): boolean {
  return lastSyncedAt === null || Date.parse(lastSyncedAt) < currentSlotStart(nowMs)
}

export interface BatchResult { synced: number; errors: number; skipped: number; remainingDue: number; stoppedForTime: boolean }

export async function runCompetitorBatch(opts: { apiKey: string; batchSize: number; budgetMs: number; now?: () => number }): Promise<BatchResult> {
  const now = opts.now ?? Date.now, started = now()
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb.from('competitor_channels')
    .select('id, channel_id, site_id, last_synced_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
  if (error) throw new Error(`competitor batch: ${error.message}`)
  const due = (data ?? []).filter(r => isDue(r.last_synced_at, started))
  const res: BatchResult = { synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false }
  let taken = 0
  for (const row of due) {
    if (taken >= opts.batchSize) break
    if (now() - started > opts.budgetMs) { res.stoppedForTime = true; break }
    taken++
    try {
      const r = await syncCompetitorChannel(row, opts.apiKey)
      if (r.skipped) res.skipped++; else res.synced++
    } catch (err) {
      res.errors++
      Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors' }, extra: { channelId: row.channel_id, siteId: row.site_id } })
    }
  }
  res.remainingDue = due.length - taken
  return res
}
```

Replace the route's competitors branch body (from `const { data: competitorChannels }` through its `return`) with:

```ts
      const BATCH_SIZE = 6 // spike S2
      const result = await runCompetitorBatch({ apiKey, batchSize: BATCH_SIZE, budgetMs: 200_000 })
      if (result.errors > 0 && result.synced === 0 && result.skipped === 0) {
        await recordCronFailure('sync-youtube-competitors', `All ${result.errors} channels in the batch failed`)
      } else {
        await recordCronSuccess('sync-youtube-competitors', 'info')
      }
      revalidatePath('/cms/youtube/competitors', 'layout')
      return { status: 'ok' as const, mode: 'competitors', ...result, health_written: true }
```
(import `runCompetitorBatch` at the top; drop the now-unused `syncCompetitorChannel` import only if nothing else in the route uses it.)

In `apps/web/vercel.json` replace `{ "path": "/api/cron/sync-youtube?mode=competitors", "schedule": "0 9 * * *" }` with `{ "path": "/api/cron/sync-youtube?mode=competitors", "schedule": "*/20 * * * *" }` (or the S2 cadence). `cron-health-report.ts` derives the expected interval from `vercel.json`, so no other change is needed. Confirm with `cd apps/web && npx vitest run test/ops` (the cron-health tests).

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/web && npx vitest run test/youtube/competitor-sync-batch.test.ts test/ops && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/competitor-sync-batch.ts apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/vercel.json apps/web/test/youtube/competitor-sync-batch.test.ts
git commit -m "feat: sincronização de concorrentes em lotes com cursor, a cada 6 h em São Paulo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
**After promotion:** call the cron once in the same minute as the deploy, `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://bythiagofigueiredo.com/api/cron/sync-youtube?mode=competitors"`. Otherwise `/api/health` reads the old daily key as late (the lesson from the IG C2 rollout).

### Task 10: Channel limit 75 + admin "+25" + the "−1 vagas" fix + duplicate message with niche

**Files:**
- Create: `apps/web/src/lib/youtube/competitor-slots.ts`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts:15-62` (`addCompetitorChannel`), add `unlockMoreChannels`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_components/add-channel-modal.tsx:150-165`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx:29` (drop `MAX_CHANNELS`, pass `slots`)
- Test: `apps/web/test/youtube/competitor-slots.test.ts`, `apps/web/test/youtube/add-channel-modal-slots.test.tsx`

**Interfaces:**
- Produces:
```ts
export interface ChannelSlots { used: number; limit: number; free: number } // free = max(0, limit − used); own channel never counted
export function computeSlots(usedCompetitors: number, limit: number | null): ChannelSlots // limit null → 75
export async function getChannelSlots(siteId: string): Promise<ChannelSlots>
export const DEFAULT_CHANNEL_LIMIT = 75
export const UNLOCK_STEP = 25
// actions.ts
export async function addCompetitorChannel(channelId: string, niche?: 'viagem' | 'ia'): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots }>
export async function unlockMoreChannels(): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots }>
```
Texts (CONVENCOES/spec 2.2): "N de 75 canais"; at the limit, "Sem vagas: remova um canal…" (Task 23 owns the full copy from `canais.html`); duplicate → "Canal já adicionado em <Viagem|IA>" (or "Canal já adicionado" when its niche is null).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/test/youtube/competitor-slots.test.ts
import { describe, it, expect } from 'vitest'
import { computeSlots, DEFAULT_CHANNEL_LIMIT } from '@/lib/youtube/competitor-slots'

describe('computeSlots', () => {
  it('defaults to 75', () => expect(computeSlots(14, null)).toEqual({ used: 14, limit: DEFAULT_CHANNEL_LIMIT, free: 61 }))
  it('never negative (the "-1 vagas" bug)', () => expect(computeSlots(16, 15)).toEqual({ used: 16, limit: 15, free: 0 }))
  it('full', () => expect(computeSlots(75, 75).free).toBe(0))
})
```

```tsx
// @vitest-environment jsdom
// apps/web/test/youtube/add-channel-modal-slots.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AddChannelModal } from '@/app/cms/(authed)/youtube/competitors/_components/add-channel-modal'

describe('AddChannelModal slots', () => {
  it('shows the server free count without subtracting added ids again (no "-1 vagas")', () => {
    render(<AddChannelModal open onClose={vi.fn()} slots={{ used: 75, limit: 75, free: 0 }} existingChannelIds={[]} />)
    expect(screen.queryByText(/-1 vaga/)).toBeNull()
    expect(screen.getByText(/0 vagas restantes/)).toBeTruthy()
  })
})
```
(Read `add-channel-modal.tsx`'s current props first. If it is not exported as `AddChannelModal`, or its props are named differently, adapt the import and props in the test, but keep the assertion: the visible count is `slots.free` exactly.)

- [ ] **Step 2: Run to see them fail**

Run: `cd apps/web && npx vitest run test/youtube/competitor-slots.test.ts test/youtube/add-channel-modal-slots.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/youtube/competitor-slots.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'
export const DEFAULT_CHANNEL_LIMIT = 75
export const UNLOCK_STEP = 25
export interface ChannelSlots { used: number; limit: number; free: number }
export function computeSlots(usedCompetitors: number, limit: number | null): ChannelSlots {
  const l = limit ?? DEFAULT_CHANNEL_LIMIT
  return { used: usedCompetitors, limit: l, free: Math.max(0, l - usedCompetitors) }
}
/** competitor_channels never holds the own channel (it lives in youtube_channels), so every row is a competitor. */
export async function getChannelSlots(siteId: string): Promise<ChannelSlots> {
  const sb = getSupabaseServiceClient()
  const [{ count }, { data: settings }] = await Promise.all([
    sb.from('competitor_channels').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    sb.from('competitor_settings').select('channel_limit').eq('site_id', siteId).maybeSingle(),
  ])
  return computeSlots(count ?? 0, settings?.channel_limit ?? null)
}
```

In `actions.ts`:
- Replace the "Check limit (max 15)" block with `const slots = await getChannelSlots(siteId); if (slots.free === 0) return { ok: false, error: 'Sem vagas', slots }`.
- Duplicate check: select `niche` too and return `` `Canal já adicionado${existing.niche ? ' em ' + (existing.niche === 'ia' ? 'IA' : 'Viagem') : ''}` ``.
- Insert `niche` when given.
- Return `slots: await getChannelSlots(siteId)` on success.

Add:

```ts
export async function unlockMoreChannels(): Promise<{ ok: boolean; error?: string; slots?: ChannelSlots }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false, error: 'forbidden' }
  const sb = getSupabaseServiceClient()
  const { data: me } = await sb.from('site_users').select('role').eq('site_id', siteId).eq('user_id', res.user.id).maybeSingle()
  if (!me || !['super_admin', 'org_admin'].includes(me.role as string)) return { ok: false, error: 'forbidden' }
  const cur = await getChannelSlots(siteId)
  const { error } = await sb.from('competitor_settings').upsert({ site_id: siteId, channel_limit: cur.limit + UNLOCK_STEP, updated_by: res.user.id, updated_at: new Date().toISOString() }, { onConflict: 'site_id' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: true, slots: await getChannelSlots(siteId) }
}
```
(Check `site_users` really has `user_id` + `role`: `grep -n "site_users: {" -A12 apps/web/src/types/database.types.ts`.)

In the modal, replace every `slotsRemaining - addedIds.size` with `slots.free` (from a new `slots: ChannelSlots` prop). After each successful add, set `slots` from the action's returned `slots` (local state initialised from the prop). The server is the only source of the count.

In `page.tsx`, delete `const MAX_CHANNELS = 15` and pass `slots={await getChannelSlots(siteId)}` down to where `maxChannels` was used (keep the current UI working until Task 23 replaces it).

- [ ] **Step 4: Add a server-action test for the admin gate**

```ts
// append to apps/web/test/youtube/competitor-slots.test.ts
import { vi } from 'vitest'
describe('unlockMoreChannels', () => {
  it('refuses an editor (only super_admin/org_admin unlock)', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'editor' } }) }) }) }) }) }) }))
    const { unlockMoreChannels } = await import('@/app/cms/(authed)/youtube/competitors/actions')
    expect(await unlockMoreChannels()).toEqual({ ok: false, error: 'forbidden' })
  })
})
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd apps/web && npx vitest run test/youtube/competitor-slots.test.ts test/youtube/add-channel-modal-slots.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/competitor-slots.ts "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_components/add-channel-modal.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" apps/web/test/youtube/competitor-slots.test.ts apps/web/test/youtube/add-channel-modal-slots.test.tsx
git commit -m "feat: limite de 75 concorrentes por site, +25 pelo admin, e o modal nunca mostra vagas negativas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 11: Niche per channel and per user (server actions)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/niche.ts` (sync helpers — a `'use server'` module may only export async functions; `test/unit/use-server-exports.test.ts` enforces this)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/niche-actions.ts` (`'use server'`)
- Test: `apps/web/test/youtube/niche-actions.test.ts`

**Interfaces:**
- Produces:
```ts
// lib/youtube/observatorio/niche.ts
export type NicheScope = 'todos' | 'viagem' | 'ia'
export function parseNiche(raw: string | null | undefined): NicheScope | null // validates ?niche=
// niche-actions.ts
export async function setChannelNiche(channelRowId: string, niche: 'viagem' | 'ia' | null): Promise<{ ok: boolean }>
export async function getUserNiche(): Promise<NicheScope>               // default 'todos'
export async function setUserNiche(niche: NicheScope): Promise<{ ok: boolean }>
```
`?niche=` in the URL wins and is persisted (CHROME.md "Nicho"). An invalid value is ignored (and removed from the URL by the client). (`types.ts` from Task 12 re-exports `NicheScope` from `niche.ts`, so there is one definition.)

- [ ] **Step 1: Failing tests**

```ts
// apps/web/test/youtube/niche-actions.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseNiche } from '@/lib/youtube/observatorio/niche'

describe('parseNiche', () => {
  it('accepts todos|viagem|ia', () => { expect(parseNiche('ia')).toBe('ia'); expect(parseNiche('todos')).toBe('todos') })
  it('rejects anything else', () => { expect(parseNiche('culinaria')).toBeNull(); expect(parseNiche(undefined)).toBeNull() })
})
describe('getUserNiche', () => {
  it('defaults to todos when there is no row', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }))
    const { getUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    expect(await getUserNiche()).toBe('todos')
  })
})
```

- [ ] **Step 2: Run → FAIL** (`cd apps/web && npx vitest run test/youtube/niche-actions.test.ts`)

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/youtube/observatorio/niche.ts
export type NicheScope = 'todos' | 'viagem' | 'ia'
const SCOPES: readonly NicheScope[] = ['todos', 'viagem', 'ia']
export function parseNiche(raw: string | null | undefined): NicheScope | null {
  return SCOPES.includes(raw as NicheScope) ? (raw as NicheScope) : null
}
```

```ts
'use server'
// apps/web/src/app/cms/(authed)/youtube/competitors/niche-actions.ts
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { parseNiche, type NicheScope } from '@/lib/youtube/observatorio/niche'

export async function getUserNiche(): Promise<NicheScope> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return 'todos'
  const { data } = await getSupabaseServiceClient().from('competitor_user_prefs').select('niche').eq('user_id', res.user.id).eq('site_id', siteId).maybeSingle()
  return parseNiche(data?.niche) ?? 'todos'
}
export async function setUserNiche(niche: NicheScope): Promise<{ ok: boolean }> {
  if (!parseNiche(niche)) return { ok: false }
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) return { ok: false }
  const { error } = await getSupabaseServiceClient().from('competitor_user_prefs').upsert({ user_id: res.user.id, site_id: siteId, niche, updated_at: new Date().toISOString() }, { onConflict: 'user_id,site_id' })
  return { ok: !error }
}
export async function setChannelNiche(channelRowId: string, niche: 'viagem' | 'ia' | null): Promise<{ ok: boolean }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { ok: false }
  const { error } = await getSupabaseServiceClient().from('competitor_channels').update({ niche }).eq('id', channelRowId).eq('site_id', siteId)
  revalidatePath('/cms/youtube/competitors', 'layout')
  return { ok: !error }
}
```

- [ ] **Step 4: Run → PASS** (`cd apps/web && npx vitest run test/youtube/niche-actions.test.ts test/unit/use-server-exports.test.ts && npx tsc --noEmit`)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/niche-actions.ts" apps/web/src/lib/youtube/observatorio/niche.ts apps/web/test/youtube/niche-actions.test.ts
git commit -m "feat: nicho por canal e nicho escolhido por usuário no observatório

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

**P1 ship gate:** run `cd apps/web && npx vitest run` (full suite), then `npx tsc --noEmit`, then ask the owner to push the two migrations. Promote, then run the cron curl from Task 9. Over 24 h, check that `competitor_video_versions` and `competitor_video_daily` fill up: `select field, precision, count(*) from competitor_video_versions group by 1,2` via `npm run db:which`-linked read-only SQL in the Supabase dashboard.

---
# Phase P2 — One calculation layer (`lib/youtube/observatorio`, port of `dados.js`)

**Porting rules for every P2 task:**
- **Port; don't reinvent.** Each function is a line-for-line TypeScript port of the cited `dados.js` lines.
- Globals become parameters: `NOW` → `ctx.ds.now`, `SERIES_START` → `ctx.ds.seriesStart`, `SNAP(i)` → `ctx.clock.snapTime(i)`, `CH/V/CHG` → `ctx.CH/ctx.V/ctx.CHG`.
- Every literal "03/10" in a text becomes `clock.dm(ds.seriesStart)` (Review Focus 1).
- No `Date.now()`, `new Date()` without an argument, `Math.random()` or I/O anywhere under `lib/youtube/observatorio/` except `now.ts` and `load.ts`.

### Task 12: Oracle fixture + verbatim mockup suite harness

**Files:**
- Create: `apps/web/test/fixtures/observatorio/dados.cjs` (byte copy of `docs/superpowers/mockups/2026-10-02-observatorio/dados.js`)
- Create: `apps/web/test/fixtures/observatorio/dados-teste.html` (byte copy)
- Create: `apps/web/test/fixtures/observatorio/README.md`
- Create: `apps/web/test/youtube/observatorio/oracle.ts`
- Create: `apps/web/test/youtube/observatorio/suite-pending.ts`
- Create: `apps/web/test/youtube/observatorio/mockup-suite.test.ts`
- Create: `apps/web/src/lib/youtube/observatorio/types.ts`
- Create: `apps/web/src/lib/youtube/observatorio/index.ts` (facade stub)

**Interfaces:**
- Produces (test side):
```ts
export type Oracle = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- the mockup engine is untyped JS; confined to tests
export function loadOracle(): Oracle                     // fresh build of dados.cjs in a vm context
export function datasetFromOracle(o: Oracle): Dataset    // INPUT fields only; strips everything the engine derives
export interface SuiteResult { name: string; section: string; ok: boolean; detail: string }
export function runMockupSuite(facade: unknown): SuiteResult[]
```
- Produces (engine side): all types in `types.ts` (below) and `createObservatory(ds: Dataset, opts?: { seriesStartLabel?: string }): Observatory`. In this task the facade only exposes the raw dataset (`channels`, `videos`, `channel(id)`, `video(id)`, `NOW`, `SERIES_START`, `DAY`, `H`); later tasks add to it.

**Note on `any`:** the project bans `any`. The oracle is untyped third-party JS used only as a test oracle; `oracle.ts` is the single place that carries the eslint-disable with that justification. No `any` crosses into `src/`.

- [ ] **Step 1: Copy the oracle files (byte-for-byte) and write the README**

```bash
mkdir -p apps/web/test/fixtures/observatorio
cp docs/superpowers/mockups/2026-10-02-observatorio/dados.js apps/web/test/fixtures/observatorio/dados.cjs
cp docs/superpowers/mockups/2026-10-02-observatorio/dados-teste.html apps/web/test/fixtures/observatorio/dados-teste.html
shasum -a 256 apps/web/test/fixtures/observatorio/dados.cjs apps/web/test/fixtures/observatorio/dados-teste.html
```
README.md content:
```markdown
# Oracle of the Observatório engine — DO NOT EDIT
Byte copies of the approved mockup engine and its 190-assertion suite
(docs/superpowers/mockups/2026-10-02-observatorio/, commit 353492d3).
The production engine (src/lib/youtube/observatorio) must reproduce them:
- test/youtube/observatorio/mockup-suite.test.ts runs dados-teste.html VERBATIM against the production facade;
- *-parity.test.ts compares production outputs with this oracle on the same data.
sha256: <paste the two hashes printed by shasum>
```

- [ ] **Step 2: Write `types.ts`**

```ts
// apps/web/src/lib/youtube/observatorio/types.ts
export type Niche = 'viagem' | 'ia'
export type { NicheScope } from './niche' // single definition (Task 11)
export type Fmt = 'long' | 'short'
export type Precision = 'min' | '6h' | '1d'
export type SyncState = 'ok' | 'atrasado' | 'erro' | 'backfill'

export interface SeriesPoint { idx: number; t: number; views: number }
interface VersionBase { id: string; first_seen: number; last_seen: number; current: boolean; prec: Precision | 'first' | null; window: [number, number] | null; F?: number }
export interface ThumbArt { text: string; bg: string; fg: string; face: string; ink: string }
export interface TitleVersion extends VersionBase { text: string }
export interface ThumbVersion extends VersionBase { key: string; art: ThumbArt | null; blobUrl: string | null; seenSinceArchive?: boolean }
export interface DescVersion extends VersionBase { lines: string[] | null; hasText: boolean }

export interface ObsVideo {
  id: string; ch: string; niche: Niche | null; fmt: Fmt; pub: number; ageDays: number; tracked: boolean
  title: string; theme: string | null; formulas: string[]; url: string; ytId: string; dur: number | null
  views: number | null; viewsAt: number | null; likes: number; comments: number
  series: SeriesPoint[]; firstIdx: number | null
  titles: TitleVersion[]; thumbs: ThumbVersion[]; descs: DescVersion[]
}
export interface ChannelSnapshot { t: number; date: string; subs: number; views: number }
export interface ChannelSync {
  state: SyncState; last: number; next: number | null; added: number; errorSince: number | null
  msg: string | null; backfill: { done: number; total: number } | null
}
export interface ObsChannel {
  id: string; name: string; fullName: string; niche: Niche | null; own: boolean; lang: string
  subs: number; video_limit: number; url: string; handle: string; gender: 'm' | 'f' | 'n'; color: string; ini: string
  sync: ChannelSync; activity: { state: 'ativo' | 'parado'; pausedDays?: number }
  lastIdx: number | null; snapshots: ChannelSnapshot[]
}
export interface FrozenReading {
  id: string; type: string; niche: Niche | null; fmt: Fmt | null; target: { kind: 'niche' | 'video'; niche?: Niche; video?: string; fmt?: Fmt }
  seal: string; generatedAt: number; model: string
  sent: Record<string, unknown> & { text: string; asOf: number }
  analysis: Record<string, unknown>; text: { title?: string; lead: string; items: string[]; theme?: string }
  base?: unknown; effects?: unknown[]
}
export type RequestState = 'na fila' | 'trabalhando' | 'publicado' | 'atrasado' | 'sem máquina' | 'nova tentativa' | 'falhou' | 'recusado (dado velho)' | 'liberado pelo vigia'
export interface ForjaRequest {
  id: string; type: string; niche: Niche; target: { kind: 'niche' | 'video'; niche: Niche; video?: string; fmt?: Fmt }
  state: RequestState; createdAt: number; claimedAt: number | null; startedAt: number | null; publishedAt: number | null
  failedAt: number | null; attempt: number; refusedReason: string | null; readingId: string | null; seq?: number
}
export interface Dataset {
  now: number; seriesStart: number; snap0: number; obsStart: number
  channels: ObsChannel[]; videos: ObsVideo[]
  sync: { last: number; next: number | null }
  readings: FrozenReading[]; requests: ForjaRequest[]
  queue: { lastPollAt: number | null; tickMinutes: number; capabilities: string[] }
}
```

- [ ] **Step 3: Write `oracle.ts` and `suite-pending.ts`**

```ts
// apps/web/test/youtube/observatorio/oracle.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped mockup engine used only as a test oracle */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import type { Dataset, ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'

const DIR = path.resolve(__dirname, '../../fixtures/observatorio')
export type Oracle = Record<string, any>

export function loadOracle(): Oracle {
  const ctx: Record<string, unknown> = { console: { log() {}, error() {} } }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(path.join(DIR, 'dados.cjs'), 'utf8'), ctx)
  return ctx.OBS as Oracle
}

const VIDEO_INPUT: (keyof ObsVideo)[] = ['id', 'ch', 'niche', 'fmt', 'pub', 'ageDays', 'tracked', 'title', 'theme', 'formulas', 'url', 'ytId', 'dur', 'views', 'viewsAt', 'likes', 'comments', 'series', 'firstIdx', 'titles', 'thumbs', 'descs']
const pick = <T extends object>(o: any, keys: (keyof T)[]): T => Object.fromEntries(keys.map(k => [k, structuredClone(o[k as string] ?? null)])) as T

/** INPUT fields only — the engine must derive vpd/vpd7/mult/changes/effects itself. */
export function datasetFromOracle(o: Oracle): Dataset {
  const channels: ObsChannel[] = o.channels.map((c: any) => ({
    id: c.id, name: c.name, fullName: c.fullName ?? c.name, niche: c.niche, own: !!c.own, lang: c.lang, subs: c.subs,
    video_limit: c.video_limit, url: c.url, handle: c.handle, gender: c.gender ?? 'n', color: c.color, ini: c.ini,
    sync: { state: c.sync.state, last: c.sync.last, next: c.sync.next ?? null, added: c.sync.added, errorSince: c.sync.errorSince ?? null, msg: c.sync.msg ?? null, backfill: c.sync.backfill ?? null },
    activity: structuredClone(c.activity), lastIdx: c.lastIdx, snapshots: structuredClone(c.snapshots),
  }))
  const videos: ObsVideo[] = o.videos.map((v: any) => pick<ObsVideo>(v, VIDEO_INPUT))
  return {
    now: o.NOW, seriesStart: o.SERIES_START, snap0: o.date.snapTime(0), obsStart: o.OBS_START, channels, videos,
    sync: { last: o.SYNC.last, next: o.SYNC.next },
    readings: structuredClone(o.forja.readings), requests: structuredClone(o.forja.requests.filter((r: any) => !r.scenario)),
    queue: { lastPollAt: o.forja.queue.lastPollAt, tickMinutes: o.forja.queue.tickMinutes, capabilities: ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] },
  }
}

export interface SuiteResult { name: string; section: string; ok: boolean; detail: string }
/** Runs dados-teste.html's <script id="tests"> VERBATIM with root.OBS = facade. */
export function runMockupSuite(facade: unknown): SuiteResult[] {
  const html = fs.readFileSync(path.join(DIR, 'dados-teste.html'), 'utf8')
  let src = html.match(/<script id="tests">([\s\S]*?)<\/script>/)![1]!
  const before = src
  src = src.replace(/\/\* ---------- (.+?) ---------- \*\//g, (_m, s: string) => `root.__SEC = ${JSON.stringify(s)};`)
  src = src.replace('R.push({ name, ok, detail });', 'R.push({ name, ok, detail, section: root.__SEC });')
  if (src === before || !src.includes('section: root.__SEC')) throw new Error('mockup suite instrumentation failed — dados-teste.html changed shape')
  const ctx: Record<string, unknown> = { OBS: facade, console: { log() {}, error() {} } }
  vm.createContext(ctx)
  vm.runInContext(src, ctx)
  return (ctx.__OBS_TEST as { results: SuiteResult[] }).results
}
```

```ts
// apps/web/test/youtube/observatorio/suite-pending.ts
/** Sections of dados-teste.html not yet ported. Each P2/P4 task deletes the sections it ports. */
export const PENDING_SECTIONS = new Set<string>([
  'calendário', 'contagens das abas', 'outliers', 'n possíveis pela cadência', 'limites e sincronização',
  'série diária', 'trocas: precisão', 'efeito', 'exemplos do BRIEF', 'forja', 'catálogos',
  'texto das leituras (singular/plural e status cru)', 'rodada F2 (reviews/f2/*.md, MOTOR)',
  'rodada F3 (reviews/f3/*.md, MOTOR)', 'rodada F4 (CONVENCOES "RODADA F4", reviews/f4)', 'rodada F5 (reviews/f5/fixes.md, MOTOR)',
])
/** Permanently out of the production port, with the reason. */
export const NOT_PORTED = new Map<string, string>([
  ['determinismo', 'tests the mockup PRNG generator (O._build); production data is not generated'],
])
/** Single tests that need a browser sessionStorage (mockup-only persistence; production state lives in the DB). */
export const NOT_PORTED_TESTS = new Set<string>([
  '[F8] runSync persiste em sessionStorage["obs-sync"] e é reaplicado na carga; resetSync limpa; seu canal intocado',
  '[F9] forja.session: estado único de pedidos — setBase, ask (só nichos livres, ordem dos cliques), cancel, current(nicho|todos), reset, persistência',
])
```

- [ ] **Step 4: Write the suite test (fails until the facade exists)**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/mockup-suite.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle, runMockupSuite } from './oracle'
import { PENDING_SECTIONS, NOT_PORTED, NOT_PORTED_TESTS } from './suite-pending'
import { createObservatory } from '@/lib/youtube/observatorio'

const oracle = loadOracle()
const onOracle = runMockupSuite(oracle)
const onProd = runMockupSuite(createObservatory(datasetFromOracle(loadOracle())))

describe('mockup suite (dados-teste.html) — oracle sanity', () => {
  it('the oracle passes everything except the browser-only tests', () => {
    const fails = onOracle.filter(r => !r.ok).map(r => r.name)
    expect(fails.sort()).toEqual([...NOT_PORTED_TESTS].sort())
  })
})
describe('mockup suite (dados-teste.html) — production engine, verbatim', () => {
  const ported = onProd.filter(r => !PENDING_SECTIONS.has(r.section) && !NOT_PORTED.has(r.section) && !NOT_PORTED_TESTS.has(r.name))
  it.each(ported.map(r => [r.section + ' › ' + r.name, r] as const))('%s', (_n, r) => {
    expect(r.ok, r.detail).toBe(true)
  })
  it('every section is either ported, pending or explicitly not ported', () => {
    const known = new Set([...PENDING_SECTIONS, ...NOT_PORTED.keys(), ...new Set(onProd.map(r => r.section))])
    expect(onProd.every(r => known.has(r.section))).toBe(true)
  })
})
```
`it.each` over an empty list throws in Vitest. While every section is pending, the "ported" list holds only `nada depois de NOW` (data-only; it should pass as soon as the facade exposes `videos/changes/channels`). The facade stub must expose `changes: []` and `forja: { readings: [] }` so that test can run. If Vitest still complains about an empty table, guard with `if (ported.length)`.

- [ ] **Step 5: Write the facade stub**

```ts
// apps/web/src/lib/youtube/observatorio/index.ts
import type { Dataset, ObsChannel, ObsVideo } from './types'
export type { Dataset } from './types'

export interface Observatory {
  NOW: number; SERIES_START: number; DAY: number; H: number
  channels: ObsChannel[]; videos: ObsVideo[]
  channel(id: string): ObsChannel | undefined; video(id: string): ObsVideo | undefined
  changes: unknown[]; forja: { readings: unknown[] }
}
export function createObservatory(ds: Dataset): Observatory {
  const CH = new Map(ds.channels.map(c => [c.id, c])), V = new Map(ds.videos.map(v => [v.id, v]))
  return {
    NOW: ds.now, SERIES_START: ds.seriesStart, DAY: 864e5, H: 36e5,
    channels: ds.channels, videos: ds.videos, channel: id => CH.get(id), video: id => V.get(id),
    changes: [], forja: { readings: ds.readings },
  }
}
```
Later tasks grow `Observatory` and `createObservatory`; the facade keeps the `OBS` method names exactly (`effect`, `multiplier`, `outliers`, `changesIn`, `tabCounts`, `cadence`, `channelStats`, `date`, `fmt`, `RULES`, …) because the verbatim suite calls them.

- [ ] **Step 6: Run**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/mockup-suite.test.ts`
Expected: PASS: oracle sanity (188/190; the 2 failures are exactly the browser-only tests) and the `nada depois de NOW` test passes on production.

- [ ] **Step 7: Commit**

```bash
git add apps/web/test/fixtures/observatorio apps/web/test/youtube/observatorio/oracle.ts apps/web/test/youtube/observatorio/suite-pending.ts apps/web/test/youtube/observatorio/mockup-suite.test.ts apps/web/src/lib/youtube/observatorio/types.ts apps/web/src/lib/youtube/observatorio/index.ts
git commit -m "test: oráculo do motor do observatório e a suíte do mockup rodando verbatim contra a fachada

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 13: Rules, São Paulo clock, pt-BR formatting, stats

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/{rules,time,fmt,stats}.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/index.ts` (expose `RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, date, fmt, median, quant, bandOf, winOf, tierOf, SYNC, LAST_IDX, TZ, TZ_LABEL, SERIES_START_LABEL`)
- Modify: `apps/web/test/youtube/observatorio/suite-pending.ts` (delete `'calendário'`)
- Test: `apps/web/test/youtube/observatorio/time.test.ts`

**Interfaces:**
- Produces:
```ts
// time.ts
export interface Clock { now: number; seriesStart: number; snap0: number; snapTime(i: number): number; snapIdxAtOrAfter(t: number): number; snapIdxAtOrBefore(t: number): number
  parts(ms: number): { y: number; mo: number; d: number; h: number; mi: number; dow: number }
  dm(ms: number): string; dmy(ms: number): string; dmOrDmy(ms: number): string; hm(ms: number): string; hh(ms: number): string; dmhm(ms: number): string
  weekday(ms: number): string; weekdayShort(ms: number): string; ago(ms: number): string; agoHours(ms: number): string; daysAgo(ms: number): number
  windowText(a: number, b: number): string; dur(ms: number, approx?: boolean): string; spIso(s: string): number; sp(y: number, mo: number, d: number, h?: number, mi?: number): number }
export function createClock(now: number, seriesStart: number, snap0: number): Clock
export const DAY = 864e5, H = 36e5, MINUS = '−'
// fmt.ts
export interface Fmt { num(v: number | null): string; subs(v: number | null): string; int(v: number): string; mult(x: number | null): string; pct(x: number | null): string; pp(x: number | null): string; dec1(x: number): string; plural(n: number, one: string, many: string): string; verVideos(n: number): string; age(v: { ageDays?: number | null; pub: number } | null): string; lcfirst(t: string): string; labelReason(label: string, reason: string, o?: { sentence?: boolean }): string }
export function createFmt(clock: Clock): Fmt
// rules.ts — RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, bandOf, winOf, tierOf  (exact values of dados.js:113-133)
// stats.ts
export function median(a: number[]): number | null
export function quant(a: number[], q: number): number | null
```

- [ ] **Step 1: Failing tests (hand-written rules + Review Focus 1)**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/time.test.ts
import { describe, it, expect } from 'vitest'
import { createClock, DAY } from '@/lib/youtube/observatorio/time'
import { createFmt } from '@/lib/youtube/observatorio/fmt'
import { median, quant } from '@/lib/youtube/observatorio/stats'

const sp = (iso: string) => Date.parse(iso + '-03:00')
const NOW = sp('2026-10-24T15:02:00'), START = sp('2026-10-03T00:00:00'), SNAP0 = sp('2026-10-03T12:00:00')
const c = createClock(NOW, START, SNAP0), f = createFmt(c)

describe('São Paulo clock', () => {
  it('weekday from the real calendar', () => {
    expect(c.weekday(NOW)).toBe('sábado')
    expect(c.weekday(sp('2026-10-20T12:00:00'))).toBe('terça')
    expect(c.weekday(sp('2026-05-31T12:00:00'))).toBe('domingo')
  })
  it('ago: hours below 48 h, rounded days after, "agora" under a minute, never negative', () => {
    expect(c.ago(NOW - 39 * 36e5)).toBe('há 39 h')
    expect(c.ago(NOW - 3 * DAY)).toBe('há 3 dias')
    expect(c.ago(NOW - 30_000)).toBe('agora')
    expect(c.ago(NOW + 60_000)).toBe('no futuro')
  })
  it('windowText across midnight', () => {
    expect(c.windowText(sp('2026-10-21T18:00:00'), sp('2026-10-22T00:00:00'))).toBe('entre 21/10 18h e 22/10 00h')
    expect(c.windowText(sp('2026-10-24T06:00:00'), sp('2026-10-24T12:00:00'))).toBe('entre 24/10 06h e 12h')
  })
  it('snap index 21 is 24/10 12:00', () => expect(c.dmhm(c.snapTime(21))).toBe('24/10 12:00'))
  it('labels follow dataset.seriesStart, not a hardcoded 03/10 (Review Focus 1)', () => {
    const late = createClock(sp('2026-11-20T10:00:00'), sp('2026-11-02T00:00:00'), sp('2026-11-02T12:00:00'))
    expect(late.dm(late.seriesStart)).toBe('02/11')
  })
})
describe('pt-BR numbers', () => {
  it('num/mult/pct/pp with U+2212', () => {
    expect(f.num(207_600)).toBe('207,6 mil'); expect(f.num(1_900_000)).toBe('1,9 mi'); expect(f.num(-1500)).toBe('−1,5 mil')
    expect(f.mult(4)).toBe('4,0×'); expect(f.pct(-0.41)).toBe('−41%'); expect(f.pp(-3.4)).toBe('−3 pp'); expect(f.pp(12.6)).toBe('+13 pp')
  })
  it('subs keeps 3 significant digits', () => { expect(f.subs(3214)).toBe('3,21 mil'); expect(f.subs(128_400)).toBe('128 mil') })
  it('age uses whole days, hours under a day', () => {
    expect(f.age({ ageDays: 30, pub: NOW - 30.9 * DAY })).toBe('há 30 dias')
    expect(f.age({ ageDays: 0, pub: NOW - 11 * 36e5 })).toBe('há 11 h')
  })
  it('labelReason never chains separators', () => {
    expect(f.labelReason('inconclusivo', 'Antes: 1 dia — pouco para comparar.')).toBe('inconclusivo. Antes: 1 dia — pouco para comparar.')
  })
})
describe('stats', () => {
  it('median/quant', () => { expect(median([3, 1, 2, 4])).toBe(2.5); expect(median([])).toBeNull(); expect(quant([1, 2, 3, 4, 5], 0.25)).toBe(2) })
})
```

- [ ] **Step 2: Run → FAIL** (`cd apps/web && npx vitest run test/youtube/observatorio/time.test.ts`)

- [ ] **Step 3: Implement by porting**

- `time.ts`: port `dados.js:20-79`. Replace the constant `NOW` with the `now` parameter, `SNAP0` with `snap0`, and `isSaturday24` is dropped.

```ts
// apps/web/src/lib/youtube/observatorio/time.ts — port of dados.js:20-79 with NOW/SNAP0 as parameters
export const DAY = 864e5, H = 36e5, MINUS = '−'
const SP_OFF = 3 * H // America/Sao_Paulo is UTC−3, no DST since 2019
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const p2 = (n: number) => (n < 10 ? '0' : '') + n

export function createClock(now: number, seriesStart: number, snap0: number): Clock {
  const sp = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) + SP_OFF
  const parts = (ms: number) => { const d = new Date(ms - SP_OFF); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() } }
  const dm = (ms: number) => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) }
  const hm = (ms: number) => { const p = parts(ms); return p2(p.h) + ':' + p2(p.mi) }
  const thisYear = parts(now).y
  return {
    now, seriesStart, snap0, sp, parts,
    spIso: s => { const a = s.split(/[-T:]/).map(Number); return sp(a[0]!, a[1]!, a[2]!, a[3] ?? 0, a[4] ?? 0) },
    snapTime: i => snap0 + i * DAY,
    snapIdxAtOrAfter: t => Math.ceil((t - snap0) / DAY - 1e-9),
    snapIdxAtOrBefore: t => Math.floor((t - snap0) / DAY + 1e-9),
    dm, hm,
    dmy: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) + '/' + p.y },
    dmOrDmy: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) + (p.y !== thisYear ? '/' + p.y : '') },
    hh: ms => p2(parts(ms).h) + 'h',
    dmhm: ms => dm(ms) + ' ' + hm(ms),
    weekday: ms => WD[parts(ms).dow]!,
    weekdayShort: ms => WDS[parts(ms).dow]!,
    ago: ms => {
      const d = now - ms
      if (d < 0) return 'no futuro'
      if (d < 6e4) return 'agora'
      if (d < H) return 'há ' + Math.max(1, Math.round(d / 6e4)) + ' min'
      if (d < 48 * H) return 'há ' + Math.round(d / H) + ' h'
      const n = Math.round(d / DAY); return 'há ' + n + (n === 1 ? ' dia' : ' dias')
    },
    agoHours: ms => 'há ' + Math.round((now - ms) / H) + ' h',
    daysAgo: ms => Math.floor((now - ms) / DAY),
    windowText: (a, b) => {
      const pa = parts(a), pb = parts(b), same = pa.d === pb.d && pa.mo === pb.mo
      return 'entre ' + dm(a) + ' ' + p2(pa.h) + 'h e ' + (same ? '' : dm(b) + ' ') + p2(pb.h) + 'h'
    },
    dur: (ms, approx) => {
      if (approx) { const d = Math.round(ms / DAY); return d >= 1 ? '≈ ' + d + ' d' : '≈ ' + Math.round(ms / H) + ' h' }
      const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / H), mi = Math.round((ms % H) / 6e4)
      return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + mi + ' min' : mi + ' min'
    },
  }
}
```
**Production window rule:** batches make real sync times like 06:20. `windowText` receives `[floorHour(window_start), ceilHour(window_end)]` from the loader (Task 20), so the printed window always CONTAINS the real one ("entre 24/10 06h e 13h"). It never narrows it. Add to `time.test.ts`: `windowText(floorHour(sp('…06:20')), ceilHour(sp('…12:40')))` → `'entre 24/10 06h e 13h'`. Export `floorHour`/`ceilHour` from `time.ts`.
`dmOrDmy` in the mockup compares with the literal `2026`. In the port, compare with `parts(now).y`, so the year shows when it differs from today's (this is the only intentional deviation; add a test case for it).

- `fmt.ts`: port `dados.js:81-105`. `fmt.age` takes the video object (production never looks videos up by id inside `fmt`).
- `rules.ts`: port `dados.js:113-133` + `tierOf` (`dados.js` return block) + `NICHES` labels/colours.
- `stats.ts`: port `dados.js:109-110`.
- `index.ts`: build `clock` and `fmt` in `createObservatory` and expose them as `date` and `fmt`.
  - `SYNC = { last, next, text: 'sincronizado ' + clock.ago(last), title: dm(last)+' '+hm(last)+' (SP)', nextText: next ? 'próxima às ' + hm(next) : null }`
  - `LAST_IDX = clock.snapIdxAtOrBefore(max point t over all videos)`
  - `TZ = 'America/Sao_Paulo'`, `TZ_LABEL = 'Horários em São Paulo'`
  - `SERIES_START_LABEL = clock.dm(seriesStart)`
- Delete `'calendário'` from `PENDING_SECTIONS`.

- [ ] **Step 4: Run** `cd apps/web && npx vitest run test/youtube/observatorio/` → PASS (time tests + the `calendário` section verbatim).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/rules.ts apps/web/src/lib/youtube/observatorio/time.ts apps/web/src/lib/youtube/observatorio/fmt.ts apps/web/src/lib/youtube/observatorio/stats.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/time.test.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor do observatório — regras, relógio de São Paulo e números pt-BR portados do mockup

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 14: Series, text comparison and change events

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/{series,text-diff,changes}.ts`
- Modify: `index.ts` (expose `seriesOf, viewsAt, rate, periodRate, expectedCurve, diffLines, titleDiff, changes, change, changesIn, caveats, rewriteGroups`; set `video.vpd`, `video.vpd7`)
- Modify: `suite-pending.ts` (delete `'série diária'`, `'trocas: precisão'`)
- Test: `apps/web/test/youtube/observatorio/changes-parity.test.ts`, `text-diff.test.ts`

**Interfaces:**
- Produces:
```ts
// series.ts
export interface EngineCtx { ds: Dataset; clock: Clock; fmt: Fmt; CH: Map<string, ObsChannel & { videos: ObsVideo[] }>; V: Map<string, ObsVideo & Derived>; CHG: Map<string, ObsChange> }
export interface Derived { vpd: number | null; vpd7: number | null; mult: MultiplierResult }
export function pointViews(ctx: EngineCtx, v: ObsVideo, i: number): number | null
export function pointTime(ctx: EngineCtx, v: ObsVideo, i: number): number
export function earliestIdx(v: ObsVideo, seriesStart: number): number
export function rate(ctx: EngineCtx, v: ObsVideo, a: number, b: number): number | null
export function vpdSince(ctx: EngineCtx, v: ObsVideo): number | null
export function vpd7(ctx: EngineCtx, v: ObsVideo): number | null
export function viewsAtAge(ctx: EngineCtx, u: ObsVideo, ageMs: number, tMax: number | null): number | null
export function periodRate(ctx: EngineCtx, videoId: string, fromMs: number, toMs: number): { vpd: number | null; sharedDay: boolean; onlySinceDays: number | null; coveredHours: number; text: string }
export function expectedCurve(ctx: EngineCtx, videoId: string): Array<{ idx: number; t: number; from: number; lifeDay: number; vpd: number; n: number; vpdAnchored: number | null; nAnchored: number; observed: number | null }> & { method: string; methodLabel: string; band: string }
// text-diff.ts
export function stripUtm(s: string): string
export function diffLines(a: string[], b: string[]): { lines: Array<{ op: 'ctx' | 'add' | 'rem' | 'utm'; text: string; from?: string }>; add: number; rem: number; utm: number; label: string }
export function titleDiff(a: string, b: string): TitleDiff
// changes.ts
export interface ObsChange { id: string; video: string; ch: string; niche: Niche | null; fmt: Fmt; type: 'title' | 'thumb' | 'desc'; typeLabel: string; idx: number; at: number; prec: Precision; window: [number, number] | null; preSeries: boolean; before: unknown; after: unknown; fromId: string; toId: string; mid: number; whenText: string; agoMidText: string; agoShort: string; agoText: string; prevLivedMs?: number; nextLivedMs?: number; revertTo: string | null; revertedBy?: string; testCompare?: boolean; cycleMs?: number | null; diff?: ReturnType<typeof diffLines> | null; hasText?: boolean; noTextReason?: string; titleDiff?: TitleDiff; rewriteGroup?: string; sameWindow: string[]; within48h: string[] }
export function deriveChanges(ctx: EngineCtx): ObsChange[]
export function changesIn(ctx: EngineCtx, o?: { days?: number | null; niche?: NicheScope; type?: string | null; channel?: string | null; video?: string | null; fmt?: Fmt | null }): ObsChange[]
export function caveats(ctx: EngineCtx, changeId: string): string[]
```
**Production rule (Review Focus 4):** `pointViews(ctx, v, i)` looks the point up by `idx` in a per-video `Map<number, SeriesPoint>` built once. The mockup's `v.series[i - v.firstIdx]` assumes a contiguous series. A missing day returns `null`, and `rate` then returns `null`. Add to `changes-parity.test.ts`:
```ts
it('a hole returns null, later points keep their idx', () => {
  const ds = datasetFromOracle(loadOracle()); const v = ds.videos.find(x => x.series.length > 5)!
  const gone = v.series[2]!.idx; v.series = v.series.filter(p => p.idx !== gone)
  const p = createObservatory(ds)
  expect(p.viewsAt(v.id, gone)).toBeNull()
  expect(p.viewsAt(v.id, gone + 1)).toBe(v.series.find(x => x.idx === gone + 1)!.views)
})
```
Ports: `series.ts` ← `dados.js:587-597, 743-750, 1088-1130`; `text-diff.ts` ← `598-613, 1293-1320`; `changes.ts` ← `614-655, 736-741, 843-846, 1321-1330`, plus the `titleDiff`/`revertTo` pass (lines 1318-1319).
The generator loop `dados.js:556-584` is NOT ported. The series comes from data.
`noTextReason` = `'Antes de ' + dm(seriesStart) + ' a sincronização só registrava que a descrição mudou, sem guardar o texto.'`

- [ ] **Step 1: Parity test (production vs oracle, every change)**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/changes-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
const FIELDS = ['id', 'type', 'at', 'prec', 'window', 'preSeries', 'whenText', 'agoText', 'agoShort', 'revertTo', 'testCompare', 'cycleMs', 'sameWindow', 'within48h', 'hasText', 'rewriteGroup'] as const

describe('changes parity with dados.js', () => {
  it('same change ids in the same order', () => {
    expect(P.changes.map(c => c.id)).toEqual(O.changes.map((c: { id: string }) => c.id))
  })
  it.each(O.changes.map((c: { id: string }) => [c.id]))('%s', id => {
    const p = P.change(id)!, o = O.change(id)
    for (const k of FIELDS) expect(p[k as keyof typeof p], k).toEqual(o[k] ?? (k === 'revertTo' ? null : o[k]))
    if (o.diff) expect(p.diff).toEqual(o.diff)
    if (o.titleDiff) expect(p.titleDiff).toEqual(o.titleDiff)
  })
  it('vpd / vpd7 per video', () => {
    for (const v of O.videos) { expect(P.video(v.id)!.vpd).toBe(v.vpd); expect(P.video(v.id)!.vpd7).toBe(v.vpd7) }
  })
  it('changesIn default window = 30 days, competitors only → 18 events', () => {
    expect(P.changesIn({}).length).toBe(18)
    expect(P.changesIn({ niche: 'viagem' }).length).toBe(8)
    expect(P.changesIn({ niche: 'ia' }).length).toBe(10)
  })
})
```

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/text-diff.test.ts
import { describe, it, expect } from 'vitest'
import { titleDiff, diffLines, stripUtm } from '@/lib/youtube/observatorio/text-diff'

describe('titleDiff', () => {
  it('a word present in both titles is "mudou de lugar", not removed/added', () => {
    const d = titleDiff('Claude Opus 5.5 Is Crazy Good', 'Claude Opus 5.5 Didn’t Need to Go This Hard')
    expect(d.removed).not.toContain('Claude')
  })
  it('case-only changes are op "case"', () => {
    const d = titleDiff('this ai model is insanely fast', 'This AI Model Is INSANELY Fast')
    expect(d.hasCaseChange).toBe(true); expect(d.removed).toEqual([]); expect(d.added).toEqual([])
  })
  it('repeated words match by count ($1M twice → once)', () => {
    const d = titleDiff('How I Built a $1M Solo AI Business ($0 to $1M)', 'I Forced Myself to Build $1M Business with AI')
    expect(d.removed.filter(w => w.includes('$1M')).length).toBe(1)
  })
})
describe('diffLines', () => {
  it('UTM-only edits are "utm", not add/rem', () => {
    const d = diffLines(['https://x.co/?utm_source=a'], ['https://x.co/?utm_source=b'])
    expect(d).toMatchObject({ add: 0, rem: 0, utm: 1, label: '+0 −0 linhas + 1 UTM' })
  })
  it('stripUtm keeps other params', () => expect(stripUtm('https://x.co/?a=1&utm_x=2')).toBe('https://x.co/?a=1'))
})
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Port** the cited lines into the three files. Wire `deriveChanges` and `vpd/vpd7` into `createObservatory` (computed once, cached on the ctx). Delete the two sections from `PENDING_SECTIONS`.

- [ ] **Step 4: Run** `cd apps/web && npx vitest run test/youtube/observatorio/` → PASS, including the verbatim `série diária` and `trocas: precisão` sections.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/series.ts apps/web/src/lib/youtube/observatorio/text-diff.ts apps/web/src/lib/youtube/observatorio/changes.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/changes-parity.test.ts apps/web/test/youtube/observatorio/text-diff.test.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor do observatório — série diária, comparação de título e descrição e eventos de troca

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 15: Effect of a change (observed vs expected by age)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/effect.ts`
- Modify: `index.ts` (expose `effect`, `effectAt`)
- Modify: `suite-pending.ts` (delete `'efeito'`)
- Test: `apps/web/test/youtube/observatorio/effect.test.ts` (hand-written rules) + `effect-parity.test.ts`

**Interfaces:**
- Consumes: `EngineCtx`, `rate`, `pointTime`, `earliestIdx`, `ObsChange`, `median`, `quant`, `bandOf`, `RULES`.
- Produces:
```ts
export type EffectStatus = 'ganhou' | 'perdeu' | 'neutro' | 'inconclusivo' | 'aguardando' | 'sem-serie' | 'sem-antes'
export interface EffectResult {
  id: string; type: string; status: EffectStatus; label: string; reason: string
  k?: number; beforeDays?: number; afterDays?: number; readyOn?: number; readyText?: string | null; readyTextIfPending?: string; firstPointAfter?: number
  daily?: { before: DailyRow[]; changeDay: DailyRow | null; after: DailyRow[] }
  collected?: number; willBeInconclusive?: string | null; willBeInconclusiveShort?: string | null; waitText?: string
  observed?: number; beforeAvg?: number; afterAvg?: number; expected?: number | null; iqr?: [number | null, number | null]; n?: number; effectPp?: number | null
  band?: string; method?: 'mesmo dia de vida' | 'aproximação por faixa'; methodLabel?: string; methodFallback?: boolean; sameDayN?: number | null; fallbackText?: string | null
  numbers?: string; numbersFlat?: string; noBaseText?: string | null; inconclusiveKind?: 'janela-dupla' | 'versao-curta' | 'antes-curto' | 'outro'; neutralWhy?: 'ambos' | 'menor-que-10pp' | 'dentro-da-faixa'
}
export interface DailyRow { idx: number; from: number; to: number; vpd: number | null }
export function effectAt(ctx: EngineCtx, changeId: string, Lcap: number | null): EffectResult | null
export function effect(ctx: EngineCtx, changeId: string): EffectResult | null
```

Port `dados.js:656-735` exactly. The code below is the port, written out so nobody "improves" it. Only globals are replaced. The literal `'(coleta por vídeo desde 03/10)'` becomes `'(coleta por vídeo desde ' + clock.dm(ds.seriesStart) + ')'`.

```ts
// apps/web/src/lib/youtube/observatorio/effect.ts
import { RULES, bandOf } from './rules'
import { median, quant } from './stats'
import { rate, pointTime, earliestIdx } from './series'
import type { EngineCtx } from './series'
import type { ObsVideo } from './types'
import { DAY, H } from './time'

const changedSince = (ctx: EngineCtx, v: ObsVideo) => [v.titles, v.thumbs, v.descs].some(arr => arr.some((x, j) => j > 0 && x.first_seen >= ctx.ds.seriesStart))
const firstRealIdx = (v: ObsVideo) => v.firstIdx!
function ratioAt(ctx: EngineCtx, u: ObsVideo, k: number, b: number, Lcap: number | null) {
  const end = k - 1, start = end - b
  if (start < firstRealIdx(u) || k + 7 > Math.min(u.series[u.series.length - 1]!.idx, Lcap == null ? 1e9 : Lcap)) return null
  const rb = rate(ctx, u, start, end), ra = rate(ctx, u, k, k + 7)
  if (rb == null || ra == null || rb <= 0) return null
  return { r: ra / rb - 1, rb, ra }
}
const cache = new WeakMap<EngineCtx, Map<string, EffectResult>>()
export function effect(ctx: EngineCtx, changeId: string) { return effectAt(ctx, changeId, null) }
export function effectAt(ctx: EngineCtx, changeId: string, Lcap: number | null): EffectResult | null {
  const memo = cache.get(ctx) ?? new Map<string, EffectResult>(); cache.set(ctx, memo)
  const key = changeId + '@' + (Lcap ?? ''); const hit = memo.get(key); if (hit) return hit
  const c = ctx.CHG.get(changeId); if (!c) return null
  const v = ctx.V.get(c.video)!, ch = ctx.CH.get(v.ch)!, { clock, fmt } = ctx, S0 = clock.dm(ctx.ds.seriesStart)
  const res = { id: c.id, type: c.type } as EffectResult
  const done = (x: Partial<EffectResult>) => { Object.assign(res, x); memo.set(key, res); return res }
  if (c.preSeries) return done({ status: 'sem-serie', label: 'sem série', reason: 'Sem série antes da troca (coleta por vídeo desde ' + S0 + ').' })
  if (!v.series.length || ch.lastIdx == null) return done({ status: 'sem-serie', label: 'sem série', reason: 'Vídeo sem série diária de views.' })
  const k = clock.snapIdxAtOrAfter(c.at), L = Lcap == null ? ch.lastIdx : Math.min(ch.lastIdx, Lcap)
  const beforeDays = Math.max(0, Math.min(RULES.effect.maxBeforeDays, (k - 1) - firstRealIdx(v)))
  const afterDays = Math.max(0, Math.min(7, L - k))
  const wdR = clock.weekday(clock.snapTime(k + 7))
  const readyTextIfPending = 'leitura ' + (/^(segunda|terça|quarta|quinta|sexta)/.test(wdR) ? 'na ' : 'no ') + wdR + ', ' + clock.dm(clock.snapTime(k + 7))
  Object.assign(res, { k, beforeDays, afterDays, readyOn: clock.snapTime(k + 7), readyText: null, readyTextIfPending, firstPointAfter: clock.snapTime(k) })
  const dRow = (i: number): DailyRow => ({ idx: i + 1, from: pointTime(ctx, v, i), to: pointTime(ctx, v, i + 1), vpd: rate(ctx, v, i, i + 1) })
  res.daily = {
    before: Array.from({ length: beforeDays }, (_, j) => dRow(k - 1 - beforeDays + j)),
    changeDay: k >= 1 && k - 1 >= earliestIdx(v, ctx.ds.seriesStart) ? dRow(k - 1) : null,
    after: Array.from({ length: afterDays }, (_, j) => dRow(k + j)),
  }
  const simul = c.sameWindow.length ? 'same' : c.within48h.length ? '48h' : null
  const simulTxt = simul === 'same' ? 'Dois campos do mesmo vídeo mudaram na mesma janela de sincronização: o efeito é dos dois e não dá para separar.'
    : simul === '48h' ? 'Outro campo do mesmo vídeo mudou a menos de 48 h: não dá para separar o efeito de cada um.' : null
  if (beforeDays === 0) return done({ status: 'sem-antes', label: 'sem base', reason: 'A versão anterior durou menos de 1 dia, antes do primeiro registro diário: sem dias antes para comparar.' })
  if (afterDays < 7) {
    const shortWhy = simul === 'same' ? 'dois campos do vídeo mudaram na mesma janela de sincronização' : simul === '48h' ? 'outro campo do vídeo mudou a menos de 48 h' : beforeDays <= 2 ? 'só ' + fmt.plural(beforeDays, 'dia', 'dias') + ' antes da troca' : null
    return done({ readyText: readyTextIfPending, status: 'aguardando', label: 'aguardando', collected: afterDays,
      reason: 'aguardando — ' + afterDays + ' de 7 dias coletados, leitura em ' + clock.dm(clock.snapTime(k + 7)),
      willBeInconclusive: simulTxt || (beforeDays <= 2 ? 'Antes: ' + beforeDays + (beforeDays === 1 ? ' dia' : ' dias') + ' — pouco para comparar.' : null),
      willBeInconclusiveShort: shortWhy,
      waitText: 'Aguardando: ' + afterDays + ' de 7 dias coletados, ' + readyTextIfPending + '.' + (shortWhy ? ' Vai sair inconclusivo: ' + shortWhy + '.' : '') })
  }
  const ob = ratioAt(ctx, v, k, beforeDays, L)
  // PRODUCTION GUARD (not in dados.js, whose fixture has no holes): a day without a daily record
  // around the change makes the ratio uncomputable. Say so; never crash, never invent.
  if (!ob) return done({ status: 'inconclusivo', inconclusiveKind: 'outro', label: 'inconclusivo', reason: 'Faltam registros diários em volta da troca: não dá para medir.' })
  const ageAtK = (clock.snapTime(k) - v.pub) / DAY, band = bandOf(Math.floor(ageAtK))
  const sameDay = v.pub >= ctx.ds.seriesStart
  const peers = ctx.CH.get(v.ch)!.videos.filter(u => u !== v && u.fmt === v.fmt && u.series.length > 0 && !changedSince(ctx, u))
  const byBand = (): number[] => {
    const out: number[] = []
    for (const u of peers) {
      let best: number | null = null
      for (let ku = firstRealIdx(u) + beforeDays + 1; ku + 7 <= L; ku++) {
        const a = Math.floor((clock.snapTime(ku) - u.pub) / DAY); if (bandOf(a) !== band) continue
        if (best == null || Math.abs(a - ageAtK) < Math.abs(Math.floor((clock.snapTime(best) - u.pub) / DAY) - ageAtK)) best = ku
      }
      if (best != null) { const x = ratioAt(ctx, u, best, beforeDays, L); if (x) out.push(x.r) }
    }
    return out
  }
  let rs: number[] = [], methodUsed: 'mesmo dia de vida' | 'aproximação por faixa' = 'aproximação por faixa', sameDayN: number | null = null
  if (sameDay) {
    for (const u of peers) { if (u.pub < ctx.ds.seriesStart) continue; const x = ratioAt(ctx, u, u.firstIdx! + (k - v.firstIdx!), beforeDays, L); if (x) rs.push(x.r) }
    sameDayN = rs.length
    if (rs.length >= RULES.weakBase) methodUsed = 'mesmo dia de vida'; else rs = byBand()
  } else rs = byBand()
  const n = rs.length, exp = median(rs), q1 = quant(rs, 0.25), q3 = quant(rs, 0.75)
  res.noBaseText = n === 0 ? 'sem base de comparação: nenhum outro vídeo do canal na faixa ' + band.label + ' (n = 0)' : null
  const eff = exp == null ? null : (ob.r - exp) * 100
  const fallback = sameDay && methodUsed !== 'mesmo dia de vida'
  Object.assign(res, { observed: ob.r, beforeAvg: ob.rb, afterAvg: ob.ra, expected: exp, iqr: [q1, q3], n, effectPp: eff, band: band.label,
    method: methodUsed, methodLabel: 'método: ' + methodUsed, methodFallback: fallback, sameDayN,
    fallbackText: fallback ? 'método: aproximação por faixa — menos de 3 vídeos do canal com série desde o dia 0' : null,
    numbers: 'observado ' + fmt.pct(ob.r) + ' · esperado ' + fmt.pct(exp) + ' (n = ' + n + ')',
    numbersFlat: 'observado ' + fmt.pct(ob.r) + ' · esperado ' + fmt.pct(exp) + ' · n = ' + n })
  const arr = c.type === 'title' ? v.titles : c.type === 'thumb' ? v.thumbs : v.descs
  const nextVer = arr[c.idx]!
  if (!nextVer.current && nextVer.last_seen - nextVer.first_seen < DAY) return done({ inconclusiveKind: 'versao-curta', status: 'inconclusivo', label: 'inconclusivo', reason: 'A nova versão ficou menos de 1 dia no ar (' + clock.dur(nextVer.last_seen - nextVer.first_seen) + '): com um registro de views por dia não dá para isolar.' })
  if (c.prevLivedMs != null && c.prevLivedMs < DAY) return done({ inconclusiveKind: 'versao-curta', status: 'inconclusivo', label: 'inconclusivo', reason: 'A versão anterior ficou menos de 1 dia no ar (' + clock.dur(c.prevLivedMs) + '): pouco para comparar.' })
  if (simulTxt) return done({ inconclusiveKind: 'janela-dupla', status: 'inconclusivo', label: 'inconclusivo', reason: simulTxt })
  if (beforeDays <= 2) return done({ inconclusiveKind: 'antes-curto', status: 'inconclusivo', label: 'inconclusivo', reason: 'Antes: ' + beforeDays + (beforeDays === 1 ? ' dia' : ' dias') + ' — pouco para comparar.' })
  if (n < RULES.effect.minN || eff == null) return done({ inconclusiveKind: 'outro', status: 'inconclusivo', label: 'inconclusivo', reason: 'Poucos vídeos do canal para comparar (n = ' + n + ', mínimo ' + RULES.effect.minN + ').' })
  const out = ob.r < q1! || ob.r > q3!, band_ = '(' + fmt.pct(q1) + ' a ' + fmt.pct(q3) + ')'
  if (eff > RULES.effect.pp && out) return done({ status: 'ganhou', label: 'ganhou', reason: 'Efeito ' + fmt.pp(eff) + ': acima de +10 pp e fora da faixa normal ' + band_ + '.' })
  if (eff < -RULES.effect.pp && out) return done({ status: 'perdeu', label: 'perdeu', reason: 'Efeito ' + fmt.pp(eff) + ': abaixo de −10 pp e fora da faixa normal ' + band_ + '.' })
  const small = Math.abs(eff) < RULES.effect.pp
  return done({ status: 'neutro', label: 'neutro', neutralWhy: small && !out ? 'ambos' : small ? 'menor-que-10pp' : 'dentro-da-faixa',
    reason: 'Efeito ' + fmt.pp(eff) + ': ' + (small && !out ? 'abaixo de 10 pp e dentro da faixa normal ' + band_
      : small ? 'fora da faixa normal ' + band_ + ', mas abaixo de 10 pp'
      : 'acima de 10 pp, mas dentro da faixa normal ' + band_) + '.' })
}
```
Every line above mirrors `dados.js:666-734`. Only two changes: the globals are replaced, and there is the one guarded `ob` null branch. The parity test fails on any other deviation.

Add this test to `effect.test.ts` for the guard (Review Focus 4):

```ts
it('a missing daily record around the change → inconclusivo "Faltam registros…", never a crash', () => {
  const ds = datasetFromOracle(loadOracle())
  const id = P.changes.find(c => ['ganhou', 'perdeu', 'neutro'].includes(P.effect(c.id)!.status))!.id
  const vid = ds.videos.find(v => v.id === P.change(id)!.video)!
  const k = P.date.snapIdxAtOrAfter(P.change(id)!.at)
  vid.series = vid.series.filter(p => p.idx !== k + 2) // knock out one day after the change
  const e = createObservatory(ds).effect(id)!
  expect(e.status).toBe('inconclusivo'); expect(e.reason).toBe('Faltam registros diários em volta da troca: não dá para medir.')
})
```

- [ ] **Step 1: Hand-written rule tests (TDD drivers)**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/effect.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const P = createObservatory(datasetFromOracle(loadOracle()))
const all = P.changes.map(c => P.effect(c.id)!)

describe('effect rules (CONVENCOES "Modelo de efeito de troca")', () => {
  it('before 7 days after the change → aguardando, with waitText and no numbers', () => {
    const w = all.filter(e => e.status === 'aguardando')
    expect(w.length).toBeGreaterThan(0)
    for (const e of w) { expect(e.observed).toBeUndefined(); expect(e.waitText).toMatch(/^Aguardando: \d de 7 dias coletados, leitura (no|na) \w+, \d\d\/\d\d\./) }
  })
  it('ganhou/perdeu only with |effect| > 10 pp AND outside the IQR AND n ≥ 5 AND before ≥ 3 d', () => {
    for (const e of all.filter(x => x.status === 'ganhou' || x.status === 'perdeu')) {
      expect(Math.abs(e.effectPp!)).toBeGreaterThan(10); expect(e.n!).toBeGreaterThanOrEqual(5); expect(e.beforeDays!).toBeGreaterThanOrEqual(3)
      expect(e.observed! < e.iqr![0]! || e.observed! > e.iqr![1]!).toBe(true)
    }
  })
  it('n = 0 → noBaseText canonical sentence', () => {
    for (const e of all.filter(x => x.n === 0)) expect(e.noBaseText).toMatch(/^sem base de comparação: nenhum outro vídeo do canal na faixa .+ \(n = 0\)$/)
  })
  it('pre-series change says the real series start date', () => {
    for (const e of all.filter(x => x.status === 'sem-serie' && /coleta/.test(x.reason))) expect(e.reason).toContain('desde ' + P.date.dm(P.SERIES_START))
  })
  it('effectPp is reported but formatted integer by fmt.pp', () => {
    const m = all.find(x => x.effectPp != null)!; expect(P.fmt.pp(m.effectPp!)).toMatch(/^[+−]?\d+ pp$/)
  })
})
```

- [ ] **Step 2: Parity test**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/effect-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
describe('effect parity with dados.js', () => {
  it.each(O.changes.map((c: { id: string }) => [c.id]))('%s', id => {
    expect(JSON.parse(JSON.stringify(P.effect(id)))).toEqual(JSON.parse(JSON.stringify(O.effect(id))))
  })
  it.each(O.changes.slice(0, 20).map((c: { id: string }) => [c.id]))('effectAt(%s, 14) matches', id => {
    expect(JSON.parse(JSON.stringify(P.effectAt(id, 14)))).toEqual(JSON.parse(JSON.stringify(O.effectAt(id, 14))))
  })
})
```

- [ ] **Step 3: Run → FAIL**, then port, then delete `'efeito'` from `PENDING_SECTIONS`.

- [ ] **Step 4: Run** `cd apps/web && npx vitest run test/youtube/observatorio/` → PASS (rules + every change in parity + verbatim `efeito`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/effect.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/effect.test.ts apps/web/test/youtube/observatorio/effect-parity.test.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor do observatório — efeito da troca, observado contra o esperado pela idade

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 16: Multiplier by age, phases, outliers, tab counts

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/{multiplier,outliers}.ts`
- Modify: `index.ts` (expose `multiplier, multiplierAt, phaseOf, outliers, tabCounts, TAB_TITLES, TAB_COUNTS, PHASES, tierOf`; set `video.mult`)
- Modify: `suite-pending.ts` (delete `'outliers'`, `'contagens das abas'`, `'exemplos do BRIEF'`)
- Test: `apps/web/test/youtube/observatorio/outliers.test.ts`, `outliers-parity.test.ts`

**Interfaces:**
- Produces:
```ts
export interface MultiplierResult { value: number | null; method: 'mesmo dia de vida' | 'aproximação por faixa' | null; n: number; base?: number | null; band?: string; bandId?: string; weak: boolean; fallback?: boolean; dayN?: number | null; fallbackText?: string | null; lifeDay?: number; ageAtRead?: number; readAt?: number; readNote?: string; label?: string; reason?: string }
export function multiplierAt(ctx: EngineCtx, v: ObsVideo, t: number | null): MultiplierResult
export interface Phase { id: 'estourando' | 'recente' | 'perene' | 'antigo' | 'novos' | 'sem-ritmo'; label: string; why: string; noMedian?: boolean }
export function phaseOf(ctx: EngineCtx, v: ObsVideo, o?: { m7?: number | null }): Phase
export interface OutlierQuery { niche?: NicheScope; fmt?: Fmt; ages?: string[] | 'all'; agesExplicit?: boolean; min?: number; theme?: string | null; topic?: string | null; formula?: string | null; channel?: string | null; channels?: string[] | null; maxAge?: number | null; includeWeak?: boolean; includeOwn?: boolean; reading?: string | null }
export interface OutliersResult { items: Array<{ id: string; video: ObsVideo; mult: MultiplierResult; weak: boolean; phase: Phase; window: string; ageDays: number }>; count: number; countWithWeak: number; byAge: Record<string, number>; byPhase: Record<string, number>; analyzed: number; untracked: number; weakExcluded: number; scope: unknown; readingInvalid: boolean; orderedIds(sort?: 'mult' | 'vpd' | 'recent'): string[]; orderedGroups(sort?: 'mult' | 'vpd' | 'recent'): Array<{ k: string; ids: string[] }> }
export function outliers(ctx: EngineCtx, q?: OutlierQuery): OutliersResult
export function tabCounts(ctx: EngineCtx, niche?: NicheScope): { canais: number; mud: number; out: number }
```
Ports: `multiplier.ts` ← `dados.js:743-786`; `outliers.ts` ← `787-857` (the `reading` branch calls `readingScope`; until Task 32 it treats any `reading` as invalid: `scope = null; readingInvalid = true`).

- [ ] **Step 1: Hand-written tests**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/outliers.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const P = createObservatory(datasetFromOracle(loadOracle()))

describe('outliers', () => {
  it('tab counts Todos 14/18/11 · Viagem 8/8/5 · IA 6/10/6 (CONVENCOES)', () => {
    expect(P.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
    expect(P.tabCounts('viagem')).toEqual({ canais: 8, mud: 8, out: 5 })
    expect(P.tabCounts('ia')).toEqual({ canais: 6, mud: 10, out: 6 })
  })
  it('outlier = ≥ 2×; weak base (n < 3) never counts', () => {
    const r = P.outliers({ ages: 'all', includeWeak: true })
    for (const it of r.items) expect(it.mult.value!).toBeGreaterThanOrEqual(2)
    expect(r.count).toBe(r.items.filter(i => !i.weak).length)
  })
  it('a lagging/erroring channel never shows "estourando agora"', () => {
    const lag = P.channels.filter(c => c.sync.state === 'atrasado' || c.sync.state === 'erro').map(c => c.id)
    for (const it of P.outliers({ ages: 'all' }).items) if (lag.includes(it.video.ch)) expect(it.phase.id).toBe('sem-ritmo')
  })
  it('edge of a band says the age at the reading ("este tinha 30 dias")', () => {
    const edge = P.videos.find(v => v.mult?.readNote)
    if (edge) expect(edge.mult!.label).toMatch(/este tinha \d+ dias?; n = \d+\)/)
  })
  it('a video is never in its own base', () => {
    // every multiplier n counts OTHER videos only: an only-video channel has n = 0
    for (const v of P.videos) if (v.mult && v.mult.n > 0) expect(v.mult.n).toBeLessThan(P.videos.filter(u => u.ch === v.ch && u.fmt === v.fmt).length)
  })
})
```

- [ ] **Step 2: Parity test** (`outliers-parity.test.ts`): for every video, `P.video(id).mult` deep-equals `O.video(id).mult`. For each `niche × fmt × ages ∈ {default, 'all', ['91-180'], ['365+']} × includeWeak ∈ {false,true}`, compare `count`, `countWithWeak`, `byAge`, `byPhase`, `orderedIds('mult'|'vpd'|'recent')` and `items.map(i => [i.id, i.phase.id])` between P and O. Use the same `it.each` structure as Task 15.

- [ ] **Step 3: Run → FAIL**, port, delete the three sections from pending.

- [ ] **Step 4: Run** `cd apps/web && npx vitest run test/youtube/observatorio/` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/multiplier.ts apps/web/src/lib/youtube/observatorio/outliers.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/outliers.test.ts apps/web/test/youtube/observatorio/outliers-parity.test.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor do observatório — multiplicador pela idade com fallback, fases, janelas e contagens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 17: Channel stats, cadence, sync labels, `problemPhrase`, slots, sync-run text

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/channels.ts`
- Modify: `index.ts` (expose `cadence, channelStats, channelSlots, syncText`, `runSyncText`; set `channel.sync.label/stateLabel/problemLabel/problemPhrase`, `channel.statusLabel`, `channel.syncAgeHours`)
- Modify: `suite-pending.ts` (delete `'n possíveis pela cadência'`, `'limites e sincronização'`)
- Test: `apps/web/test/youtube/observatorio/channels.test.ts`, `channels-parity.test.ts`

**Interfaces:**
- Produces:
```ts
export function syncLabel(state: SyncState): 'sincronizado' | 'atrasado' | 'erro' | 'buscando vídeos'
export function problemPhrase(ctx: EngineCtx, ch: ObsChannel): string | null
export function cadence(ctx: EngineCtx, channelId: string, fmt?: Fmt): { weeks: Array<{ from: number; to: number; n: number }>; pw: number; n: number; habit: { costuma: boolean; text: string }; lastUpload: number | null; lastUploadAgo: string | null; partial: boolean; fetchedSince: number | null; partialText: string | null }
export function channelStats(ctx: EngineCtx, channelId: string, fmt?: Fmt): Record<string, unknown> // exact field set of dados.js:878-901 + PEDIDOS-API Canais 2/3 + F2 pctOutliers
export function channelSlots(ctx: EngineCtx, limit: number): { used: number; limit: number; free: number }
export function runSyncText(ok: string[], problems: Array<{ id: string; label: string }>, outOfRound: Array<{ id: string; label: string }>, names: (id: string) => string): string
```
Ports: `channels.ts` ← `dados.js:858-935, 1035-1058, 1966-1985` (+ `sync.label` at line 415).

**Production mapping of `problemLabel` (no canned text):**
- `erro` → `channel.sync.msg` from the DB `sync_error`, mapped by `humanizeSyncError(msg)`: `/YouTube API 404/` → "não encontrado no YouTube (404)"; `/quotaExceeded|403/` → "cota diária da API do YouTube esgotada"; `/timeout|aborted/i` → "tempo de resposta do YouTube esgotado". An unknown message → the raw message, never hidden.
- `atrasado` → "sem sincronização boa há N h". The mockup's "(5 tentativas)" is fixture text only.
- `backfill` → "ainda buscando vídeos (done de total)".

Add `humanizeSyncError` to `channels.ts`, with tests for each branch AND an unknown message. In the oracle adapter, set `sync.msg` so that the oracle's labels come out (the parity test compares `problemPhrase` on oracle data, where `msg` is the canned text).

**Sync state derivation** (used by `load.ts`, Task 20). Add it here as a pure function with tests:
```ts
export function deriveSyncState(row: { sync_status: string; sync_error: string | null; last_ok_synced_at: string | null; sync_error_since: string | null; youtube_video_count: number | null; video_limit: number; tracked: number; full_sync_completed_at: string | null }, nowMs: number): SyncState
// erro: sync_status = 'error'
// backfill: tracked < min(video_limit, youtube_video_count ?? video_limit) AND no full sync completed AND never ok-synced twice (tracked short)
// atrasado: last_ok_synced_at older than RULES.syncLateHours (12) — two missed 6 h slots
// ok: otherwise
```
`RULES.syncLateHours = 12` is a new rule (the mockup fixes the state in data). Record it in `rules.ts` with a comment that cites this plan.

- [ ] **Step 1: Tests**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/channels.test.ts
import { describe, it, expect } from 'vitest'
import { deriveSyncState, humanizeSyncError, syncLabel } from '@/lib/youtube/observatorio/channels'
const now = Date.parse('2026-10-24T18:02:00Z')
const base = { sync_status: 'idle', sync_error: null, last_ok_synced_at: '2026-10-24T15:00:00Z', sync_error_since: null, youtube_video_count: 300, video_limit: 50, tracked: 50, full_sync_completed_at: null }
describe('deriveSyncState', () => {
  it('ok', () => expect(deriveSyncState(base, now)).toBe('ok'))
  it('erro wins', () => expect(deriveSyncState({ ...base, sync_status: 'error', sync_error: 'YouTube API 404 for channel X' }, now)).toBe('erro'))
  it('atrasado after 12 h without an ok sync', () => expect(deriveSyncState({ ...base, last_ok_synced_at: '2026-10-24T05:00:00Z' }, now)).toBe('atrasado'))
  it('backfill while fewer videos than the limit were fetched', () => expect(deriveSyncState({ ...base, tracked: 18 }, now)).toBe('backfill'))
  it('never synced is backfill, not ok', () => expect(deriveSyncState({ ...base, last_ok_synced_at: null, tracked: 0 }, now)).toBe('backfill'))
})
describe('humanizeSyncError', () => {
  it('404', () => expect(humanizeSyncError('YouTube API 404 for channel UCx')).toBe('não encontrado no YouTube (404)'))
  it('quota', () => expect(humanizeSyncError('YouTube API 403 quotaExceeded')).toBe('cota diária da API do YouTube esgotada'))
  it('unknown text is kept, never hidden', () => expect(humanizeSyncError('weird thing')).toBe('weird thing'))
})
describe('syncLabel', () => { it('labels', () => expect(syncLabel('backfill')).toBe('buscando vídeos')) })
```
Plus `channels-parity.test.ts`: for every oracle channel and both formats, `cadence` and `channelStats` deep-equal the oracle's, and `sync.problemPhrase` is equal.

- [ ] **Step 2–4:** Run → FAIL; port; delete the two pending sections; run `npx vitest run test/youtube/observatorio/` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/channels.ts apps/web/src/lib/youtube/observatorio/rules.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/channels.test.ts apps/web/test/youtube/observatorio/channels-parity.test.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor do observatório — ritmo, estatísticas e frase única de problema por canal

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 18: Insights calculations (formulas, heatmap, niche stats, themes, patterns, attribution)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/insights.ts`
- Modify: `index.ts` (expose `formulas, formula, formulasOf, themes, theme, heatmap, nicheStats, themeTrend, ownCoverage, patternsNow`)
- Modify: `suite-pending.ts` (delete `'catálogos'`)
- Test: `apps/web/test/youtube/observatorio/insights.test.ts`, `insights-parity.test.ts`

**Interfaces:**
- Produces (ports `dados.js:137-171, 937-991, 1131-1219`):
```ts
export const FORMULAS: ReadonlyArray<{ id: string; label: string; short: string; test(t: string): boolean; niches: Niche[]; ex: string }>
export function formulasOf(title: string): string[]
export function heatmap(ctx: EngineCtx, niche: NicheScope, fmt: Fmt): { cells: Array<Array<{ n: number; ids: string[]; medMult: number | null; nMult: number; dominantChannel: { id: string; name: string; share: number; n: number; of: number } | null }>>; n: number; peak: unknown; bestMult: unknown; thin: Array<{ dow: number; block: number }>; days: string[]; blocks: string[]; excluded: Array<{ id: string; partial: boolean; fetchedSince: number | null; reason: string }> }
export function nicheStats(ctx: EngineCtx, niche: NicheScope, fmt: Fmt, ownId?: string): Record<string, unknown>
export function themeTrend(ctx: EngineCtx, niche: NicheScope, fmt: Fmt): Array<Record<string, unknown>> & { excluded: unknown[]; channelsCompared: string[] }
export function ownCoverage(ctx: EngineCtx, fmt: Fmt): { n: number; byTheme: Record<string, number>; ids: string[] }
export function analyzePatterns(ctx: EngineCtx, base: unknown): unknown
export function attribution(ctx: EngineCtx, list: string[], noun: string): { kind: string; text: string; textMid: string; textStart: string; tie?: boolean } | null
export function patternsNow(ctx: EngineCtx, niche: NicheScope, fmt: Fmt): unknown
```
`heatmap` blocks are SP 2-hour blocks; the weekday comes from `clock.parts(pub).dow`. This replaces `page.tsx`'s UTC `getDay()/getHours()` (spec D6).
Themes: production `video.theme` comes from the latest `temas` frozen reading's evidence (Task 20 loader). With no `temas` reading, every theme is `null`, `themeTrend` returns `[]` and the Insights screen shows its empty state (Review Focus 2).

- [ ] **Step 1: Tests** (`insights.test.ts` hand-written):
  - `formulasOf('Trying a $2.70 Pakistan\'s version of KFC')` contains `'preco'` and `'nome-do-lugar'`.
  - Heatmap uses SP: a video published `2026-10-23T23:30:00-03:00` falls on `sex` block 11, not on Saturday.
  - The 2nd attribution channel is named only when it has ≥ 20 % of the list. With > 60 % for the first: "{canal} sozinho assina 12 dos 13".
  - n = 1 → `{kind: 'unico', text: '1 outlier: <canal>'}`.
  - `nicheStats(...).own` with both values 0 → `bothZero: true`, verdict `'≈'`.
  - An empty dataset (no videos) → `heatmap(...).n === 0` and no throw.

  `insights-parity.test.ts`: deep-equal vs the oracle for `heatmap`, `nicheStats`, `themeTrend`, `ownCoverage`, `patternsNow` across `{todos, viagem, ia} × {long, short}`.
- [ ] **Step 2–4:** FAIL → port → delete `'catálogos'` from pending → PASS (`cd apps/web && npx vitest run test/youtube/observatorio/`).
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/insights.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/insights.test.ts apps/web/test/youtube/observatorio/insights-parity.test.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor do observatório — fórmulas, mapa dia × hora em São Paulo, você no nicho e temas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 19: Links between screens

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/links.ts`
- Modify: `index.ts` (expose `link`)
- Test: `apps/web/test/youtube/observatorio/links.test.ts`

**Interfaces:**
- Produces (port of `dados.js:1939-1960`, with mockup file names mapped to routes):
```ts
export const OBS_BASE = '/cms/youtube/competitors'
export const link: {
  canais(p?: { niche?: NicheScope; channel?: string; add?: 1; filter?: 'problemas' }): string            // OBS_BASE
  mudancas(p?: { niche?: NicheScope; type?: string; channel?: string; video?: string; changes?: string[]; reading?: string; win?: 7 | 30 | 90; fmt?: Fmt | 'all'; q?: string }): string // OBS_BASE + '/mudancas'
  outliers(p?: { niche?: NicheScope; fmt?: Fmt; ages?: string[] | 'all'; min?: number; topic?: string; theme?: 'light' | 'dark'; formula?: string; channel?: string; asof?: string; reading?: string }): string // OBS_BASE + '/outliers'
  insights(p?: { niche?: NicheScope }): string
  historico(videoId: string, p?: { from?: 'canais' | 'mudancas' | 'outliers' | 'insights'; back?: string; ids?: string[] }): string // OBS_BASE + '/video/' + id
}
```
Rules (CONVENCOES F4):
- Links to an object (`video`, `change`, `changes`, `channel`, `reading`) never carry `niche=`.
- `topic=` is the content theme; `theme=` only passes `light|dark`.
- `back=` carries only the origin's query string, starting with `?`.
- An empty query → no trailing `?`.

- [ ] **Step 1: Tests**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { link } from '@/lib/youtube/observatorio/links'
describe('links', () => {
  it('object links never carry niche', () => expect(link.mudancas({ niche: 'ia', video: 'abc' })).toBe('/cms/youtube/competitors/mudancas?video=abc'))
  it('content theme goes in topic=, colour theme only light|dark', () => {
    expect(link.outliers({ topic: 'comida-de-rua' })).toBe('/cms/youtube/competitors/outliers?topic=comida-de-rua')
    expect(link.outliers({ theme: 'light' as const })).toBe('/cms/youtube/competitors/outliers?theme=light')
  })
  it('no dangling "?"', () => expect(link.outliers({})).toBe('/cms/youtube/competitors/outliers'))
  it('historico keeps back= as the origin query', () => expect(link.historico('v1', { from: 'outliers', back: '?niche=ia&ages=0-30' })).toBe('/cms/youtube/competitors/video/v1?from=outliers&back=%3Fniche%3Dia%26ages%3D0-30'))
  it('changes list', () => expect(link.mudancas({ changes: ['a/title/1', 'b/thumb/2'] })).toBe('/cms/youtube/competitors/mudancas?changes=a%2Ftitle%2F1%2Cb%2Fthumb%2F2'))
})
```
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/links.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/links.test.ts
git commit -m "feat: links entre as telas do observatório com os parâmetros da CONVENCOES

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 20: DB loader, the clock override, and removing the triplicated outlier calculation

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/load.ts`, `apps/web/src/lib/youtube/observatorio/now.ts`
- Modify: `apps/web/src/lib/pipeline/services/competitors.ts:261-349` (`listCompetitorOutliers` → engine), `:357+` (`getCompetitorInsights` heatmap/cadence → engine)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx:398-433` (outliers), `:478-…` (heatmap/cadence/hits) → engine (the old UI keeps rendering until P3 replaces it)
- Test: `apps/web/test/youtube/observatorio/load.test.ts`, `now.test.ts`, `apps/web/test/integration/observatorio-load.test.ts` (DB-gated)

**Interfaces:**
- Consumes: every engine module; tables from Tasks 3–4.
- Produces:
```ts
// now.ts
export function observatoryNow(): number // Date.now(), or OBS_NOW_OVERRIDE when NODE_ENV === 'test'
// load.ts (server-only)
export interface LoadOptions { siteId: string; now: number }
export async function loadDataset(opts: LoadOptions): Promise<Dataset>
export function rowsToDataset(rows: ObservatoryRows, now: number): Dataset // pure, unit-tested
export interface ObservatoryRows { settings: { series_started_at: string | null; channel_limit: number } | null; channels: ChannelRow[]; ownChannels: OwnChannelRow[]; videos: VideoRow[]; ownVideos: OwnVideoRow[]; versions: VersionRow[]; legacyChanges: LegacyChangeRow[]; daily: DailyRow[]; snapshots: SnapshotRow[]; readings: ReadingRow[]; tasks: TaskRow[]; heartbeat: HeartbeatRow | null }
```
`rowsToDataset` rules:
- `seriesStart` = SP midnight of `series_started_at` (null → `now`, so nothing is "since"); `snap0` = that date at 12:00 SP.
- `video.series` = daily rows → `{idx: dayIndex(snap_date), t: snap0 + idx·DAY, views}` (nominal 12:00 time, like the mockup; the real `taken_at` stays in the DB).
- `firstIdx` = first idx.
- `ageDays` = `floor((now − pub)/DAY)`.
- `tracked` = within the channel's `video_limit` most recent.
- `fmt` = `is_short ? 'short' : 'long'`.
- `formulas` = `formulasOf(title)`.
- `theme` = from the latest `temas` reading's evidence (else null).
- Versions per field ordered by `first_seen_at`: `prec` = precision; `window` = `[window_start, first_seen_at]` when `window_start` is set.
- **Legacy title history:** each `competitor_changes` row with `change_type='title'` and `from_version_id is null` becomes a pre-series version pair (`prec '1d'`, window `[detected_at − 1 d, detected_at]`, text from `old_title`/`new_title`).
- **Legacy description changes** become versions with `lines: null, hasText: false`.
- **Legacy thumbnail rows are ignored** (CONVENCOES: the old URL method is unreliable).
- Own channel: `own: true`, its videos from `youtube_videos` (no versions, no series: the multiplier marks them "sem série").
- `sync` = `{ last: max(last_ok_synced_at), next: next 00/06/12/18 slot }`.

- [ ] **Step 1: `now.test.ts` (Review Focus 4)**

```ts
// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
const ENV = { ...process.env }
afterEach(() => { process.env = { ...ENV }; vi.useRealTimers() })
describe('observatoryNow', () => {
  it('without OBS_NOW_OVERRIDE it is Date.now()', () => {
    delete process.env.OBS_NOW_OVERRIDE
    vi.useFakeTimers({ now: 1_800_000_000_000, toFake: ['Date'] })
    expect(observatoryNow()).toBe(1_800_000_000_000)
  })
  it('honours the override only under NODE_ENV=test', () => {
    process.env.OBS_NOW_OVERRIDE = '2026-10-24T15:02:00-03:00'
    vi.stubEnv('NODE_ENV', 'test'); expect(observatoryNow()).toBe(Date.parse('2026-10-24T15:02:00-03:00'))
    vi.stubEnv('NODE_ENV', 'production'); expect(observatoryNow()).not.toBe(Date.parse('2026-10-24T15:02:00-03:00'))
  })
  it('an unparsable override is ignored', () => {
    process.env.OBS_NOW_OVERRIDE = 'banana'; vi.stubEnv('NODE_ENV', 'test')
    expect(Number.isFinite(observatoryNow())).toBe(true)
  })
})
```

```ts
// apps/web/src/lib/youtube/observatorio/now.ts
/** The observatory's "now". The override exists ONLY for the fidelity e2e (frozen mockup clock). */
export function observatoryNow(): number {
  const raw = process.env.OBS_NOW_OVERRIDE
  if (process.env.NODE_ENV === 'test' && raw) { const t = Date.parse(raw); if (Number.isFinite(t)) return t }
  return Date.now()
}
```

- [ ] **Step 2: `load.test.ts` (pure `rowsToDataset`, Review Focus 2)**

Cases:
1. **Empty rows** (`settings: null`, all arrays empty) → `createObservatory(ds)`: `tabCounts('todos')` = `{canais:0, mud:0, out:0}`; `outliers().count === 0`; `JSON.stringify` of `channelSlots(75)` has no `NaN`; `SYNC.text` is not `"sincronizado há NaN"` (with no channel synced: `SYNC.last = null` → `SYNC.text = 'nunca sincronizado'`. Add that branch to Task 13's SYNC builder; it is a one-line `null` guard plus a test).
2. **Legacy title rows** → two title versions with `prec '1d'`, and the change has `preSeries: true` and an effect `sem-serie` that says "desde <dm(seriesStart)>".
3. **Legacy thumbnail rows** → no thumb change.
4. **`series_started_at` = 2026-11-02** → `SERIES_START_LABEL === '02/11'`.
5. **Daily rows on 3 days** → `series.length === 3`, `firstIdx` = dayIndex of the first.

Write each with literal row fixtures (the row types mirror `database.types.ts`; build them with small factory helpers inside the test file).

- [ ] **Step 3: DB-gated `observatorio-load.test.ts`** — seed 2 channels (one niche each), 3 videos, versions and daily rows; `loadDataset({siteId, now})` returns them with the right `fmt`, `tracked`, `series` and `niche`. One query per table (assert with a spy on `from()` that `competitor_videos` is read once, not once per channel; it fixes the per-channel loop of `page.tsx:72-82`).

- [ ] **Step 4: Run → FAIL**; implement `load.ts` (queries: `competitor_settings`; `competitor_channels`; `youtube_channels` + `youtube_videos` (own); `competitor_videos` with `in(channel ids)`; `competitor_video_versions` with `in(video ids)` chunked by 500; `competitor_changes` legacy where `from_version_id is null`; `competitor_video_daily` with `in(video ids)` and `snap_date ≥ seriesStart − 1 d`; `competitor_channel_snapshots`; `competitor_readings`; `youtube_intelligence_tasks` observatory types; `forja_heartbeat`). The last three tables arrive in P4: guard them with "table missing → empty" ONLY until Task 29 lands. Put the guard in one function, `readOptional(table)`, with a comment that Task 29 removes it.

- [ ] **Step 5: Replace the triplicated outlier calculation**

```ts
// apps/web/src/lib/pipeline/services/competitors.ts — listCompetitorOutliers body becomes:
const ds = await loadDataset({ siteId, now: observatoryNow() })
const obs = createObservatory(ds)
const tierMap: Record<string, 'top' | 'high' | 'mid'> = { S: 'top', A: 'high', B: 'mid' }
const res = obs.outliers({ ages: 'all', fmt: filters.fmt ?? 'long' })
let rows = res.items.map(it => ({ id: it.video.id, video_id: it.video.ytId, title: it.video.title, thumbnail_url: it.video.thumbs.at(-1)?.blobUrl ?? null,
  channel_name: obs.channel(it.video.ch)!.name, view_count: it.video.views ?? 0, like_count: it.video.likes, comment_count: it.video.comments,
  duration_seconds: it.video.dur, published_at: new Date(it.video.pub).toISOString(),
  multiplier: Math.round((it.mult.value ?? 0) * 10) / 10, tier: obs.tierOf(it.mult.value)!, method: it.mult.method, n: it.mult.n, label: it.mult.label, phase: it.phase.id }))
if (filters.tier && filters.tier !== 'all') rows = rows.filter(r => r.tier === (tierMap[filters.tier!] ?? filters.tier))
return ok({ outliers: rows.slice(0, Math.min(filters.limit ?? 25, 100)), count: rows.length })
```
Add the optional `fmt?: 'long' | 'short'` to `CompetitorOutlierFilters` (and to the route's query parsing, default `long`). Extend `CompetitorOutlierRow` with `method, n, label, phase` (additive, the API stays compatible) and update `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (outliers response fields). Do the same for `page.tsx`'s outliers block, heatmap block and cadence block: they become `obs.outliers(...)`, `obs.heatmap(...)` and `obs.cadence(...)` mapped into the existing view types. After this, `grep -n "median\b\|sort((a, b) => a - b)" src/app/cms/(authed)/youtube/competitors/page.tsx src/lib/pipeline/services/competitors.ts` must show no outlier median logic.

- [ ] **Step 6: Run** `cd apps/web && npx vitest run test/youtube/observatorio/ test/mcp test/unit/pipeline && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-load.test.ts && npx tsc --noEmit`
Expected: PASS. Run the existing competitors pipeline tests too (`grep -rl "listCompetitorOutliers\|competitors/outliers" apps/web/test` and run those files).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/now.ts apps/web/src/lib/pipeline/services/competitors.ts "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" apps/web/data/pipeline-docs/cowork-docs-youtube.md apps/web/test/youtube/observatorio/load.test.ts apps/web/test/youtube/observatorio/now.test.ts apps/web/test/integration/observatorio-load.test.ts
git commit -m "refactor: uma única camada de cálculo — outliers, mapa e ritmo do observatório saem do motor

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

**P2 ship gate:** full `npx vitest run`, typecheck, and authenticated `/cms/youtube/competitors` smoke (runbook) on the old UI fed by the engine. Push.

---
# Phase P3 — Screens (one per task, each checked side by side with its mockup)

**Rules for every screen task:**
- **The mockup file is the visual source of truth.**
  - Port its `<style>` block into the screen's CSS file, scoped under `[data-obs-screen="<name>"]` (the CONVENCOES rule "TODO seletor da tela escopado em #screen").
  - Port its markup into React components.
  - Every number and text comes from the engine (`createObservatory(ds)` on the server). No screen computes effect, multiplier, outliers, counts or cadence (CONVENCOES "INTEGRAÇÃO").
- **Theme:** the CMS theme comes from the `btf_theme` cookie → `<html data-theme>` (`src/app/layout.tsx:73-85`). Map the mockup's dark/light tokens (`chrome.css :root` + CONVENCOES "Tokens") to `[data-theme="dark"]`/`[data-theme="light"]` under `[data-obs]`. The mockup's own theme toggle is NOT ported; the CMS toggle drives the theme.
- **Server/client split:**
  - `page.tsx` (server) does `loadDataset` → `createObservatory`, then builds a **serialisable view model** (`build<Screen>View(obs, params)` in `_<screen>/view-model.ts`, pure, unit-tested).
  - It passes the view model to a `'use client'` screen component.
  - Server actions are passed as props, never imported by client components (CLAUDE.md).
  - `next/link` is never passed as a prop; use `cms-link.tsx`.
- **The "Estados do mockup" bar never ships.** Each mockup state maps to a seed/fixture for the fidelity e2e (listed per task).
- **Forja UI in P3:** the forja button, status and cards render only when `forjaReady(type)` is true: the P4 tables exist AND the heartbeat announces the type (Task 30). Until P4 the screens show no forja controls at all (never a dead button, never "em desenvolvimento"). The forja-state fidelity rows of every screen run in Task 35.
- **Every screen task ends with the fidelity check (spec §9):**
  - mockup vs implementation at 1440×900 and 768×1024, light and dark, for every non-forja state of the mockup's bar;
  - plus the ported audits, run as Vitest (DOM-only: junk text, link N, one filled button, contrast on computed tokens) and as Playwright (layout: overflow at 768, targets ≥ 32 px, equal card heights, content top 16 px below the tabs).

### Task 21: Fidelity harness — audits, seed, mockup-vs-implementation runner

**Files:**
- Create: `apps/web/test/youtube/observatorio/audits.ts`
- Create: `apps/web/test/youtube/observatorio/audits.test.ts`
- Create: `apps/web/e2e/fixtures/observatorio-seed.ts`
- Create: `apps/web/e2e/tests/cms/observatorio/fidelity.ts` (helpers) and `apps/web/e2e/tests/cms/observatorio/seed.spec.ts` (smoke of the seed)
- Modify: `apps/web/playwright.config.ts` (webServer env `OBS_NOW_OVERRIDE`)

**Interfaces:**
- Produces:
```ts
// audits.ts — pure DOM audits; each returns string[] of failures (empty = pass)
export function noJunkText(root: Element): string[]           // NaN, undefined, null, "há −", "Infinity", "[object Object]", "−0", "há no futuro"
export function oneFilledButton(root: Element): string[]      // ≤ 1 visible .btn-primary/.btn-forja-solid per view (CONVENCOES)
export function linkCountsMatch(root: Element, counts: Record<string, number>): string[] // [data-link-n] N === destination N
export function contrastAA(pairs: Array<{ fg: string; bg: string; label: string; large?: boolean }>): string[] // token pairs, 4.5:1 / 3:1
export function contrastRatio(fg: string, bg: string): number
export function forbiddenVocabulary(root: Element): string[]  // "watchdog", "sync", "diff", "snapshot", "ETag", "Test & Compare", "horário de Brasília", "Competitors"
// fidelity.ts (Playwright)
export interface MockupState { label: string; mockupClicks: string[]; seed: SeedOptions; query?: string }
export interface ScreenSpec { name: string; mockupFile: string; route: string; mockThumbSelector: string; implThumbSelector: string; states: MockupState[]; textAllow?: RegExp[] }
export async function runFidelity(spec: ScreenSpec): Promise<void> // registers Playwright tests: state × viewport × theme
export async function layoutAudits(page: import('@playwright/test').Page, opts: { screen: string }): Promise<string[]> // overflow@768, targets ≥ 32, equal heights per row, content top = tabs bottom + 16
// observatorio-seed.ts
export interface SeedOptions { forjaState?: RequestState | null; forjaType?: string; channelLimit?: number; ownEmpty?: boolean; onlyProblems?: boolean; emptyWindow?: boolean; scenario?: string }
export async function seedObservatory(siteId: string, opts?: SeedOptions): Promise<void> // oracle dataset → rows
export async function clearObservatory(siteId: string): Promise<void>
```

- [ ] **Step 1: Write `audits.test.ts` against tiny DOM fixtures**

```ts
// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/audits.test.ts
import { describe, it, expect } from 'vitest'
import { noJunkText, oneFilledButton, linkCountsMatch, contrastRatio, contrastAA, forbiddenVocabulary } from './audits'
const el = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d }
describe('audits', () => {
  it('flags NaN / undefined / "há −"', () => {
    expect(noJunkText(el('<p>views NaN</p><p>há −3 h</p><p>undefined</p>')).length).toBe(3)
    expect(noJunkText(el('<p>há 3 h · −41%</p>'))).toEqual([])
  })
  it('one filled button per view', () => {
    expect(oneFilledButton(el('<button class="btn-primary">A</button><button class="btn-forja-solid">B</button>'))).toHaveLength(1)
  })
  it('link N equals destination N', () => {
    expect(linkCountsMatch(el('<a data-link-n="5" data-link-key="out">Ver os 5 vídeos</a>'), { out: 5 })).toEqual([])
    expect(linkCountsMatch(el('<a data-link-n="5" data-link-key="out">Ver os 5 vídeos</a>'), { out: 4 })).toHaveLength(1)
  })
  it('contrast: muted #A89D88 on surface #221E1A passes AA; #5C5345 fails', () => {
    expect(contrastRatio('#A89D88', '#221E1A')).toBeGreaterThan(4.5)
    expect(contrastAA([{ fg: '#5C5345', bg: '#221E1A', label: 'faint' }])).toHaveLength(1)
  })
  it('forbidden vocabulary', () => expect(forbiddenVocabulary(el('<p>o watchdog liberou</p>'))).toHaveLength(1))
})
```

- [ ] **Step 2: Run → FAIL** (`cd apps/web && npx vitest run test/youtube/observatorio/audits.test.ts`)

- [ ] **Step 3: Implement `audits.ts`**

Port the checks of `moldura-forja.html:936-…` (`auditMockup`: one filled button, the "nada de horário futuro sem previsão" regex `FUTURE`, weekday check, counts vs engine, `href="#"` or a dangling `?`) and the contrast math (`rgb`, `L`, `ratio` at `moldura-forja.html:938-950`). Each function walks `root.querySelectorAll('*')` text nodes, skipping `[hidden]`, `.sr-only` and `[aria-hidden="true"]`. Also add `futureTimes(root, nowMs)` ported from the `FUTURE` regex block, and `weekdaysMatch(root, clock)`.

- [ ] **Step 4: Write the seed**

`seedObservatory(siteId, opts)` loads the oracle (`test/youtube/observatorio/oracle.ts` → `loadOracle()`; when the seed needs a different state it calls `O.runSync()`/`O.setNiche()` on the oracle BEFORE converting). It then writes, with the service client:
- `competitor_settings` (`series_started_at` = oracle `SERIES_START`, `channel_limit` = `opts.channelLimit ?? 75`);
- `competitor_channels` (`niche`, `channel_name`, `subscriber_count`, `video_limit`, and the sync columns derived from `sync.state`: `erro` → `sync_status 'error'` + `sync_error` = a message that `humanizeSyncError` turns into the oracle label; `atrasado` → `last_ok_synced_at = sync.last`; `backfill` → tracked < limit);
- `competitor_videos` (`is_short` = fmt short, `published_at`, `view_count`, likes, comments, `duration_seconds`);
- `competitor_video_versions` from `titles/thumbs/descs` (thumb `thumb_blob_url` = null);
- `competitor_changes` for pre-series titles (legacy rows) and post-series ones with version ids;
- `competitor_video_daily` from `series` (snap_date = SP date of `SNAP(idx)`);
- `competitor_channel_snapshots` from `snapshots`;
- the own channel as a `youtube_channels` row + `youtube_videos`;
- when `opts.forjaState` is set (P4 only), `youtube_intelligence_tasks` rows from `O.forja.requestScenario(state, {niche:'todos', type})`.requests and `forja_heartbeat` from its `machine`.

`clearObservatory` deletes these rows for the site (children first).

- [ ] **Step 5: Wire Playwright**

In `playwright.config.ts` `webServer.env`, add `OBS_NOW_OVERRIDE: '2026-10-24T15:02:00-03:00'` (the mockup's `NOW_ISO`). Write `fidelity.ts`. For each `state × viewport {1440×900, 768×1024} × theme {dark, light}`:
1. `seedObservatory(siteId, state.seed)`.
2. Implementation:
   - set the cookie `btf_theme=<theme>`;
   - `goto(route + (state.query ?? ''))`;
   - wait for `[data-obs-screen]`;
   - `implText` = innerText of `[data-obs-screen]`, with the text of `implThumbSelector` removed.
3. Mockup:
   - `goto('file://' + abs(mockupFile) + '?theme=' + theme)`;
   - expand `#ch-mock` (click its summary button) and click each `mockupClicks` label inside `#ch-mock`;
   - `mockText` = innerText of `#screen`, with `mockThumbSelector` text removed.
4. Assert `normalize(implText) === normalize(mockText)`:
   - `normalize` collapses whitespace and strips zero-width chars;
   - `textAllow` regexes let a screen list known "real data" differences (each with a comment);
   - on mismatch, write both texts and a line diff to `test-results/observatorio/<screen>/<state>-<vp>-<theme>.diff.txt`.
5. Screenshots of both to `test-results/observatorio/<screen>/<state>-<vp>-<theme>-{mockup,impl}.png` (side by side review artefacts).
6. `layoutAudits(page)` on the implementation must return `[]`.

- [ ] **Step 6: Seed smoke spec**

```ts
// apps/web/e2e/tests/cms/observatorio/seed.spec.ts
import { test, expect } from '@playwright/test'
import { seedObservatory, clearObservatory } from '../../../fixtures/observatorio-seed'
import { getSeedSiteId } from '../../../fixtures/seed-helpers'
test('oracle seed loads into the engine with the mockup counts', async () => {
  const siteId = await getSeedSiteId()
  await seedObservatory(siteId)
  const { loadDataset } = await import('@/lib/youtube/observatorio/load')
  const { createObservatory } = await import('@/lib/youtube/observatorio')
  const obs = createObservatory(await loadDataset({ siteId, now: Date.parse('2026-10-24T15:02:00-03:00') }))
  expect(obs.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
  await clearObservatory(siteId)
})
```
(If `seed-helpers.ts` has no `getSeedSiteId`, add it there: it returns the id of the site whose `domains` contains `localhost`.)

- [ ] **Step 7: Run**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/audits.test.ts && npx playwright test e2e/tests/cms/observatorio/seed.spec.ts`
Expected: PASS. The seed reproduces 14/18/11 through the DB → loader → engine path, which proves the round trip.

- [ ] **Step 8: Commit**

```bash
git add apps/web/test/youtube/observatorio/audits.ts apps/web/test/youtube/observatorio/audits.test.ts apps/web/e2e/fixtures/observatorio-seed.ts apps/web/e2e/fixtures/seed-helpers.ts apps/web/e2e/tests/cms/observatorio/fidelity.ts apps/web/e2e/tests/cms/observatorio/seed.spec.ts apps/web/playwright.config.ts
git commit -m "test: harness de fidelidade do observatório — auditorias, semente do oráculo e comparação mockup × tela

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 22: Layout chrome (header, freshness line, tabs with counts, niche bar, compact mode)

**Mockup:** `chrome.js`, `chrome.css`, `CHROME.md`, `moldura-forja.html` (header and tabs only; the forja drawer is Task 35).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/layout.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/{observatory-chrome.tsx,chrome.css,freshness.tsx,tabs.tsx,niche-bar.tsx,menu.tsx,toasts.tsx,view-model.ts}`
- Test: `apps/web/test/youtube/observatorio/chrome-view-model.test.ts`, `apps/web/test/youtube/observatorio/chrome.test.tsx`, `apps/web/e2e/tests/cms/observatorio/chrome.spec.ts`

**Interfaces:**
- Consumes: `loadDataset`, `createObservatory`, `getUserNiche`/`setUserNiche`/`parseNiche` (Task 11), `link` (Task 19), `runCompetitorBatch` is NOT called from the UI (the button triggers a per-site manual sync action, below).
- Produces:
```ts
// _chrome/view-model.ts
export interface ChromeView {
  title: 'Observatório de Competidores'; subtitle: string; tzLabel: 'Horários em São Paulo'
  niche: NicheScope; nicheLabel: string; nicheColor: { dark: string; light: string } | null
  tabs: Array<{ key: 'canais' | 'mudancas' | 'outliers' | 'insights'; label: string; href: string; count: number | null; title: string; current: boolean }>
  fresh: { channelsInNiche: number; channelsTotal: number; syncText: string; syncTitle: string; problems: Array<{ id: string; name: string; phrase: string }>; problemsText: string | null }
  forja: null // P3: no forja segment; Task 35 fills it
}
export function buildChromeView(obs: Observatory, o: { tab: ChromeView['tabs'][number]['key']; niche: NicheScope }): ChromeView
// actions.ts (add)
export async function syncCompetitorsNow(): Promise<{ ok: boolean; text: string; problems: Array<{ id: string; label: string }>; outOfRound: Array<{ id: string; label: string }> }>
```
`syncCompetitorsNow` runs `syncCompetitorChannel` for this site's channels whose engine state is `ok`, sequentially, with a 50 s budget (the page's `maxDuration` is 60). It returns `runSyncText(...)` so the toast says exactly "11 de 13 canais sincronizados agora; 2 com problema · Fora da rodada: Vou sem volta (buscando vídeos)" (spec 2.2). The actual ok count comes from the run, never from the plan. Channels with problems are not touched and are listed. No success is fabricated: if 0 synced, the toast is `warn`.

Tab counts and titles: `obs.tabCounts(niche)` with `TAB_TITLES` for `title=`; Insights has no count. The tabs are **links** (`/cms/youtube/competitors`, `/mudancas`, `/outliers`, `/insights`) with `aria-current="page"`, built from the PERSISTED niche (CONVENCOES F4). The niche bar persists via `setUserNiche`; `?niche=` wins and is persisted; an invalid `?niche=` is ignored and removed by `router.replace`.

Compact (container ≤ 860 px; port `chrome.css`'s container query): tabs and niche on one line, fixed header height.

Content starts 16 px below the tabs; the first child has no margin of its own (port the `.ch-screen` rules: `display: flow-root` + `!important` on the container's top margin/padding).

The menu ⋯ holds "Copiar pedido para o Cowork" (copies the text from `chrome.js`'s default per tab, shows "cole no Cowork com ⌘V"; a copy failure shows the text selectable — `CHROME.toast(..., {selectable})`) and "Definir nicho dos canais" (opens the per-channel niche editor from Task 23).

- [ ] **Step 1: View-model tests (oracle dataset, frozen now)**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/chrome-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
describe('chrome view model', () => {
  it('tab counts follow the niche (Todos 14/18/11, Viagem 8/8/5, IA 6/10/6); Insights has none', () => {
    const t = buildChromeView(obs, { tab: 'canais', niche: 'todos' }).tabs
    expect(t.map(x => x.count)).toEqual([14, 18, 11, null])
    expect(buildChromeView(obs, { tab: 'canais', niche: 'ia' }).tabs.map(x => x.count)).toEqual([6, 10, 6, null])
  })
  it('each tab explains its count in title=', () => {
    expect(buildChromeView(obs, { tab: 'mudancas', niche: 'todos' }).tabs[1]!.title).toBe('18 trocas nos últimos 30 dias (título, thumbnail e descrição; longos e Shorts; contadas por evento)')
  })
  it('freshness line uses the engine sync text and problemPhrase', () => {
    const f = buildChromeView(obs, { tab: 'canais', niche: 'todos' }).fresh
    expect(f.syncText).toBe('sincronizado há 3 h')
    expect(f.problems.every(p => p.phrase === obs.channel(p.id)!.sync.problemPhrase)).toBe(true)
  })
  it('tab hrefs carry no niche (object links) and point at the routes', () => {
    expect(buildChromeView(obs, { tab: 'canais', niche: 'ia' }).tabs.map(t => t.href)).toEqual(['/cms/youtube/competitors', '/cms/youtube/competitors/mudancas', '/cms/youtube/competitors/outliers', '/cms/youtube/competitors/insights'])
  })
})
```

- [ ] **Step 2: Component test (jsdom) with the DOM audits**

Render `<ObservatoryChrome view={...}>` with a child `<div data-obs-screen="x"/>`. Assert:
- `noJunkText`, `oneFilledButton` (0 filled in the header — CONVENCOES "Cabeçalho da moldura não tem preenchido") and `forbiddenVocabulary` all return `[]`;
- every interactive element has a non-empty accessible name;
- the menu opens with Enter and closes with Esc, with the focus returning to ⋯.

- [ ] **Step 3: Run → FAIL**; implement:
- Port `chrome.css` into `_chrome/chrome.css`: tokens under `[data-obs]`, `[data-theme]` variants from CONVENCOES "Tokens", the `.ch-*` classes renamed `.obs-ch-*`.
- Port the `chrome.js` render functions into the components.
- `layout.tsx` (server): `const siteId = (await getSiteContext()).siteId; const niche = parseNiche(searchParams niche) ?? await getUserNiche(); const obs = createObservatory(await loadDataset({ siteId, now: observatoryNow() }))`.
  - App Router layouts don't receive `searchParams`. So the layout renders the chrome shell, and the niche/tab-dependent parts are rendered by each page through `<ObservatoryChrome>` wrapping its screen. `layout.tsx` only imports `chrome.css` and sets `data-obs`.
  - Put the `getUserNiche` + `?niche=` resolution in a shared helper `resolveNiche(searchParams)` in `_chrome/resolve-niche.ts`.
- Add `syncCompetitorsNow` to `actions.ts` (with the `requireSiteScope` edit check).

- [ ] **Step 4: Playwright chrome spec (fidelity + layout audits)**

```ts
// apps/web/e2e/tests/cms/observatorio/chrome.spec.ts
import { runFidelity } from './fidelity'
runFidelity({
  name: 'moldura', mockupFile: 'docs/superpowers/mockups/2026-10-02-observatorio/moldura-forja.html', route: '/cms/youtube/competitors',
  mockThumbSelector: '.thumb', implThumbSelector: '[data-thumb]',
  states: [
    { label: 'Aba Canais', mockupClicks: ['Canais'], seed: {} },
    { label: 'Aba Mudanças', mockupClicks: ['Mudanças'], seed: {}, query: '' },
    { label: 'Aba Outliers', mockupClicks: ['Outliers'], seed: {} },
    { label: 'Aba Insights', mockupClicks: ['Insights'], seed: {} },
  ],
  compareSelector: { mockup: '#ch-app header, #ch-app nav', impl: '[data-obs-chrome]' }, // chrome-only text comparison
})
```
Add `compareSelector` to `ScreenSpec` (optional; default `#screen` vs `[data-obs-screen]`). The moldura's "Fluxo da forja" states (`choose`, `confirm`, `queued`, … `cota`) are compared in Task 35.

- [ ] **Step 5: Run**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/chrome-view-model.test.ts test/youtube/observatorio/chrome.test.tsx && npx playwright test e2e/tests/cms/observatorio/chrome.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Side-by-side review (spec §9.1)**

Open `python3 -m http.server 8800` (mockups) and the local dev server (runbook) side by side. At 1440×900 and 768×1024, dark and light, compare header, freshness popover (with problems), tabs and niche bar. Write 1 line per mismatch found in the commit body ("none" if none). Fix before committing.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/layout.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome" "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts" apps/web/test/youtube/observatorio/chrome-view-model.test.ts apps/web/test/youtube/observatorio/chrome.test.tsx apps/web/e2e/tests/cms/observatorio/chrome.spec.ts
git commit -m "feat: moldura do observatório — cabeçalho, frescor, abas com contagem e nicho

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 23: Canais

**Mockup:** `canais.html` (its states bar: `MOCK` at `canais.html:857-860`).

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` (becomes Canais; the old dashboard props go away)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_canais/{canais-screen.tsx,canais.css,channel-table.tsx,channel-cards.tsx,channel-drawer.tsx,add-channel-form.tsx,niche-editor.tsx,view-model.ts}`
- Test: `apps/web/test/youtube/observatorio/canais-view-model.test.ts`, `canais-screen.test.tsx`, `apps/web/e2e/tests/cms/observatorio/canais.spec.ts`

**Interfaces:**
- Consumes: `obs.channelStats`, `obs.cadence`, `obs.channelSlots(limit)`, `obs.outliers`, `obs.changesIn`, `channel.sync.problemPhrase`, `link.*`, actions `addCompetitorChannel`, `removeCompetitorChannel`, `unlockMoreChannels`, `setChannelNiche`, `syncCompetitorsNow`.
- Produces:
```ts
export interface CanaisView {
  slots: { used: number; limit: number; free: number; text: string /* "14 de 75 canais" */; fullText: string | null }
  scale: 'per-mil' | 'abs'; fmt: 'long' | 'short'; layout: 'table' | 'cards'
  rows: Array<{ id: string; name: string; niche: Niche | null; pw: string; vpd: string; outliers: { n: number; href: string }; changes: { n: number; href: string }; growth: string; growthTitle: string; sync: { label: string; phrase: string | null; state: SyncState }; own: boolean }>
  own: { row: CanaisView['rows'][number] | null; emptyText: string | null }
  drawer: null | { id: string; tab: 'trocas' | 'videos' | 'outliers'; /* port fields of canais.html openDrawer */ }
  filter: 'todos' | 'problemas'; addOpen: boolean
}
export function buildCanaisView(obs: Observatory, p: { niche: NicheScope; limit: number; channel?: string; tab?: string; add?: string; filter?: string; scale?: string; fmt?: string; layout?: string }): CanaisView
```
Texts to keep verbatim from `canais.html`:
- the counter "N de 75 canais" (the limit comes from settings);
- at the limit, the "Adicionar" button disabled with "Sem vagas: remova um canal…" (copy the full sentence from `canais.html`);
- a duplicate is rejected with the niche;
- the sync result "11 de 13 canais sincronizados agora; 2 com problema · Fora da rodada: Vou sem volta (buscando vídeos)" (from the action);
- a stalled channel's numbers say "até o registro diário de DD/MM HH:MM";
- `?add=1` opens the add form and `?filter=problemas` filters the list (PEDIDOS-API moldura 6).

The admin "+25" control is shown only to admins (`role` from `site_users`, passed as `canUnlock`). It appears next to the counter when `free ≤ 5` ("Destravar mais 25 vagas"; exact copy from the mockup if present, otherwise this label; confirm with the owner in the review step).

Mockup states → fidelity seeds:

| mockup state | seed / query |
|---|---|
| (default) | `{}` |
| Sincronização em andamento | Playwright clicks "Sincronizar concorrentes" and asserts the in-progress state, then intercepts the action to stay pending (route interception) |
| Sincronização concluída | after the click resolves |
| Seu canal sem vídeo longo em 90 d | `{ ownEmpty: true }` |
| Só canais com problema | `query: '?filter=problemas'` |
| 74 de 75 canais | `{ channelLimit: 15 }` → expects "14 de 15 canais" (real count; `textAllow` covers the numbers) |
| 75 de 75 canais (cheio) | `{ channelLimit: 14 }` → "14 de 14 canais" + disabled add |
| Adicionar canal (?add=1) | `query: '?add=1'` |
| Drawer: Matt Wolfe … bald (parado) | `query: '?channel=<seeded uuid of that channel>'`, one state per drawer item, each tab Trocas/Vídeos/Outliers |
| Pedido à forja no drawer (*) | Task 35 |

- [ ] **Step 1: View-model tests (oracle)**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/canais-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
describe('Canais view model', () => {
  it('"14 de 75 canais" — own channel not counted', () => expect(buildCanaisView(obs, { niche: 'todos', limit: 75 }).slots.text).toBe('14 de 75 canais'))
  it('never negative slots', () => expect(buildCanaisView(obs, { niche: 'todos', limit: 10 }).slots.free).toBe(0))
  it('link N = destination N (outliers and changes per channel)', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75 })
    for (const r of v.rows.filter(r => !r.own)) {
      expect(r.outliers.n).toBe(obs.outliers({ channel: r.id, fmt: 'long' }).count)
      expect(r.changes.n).toBe(obs.changesIn({ channel: r.id }).length)
    }
  })
  it('problem rows use problemPhrase verbatim', () => {
    for (const r of buildCanaisView(obs, { niche: 'todos', limit: 75 }).rows) expect(r.sync.phrase).toBe(obs.channel(r.id)!.sync.problemPhrase ?? null)
  })
  it('?filter=problemas keeps only non-ok channels', () => {
    expect(buildCanaisView(obs, { niche: 'todos', limit: 75, filter: 'problemas' }).rows.every(r => r.sync.state !== 'ok')).toBe(true)
  })
  it('stalled channel numbers say "até o registro diário de DD/MM HH:MM"', () => {
    const v = buildCanaisView(obs, { niche: 'todos', limit: 75, channel: 'bald-and-bankrupt' })
    expect(JSON.stringify(v.drawer)).toMatch(/até o registro diário de \d\d\/\d\d \d\d:\d\d/)
  })
})
```

- [ ] **Step 2: Component test** (jsdom): render `CanaisScreen` with the view; run `noJunkText`, `oneFilledButton` (exactly one: "Adicionar canal" orange inside Canais), `linkCountsMatch` (with `data-link-n`/`data-link-key` on every "Ver os N…" link) and `forbiddenVocabulary`. Keyboard: the drawer (≥ 1280 px column; below, a modal with focus trap; Esc returns focus to the row button).

- [ ] **Step 3: Run → FAIL**, implement (port `canais.html`'s markup, CSS and drawer; wire the actions as props), run → PASS.

- [ ] **Step 4: Fidelity spec** `canais.spec.ts` with `runFidelity({... states from the table above ...})`, then run it.
Expected: PASS for every non-forja state, both viewports, both themes; `layoutAudits` empty.

- [ ] **Step 5: Side-by-side review** (as in Task 22, Step 6), with every drawer tab.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais" apps/web/test/youtube/observatorio/canais-view-model.test.ts apps/web/test/youtube/observatorio/canais-screen.test.tsx apps/web/e2e/tests/cms/observatorio/canais.spec.ts
git commit -m "feat: tela Canais do observatório — tabela, vagas, gaveta do canal e sincronização honesta

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 24: Mudanças

**Mockup:** `mudancas.html` (states at `mudancas.html:429-432`).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/mudancas/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_mudancas/{mudancas-screen.tsx,mudancas.css,change-hero.tsx,title-diff.tsx,thumb-compare.tsx,desc-diff.tsx,effect-panel.tsx,ledger.tsx,filters.tsx,sparkline.tsx,view-model.ts}`
- Modify: `actions.ts` — `toggleBookmark` keeps working (swipe file = `competitor_changes.bookmarked`); add the toasts "Salvo no swipe file"/"Tirado do swipe file"
- Test: `apps/web/test/youtube/observatorio/mudancas-view-model.test.ts`, `mudancas-screen.test.tsx`, `apps/web/e2e/tests/cms/observatorio/mudancas.spec.ts`

**Interfaces:**
- Consumes: `obs.changesIn`, `obs.change`, `obs.effect` (`numbers`, `waitText`, `noBaseText`, `reason`, `daily`, `iqr`, `n`, `band`, `methodLabel`, `fallbackText`), `obs.caveats`, `change.titleDiff`, `change.diff`, `fmt.pp`, `fmt.labelReason`, `link.historico`.
- Produces:
```ts
export interface MudancasView {
  filters: { win: 7 | 30 | 90; type: 'all' | 'title' | 'thumb' | 'desc'; fmt: 'all' | 'long' | 'short'; q: string; channel: string; changes: string[] | null; reading: string | null }
  heroes: Array<{ id: string; type: 'title' | 'thumb' | 'desc'; video: { id: string; title: string; channel: string; ago: string; historyHref: string; url: string }; title?: TitleDiff; thumbs?: Array<{ key: string; label: 'A' | 'B' | 'C'; src: string | null; period: string; archived: boolean }>; desc?: { label: string; lines: Array<{ op: string; text: string }>; noiseHidden: number; noText: string | null }
    effect: { status: EffectStatus; icon: string; label: string; demoted: boolean; numbers: string | null; pp: string | null; detail: string; wait: string | null; noBase: string | null; method: string | null; caveats: string[]; notCause: 'Não prova causa' }
    swipe: { saved: boolean; label: string } }>
  ledger: { medians: Array<{ type: string; median: string | null; n: number; range: string | null; few: boolean; text: string }>; groups: { reverts: number; withCaveat: number; inconclusiveByType: Record<string, number>; noVerdict: number }; totalCheck: boolean }
  empty: null | { text: string; hiddenBy: string | null }
}
export function buildMudancasView(obs: Observatory, p: Record<string, string | undefined>, saved: Set<string>): MudancasView
```
Rules (spec 2.3, CONVENCOES):
- The median only with n ≥ 5 (`RULES.effect.minN`); below that, a count per verdict + range (min–max) + "pouco para concluir".
- The ledger groups are disjoint and add up: `reverts + withCaveat + Σ inconclusive + noVerdict + Σ measured = total` (`totalCheck` must be true).
- An inconclusive verdict demotes the number (`demoted: true` → `--dim` style, never opacity).
- "Aguardando" uses `waitText`; n = 0 uses `noBaseText`; pp always via `fmt.pp`.
- Thumbnails before `seriesStart` are not shown as changes; an old version without an archived image says so ("trocas antes de DD/MM não têm a imagem antiga").
- The description line diff hides UTM noise behind a toggle ("mostrar ruído").
- `?changes=` shows exactly that list (cited by the forja); `?reading=` opens the reading card and never changes the list or any request.
- The empty state claims "não mexeram" only if the query without local filters is also 0; otherwise it names the filter that hides results (CONVENCOES final round).
- The title diff has screen-reader text per segment (`label`: saiu/entrou/mudou de lugar/só maiúsculas/minúsculas).

Mockup states → seeds: "Dados: Padrão" `{}`; "Vazio com sugestão" `query: '?q=zzzz'`; "Vazio em 90 dias" `{ emptyWindow: true }` (the seed shifts every change to > 90 days before NOW). "Pedido à forja (*)" → Task 35.

- [ ] **Step 1: View-model tests**

```ts
// @vitest-environment node
// apps/web/test/youtube/observatorio/mudancas-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
const v = buildMudancasView(obs, {}, new Set())
describe('Mudanças view model', () => {
  it('default window 30 d, all types and formats → 18 heroes (matches the tab)', () => expect(v.heroes.length).toBe(18))
  it('ledger closes the account', () => expect(v.ledger.totalCheck).toBe(true))
  it('median only with n ≥ 5; otherwise "pouco para concluir"', () => {
    for (const m of v.ledger.medians) if (m.n < 5) { expect(m.median).toBeNull(); expect(m.text).toMatch(/pouco para concluir/) }
  })
  it('pp are integers with U+2212', () => { for (const h of v.heroes) if (h.effect.pp) expect(h.effect.pp).toMatch(/^[+−]?\d+ pp$/) })
  it('aguardando shows waitText, never numbers', () => {
    for (const h of v.heroes.filter(h => h.effect.status === 'aguardando')) { expect(h.effect.wait).toMatch(/^Aguardando:/); expect(h.effect.numbers).toBeNull() }
  })
  it('?reading= never changes the list', () => {
    expect(buildMudancasView(obs, { reading: 'resumo-trocas-ia-20-10' }, new Set()).heroes.map(h => h.id)).toEqual(v.heroes.map(h => h.id))
  })
  it('empty with a local filter names the filter', () => {
    const e = buildMudancasView(obs, { q: 'zzzz' }, new Set()).empty!
    expect(e.hiddenBy).toBeTruthy(); expect(e.text).not.toMatch(/não mexeram/)
  })
})
```

- [ ] **Step 2:** component test with the audits (one filled button: none in Mudanças unless the forja is primary; the forja is outlined here); **Step 3:** implement; **Step 4:** `mudancas.spec.ts` fidelity; **Step 5:** side-by-side review; **Step 6:** commit:

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/mudancas" "apps/web/src/app/cms/(authed)/youtube/competitors/_mudancas" "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts" apps/web/test/youtube/observatorio/mudancas-view-model.test.ts apps/web/test/youtube/observatorio/mudancas-screen.test.tsx apps/web/e2e/tests/cms/observatorio/mudancas.spec.ts
git commit -m "feat: tela Mudanças — antes e depois de título, thumbnail e descrição com o efeito medido

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 25: Outliers

**Mockup:** `outliers.html` (states at `outliers.html:1024-1027`; the approval adjustment in `353492d3`: the main card spans 2 columns, cards in a row share height, the footer is anchored at the bottom).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/outliers/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_outliers/{outliers-screen.tsx,outliers.css,age-timeline.tsx,phase-group.tsx,outlier-card.tsx,param-chips.tsx,view-model.ts}`
- Test: `apps/web/test/youtube/observatorio/outliers-view-model.test.ts`, `outliers-screen.test.tsx`, `apps/web/e2e/tests/cms/observatorio/outliers.spec.ts`

**Interfaces:**
- Consumes: `obs.outliers(q)` (`orderedGroups`, `byAge`, `byPhase`, `weakExcluded`, `analyzed`, `untracked`), `obs.multiplier` labels, `PHASES`, `OUT_WINDOWS`, `link`.
- Produces:
```ts
export interface OutliersView {
  query: { niche: NicheScope; fmt: Fmt; ages: string[] | 'all'; min: number; topic: string | null; formula: string | null; channel: string | null; asof: string | null; reading: string | null; sort: 'mult' | 'vpd' | 'recent' }
  timeline: Array<{ id: string; label: string; count: number; selected: boolean }>; allCount: number
  groups: Array<{ id: string; label: string; why: string; cards: Array<{ id: string; main: boolean; title: string; channel: string; age: string; mult: string; multLabel: string; method: string; tier: 'mid' | 'high' | 'top' | null; weak: boolean; views: string; vpd7: string | null; historyHref: string; url: string; thumb: string | null }> }>
  chips: Array<{ key: string; label: string; invalid: boolean; removeHref: string }>
  baseText: string; empty: null | { text: string; actions: Array<{ label: string; href: string; n: number }> }
  asofNote: string | null // "Link da leitura de 20/10: ela via N; hoje são M"
}
export function buildOutliersView(obs: Observatory, p: Record<string, string | undefined>): OutliersView
```
Rules:
- Exclusive windows; the default is "Até 90 dias" (first two).
- Groups by phase in `PHASES` order: Estourando agora, Recentes, Perenes, Antigos, Novos, Sem ritmo medido.
- `min=0` = all videos with the formula/theme (no tier colour, "1,6× a mediana").
- Invalid params become removable chips.
- Every empty-state button shows an N equal to its destination's count.
- A weak base stays out of the count and is shown greyed/dashed only with `includeWeak`.
- The first card fits above the fold at 1440×900.
- Equivalent cards share height and width per row; the main card spans 2 columns and follows the row height; the footer is anchored at the bottom.

Mockup states → seeds: "Dados de hoje" `{}`; "Janela sem outliers" `query: '?ages=181-365&niche=ia'` (or whichever window the oracle shows empty: compute it in the spec with `obs.outliers({ages:[w]}).count === 0`); "Link de leitura (fórmula, todos os vídeos)" `query: '?formula=preco&min=0&asof=2026-10-20'`; "Link de leitura (tema)" `query: '?topic=comida-de-rua&asof=2026-10-20'`; "Link com filtro desconhecido" `query: '?ages=99-100&formula=nope'`. "Pedido à forja (*)" → Task 35.

- [ ] **Step 1: View-model tests**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildOutliersView } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
describe('Outliers view model', () => {
  it('default = longs, up to 90 days, count 11 (the tab)', () => {
    const v = buildOutliersView(obs, {})
    expect(v.groups.flatMap(g => g.cards).filter(c => !c.weak).length).toBe(11)
  })
  it('order = engine orderedGroups (phases in PHASES order)', () => {
    const v = buildOutliersView(obs, {})
    expect(v.groups.flatMap(g => g.cards.map(c => c.id))).toEqual(obs.outliers({ includeWeak: true }).orderedIds('mult'))
  })
  it('invalid params become removable chips and are not applied', () => {
    const v = buildOutliersView(obs, { ages: '99-100', formula: 'nope' })
    expect(v.chips.filter(c => c.invalid).map(c => c.key).sort()).toEqual(['ages', 'formula'])
  })
  it('empty-state buttons carry the destination N', () => {
    const empty = buildOutliersView(obs, { ages: '181-365', niche: 'ia', fmt: 'short' })
    for (const a of empty.empty?.actions ?? []) expect(a.n).toBeGreaterThan(0)
  })
  it('edge-of-band label says the age at the reading', () => {
    const v = buildOutliersView(obs, { ages: 'all' })
    const edge = v.groups.flatMap(g => g.cards).find(c => /este tinha/.test(c.multLabel))
    if (edge) expect(edge.multLabel).toMatch(/no registro de \d\d\/\d\d \d\d:\d\d \(este tinha \d+ dias?; n = \d+\)/)
  })
})
```

- [ ] **Step 2:** component test + audits. **Step 3:** implement. **Step 4:** fidelity spec, adding the layout audit `equalHeights('[data-outlier-row]')` and `aboveFold('[data-outlier]:first-of-type', 900)` at 1440×900. **Step 5:** side by side (pay attention to the approved card adjustment). **Step 6:** commit:

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/outliers" "apps/web/src/app/cms/(authed)/youtube/competitors/_outliers" apps/web/test/youtube/observatorio/outliers-view-model.test.ts apps/web/test/youtube/observatorio/outliers-screen.test.tsx apps/web/e2e/tests/cms/observatorio/outliers.spec.ts
git commit -m "feat: tela Outliers — janelas de idade, fases e multiplicador pela idade com cards de mesma altura

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 26: Histórico por vídeo

**Mockup:** `historico-video.html` (states at `historico-video.html:1051-1054`; demo picks `demoVideos()` at `:1015-1021`: `full, pre, few, none, noreg, untr, old, err, bf`).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/video/[id]/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_historico/{historico-screen.tsx,historico.css,views-chart.tsx,lanes.tsx,versions.tsx,compare.tsx,pager.tsx,view-model.ts}`
- Test: `apps/web/test/youtube/observatorio/historico-view-model.test.ts`, `historico-screen.test.tsx`, `apps/web/e2e/tests/cms/observatorio/historico.spec.ts`

**Interfaces:**
- Consumes: `obs.video`, `obs.expectedCurve`, `obs.periodRate`, `obs.changesIn({video})`, `obs.effect`, `obs.caveats`, `link.historico` (`from`, `back`, `ids`).
- Produces:
```ts
export interface HistoricoView {
  video: { id: string; title: string; channel: string; niche: Niche | null; age: string; url: string; nicheToast: string | null }
  chart: { points: Array<{ t: number; vpd: number | null }>; expected: Array<{ t: number; vpd: number }>; expectedMethod: string; compressedBefore: number | null /* seriesStart */ }
  lanes: Array<{ type: 'title' | 'thumb' | 'desc'; versions: Array<{ id: string; label: string; from: string; to: string; atLeast: boolean; participle: string; precision: string }> }>
  comparisons: Array<{ changeId: string; before: string; after: string; scale: string; effect: MudancasView['heroes'][number]['effect'] }>
  pager: { prev: string | null; next: string | null; backHref: string; position: string } | null
  state: 'full' | 'pre' | 'few' | 'none' | 'noreg' | 'untr' | 'old' | 'err' | 'bf' | 'not-found'
}
export function buildHistoricoView(obs: Observatory, id: string, p: Record<string, string | undefined>): HistoricoView
```
Rules (spec 2.6):
- Views/day is a step curve, with the expected curve dashed in `--muted` (never forja colour).
- Lanes for title, thumbnail and description use 6 h or 1 d windows, and the exact minute when available.
- The period before `seriesStart` is compressed.
- Versions say "pelo menos" when the start or end was not observed.
- The participle follows the type: title visto/trocado; thumbnail and description vista/trocada.
- The pager rebuilds the origin list (`back=`, `ids=`). Without `from`, the breadcrumb is Mudanças.
- `?video` of another niche changes the niche for display only (no persistence) + the toast "Nicho mudou para Viagem para mostrar este vídeo".
- An unknown id → the not-found state, never a 500.

Mockup states → seeds: one per demo video category (the seeded oracle ids). Use `query` `/video/<seeded uuid of PICK[k]>` for each k in `full, pre, few, none, noreg, untr, old, err, bf`. "Pedido de leitura do vídeo (*)" → Task 35.

- [ ] **Step 1: View-model tests**, including:
  - the participle per type (title "visto", thumbnail "vista");
  - "pelo menos" on a version whose `first_seen` equals `seriesStart`;
  - the pager built from `ids=a,b,c` with `back=?niche=ia` → prev/next hrefs keep `from`/`back`/`ids`;
  - an unknown id → `state: 'not-found'`;
  - the other-niche toast text.
- [ ] **Step 2–6:** component test + audits → implement → fidelity spec (9 demo states × 2 viewports × 2 themes) → side by side → commit:

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/video" "apps/web/src/app/cms/(authed)/youtube/competitors/_historico" apps/web/test/youtube/observatorio/historico-view-model.test.ts apps/web/test/youtube/observatorio/historico-screen.test.tsx apps/web/e2e/tests/cms/observatorio/historico.spec.ts
git commit -m "feat: histórico por vídeo — todas as versões de título, thumbnail e descrição sobre a curva de views

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 27: Insights (site-computed parts)

**Mockup:** `insights.html` (states at `insights.html:808-815`: `NONE`, the 9 request states, `EMPTY`).

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/insights/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_insights/{insights-screen.tsx,insights.css,formulas.tsx,cadence.tsx,heatmap.tsx,themes.tsx,you-in-niche.tsx,gaps.tsx,view-model.ts}`
- Modify: delete `_components/insights-tab.tsx` usage from the old dashboard (Task 28 deletes the file)
- Test: `apps/web/test/youtube/observatorio/insights-view-model.test.ts`, `insights-screen.test.tsx`, `apps/web/e2e/tests/cms/observatorio/insights.spec.ts`

**Interfaces:**
- Consumes: `obs.patternsNow`, `obs.formulas`, `obs.cadence`, `obs.heatmap`, `obs.themeTrend`, `obs.nicheStats`, `obs.ownCoverage`, `RULES.pattern`.
- Produces: `InsightsView` with sections:
  - `formulas` (a rule passes only with n ≥ 10 and Δ ≥ 0,3×; otherwise "recorrência observada (n = 7) — pouco para concluir");
  - `cadence` per channel ("costuma" only when the day+hour pair has ≥ 3 videos and ≥ 30 %; otherwise "horário variado (n = 4)");
  - `heatmap` day × 2 h block in SP (uploads and multiplier, ties and the dominant channel);
  - `themes` (empty state when there is no `temas` reading);
  - `youInNiche` (relative metrics only);
  - `gaps` (relative only; warns "tags em outro idioma não casam" when using tags);
  - `reading: null` (the frozen-reading hero arrives in Task 35).
  The weekday is computed, never "sexta" hardcoded (spec D6).

Mockup states → seeds: `NONE` `{}` (the reading hero is absent in P3; compare with `textAllow` removing the hero block until Task 35 adds it), `EMPTY` `{ scenario: 'empty' }` (no videos in 90 d). The 9 request states → Task 35.

- [ ] **Step 1: View-model tests**, including:
  - a formula with n = 7 never says "padrão";
  - a video published Friday 23:30 SP shows in Friday's 22–24 block;
  - no `vsYou` against an own channel with 0 videos (the honest empty state, spec D6);
  - an empty dataset → every section has its empty text and no `NaN`.
- [ ] **Step 2–6:** component test + audits → implement → fidelity spec → side by side → commit:

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/insights" "apps/web/src/app/cms/(authed)/youtube/competitors/_insights" apps/web/test/youtube/observatorio/insights-view-model.test.ts apps/web/test/youtube/observatorio/insights-screen.test.tsx apps/web/e2e/tests/cms/observatorio/insights.spec.ts
git commit -m "feat: tela Insights — fórmulas com regra, ritmo, mapa em São Paulo, temas e você no nicho

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 28: Remove the legacy observatory and redirect old links

**Files:**
- Delete: `apps/web/src/app/cms/(authed)/youtube/competitors/_components/{competitor-dashboard-v2,insights-tab,mudancas-tab,outliers-tab,channel-card,channel-drawer,video-modal,sparkline-chart,confirm-full-sync-dialog,useFullSyncProgress,remove-channel-dialog,add-channel-modal}.tsx|ts` — only those no longer imported (check each with `grep -rn "<name>" apps/web/src`)
- Modify: `apps/web/src/lib/youtube/observatory-types.ts` (delete types no longer referenced; keep what the pipeline/MCP still use)
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts` notification `action_href` → `/cms/youtube/competitors/mudancas`
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx` (`?tab=` redirect)
- Test: `apps/web/test/youtube/observatorio/legacy-redirect.test.ts`

- [ ] **Step 1: Failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
import { legacyTabRedirect } from '@/app/cms/(authed)/youtube/competitors/_canais/legacy'
describe('legacy ?tab=', () => {
  it('maps tabs to routes', () => {
    expect(() => legacyTabRedirect('mudancas')).toThrow('REDIRECT /cms/youtube/competitors/mudancas')
    expect(() => legacyTabRedirect('outliers')).toThrow('REDIRECT /cms/youtube/competitors/outliers')
    expect(() => legacyTabRedirect('insights')).toThrow('REDIRECT /cms/youtube/competitors/insights')
    expect(legacyTabRedirect('canais')).toBeUndefined()
    expect(legacyTabRedirect(undefined)).toBeUndefined()
  })
})
```
- [ ] **Step 2:** FAIL → implement `legacy.ts` (`redirect(link.mudancas())` etc.) and call it at the top of Canais `page.tsx`.
- [ ] **Step 3:** delete the dead components; `grep -rn "Testar esta abordagem\|Abrir no Cowork\|Montar roteiro" apps/web/src` must return nothing.
- [ ] **Step 4:** `cd apps/web && npx tsc --noEmit && npx vitest run test/youtube test/mcp` → PASS.
- [ ] **Step 5:** commit:

```bash
git add -u "apps/web/src/app/cms/(authed)/youtube/competitors/_components" apps/web/src/lib/youtube/observatory-types.ts
git add apps/web/src/lib/youtube/competitor-sync.ts "apps/web/src/app/cms/(authed)/youtube/competitors/page.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais/legacy.ts" apps/web/test/youtube/observatorio/legacy-redirect.test.ts
git commit -m "refactor: sai o observatório antigo (botões de Cowork) e ?tab= redireciona para as rotas novas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
(`git add -u <dir>` stages only deletions/modifications inside that directory: explicit-path staging, allowed.)

**P3 ship gate:**
1. Full `npx vitest run`, typecheck, and every `e2e/tests/cms/observatorio/*.spec.ts`.
2. The authenticated `/cms` sweep from `docs/ops/runbook-cms-e2e-local.md`, which must include the 5 new routes with status 200, no boundary, and a console without errors on real navigation.
3. Then push.

---
# Phase P4 — The forja as the R&D centre: typed queue, frozen readings, pipeline API, worker

**Design:**
- **One global queue:** the existing `youtube_intelligence_tasks` table gains a `task_type`. Existing Health Coach rows are `task_type='diagnostico'`.
- **Targets:** a request is keyed by (type, target). The target is a niche for `padroes-titulo`, `padroes-titulo-shorts`, `temas` and `resumo-trocas`, and a video for `leitura-video` (which also records the video's niche).
- **"Ocupado":** an active request blocks the same type in the same niche (CONVENCOES F11: other types in the same niche are allowed).
- **Quota:** 1 per niche + type per São Paulo day. Only `completed` counts; failure and refusal don't.
- **Backward compatibility:** the old worker claims with `channel_ids` only and keeps getting only `diagnostico` tasks. Observatory tasks are claimed only by a worker that sends `task_types`, and the claim records those types as the heartbeat's `capabilities`. Until the owner installs the new worker, the UI says the forja does not read observatory requests yet (Review Focus 3).
- **Budget:** one claim per tick, one request = one type × one target, `sent` capped at `RULES.forja.maxVideos = 400` videos (the most recent N, said in `sent.text`). 20 min claim < 25 min cron < 30 min watchdog stays untouched.

### Task 29: Migration — typed tasks, frozen readings, heartbeat

**Files:**
- Create: `supabase/migrations/<ts>_observatorio_forja.sql` (via `npm run db:new observatorio_forja`)
- Modify: `apps/web/src/lib/youtube/observatorio/load.ts` (remove the `readOptional` guard from Task 20)
- Test: `apps/web/test/integration/observatorio-forja-migration.test.ts`

**Interfaces:**
- Produces:
  - `youtube_intelligence_tasks.{task_type, target_niche, target_video_id, target_fmt, refused_at, refused_reason, released_at, sent}`; `channel_id` becomes nullable; status adds `'refused'`;
  - `competitor_readings(id, site_id, task_id, task_type, niche, video_id, fmt, model, generated_at, sent, analysis, text, evidence)`;
  - `forja_heartbeat(site_id pk, last_poll_at, capabilities text[], key_id, updated_at)`.

- [ ] **Step 1: Failing DB-gated test**

```ts
// apps/web/test/integration/observatorio-forja-migration.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
describe.skipIf(skipIfNoLocalDb())('migration observatorio_forja', () => {
  const sb = getSupabaseServiceClient(); let siteId = ''
  beforeAll(async () => { siteId = (await sb.from('sites').select('id').limit(1).single()).data!.id; await sb.from('youtube_intelligence_tasks').delete().eq('site_id', siteId).neq('task_type', 'diagnostico') })
  const ask = (type: string, niche: string) => sb.from('youtube_intelligence_tasks').insert({ site_id: siteId, task_type: type, target_niche: niche, trigger_type: 'manual', status: 'pending' })
  it('observatory task without channel_id is valid; diagnostico without channel_id is not', async () => {
    expect((await ask('temas', 'ia')).error).toBeNull()
    expect((await sb.from('youtube_intelligence_tasks').insert({ site_id: siteId, task_type: 'diagnostico', trigger_type: 'manual' })).error?.message).toMatch(/check/i)
  })
  it('same type + same niche active twice → unique violation; other type same niche → ok', async () => {
    expect((await ask('temas', 'ia')).error?.message).toMatch(/duplicate|unique/i)
    expect((await ask('padroes-titulo', 'ia')).error).toBeNull()
  })
  it('status refused exists', async () => {
    const { data } = await ask('resumo-trocas', 'viagem').select('id').single()
    expect((await sb.from('youtube_intelligence_tasks').update({ status: 'refused', refused_reason: 'dado-velho', refused_at: new Date().toISOString() }).eq('id', data!.id)).error).toBeNull()
  })
  it('readings and heartbeat tables exist', async () => {
    expect((await sb.from('competitor_readings').select('id').limit(1)).error).toBeNull()
    expect((await sb.from('forja_heartbeat').upsert({ site_id: siteId, last_poll_at: new Date().toISOString(), capabilities: ['temas'] })).error).toBeNull()
  })
})
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Migration**

```sql
-- Observatório v2 — fila única da forja com tipo e alvo, leituras congeladas, batimento da máquina.
-- Linhas existentes do Health Coach viram task_type = 'diagnostico' (default) e nada muda para elas.

alter table youtube_intelligence_tasks
  add column if not exists task_type text not null default 'diagnostico',
  add column if not exists target_niche text,
  add column if not exists target_video_id uuid references competitor_videos(id) on delete cascade,
  add column if not exists target_fmt text,
  add column if not exists refused_at timestamptz,
  add column if not exists refused_reason text,
  add column if not exists released_at timestamptz,
  add column if not exists sent jsonb;
alter table youtube_intelligence_tasks alter column channel_id drop not null;

alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_task_type_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_task_type_check
  check (task_type in ('diagnostico', 'padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'));
alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_target_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_target_check
  check ((task_type = 'diagnostico' and channel_id is not null)
      or (task_type <> 'diagnostico' and target_niche in ('viagem', 'ia')
          and ((task_type = 'leitura-video') = (target_video_id is not null))));
alter table youtube_intelligence_tasks drop constraint if exists youtube_intelligence_tasks_status_check;
alter table youtube_intelligence_tasks add constraint youtube_intelligence_tasks_status_check
  check (status in ('pending', 'running', 'completed', 'failed', 'stale', 'refused'));

drop index if exists idx_yt_intel_task_active;
create unique index if not exists idx_yt_intel_task_active
  on youtube_intelligence_tasks (site_id, channel_id)
  where status in ('pending', 'running') and task_type = 'diagnostico';
create unique index if not exists idx_yt_intel_obs_active
  on youtube_intelligence_tasks (site_id, task_type, target_niche)
  where status in ('pending', 'running') and task_type <> 'diagnostico';
create index if not exists idx_yt_intel_obs_quota
  on youtube_intelligence_tasks (site_id, task_type, target_niche, completed_at desc)
  where status = 'completed' and task_type <> 'diagnostico';

create table if not exists competitor_readings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  task_id uuid unique references youtube_intelligence_tasks(id) on delete set null,
  task_type text not null,
  niche text check (niche in ('viagem', 'ia')),
  video_id uuid references competitor_videos(id) on delete cascade,
  fmt text check (fmt in ('long', 'short')),
  model text not null,
  generated_at timestamptz not null,
  sent jsonb not null,
  analysis jsonb not null default '{}'::jsonb,
  text jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitor_readings_latest on competitor_readings (site_id, task_type, niche, generated_at desc);
alter table competitor_readings enable row level security;
drop policy if exists "competitor_readings_select" on competitor_readings;
create policy "competitor_readings_select" on competitor_readings for select using (public.can_view_site(site_id));

create table if not exists forja_heartbeat (
  site_id uuid primary key references sites(id) on delete cascade,
  last_poll_at timestamptz not null,
  capabilities text[] not null default '{}',
  key_id uuid,
  updated_at timestamptz not null default now()
);
alter table forja_heartbeat enable row level security;
drop policy if exists "forja_heartbeat_select" on forja_heartbeat;
create policy "forja_heartbeat_select" on forja_heartbeat for select using (public.can_view_site(site_id));
```

- [ ] **Step 4:** `npm run db:reset`, regenerate types, run the test → PASS. Remove `readOptional` from `load.ts` (read the three tables normally), then run `cd apps/web && npx vitest run test/youtube/observatorio/load.test.ts && npx tsc --noEmit` → PASS. Also run the existing Health Coach tests, which must stay green (`test/integration/youtube-intelligence-forja.test.ts`, `test/cron/youtube-intelligence-watchdog.test.ts`, `test/youtube/analysis-actions.test.ts`).

- [ ] **Step 5: Commit + ASK before prod**

```bash
git add supabase/migrations/*_observatorio_forja.sql apps/web/src/types/database.types.ts apps/web/src/lib/youtube/observatorio/load.ts apps/web/test/integration/observatorio-forja-migration.test.ts
git commit -m "feat: fila única da forja com tipo e alvo, leituras congeladas e batimento da máquina

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
Ask the owner before `npm run db:push:prod`.

### Task 30: Queue service — ask, cancel, claim by types, heartbeat, refuse, complete

**Files:**
- Create: `apps/web/src/lib/pipeline/services/forja-queue.ts`
- Modify: `apps/web/src/lib/pipeline/services/youtube.ts:630-671` (`claimNextTask` delegates to `forja-queue.claim`)
- Test: `apps/web/test/youtube/forja-queue.test.ts` (unit with a fake client), `apps/web/test/integration/forja-queue.test.ts` (DB-gated), `apps/web/test/youtube/claim-capabilities.test.ts`

**Interfaces:**
- Consumes: Task 29 schema; `ServiceContext`, `ok`, `err` (existing in `services/types.ts`); engine `forja/quota.ts`, `planAsk` (Task 31) — implement this task AFTER Task 31 if executing strictly in order fails on imports; the plan orders 29 → 31 → 32 → 30 → 33 → 34 → 35 → 36 when executing (task numbers are stable names, not execution order).
- Produces:
```ts
export const OBS_TYPES = ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] as const
export type ObsType = typeof OBS_TYPES[number]
export interface AskInput { type: ObsType; scope: NicheScope; videoId?: string; fmt?: Fmt; userId: string }
export interface AskOutcome { ok: boolean; reason: string | null; results: Array<{ niche: Niche; ok: boolean; reason: string | null; taskId?: string }> }
export async function askReading(ctx: ServiceContext, input: AskInput, now: number): Promise<ServiceResult<AskOutcome>>
export async function cancelReading(ctx: ServiceContext, input: { type: ObsType; niche: Niche; videoId?: string }): Promise<ServiceResult<{ cancelled: boolean }>>
export async function claim(ctx: ServiceContext, input: { channelIds: string[]; taskTypes?: ObsType[] }, now: number): Promise<ServiceResult<IntelTask | null>>
export async function recordHeartbeat(ctx: ServiceContext, capabilities: ObsType[], now: number): Promise<void>
export async function refuseTask(ctx: ServiceContext, taskId: string, reason: string): Promise<ServiceResult<{ id: string; status: 'refused' }>>
export async function completeReading(ctx: ServiceContext, input: ReadingSubmission): Promise<ServiceResult<{ readingId: string }>>
```
Rules:
1. **`askReading`:**
   - loads the active observatory tasks + today's completed ones + the heartbeat + the dataset (for eligibility);
   - runs the engine's `planAsk` (Task 31): free niche, quota, `blockedBy`, channels out of scope (sync > 24 h), and the capability (no capability for the type → reason "A forja ainda não lê pedidos do observatório.");
   - inserts one `pending` row per free niche, in click order;
   - a unique-violation race maps to the engine's "já há um pedido…" text.
2. **`claim` (global queue):**
   - always calls `recordHeartbeat(ctx, taskTypes ?? [])` FIRST, even when the queue is empty;
   - selects the oldest `pending` row where `(task_type='diagnostico' and channel_id in channelIds) or (task_type in taskTypes)`, ordered by `requested_at asc`;
   - CAS to `running` exactly like today. The column list returned is closed and adds `task_type, target_niche, target_video_id, target_fmt`.
   - No `taskTypes` → only `diagnostico` (old worker unchanged).
3. **`refuseTask`:** CAS `running → refused` with `refused_reason` (≤ 200 chars) and `refused_at`; same owner check as `failTask` (`claimed_by === keyId` unless wide).
4. **`completeReading`:**
   - validates with Zod;
   - the task is `running`, owned by the key, and of an observatory type;
   - `evidence[].id` ⊆ `task.sent.ids`;
   - every number in `text.lead`/`text.items` appears in `task.sent.numbers` (a number not in the data sent → reject, the same rule as the forja validator);
   - then inserts `competitor_readings` (with `sent` copied from the task) and marks the task `completed` in ONE RPC or two writes with the CAS on `status='running'` (a second POST → 409).

- [ ] **Step 1: Failing tests (unit, fake client)**

```ts
// @vitest-environment node
// apps/web/test/youtube/claim-capabilities.test.ts
import { describe, it, expect } from 'vitest'
import { claimFilter } from '@/lib/pipeline/services/forja-queue'
describe('claim filter (global queue, backward compatible)', () => {
  it('old worker (no task_types) only sees diagnostico for its channels', () => {
    expect(claimFilter(['c1'], undefined)).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1))')
  })
  it('new worker sees its channels AND the observatory types it announced', () => {
    expect(claimFilter(['c1'], ['temas', 'resumo-trocas'])).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1)),task_type.in.(temas,resumo-trocas)')
  })
  it('an unknown type in task_types is dropped, never injected into the filter', () => {
    expect(claimFilter(['c1'], ['temas', 'x);drop' as never])).toBe('and(task_type.eq.diagnostico,channel_id.in.(c1)),task_type.in.(temas)')
  })
})
```
`claimFilter` is exported for the PostgREST `.or()` string. Validate `channelIds` as UUIDs and `taskTypes` against `OBS_TYPES` before building it.

```ts
// apps/web/test/integration/forja-queue.test.ts (DB-gated) — cases:
// 1. askReading('temas','todos') with heartbeat capabilities ['temas'] → 2 pending rows (ia, viagem), results ok in click order
// 2. second ask same type+niche → ok:false, reason starts "Nada enviado: já há um pedido de IA"
// 3. a completed 'temas'/'ia' today → ask → reason = quota text; a failed one today → allowed
// 4. heartbeat capabilities [] → ask → ok:false, reason 'A forja ainda não lê pedidos do observatório.'
// 5. claim({channelIds:[own], taskTypes:undefined}) never returns an observatory task; claim with taskTypes returns the oldest pending of any type
// 6. claim on an empty queue still writes forja_heartbeat.last_poll_at = now and capabilities
// 7. completeReading with a number not in sent.numbers → 400 VALIDATION_ERROR; valid → reading row + task completed; second POST → 409
// 8. refuseTask → status refused; it does not count in the quota (ask again same day → allowed)
```
Write each case as an `it(...)` with real inserts/asserts (helpers: `seedSite()`, `seedHeartbeat(caps)`, `ctx()` building a `ServiceContext` with the service client, `keyId` and `permissions: ['intelligence']`).

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** `forja-queue.ts` and make `claimNextTask` call `claim(ctx, { channelIds: channelIds ?? [], taskTypes: undefined }, Date.now())`. The legacy GET claim route (Cowork, write key) passes no channel ids. Preserve its behaviour: with `channelIds` empty AND no types, `claimFilter` returns `task_type.eq.diagnostico`. Add that case to the unit test.
- [ ] **Step 4: Run** `cd apps/web && npx vitest run test/youtube/claim-capabilities.test.ts test/youtube/forja-queue.test.ts && HAS_LOCAL_DB=1 npx vitest run test/integration/forja-queue.test.ts test/integration/youtube-intelligence-forja.test.ts && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/services/forja-queue.ts apps/web/src/lib/pipeline/services/youtube.ts apps/web/test/youtube/claim-capabilities.test.ts apps/web/test/youtube/forja-queue.test.ts apps/web/test/integration/forja-queue.test.ts
git commit -m "feat: fila da forja — pedido por tipo e nicho com cota, claim por tipos anunciados e batimento

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 31: Engine — request states, status texts, queue order, compose and the ask planner

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/forja/{states,quota,session}.ts`
- Create: `apps/web/test/youtube/observatorio/forja-scenarios.ts` (TEST fixture: port of `REQ_SCENARIOS` + `requestScenario` request generation, `dados.js:1450-1621`, producing `ForjaRequest[]` that are then summarised by PRODUCTION code)
- Modify: `index.ts` (expose `forja.{requestStates, requestScenario (test-injected), compose, session, queue, states, quotaScope, requests}`)
- Modify: `suite-pending.ts` (delete `'forja'` once its tests pass; keep the F-round sections until Task 32)
- Test: `apps/web/test/youtube/observatorio/forja-states.test.ts`, `forja-parity.test.ts`

**Interfaces:**
- Produces:
```ts
// states.ts
export interface Machine { lastPollAt: number | null; alive: boolean; tickMinutes: number; nextPollAt: number | null; text: string }
export interface Scenario {
  requests: ForjaRequest[]; request: ForjaRequest | null; statusLines: string[]; statusLabel: string; statusText: string
  split: boolean; active: boolean; anyActive: boolean; terminal: boolean; future: boolean; empty?: boolean
  quota: { usedToday: number; text: string; releasesAt: number | null; byNiche?: Record<Niche, { free: boolean; text: string }> }
  machine: Machine
}
export function requestStateOf(task: { status: string; retry_count: number; requested_at: string; started_at: string | null; completed_at: string | null; failed_at: string | null; refused_at: string | null; released_at: string | null }, machine: { lastPollAt: number | null }, now: number): RequestState
export function statusLabel(req: ForjaRequest, clock: Clock, o?: { prefixNiche?: boolean; ahead?: ForjaRequest | null }): string   // CONVENCOES line 218 format
export function statusText(...): string                                 // port of summarize/againText/aheadNote text branches
export function summarize(requests: ForjaRequest[], machine: Machine, scopeTodos: boolean, clock: Clock): Scenario // dados.js:1841-1864
export function queueOrder(reqs: ForjaRequest[]): ForjaRequest[]       // dados.js:1639-1644
export function compose(base: Scenario, newReq: Partial<ForjaRequest> & { niche: Niche }, opts: { niche?: NicheScope; createdAt?: number }, clock: Clock): Scenario // dados.js:1645-1680
// quota.ts
export function quotaFor(requests: ForjaRequest[], type: string, niche: Niche, now: number, clock: Clock): { free: boolean; usedToday: number; releasesAt: number; text: string }
// session.ts — the planner the DB service uses (pure port of OBS.forja.session.ask/current/cancel, dados.js:1693-1826, minus storage)
export function createSession(requests: ForjaRequest[], machine: Machine, clock: Clock, opts: { capabilities: string[]; eligible: (niche: Niche) => { in: string[]; out: Array<{ id: string; reason: string }> } }): {
  current(scope: NicheScope, o?: { type?: string; video?: string }): Scenario & { blockedBy?: unknown; machineBusy?: string | null }
  ask(scope: NicheScope, o?: { type?: string; video?: string; createdAt?: number }): { ok: boolean; reason: string | null; results: Array<{ niche: Niche; ok: boolean; reason: string | null }>; scenario: Scenario }
  cancel(scope: NicheScope, o?: { type?: string; video?: string }): Scenario
}
export function planAsk(...): ReturnType<ReturnType<typeof createSession>['ask']> // used by forja-queue.askReading
```
Machine-alive rule (CONVENCOES "Fila"): with a heartbeat, "sem máquina" = no poll for > 30 min (3 ticks); "atrasado" = the machine is alive but the request has waited > 25 min (`LATE_AFTER_MINUTES`); "sem máquina" for a request also holds when it has waited > 24 h (`UNSERVED_AFTER_HOURS`). Import those constants from `apps/web/src/lib/youtube/analysis-progress.ts`; never duplicate them.

- [ ] **Step 1: Hand-written tests (`forja-states.test.ts`)**, all with a clock at 24/10 15:02 SP:
  - `requestStateOf`: pending 4 min, alive → `'na fila'`; pending 32 min, alive → `'atrasado'`; pending, last poll 2 h ago → `'sem máquina'`; running → `'trabalhando'`; pending with `released_at` set and retry 1 → `'liberado pelo vigia'`; pending with retry 1 and no `released_at` → `'nova tentativa'`; `refused` → `'recusado (dado velho)'`; failed → `'falhou'`; completed → `'publicado'`.
  - `statusLabel` gives exactly the 9 strings of CONVENCOES line 218 for their fixtures ("na fila · pedido 14:58", "trabalhando desde 14:45", "atrasado · pedido 14:33", "sem máquina desde 12:55", "nova tentativa · 15:05", "liberado pelo vigia · 15:05", "falhou às 14:21", "recusado às 14:56", "publicado às 14:50").
  - "sem máquina" single niche: "Seu pedido das 14:48 está na fila e roda quando a máquina voltar."; Todos: "Seus pedidos das 14:48 (IA e Viagem) estão na fila e rodam quando a máquina voltar."
  - `quotaFor`: one completed today → not free, `releasesAt` = next SP midnight; one failed today → free with "falha não conta na cota"; one refused → free.
  - The session asking a type the machine has not announced → `ok:false`, reason "A forja ainda não lê pedidos do observatório."
  - A video reading of IA active → asking another IA video → `ok:false`, with `blockedBy` naming the other video.
- [ ] **Step 2: Parity** (`forja-parity.test.ts`): for every state in `requestStates` × target `{niche: ia}`, `{niche: viagem}`, `{niche: todos}` × type in `{padroes-titulo, resumo-trocas, leitura-video}`, build the requests with `forja-scenarios.ts`. Then `summarize(...)` (production) must deep-equal the oracle's `requestScenario(...)` on `statusLabel`, `statusLines`, `statusText`, `terminal`, `anyActive`, `split` and `quota.text`.
- [ ] **Step 3: Run → FAIL**, port, wire the facade (`forja.requestScenario` = fixture-built requests → production `summarize`; inject it ONLY in `test/youtube/observatorio/oracle.ts` via `createObservatory(ds, { testScenarios })`). Delete `'forja'` from pending. Run → PASS.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/forja apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/forja-scenarios.ts apps/web/test/youtube/observatorio/forja-states.test.ts apps/web/test/youtube/observatorio/forja-parity.test.ts apps/web/test/youtube/observatorio/oracle.ts apps/web/test/youtube/observatorio/suite-pending.ts
git commit -m "feat: motor da forja — estados do pedido, textos canônicos, fila única, cota e planejador do pedido

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 32: Engine — "Desde então", scope, preview, timing, reading-scoped outliers

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/forja/{since,scope}.ts`
- Modify: `outliers.ts` (the `reading` branch uses `readingScope`), `index.ts` (expose `forja.{readings, byId, latest, since, eligibleChannels, preview, readingScope, timing, readingTypes, readingTypeFor, shortsNote}`)
- Modify: `suite-pending.ts` (delete `'texto das leituras (…)'` and the four `rodada F…` sections)
- Create: `apps/web/src/lib/youtube/observatorio/forja/sent.ts` — `buildSent(obs, type, niche|video, fmt)` → the frozen data the forja receives (`{text, asOf, ids, numbers, nVideos, nOutliers, channels, channelsOut, items}`)
- Test: `apps/web/test/youtube/observatorio/forja-since.test.ts`, `forja-sent.test.ts`

**Interfaces:**
- Produces (ports `dados.js:992-1034` types catalogue, `1252-1275`, `1355-1449`, `1865-1915`):
```ts
export const READING_TYPES: Array<{ id: string; label: string; windowDays: number; fmt?: Fmt; shorts?: boolean; aka?: string }>
export function since(ctx: EngineCtx, reading: FrozenReading): { text: string; textNoAsk: string; shortText: string; countsText: string; newVideos: number; leftWindow: number; becameOutlier: number; titleChanged: number; staleNow: string[]; nowVideos: number; nowOutliers: number; items?: unknown[]; flipped?: number; moved?: unknown[]; newPoints?: number; newChanges?: number }
export function eligibleChannels(ctx: EngineCtx, niche: Niche): { in: string[]; out: Array<{ id: string; reason: string }> } // out: sync > RULES.staleSyncHours, with "<Canal> fica fora: sem sincronização há 3 dias"
export function preview(ctx: EngineCtx, type: string, niche: Niche, fmt?: Fmt): { nVideos: number; nOutliers: number; channelsIn: string[]; channelsOut: Array<{ id: string; reason: string }>; text: string; changes?: number }
export function readingScope(ctx: EngineCtx, id: string, filt?: { formula?: string; theme?: string; min?: number; channel?: string }): null | { channels: string[]; fmt: Fmt; niche: Niche; windowDays: number; ages: string[]; maxAge: number; asof: string; asOf: number; nThen: number; text: string }
export function timing(requests: ForjaRequest[], type: string, niche: Niche): { n: number; medianMinutes: number | null; text: string } // "tempo deste tipo ainda não medido (2 leituras; mediana a partir de 5)"
export function buildSent(obs: Observatory, type: string, target: { niche: Niche; videoId?: string; fmt?: Fmt }): SentPack
export interface SentPack { text: string; asOf: number; ids: string[]; numbers: string[]; nVideos: number; nOutliers: number; channels: string[]; channelsOut: Array<{ id: string; reason: string }>; items: Array<Record<string, string | number | null>>; capped: boolean }
```
`buildSent` caps at `RULES.forja.maxVideos` (400, most recent first) and says so in `text` ("os 400 mais recentes de 1.230"). `numbers` is every number the site sends, formatted the way the forja may cite them (`fmt.num`, `fmt.mult`, integers). It is the whitelist for the validator in `completeReading` (Task 30). The production texts of the reading types are ported verbatim from `READING_TYPES` (`dados.js:992-996`).

- [ ] **Step 1: Tests**:
  - `forja-since.test.ts`: `since` of `padroes-titulo-ia-20-10` → `shortText` starts "desde então:" and `text` starts "Desde então:", with no final period on the first line (CONVENCOES F11); with an active request `textNoAsk` lacks "Peça nova leitura…"; "nada mudou" only when every count is equal. Parity: `since`, `preview`, `readingScope` and `timing` deep-equal the oracle for every reading in `forja.readings`.
  - `forja-sent.test.ts`: the cap at 400 with text; a channel with sync > 24 h is in `channelsOut` with its reason; `numbers` contains every `fmt.mult` of the outliers sent; an empty niche → `nVideos: 0` and `text` "nenhum vídeo …" (never "0 vídeos" posing as data).
- [ ] **Step 2–3:** FAIL → port → delete the five pending sections → `npx vitest run test/youtube/observatorio/` → PASS. **The verbatim suite must now pass everything except `NOT_PORTED`/`NOT_PORTED_TESTS`.** Add this assertion to `mockup-suite.test.ts`:

```ts
it('nothing left pending', () => expect([...PENDING_SECTIONS]).toEqual([]))
```
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/forja apps/web/src/lib/youtube/observatorio/outliers.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/forja-since.test.ts apps/web/test/youtube/observatorio/forja-sent.test.ts apps/web/test/youtube/observatorio/suite-pending.ts apps/web/test/youtube/observatorio/mockup-suite.test.ts
git commit -m "feat: motor da forja — desde então, escopo e prévia do pedido, dados enviados com teto

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 33: Pipeline API — claim by types, refuse, readings endpoint; registry and Cowork docs

**Files:**
- Modify: `apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts` (body `task_types?`)
- Modify: `apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts` (body `refuse?: boolean`)
- Create: `apps/web/src/app/api/pipeline/youtube/competitors/readings/route.ts` (`GET ?task_id=` → `SentPack` frozen into `task.sent` on first read; `POST` → `completeReading`)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (youtube domain: +2 endpoints (GET/POST readings), update the claim/fail summaries, `endpoint_count` += 2)
- Modify: `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (new section "Leituras do observatório (forja)")
- Test: `apps/web/test/api/pipeline-competitor-readings.test.ts`; the existing registry tests (`grep -rl "api-registry" apps/web/test`) must stay green

**Interfaces:**
- Consumes: `authenticateIntel` (`intelligence` scope, `apiKeyOnly: true` for claim/fail/POST; GET also `apiKeyOnly`), `claim`, `refuseTask`, `completeReading` (Task 30), `buildSent` (Task 32), `loadDataset`, `createObservatory`.
- Produces (HTTP):
  - `POST /api/pipeline/youtube/intelligence/task/claim` body `{channel_ids: uuid[1..10], task_types?: ObsType[] (max 5)}` → 200 task (+ `task_type`, `target_niche`, `target_video_id`, `target_fmt`) | 204. Writes the heartbeat on both.
  - `POST /api/pipeline/youtube/intelligence/task/:id/fail` body `{reason ≤ 500, retry?: boolean, refuse?: boolean}`; `refuse` and `retry` are mutually exclusive (400).
  - `GET /api/pipeline/youtube/competitors/readings?task_id=<uuid>` → `{task_id, task_type, target, sent: SentPack}`. 409 if the task is not `running` or is held by another key. Idempotent: the second read returns the same frozen `sent`.
  - `POST /api/pipeline/youtube/competitors/readings` body:
    ```json
    {"task_id":"uuid","model":"Gemma 12B","generated_at":"ISO","text":{"title":"…","lead":"…","items":["…"]},"analysis":{},"evidence":[{"id":"<video or change id from sent.ids>","note":"…"}]}
    ```
    → 200 `{reading_id}` | 400 (validation, number not in `sent.numbers`, evidence outside `sent.ids`) | 409 (not running / already completed).
  - The route's `maxDuration` is 60 (the same coupled budget note as the intelligence route).

- [ ] **Step 1: Failing route tests** (mock `authenticateIntel` and the services the way `test/analytics-intelligence-api.test.ts` does; read it first and reuse its mock style). Cases:
  - claim with `task_types: ['temas']` passes the types through;
  - claim with `task_types: ['nope']` → 400;
  - fail with `refuse:true` + `retry:true` → 400;
  - readings GET without `task_id` → 400;
  - GET for a running task returns `sent` and stores it; GET again returns the same object (the `buildSent` spy is called once);
  - POST with a number not in `sent.numbers` → 400 with `code` `VALIDATION_ERROR`;
  - POST valid → 200;
  - POST again → 409.
- [ ] **Step 2:** FAIL → implement the routes (thin adapters, as in the existing intelligence routes) → PASS.
- [ ] **Step 3: Registry + docs.**
  - `api-registry.ts` youtube domain: add
    - `{ method: 'GET', path: '/api/pipeline/youtube/competitors/readings', summary: 'Data sent to the forja for a running observatory task (frozen on first read) — intelligence', auth: 'intelligence' }`
    - `{ method: 'POST', path: '/api/pipeline/youtube/competitors/readings', summary: 'Submit a frozen forja reading for a running observatory task — intelligence', auth: 'intelligence' }`
  - Update the claim summary ("… by channel_ids and optional task_types (observatory) …") and the fail summary ("… fail, requeue or refuse …"); bump `endpoint_count` by 2.
  - In `cowork-docs-youtube.md`, document the 4 contracts above with request/response examples, the rule "one request = one type × one target", the quota and the refusal codes.
  - Run: `cd apps/web && npx vitest run test/api/pipeline-competitor-readings.test.ts $(grep -rl "api-registry\|endpoint_count" test) test/mcp/youtube-cowork-docs.test.ts` → PASS.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/pipeline/youtube/intelligence/task/claim/route.ts "apps/web/src/app/api/pipeline/youtube/intelligence/task/[id]/fail/route.ts" apps/web/src/app/api/pipeline/youtube/competitors/readings/route.ts apps/web/src/lib/pipeline/api-registry.ts apps/web/data/pipeline-docs/cowork-docs-youtube.md apps/web/test/api/pipeline-competitor-readings.test.ts
git commit -m "feat: API da forja para o observatório — claim por tipos, recusa e leituras congeladas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
The Cowork reference lives online (memory: feedback_reference_online). If `docs/cowork-pipeline-reference.md` is affected (it is not: no section JSON schema changed), re-run the seed script; otherwise nothing to seed.

### Task 34: The vigia sends stuck observatory requests back to the queue

**Files:**
- Modify: `apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts`
- Test: `apps/web/test/cron/youtube-intelligence-watchdog.test.ts` (extend)

Rules:
- `diagnostico` keeps today's behaviour (`running` > 30 min → `stale`).
- Observatory types: `running` > 30 min with `retry_count < 2` → `pending`, `retry_count + 1`, `released_at = now`, `started_at = null`. With `retry_count ≥ 2` → `failed`, `error_message = 'travou-3x'`, `failed_at = now`.
- `STALE_THRESHOLD_MINUTES` stays 30. The coupled budget is unchanged: 20 min claim < 25 min cron < 30 min vigia.

- [ ] **Step 1: Failing tests** (extend the existing file, reusing its mocks):
  - a diagnostico row still becomes `stale`;
  - an observatory row with retry 0 becomes `pending` with retry 1 and `released_at`;
  - one with retry 2 becomes `failed` 'travou-3x';
  - the response JSON reports `{released, requeued, failed}`.
- [ ] **Step 2:** FAIL → implement with two update statements filtered by `task_type` → PASS (`cd apps/web && npx vitest run test/cron/youtube-intelligence-watchdog.test.ts`).
- [ ] **Step 3:** Map the forja reason `travou-3x` in `analysis-progress.ts` `REASONS` ("travou três vezes: o vigia liberou e a máquina não terminou").
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/youtube-intelligence-watchdog/route.ts apps/web/src/lib/youtube/analysis-progress.ts apps/web/test/cron/youtube-intelligence-watchdog.test.ts
git commit -m "feat: o vigia devolve à fila os pedidos do observatório que travaram (até 3 tentativas)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 35: Forja in the UI — drawer, buttons and status on every screen, Insights reading hero, forja-state fidelity

**Mockups:** `moldura-forja.html` (FLOWS at `:742`: choose, confirm, queued, running, done, late, nomachine, retry, released, failed, refused, cota), and the forja states of `canais.html`, `mudancas.html`, `outliers.html`, `insights.html` and `historico-video.html`.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/forja-actions.ts` (`askForjaReading`, `cancelForjaReading`)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_chrome/{forja-status.tsx,forja-drawer.tsx,forja-view-model.ts}`
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_insights/reading-hero.tsx`, `_mudancas/reading-card.tsx`, `_historico/video-reading.tsx`, `_canais/drawer-forja.tsx`, `_outliers/forja-bar.tsx`
- Modify: each screen's view model (+ `forja` block) and the chrome view model (`forja` segment)
- Test: `apps/web/test/youtube/observatorio/forja-view-model.test.ts`, `forja-actions.test.ts`, `apps/web/e2e/tests/cms/observatorio/forja.spec.ts`

**Interfaces:**
- Consumes: `createSession(...)` (Task 31) over the DB requests, `askReading`/`cancelReading` (Task 30), `since`, `preview`, `timing`, `quotaFor`, frozen readings.
- Produces:
```ts
export interface ForjaView {
  ready: boolean                  // tables exist (always true after Task 29)
  capable: boolean                // heartbeat announces the type
  incapableText: 'A forja ainda não lê pedidos do observatório.' | null
  variant: 'solid' | 'outline' | 'none'
  button: { mode: 'free' | 'busy' | 'free-niche' | 'disabled'; label: string; short?: string; ariaLabel: string; disabledText?: string }
  status: null | { text: string; active: boolean; terminal: boolean; warn: boolean; lines: string[]; statusText: string }
  machine: { alive: boolean; text: string } // "forja consultou às HH:MM" | "forja sem máquina · 12:55"
  reading: null | { seal: string; title: string; lead: string; items: string[]; sentText: string; since: { shortText: string; text: string }; siteNotes: string[]; evidenceLinks: Array<{ label: string; href: string; n: number }> }
}
export function buildForjaView(obs: Observatory, o: { screen: 'canais' | 'mudancas' | 'outliers' | 'insights' | 'historico'; type: ObsType; niche: NicheScope; videoId?: string; fmt?: Fmt }): ForjaView
// forja-actions.ts ('use server')
export async function askForjaReading(type: ObsType, scope: NicheScope, videoId?: string, fmt?: Fmt): Promise<AskOutcome>
export async function cancelForjaReading(type: ObsType, niche: Niche, videoId?: string): Promise<{ ok: boolean }>
```
Types per screen (CONVENCOES F9): Canais/Mudanças `resumo-trocas`; Outliers/Insights (patterns) `padroes-titulo` (Shorts: `padroes-titulo-shorts`); Insights (themes) `temas`; Histórico `leitura-video` + video.
Button variant: solid in Insights, Histórico and the drawer; outlined elsewhere; with the drawer open, the screen's primary turns outlined.
With Todos:
- one request per free niche, in click order;
- the busy niche shows as an ACTIVE status line, never a terminal pill;
- the button stays enabled for the free niche ("Pedir leitura de Viagem à forja", short "Ler Viagem").
Seal: "forja · Gemma 12B · <tipo>, <janela> · DD/MM HH:MM (SP)" directly above the LITERAL `reading.text`. Site notes go in "Do site", outside the seal. "Desde então" comes from `since` (`shortText` collapsed, `text` in detail, `textNoAsk` while a request is active). Copying the reading gives one block per source with its seal and the data sent; a copy failure shows the text selectable. The drawer is a column at ≥ 1280 px and a modal below (focus trapped, Esc returns focus); dialogs live outside the content area. In Histórico, when another video of the same niche has an active `leitura-video` request, the button is disabled with `blockedBy.reason` and a link to that video's history (`link.historico(blockedBy.video)`, spec 2.6). Clicking the status in the header NEVER creates a request: it scrolls to the anchor `[data-forja-anchor]`. A new request is timestamped now ("enviado agora", never negative minutes). Toasts: "Pedido enviado à forja" → "Leitura publicada"; "Pedido cancelado".

- [ ] **Step 1: View-model tests**, on the oracle dataset with requests injected from `forja-scenarios.ts` for each state:
  - header `status.text` = the CONVENCOES line 218 string;
  - "sem máquina" `statusText` exact (singular/plural);
  - Todos + IA busy + Viagem free → `button.mode 'free-niche'`, label "Pedir leitura de Viagem à forja", short "Ler Viagem";
  - capabilities `[]` → `button.mode 'disabled'`, `disabledText` 'A forja ainda não lê pedidos do observatório.' (Review Focus 3);
  - quota used → disabled with `quota.text`;
  - the reading seal string format;
  - `reading.items` equal the frozen `text.items` literally;
  - "Desde então" first line has no final period;
  - evidence link N = `outliers({reading, …}).count`;
  - the status click never creates a request (no action prop called).
- [ ] **Step 2: Action tests**: `askForjaReading` requires `requireSiteScope` edit and passes `userId`; `cancelForjaReading` only cancels `pending` (a `running` task cannot be cancelled → `{ok:false}` with the engine text).
- [ ] **Step 3: Implement**: port the moldura drawer flows and each screen's forja card markup and CSS from the mockups. Wire `forjaReady` (Task 22's guard) to `ForjaView.ready`.
- [ ] **Step 4: Fidelity** `forja.spec.ts`, using `runFidelity` with `seed: { forjaState, forjaType }`:
  - moldura: each `FLOWS` id (choose/confirm need clicks on the drawer: open the drawer, pick type/niche);
  - Canais: drawer × 9 request states;
  - Mudanças: 9 states;
  - Outliers: 9 states;
  - Insights: `NONE` + 9 states + `EMPTY`;
  - Histórico: 9 states on the showcase video.
  - Both viewports and themes. The `textAllow` list must stay empty for status lines (they come from the same engine text).
- [ ] **Step 5: Side-by-side review** of the moldura drawer at 1280/1279 px (column vs modal).
- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/forja-actions.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_chrome" "apps/web/src/app/cms/(authed)/youtube/competitors/_insights" "apps/web/src/app/cms/(authed)/youtube/competitors/_mudancas" "apps/web/src/app/cms/(authed)/youtube/competitors/_historico" "apps/web/src/app/cms/(authed)/youtube/competitors/_canais" "apps/web/src/app/cms/(authed)/youtube/competitors/_outliers" apps/web/test/youtube/observatorio/forja-view-model.test.ts apps/web/test/youtube/observatorio/forja-actions.test.ts apps/web/e2e/tests/cms/observatorio/forja.spec.ts
git commit -m "feat: a forja no observatório — pedido por nicho e tipo, andamento honesto e leitura congelada com selo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 36: Forja worker — observatory readings (kit change + owner commands)

**Where:** `~/Workspace/forja/ferramentas` (a LOCAL git repo with no remote). Files: `docs/trilha/fila_intel.py` and `docs/trilha/teste_fila.py`, plus a new `docs/trilha/leituras_obs.py` (per-type prompt + validator, kept out of the 1788-line worker). **Agents never write to the forja.**

**Interfaces:**
- Consumes (HTTP, Task 33): claim with `task_types`, `GET/POST /api/pipeline/youtube/competitors/readings`, fail with `retry`/`refuse`.
- Produces (Python):
```python
# leituras_obs.py
TIPOS = ("padroes-titulo", "padroes-titulo-shorts", "temas", "resumo-trocas", "leitura-video")
def prompt(tipo: str, sent: dict) -> str                      # PT-BR instructions + the sent items as a table; asks for JSON {title, lead, items[]}
def validar(tipo: str, sent: dict, saida: dict) -> list[str]  # [] = ok; each number in lead/items must be in sent["numbers"]; evidence ids ⊆ sent["ids"]; no causal claims ("porque", "causou", "graças a") about thumbnails; max 8 items, 280 chars each
def rodar(cli, task: dict, llama, agora) -> str               # GET sent → llama → validar → POST reading | fail(retry=True) | fail(refuse=True, reason="dado-velho") ; returns the desfecho
```
In `fila_intel.py`:
- the claim body gets `"task_types": list(TIPOS)` only when `OBS_TIPOS=1` is set in `/opt/agente/fila_intel.env` (opt-in; without it the worker behaves exactly as today);
- a claimed task with `task_type != "diagnostico"` dispatches to `leituras_obs.rodar`;
- new `desfecho` values `"leitura"` and `"leitura_reprovada"` are appended to `DESFECHOS`, and the jsonl line gets `task_type`;
- `ORCAMENTO_S` (20 min) covers the whole observatory run: snapshot GET, llama, POST.

- [ ] **Step 1: Failing groups in `teste_fila.py`** (insert before the "isolamento: sentinela final" group, using the harness vocabulary `@grupo`, `rodar`, `exige`):
  - "observatorio: sem OBS_TIPOS o claim não leva task_types" (the claim body is unchanged);
  - "observatorio: com OBS_TIPOS o claim leva os 5 tipos";
  - "observatorio: leitura publicada" (fake site returns a `temas` task + `sent`; fake llama returns valid JSON → one POST to `/competitors/readings`, desfecho `leitura`);
  - "observatorio: número inventado reprova" (llama cites "12,4×" not in `sent.numbers` → fail with `retry: true`, desfecho `leitura_reprovada`);
  - "observatorio: orçamento" (a slow fake llama crosses `ORCAMENTO_S` → fail with `retry`, nothing POSTed after the budget).
- [ ] **Step 2: Run on the Mac** (the redaction/calc siblings run locally; the full gate runs only on the forja):

Run: `cd ~/Workspace/forja/ferramentas/docs/trilha && python3 -m py_compile fila_intel.py leituras_obs.py teste_fila.py && python3 -B teste_fila_redacao.py`
Expected: compiles; the redaction suite is still green. (`teste_fila.py` imports httpx and runs on the forja, Step 5.)

- [ ] **Step 3: Implement** `leituras_obs.py` and the dispatch, following the kit README "Armadilhas que já custaram caro". Then `python3 -m py_compile …` → OK.

- [ ] **Step 4: Commit in the kit (explicit paths)**

```bash
git -C ~/Workspace/forja/ferramentas add docs/trilha/fila_intel.py docs/trilha/leituras_obs.py docs/trilha/teste_fila.py
git -C ~/Workspace/forja/ferramentas commit -m "feat: fila lê pedidos do observatório (tipos opt-in por OBS_TIPOS), com validador de números" -- docs/trilha/fila_intel.py docs/trilha/leituras_obs.py docs/trilha/teste_fila.py
```

- [ ] **Step 5: Prepare the owner's commands** (append to `~/Workspace/forja/LEIAME-COMANDOS.md`, one command per block, per memory feedback_leiame_comandos)

Read the installed state first (allowed, read-only): `ssh forja 'sha256sum /opt/agente/docs/trilha/fila_intel.py; grep -c OBS_TIPOS /opt/agente/fila_intel.env || true; crontab -l | grep fila_intel'`. Then write, each in its own block:

```bash
scp ~/Workspace/forja/ferramentas/docs/trilha/leituras_obs.py forja:/tmp/leituras_obs.py
```
```bash
scp ~/Workspace/forja/ferramentas/docs/trilha/fila_intel.py forja:/tmp/fila_intel.py
```
```bash
scp ~/Workspace/forja/ferramentas/docs/trilha/teste_fila.py forja:/tmp/teste_fila.py
```
```bash
ssh forja 'sudo install -o thiago -g thiago -m 0644 /tmp/leituras_obs.py /tmp/fila_intel.py /tmp/teste_fila.py /opt/agente/docs/trilha/'
```
```bash
ssh forja 'cd /opt/agente/docs/trilha && flock -w 1800 /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py'
```
```bash
ssh forja 'echo OBS_TIPOS=1 >> /opt/agente/fila_intel.env'
```
```bash
ssh forja 'tail -n 3 /opt/agente/log/fila_intel.jsonl'
```
Add one line of explanation above each block: what it does and what the expected output is. Examples: the gate prints `PASS` for every group; after the next tick (≤ 10 min) the jsonl shows `"desfecho": "vazia"` with no error, and `forja_heartbeat.capabilities` lists the 5 types.

- [ ] **Step 6: Verify from the site (read-only)** after the owner runs them:
  - `forja_heartbeat` row updated within 10 min, with the 5 capabilities;
  - in `/cms/youtube/competitors/insights` the forja button turns enabled;
  - ask one `temas` reading for IA and watch it go "na fila" → "trabalhando" → "publicado";
  - the reading shows the seal and literal text;
  - the jsonl line shows `desfecho: leitura` and its duration;
  - record the duration in the runbook (`docs/ops/forja-fila-inteligencia-runbook.md` §1 "Onde entra o tempo") and confirm it is far below 20 min. If it is above 10 min, lower `RULES.forja.maxVideos` and say so.
- [ ] **Step 7: Update the runbook** (`docs/ops/forja-fila-inteligencia-runbook.md`): a new section "Leituras do observatório" (the `OBS_TIPOS` switch, how to turn it off by removing the line from `fila_intel.env`, the new `desfecho` values, the reading endpoints). Commit:

```bash
git add docs/ops/forja-fila-inteligencia-runbook.md
git commit -m "docs: runbook da forja — leituras do observatório, chave OBS_TIPOS e novos desfechos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

**P4 ship gate:**
1. Full `npx vitest run`, typecheck, and all `e2e/tests/cms/observatorio/*.spec.ts`.
2. The authenticated `/cms` runbook sweep, and the owner's yes for `db:push:prod` of `observatorio_forja`.
3. Push. The site must ship BEFORE the owner turns on `OBS_TIPOS`: the old worker keeps working against the new claim, and the UI says the forja does not read observatory requests yet.

---

## Next (out of scope here — spec §8, owner prioritises after delivery)

- **Security S1–S6** (audit of 02/10):
  - Next RCE via `npm audit`;
  - views exposed to `anon`;
  - `authenticateRead` without `requirePermission` in `apps/web/src/lib/pipeline/helpers.ts:32-38`;
  - and the rest of the list in the audit notes.
- **CI** items from the same audit.
- **Forja F1–F7** (the forja audit items; the kit README "Pendência aberta: series.json" and runbook §2 drift).
- Product backlog noted by the spec: "Criar ideia no pipeline" from an insight (no endpoint yet); per-channel forja reading (PEDIDOS-API Canais 6, deferred by the coordinator).
