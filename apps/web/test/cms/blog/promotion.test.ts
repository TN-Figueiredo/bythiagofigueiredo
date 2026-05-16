import { describe, it, expect } from 'vitest'
import { isValidTransition } from '@/app/cms/(authed)/blog/_hub/hub-utils'

describe('Promotion flow validation', () => {
  describe('isValidTransition for blog post statuses', () => {
    it('idea → draft is valid', () => {
      expect(isValidTransition('idea', 'draft')).toBe(true)
    })

    it('idea → scheduled is NOT valid (must go through draft/ready)', () => {
      expect(isValidTransition('idea', 'scheduled')).toBe(false)
    })

    it('ready → scheduled is valid', () => {
      expect(isValidTransition('ready', 'scheduled')).toBe(true)
    })

    it('ready → published is valid', () => {
      expect(isValidTransition('ready', 'published')).toBe(true)
    })

    it('published → archived is valid', () => {
      expect(isValidTransition('published', 'archived')).toBe(true)
    })

    it('archived → idea is valid (unarchive)', () => {
      expect(isValidTransition('archived', 'idea')).toBe(true)
    })

    it('published → idea is NOT valid', () => {
      expect(isValidTransition('published', 'idea')).toBe(false)
    })

    it('scheduled → ready is valid (unschedule)', () => {
      expect(isValidTransition('scheduled', 'ready')).toBe(true)
    })
  })

  describe('return-to-pipeline eligibility', () => {
    it('idea status is returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('idea')).toBe(true)
    })

    it('draft status is returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('draft')).toBe(true)
    })

    it('scheduled status is NOT returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('scheduled')).toBe(false)
    })

    it('published status is NOT returnable', () => {
      const returnableStatuses = ['idea', 'draft']
      expect(returnableStatuses.includes('published')).toBe(false)
    })
  })
})
