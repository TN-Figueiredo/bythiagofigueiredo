// @vitest-environment node
// Degrau "administrar o site" — integrações e zona de perigo. Conectar, desconectar,
// remover conta, trocar credencial (Instagram, redes sociais, YouTube via OAuth),
// desligar o CMS e apagar o site: só quem administra.
//   (a) editora → negado, service client nem é criado;
//   (b) org_admin → passa do guarda;
//   (c) erro da RPC de permissão → negado.
// O guarda real (`requireSiteAdminScope`) roda; só a resposta do banco é trocada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { SessionWho, ServiceLog } from '../helpers/site-admin-session'

const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
const log = vi.hoisted(() => ({ clients: 0, writes: [], reads: [], rpcs: [], row: {}, rpcData: { ok: true } }) as ServiceLog)
const jar = vi.hoisted(() => ({ cookies: new Map<string, string>() }))

const SITE = '22222222-2222-4222-8222-222222222222'
const UUID = '11111111-1111-4111-8111-111111111111'
const MASTER = 'a'.repeat(64)
const ORIGIN = 'https://cms.example.test'

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [],
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name) } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers({ 'x-nonce': 'n0nce' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', async () => {
  const { fakeSessionClient, SESSION_USER_ID } = await import('../helpers/site-admin-session')
  return {
    createServerClient: () => fakeSessionClient(sess),
    // editar/publicar: a editora PASSA (guarda antigo). Só o degrau novo a barra.
    requireSiteScope: async () =>
      sess.who === 'anon' ? { ok: false, reason: 'unauthenticated' } : { ok: true, user: { id: SESSION_USER_ID } },
  }
})
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: async () => ({ siteId: SITE, orgId: 'org-1', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo' }),
}))
vi.mock('@/lib/supabase/service', async () => {
  const { recordingServiceClient } = await import('../helpers/site-admin-session')
  return { getSupabaseServiceClient: () => recordingServiceClient(log) }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@tn-figueiredo/social/vault', () => ({ encrypt: () => 'enc', decrypt: () => 'dec', getMasterKey: () => Buffer.alloc(32) }))
vi.mock('@/lib/oauth/origin', () => ({
  assertSameOriginFetch: () => null,
  getSiteDomains: async () => ['cms.example.test'],
  resolveOAuthOrigin: () => ORIGIN,
}))
vi.mock('@/lib/oauth/consent', () => ({ recordSocialConsent: vi.fn() }))

import * as settings from '@/app/cms/(authed)/settings/actions'
import { connectSocial, disconnectSocial } from '@/lib/social/actions/connections'
import { GET as igStart } from '@/app/api/instagram/oauth/route'
import { GET as igCallback } from '@/app/api/instagram/oauth/callback/route'
import { GET as socialStart } from '@/app/api/social/oauth/[provider]/route'
import { GET as socialCallback } from '@/app/api/social/oauth/[provider]/callback/route'
import { resetServiceLog, hadEffect, SESSION_USER_ID } from '../helpers/site-admin-session'
import {
  INSTAGRAM_STATE_LABEL, SOCIAL_STATE_LABEL, STATE_TTL_SECONDS, deriveHmacKey, signState,
} from '@/lib/oauth/state'

type Res = { ok: boolean; error?: string }
const isRefusal = (r: Res) => r.ok === false && /^Só quem administra o site pode /.test(r.error ?? '')

const ENV_KEYS = ['SOCIAL_MASTER_KEY', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'NEXT_PUBLIC_APP_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const
const savedEnv: Record<string, string | undefined> = {}

function arrange(who: SessionWho) {
  sess.who = who
  sess.rpcCalls.length = 0
  jar.cookies.clear()
  resetServiceLog(log, { id: UUID, site_id: SITE, slug: 'meu-site', locale: 'pt', handle: 'conta' })
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k]
  process.env.SOCIAL_MASTER_KEY = MASTER
  process.env.INSTAGRAM_APP_ID = 'ig-app'
  process.env.INSTAGRAM_APP_SECRET = 'ig-secret'
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  vi.unstubAllGlobals()
})

interface Case { name: string; run: () => Promise<Res> }
const ACTIONS: Case[] = [
  { name: 'addInstagramAccount', run: () => settings.addInstagramAccount({ handle: 'conta', locale: 'pt' }) },
  { name: 'removeInstagramAccount', run: () => settings.removeInstagramAccount({ accountId: UUID }) },
  { name: 'setInstagramToken', run: () => settings.setInstagramToken({ accountId: UUID, accessToken: 'IGQ' + 'x'.repeat(60) }) },
  { name: 'disconnectInstagramAccount', run: () => settings.disconnectInstagramAccount({ accountId: UUID }) },
  { name: 'authorizeInstagramRebind', run: () => settings.authorizeInstagramRebind({ accountId: UUID }) },
  { name: 'disableCms', run: () => settings.disableCms() },
  { name: 'deleteSite', run: () => settings.deleteSite('meu-site') },
  { name: 'deleteNewsletterType (settings)', run: () => settings.deleteNewsletterType(UUID) },
  {
    name: 'connectSocial',
    run: () => connectSocial('bluesky', { accessToken: 'tok', accountId: 'did:plc:x', accountName: 'conta', scopes: [] }),
  },
  { name: 'disconnectSocial', run: () => disconnectSocial(UUID) },
]

describe('degrau "administrar o site" — integrações e zona de perigo (actions)', () => {
  describe.each(ACTIONS)('$name', (c) => {
    it('(a) editora: negado em português; service client NEM é criado; nada escrito', async () => {
      arrange('editor')
      const res = await c.run()
      expect(isRefusal(res)).toBe(true)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.clients).toBe(0)
      expect(hadEffect(log)).toBe(false)
    })

    it('(b) org_admin: passa do guarda (não recebe a recusa do degrau)', async () => {
      arrange('admin')
      const res = await c.run()
      expect(isRefusal(res)).toBe(false)
      expect(sess.rpcCalls).toContain('can_admin_site_users')
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

  it('org_admin de fato escreve: desconectar rede social revoga a conexão; apagar o site apaga', async () => {
    arrange('admin')
    expect((await disconnectSocial(UUID)).ok).toBe(true)
    expect(log.writes).toEqual([{ table: 'social_connections', op: 'update' }])
    arrange('admin')
    expect((await settings.deleteSite('meu-site')).ok).toBe(true)
    expect(log.writes).toEqual([{ table: 'sites', op: 'delete' }])
  })

  it('editora continua podendo o que não é do degrau em /cms/settings (ex.: slots e ajustes do Instagram não perguntam por ele)', async () => {
    arrange('editor')
    await settings.dismissInstagramHandleMismatch()
    await settings.updateInstagramSettings({ accountId: UUID, sync_enabled: true })
    expect(sess.rpcCalls).toEqual([])
  })
})

describe('degrau "administrar o site" — rotas de OAuth (sessão de usuário, não máquina)', () => {
  const igStartReq = () => new NextRequest(`${ORIGIN}/api/instagram/oauth?account_id=${UUID}`)
  const socialStartReq = () => new NextRequest(`${ORIGIN}/api/social/oauth/google`)
  const socialParams = { params: Promise.resolve({ provider: 'google' }) }

  function socialCallbackReq() {
    const state = signState(
      { typ: 'state', siteId: SITE, userId: SESSION_USER_ID, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS },
      deriveHmacKey(MASTER, SOCIAL_STATE_LABEL),
    )
    return new NextRequest(`${ORIGIN}/api/social/oauth/google/callback?code=c0de&state=${encodeURIComponent(state)}`)
  }
  function igCallbackReq() {
    jar.cookies.set('ig_oauth_nonce', 'nonce-1')
    const state = signState(
      {
        typ: 'state', siteId: SITE, userId: SESSION_USER_ID, accountId: UUID, origin: ORIGIN, nonce: 'nonce-1',
        exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
      },
      deriveHmacKey(MASTER, INSTAGRAM_STATE_LABEL),
    )
    return new NextRequest(`${ORIGIN}/api/instagram/oauth/callback?code=c0de&state=${encodeURIComponent(state)}`)
  }

  const ROUTES: Array<{ name: string; call: () => Promise<Response>; needle: string }> = [
    { name: 'GET /api/instagram/oauth (início)', call: () => igStart(igStartReq()), needle: 'Só quem administra o site pode conectar ou trocar a conta do Instagram.' },
    { name: 'GET /api/instagram/oauth/callback', call: () => igCallback(igCallbackReq()), needle: 'Só quem administra o site pode conectar ou trocar a conta do Instagram.' },
    { name: 'GET /api/social/oauth/[provider] (início)', call: () => socialStart(socialStartReq(), socialParams), needle: 'Só quem administra o site pode conectar uma conta de rede social.' },
    { name: 'GET /api/social/oauth/[provider]/callback', call: () => socialCallback(socialCallbackReq(), socialParams), needle: 'Só quem administra o site pode conectar uma conta de rede social.' },
  ]

  describe.each(ROUTES)('$name', (r) => {
    it('(a) editora: 403 com a frase; service client NEM é criado; nenhuma chamada externa', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      arrange('editor')
      const res = await r.call()
      expect(res.status).toBe(403)
      expect(await res.text()).toContain(r.needle)
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.clients).toBe(0)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('(c) erro da RPC de permissão: 403, nada tocado, nenhuma chamada externa', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      arrange('rpc_error')
      const res = await r.call()
      expect(res.status).toBe(403)
      expect(log.clients).toBe(0)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('(b) org_admin: passa do guarda (não recebe 403 do degrau)', async () => {
      // Depois do guarda a rota fala com Meta/Google: aqui a troca "falha" de propósito.
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
      arrange('admin')
      const res = await r.call()
      const body = await res.text().catch(() => '')
      expect(body).not.toContain('Só quem administra o site')
      expect(body).not.toContain('site_admin_required')
      expect(res.status).not.toBe(403)
    })

    it('sem sessão: 401, nunca a frase do degrau', async () => {
      vi.stubGlobal('fetch', vi.fn())
      arrange('anon')
      const res = await r.call()
      expect(res.status).toBe(401)
      expect(log.clients).toBe(0)
    })
  })
})
