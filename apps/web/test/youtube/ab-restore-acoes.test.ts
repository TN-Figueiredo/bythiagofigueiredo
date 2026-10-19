// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const releaseAlert = vi.fn(async () => {})
vi.mock('@/lib/ops/alert-state', () => ({ claimAlert: vi.fn(async () => true), releaseAlert: (...a: unknown[]) => releaseAlert(...(a as [])) }))

const requireSiteScope = vi.fn()
const denyUnlessSiteAdmin = vi.fn()
const novaTentativa = vi.fn()
const getSupabaseServiceClient = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn(async () => ({ siteId: 'site-1', orgId: 'org-1' })) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/cms/auth-guards', () => ({ denyUnlessSiteAdmin: (...a: unknown[]) => denyUnlessSiteAdmin(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => getSupabaseServiceClient() }))
vi.mock('@/lib/youtube/ab-settle', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/ab-settle')>()), novaTentativa: (...a: unknown[]) => novaTentativa(...a) }))

import { dispensarCampos, destinoDosCampos } from '@/lib/youtube/ab-restore-acoes'
import { retryRestore, dismissRestore } from '@/app/cms/(authed)/youtube/ab-lab/actions'

const EM = '2026-10-19T10:00:00.000Z'
const falhou = (destino = 'original') => ({ estado: 'falhou', destino, em: EM, forcado: false, escreveu: false, erro: null, attempts: 1 })
const ok = () => ({ estado: 'ok', destino: 'original', em: EM, forcado: false, escreveu: true, erro: null, attempts: 0 })
const desistiu = (motivo = 'tres_falhas') => ({ estado: 'desistiu', destino: 'original', em: EM, forcado: false, escreveu: false, erro: null, attempts: 3, motivo })

interface Linha { id: string; name?: string; site_id: string; restore_seq: number; restore_status: Record<string, unknown> | null }
function banco(linha: Linha | null, { update = true, erroDeLeitura = false }: { update?: boolean; erroDeLeitura?: boolean } = {}) {
  const updates: Array<{ patch: Record<string, unknown>; eqs: Array<[string, unknown]> }> = []
  const audit: Array<Record<string, unknown>> = []
  const sb = {
    from: (tabela: string) => {
      if (tabela === 'audit_log') return { insert: async (row: Record<string, unknown>) => { audit.push(row); return { error: null } } }
      return {
        select: () => {
          const q = { eq: () => q, maybeSingle: async () => (erroDeLeitura ? { data: null, error: { message: 'banco caiu' } } : { data: linha, error: null }) }
          return q
        },
        update: (patch: Record<string, unknown>) => {
          const eqs: Array<[string, unknown]> = []
          const q = {
            eq: (k: string, v: unknown) => { eqs.push([k, v]); return q },
            select: async () => { updates.push({ patch, eqs }); return { data: update ? [{ id: 't1' }] : [], error: null } },
          }
          return q
        },
      }
    },
  }
  return { sb: sb as unknown as SupabaseClient, updates, audit }
}
const ATOR = { userId: 'user-9', orgId: 'org-1' }
const base = (rs: Linha['restore_status'], seq = 4): Linha => ({ id: 't1', site_id: 'site-1', restore_seq: seq, restore_status: rs })

beforeEach(() => {
  vi.clearAllMocks()
  requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'user-9' } })
  denyUnlessSiteAdmin.mockResolvedValue(null)
})

describe('dispensarCampos', () => {
  it('title falhou e thumbnail ok: grava só thumbnail e restore_seq + 1, guardado pelo seq visto (P4b-I7)', async () => {
    const b = banco(base({ title: falhou(), thumbnail: ok() }))
    const r = await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4, ATOR)
    expect(r.resultado).toBe('feito')
    expect(b.updates[0]!.patch).toEqual({ restore_status: { thumbnail: ok() }, restore_seq: 5 })
    expect(b.updates[0]!.eqs).toContainEqual(['restore_seq', 4])
  })
  it('dispensar o único campo grava {} e nunca null (P4b-I7, D4)', async () => {
    const b = banco(base({ title: falhou() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4, ATOR)
    expect(b.updates[0]!.patch.restore_status).toEqual({})
  })
  it('campo em_andamento ou ok: ja_encerrado, nada gravado', async () => {
    const b = banco(base({ title: ok(), thumbnail: { ...ok(), estado: 'em_andamento' } }))
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4, ATOR)).resultado).toBe('ja_encerrado')
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['thumbnail'], 4, ATOR)).resultado).toBe('ja_encerrado')
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title', 'thumbnail'], 4, ATOR)).resultado).toBe('ja_encerrado')
    expect(b.updates).toHaveLength(0)
  })
  it('seqVisto velho: mudou, nada gravado', async () => {
    const b = banco(base({ title: falhou() }, 7))
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4, ATOR)).resultado).toBe('mudou')
    expect(b.updates).toHaveLength(0)
  })
  it('zero linhas no update: em_andamento, sem aviso liberado', async () => {
    const b = banco(base({ title: falhou() }), { update: false })
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4, ATOR)).resultado).toBe('em_andamento')
    expect(releaseAlert).not.toHaveBeenCalled()
  })
  it('grava uma linha em audit_log com ab_restore_dismissed e os campos (F8)', async () => {
    const b = banco(base({ title: falhou(), thumbnail: desistiu() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['title', 'thumbnail'], 4, ATOR)
    expect(b.audit).toHaveLength(1)
    expect(b.audit[0]).toMatchObject({ action: 'ab_restore_dismissed', resource_id: 't1', site_id: 'site-1', actor_user_id: 'user-9', org_id: 'org-1',
      after_data: { campos: ['title', 'thumbnail'], restore_seq: 4, restore_seq_novo: 5, estados_dispensados: { title: 'falhou', thumbnail: 'desistiu' } } })
  })
  it('libera ab-restore:<id> sem falhou restante e a chave de desistiu do campo dispensado (F7)', async () => {
    const b = banco(base({ thumbnail: desistiu() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['thumbnail'], 4, ATOR)
    expect(releaseAlert).toHaveBeenCalledWith(b.sb, 'ab-restore:t1')
    expect(releaseAlert).toHaveBeenCalledWith(b.sb, 'ab-restore-desistiu:t1:thumbnail')
  })
  it('com falhou restante, não libera ab-restore:<id>', async () => {
    const b = banco(base({ title: falhou(), thumbnail: falhou() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['thumbnail'], 4, ATOR)
    expect(releaseAlert).not.toHaveBeenCalledWith(expect.anything(), 'ab-restore:t1')
  })
})

describe('destinoDosCampos', () => {
  it('original, variante e nulo (teste de outro site)', async () => {
    expect(await destinoDosCampos(banco(base({ title: falhou() })).sb, 't1', 'site-1', ['title'])).toBe('original')
    expect(await destinoDosCampos(banco(base({ title: falhou('var-1') })).sb, 't1', 'site-1', ['title'])).toBe('variante')
    expect(await destinoDosCampos(banco(null).sb, 't1', 'site-1', ['title'])).toBeNull()
  })
  it('Y-A1: restore_status vazio ou sem o campo pedido → nulo (recusa), nunca original', async () => {
    expect(await destinoDosCampos(banco(base({})).sb, 't1', 'site-1', ['title'])).toBeNull()
    expect(await destinoDosCampos(banco(base(null)).sb, 't1', 'site-1', ['title'])).toBeNull()
    expect(await destinoDosCampos(banco(base({ thumbnail: falhou() })).sb, 't1', 'site-1', ['title'])).toBeNull()
  })
  it('Y-A1: o destino considera todos os campos presentes, inclusive em_andamento', async () => {
    const emAnd = { ...falhou('var-1'), estado: 'em_andamento' }
    expect(await destinoDosCampos(banco(base({ title: falhou(), thumbnail: emAnd })).sb, 't1', 'site-1', ['title'])).toBe('variante')
  })
  it('erro de leitura lança (nunca vira original)', async () => {
    await expect(destinoDosCampos(banco(base({ title: falhou() }), { erroDeLeitura: true }).sb, 't1', 'site-1', ['title'])).rejects.toThrow()
  })
})

describe('ações', () => {
  it('sem sessão: sem_permissao, nada chamado', async () => {
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const b = banco(base({ title: falhou() })); getSupabaseServiceClient.mockReturnValue(b.sb)
    expect((await retryRestore('t1', 4)).resultado).toBe('sem_permissao')
    expect((await dismissRestore('t1', ['title'], 4, ATOR)).resultado).toBe('sem_permissao')
    expect(novaTentativa).not.toHaveBeenCalled(); expect(b.updates).toHaveLength(0)
  })
  it('editora sem admin, destino variante: dismiss recusa; retry passa autorizar a novaTentativa, que recusa sem update', async () => {
    denyUnlessSiteAdmin.mockResolvedValue({ error: 'x' })
    const b = banco(base({ title: falhou('var-1') })); getSupabaseServiceClient.mockReturnValue(b.sb)
    novaTentativa.mockImplementation(async (_id: string, op: { autorizar: (d: 'original' | 'variante') => Promise<boolean> }) =>
      (await op.autorizar('variante')) ? { resultado: 'feito', campos: {} } : { resultado: 'sem_permissao', campos: null })
    expect((await retryRestore('t1', 4)).resultado).toBe('sem_permissao')
    expect((await dismissRestore('t1', ['title'], 4)).resultado).toBe('sem_permissao')
    expect(b.updates).toHaveLength(0)
  })
  it('Y-A1 (sonda): variante em_andamento na leitura, editora sem admin → a permissão é decidida DENTRO de novaTentativa sobre o destino variante; recusa, zero escrita', async () => {
    denyUnlessSiteAdmin.mockResolvedValue({ error: 'x' })
    const emAnd = { ...falhou('var-1'), estado: 'em_andamento' }
    const b = banco(base({ title: emAnd }, 7)); getSupabaseServiceClient.mockReturnValue(b.sb)
    novaTentativa.mockImplementation(async (_id: string, op: { autorizar: (d: 'original' | 'variante') => Promise<boolean> }) =>
      (await op.autorizar('variante')) ? { resultado: 'feito', campos: {} } : { resultado: 'sem_permissao', campos: null })
    const r = await retryRestore('t1', 7)
    expect(r).toMatchObject({ ok: false, resultado: 'sem_permissao' })
    expect(novaTentativa).toHaveBeenCalledTimes(1)
    expect(denyUnlessSiteAdmin).toHaveBeenCalled()
    expect(b.updates).toHaveLength(0)
  })
  it('Y-A1: autorizar("original") não cobra administrar; autorizar que lança → erro da ação, não escrita', async () => {
    const b = banco(base({ title: falhou() })); getSupabaseServiceClient.mockReturnValue(b.sb)
    novaTentativa.mockImplementation(async (_id: string, op: { autorizar: (d: 'original' | 'variante') => Promise<boolean> }) => {
      expect(await op.autorizar('original')).toBe(true)
      denyUnlessSiteAdmin.mockRejectedValue(new Error('banco caiu'))
      await op.autorizar('variante')
      return { resultado: 'feito', campos: {} }
    })
    const r = await retryRestore('t1', 4)
    expect(r).toMatchObject({ ok: false, resultado: 'erro' })
    expect(b.updates).toHaveLength(0)
  })
  it('dismiss: leitura da permissão com erro → erro da ação, nenhuma escrita (Y-A1/4)', async () => {
    const b = banco(base({ title: falhou() }), { erroDeLeitura: true }); getSupabaseServiceClient.mockReturnValue(b.sb)
    const r = await dismissRestore('t1', ['title'], 4)
    expect(r).toMatchObject({ ok: false, resultado: 'erro' })
    expect(b.updates).toHaveLength(0); expect(b.audit).toHaveLength(0)
  })
  it('dismiss de campo ausente → ja_encerrado, sem escrita', async () => {
    const b = banco(base({})); getSupabaseServiceClient.mockReturnValue(b.sb)
    expect((await dismissRestore('t1', ['title'], 4)).resultado).toBe('ja_encerrado')
    expect(b.updates).toHaveLength(0)
  })
  it('editora, destino original: retry chama novaTentativa com origem humano e seqEsperado', async () => {
    const b = banco(base({ title: falhou() })); getSupabaseServiceClient.mockReturnValue(b.sb)
    novaTentativa.mockResolvedValue({ resultado: 'em_andamento', campos: null })
    await retryRestore('t1', 4)
    expect(denyUnlessSiteAdmin).not.toHaveBeenCalled()
    expect(novaTentativa).toHaveBeenCalledWith('t1', { siteId: 'site-1', origem: 'humano', seqEsperado: 4, autorizar: expect.any(Function) })
  })
  it('pedido inválido: seq negativo ou campos vazios/repetidos além de 2', async () => {
    const b = banco(base({ title: falhou() })); getSupabaseServiceClient.mockReturnValue(b.sb)
    expect((await retryRestore('t1', -1)).resultado).toBe('erro')
    expect((await dismissRestore('t1', [], 4)).resultado).toBe('erro')
    expect((await dismissRestore('t1', ['title', 'thumbnail', 'title'] as never, 4)).resultado).toBe('erro')
  })
  it('retry de campo desistiu que sai de desistiu libera a chave de desistiu do campo (F7)', async () => {
    const antes = base({ thumbnail: desistiu() })
    const depois = base({ thumbnail: falhou() }, 5)
    let andou = false
    const b = banco(antes)
    const orig = b.sb.from.bind(b.sb)
    ;(b.sb as unknown as { from: unknown }).from = (t: string) => {
      const f = orig(t) as { select?: () => unknown }
      if (t !== 'ab_tests' || !f.select) return f
      return { ...f, select: () => { const q = { eq: () => q, maybeSingle: async () => ({ data: andou ? depois : antes, error: null }) }; return q } }
    }
    getSupabaseServiceClient.mockReturnValue(b.sb)
    novaTentativa.mockImplementation(async () => { andou = true; return { resultado: 'em_andamento', campos: null } })
    await retryRestore('t1', 4)
    expect(releaseAlert).toHaveBeenCalledWith(b.sb, 'ab-restore-desistiu:t1:thumbnail')
  })
})
