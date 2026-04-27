import { describe, it, expect } from 'vitest'

describe('Status transition matrix — allowed/blocked', () => {
  const EDITABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled']
  const LOCKED_STATUSES = ['sending', 'sent', 'failed', 'cancelled']
  const SCHEDULABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled']
  const CANCELLABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled', 'queued']
  const SENDABLE_STATUSES = ['idea', 'draft', 'ready', 'scheduled']
  const REVERTABLE_STATUSES = ['cancelled', 'failed']
  const TESTABLE_STATUSES = ['idea', 'draft', 'ready']

  describe('saveEdition', () => {
    it.each(EDITABLE_STATUSES)('allows save from %s', (status) => {
      expect(EDITABLE_STATUSES).toContain(status)
    })
    it.each(LOCKED_STATUSES)('blocks save from %s', (status) => {
      expect(EDITABLE_STATUSES).not.toContain(status)
    })
  })

  describe('scheduleEdition', () => {
    it.each(SCHEDULABLE_STATUSES)('allows schedule from %s', (status) => {
      expect(SCHEDULABLE_STATUSES).toContain(status)
    })
    it.each(['sending', 'sent', 'failed', 'cancelled'])('blocks schedule from %s', (status) => {
      expect(SCHEDULABLE_STATUSES).not.toContain(status)
    })
  })

  describe('cancelEdition', () => {
    it.each(CANCELLABLE_STATUSES)('allows cancel from %s', (status) => {
      expect(CANCELLABLE_STATUSES).toContain(status)
    })
    it.each(['sending', 'sent', 'failed', 'cancelled'])('blocks cancel from %s', (status) => {
      expect(CANCELLABLE_STATUSES).not.toContain(status)
    })
  })

  describe('sendNow', () => {
    it.each(SENDABLE_STATUSES)('allows sendNow from %s', (status) => {
      expect(SENDABLE_STATUSES).toContain(status)
    })
    it.each(['sending', 'sent', 'failed', 'cancelled'])('blocks sendNow from %s', (status) => {
      expect(SENDABLE_STATUSES).not.toContain(status)
    })
  })

  describe('revertToDraft', () => {
    it.each(REVERTABLE_STATUSES)('allows revert from %s', (status) => {
      expect(REVERTABLE_STATUSES).toContain(status)
    })
    it.each(['idea', 'draft', 'ready', 'scheduled', 'sending', 'sent'])('blocks revert from %s', (status) => {
      expect(REVERTABLE_STATUSES).not.toContain(status)
    })
  })

  describe('sendTestEmail', () => {
    it.each(TESTABLE_STATUSES)('allows test from %s', (status) => {
      expect(TESTABLE_STATUSES).toContain(status)
    })
    it.each(['scheduled', 'sending', 'sent', 'failed', 'cancelled'])('blocks test from %s', (status) => {
      expect(TESTABLE_STATUSES).not.toContain(status)
    })
  })

  describe('sent is terminal', () => {
    it('only delete and duplicate work from sent', () => {
      const sent = 'sent'
      expect(EDITABLE_STATUSES).not.toContain(sent)
      expect(SCHEDULABLE_STATUSES).not.toContain(sent)
      expect(CANCELLABLE_STATUSES).not.toContain(sent)
      expect(SENDABLE_STATUSES).not.toContain(sent)
      expect(REVERTABLE_STATUSES).not.toContain(sent)
    })
  })
})
