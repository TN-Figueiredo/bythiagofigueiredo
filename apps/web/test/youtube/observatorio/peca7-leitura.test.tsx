// apps/web/test/youtube/observatorio/peca7-leitura.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EsperamComandos } from '@/app/cms/(authed)/youtube/competitors/_canais/esperam-comandos'
import { LINHA_DO_DONO, type PendenciasDaTela } from '@/lib/youtube/observatorio/arquivo-mensal/pendencias'

const LIDO = new Date('2025-05-03T15:00:00Z')
const item = (idadeDias: number, i: number) => ({ item_id: 'canal:aaaaaaaa-1111-2222-3333-44444444444' + i, kind: 'canal', tempo: 'sem_comando' as const, idadeDias, titulo: null as string | null, desde: new Date(LIDO.getTime() - idadeDias * 86_400_000), codigo: 'abc12345' as string | null })
const tres = (linha: string | null): PendenciasDaTela => ({ estado: 'com_itens', lidoEm: LIDO, n: 3, maisAntigoDias: 63, itens: [item(63, 1), item(20, 2), item(3, 3)], linha })

describe('peça 7, parte de leitura', () => {
  it('zero medido: frase própria, uma frase só', () => {
    render(<EsperamComandos t={{ estado: 'zero', lidoEm: LIDO, linha: null }} />)
    expect(screen.getByText('Nenhum item espera você rodar os comandos.')).toBeTruthy()
    expect(screen.queryByText(/Esperar não perde nada/)).toBeNull()
  })
  it('não medido: hachura e a ressalva', () => {
    render(<EsperamComandos t={{ estado: 'nao_medido' }} />)
    expect(screen.getByText(/Não foi possível ler se há cópia no arquivo/)).toBeTruthy()
    expect(screen.getByText(/Isto não quer dizer que não há cópia/)).toBeTruthy()
    expect(document.querySelector('[data-forma="hachura"]')).not.toBeNull()
  })
  it('3 itens com o mais antigo de 63 dias: resumo exato e octógono', () => {
    render(<EsperamComandos t={tres(LINHA_DO_DONO)} />)
    expect(screen.getByText('3 itens esperam você rodar os comandos; o mais antigo há 63 dias.')).toBeTruthy()
    expect(document.querySelector('[data-forma="octogono"]')).not.toBeNull()
  })
  it('1 item: singular', () => {
    render(<EsperamComandos t={{ estado: 'com_itens', lidoEm: LIDO, n: 1, maisAntigoDias: 1, itens: [item(1, 1)], linha: LINHA_DO_DONO }} />)
    expect(screen.getByText('1 item espera você rodar os comandos; o mais antigo há 1 dia.')).toBeTruthy()
  })
  it('só edita: sem a linha e sem "Ver os comandos"', () => {
    render(<EsperamComandos t={tres(null)} />)
    expect(screen.queryByText('Ver os comandos')).toBeNull()
    expect(document.body.textContent).not.toContain(LINHA_DO_DONO)
  })
  it('administra: a linha é a LINHA_DO_DONO, com o botão Copiar', () => {
    render(<EsperamComandos t={tres(LINHA_DO_DONO)} />)
    expect(screen.getByText('Ver os comandos')).toBeTruthy()
    expect(document.body.textContent).toContain(LINHA_DO_DONO)
    expect(screen.getByRole('button', { name: /Copiar/ })).toBeTruthy()
  })
  it('Yannis I-3: dois canais removidos se distinguem pelo nome; sem nome aparece o mês', () => {
    render(<EsperamComandos t={{ estado: 'com_itens', lidoEm: LIDO, n: 2, maisAntigoDias: 5, itens: [{ ...item(5, 1), titulo: 'Canal Um' }, { ...item(2, 2), titulo: 'março de 2028' }], linha: null }} />)
    expect(screen.getByText('Canal removido · Canal Um')).toBeTruthy()
    expect(screen.getByText('Canal removido · março de 2028')).toBeTruthy()
  })
  it('nunca "Já rodei" (é da M9)', () => {
    render(<EsperamComandos t={tres(LINHA_DO_DONO)} />)
    expect(screen.queryByText(/Já rodei/)).toBeNull()
  })
})
