// @vitest-environment jsdom
// E5b Tarefa 15: os três cartões de % assistido por período na tela (radiogroup, lembrança, URL, hachura, segurança).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import { AssistidoPeriodos } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodos'
import { BarraAssistido } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/barra-assistido'
import type { BlocoAssistido } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { buildAssistidoPeriodos, CHAVE_ASSISTIDO, type EntradaAssistido } from '../../../src/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodo-model'
import type { NormalDoPeriodo, PeriodoAssistido } from '../../../src/lib/youtube/observatorio/proprio/assistido-periodo'

let busca = ''
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(busca) }))
// o jsdom desta suíte não traz um localStorage inteiro: um armazenamento de mentira, que também sabe falhar
let store = new Map<string, string>()
let falha = false
const armazenamento = {
  getItem: (k: string) => { if (falha) throw new Error('bloqueado'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (falha) throw new Error('bloqueado'); store.set(k, v) },
  removeItem: (k: string) => { if (falha) throw new Error('bloqueado'); store.delete(k) },
}
beforeEach(() => { busca = ''; store = new Map(); falha = false; vi.stubGlobal('localStorage', armazenamento) })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.unstubAllGlobals() })

const ok = (periodo: PeriodoAssistido, pct: number, views: number): NormalDoPeriodo => ({ periodo, de: '2026-01-01', ate: '2026-10-10', pct, pctArredondado: Math.round(pct), views, videos: 20, motivo: null })
const sem = (periodo: PeriodoAssistido, motivo: NonNullable<NormalDoPeriodo['motivo']>, views = 0): NormalDoPeriodo => ({ periodo, de: null, ate: null, pct: null, pctArredondado: null, views, videos: 0, motivo })
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const entrada = (o: Partial<EntradaAssistido> = {}): EntradaAssistido => ({
  tela: 'video', acesso: 'ok',
  normais: { inteiro: ok('inteiro', 47.2, 412000), '90': ok('90', 51.1, 188000), '28': ok('28', 52.3, 60000) },
  faixas: null, videoPct: 54, buracos: { inteiro: { comBuraco: 0, naConta: 35 }, '90': { comBuraco: 0, naConta: 35 }, '28': { comBuraco: 0, naConta: 35 } },
  diarioDesde: null, ultimoDia: '2026-10-10', dm, dmy: d => `${dm(d)}/${d.slice(0, 4)}`, ...o,
})
const abrir = (o: Partial<EntradaAssistido> = {}) => render(<AssistidoPeriodos view={buildAssistidoPeriodos(entrada(o))} />)
const radios = () => screen.getAllByRole('radio')
const marcado = () => radios().find(r => r.getAttribute('aria-checked') === 'true')!.getAttribute('data-periodo')

describe('E5b T15: cartões de % assistido por período', () => {
  it('um radiogroup de três cartões; só o escolhido entra no Tab; o padrão é o canal inteiro e não há linha de lembrança', () => {
    abrir()
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    expect(radios().map(r => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(marcado()).toBe('inteiro')
    expect(screen.queryByText(/Salvo neste navegador/)).toBeNull()
  })

  it('os cartões trazem 47, 51 e 52 e as setas ▲ +4 e ▲ +5', () => {
    abrir()
    const t = radios().map(r => r.textContent)
    expect(t[0]).toContain('47%')
    expect(t[1]).toContain('51%'); expect(t[1]).toContain('▲ +4')
    expect(t[2]).toContain('52%'); expect(t[2]).toContain('▲ +5')
  })

  it('a seta troca o cartão e o conteúdo, sem navegar, e grava a escolha', async () => {
    abrir()
    expect(screen.getByText(/Acima do normal do canal inteiro/)).toBeTruthy()
    radios()[0]!.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(marcado()).toBe('90')
    expect(document.activeElement).toBe(radios()[1])
    expect(screen.getByText(/Acima do normal dos últimos 90 dias/).textContent).toContain('54% contra 51% (+3 pontos)')
    expect((store.get(CHAVE_ASSISTIDO) ?? null)).toBe('90')
    expect(screen.getByText(/Salvo neste navegador/)).toBeTruthy()
  })

  it('"Voltar ao padrão" limpa a escolha e some a linha', async () => {
    store.set(CHAVE_ASSISTIDO, '90')
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /Voltar ao padrão/ }))
    expect(marcado()).toBe('inteiro')
    expect((store.get(CHAVE_ASSISTIDO) ?? null)).toBeNull()
    expect(screen.queryByText(/Salvo neste navegador/)).toBeNull()
  })

  it('90 dias salvo: a linha de lembrança aparece', () => {
    store.set(CHAVE_ASSISTIDO, '90')
    abrir()
    expect(marcado()).toBe('90')
    expect(screen.getByText(/Salvo neste navegador/)).toBeTruthy()
  })

  it('?assistido=28 vence o salvo', () => {
    store.set(CHAVE_ASSISTIDO, '90')
    busca = 'assistido=28'
    abrir()
    expect(marcado()).toBe('28')
  })

  it('?assistido=28 sem nada salvo: sem a linha de lembrança (Yannis m-8)', () => {
    busca = 'assistido=28'
    abrir()
    expect(marcado()).toBe('28')
    expect(screen.queryByText(/Salvo neste navegador/)).toBeNull()
  })

  it('?origem=90 na URL não muda o cartão', () => {
    busca = 'origem=90'
    abrir()
    expect(marcado()).toBe('inteiro')
  })

  it('valor salvo que não existe é ignorado', () => {
    store.set(CHAVE_ASSISTIDO, '7')
    abrir()
    expect(marcado()).toBe('inteiro')
  })

  it('localStorage que lança não quebra, nem ao ler nem ao gravar', async () => {
    falha = true
    abrir()
    await userEvent.click(radios()[2]!)
    expect(marcado()).toBe('28')
  })

  it('poucas views: hachura, sem número, sem seta, e o cartão não traz "28%"', () => {
    abrir({ normais: { inteiro: ok('inteiro', 47.7, 296000), '90': ok('90', 48.7, 41000), '28': sem('28', 'poucas-views', 340) } })
    const c = radios()[2]!
    expect(c.querySelector('.obs-ch-nm')?.textContent).toBe('poucas views')
    expect(c.textContent).toContain('340 de 1.000 views')
    expect(c.textContent).not.toMatch(/[▲▼＝]|\d+%/)
  })

  it('cobertura-parcial: hachura, a frase com N de M, e o cartão não contém "poucas views"', () => {
    abrir({ normais: { inteiro: ok('inteiro', 47, 300000), '90': ok('90', 49, 40000), '28': sem('28', 'cobertura-parcial', 340) }, buracos: { inteiro: { comBuraco: 0, naConta: 35 }, '90': { comBuraco: 0, naConta: 35 }, '28': { comBuraco: 2, naConta: 34 } } })
    const c = radios()[2]!
    expect(c.querySelector('.obs-ch-nm')).not.toBeNull()
    expect(c.textContent).toContain('2 de 34 vídeos com dias sem leitura no período')
    expect(c.textContent).not.toContain('poucas views')
  })

  it('a barra do vídeo mora nos cartões e a marca do "normal" segue o período escolhido: 28 dias com poucas views não tem marca, 90 dias move a marca para o normal de 90 (Phil I3)', async () => {
    const barra: BlocoAssistido = {
      estado: 'ok', partes: [{ t: 'x' }], pctTexto: '54%', barraPct: 54, normalPct: 52, normalTexto: '52%', marcaPct: 52, rotuloAncora: 'meio',
      contra: 'Perto do normal do canal (52%).', direcao: 'na-media', semNormal: null, marcas: null, alt: '54% do vídeo assistido em média', metodo: [],
    }
    const { container } = render(<AssistidoPeriodos view={buildAssistidoPeriodos(entrada({ normais: { inteiro: ok('inteiro', 47.2, 412000), '90': ok('90', 40.4, 188000), '28': sem('28', 'poucas-views', 340) } }))} barra={barra} />)
    const marca = () => container.querySelector<HTMLElement>('.vb-as-barra s')
    // padrão (canal inteiro): o normal do canal inteiro, 47
    expect(marca()!.style.left).toBe('47%')
    await userEvent.click(radios()[2]!)  // 28 dias: poucas views, sem normal
    expect(marca()).toBeNull()
    expect(container.querySelector('.vb-as-med')).toBeNull()
    expect(container.textContent).not.toContain('Perto do normal do canal')
    await userEvent.click(radios()[1]!)  // 90 dias
    expect(marca()!.style.left).toBe('40%')
    expect(container.querySelector('.vb-as-med')!.textContent).toContain('normal do canal (90 dias): 40%')
  })

  it('a barra sem a marca (esqueleto e leitura falha) não desenha o normal', () => {
    const barra = { estado: 'ok', partes: [], pctTexto: '54%', barraPct: 54, normalPct: 52, normalTexto: '52%', marcaPct: 52, rotuloAncora: 'meio', contra: null, direcao: null, semNormal: null, marcas: null, alt: 'a', metodo: [] } as BlocoAssistido
    const { container } = render(<BarraAssistido a={barra} normal={null} />)
    expect(container.querySelector('.vb-as-barra')).not.toBeNull()
    expect(container.querySelector('.vb-as-barra s')).toBeNull()
  })

  it('poucas views no período escolhido: "Ver contra o canal inteiro" volta ao canal inteiro', async () => {
    abrir({ normais: { inteiro: ok('inteiro', 47.7, 296000), '90': ok('90', 48.7, 41000), '28': sem('28', 'poucas-views', 340) } })
    await userEvent.click(radios()[2]!)
    await userEvent.click(screen.getByRole('button', { name: 'Ver contra o canal inteiro' }))
    expect(marcado()).toBe('inteiro')
  })

  it('diário que começa depois da publicação: o primeiro cartão se chama "Desde dd/mm/aaaa"', () => {
    abrir({ diarioDesde: '2026-08-20' })
    expect(radios()[0]!.textContent).toContain('Desde 20/08/2026')
  })

  it('a aba do canal: a frase "vídeo típico" e a tabela por faixa com a coluna escolhida destacada', async () => {
    const f = (p: PeriodoAssistido, v: number) => (['ate-5', '5-a-15', 'acima-15'] as const).map(faixa => ({ faixa, normal: ok(p, v, 50000) }))
    abrir({ tela: 'canal', faixas: { inteiro: f('inteiro', 47), '90': f('90', 51), '28': f('28', 52) } })
    expect(screen.getByText(/o vídeo típico foi assistido por/).textContent).toContain('51%; no canal inteiro, 47% (+4 pontos)')
    const t = screen.getByRole('table', { name: 'Normal de % assistido por faixa de duração e por período' })
    expect(within(t).getAllByRole('row')).toHaveLength(4)
    await userEvent.click(radios()[1]!)
    expect(t.querySelectorAll('.ap-col').length).toBe(4)
    expect(t.querySelector('thead .ap-col')?.textContent).toBe('Últimos 90 dias')
  })

  it('negado: os três cartões somem, só a frase de acesso, e nenhum número no HTML', () => {
    const { container } = abrir({ acesso: 'negado', negativa: 'sem_direito', normais: { inteiro: ok('inteiro', 73.5, 73519), '90': ok('90', 73.5, 73519), '28': ok('28', 73.5, 73519) } })
    expect(container.textContent).toBe('restrito Só quem edita o site vê o % assistido.')
    expect(container.innerHTML).not.toMatch(/73519|73%|74%|title=|data-/)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('erro de leitura: role alert com a frase de falha', () => {
    abrir({ acesso: 'erro' })
    expect(screen.getByRole('alert').textContent).toBe('falhou A leitura do % assistido falhou agora; recarregue a página.')
    expect(screen.getByRole('alert').querySelector('.obs-au-falhou')).not.toBeNull()
  })

  it('o componente cliente não importa leitor, dados nem model com dado privado', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodos.tsx'), 'utf8')
    expect(src).not.toMatch(/from\s+['"][^'"]*(proprio\/ler|edicao|\/dados|dados-origem|dados-termos)/)
  })

  it('assistido-periodo.css sem color-mix(, sem z-index numérico e com alvo de 44 px', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodo.css'), 'utf8')
    expect(css).not.toContain('color-mix(')
    expect(css).not.toMatch(/z-index\s*:\s*\d/)
    expect(css).toMatch(/\.ap-c\{[^}]*min-height:44px/)
  })
})
