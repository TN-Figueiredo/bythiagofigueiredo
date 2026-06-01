import { describe, it, expect } from 'vitest'
import {
  notificationReducer,
  INITIAL_STATE,
} from '@/lib/notifications/notification-context'
import type {
  INotification,
  NotificationState,
} from '@/lib/notifications/types'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeNotification(overrides: Partial<INotification> = {}): INotification {
  return {
    id: 'n-1',
    site_id: 'site-1',
    user_id: 'user-1',
    type: 'pipeline.step_completed',
    domain: 'pipeline',
    priority: 2,
    title: 'Step completed',
    message: null,
    payload: null,
    dedup_key: null,
    group_key: null,
    read_at: null,
    dismissed_at: null,
    expired_at: null,
    snoozed_until: null,
    suggested_action: null,
    action_href: null,
    created_at: '2026-05-29T12:00:00Z',
    ...overrides,
  }
}

function stateWith(items: INotification[]): NotificationState {
  return notificationReducer(INITIAL_STATE, {
    type: 'SET_INITIAL',
    items,
    lastReceived: null,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notificationReducer', () => {
  // -----------------------------------------------------------------------
  // SET_INITIAL
  // -----------------------------------------------------------------------
  describe('SET_INITIAL', () => {
    it('sets items and computes derived fields', () => {
      const items = [
        makeNotification({ id: 'a', priority: 4 }),
        makeNotification({ id: 'b', read_at: '2026-05-29T13:00:00Z' }),
      ]
      const state = notificationReducer(INITIAL_STATE, {
        type: 'SET_INITIAL',
        items,
        lastReceived: null,
      })
      expect(state.items).toHaveLength(2)
      expect(state.unreadCount).toBe(1)
      expect(state.hasCritical).toBe(true)
      expect(state.lastReceived).toBe('2026-05-29T12:00:00Z')
    })

    it('uses explicit lastReceived when provided', () => {
      const state = notificationReducer(INITIAL_STATE, {
        type: 'SET_INITIAL',
        items: [],
        lastReceived: '2026-01-01T00:00:00Z',
      })
      expect(state.lastReceived).toBe('2026-01-01T00:00:00Z')
    })
  })

  // -----------------------------------------------------------------------
  // SET_COUNT_ONLY
  // -----------------------------------------------------------------------
  describe('SET_COUNT_ONLY', () => {
    it('sets unreadCount and hasCritical without modifying items', () => {
      const state = stateWith([makeNotification({ id: 'a' })])
      const next = notificationReducer(state, {
        type: 'SET_COUNT_ONLY',
        unreadCount: 5,
        hasCritical: true,
      })
      expect(next.unreadCount).toBe(5)
      expect(next.hasCritical).toBe(true)
      // Items remain untouched
      expect(next.items).toHaveLength(1)
      expect(next.items[0].id).toBe('a')
    })

    it('works on empty state', () => {
      const next = notificationReducer(INITIAL_STATE, {
        type: 'SET_COUNT_ONLY',
        unreadCount: 3,
        hasCritical: false,
      })
      expect(next.unreadCount).toBe(3)
      expect(next.hasCritical).toBe(false)
      expect(next.items).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // ADD
  // -----------------------------------------------------------------------
  describe('ADD', () => {
    it('prepends item and increments unreadCount', () => {
      const state = stateWith([makeNotification({ id: 'existing' })])
      const next = notificationReducer(state, {
        type: 'ADD',
        item: makeNotification({ id: 'new', created_at: '2026-05-30T00:00:00Z' }),
      })
      expect(next.items).toHaveLength(2)
      expect(next.items[0].id).toBe('new')
      expect(next.unreadCount).toBe(2)
      expect(next.lastReceived).toBe('2026-05-30T00:00:00Z')
    })

    it('does not increment unreadCount for already-read items', () => {
      const state = stateWith([])
      const next = notificationReducer(state, {
        type: 'ADD',
        item: makeNotification({ id: 'read', read_at: '2026-05-29T14:00:00Z' }),
      })
      expect(next.unreadCount).toBe(0)
    })

    it('deduplicates by id', () => {
      const state = stateWith([makeNotification({ id: 'dup' })])
      const next = notificationReducer(state, {
        type: 'ADD',
        item: makeNotification({ id: 'dup', title: 'Different title' }),
      })
      expect(next.items).toHaveLength(1)
      expect(next.items[0].title).toBe('Step completed') // original kept
    })
  })

  // -----------------------------------------------------------------------
  // MARK_READ
  // -----------------------------------------------------------------------
  describe('MARK_READ', () => {
    it('marks an unread item as read and decrements count', () => {
      const state = stateWith([makeNotification({ id: 'x' })])
      expect(state.unreadCount).toBe(1)
      const next = notificationReducer(state, { type: 'MARK_READ', id: 'x' })
      expect(next.items[0].read_at).toBeTruthy()
      expect(next.unreadCount).toBe(0)
    })

    it('is idempotent for already-read items', () => {
      const state = stateWith([
        makeNotification({ id: 'x', read_at: '2026-05-29T13:00:00Z' }),
      ])
      const next = notificationReducer(state, { type: 'MARK_READ', id: 'x' })
      expect(next).toBe(state) // reference equality — no change
    })

    it('returns same state for unknown id', () => {
      const state = stateWith([makeNotification({ id: 'x' })])
      const next = notificationReducer(state, { type: 'MARK_READ', id: 'nope' })
      expect(next).toBe(state)
    })
  })

  // -----------------------------------------------------------------------
  // MARK_UNREAD
  // -----------------------------------------------------------------------
  describe('MARK_UNREAD', () => {
    it('clears read_at and increments count', () => {
      const state = stateWith([
        makeNotification({ id: 'x', read_at: '2026-05-29T13:00:00Z' }),
      ])
      expect(state.unreadCount).toBe(0)
      const next = notificationReducer(state, { type: 'MARK_UNREAD', id: 'x' })
      expect(next.items[0].read_at).toBeNull()
      expect(next.unreadCount).toBe(1)
    })

    it('is idempotent for already-unread items', () => {
      const state = stateWith([makeNotification({ id: 'x' })])
      const next = notificationReducer(state, { type: 'MARK_UNREAD', id: 'x' })
      expect(next).toBe(state)
    })
  })

  // -----------------------------------------------------------------------
  // MARK_ALL_READ
  // -----------------------------------------------------------------------
  describe('MARK_ALL_READ', () => {
    it('marks all items read and resets counts', () => {
      const state = stateWith([
        makeNotification({ id: 'a', priority: 5 }),
        makeNotification({ id: 'b' }),
        makeNotification({ id: 'c', read_at: '2026-05-29T13:00:00Z' }),
      ])
      expect(state.unreadCount).toBe(2)
      expect(state.hasCritical).toBe(true)
      const next = notificationReducer(state, { type: 'MARK_ALL_READ' })
      expect(next.unreadCount).toBe(0)
      expect(next.hasCritical).toBe(false)
      expect(next.items.every((n) => n.read_at !== null)).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // DISMISS
  // -----------------------------------------------------------------------
  describe('DISMISS', () => {
    it('removes item and decrements if unread', () => {
      const state = stateWith([
        makeNotification({ id: 'a' }),
        makeNotification({ id: 'b' }),
      ])
      const next = notificationReducer(state, { type: 'DISMISS', id: 'a' })
      expect(next.items).toHaveLength(1)
      expect(next.unreadCount).toBe(1)
    })

    it('does not decrement if dismissed item was read', () => {
      const state = stateWith([
        makeNotification({ id: 'a', read_at: '2026-05-29T13:00:00Z' }),
        makeNotification({ id: 'b' }),
      ])
      const next = notificationReducer(state, { type: 'DISMISS', id: 'a' })
      expect(next.items).toHaveLength(1)
      expect(next.unreadCount).toBe(1)
    })

    it('returns same state for unknown id', () => {
      const state = stateWith([makeNotification({ id: 'a' })])
      const next = notificationReducer(state, { type: 'DISMISS', id: 'nope' })
      expect(next).toBe(state)
    })
  })

  // -----------------------------------------------------------------------
  // BULK_DISMISS
  // -----------------------------------------------------------------------
  describe('BULK_DISMISS', () => {
    it('removes multiple items and adjusts unreadCount', () => {
      const state = stateWith([
        makeNotification({ id: 'a' }),
        makeNotification({ id: 'b', read_at: '2026-05-29T13:00:00Z' }),
        makeNotification({ id: 'c' }),
      ])
      expect(state.unreadCount).toBe(2)
      const next = notificationReducer(state, {
        type: 'BULK_DISMISS',
        ids: ['a', 'b'],
      })
      expect(next.items).toHaveLength(1)
      expect(next.items[0].id).toBe('c')
      expect(next.unreadCount).toBe(1) // only 'a' was unread
    })
  })

  // -----------------------------------------------------------------------
  // RECOVERY_START
  // -----------------------------------------------------------------------
  describe('RECOVERY_START', () => {
    it('sets isRecovering to true', () => {
      const next = notificationReducer(INITIAL_STATE, { type: 'RECOVERY_START' })
      expect(next.isRecovering).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // RECOVERY_COMPLETE
  // -----------------------------------------------------------------------
  describe('RECOVERY_COMPLETE', () => {
    it('merges items deduped by id and clears isRecovering', () => {
      let state = notificationReducer(INITIAL_STATE, { type: 'RECOVERY_START' })
      state = notificationReducer(state, {
        type: 'SET_INITIAL',
        items: [makeNotification({ id: 'existing' })],
        lastReceived: null,
      })
      state = notificationReducer(state, { type: 'RECOVERY_START' })

      const next = notificationReducer(state, {
        type: 'RECOVERY_COMPLETE',
        items: [
          makeNotification({ id: 'existing', title: 'Should be ignored' }),
          makeNotification({ id: 'new', created_at: '2026-05-30T01:00:00Z' }),
        ],
      })
      expect(next.items).toHaveLength(2)
      expect(next.items.find((n) => n.id === 'existing')?.title).toBe(
        'Step completed',
      )
      expect(next.isRecovering).toBe(false)
      expect(next.lastReceived).toBe('2026-05-30T01:00:00Z')
    })

    it('updates unreadCount after merge', () => {
      const state = stateWith([
        makeNotification({ id: 'a', read_at: '2026-05-29T13:00:00Z' }),
      ])
      const recovered = notificationReducer(state, {
        type: 'RECOVERY_COMPLETE',
        items: [makeNotification({ id: 'b' })],
      })
      expect(recovered.unreadCount).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // CONNECTION_STATUS
  // -----------------------------------------------------------------------
  describe('CONNECTION_STATUS', () => {
    it('updates connection status', () => {
      const next = notificationReducer(INITIAL_STATE, {
        type: 'CONNECTION_STATUS',
        status: 'reconnecting',
      })
      expect(next.connectionStatus).toBe('reconnecting')
    })

    it('cycles through all statuses', () => {
      let state = notificationReducer(INITIAL_STATE, {
        type: 'CONNECTION_STATUS',
        status: 'disconnected',
      })
      expect(state.connectionStatus).toBe('disconnected')
      state = notificationReducer(state, {
        type: 'CONNECTION_STATUS',
        status: 'connected',
      })
      expect(state.connectionStatus).toBe('connected')
    })
  })

  // -----------------------------------------------------------------------
  // REVERT_READ
  // -----------------------------------------------------------------------
  describe('REVERT_READ', () => {
    it('reverts a read item back to unread', () => {
      let state = stateWith([makeNotification({ id: 'x' })])
      state = notificationReducer(state, { type: 'MARK_READ', id: 'x' })
      expect(state.unreadCount).toBe(0)
      const next = notificationReducer(state, { type: 'REVERT_READ', id: 'x' })
      expect(next.items[0].read_at).toBeNull()
      expect(next.unreadCount).toBe(1)
    })

    it('is idempotent for already-unread items', () => {
      const state = stateWith([makeNotification({ id: 'x' })])
      const next = notificationReducer(state, { type: 'REVERT_READ', id: 'x' })
      expect(next).toBe(state)
    })

    it('restores hasCritical for high-priority items', () => {
      let state = stateWith([makeNotification({ id: 'x', priority: 5 })])
      expect(state.hasCritical).toBe(true)
      state = notificationReducer(state, { type: 'MARK_READ', id: 'x' })
      expect(state.hasCritical).toBe(false)
      state = notificationReducer(state, { type: 'REVERT_READ', id: 'x' })
      expect(state.hasCritical).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // REVERT_DISMISS
  // -----------------------------------------------------------------------
  describe('REVERT_DISMISS', () => {
    it('re-inserts a dismissed item', () => {
      const item = makeNotification({ id: 'gone' })
      const state = stateWith([makeNotification({ id: 'stay' })])
      const next = notificationReducer(state, {
        type: 'REVERT_DISMISS',
        id: 'gone',
        item,
      })
      expect(next.items).toHaveLength(2)
      expect(next.items[0].id).toBe('gone') // prepended
      expect(next.unreadCount).toBe(2)
    })

    it('does not increment unreadCount for a read item', () => {
      const item = makeNotification({
        id: 'gone',
        read_at: '2026-05-29T14:00:00Z',
      })
      const state = stateWith([])
      const next = notificationReducer(state, {
        type: 'REVERT_DISMISS',
        id: 'gone',
        item,
      })
      expect(next.unreadCount).toBe(0)
    })

    it('is idempotent if item already exists', () => {
      const item = makeNotification({ id: 'x' })
      const state = stateWith([item])
      const next = notificationReducer(state, {
        type: 'REVERT_DISMISS',
        id: 'x',
        item,
      })
      expect(next).toBe(state)
    })
  })
})
