// @vitest-environment jsdom
// Manutenção M5, conserto r3 (27/10): a peça 7, "Esperam você rodar os comandos" (Logan P1-P4, Naksu N5/pointer).
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { LINHA_DO_DONO, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const LIDO = new Date('2028-05-03T15:00:00Z')
const dia = (n: number): Date => new Date(LIDO.getTime() - n * 86_400_000)
const it1 = (o: Record<string, unknown>) => ({ item_id: 'item:1', kind: 'video', tempo: 'sem_comando' as const, idadeDias: 0, titulo: null as string | null, desde: dia(0), codigo: 'vid12345' as string | null, ...o })
const com = (itens: ReturnType<typeof it1>[], linha: string | null = null): PendenciasDaTela =>
  ({ estado: 'com_itens', lidoEm: LIDO, n: itens.length, maisAntigoDias: Math.max(...itens.map(i => i.idadeDias)), itens, linha })

describe('P1: "Ver os comandos" fica no quadro do resumo, antes da lista', () => {
  it('o botão vem antes do primeiro item', () => {
    render(<EsperamComandos t={com([it1({}), it1({ item_id: 'item:2' })], LINHA_DO_DONO)} />)
    const botao = screen.getByText('Ver os comandos')
    const primeiro = document.querySelector('.p7-it')!
    expect(botao.closest('.p7-res')).not.toBeNull()
    expect(botao.compareDocumentPosition(primeiro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
describe('P2: o item tem uma linha em negrito que o distingue', () => {
  it('vídeo sem título: o canal dono no kicker e "Apagado do site em dd/mm"', () => {
    render(<EsperamComandos t={com([it1({ titulo: 'Nômade Raiz', idadeDias: 63, desde: new Date('2028-03-01T15:00:00Z') })])} />)
    expect(screen.getByText('Vídeo · Nômade Raiz')).toBeTruthy()
    expect(screen.getByText('Apagado do site em 01/03').className).toBe('p7-t')
  })
  it('canal removido: "Removido do site em"; sem nome nem mês, o código', () => {
    render(<EsperamComandos t={com([it1({ kind: 'canal', item_id: 'canal:x', titulo: null, codigo: '6f1c1b9e', desde: new Date('2028-04-10T15:00:00Z'), idadeDias: 23 })])} />)
    expect(screen.getByText('Canal removido · código 6f1c1b9e')).toBeTruthy()
    expect(screen.getByText('Removido do site em 10/04')).toBeTruthy()
  })
  it('a frase repetida "Espera você rodar os comandos" não aparece por item', () => {
    render(<EsperamComandos t={com([it1({}), it1({ item_id: 'item:2' })])} />)
    expect(screen.queryByText(/Há cópia no arquivo/)).toBeNull()
  })
})
describe('P3: nunca "há 0 dias"', () => {
  it('o mais antigo de hoje: "é de hoje"; o item: "hoje"', () => {
    render(<EsperamComandos t={com([it1({})])} />)
    expect(screen.getByText('1 item espera você rodar os comandos; o mais antigo é de hoje.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/há 0 dias?/)
    expect(screen.getByText('hoje')).toBeTruthy()
  })
  it('1 dia: "há 1 dia"', () => {
    render(<EsperamComandos t={com([it1({ idadeDias: 1, desde: dia(1) })])} />)
    expect(screen.getByText('1 item espera você rodar os comandos; o mais antigo há 1 dia.')).toBeTruthy()
  })
})
describe('P4: a frase do Tailscale', () => {
  it('está no resumo', () => {
    render(<EsperamComandos t={com([it1({})])} />)
    expect(screen.getByText('De fora do país, a linha funciona com o Tailscale ligado no Mac e a forja ligada.')).toBeTruthy()
  })
})
