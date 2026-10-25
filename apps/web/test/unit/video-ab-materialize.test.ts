import { describe, it, expect } from 'vitest'
import { planAbMaterialization, escolherDesafiantes } from '@/lib/pipeline/video-ab-materialize'
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
    expect('challengers' in plan).toBe(false) // fonte única: escolherDesafiantes
  })
  it('firstOnAir title is never dropped (goes to updateTextVariant payload)', () => {
    expect(plan.originalUpdate.title_text).toBe('Título A')
    expect(plan.originalUpdate.metadata.visual_description).toBe('brief A')
  })
  it('escolherDesafiantes mapeia title→title_text e brief→visual_description, ordem do rascunho, corta no teto', () => {
    const { escolhidas, descartadas } = escolherDesafiantes(draft)
    expect(escolhidas).toEqual([
      { title_text: 'Chall B', metadata: { visual_description: 'brief B' } },
      { title_text: 'Chall C', metadata: { visual_description: 'brief C' } },
    ])
    expect(descartadas).toEqual(['D: Chall D'])
  })
  it('splits on firstOnAir even when it is not A', () => {
    const d = { ...draft, firstOnAir: 'C' }
    expect(planAbMaterialization(d).original.title).toBe('Chall C')
    expect(escolherDesafiantes(d).escolhidas.map(c => c.title_text)).toEqual(['Título A', 'Chall B'])
  })
})
