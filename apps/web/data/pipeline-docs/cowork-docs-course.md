# Cowork Docs: Course Domain

## Sections

### curriculum_shared
**Input context:** ideia_shared (premise, body, target audience)
**Output schema:** CurriculumContentSchema (see course-schemas.ts)

When generating curriculum:
- Create 3-5 modules with 3-5 lessons each
- Set estimated_minutes per lesson (10-30 min for video, 5-10 for text/quiz)
- Set difficulty based on ideia content
- Generate 3-5 learning outcomes
- All lessons start with production_status: 'outline'
- Mark module 1 as is_preview: true
- Mark lesson 1.1 as is_preview: true

### lessons_pt | lessons_en
**Input context:** curriculum_shared (module/lesson structure) + ideia_shared
**Output schema:** Record<lesson_id, LessonScript>

When generating lesson scripts:
- Generate talking_points (5-8 bullet points per lesson)
- Generate script as markdown with headers per topic
- Include production_notes with recording suggestions
- Reference the lesson title and module context
- Keep estimated speaking time close to estimated_minutes

### launch_shared
**Input context:** ideia_shared + curriculum_shared + format_metadata (pricing, tier)
**Output schema:** LaunchContentSchema (see launch-schemas.ts)

When generating launch plan:
- Set launch_type based on audience size (no audience → seed, existing list → internal)
- PLC1 theme: opportunity — hook with the big promise
- PLC2 theme: teaching — deliver real value, show framework
- PLC3 theme: ownership — address objections, show what's inside
- Space PLCs 3 days apart
- Cart open 3 days after PLC3, close 7 days after open
- Suggest 2-3 bonuses with deadlines (first 48h for fast-action bonus)
- Fill mental_triggers based on creator's assets

### material_pt | material_en
**Input context:** curriculum_shared (module/lesson structure with lesson IDs)
**Output schema:** Record<lesson_id, MaterialItem[]>

Each entry maps a lesson ID to an array of resources:
```
{ label: string, type: 'pdf'|'repo'|'link'|'template'|'tool', url: string|null }
```

When generating course materials:
- Use the exact lesson IDs from curriculum_shared (e.g., "l1", "abc123")
- Include at least 1-3 materials per lesson (more for hands-on lessons)
- Choose type based on content: code exercises → 'repo', downloadable files → 'pdf', external references → 'link', starter files → 'template', software → 'tool'
- Provide concrete URLs when known (GitHub repos, official docs, etc.); use null for placeholder materials
- Label materials clearly in the same language as the section (pt or en)
- Prioritize materials that reinforce the learning outcomes from curriculum_shared
- For exercise and quiz lessons, always include a 'template' or 'repo' resource

### publish_pt | publish_en
**Input context:** ideia_shared + curriculum_shared + launch_shared (testimonials, social proof)
**Output schema:** Course publish section

When generating sales copy:
- Headline: max 10 words, benefit-focused
- Subheadline: clarify the how
- 5-7 bullet points with specific outcomes
- 4-6 FAQ items addressing common objections
- CTA: action-oriented, specific
- Guarantee: 30-day standard unless specified otherwise
