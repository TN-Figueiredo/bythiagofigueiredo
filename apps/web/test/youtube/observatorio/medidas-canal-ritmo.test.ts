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
  const real = (f: 'long' | 'short') => ritmoReal(quais(f), { agoraMs: AGORA, parcial: false })
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
    expect(b.frase.negrito).toBe('Ritmo ainda sem base:')
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
    expect(html(entrada(seis, { medidas: null }))).toContain('Não carregou')
  })
  it('canal ainda buscando vídeos: "Ritmo parcial" e "pelo que já foi buscado"', () => {
    const e = entrada(seis, { estado: estadoDaPagina(m8('ativo'), { state: 'backfill', last: null, errorSince: null }, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA) })
    const b = blocoDeRitmo(e)
    expect(b.frase.negrito).toBe('Ritmo parcial:')
    expect(b.ponteiro?.pelaBusca).toBe(true)
    expect(html(e)).toContain('pelo que já foi buscado')
  })
})

describe('bloco Ritmo: fronteiras e frases', () => {
  it('as frases são as da tabela do NOTAS (ativo, fechado)', () => {
    const b = blocoDeRitmo(entrada(seis))
    expect(b.frase.negrito).toBe('Publica 0,5 vídeos longos por semana,')
    expect(b.frase.resto).toMatch(/^ e teve um longo em 6 de 13 semanas\. O maior intervalo sem publicar um longo, em 26 semanas, (foi de \d+ dias|é o que começou em \d\d\/\d\d e ainda não acabou: \d+ dias)\.$/)
  })
  it('canal parado diz "Publicou … nas últimas 13 semanas"', () => {
    const e = entrada(seis.map((v, i) => pub('p' + i, [40, 47, 54, 61, 68, 100][i]!)), { estado: estadoDaPagina(m8('parado'), sync, { missingSince: null, doisFormatos: false }, null, HOJE, AGORA) })
    expect(blocoDeRitmo(e).frase.negrito).toMatch(/^Publicou .* por semana nas últimas 13 semanas,$/)
  })
  it('semana lida sem publicação é caixa vazada com 0; com publicação leva o número', () => {
    const b = blocoDeRitmo(entrada(seis))
    expect(b.raias[0]!.casas.some(c => c.estado === 'zero')).toBe(true)
    expect(b.raias[0]!.casas.find(c => c.estado === 'com')).toMatchObject({ n: 1 })
    const h = html(entrada(seis))
    expect(h).toContain('obs-ch-zero')
    expect(h).toContain('aria-label="Publicações por semana, Longos, das 13 últimas semanas"')
  })
  it('canal só de Shorts: a raia de cima é de Shorts, as frases dizem "um Short" e a de longos diz que não há', () => {
    const vs = [3, 10, 17, 24, 31].map((d, i) => pub('s' + i, d, { isShort: true, durationSeconds: 30 }))
    const b = blocoDeRitmo(entrada(vs))
    expect(b.raias[0]!.rotulo).toBe('Shorts')
    expect(b.frase.negrito).toMatch(/Shorts por semana,$/)
    expect(b.frase.resto).toContain('um Short')
    expect(b.raias[1]).toMatchObject({ rotulo: 'Longos', ausente: true })
    expect(html(entrada(vs))).toContain('nenhum vídeo longo nas 13 semanas')
  })
  it('a conta "4 × o intervalo" só aparece acima de 28; o rótulo leva "(longo ou Short)" com os dois formatos', () => {
    const baixo = blocoDeRitmo(entrada(seis, { estado: ativo(28) })).ponteiro!
    expect(baixo.conta).toBeNull()
    const e = entrada([...seis, pub('sh', 2, { isShort: true })])
    const alto = blocoDeRitmo({ ...e, medidas: { ...e.medidas!, m8: m8('ativo', { limite: 38 }) } }).ponteiro!
    expect(alto.conta).toBe('4 × o intervalo típico, 9,5 dias')
    expect(alto.rotulo).toBe('Dias desde o último vídeo (longo ou Short)')
    expect(baixo.rotulo).toBe('Dias desde o último vídeo')
  })
  it('o ponteiro de dias nunca passa do maior buraco quando o buraco é o que está aberto', () => {
    const vs = [60, 70, 80, 90, 95].map((d, i) => pub('b' + i, d))
    const b = blocoDeRitmo(entrada(vs))
    const buraco = b.cartoes.find(c => c.chave === 'buraco')!.valor
    expect(buraco.tipo).toBe('medido')
    expect(b.ponteiro!.dias).toBeLessThanOrEqual(buraco.tipo === 'medido' ? parseInt(buraco.texto, 10) : 0)
    expect(buraco.tipo === 'medido' && buraco.pequeno).toMatch(/^sem longo desde \d\d\/\d\d$/)
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
