'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { PostStatus, SocialDelivery } from '@tn-figueiredo/social'

function parseSocialDelivery(row: Record<string, unknown>): SocialDelivery {
  return {
    id: row.id as string,
    post_id: row.post_id as string,
    connection_id: row.connection_id as string,
    provider: row.provider as SocialDelivery['provider'],
    status: row.status as SocialDelivery['status'],
    platform_post_id: (row.platform_post_id as string | null) ?? null,
    platform_url: (row.platform_url as string | null) ?? null,
    content_override: (row.content_override as Record<string, unknown> | null) ?? null,
    attempt: row.attempt as number,
    max_attempts: row.max_attempts as number,
    last_error: (row.last_error as string | null) ?? null,
    error_type: (row.error_type as SocialDelivery['error_type']) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    format: row.format as SocialDelivery['format'],
  }
}

export function useSocialDeliveries(postId: string): SocialDelivery[] {
  const [deliveries, setDeliveries] = useState<SocialDelivery[]>([])

  useEffect(() => {
    if (!postId) return

    const supabase = getSupabaseBrowserClient()

    // Initial fetch
    supabase
      .from('social_deliveries')
      .select('id, post_id, connection_id, provider, status, platform_post_id, platform_url, content_override, attempt, max_attempts, published_at, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDeliveries((data as Record<string, unknown>[]).map(parseSocialDelivery))
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
            const updated = payload.new && typeof payload.new === 'object' && 'id' in payload.new
            ? parseSocialDelivery(payload.new as Record<string, unknown>)
            : undefined
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
