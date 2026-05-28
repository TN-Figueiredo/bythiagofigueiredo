import { describe, it, expect } from 'vitest'
import { VARIANT_LABELS } from '@/lib/youtube/ab-types'

describe('handleVariantsReceived logic', () => {
  it('maps variant labels to correct indices', () => {
    const labelToIndex = Object.fromEntries(
      VARIANT_LABELS.map((l, i) => [l, i]),
    ) as Record<string, number>
    expect(labelToIndex).toEqual({ B: 0, C: 1, D: 2 })
  })

  it('filters out unknown labels', () => {
    const labelToIndex = Object.fromEntries(
      VARIANT_LABELS.map((l, i) => [l, i]),
    ) as Record<string, number>
    const variants = [
      { label: 'B', title_text: 'Test B', description_text: null, metadata: null },
      { label: 'X', title_text: 'Test X', description_text: null, metadata: null },
    ]
    const labels = new Set(
      variants.map((v) => v.label).filter((l) => l in labelToIndex),
    )
    expect(labels).toEqual(new Set(['B']))
  })

  it('maps variants to textVariants correctly', () => {
    const labelToIndex = Object.fromEntries(
      VARIANT_LABELS.map((l, i) => [l, i]),
    ) as Record<string, number>
    const variants = [
      { label: 'B', title_text: 'Title B', description_text: 'Desc B', metadata: null },
      { label: 'D', title_text: 'Title D', description_text: null, metadata: null },
    ]
    const prev = [
      { title: '', description: '' },
      { title: '', description: '' },
      { title: '', description: '' },
    ]
    const next = [...prev]
    for (const v of variants) {
      const idx = labelToIndex[v.label]
      if (idx !== undefined) {
        next[idx] = {
          title: v.title_text ?? '',
          description: v.description_text ?? '',
        }
      }
    }
    expect(next[0]).toEqual({ title: 'Title B', description: 'Desc B' })
    expect(next[1]).toEqual({ title: '', description: '' })
    expect(next[2]).toEqual({ title: 'Title D', description: '' })
  })
})

describe('submit guard — coworkVariantLabels', () => {
  it('skips image upload when Cowork populated variants', () => {
    const coworkVariantLabels = new Set(['B', 'C', 'D'])
    const shouldUploadImages = coworkVariantLabels.size === 0
    expect(shouldUploadImages).toBe(false)
  })

  it('allows image upload when no Cowork variants', () => {
    const coworkVariantLabels = new Set<string>()
    const shouldUploadImages = coworkVariantLabels.size === 0
    expect(shouldUploadImages).toBe(true)
  })

  it('filters text variants already created by Cowork', () => {
    const coworkVariantLabels = new Set(['B', 'D'])
    const textVariants = [
      { title: 'Title B', description: '' },
      { title: 'Title C', description: '' },
      { title: 'Title D', description: '' },
    ]
    const textSlotsToSave = textVariants
      .map((tv, i) => ({ ...tv, label: VARIANT_LABELS[i] ?? '' }))
      .filter((tv) => {
        if (coworkVariantLabels.has(tv.label)) return false
        return tv.title.trim().length > 0
      })
    expect(textSlotsToSave).toHaveLength(1)
    expect(textSlotsToSave[0].label).toBe('C')
  })
})

describe('coworkVariantLabels phantom render prevention', () => {
  it('returns same reference when labels match', () => {
    const prev = new Set(['B', 'C'])
    const labels = new Set(['B', 'C'])
    const result =
      prev.size === labels.size && [...labels].every((l) => prev.has(l))
        ? prev
        : labels
    expect(result).toBe(prev) // same reference
  })

  it('returns new set when labels differ', () => {
    const prev = new Set(['B'])
    const labels = new Set(['B', 'C'])
    const result =
      prev.size === labels.size && [...labels].every((l) => prev.has(l))
        ? prev
        : labels
    expect(result).toBe(labels) // new reference
  })
})
