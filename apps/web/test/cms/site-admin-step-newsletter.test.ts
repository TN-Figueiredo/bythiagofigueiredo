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
  writes: [] as Array<{ table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }>,
  rpcs: [] as string[],
  row: {} as Record<string, unknown>,
  /** Quando true, toda escrita devolve 0 linhas (outra aba mudou o estado no meio). */
  writesAffectNothing: false,
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
      let write: { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> } | null = null
      const q: Record<string, unknown> = {}
      const self = () => q
      for (const m of ['select', 'neq', 'in', 'gte', 'lte', 'limit', 'order', 'is']) q[m] = self
      q.eq = (col: string, val: unknown) => {
        write?.filters.push([col, val])
        return q
      }
      for (const op of ['update', 'delete', 'insert', 'upsert']) {
        q[op] = (payload?: unknown) => {
          write = { table, op, payload, filters: [] }
          db.writes.push(write)
          return q
        }
      }
      q.single = () => { single = true; return q }
      q.maybeSingle = q.single
      q.then = (ok: (v: unknown) => unknown) => {
        const rows = write && db.writesAffectNothing ? [] : [db.row]
        return Promise.resolve(single ? { data: db.row, error: null } : { data: rows, error: null, count: 7 }).then(ok)
      }
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
  db.writesAffectNothing = false
  db.row = { ...baseRow, status }
}

const SCHEDULED_EDIT = 'Esta edição já está agendada; só quem administra o site pode alterá-la.'
/** Chamada como um cliente forjado faria: o TypeScript não segura um POST de server action. */
const saveRaw = (patch: Record<string, unknown>) =>
  actions.saveEdition('ed-1', patch as Parameters<typeof actions.saveEdition>[1])
const updates = () => db.writes.filter((w) => w.op === 'update')
const lastWrite = (op: string) => db.writes.filter((w) => w.op === op).at(-1)

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

  // saveEdition gravava o patch inteiro por spread: `{ status: 'scheduled', scheduled_at }`
  // disparava a newsletter pelo cron sem passar por `scheduleEdition`.
  describe('saveEdition só grava campos de conteúdo', () => {
    const FORGED: Array<[string, Record<string, unknown>]> = [
      ['status + scheduled_at (dispara pelo cron)', { status: 'scheduled', scheduled_at: new Date().toISOString() }],
      ['status cancelled (cancela um envio)', { status: 'cancelled' }],
      ['site_id (move a edição de site)', { site_id: 'site-2' }],
      ['id', { id: 'ed-2' }],
      ['sent_at', { sent_at: new Date().toISOString() }],
      ['contador', { stats_opens: 999 }],
      ['chave proibida junto de uma válida', { subject: 'ok', slot_date: SLOT }],
    ]

    describe.each(FORGED)('%s', (_name, patch) => {
      it.each(['editor', 'admin'] as const)('%s: recusa a chamada inteira, sem tocar no banco', async (who) => {
        arrange(who, 'draft')
        const res = await saveRaw(patch)
        expect(res.ok).toBe(false)
        expect(res).toHaveProperty('error', expect.stringMatching(/^Campo não aceito ao salvar a edição: /))
        expect(db.serviceClients).toBe(0)
        expect(db.writes).toEqual([])
      })
    })

    it('editora em rascunho: os campos que o editor envia passam, e só eles vão para o banco', async () => {
      arrange('editor', 'draft')
      const res = await saveRaw({
        subject: 'novo', preheader: 'p', content_json: '{"type":"doc"}', content_html: '<p>x</p>',
        notes: 'n', segment: 'all', newsletter_type_id: 'type-1',
      })
      expect(res).toMatchObject({ ok: true })
      expect(updates()).toHaveLength(1)
      const payload = updates()[0]!.payload as Record<string, unknown>
      expect(Object.keys(payload).sort()).toEqual(
        ['content_html', 'content_json', 'newsletter_type_id', 'notes', 'preheader', 'segment', 'subject', 'updated_at'],
      )
      expect(payload.content_json).toEqual({ type: 'doc' })
    })

    it('content_json que não é JSON: recusa sem escrever', async () => {
      arrange('editor', 'draft')
      const res = await saveRaw({ content_json: '{nao' })
      expect(res.ok).toBe(false)
      expect(db.writes).toEqual([])
    })
  })

  // Trocar o conteúdo ou o tipo (= a lista de destinatários) de uma edição que o
  // cron já pode enviar é mexer num envio real.
  describe.each([
    { name: 'saveEdition', run: () => actions.saveEdition('ed-1', { subject: 'novo' }) },
    { name: 'reassignEditionType', run: () => actions.reassignEditionType('ed-1', 'type-2') },
  ])('edição já agendada: $name', (c) => {
    it.each(['editor', 'rpc_error'] as const)('%s: negado com a frase da edição agendada, nada escrito', async (who) => {
      arrange(who, 'scheduled')
      const res = await c.run()
      expect(res).toEqual({ ok: false, error: SCHEDULED_EDIT })
      expect(db.writes).toEqual([])
    })

    it('org_admin: continua funcionando', async () => {
      arrange('admin', 'scheduled')
      expect(await c.run()).toMatchObject({ ok: true })
      expect(updates()).toHaveLength(1)
    })

    it('editora em rascunho: continua podendo', async () => {
      arrange('editor', 'draft')
      expect(await c.run()).toMatchObject({ ok: true })
      expect(updates()).toHaveLength(1)
    })
  })

  // Entre ler o status e escrever, o dono pode ter agendado em outra aba: a
  // escrita é condicionada ao status lido e "0 linhas" é falha, não sucesso.
  describe('escrita condicionada ao status lido', () => {
    const RACE: Array<{ name: string; status: string; op: string; expected: string; run: () => Promise<Result> }> = [
      { name: 'saveEdition', status: 'draft', op: 'update', expected: 'draft', run: () => actions.saveEdition('ed-1', { subject: 'novo' }) },
      { name: 'reassignEditionType', status: 'draft', op: 'update', expected: 'draft', run: () => actions.reassignEditionType('ed-1', 'type-2') },
      { name: 'cancelEdition', status: 'draft', op: 'update', expected: 'draft', run: () => actions.cancelEdition('ed-1') },
      { name: 'deleteEdition (rascunho)', status: 'draft', op: 'delete', expected: 'draft', run: () => actions.deleteEdition('ed-1', { confirmed: true }) },
    ]

    describe.each(RACE)('$name', (c) => {
      it('a escrita leva .eq(status, <status lido>)', async () => {
        arrange('admin', c.status)
        expect(await c.run()).toMatchObject({ ok: true })
        expect(lastWrite(c.op)!.filters).toEqual(expect.arrayContaining([['id', 'ed-1'], ['status', c.expected]]))
      })

      it('0 linhas afetadas: falha honesta', async () => {
        arrange('admin', c.status)
        db.writesAffectNothing = true
        const res = await c.run()
        expect(res.ok).toBe(false)
        expect(res.error).toMatch(/estado da edição mudou.*recarregue/i)
      })
    })

    it('deleteEdition de agendada: cancela condicionado a "scheduled" e apaga condicionado a "cancelled"', async () => {
      arrange('admin', 'scheduled')
      expect(await actions.deleteEdition('ed-1', { confirmed: true })).toMatchObject({ ok: true })
      expect(lastWrite('update')!.filters).toEqual(expect.arrayContaining([['status', 'scheduled']]))
      expect(lastWrite('delete')!.filters).toEqual(expect.arrayContaining([['status', 'cancelled']]))
    })

    it('deleteEdition de agendada que outra aba já tirou de "scheduled": não apaga', async () => {
      arrange('admin', 'scheduled')
      db.writesAffectNothing = true
      const res = await actions.deleteEdition('ed-1', { confirmed: true })
      expect(res.ok).toBe(false)
      expect(db.writes.some((w) => w.op === 'delete')).toBe(false)
    })
  })
})
