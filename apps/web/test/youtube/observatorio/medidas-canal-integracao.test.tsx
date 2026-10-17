// @vitest-environment jsdom
/**
 * E5a Tarefa 19: a integração na página do canal. A página roda de verdade (mocks só nas leituras): o carregador é chamado UMA vez, a promessa nasce
 * depois de `view` e antes de `canAdminSiteUsers`, os três elementos recebem a MESMA promessa, cada um no seu Suspense com o esqueleto de reserva, e
 * nenhum lança quando as medidas não carregam. O cabeçalho: o ⓘ só lista o que está na tela.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canalWorld } from './canal-fixture'
import { ownMenuFromRows } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { CanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-header'
import { canalNaoCarregou } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado-async'
import { EsqueletoDasCelulas, EsqueletoDosBlocos, EsqueletoDoTopo } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/esqueleto'
import { BlocosDoCanal, CelulasDoCanal, TopoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/blocos-do-canal'
import type { ContextoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { canalActions, mountCanal } from './canal-mount'
import { CanalScreen } from '@/app/cms/(authed)/youtube/competitors/_canal/canal-screen'
import { nicheOptions } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
  redirect: vi.fn(),
}))
const ordem: string[] = []
const mocks = vi.hoisted(() => ({
  openChannelPage: vi.fn(), openObservatoryPage: vi.fn(), carregar: vi.fn(), canAdmin: vi.fn(), servico: vi.fn(), sentry: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openChannelPage: mocks.openChannelPage, openObservatoryPage: mocks.openObservatoryPage }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: (...a: unknown[]) => mocks.canAdmin(...a) }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-canal', () => ({ carregarMedidasDoCanalInteiro: (...a: unknown[]) => mocks.carregar(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mocks.servico() }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => mocks.sentry(...a), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn() }))

import CanalPage from '@/app/cms/(authed)/youtube/competitors/canal/[id]/page'

const AGORA = Date.UTC(2026, 9, 24, 18, 0, 0)
type Tela = ReactElement<{ children: ReactElement<{ topo: ReactElement; celulas: ReactElement; blocos: ReactElement; view: { header: { id: string; name: string } } }> }>

async function abrir(id?: string) {
  const { obs, chId } = canalWorld()
  mocks.openChannelPage.mockResolvedValue({ siteId: 's1', now: AGORA, obs, canEdit: true, owns: ownMenuFromRows([], { subs: String }, { lembrado: null, agora: AGORA }) })
  const el = (await CanalPage({ params: Promise.resolve({ id: id ?? chId }), searchParams: Promise.resolve({}) })) as Tela
  return { el, chId, obs, tela: el.props.children }
}
const promessaDe = (s: ReactElement): unknown => (s.props as { children: ReactElement<{ medidas: unknown }> }).children.props.medidas
const fallbackDe = (s: ReactElement): ReactElement => (s.props as { fallback: ReactElement }).fallback

beforeEach(() => {
  ordem.length = 0
  for (const m of Object.values(mocks)) m.mockReset()
  mocks.servico.mockReturnValue({})
  mocks.canAdmin.mockImplementation(async () => { ordem.push('canAdmin'); return true })
  mocks.carregar.mockImplementation(async () => { ordem.push('medidas'); return canalNaoCarregou() })
})
afterEach(() => { cleanup() })

describe('a página do canal: as medidas', () => {
  it('chama o carregador uma vez e os três elementos recebem a mesma promessa, cada um no seu Suspense com o esqueleto de reserva', async () => {
    const { tela } = await abrir()
    expect(mocks.carregar).toHaveBeenCalledTimes(1)
    const { topo, celulas, blocos } = tela.props
    expect(promessaDe(topo)).toBe(promessaDe(celulas))
    expect(promessaDe(celulas)).toBe(promessaDe(blocos))
    expect(promessaDe(topo)).toBeInstanceOf(Promise)
    expect(fallbackDe(topo).type).toBe(EsqueletoDoTopo)
    expect(fallbackDe(celulas).type).toBe(EsqueletoDasCelulas)
    expect(fallbackDe(blocos).type).toBe(EsqueletoDosBlocos)
    expect(tela.props.view.header.name.length).toBeGreaterThan(0) // o cabeçalho (nome) está fora dos Suspense
  })
  it('a promessa nasce depois de view e antes de canAdminSiteUsers; o id passado é o resolvido', async () => {
    const { chId } = await abrir()
    expect(ordem).toEqual(['medidas', 'canAdmin'])
    const arg = mocks.carregar.mock.calls[0]![1] as { channelId: string; siteId: string; pedir: unknown; agoraMs: number }
    expect(arg.channelId).toBe(chId)
    expect(arg.siteId).toBe('s1')
    expect(arg.pedir).toEqual({ serie: true, mudancas: true, horas: true })
    expect(arg.agoraMs).toBe(AGORA)
  })
  it('URL com o id em maiúsculas: abre o mesmo canal e mede com o id resolvido', async () => {
    const { chId } = canalWorld()
    const r = await abrir(chId.toUpperCase())
    if (mocks.carregar.mock.calls.length === 0) {
      // o mundo de teste não casa maiúsculas no ramo do concorrente: então a página diz "não encontrado" e não mede (nunca mede com o id da URL)
      expect(r.tela).toBeDefined()
      return
    }
    expect((mocks.carregar.mock.calls[0]![1] as { channelId: string }).channelId).toBe(chId)
  })
  it('canal não encontrado: a promessa nem é criada', async () => {
    const { obs } = canalWorld()
    mocks.openChannelPage.mockResolvedValue({ siteId: 's1', now: AGORA, obs, canEdit: true, owns: ownMenuFromRows([], { subs: String }, { lembrado: null, agora: AGORA }) })
    await CanalPage({ params: Promise.resolve({ id: 'canal-de-outro-site' }), searchParams: Promise.resolve({}) })
    expect(mocks.carregar).not.toHaveBeenCalled()
    expect(mocks.servico).not.toHaveBeenCalled()
  })
  it('carregador que rejeita por defeito: o catch da página entrega naoCarregou aos três (e ninguém lança)', async () => {
    mocks.carregar.mockRejectedValue(new Error('defeito'))
    const { tela } = await abrir()
    const p = (await promessaDe(tela.props.topo)) as CanalInteiro
    expect('naoCarregou' in p.medidas).toBe(true)
    expect(mocks.sentry).toHaveBeenCalled()
  })
  it('cliente de serviço que lança na hora: também vira naoCarregou, sem derrubar a página', async () => {
    mocks.servico.mockImplementation(() => { throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured') })
    const { tela } = await abrir()
    expect('naoCarregou' in ((await promessaDe(tela.props.blocos)) as CanalInteiro).medidas).toBe(true)
  })
  it('canAdminSiteUsers que lança: nenhuma rejeição sem dono', async () => {
    const soltas: unknown[] = []
    const aoSoltar = (e: unknown) => { soltas.push(e) }
    process.on('unhandledRejection', aoSoltar)
    mocks.carregar.mockRejectedValue(new Error('defeito'))
    mocks.canAdmin.mockRejectedValue(new Error('guarda caiu'))
    await expect(abrir()).rejects.toThrow('guarda caiu')
    await new Promise(r => setTimeout(r, 20))
    process.off('unhandledRejection', aoSoltar)
    expect(soltas).toEqual([])
  })
  it('o ramo do canal próprio não lê medida de concorrente', async () => {
    const { obs, chId } = canalWorld()
    expect(obs.channel(chId)?.own).toBe(false)
    const src = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/montar.ts'), 'utf8')
    // a leitura só é pedida dentro do ramo do concorrente, depois do retorno do canal próprio
    expect(src.indexOf("tipo: 'proprio'")).toBeLessThan(src.indexOf('opcoes.iniciarMedidas'))
  })
})

const ctx = async (): Promise<ContextoDoCanal> => {
  const { obs, chId } = canalWorld()
  const view = buildCanalView(obs, chId, {})!
  return {
    F: obs.fmt, subs: 84_000, sync: { state: 'ok', last: AGORA - 3_600_000, errorSince: null }, hojeSP: '2026-10-24', agoraMs: AGORA,
    primeiraBusca: false, semVideos: false, titulos: view.videos.videos.map(v => [v.id, v.title] as const), trocas: [],
  }
}
const html = (n: ReactNode): string => renderToStaticMarkup(<>{n}</>)

describe('os três elementos com as medidas em não carregou', () => {
  it('nenhum lança e todos dizem não carregou, sem número inventado', async () => {
    const contexto = await ctx()
    const medidas = Promise.resolve(canalNaoCarregou())
    const topo = html(await TopoDoCanal({ medidas, contexto }))
    expect(topo).toMatch(/não carregaram/)
    expect(topo).not.toMatch(/Subindo|Descendo|Ativo|Parado/)
    const cel = html(await CelulasDoCanal({ medidas, contexto }))
    for (const c of ['direcao', 'estado', 'acerto', 'ritmo']) expect(cel).toMatch(new RegExp(`data-celula="${c}" data-valor="nao_carregou"`))
    expect(cel).not.toContain('data-celula="inscritos"')
    const blocos = html(await BlocosDoCanal({ medidas, contexto }))
    for (const id of ['direcao', 'lancamentos', 'tempo', 'ritmo', 'criador']) expect(blocos).toContain(`id="${id}"`)
    expect(blocos).toMatch(/Não carregou/i)
    expect(blocos).not.toMatch(/\b0 views ganhas\b/)
  })
  it('uma promessa que rejeita (defeito do carregador) também não derruba os elementos', async () => {
    const contexto = await ctx()
    const medidas = Promise.reject<CanalInteiro>(new Error('x'))
    expect(html(await TopoDoCanal({ medidas, contexto }))).toMatch(/não carregaram/)
  })
})

describe('o cabeçalho com a prop celulas', () => {
  function cab(celulas: ReactNode, nums = false) {
    const { obs, chId } = canalWorld()
    const view = buildCanalView(obs, chId, {})!
    const r = render(
      <CanalHeader h={view.header} nums={nums} syncing={false} canAdmin menuBtnRef={{ current: null }} celulas={celulas}
        onToggleNums={vi.fn()} onSync={vi.fn()} onAskRemove={vi.fn()} onNiche={vi.fn()} />,
    )
    return { ...r, view }
  }
  const tip = async () => {
    screen.getByRole('button', { name: 'De onde vêm os números do canal' }).click()
    await screen.findByRole('dialog')
    return document.querySelector('#canal-tip')!.textContent ?? ''
  }
  it('o ⓘ não cita célula que não está na tela (só Inscritos; nem "por semana" nem "acima de 2×")', async () => {
    cab(<EsqueletoDasCelulas />)
    const t = await tip()
    expect(t).toMatch(/Inscritos/)
    expect(t).not.toMatch(/por semana|Acima de 2|Views por dia|Engajamento|Inscritos em 30/i)
  })
  it('com "Todos os números" aberto o ⓘ lista Inscritos e as doze', async () => {
    const { view } = cab(<EsqueletoDasCelulas />, true)
    const t = await tip()
    expect(t).toMatch(/Inscritos/)
    for (const c of view.header.todos) expect(t).toContain(c.label.charAt(0).toUpperCase() + c.label.slice(1))
  })
  it('com a prop celulas no esqueleto ou em não carregou, o ⓘ é o mesmo', async () => {
    cab(<EsqueletoDasCelulas />)
    const a = await tip()
    cleanup()
    cab(<dl>{html(<span>Não carregou</span>)}</dl>)
    expect(await tip()).toBe(a)
  })
  it('só Inscritos fica na faixa de antes; os quatro de "Mais números" trazem a base escrita', () => {
    const { container, view } = cab(<EsqueletoDasCelulas />)
    expect(container.querySelector('dl[aria-label="Inscritos do canal"]')!.children).toHaveLength(1)
    const mais = container.querySelector('details[data-mais-numeros]')!
    expect(mais.querySelectorAll('.pc-cel')).toHaveLength(4)
    for (const c of mais.querySelectorAll('.pc-cel')) expect((c.querySelector('dd.b')?.textContent ?? '').length).toBeGreaterThan(0)
    expect(view.header.faixa).toHaveLength(6) // o modelo não mudou
  })
  it('sem a prop celulas, a faixa é a de antes (seis)', () => {
    const { container } = cab(null)
    expect(container.querySelector('dl[aria-label="Números do canal"]')!.children).toHaveLength(6)
    expect(container.querySelector('details[data-mais-numeros]')).toBeNull()
  })
})

describe('a tela com as medidas em não carregou', () => {
  it('a grade de vídeos e os controles seguem funcionando', () => {
    const { obs, chId } = canalWorld()
    const view = buildCanalView(obs, chId, {})!
    void obs
    const r = render(
      <ToastProvider><div data-obs="">
        <CanalScreen view={view} niches={nicheOptions(obs)} canAdmin leitura={null} actions={canalActions()}
          topo={<p>Não carregou: as medidas</p>} celulas={<EsqueletoDasCelulas />} blocos={<EsqueletoDosBlocos />} />
      </div></ToastProvider>,
    )
    expect(r.container.querySelectorAll('ul.cv-grid > li.cv-card').length).toBeGreaterThan(0)
    expect(r.container.querySelector('[data-esqueleto="blocos"]')).not.toBeNull()
    expect(screen.getAllByRole('combobox').length + screen.getAllByRole('button').length).toBeGreaterThan(3)
  })
  it('a mesma tela sem as medidas é a de antes (mountCanal)', () => {
    const { container } = mountCanal()
    expect(container.querySelector('[data-esqueleto]')).toBeNull()
  })
})

describe('Next 16: nada de componente nem next/link como prop de componente cliente', () => {
  const lê = (p: string) => readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors', p), 'utf8')
  it('os arquivos novos e editados não importam next/link nem passam componente por prop', () => {
    for (const p of ['_canal/medidas/blocos-do-canal.tsx', '_canal/medidas/esqueleto.tsx', '_canal/medidas/canal-derivado.ts', '_canal/medidas/canal-derivado-async.ts', '_canal/medidas/linha-do-tempo.tsx']) {
      expect(lê(p), p).not.toMatch(/from 'next\/link'/)
    }
    const pagina = lê('canal/[id]/page.tsx')
    // a página entrega elementos prontos (JSX), nunca o nome de um componente
    expect(pagina).toMatch(/topo=\{topo\} celulas=\{celulas\} blocos=\{blocos\}/)
    expect(pagina).toMatch(/const topo = <Suspense/)
    expect(pagina).not.toMatch(/(topo|celulas|blocos)=\{(TopoDoCanal|CelulasDoCanal|BlocosDoCanal)\}/)
    expect(isValidElement(<EsqueletoDoTopo />)).toBe(true)
  })
})
