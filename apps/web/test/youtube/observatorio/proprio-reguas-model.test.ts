// @vitest-environment node
// A4 Tarefa 12: "Este vídeo no canal" — posição, terço e frase (modelo puro). Nulo nunca vira zero: vídeo sem o dado fica fora da régua e da
// contagem; empate divide a posição e o terço sai da posição média. A frase diz só o que o dado sustenta (sem número, sem causa).
import { afterEach, describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { escalar } from '@/app/cms/(authed)/youtube/competitors/_chrome/regua/regua-model'
import { foraDosGuardadosFrase } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { posicaoNoCanal, buildReguas, type EntradaReguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas-model'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { buildProprioVideoHeader } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-model'
import { buildProprioVideos } from '@/app/cms/(authed)/youtube/competitors/_proprio/videos-model'
import { lerEstado } from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { proprioWorld } from './proprio-fixture'

// o arquivo é todo síncrono: devolve o controle ao vitest entre os testes (o limite de 60 s por executor da CI)
afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const vals = (xs: Array<number | null>) => xs.map((x, k) => ({ id: 'v' + k, x }))

describe('posição no canal', () => {
  it('1 + quantos têm valor MAIOR; "de" conta só quem tem o dado', () => {
    expect(posicaoNoCanal(vals([10, 30, 20, null]), 'v0')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
    expect(posicaoNoCanal(vals([10, 30, 20, null]), 'v1')).toEqual({ pos: 1, de: 3, empates: 0, terco: 'cima' })
  })
  it('vídeo sem o dado: null (fora da régua e da contagem), nunca último', () => {
    expect(posicaoNoCanal(vals([10, 30, 20, null]), 'v3')).toBeNull()
  })
  it('menos de 3 vídeos com o dado: null para todos', () => {
    expect(posicaoNoCanal(vals([10, 30, null]), 'v0')).toBeNull()
  })
  it('empate: a posição MÉDIA decide o terço (posição + empates ÷ 2), para o empate não favorecer ninguém', () => {
    // 9 vídeos; três empatados em 2º (pos 2, empates 2 → média 3 = 9/3 → cima); com seis empatados em 1º: média 1 + 5/2 = 3,5 → meio
    expect(posicaoNoCanal(vals([9, 5, 5, 5, 4, 3, 2, 1, 0]), 'v1')).toEqual({ pos: 2, de: 9, empates: 2, terco: 'cima' })
    expect(posicaoNoCanal(vals([5, 5, 5, 5, 5, 5, 2, 1, 0]), 'v0')).toEqual({ pos: 1, de: 9, empates: 5, terco: 'meio' })
  })
  it('zero medido entra e fica atrás de qualquer positivo', () => {
    expect(posicaoNoCanal(vals([0, 4, 7]), 'v0')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
  })
  it('limites dos terços: média até n/3 é cima, até 2n/3 é meio, o resto é baixo', () => {
    const xs = vals([6, 5, 4, 3, 2, 1])
    expect(['v0', 'v1', 'v2', 'v3', 'v4', 'v5'].map(id => posicaoNoCanal(xs, id)!.terco)).toEqual(['cima', 'cima', 'meio', 'meio', 'baixo', 'baixo'])
  })
})

describe('as réguas do vídeo', () => {
  const videos = Array.from({ length: 6 }, (_, k) => ({ id: 'v' + k, ytId: 'y' + k, views: (k + 1) * 100, likes: k, comments: k === 5 ? null : 1, dur: 600 + k }))
  const porVideo = new Map([['y0', { imp: 18, cliques: 2, diasComImpressao: 6 }], ['y1', { imp: 8, cliques: 0, diasComImpressao: 4 }], ['y2', { imp: 3, cliques: 0, diasComImpressao: 1 }], ['y3', { imp: 1, cliques: 0, diasComImpressao: 1 }]])
  const base = { videos, porVideo, alcanceLido: true, dias: { medidos: 19, semRelatorio: 2 }, periodoTexto: 'de 09/09 a 07/10', hrefs: { vistos: '/v', imp: '/i' } }
  it('seis linhas em três grupos, na ordem do spec 17.3', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas.map(l => [l.grupo, l.numero])).toEqual([['Alcance', 'impressoes'], ['Alcance', 'views'], ['Resposta', 'engajamento'], ['Resposta', 'curtidas'], ['Resposta', 'comentarios'], ['Formato', 'duracao']])
  })
  it('impressões são "de 4", não "de 6": quem não teve impressão fica fora da régua e da posição', () => {
    const l = buildReguas({ ...base, videoId: 'v0' }).linhas[0]!
    expect(l.pos).toEqual({ pos: 1, de: 4, empates: 0, terco: 'cima' }); expect(l.tracos).toHaveLength(4); expect(l.posTexto).toBe('1º de 4 com impressão')
  })
  it('vídeo sem impressão em dia medido: ZERO MEDIDO ("0", sem régua e sem posição) com a frase dos dias medidos; a frase abre com "Sem impressão no período." (B2: antes era valor nulo e "sem impressão de 09/09 a 07/10")', () => {
    const r = buildReguas({ ...base, videoId: 'v5' })
    expect(r.linhas[0]).toMatchObject({ valor: '0', zeroMedido: true, pos: null, tracos: [], semRegua: 'Nenhuma impressão nos 19 dias medidos (2 dias sem relatório). Abaixo dos 4 vídeos com impressão.' })
    expect(r.frase.startsWith('Sem impressão no período.')).toBe(true)
  })
  it('alcance não lido: a linha de impressões diz o motivo e a frase não fala de impressões', () => {
    const r = buildReguas({ ...base, alcanceLido: false, porVideo: new Map(), periodoTexto: null, videoId: 'v0' })
    expect(r.linhas[0]!.semRegua).toBe('impressões não medidas'); expect(r.frase).not.toMatch(/impress/i)
  })
  it('comentário nulo: o vídeo fica fora da régua de comentários e de engajamento ("de 5")', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas.find(l => l.numero === 'comentarios')!.pos!.de).toBe(5)
    expect(buildReguas({ ...base, videoId: 'v5' }).linhas.find(l => l.numero === 'comentarios')).toMatchObject({ valor: null, pos: null, semRegua: 'não medido' })
  })
  it('a duração é neutra e fica fora da frase', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas[5]!.neutro).toBe(true); expect(r.frase).not.toMatch(/dura/i)
  })
  it('só views e impressões são link', () => {
    const r = buildReguas({ ...base, videoId: 'v0' })
    expect(r.linhas.map(l => l.href)).toEqual(['/i', '/v', null, null, null, null])
  })
  it('texto para leitor de tela por régua: posição, terço, valor, faixa do canal e mediana', () => {
    expect(buildReguas({ ...base, videoId: 'v2' }).linhas[1]!.sr).toMatch(/^4º de 6 em views, terço do meio; 300 views; no canal de 100 a 600; mediana 350$/)
  })
  it('menos de 3 vídeos com o dado: sem régua e "poucos vídeos para comparar (2)"', () => {
    const r = buildReguas({ ...base, videos: videos.slice(0, 2), videoId: 'v0' })
    expect(r.linhas[1]).toMatchObject({ pos: null, tracos: [], semRegua: 'poucos vídeos para comparar (2)' })
  })
  it('pouco dado, dito: com menos de 1.000 impressões no canal a nota avisa que a posição em impressões muda de um dia para o outro', () => {
    expect(buildReguas({ ...base, videoId: 'v0' }).pouco).toMatch(/muda de um dia para o outro/)
  })
  it('a frase nunca traz número e cada oração leva a forma do terço (▲ ● ▼)', () => {
    const f = buildReguas({ ...base, videoId: 'v0' }).frase
    expect(f).not.toMatch(/\d/); expect(f).toMatch(/[▲●▼]/)
  })
})

// ------------------------------------------------------------------------------------------------------------------------------
// Além do brief: dado ausente, empate, base e paridade de texto (cada teste diz o mutante que mata)

describe('posição no canal: dado ausente e empate', () => {
  it('não medido não participa nem ocupa lugar: nulo não é zero na ordenação (mutante: null → 0)', () => {
    // com null como 0 o v0 seria 3º de 5; sem ele é 3º de 3 e os nulos não têm posição
    const xs = vals([5, null, null, 7, 9])
    expect(posicaoNoCanal(xs, 'v0')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
    expect(posicaoNoCanal(xs, 'v1')).toBeNull(); expect(posicaoNoCanal(xs, 'v2')).toBeNull()
    expect(posicaoNoCanal(vals([null, null, null, 4, 5, 6]), 'v3')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
  })
  it('valor que não é número (NaN, infinito, negativo) é dado ausente, nunca posição', () => {
    const xs = vals([5, Number.NaN, Number.POSITIVE_INFINITY, -1, 7, 9])
    expect(posicaoNoCanal(xs, 'v1')).toBeNull(); expect(posicaoNoCanal(xs, 'v2')).toBeNull(); expect(posicaoNoCanal(xs, 'v3')).toBeNull()
    expect(posicaoNoCanal(xs, 'v0')).toEqual({ pos: 3, de: 3, empates: 0, terco: 'baixo' })
  })
  it('o terço é sobre os vídeos COM o dado, não sobre todos (mutante: de = total de vídeos)', () => {
    // 6 medidos e 3 sem o dado: o 3º de 6 está no meio (3 > 6/3); contado sobre 9 cairia em "cima" (3 <= 9/3)
    const xs = vals([6, 5, 4, 3, 2, 1, null, null, null])
    expect(posicaoNoCanal(xs, 'v2')).toEqual({ pos: 3, de: 6, empates: 0, terco: 'meio' })
  })
  it('empate não se desfaz pela ordem de entrada: a mesma medida é a mesma posição, em qualquer ordem (mutante: desempate por índice)', () => {
    const a = vals([5, 5, 5, 1]), b = [...a].reverse()
    for (const id of ['v0', 'v1', 'v2']) {
      expect(posicaoNoCanal(a, id)).toEqual({ pos: 1, de: 4, empates: 2, terco: 'meio' })
      expect(posicaoNoCanal(b, id)).toEqual({ pos: 1, de: 4, empates: 2, terco: 'meio' })
    }
    expect(posicaoNoCanal(a, 'v3')).toEqual({ pos: 4, de: 4, empates: 0, terco: 'baixo' })
  })
  it('empate no zero medido: vários zeros dividem o último lugar', () => {
    expect(posicaoNoCanal(vals([0, 0, 0, 3]), 'v0')).toEqual({ pos: 2, de: 4, empates: 2, terco: 'baixo' })
  })
  it('exatamente 3 vídeos: um em cada terço; com 4, o 3º já é "baixo" (3 > 2 × 4 ÷ 3)', () => {
    expect(['v0', 'v1', 'v2'].map(id => posicaoNoCanal(vals([3, 2, 1]), id)!.terco)).toEqual(['cima', 'meio', 'baixo'])
    expect(['v0', 'v1', 'v2', 'v3'].map(id => posicaoNoCanal(vals([4, 3, 2, 1]), id)!.terco)).toEqual(['cima', 'meio', 'baixo', 'baixo'])
  })
  it('a chave é a medida ESCRITA: dois números que se escrevem igual dividem a posição, mesmo com o valor cru diferente', () => {
    const xs = [{ id: 'a', x: 0.1531, chave: '15,3%' }, { id: 'b', x: 0.1534, chave: '15,3%' }, { id: 'c', x: 0.05, chave: '5,0%' }, { id: 'd', x: 0.2, chave: '20,0%' }]
    expect(posicaoNoCanal(xs, 'a')).toEqual({ pos: 2, de: 4, empates: 1, terco: 'meio' })
    expect(posicaoNoCanal(xs, 'b')).toEqual({ pos: 2, de: 4, empates: 1, terco: 'meio' })
    // sem a chave valeria o número cru e o empate sumiria
    expect(posicaoNoCanal(xs.map(({ id, x }) => ({ id, x })), 'a')!.empates).toBe(0)
  })
})

describe('as réguas do vídeo: dado ausente, base e frase', () => {
  const mk = (n: number, mexe?: (v: EntradaReguas['videos'][number], k: number) => void) => Array.from({ length: n }, (_, k) => {
    const v = { id: 'v' + k, ytId: 'y' + k, views: (k + 1) * 100, likes: k + 1, comments: k + 1, dur: 600 + k * 60 }
    mexe?.(v, k)
    return v
  })
  const imp = (...xs: Array<[string, number]>) => new Map(xs.map(([y, n]) => [y, { imp: n, cliques: 0, diasComImpressao: 1 }] as const))
  const H = { vistos: '/v', imp: '/i' }
  const base = (videos: EntradaReguas['videos'], porVideo = new Map(), alcanceLido = true): Omit<EntradaReguas, 'videoId'> => ({ videos, porVideo, alcanceLido, dias: { medidos: 19, semRelatorio: 2 }, periodoTexto: 'de 09/09 a 07/10', hrefs: H })
  const linha = (r: ReturnType<typeof buildReguas>, n: string) => r.linhas.find(l => l.numero === n)!

  it('views nulas: o vídeo fica fora da régua e da contagem ("de 5") e não vira o último (mutante: views null → 0)', () => {
    const videos = mk(6, (v, k) => { if (k === 5) v.views = null })
    const r = buildReguas({ ...base(videos), videoId: 'v0' })
    const l = linha(r, 'views')
    expect(l.pos).toEqual({ pos: 5, de: 5, empates: 0, terco: 'baixo' }); expect(l.tracos).toHaveLength(5)
    expect(l.tracos.map(t => t.id)).not.toContain('v5')
    expect(l.semMedida).toBe('1 sem medida')
    const sem = buildReguas({ ...base(videos), videoId: 'v5' })
    expect(linha(sem, 'views')).toMatchObject({ valor: null, pos: null, posTexto: null, tracos: [], semRegua: 'sem contagem de views', href: null })
    expect(linha(sem, 'engajamento')).toMatchObject({ valor: null, pos: null, semRegua: 'sem contagem de views' })
  })
  it('engajamento só com views, curtidas e comentários presentes e views > 0: zero views não dá 0% nem divisão por zero', () => {
    const videos = mk(5, (v, k) => { if (k === 0) v.views = 0; if (k === 1) v.likes = null })
    const r0 = buildReguas({ ...base(videos), videoId: 'v0' })
    expect(linha(r0, 'engajamento')).toMatchObject({ valor: null, pos: null, semRegua: 'sem views para calcular' })
    expect(linha(r0, 'views')).toMatchObject({ valor: '0', pos: { pos: 5, de: 5 } }) // views 0 é zero medido: participa, em último
    expect(linha(r0, 'engajamento').tracos).toEqual([]) // nenhum "NaN" nem "Infinity" chega à tela
    expect(JSON.stringify(r0)).not.toMatch(/NaN|Infinity|undefined/)
    const r1 = buildReguas({ ...base(videos), videoId: 'v1' })
    expect(linha(r1, 'engajamento')).toMatchObject({ valor: null, pos: null, semRegua: 'não medido' })
    expect(linha(r1, 'curtidas')).toMatchObject({ valor: null, semRegua: 'não medido' })
    // quem tem o dado vê a régua dos 3 que o têm
    expect(linha(buildReguas({ ...base(videos), videoId: 'v2' }), 'engajamento').pos!.de).toBe(3)
  })
  it('zero medido participa e aparece como "0" (nunca null) e em último', () => {
    const videos = mk(5, (v, k) => { if (k === 0) { v.likes = 0; v.comments = 0 } })
    const r = buildReguas({ ...base(videos), videoId: 'v0' })
    expect(linha(r, 'curtidas')).toMatchObject({ valor: '0', pos: { pos: 5, de: 5, empates: 0, terco: 'baixo' }, semRegua: null })
    expect(linha(r, 'comentarios')).toMatchObject({ valor: '0', pos: { pos: 5, de: 5 } })
    expect(linha(r, 'engajamento')).toMatchObject({ valor: '0,0%', pos: { pos: 5, de: 5 } })
    expect(linha(r, 'curtidas').sr).toMatch(/; 0 curtidas;/)
  })
  it('"N sem medida" conta quem ficou fora de cada régua; sem ninguém fora, null', () => {
    const videos = mk(6, (v, k) => { if (k >= 4) v.dur = null })
    const r = buildReguas({ ...base(videos), videoId: 'v0' })
    expect(linha(r, 'duracao')).toMatchObject({ semMedida: '2 sem medida', pos: { de: 4 } })
    expect(linha(r, 'views').semMedida).toBeNull()
  })
  it('canal com 1 vídeo: nenhuma régua, nenhuma posição, frase sem terço e sem número', () => {
    const r = buildReguas({ ...base(mk(1), imp(['y0', 5])), videoId: 'v0' })
    for (const l of r.linhas) expect(l).toMatchObject({ pos: null, posTexto: null, tracos: [], semRegua: 'poucos vídeos para comparar (1)', href: null })
    expect(r.frase).toMatch(/^Poucos vídeos para comparar em impressões, views, engajamento, curtidas e comentários\.$/)
    expect(r.frase).not.toMatch(/[▲●▼\d]/)
  })
  it('canal com 2 vídeos: "(2)" em toda linha; o valor do vídeo continua escrito', () => {
    const r = buildReguas({ ...base(mk(2), imp(['y0', 5], ['y1', 6])), videoId: 'v1' })
    expect(r.linhas.map(l => l.semRegua)).toEqual(Array(6).fill('poucos vídeos para comparar (2)'))
    expect(linha(r, 'views').valor).toBe('200')
  })
  it('exatamente 3 vídeos (o menor canal com régua): um em cada terço', () => {
    const r = (id: string) => buildReguas({ ...base(mk(3)), videoId: id, alcanceLido: false })
    expect(['v2', 'v1', 'v0'].map(id => linha(r(id), 'views').pos!.terco)).toEqual(['cima', 'meio', 'baixo'])
    expect(linha(r('v1'), 'views').tracos).toHaveLength(3)
  })
  it('estado negado ou erro (alcance não lido) NÃO monta posição, nem com relatório na mão (mutante: posição no estado negado)', () => {
    const porVideo = imp(['y0', 5], ['y1', 9], ['y2', 2], ['y3', 7])
    const r = buildReguas({ ...base(mk(6), porVideo, false), periodoTexto: null, videoId: 'v0' })
    expect(linha(r, 'impressoes')).toMatchObject({ valor: null, pos: null, posTexto: null, tracos: [], semRegua: 'impressões não medidas', href: null, semMedida: null, min: null, max: null, medianaPct: null })
    expect(r.base).toBeNull(); expect(r.pouco).toBeNull(); expect(r.frase).not.toMatch(/impress/i)
    expect(r.frase).not.toMatch(/^Sem impressão/)
    // e as outras cinco linhas seguem normais
    expect(linha(r, 'views').pos).not.toBeNull()
    // lido, com os mesmos dados, há posição: é o alcance lido que liga a posição
    expect(linha(buildReguas({ ...base(mk(6), porVideo, true), videoId: 'v0' }), 'impressoes').pos).toMatchObject({ pos: 3, de: 4 })
  })
  it('lido mas sem nenhum vídeo com impressão: zero medido na linha (sem "abaixo dos 0"), sem base e sem "pouco" (nada a comparar) (B2)', () => {
    const r = buildReguas({ ...base(mk(6), new Map(), true), videoId: 'v0' })
    expect(linha(r, 'impressoes')).toMatchObject({ valor: '0', zeroMedido: true, pos: null, semRegua: 'Nenhuma impressão nos 19 dias medidos (2 dias sem relatório).' })
    expect(r.base).toBeNull(); expect(r.pouco).toBeNull()
    expect(r.frase.startsWith('Sem impressão no período.')).toBe(true)
  })
  it('lido, sem período escrito: a frase dos dias medidos não depende do período (B2); sem nenhum dia medido, "ainda não há dia de alcance medido" e nunca zero', () => {
    const r = buildReguas({ ...base(mk(6), new Map(), true), periodoTexto: null, videoId: 'v0' })
    expect(linha(r, 'impressoes').semRegua).toBe('Nenhuma impressão nos 19 dias medidos (2 dias sem relatório).')
    const nada = buildReguas({ ...base(mk(6), new Map(), true), dias: { medidos: 0, semRelatorio: 3 }, videoId: 'v0' })
    expect(linha(nada, 'impressoes')).toMatchObject({ valor: null, zeroMedido: false, semRegua: 'ainda não há dia de alcance medido' })
  })
  it('a base e a janela estão escritas ao lado da frase: "Entre N vídeos com impressões medidas de 09/09 a 07/10."', () => {
    const r = buildReguas({ ...base(mk(6), imp(['y0', 5], ['y1', 9], ['y2', 2], ['y3', 7])), videoId: 'v0' })
    expect(r.base).toBe('Entre 4 vídeos com impressões medidas de 09/09 a 07/10.')
    expect(buildReguas({ ...base(mk(6), imp(['y0', 5])), videoId: 'v0' }).base).toBe('Só 1 vídeo tem impressões medidas de 09/09 a 07/10.')
  })
  it('impressões de vídeos que não estão na lista do canal não entram na posição nem na contagem', () => {
    const r = buildReguas({ ...base(mk(5), imp(['y0', 5], ['y1', 9], ['y2', 2], ['fora', 5000])), videoId: 'v0' })
    expect(linha(r, 'impressoes').pos).toEqual({ pos: 2, de: 3, empates: 0, terco: 'meio' })
  })
  it('a frase só diz a posição e a base, nunca a causa nem número (varredura de palavras)', () => {
    const casos: EntradaReguas[] = [
      { ...base(mk(6), imp(['y0', 5], ['y1', 9], ['y2', 2], ['y3', 7])), videoId: 'v0' },
      { ...base(mk(6), imp(['y0', 5], ['y1', 9], ['y2', 2], ['y3', 7])), videoId: 'v5' },
      { ...base(mk(6), new Map()), videoId: 'v2' },
      { ...base(mk(6, (v, k) => { if (k === 0) v.comments = null }), imp(['y1', 5000], ['y2', 9], ['y3', 2])), videoId: 'v0' },
      { ...base(mk(2)), videoId: 'v0', alcanceLido: false },
    ]
    for (const c of casos) {
      const f = buildReguas(c).frase
      // o único número permitido é a base de "▼ O que menos teve impressões entre os N vídeos com impressão" (V1: diz entre quantos)
      expect(f.replace(/entre os \d+ vídeos com impressão/, 'entre os N vídeos com impressão')).not.toMatch(/porque|por causa|devido|culpa|motivo|razão|\d/i)
      expect(f.length).toBeGreaterThan(0)
    }
  })
  it('"mas com poucas" só quando é o 1º em impressões E o canal tem menos de 1.000 no período (e a nota de pouco volume junto)', () => {
    const pouco = buildReguas({ ...base(mk(6), imp(['y0', 50], ['y1', 9], ['y2', 2])), videoId: 'v0' })
    expect(pouco.frase).toMatch(/Primeiro do canal em impressões, mas com poucas\./); expect(pouco.pouco).not.toBeNull()
    const muito = buildReguas({ ...base(mk(6), imp(['y0', 5000], ['y1', 900], ['y2', 200])), videoId: 'v0' })
    expect(muito.frase).toMatch(/Primeiro do canal em impressões\./); expect(muito.frase).not.toMatch(/poucas/); expect(muito.pouco).toBeNull()
    const limite = buildReguas({ ...base(mk(6), imp(['y0', 500], ['y1', 400], ['y2', 100])), videoId: 'v0' }) // 1.000 exatos: não é pouco
    expect(limite.pouco).toBeNull(); expect(limite.frase).not.toMatch(/poucas/)
    const naoPrimeiro = buildReguas({ ...base(mk(6), imp(['y0', 5], ['y1', 9], ['y2', 2])), videoId: 'v0' })
    expect(naoPrimeiro.frase).not.toMatch(/poucas/); expect(naoPrimeiro.pouco).not.toBeNull() // o aviso da nota vale para o canal todo
  })
  it('a nota de pouco volume diz o volume do relatório e a janela; o singular de 1 impressão', () => {
    expect(buildReguas({ ...base(mk(6), imp(['y0', 1], ['y1', 1], ['y2', 1])), videoId: 'v0' }).pouco).toMatch(/^3 impressões no relatório de 09\/09 a 07\/10\./)
    expect(buildReguas({ ...base(mk(6), imp(['y0', 1])), videoId: 'v0' }).pouco).toMatch(/^1 impressão no relatório /)
  })
  it('T13.0 H16: o total é o do RELATÓRIO, e a nota diz "no relatório"; o que está fora dos guardados é dito pela função única (nunca "no canal")', () => {
    // 4 vídeos do canal somam 3 impressões; um ytId do relatório que não está em `videos` soma outras 4: o total do relatório é 7
    const r = buildReguas({ ...base(mk(6), imp(['y0', 1], ['y1', 1], ['y2', 1], ['fora', 4])), videoId: 'v0' })
    expect(r.pouco).toBe(`7 impressões no relatório de 09/09 a 07/10. ${foraDosGuardadosFrase(1, n => String(n))} Com tão poucas, a posição em impressões muda de um dia para o outro.`)
    expect(r.pouco).not.toMatch(/no canal/)
    // a base continua contando só os vídeos guardados (3), e diz isso ao lado
    expect(r.base).toBe('Entre 3 vídeos com impressões medidas de 09/09 a 07/10.')
    // dois fora: o plural da mesma função
    const dois = buildReguas({ ...base(mk(6), imp(['y0', 1], ['y1', 1], ['y2', 1], ['fora', 4], ['fora2', 1])), videoId: 'v0' })
    expect(dois.pouco).toContain(foraDosGuardadosFrase(2, n => String(n)))
    expect(dois.pouco).toMatch(/^8 impressões no relatório /)
    // nada fora: a nota não ganha a frase de "fora dos guardados"
    expect(buildReguas({ ...base(mk(6), imp(['y0', 1], ['y1', 1], ['y2', 1])), videoId: 'v0' }).pouco).not.toMatch(/guardados/)
  })
  it('T13.0 H16: o volume do relatório decide o "pouco": 1.000 só porque o vídeo de fora tem muita impressão deixa de ser pouco', () => {
    expect(buildReguas({ ...base(mk(6), imp(['y0', 1], ['y1', 1], ['y2', 1], ['fora', 5000])), videoId: 'v0' }).pouco).toBeNull()
  })
  it('T13.0 H19: ninguém é "Último do canal" (tom duro); o menor é "O menor do canal", e a base vai junto de toda posição em impressões', () => {
    const r = buildReguas({ ...base(mk(6), imp(['y0', 2], ['y1', 9], ['y2', 5], ['y3', 7])), videoId: 'v0' })
    expect(linha(r, 'impressoes').pos).toMatchObject({ pos: 4, de: 4 })
    // V1: a base em impressões é só o vídeo COM impressão, então a frase diz entre quantos (antes: "O menor do canal em impressões")
    expect(r.frase).toMatch(/▼ O que menos teve impressões entre os 4 vídeos com impressão\./)
    expect(r.frase).not.toMatch(/O menor do canal em impressões/)
    expect(r.frase).not.toMatch(/[Úú]ltimo do canal/)
    // a posição em impressões só é afirmada com a base ao lado
    expect(r.base).toBe('Entre 4 vídeos com impressões medidas de 09/09 a 07/10.')
    for (const videoId of ['v0', 'v1', 'v2', 'v3']) {
      const x = buildReguas({ ...base(mk(6), imp(['y0', 2], ['y1', 9], ['y2', 5], ['y3', 7])), videoId })
      expect(x.frase).not.toMatch(/[Úú]ltimo do canal/)
      if (/impressões/.test(x.frase)) expect(x.base, videoId).not.toBeNull()
    }
  })
  it('T13.0 H18: a mediana é a MEDIANA, não a média (série que não é progressão aritmética: 1, 2, 100)', () => {
    const r = buildReguas({ ...base(mk(3, (v, k) => { v.views = [1, 2, 100][k]! })), alcanceLido: false, videoId: 'v1' })
    const views = linha(r, 'views')
    expect(views.medianaPct).toBe(escalar([1, 2, 100]).pct(2))
    expect(views.medianaPct).not.toBe(escalar([1, 2, 100]).pct(103 / 3))   // a média (34,3) cairia noutro ponto do eixo
    expect(views.sr).toMatch(/mediana 2$/)
  })
  it('T13.0 H18: views a partir de 1.000 saem com o espaço que não quebra linha antes de "mil" (numNb), em valor, mínimo e máximo', () => {
    const r = buildReguas({ ...base(mk(3, (v, k) => { v.views = [1500, 2200, 12000][k]! })), alcanceLido: false, videoId: 'v0' })
    const views = linha(r, 'views')
    expect(views.valor).toBe('1,5\u00A0mil')
    expect(views.min).toBe('1,5\u00A0mil'); expect(views.max).toBe('12\u00A0mil')
    expect(views.sr).toContain('mediana 2,2\u00A0mil')
    // as impressões, ao contrário, saem como o cartão da lista as escreve (F.num, sem NBSP)
    const comImp = buildReguas({ ...base(mk(3), imp(['y0', 1500], ['y1', 2200], ['y2', 12000])), videoId: 'v0' })
    expect(linha(comImp, 'impressoes').valor).toBe('1,5 mil')
  })
  it('cada oração da frase leva a forma do SEU terço: ▲ em cima, ● no meio, ▼ embaixo', () => {
    const videos = mk(9, (v, k) => { v.likes = k * 10 }) // curtidas: v4 é o 5º de 9 (meio); engajamento e comentários empatam (meio)
    const meio = buildReguas({ ...base(videos), alcanceLido: false, videoId: 'v4' }).frase
    expect(meio).toBe('● No meio em views, engajamento, curtidas e comentários.')
    const topo = buildReguas({ ...base(videos), alcanceLido: false, videoId: 'v8' }).frase
    expect(topo).toBe('▲ Primeiro do canal em views, engajamento, curtidas e comentários.')
    const fundo = buildReguas({ ...base(videos), alcanceLido: false, videoId: 'v0' }).frase
    expect(fundo).toBe('▼ O menor do canal em views, engajamento, curtidas e comentários.')
  })
  it('a régua tem um traço por vídeo com o dado, do menor ao maior, este marcado; a mediana cai no eixo', () => {
    const r = buildReguas({ ...base(mk(5)), alcanceLido: false, videoId: 'v3' })
    const l = linha(r, 'views')
    expect(l.tracos.map(t => t.id)).toEqual(['v0', 'v1', 'v2', 'v3', 'v4'])
    expect(l.tracos.filter(t => t.este).map(t => t.id)).toEqual(['v3'])
    expect(l.tracos[0]!.pct).toBe(0); expect(l.tracos[4]!.pct).toBe(100)
    expect(l.tracos.map(t => t.pct)).toEqual([...l.tracos.map(t => t.pct)].sort((a, b) => a - b))
    expect(l.min).toBe('100'); expect(l.max).toBe('500'); expect(l.medianaPct).toBe(50)
    expect(l.comprimida).toBe(false)
  })
  it('escala comprimida quando 60% ou mais cai no primeiro quarto (regra do regua-model)', () => {
    const videos = mk(10, (v, k) => { v.views = k === 9 ? 10_000 : 100 + k })
    const l = linha(buildReguas({ ...base(videos), alcanceLido: false, videoId: 'v9' }), 'views')
    expect(l.comprimida).toBe(true)
  })
  it('empate escrito na posição: "empate com N" e o mesmo no leitor de tela', () => {
    const videos = mk(5, (v, k) => { if (k < 3) v.views = 300 })
    const l = linha(buildReguas({ ...base(videos), alcanceLido: false, videoId: 'v1' }), 'views')
    expect(l.posTexto).toBe('3º de 5 · empate com 2')
  })
  it('vídeo que não está na lista do canal: lança (nunca finge uma posição)', () => {
    expect(() => buildReguas({ ...base(mk(4)), videoId: 'nao-existe' })).toThrow(/nao-existe/)
  })
  it('a duração fica na régua mas sem a palavra do terço no leitor de tela, e nunca é link', () => {
    const l = linha(buildReguas({ ...base(mk(5)), alcanceLido: false, videoId: 'v0' }), 'duracao')
    expect(l.neutro).toBe(true); expect(l.sr).not.toMatch(/terço/); expect(l.href).toBeNull()
    expect(l.pos).not.toBeNull()
  })
  it('sem posição não há link: vídeo sem impressão não leva a lista por impressões', () => {
    const r = buildReguas({ ...base(mk(6), imp(['y0', 5], ['y1', 9], ['y2', 2])), videoId: 'v5' })
    expect(linha(r, 'impressoes').href).toBeNull(); expect(linha(r, 'views').href).toBe('/v')
  })
})

describe('o mesmo número tem o mesmo texto da faixa do vídeo (T11) e do cartão (T7)', () => {
  const w = proprioWorld()
  const cartoes = buildCanalVideos(w.obs, w.canalId).videos
  const alc = lerEstado(w.dados.alcance)
  const porVideo = alc.estado === 'ok' ? alc.porVideo : new Map()
  const entrada = (videoId: string): EntradaReguas => ({
    videoId, videos: cartoes.map(c => ({ id: c.id, ytId: c.ytId, views: c.views, likes: c.likes, comments: c.comments, dur: c.dur })),
    porVideo, alcanceLido: alc.estado === 'ok', dias: alc.estado === 'ok' ? { medidos: alc.resumo.diasLidos, semRelatorio: alc.resumo.diasNaoMedidos } : { medidos: 0, semRelatorio: 0 }, periodoTexto: alc.estado === 'ok' ? 'de 01/01 a 02/01' : null, hrefs: { vistos: '/v', imp: '/i' }, fmt: w.obs.fmt,
  })
  it('views, curtidas, comentários e duração: o texto do cartão; engajamento: o da faixa', () => {
    expect(cartoes.length).toBeGreaterThan(5)
    for (const c of cartoes) {
      const r = buildReguas(entrada(c.id))
      const f = Object.fromEntries(buildProprioVideoHeader(w.obs, c.id)!.faixa.map(x => [x.key, x.value]))
      const l = (n: string) => r.linhas.find(x => x.numero === n)!
      expect(l('views').valor).toBe(c.viewsText); expect(l('curtidas').valor).toBe(c.likesText)
      expect(l('comentarios').valor).toBe(c.commentsText); expect(l('duracao').valor).toBe(c.durText)
      expect(l('engajamento').valor).toBe(f.engajamento)
    }
  })
  it('impressões: o texto do cartão da lista de vídeos', () => {
    const lista = buildProprioVideos(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm })!
    let visto = 0
    for (const c of lista.videos) {
      if (c.impText == null) continue
      visto++
      expect(buildReguas(entrada(c.id)).linhas[0]!.valor).toBe(c.impText)
    }
    expect(visto).toBeGreaterThan(0)
  })
  it('com e sem `fmt` do motor o texto é o mesmo (os formatadores da fábrica são os do motor)', () => {
    const sem = { ...entrada(cartoes[0]!.id), fmt: undefined }
    expect(buildReguas(sem).linhas.map(l => [l.valor, l.min, l.max])).toEqual(buildReguas(entrada(cartoes[0]!.id)).linhas.map(l => [l.valor, l.min, l.max]))
  })
})

describe('T13.0 H20: o modelo é puro de verdade (regra 6: nenhum leitor, nenhuma prova de edição, nenhum dado privado cru)', () => {
  const DIR = join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio')
  const modelos = readdirSync(DIR).filter(n => /-model\.ts$/.test(n))
  const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  /** Quem importa o leitor, a prova de edição ou o módulo de dados COMO VALOR (import de tipo é apagado na compilação). */
  const proibidos = (fonte: string): string[] => {
    const out: string[] = []
    for (const m of semComentarios(fonte).matchAll(/import\s+(type\s+)?([^'"]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
      const [, tipo, , de] = m
      if (tipo) continue
      if (/proprio\/ler$/.test(de!)) out.push(`importa o leitor (${de})`)
      if (/proprio\/edicao$/.test(de!)) out.push(`importa a prova de edição (${de})`)
      if (/(^|\/)dados$/.test(de!)) out.push(`importa o módulo de dados como valor (${de})`)
    }
    return out
  }
  it('a varredura enxerga os modelos (não passa por varrer a pasta errada)', () => {
    expect(modelos).toEqual(expect.arrayContaining(['reguas-model.ts', 'video-model.ts', 'impressoes-model.ts', 'como-esta-model.ts', 'header-model.ts']))
  })
  it('nenhum modelo de _proprio importa o leitor, a prova de edição ou o módulo de dados como valor', () => {
    for (const n of modelos) expect(proibidos(readFileSync(join(DIR, n), 'utf8')), n).toEqual([])
  })
  it('controles negativos: a varredura pega o que deve pegar', () => {
    expect(proibidos("import { lerAlcance } from '@/lib/youtube/observatorio/proprio/ler'")).toHaveLength(1)
    expect(proibidos("import { provarEdicao } from '@/lib/youtube/observatorio/proprio/edicao'")).toHaveLength(1)
    expect(proibidos("import { lerDadosDoCanal } from './dados'")).toHaveLength(1)
    expect(proibidos("import type { DadosDoCanal } from './dados'")).toEqual([])           // tipo: apagado na compilação
    expect(proibidos("// import { lerAlcance } from '@/lib/youtube/observatorio/proprio/ler'")).toEqual([])
  })
})
