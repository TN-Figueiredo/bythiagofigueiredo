// @vitest-environment node
/**
 * F4 T9: as ações `pedirTitulos` e `cancelarTitulos`. Ordem: Zod -> quem administra o site -> sessão de edição -> cliente de serviço -> motor.
 * Quem não administra NUNCA chega ao cliente de serviço nem ao `askReading`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const OWN = '11111111-1111-4111-8111-111111111111'
const SIG = '22222222-2222-4222-8222-222222222222'
interface Opcoes { admin?: boolean; edit?: boolean; ask?: unknown; cancel?: unknown; lanca?: boolean; lanca400?: boolean }

const sentry = { captureException: vi.fn(), captureMessage: vi.fn() }

async function montar(o: Opcoes = {}) {
  const ordem: string[] = []
  const pedidos: unknown[][] = []
  const cancelados: unknown[][] = []
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('@sentry/nextjs', () => sentry)
  vi.doMock('next/navigation', () => ({ unstable_rethrow: () => undefined }))
  vi.doMock('next/cache', () => ({ revalidatePath: () => undefined }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-ctx' }) }))
  vi.doMock('@/lib/cms/auth-guards', () => ({
    denyUnlessSiteAdmin: async () => null,
    requireSiteAdminScope: async () => { ordem.push('admin'); return o.admin === false ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: 'u1' } } },
  }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => { ordem.push('edit'); return o.edit === false ? { ok: false } : { ok: true, user: { id: OWN } } } }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { ordem.push('service'); return { marca: 'sb' } } }))
  vi.doMock('@/lib/youtube/observatorio/sinais/leitura', () => ({ adiarSinal: vi.fn(), dispensarSinal: vi.fn() }))
  vi.doMock('@/lib/pipeline/services/forja-queue', () => ({
    askReading: async (...a: unknown[]) => { ordem.push('ask'); pedidos.push(a); if (o.lanca400) throw Object.assign(new Error('sinal sem nicho'), { name: 'PipelineServiceError', status: 400 }); if (o.lanca) throw new Error('postgres: secret'); return o.ask ?? { data: { ok: true, reason: null, results: [] } } },
    cancelReading: async (...a: unknown[]) => { ordem.push('cancel'); cancelados.push(a); if (o.lanca) throw new Error('postgres: secret'); return o.cancel ?? { data: { cancelled: true } } },
  }))
  const mod = await import('@/app/cms/(authed)/youtube/competitors/_sugestoes/actions')
  return { ordem, pedidos, cancelados, ...mod }
}

beforeEach(() => { vi.restoreAllMocks(); sentry.captureException.mockClear() })

describe('pedirTitulos', () => {
  it('sem admin: sem_permissao, sem cliente de serviço e sem pedido', async () => {
    const { ordem, pedirTitulos } = await montar({ admin: false })
    expect(await pedirTitulos(OWN, SIG)).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(ordem).toEqual(['admin'])
  })
  it('admin sem sessão de edição: sem_permissao antes do cliente de serviço', async () => {
    const { ordem, pedirTitulos } = await montar({ edit: false })
    expect(await pedirTitulos(OWN, SIG)).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(ordem).toEqual(['admin', 'edit'])
  })
  it('entrada que não é uuid: recusada sem guarda nem banco', async () => {
    const { ordem, pedirTitulos } = await montar()
    expect(await pedirTitulos('abc', SIG)).toEqual({ ok: false, motivo: 'falhou' })
    expect(ordem).toEqual([])
  })
  it('ok: pede titulo-complementar com o par e o usuário da SESSÃO, nunca do chamador', async () => {
    const { ordem, pedidos, pedirTitulos } = await montar()
    expect(await pedirTitulos(OWN, SIG)).toEqual({ ok: true })
    expect(ordem).toEqual(['admin', 'edit', 'service', 'ask'])
    expect(pedidos[0]![1]).toMatchObject({ type: 'titulo-complementar', ownVideoId: OWN, signalId: SIG, userId: OWN, scope: 'todos' })
  })
  it('recusa do motor volta com a frase dele', async () => {
    const { pedirTitulos } = await montar({ ask: { data: { ok: false, reason: 'Nada enviado: já há um pedido de títulos para este vídeo e este sinal.', results: [] } } })
    expect(await pedirTitulos(OWN, SIG)).toEqual({ ok: false, motivo: 'recusado', texto: 'Nada enviado: já há um pedido de títulos para este vídeo e este sinal.' })
  })
  it('P7: 400 do motor (entrada nossa malformada) vira "falhou" fixo, sem a frase do motor e sem Sentry', async () => {
    const { pedirTitulos } = await montar({ lanca400: true })
    expect(await pedirTitulos(OWN, SIG)).toEqual({ ok: false, motivo: 'falhou' })
    expect(sentry.captureException).not.toHaveBeenCalled()
  })
  it('exceção: "falhou" sem vazar a mensagem, e Sentry', async () => {
    const { pedirTitulos } = await montar({ lanca: true })
    const r = await pedirTitulos(OWN, SIG)
    expect(r).toEqual({ ok: false, motivo: 'falhou' })
    expect(JSON.stringify(r)).not.toContain('secret')
    expect(sentry.captureException).toHaveBeenCalled()
  })
})

describe('cancelarTitulos', () => {
  it('sem admin: nada é cancelado e o cliente de serviço não é criado', async () => {
    const { ordem, cancelarTitulos } = await montar({ admin: false })
    expect(await cancelarTitulos(OWN, SIG)).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(ordem).toEqual(['admin'])
  })
  it('cancela pelo par; sem nada esperando diz isso', async () => {
    const a = await montar()
    expect(await a.cancelarTitulos(OWN, SIG)).toEqual({ ok: true })
    expect(a.cancelados[0]![1]).toEqual({ type: 'titulo-complementar', ownVideoId: OWN, signalId: SIG })
    const b = await montar({ cancel: { data: { cancelled: false } } })
    expect(await b.cancelarTitulos(OWN, SIG)).toMatchObject({ ok: false, motivo: 'recusado' })
  })
})
