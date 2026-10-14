// @vitest-environment node
/** A5 · E10, Tarefa 11b: `removeCompetitorChannel` passa só por `removerCanalArquivado`; canal pausado nas ações de sincronização. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('server-only', () => ({}))
const ordem: string[] = []
const remover = vi.fn()
const revalidateTag = vi.fn()
const updates: unknown[] = []
const syncMock = vi.fn()
let negado: { ok: false; error: string } | null = null
let pausadoNaLinha = false
let linhasAlteradas: Array<{ id: string }> = [{ id: 'c1' }]

function carregar() {
  vi.resetModules()
  ordem.length = 0; updates.length = 0
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async () => { ordem.push('guarda'); return negado },
    requireSiteAdminScope: async () => ({ ok: true, user: { id: 'u1' } }),
    siteAdminOnlyMessage: (a: string) => `Só quem administra o site pode ${a}.`,
    requireSiteAdminForRow: async () => ({ siteId: 's1' }),
  }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag }))
  vi.doMock('next/server', () => ({ after: vi.fn() }))
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
  vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: syncMock }))
  vi.doMock('@/lib/youtube/competitor-sync-guard', () => ({ syncSchemaBlock: async () => null }))
  vi.doMock('@/lib/youtube/observatorio/arquivo/remover', () => ({ removerCanalArquivado: remover }))
  vi.doMock('@/lib/supabase/service', () => ({
    getSupabaseServiceClient: () => {
      ordem.push('cliente')
      const leitura = { eq: () => leitura, single: async () => ({ data: { id: 'c1', channel_id: 'UC1', site_id: 's1', collection_paused_at: pausadoNaLinha ? '2026-10-01T00:00:00Z' : null } }), then: undefined }
      return {
        from: () => ({
          // (A5 E9 T9) `limit` e `not().is()` atendem as leituras novas de removeCompetitorChannel: canal no ar (sem missing_since), zero itens esperando
          select: () => ({ eq: () => ({ eq: () => ({ gt: async () => ({ count: 0 }), single: leitura.single, maybeSingle: leitura.single, limit: async () => ({ data: [{ id: 'c1', missing_since: null }], error: null }), not: () => ({ is: async () => ({ count: 0, error: null }) }) }), single: leitura.single }) }),
          update: (v: unknown) => { updates.push(v); return { eq: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: linhasAlteradas, error: null }) }) }) }) } },
        }),
      }
    },
  }))
  return import('@/app/cms/(authed)/youtube/competitors/actions')
}

beforeEach(() => {
  remover.mockReset(); revalidateTag.mockClear(); syncMock.mockReset(); negado = null; pausadoNaLinha = false; linhasAlteradas = [{ id: 'c1' }]
  process.env.YOUTUBE_API_KEY = 'k'
})

describe('removeCompetitorChannel (E10 T11b)', () => {
  it('sem administrar o site: recusa antes de criar o cliente de serviço', async () => {
    negado = { ok: false, error: 'Só quem administra o site pode remover.' }
    const a = await carregar()
    expect(await a.removeCompetitorChannel('c1')).toEqual(negado)
    expect(ordem).toEqual(['guarda'])
    expect(remover).not.toHaveBeenCalled()
  })
  it('canal sem lote: a frase diz o que falta e nada é apagado nem invalidado', async () => {
    remover.mockResolvedValue({ ok: false, codigo: 'sem_lote', frase: 'Este canal ainda não foi exportado.' })
    const a = await carregar()
    expect(await a.removeCompetitorChannel('c1')).toEqual({ ok: false, error: 'Este canal ainda não foi exportado.' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it('canal com lote confirmado: remove com o usuário da sessão e invalida o cache', async () => {
    remover.mockResolvedValue({ ok: true, lote: 'l1', linhas: 3, miniaturasPendentes: 0, foraDoPrefixo: 0 })
    const a = await carregar()
    expect(await a.removeCompetitorChannel('c1')).toEqual({ ok: true })
    expect(remover.mock.calls[0]![1]).toEqual({ siteId: 's1', canalId: 'c1', actorId: 'u1' })
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('removido no banco com miniaturas ainda pendentes: a tela recebe ok (o canal já saiu) e o cache é invalidado', async () => {
    remover.mockResolvedValue({ ok: true, lote: 'l1', linhas: 3, miniaturasPendentes: 4000, foraDoPrefixo: 0 })
    const a = await carregar()
    expect(await a.removeCompetitorChannel('c1')).toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledTimes(1)
  })
  it('o delete direto não existe mais', () => {
    const t = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/actions.ts'), 'utf8')
    expect(t).not.toMatch(/from\('competitor_channels'\)\s*\.delete\(/)
    expect(t).toContain('removerCanalArquivado(')
  })
})

describe('canal pausado nas ações de sincronização (E10 T11b)', () => {
  it('sincronização manual de canal pausado: a frase da pausa, não a de "outra sincronização"', async () => {
    syncMock.mockResolvedValue({ videosChecked: 0, changesDetected: 0, skipped: true, paused: true })
    const a = await carregar()
    const r = await a.syncCompetitorNow('c1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/pausada/)
    expect(r.error).not.toMatch(/outra sincroniza/)
  })
  it('histórico completo de canal pausado: recusa e nenhum update é feito', async () => {
    pausadoNaLinha = true
    const a = await carregar()
    const r = await a.syncFullHistory('c1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/pausada/)
    expect(updates).toEqual([])
    expect(syncMock).not.toHaveBeenCalled()
  })
  it('histórico completo: a pausa gravada entre a leitura e o update deixa zero linhas e a sincronização não roda', async () => {
    linhasAlteradas = []
    const a = await carregar()
    const r = await a.syncFullHistory('c1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/pausada/)
    expect(syncMock).not.toHaveBeenCalled()
  })
  it('histórico completo: a sincronização que volta "paused" não vira ok', async () => {
    syncMock.mockResolvedValue({ videosChecked: 0, changesDetected: 0, skipped: true, paused: true })
    const a = await carregar()
    const r = await a.syncFullHistory('c1')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/pausada/)
  })
  it('histórico completo de canal ativo continua gravando sync_mode e sincronizando', async () => {
    syncMock.mockResolvedValue({})
    const a = await carregar()
    expect((await a.syncFullHistory('c1')).ok).toBe(true)
    expect(updates).toEqual([{ sync_mode: 'full', full_sync_completed_at: null }])
  })
})
