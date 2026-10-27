// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ rpc }) }))
/** Um unstable_cache fiel no que importa: guarda o que o corpo DEVOLVE, nunca o que ele lança. */
vi.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: () => Promise<T>, chave: string[]) => {
    const g = globalThis as { __cacheAviso?: Map<string, T> }
    const m = (g.__cacheAviso ??= new Map())
    return async () => { const k = chave.join('|'); if (m.has(k)) return m.get(k) as T; const v = await fn(); m.set(k, v); return v }
  },
}))

const BOM = { versao: 1, lido_em: '2025-05-03T15:00:00Z', hoje: '2025-05-03', proximo_mes: null, primeira_devida_em: null, primeira_devida_mes: null, atraso_mes: null, ultima_copia: null,
  casa: [], vermelhos_n: 0, atraso: { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 } }

describe('lerAvisoLeve: falha não fica em cache (Yannis M-A)', () => {
  beforeEach(() => { vi.resetModules(); rpc.mockReset(); (globalThis as { __cacheAviso?: Map<string, unknown> }).__cacheAviso = new Map() })
  const ler = async (site: string) => (await import('@/lib/youtube/observatorio/arquivo-mensal/aviso-leve')).lerAvisoLeve(site)

  it('erro do banco e depois leitura boa: a boa aparece na chamada seguinte, sem esperar o TTL', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '57014' } }).mockResolvedValueOnce({ data: BOM, error: null })
    expect(await ler('s1')).toEqual({ ok: false, porque: 'erro_do_banco' })
    expect((await ler('s1')).ok).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it('função ausente (antes do db:push da T13) também não é guardada', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42883' } }).mockResolvedValueOnce({ data: BOM, error: null })
    expect(await ler('s2')).toEqual({ ok: false, porque: 'funcao_ausente' })
    expect((await ler('s2')).ok).toBe(true)
  })
  it('forma inválida e exceção do rpc: idem', async () => {
    rpc.mockResolvedValueOnce({ data: { lixo: 1 }, error: null }).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ data: BOM, error: null })
    expect(await ler('s3')).toEqual({ ok: false, porque: 'erro_do_banco' })
    expect(await ler('s3')).toEqual({ ok: false, porque: 'erro_do_banco' })
    expect((await ler('s3')).ok).toBe(true)
  })
  it('leitura boa continua guardada: a 2ª não vai ao banco', async () => {
    rpc.mockResolvedValue({ data: BOM, error: null })
    await ler('s4'); await ler('s4')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
