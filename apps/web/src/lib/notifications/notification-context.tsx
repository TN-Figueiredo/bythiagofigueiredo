'use client'

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react'
import type {
  INotification,
  NotificationState,
  NotificationAction,
} from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeUnreadCount(items: INotification[]): number {
  return items.filter((n) => !n.read_at).length
}

function computeHasCritical(items: INotification[]): boolean {
  return items.some((n) => n.priority >= 4 && !n.read_at)
}

function latestTimestamp(items: INotification[]): string | null {
  if (items.length === 0) return null
  return items.reduce((max, n) =>
    n.created_at > max ? n.created_at : max,
    items[0]!.created_at,
  )
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export const INITIAL_STATE: NotificationState = {
  items: [],
  unreadCount: 0,
  hasCritical: false,
  lastReceived: null,
  isRecovering: false,
  connectionStatus: 'connected',
}

export function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  switch (action.type) {
    case 'SET_INITIAL': {
      const items = action.items
      return {
        ...state,
        items,
        unreadCount: computeUnreadCount(items),
        hasCritical: computeHasCritical(items),
        lastReceived: action.lastReceived ?? latestTimestamp(items),
      }
    }

    case 'SET_COUNT_ONLY': {
      // Lightweight update — only sets badge counts without full item list.
      // Used on mount to avoid fetching 50 rows on every navigation.
      return {
        ...state,
        unreadCount: action.unreadCount,
        hasCritical: action.hasCritical,
      }
    }

    case 'ADD': {
      // Dedup by id — if already present, skip
      if (state.items.some((n) => n.id === action.item.id)) {
        return state
      }
      const items = [action.item, ...state.items]
      return {
        ...state,
        items,
        unreadCount: action.item.read_at
          ? state.unreadCount
          : state.unreadCount + 1,
        hasCritical: computeHasCritical(items),
        lastReceived:
          action.item.created_at > (state.lastReceived ?? '')
            ? action.item.created_at
            : state.lastReceived,
      }
    }

    case 'MARK_READ': {
      const target = state.items.find((n) => n.id === action.id)
      if (!target || target.read_at) return state
      const items = state.items.map((n) =>
        n.id === action.id ? { ...n, read_at: new Date().toISOString() } : n,
      )
      return {
        ...state,
        items,
        unreadCount: state.unreadCount - 1,
        hasCritical: computeHasCritical(items),
      }
    }

    case 'MARK_UNREAD': {
      const target = state.items.find((n) => n.id === action.id)
      if (!target || !target.read_at) return state
      const items = state.items.map((n) =>
        n.id === action.id ? { ...n, read_at: null } : n,
      )
      return {
        ...state,
        items,
        unreadCount: state.unreadCount + 1,
        hasCritical: computeHasCritical(items),
      }
    }

    case 'MARK_ALL_READ': {
      const now = new Date().toISOString()
      const items = state.items.map((n) =>
        n.read_at ? n : { ...n, read_at: now },
      )
      return {
        ...state,
        items,
        unreadCount: 0,
        hasCritical: false,
      }
    }

    case 'DISMISS': {
      const target = state.items.find((n) => n.id === action.id)
      if (!target) return state
      const items = state.items.filter((n) => n.id !== action.id)
      const wasUnread = !target.read_at
      return {
        ...state,
        items,
        unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
        hasCritical: computeHasCritical(items),
      }
    }

    case 'BULK_DISMISS': {
      const idsSet = new Set(action.ids)
      const dismissed = state.items.filter((n) => idsSet.has(n.id))
      const items = state.items.filter((n) => !idsSet.has(n.id))
      const unreadDismissed = dismissed.filter((n) => !n.read_at).length
      return {
        ...state,
        items,
        unreadCount: state.unreadCount - unreadDismissed,
        hasCritical: computeHasCritical(items),
      }
    }

    case 'RECOVERY_START': {
      return { ...state, isRecovering: true }
    }

    case 'RECOVERY_COMPLETE': {
      // Merge incoming items, dedup by id (existing items win)
      const existingIds = new Set(state.items.map((n) => n.id))
      const newItems = action.items.filter((n) => !existingIds.has(n.id))
      const items = [...state.items, ...newItems]
      return {
        ...state,
        items,
        unreadCount: computeUnreadCount(items),
        hasCritical: computeHasCritical(items),
        lastReceived: latestTimestamp(items) ?? state.lastReceived,
        isRecovering: false,
      }
    }

    case 'CONNECTION_STATUS': {
      return { ...state, connectionStatus: action.status }
    }

    case 'REVERT_READ': {
      // Undo a MARK_READ — set read_at back to null
      const target = state.items.find((n) => n.id === action.id)
      if (!target || !target.read_at) return state
      const items = state.items.map((n) =>
        n.id === action.id ? { ...n, read_at: null } : n,
      )
      return {
        ...state,
        items,
        unreadCount: state.unreadCount + 1,
        hasCritical: computeHasCritical(items),
      }
    }

    case 'REVERT_DISMISS': {
      // Re-insert the dismissed item
      if (state.items.some((n) => n.id === action.id)) return state
      const items = [action.item, ...state.items]
      return {
        ...state,
        items,
        unreadCount: action.item.read_at
          ? state.unreadCount
          : state.unreadCount + 1,
        hasCritical: computeHasCritical(items),
      }
    }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface NotificationContextValue {
  state: NotificationState
  dispatch: Dispatch<NotificationAction>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({
  children,
}: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, INITIAL_STATE)

  // Fetch lightweight count on mount instead of 50-row full query
  useEffect(() => {
    let cancelled = false
    fetch('/api/notifications/count')
      .then((r) => r.json())
      .then((data: { unreadCount: number; hasCritical: boolean }) => {
        if (!cancelled) {
          dispatch({
            type: 'SET_COUNT_ONLY',
            unreadCount: data.unreadCount,
            hasCritical: data.hasCritical,
          })
        }
      })
      .catch(() => {
        // Silently fail — badge will show 0 until next realtime event
      })
    return () => { cancelled = true }
  }, [])

  return (
    <NotificationContext.Provider value={{ state, dispatch }}>
      {children}
    </NotificationContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    )
  }
  return ctx
}
