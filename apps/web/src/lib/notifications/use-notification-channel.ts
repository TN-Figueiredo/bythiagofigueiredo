'use client'

import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export function useNotificationChannel(
  userId: string,
  dispatch: (action: any) => void, // NotificationAction dispatch
) {
  const lastReceivedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          dispatch({ type: 'ADD', item: payload.new })
          lastReceivedRef.current = (payload.new as { created_at: string }).created_at
        },
      )
      .subscribe()

    // Gap recovery on visibility change
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      if (!lastReceivedRef.current) return

      dispatch({ type: 'RECOVERY_START' })
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gt('created_at', lastReceivedRef.current)
        .is('dismissed_at', null)
        .order('created_at', { ascending: true })
        .limit(50)

      if (data?.length) {
        dispatch({ type: 'RECOVERY_COMPLETE', items: data })
        lastReceivedRef.current = data[data.length - 1].created_at
      } else {
        dispatch({ type: 'RECOVERY_COMPLETE', items: [] })
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId, dispatch])
}
