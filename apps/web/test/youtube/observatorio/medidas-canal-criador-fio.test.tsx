// @vitest-environment jsdom
// Comentários em produção, T5: "O que o criador respondeu" agrupado por vídeo, com o fio único.
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { criadorDoCanal, type BlocoDoCriador, type EntradaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-model'
import { listaDoCriador } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-lista-model'
import { CriadorResponde } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/criador-responde'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { ContagemDeRespostas, ParteLida, RespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams('') }))
afterEach(cleanup)

const DIA = 86_400_000
const AGORA = Date.UTC(2026, 9, 24, 18)
const LONGO = { fmt: 'long' as const, doisFormatos: false, soShorts: false }
const ok = <T,>(dados: T): ParteLida<T> => ({ lido: true, dados }) as ParteLida<T>
const vid = (i: number, idade: number): VideoLido => ({
  id: `v${i}`, videoId: `v${i}`, publishedAt: new Date(AGORA - idade * DIA).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false,
  isShort: false, durationSeconds: 600, viewCount: 1000, likeCount: 10, commentCount: 5, likesHidden: false, commentsDisabled: false, viewsHidden: false,
  discoveredAt: null, missingSince: null, seriesTier: null, lastCheckedAt: null,
})
const contagem = (ids: string[]): ParteLida<ContagemDeRespostas> => ok({
  porVideo: new Map(ids.map(id => [id, { retrato30: 'ok', algumComRespostaDoCriador: true }])),
  coletaDoSiteDesdeMs: AGORA - 200 * DIA, coletaDoCanalDesdeMs: AGORA - 200 * DIA, ultimoOkDaTarefaMs: AGORA - 3_600_000, primeiraExecucaoDaTarefaMs: AGORA - 200 * DIA,
})
const ativo = { tipo: 'ativo', pastilha: 'Ativo', base: '', ate: null } as unknown as EntradaDoCriador['estado']
const CRIADOR = { nome: 'Matt', avatar: null, ini: 'M', color: '#336699' }
const respostasDe = (videoId: string, n: number, extra: Partial<RespostasDoCriador['itens'][number]> = {}) => Array.from({ length: n }, (_, i) => ({
  videoId, texto: `comentário ${videoId}-${i}`, cortado: false, publicadoEm: '2026-10-17T01:30:00.000Z',
  respostas: [{ texto: `resposta ${videoId}-${i}`, cortado: false, publicadoEm: '2026-10-17T01:30:00.000Z' }], curtidas: 12, marco: 7 as const, mencoesTrocadas: 0, ...extra,
}))

function montar(itens: RespostasDoCriador['itens'], titulos: Map<string, string>, thumbs?: Map<string, string | null>, nivel: RespostasDoCriador['nivel'] = 'texto') {
  const videos = [vid(1, 40), vid(2, 50)]
  const bloco = criadorDoCanal({ nome: 'Matt', formato: LONGO, videos, contagem: contagem(['v1', 'v2']), estado: ativo, agoraMs: AGORA, hojeSP: '2026-10-24' } as EntradaDoCriador).bloco
  const lista = listaDoCriador({ nome: 'Matt', resposta: ok({ nivel, total: itens.length, itens }), videos, titulos, thumbs, nBase: bloco.nBase })
  return { bloco, lista }
}
const desenhar = (bloco: BlocoDoCriador, lista: ReturnType<typeof listaDoCriador>) => render(<div data-obs-screen="canal"><CriadorResponde bloco={bloco} lista={lista} canalId="c1" criador={CRIADOR} /></div>)

describe('canal: o criador respondeu, por vídeo', () => {
  it('data em fuso de São Paulo na raiz e em cada resposta; sem data, nulo', () => {
    const { lista } = montar([...respostasDe('v1', 1), ...respostasDe('v2', 1, { publicadoEm: null, respostas: [{ texto: 'x', cortado: false, publicadoEm: null }] })], new Map())
    if (lista.tipo !== 'itens') throw new Error('itens')
    const f1 = lista.grupos.find(g => g.videoId === 'v1')!.fios[0]!
    expect(f1.raiz.data).toBe('16/10')
    expect(f1.respostas[0]!.data).toBe('16/10')
    const f2 = lista.grupos.find(g => g.videoId === 'v2')!.fios[0]!
    expect(f2.raiz.data).toBeNull()
    expect(f2.respostas[0]!.data).toBeNull()
    expect(f1.raiz.autor).toEqual({ tipo: 'espectador' })
    expect(f1.meta.curtidas).toBe('12 no retrato de 7 dias')
  })

  it('12 respostas num vídeo: 1 grupo, 3 fios visíveis, botão "Ver as outras 9 deste vídeo"; recolher volta o foco ao botão', () => {
    const { bloco, lista } = montar(respostasDe('v1', 12), new Map([['v1', 'Meu vídeo']]))
    const { container } = desenhar(bloco, lista)
    expect(container.querySelectorAll('.pc-grupo')).toHaveLength(1)
    const visiveis = () => [...container.querySelectorAll('.cf')].filter(f => !f.hasAttribute('hidden'))
    expect(visiveis()).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Ver as outras 9 deste vídeo' }))
    expect(visiveis()).toHaveLength(12)
    const rec = screen.getByRole('button', { name: 'Recolher' })
    fireEvent.click(rec)
    expect(visiveis()).toHaveLength(3)
    expect(container.textContent?.match(/Meu vídeo/g)).toHaveLength(1)
    expect(container.querySelector('.pc-cm, .pc-cma, .chip')).toBeNull()
    expect(container.textContent).toContain('Espectador')
    expect(container.textContent).not.toContain('?')
    expect(container.querySelector('.cf-selo')?.textContent).toBe('Criador')
    expect(container.querySelector('.pc-grupo-n')?.textContent).toBe('12 respostas dele')
  })

  it('a frase da lista vem antes da régua; singular e plural em "respostas dele"', () => {
    const { bloco, lista } = montar([...respostasDe('v1', 1), ...respostasDe('v2', 2)], new Map())
    const { container } = desenhar(bloco, lista)
    const frase = container.querySelector('[data-frase-da-lista]')!
    expect(frase.compareDocumentPosition(container.querySelector('.pc-rqs')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(frase.textContent).toBe('Matt respondeu a 3 comentários guardados de espectadores, em 2 vídeos.')
    expect([...container.querySelectorAll('.pc-grupo-n')].map(n => n.textContent)).toEqual(['1 resposta dele', '2 respostas dele'])
  })

  it('vídeo sem título e sem ytId: "(sem título)" e nenhum img de thumbnail', () => {
    const { bloco, lista } = montar(respostasDe('v1', 1), new Map())
    const { container } = desenhar(bloco, lista)
    expect(container.querySelector('.pc-grupo-tit')?.textContent).toBe('(sem título)')
    expect(container.querySelector('.pc-grupo-th img')).toBeNull()
  })

  it('com thumbnail: 64x36, preguiçosa, sem alt', () => {
    const { bloco, lista } = montar(respostasDe('v1', 1), new Map([['v1', 'T']]), new Map([['v1', 'https://i.ytimg.com/vi/abc/mqdefault.jpg']]))
    const { container } = desenhar(bloco, lista)
    const img = container.querySelector('.pc-grupo-th img')!
    expect([img.getAttribute('width'), img.getAttribute('height'), img.getAttribute('loading'), img.getAttribute('alt')]).toEqual(['64', '36', 'lazy', ''])
  })

  it('nível contagem (reporter): nenhum fio e nenhum texto de terceiro', () => {
    const { bloco, lista } = montar(respostasDe('v1', 2), new Map(), undefined, 'contagem')
    const { container } = desenhar(bloco, lista)
    expect(container.querySelector('.cf')).toBeNull()
    expect(container.textContent).not.toContain('comentário v1-0')
  })
})

describe('N2: a pastilha "não medido" fica depois da frase do bloco, fora do cabeçalho', () => {
  const lista = null
  const base = { casas: [], legenda: [], nBase: 0, pastilha: 'não medido' as const }
  for (const tipo of ['nao_medido', 'fora', 'desligados'] as const) {
    it(tipo, () => {
      const bloco = { tipo, frase: { negrito: 'x', resto: ' y' }, ...base } as unknown as BlocoDoCriador
      const { container } = desenhar(bloco, lista)
      const pastilha = container.querySelector('.obs-ch-nm')!
      expect(pastilha.textContent).toContain('não medido')
      expect(pastilha.closest('.pc-sh')).toBeNull()
      expect(container.querySelector('[data-frase-do-bloco]')!.compareDocumentPosition(pastilha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  }
})
