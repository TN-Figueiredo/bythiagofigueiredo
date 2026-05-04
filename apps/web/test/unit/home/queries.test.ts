import { describe, it, expect } from 'vitest'
import type { HomeTag } from '../../../lib/home/types'

describe('HomeTag type', () => {
  it('has required fields', () => {
    const tag: HomeTag = {
      id: 'uuid-1', name: 'tech', slug: 'tech',
      color: '#6366f1', colorDark: '#818cf8', postCount: 3,
    }
    expect(tag.id).toBe('uuid-1')
    expect(tag.name).toBe('tech')
    expect(tag.postCount).toBe(3)
  })

  it('allows null colorDark', () => {
    const tag: HomeTag = {
      id: 'uuid-2', name: 'vida', slug: 'vida',
      color: '#22c55e', colorDark: null, postCount: 1,
    }
    expect(tag.colorDark).toBeNull()
  })
})
