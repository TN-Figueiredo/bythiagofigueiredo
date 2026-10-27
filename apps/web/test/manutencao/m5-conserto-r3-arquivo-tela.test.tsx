// @vitest-environment jsdom
// Manutenção M5, conserto r3 (27/10): a página Arquivo (Logan A1/A2/A3/A5, Naksu N1/N2/N6).
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ArquivoScreen } from '@/app/cms/(authed)/youtube/competitors/_arquivo/arquivo-screen'
import { montarPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { paginaVazia, mesCom, AGORA } from '../youtube/observatorio/fixtures/arquivo-pagina'
import { blocoComSemDestino } from '../youtube/observatorio/fixtures/arquivo-modelos'

const liga = { arquivoLigado: true }
const velho = (h: number) => { const t = new Date(AGORA - h * 3_600_000).toISOString(); return [{ ...paginaVazia().casa[0]!, last_poll_at: t, updated_at: t }] }
const bloco = { ok: true as const, bloco: blocoComSemDestino() }

describe('A1: a frase do topo linka para a linha do mês', () => {
  it('o link aponta para o id que existe na página, na linha do mês', () => {
    const m = montarPagina(paginaVazia({ meses: [mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 3 })] }), liga)
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    const a = document.querySelector('.arq-resumo-geral a') as HTMLAnchorElement
    expect(a.textContent).toMatch(/^Views por dia, dezembro de 2027: ver a cópia atrasada$/)
    const id = a.getAttribute('href')!.slice(1)
    expect(document.getElementById(id)?.getAttribute('data-mes')).toBe('serie:2027-12-01')
  })
  it('a lista "Problemas" vem antes do bloco Canais removidos e dos cartões, e tem id', () => {
    const m = montarPagina(paginaVazia({ vermelhos: ['xyz:1'], meses: [mesCom({ nasHorasAtras: 3 })] }), liga)
    render(<ArquivoScreen modelo={m} bloco={bloco} acesso="administra" />)
    const ordem = [...document.querySelectorAll('[data-secao]')].map(e => e.getAttribute('data-secao'))
    expect(ordem.indexOf('problemas')).toBeGreaterThanOrEqual(0)
    expect(ordem.indexOf('problemas')).toBeLessThan(ordem.indexOf('canais-removidos'))
    expect(ordem.indexOf('problemas')).toBeLessThan(ordem.indexOf('tipo-serie'))
    expect(document.getElementById('problemas')).not.toBeNull()
    expect(document.getElementById('canais-removidos')).not.toBeNull()
  })
  it('casa a 64 h: o título é a casa e "Além disso:" mostra o problema, com link', () => {
    const m = montarPagina(paginaVazia({ casa: velho(64), meses: [mesCom({ devidoHa: 31, esperadas: 2, recebidas: 0, mesNum: 3 })] }), liga)
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(document.querySelector('.arq-resumo-geral')?.textContent).toMatch(/A casa não respondeu desde/)
    const alem = document.querySelector('.arq-alem')!
    expect(alem.textContent).toMatch(/^Além disso: 1 mês precisa de você/)
    expect(alem.querySelector('a')).not.toBeNull()
  })
  it('o item da lista de canais sem destino leva ao bloco', () => {
    const m = montarPagina(paginaVazia({ vermelhos: ['2 canais removidos sem destino do arquivo'] }), liga)
    render(<ArquivoScreen modelo={m} bloco={bloco} acesso="administra" />)
    const li = within(document.getElementById('problemas')!).getByText('2 canais removidos estão sem destino do arquivo.').closest('li')!
    expect(li.querySelector('a')?.getAttribute('href')).toBe('#canais-removidos')
  })
})

describe('A2 / N1: meses arquivados dentro do ano', () => {
  const m = () => montarPagina(paginaVazia({ meses: [mesCom({ descartadoHa: 60, nasHorasAtras: 5, mesNum: 1 }), mesCom({ nasHorasAtras: 3, mesNum: 2 })] }), liga)
  it('um <details> por ano, fechado, com o mês dentro; o mês arquivado não é linha', () => {
    render(<ArquivoScreen modelo={m()} bloco={{ ok: false }} acesso="administra" />)
    const d = document.querySelector('details.arq-ano') as HTMLDetailsElement
    expect(d.open).toBe(false)
    expect(d.querySelector('summary')?.textContent).toMatch(/2027: 1 mês no arquivo, conferido/)
    expect(d.textContent).toMatch(/outubro de 2027 · verificado em \d\d\/\d\d\/\d{4}/)
    expect(document.querySelectorAll('li[data-mes]')).toHaveLength(1)
  })
  it('o sub-cabeçalho do cartão diz a ordem', () => {
    render(<ArquivoScreen modelo={m()} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByText('O caminho de cada mês · do mais antigo ao corrente')).toBeTruthy()
  })
})

describe('A3: ⓘ "Por que se espera"', () => {
  it('o mês fechado tem o ⓘ com o texto; as outras linhas não', () => {
    const m = montarPagina(paginaVazia({ meses: [mesCom({ mes: 'fechado_ha', dias: 10 })] }), liga)
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(screen.getByLabelText('Por que se espera')).toBeTruthy()
    expect(document.querySelector('.arq-info-t')?.textContent).toMatch(/^A cópia espera o mês parar de mudar \(\d+ dias depois de fechar\)/)
  })
})

describe('N6: erro de leitura em caixa hachurada', () => {
  it('"Não foi possível ler o estado do arquivo" sai como caixa .arq-ausente.nm', () => {
    const m = montarPagina(paginaVazia(), liga); m.resumo = { texto: 'Não foi possível ler o estado do arquivo', forma: 'hachura' }
    render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    expect(document.querySelector('p.arq-ausente.nm')?.textContent).toBe('Não foi possível ler o estado do arquivo')
  })
})

describe('N2: um desenho só para o octógono', () => {
  it('o octógono da régua e o do aviso do banco têm o "!" (nenhum com X)', async () => {
    const { FormaBl } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco/formas')
    const { FormaIcone } = await import('@/app/cms/(authed)/youtube/competitors/_arquivo/regua')
    const a = render(<FormaBl forma="octogono" />).container.innerHTML.replace(/ class="[^"]*"| width="16"| height="16"| aria-hidden="true"| focusable="false"/g, '')
    const b = render(<FormaIcone forma="octogono" />).container.innerHTML.replace(/ class="[^"]*"| width="16"| height="16"| aria-hidden="true"| focusable="false"/g, '')
    const caminhos = (h: string): string[] => [...h.matchAll(/ d="([^"]*)"/g)].map(x => x[1]!)
    expect(caminhos(a)).toEqual(caminhos(b))
    expect(caminhos(a).join(' ')).not.toContain('M5.6 5.6')
  })
  it('nenhum arquivo da M5 declara cor própria --arq-*', async () => {
    const { readFileSync } = await import('node:fs')
    const C = 'src/app/cms/(authed)/youtube/competitors'
    for (const f of [`${C}/_arquivo/arquivo.css`, `${C}/_canais/esperam-comandos.css`, `${C}/_chrome/aviso-banco/aviso-banco.css`]) {
      const css = readFileSync(f, 'utf8')
      expect(css, f).not.toMatch(/--arq-(ok|am|vm|fio)/)
      expect(css, f).not.toContain('rgba(229,156,192,.14)')
    }
  })
})
