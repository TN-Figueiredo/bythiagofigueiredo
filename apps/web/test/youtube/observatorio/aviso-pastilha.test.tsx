// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AvisoBancoNaFaixa } from '@/app/cms/(authed)/youtube/competitors/_chrome/aviso-banco/pastilha'
import { montarAvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'
import { caso } from './fixtures/aviso-v2-casos'

afterEach(cleanup)
const montar = (id: string) => render(<div className="obs-ch-fresh-row" data-testid="faixa"><AvisoBancoNaFaixa aviso={montarAvisoV2(caso(id))} arquivoHref="/cms/youtube/competitors/arquivo" /></div>)

describe('pastilha do banco e marcas', () => {
  it('a marca de canais removidos é irmã da pastilha, não filha', () => {
    montar('v12b')
    const marca = screen.getByTestId('marca-canais-removidos'), pastilha = screen.getByTestId('pastilha-banco')
    expect(marca.contains(pastilha)).toBe(false)
    expect(pastilha.contains(marca)).toBe(false)
    expect(marca.closest('[data-testid=faixa]')).toBe(pastilha.closest('[data-testid=faixa]'))
    expect(marca.textContent).toContain('2 canais removidos pedem um comando seu')
  })
  it('sem o comando de limpeza (V12n) a marca não é desenhada', () => {
    montar('v12n')
    expect(screen.queryByTestId('marca-canais-removidos')).toBeNull()
  })
  it('a faixa quebra linha: a regra de CSS da faixa é flex-wrap nas duas larguras', () => {
    const css = readFileSync(path.join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/chrome.css'), 'utf8')
    const regras = css.split('\n').filter(l => l.includes('.obs-ch-fresh-row{'))
    expect(regras.length).toBeGreaterThanOrEqual(2)
    for (const r of regras) expect(r).toContain('flex-wrap:wrap')
  })
  it('o rótulo "chega a" é texto visível no painel, não só title', () => {
    montar('v2')
    fireEvent.click(screen.getByTestId('pastilha-banco'))
    const r = screen.getByTestId('rotulo-chega-a')
    expect(r.textContent).toContain('chega a 78% antes da próxima saída')
    expect(r.getAttribute('title')).toBeNull()
  })
  it('V1n: a linha da cópia no painel é hachura; V0: pontilhada com a data', () => {
    montar('v1n')
    fireEvent.click(screen.getByTestId('pastilha-banco'))
    expect(screen.getByTestId('linha-da-copia').getAttribute('data-forma')).toBe('hachura')
    cleanup(); montar('v0')
    fireEvent.click(screen.getByTestId('pastilha-banco'))
    expect(screen.getByTestId('linha-da-copia').textContent).toContain('A primeira cópia é a de outubro, a partir de 28/11')
  })
  it('V10: pastilha "Não medido", sem número', () => {
    montar('v10')
    expect(screen.getByTestId('pastilha-banco').textContent).toBe('Banco: Não medido')
  })
  it('V1a: "Abrir o Arquivo" aparece como link', () => {
    montar('v1a')
    fireEvent.click(screen.getByTestId('pastilha-banco'))
    expect(screen.getByRole('link', { name: 'Abrir o Arquivo' }).getAttribute('href')).toBe('/cms/youtube/competitors/arquivo')
  })
})
