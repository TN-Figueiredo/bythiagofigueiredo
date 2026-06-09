import { describe, it, expect } from 'vitest'
import { planAbMaterialization } from '@/lib/pipeline/video-ab-materialize'
import type { ABDraft } from '@/lib/pipeline/video-schemas'

const draft: ABDraft = {
  firstOnAir: 'A',
  variants: [
    { id: 'A', role: 'challenger', title: 'Título A', brief: 'brief A' },
    { id: 'B', role: 'challenger', title: 'Chall B', brief: 'brief B' },
    { id: 'C', role: 'challenger', title: 'Chall C', brief: 'brief C' },
    { id: 'D', role: 'challenger', title: 'Chall D', brief: 'brief D' },
  ],
}

describe('planAbMaterialization', () => {
  const plan = planAbMaterialization(draft)

  it('seeds the is_original row from firstOnAir (not a user tag)', () => {
    expect(plan.original.title).toBe('Título A')
    expect(plan.original.brief).toBe('brief A')
    expect(plan.challengers).toHaveLength(3)
  })
  it('firstOnAir title is never dropped (goes to updateTextVariant payload)', () => {
    expect(plan.originalUpdate.title_text).toBe('Título A')
    expect(plan.originalUpdate.metadata.visual_description).toBe('brief A')
  })
  it('each non-firstOnAir variant maps title→title_text and brief→metadata.visual_description', () => {
    expect(plan.challengers).toEqual([
      { title_text: 'Chall B', metadata: { visual_description: 'brief B' } },
      { title_text: 'Chall C', metadata: { visual_description: 'brief C' } },
      { title_text: 'Chall D', metadata: { visual_description: 'brief D' } },
    ])
  })
  it('total materialized row count is exactly 4 (1 firstOnAir + 3 others)', () => {
    expect(1 + plan.challengers.length).toBe(4)
  })
  it('splits on firstOnAir even when it is not A', () => {
    const p = planAbMaterialization({ ...draft, firstOnAir: 'C' })
    expect(p.original.title).toBe('Chall C')
    expect(p.challengers.map(c => c.title_text)).toEqual(['Título A', 'Chall B', 'Chall D'])
  })
})
