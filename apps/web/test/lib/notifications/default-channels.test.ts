// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows: Record<string, unknown> = {}
const inserted: Array<Record<string, unknown>> = []
let globalPrefs: { channel_email: boolean; channel_push: boolean; channel_telegram: boolean } | null = null

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: vi.fn(() => Promise.resolve({ data: 0, error: null })),
    from: (table: string) => {
      if (table === 'notification_preferences') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({ maybeSingle: () => Promise.resolve({ data: globalPrefs }) }),
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
              }),
            }),
          }),
        }
      }
      if (table === 'notification_deliveries') {
        return { insert: (r: Array<Record<string, unknown>>) => { inserted.push(...r); return Promise.resolve({ error: null }) } }
      }
      return {
        select: () => ({
          eq: () => ({ gte: () => Promise.resolve({ count: 0, error: null }) }),
        }),
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'n-1' }, error: null }) }),
        }),
      }
    },
  }),
}))

import { createNotification } from '@/lib/notifications/create'

const BASE = {
  site_id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000002',
  type: 'system.token_expired',
  domain: 'system' as const,
  priority: 5,
  title: 'Instagram token expired',
  message: 'reconnect',
}

beforeEach(() => { inserted.length = 0; globalPrefs = null; void rows })

describe('defaultChannels', () => {
  it('SEM linha em notification_preferences: o e-mail SAI', async () => {
    const r = await createNotification({ ...BASE, defaultChannels: ['email'] })
    expect(r.success).toBe(true)
    expect(inserted.map((d) => d.channel)).toEqual(['email'])
  })

  it('COM linha global channel_email:false: o e-mail é SUPRIMIDO e a linha em notifications é escrita', async () => {
    globalPrefs = { channel_email: false, channel_push: false, channel_telegram: false }
    const r = await createNotification({ ...BASE, defaultChannels: ['email'] })
    expect(r.success).toBe(true)
    expect(r.notificationId).toBe('n-1')
    expect(inserted).toHaveLength(0)
  })

  it('sem defaultChannels e sem prefs: comportamento antigo (nenhuma entrega externa)', async () => {
    const r = await createNotification(BASE)
    expect(r.success).toBe(true)
    expect(inserted).toHaveLength(0)
  })
})
