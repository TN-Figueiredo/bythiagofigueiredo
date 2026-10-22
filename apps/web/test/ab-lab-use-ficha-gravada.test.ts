// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { useFichaGravada, type AcoesGravacao } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/use-ficha-gravada'
import { fichaLida, TITULO_100, TITULO_101, URL_IMG, SHA } from './helpers/ficha-fixture'

type Res = Awaited<ReturnType<AcoesGravacao['salvarFicha']>>
const T = (n: number): string => `2026-10-22T14:${String(30 + n).padStart(2, '0')}:00.000Z`
const okCom = (f: FichaLida): Res => ({ ok: true, ficha: f })

function montar(salvar: AcoesGravacao['salvarFicha'], inicial = fichaLida()) {
  return renderHook(() => useFichaGravada(inicial, { salvarFicha: salvar }))
}

describe('useFichaGravada', () => {
  it('grava ao sair do campo, sem a n=1, e adota o atualizada_em devolvido', async () => {
    const salvar = vi.fn(async (_id: string, _lido: string, d): Promise<Res> => okCom(fichaLida({ atualizada_em: T(5), variantes: [{ n: 1, tipo: 'combo', titulo: 'Título da A' }, ...d.variantes] })))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'Título da B' }))
    await act(async () => { await result.current.sair('2:titulo') })
    const [id, lido, dados] = salvar.mock.calls[0]!
    expect(id).toBe(fichaLida().id)
    expect(lido).toBe(fichaLida().atualizada_em)
    expect(dados.campos).toEqual(['titulo', 'miniatura'])
    expect(dados.variantes).toEqual([{ n: 2, tipo: 'combo', titulo: 'Título da B' }])
    expect(result.current.status).toBe('salvo')
    expect(result.current.ficha.atualizada_em).toBe(T(5))
  })

  it('apagar o título da B omite a chave titulo (nunca manda "")', async () => {
    const salvar = vi.fn(async (): Promise<Res> => okCom(fichaLida({ atualizada_em: T(6) })))
    const inicial = fichaLida({ variantes: [{ n: 1, tipo: 'combo', titulo: 'A' }, { n: 2, tipo: 'combo', titulo: 'B' }] })
    const { result } = montar(salvar, inicial)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: '   ' }))
    await act(async () => { await result.current.sair('2:titulo') })
    const dados = (salvar.mock.calls[0] as unknown as [string, string, { variantes: Array<Record<string, unknown>> }])[2]
    expect(dados.variantes).toEqual([{ n: 2, tipo: 'combo' }])
    expect('titulo' in dados.variantes[0]!).toBe(false)
  })

  it('fila: salvar espera a mutação pendente (cópia lenta da A) e parte do atualizada_em adotado dela', async () => {
    const salvar = vi.fn(async (): Promise<Res> => okCom(fichaLida({ atualizada_em: T(9) })))
    const { result } = montar(salvar)
    let solta: (f: FichaLida) => void = () => undefined
    const lenta = new Promise<{ ficha: FichaLida }>((r) => { solta = (ficha) => r({ ficha }) })
    let p1: Promise<unknown> = Promise.resolve()
    act(() => { p1 = result.current.executar(() => lenta) })
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'B' }))
    let p2: Promise<boolean> = Promise.resolve(false)
    act(() => { p2 = result.current.salvarAgora() })
    await act(async () => { await Promise.resolve() })
    expect(salvar).not.toHaveBeenCalled()
    await act(async () => { solta(fichaLida({ atualizada_em: T(7) })); await p1; await p2 })
    expect(salvar.mock.calls[0]![1]).toBe(T(7))
    expect(result.current.status).toBe('salvo')
  })

  it('executar encadeia: cada mutação parte do atualizada_em adotado da anterior', async () => {
    const { result } = montar(vi.fn())
    const vistos: string[] = []
    await act(async () => {
      const a = result.current.executar(async (l) => { vistos.push(l); return { ficha: fichaLida({ atualizada_em: T(1) }) } })
      const b = result.current.executar(async (l) => { vistos.push(l); return { ficha: fichaLida({ atualizada_em: T(2) }) } })
      const c = result.current.executar(async (l) => { vistos.push(l); return {} })
      await Promise.all([a, b, c])
    })
    expect(vistos).toEqual([fichaLida().atualizada_em, T(1), T(2)])
  })

  it('CAS perdido: adota a atual, avisa, preserva o digitado e REGRAVA sozinho sobre o novo atualizada_em', async () => {
    const outroAparelho = fichaLida({ atualizada_em: T(8), variantes: [{ n: 1, tipo: 'combo', titulo: 'Título da A' }, { n: 3, tipo: 'combo', titulo: 'C do outro' }] })
    const salvar = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: FRASES.mudouEmOutroLugar, fichaAtual: outroAparelho } satisfies Res)
      .mockResolvedValueOnce(okCom(fichaLida({ atualizada_em: T(10), variantes: [{ n: 1, tipo: 'combo', titulo: 'Título da A' }, { n: 2, tipo: 'combo', titulo: 'Meu B' }, { n: 3, tipo: 'combo', titulo: 'C do outro' }] })))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'Meu B' }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(salvar).toHaveBeenCalledTimes(2)
    expect(salvar.mock.calls[1]![1]).toBe(T(8))
    expect((salvar.mock.calls[1] as unknown as [string, string, { variantes: Array<{ n: number }> }])[2].variantes.map((v) => v.n)).toEqual([2, 3])
    expect(result.current.status).toBe('salvo')
    expect(result.current.mensagem).toBe(FRASES.mudouEmOutroLugar)
    expect(result.current.rascunho.variantes.map((v) => [v.n, v.titulo])).toEqual([[1, 'Título da A'], [2, 'Meu B'], [3, 'C do outro']])
  })

  it('CAS perdido duas vezes: UMA nova tentativa só, linha "Não salvo" e texto intacto', async () => {
    const outro = (n: number) => fichaLida({ atualizada_em: T(n) })
    const salvar = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'x', fichaAtual: outro(8) } satisfies Res)
      .mockResolvedValueOnce({ ok: false, error: 'x', fichaAtual: outro(9) } satisfies Res)
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'Meu B' }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(salvar).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('mudou')
    expect(result.current.mensagem).toBe(FRASES.ficha.naoSalvoConflito)
    expect(result.current.rascunho.variantes.find((v) => v.n === 2)?.titulo).toBe('Meu B')
  })

  it('título de 100 com espaço e quebra no fim grava (o servidor corta com trim); recusado some ao encurtar', async () => {
    const salvar = vi.fn(async (): Promise<Res> => okCom(fichaLida({ atualizada_em: T(3) })))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: `${TITULO_100}  \n` }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(salvar).toHaveBeenCalledTimes(1)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: TITULO_101 }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(result.current.status).toBe('recusado')
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: TITULO_100 }))
    expect(result.current.status).not.toBe('recusado')
    expect(result.current.mensagem).toBeNull()
  })

  it('erro do servidor (lança, não é rede) não vira "sem conexão"', async () => {
    const salvar = vi.fn().mockRejectedValueOnce(new Error('Internal Server Error'))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'x' }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(result.current.status).toBe('recusado')
    expect(result.current.mensagem).toBe(FRASES.ficha.erroServidor)
  })

  it('rede caída: sem_conexao, texto intacto, e salvarAgora de novo grava', async () => {
    const salvar = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(okCom(fichaLida({ atualizada_em: T(4) })))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'Escrevi' }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(result.current.status).toBe('sem_conexao')
    expect(result.current.rascunho.variantes.find((v) => v.n === 2)?.titulo).toBe('Escrevi')
    let ok = false
    await act(async () => { ok = await result.current.salvarAgora() })
    expect(ok).toBe(true)
    expect(result.current.status).toBe('salvo')
  })

  it('100 grafemas com emoji grava; 101 não vai ao servidor e mostra o limite', async () => {
    const salvar = vi.fn(async (): Promise<Res> => okCom(fichaLida({ atualizada_em: T(3) })))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: TITULO_100 }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(salvar).toHaveBeenCalledTimes(1)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: TITULO_101 }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(salvar).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('recusado')
    expect(result.current.mensagem).toBe(FRASES.ficha.tituloAcima(100))
  })

  it('erro de validação do servidor vira frase de FRASES, nunca texto do Zod', async () => {
    const salvar = vi.fn(async (): Promise<Res> => ({ ok: false, error: 'variantes.1.titulo: String must contain at least 1 character(s)' }))
    const { result } = montar(salvar)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'x' }))
    await act(async () => { await result.current.sair('2:titulo') })
    expect(result.current.mensagem).toBe(FRASES.ficha.erroSalvar)
    expect(JSON.stringify(result.current.mensagem)).not.toMatch(/variantes|String must/)
  })

  it('a imagem da A (n=1) nunca é regravada e a da B sobrevive a uma gravação de título', async () => {
    const salvar = vi.fn(async (): Promise<Res> => okCom(fichaLida({ atualizada_em: T(3) })))
    const img = { url: URL_IMG('b'), sha256: SHA, largura: 1280, altura: 720 }
    const inicial = fichaLida({ variantes: [{ n: 1, tipo: 'combo', titulo: 'A', imagem: { ...img, url: URL_IMG('a') } }, { n: 2, tipo: 'combo', imagem: img }] })
    const { result } = montar(salvar, inicial)
    act(() => result.current.alterar({ atributo: 'titulo', n: 2, valor: 'B' }))
    await act(async () => { await result.current.sair('2:titulo') })
    const dados = (salvar.mock.calls[0] as unknown as [string, string, { variantes: Array<{ n: number; imagem?: unknown }> }])[2]
    expect(dados.variantes.map((v) => v.n)).toEqual([2])
    expect(dados.variantes[0]!.imagem).toEqual(img)
  })
})
