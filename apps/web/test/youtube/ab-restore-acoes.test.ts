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
function banco(linha: Linha | null, { update = true }: { update?: boolean } = {}) {
  const updates: Array<{ patch: Record<string, unknown>; eqs: Array<[string, unknown]> }> = []
  const audit: Array<Record<string, unknown>> = []
  const sb = {
    from: (tabela: string) => {
      if (tabela === 'audit_log') return { insert: async (row: Record<string, unknown>) => { audit.push(row); return { error: null } } }
      return {
        select: () => {
          const q = { eq: () => q, maybeSingle: async () => ({ data: linha, error: null }) }
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
const base = (rs: Linha['restore_status'], seq = 4): Linha => ({ id: 't1', site_id: 'site-1', restore_seq: seq, restore_status: rs })

beforeEach(() => {
  vi.clearAllMocks()
  requireSiteScope.mockResolvedValue({ ok: true })
  denyUnlessSiteAdmin.mockResolvedValue(null)
})

describe('dispensarCampos', () => {
  it('title falhou e thumbnail ok: grava só thumbnail e restore_seq + 1, guardado pelo seq visto (P4b-I7)', async () => {
    const b = banco(base({ title: falhou(), thumbnail: ok() }))
    const r = await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4)
    expect(r.resultado).toBe('feito')
    expect(b.updates[0]!.patch).toEqual({ restore_status: { thumbnail: ok() }, restore_seq: 5 })
    expect(b.updates[0]!.eqs).toContainEqual(['restore_seq', 4])
  })
  it('dispensar o único campo grava {} e nunca null (P4b-I7, D4)', async () => {
    const b = banco(base({ title: falhou() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4)
    expect(b.updates[0]!.patch.restore_status).toEqual({})
  })
  it('campo em_andamento ou ok: ja_encerrado, nada gravado', async () => {
    const b = banco(base({ title: ok(), thumbnail: { ...ok(), estado: 'em_andamento' } }))
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4)).resultado).toBe('ja_encerrado')
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['thumbnail'], 4)).resultado).toBe('ja_encerrado')
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title', 'thumbnail'], 4)).resultado).toBe('ja_encerrado')
    expect(b.updates).toHaveLength(0)
  })
  it('seqVisto velho: mudou, nada gravado', async () => {
    const b = banco(base({ title: falhou() }, 7))
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4)).resultado).toBe('mudou')
    expect(b.updates).toHaveLength(0)
  })
  it('zero linhas no update: em_andamento, sem aviso liberado', async () => {
    const b = banco(base({ title: falhou() }), { update: false })
    expect((await dispensarCampos(b.sb, 't1', 'site-1', ['title'], 4)).resultado).toBe('em_andamento')
    expect(releaseAlert).not.toHaveBeenCalled()
  })
  it('grava uma linha em audit_log com ab_restore_dismissed e os campos (F8)', async () => {
    const b = banco(base({ title: falhou(), thumbnail: desistiu() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['title', 'thumbnail'], 4)
    expect(b.audit).toHaveLength(1)
    expect(b.audit[0]).toMatchObject({ action: 'ab_restore_dismissed', resource_id: 't1', site_id: 'site-1',
      after_data: { campos: ['title', 'thumbnail'], restore_seq: 4, estados_dispensados: { title: 'falhou', thumbnail: 'desistiu' } } })
  })
  it('libera ab-restore:<id> sem falhou restante e a chave de desistiu do campo dispensado (F7)', async () => {
    const b = banco(base({ thumbnail: desistiu() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['thumbnail'], 4)
    expect(releaseAlert).toHaveBeenCalledWith(b.sb, 'ab-restore:t1')
    expect(releaseAlert).toHaveBeenCalledWith(b.sb, 'ab-restore-desistiu:t1:thumbnail')
  })
  it('com falhou restante, não libera ab-restore:<id>', async () => {
    const b = banco(base({ title: falhou(), thumbnail: falhou() }))
    await dispensarCampos(b.sb, 't1', 'site-1', ['thumbnail'], 4)
    expect(releaseAlert).not.toHaveBeenCalledWith(expect.anything(), 'ab-restore:t1')
  })
})

describe('destinoDosCampos', () => {
  it('original, variante e nulo (teste de outro site)', async () => {
    expect(await destinoDosCampos(banco(base({ title: falhou() })).sb, 't1', 'site-1', ['title'])).toBe('original')
    expect(await destinoDosCampos(banco(base({ title: falhou('var-1') })).sb, 't1', 'site-1', ['title'])).toBe('variante')
    expect(await destinoDosCampos(banco(null).sb, 't1', 'site-1', ['title'])).toBeNull()
  })
})

describe('ações', () => {
  it('sem sessão: sem_permissao, nada chamado', async () => {
    requireSiteScope.mockResolvedValue({ ok: false, reason: 'unauthenticated' })
    const b = banco(base({ title: falhou() })); getSupabaseServiceClient.mockReturnValue(b.sb)
    expect((await retryRestore('t1', 4)).resultado).toBe('sem_permissao')
    expect((await dismissRestore('t1', ['title'], 4)).resultado).toBe('sem_permissao')
    expect(novaTentativa).not.toHaveBeenCalled(); expect(b.updates).toHaveLength(0)
  })
  it('editora sem admin, destino variante: sem_permissao, sem novaTentativa nem update', async () => {
    denyUnlessSiteAdmin.mockResolvedValue({ error: 'x' })
    const b = banco(base({ title: falhou('var-1') })); getSupabaseServiceClient.mockReturnValue(b.sb)
    expect((await retryRestore('t1', 4)).resultado).toBe('sem_permissao')
    expect((await dismissRestore('t1', ['title'], 4)).resultado).toBe('sem_permissao')
    expect(novaTentativa).not.toHaveBeenCalled(); expect(b.updates).toHaveLength(0)
  })
  it('editora, destino original: retry chama novaTentativa com origem humano e seqEsperado', async () => {
    const b = banco(base({ title: falhou() })); getSupabaseServiceClient.mockReturnValue(b.sb)
    novaTentativa.mockResolvedValue({ resultado: 'em_andamento', campos: null })
    await retryRestore('t1', 4)
    expect(denyUnlessSiteAdmin).not.toHaveBeenCalled()
    expect(novaTentativa).toHaveBeenCalledWith('t1', { siteId: 'site-1', origem: 'humano', seqEsperado: 4 })
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
