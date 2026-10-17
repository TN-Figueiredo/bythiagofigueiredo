// @vitest-environment jsdom
// Decisão 75, Task 6: as telas do canal próprio e da página do vídeo desenham a forma do SEU estado. `negado` com a prova `sem_direito` = restrito (cadeado);
// `erro` e guarda de permissão caída = falhou (triângulo); sem relatório = a hachura de sempre. Um `role=status` por lista (nunca 40), zero `role=alert`.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { proprioWorld, type CenarioDados } from './proprio-fixture'
import { urlDoTeste, type Mundo } from './proprio-mount'
import { buildProprioView } from '@/app/cms/(authed)/youtube/competitors/_proprio/view-model'
import { posicaoDoSite } from '@/app/cms/(authed)/youtube/competitors/_proprio/posicao-do-site'
import { ProprioScreen } from '@/app/cms/(authed)/youtube/competitors/_proprio/proprio-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import type { NegativaPrivada } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/estado'
import { VideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { LinhaDasTrocas, Trocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas'
import { buildTrocas, FRASE_TESTE_RESTRITO } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { alcance, base, comAlcance, entrada, HOJE, teste, versao } from './proprio-trocas-fixture'
import { mundoVideo } from './proprio-video-fixture'
import { AssistidoPeriodos } from '@/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodos'
import { buildAssistidoPeriodos, type EntradaAssistido } from '@/app/cms/(authed)/youtube/competitors/_proprio/assistido-periodo-model'
import type { NormalDoPeriodo, PeriodoAssistido } from '@/lib/youtube/observatorio/proprio/assistido-periodo'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/x',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
})
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.unstubAllGlobals() })

function tela(cenario: CenarioDados, negativa: NegativaPrivada, sp: Record<string, string | undefined> = {}) {
  const w: Mundo = proprioWorld({ cenario })
  urlDoTeste(sp)
  const { posicao, concorrenteAcima } = posicaoDoSite(w.obs, w.canalId)
  const view = buildProprioView(w.obs, w.canalId, sp, w.dados, { hoje: w.hoje, dm: w.dm, posicao, concorrenteAcima, muitosProprios: w.obs.ownChannels().length > 1, negativa })
  if (!view) throw new Error('o canal devia ter página')
  return render(<ToastProvider><div data-obs=""><ProprioScreen view={view} /></div></ToastProvider>)
}
const LISTA = { tab: 'videos', ver: 'lista' }

describe('cabeçalho e tabela do canal próprio', () => {
  it('negado com sem_direito: cadeado no cabeçalho e na coluna de impressões; nenhum "não medido" nas células de alcance', () => {
    const { container } = tela('negado', 'sem_direito', LISTA)
    expect(container.querySelectorAll('.nstrip .obs-au-restrito').length).toBeGreaterThan(0)
    const imp = [...container.querySelectorAll('td[data-label="Impressões"]')]
    expect(imp.length).toBeGreaterThan(0)
    for (const td of imp) { expect(td.querySelector('.obs-au-restrito')).not.toBeNull(); expect(td.querySelector('.obs-ch-nm')).toBeNull() }
    expect(container.querySelector('.obs-au-falhou')).toBeNull()
  })
  it('negado com a guarda de permissão caída (nao_foi_possivel_conferir): falhou, NUNCA cadeado', () => {
    const { container } = tela('negado', 'nao_foi_possivel_conferir', LISTA)
    expect(container.querySelector('.obs-au-restrito')).toBeNull()
    expect(container.querySelectorAll('.obs-au-falhou').length).toBeGreaterThan(0)
  })
  it('erro: falhou no cabeçalho e na tabela; UM role=status na lista (não um por linha), zero role=alert', () => {
    const { container } = tela('erro', null, LISTA)
    expect(container.querySelectorAll('.nstrip .obs-au-falhou').length).toBeGreaterThan(0)
    const tabela = container.querySelector('.cv-tw')!
    expect(tabela.querySelectorAll('tbody tr.cv-row').length).toBeGreaterThan(5)
    expect(tabela.querySelectorAll('td[data-label="Impressões"] .obs-au-falhou').length).toBeGreaterThan(5)
    expect(tabela.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })
  it('sem relatório (alcance lido vazio): a hachura de sempre, nenhuma forma nova', () => {
    const { container } = tela('vazio', null, LISTA)
    expect(container.querySelector('.obs-au-falhou, .obs-au-restrito')).toBeNull()
    expect(container.querySelector('.obs-ch-nm')).not.toBeNull()
  })
  it('cartões (vista Capas): a impressão ausente leva a pastilha da forma certa', () => {
    expect(tela('negado', 'sem_direito', { tab: 'videos' }).container.querySelectorAll('.cv-card .obs-au-restrito').length).toBeGreaterThan(0)
    cleanup()
    expect(tela('erro', null, { tab: 'videos' }).container.querySelectorAll('.cv-card .obs-au-falhou').length).toBeGreaterThan(0)
  })
})

describe('página do vídeo', () => {
  const W = mundoVideo({})
  const montar = (acesso: 'negado' | 'erro', negativa: NegativaPrivada) =>
    render(<div data-obs-screen="video-proprio"><VideoBlocos view={buildVideoBlocos({ obs: W.obs, videoId: W.foco.id, dados: { acesso }, hoje: W.hoje, dm: dmDia, negativa })} /></div>)
  it('negado com sem_direito: a nota única e a retenção levam o cadeado; nenhuma classe vb-falhou', () => {
    const { container } = montar('negado', 'sem_direito')
    expect(container.querySelector('.vb-nml.vb-privado .obs-au-restrito')).not.toBeNull()
    expect(container.querySelector('#vb-ret-h')!.closest('section')!.querySelector('.obs-au-restrito')).not.toBeNull()
    expect(container.querySelector('.vb-falhou')).toBeNull()
  })
  it('erro e guarda caída: falhou na nota e na retenção, nunca cadeado', () => {
    for (const [a, n] of [['erro', null], ['negado', 'nao_foi_possivel_conferir']] as const) {
      const { container } = montar(a, n)
      expect(container.querySelector('.vb-nml.vb-privado .obs-au-falhou'), a).not.toBeNull()
      expect(container.querySelector('#vb-ret-h')!.closest('section')!.querySelector('.obs-au-falhou'), a).not.toBeNull()
      expect(container.querySelector('.obs-au-restrito, .vb-falhou'), a).toBeNull()
      cleanup()
    }
  })
  it('% assistido: o cartão sem número diz "restrito" (sem_direito) ou "falhou" (erro / guarda caída), com a pastilha da forma', () => {
    const sem = (periodo: PeriodoAssistido, motivo: 'sem-acesso' | 'leitura-falhou'): NormalDoPeriodo => ({ periodo, de: null, ate: null, pct: null, pctArredondado: null, views: 0, videos: 0, motivo })
    const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
    const monta = (motivo: 'sem-acesso' | 'leitura-falhou', negativa: NegativaPrivada) => {
      const e: EntradaAssistido = {
        tela: 'video', acesso: motivo === 'sem-acesso' ? 'negado' : 'erro', negativa, normais: { inteiro: sem('inteiro', motivo), '90': sem('90', motivo), '28': sem('28', motivo) },
        faixas: null, videoPct: null, buracos: { inteiro: { comBuraco: 0, naConta: 0 }, '90': { comBuraco: 0, naConta: 0 }, '28': { comBuraco: 0, naConta: 0 } },
        diarioDesde: null, ultimoDia: '2026-10-10', dm, dmy: d => `${dm(d)}/${d.slice(0, 4)}`,
      }
      return buildAssistidoPeriodos(e)
    }
    for (const [motivo, n, forma] of [['sem-acesso', 'sem_direito', 'restrito'], ['leitura-falhou', null, 'falhou'], ['sem-acesso', 'nao_foi_possivel_conferir', 'falhou']] as const) {
      const view = monta(motivo, n)
      expect(view.cartoes.every(c => c.semNumero === forma && c.ausencia === forma), motivo + n).toBe(true)
      const { container } = render(<AssistidoPeriodos view={view} />)
      expect(container.querySelectorAll('.obs-au-' + forma).length, motivo + n).toBeGreaterThan(0)
      expect(container.querySelector('.obs-ch-nm'), motivo + n).toBeNull()
      cleanup()
    }
  })
})

describe('Trocas: o teste A/B que a pessoa não abre', () => {
  const comTeste = (ex: { podeEditar: boolean; edicaoNaoConferida?: boolean }) =>
    buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE), undefined, { testes: { acesso: 'ok', dado: { testes: [teste()], descartados: 0 } } }), ex))
  const tr = (v: ReturnType<typeof comTeste>) => render(<div><LinhaDasTrocas view={v} /><Trocas view={v} /></div>)
  it('sem edição: restrito + a frase do teste restrito', () => {
    const { container } = tr(comTeste({ podeEditar: false }))
    const li = container.querySelector('li.tr-teste')!
    expect(li.querySelector('.obs-au-restrito')).not.toBeNull()
    expect(li.textContent).toContain(FRASE_TESTE_RESTRITO)
  })
  it('M4: guarda de edição caída com a leitura concedida = falhou, nunca cadeado, e sem frase de "só quem edita"', () => {
    const { container } = tr(comTeste({ podeEditar: false, edicaoNaoConferida: true }))
    expect(container.querySelector('.obs-au-restrito')).toBeNull()
    expect(container.querySelector('li.tr-teste .obs-au-falhou')).not.toBeNull()
    expect(container.textContent).not.toContain('só abre para quem edita')
  })
  it('quem edita abre o teste, sem pastilha', () => {
    const { container } = tr(comTeste({ podeEditar: true }))
    expect(container.querySelector('li.tr-teste a.tr-link')).not.toBeNull()
    expect(container.querySelector('.obs-au-restrito, .obs-au-falhou')).toBeNull()
  })
})
