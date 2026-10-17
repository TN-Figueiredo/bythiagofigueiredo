// @vitest-environment jsdom
// E5a T8 (mockup 17b): a tela de Outliers com as colunas de 7 e 30 dias, a faixa de cobertura, o selo e o aviso de erro.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorM1 } from '@/lib/youtube/observatorio/medidas/m1'
import { buildOutliersView, type DadosDeIdade, type EntradaDeIdade } from '@/app/cms/(authed)/youtube/competitors/_outliers/view-model'
import { OutliersScreen } from '@/app/cms/(authed)/youtube/competitors/_outliers/outliers-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { forbiddenVocabulary, noJunkText } from './audits'

const push = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/outliers',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { push.mockReset(); refresh.mockReset() })

const obs = createObservatory(datasetFromOracle(loadOracle()))
const JAN = { de: '2026-10-01', ate: '2026-10-08', dias: 7 }
const ok = (views: number): Medida<ValorM1> => medido({ views, gapHoras: 12, fonte: 'marca' }, 1, JAN)
const ids = buildOutliersView(obs, {}).groups.flatMap(g => g.cards.map(c => c.id))
const CSS = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/app/cms/(authed)/youtube/competitors/_outliers/outliers.css'), 'utf8')

function dados(v7: Record<number, Medida<ValorM1>> = {}, live: Record<number, boolean | null> = {}): DadosDeIdade {
  const m1 = new Map<string, Record<7 | 30, Medida<ValorM1>>>(), videos = new Map<string, { wasLive: boolean | null; missingSince: number | null }>()
  ids.forEach((id, i) => {
    m1.set(id, { 7: v7[i] ?? naoMedido('leitura_comecou_depois'), 30: naoMedido('fecha_em', { fechaEm: '2026-11-03' }) })
    videos.set(id, { wasLive: i in live ? live[i]! : false, missingSince: i === 9 ? 1 : null })
  })
  return { hojeSP: '2026-10-16', m1, videos, foraDoNormal: new Map() }
}
const mount = (p: Record<string, string>, e: EntradaDeIdade) => render(<ToastProvider><OutliersScreen view={buildOutliersView(obs, p, e)} /></ToastProvider>)

describe('OutliersScreen: views aos 7 e aos 30 dias', () => {
  it('a coluna ordenada leva aria-sort, o selo aparece e a faixa descreve a cobertura por extenso', () => {
    const { container } = mount({ sort: 'v7' }, dados({ 0: ok(82_400), 1: ok(0), 2: ok(300) }, { 3: true }))
    const th7 = screen.getAllByRole('columnheader', { name: /Views aos 7 dias/ })[0]!
    expect(th7.getAttribute('aria-sort')).toBe('descending')
    expect(screen.getAllByRole('columnheader', { name: /Views aos 30 dias/ })[0]!.getAttribute('aria-sort')).toBeNull()
    expect(container.querySelectorAll('.obs-out-selo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('não conta no normal do canal').length).toBe(1)
    const faixa = container.querySelector('[data-faixa-idade="7"] [role="img"]')!
    expect(faixa.getAttribute('aria-label')).toMatch(/^7 dias: 3 de 11 medidos, 1 com zero medido; 8 não medidos: 8 antes de 03\/10\. Uma casa por vídeo, na ordem da lista\.$/)
    expect(faixa.querySelectorAll('li')).toHaveLength(11)
    // célula de zero: caixa com 0 e a palavra; célula não medida: motivo escrito, nunca 0
    expect(container.querySelector('[data-estado="zero"]')!.textContent).toContain('zero medido')
    for (const c of container.querySelectorAll('[data-estado="nao"]')) expect(c.textContent).not.toMatch(/(^|\s)0(\s|$)/)
  })

  it('o vídeo que saiu do YouTube fica na lista com a marca e sem a ligação para o YouTube', () => {
    const { container } = mount({ sort: 'v7' }, dados())
    expect(container.querySelectorAll('.obs-out-saiu')).toHaveLength(1)
    const linha = container.querySelector('.obs-out-saiu')!.closest('tr')!
    expect(linha.querySelector('[data-yt]')).toBeNull()
    expect(linha.querySelector('[data-hist]')).not.toBeNull()
  })

  it('erro: aviso com "Tentar de novo", as duas opções desligadas, "não carregou" nas células e nenhum 0', () => {
    const { container } = mount({}, 'erro')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    const opts = within(screen.getByLabelText('Ordenar por')).getAllByRole('option') as HTMLOptionElement[]
    expect(opts.filter(o => o.disabled).map(o => o.textContent)).toEqual(['Ordenar: views aos 7 dias (indisponível agora)', 'Ordenar: views aos 30 dias (indisponível agora)'])
    expect(container.querySelector('[data-faixa]')).toBeNull()
    for (const c of container.querySelectorAll('[data-estado]')) expect(c.getAttribute('data-estado')).toBe('erro')
    expect(container.textContent).not.toContain('não medido')
  })

  it('decisão 75, 8a: a célula em erro é a pastilha falhou, nunca a hachura de não medido nem "não carregou"', () => {
    const { container } = mount({ sort: 'v7', view: 'list' }, 'erro')
    expect(container.querySelectorAll('[data-estado="erro"] .obs-au-falhou').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-estado="erro"] .obs-ch-nm')).toBeNull()
    expect(container.textContent).not.toMatch(/não carregou/i)
    expect(container.querySelector('[data-estado="erro"] [role="alert"]')).toBeNull()
  })

  it('nenhum medido: o botão volta ao multiplicador e a frase diz quando fecha', () => {
    mount({ sort: 'v30' }, dados())
    expect(screen.getByText(/Nenhum/).closest('span')!.textContent).toContain('a primeira medida fecha em 03/11 (faltam 18 dias)')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao multiplicador (padrão)' }))
    expect(push).toHaveBeenCalledTimes(1)
    expect(push.mock.calls[0]![0]).not.toContain('sort=')
  })

  it('escolher a ordem navega para o href da opção', () => {
    mount({}, dados({ 0: ok(5) }))
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'v7' } })
    expect(push.mock.calls[0]![0]).toContain('sort=v7')
  })

  it('passa as auditorias do DOM (sem texto lixo, sem vocabulário proibido) com as colunas', () => {
    const { container } = mount({ sort: 'v7' }, dados({ 0: ok(1200), 1: ok(0) }, { 2: true }))
    expect(noJunkText(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
  })

  it('abaixo de 900 px a linha vira cartão com rótulo em cada número', () => {
    const { container } = mount({ sort: 'v7' }, dados({ 0: ok(9) }))
    expect(CSS).toMatch(/@media \(max-width:900px\)\{[\s\S]*td\[data-l\]::before\{content:attr\(data-l\)/)
    const rotulos = [...container.querySelectorAll('tbody tr')[0]!.querySelectorAll('td[data-l]')].map(td => td.getAttribute('data-l'))
    expect(rotulos).toEqual(['Views por dia', 'Views aos 7 dias', 'Views aos 30 dias'])
  })

  it('sem os dados a tabela é a de antes: sem as colunas novas', () => {
    const { container } = mount({ view: 'list' }, undefined as unknown as EntradaDeIdade)
    expect(container.querySelector('[data-cel]')).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /Views aos 7 dias/ })).toBeNull()
  })
})
