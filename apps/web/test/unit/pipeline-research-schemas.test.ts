// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  THEME_IDS,
  RESEARCH_STATUS,
  RESEARCH_SOURCE,
  DECISION_HORIZON,
  DECISION_STATUS,
  FOCO_STATE,
  TOPIC_SLUG_REGEX,
  ResearchItemCreateSchema,
  ResearchItemUpdateSchema,
  ResearchDecisionCreateSchema,
  ResearchDecisionUpdateSchema,
  ResearchFocoCreateSchema,
  ResearchFocoUpdateSchema,
  ResearchFocoFullSchema,
  ResearchTopicCreateSchema,
  ResearchImportSchema,
} from '@/lib/pipeline/research-schemas'
import {
  STATUS_META,
  THEME_META,
  THEMES,
  HORIZON_META,
  DECISION_STATUS_META,
  FOCO_STATE_META,
  SOURCE_META,
} from '@/lib/pipeline/research-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '00000000-0000-4000-8000-000000000001'
const VALID_UUID_2 = '00000000-0000-4000-8000-000000000002'

function validResearchItem() {
  return {
    title: 'How Asia shapes indie dev culture',
    topic_slug: 'asia/indie',
    content_md: '# Deep dive\nLorem ipsum...',
  }
}

function validDecision() {
  return {
    title: 'Switch to Bun runtime',
    horizon: 'agora' as const,
  }
}

function validFoco() {
  return {
    title: 'IA for video editing pipeline',
  }
}

// ---------------------------------------------------------------------------
// 1. ThemeId constants
// ---------------------------------------------------------------------------

describe('THEME_IDS', () => {
  it('has exactly 6 entries', () => {
    expect(THEME_IDS).toHaveLength(6)
  })

  it('contains the expected ids', () => {
    expect([...THEME_IDS]).toEqual(['asia', 'ia', 'dev', 'games', 'grana', 'canal'])
  })
})

describe('THEMES array', () => {
  it('has one entry per THEME_ID', () => {
    expect(THEMES).toHaveLength(THEME_IDS.length)
  })

  it('each entry has id, label, color, icon, short', () => {
    for (const theme of THEMES) {
      expect(theme).toHaveProperty('id')
      expect(theme).toHaveProperty('label')
      expect(theme).toHaveProperty('color')
      expect(theme).toHaveProperty('icon')
      expect(theme).toHaveProperty('short')
    }
  })

  it('every THEME_ID has a matching THEMES entry', () => {
    const ids = THEMES.map((t) => t.id)
    for (const id of THEME_IDS) {
      expect(ids).toContain(id)
    }
  })

  it('color values are valid hex colors', () => {
    for (const theme of THEMES) {
      expect(theme.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. ResearchItemCreateSchema
// ---------------------------------------------------------------------------

describe('ResearchItemCreateSchema', () => {
  it('accepts valid minimal input', () => {
    const result = ResearchItemCreateSchema.safeParse(validResearchItem())
    expect(result.success).toBe(true)
  })

  it('accepts valid input with all optional fields', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      summary: 'A short summary',
      sources: [{ url: 'https://example.com', title: 'Example' }],
      theme_id: 'ia',
      source: 'cowork',
      read_min: 5,
      pinned: true,
      takeaways: ['Key insight 1', 'Key insight 2'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      title: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing title', () => {
    const { title: _, ...rest } = validResearchItem()
    const result = ResearchItemCreateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing content_md', () => {
    const { content_md: _, ...rest } = validResearchItem()
    const result = ResearchItemCreateSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid theme_id', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      theme_id: 'invalid_theme',
    })
    expect(result.success).toBe(false)
  })

  it('accepts every valid theme_id', () => {
    for (const id of THEME_IDS) {
      const result = ResearchItemCreateSchema.safeParse({
        ...validResearchItem(),
        theme_id: id,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid source value', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      source: 'unknown_source',
    })
    expect(result.success).toBe(false)
  })

  it('accepts every valid source', () => {
    for (const src of RESEARCH_SOURCE) {
      const result = ResearchItemCreateSchema.safeParse({
        ...validResearchItem(),
        source: src,
      })
      expect(result.success).toBe(true)
    }
  })

  it('defaults takeaways to empty array', () => {
    const result = ResearchItemCreateSchema.parse(validResearchItem())
    expect(result.takeaways).toEqual([])
  })

  it('defaults source to "thiago"', () => {
    const result = ResearchItemCreateSchema.parse(validResearchItem())
    expect(result.source).toBe('thiago')
  })

  it('defaults pinned to false', () => {
    const result = ResearchItemCreateSchema.parse(validResearchItem())
    expect(result.pinned).toBe(false)
  })

  it('defaults sources to empty array', () => {
    const result = ResearchItemCreateSchema.parse(validResearchItem())
    expect(result.sources).toEqual([])
  })

  it('rejects takeaways with more than 10 items', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      takeaways: Array.from({ length: 11 }, (_, i) => `Takeaway ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid topic_slug format', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      topic_slug: 'INVALID SLUG!',
    })
    expect(result.success).toBe(false)
  })

  it('accepts hierarchical topic_slug with slashes', () => {
    const result = ResearchItemCreateSchema.safeParse({
      ...validResearchItem(),
      topic_slug: 'asia/nomadismo/vistos',
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2b. ResearchItemUpdateSchema
// ---------------------------------------------------------------------------

describe('ResearchItemUpdateSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = ResearchItemUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid status', () => {
    for (const status of RESEARCH_STATUS) {
      const result = ResearchItemUpdateSchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = ResearchItemUpdateSchema.safeParse({ status: 'bogus' })
    expect(result.success).toBe(false)
  })

  it('rejects content_json and content_md together', () => {
    const result = ResearchItemUpdateSchema.safeParse({
      content_json: { type: 'doc' },
      content_md: '# Hello',
    })
    expect(result.success).toBe(false)
  })

  it('accepts content_json alone', () => {
    const result = ResearchItemUpdateSchema.safeParse({
      content_json: { type: 'doc' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts nullable theme_id', () => {
    const result = ResearchItemUpdateSchema.safeParse({ theme_id: null })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. ResearchDecisionCreateSchema
// ---------------------------------------------------------------------------

describe('ResearchDecisionCreateSchema', () => {
  it('accepts valid minimal input', () => {
    const result = ResearchDecisionCreateSchema.safeParse(validDecision())
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      title: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing title', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      horizon: 'agora',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid horizon values', () => {
    for (const h of DECISION_HORIZON) {
      const result = ResearchDecisionCreateSchema.safeParse({
        ...validDecision(),
        horizon: h,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid horizon value', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      horizon: 'never',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid status values', () => {
    for (const s of DECISION_STATUS) {
      const result = ResearchDecisionCreateSchema.safeParse({
        ...validDecision(),
        status: s,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status value', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      status: 'invalid_status',
    })
    expect(result.success).toBe(false)
  })

  it('defaults status to "decidido"', () => {
    const result = ResearchDecisionCreateSchema.parse(validDecision())
    expect(result.status).toBe('decidido')
  })

  it('defaults drives to empty array', () => {
    const result = ResearchDecisionCreateSchema.parse(validDecision())
    expect(result.drives).toEqual([])
  })

  it('defaults source_research_ids to empty array', () => {
    const result = ResearchDecisionCreateSchema.parse(validDecision())
    expect(result.source_research_ids).toEqual([])
  })

  it('accepts source_research_ids with valid UUIDs', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      source_research_ids: [VALID_UUID, VALID_UUID_2],
    })
    expect(result.success).toBe(true)
  })

  it('rejects source_research_ids with invalid UUIDs', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      source_research_ids: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects drives array with more than 10 items', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      drives: Array.from({ length: 11 }, (_, i) => `drive-${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('accepts drives array with exactly 10 items', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      drives: Array.from({ length: 10 }, (_, i) => `drive-${i}`),
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional source_notes keyed by UUID', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validDecision(),
      source_notes: { [VALID_UUID]: 'Important context' },
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. ResearchFocoCreateSchema
// ---------------------------------------------------------------------------

describe('ResearchFocoCreateSchema', () => {
  it('accepts valid minimal input', () => {
    const result = ResearchFocoCreateSchema.safeParse(validFoco())
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = ResearchFocoCreateSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing title', () => {
    const result = ResearchFocoCreateSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts all valid state values', () => {
    for (const s of FOCO_STATE) {
      const result = ResearchFocoCreateSchema.safeParse({
        ...validFoco(),
        state: s,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid state value', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      state: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('defaults state to "rascunho"', () => {
    const result = ResearchFocoCreateSchema.parse(validFoco())
    expect(result.state).toBe('rascunho')
  })

  it('defaults horizon to "agora"', () => {
    const result = ResearchFocoCreateSchema.parse(validFoco())
    expect(result.horizon).toBe('agora')
  })

  it('defaults theme_ids to empty array', () => {
    const result = ResearchFocoCreateSchema.parse(validFoco())
    expect(result.theme_ids).toEqual([])
  })

  it('defaults pinned_research_ids to empty array', () => {
    const result = ResearchFocoCreateSchema.parse(validFoco())
    expect(result.pinned_research_ids).toEqual([])
  })

  it('accepts theme_ids with valid ThemeIds', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      theme_ids: ['ia', 'dev', 'games'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects theme_ids with invalid ThemeId', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      theme_ids: ['ia', 'invalid_id'],
    })
    expect(result.success).toBe(false)
  })

  it('metric is optional', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      metric: 'Views per video > 1000',
    })
    expect(result.success).toBe(true)
  })

  it('window_label is optional', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      window_label: 'Q3 2026',
    })
    expect(result.success).toBe(true)
  })

  it('accepts nullable description and rationale', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      description: null,
      rationale: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts pinned_notes keyed by UUID', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validFoco(),
      pinned_research_ids: [VALID_UUID],
      pinned_notes: { [VALID_UUID]: 'Key source for this focus' },
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. ResearchFocoFullSchema
// ---------------------------------------------------------------------------

describe('ResearchFocoFullSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = ResearchFocoFullSchema.safeParse({
      id: VALID_UUID,
      title: 'Full foco entry',
      description: 'Detailed description',
      rationale: 'Because data says so',
      metric: 'NPS > 8',
      window_label: 'Q1 2026',
      state: 'ativo',
      horizon: 'proximo',
      theme_ids: ['ia', 'canal'],
      pinned_research_ids: [VALID_UUID_2],
      pinned_notes: { [VALID_UUID_2]: 'Supporting research' },
    })
    expect(result.success).toBe(true)
  })

  it('id is optional (supports create vs update)', () => {
    const result = ResearchFocoFullSchema.safeParse({
      title: 'No id foco',
    })
    expect(result.success).toBe(true)
  })

  it('title is required (not optional like in update schema)', () => {
    const result = ResearchFocoFullSchema.safeParse({
      id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID for id', () => {
    const result = ResearchFocoFullSchema.safeParse({
      id: 'not-a-uuid',
      title: 'Bad id foco',
    })
    expect(result.success).toBe(false)
  })

  it('theme_ids defaults handled from update schema', () => {
    const result = ResearchFocoFullSchema.safeParse({
      title: 'Defaults foco',
    })
    expect(result.success).toBe(true)
    // theme_ids is optional in update schema (no default), so should be undefined
    if (result.success) {
      expect(result.data.theme_ids).toBeUndefined()
    }
  })

  it('pinned_research_ids is optional from update schema', () => {
    const result = ResearchFocoFullSchema.safeParse({
      title: 'No pinned',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pinned_research_ids).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// 6. Meta dictionaries alignment
// ---------------------------------------------------------------------------

describe('Meta dictionaries alignment', () => {
  it('STATUS_META keys match RESEARCH_STATUS values', () => {
    const metaKeys = Object.keys(STATUS_META).sort()
    const enumValues = [...RESEARCH_STATUS].sort()
    expect(metaKeys).toEqual(enumValues)
  })

  it('THEME_META keys match THEME_IDS values', () => {
    const metaKeys = Object.keys(THEME_META).sort()
    const enumValues = [...THEME_IDS].sort()
    expect(metaKeys).toEqual(enumValues)
  })

  it('HORIZON_META keys match DECISION_HORIZON values', () => {
    const metaKeys = Object.keys(HORIZON_META).sort()
    const enumValues = [...DECISION_HORIZON].sort()
    expect(metaKeys).toEqual(enumValues)
  })

  it('DECISION_STATUS_META keys match DECISION_STATUS values', () => {
    const metaKeys = Object.keys(DECISION_STATUS_META).sort()
    const enumValues = [...DECISION_STATUS].sort()
    expect(metaKeys).toEqual(enumValues)
  })

  it('FOCO_STATE_META keys match FOCO_STATE values', () => {
    const metaKeys = Object.keys(FOCO_STATE_META).sort()
    const enumValues = [...FOCO_STATE].sort()
    expect(metaKeys).toEqual(enumValues)
  })

  it('SOURCE_META keys match RESEARCH_SOURCE values', () => {
    const metaKeys = Object.keys(SOURCE_META).sort()
    const enumValues = [...RESEARCH_SOURCE].sort()
    expect(metaKeys).toEqual(enumValues)
  })

  it('STATUS_META entries have required fields', () => {
    for (const [key, meta] of Object.entries(STATUS_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('kind')
      expect(meta).toHaveProperty('dot')
      expect(typeof meta.label).toBe('string')
      expect(meta.label.length).toBeGreaterThan(0)
      // kind must be one of the defined values
      expect(['info', 'warn', 'ok', 'muted']).toContain(meta.kind)
    }
  })

  it('THEME_META entries have required fields', () => {
    for (const meta of Object.values(THEME_META)) {
      expect(meta).toHaveProperty('id')
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('short')
      expect(meta).toHaveProperty('color')
      expect(meta).toHaveProperty('icon')
      expect(typeof meta.label).toBe('string')
      expect(meta.label.length).toBeGreaterThan(0)
    }
  })

  it('HORIZON_META entries have required fields', () => {
    for (const meta of Object.values(HORIZON_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('sub')
      expect(meta).toHaveProperty('icon')
      expect(meta).toHaveProperty('color')
      expect(typeof meta.label).toBe('string')
    }
  })

  it('DECISION_STATUS_META entries have required fields', () => {
    for (const meta of Object.values(DECISION_STATUS_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('kind')
      expect(meta).toHaveProperty('icon')
      expect(meta).toHaveProperty('dot')
      expect(['ok', 'warn', 'info', 'muted']).toContain(meta.kind)
    }
  })

  it('FOCO_STATE_META entries have required fields', () => {
    for (const meta of Object.values(FOCO_STATE_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('kind')
      expect(meta).toHaveProperty('tone')
      expect(['ok', 'info', 'muted']).toContain(meta.kind)
    }
  })

  it('SOURCE_META entries have required fields', () => {
    for (const meta of Object.values(SOURCE_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('short')
      expect(meta).toHaveProperty('icon')
      expect(meta).toHaveProperty('tone')
      expect(typeof meta.label).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------
// 7. TOPIC_SLUG_REGEX
// ---------------------------------------------------------------------------

describe('TOPIC_SLUG_REGEX', () => {
  it('accepts simple slug', () => {
    expect(TOPIC_SLUG_REGEX.test('asia')).toBe(true)
  })

  it('accepts hierarchical slugs', () => {
    expect(TOPIC_SLUG_REGEX.test('asia/nomadismo')).toBe(true)
    expect(TOPIC_SLUG_REGEX.test('dev/typescript/generics')).toBe(true)
  })

  it('accepts slugs with numbers', () => {
    expect(TOPIC_SLUG_REGEX.test('web3')).toBe(true)
    expect(TOPIC_SLUG_REGEX.test('react-19')).toBe(true)
  })

  it('rejects uppercase', () => {
    expect(TOPIC_SLUG_REGEX.test('Asia')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(TOPIC_SLUG_REGEX.test('asia nomadismo')).toBe(false)
  })

  it('rejects trailing slash', () => {
    expect(TOPIC_SLUG_REGEX.test('asia/')).toBe(false)
  })

  it('rejects leading slash', () => {
    expect(TOPIC_SLUG_REGEX.test('/asia')).toBe(false)
  })

  it('rejects double slash', () => {
    expect(TOPIC_SLUG_REGEX.test('asia//dev')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8. ResearchImportSchema
// ---------------------------------------------------------------------------

describe('ResearchImportSchema', () => {
  it('accepts array with 1 item', () => {
    const result = ResearchImportSchema.safeParse({
      items: [validResearchItem()],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = ResearchImportSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 50 items', () => {
    const result = ResearchImportSchema.safeParse({
      items: Array.from({ length: 51 }, () => validResearchItem()),
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 9. ResearchTopicCreateSchema
// ---------------------------------------------------------------------------

describe('ResearchTopicCreateSchema', () => {
  it('accepts valid input', () => {
    const result = ResearchTopicCreateSchema.safeParse({
      name: 'Typescript',
      slug: 'typescript',
    })
    expect(result.success).toBe(true)
  })

  it('defaults color and icon', () => {
    const result = ResearchTopicCreateSchema.parse({
      name: 'Typescript',
      slug: 'typescript',
    })
    expect(result.color).toBe('#a78bfa')
    expect(result.icon).toBe('📁')
  })

  it('rejects invalid hex color', () => {
    const result = ResearchTopicCreateSchema.safeParse({
      name: 'Test',
      slug: 'test',
      color: 'red',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = ResearchTopicCreateSchema.safeParse({
      name: 'My Topic',
      slug: 'my topic',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. Enum array completeness
// ---------------------------------------------------------------------------

describe('Enum arrays', () => {
  it('RESEARCH_STATUS has 4 values', () => {
    expect(RESEARCH_STATUS).toHaveLength(4)
    expect([...RESEARCH_STATUS]).toEqual(['fresca', 'analise', 'aplicada', 'arquivada'])
  })

  it('RESEARCH_SOURCE has 3 values', () => {
    expect(RESEARCH_SOURCE).toHaveLength(3)
    expect([...RESEARCH_SOURCE]).toEqual(['cowork', 'thiago', 'dupla'])
  })

  it('DECISION_HORIZON has 3 values', () => {
    expect(DECISION_HORIZON).toHaveLength(3)
    expect([...DECISION_HORIZON]).toEqual(['agora', 'proximo', 'explorar'])
  })

  it('DECISION_STATUS has 4 values', () => {
    expect(DECISION_STATUS).toHaveLength(4)
    expect([...DECISION_STATUS]).toEqual(['decidido', 'testando', 'revisar', 'arquivado'])
  })

  it('FOCO_STATE has 4 values', () => {
    expect(FOCO_STATE).toHaveLength(4)
    expect([...FOCO_STATE]).toEqual(['ativo', 'proposto', 'rascunho', 'arquivado'])
  })
})
