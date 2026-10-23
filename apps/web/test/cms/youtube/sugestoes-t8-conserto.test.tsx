// @vitest-environment jsdom
// F3 T8: defeitos achados pelo Gio (D1 a D8, D10, D11). Cada teste nasceu vermelho.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: vi.fn() }) }))

import { SugestoesLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/sugestoes-lista'
import { EsqueletoDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/esqueleto'
import { montarVistaDaLista, VISTA_COM_ERRO, type LinhaDaVista, type VistaDaLista } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/view-model'
import type { AcoesDaLista, RespostaDaAcao } from '@/app/cms/(authed)/youtube/competitors/_sugestoes/tipos'
import { FaixaSugestao } from '@/app/cms/(authed)/youtube/videos/faixa-sugestao'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')

function linha(id: string, kind: 'destino' | 'parecido' = 'destino'): LinhaDaVista {
  return {
    id, kind, chip: { rotulo: kind === 'destino' ? 'Destino esquentou' : 'Concorrente bombou', simbolo: kind === 'destino' ? 'alfinete' : 'chama' },
    lugar: kind === 'destino' ? 'L' + id : '', titulo: `Um vídeo sobre ${id}`,
    puxadoPor: { titulo: 'Vídeo ' + id, canal: 'Canal X', miniatura: 'https://x/y.jpg' },
    regua: { valor: 8.4, acimaDe20: false, limiar: 5, texto: '8,4× o normal do canal' },
    seus: { texto: 'Seus vídeos: 2.', naoMedido: false },
    primario: { texto: 'Abrir', href: '/cms/youtube/videos', cheio: false }, venceEm: null,
    info: { mults: '8,4×', medida: 'm', regra: 'r', surgiu: '18/10', vence: '17/11' },
    motivos: [{ valor: 'nao_interessa', rotulo: 'Não me interessa', grupo: 'motivo' }, { valor: 'ja_fiz', rotulo: 'Já fiz', grupo: 'feito' }],
  }
}
function vista(ls: LinhaDaVista[], o: Partial<VistaDaLista> = {}): VistaDaLista {
  const com = ls.map((l, i) => ({ ...l, primario: { ...l.primario, cheio: i === 0 } }))
  return { n: com.length, calculado: 'Calculado hoje às 07:02', velho: false, resumo: 'r', faixa: null, filtro: null, linhas: com, completas: com, totalAlemDoLimite: null, vazio: null, ...o }
}
const acoes = (r: () => Promise<RespostaDaAcao>): AcoesDaLista => ({ dispensar: vi.fn(r) })

beforeEach(() => { nav.replace.mockClear(); nav.refresh.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function dispensarJaFiz(id: string) {
  const li = document.querySelector(`[data-row="${id}"]`) as HTMLElement
  fireEvent.click(within(li).getAllByRole('button', { name: /dispensar/i })[0]!)
  await act(async () => { fireEvent.click(within(li).getByRole('button', { name: 'Já fiz' })) })
}

describe('D3: sessão expirada não vira "sem conexão"', () => {
  it('chamada rejeitada + sondagem com redirect de login -> mensagem de sessão e link de login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ type: 'opaqueredirect', ok: false, status: 0 })))
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={acoes(async () => { throw new Error('Failed to fetch') })} modo="pagina" />)
    await dispensarJaFiz('a')
    expect(screen.queryByText(/sem conexão/)).toBeNull()
    expect(screen.getByText(/sessão expirou/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar de novo' }).getAttribute('href')).toMatch(/^\/cms\/login\?next=/)
  })
  it('chamada rejeitada + sondagem que também falha -> continua "sem conexão"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={acoes(async () => { throw new Error('x') })} modo="pagina" />)
    await dispensarJaFiz('a')
    expect(screen.getByText(/sem conexão/)).toBeTruthy()
  })
})

describe('D4: o filtro sobrevive à queda de N', () => {
  it('Destinos ativo, N 9 -> 8: continua em Destinos', () => {
    const ls = [...Array.from({ length: 7 }, (_, i) => linha('d' + i)), linha('p1', 'parecido'), linha('p2', 'parecido')]
    const nove = vista(ls, { filtro: { atual: 'todas', contagens: { todas: 9, destino: 7, parecido: 2 } } })
    const { rerender } = render(<SugestoesLista vista={nove} acoes={null} modo="pagina" />)
    fireEvent.click(screen.getByRole('button', { name: /Destinos \(7\)/ }))
    const oito = vista(ls.slice(1), { filtro: null })
    rerender(<SugestoesLista vista={oito} acoes={null} modo="pagina" />)
    expect(document.querySelectorAll('[data-row]')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Destinos \(6\)/ }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('D1: o lugar fica visível a 390', () => {
  it('a 640 ou menos o título aceita 3 linhas', () => {
    const css = fs.readFileSync(path.join(DIR, '_sugestoes/sugestoes.css'), 'utf8')
    const bloco = css.slice(css.indexOf('@container (max-width:640px)'))
    expect(bloco).toMatch(/\.sg-row h4\{[^}]*-webkit-line-clamp:3/)
  })
})

describe('D7: miniatura que já falhou antes da hidratação', () => {
  it('img completa com naturalWidth 0 no mount mostra o substituto', () => {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 0 })
    try {
      render(<SugestoesLista vista={vista([linha('a')])} acoes={null} modo="pagina" />)
      expect(screen.getByText('Miniatura indisponível')).toBeTruthy()
    } finally {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'complete')
      Reflect.deleteProperty(HTMLImageElement.prototype, 'naturalWidth')
    }
  })
})

describe('D2: contador da aba com ⚠ numa linha', () => {
  it('o contador força display inline-flex e sem quebra', () => {
    const src = fs.readFileSync(path.join(DIR, '_chrome/tabs.tsx'), 'utf8')
    expect(src).toMatch(/display: 'inline-flex'/)
    expect(src).toMatch(/whiteSpace: 'nowrap'/)
  })
})

describe('D2b: a aba Sugestões com contador é trazida para a vista na trilha', () => {
  it('tabs.tsx rola a trilha (não a página) até o fim da aba Sugestões', () => {
    const src = fs.readFileSync(path.join(DIR, '_chrome/tabs.tsx'), 'utf8')
    expect(src).toMatch(/data-tab="sugestoes"/)
    expect(src).toMatch(/r > tb\.scrollLeft \+ tb\.clientWidth\) tb\.scrollLeft = r - tb\.clientWidth/)
  })
})

describe('D8: Tentar de novo sem rede não navega', () => {
  it('sondagem falha -> aviso na tela e nenhum router.refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    render(<SugestoesLista vista={VISTA_COM_ERRO} acoes={null} modo="pagina" />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })) })
    expect(nav.refresh).not.toHaveBeenCalled()
    expect(screen.getByText(/Sem conexão/)).toBeTruthy()
  })
  it('sondagem ok -> router.refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, type: 'basic', status: 200 })))
    render(<SugestoesLista vista={VISTA_COM_ERRO} acoes={null} modo="pagina" />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })) })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('D5: sem-historico coerente com canais_total', () => {
  const base = { agora: new Date('2026-10-23T15:00:00Z'), filtro: 'todas' as const, saiuDoAviso: false, limite: 40, amostra: new Map() }
  const mk = (canais_total: number) => montarVistaDaLista({
    ...base,
    lista: { n: 0, itens: [], contagens: { canais_total, proprios: 1 }, motivoVazio: 'sem-historico', computado_em: '2026-10-23T10:00:00Z', desatualizado: false, calculoLigado: true } as never,
  })
  it('12 canais: não diz "não há canais acompanhados"', () => {
    const v = mk(12).vazio!
    expect(v.titulo).not.toMatch(/não há canais/)
    expect(v.texto).toMatch(/12 canais em Competidores/)
  })
  it('0 canais: mantém o título e usa o texto sem zero', () => {
    const v = mk(0).vazio!
    expect(v.titulo).toBe('Ainda não há canais acompanhados.')
    expect(v.texto).toMatch(/Nenhum canal em Competidores/)
  })
})

describe('menores', () => {
  it('D10: plural "1 vídeo"', () => {
    render(<FaixaSugestao mostrados={1} total={1} />)
    expect(screen.getByText('Mostrando 1 vídeo da sugestão')).toBeTruthy()
  })
  it('D6: esqueleto a 1440 com a altura da linha real (≤ 174 + margem)', () => {
    const css = fs.readFileSync(path.join(DIR, '_sugestoes/sugestoes.css'), 'utf8')
    const m = /\.sg-sk-row\{[^}]*min-height:(\d+)px/.exec(css)
    expect(Number(m![1])).toBeLessThanOrEqual(190)
  })
  it('D11: subfrase "Da mais forte para a mais fraca." sob o resumo', () => {
    render(<SugestoesLista vista={vista([linha('a'), linha('b')])} acoes={null} modo="pagina" />)
    expect(document.querySelector('.sg-sum small')!.textContent).toBe('Da mais forte para a mais fraca.')
  })
  it('esqueleto ainda renderiza', () => {
    expect(() => render(<EsqueletoDaLista linhas={3} />)).not.toThrow()
  })
})

describe('T8 r2', () => {
  it('C1: o número-chave da régua e do "seus" vai em <b>', () => {
    const l = { ...linha('a'), seus: { texto: 'Parecido com 2 vídeos seus (cálculo de hoje, 08:38).', naoMedido: false } }
    render(<SugestoesLista vista={vista([l])} acoes={null} modo="pagina" />)
    expect(Array.from(document.querySelectorAll('.sg-rg .sg-v b')).map((b) => b.textContent)).toEqual(['8,4×'])
    const bs = Array.from(document.querySelectorAll('.sg-alv b')).map((b) => b.textContent)
    expect(bs).toEqual(['2 vídeos'])
  })
  it('D4b: dispensar com filtro mantém ?filtro= na URL', async () => {
    window.history.replaceState(null, '', '/cms/youtube/competitors/sugestoes')
    const ls = [...Array.from({ length: 7 }, (_, i) => linha('d' + i)), linha('p1', 'parecido'), linha('p2', 'parecido')]
    const nove = vista(ls, { filtro: { atual: 'todas', contagens: { todas: 9, destino: 7, parecido: 2 } } })
    render(<SugestoesLista vista={nove} acoes={acoes(async () => ({ ok: true }) as RespostaDaAcao)} modo="pagina" />)
    fireEvent.click(screen.getByRole('button', { name: /Destinos \(7\)/ }))
    await dispensarJaFiz('d0')
    expect(window.location.search).toContain('filtro=destino')
    expect(nav.replace.mock.calls.every((c) => String(c[0]).includes('filtro=destino'))).toBe(true)
  })
  it('D5b: com 0 canais o vazio não diz "0 canais"', () => {
    const v = montarVistaDaLista({
      agora: new Date('2026-10-23T15:00:00Z'), filtro: 'todas', saiuDoAviso: false, limite: 40, amostra: new Map(),
      lista: { n: 0, itens: [], contagens: { canais_total: 0, proprios: 1 }, motivoVazio: 'sem-historico', computado_em: '2026-10-23T10:00:00Z', desatualizado: false, calculoLigado: true } as never,
    }).vazio!
    expect(v.texto).toBe('Nenhum canal em Competidores ainda. As sugestões nascem dos vídeos deles.')
    expect(v.texto).not.toMatch(/0 canais/)
  })
  it('D5: a data de dados velhos aparece uma vez só (sem repetir na faixa)', () => {
    const v = montarVistaDaLista({
      agora: new Date('2026-10-23T15:00:00Z'), filtro: 'todas', saiuDoAviso: false, limite: 40, amostra: new Map(),
      lista: { n: 0, itens: [], contagens: { canais_total: 3, proprios: 1 }, motivoVazio: 'sem-historico', computado_em: '2026-10-20T10:00:00Z', desatualizado: true, calculoLigado: true } as never,
    })
    expect(v.faixa!.titulo).not.toMatch(/\d{2}\/\d{2}/)
    expect(v.calculado).toMatch(/20\/10/)
  })
  it('menor: toque (pointer: coarse) dá 44 px a Dispensar e filtros', () => {
    const css = fs.readFileSync(path.join(DIR, '_sugestoes/sugestoes.css'), 'utf8')
    expect(css).toMatch(/@media \(pointer:\s*coarse\)\{[^}]*\.sg-btn[^}]*min-height:44px/)
  })
  it('D2b: a aba Sugestões não encolhe nem corta o número', () => {
    const css = fs.readFileSync(path.join(DIR, '_chrome/chrome.css'), 'utf8')
    expect(css).toMatch(/obs-ch-tab\[data-tab="sugestoes"\][^{]*\{[^}]*flex:none/)
  })
})
