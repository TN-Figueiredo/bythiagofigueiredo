import { describe, it, expect } from 'vitest'
import {
  ResearchFocoCreateSchema,
  ResearchFocoUpdateSchema,
  ResearchFocoFullSchema,
  ResearchDecisionCreateSchema,
  ResearchDecisionUpdateSchema,
  RESEARCH_STATUS,
  DECISION_STATUS,
  FOCO_STATE,
  DECISION_HORIZON,
  RESEARCH_SOURCE,
  THEME_IDS,
} from '@/lib/pipeline/research-schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '11111111-1111-1111-1111-111111111111'
const VALID_UUID_2 = '22222222-2222-2222-2222-222222222222'

// ---------------------------------------------------------------------------
// 1. Foco validation
// ---------------------------------------------------------------------------

describe('ResearchFocoCreateSchema', () => {
  const validInput = {
    title: 'Foco de estudo sobre IA',
    state: 'rascunho' as const,
    horizon: 'agora' as const,
    theme_ids: ['ia', 'dev'] as const,
    pinned_research_ids: [VALID_UUID],
  }

  it('accepts valid create input', () => {
    const result = ResearchFocoCreateSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = validInput
    const result = ResearchFocoCreateSchema.safeParse(noTitle)
    expect(result.success).toBe(false)
  })

  it('rejects invalid state', () => {
    const result = ResearchFocoCreateSchema.safeParse({ ...validInput, state: 'invalido' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid horizon', () => {
    const result = ResearchFocoCreateSchema.safeParse({ ...validInput, horizon: 'depois' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid theme_id in array', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validInput,
      theme_ids: ['ia', 'invalid-theme'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty title (whitespace only)', () => {
    // min(1) on .string() validates length, but whitespace passes min(1)
    // This documents current behavior: Zod min(1) does NOT trim
    const result = ResearchFocoCreateSchema.safeParse({ ...validInput, title: '   ' })
    // whitespace-only string length > 0, so min(1) passes
    expect(result.success).toBe(true)
  })

  it('applies defaults for state, horizon, theme_ids, pinned_research_ids', () => {
    const result = ResearchFocoCreateSchema.safeParse({ title: 'Minimal foco' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.state).toBe('rascunho')
      expect(result.data.horizon).toBe('agora')
      expect(result.data.theme_ids).toEqual([])
      expect(result.data.pinned_research_ids).toEqual([])
    }
  })

  it('pinned_research_ids accepts UUID array', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validInput,
      pinned_research_ids: [VALID_UUID, VALID_UUID_2],
    })
    expect(result.success).toBe(true)
  })

  it('pinned_research_ids rejects non-UUID strings', () => {
    const result = ResearchFocoCreateSchema.safeParse({
      ...validInput,
      pinned_research_ids: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })
})

describe('ResearchFocoUpdateSchema', () => {
  it('accepts partial update (only title)', () => {
    const result = ResearchFocoUpdateSchema.safeParse({ title: 'Novo titulo' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no fields required)', () => {
    const result = ResearchFocoUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid state', () => {
    const result = ResearchFocoUpdateSchema.safeParse({ state: 'nope' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid horizon', () => {
    const result = ResearchFocoUpdateSchema.safeParse({ horizon: 'nunca' })
    expect(result.success).toBe(false)
  })

  it('accepts nullable description', () => {
    const result = ResearchFocoUpdateSchema.safeParse({ description: null })
    expect(result.success).toBe(true)
  })
})

describe('ResearchFocoFullSchema', () => {
  it('accepts full schema with all fields', () => {
    const result = ResearchFocoFullSchema.safeParse({
      id: VALID_UUID,
      title: 'Foco completo',
      description: 'Uma descricao',
      state: 'ativo',
      horizon: 'proximo',
      rationale: 'Porque sim',
      metric: 'Views > 1000',
      window_label: 'Q3 2026',
      theme_ids: ['ia'],
      pinned_research_ids: [VALID_UUID_2],
    })
    expect(result.success).toBe(true)
  })

  it('accepts full schema without id (create mode)', () => {
    const result = ResearchFocoFullSchema.safeParse({
      title: 'Sem ID',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBeUndefined()
    }
  })

  it('requires title (inherited override from create)', () => {
    // ResearchFocoFullSchema extends Update but overrides title to required
    const result = ResearchFocoFullSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid id (non-UUID)', () => {
    const result = ResearchFocoFullSchema.safeParse({
      id: 'not-a-uuid',
      title: 'Foco',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Decision validation
// ---------------------------------------------------------------------------

describe('ResearchDecisionCreateSchema', () => {
  const validInput = {
    title: 'Decidir formato de conteudo',
    horizon: 'agora' as const,
  }

  it('accepts valid create input', () => {
    const result = ResearchDecisionCreateSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = validInput
    const result = ResearchDecisionCreateSchema.safeParse(noTitle)
    expect(result.success).toBe(false)
  })

  it('rejects missing horizon', () => {
    const { horizon: _, ...noHorizon } = validInput
    const result = ResearchDecisionCreateSchema.safeParse(noHorizon)
    expect(result.success).toBe(false)
  })

  it('rejects invalid horizon', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      horizon: 'futuro-distante',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      status: 'pendente',
    })
    expect(result.success).toBe(false)
  })

  it('applies default status = decidido', () => {
    const result = ResearchDecisionCreateSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('decidido')
    }
  })

  it('drives accepts string array', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      drives: ['Mais views', 'Melhor SEO'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.drives).toEqual(['Mais views', 'Melhor SEO'])
    }
  })

  it('drives rejects array > 10 items', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      drives: Array.from({ length: 11 }, (_, i) => `Drive ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('drives item max length is 100 chars', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      drives: ['x'.repeat(101)],
    })
    expect(result.success).toBe(false)
  })

  it('drives item at exactly 100 chars passes', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      drives: ['x'.repeat(100)],
    })
    expect(result.success).toBe(true)
  })

  it('source_research_ids accepts UUID array', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      source_research_ids: [VALID_UUID, VALID_UUID_2],
    })
    expect(result.success).toBe(true)
  })

  it('source_research_ids rejects non-UUID strings', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      source_research_ids: ['bad-id'],
    })
    expect(result.success).toBe(false)
  })

  it('theme_id accepts valid ThemeId', () => {
    for (const id of THEME_IDS) {
      const result = ResearchDecisionCreateSchema.safeParse({ ...validInput, theme_id: id })
      expect(result.success, `theme_id "${id}" should be valid`).toBe(true)
    }
  })

  it('theme_id rejects invalid string', () => {
    const result = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      theme_id: 'crypto',
    })
    expect(result.success).toBe(false)
  })

  it('date_label is optional string', () => {
    const withLabel = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      date_label: 'Jun 2026',
    })
    expect(withLabel.success).toBe(true)

    const withoutLabel = ResearchDecisionCreateSchema.safeParse(validInput)
    expect(withoutLabel.success).toBe(true)

    const nullLabel = ResearchDecisionCreateSchema.safeParse({
      ...validInput,
      date_label: null,
    })
    expect(nullLabel.success).toBe(true)
  })
})

describe('ResearchDecisionUpdateSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = ResearchDecisionUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with only title', () => {
    const result = ResearchDecisionUpdateSchema.safeParse({ title: 'Updated' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = ResearchDecisionUpdateSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid horizon', () => {
    const result = ResearchDecisionUpdateSchema.safeParse({ horizon: 'far-away' })
    expect(result.success).toBe(false)
  })

  it('source_research_ids is optional (for diff-sync)', () => {
    const result = ResearchDecisionUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.source_research_ids).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Status/enum value alignment
// ---------------------------------------------------------------------------

describe('Enum value alignment', () => {
  it('RESEARCH_STATUS has exactly 4 values', () => {
    expect(RESEARCH_STATUS).toHaveLength(4)
    expect(RESEARCH_STATUS).toEqual(['fresca', 'analise', 'aplicada', 'arquivada'])
  })

  it('DECISION_STATUS has exactly 4 values', () => {
    expect(DECISION_STATUS).toHaveLength(4)
    expect(DECISION_STATUS).toEqual(['decidido', 'testando', 'revisar', 'arquivado'])
  })

  it('FOCO_STATE has exactly 4 values', () => {
    expect(FOCO_STATE).toHaveLength(4)
    expect(FOCO_STATE).toEqual(['ativo', 'proposto', 'rascunho', 'arquivado'])
  })

  it('DECISION_HORIZON has exactly 3 values', () => {
    expect(DECISION_HORIZON).toHaveLength(3)
    expect(DECISION_HORIZON).toEqual(['agora', 'proximo', 'explorar'])
  })

  it('RESEARCH_SOURCE has exactly 3 values', () => {
    expect(RESEARCH_SOURCE).toHaveLength(3)
    expect(RESEARCH_SOURCE).toEqual(['cowork', 'thiago', 'dupla'])
  })

  it('THEME_IDS has exactly 6 values', () => {
    expect(THEME_IDS).toHaveLength(6)
    expect(THEME_IDS).toEqual(['asia', 'ia', 'dev', 'games', 'grana', 'canal'])
  })
})
