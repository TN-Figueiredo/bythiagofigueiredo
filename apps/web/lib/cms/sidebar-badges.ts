import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { generateCadenceSlots } from '@/lib/newsletter/cadence-slots'
import type { CadencePattern } from '@/lib/newsletter/cadence-pattern'

export interface UrgencySlot {
  typeName: string
  typeColor: string
  slotDate: string
  daysUntil: number
}

export type UrgencyColor = 'yellow' | 'orange' | 'red'

export interface UrgencyBadge {
  count: number
  color: UrgencyColor
  slots: UrgencySlot[]
}

export interface SidebarBadgeData {
  posts: { wip: number }
  newsletters: {
    wip: number
    wipDraft: number
    wipReady: number
    urgency: UrgencyBadge | null
  }
}

export function computeUrgencyColor(daysUntil: number): UrgencyColor | null {
  if (daysUntil < 0) return null
  if (daysUntil <= 4) return 'red'
  if (daysUntil <= 9) return 'orange'
  if (daysUntil <= 15) return 'yellow'
  return null
}

export function computeUrgencyBadge(slots: UrgencySlot[]): UrgencyBadge | null {
  const validSlots = slots.filter((s) => s.daysUntil >= 0 && s.daysUntil <= 15)
  if (validSlots.length === 0) return null
  const minDays = Math.min(...validSlots.map((s) => s.daysUntil))
  const color = computeUrgencyColor(minDays)!
  return { count: validSlots.length, color, slots: validSlots }
}

export const fetchSidebarBadges = unstable_cache(
  async (siteId: string): Promise<SidebarBadgeData> => {
    const supabase = getSupabaseServiceClient()
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayMs = new Date(todayStr + 'T00:00:00Z').getTime()

    const [postsRes, editionsWipRes, typesRes, filledEditionsRes] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .in('status', ['draft', 'ready']),
      supabase
        .from('newsletter_editions')
        .select('status', { count: 'exact' })
        .eq('site_id', siteId)
        .in('status', ['draft', 'ready']),
      supabase
        .from('newsletter_types')
        .select('id, name, color, cadence_pattern, cadence_paused')
        .eq('site_id', siteId)
        .eq('active', true),
      supabase
        .from('newsletter_editions')
        .select('newsletter_type_id, slot_date')
        .eq('site_id', siteId)
        .in('status', ['ready', 'scheduled', 'queued', 'sending', 'sent'])
        .not('slot_date', 'is', null)
        .gte('slot_date', todayStr),
    ])

    const postsWip = postsRes.count ?? 0
    const wipRows = editionsWipRes.data ?? []
    const wipDraft = wipRows.filter((r) => r.status === 'draft').length
    const wipReady = wipRows.filter((r) => r.status === 'ready').length
    const newsletterWip = editionsWipRes.count ?? 0

    const fifteenDaysStr = new Date(todayMs + 15 * 86_400_000).toISOString().slice(0, 10)
    const filledSlots = new Set(
      (filledEditionsRes.data ?? []).map((e) => `${e.newsletter_type_id}:${e.slot_date}`),
    )

    const urgencySlots: UrgencySlot[] = []
    for (const t of typesRes.data ?? []) {
      if (t.cadence_paused || !t.cadence_pattern) continue
      const pattern = t.cadence_pattern as CadencePattern
      const slots = generateCadenceSlots(pattern, { from: todayStr, maxSlots: 30 })
      for (const slotDate of slots) {
        if (slotDate > fifteenDaysStr) break
        const key = `${t.id}:${slotDate}`
        if (!filledSlots.has(key)) {
          const daysUntil = Math.round(
            (new Date(slotDate + 'T00:00:00Z').getTime() - todayMs) / 86_400_000,
          )
          urgencySlots.push({
            typeName: t.name as string,
            typeColor: (t.color as string) ?? '#6366f1',
            slotDate,
            daysUntil,
          })
        }
      }
    }

    return {
      posts: { wip: postsWip },
      newsletters: {
        wip: newsletterWip,
        wipDraft,
        wipReady,
        urgency: computeUrgencyBadge(urgencySlots),
      },
    }
  },
  ['sidebar-badges'],
  { tags: ['sidebar-badges'], revalidate: 60 },
)
