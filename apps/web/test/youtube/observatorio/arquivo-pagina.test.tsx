// apps/web/test/youtube/observatorio/arquivo-pagina.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ArquivoScreen } from '@/app/cms/(authed)/youtube/competitors/_arquivo/arquivo-screen'
import { modeloCheio, modeloVazio, blocoComSemDestino } from './fixtures/arquivo-modelos'

describe('página Arquivo', () => {
  it('a linha que precisa do dono é a primeira do tipo e a única com contorno', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="administra" />)
    const tipo = screen.getByRole('region', { name: 'Views por dia' })
    const linhas = within(tipo).getAllByRole('listitem')
    expect(linhas[0]!.className).toMatch(/arq-contorno/)
    expect(linhas.slice(1).every(l => !/arq-contorno/.test(l.className))).toBe(true)
  })
  it('cada forma tem texto alternativo, nunca só cor', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="administra" />)
    for (const el of document.querySelectorAll('[data-forma]')) expect(el.getAttribute('aria-label') || el.textContent).toBeTruthy()
  })
  it('sem_destino sobe acima dos tipos', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="administra" />)
    const ordem = [...document.querySelectorAll('[data-secao]')].map(e => e.getAttribute('data-secao'))
    expect(ordem.indexOf('canais-removidos')).toBeLessThan(ordem.indexOf('tipo-serie'))
  })
  it('bloco não lido: frase em hachura, nunca lista vazia', () => {
    render(<ArquivoScreen modelo={modeloVazio()} bloco={{ ok: false }} acesso="edita" />)
    expect(screen.getByText('Não foi possível ler os canais removidos.')).toBeTruthy()
  })
  it('quem edita não vê "Ver os comandos" nem "Apagar do arquivo" (M9) nem o grupo de teste, e não lê "precisa de você" (Logan A5)', () => {
    render(<ArquivoScreen modelo={modeloCheio()} bloco={{ ok: true, bloco: blocoComSemDestino() }} acesso="edita" />)
    expect(screen.queryByText(/Ver os comandos|Apagar do arquivo|Dado de teste/)).toBeNull()
    expect(document.querySelector('.arq-resumo-geral')?.textContent).toMatch(/precisa de quem administra o site/)
    expect(document.body.textContent).not.toMatch(/precisa(m)? de você/)
    expect(screen.queryByText(/Alguns passos esperam/)).toBeNull()
  })
  it('Gio D2b: a frase da casa que já é o resumo não aparece duas vezes; a da casa que não é o resumo aparece', () => {
    const m = modeloVazio(); m.ligado = true
    m.casa = { estado: 'nao_respondeu', desde: 1, forma: 'octogono', frase: 'A casa não respondeu desde 30/04 22:00.' }
    m.resumo = { texto: m.casa.frase, forma: 'octogono' }
    const { unmount } = render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="edita" />)
    expect(screen.getAllByText('A casa não respondeu desde 30/04 22:00.')).toHaveLength(1)
    unmount()
    m.resumo = { texto: '2 meses precisam de você', forma: 'octogono' }
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getAllByText('A casa não respondeu desde 30/04 22:00.')).toHaveLength(1)
  })
  it('Gio D1: a faixa do dado de teste é a do mockup TESTE-1, com "Dado de teste." em destaque', () => {
    const m = modeloCheio(); m.teste = { faixa: 'Dado de teste. Isto é um mês fictício, criado para você testar o caminho inteiro sem tocar no dado real. Nada que sair daqui libera espaço de verdade.', linhas: [], encerradoEm: null }
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    const faixa = document.querySelector('.arq-teste-h')!
    expect(faixa.textContent).toBe(m.teste.faixa)
    expect(faixa.querySelector('b')?.textContent).toBe('Dado de teste.')
  })
  it('Yannis I-2: o título dos meses à frente não usa a palavra "partições"', () => {
    const m = modeloCheio(); m.mesesAFrente = [{ tabela: 'Views por dia', frase: '12 meses à frente', forma: 'visto' }]
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="edita" />)
    expect(screen.getByRole('region', { name: 'Meses criados à frente' })).toBeTruthy()
  })
  it('arquivo desligado: uma frase, sem cartões e sem o bloco', () => {
    render(<ArquivoScreen modelo={{ ...modeloVazio(), ligado: false }} bloco={{ ok: false }} acesso="edita" />)
    expect(document.querySelectorAll('[data-secao]')).toHaveLength(0)
    expect(screen.queryByText('Não foi possível ler os canais removidos.')).toBeNull()
  })
  it('M6 encaixa: o slot acoes da linha e do cartão aparece quando preenchido', () => {
    const m = modeloCheio(); m.tipos[0]!.linhas[0]!.acoes = <button type="button">Sair do banco</button>
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByText('Sair do banco')).toBeTruthy()
  })
  it('mês que voltou fora de ordem: triângulo com a frase, sem botão', () => {
    const m = modeloCheio(); m.tipos[0]!.linhas[0]!.secundaria = 'Voltou fora de ordem'
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByText('Voltou fora de ordem')).toBeTruthy()
  })
  it('a coluna reattach_out_of_order chega à linha como "Voltou fora de ordem" (leitura da M5)', async () => {
    const { montarPagina } = await import('@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes')
    const { paginaVazia, mesCom } = await import('./fixtures/arquivo-pagina')
    const m = mesCom({ nasHorasAtras: 3 }); m.linha.reattach_out_of_order = true
    const ok = montarPagina(paginaVazia({ meses: [mesCom({ nasHorasAtras: 3 })] }), { arquivoLigado: true })
    const fora = montarPagina(paginaVazia({ meses: [m] }), { arquivoLigado: true })
    expect(ok.tipos[0]!.linhas[0]!.secundaria).toBeNull()
    expect(fora.tipos[0]!.linhas[0]!.secundaria).toBe('Voltou fora de ordem')
    render(<ArquivoScreen modelo={fora} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByText('Voltou fora de ordem').closest('[data-forma]')?.getAttribute('data-forma')).toBe('triangulo')
  })
})
