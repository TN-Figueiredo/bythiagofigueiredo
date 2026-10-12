// @vitest-environment node
// A4 13.4: as duas linhas da régua que nascem do diário ("Views por dia" e "% assistido"). Sem o diário a régua continua com as seis
// linhas da Tarefa 12; com ele, oito, e o vídeo com poucas views fica com o número escrito e SEM posição (nunca um "último" inventado).
import { afterEach, describe, it, expect } from 'vitest'
import { buildReguas, type DiarioReguas, type EntradaReguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas-model'

afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

const videos = Array.from({ length: 6 }, (_, k) => ({ id: 'v' + k, ytId: 'y' + k, views: (k + 1) * 100, likes: k, comments: 1, dur: 600 + k }))
const base: Omit<EntradaReguas, 'videoId'> = { videos, porVideo: new Map([['y0', { imp: 18, cliques: 2, diasComImpressao: 6 }]]), alcanceLido: true, dias: { medidos: 19, semRelatorio: 2 }, periodoTexto: 'de 09/09 a 07/10', hrefs: { vistos: '/v', imp: '/i' } }
const diario = (o: Partial<DiarioReguas> = {}): DiarioReguas => ({
  vpd: new Map(videos.map((v, k) => [v.id, k + 1.5] as const)),
  pct: new Map(videos.map((v, k) => [v.id, 40 + 5 * k] as const)),
  naoPosicionaVpd: null, naoPosicionaPct: null, semVpd: 'sem 7 dias de medida', semPct: 'sem views nos 28 dias', ...o,
})
const linha = (r: ReturnType<typeof buildReguas>, n: string) => r.linhas.find(l => l.numero === n)!

describe('13.4 réguas do diário', () => {
  it('sem o diário: as seis linhas de sempre, nenhuma de views por dia nem de % assistido', () => {
    const r = buildReguas({ ...base, videoId: 'v2' })
    expect(r.linhas.map(l => l.numero)).toEqual(['impressoes', 'views', 'engajamento', 'curtidas', 'comentarios', 'duracao'])
  })

  it('com o diário: oito linhas, "Views por dia" no Alcance e "% assistido" na Resposta, cada uma com a sua segunda linha', () => {
    const r = buildReguas({ ...base, videoId: 'v2', diario: diario() })
    expect(r.linhas.map(l => [l.numero, l.grupo])).toEqual([
      ['impressoes', 'Alcance'], ['views', 'Alcance'], ['vpd', 'Alcance'], ['engajamento', 'Resposta'], ['assistido', 'Resposta'], ['curtidas', 'Resposta'], ['comentarios', 'Resposta'], ['duracao', 'Formato'],
    ])
    expect(linha(r, 'vpd')).toMatchObject({ nome: 'Views por dia', sub: 'média dos últimos 28 dias', valor: '3,5', posTexto: '4º de 6' })
    expect(linha(r, 'assistido')).toMatchObject({ nome: '% assistido', sub: 'média pelas views, 28 dias', valor: '50%', posTexto: '4º de 6' })
    expect(linha(r, 'views').sub).toBeNull()
  })

  it('o texto: views por dia com uma casa abaixo de 10, inteiro de 10 em diante, "0" para zero medido; % assistido inteiro, acima de 100 sem recorte', () => {
    const vpd = new Map([['v0', 0], ['v1', 9.94], ['v2', 10.4], ['v3', 1234.5], ['v4', 3], ['v5', 4]])
    const pct = new Map([['v0', 139.38], ['v1', 5], ['v2', 100], ['v3', 40], ['v4', 40], ['v5', 41]])
    const r = buildReguas({ ...base, videoId: 'v1', diario: diario({ vpd, pct }) })
    expect(linha(r, 'vpd').valor).toBe('9,9')
    expect(linha(buildReguas({ ...base, videoId: 'v0', diario: diario({ vpd, pct }) }), 'vpd').valor).toBe('0')
    expect(linha(buildReguas({ ...base, videoId: 'v2', diario: diario({ vpd, pct }) }), 'vpd').valor).toBe('10')
    expect(linha(buildReguas({ ...base, videoId: 'v3', diario: diario({ vpd, pct }) }), 'vpd').valor).toBe('1.235')
    expect(linha(buildReguas({ ...base, videoId: 'v0', diario: diario({ vpd, pct }) }), 'assistido').valor).toBe('139%')
  })

  it('este vídeo sem o número: a frase do motivo, sem régua, sem posição e sem zero; os outros continuam contando', () => {
    const vpd = new Map<string, number | null>(videos.map((v, k) => [v.id, k === 2 ? null : k + 1] as const))
    const r = buildReguas({ ...base, videoId: 'v2', diario: diario({ vpd }) })
    expect(linha(r, 'vpd')).toMatchObject({ valor: null, pos: null, posTexto: null, semRegua: 'sem 7 dias de medida', tracos: [], semMedida: '1 sem medida' })
  })

  it('poucas views neste vídeo: o número fica escrito, a posição não, e a frase da trava ocupa o lugar da régua (nunca "último")', () => {
    const trava = 'Com 3 views em 28 dias não dá para posicionar este vídeo: 4 dos 5 outros também ficam abaixo de 1 view por dia.'
    const r = buildReguas({ ...base, videoId: 'v0', diario: diario({ naoPosicionaVpd: trava }) })
    expect(linha(r, 'vpd')).toMatchObject({ valor: '1,5', pos: null, posTexto: null, semRegua: trava, tracos: [] })
    expect(linha(r, 'assistido').pos).not.toBeNull()
    expect(linha(r, 'assistido').sr).toContain('em % assistido')
  })

  it('menos de 3 vídeos com o dado: "poucos vídeos para comparar (N)", como nas outras linhas', () => {
    const pct = new Map<string, number | null>(videos.map((v, k) => [v.id, k < 2 ? 50 + k : null] as const))
    const r = buildReguas({ ...base, videoId: 'v0', diario: diario({ pct }) })
    expect(linha(r, 'assistido')).toMatchObject({ valor: '50%', pos: null, semRegua: 'poucos vídeos para comparar (2)' })
  })

  it('a frase-resumo fala das duas linhas quando elas têm posição, e não fala delas quando faltam (a linha diz o motivo)', () => {
    const r = buildReguas({ ...base, videoId: 'v5', diario: diario() })
    expect(r.frase).toMatch(/Primeiro do canal em .*views por dia/)
    const sem = buildReguas({ ...base, videoId: 'v5', diario: diario({ vpd: new Map(), pct: new Map() }) })
    expect(sem.frase).not.toMatch(/views por dia|% assistido/)
  })

  it('o motivo das impressões nulas é o que a tela passou (negado não diz "não medidas")', () => {
    const r = buildReguas({ ...base, videoId: 'v2', alcanceLido: false, motivoImpressoes: 'só quem edita o site vê as impressões' })
    expect(linha(r, 'impressoes').semRegua).toBe('só quem edita o site vê as impressões')
    expect(linha(buildReguas({ ...base, videoId: 'v2', alcanceLido: false }), 'impressoes').semRegua).toBe('impressões não medidas')
  })

  it('o texto para leitor de tela de cada linha nova fala o valor com a unidade', () => {
    const r = buildReguas({ ...base, videoId: 'v2', diario: diario() })
    expect(linha(r, 'vpd').sr).toMatch(/4º de 6 em views por dia.*; 3,5 views por dia;/)
    expect(linha(r, 'assistido').sr).toMatch(/4º de 6 em % assistido.*; 50% do vídeo assistido;/)
  })
})
