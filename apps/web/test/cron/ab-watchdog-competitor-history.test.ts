// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---- o cron inteiro, com o banco de mentira que só anota os deletes
const deletes: string[] = []
let ausentes: string[] = []
function chain(table: string): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'lt', 'gt', 'in', 'is', 'not', 'or', 'order', 'range', 'limit', 'update', 'insert', 'upsert', 'maybeSingle', 'single']) c[m] = vi.fn(self)
  c.delete = vi.fn(() => { deletes.push(table); return c })
  c.then = (r: (v: { data: unknown[]; error: null; count: number }) => unknown) => {
    const rows = table === 'competitor_channels' ? ausentes.map(id => ({ id })) : []
    return Promise.resolve({ data: rows, error: null, count: rows.length }).then(r)
  }
  return c
}
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => chain(t), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }) }))
vi.mock('@/lib/cron-health', () => ({ getCronHealth: vi.fn(() => Promise.resolve(null)), recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))

describe('ab-watchdog keeps competitor change history', () => {
  beforeEach(() => { deletes.length = 0; ausentes = []; process.env.CRON_SECRET = 's' })
  it('never deletes competitor_changes', async () => {
    const { GET } = await import('@/app/api/cron/ab-watchdog/route')
    await GET(new Request('http://x/api/cron/ab-watchdog', { headers: { authorization: 'Bearer s' } }) as never)
    expect(deletes).not.toContain('competitor_changes')
    expect(deletes).toContain('competitor_channel_snapshots')
  })

  it('a resposta do cron traz poda_retratos com ok true quando rodou, e ok false com o motivo quando não rodou', async () => {
    const { GET } = await import('@/app/api/cron/ab-watchdog/route')
    const pedido = () => new Request('http://x/api/cron/ab-watchdog', { headers: { authorization: 'Bearer s' } }) as never
    const bom = await (await GET(pedido())).json() as { poda_retratos?: { ok: boolean; motivo?: string }; status?: string }
    expect(bom.poda_retratos).toEqual({ ok: true })
    ausentes = Array.from({ length: 151 }, (_, i) => `c${i}`)
    deletes.length = 0
    const ruim = await (await GET(pedido())).json() as { poda_retratos?: { ok: boolean; motivo?: string }; status?: string }
    expect(ruim.status).toBe('ok')
    expect(ruim.poda_retratos?.ok).toBe(false)
    expect(ruim.poda_retratos?.motivo).toContain('151')
    expect(deletes).not.toContain('competitor_channel_snapshots')
  })
})

// ---- a poda sozinha (lib/youtube/competitor-snapshot-prune.ts)
interface Registro { delete: boolean; lt: unknown[]; not: unknown[][] }
function banco(opts: { ausentes?: string[]; contagem?: number; erroNaLeitura?: boolean; erroNoDelete?: boolean }) {
  const registro: Registro = { delete: false, lt: [], not: [] }
  const sb = {
    from(tabela: string) {
      const c: Record<string, unknown> = {}
      const self = () => c
      for (const m of ['select', 'order', 'range', 'limit']) c[m] = self
      c.not = (...a: unknown[]) => { if (tabela === 'competitor_channel_snapshots') registro.not.push(a); return c }
      c.lt = (...a: unknown[]) => { registro.lt.push(...a); return c }
      c.delete = () => { registro.delete = true; return c }
      c.then = (r: (v: unknown) => unknown) => {
        if (tabela === 'competitor_channels') {
          if (opts.erroNaLeitura) return Promise.resolve({ data: null, error: { message: 'x' }, count: null }).then(r)
          const rows = (opts.ausentes ?? []).map(id => ({ id }))
          return Promise.resolve({ data: rows, error: null, count: opts.contagem ?? rows.length }).then(r)
        }
        return Promise.resolve({ data: null, error: opts.erroNoDelete ? { message: 'y' } : null }).then(r)
      }
      return c
    },
  } as unknown as SupabaseClient
  return { sb, registro }
}
const AGORA = Date.parse('2026-10-14T12:00:00Z')

describe('podarRetratosDeCanal', () => {
  it('a poda de retratos não apaga os de canal ausente', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb, registro } = banco({ ausentes: ['a1', 'b2'] })
    expect(await podarRetratosDeCanal(sb, AGORA)).toEqual({ ok: true })
    expect(registro.delete).toBe(true)
    expect(registro.not).toEqual([['competitor_channel_id', 'in', '(a1,b2)']])
  })

  it('sem canal ausente a poda é a de hoje (mesmo filtro de data)', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb, registro } = banco({ ausentes: [] })
    expect((await podarRetratosDeCanal(sb, AGORA)).ok).toBe(true)
    expect(registro.delete).toBe(true)
    expect(registro.not).toEqual([])
    expect(registro.lt).toEqual(['snapshot_date', '2025-10-14'])
  })

  it('a leitura dos ausentes falha: nenhum delete de retratos', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb, registro } = banco({ erroNaLeitura: true })
    const r = await podarRetratosDeCanal(sb, AGORA)
    expect(r.ok).toBe(false)
    expect(registro.delete).toBe(false)
  })

  it('menos linhas que a contagem: trata como falha', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb, registro } = banco({ ausentes: ['a1'], contagem: 2 })
    expect((await podarRetratosDeCanal(sb, AGORA)).ok).toBe(false)
    expect(registro.delete).toBe(false)
  })

  it('151 canais ausentes: nenhum delete, e o motivo diz o número', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb, registro } = banco({ ausentes: Array.from({ length: 150 }, (_, i) => `c${i}`), contagem: 151 })
    const r = await podarRetratosDeCanal(sb, AGORA)
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('151')
    expect(registro.delete).toBe(false)
  })

  it('150 canais ausentes ainda poda (com o filtro)', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb, registro } = banco({ ausentes: Array.from({ length: 150 }, (_, i) => `c${i}`) })
    expect((await podarRetratosDeCanal(sb, AGORA)).ok).toBe(true)
    expect(registro.not).toHaveLength(1)
  })

  it('erro no delete devolve ok false, sem lançar', async () => {
    const { podarRetratosDeCanal } = await import('@/lib/youtube/competitor-snapshot-prune')
    const { sb } = banco({ erroNoDelete: true })
    expect((await podarRetratosDeCanal(sb, AGORA)).ok).toBe(false)
  })
})
