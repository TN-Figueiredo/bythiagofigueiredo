// @vitest-environment jsdom
// Tarefa 11c, C2 (design D-C): "meu canal" com N canais próprios. Uma função pura única (`escolherPrincipal`) decide o canal próprio padrão; o dono
// escolhe pelo menu ou pela comparação e a escolha fica num cookie do navegador. Aqui: a regra (0, 1, 2, N, parado, novo, desempate), o texto das notas
// do menu, o cookie (valor ruim ignorado, ausente = recência) e a escrita do cookie.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { a3World } from './a3-fixture'
import { DAY } from '@/lib/youtube/observatorio/time'
import { createFmt } from '@/lib/youtube/observatorio/fmt'
import { createClock } from '@/lib/youtube/observatorio/time'
import {
  escolherPrincipal, ownMenuFromRows, ownMenuOf, notaDoCanal, haTempo, JANELA_ATIVO_DIAS, type LinhaPrincipal,
} from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import {
  COOKIE_MEU_CANAL, parseMeuCanal, lembrarMeuCanal, lerMeuCanalNoNavegador,
} from '@/app/cms/(authed)/youtube/competitors/_chrome/meu-canal-lembrado'

const AGORA = Date.UTC(2026, 9, 24, 18, 0, 0)
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ha = (dias: number) => AGORA - dias * DAY
const L = (id: string, videos: number, diasAtras: number | null): LinhaPrincipal => ({ id, videos, ultimo: diasAtras == null ? null : ha(diasAtras) })

describe('escolherPrincipal (a regra única do "meu canal")', () => {
  it('0 canais próprios: null', () => { expect(escolherPrincipal([], null, AGORA)).toBeNull() })
  it('1 canal sem vídeos (canal novo): null, mesmo com lembrança dele', () => {
    expect(escolherPrincipal([L(U(1), 0, null)], null, AGORA)).toBeNull()
    expect(escolherPrincipal([L(U(1), 0, null)], U(1), AGORA)).toBeNull()
  })
  it('1 canal com vídeos: ele, ativo ou parado', () => {
    expect(escolherPrincipal([L(U(1), 5, 3)], null, AGORA)).toBe(U(1))
    expect(escolherPrincipal([L(U(1), 5, 400)], null, AGORA)).toBe(U(1))
  })
  it('2 canais, só um com vídeos: esse (o outro é canal novo)', () => {
    expect(escolherPrincipal([L(U(1), 0, null), L(U(2), 4, 200)], null, AGORA)).toBe(U(2))
    expect(escolherPrincipal([L(U(1), 0, null), L(U(2), 4, 200)], U(1), AGORA)).toBe(U(2))
  })
  it('dois canais parados e um novo ativo, sem lembrança: o novo (publicou por último)', () => {
    expect(escolherPrincipal([L(U(1), 90, 300), L(U(2), 50, 500), L(U(3), 2, 4)], null, AGORA)).toBe(U(3))
  })
  it('dois ativos, nunca escolheu: o de publicação mais recente, ainda que não seja o maior', () => {
    expect(escolherPrincipal([L(U(1), 90, 10), L(U(2), 5, 2)], null, AGORA)).toBe(U(2))
  })
  it('dois ativos com lembrança: a lembrança vale, ainda que o outro tenha publicado depois', () => {
    expect(escolherPrincipal([L(U(1), 90, 10), L(U(2), 5, 2)], U(1), AGORA)).toBe(U(1))
  })
  it('lembrança de canal parado com outro ativo: cede ao ativo', () => {
    expect(escolherPrincipal([L(U(1), 90, 300), L(U(2), 5, 6)], U(1), AGORA)).toBe(U(2))
  })
  it('lembrança de canal parado, mas NENHUM ativo: a lembrança vale', () => {
    expect(escolherPrincipal([L(U(1), 90, 300), L(U(2), 5, 200)], U(2), AGORA)).toBe(U(2))
    expect(escolherPrincipal([L(U(1), 90, 300), L(U(2), 5, 200)], U(1), AGORA)).toBe(U(1))
  })
  it('lembrança de canal inexistente ou sem vídeos: ignorada, vale a recência', () => {
    expect(escolherPrincipal([L(U(1), 90, 30), L(U(2), 5, 2)], U(99), AGORA)).toBe(U(2))
    expect(escolherPrincipal([L(U(1), 0, null), L(U(2), 5, 2), L(U(3), 5, 1)], U(1), AGORA)).toBe(U(3))
  })
  it('todos sem data: a ordem do motor (o primeiro da lista)', () => {
    expect(escolherPrincipal([L(U(1), 9, null), L(U(2), 9, null)], null, AGORA)).toBe(U(1))
    // sem data fica por último: quem tem data vence
    expect(escolherPrincipal([L(U(1), 9, null), L(U(2), 9, 400)], null, AGORA)).toBe(U(2))
  })
  it('empate de data: a ordem do motor', () => {
    expect(escolherPrincipal([L(U(1), 9, 7), L(U(2), 9, 7)], null, AGORA)).toBe(U(1))
    expect(escolherPrincipal([L(U(2), 9, 7), L(U(1), 9, 7)], null, AGORA)).toBe(U(2))
  })
  it('a janela de "ativo" é a de 91 dias (13 semanas): 91 é ativo, 92 é parado; sem data nunca é ativo', () => {
    expect(JANELA_ATIVO_DIAS).toBe(91)
    expect(escolherPrincipal([L(U(1), 9, 91), L(U(2), 9, 3)], U(1), AGORA)).toBe(U(1)) // ativo: a lembrança segura
    expect(escolherPrincipal([L(U(1), 9, 92), L(U(2), 9, 3)], U(1), AGORA)).toBe(U(2)) // parado: cede
    expect(escolherPrincipal([L(U(1), 9, null), L(U(2), 9, 3)], U(1), AGORA)).toBe(U(2))
  })
  it('é determinística: a mesma entrada dá a mesma saída, e a entrada não é alterada', () => {
    const linhas = [L(U(1), 9, 10), L(U(2), 9, 2)]
    const copia = JSON.stringify(linhas)
    expect(escolherPrincipal(linhas, null, AGORA)).toBe(escolherPrincipal(linhas, null, AGORA))
    expect(JSON.stringify(linhas)).toBe(copia)
  })
})

describe('o cookie obs-meu-canal', () => {
  afterEach(() => { document.cookie = `${COOKIE_MEU_CANAL}=; path=/cms; max-age=0` })
  it('só um uuid vale: ausente, vazio, lixo e script viram null, sem erro', () => {
    expect(parseMeuCanal(U(1))).toBe(U(1))
    for (const ruim of [undefined, null, '', '   ', 'lixo', "'; drop table", '<script>', U(1) + 'x', U(1).toUpperCase().slice(0, 30)]) expect(parseMeuCanal(ruim), String(ruim)).toBeNull()
  })
  it('lembrarMeuCanal grava só o id, com path /cms, SameSite=Lax e um ano; lerMeuCanalNoNavegador o devolve', () => {
    let escrito = ''
    const set = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!.set!
    const get = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!.get!
    Object.defineProperty(document, 'cookie', { configurable: true, get() { return get.call(document) }, set(v: string) { escrito = v; set.call(document, v) } })
    try {
      lembrarMeuCanal(U(7))
      expect(escrito).toBe(`${COOKIE_MEU_CANAL}=${U(7)}; path=/cms; max-age=31536000; samesite=lax`)
      expect(escrito).not.toMatch(/httponly/i)
    } finally { delete (document as unknown as { cookie?: string }).cookie }
  })
  it('13 (menor da 11c): o atributo Secure liga em https e não liga em http', () => {
    const grava = (protocolo: string) => {
      let escrito = ''
      Object.defineProperty(document, 'cookie', { configurable: true, get() { return '' }, set(v: string) { escrito = v } })
      vi.stubGlobal('location', { ...window.location, protocol: protocolo })
      try { lembrarMeuCanal(U(7)) } finally { vi.unstubAllGlobals(); delete (document as unknown as { cookie?: string }).cookie }
      return escrito
    }
    expect(grava('https:')).toBe(`${COOKIE_MEU_CANAL}=${U(7)}; path=/cms; max-age=31536000; samesite=lax; secure`)
    expect(grava('http:')).toBe(`${COOKIE_MEU_CANAL}=${U(7)}; path=/cms; max-age=31536000; samesite=lax`)
    expect(grava('http:')).not.toMatch(/secure/i)
  })
  it('ida e volta no CMS: o que lembrarMeuCanal grava, lerMeuCanalNoNavegador lê; fora do /cms o cookie não é visível (path)', () => {
    window.history.replaceState(null, '', '/cms/youtube/competitors')
    lembrarMeuCanal(U(9))
    expect(lerMeuCanalNoNavegador()).toBe(U(9))
    window.history.replaceState(null, '', '/blog')
    expect(lerMeuCanalNoNavegador()).toBeNull()
    window.history.replaceState(null, '', '/cms/youtube/competitors')
  })
  it('um id que não é uuid não é gravado', () => {
    lembrarMeuCanal('lixo')
    expect(lerMeuCanalNoNavegador()).toBeNull()
  })
  it('se o navegador recusar o cookie, a função não lança (a tela já mudou)', () => {
    Object.defineProperty(document, 'cookie', { configurable: true, get() { return '' }, set() { throw new Error('bloqueado') } })
    try { expect(() => lembrarMeuCanal(U(7))).not.toThrow() } finally { delete (document as unknown as { cookie?: string }).cookie }
  })
})

describe('as notas do menu (D-C.5)', () => {
  const F = createFmt(createClock(AGORA, AGORA, AGORA))
  const nota = (videos: number, diasAtras: number | null, subs: number | null) => notaDoCanal({ videos, ultimo: diasAtras == null ? null : ha(diasAtras), subs }, F, AGORA)
  it('ativo: "último vídeo há …, N inscritos"', () => {
    expect(nota(58, 14, 3210)).toBe('último vídeo há 2 semanas, 3,21 mil inscritos')
    expect(nota(58, 3, 3210)).toBe('último vídeo há 3 dias, 3,21 mil inscritos')
  })
  it('parado (mais de 91 dias): "parado: último vídeo há …"', () => {
    expect(nota(58, 150, 18400)).toBe('parado: último vídeo há 5 meses, 18,4 mil inscritos')
    expect(nota(58, 92, 18400)).toMatch(/^parado: último vídeo há /)
    expect(nota(58, 91, 18400)).toMatch(/^último vídeo há /)
  })
  it('sem datas de publicação: "vídeos sem data, …"; nunca "há 0"', () => {
    expect(nota(58, null, 3210)).toBe('vídeos sem data, 3,21 mil inscritos')
  })
  it('sem vídeos: como antes', () => { expect(nota(0, null, 412)).toBe('sem vídeos, 412 inscritos: ainda sem página') })
  it('inscritos ocultos trocam o trecho final', () => {
    expect(nota(58, 3, null)).toBe('último vídeo há 3 dias, inscritos ocultos')
    expect(nota(0, null, null)).toBe('sem vídeos, inscritos ocultos: ainda sem página')
  })
  it('um inscrito: singular', () => { expect(nota(2, 3, 1)).toBe('último vídeo há 3 dias, 1 inscrito') })
  it('haTempo: hoje, dia, semana, mês, ano; futuro e zero viram "hoje", nunca "há 0 dias"', () => {
    expect(haTempo(0)).toBe('hoje'); expect(haTempo(-3)).toBe('hoje')
    expect(haTempo(1)).toBe('há 1 dia'); expect(haTempo(13)).toBe('há 13 dias')
    expect(haTempo(14)).toBe('há 2 semanas'); expect(haTempo(7)).toBe('há 7 dias')
    expect(haTempo(59)).toBe('há 8 semanas'); expect(haTempo(60)).toBe('há 2 meses')
    expect(haTempo(364)).toMatch(/^há \d+ meses$/); expect(haTempo(365)).toBe('há 1 ano'); expect(haTempo(800)).toBe('há 2 anos')
  })
})

describe('ownMenuFromRows / ownMenuOf com a regra única', () => {
  const F = createFmt(createClock(AGORA, AGORA, AGORA))
  const row = (id: string, subs: number | null, videos: number, diasAtras: number | null) => ({ id, name: 'Canal ' + id.slice(-2), subs, videos, ultimo: diasAtras == null ? null : ha(diasAtras) })
  it('sem lembrança: o de publicação mais recente é o principal; o item vem na ordem do motor (inscritos)', () => {
    const m = ownMenuFromRows([row(U(1), 900, 90, 30), row(U(2), 50, 5, 2)], F, { lembrado: null, agora: AGORA })
    expect(m.itens.map(i => i.id)).toEqual([U(1), U(2)])
    expect(m.principal!.id).toBe(U(2))
  })
  it('com lembrança: ela vale; sem o cookie (apagado), volta à recência', () => {
    const rows = [row(U(1), 900, 90, 30), row(U(2), 50, 5, 2)]
    expect(ownMenuFromRows(rows, F, { lembrado: U(1), agora: AGORA }).principal!.id).toBe(U(1))
    expect(ownMenuFromRows(rows, F, { lembrado: null, agora: AGORA }).principal!.id).toBe(U(2)) // o teste que apaga o cookie
  })
  it('lembrança de canal que não é próprio, removido ou lixo: ignorada, sem erro', () => {
    const rows = [row(U(1), 900, 90, 30), row(U(2), 50, 5, 2)]
    for (const l of [U(50), 'lixo', '']) expect(ownMenuFromRows(rows, F, { lembrado: l, agora: AGORA }).principal!.id).toBe(U(2))
  })
  it('o motor (ownMenuOf) e a leitura leve dão a mesma resposta, com e sem lembrança', () => {
    const w = a3World()
    const obs = w.obs
    const ultimo = (id: string) => { const ps = obs.videos.filter(v => v.ch === id).map(v => v.pub); return ps.length ? Math.max(...ps) : null }
    const rows = obs.ownChannels().map(c => ({ id: c.id, name: c.name, subs: c.subs, videos: obs.videos.filter(v => v.ch === c.id).length, ultimo: ultimo(c.id) }))
    for (const lembrado of [null, obs.ownChannels()[0]!.id, obs.ownChannels()[1]!.id, 'lixo']) {
      expect(ownMenuFromRows(rows, obs.fmt, { lembrado, agora: obs.NOW }), String(lembrado)).toEqual(ownMenuOf(obs, lembrado))
    }
  })
})
