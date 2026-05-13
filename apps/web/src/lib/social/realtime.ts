'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { PostStatus, SocialDelivery } from '@tn-figueiredo/social'

function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export function useSocialDeliveries(postId: string): SocialDelivery[] {
  const [deliveries, setDeliveries] = useState<SocialDelivery[]>([])

  useEffect(() => {
    if (!postId) return

    const supabase = getSupabaseBrowserClient()

    // Initial fetch
    supabase
      .from('social_deliveries')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDeliveries(data as unknown as SocialDelivery[])
      })

    // Subscribe to changes
    const channel = supabase
      .channel(`social-deliveries-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_deliveries',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setDeliveries((prev) => {
            const updated = payload.new as unknown as SocialDelivery | undefined
            const deleted = payload.old as { id?: string } | undefined

            if (payload.eventType === 'DELETE' && deleted?.id) {
              return prev.filter((d) => d.id !== deleted.id)
            }

            if (!updated) return prev

            const idx = prev.findIndex((d) => d.id === updated.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = updated
              return next
            }
            return [...prev, updated]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [postId])

  return deliveries
}

export function useSocialPostStatus(postId: string): PostStatus {
  const [status, setStatus] = useState<PostStatus>('draft')

  useEffect(() => {
    if (!postId) return

    const supabase = getSupabaseBrowserClient()

    // Initial fetch
    supabase
      .from('social_posts')
      .select('status')
      .eq('id', postId)
      .single()
      .then(({ data }) => {
        if (data) setStatus(data.status as PostStatus)
      })

    // Subscribe to changes
    const channel = supabase
      .channel(`social-post-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'social_posts',
          filter: `id=eq.${postId}`,
        },
        (payload) => {
          const updated = payload.new as { status?: PostStatus } | undefined
          if (updated?.status) {
            setStatus(updated.status)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [postId])

  return status
}
