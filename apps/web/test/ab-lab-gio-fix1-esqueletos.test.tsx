// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { FichaEsqueleto } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/ficha-esqueleto'
import { ListaEsqueleto } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-esqueleto'

afterEach(() => cleanup())
const css = (nome: string): string => readFileSync(resolve(__dirname, '../src/app/cms/(authed)/youtube/ab-lab/_components', nome), 'utf8')

describe('Gio F-5: ficha carregando como no mockup', () => {
  it('cabeçalho real, frase de estado com apoio, esqueleto, "Carregando a ficha…" e Fechar', () => {
    const fechar = vi.fn()
    const { container } = render(<FichaEsqueleto l={{ titulo: 'Rota 66, dia 4', miniaturaUrl: null }} fechar={fechar} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Rota 66, dia 4')
    expect(screen.getByText(FRASES.ficha.carregando.frase)).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.carregando.apoio!)).toBeTruthy()
    expect(screen.getByText(FRASES.ficha.carregandoMeta)).toBeTruthy()
    expect(container.querySelector('.cn-fsk')).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')?.textContent).toContain(FRASES.ficha.carregandoMeta)
    fireEvent.click(screen.getByRole('button', { name: /Fechar a ficha/ }))
    expect(fechar).toHaveBeenCalledTimes(1)
  })
  it('o esqueleto da ficha tem a altura medida (--cn-hf)', () => {
    expect(css('ficha-teste.css')).toMatch(/\.cn-fsk \{ height: var\(--cn-hf\)/)
  })
})

describe('Gio F-2: o esqueleto da lista tem altura fixa, com ou sem cabeçalhos de grupo', () => {
  it('Naksu U-3: a altura vem do número de linhas (128 px larga, 220 px estreita), sem altura de região nem linhas esticadas', () => {
    const l = css('lista-caminho.css')
    expect(l).toMatch(/\[data-skel-linha\] \{ flex: none; height: 128px;/)
    expect(l).toMatch(/@container \(max-width: 640px\) \{ \.cn-lsk \[data-skel-linha\] \{ height: 220px; \} \}/)
    expect(l).not.toMatch(/--cn-hs/)
    expect(l).not.toMatch(/flex: 1 1 0/)
    expect(css('caminho-nativo.css')).not.toMatch(/--cn-hs/)
  })
  it('a lista e a frase ficam dentro do invólucro de altura fixa', () => {
    const { container } = render(<ListaEsqueleto />)
    const esq = container.querySelector('.cn-esq')!
    expect(esq.querySelector('.cn-sum')).toBeTruthy()
    expect(esq.querySelector('[data-skel-lista]')).toBeTruthy()
  })
})
