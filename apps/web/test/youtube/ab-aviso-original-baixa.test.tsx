// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAvisoOriginal, TEMPO_LIMITE_LEITURA_MS } from '@/app/cms/(authed)/youtube/ab-lab/_components/use-aviso-original'
import type { EstadoAviso } from '@/lib/youtube/ab-original-resolucao'

const ler = vi.fn()
/** Estreita o estado para o objeto de aviso (ou null). */
const obj = (e: EstadoAviso) => (e !== null && e !== 'pendente' ? e : null)

describe('useAvisoOriginal', () => {
  beforeEach(() => ler.mockReset())
  afterEach(() => { vi.useRealTimers() })

  it('480x360 medida → baixa; 1280x720 → pendente e depois null', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    const a = renderHook(() => useAvisoOriginal(ler, 't1', 'thumbnail', true))
    await waitFor(() => expect(obj(a.result.current)?.texto).toContain('480×360'))
    let resolve!: (v: { ok: true; dimensions: string; medida: boolean }) => void
    ler.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const b = renderHook(() => useAvisoOriginal(ler, 't2', 'combo', true))
    expect(b.result.current).toBe('pendente')
    await act(async () => { resolve({ ok: true, dimensions: '1280x720', medida: true }) })
    await waitFor(() => expect(b.result.current).toBeNull())
  })
  it('dimensions nula e original medida: baixa sem número', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null, medida: true })
    const h = renderHook(() => useAvisoOriginal(ler, 't3', 'thumbnail', true))
    await waitFor(() => expect(obj(h.result.current)?.texto).toContain('abaixo do mínimo de 1280 px de largura'))
  })
  it('não medida: selo e texto próprios, sem "baixa"', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null, medida: false })
    const h = renderHook(() => useAvisoOriginal(ler, 't3b', 'thumbnail', true))
    await waitFor(() => expect(obj(h.result.current)?.kind).toBe('nao-medida'))
    expect(obj(h.result.current)?.selo).toBe('Resolução não medida')
  })
  it('leitura que falha, lança de forma síncrona ou rejeita: linha neutra, nunca "baixa"', async () => {
    ler.mockResolvedValueOnce({ ok: false })
    const a = renderHook(() => useAvisoOriginal(ler, 't4', 'thumbnail', true))
    await waitFor(() => expect(obj(a.result.current)?.kind).toBe('indisponivel'))
    ler.mockRejectedValueOnce(new Error('rede'))
    const b = renderHook(() => useAvisoOriginal(ler, 't5', 'thumbnail', true))
    await waitFor(() => expect(obj(b.result.current)?.kind).toBe('indisponivel'))
    ler.mockImplementationOnce(() => { throw new Error('síncrono') })
    const c = renderHook(() => useAvisoOriginal(ler, 't5b', 'thumbnail', true))
    await waitFor(() => expect(obj(c.result.current)?.kind).toBe('indisponivel'))
  })
  it('tipo title ou passo inativo: null e não lê', () => {
    const a = renderHook(() => useAvisoOriginal(ler, 't6', 'title', true))
    const b = renderHook(() => useAvisoOriginal(ler, 't7', 'thumbnail', false))
    expect(a.result.current).toBeNull()
    expect(b.result.current).toBeNull()
    expect(ler).not.toHaveBeenCalled()
  })
  it('thumbnail ativo sem rascunho: "não medida" e não lê (nunca "Tudo pronto." sem ler)', () => {
    const h = renderHook(() => useAvisoOriginal(ler, null, 'thumbnail', true))
    expect(obj(h.result.current)?.kind).toBe('nao-medida')
    expect(ler).not.toHaveBeenCalled()
  })
  it('trocar o rascunho mostra pendente, nunca o aviso do anterior (Logan L7, Phil menor 3)', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    const h = renderHook(({ id }) => useAvisoOriginal(ler, id, 'thumbnail', true), { initialProps: { id: 'a' } })
    await waitFor(() => expect(obj(h.result.current)?.kind).toBe('baixa'))
    ler.mockReturnValueOnce(new Promise(() => {}))
    h.rerender({ id: 'b' })
    expect(h.result.current).toBe('pendente')
  })

  describe('tempo-limite', () => {
    it('leitura que nunca volta: 7999 ms pendente, 8000 ms indisponível', async () => {
      vi.useFakeTimers()
      ler.mockReturnValueOnce(new Promise(() => {}))
      const h = renderHook(() => useAvisoOriginal(ler, 'tl', 'thumbnail', true))
      await act(async () => { await vi.advanceTimersByTimeAsync(TEMPO_LIMITE_LEITURA_MS - 1) })
      expect(h.result.current).toBe('pendente')
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(obj(h.result.current)?.kind).toBe('indisponivel')
    })
    it('o indisponível do tempo é provisório: resposta ok em 9 s com 480x360 vira "baixa"', async () => {
      vi.useFakeTimers()
      ler.mockReturnValueOnce(new Promise((r) => setTimeout(() => r({ ok: true, dimensions: '480x360', medida: true }), 9000)))
      const h = renderHook(() => useAvisoOriginal(ler, 'tl2', 'thumbnail', true))
      await act(async () => { await vi.advanceTimersByTimeAsync(8500) })
      expect(obj(h.result.current)?.kind).toBe('indisponivel')
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(obj(h.result.current)?.kind).toBe('baixa')
    })
    it('ok:false tardio não sobrescreve resultado já bom', async () => {
      vi.useFakeTimers()
      let ok!: (v: unknown) => void
      ler.mockReturnValueOnce(new Promise((r) => { ok = r }))
      const h = renderHook(() => useAvisoOriginal(ler, 'tl3', 'thumbnail', true))
      await act(async () => { ok({ ok: true, dimensions: '480x360', medida: true }) })
      expect(obj(h.result.current)?.kind).toBe('baixa')
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(obj(h.result.current)?.kind).toBe('baixa')
    })
    it('erro fecha o desfecho: depois dele, resposta ok tardia é ignorada', async () => {
      vi.useFakeTimers()
      let rej!: (e: Error) => void
      ler.mockReturnValueOnce(new Promise((_, r) => { rej = r }))
      const h = renderHook(() => useAvisoOriginal(ler, 'tl4', 'thumbnail', true))
      await act(async () => { rej(new Error('rede')) })
      expect(obj(h.result.current)?.kind).toBe('indisponivel')
    })
    it('resposta em 100 ms cancela o timer: depois de 10 s o aviso continua intacto', async () => {
      vi.useFakeTimers()
      ler.mockReturnValueOnce(new Promise((r) => setTimeout(() => r({ ok: true, dimensions: '480x360', medida: true }), 100)))
      const h = renderHook(() => useAvisoOriginal(ler, 'tl5', 'thumbnail', true))
      await act(async () => { await vi.advanceTimersByTimeAsync(200) })
      expect(obj(h.result.current)?.kind).toBe('baixa')
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(obj(h.result.current)?.kind).toBe('baixa')
    })
  })
})
