import { describe, it, expect } from 'vitest'
import { isValidTransition, getValidTargets, computeDisplayId, mapStatusToColumn, BLOG_TRANSITIONS } from '../../src/app/cms/(authed)/blog/_hub/hub-utils'
import type { PostCard } from '../../src/app/cms/(authed)/blog/_hub/hub-types'

describe('blog-hub utils', () => {
  describe('BLOG_TRANSITIONS', () => {
    it('allows idea → draft', () => {
      expect(isValidTransition('idea', 'draft')).toBe(true)
    })

    it('allows idea → archived', () => {
      expect(isValidTransition('idea', 'archived')).toBe(true)
    })

    it('blocks idea → published', () => {
      expect(isValidTransition('idea', 'published')).toBe(false)
    })

    it('allows draft → ready', () => {
      expect(isValidTransition('draft', 'ready')).toBe(true)
    })

    it('allows draft → idea (revert)', () => {
      expect(isValidTransition('draft', 'idea')).toBe(true)
    })

    it('blocks draft → published (skip ready)', () => {
      expect(isValidTransition('draft', 'published')).toBe(false)
    })

    it('allows ready → published', () => {
      expect(isValidTransition('ready', 'published')).toBe(true)
    })

    it('allows published → archived only', () => {
      expect(isValidTransition('published', 'archived')).toBe(true)
      expect(isValidTransition('published', 'draft')).toBe(false)
    })

    it('allows archived → idea or draft', () => {
      expect(isValidTransition('archived', 'idea')).toBe(true)
      expect(isValidTransition('archived', 'draft')).toBe(true)
      expect(isValidTransition('archived', 'published')).toBe(false)
    })

    it('returns valid targets for ready', () => {
      expect(getValidTargets('ready')).toEqual(['draft', 'scheduled', 'queued', 'published', 'archived'])
    })

    it('returns empty for unknown status', () => {
      expect(getValidTargets('unknown')).toEqual([])
    })
  })

  describe('computeDisplayId', () => {
    it('formats with BP prefix and zero-padded number', () => {
      expect(computeDisplayId(1)).toBe('#BP-001')
      expect(computeDisplayId(42)).toBe('#BP-042')
      expect(computeDisplayId(999)).toBe('#BP-999')
      expect(computeDisplayId(1000)).toBe('#BP-1000')
    })
  })

  describe('mapStatusToColumn', () => {
    it('maps idea to idea column', () => {
      expect(mapStatusToColumn('idea')).toBe('idea')
    })

    it('maps draft and pending_review to draft column', () => {
      expect(mapStatusToColumn('draft')).toBe('draft')
      expect(mapStatusToColumn('pending_review')).toBe('draft')
    })

    it('maps ready and queued to ready column', () => {
      expect(mapStatusToColumn('ready')).toBe('ready')
      expect(mapStatusToColumn('queued')).toBe('ready')
    })

    it('maps scheduled to scheduled column', () => {
      expect(mapStatusToColumn('scheduled')).toBe('scheduled')
    })

    it('maps published to published column', () => {
      expect(mapStatusToColumn('published')).toBe('published')
    })

    it('maps archived to archived', () => {
      expect(mapStatusToColumn('archived')).toBe('archived')
    })
  })
})
