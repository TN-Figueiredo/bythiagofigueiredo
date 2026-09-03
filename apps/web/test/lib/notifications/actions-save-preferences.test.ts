// apps/web/test/lib/notifications/actions-save-preferences.test.ts
//
// Regressão: savePreferences não pode confiar no payload do cliente para os
// canais push/telegram. A UI já os desabilita (push é stub permanente;
// telegram depende de public.profiles, que não existe em produção), mas
// alguém chamando a server action direto poderia persistir channel_push:
// true / channel_telegram: true. O servidor precisa forçar false
// independentemente do que o cliente mandar.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SavePreferencesInput } from '@/lib/notifications/actions'

const upsertCalls: Array<{ table: string; rows: unknown }> = []

function buildSupabaseMock() {
  return {
    from: vi.fn((table: string) => ({
      upsert: vi.fn((rows: unknown) => {
        upsertCalls.push({ table, rows })
        return Promise.resolve({ error: null })
      }),
    })),
  }
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => buildSupabaseMock()),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: '00000000-0000-0000-0000-000000000001',
    orgId: 'org-1',
    defaultLocale: 'pt-br',
  }),
}))

const { mockAuthNextjs } = vi.hoisted(() => ({
  mockAuthNextjs: {
    requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-abc' } }),
    createServerClient: vi.fn().mockReturnValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    }),
  },
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => mockAuthNextjs)
vi.mock('@tn-figueiredo/auth-nextjs', () => mockAuthNextjs)

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}))

import { savePreferences } from '@/lib/notifications/actions'

describe('savePreferences — push/telegram server-side lock', () => {
  beforeEach(() => {
    upsertCalls.length = 0
    vi.clearAllMocks()
  })

  it('forces channel_push and channel_telegram to false even when the client sends true', async () => {
    const input: SavePreferencesInput = {
      channels: { in_app: true, email: true, push: true, telegram: true },
      preset: 'regular',
      categories: {
        pipeline: { in_app: true, email: true, push: true, telegram: true },
        youtube: { in_app: true, email: false, push: true, telegram: true },
        newsletter: { in_app: true, email: true, push: false, telegram: false },
        social: { in_app: true, email: true, push: true, telegram: true },
        links: { in_app: true, email: true, push: true, telegram: true },
        blog: { in_app: true, email: true, push: true, telegram: true },
        media: { in_app: true, email: true, push: true, telegram: true },
        system: { in_app: true, email: true, push: true, telegram: true },
      },
      quietEnabled: false,
      quietStart: '22:00',
      quietEnd: '08:00',
      timezone: 'America/Sao_Paulo',
    }

    const result = await savePreferences(input)
    expect(result.ok).toBe(true)

    const preferenceCalls = upsertCalls.filter((c) => c.table === 'notification_preferences')
    expect(preferenceCalls.length).toBeGreaterThan(0)

    for (const call of preferenceCalls) {
      const rows = Array.isArray(call.rows) ? call.rows : [call.rows]
      for (const row of rows as Array<Record<string, unknown>>) {
        expect(row.channel_push).toBe(false)
        expect(row.channel_telegram).toBe(false)
      }
    }
  })
})
