// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'node:fs'
import path from 'node:path'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import { mountCanal, cartoes, norm, canalActions } from './canal-mount'

const push = vi.fn(), replace = vi.fn(), refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))

const flut = () => document.getElementById('flut')
const cardOf = (id: string) => cartoes().find(c => c.dataset.id === id)!
type Ds = Dataset
const tracked = (ds: Ds, id: string) => ds.videos.find(v => v.ch === id && v.tracked)!

beforeEach(() => { push.mockReset(); replace.mockReset(); refresh.mockReset(); window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Capas: a grade e o cartão', () => {
  it('Capas é ul/li; cada cartão tem exatamente 2 paradas de Tab: o link (thumbnail + título) e "Ações do vídeo: <título>"', () => {
    const { all } = mountCanal()
    const lista = document.querySelector('ul.cv-grid')!
    expect(lista).not.toBeNull()
    const doze = cartoes().slice(0, 12)
    expect(doze).toHaveLength(12)
    let paradas = 0
    doze.forEach((c, i) => {
      const stops = [...c.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]')].filter(e => e.getAttribute('tabindex') !== '-1')
      expect(stops, `cartão ${i}`).toHaveLength(2)
      expect(stops[0]!.tagName).toBe('A')
      expect(stops[1]!.getAttribute('aria-label')).toBe('Ações do vídeo: ' + all[i]!.title)
      paradas += stops.length
    })
    expect(paradas).toBe(24)
  })

  it('a lupa do cartão tem tabindex=-1 e nome "Ampliar a thumbnail: <título>"', () => {
    const { all } = mountCanal()
    const lupa = within(cardOf(all[0]!.id)).getByRole('button', { name: 'Ampliar a thumbnail: ' + all[0]!.title })
    expect(lupa.getAttribute('tabindex')).toBe('-1')
  })

  it('thumbnail tem alt="" e fica dentro do link com o título', () => {
    const { all } = mountCanal()
    const c = cardOf(all[0]!.id)
    const a = c.querySelector('a.cv-lnk')!
    const img = a.querySelector('img')!
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('src')).toBe(all[0]!.thumbSrc)
    expect(norm(a.textContent)).toBe(norm(all[0]!.title))
  })

  it('os três números ficam sempre na ordem views, views por dia, múltiplo; a ordenação só muda qual tem a classe de destaque', () => {
    const base = mountCanal()
    const v = base.all.find(x => x.vpdText && x.multText && x.viewsText)!
    base.unmount()
    const casos: [string, number | null][] = [['recentes', null], ['vistos', 0], ['vpd', 1], ['multiplo', 2]]
    for (const [sort, destaque] of casos) {
      const m = mountCanal({ sp: { sort } })
      const cells = [...cardOf(v.id).querySelectorAll('.cv-nums > .cv-c')]
      expect(cells, sort).toHaveLength(3)
      expect(norm(cells[0]!.textContent), sort).toContain(norm(v.viewsText))
      expect(norm(cells[1]!.textContent), sort).toContain(norm(v.vpdText))
      expect(norm(cells[2]!.textContent), sort).toContain(norm(v.multText))
      expect(cells.map(c => c.classList.contains('on')), sort).toEqual([0, 1, 2].map(i => i === destaque))
      m.unmount()
    }
  })

  it('no DOM o rótulo acompanha o valor ("84 mil views")', () => {
    const { all } = mountCanal()
    const v = all.find(x => x.vpdText && x.multText && x.viewsText)!
    const cells = [...cardOf(v.id).querySelectorAll('.cv-nums > .cv-c')]
    expect(norm(cells[0]!.textContent)).toBe(`${norm(v.viewsText)} views`)
    expect(norm(cells[1]!.textContent)).toBe(`${norm(v.vpdText)} views/dia`)
    expect(norm(cells[2]!.textContent).startsWith(norm(v.multText))).toBe(true)
    // o múltiplo leva a palavra do nível, e o nível por escrito
    const alto = all.find(x => x.multWord)!
    expect(norm(cardOf(alto.id).querySelectorAll('.cv-nums > .cv-c')[2]!.textContent)).toContain(alto.multWord!)
  })

  it('quando faltam views/dia e múltiplo, uma frase só ocupa as duas colunas, em obs-ch-nm', () => {
    const { all } = mountCanal()
    const v = all.find(x => x.grupo === 'acompanhado' && x.semMedida && x.viewsText)!
    expect(v).toBeTruthy()
    const cells = [...cardOf(v.id).querySelectorAll('.cv-nums > .cv-c')]
    expect(cells).toHaveLength(2)
    expect(cells[1]!.classList.contains('s2')).toBe(true)
    expect(cells[1]!.querySelector('.obs-ch-nm')!.textContent).toBe('views/dia e múltiplo: não medido')
  })

  it('fixado antigo: a frase própria, também em obs-ch-nm', () => {
    const { all } = mountCanal({ mut: (ds, id) => { const x = tracked(ds, id); x.tracked = false; x.pinned = true; x.pinState = 'ativo'; x.series = []; x.firstIdx = null } })
    const v = all.find(x => x.grupo === 'fixado-antigo')!
    const nm = cardOf(v.id).querySelector('.cv-nums .s2 .obs-ch-nm')!
    expect(nm.textContent).toBe('fixado antigo: sem views/dia nem múltiplo')
  })

  it('views/dia sem valor e múltiplo com valor: só a célula sem valor diz "não medido"', () => {
    const { all } = mountCanal()
    const v = all.find(x => x.viewsText && x.vpdText == null && x.multText && !x.semMedida)!
    expect(v).toBeTruthy()
    const cells = [...cardOf(v.id).querySelectorAll('.cv-nums > .cv-c')]
    expect(cells).toHaveLength(3)
    expect(cells[1]!.querySelector('.obs-ch-nm')!.textContent).toBe('não medido')
    expect(norm(cells[1]!.textContent)).toContain('views/dia')
    expect(cells[2]!.querySelector('.obs-ch-nm')).toBeNull()
  })

  it('views nulas: "sem contagem: <motivo>" no lugar de views e de views/dia', () => {
    let alvo = ''
    const { all } = mountCanal({ mut: (ds, id) => { const x = tracked(ds, id); alvo = x.id; x.views = null; x.series = []; x.firstIdx = null } })
    const v = all.find(x => x.id === alvo)!
    const cells = [...cardOf(v.id).querySelectorAll('.cv-nums > .cv-c')]
    expect(cells).toHaveLength(1)
    expect(cells[0]!.classList.contains('s3')).toBe(true)
    expect(cells[0]!.querySelector('.obs-ch-nm')!.textContent).toBe(v.viewsMissing)
    expect(v.viewsMissing).toMatch(/^sem contagem: /)
    expect(norm(cardOf(v.id).querySelector('.cv-nums')!.textContent)).not.toContain('views/dia')
  })

  it('zero medido é "0", nunca "não medido"', () => {
    const { all } = mountCanal()
    // o texto vem do modelo: um valor "0" não passa por o nulo
    const zero = all.find(x => x.views === 0)
    if (zero) expect(norm(cardOf(zero.id).querySelector('.cv-nums .cv-c')!.textContent)).toBe('0 views')
    // e o que é nulo nunca vira "0"
    for (const c of cartoes()) for (const nm of c.querySelectorAll('.obs-ch-nm')) expect(nm.textContent).not.toBe('0')
  })

  it('os selos são texto, nunca controle', () => {
    const { all } = mountCanal({ mut: (ds, id) => { const x = tracked(ds, id); x.pinned = true; x.pinState = 'ativo'; x.isShort = null; x.dur = null } })
    const selos = [...document.querySelectorAll('.cv-badges')]
    expect(selos.length).toBe(cartoes().length)
    for (const s of selos) expect(s.querySelectorAll('button, a, [tabindex]')).toHaveLength(0)
    const txt = selos.map(s => norm(s.textContent)).join(' | ')
    expect(txt).toContain('fixado')
    expect(txt).toContain('formato não confirmado')
    expect(txt).toMatch(/\d trocas?/)
    expect(all.length).toBeGreaterThan(0)
  })

  it('selos de duração: "Short" no Short, mm:ss no longo, "sem duração" sem duração', () => {
    const { all } = mountCanal({ mut: (ds, id) => { const x = ds.videos.find(v => v.ch === id && v.tracked && v.fmt === 'long')!; x.dur = null } })
    const short = all.find(x => x.isShort === true)!
    const longo = all.find(x => x.isShort === false && x.durText)!
    const sem = all.find(x => x.isShort === false && !x.durText)!
    expect(norm(cardOf(short.id).querySelector('.cv-badges')!.textContent)).toContain('Short')
    expect(norm(cardOf(longo.id).querySelector('.cv-badges')!.textContent)).toContain(longo.durText!)
    expect(norm(cardOf(sem.id).querySelector('.cv-badges')!.textContent)).toContain('sem duração')
  })

  it('título truncado tem o nome inteiro no nome acessível do link', () => {
    const longo = 'Um título muito comprido que o cartão corta em duas linhas mas que o leitor de tela precisa ouvir inteiro, até a última palavra: fim'
    let alvo = ''
    mountCanal({ mut: (ds, id) => { const x = tracked(ds, id); alvo = x.id; x.title = longo } })
    const a = cardOf(alvo).querySelector('a.cv-lnk') as HTMLElement
    expect(screen.getByRole('link', { name: longo })).toBe(a)
  })

  it('a data sai em <time datetime>, com a data completa para quem não vê a tela', () => {
    const { all } = mountCanal()
    const t = cardOf(all[0]!.id).querySelector('time')!
    expect(t.getAttribute('datetime')).toBe(all[0]!.pubISO)
    expect(norm(t.textContent)).toContain(all[0]!.ageText!)
    expect(norm(t.textContent)).toContain(all[0]!.pubTitle!)
  })

  it('divisores com contagem são h3 dentro da lista e não somem com filtro', () => {
    const undated = { id: 'u1', ytId: 'yt-u1', title: 'sem data aqui', url: 'https://youtu.be/yt-u1', isShort: false, dur: null, views: 10, likes: null, comments: null, pinned: false, checkedAt: null }
    const mut = (ds: Ds, id: string) => { ds.channels.find(c => c.id === id)!.undated.push(undated) }
    const a = mountCanal({ mut })
    let h3s = [...document.querySelectorAll('ul.cv-grid h3')]
    expect(h3s.map(h => norm(h.textContent))).toContain('Sem data de publicação (1)')
    expect(h3s[0]!.closest('li')!.parentElement!.tagName).toBe('UL')
    a.unmount()
    mountCanal({ mut, sp: { fmt: 'longos' } })
    h3s = [...document.querySelectorAll('ul.cv-grid h3')]
    expect(h3s.map(h => norm(h.textContent))).toContain('Sem data de publicação (1)')
  })

  it('o divisor "sem valor" só existe na ordenação que depende do número', () => {
    mountCanal({ sp: { sort: 'multiplo' } })
    const t = [...document.querySelectorAll('ul.cv-grid h3')].map(h => norm(h.textContent))
    expect(t.some(x => /^Sem múltiplo ainda \(\d+\)$/.test(x))).toBe(true)
  })

  it('link "Pular a lista de vídeos" antes da grade leva ao bloco depois dela', () => {
    mountCanal()
    const skip = screen.getByRole('link', { name: 'Pular a lista de vídeos' })
    const grade = document.querySelector('ul.cv-grid')!
    const fim = document.getElementById(skip.getAttribute('href')!.slice(1))!
    expect(fim).not.toBeNull()
    expect(skip.compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grade.compareDocumentPosition(fim) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(skip)
    expect(document.activeElement).toBe(fim)
  })

  it('o href do cartão leva ao Histórico com from=canais, canal=<id>, back=<query do estado> e ids= da vizinhança (no máximo 100, em torno do vídeo)', () => {
    const { all, chId } = mountCanal({ sp: { sort: 'vistos', fmt: 'longos' } })
    const cs = cartoes()
    const href = (i: number) => new URL(cs[i]!.querySelector('a.cv-lnk')!.getAttribute('href')!, 'http://x')
    const id0 = cs[0]!.dataset.id!
    const u0 = href(0)
    expect(u0.pathname).toBe('/cms/youtube/competitors/video/' + encodeURIComponent(id0))
    expect(u0.searchParams.get('from')).toBe('canais')
    expect(u0.searchParams.get('canal')).toBe(chId)
    expect(u0.searchParams.get('back')).toBe('?fmt=longos&sort=vistos')
    const ids0 = u0.searchParams.get('ids')!.split(',')
    expect(ids0.length).toBe(100)
    expect(ids0[0]).toBe(id0)
    // um cartão perto do fim: a janela de 100 ids ainda o contém, e é a última possível
    const ordem = cs.map(c => c.dataset.id!)
    const i = ordem.length - 3
    const ids = href(i).searchParams.get('ids')!.split(',')
    expect(ids.length).toBe(100)
    expect(ids).toContain(ordem[i])
    expect(ids[ids.length - 1]).toBe(ordem[ordem.length - 1])
    // no meio: centrada
    const mid = href(60).searchParams.get('ids')!.split(',')
    const a = Math.max(0, Math.min(60 - 50, ordem.length - 100))
    expect(mid).toEqual(ordem.slice(a, a + 100))
    expect(mid.indexOf(ordem[60]!)).toBe(60 - a)
    expect(all.length).toBeGreaterThan(100)
  })

  it('o back do cartão é vazio no estado padrão', () => {
    mountCanal()
    const u = new URL(cartoes()[0]!.querySelector('a.cv-lnk')!.getAttribute('href')!, 'http://x')
    expect(u.searchParams.has('back')).toBe(false)
  })

  it('nenhum controle some fora do hover: a lupa e o ⋯ estão no DOM e visíveis sem hover', () => {
    mountCanal()
    const c = cartoes()[0]!
    for (const el of [c.querySelector('.cv-amp'), c.querySelector('.cv-abtn')] as HTMLElement[]) {
      expect(el).not.toBeNull()
      expect(el.hidden).toBe(false)
      expect(el.closest('[hidden], [aria-hidden="true"]')).toBeNull()
      expect(getComputedStyle(el).display).not.toBe('none')
    }
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/canal.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/\.cv-(amp|abtn)[^{}]*\{[^}]*(opacity:\s*0|visibility:\s*hidden|display:\s*none)/)
    expect(css).not.toMatch(/\.cv-card:hover[^{}]*\.cv-(amp|abtn)[^{}]*\{[^}]*opacity/)
  })
})

describe('Capas: o menu "Ações do vídeo"', () => {
  const abrir = async (id: string) => {
    const user = userEvent.setup()
    const btn = within(cardOf(id)).getByRole('button', { name: /^Ações do vídeo: / })
    await user.click(btn)
    return { user, btn, menu: screen.getByRole('menu') }
  }

  it('padrão menu button (aria-haspopup, aria-expanded), abre em #flut, setas/Home/End, Esc devolve o foco', async () => {
    const { all } = mountCanal()
    const btn = within(cardOf(all[0]!.id)).getByRole('button', { name: /^Ações do vídeo: / })
    expect(btn.getAttribute('aria-haspopup')).toBe('menu')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    const { user, menu } = await abrir(all[0]!.id)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(flut()!.contains(menu)).toBe(true)
    expect(cardOf(all[0]!.id).contains(menu)).toBe(false)
    const itens = within(menu).getAllByRole('menuitem')
    expect(document.activeElement).toBe(itens[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(itens[1])
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(itens[itens.length - 1])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(itens[0])
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(itens[itens.length - 1])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(btn)
  })

  it('o topo do menu traz as notas do vídeo (base do múltiplo e motivos de "não medido")', async () => {
    const { all } = mountCanal()
    const v = all.find(x => x.multText && x.notas.length >= 1)!
    const { menu } = await abrir(v.id)
    for (const n of v.notas) expect(norm(menu.textContent)).toContain(norm(n))
    expect(v.notas[0]).toMatch(/^contra os (longos|Shorts) do canal /)
    // as notas vêm antes dos itens
    const primeiroItem = within(menu).getAllByRole('menuitem')[0]!
    const nota = [...menu.querySelectorAll('*')].find(e => norm(e.textContent) === norm(v.notas[0]))!
    expect(nota.compareDocumentPosition(primeiroItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('itens do menu: "Fixar" ou "Desafixar", "Ampliar thumbnail", "Abrir no YouTube" (abre em nova aba), "Ver trocas"', async () => {
    const { all } = mountCanal({ mut: (ds, id) => { const x = ds.videos.filter(v => v.ch === id && v.tracked)[1]!; x.pinned = true; x.pinState = 'ativo' } })
    const livre = all.find(x => !x.pinned && x.pin)!
    const a = await abrir(livre.id)
    const nomes = within(a.menu).getAllByRole('menuitem').map(i => norm(i.textContent))
    expect(nomes[0]).toBe('Fixar')
    expect(nomes[1]).toBe('Ampliar thumbnail')
    expect(nomes[2]).toMatch(/^Abrir no YouTube/)
    expect(nomes[3]).toMatch(/^Ver trocas/)
    const yt = within(a.menu).getByRole('menuitem', { name: /Abrir no YouTube/ })
    expect(yt.tagName).toBe('A')
    expect(yt.getAttribute('href')).toBe(livre.url)
    expect(yt.getAttribute('target')).toBe('_blank')
    expect(yt.getAttribute('rel')).toContain('noopener')
    expect(norm(yt.textContent)).toContain('abre em nova aba')
    await a.user.keyboard('{Escape}')
    const fixado = all.find(x => x.pinned)!
    const b = await abrir(fixado.id)
    expect(within(b.menu).getAllByRole('menuitem').map(i => norm(i.textContent))[0]).toBe('Desafixar')
  })

  it('"Ampliar thumbnail" (menu e lupa) abre a imagem em nova aba na A1', async () => {
    const { all } = mountCanal()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const v = all[0]!
    fireEvent.click(within(cardOf(v.id)).getByRole('button', { name: 'Ampliar a thumbnail: ' + v.title }))
    expect(open).toHaveBeenLastCalledWith(v.thumbSrc, '_blank', 'noopener,noreferrer')
    const { user, menu } = await abrir(v.id)
    await user.click(within(menu).getByRole('menuitem', { name: 'Ampliar thumbnail' }))
    expect(open).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('"Ver trocas" troca para a aba Trocas com video=<id>, sem navegar', async () => {
    const { all } = mountCanal()
    const v = all.find(x => x.swaps > 0)!
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const { user, menu } = await abrir(v.id)
    await user.click(within(menu).getByRole('menuitem', { name: /^Ver trocas/ }))
    const last = replaceState.mock.calls.at(-1)![2] as string
    const q = new URL(last, 'http://x').searchParams
    expect(q.get('tab')).toBe('trocas')
    expect(q.get('video')).toBe(v.id)
    expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
    expect(document.querySelector('ul.cv-grid')).toBeNull()
  })

  it('"Ver trocas" sem troca nos últimos 30 dias fica desligado e diz por quê', async () => {
    const { all } = mountCanal()
    const v = all.find(x => x.swaps === 0)!
    const { user, menu } = await abrir(v.id)
    const item = within(menu).getByRole('menuitem', { name: /^Ver trocas/ })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(norm(item.textContent)).toContain('nenhuma em 30 d')
    await user.click(item)
    expect(document.querySelector('ul.cv-grid')).not.toBeNull()
  })

  it('"Fixar" chama onPin e mostra o resultado pelo PinProvider; no limite, a mensagem do limite', async () => {
    const onPin = vi.fn(async (_id: string) => ({ ok: true as const }))
    const { all } = mountCanal({ act: canalActions({ onPin }) })
    const v = all.find(x => x.pin && !x.pinned)!
    const a = await abrir(v.id)
    await a.user.click(within(a.menu).getByRole('menuitem', { name: 'Fixar' }))
    expect(onPin).toHaveBeenCalledWith(v.id)
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(document.getElementById('fx-status')!.textContent).toBe('Vídeo fixado.'))
    expect(refresh).toHaveBeenCalled()
  })

  it('no limite de fixados a mensagem do limite aparece na tela', async () => {
    const frase = 'Este canal já tem 5 vídeos fixados. Desafixe um para fixar outro.'
    const onPin = vi.fn(async (_id: string) => ({ ok: false as const, kind: 'cap' as const, error: frase }))
    const { all } = mountCanal({ act: canalActions({ onPin }) })
    const v = all.find(x => x.pin && !x.pinned)!
    const a = await abrir(v.id)
    await a.user.click(within(a.menu).getByRole('menuitem', { name: 'Fixar' }))
    await waitFor(() => expect(document.querySelector('[data-fx-msg="cap"]')).not.toBeNull())
    expect(norm(document.querySelector('[data-fx-msg="cap"]')!.textContent)).toContain(frase)
    expect(document.getElementById('fx-alert')!.textContent).toBe(frase)
  })
})
