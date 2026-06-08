import { describe, it, expect } from 'vitest'
import { planAbMaterialization } from '@/lib/pipeline/video-ab-materialize'
import type { ABDraft } from '@/lib/pipeline/video-schemas'

const draft: ABDraft = {
  leader: 'A',
  variants: [
    { id: 'A', tag: 'original', title: 'Título Original', brief: 'brief original' },
    { id: 'B', title: 'Chall B', brief: 'brief B' },
    { id: 'C', title: 'Chall C', brief: 'brief C' },
    { id: 'D', title: 'Chall D', brief: 'brief D' },
  ],
}

describe('planAbMaterialization', () => {
  const plan = planAbMaterialization(draft)

  it('separates exactly one original and three challengers', () => {
    expect(plan.original.title).toBe('Título Original')
    expect(plan.original.brief).toBe('brief original')
    expect(plan.challengers).toHaveLength(3)
  })
  it('original title is never dropped (goes to updateTextVariant payload)', () => {
    expect(plan.originalUpdate.title_text).toBe('Título Original')
    expect(plan.originalUpdate.metadata.visual_description).toBe('brief original')
  })
  it('each challenger maps title→title_text and brief→metadata.visual_description', () => {
    expect(plan.challengers).toEqual([
      { title_text: 'Chall B', metadata: { visual_description: 'brief B' } },
      { title_text: 'Chall C', metadata: { visual_description: 'brief C' } },
      { title_text: 'Chall D', metadata: { visual_description: 'brief D' } },
    ])
  })
  it('total materialized row count is exactly 4 (1 original + 3 challengers)', () => {
    expect(1 + plan.challengers.length).toBe(4)
  })
})
