// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAvisoOriginal } from '@/app/cms/(authed)/youtube/ab-lab/_components/use-aviso-original'

const ler = vi.fn()

describe('useAvisoOriginal', () => {
  beforeEach(() => ler.mockReset())

  it('480x360 medida → baixa; 1280x720 → null', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    const a = renderHook(() => useAvisoOriginal(ler, 't1', 'thumbnail', true))
    await waitFor(() => expect(a.result.current?.texto).toContain('480×360'))
    ler.mockResolvedValueOnce({ ok: true, dimensions: '1280x720', medida: true })
    const b = renderHook(() => useAvisoOriginal(ler, 't2', 'combo', true))
    await waitFor(() => expect(ler).toHaveBeenCalledTimes(2))
    expect(b.result.current).toBeNull()
  })
  it('dimensions nula e original medida: baixa sem número', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null, medida: true })
    const h = renderHook(() => useAvisoOriginal(ler, 't3', 'thumbnail', true))
    await waitFor(() => expect(h.result.current?.texto).toContain('mínimo 1280 px de largura'))
  })
  it('não medida: selo e texto próprios, sem "baixa"', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: null, medida: false })
    const h = renderHook(() => useAvisoOriginal(ler, 't3b', 'thumbnail', true))
    await waitFor(() => expect(h.result.current?.kind).toBe('nao-medida'))
    expect(h.result.current?.selo).toBe('Resolução não medida')
  })
  it('leitura que falha, lança de forma síncrona ou rejeita: linha neutra, nunca "baixa"', async () => {
    ler.mockResolvedValueOnce({ ok: false })
    const a = renderHook(() => useAvisoOriginal(ler, 't4', 'thumbnail', true))
    await waitFor(() => expect(a.result.current?.kind).toBe('indisponivel'))
    ler.mockRejectedValueOnce(new Error('rede'))
    const b = renderHook(() => useAvisoOriginal(ler, 't5', 'thumbnail', true))
    await waitFor(() => expect(b.result.current?.kind).toBe('indisponivel'))
    ler.mockImplementationOnce(() => { throw new Error('síncrono') })
    const c = renderHook(() => useAvisoOriginal(ler, 't5b', 'thumbnail', true))
    await waitFor(() => expect(c.result.current?.kind).toBe('indisponivel'))
  })
  it('tipo title, passo inativo ou sem rascunho não lê', () => {
    renderHook(() => useAvisoOriginal(ler, 't6', 'title', true))
    renderHook(() => useAvisoOriginal(ler, 't7', 'thumbnail', false))
    renderHook(() => useAvisoOriginal(ler, null, 'thumbnail', true))
    expect(ler).not.toHaveBeenCalled()
  })
  it('trocar o rascunho limpa o aviso antigo antes da nova resposta (Logan L7)', async () => {
    ler.mockResolvedValueOnce({ ok: true, dimensions: '480x360', medida: true })
    const h = renderHook(({ id }) => useAvisoOriginal(ler, id, 'thumbnail', true), { initialProps: { id: 'a' } })
    await waitFor(() => expect(h.result.current?.kind).toBe('baixa'))
    ler.mockReturnValueOnce(new Promise(() => {}))
    h.rerender({ id: 'b' })
    expect(h.result.current).toBeNull()
  })
})
