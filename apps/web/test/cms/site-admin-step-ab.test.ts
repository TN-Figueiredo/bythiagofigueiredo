// Degrau "administrar o site" — teste A/B. Deixar uma variante no ar, forçar rotação ou reverter
// vencedor troca título/thumbnail no canal de verdade: só quem administra.
//   (a) editora → negado, service client nem é criado, YouTube não é chamado;
//   (b) org_admin → passa do guarda (os caminhos felizes completos estão em
//       test/ab-p3-actions, test/ab-force-rotate, test/youtube/ab-p4a-chamadores e test/youtube/ab-settle);
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

  describe('endAbTest — só deixar uma VARIANTE no ar é do degrau', () => {
    // A linha devolvida por toda leitura serve de variante original: id 'v-orig'.
    const linha = { id: 'v-orig', status: 'active', site_id: 'site-1', youtube_video_id: 'vid-1', is_original: true }
    const variante = { destino: 'variante', varianteId: 'v-b' } as const

    it('(a) editora + variante que NÃO é a original: negado, nada escrito, YouTube não é chamado', async () => {
      arrange('editor', linha)
      const res = await ab.endAbTest('test-1', variante)
      expect(isRefusal(res)).toBe(true)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.writes).toEqual([])
      expect(log.rpcs).toEqual([])
      expect(yt.calls).toEqual([])
    })

    it('(c) erro da RPC e sessão sem usuário + variante não-original: negado, nada escrito', async () => {
      for (const who of ['rpc_error', 'anon'] as const) {
        arrange(who, linha)
        const res = await ab.endAbTest('test-1', variante)
        // anon cai antes, na sessão ('unauthenticated'); rpc_error cai no degrau, com a frase da variante.
        if (who === 'anon') expect(res).toMatchObject({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' })
        else expect(isRefusal(res)).toBe(true)
        expect(log.writes).toEqual([])
        expect(log.rpcs).toEqual([])
        expect(yt.calls).toEqual([])
      }
    })

    it('(b) org_admin + variante não-original: passa do guarda e chega ao banco', async () => {
      arrange('admin', linha)
      const res = await ab.endAbTest('test-1', variante)
      expect(isRefusal(res)).toBe(false)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.clients).toBeGreaterThan(0)
    })

    it('editora continua podendo encerrar voltando ao ORIGINAL (destino original ou o id da original): nem pergunta pelo degrau', async () => {
      arrange('editor', linha)
      expect(isRefusal(await ab.endAbTest('test-1', { destino: 'variante', varianteId: 'v-orig' }))).toBe(false)
      expect(sess.rpcCalls).toEqual([])

      arrange('editor', linha)
      expect(isRefusal(await ab.endAbTest('test-1', { destino: 'original' }))).toBe(false)
      expect(sess.rpcCalls).toEqual([])
      expect(log.clients).toBeGreaterThan(0)
    })
  })

  it('editora continua podendo pausar e retomar (não são do degrau: nem perguntam)', async () => {
    arrange('editor', { id: 'test-1', status: 'active', site_id: 'site-1' })
    expect(isRefusal(await ab.pauseAbTest('test-1'))).toBe(false)
    expect(isRefusal(await ab.resumeAbTest('test-1'))).toBe(false)
    expect(sess.rpcCalls).toEqual([])
  })
})
