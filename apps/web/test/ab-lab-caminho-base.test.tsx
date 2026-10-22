// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { SeloCaminho, type TipoSelo } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/selo-caminho'
import { ChipVersao } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/chip-versao'
import { AvisoResolucao } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/aviso-resolucao'
import { FaixaCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/faixa-caminho'

const BASE = 'src/app/cms/(authed)/youtube/ab-lab/_components/'
const css = readFileSync(`${BASE}caminho-nativo.css`, 'utf8')
afterEach(cleanup)

const TIPOS: TipoSelo[] = ['yt', 'yts', 'warn', 'ok', 'unk', 'dim', 'mute-neq', 'mute-late', 'pen', 'resb']

describe('SeloCaminho', () => {
  it.each(TIPOS)('%s: SVG aria-hidden e texto', (tipo) => {
    const { container } = render(<SeloCaminho tipo={tipo}>Palavra</SeloCaminho>)
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(container.textContent).toBe('Palavra')
  })
  it('sem vencedor usa a classe mute (cinza), não yt', () => {
    const { container } = render(<SeloCaminho tipo="mute-neq">Sem vencedor</SeloCaminho>)
    const el = container.querySelector('.cn-selo')
    expect(el?.classList.contains('mute')).toBe(true)
    expect(el?.classList.contains('yt')).toBe(false)
  })
})

describe('ChipVersao', () => {
  it('mostra a letra e aria-label em português', () => {
    render(<ChipVersao letra="B" />)
    expect(screen.getByLabelText('Versão B').textContent).toBe('B')
  })
  it('letra é obrigatória', () => {
    // @ts-expect-error sem letra não compila
    const el = <ChipVersao />
    expect(el).toBeTruthy()
  })
  it('não importa VChip', () => {
    const src = readFileSync(`${BASE}caminho-nativo/chip-versao.tsx`, 'utf8')
    expect(src).not.toMatch(/import[^\n]*(VChip|ab-primitives)/)
  })
})

describe('AvisoResolucao', () => {
  it('1279 × 720 é baixa, com a explicação', () => {
    render(<AvisoResolucao sujeito="enviada" medida={{ largura: 1279, altura: 720 }} />)
    expect(screen.getByText('Resolução baixa: 1279 × 720')).toBeTruthy()
    expect(screen.getByText('Abaixo de 1280 × 720 o Studio reduz todas as versões a 854 × 480. Envie uma maior.')).toBeTruthy()
  })
  it('null é "Resolução não medida"', () => {
    render(<AvisoResolucao sujeito="guardada" medida={null} />)
    expect(screen.getByText('Resolução não medida')).toBeTruthy()
  })
  it('1280 × 720 é só texto meta', () => {
    const { container } = render(<AvisoResolucao sujeito="enviada" medida={{ largura: 1280, altura: 720 }} />)
    expect(container.textContent).toBe('1280 × 720')
    expect(container.querySelector('.cn-selo')).toBeNull()
  })
})

describe('FaixaCaminho', () => {
  it('renderiza título, texto, ações e role', () => {
    render(<FaixaCaminho tom="warn" titulo="Título" role="status" acoes={<button>Ir</button>}>Texto</FaixaCaminho>)
    expect(screen.getByRole('status').textContent).toContain('Título')
    expect(screen.getByText('Texto')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ir' })).toBeTruthy()
  })
})

describe('caminho-nativo.css', () => {
  it('sem color-mix', () => { expect(css).not.toMatch(/color-mix\(/) })
  it('sem opacity', () => { expect(css).not.toMatch(/opacity\s*:/) })
  it('não usa --va/--vb/--vc sem o prefixo --cn-', () => { expect(css).not.toMatch(/--v[abc]\b/) })
  it('todo token tem prefixo --cn-', () => {
    const decl = [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1])
    expect(decl.length).toBeGreaterThan(20)
    expect(decl.filter(d => !d.startsWith('--cn-'))).toEqual([])
  })
  it('tem blocos dos dois temas e alvo de 44 px no estreito', () => {
    expect(css).toContain('[data-theme="dark"] .cn-raiz')
    expect(css).toContain('[data-theme="light"] .cn-raiz')
    expect(css).toMatch(/@container \(max-width: 640px\)[\s\S]*min-height: 44px/)
  })
  it('medidas únicas --cn-hf e --cn-hl', () => {
    expect(css).toMatch(/--cn-hf: 1011px/)
    expect(css).toMatch(/--cn-hl: 1525px/)
  })
  it('títulos em Georgia e com overflow-wrap', () => {
    expect(css).toMatch(/Georgia/)
    expect(css).toMatch(/overflow-wrap: anywhere/)
  })
})
