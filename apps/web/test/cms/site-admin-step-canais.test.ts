// Degrau "administrar o site" — canais. Remover canal próprio, mudar a identidade
// dele (idioma/nicho) e remover canal concorrente: só quem administra.
//   (a) editora → negado, service client nem é criado;
//   (b) org_admin → continua funcionando;
//   (c) erro da RPC de permissão → negado.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionWho, ServiceLog } from '../helpers/site-admin-session'

const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
const log = vi.hoisted(() => ({ clients: 0, writes: [], reads: [], rpcs: [], row: {}, rpcData: { ok: true } }) as ServiceLog)
const cache = vi.hoisted(() => ({ invalidated: 0 }))

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', async () => {
  const { fakeSessionClient, SESSION_USER_ID } = await import('../helpers/site-admin-session')
  return {
    createServerClient: () => fakeSessionClient(sess),
    requireSiteScope: async () =>
      sess.who === 'anon' ? { ok: false, reason: 'unauthenticated' } : { ok: true, user: { id: SESSION_USER_ID } },
  }
})
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@/lib/supabase/service', async () => {
  const { recordingServiceClient } = await import('../helpers/site-admin-session')
  return { getSupabaseServiceClient: () => recordingServiceClient(log) }
})
vi.mock('@/lib/youtube/observatorio/cache-tag', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/observatorio/cache-tag')>()),
  invalidateObservatory: () => { cache.invalidated++ },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as channels from '@/app/cms/(authed)/youtube/_actions/channels'
import * as competitors from '@/app/cms/(authed)/youtube/competitors/actions'
import * as niches from '@/app/cms/(authed)/youtube/competitors/niche-actions'
import { resetServiceLog, hadEffect } from '../helpers/site-admin-session'

const UUID = '11111111-1111-4111-8111-111111111111'
type Res = { ok: boolean; error?: string }
const isRefusal = (r: Res) => r.ok === false && /^Só quem administra o site pode /.test(r.error ?? '')

interface Case { name: string; run: () => Promise<Res>; adminDid: () => boolean }
const RESTRICTED: Case[] = [
  {
    name: 'removeYouTubeChannel',
    run: () => channels.removeYouTubeChannel({ channelId: UUID, confirmSlug: 'meu-canal' }),
    adminDid: () => log.rpcs.includes('youtube_channel_remove'),
  },
  {
    name: 'updateYouTubeChannelIdentity',
    run: () => channels.updateYouTubeChannelIdentity({ channel_id: UUID, locale: 'pt', niche: null }),
    adminDid: () => log.writes.some((w) => w.table === 'youtube_channels' && w.op === 'update'),
  },
  {
    name: 'setOwnChannelNiche',
    run: () => niches.setOwnChannelNiche(UUID, null),
    adminDid: () => log.writes.some((w) => w.table === 'youtube_channels' && w.op === 'update'),
  },
  {
    name: 'removeCompetitorChannel',
    run: () => competitors.removeCompetitorChannel(UUID),
    adminDid: () => log.writes.some((w) => w.table === 'competitor_channels' && w.op === 'delete'),
  },
]

function arrange(who: SessionWho) {
  sess.who = who
  sess.rpcCalls.length = 0
  cache.invalidated = 0
  resetServiceLog(log, { id: UUID, site_id: 'site-1' })
  log.rpcData = { status: 'removed', impact: {} }
}

describe('degrau "administrar o site" — canais', () => {
  beforeEach(() => vi.clearAllMocks())

  describe.each(RESTRICTED)('$name', (c) => {
    it('(a) editora: negado em português; service client NEM é criado; nada apagado', async () => {
      arrange('editor')
      const res = await c.run()
      expect(isRefusal(res)).toBe(true)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.clients).toBe(0)
      expect(hadEffect(log)).toBe(false)
      expect(cache.invalidated).toBe(0)
    })

    it('(b) org_admin: passa do guarda e faz a operação', async () => {
      arrange('admin')
      const res = await c.run()
      expect(isRefusal(res)).toBe(false)
      expect(c.adminDid()).toBe(true)
      if (c.name === 'removeCompetitorChannel') expect(cache.invalidated).toBe(1)
    })

    it('(c) erro da RPC de permissão e sessão sem usuário: negado, nada tocado', async () => {
      for (const who of ['rpc_error', 'anon'] as const) {
        arrange(who)
        const res = await c.run()
        expect(isRefusal(res)).toBe(true)
        expect(log.clients).toBe(0)
        expect(hadEffect(log)).toBe(false)
      }
    })
  })

  it('editora continua podendo: nicho de canal CONCORRENTE e fixar/desafixar vídeo (não perguntam pelo degrau)', async () => {
    arrange('editor')
    expect((await niches.setChannelNiche(UUID, null)).ok).toBe(true)
    expect(log.writes).toEqual([{ table: 'competitor_channels', op: 'update' }])
    await competitors.pinVideo(UUID)
    await competitors.unpinVideo(UUID)
    expect(sess.rpcCalls).toEqual([])
  })
})
