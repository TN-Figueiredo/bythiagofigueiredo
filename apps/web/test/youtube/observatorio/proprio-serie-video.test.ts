// @vitest-environment node
// Série de views por dia de UM vídeo: três estados por dia (com views, zero medido, não medido), o dia da publicação e o
// vídeo novo (menos de 3 dias de vida). Pura, sem banco. Dia sem linha NUNCA vira zero.
import { describe, it, expect } from 'vitest'
import { serieDoVideo, DIAS_DE_VIDA_MIN, JANELA_SERIE_DIAS } from '@/lib/youtube/observatorio/proprio/serie-video'
import { DIARIO_PARADO_DIAS } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DiarioCanal, DiarioLinha, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const HOJE = '2026-10-12'
const ULT = '2026-10-11' // o diário fecha o dia anterior
const d = (n: number) => addDays(ULT, -n)
const l = (ytId: string, n: number, views: number | null): DiarioLinha => ({ ytId, dia: d(n), views, pctAssistido: null, duracaoMediaSeg: null })
const canal = (linhas: DiarioLinha[], ultimoDia: string | null = ULT): Privado<DiarioCanal> => ({ acesso: 'ok', dado: { canalId: 'c', ultimoDia, linhas, descartados: 0 } })
const velho = addDays(HOJE, -200) // publicado há muito: a janela inteira é do vídeo

describe('constantes', () => {
  it('28 dias de janela; vídeo novo = menos de 3 dias de vida; mesmo "parado" do canal (7 dias)', () => {
    expect(JANELA_SERIE_DIAS).toBe(28)
    expect(DIAS_DE_VIDA_MIN).toBe(3)
    expect(DIARIO_PARADO_DIAS).toBe(7)
  })
})

describe('serieDoVideo: os três estados do dia', () => {
  const s = serieDoVideo(canal([l('v', 0, 12), l('v', 1, 0), l('v', 3, null), l('v', 4, 5)]), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
  const por = (n: number) => s.dias.find(x => x.dia === d(n))!
  it('linha com views > 0: com-views, com o número', () => {
    expect(por(0)).toMatchObject({ estado: 'com-views', views: 12 })
    expect(por(4)).toMatchObject({ estado: 'com-views', views: 5 })
  })
  it('linha com views 0: zero MEDIDO (0, não null)', () => {
    expect(por(1)).toMatchObject({ estado: 'zero-medido', views: 0 })
  })
  it('linha com views nulas: não medido, views null (nunca 0)', () => {
    expect(por(3)).toMatchObject({ estado: 'nao-medido', views: null })
  })
  it('dia SEM linha: não medido, views null (nunca 0)', () => {
    expect(por(2)).toMatchObject({ estado: 'nao-medido', views: null })
    expect(por(10)).toMatchObject({ estado: 'nao-medido', views: null })
  })
  it('os 28 dias, do mais antigo ao mais novo, sem buracos nem repetição', () => {
    expect(s.dias).toHaveLength(28)
    expect(s.dias[0]!.dia).toBe(d(27))
    expect(s.dias[27]!.dia).toBe(ULT)
    expect(s.dias.map(x => x.dia)).toEqual(Array.from({ length: 28 }, (_, i) => d(27 - i)))
  })
  it('estado ok, janela e contagem de dias medidos (com views ou zero)', () => {
    expect(s).toMatchObject({ estado: 'ok', janela: { de: d(27), ate: ULT }, ultimoDia: ULT, diasMedidos: 3 })
  })
})

describe('serieDoVideo: só o vídeo pedido e só a janela', () => {
  it('linhas de outro vídeo não entram; o dia -27 entra e o -28 não', () => {
    const s = serieDoVideo(canal([l('v', 27, 3), l('v', 28, 9), l('w', 2, 77)]), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(s.dias).toHaveLength(28)
    expect(s.dias[0]).toMatchObject({ dia: d(27), views: 3 })
    expect(s.dias.some(x => x.views === 9 || x.views === 77)).toBe(false)
  })
  it('a janela termina no último dia GRAVADO do canal (diário parado: as views novas não existem, os dias depois não são desenhados)', () => {
    const ult = addDays(HOJE, -20)
    const s = serieDoVideo(canal([{ ytId: 'v', dia: ult, views: 4, pctAssistido: null, duracaoMediaSeg: null }], ult), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(s.dias[s.dias.length - 1]!.dia).toBe(ult)
    expect(s.parado).toBe(true)
    expect(s.ultimoDia).toBe(ult)
  })
  it('parado = último dia há mais de 7 dias; exatamente 7 não', () => {
    const com = (n: number) => serieDoVideo(canal([l('v', 0, 1)], addDays(HOJE, -n)), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(com(7).parado).toBe(false)
    expect(com(8).parado).toBe(true)
  })
})

describe('serieDoVideo: dia da publicação', () => {
  it('o dia da publicação dentro da janela vem marcado; os dias ANTES dele não existem (não são "não medido")', () => {
    const pub = d(9)
    const s = serieDoVideo(canal([l('v', 9, 40), l('v', 8, 20), l('v', 0, 2)]), { ytId: 'v', publicadoEm: pub, hoje: HOJE })
    expect(s.dias[0]!.dia).toBe(pub)
    expect(s.dias).toHaveLength(10)
    expect(s.dias.filter(x => x.publicacao).map(x => x.dia)).toEqual([pub])
    expect(s.diaPublicacao).toBe(pub)
    expect(s.janela).toEqual({ de: pub, ate: ULT })
  })
  it('publicado antes da janela: nenhum dia marcado, janela cheia, mas o diaPublicacao continua dito', () => {
    const s = serieDoVideo(canal([l('v', 0, 2)]), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(s.dias.some(x => x.publicacao)).toBe(false)
    expect(s.diaPublicacao).toBe(velho)
    expect(s.dias).toHaveLength(28)
  })
  it('data de publicação desconhecida: janela cheia, sem marca', () => {
    const s = serieDoVideo(canal([l('v', 0, 2)]), { ytId: 'v', publicadoEm: null, hoje: HOJE })
    expect(s.dias).toHaveLength(28)
    expect(s.diaPublicacao).toBeNull()
    expect(s.estado).toBe('ok')
  })
  it('publicado na fronteira da janela (dia -27): marcado no primeiro dia', () => {
    const s = serieDoVideo(canal([l('v', 27, 40)]), { ytId: 'v', publicadoEm: d(27), hoje: HOJE })
    expect(s.dias[0]).toMatchObject({ dia: d(27), publicacao: true })
    expect(s.dias).toHaveLength(28)
  })
})

describe('serieDoVideo: vídeo novo (menos de 3 dias de vida)', () => {
  it('publicado hoje, ontem ou anteontem: video-novo, sem dias (ainda não há dia fechado), sem nenhum zero', () => {
    for (const idade of [0, 1, 2]) {
      const s = serieDoVideo(canal([l('v', 0, 5)]), { ytId: 'v', publicadoEm: addDays(HOJE, -idade), hoje: HOJE })
      expect(s).toMatchObject({ estado: 'video-novo', dias: [], diasMedidos: 0 })
    }
  })
  it('3 dias de vida já não é novo', () => {
    const s = serieDoVideo(canal([l('v', 0, 5)]), { ytId: 'v', publicadoEm: addDays(HOJE, -3), hoje: HOJE })
    expect(s.estado).toBe('ok')
    expect(s.dias.length).toBeGreaterThan(0)
  })
  it('canal sem nenhum dia gravado e vídeo novo: vale sem-diario (a coleta não rodou; é o motivo que o dono pode agir)', () => {
    const s = serieDoVideo(canal([], null), { ytId: 'v', publicadoEm: HOJE, hoje: HOJE })
    expect(s.estado).toBe('sem-diario')
  })
})

describe('serieDoVideo: sem série, com o motivo', () => {
  it('quem não edita o site: sem-acesso, nenhuma linha, nenhum número', () => {
    const s = serieDoVideo({ acesso: 'negado' }, { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(s).toMatchObject({ estado: 'sem-acesso', dias: [], janela: null, ultimoDia: null, diasMedidos: 0 })
    expect(s).toEqual({ estado: 'sem-acesso', dias: [], janela: null, ultimoDia: null, parado: false, diasMedidos: 0, diaPublicacao: velho })
  })
  it('leitura que falhou: leitura-falhou', () => {
    expect(serieDoVideo({ acesso: 'erro' }, { ytId: 'v', publicadoEm: velho, hoje: HOJE })).toMatchObject({ estado: 'leitura-falhou', dias: [] })
  })
  it('canal sem nenhum dia gravado (coleta não rodou): sem-diario, sem dias desenhados', () => {
    expect(serieDoVideo(canal([], null), { ytId: 'v', publicadoEm: velho, hoje: HOJE })).toMatchObject({ estado: 'sem-diario', dias: [], ultimoDia: null })
  })
  it('diário existe mas o vídeo não tem NENHUM dia medido na janela: sem-medida, com os 28 dias todos "não medido" (nunca zeros)', () => {
    const s = serieDoVideo(canal([l('w', 1, 30)]), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(s.estado).toBe('sem-medida')
    expect(s.diasMedidos).toBe(0)
    expect(s.dias).toHaveLength(28)
    expect(s.dias.every(x => x.estado === 'nao-medido' && x.views === null)).toBe(true)
  })
  it('só linhas com views nulas também é sem-medida', () => {
    expect(serieDoVideo(canal([l('v', 1, null), l('v', 2, null)]), { ytId: 'v', publicadoEm: velho, hoje: HOJE }).estado).toBe('sem-medida')
  })
  it('só zeros medidos é ok (zero medido é medida): a tela diz "sem view", não "não medido"', () => {
    const s = serieDoVideo(canal([l('v', 1, 0), l('v', 2, 0)]), { ytId: 'v', publicadoEm: velho, hoje: HOJE })
    expect(s.estado).toBe('ok')
    expect(s.diasMedidos).toBe(2)
  })
  it('publicado DEPOIS do último dia gravado (diário parado antes do vídeo existir): sem-medida e sem dias', () => {
    const pub = addDays(HOJE, -5)
    const s = serieDoVideo(canal([l('w', 20, 3)], addDays(HOJE, -30)), { ytId: 'v', publicadoEm: pub, hoje: HOJE })
    expect(s).toMatchObject({ estado: 'sem-medida', dias: [], janela: null })
  })
})
