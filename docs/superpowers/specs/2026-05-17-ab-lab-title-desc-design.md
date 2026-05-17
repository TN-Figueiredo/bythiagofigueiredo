# A/B Lab C+ — Title, Description & Combo Testing

Sprint 5h Social Hub. Extends the existing A/B Lab (thumbnail-only) to support title testing, description testing, and combo packages (thumbnail + title + description tested atomically as variant slots).

**Extends:** `2026-05-17-ab-lab-design.md` (thumbnail A/B testing — must be implemented first)

---

## 1. Architecture: Approach C+ (Combo Slots)

Each variant becomes a **slot** containing optional elements:

```
Variant Slot = {
  blob_url: string | null,       // thumbnail (existing)
  title_text: string | null,     // NEW
  description_text: string | null // NEW
}
```

Test types discriminated by a `type` column on `ab_tests`:

| Type | What rotates | What stays fixed |
|------|-------------|------------------|
| `thumbnail` | `blob_url` | title, description |
| `title` | `title_text` | thumbnail, description |
| `description` | `description_text` | thumbnail, title |
| `combo` | all three | — |

The ABBA rotation engine and Bayesian/Z-test statistics remain element-agnostic (they operate on impressions/clicks regardless of what was changed).

---

## 2. Database Changes

### 2.1 Alter `ab_tests`

```sql
ALTER TABLE public.ab_tests
  ADD COLUMN test_type TEXT NOT NULL DEFAULT 'thumbnail'
    CHECK (test_type IN ('thumbnail', 'title', 'description', 'combo')),
  ADD COLUMN original_title TEXT,
  ADD COLUMN original_description TEXT;
```

- `original_title`: captured from YouTube on test creation (via `videos.list`)
- `original_description`: captured from YouTube on test creation

### 2.2 Alter `ab_test_variants`

```sql
ALTER TABLE public.ab_test_variants
  ADD COLUMN title_text TEXT,
  ADD COLUMN description_text TEXT;
```

For the Original variant (variant A), `title_text` and `description_text` are NULL — the system uses `ab_tests.original_title` / `ab_tests.original_description` as the baseline.

### 2.3 Alter `ab_test_cycles`

```sql
ALTER TABLE public.ab_test_cycles
  ADD COLUMN applied_metadata JSONB;
```

`applied_metadata` records what was actually set on YouTube for this cycle:
```json
{
  "thumbnail_set": true,
  "title_set": "MBK Center Bangkok: O Shopping Mais INSANO...",
  "description_set": "Você já ouviu falar do MBK Center?...",
  "links_resolved": { "newsletter": "go/news-b", "curso": "go/curso-b" }
}
```

### 2.4 New table: `ab_test_tracked_links`

```sql
CREATE TABLE public.ab_test_tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ab_test_id, variant_id, template_name)
);
```

Maps `{{link:newsletter}}` in variant B's description → a specific tracked short code (e.g., `go/news-b`).

### 2.5 Metadata for Cowork API

```sql
ALTER TABLE public.ab_test_variants
  ADD COLUMN metadata JSONB DEFAULT '{}';
```

Schema for `metadata`:
```json
{
  "thumbnail_tags": ["bangkok", "shopping", "colorful"],
  "title_pattern": "Location: Superlative + Emoji",
  "emotional_triggers": ["curiosity", "surprise", "fomo"],
  "visual_description": "Crowded stalls, golden jewelry, faces"
}
```

---

## 3. Template Engine: `{{link:name}}`

### Syntax

In description fields, users write `{{link:name}}` placeholders. On test creation, the system:

1. Parses all `{{link:...}}` tokens from each variant's `description_text`
2. For each unique `name` × variant pair, creates a tracked link via Links Engine
3. Short code convention: `{name}-{variant_letter}` (e.g., `news-b`, `curso-b`)
4. Stores mapping in `ab_test_tracked_links`
5. On rotation, resolves templates to full URLs before calling `videos.update`

### Resolution

```
Input:  "📩 Newsletter: {{link:newsletter}}\n🎓 Curso: {{link:curso}}"
Output: "📩 Newsletter: go.bythiagofigueiredo.com/news-b\n🎓 Curso: go.bythiagofigueiredo.com/curso-b"
```

### Link click attribution

Existing Links Engine tracks clicks per short code with daily-rotating visitor ID. Since each variant gets unique codes, click data is automatically segmented by variant. The `ab_test_tracked_links` table provides the join path.

---

## 4. YouTube Data API Integration

### 4.1 New function: `updateVideoMetadata`

```typescript
export async function updateVideoMetadata(
  videoId: string,
  title: string | null,
  description: string | null,
  accessToken: string
): Promise<void>
```

Uses YouTube Data API v3 `videos.update` with `part=snippet`:
- GET current snippet (to preserve categoryId, tags, etc.)
- PATCH only title and/or description
- Single API call sets both atomically

### 4.2 Rotation dispatch by type

The `ab-rotate` cron currently only calls `setThumbnail`. After this extension:

```
switch (test.test_type) {
  case 'thumbnail':
    → setThumbnail(variant.blob_url)
  case 'title':
    → updateVideoMetadata(title=variant.title_text)
  case 'description':
    → updateVideoMetadata(description=resolveTemplates(variant.description_text))
  case 'combo':
    → setThumbnail(variant.blob_url)  // if blob_url present
    → updateVideoMetadata(title, description)  // atomic
}
```

### 4.3 Capturing originals on test creation

When creating a test:
1. Call `videos.list?part=snippet&id={videoId}`
2. Store `snippet.title` → `ab_tests.original_title`
3. Store `snippet.description` → `ab_tests.original_description`
4. Store current thumbnail URL → `ab_tests.original_thumbnail_url` (existing)

---

## 5. Wizard Flow (5 Steps)

### Step 1: Type Selection
4 cards: Thumbnail, Title (NEW), Description (NEW), Combo (NEW/COMBO badge).

### Step 2: Video Selection
Channel filter + search. Shows badges for videos already being tested or previously tested.

### Step 3: Variant Editor
Adapts based on type:
- **Thumbnail**: blob upload zone only (existing behavior)
- **Title**: text input with character counter (100 max)
- **Description**: textarea with `{{link:name}}` template support + resolved link preview
- **Combo**: all three fields per variant slot + thumbnail upload

Variant A is always locked (auto-captured from YouTube). Up to 4 variants total.

**Metadata section** (collapsible): tags, title pattern, emotional triggers, visual description — exposed to Cowork via Pipeline API.

### Step 4: Configuration
- Duration: 7/14/21/28 days
- Confidence threshold: 80-99% slider
- Auto-apply winner: toggle
- Burn-in period: toggle (2 days)
- Rotation pattern: ABBA (default) / Round Robin / Random (extends existing `'abba' | 'round_robin'` with `'random'`)
- Stability gate: 1-10 consecutive evaluations

### Step 5: Review & Launch
Side-by-side variant cards with:
- Thumbnail preview (gradient placeholder or actual image)
- Title + description text
- Resolved tracked links with "rastreado" badge
- YouTube Feed preview (shows how variant B looks in feed)
- Config summary table
- "Salvar Rascunho" + "Lançar Teste" buttons

---

## 6. Detail Pages

### Active Test Detail
- **Insight banner**: AI-generated summary ("Variante B gera +50.6% mais signups...")
- **Confidence chart**: SVG polyline showing Bayesian confidence over time, with 95% threshold dashed line and projected trend
- **Mode toggle**: "Dados Confirmados" (48-72h lag) vs "Estimativa Live" (current cycle extrapolation)
- **4 KPI cards**: CTR Lift, Link Click Lift, Impressões, Impacto Mensal
- **Variant comparison cards** (5 stats each): Impressões, Clicks, Video CTR, Link Clicks, Link CTR
- **ABBA Timeline**: visual day-by-day showing which variant was active, today marker, future projections
- **Funnel Attribution** (Links Engine integration): full path Impressão → View → Link Click → Conversão, per-variant comparison, per-link breakdown table
- **Cowork API card**: endpoint reference for Pipeline integration

### Completed Test Detail
- **Winner banner** with lift % and confidence
- **Final confidence chart** (complete curve)
- **Final metrics** (4 KPIs)
- **Variant cards** with "Vencedor" / "Perdeu" status
- **Complete timeline**
- **Actions**: Arquivar, Duplicar, Export

---

## 7. Dashboard

### Empty State
Illustration + "Nenhum teste ainda" + CTA.

### Active State
- **4 KPIs**: Testes Ativos, Confiança Média, Taxa de Vitória, CTR Lift Médio
- **Active test cards** (grid): status badge (Active/Paused), test name + type badge, confidence bar, thumbnail previews, rotation info
- **Completed test rows** (list): name, winner, lift %, confidence %

---

## 8. Pipeline API for Cowork

No AI inference layer. Cowork accesses data via existing Pipeline API with permanent pipeline key.

### New endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/pipeline/youtube/ab-tests` | GET | All tests (active + completed) with summary stats |
| `/api/pipeline/youtube/ab-tests/{id}` | GET | Full test detail: config, variants, cycles, metrics, funnel |
| `/api/pipeline/youtube/ab-tests/{id}/variants` | GET | Variant metadata, stats per cycle, link attribution |
| `/api/pipeline/youtube/ab-tests/{id}/funnel` | GET | Full funnel data per variant (impressions → views → link clicks → conversions) |
| `/api/pipeline/youtube/ab-performance` | GET | Cross-test analysis: patterns, best-performing metadata tags, title patterns |

All endpoints require `x-pipeline-key` header. No rate limiting for authenticated pipeline requests.

### Data shape for Cowork analysis

```json
{
  "test": { "id", "name", "type", "status", "config", "started_at" },
  "variants": [{
    "id", "label", "is_original",
    "title_text", "description_text", "blob_url",
    "metadata": { "thumbnail_tags", "title_pattern", "emotional_triggers", "visual_description" },
    "stats": { "impressions", "clicks", "ctr", "link_clicks", "link_ctr" },
    "cycles": [{ "day", "impressions", "ctr" }]
  }],
  "funnel": {
    "per_variant": [{ "variant_id", "impressions", "views", "link_clicks", "conversions" }],
    "per_link": [{ "template_name", "variant_a_clicks", "variant_b_clicks", "lift" }]
  },
  "confidence": { "current", "history": [{ "day", "value" }], "significant": false }
}
```

---

## 9. Competitive Differentiators

### vs VidIQ / TubeBuddy / ViewStats

| Feature | VidIQ | TubeBuddy | ViewStats | Us |
|---------|-------|-----------|-----------|-----|
| Thumbnail A/B | ✓ (paid) | ✓ (paid) | ✓ | ✓ |
| Title A/B | ✗ | ✗ | ✗ | ✓ |
| Description A/B | ✗ | ✗ | ✗ | ✓ |
| Combo testing | ✗ | ✗ | ✗ | ✓ |
| Link funnel attribution | ✗ | ✗ | ✗ | ✓ |
| AI-powered analysis (Cowork) | Basic | Basic | ✗ | Full pipeline access |
| ABBA counterbalancing | ✗ | ✗ | ✗ | ✓ |
| Per-variant tracked links | ✗ | ✗ | ✗ | ✓ |

**Three unique advantages:**
1. **Combo testing** — test title+thumb+desc as atomic packages
2. **Funnel attribution via Links Engine** — track the full path from impression to conversion
3. **Cowork AI analysis** — full test data exposed via Pipeline API for AI-driven optimization proposals

---

## 10. Technical Constraints

- **YouTube API quota**: `videos.update` costs 50 units. Daily quota is 10,000 units. With 3 test slots rotating daily, that's 150 units/day for rotations — negligible.
- **Title changes are instant**: YouTube endorses title testing (launched native Title A/B in 2025). Zero SEO penalty confirmed by research.
- **Description changes**: atomic with title via single `videos.update` call.
- **Data delay**: YouTube Analytics API has 48-72h lag for confirmed data. "Estimativa Live" mode uses current-cycle extrapolation.
- **Links Engine dependency**: description tests require Links Engine to be active. Title-only and thumbnail-only tests have no dependency.
- **Max 3 concurrent tests** (configurable): prevents quota issues and ensures each test gets enough impressions.

---

## 11. Files to Create/Modify

### New files
- `apps/web/src/lib/youtube/ab-templates.ts` — `{{link:name}}` parser + resolver
- `apps/web/src/lib/youtube/ab-metadata.ts` — YouTube `videos.update` for title/desc
- `apps/web/src/app/api/pipeline/youtube/ab-tests/route.ts` — Pipeline endpoints
- `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/route.ts`
- `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/funnel/route.ts`
- `apps/web/src/app/api/pipeline/youtube/ab-performance/route.ts`
- `supabase/migrations/TIMESTAMP_ab_lab_title_desc.sql`

### Modified files
- `apps/web/src/lib/youtube/ab-types.ts` — add `test_type`, `title_text`, `description_text`, `metadata` to interfaces
- `apps/web/src/lib/youtube/ab-youtube.ts` — add `updateVideoMetadata`, `captureOriginalMetadata`
- `apps/web/src/app/api/cron/ab-rotate/route.ts` — dispatch by `test_type`
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` — handle text variants, template resolution, link creation
- `apps/web/src/app/cms/(authed)/youtube/ab-lab/` — wizard components (type step, variant editor, review)

### Unchanged (already element-agnostic)
- `apps/web/src/lib/youtube/ab-rotation.ts` — pure ABBA math
- `apps/web/src/lib/youtube/ab-statistics.ts` — Bayesian + Z-test on impressions/clicks
- `apps/web/src/app/api/cron/ab-evaluate/route.ts` — CTR-based evaluation

---

## 12. Visual Reference

Full interactive mockup (11 screens) at:
`.superpowers/brainstorm/81247-1779037688/content/index.html`

Covers: Dashboard (empty/active), Wizard (Type/Video/Variants-Combo/Title-only/Desc-only/Config/Review), Detail (Active/Completed).
