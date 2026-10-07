// @vitest-environment node
// Degrau "administrar o site" — sincronizações caras em cota. "Histórico completo",
// "Sincronizar concorrentes" (todos de uma vez) e "Sincronizar tudo" (todos os canais
// próprios): só quem administra. Um canal por vez continua com a editora.
//   (a) editora → negado, service client nem é criado, YouTube não é chamado;
//   (b) org_admin → continua funcionando;
//   (c) erro da RPC de permissão → negado.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionWho, ServiceLog } from '../helpers/site-admin-session'

const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
const log = vi.hoisted(() => ({ clients: 0, writes: [], reads: [], rpcs: [], row: {}, rpcData: { ok: true } }) as ServiceLog)
const ext = vi.hoisted(() => ({ channelSyncs: [] as string[], loads: 0, fetches: [] as string[] }))

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
vi.mock('@/lib/youtube/competitor-sync', () => ({
  syncCompetitorChannel: async (ch: { id: string }) => {
    ext.channelSyncs.push(ch.id)
    return { videosChecked: 3, changesDetected: 0, skipped: false }
  },
}))
vi.mock('@/lib/youtube/observatorio/load', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/observatorio/load')>()),
  loadRows: async () => { ext.loads++; throw new Error('loadRows não deveria rodar neste teste') },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import * as competitors from '@/app/cms/(authed)/youtube/competitors/actions'
import { triggerSync } from '@/app/cms/(authed)/youtube/videos/actions'
import { resetServiceLog, hadEffect } from '../helpers/site-admin-session'

const UUID = '11111111-1111-4111-8111-111111111111'
const saved: Record<string, string | undefined> = {}

function arrange(who: SessionWho) {
  sess.who = who
  sess.rpcCalls.length = 0
  ext.channelSyncs.length = 0
  ext.loads = 0
  ext.fetches.length = 0
  resetServiceLog(log, { id: UUID, channel_id: 'UCxxxxxxxx', site_id: 'site-1' })
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of ['YOUTUBE_API_KEY', 'CRON_SECRET', 'NEXT_PUBLIC_APP_URL']) saved[k] = process.env[k]
  process.env.YOUTUBE_API_KEY = 'fake-key'
  process.env.CRON_SECRET = 'fake-cron'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3997'
  vi.stubGlobal('fetch', vi.fn(async (url: URL | string) => {
    ext.fetches.push(String(url))
    return new Response(JSON.stringify({ ok: true, channels: [] }), { status: 200 })
  }))
})
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.unstubAllGlobals()
})

const refusalText = (r: { error?: string; text?: string }) => r.error ?? r.text ?? ''
const touchedNothing = () => log.clients === 0 && !hadEffect(log) && ext.channelSyncs.length === 0 && ext.loads === 0 && ext.fetches.length === 0

describe('degrau "administrar o site" — sincronizações caras em cota', () => {
  const RESTRICTED = [
    { name: 'syncFullHistory (histórico completo)', run: () => competitors.syncFullHistory(UUID) },
    { name: 'syncCompetitorsNow ("Sincronizar concorrentes")', run: () => competitors.syncCompetitorsNow() },
    { name: 'triggerSync() sem canal ("Sincronizar tudo")', run: () => triggerSync() },
  ]

  describe.each(RESTRICTED)('$name', (c) => {
    it('(a) editora: negado em português; service client NEM é criado; nenhuma chamada ao YouTube/cron', async () => {
      arrange('editor')
      const res = await c.run()
      expect(res.ok).toBe(false)
      expect(refusalText(res)).toMatch(/^Só quem administra o site pode /)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(touchedNothing()).toBe(true)
    })

    it('(c) erro da RPC de permissão e sessão sem usuário: negado, nada tocado', async () => {
      for (const who of ['rpc_error', 'anon'] as const) {
        arrange(who)
        const res = await c.run()
        expect(res.ok).toBe(false)
        expect(refusalText(res)).toMatch(/^Só quem administra o site pode /)
        expect(touchedNothing()).toBe(true)
      }
    })
  })

  it('(b) org_admin: histórico completo roda o sync do canal', async () => {
    arrange('admin')
    log.count = 0 // nenhum outro canal sincronizando agora
    expect(await competitors.syncFullHistory(UUID)).toEqual({ ok: true })
    expect(ext.channelSyncs).toEqual([UUID])
    expect(log.writes).toContainEqual({ table: 'competitor_channels', op: 'update' })
  })

  it('(b) org_admin: "Sincronizar concorrentes" passa do guarda e vai ler os canais', async () => {
    arrange('admin')
    // loadRows está trocado por um que lança: chegar nele prova que o guarda deixou o admin passar.
    await expect(competitors.syncCompetitorsNow()).rejects.toThrow('loadRows não deveria rodar neste teste')
    expect(ext.loads).toBe(1)
  })

  it('(b) org_admin: "Sincronizar tudo" chama o sync dos canais próprios', async () => {
    arrange('admin')
    expect(await triggerSync()).toEqual({ ok: true })
    expect(ext.fetches).toHaveLength(1)
    expect(ext.fetches[0]).toContain('/api/cron/sync-youtube')
    expect(ext.fetches[0]).not.toContain('channelId=')
  })

  describe('sincronização normal: a editora continua podendo, um canal por vez', () => {
    it('um concorrente (syncCompetitorNow): funciona e nem pergunta pelo degrau', async () => {
      arrange('editor')
      const res = await competitors.syncCompetitorNow(UUID)
      expect(res.ok).toBe(true)
      expect(ext.channelSyncs).toEqual([UUID])
      expect(sess.rpcCalls).toEqual([])
    })

    it('um canal próprio (triggerSync(channelId)): funciona e nem pergunta pelo degrau', async () => {
      arrange('editor')
      // outro id a cada execução: a action guarda um cooldown por canal em memória
      const res = await triggerSync('22222222-2222-4222-8222-222222222222')
      expect(res).toEqual({ ok: true })
      expect(ext.fetches[0]).toContain('channelId=22222222-2222-4222-8222-222222222222')
      expect(sess.rpcCalls).toEqual([])
    })
  })
})
