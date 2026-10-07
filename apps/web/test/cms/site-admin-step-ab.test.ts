// Degrau "administrar o site" — teste A/B. Aplicar, forçar ou reverter vencedor
// troca título/thumbnail no canal de verdade: só quem administra.
//   (a) editora → negado, service client nem é criado, YouTube não é chamado;
//   (b) org_admin → passa do guarda (os caminhos felizes completos estão em
//       test/ab-p3-actions, test/ab-force-rotate e test/ab-actions-end);
//   (c) erro da RPC de permissão → negado.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionWho, ServiceLog } from '../helpers/site-admin-session'

const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
const log = vi.hoisted(() => ({ clients: 0, writes: [], reads: [], rpcs: [], row: {}, rpcData: { ok: true } }) as ServiceLog)
const yt = vi.hoisted(() => ({ calls: [] as string[] }))

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
vi.mock('@/lib/youtube/ab-preflight', () => ({
  preflightTokenCheck: async () => { yt.calls.push('preflight'); return { ok: true, accessToken: 't' } },
}))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: async () => { yt.calls.push('setThumbnail'); return { highUrl: 'https://i.ytimg.com/x.jpg' } },
  fetchVariantImageBuffer: async () => ({ buffer: Buffer.from('x'), contentType: 'image/png' }),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: async () => { yt.calls.push('updateVideoMetadata') } }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn(() => ({ title: 't', description: 'd' })) }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn(() => 0) }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: async () => ({ accessToken: 't' }) }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/youtube/channel-account', () => ({
  channelAccountIdForVideo: async () => 'acc-1',
  CHANNEL_NOT_IDENTIFIED_MESSAGE: 'canal não identificado',
}))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as ab from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { resetServiceLog, hadEffect } from '../helpers/site-admin-session'

type Res = { ok: boolean; error?: string }
const isRefusal = (r: Res) => r.ok === false && /^Só quem administra o site pode /.test(r.error ?? '')

const ALWAYS: Array<{ name: string; run: () => Promise<Res> }> = [
  { name: 'forceRotate', run: () => ab.forceRotate('test-1') },
  { name: 'applyWinnerNow', run: () => ab.applyWinnerNow('test-1') },
  { name: 'revertWinner', run: () => ab.revertWinner('test-1') },
]

function arrange(who: SessionWho, row: Record<string, unknown> = {}) {
  sess.who = who
  sess.rpcCalls.length = 0
  yt.calls.length = 0
  resetServiceLog(log, row)
}

describe('degrau "administrar o site" — teste A/B', () => {
  beforeEach(() => vi.clearAllMocks())

  describe.each(ALWAYS)('$name', (c) => {
    it('(a) editora: negado em português; service client NEM é criado; YouTube não é chamado', async () => {
      arrange('editor')
      const res = await c.run()
      expect(isRefusal(res)).toBe(true)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.clients).toBe(0)
      expect(hadEffect(log)).toBe(false)
      expect(yt.calls).toEqual([])
    })

    it('(b) org_admin: passa do guarda e chega ao banco', async () => {
      arrange('admin', { id: 'test-1', status: 'active', site_id: 'site-1', variants: [] })
      const res = await c.run()
      expect(isRefusal(res)).toBe(false)
      expect(log.clients).toBeGreaterThan(0)
    })

    it('(c) erro da RPC de permissão e sessão sem usuário: negado, nada tocado', async () => {
      for (const who of ['rpc_error', 'anon'] as const) {
        arrange(who)
        const res = await c.run()
        expect(isRefusal(res)).toBe(true)
        expect(log.clients).toBe(0)
        expect(yt.calls).toEqual([])
      }
    })
  })

  describe('endAbTest — só aplicar uma variante VENCEDORA é do degrau', () => {
    const active = { id: 'v-b', status: 'active', site_id: 'site-1', youtube_video_id: 'vid-1', youtube_channel_id: 'ch-1', channel_account_id: 'acc-1', blob_url: 'https://blob.test/b.png', label: 'B' }

    it('(a) editora + vencedor que NÃO é o original: negado, nada escrito, thumbnail não muda', async () => {
      arrange('editor', { ...active, is_original: false })
      const res = await ab.endAbTest('test-1', 'v-b')
      expect(isRefusal(res)).toBe(true)
      expect(log.writes).toEqual([])
      expect(yt.calls).toEqual([])
    })

    it('(c) erro da RPC + vencedor não-original: negado, nada escrito', async () => {
      arrange('rpc_error', { ...active, is_original: false })
      const res = await ab.endAbTest('test-1', 'v-b')
      expect(isRefusal(res)).toBe(true)
      expect(log.writes).toEqual([])
      expect(yt.calls).toEqual([])
    })

    it('(b) org_admin + vencedor não-original: aplica e encerra', async () => {
      arrange('admin', { ...active, is_original: false })
      const res = await ab.endAbTest('test-1', 'v-b')
      expect(isRefusal(res)).toBe(false)
      expect(log.writes.some((w) => w.table === 'ab_tests' && w.op === 'update')).toBe(true)
    })

    it('editora continua podendo encerrar restaurando o ORIGINAL (com ou sem winnerId)', async () => {
      arrange('editor', { ...active, is_original: true })
      expect(isRefusal(await ab.endAbTest('test-1', 'v-b'))).toBe(false)
      expect(log.writes.some((w) => w.table === 'ab_tests' && w.op === 'update')).toBe(true)

      arrange('editor', { ...active, is_original: true })
      expect(isRefusal(await ab.endAbTest('test-1'))).toBe(false)
      expect(sess.rpcCalls).toEqual([]) // sem vencedor nem pergunta pelo degrau
    })
  })

  it('editora continua podendo pausar e retomar (não são do degrau: nem perguntam)', async () => {
    arrange('editor', { id: 'test-1', status: 'active', site_id: 'site-1' })
    expect(isRefusal(await ab.pauseAbTest('test-1'))).toBe(false)
    expect(isRefusal(await ab.resumeAbTest('test-1'))).toBe(false)
    expect(isRefusal(await ab.cancelGracePeriod('test-1'))).toBe(false)
    expect(sess.rpcCalls).toEqual([])
  })
})
