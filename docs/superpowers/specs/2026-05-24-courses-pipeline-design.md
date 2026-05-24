# Courses Pipeline: Design Spec

**Date:** 2026-05-24
**Status:** Approved
**Scope:** Course planning, production tracking, PLF launch integration
**NOT in scope:** Course delivery platform, student-facing UI, payment integration

## Problem

The Courses section exists in the pipeline kanban (IDEIA → OUTLINE → MÓDULOS → REVISÃO → PUBLICADO) but:
1. "New Item" button doesn't work (`?action=create` query param ignored, no create modal)
2. Sections use generic renderers — no course-specific editing experience
3. No support for Jeff Walker's Product Launch Formula (PLF) workflow
4. No production tracking per-lesson
5. No cross-referencing between free content (YouTube, blog) and paid course lessons

## Architecture: 3 Layers, Zero New Tables

### Layer 1: Planning (Pipeline Item, format='course')

The course IS a pipeline item with enriched sections:

| Section | Type | Renderer | Purpose |
|---------|------|----------|---------|
| `ideia_shared` | shared | IdeaRenderer (exists) | Premise, audience, VVS |
| `curriculum_shared` | shared | **CurriculumRenderer (new)** | Modules, lessons, prerequisites |
| `lessons_pt\|en` | per-lang | **LessonsRenderer (new)** | Per-lesson scripts, talking points |
| `material_pt\|en` | per-lang | GenericRenderer (enriched) | Resource inventory |
| `launch_shared` | shared | **LaunchRenderer (new)** | PLF strategy, PLC timeline |
| `publish_pt\|en` | per-lang | PublishRenderer (enriched) | Platform, sales copy |

### Layer 2: Structure (Playlist, category='course')

When ready for delivery, the course "graduates" to a playlist:
- Playlist items = assembled lessons referencing pipeline items
- Playlist edges = sequence + prerequisite relationships
- Graph editor provides visual DAG editing (already exists)
- **Graduation is optional and partial** — curriculum_shared is always the source of truth

### Layer 3: Product (format_metadata)

Enriched CourseMetadataSchema for product/funnel tracking:
- Product type, tier, pricing model
- Funnel stage (TOFU/MOFU/BOFU)
- Upsell/downsell references
- Topic clusters for cross-format content grouping

## Section Schemas

### curriculum_shared

```typescript
{
  curriculum_mode: 'fixed' | 'progressive',  // progressive = seed launch
  target_audience: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  estimated_hours: number,
  learning_outcomes: string[],
  modules: [{
    id: string,                    // nanoid
    title: string,
    description: string,
    sort_order: number,
    is_preview: boolean,           // free preview module
    lessons: [{
      id: string,                  // nanoid
      title: string,
      type: 'video' | 'text' | 'quiz' | 'exercise' | 'pdf' | 'live' | 'mixed',
      sort_order: number,
      is_preview: boolean,         // free preview lesson
      estimated_minutes: number,
      production_status: 'outline' | 'scripted' | 'recorded' | 'edited' | 'ready',
      pipeline_ref: string | null, // UUID of linked pipeline item (video, blog)
      resources: [{
        label: string,
        type: 'pdf' | 'repo' | 'link' | 'template' | 'tool',
        url: string | null,
        media_id: string | null    // link to Media System
      }]
    }]
  }]
}
```

**Progressive mode (Seed Launch):** When `curriculum_mode='progressive'`, stage advancement
validations are relaxed. Modules/lessons can be added at any stage. The course can reach
PUBLICADO with a single module. After the seed launch completes, switch to `'fixed'`.

### lessons_pt | lessons_en

```typescript
{
  // Keyed by lesson.id from curriculum
  [lesson_id: string]: {
    talking_points: string[],
    script: string | JSONContent,       // Tiptap rich text or markdown
    production_notes: string,
    recording_date: string | null,      // ISO date
    actual_duration_seconds: number | null,
    equipment_notes: string | null
  }
}
```

### material_pt | material_en

```typescript
{
  resources: [{
    id: string,                         // nanoid
    title: string,
    type: 'pdf' | 'slide_deck' | 'repo' | 'template' | 'tool' | 'dataset' | 'notebook' | 'link',
    description: string,
    url: string | null,
    media_id: string | null,            // link to Media System
    lesson_refs: string[],              // which lessons use this
    status: 'planned' | 'in_progress' | 'ready'
  }],
  tools_required: string[],
  notes: string                         // markdown
}
```

### launch_shared

```typescript
{
  launch_type: 'seed' | 'internal' | 'jv' | 'evergreen',
  plc_sequence: [{
    number: 1 | 2 | 3,
    title: string,
    theme: 'opportunity' | 'teaching' | 'ownership',
    content_format: 'video' | 'blog' | 'email' | 'live',
    pipeline_ref: string | null,        // link to PLC content pipeline item
    campaign_ref: string | null,        // link to email campaign
    planned_date: string | null,
    status: 'planned' | 'drafted' | 'produced' | 'published',
    key_message: string,
    mental_triggers: string[]
  }],
  cart_open_date: string | null,
  cart_close_date: string | null,
  early_bird_deadline: string | null,
  bonuses: [{
    title: string,
    description: string,
    deadline: string | null,
    type: 'content' | 'access' | 'tool' | 'community' | 'coaching'
  }],
  email_campaign_id: string | null,
  mental_triggers: {
    authority: string | null,
    social_proof: string | null,
    reciprocity: string | null,
    scarcity: string | null,
    community: string | null,
    anticipation: string | null
  },
  notes: string                         // markdown
}
```

### publish_pt | publish_en

```typescript
{
  platform: 'hotmart' | 'udemy' | 'self-hosted' | 'youtube' | 'other',
  platform_url: string | null,
  sales_page_url: string | null,
  headline: string,
  subheadline: string,
  bullet_points: string[],
  testimonials: [{
    name: string,
    text: string,
    result: string
  }],
  faq: [{
    question: string,
    answer: string
  }],
  cta_text: string,
  guarantee: string | null,
  // Inherited from existing PublishRenderer:
  title: { chosen: string, alternatives: string[] },
  description: string,
  tags: string[]
}
```

## CourseMetadataSchema (Enriched)

```typescript
CourseMetadataSchema = z.object({
  // Structure
  module_count: z.number().optional(),
  lesson_count: z.number().optional(),
  estimated_hours: z.number().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  // Platform
  platform: z.enum(['self-hosted', 'hotmart', 'youtube', 'udemy', 'other']).optional(),
  // Product
  product_type: z.enum(['mini_course', 'course', 'masterclass', 'workshop']).optional(),
  tier: z.enum(['free', 'lead_magnet', 'tripwire', 'core', 'premium']).optional(),
  pricing_model: z.enum(['free', 'one_time', 'subscription', 'cohort', 'pwyw']).optional(),
  price_cents: z.number().optional(),
  currency: z.string().optional(),
  compare_at_price_cents: z.number().optional(),
  // Funnel
  funnel_stage: z.enum(['tofu', 'mofu', 'bofu']).optional(),
  topic_clusters: z.array(z.string()).optional(),
  // Relations
  upsell_ref: z.string().uuid().optional(),
  downsell_ref: z.string().uuid().optional(),
  prerequisite_courses: z.array(z.string().uuid()).optional(),
  // Launch
  launch_type: z.enum(['seed', 'internal', 'jv', 'evergreen']).optional(),
  // Graduation
  playlist_id: z.string().uuid().optional(),
}).strict()
```

## Workflow Stages

| Stage | Sections Active | Entry Criteria | Description |
|-------|----------------|----------------|-------------|
| IDEIA | ideia | — | Concept, audience, value prop |
| OUTLINE | curriculum | Idea validated | Module/lesson structure, prerequisites |
| MÓDULOS | lessons, material | Curriculum defined (progressive: relaxed) | Per-lesson scripts, recordings, materials |
| REVISÃO | launch, publish | All lessons ≥ 'edited' (progressive: relaxed) | PLF strategy, sales copy, platform config |
| PUBLICADO | all | Launch executed | Live, graduation to playlist available |

## Renderers

### CurriculumRenderer

Pattern: ScriptRenderer (beats accordion + dnd-kit reorder).

- **Header:** Course-level fields (target_audience, difficulty, estimated_hours, curriculum_mode toggle)
- **Learning outcomes:** Editable list with add/remove
- **Modules:** Accordion with drag-and-drop reorder
  - Each module: title, description, is_preview toggle, progress bar
  - Lessons within module: draggable list
    - Each lesson: title, type selector, production_status badge, estimated_minutes, is_preview, pipeline_ref link
    - "Add lesson" button at bottom
  - "Add module" button at bottom
- **Progress rollup:** Per-module and total progress bars computed from lesson production_status

### LessonsRenderer

Pattern: DraftRenderer (structured fields + Tiptap) with sidebar navigation.

- **Sidebar:** Lesson list grouped by module, with status indicators (checkmark/circle/half-circle)
  - Click to select lesson
  - Progress summary at bottom
- **Main panel:** Selected lesson editor
  - Header: title, type, estimated_minutes, production_status dropdown
  - Talking points: editable bullet list
  - Script: Tiptap PipelineEditor (compact preset)
  - Production metadata: recording_date, equipment_notes, production_notes
  - Actual duration (post-recording)

### LaunchRenderer

Pattern: PublishRenderer (timeline + config fields).

- **Launch type selector:** Tabs (Seed, Internal, JV, Evergreen)
- **PLC sequence:** 3 cards in a row, each with:
  - Title, theme badge, content_format, status badge
  - Key message (editable)
  - Mental triggers tags
  - Planned date
  - Pipeline ref link
- **Cart section:** Open/close/early-bird date pickers, campaign link
- **Mental triggers checklist:** 6 items with status indicators and text fields
- **Bonuses:** Editable list with add/remove
- **Notes:** Markdown textarea

### PublishRenderer (enriched for courses)

Existing PublishRenderer receives `format` prop. When `format='course'`, renders additional fields:
- Headline, subheadline, bullet_points (sales copy)
- Testimonials list (add/remove)
- FAQ accordion (add/remove)
- CTA text, guarantee
- Platform selector, URLs

### Kanban Card Enrichment

When format='course', the pipeline board card shows:
- Title + language/priority (existing)
- Module count + lesson count
- Tier badge + price (e.g., "core R$297")
- Production progress bar with percentage
- Status breakdown badges (N ready, N recorded, N scripted, N outline)
- Launch indicator (launch_type + PLC progress)

## "New Item" Button Fix

**Root cause:** `[format]/page.tsx` doesn't accept `searchParams`. No create modal exists.
`createPipelineItem()` server action is implemented but orphaned.

**Fix:**
1. Add `searchParams` to FormatBoardPage function signature
2. Create `CreateItemModal` component (title, language, priority fields)
3. Render modal when `?action=create` detected
4. Wire form submission to `createPipelineItem()` server action
5. This fix benefits ALL formats, not just courses

## Graduation: Course → Playlist

**Trigger:** Manual button "Graduar para Playlist" in course detail view (REVISÃO or PUBLICADO stage).

**Rules:**
- Graduation is optional — curriculum_shared is always the source of truth
- Graduation can be partial — only modules with all lessons ≥ 'ready'
- Re-graduation updates existing playlist (idempotent)

**Steps:**
1. Read curriculum_shared from pipeline item
2. Create/update playlist with category='course', name from course title
3. For each eligible module:
   - For each lesson: create playlist_item
     - If lesson.pipeline_ref → `pipeline_id = pipeline_ref`
     - If no pipeline_ref → `pipeline_id = course_pipeline_id`
   - Create sequence edges between consecutive lessons
4. Create prerequisite edges between modules (if defined)
5. Store playlist_id in format_metadata
6. Create history entry: event_type='graduated', to_value='course:{playlist_id}'

**API:** POST `/api/pipeline/items/{id}/graduate` with `{ target: 'course' }`

## Cross-Referencing

### Free content → Course
- Lesson.pipeline_ref links to video/blog pipeline item
- The video lives on YouTube (free, TOFU), the course lesson adds depth (paid, BOFU)
- topic_clusters tag groups related content across formats

### Course → Free content
- Launch section PLC items link to pipeline items (videos/posts published as free content)
- Campaign linked in launch handles email sequence

### Topic Clusters
- `format_metadata.topic_clusters: string[]` — free-form tags
- Query: `format_metadata->'topic_clusters' ? 'cluster-name'`
- Autocomplete from existing clusters
- No new table, no migration

## Product Ladder

| Tier | Product Type | Price Range | Use Case |
|------|-------------|-------------|----------|
| free | — | $0 | YouTube, blog (TOFU) |
| lead_magnet | mini_course | $0 (gated) | 3-5 lesson mini-course |
| tripwire | workshop | R$27-47 | Focused workshop, downsell |
| core | course | R$97-497 | Full course, primary revenue |
| premium | masterclass | R$997+ | Course + coaching + community |

Relationships: `upsell_ref` and `downsell_ref` in format_metadata link courses.

## Cowork AI Integration

Prompts added to `apps/web/data/pipeline-docs/cowork-docs-course.md`:

| Section | Input | Output |
|---------|-------|--------|
| curriculum | ideia (premise, audience) | modules[], lessons[], outcomes[] |
| lessons | curriculum lesson + ideia | talking_points[], script, production_notes |
| launch | ideia + curriculum + metadata | plc_sequence[], bonuses[], mental_triggers |
| publish | ideia + curriculum + testimonials | headline, bullets[], faq[], cta_text |

## Edge Cases

1. **Mini-course (lead magnet):** 1 default module, 3-5 lessons, tier='lead_magnet', no launch section needed
2. **Bilingual course:** curriculum_shared same structure, lessons_pt/en different scripts, publish_pt/en different sales copy
3. **Course-within-course:** prerequisite_courses[] in metadata + playlist edges with edge_type='prerequisite'
4. **Drip content:** Partial graduation — graduate module 1 in week 1, module 2 in week 2
5. **Lesson = YouTube video:** lesson.pipeline_ref → video pipeline item. Video is free TOFU, lesson adds exercises/PDF (paid BOFU)
6. **Launch cancellation:** Course returns from REVISÃO to MÓDULOS. Launch section preserved as draft. Cart dates reset.

## Implementation Phases

| Phase | Scope | Effort | Deliverable |
|-------|-------|--------|-------------|
| 0 | Fix "New Item" button (all formats) | ~2h | CreateItemModal + searchParams |
| 1 | MVP: Curriculum Builder | ~12h | CurriculumRenderer + schema + card enrichment |
| 2 | Scripts & Material | ~10h | LessonsRenderer + material enrichment |
| 3 | Launch & Product | ~8h | LaunchRenderer + metadata + publish enrichment |
| 4 | Graduation & Graph | ~6h | Course→Playlist graduation + Cowork docs |

**Total: ~38h across 5 independent phases.**

## Database Impact

**Zero new tables. Zero migrations.** Everything uses:
- `content_pipeline.sections` (JSONB) — new section schemas
- `content_pipeline.format_metadata` (JSONB) — enriched CourseMetadataSchema
- `playlists` + `playlist_items` + `playlist_edges` — graduation target

**TypeScript-only changes:**
- New: CurriculumRenderer, LessonsRenderer, LaunchRenderer, CreateItemModal
- Modified: CourseMetadataSchema, sections.ts, section-content.tsx, pipeline-board.tsx
- Modified: PublishRenderer (conditional course fields), graduate route (course target)
