// Degrau "administrar o site" — dados pessoais (assinantes, contatos, waitlist).
// Para CADA action restrita: (a) editora → negado, service client nem é criado;
// (b) org_admin → funciona; (c) erro da RPC de permissão → negado.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionWho, ServiceLog } from '../helpers/site-admin-session'

const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
const log = vi.hoisted(() => ({ clients: 0, writes: [], reads: [], rpcs: [], row: {}, rpcData: { ok: true } }) as ServiceLog)

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', async () => {
  const { fakeSessionClient, SESSION_USER_ID } = await import('../helpers/site-admin-session')
  return {
    createServerClient: () => fakeSessionClient(sess),
    // view/edit: a editora PASSA (guarda antigo). Só o degrau novo a barra.
    requireSiteScope: async () =>
      sess.who === 'anon' ? { ok: false, reason: 'unauthenticated' } : { ok: true, user: { id: SESSION_USER_ID } },
  }
})
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: async () => ({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo' }),
}))
vi.mock('@/lib/supabase/service', async () => {
  const { recordingServiceClient } = await import('../helpers/site-admin-session')
  return { getSupabaseServiceClient: () => recordingServiceClient(log) }
})
vi.mock('@/lib/email/service', () => ({ getEmailService: () => ({ send: vi.fn(async () => ({ messageId: 'm' })) }) }))
vi.mock('@/lib/email/sender', () => ({ getEmailSender: vi.fn(async () => ({ email: 'a@example.test', name: 'A' })) }))
vi.mock('@/lib/sentry-wrap', () => ({ captureServerActionError: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

import * as subscribers from '@/app/cms/(authed)/subscribers/actions'
import * as contacts from '@/app/cms/(authed)/contacts/actions'
import * as waitlists from '@/app/cms/(authed)/waitlists/actions'
import { resetServiceLog, hadEffect } from '../helpers/site-admin-session'

const UUID = '11111111-1111-4111-8111-111111111111'
const ROW = { id: UUID, email: 'pessoa@example.test', name: 'Pessoa', message: 'oi', status: 'confirmed', slug: 'lista', site_id: 'site-1', submitted_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }

type Res = { ok: boolean; error?: string; message?: string }
interface Case { name: string; run: () => Promise<Res>; /** o que prova que o admin passou */ adminTouched: () => boolean }

const RESTRICTED: Case[] = [
  { name: 'exportSubscribers', run: () => subscribers.exportSubscribers('csv'), adminTouched: () => log.reads.includes('newsletter_subscriptions') },
  { name: 'batchUnsubscribe', run: () => subscribers.batchUnsubscribe([UUID]), adminTouched: () => log.writes.some((w) => w.table === 'newsletter_subscriptions' && w.op === 'update') },
  { name: 'anonymizeSubmission', run: () => contacts.anonymizeSubmission(UUID), adminTouched: () => log.rpcs.includes('anonymize_contact_submission') },
  { name: 'bulkAnonymize', run: () => contacts.bulkAnonymize([UUID, UUID]), adminTouched: () => log.rpcs.filter((r) => r === 'anonymize_contact_submission').length === 2 },
  { name: 'exportContacts', run: () => contacts.exportContacts('all', 'all'), adminTouched: () => log.reads.includes('contact_submissions') },
  { name: 'exportWaitlistSignups', run: () => waitlists.exportWaitlistSignups(UUID), adminTouched: () => log.reads.includes('waitlist_signups') },
]

const refusal = (r: Res) => r.error?.startsWith('Só quem administra o site pode ') ? r.error : r.message

function arrange(who: SessionWho) {
  sess.who = who
  sess.rpcCalls.length = 0
  resetServiceLog(log, { ...ROW })
}

describe('degrau "administrar o site" — dados pessoais', () => {
  beforeEach(() => vi.clearAllMocks())

  describe.each(RESTRICTED)('$name', (c) => {
    it('(a) editora: negado em português, sem dado e sem efeito — o service client NEM é criado', async () => {
      arrange('editor')
      const res = await c.run()
      expect(res.ok).toBe(false)
      expect(refusal(res)).toMatch(/^Só quem administra o site pode /)
      expect(res).not.toHaveProperty('data')
      expect(res).not.toHaveProperty('csv')
      expect(sess.rpcCalls).toEqual(['can_admin_site_users'])
      expect(log.clients).toBe(0)
      expect(hadEffect(log)).toBe(false)
    })

    it('(b) org_admin: continua funcionando', async () => {
      arrange('admin')
      const res = await c.run()
      expect(res.ok).toBe(true)
      expect(c.adminTouched()).toBe(true)
    })

    it('(c) erro da RPC de permissão e sessão sem usuário: negado, nada tocado', async () => {
      for (const who of ['rpc_error', 'anon'] as const) {
        arrange(who)
        const res = await c.run()
        expect(res.ok).toBe(false)
        expect(refusal(res)).toMatch(/^Só quem administra o site pode /)
        expect(log.clients).toBe(0)
      }
    })
  })

  it('editora continua podendo o que não é do degrau: marcar contato como respondido e ligar/desligar consentimento', async () => {
    arrange('editor')
    expect((await contacts.markReplied(UUID)).ok).toBe(true)
    expect((await subscribers.toggleTrackingConsent(UUID, true)).ok).toBe(true)
    expect(sess.rpcCalls).toEqual([]) // nem pergunta pelo degrau
  })
})
