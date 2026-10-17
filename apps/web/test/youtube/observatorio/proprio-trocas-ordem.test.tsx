// @vitest-environment jsdom
// T16e: a ordem das seções da página do vídeo com as trocas: a linha das trocas abre; o bloco das trocas vem logo depois de "Impressões e cliques" e antes de
// "Quanto do vídeo as pessoas assistem"; sem acesso ao vídeo (privado/erro) nem a linha nem o bloco entram.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { VideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos'
import { buildVideoBlocos } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'
import { LinhaDasTrocas, Trocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas'
import { buildTrocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { DadosDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mundoVideo } from './proprio-video-fixture'
import { alcance, base, comAlcance, entrada, HOJE, versao } from './proprio-trocas-fixture'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }))
afterEach(cleanup)

const umaFaixa = (ds: Dataset) => { for (const v of ds.videos) if (v.fmt === 'long') v.dur = 600 }
const W = mundoVideo({ mut: umaFaixa })
const dadosOk = (): Privado<DadosDoVideo> => {
  const { alcance: a, diario } = W.dados
  if (a.acesso !== 'ok' || diario.acesso !== 'ok') throw new Error('a fixture esperava dado lido')
  return { acesso: 'ok', dado: { alcance: a.dado, diario: diario.dado } }
}
const tv = buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE))))
const titulos = (c: HTMLElement) => [...c.querySelectorAll('section, .tr-linha')].map(s => (s.classList.contains('tr-linha') ? 'LINHA-TROCAS' : s.querySelector('h2, h3')!.textContent!.replace(/ⓘ.*$/, '').trim()))
const montar = (dados: Privado<DadosDoVideo>) => render(
  <VideoBlocos view={buildVideoBlocos({ obs: W.obs, videoId: W.foco.id, dados, hoje: W.hoje, dm: dmDia })} linhaTrocas={<LinhaDasTrocas view={tv} />} trocas={<Trocas view={tv} />} />,
)

describe('ordem das seções com as trocas', () => {
  it('Linha das trocas → Views → Impressões → Trocas deste vídeo → % assistido → Retenção → ...', () => {
    const t = titulos(montar(dadosOk()).container)
    expect(t.slice(0, 5)).toEqual(['LINHA-TROCAS', 'Views por dia', 'Impressões e cliques', 'Trocas deste vídeo', 'Quanto do vídeo as pessoas assistem'])
    expect(t.indexOf('Retenção')).toBeGreaterThan(t.indexOf('Trocas deste vídeo'))
    expect(t).not.toContain('O que ainda não há deste vídeo')
  })
  it('sem acesso ao vídeo (privado): nem a linha nem o bloco das trocas entram', () => {
    const t = titulos(montar({ acesso: 'negado' }).container)
    expect(t).not.toContain('LINHA-TROCAS')
    expect(t).not.toContain('Trocas deste vídeo')
  })
})
