// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { blocoDeRitmo, type EntradaDoRitmo } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/ritmo-model'
import { RitmoBloco } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/ritmo-bloco'
import { estadoDaPagina, type EstadoDaPagina } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/estado-model'
import { formatoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/cabecalho-model'
import { ritmo as ritmoReal } from '@/lib/youtube/observatorio/medidas/ritmo'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import { medido } from '@/lib/youtube/observatorio/medidas/tipos'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { AGORA, HOJE, J, m8, medidasFalsas, videoLido } from './medidas-canal-fixture'

const DIA = 86_400_000
const sync = { state: 'ok' as const, last: AGORA - 600_000, errorSince: null }
const ativo = (limite = 28, dias = 3): EstadoDaPagina => estadoDaPagina(m8('ativo', { limite, dias }), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
const ultimaBoa = Date.parse('2026-10-04T12:00:00Z')
const erro = (): EstadoDaPagina => estadoDaPagina(m8('ativo'), { state: 'erro', last: ultimaBoa, errorSince: ultimaBoa + DIA }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA)
const pub = (id: string, diasAtras: number, o: Partial<VideoLido> = {}) => videoLido(id, { publishedAt: new Date(AGORA - diasAtras * DIA).toISOString(), ...o })

function entrada(vs: VideoLido[], o: Partial<EntradaDoRitmo> = {}): EntradaDoRitmo {
  const fmt = formatoDoCanal(vs)
  const quais = (f: 'long' | 'short') => vs.filter(v => v.isShort === (f === 'short')).map(v => baseDaIdade(v)!)
  const m = medidasFalsas({})
  const real = (f: 'long' | 'short') => ritmoReal(quais(f), { agoraMs: AGORA, criadoEmMs: null, coberturaDesdeMs: null })
  const medidas = { ...m, porFormato: { long: { ...m.porFormato.long, m6: real('long') }, short: { ...m.porFormato.short, m6: real('short') } } }
  return { medidas, videos: vs, formato: fmt, estado: ativo(), ultimaLeituraMs: AGORA - 600_000, agoraMs: AGORA, hojeSP: HOJE, ...o }
}
const seis = [3, 10, 17, 24, 31, 80].map((d, i) => pub('l' + i, d))
const html = (e: EntradaDoRitmo) => renderToStaticMarkup(createElement(RitmoBloco, { bloco: blocoDeRitmo(e) }))

describe('bloco Ritmo: dado ausente', () => {
  it('M6 não medido: as casas continuam e a frase diz o motivo', () => {
    const e = entrada([pub('a', 3), pub('b', 40)])
    const b = blocoDeRitmo(e)
    expect(b.frase.tom).toBe('sem_base')
    expect(b.frase.negrito).toBe('Ritmo ainda não medido:')
    expect(b.raias[0]!.casas).toHaveLength(13)
    expect(b.cartoes.every(c => c.valor.tipo === 'nao_medido')).toBe(true)
  })
  it('canal em erro: a frase e os cartões dizem "sem leitura desde dd/mm" e a grade mostra "—" depois da data', () => {
    const e = entrada(seis.map((v, i) => pub('e' + i, [8, 15, 22, 29, 36, 85][i]!)), { estado: erro(), ultimaLeituraMs: ultimaBoa })
    const b = blocoDeRitmo(e)
    expect(b.frase.tom).toBe('sem_leitura')
    expect(`${b.frase.negrito}${b.frase.resto}`).toContain('sem leitura desde 04/10')
    expect(b.cartoes.every(c => c.valor.tipo === 'nao_medido' && c.valor.motivo.includes('sem leitura desde 04/10'))).toBe(true)
    const casas = b.raias[0]!.casas
    expect(casas[12]!.estado).toBe('nao_lida')
    expect(casas[0]!.estado).not.toBe('nao_lida')
    expect(b.eixoFim).toBe('semana de 04/10')
  })
  it('Yannis I2: coleta pausada há 60 dias: nenhuma semana depois da última leitura é zero; a frase é "sem leitura"', () => {
    const ultima = AGORA - 60 * DIA
    const pausado = estadoDaPagina(m8('ativo'), { state: 'ok', last: ultima, errorSince: null }, { missingSince: null, doisFormatos: false }, { collectionPausedAt: new Date(ultima).toISOString(), missingSince: null }, HOJE, AGORA)
    expect(pausado.tipo).toBe('pausado')
    const b = blocoDeRitmo(entrada(seis.map((v, i) => pub('p' + i, [70, 77, 84, 91, 98, 120][i]!)), { estado: pausado, ultimaLeituraMs: ultima }))
    const casas = b.raias[0]!.casas
    expect(casas.some(c => c.estado === 'nao_lida')).toBe(true)
    expect(casas[12]!.estado).toBe('nao_lida')
    expect(b.frase.tom).toBe('sem_leitura')
    expect(b.cartoes.every(c => c.valor.tipo === 'nao_medido')).toBe(true)
  })
  it('semana não lida é "—" nas duas raias, com ou sem vídeo, e nunca zero', () => {
    const b = blocoDeRitmo(entrada(seis, { estado: erro(), ultimaLeituraMs: ultimaBoa }))
    const idx = (r: number) => b.raias[r]!.casas.map((c, i) => (c.estado === 'nao_lida' ? i : -1)).filter(i => i >= 0)
    expect(idx(0).length).toBeGreaterThan(0)
    expect(idx(0)).toEqual(idx(1))
    expect(b.semanasLidas).toBe(13 - idx(0).length)
  })
  it('medidas não carregaram: o bloco todo em não carregou, sem casas e sem zero', () => {
    const b = blocoDeRitmo(entrada(seis, { medidas: null }))
    expect(b.frase.tom).toBe('nao_carregou')
    expect(b.raias).toEqual([])
    expect(b.cartoes.every(c => c.valor.tipo === 'nao_carregou')).toBe(true)
    expect(html(entrada(seis, { medidas: null }))).toContain('falhou')
  })
  it('canal ainda buscando vídeos: "Ritmo parcial" e "pelo que já foi buscado"', () => {
    const e = entrada(seis, { estado: estadoDaPagina(m8('ativo'), { state: 'backfill', last: null, errorSince: null }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA) })
    const b = blocoDeRitmo(e)
    expect(b.frase.negrito).toBe('Ritmo parcial:')
    expect(b.ponteiro?.pelaBusca).toBe(true)
    expect(html(e)).toContain('pelo que já foi buscado')
    // Phil I-2: o canal em primeira busca pode ter anos; a frase não diz que "o canal tem menos de quatro semanas"
    const linhas = b.cartoes.map(c => JSON.stringify(c.valor)).join(' ')
    expect(linhas).not.toContain('menos de quatro semanas')
    expect(linhas).toContain('ainda não cobriu todos os vídeos')
  })
})

describe('bloco Ritmo: semanas antes da base (Yannis I-2)', () => {
  const antes = (b: ReturnType<typeof blocoDeRitmo>) => b.raias.map(r => r.casas.map((c, i) => (c.estado === 'nao_lida' ? i : -1)).filter(i => i >= 0))
  it('canal de 81 dias: a semana mais antiga não existia ("—", nunca zero); "X de 12" e o período em dias', () => {
    const vs = [3, 10, 17, 24, 31, 38, 45, 52].map((d, i) => pub('n' + i, d))
    const e = entrada(vs)
    const m = e.medidas!
    const criadoEmMs = AGORA - 81 * DIA
    const e2: EntradaDoRitmo = { ...e, medidas: { ...m, baseDoRitmo: { criadoEmMs, coberturaDesdeMs: null }, porFormato: { ...m.porFormato, long: { ...m.porFormato.long, m6: ritmoReal(vs.map(v => baseDaIdade(v)!), { agoraMs: AGORA, criadoEmMs, coberturaDesdeMs: null }) } } } }
    const b = blocoDeRitmo(e2)
    expect(b.raias[0]!.casas[0]).toMatchObject({ estado: 'nao_lida', por: 'antes da criação do canal' })
    expect(b.raias[0]!.casas[1]!.estado).not.toBe('nao_lida')
    expect(antes(b)[0]).toEqual([0])
    expect(b.semanasLidas).toBe(12)
    expect(b.periodo).toBe('81 dias, desde a criação')
    expect(b.cartoes.find(c => c.chave === 'semanas')!.valor).toMatchObject({ tipo: 'medido', texto: expect.stringMatching(/ de 12$/) })
    expect(html(e2)).toContain('há 81 dias, desde a criação')
  })
  it('lista cortada: as semanas antes dos vídeos guardados são "—" com a causa certa', () => {
    const vs = [3, 10, 17, 24, 31, 38].map((d, i) => pub('c' + i, d))
    const e = entrada(vs)
    const b = blocoDeRitmo({ ...e, medidas: { ...e.medidas!, baseDoRitmo: { criadoEmMs: null, coberturaDesdeMs: AGORA - 40 * DIA } } })
    const c0 = b.raias[0]!.casas[0]!
    expect(c0).toMatchObject({ estado: 'nao_lida', por: 'antes dos vídeos guardados' })
    expect(antes(b)[0]!.length).toBeGreaterThanOrEqual(7)
    expect(b.periodo).toBe('40 dias guardados')
  })
  it('sem corte (base cheia): 13 semanas, nenhuma casa fora da base', () => {
    const b = blocoDeRitmo(entrada(seis))
    expect(antes(b)[0]).toEqual([])
    expect(b.periodo).toBe('13 semanas')
  })
})

describe('bloco Ritmo: limite sempre inteiro na tela', () => {
  it('limite fracionário (48,000277…) sai "48", na régua e no aria-label, nunca o float cru', () => {
    const e = entrada(seis, { estado: ativo(48.000277777777775, 14) })
    const e2 = { ...e, medidas: { ...e.medidas!, m8: m8('ativo', { limite: 48.000277777777775, dias: 14 }) } }
    const p = blocoDeRitmo(e2).ponteiro!
    expect(p.limite).toBe(48)
    const h = html(e2)
    expect(h).toContain('parado: 48 d')
    expect(h).not.toMatch(/48\.0002/)
    expect(h).toContain('típico: 12 d')
  })
})

describe('bloco Ritmo: fronteiras e frases', () => {
  it('as frases são as da tabela do NOTAS (ativo, fechado)', () => {
    const b = blocoDeRitmo(entrada(seis))
    expect(b.frase.negrito).toBe('Publica um longo a cada 7 dias.')
    expect(b.frase.resto).toBe(' O último saiu há 3 dias.')
    expect(`${b.frase.negrito}${b.frase.resto}`).not.toMatch(/por semana/)
  })
  it('canal parado diz "Parado: nenhum longo há N dias." e o que publicava antes', () => {
    const e = entrada(seis.map((v, i) => pub('p' + i, [40, 47, 54, 61, 68, 100][i]!)), { estado: estadoDaPagina(m8('parado'), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA) })
    const f = blocoDeRitmo(e).frase
    expect(f.negrito).toBe('Parado: nenhum longo há 40 dias.')
    expect(f.resto).toBe(' Antes, publicava um longo a cada 7 dias.')
  })
  it('semana lida sem publicação é caixa vazada com 0; com publicação leva o número', () => {
    const b = blocoDeRitmo(entrada(seis))
    expect(b.raias[0]!.casas.some(c => c.estado === 'zero')).toBe(true)
    expect(b.raias[0]!.casas.find(c => c.estado === 'com')).toMatchObject({ n: 1 })
    const h = html(entrada(seis))
    expect(h).toContain('obs-ch-zero')
    expect(h).toContain('aria-label="Publicações por semana, Longos, 13 semanas"')
  })
  it('canal só de Shorts: a raia de cima é de Shorts, as frases dizem "um Short" e a de longos diz que não há', () => {
    const vs = [3, 10, 17, 24, 31].map((d, i) => pub('s' + i, d, { isShort: true, durationSeconds: 30 }))
    const b = blocoDeRitmo(entrada(vs))
    expect(b.raias[0]!.rotulo).toBe('Shorts')
    expect(b.frase.negrito).toBe('Publica um Short a cada 7 dias.')
    expect(b.raias[1]).toMatchObject({ rotulo: 'Longos', ausente: true })
    expect(html(entrada(vs))).toContain('nenhum vídeo longo em 13 semanas')
  })
  it('raia de Shorts toda zero vira uma linha só: "nenhum Short em 13 semanas"', () => {
    const h = html(entrada(seis))
    expect(h).toContain('nenhum Short em 13 semanas')
    expect(h).not.toContain('aria-label="Publicações por semana, Shorts')
  })
  it('a conta "4 × o intervalo" só aparece acima de 28; o rótulo leva "(longo ou Short)" com os dois formatos', () => {
    const baixo = blocoDeRitmo(entrada(seis, { estado: ativo(28) })).ponteiro!
    expect(baixo.conta).toBeNull()
    const e = entrada([...seis, pub('sh', 2, { isShort: true })])
    const alto = blocoDeRitmo({ ...e, medidas: { ...e.medidas!, m8: m8('ativo', { limite: 38 }) } }).ponteiro!
    expect(alto.conta).toBe('4 × o intervalo típico, 9,5 dias')
    expect(alto.rotulo).toBe('desde o último vídeo (longo ou Short)')
    expect(baixo.rotulo).toBe('desde o último longo')
  })
  it('o ponteiro de dias nunca passa do maior buraco quando o buraco é o que está aberto', () => {
    const vs = [60, 70, 80, 90, 95].map((d, i) => pub('b' + i, d))
    const b = blocoDeRitmo(entrada(vs))
    const buraco = b.cartoes.find(c => c.chave === 'buraco')!.valor
    expect(buraco.tipo).toBe('medido')
    expect(b.ponteiro!.dias).toBeLessThanOrEqual(buraco.tipo === 'medido' ? parseInt(buraco.texto, 10) : 0)
    expect(buraco.tipo === 'medido' && buraco.pequeno).toMatch(/^sem longo desde \d\d\/\d\d$/)
  })
  it('b (Gio): o buraco aberto e o ponteiro dizem os mesmos dias, com fração (14,6 d: 14 nos dois)', () => {
    const vs = [14.6, 20, 25, 30, 35].map((d, i) => pub('f' + i, d))
    const b = blocoDeRitmo(entrada(vs))
    const buraco = b.cartoes.find(c => c.chave === 'buraco')!.valor
    expect(b.ponteiro!.dias).toBe(14)
    expect(buraco.tipo === 'medido' && buraco.texto).toBe('14 dias')
  })
  it('coerência: casas com publicação = semanas com publicação da M6, com um vídeo de domingo 23:30 de São Paulo (segunda em UTC)', () => {
    // 2026-10-12 02:30 UTC é domingo 11/10 23:30 em São Paulo; a divisão em semanas é a da M6 (relativa ao agora), então concorda.
    const vs = [...seis, videoLido('dom', { publishedAt: '2026-10-12T02:30:00Z' })]
    const e = entrada(vs)
    const b = blocoDeRitmo(e)
    const m6 = e.medidas!.porFormato.long.m6
    expect(m6.estado).toBe('medido')
    const comPub = b.raias[0]!.casas.filter(c => c.estado === 'com').length
    expect(comPub).toBe(m6.estado === 'medido' ? m6.valor.semanasComPublicacao : -1)
  })
  it('o limite de parado vem de M8, nunca de conta própria', () => {
    const e = entrada(seis)
    const b = blocoDeRitmo({ ...e, medidas: { ...e.medidas!, m8: { ...e.medidas!.m8, parado: medido({ dias: 3, limite: 31, ultimaEm: AGORA }, 1, J) } } })
    expect(b.ponteiro!.limite).toBe(31)
  })
})

describe('a (Gio): Ritmo a 390 px', () => {
  it('a raia traz o aviso de rolagem e o CSS empilhado desce a régua sem z-index', async () => {
    const h = html(entrada(seis))
    expect(h).toContain('data-rola')
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-medidas.css', 'utf8')
    expect(css).toMatch(/\.pc-par \.pc-rp\{margin-top:24px\}/)
  })
})

describe('bloco Ritmo: semana fora do período (Gio D7)', () => {
  it('a casa antes da criação leva `fora` e a faixa tracejada, não o "não medido"', () => {
    const html = renderToStaticMarkup(createElement(RitmoBloco, { bloco: { frase: { negrito: '', resto: '' }, periodo: '20 dias', eixoFim: 'hoje', ponteiro: null, cartoes: [], raias: [{ rotulo: 'Longos', ausente: false, casas: [{ estado: 'nao_lida', por: 'antes da criação do canal', fora: true }, { estado: 'nao_lida', por: 'ainda não buscada' }] }] } as unknown as Parameters<typeof RitmoBloco>[0]['bloco'] }))
    expect(html).toContain('pc-cs fora')
    expect(html).toContain('fora do período: antes da criação do canal')
    expect(html.match(/pc-cs nm/g)?.length).toBe(1)
  })
})

describe('bloco Ritmo: frase e legenda do fora do período (D7b)', () => {
  const vs = [3, 10, 17, 24, 31, 38].map((d, i) => pub('f' + i, d))
  const com = (b: { criadoEmMs: number | null; coberturaDesdeMs: number | null }) => { const e = entrada(vs); return { ...e, medidas: { ...e.medidas!, baseDoRitmo: b } } }
  it('sem semana fora: nenhuma frase nem legenda', () => {
    const e = entrada(seis)
    expect(blocoDeRitmo(e).foraDoPeriodo).toBeNull()
    expect(html(e)).not.toContain('data-fora-do-periodo')
    expect(html(e)).not.toContain('data-legenda-fora')
  })
  it('1 semana fora, canal novo: singular e "o canal ainda não existia"', () => {
    const e = com({ criadoEmMs: AGORA - 81 * DIA, coberturaDesdeMs: null })
    expect(blocoDeRitmo(e).foraDoPeriodo).toBe('A semana mais antiga está fora do período: o canal ainda não existia. Não é semana sem vídeo.')
    const h = html(e)
    expect(h).toContain('data-fora-do-periodo')
    expect(h).toContain('data-legenda-fora')
  })
  it('N semanas fora, lista cortada: plural e "os vídeos guardados não chegam até lá"', () => {
    const f = blocoDeRitmo(com({ criadoEmMs: null, coberturaDesdeMs: AGORA - 40 * DIA })).foraDoPeriodo!
    expect(f).toMatch(/^\d+ semanas mais antigas estão fora do período: os vídeos guardados não chegam até lá\. Não é semana sem vídeo\.$/)
  })
})
