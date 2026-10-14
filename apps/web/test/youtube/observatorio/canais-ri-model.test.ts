// @vitest-environment node
// apps/web/test/youtube/observatorio/canais-ri-model.test.ts
// A5 · E5a · R4. Modelo das seções Referências e Inscritos. Dado 100% sintético; datas relativas a AGORA.
import { describe, it, expect } from 'vitest'
import { buildRiView, riEmErro, ROTULOS_NOVOS_RI, type RiObs } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-model'
import { referenciaDoCanal } from '@/lib/youtube/observatorio/referencias'
import { inscritosDoCanal } from '@/lib/youtube/observatorio/inscritos-28d'
import { spDayStart } from '@/lib/youtube/observatorio/time'
import type { ObsChannel, ObsVideo, Fmt, ChannelSnapshot } from '@/lib/youtube/observatorio/types'
import type { RiSecao, RiLinhaRef, RiLinhaIns, RiView } from '@/app/cms/(authed)/youtube/competitors/_canais/ri-tipos'

const DIA = 864e5
const HORA = 36e5
const AGORA = Date.parse('2026-06-15T15:00:00Z')

function canal(id: string, over: Partial<ObsChannel> = {}): ObsChannel {
  return {
    id, name: id, fullName: id, niche: null, own: false, lang: 'pt', subs: 1000, video_limit: 50,
    url: '', handle: '', gender: 'n', color: '#000', ini: 'C', undated: [],
    sync: { state: 'ok', last: AGORA, next: null, added: null, errorSince: null, msg: null, backfill: null },
    activity: { state: 'ativo' }, lastIdx: null, snapshots: [], ...over,
  }
}
let seq = 0
function video(ch: string, dias: number, views: number | null, fmt: Fmt = 'long'): ObsVideo {
  const pub = AGORA - dias * DIA
  return {
    id: 'v' + seq++, ch, niche: null, fmt, isShort: null, pub, ageDays: Math.floor((AGORA - pub) / DIA), tracked: true,
    title: 't', theme: null, formulas: [], url: '', ytId: 'y' + seq, dur: null, views, viewsAt: AGORA,
    likes: null, comments: null, series: [], firstIdx: null, titles: [], thumbs: [], descs: [],
  }
}
/** 5 vídeos cuja mediana é v, p25 lo, p75 hi (quant linear sobre 5 valores ordenados). */
const cinco = (ch: string, v: number, lo: number, hi: number, fmt: Fmt = 'long') =>
  [Math.max(0, lo / 2), lo, v, hi, hi * 2].map((x, i) => video(ch, 20 + i * 3, x, fmt))
const snap = (diasAtras: number, subs: number): ChannelSnapshot => {
  const t = spDayStart(AGORA - diasAtras * DIA) + 12 * HORA
  const d = new Date(t - 3 * HORA)
  const p = (n: number) => String(n).padStart(2, '0')
  return { t, date: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, subs, views: 0 }
}
const serie = (hoje: number, antes: number, dias = 40): ChannelSnapshot[] => [snap(dias, antes), snap(28, antes), snap(0, hoje)]

const obsDe = (channels: ObsChannel[], videos: ObsVideo[], last: number | null = AGORA): RiObs => ({ channels, videos, SYNC: { last } })
const P = { agoraMs: AGORA, niche: 'todos', fmt: 'long' as Fmt, meuCanalLembrado: null as string | null }
const ok = <L, O extends string>(s: RiSecao<L, O>) => { if (s.estado !== 'ok') throw new Error('esperava ok, veio ' + s.estado); return s }
const texto = (f: Array<{ t: string }>) => f.map(x => x.t).join('')

// ---- o conjunto do estado "cheio" do mockup (Referências) ----
const CHEIO: Array<{ n: string; v: number; lo: number; hi: number; own?: true }> = [
  { n: 'Rota Solta', v: 1180000, lo: 640000, hi: 1900000 }, { n: 'Mochila Nômade ao Vivo', v: 812000, lo: 590000, hi: 1010000 },
  { n: 'Dois Passaportes', v: 455000, lo: 120000, hi: 1400000 }, { n: 'Quilômetro Zero', v: 301000, lo: 248000, hi: 360000 },
  { n: 'Viajar Sem Pressa', v: 270000, lo: 201000, hi: 333000 }, { n: 'Terra Firme', v: 212000, lo: 40000, hi: 690000 },
  { n: 'Canal Exemplo', v: 88000, lo: 61000, hi: 120000, own: true }, { n: 'Cabine Dupla', v: 76000, lo: 70000, hi: 83000 },
  { n: 'Mapa Amassado', v: 64500, lo: 22000, hi: 150000 }, { n: 'Bagagem de Mão', v: 51000, lo: 38000, hi: 72000 },
  { n: 'Café em Trânsito', v: 44000, lo: 9000, hi: 260000 }, { n: 'Janela do Fundo', v: 38200, lo: 30500, hi: 47000 },
  { n: 'Trilha e Tralha', v: 29000, lo: 17000, hi: 41000 }, { n: 'Passagem Barata TV', v: 21800, lo: 15000, hi: 33000 },
  { n: 'Voo Rasante', v: 17400, lo: 2100, hi: 98000 }, { n: 'Estrada de Terra', v: 14900, lo: 11800, hi: 19000 },
  { n: 'Meia Estação', v: 11200, lo: 7500, hi: 15500 }, { n: 'Vaga na Janela', v: 8700, lo: 5200, hi: 12400 },
  { n: 'Diário de Escala', v: 6100, lo: 4300, hi: 8800 }, { n: 'Fim de Linha', v: 4400, lo: 3100, hi: 6300 },
  { n: 'Baldeação', v: 2900, lo: 1200, hi: 5400 }, { n: 'Pé na Estrada', v: 2400, lo: 1700, hi: 3500 },
]
function cheio(): RiObs {
  const chs: ObsChannel[] = [], vs: ObsVideo[] = []
  for (const c of CHEIO) { chs.push(canal(c.n, { name: c.n, own: !!c.own })); vs.push(...cinco(c.n, c.v, c.lo, c.hi)) }
  // 2 provisórias (3 e 4 vídeos) e 3 sem medida
  chs.push(canal('Guia Nenhum', { name: 'Guia Nenhum' })); vs.push(...[1800, 1500, 2000, 900].map((x, i) => video('Guia Nenhum', 20 + i * 3, x)))
  chs.push(canal('Primeira Viagem', { name: 'Primeira Viagem' })); vs.push(...[9200, 8000, 9900].map((x, i) => video('Primeira Viagem', 20 + i * 3, x)))
  chs.push(canal('Estreia Recente', { name: 'Estreia Recente' })); vs.push(video('Estreia Recente', 20, 100), video('Estreia Recente', 30, 200))
  chs.push(canal('Sem Postar Desde Julho', { name: 'Sem Postar Desde Julho' }))
  chs.push(canal('Canal Recém-Adicionado', { name: 'Canal Recém-Adicionado', sync: { state: 'backfill', last: null, next: null, added: null, errorSince: null, msg: null, backfill: null } }))
  return obsDe(chs, vs)
}

describe('Referências: o texto do mockup cheio', () => {
  it('a frase do mockup cheio sai igual, letra por letra', () => {
    const { view, falhas } = buildRiView(cheio(), P)
    expect(falhas).toEqual([])
    const s = ok(view.referencias)
    expect(texto(s.frase)).toBe(
      'Nos últimos 90 dias, o vídeo típico de Rota Solta tem 1,2 mi de views, o mais alto entre os 22 canais medidos. ' +
      'Seu canal está em 7º (88 mil). 5 têm faixa larga (as views variam muito de um vídeo para outro); 3 sem medida, 2 com mediana provisória.')
    expect(s.frase.filter(x => x.b).map(x => x.t)).toEqual(['Rota Solta tem 1,2 mi de views', 'Seu canal está em 7º (88 mil).'])
  })
  it('lista: unidade única em mil, 1,42 mi acima de 999 mil, nunca 1.180 mil', () => {
    const s = ok(buildRiView(cheio(), P).view.referencias)
    const rota = s.linhas.find(l => l.id === 'Rota Solta')!
    expect(rota.valor).toBe('1,18 mi')
    expect(s.linhas.find(l => l.id === 'Mochila Nômade ao Vivo')!.valor).toBe('812 mil')
    expect(JSON.stringify(s.linhas)).not.toMatch(/1\.180 mil/)
  })
  it('ordem padrão: medidos pela mediana, depois provisórias, depois sem medida pelo nome; rótulos do mockup', () => {
    const s = ok(buildRiView(cheio(), P).view.referencias)
    expect(s.ordens.mediana.ids.slice(0, 3)).toEqual(['Rota Solta', 'Mochila Nômade ao Vivo', 'Dois Passaportes'])
    expect(s.ordens.mediana.ids).toHaveLength(22)
    expect(s.linhas.slice(22).map(l => l.id)).toEqual(['Primeira Viagem', 'Guia Nenhum', 'Canal Recém-Adicionado', 'Estreia Recente', 'Sem Postar Desde Julho'])
    expect(s.ordens.mediana.rotulo).toBe('Views do vídeo típico')
    expect(s.ordens.faixa.rotulo).toBe('Faixa mais estreita')
    expect(s.n).toBe(27)
  })
  it('pílulas e textos das linhas sem medida e provisória', () => {
    const s = ok(buildRiView(cheio(), P).view.referencias)
    const por = (id: string) => s.linhas.find(l => l.id === id)!
    expect(por('Guia Nenhum').pilula).toEqual({ tipo: 'prov', texto: 'provisória · 4 vídeos' })
    expect(por('Guia Nenhum').provisoria).toBe(true)
    expect(por('Guia Nenhum').faixa).toBeNull()
    expect(por('Estreia Recente').pilula).toEqual({ tipo: 'nm', texto: 'sem medida · poucos vídeos (2)' })
    expect(por('Canal Recém-Adicionado').pilula).toEqual({ tipo: 'nm', texto: 'sem medida · ainda não coletado' })
    expect(por('Sem Postar Desde Julho').pilula).toEqual({ tipo: 'nm', texto: 'sem medida · sem vídeos em 90 dias' })
    expect(por('Rota Solta').sub).toBe('～ faixa média · 3,0× · 5 vídeos')
    expect(por('Dois Passaportes').sub).toBe('≋ faixa larga · 12× · 5 vídeos')
  })
  it('seu canal e os dois ganham o selo (proprio)', () => {
    const s = ok(buildRiView(cheio(), P).view.referencias)
    expect(s.linhas.filter(l => l.proprio).map(l => l.id)).toEqual(['Canal Exemplo'])
  })
})

describe('Referências: ordem, escala, escopo', () => {
  it('ordem faixa: a mais estreita primeiro; provisórias e sem medida no fim nas duas ordens', () => {
    const { view } = buildRiView(cheio(), { ...P, ordr: 'faixa' })
    const s = ok(view.referencias)
    expect(view.ordem.ref).toBe('faixa')
    expect(s.ordens.faixa.ids[0]).toBe('Cabine Dupla')
    expect(s.ordens.faixa.ids.at(-1)).toBe('Voo Rasante')
    for (const o of ['mediana', 'faixa'] as const) expect(s.ordens[o].ids).toHaveLength(22)
    expect(s.linhas.slice(22).every(l => l.marca == null || l.provisoria)).toBe(true)
  })
  it('ordr=lixo cai em mediana; ordi=lixo cai em pct; aba lixo cai em ref', () => {
    const { view } = buildRiView(cheio(), { ...P, ordr: 'lixo', ordi: 'lixo', aba: 'lixo' })
    expect(view.ordem).toEqual({ ref: 'mediana', ins: 'pct' })
    expect(view.aba).toBe('ref')
    expect(buildRiView(cheio(), { ...P, aba: 'ins' }).view.aba).toBe('ins')
  })
  it('ordens são ids que existem em linhas', () => {
    const { view } = buildRiView(cheio(), P)
    for (const s of [ok(view.referencias), ok(view.inscritos)]) {
      const ids = new Set((s.linhas as Array<{ id: string }>).map(l => l.id))
      for (const o of Object.values(s.ordens)) for (const id of o.ids) expect(ids.has(id)).toBe(true)
    }
  })
  it('escala com um canal de 300 views e um de 3 mi: ticks de 100 a 10 mi, posições crescentes', () => {
    const o = obsDe([canal('a'), canal('b')], [...cinco('a', 300, 250, 350), ...cinco('b', 3e6, 2e6, 4e6)])
    const { view } = buildRiView(o, P)
    expect(view.ticks.map(t => t.rotulo)).toEqual(['100', '1 mil', '10 mil', '100 mil', '1 mi', '10 mi'])
    const pos = view.ticks.map(t => t.pos)
    expect(pos[0]).toBe(0)
    expect(pos.at(-1)).toBe(100)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    const a = ok(view.referencias).linhas.find(l => l.id === 'a')!
    expect(a.marca!).toBeGreaterThan(0)
    expect(a.marca!).toBeLessThan(ok(view.referencias).linhas.find(l => l.id === 'b')!.marca!)
  })
  it('domínio tem no mínimo duas décadas', () => {
    const o = obsDe([canal('a')], cinco('a', 5000, 4000, 6000))
    expect(buildRiView(o, P).view.ticks.map(t => t.rotulo)).toEqual(['1 mil', '10 mil', '100 mil'])
  })
  it('valor 0 fica na borda esquerda e o texto alternativo diz o valor verdadeiro', () => {
    const vs = [0, 0, 0, 500, 900].map((x, i) => video('z', 20 + i, x))
    const o = obsDe([canal('z'), canal('y')], [...vs, ...cinco('y', 5000, 4000, 6000)])
    const l = ok(buildRiView(o, P).view.referencias).linhas.find(x => x.id === 'z')!
    expect(l.marca).toBe(0)
    expect(l.ariaLabel).toContain(' 0 views')
  })
  it('p25 = 0: faixa larga sem razão escrita', () => {
    const vs = [0, 0, 100, 400, 900].map((x, i) => video('z', 20 + i, x))
    const l = ok(buildRiView(obsDe([canal('z')], vs), P).view.referencias).linhas[0]!
    expect(l.sub).toBe('≋ faixa larga · 5 vídeos')
    expect(JSON.stringify(l)).not.toMatch(/Infinity|NaN/)
  })
  it('escopo Shorts usa só Shorts; Inscritos igual nos dois escopos', () => {
    const c = canal('a', { snapshots: serie(60000, 50000) })
    const o = obsDe([c], [...cinco('a', 9000, 8000, 10000, 'long'), ...cinco('a', 700, 600, 800, 'short')])
    const L = buildRiView(o, { ...P, fmt: 'long' }).view
    const S = buildRiView(o, { ...P, fmt: 'short' }).view
    expect(ok(L.referencias).linhas[0]!.valor).toBe('9 mil')
    expect(ok(S.referencias).linhas[0]!.valor).toBe('700')
    expect(S.inscritos).toEqual(L.inscritos)
  })
  it('nicho X tira os canais de fora das duas seções', () => {
    const a = canal('a', { niche: 'x', snapshots: serie(60000, 50000) }), b = canal('b', { niche: 'y', snapshots: serie(60000, 50000) })
    const o = obsDe([a, b], [...cinco('a', 9000, 8000, 10000), ...cinco('b', 9000, 8000, 10000)])
    const v = buildRiView(o, { ...P, niche: 'x' }).view
    expect(ok(v.referencias).linhas.map(l => l.id)).toEqual(['a'])
    expect(ok(v.inscritos).linhas.map(l => l.id)).toEqual(['a'])
  })
  it('legenda: filtro Todos/Longos diz vídeos longos; Shorts diz Shorts', () => {
    const o = obsDe([canal('a')], cinco('a', 9000, 8000, 10000))
    expect(ok(buildRiView(o, { ...P, fmt: 'long' }).view.referencias).legenda.join(' | ')).toContain(ROTULOS_NOVOS_RI.formato.long)
    expect(ROTULOS_NOVOS_RI.formato.long).toBe('vídeos longos')
    const s = ok(buildRiView(o, { ...P, fmt: 'short' }).view.referencias).legenda.join(' | ')
    expect(s).toContain('Shorts')
    expect(s).not.toContain('vídeos longos')
  })
  it('escopo Shorts sem Shorts: "sem Shorts em 90 dias"', () => {
    const o = obsDe([canal('a'), canal('b')], [...cinco('a', 9000, 8000, 10000)])
    const l = ok(buildRiView(o, { ...P, fmt: 'short' }).view.referencias)
    expect(l.linhas.find(x => x.id === 'b')!.pilula!.texto).toBe('sem medida · sem Shorts em 90 dias')
  })
})

describe('Referências: seu canal', () => {
  const dois = (): RiObs => obsDe([canal('a'), canal('p1', { own: true }), canal('p2', { own: true })],
    [...cinco('a', 9000, 8000, 10000), ...cinco('p1', 5000, 4000, 6000), ...cinco('p2', 1000, 900, 1100)])
  it('canal próprio fora do nicho: a oração "Seu canal" some', () => {
    const o = obsDe([canal('a', { niche: 'x' }), canal('p', { own: true, niche: 'y' })], [...cinco('a', 9000, 8000, 10000), ...cinco('p', 5000, 4000, 6000)])
    const t = texto(ok(buildRiView(o, { ...P, niche: 'x' }).view.referencias).frase)
    expect(t).not.toContain('Seu canal')
  })
  it('dois canais próprios e nenhum lembrado: a oração some; com o lembrado, cita ele', () => {
    expect(texto(ok(buildRiView(dois(), P).view.referencias).frase)).not.toContain('Seu canal')
    expect(texto(ok(buildRiView(dois(), { ...P, meuCanalLembrado: 'p2' }).view.referencias).frase)).toContain('Seu canal está em 3º (1 mil)')
    expect(ok(buildRiView(dois(), P).view.referencias).linhas.filter(l => l.proprio)).toHaveLength(2)
  })
  it('lembrado que não está no escopo: a oração some (nunca "em 0º")', () => {
    expect(texto(ok(buildRiView(dois(), { ...P, meuCanalLembrado: 'nao-existe' }).view.referencias).frase)).not.toMatch(/Seu canal|0º/)
  })
})

describe('Dado apagado e relógio', () => {
  it('obs sem vídeos na janela: frase nova de Referências, nenhum líder, nenhuma régua', () => {
    const { view } = buildRiView(obsDe([canal('a'), canal('b')], []), P)
    const s = ok(view.referencias)
    expect(texto(s.frase)).toBe('Nenhum canal pôde ser medido nos últimos 90 dias.')
    expect(s.linhas.every(l => l.marca == null)).toBe(true)
    expect(s.ordens.mediana.ids).toEqual([])
    expect(view.ticks).toEqual([])
  })
  it('obs sem retratos em nenhum canal: frase de Inscritos e nenhuma linha medida', () => {
    const s = ok(buildRiView(obsDe([canal('a'), canal('b')], cinco('a', 9000, 8000, 10000)), P).view.inscritos)
    expect(texto(s.frase)).toBe('Nenhum canal pôde ser medido nos últimos 28 dias.')
    expect(s.linhas.every(l => l.classe == null && l.barra == null)).toBe(true)
    expect(s.linhas[0]!.pilula).toEqual({ tipo: 'nm', texto: 'sem medida · ainda não coletado' })
  })
  it('nenhum canal no escopo: os dois vazios do mockup', () => {
    const { view } = buildRiView(obsDe([], []), P)
    expect(view.referencias).toEqual({ estado: 'vazio', titulo: 'Nenhum canal acompanhado ainda.', texto: 'Adicione canais em Canais para ver quem mantém as views em alta.' })
    expect(view.inscritos).toEqual({ estado: 'vazio', titulo: 'Sem inscritos para mostrar.', texto: 'Os números aparecem depois da primeira coleta de cada canal.' })
  })
  it('obs.SYNC.last nulo: sem aviso e sem "Última leitura boa"', () => {
    const o = obsDe([canal('a')], [], null)
    expect(buildRiView(o, P).view.aviso).toBeNull()
    const e = riEmErro(o)
    expect(e.referencias).toMatchObject({ estado: 'erro', ultimaBoa: null })
    expect(e.inscritos).toMatchObject({ estado: 'erro', ultimaBoa: null })
  })
  it('obs.SYNC.last 49 h antes de AGORA: aviso com a data e "há 2 dias"; 47 h: sem aviso', () => {
    const velho = buildRiView(obsDe([canal('a')], [], AGORA - 49 * HORA), P).view.aviso
    expect(velho).toMatch(/^Mostrando os dados de 1[23]\/06, \d\d:\d\d \(última coleta há 2 dias\)\. Ordenar continua funcionando\.$/)
    expect(buildRiView(obsDe([canal('a')], [], AGORA - 47 * HORA), P).view.aviso).toBeNull()
  })
  it('canal com primeiro retrato há 11 dias: nota "Entrou há 11 dias; faltam 17…"', () => {
    const c = canal('n', { snapshots: [snap(11, 6000), snap(0, 6900)] })
    const l = ok(buildRiView(obsDe([c], []), P).view.inscritos).linhas[0]!
    expect(l.pilula).toEqual({ tipo: 'nm', texto: 'sem medida · menos de 28 dias' })
    expect(l.nota).toBe('Entrou há 11 dias; faltam 17 para ter 28 dias de histórico.')
  })
  it('motivos novos de Inscritos', () => {
    const cs = [
      canal('prop', { own: true }), canal('ocu', { subs: null }),
      canal('velho', { snapshots: [snap(10, 5000), snap(5, 5000)] }),
      canal('arred', { snapshots: serie(143000, 143000) }),
      canal('buraco', { snapshots: [snap(40, 5000), snap(20, 5000), snap(0, 5000)] }),
    ]
    const por = Object.fromEntries(ok(buildRiView(obsDe(cs, []), P).view.inscritos).linhas.map(l => [l.id, l]))
    expect(por.prop.pilula!.texto).toBe('sem medida · sem histórico público do seu canal')
    expect(por.ocu.pilula!.texto).toBe('sem medida · contagem oculta')
    expect(por.ocu.nota).toBe('O canal escondeu a contagem de inscritos.')
    expect(por.velho.pilula!.texto).toMatch(/^sem medida · contagem parada desde \d\d\/\d\d$/)
    expect(por.arred.pilula!.texto).toBe('sem medida · dentro do arredondamento (±1 mil)')
    expect(por.arred.nota).toBe('143 mil no total')
    expect(por.buraco.pilula!.texto).toMatch(/^sem medida · falta a contagem de \d\d\/\d\d$/)
  })
  it('coleta velha do canal: "última coleta em dd/mm"', () => {
    const c = canal('a', { sync: { state: 'ok', last: AGORA - 60 * HORA, next: null, added: null, errorSince: null, msg: null, backfill: null } })
    const l = ok(buildRiView(obsDe([c], cinco('a', 9000, 8000, 10000)), P).view.referencias).linhas[0]!
    expect(l.pilula!.texto).toMatch(/^sem medida · última coleta em \d\d\/\d\d$/)
  })
  it('janela parcial: "provisória · só desde dd/mm"', () => {
    const c = canal('a', { video_limit: 5 })
    const l = ok(buildRiView(obsDe([c], cinco('a', 9000, 8000, 10000)), P).view.referencias).linhas[0]!
    expect(l.provisoria).toBe(true)
    expect(l.pilula).toEqual({ tipo: 'prov', texto: expect.stringMatching(/^provisória · só desde \d\d\/\d\d$/) })
  })
})

describe('Portão Phil: janela parcial, frase de queda e ⓘ', () => {
  it('P1: canal que posta Shorts todo dia, escopo longos: "sem medida · só desde dd/mm", nunca "sem vídeos em 90 dias"', () => {
    const c = canal('a', { video_limit: 50 })
    const shorts = Array.from({ length: 50 }, (_, i) => video('a', 1 + (i * 15) / 49, 100 + i, 'short'))
    const l = ok(buildRiView(obsDe([c], shorts), P).view.referencias).linhas[0]!
    expect(l.pilula).toEqual({ tipo: 'nm', texto: expect.stringMatching(/^sem medida · só desde \d\d\/\d\d$/) })
    expect(l.pilula!.texto).not.toContain('sem vídeos')
  })
  it('m-b: todos caíram, a frase não contém "cresceu" nem "ganhou mais"', () => {
    const o = obsDe([
      canal('A', { name: 'A', subs: 50000, snapshots: serie(50000, 55000) }),
      canal('B', { name: 'B', subs: 120000, snapshots: serie(120000, 124000) }),
    ], [])
    const t = texto(ok(buildRiView(o, P).view.inscritos).frase)
    expect(t).not.toContain('cresceu')
    expect(t).not.toContain('ganhou mais')
    expect(t).toBe('Em 28 dias, 2 caíram.')
  })
  it('m-b: só o ganho positivo é citado (um subiu, outro caiu)', () => {
    const o = obsDe([
      canal('A', { name: 'A', subs: 50000, snapshots: serie(50000, 55000) }),
      canal('B', { name: 'B', subs: 120000, snapshots: serie(120000, 118000) }),
    ], [])
    const t = texto(ok(buildRiView(o, P).view.inscritos).frase)
    expect(t).toContain('B cresceu mais em %')
    expect(t).not.toContain('A ganhou')
  })
  it('m-c: o ⓘ de Referências diz última leitura, não "Views de hoje"', () => {
    const s = ok(buildRiView(obsDe([canal('a')], cinco('a', 9000, 8000, 10000)), P).view.referencias)
    const t = s.info.itens.join(' ')
    expect(t).toContain('Views da última leitura de cada vídeo publicado nos últimos 90 dias.')
    expect(t).not.toContain('Views de hoje')
  })
})

describe('Inscritos: frase, ordens e barra', () => {
  // ganhos: A +5000 (143k→148k? passo 1 mil: >=2 mil ok) ; B maior em %, C maior em número, D cai, E sem variação (exata)
  const ins = (): RiObs => obsDe([
    canal('A', { name: 'A', subs: 120000, snapshots: serie(120000, 118000) }),   // +2000, 1,7%
    canal('B', { name: 'B', subs: 9000, snapshots: serie(9000, 6000) }),         // +3000, 50%
    canal('C', { name: 'C', subs: 2000000, snapshots: serie(2000000, 1900000) }), // +100000, 5,3%
    canal('D', { name: 'D', subs: 50000, snapshots: serie(50000, 55000) }),      // -5000, -9,1%
    canal('E', { name: 'E', subs: 400, snapshots: serie(400, 400) }),            // exata, 0
    canal('F', { name: 'F', subs: 143000, snapshots: serie(143000, 143000) }),   // arredondamento
  ], [])
  it('frase com os dois líderes e as contagens; zeradas omitidas', () => {
    const t = texto(ok(buildRiView(ins(), P).view.inscritos).frase)
    expect(t).toBe('Em 28 dias, B cresceu mais em %: +50,0% (+3.000). C ganhou mais em número: +100.000. 3 subiram, 1 caíram, 1 sem variação; 1 sem medida.'.replace('1 caíram', '1 caiu'))
  })
  it('contagens zeradas omitidas', () => {
    const o = obsDe([canal('A', { snapshots: serie(120000, 118000) })], [])
    const t = texto(ok(buildRiView(o, P).view.inscritos).frase)
    expect(t).toBe('Em 28 dias, A cresceu mais em %: +1,7% (+2.000). Também foi o que mais ganhou em número. 1 subiu.')
  })
  it('linha medida: pct, sub com ganho, total e as datas de/ate', () => {
    const l = ok(buildRiView(ins(), P).view.inscritos).linhas.find(x => x.id === 'B')!
    expect(l.classe).toBe('up')
    expect(l.pct).toBe('+50,0%')
    expect(l.sub).toMatch(/^\+3\.000 · 9 mil no total · de \d\d\/\d\d a \d\d\/\d\d$/)
    const e = ok(buildRiView(ins(), P).view.inscritos).linhas.find(x => x.id === 'E')!
    expect(e.classe).toBe('eq')
    expect(e.pct).toBe('sem variação')
    const d = ok(buildRiView(ins(), P).view.inscritos).linhas.find(x => x.id === 'D')!
    expect(d.classe).toBe('dn')
    expect(d.pct).toBe('−9,1%')
  })
  it('ordem pct x abs; ordi=abs: a barra e a legenda seguem o absoluto', () => {
    const pct = buildRiView(ins(), P).view
    expect(ok(pct.inscritos).ordens.pct.ids).toEqual(['B', 'C', 'A', 'E', 'D'])
    expect(ok(pct.inscritos).ordens.abs.ids).toEqual(['C', 'B', 'A', 'E', 'D'])
    const barra = (v: RiView, id: string) => ok(v.inscritos).linhas.find(l => l.id === id)!.barra!
    expect(barra(pct, 'B').pct).toBe(50)
    expect(barra(pct, 'C').pct).toBeCloseTo(50 * 5.26 / 50, 0)
    const abs = buildRiView(ins(), { ...P, ordi: 'abs' }).view
    expect(abs.ordem.ins).toBe('abs')
    expect(barra(abs, 'C').abs).toBe(50)
    expect(barra(abs, 'B').abs).toBeCloseTo(1.5, 1)
    expect(ok(abs.inscritos).ordens.abs.legendaBarra).toBe('Barra: tamanho do ganho em inscritos.')
    expect(ok(pct.inscritos).ordens.pct.legendaBarra).toBe('Barra: tamanho do ganho em %.')
  })
  it('legenda: 4 símbolos e o ⓘ ganha a frase dos 30 dias', () => {
    const s = ok(buildRiView(ins(), P).view.inscritos)
    expect(s.legenda.slice(0, 4)).toEqual(['subiu', 'caiu', 'sem variação', 'sem medida'])
    expect(s.info.itens.join(' ')).toContain('Esta seção usa 28 dias; a coluna Crescimento da lista usa 30. Por isso os números podem ser diferentes.')
  })
})

describe('Portão Yannis: arredondar, barra por ordem, isolamento, fronteiras', () => {
  const seis = (ch: string, views: number[]) => views.map((v, i) => video(ch, 20 + i * 3, v))
  it('I1: mediana fracionária (577,5) sai inteira na coluna, na frase e no aria; sem ponto decimal', () => {
    const o = obsDe([canal('a')], seis('a', [310, 420, 515, 640, 700, 880]))
    const s = ok(buildRiView(o, P).view.referencias)
    const l = s.linhas[0]!
    expect(l.valor).toBe('578')
    expect(l.ariaLabel).toContain('578 views')
    expect(l.ariaLabel).not.toContain(',5')
    expect(l.ariaLabel).toContain('entre 444 e 685')
    expect(texto(s.frase)).toContain('578 de views')
    for (const t of [l.valor!, l.sub!, l.ariaLabel, texto(s.frase)]) expect(t).not.toMatch(/\d\.\d/)
  })
  it('m1: 999.600 views não vira "1000 mil"', () => {
    const o = obsDe([canal('a')], seis('a', [999600, 999600, 999600, 999600, 999600]))
    const t = texto(ok(buildRiView(o, P).view.referencias).frase)
    expect(t).toContain('tem 1,0 mi de views')
    expect(t).not.toContain('1000 mil')
  })
  it('I2: a barra traz os dois tamanhos e a legenda é uma por ordem', () => {
    const o = obsDe([
      canal('A', { name: 'A', subs: 1100, snapshots: serie(1100, 1000) }),           // +10%, +100
      canal('B', { name: 'B', subs: 505000, snapshots: serie(505000, 500000) }),     // +1%, +5.000
    ], [])
    const s = ok(buildRiView(o, P).view.inscritos)
    const a = s.linhas.find(l => l.id === 'A')!.barra!, b = s.linhas.find(l => l.id === 'B')!.barra!
    expect(a.pct).toBeGreaterThan(b.pct)
    expect(a.abs).toBeLessThan(b.abs)
    expect(s.ordens.pct.legendaBarra).not.toBe(s.ordens.abs.legendaBarra)
    expect(s.ordens.pct.legendaBarra).toBe('Barra: tamanho do ganho em %.')
    expect(s.ordens.abs.legendaBarra).toBe('Barra: tamanho do ganho em inscritos.')
    // a escolha da ordem inicial não muda os tamanhos
    const s2 = ok(buildRiView(o, { ...P, ordi: 'abs' }).view.inscritos)
    expect(s2.linhas.find(l => l.id === 'A')!.barra).toEqual(a)
  })
  it('M12: a falha em Referências isola: Referências em erro, Inscritos ok, falhas[0].secao referencias', () => {
    const o = obsDe([canal('a', { snapshots: serie(120000, 118000) })], [])
    Object.defineProperty(o, 'videos', { get() { throw new Error('boom') } })
    const { view, falhas } = buildRiView(o, P)
    expect(view.referencias.estado).toBe('erro')
    expect(view.inscritos.estado).toBe('ok')
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toMatchObject({ secao: 'referencias' })
  })
  it('M10: canal com antes = 0 (pct nulo) fica por último em ordens.pct.ids e não é líder em %', () => {
    const o = obsDe([
      canal('Z', { name: 'Z', subs: 50, snapshots: serie(50, 0) }),
      canal('A', { name: 'A', subs: 1100, snapshots: serie(1100, 1000) }),
      canal('B', { name: 'B', subs: 120000, snapshots: serie(120000, 118000) }),
    ], [])
    const s = ok(buildRiView(o, P).view.inscritos)
    expect(s.ordens.pct.ids[s.ordens.pct.ids.length - 1]).toBe('Z')
    expect(texto(s.frase)).not.toContain('Z cresceu')
  })
  it('M11: SYNC.last exatamente 48 h antes de AGORA: sem aviso', () => {
    expect(buildRiView(obsDe([canal('a')], cinco('a', 9000, 8000, 10000), AGORA - 48 * HORA), P).view.aviso).toBeNull()
  })
  it('m3: o modelo não numera (o cliente numera pela ordem)', () => {
    const o = obsDe([canal('a', { snapshots: serie(120000, 118000) })], cinco('a', 9000, 8000, 10000))
    const { view } = buildRiView(o, P)
    expect(ok(view.referencias).linhas.every(l => l.rank === null)).toBe(true)
    expect(ok(view.inscritos).linhas.every(l => l.rank === null)).toBe(true)
  })
})

describe('Falhas e erro', () => {
  it('conta que lança em Inscritos: Inscritos em erro, Referências inteira, falhas.length === 1', () => {
    const ruim = canal('ruim')
    Object.defineProperty(ruim, 'snapshots', { get() { throw new Error('boom') } })
    const { view, falhas } = buildRiView(obsDe([canal('a'), ruim], cinco('a', 9000, 8000, 10000)), P)
    expect(view.inscritos).toEqual({ estado: 'erro', texto: 'Não foi possível carregar os inscritos. Seus dados não mudaram.', ultimaBoa: expect.stringMatching(/^\d\d\/\d\d, \d\d:\d\d$/) })
    expect(view.referencias.estado).toBe('ok')
    expect(falhas).toHaveLength(1)
    expect(falhas[0]).toMatchObject({ secao: 'inscritos' })
    expect((falhas[0]!.erro as Error).message).toBe('boom')
  })
  it('riEmErro: as duas seções em erro, ultimaBoa de obs.SYNC.last, sem ordem nem ticks', () => {
    const e = riEmErro(obsDe([], [], AGORA))
    expect(e.referencias).toEqual({ estado: 'erro', texto: 'Não foi possível carregar as referências. Seus dados não mudaram.', ultimaBoa: expect.stringMatching(/^\d\d\/\d\d, \d\d:\d\d$/) })
    expect(e.inscritos.estado).toBe('erro')
    expect(e.ticks).toEqual([])
    expect(e.atalhos.map(a => a.href)).toEqual(['#referencias', '#inscritos'])
  })
})

describe('Textos e paridade', () => {
  it('nenhuma frase contém "exemplo", "retenção" nem "mediana" fora do ⓘ e da legenda', () => {
    const { view } = buildRiView(cheio(), P)
    const r = ok(view.referencias), i = ok(view.inscritos)
    const fora = JSON.stringify({ aviso: view.aviso, frase: r.frase, f2: i.frase, linhas: r.linhas, l2: i.linhas, rot: [r.ordens.mediana.rotulo, r.ordens.faixa.rotulo, i.ordens.pct.rotulo, i.ordens.abs.rotulo], info: [r.info.titulo, i.info.titulo] })
    expect(fora.replace(/Canal Exemplo/g, 'Canal X')).not.toMatch(/exemplo/i)
    expect(fora).not.toMatch(/retenção/i)
    // frase de Referências diz "mediana" só em "com mediana provisória" (a contagem do mockup); linhas e rótulos não dizem
    expect(JSON.stringify({ l: r.linhas, rot: r.ordens, l2: i.linhas })).not.toMatch(/mediana(?!\")/)
    expect(JSON.stringify([r.legenda, i.legenda, r.info, i.info])).not.toMatch(/exemplo|retenção/i)
  })
  it('o número de cada linha é o de referenciaDoCanal/inscritosDoCanal', () => {
    const cs = [canal('a', { snapshots: serie(9000, 6000) }), canal('b', { snapshots: serie(60000, 50000) }), canal('c')]
    const vs = [...cinco('a', 9000, 8000, 10000), ...cinco('b', 700, 100, 3000), ...[1, 2].map((x, i) => video('c', 20 + i, x))]
    const o = obsDe(cs, vs)
    const { view } = buildRiView(o, P)
    const r = ok(view.referencias), i = ok(view.inscritos)
    for (const c of cs) {
      const n = referenciaDoCanal(c, vs.filter(v => v.ch === c.id), { fmt: 'long', syncDoSite: AGORA })
      const l = r.linhas.find(x => x.id === c.id)!
      if (n.tipo === 'ok') expect(r.ordens.mediana.ids.includes(c.id)).toBe(true)
      else expect(r.ordens.mediana.ids.includes(c.id)).toBe(false)
      if (n.tipo === 'nm') expect(l.marca).toBeNull()
      const m = inscritosDoCanal(c, { agoraMs: AGORA })
      expect(i.ordens.pct.ids.includes(c.id)).toBe(m.tipo === 'ok')
    }
    expect(r.linhas.find(x => x.id === 'a')!.ariaLabel).toContain('9.000')
  })
  it('agrupa por canal uma vez: não chama obs.videos.filter', () => {
    const vs = cinco('a', 9000, 8000, 10000)
    const proxy = new Proxy(vs, { get(t, k, rc) { if (k === 'filter') throw new Error('filter por canal'); return Reflect.get(t, k, rc) } })
    const { falhas } = buildRiView(obsDe([canal('a')], proxy as ObsVideo[]), P)
    expect(falhas).toEqual([])
  })
  it('ROTULOS_NOVOS_RI traz os rótulos novos para o Logan', () => {
    expect(Object.keys(ROTULOS_NOVOS_RI).length).toBeGreaterThan(5)
  })
})
void ([] as RiLinhaRef[]); void ([] as RiLinhaIns[])
