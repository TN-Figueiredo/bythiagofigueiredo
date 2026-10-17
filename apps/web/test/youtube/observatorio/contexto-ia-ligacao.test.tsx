// @vitest-environment jsdom
/**
 * A5 · E17 degrau 1, Tarefa 11: a ligação do botão "Perguntar a uma IA" às telas. O padrão é DESLIGADO (`ligado: false`): sem a constante preenchida
 * nada aparece, nem a faixa nova das telas raiz. Os testes que mostram o botão simulam `ligado: true`; os de "valor real" leem a constante de verdade.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildChromeView } from '@/app/cms/(authed)/youtube/competitors/_chrome/view-model'
import { E17_D1_DEPLOY } from '@/lib/conferencias'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const modo = vi.hoisted(() => ({ real: false, ligado: true }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/contexto-ia/regras')>()
  return { ...m, CONTEXTO_IA_RULES: new Proxy(m.CONTEXTO_IA_RULES, { get: (t, k) => (k === 'ligado' && !modo.real ? modo.ligado : Reflect.get(t, k)) }) }
})
vi.mock('@/lib/cms/site-admin-context', async (orig) => ({ ...(await orig<typeof import('@/lib/cms/site-admin-context')>()), useCanAdminSite: () => true }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams(''),
}))

import { TrailChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome'
import { ObservatoryChrome } from '@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome'

const crumbs = [{ text: 'Canais', href: '/cms/youtube/competitors' }, { text: 'Leo Khev' }]
const onGerar = vi.fn()
const pi = (tela: TelaId = 'canal', id?: string) => ({ tela, id, nomeDaTela: TELAS_IA[tela].nome, exemplos: TELAS_IA[tela].exemplos, onGerar })
const BOTAO = /Perguntar a uma IA/
const obs = createObservatory(datasetFromOracle(loadOracle()))

beforeEach(() => { modo.real = false; modo.ligado = true })
afterEach(cleanup)

describe('TrailChrome', () => {
  it('sem a prop não mostra o botão', () => {
    render(<TrailChrome crumbs={crumbs}><p>x</p></TrailChrome>)
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
  })
  it('com a prop mostra o botão, depois da nota de fuso na ordem do DOM, dentro da linha da trilha', () => {
    const { container } = render(<TrailChrome crumbs={crumbs} perguntarIa={pi('canal', 'x')}><p>x</p></TrailChrome>)
    const botao = screen.getByRole('button', { name: BOTAO })
    const tz = screen.getByText('Horários em São Paulo')
    expect(tz.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('.obs-tr-top')!.contains(botao)).toBe(true)
  })
  it('com ligado falso (simulado) e com a prop: nenhum botão', () => {
    modo.ligado = false
    render(<TrailChrome crumbs={crumbs} perguntarIa={pi()}><p>x</p></TrailChrome>)
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
  })
  it('com o valor real da constante, sem simular e com a prop: o botão segue E17_D1_DEPLOY (nula: ausente)', () => {
    modo.real = true
    render(<TrailChrome crumbs={crumbs} perguntarIa={pi()}><p>x</p></TrailChrome>)
    expect(screen.queryByRole('button', { name: BOTAO }) !== null).toBe(E17_D1_DEPLOY !== null)
  })
})

describe('ObservatoryChrome', () => {
  const view = () => buildChromeView(obs, { tab: 'canais', niche: 'todos' })
  it('sem a prop: nenhuma faixa nova e nenhum botão', () => {
    const { container } = render(<ObservatoryChrome view={view()}><div>tela</div></ObservatoryChrome>)
    expect(container.querySelector('.obs-ch-content > .obs-tr-top')).toBeNull()
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
  })
  it('com a prop e ligado: a faixa é a primeira linha do corpo, com o botão', () => {
    const { container } = render(<ObservatoryChrome view={view()} perguntarIa={pi('canais')}><div>tela</div></ObservatoryChrome>)
    const corpo = container.querySelector('.obs-ch-content')!
    expect(corpo.firstElementChild!.classList.contains('obs-tr-top')).toBe(true)
    expect(corpo.firstElementChild!.querySelector('button')!.textContent).toMatch(BOTAO)
  })
  it('com ligado falso (simulado), a faixa nova das telas raiz não é desenhada (nada de faixa vazia)', () => {
    modo.ligado = false
    const { container } = render(<ObservatoryChrome view={view()} perguntarIa={pi('canais')}><div>tela</div></ObservatoryChrome>)
    expect(container.querySelector('.obs-tr-top')).toBeNull()
  })
  it('com o valor real da constante, sem simular e com a prop: a faixa e o botão seguem E17_D1_DEPLOY (nula: ausentes)', () => {
    modo.real = true
    const { container } = render(<ObservatoryChrome view={view()} perguntarIa={pi('canais')}><div>tela</div></ObservatoryChrome>)
    expect(container.querySelector('.obs-tr-top') !== null).toBe(E17_D1_DEPLOY !== null)
    expect(screen.queryByRole('button', { name: BOTAO }) !== null).toBe(E17_D1_DEPLOY !== null)
  })
})

// ───────────────────────── leitura do código-fonte das páginas
const RAIZ = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const lerPagina = (rel: string): string => readFileSync(resolve(RAIZ, rel), 'utf8')

/** Pedaços de JSX que abrem um dos dois chromes, de `<` até o `>` que fecha a abertura. */
function aberturasDoChrome(fonte: string): string[] {
  const achados: string[] = []
  const re = /<(ObservatoryChromeServer|TrailChrome)\b/g
  for (let m = re.exec(fonte); m; m = re.exec(fonte)) {
    let fundo = 0
    let i = m.index
    for (; i < fonte.length; i++) {
      const c = fonte[i]
      if (c === '{') fundo++
      else if (c === '}') fundo--
      else if (c === '>' && fundo === 0) break
    }
    achados.push(fonte.slice(m.index, i + 1))
  }
  return achados
}

const PAGINAS: Array<[TelaId, string]> = [
  ['canais', 'page.tsx'], ['mudancas', 'mudancas/page.tsx'], ['outliers', 'outliers/page.tsx'], ['insights', 'insights/page.tsx'], ['comparar', 'comparar/page.tsx'], ['fila', 'saiu/page.tsx'],
]

describe('as páginas passam perguntarIa ao chrome (leitura do código-fonte)', () => {
  for (const [tela, rel] of PAGINAS) {
    it(`${rel}: o chrome recebe perguntarIa com a tela "${tela}"`, () => {
      const aberturas = aberturasDoChrome(lerPagina(rel))
      expect(aberturas).toHaveLength(1)
      expect(aberturas[0]).toMatch(/perguntarIa=\{/)
      expect(aberturas[0]).toContain(`'${tela}'`)
    })
  }
  it('canal/[id]/page.tsx: o canal próprio e o de concorrente passam; "não encontrado" e "sem vídeos" não', () => {
    const fonte = lerPagina('canal/[id]/page.tsx')
    const a = aberturasDoChrome(fonte)
    const comProp = a.filter((x) => /perguntarIa=\{/.test(x))
    const semProp = a.filter((x) => !/perguntarIa=\{/.test(x))
    expect(comProp).toHaveLength(2)
    expect(comProp.some((x) => x.includes("'canal-proprio'"))).toBe(true)
    expect(comProp.some((x) => x.includes("'canal'"))).toBe(true)
    expect(semProp).toHaveLength(2)
    expect(semProp.some((x) => x.includes('Canal não encontrado'))).toBe(true)
    expect(semProp.some((x) => x.includes('m.proprio.name') || x.includes('proprio.name'))).toBe(true)
  })
  it('video/[id]/page.tsx: o vídeo próprio e o de concorrente passam; o "não encontrado" do Histórico não', () => {
    const fonte = lerPagina('video/[id]/page.tsx')
    const a = aberturasDoChrome(fonte)
    expect(a.filter((x) => /perguntarIa=\{/.test(x)).some((x) => x.includes("'video-proprio'"))).toBe(true)
    expect(fonte).toMatch(/view\.notFound/)
    expect(fonte).toMatch(/perguntarIa=\{view\.notFound/)
  })
  it('controle negativo: o leitor de aberturas acha a prop num trecho com ela e não num sem ela', () => {
    expect(aberturasDoChrome('<TrailChrome crumbs={[{a:1}]} perguntarIa={x}>')[0]).toMatch(/perguntarIa/)
    expect(aberturasDoChrome('<TrailChrome crumbs={[{a:1}]} owns={o}>')[0]).not.toMatch(/perguntarIa/)
  })
})

describe('o botão não recebe a ação por import', () => {
  it('nenhum arquivo de _chrome/perguntar-ia importa contexto-ia-actions, nem tipo', () => {
    const pasta = resolve(RAIZ, '_chrome/perguntar-ia')
    for (const nome of ['botao.tsx', 'dialogo.tsx', 'previa.tsx', 'barra-de-tamanho.tsx', 'regua-dos-numeros.tsx', 'linhas-de-fora.tsx', 'info.tsx', 'use-pacote.ts', 'frases-do-dialogo.ts']) {
      expect(readFileSync(resolve(pasta, nome), 'utf8'), nome).not.toMatch(/contexto-ia-actions/)
    }
  })
  it('os chromes não importam a ação (ela chega por prop da página)', () => {
    for (const rel of ['_chrome/trail-chrome.tsx', '_chrome/observatory-chrome.tsx', '_chrome/chrome-server.tsx']) {
      expect(lerPagina(rel), rel).not.toMatch(/contexto-ia-actions/)
    }
  })
})
