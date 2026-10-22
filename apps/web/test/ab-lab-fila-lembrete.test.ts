// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { enfileirar, drenar, lerFila, useDrenarFilaLembrete, CHAVE_FILA_LEMBRETE, VALIDADE_FILA_MS } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/fila-lembrete'

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const DIA = 86_400_000
const ID = '11111111-1111-4111-8111-111111111111'
const ID2 = '22222222-2222-4222-8222-222222222222'

function armazem(lanca = false): Storage {
  const m = new Map<string, string>()
  const bloqueia = (): never => { throw new Error('bloqueado') }
  return {
    get length() { return m.size }, key: (i: number) => [...m.keys()][i] ?? null,
    getItem: lanca ? bloqueia : (k: string) => m.get(k) ?? null, setItem: lanca ? bloqueia : (k: string, v: string) => { m.set(k, v) },
    removeItem: lanca ? bloqueia : (k: string) => { m.delete(k) }, clear: () => m.clear(),
  }
}
const ok = { ok: true as const, lembrarEm: AGORA.toISOString(), jaLembrado: false }

beforeEach(() => { vi.stubGlobal('localStorage', armazem()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('fila do lembrete', () => {
  it('guarda só fichaId e enfileiradoEm, nunca título', () => {
    enfileirar(ID, AGORA)
    const bruto = localStorage.getItem(CHAVE_FILA_LEMBRETE)!
    expect(JSON.parse(bruto)).toEqual([{ fichaId: ID, enfileiradoEm: AGORA.toISOString() }])
    expect(Object.keys(JSON.parse(bruto)[0]).sort()).toEqual(['enfileiradoEm', 'fichaId'])
  })

  it('o mesmo fichaId não entra duas vezes', () => {
    enfileirar(ID, AGORA); enfileirar(ID, AGORA)
    expect(lerFila()).toHaveLength(1)
  })

  it('drenar chama a action uma vez e o item sai', async () => {
    enfileirar(ID, AGORA)
    const lembrar = vi.fn().mockResolvedValue(ok)
    await drenar(lembrar, AGORA)
    expect(lembrar).toHaveBeenCalledTimes(1)
    expect(lembrar).toHaveBeenCalledWith(ID)
    expect(lerFila()).toEqual([])
  })

  it('"não encontrado" tira o item sem erro', async () => {
    enfileirar(ID, AGORA)
    const lembrar = vi.fn().mockResolvedValue({ ok: false, error: 'não encontrado' })
    await expect(drenar(lembrar, AGORA)).resolves.toBeUndefined()
    expect(lerFila()).toEqual([])
  })

  it('item de 15 dias sai sem chamar a action; o de 13 dias segue', async () => {
    localStorage.setItem(CHAVE_FILA_LEMBRETE, JSON.stringify([
      { fichaId: ID, enfileiradoEm: new Date(AGORA.getTime() - 15 * DIA).toISOString() },
      { fichaId: ID2, enfileiradoEm: new Date(AGORA.getTime() - 13 * DIA).toISOString() },
    ]))
    const lembrar = vi.fn().mockResolvedValue(ok)
    await drenar(lembrar, AGORA)
    expect(lembrar).toHaveBeenCalledTimes(1)
    expect(lembrar).toHaveBeenCalledWith(ID2)
    expect(VALIDADE_FILA_MS).toBe(14 * DIA)
  })

  it('outro erro ou exceção de rede mantém o item para a próxima vez', async () => {
    enfileirar(ID, AGORA)
    await drenar(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')), AGORA)
    expect(lerFila()).toHaveLength(1)
    await drenar(vi.fn().mockResolvedValue({ ok: false, error: 'não foi possível criar o lembrete' }), AGORA)
    expect(lerFila()).toHaveLength(1)
  })

  it('localStorage lançando não quebra nada', async () => {
    vi.stubGlobal('localStorage', armazem(true))
    expect(() => enfileirar(ID, AGORA)).not.toThrow()
    expect(lerFila()).toEqual([])
    const lembrar = vi.fn()
    await expect(drenar(lembrar, AGORA)).resolves.toBeUndefined()
    expect(lembrar).not.toHaveBeenCalled()
  })
})

describe('useDrenarFilaLembrete', () => {
  const visivel = (): void => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')) }
  const oculto = (): void => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) }

  it('ao montar com rede: a action é chamada uma vez e o item sai', async () => {
    enfileirar(ID, AGORA)
    const lembrar = vi.fn().mockResolvedValue(ok)
    await act(async () => { renderHook(() => useDrenarFilaLembrete(lembrar, () => AGORA)) })
    expect(lembrar).toHaveBeenCalledTimes(1)
    expect(lerFila()).toEqual([])
  })

  it('online drena uma vez', async () => {
    const lembrar = vi.fn().mockResolvedValue(ok)
    await act(async () => { renderHook(() => useDrenarFilaLembrete(lembrar, () => AGORA)) })
    enfileirar(ID, AGORA)
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(lembrar).toHaveBeenCalledTimes(1)
  })

  it('visibilitychange visível drena uma vez; oculto não', async () => {
    const lembrar = vi.fn().mockResolvedValue(ok)
    await act(async () => { renderHook(() => useDrenarFilaLembrete(lembrar, () => AGORA)) })
    enfileirar(ID, AGORA)
    await act(async () => { oculto() })
    expect(lembrar).not.toHaveBeenCalled()
    await act(async () => { visivel() })
    expect(lembrar).toHaveBeenCalledTimes(1)
  })

  it('dois gatilhos juntos não chamam duas vezes o mesmo item', async () => {
    enfileirar(ID, AGORA)
    let solta: (v: typeof ok) => void = () => undefined
    const lembrar = vi.fn().mockImplementation(() => new Promise((r) => { solta = r }))
    await act(async () => { renderHook(() => useDrenarFilaLembrete(lembrar, () => AGORA)) })
    await act(async () => { window.dispatchEvent(new Event('online')); visivel() })
    solta(ok)
    await act(async () => { await Promise.resolve() })
    expect(lembrar).toHaveBeenCalledTimes(1)
  })
})
