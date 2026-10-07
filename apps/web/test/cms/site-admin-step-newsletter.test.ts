// Degrau "administrar o site" — newsletter. Para CADA action restrita:
//   (a) editora → negado e nenhum efeito (o service client nem é criado);
//   (b) org_admin → continua funcionando;
//   (c) erro da RPC de permissão → negado (falha fechado).
// O guarda real (`requireSiteAdminScope`) roda; só a resposta do banco é trocada.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionWho } from '../helpers/site-admin-session'

const sess = vi.hoisted(() => ({ who: 'admin' as SessionWho, rpcCalls: [] as string[] }))
const db = vi.hoisted(() => ({
  serviceClients: 0,
  writes: [] as Array<{ table: string; op: string }>,
  rpcs: [] as string[],
  row: {} as Record<string, unknown>,
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', async () => {
  const { fakeSessionClient, SESSION_USER_ID } = await import('../helpers/site-admin-session')
  return {
    createServerClient: () => fakeSessionClient(sess),
    // Editar: a editora PODE (é o guarda antigo). Só o degrau novo a barra.
    requireSiteScope: async () =>
      sess.who === 'anon' ? { ok: false, reason: 'unauthenticated' } : { ok: true, user: { id: SESSION_USER_ID } },
  }
})
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: async () => ({ siteId: 'site-1', orgId: 'org-1', defaultLocale: 'pt-BR', timezone: 'America/Sao_Paulo' }),
}))
vi.mock('@/lib/email/service', () => ({ getEmailService: () => ({ send: vi.fn() }) }))
vi.mock('@/lib/seo/cache-invalidation', () => ({ revalidateNewsletterTypeSeo: vi.fn() }))
vi.mock('@/lib/media/track-usage', () => ({ trackMediaUsage: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => {
    db.serviceClients++
    const chain = (table: string) => {
      let single = false
      const q: Record<string, unknown> = {}
      const self = () => q
      for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'limit', 'order', 'is']) q[m] = self
      for (const op of ['update', 'delete', 'insert', 'upsert']) {
        q[op] = () => {
          db.writes.push({ table, op })
          return q
        }
      }
      q.single = () => { single = true; return q }
      q.maybeSingle = q.single
      q.then = (ok: (v: unknown) => unknown) =>
        Promise.resolve(single ? { data: db.row, error: null } : { data: [db.row], error: null, count: 7 }).then(ok)
      return q
    }
    return {
      from: (table: string) => chain(table),
      rpc: async (name: string) => {
        db.rpcs.push(name)
        return { data: { ok: true }, error: null }
      },
      storage: { from: () => ({ list: async () => ({ data: [] }), remove: async () => ({}) }) },
    }
  },
}))

import * as actions from '@/app/cms/(authed)/newsletters/actions'

const FUTURE = new Date(Date.now() + 3 * 864e5).toISOString()
const SLOT = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
const baseRow = { id: 'ed-1', site_id: 'site-1', newsletter_type_id: 'type-1', name: 'Tipo', slug: 'tipo', preferred_send_time: '09:00:00', timezone: 'America/Sao_Paulo', retry_count: 0, max_retries: 3 }

type Result = { ok: boolean; error?: string }
interface Case { name: string; status: string; run: () => Promise<Result>; effect: () => boolean }
const wrote = () => db.writes.some((w) => w.op === 'update' || w.op === 'delete')

/** Sempre restritas: nem chegam a criar o service client quando negadas. */
const ALWAYS: Case[] = [
  { name: 'sendNow', status: 'ready', run: () => actions.sendNow('ed-1'), effect: wrote },
  { name: 'scheduleEdition', status: 'ready', run: () => actions.scheduleEdition('ed-1', FUTURE), effect: wrote },
  { name: 'scheduleEditionToSlot', status: 'ready', run: () => actions.scheduleEditionToSlot('ed-1', SLOT, 'type-1'), effect: wrote },
  { name: 'swapSlotEdition', status: 'ready', run: () => actions.swapSlotEdition('ed-1', SLOT, 'type-1'), effect: () => db.rpcs.includes('swap_slot_edition') },
  { name: 'scheduleEditionAsSpecial', status: 'ready', run: () => actions.scheduleEditionAsSpecial('ed-1', FUTURE), effect: wrote },
  { name: 'retryEdition', status: 'failed', run: () => actions.retryEdition('ed-1'), effect: wrote },
  { name: 'deleteNewsletterType', status: 'ready', run: () => actions.deleteNewsletterType('type-1', { confirmed: true, confirmText: 'Tipo' }), effect: wrote },
  { name: 'moveEdition → scheduled', status: 'ready', run: () => actions.moveEdition('ed-1', 'scheduled', FUTURE), effect: wrote },
]

/** Restritas conforme o status lido: o service client lê, mas nada é escrito. */
const BY_STATUS: Case[] = [
  { name: 'cancelEdition (agendada)', status: 'scheduled', run: () => actions.cancelEdition('ed-1'), effect: wrote },
  { name: 'moveEdition (tirar de agendada)', status: 'scheduled', run: () => actions.moveEdition('ed-1', 'draft'), effect: wrote },
  { name: 'deleteEdition (agendada)', status: 'scheduled', run: () => actions.deleteEdition('ed-1', { confirmed: true }), effect: wrote },
  { name: 'deleteEdition (enviada)', status: 'sent', run: () => actions.deleteEdition('ed-1', { confirmed: true, confirmText: 'DELETE' }), effect: wrote },
]

/** O que a editora CONTINUA podendo (decisão 2: redigir, editar, descartar rascunho). */
const STILL_ALLOWED: Case[] = [
  { name: 'cancelEdition (rascunho)', status: 'draft', run: () => actions.cancelEdition('ed-1'), effect: wrote },
  { name: 'moveEdition draft → ready', status: 'draft', run: () => actions.moveEdition('ed-1', 'ready'), effect: wrote },
  { name: 'deleteEdition (rascunho)', status: 'draft', run: () => actions.deleteEdition('ed-1', { confirmed: true }), effect: wrote },
  { name: 'saveEdition', status: 'draft', run: () => actions.saveEdition('ed-1', { subject: 'novo' }), effect: wrote },
  { name: 'assignToSlot', status: 'ready', run: () => actions.assignToSlot('ed-1', SLOT), effect: wrote },
]

function arrange(who: SessionWho, status: string) {
  sess.who = who
  sess.rpcCalls.length = 0
  db.serviceClients = 0
  db.writes.length = 0
  db.rpcs.length = 0
  db.row = { ...baseRow, status }
}

describe('degrau "administrar o site" — newsletter', () => {
  beforeEach(() => vi.clearAllMocks())

  describe.each(ALWAYS)('$name', (c) => {
    it('(a) editora: negado, frase em português, service client NEM é criado', async () => {
      arrange('editor', c.status)
      const res = await c.run()
      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/^Só quem administra o site pode /)
      expect(sess.rpcCalls).toContain('can_admin_site_users')
      expect(db.serviceClients).toBe(0)
      expect(c.effect()).toBe(false)
    })

    it('(b) org_admin: continua funcionando', async () => {
      arrange('admin', c.status)
      const res = await c.run()
      expect(res).toMatchObject({ ok: true })
      expect(c.effect()).toBe(true)
    })

    it('(c) erro da RPC de permissão (e sessão sem usuário): negado, nenhum efeito', async () => {
      for (const who of ['rpc_error', 'anon'] as const) {
        arrange(who, c.status)
        const res = await c.run()
        expect(res.ok).toBe(false)
        expect(res.error).toMatch(/^Só quem administra o site pode /)
        expect(db.serviceClients).toBe(0)
        expect(c.effect()).toBe(false)
      }
    })
  })

  describe.each(BY_STATUS)('$name', (c) => {
    it('(a) editora: negado e NADA é escrito', async () => {
      arrange('editor', c.status)
      const res = await c.run()
      expect(res.ok).toBe(false)
      expect(res.error).toMatch(/^Só quem administra o site pode /)
      expect(c.effect()).toBe(false)
    })

    it('(b) org_admin: continua funcionando', async () => {
      arrange('admin', c.status)
      expect(await c.run()).toMatchObject({ ok: true })
      expect(c.effect()).toBe(true)
    })

    it('(c) erro da RPC de permissão: negado e nada é escrito', async () => {
      arrange('rpc_error', c.status)
      const res = await c.run()
      expect(res.ok).toBe(false)
      expect(c.effect()).toBe(false)
    })
  })

  describe.each(STILL_ALLOWED)('editora continua podendo: $name', (c) => {
    it('editora: funciona', async () => {
      arrange('editor', c.status)
      expect(await c.run()).toMatchObject({ ok: true })
      expect(c.effect()).toBe(true)
    })
    it('nem o erro da RPC do degrau atrapalha o que não é restrito', async () => {
      arrange('rpc_error', c.status)
      expect(await c.run()).toMatchObject({ ok: true })
    })
  })
})
