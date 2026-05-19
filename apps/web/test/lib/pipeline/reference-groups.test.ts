import { describe, it, expect } from 'vitest'
import {
  REFERENCE_GROUPS,
  REFERENCE_GROUP_IDS,
  getGroupMeta,
  REFERENCE_USAGE,
} from '@/lib/pipeline/reference-groups'

describe('REFERENCE_GROUPS', () => {
  it('has 6 groups', () => {
    expect(REFERENCE_GROUPS).toHaveLength(6)
  })

  it('each group has id, label, and color', () => {
    for (const g of REFERENCE_GROUPS) {
      expect(g.id).toBeTruthy()
      expect(g.label).toBeTruthy()
      expect(g.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('group ids are unique', () => {
    const ids = REFERENCE_GROUPS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('REFERENCE_GROUP_IDS', () => {
  it('matches REFERENCE_GROUPS order', () => {
    expect(REFERENCE_GROUP_IDS).toEqual(REFERENCE_GROUPS.map((g) => g.id))
  })
})

describe('getGroupMeta', () => {
  it('finds known group by id', () => {
    const meta = getGroupMeta('craft')
    expect(meta.id).toBe('craft')
    expect(meta.label).toBe('Craft')
  })

  it('returns first group as fallback for unknown id', () => {
    const meta = getGroupMeta('nonexistent')
    expect(meta).toBe(REFERENCE_GROUPS[0])
  })
})

describe('REFERENCE_USAGE', () => {
  it('has entries with non-empty role arrays', () => {
    for (const [key, roles] of Object.entries(REFERENCE_USAGE)) {
      expect(roles.length).toBeGreaterThan(0)
      expect(key).toBeTruthy()
    }
  })

  it('all roles are strings', () => {
    for (const roles of Object.values(REFERENCE_USAGE)) {
      for (const role of roles) {
        expect(typeof role).toBe('string')
      }
    }
  })
})
