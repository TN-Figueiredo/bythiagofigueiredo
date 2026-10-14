// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import {
  CABECALHO_TRAFEGO, CsvTrafegoError, lerTrafego, normalizarDetalhe, cortarDetalhe, agregarTrafego,
} from '@/lib/youtube/reporting/traffic-source-csv'

/** Sintética, com a forma do relatório real (15 colunas, 7 linhas, origens 4, 5 e 8, detalhe mascarado com X). */
const FORMA_REAL = readFileSync(join(__dirname, 'fixtures/traffic-source-a3-forma-real.csv'), 'utf8')
const CAB = CABECALHO_TRAFEGO.join(',')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const motivo = (fn: () => unknown) => { try { fn() } catch (e) { return e instanceof CsvTrafegoError ? e.motivo : `outro: ${String(e)}` } return 'não lançou' }

/** Linha sob o cabeçalho real; só as colunas que o leitor usa variam. */
function linha(o: { date?: string; video?: string; pais?: string; inscrito?: string; tipo?: string; detalhe?: string; views?: string; minutos?: string } = {}): string {
  return [
    o.date ?? '20260925', 'UCcanalFicticio', o.video ?? 'vid00000001', 'on_demand', o.inscrito ?? 'not_subscribed', o.pais ?? 'BR',
    o.tipo ?? '5', o.detalhe ?? '', o.views ?? '1', '1', o.minutos ?? '0.5', '10', '0.5', '0', '0',
  ].join(',')
}
const csv = (...ls: string[]) => [CAB, ...ls].join('\n') + '\n'

describe('lerTrafego', () => {
  it('o cabeçalho do arquivo de forma real tem as 15 colunas esperadas, na ordem', () => {
    expect(CABECALHO_TRAFEGO).toHaveLength(15)
    expect(FORMA_REAL.split('\n')[0]!.trim().split(',')).toEqual([...CABECALHO_TRAFEGO])
  })
  it('lê o arquivo de forma real: 7 linhas, tipos 4, 5 e 8', () => {
    const l = lerTrafego(FORMA_REAL)
    expect(l).toHaveLength(7)
    expect(new Set(l.map(x => x.sourceType))).toEqual(new Set(['4', '5', '8']))
    expect(l[0]).toMatchObject({ day: '2026-09-24', videoId: 'SINTVIDEO14', sourceType: '4', views: 1 })
    expect(l[0]!.watchTimeMinutes).toBeCloseTo(0.2326, 5)
  })
  it('só cabeçalho: lista vazia, sem erro', () => {
    expect(lerTrafego(CAB + '\n')).toEqual([])
  })
  it('coluna trocada (item 86): cabecalho_inesperado', () => {
    expect(motivo(() => lerTrafego(csv(linha()).replace(',views,', ',visualizacoes,')))).toBe('cabecalho_inesperado')
  })
  it('coluna a mais e coluna a menos: cabecalho_inesperado', () => {
    expect(motivo(() => lerTrafego(csv(linha()).replace('\n', ',extra\n')))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerTrafego(csv(linha()).replace(',red_watch_time_minutes', '')))).toBe('cabecalho_inesperado')
  })
  it('aceita as mesmas colunas em outra ordem', () => {
    const cab = [...CABECALHO_TRAFEGO]; cab.reverse()
    const campos = linha({ views: '7', tipo: '8', detalhe: 'XX' }).split(',').reverse()
    const l = lerTrafego([cab.join(','), campos.join(',')].join('\n'))
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ views: 7, sourceType: '8', detail: 'XX', videoId: 'vid00000001' })
  })
  it('linha com aspas: linha_invalida', () => {
    expect(motivo(() => lerTrafego(csv(linha({ detalhe: '"a,b"' }))))).toBe('linha_invalida')
  })
  it('número de campos diferente: linha_invalida', () => {
    expect(motivo(() => lerTrafego(csv(linha() + ',x')))).toBe('linha_invalida')
  })
  it('data que não existe, views não inteiro, minutos inválidos ou negativos, tipo fora do padrão: linha_invalida', () => {
    expect(motivo(() => lerTrafego(csv(linha({ date: '20260230' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ views: '1.5' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ views: '-1' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ minutos: 'abc' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ minutos: '-0.1' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ minutos: '' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ tipo: 'a-b' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ tipo: '' }))))).toBe('linha_invalida')
    expect(motivo(() => lerTrafego(csv(linha({ tipo: 'x'.repeat(41) }))))).toBe('linha_invalida')
  })
  it('a mensagem de erro não leva o conteúdo da linha', () => {
    try { lerTrafego(csv(linha({ detalhe: '"termo secreto"' }))) } catch (e) { expect(String(e)).not.toContain('secreto'); return }
    throw new Error('não lançou')
  })
})

describe('normalizarDetalhe e cortarDetalhe', () => {
  it('origem externa (9): corta no primeiro ? ou #', () => {
    expect(normalizarDetalhe('9', 'https://ex.com/p?utm_source=x&email=a@b.c#x')).toBe('https://ex.com/p')
    expect(normalizarDetalhe('9', 'https://ex.com/p#frag?x')).toBe('https://ex.com/p')
  })
  it('outras origens: o texto fica inteiro (termo pode ter ?)', () => {
    expect(normalizarDetalhe('5', 'como fazer x?')).toBe('como fazer x?')
    expect(normalizarDetalhe('5', 'a#b')).toBe('a#b')
  })
  it('trim e limpeza de NUL e substituto solitário', () => {
    expect(normalizarDetalhe('5', '  abc  ')).toBe('abc')
    expect(normalizarDetalhe('5', 'a\u0000b')).toBe('ab')
    expect(normalizarDetalhe('5', 'a\ud83db')).toBe('a�b')
  })
  it('cortarDetalhe corta por ponto de código, sem deixar meio emoji', () => {
    const c = cortarDetalhe('a'.repeat(299) + '😀' + 'zz')
    expect(Array.from(c)).toHaveLength(300)
    expect(c.endsWith('😀')).toBe(true)
    expect(cortarDetalhe('curto')).toBe('curto')
  })
})

describe('agregarTrafego', () => {
  const agr = (...ls: string[]) => agregarTrafego(lerTrafego(csv(...ls)))
  it('soma por cima de país e inscrito', () => {
    const r = agr(linha({ pais: 'BR', views: '2', minutos: '1' }), linha({ pais: 'PT', inscrito: 'subscribed', views: '3', minutos: '0.5' }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ day: '2026-09-25', videoId: 'vid00000001', sourceType: '5', views: 5 })
    expect(r[0]!.watchTimeMinutes).toBeCloseTo(1.5, 10)
  })
  it('o arquivo de forma real agrega em 7 linhas distintas, sem zeradas', () => {
    const r = agregarTrafego(lerTrafego(FORMA_REAL))
    expect(r).toHaveLength(7)
    expect(r.descartadasZeradas).toBe(0)
  })
  it('url sem query e sem fragmento (item 88)', () => {
    const r = agr(linha({ tipo: '9', detalhe: 'https://ex.com/p?utm_source=x&email=a@b.c#x' }))
    expect(r[0]!.detail).toBe('https://ex.com/p')
  })
  it('mesma URL com duas query strings vira uma linha (item 226)', () => {
    const r = agr(linha({ tipo: '9', detalhe: 'https://ex.com/p?a=1', views: '2' }), linha({ tipo: '9', detalhe: 'https://ex.com/p?b=2', views: '3' }))
    expect(r).toHaveLength(1)
    expect(r[0]!.views).toBe(5)
  })
  it('iguais nos 300 primeiros e diferentes depois são duas (item 226)', () => {
    const base = 'x'.repeat(300)
    const r = agr(linha({ detalhe: base + 'A'.repeat(50) }), linha({ detalhe: base + 'B'.repeat(50) }))
    expect(r).toHaveLength(2)
    expect(r[0]!.detail).toBe(r[1]!.detail)
    expect(r[0]!.detailHash).not.toBe(r[1]!.detailHash)
    expect(r[0]!.detailHash).toBe(sha(base + 'A'.repeat(50)))
  })
  it('termo com interrogação fica inteiro', () => {
    expect(agr(linha({ tipo: '5', detalhe: 'como fazer x?' }))[0]!.detail).toBe('como fazer x?')
  })
  it('detalhe vazio: uma linha com detail vazio e hash da cadeia vazia', () => {
    const r = agr(linha({ tipo: '5', detalhe: '' }))
    expect(r).toHaveLength(1)
    expect(r[0]!.detail).toBe('')
    expect(r[0]!.detailHash).toBe(sha(''))
  })
  it('NUL e substituto solitário: limpos antes do hash', () => {
    const r = agr(linha({ detalhe: 'a\u0000b' }))
    expect(r[0]!.detail).toBe('ab')
    expect(r[0]!.detailHash).toBe(sha('ab'))
  })
  it('detalhe com emoji atravessando a posição 300 (dados I-4)', () => {
    const r = agr(linha({ detalhe: 'a'.repeat(299) + '😀' + 'zz' }))
    expect(JSON.stringify(r)).not.toMatch(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])/i)
    expect(Array.from(r[0]!.detail).length).toBeLessThanOrEqual(300)
    expect(r[0]!.detailHash).toBe(sha('a'.repeat(299) + '😀' + 'zz'))
  })
  it('linha zerada sai e é contada', () => {
    const r = agr(linha({ views: '0', minutos: '0' }), linha({ video: 'vid00000002', views: '1' }))
    expect(r).toHaveLength(1)
    expect(r[0]!.videoId).toBe('vid00000002')
    expect(r.descartadasZeradas).toBe(1)
  })
  it('views zero com minutos positivos não é zerada', () => {
    const r = agr(linha({ views: '0', minutos: '0.2' }))
    expect(r).toHaveLength(1)
    expect(r.descartadasZeradas).toBe(0)
  })
  it('dias e vídeos diferentes não se misturam', () => {
    expect(agr(linha({ date: '20260924' }), linha({ date: '20260925' }), linha({ video: 'vid00000002' }))).toHaveLength(3)
  })
})
