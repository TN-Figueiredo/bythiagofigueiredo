// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  criarRelogio, restante, fetchComPrazo, emParalelo, comPrazo, SemTempoError,
  RELOGIO_GLOBAL_MS, TETOS_MS, FETCH_TIMEOUT_MS, PARALELO,
} from '@/lib/youtube/coleta/clock'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('relógio da coleta', () => {
  it('as constantes são as do spec', () => {
    expect(RELOGIO_GLOBAL_MS).toBe(270_000)
    expect(TETOS_MS).toEqual({ metadados: 30_000, jobs: 20_000, relatorios: 60_000 })
    expect(FETCH_TIMEOUT_MS).toBe(15_000)
    expect(PARALELO).toBe(4)
  })

  it('prazo do passo = min(teto, o que resta do relógio global)', () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const r = criarRelogio()
    expect(r.prazo(30_000) - Date.now()).toBe(30_000)
    vi.setSystemTime(new Date('2026-10-07T12:04:20.000Z')) // 260 s depois: restam 10 s
    expect(r.decorrido()).toBe(260_000)
    expect(r.prazo(30_000) - Date.now()).toBe(10_000)
    vi.setSystemTime(new Date('2026-10-07T12:05:00.000Z')) // relógio estourado
    expect(restante(r.prazo(30_000))).toBe(0)
  })

  it('fetchComPrazo aplica 15 s quando sobra mais que isso, e o que resta quando sobra menos', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const f = vi.fn(async () => new Response('ok'))
    await fetchComPrazo(Date.now() + 60_000, f as unknown as typeof fetch)('https://x.test')
    expect(timeout).toHaveBeenLastCalledWith(15_000)
    await fetchComPrazo(Date.now() + 4_000, f as unknown as typeof fetch)('https://x.test')
    expect(timeout).toHaveBeenLastCalledWith(4_000)
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal)
  })

  it('fetchComPrazo sem tempo lança SemTempoError e não chama a rede', async () => {
    const f = vi.fn()
    await expect(fetchComPrazo(Date.now() - 1, f as unknown as typeof fetch)('https://x.test')).rejects.toBeInstanceOf(SemTempoError)
    expect(f).not.toHaveBeenCalled()
  })

  it('fetch que nunca responde é abortado pelo prazo de 15 s', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const c = new AbortController()
      queueMicrotask(() => c.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')))
      return c.signal
    })
    const nuncaResponde = ((_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_ok, falha) => init!.signal!.addEventListener('abort', () => falha(init!.signal!.reason)))) as typeof fetch
    await expect(fetchComPrazo(Date.now() + 60_000, nuncaResponde)('https://x.test')).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(timeout).toHaveBeenCalledWith(15_000)
  })

  it('fetch rejeita com TimeoutError depois do prazo do passo: SemTempoError', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const deadline = Date.now() + 5_000
    const f = vi.fn(async () => {
      vi.setSystemTime(new Date(Date.now() + 6_000))
      throw new DOMException('timeout', 'TimeoutError')
    })
    await expect(fetchComPrazo(deadline, f as unknown as typeof fetch)('https://x.test')).rejects.toBeInstanceOf(SemTempoError)
  })

  it('fetch rejeita com TimeoutError sobrando tempo do passo: o mesmo TimeoutError', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const erro = new DOMException('timeout', 'TimeoutError')
    const f = vi.fn(async () => { throw erro })
    await expect(fetchComPrazo(Date.now() + 60_000, f as unknown as typeof fetch)('https://x.test')).rejects.toBe(erro)
  })

  it('fetch rejeita com TypeError (rede) depois do prazo: SemTempoError; com tempo sobrando: o TypeError', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T12:00:00.000Z'), toFake: ['Date'] })
    const f = vi.fn(async () => {
      vi.setSystemTime(new Date(Date.now() + 6_000))
      throw new TypeError('fetch failed')
    })
    await expect(fetchComPrazo(Date.now() + 5_000, f as unknown as typeof fetch)('https://x.test')).rejects.toBeInstanceOf(SemTempoError)
    const g = vi.fn(async () => { throw new TypeError('fetch failed') })
    await expect(fetchComPrazo(Date.now() + 60_000, g as unknown as typeof fetch)('https://x.test')).rejects.toBeInstanceOf(TypeError)
  })

  it('aborto do sinal de quem chama com tempo sobrando: o erro original', async () => {
    const dele = new AbortController()
    const f = vi.fn(async () => { dele.abort(); throw dele.signal.reason })
    await expect(fetchComPrazo(Date.now() + 60_000, f as unknown as typeof fetch)('https://x.test', { signal: dele.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('fetchComPrazo respeita também o sinal que quem chama já passou', async () => {
    const dele = new AbortController()
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      dele.abort()
      return new Response(init!.signal!.aborted ? 'abortado' : 'vivo')
    })
    const res = await fetchComPrazo(Date.now() + 60_000, f as unknown as typeof fetch)('https://x.test', { signal: dele.signal })
    expect(await res.text()).toBe('abortado')
  })

  it('emParalelo nunca passa do limite e devolve na ordem de entrada', async () => {
    let ativos = 0
    let pico = 0
    const out = await emParalelo([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      ativos++
      pico = Math.max(pico, ativos)
      await new Promise(r => setTimeout(r, 5))
      ativos--
      return n * 2
    })
    expect(pico).toBeLessThanOrEqual(4)
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18])
  })

  it('comPrazo devolve null quando a promessa não termina a tempo, e o valor quando termina', async () => {
    expect(await comPrazo(Promise.resolve('a'), Date.now() + 1_000)).toBe('a')
    expect(await comPrazo(new Promise<string>(() => {}), Date.now() + 20)).toBeNull()
    expect(await comPrazo(Promise.resolve('a'), Date.now() - 1)).toBeNull()
  })
})
