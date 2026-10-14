// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  agregarAlcanceCombinado, CABECALHO_ALCANCE_COMBINADO, CsvAlcanceCombinadoError, lerAlcanceCombinado,
} from '@/lib/youtube/reporting/reach-combined-csv'

// Duas fixtures sob o cabeçalho REAL de 9 colunas (F4), as duas SINTÉTICAS: a de casos montados e a de FORMA REAL (38 linhas, 32 vídeos,
// os mesmos códigos de aparelho, sistema e origem do relatório de 30/09 e `traffic_source_detail` mascarado com X). Nenhum número, id
// de vídeo ou id de canal vem de produção.
const SINTETICO = readFileSync(join(__dirname, 'fixtures/reach-combined-a1-sintetico.csv'), 'utf8')
const FORMA_REAL = readFileSync(join(__dirname, 'fixtures/reach-combined-a1-forma-real.csv'), 'utf8')
const CANAL = 'UC' + 'b'.repeat(22)
const CAB = CABECALHO_ALCANCE_COMBINADO.join(',')
const motivo = (fn: () => unknown) => { try { fn() } catch (e) { return e instanceof CsvAlcanceCombinadoError ? e.motivo : `outro: ${String(e)}` } return 'não lançou' }
const linha = (o: Partial<Record<'data' | 'canal' | 'video' | 'aparelho' | 'so' | 'origem' | 'detalhe' | 'imp' | 'ctr', string>> = {}) =>
  [o.data ?? '20260930', o.canal ?? CANAL, o.video ?? 'abcdefghijk', o.aparelho ?? '102', o.so ?? '2', o.origem ?? '5', o.detalhe ?? 'XXXX', o.imp ?? '3', o.ctr ?? '0'].join(',')

describe('lerAlcanceCombinado', () => {
  it('lê o arquivo de forma real (38 linhas do relatório de 30/09, dados sintéticos, detalhe da origem mascarado)', () => {
    expect(FORMA_REAL.split('\n')[0]!.trim().split(',')).toEqual([...CABECALHO_ALCANCE_COMBINADO])
    const linhas = lerAlcanceCombinado(FORMA_REAL)
    expect(linhas).toHaveLength(38)
    expect(new Set(linhas.map(l => l.day))).toEqual(new Set(['2026-09-30']))
    expect(new Set(linhas.map(l => l.channelId)).size).toBe(1)
    expect(new Set(linhas.map(l => l.videoId)).size).toBe(32)
    expect(new Set(linhas.map(l => l.trafficSourceType))).toEqual(new Set(['4']))
    expect(new Set(linhas.map(l => l.deviceType))).toEqual(new Set(['101', '104']))
    expect(linhas.reduce((t, l) => t + l.impressions, 0)).toBe(189)
    // Toda linha tem impressão e taxa informada (zero ou não): nenhuma taxa ausente vira zero por conta do leitor.
    expect(linhas.every(l => l.impressions > 0 && l.ctr !== null && l.ctr >= 0 && l.ctr <= 1)).toBe(true)
    expect(linhas.some(l => l.ctr === 0)).toBe(true)
    expect(linhas.some(l => l.ctr !== null && l.ctr > 0)).toBe(true)
  })
  it('lê o arquivo sintético sob o cabeçalho real', () => {
    expect(SINTETICO.split('\n')[0]!.trim().split(',')).toEqual([...CABECALHO_ALCANCE_COMBINADO])
    const linhas = lerAlcanceCombinado(SINTETICO)
    expect(linhas).toHaveLength(12)
    expect(linhas[0]).toEqual({
      day: '2026-09-30', channelId: 'UCfake00000000000000000A', videoId: 'VIDEOFAKE01',
      deviceType: '102', operatingSystem: '2', trafficSourceType: '5', impressions: 4, ctr: 0.25,
    })
    expect(new Set(linhas.map(l => l.trafficSourceType))).toEqual(new Set(['4', '5', '8']))
    expect(linhas.every(l => l.ctr !== null && l.ctr >= 0 && l.ctr <= 1)).toBe(true)
  })
  it('só cabeçalho → lista vazia, sem erro', () => {
    expect(lerAlcanceCombinado(`${CAB}\n`)).toEqual([])
  })
  it('coluna trocada → cabecalho_inesperado (item 86)', () => {
    expect(motivo(() => lerAlcanceCombinado(SINTETICO.replace('video_thumbnail_impressions_ctr', 'ctr')))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceCombinado(`${CAB},extra\n`))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceCombinado(''))).toBe('cabecalho_inesperado')
  })
  it('as colunas são lidas pelo nome: outra ordem dá o mesmo resultado', () => {
    const troca = (l: string) => { const c = l.split(','); return [c[8], c[7], ...c.slice(0, 7)].join(',') }
    const [cab, ...resto] = SINTETICO.trim().split('\n')
    expect(lerAlcanceCombinado([troca(cab!), ...resto.map(troca)].join('\n'))).toEqual(lerAlcanceCombinado(SINTETICO))
  })
  it('taxa 33.3 é linha inválida; 0 e 1 exatos valem; vazio é nulo', () => {
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ ctr: '33.3' })}\n`))).toBe('linha_invalida')
    expect(lerAlcanceCombinado(`${CAB}\n${linha({ ctr: '1' })}\n`)[0]!.ctr).toBe(1)
    expect(lerAlcanceCombinado(`${CAB}\n${linha({ ctr: '' })}\n`)[0]!.ctr).toBeNull()
  })
  it('data inexistente, aspas, campos a mais e impressões não inteiras são linha inválida', () => {
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ data: '20260229' })}\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ detalhe: '"a b"' })}\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha()},1\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ imp: '-1' })}\n`))).toBe('linha_invalida')
  })
  it('código de aparelho, de sistema ou de origem com espaço é linha inválida (dados m-6)', () => {
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ aparelho: '10 2' })}\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ so: 'an droid' })}\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ origem: 'a b' })}\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ aparelho: '' })}\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ aparelho: 'A'.repeat(41) })}\n`))).toBe('linha_invalida')
  })
  it('impressões além do inteiro seguro são linha inválida (M1)', () => {
    expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ imp: '99999999999999999999' })}\n`))).toBe('linha_invalida')
    expect(lerAlcanceCombinado(`${CAB}\n${linha({ imp: '9007199254740991' })}\n`)[0]!.impressions).toBe(9007199254740991)
  })
  it('números só em decimal simples: hexadecimal, binário, científica, sinal e ponto solto são linha inválida (M2)', () => {
    for (const ctr of ['0x1', '0b1', '1e-1', '1E-1', '-0', '+1', '.5', '5.', 'NaN', 'Infinity']) {
      expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ ctr })}\n`))).toBe('linha_invalida')
    }
    for (const imp of ['0x1', '0b1', '1e3', '-0', '+1']) {
      expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ imp })}\n`))).toBe('linha_invalida')
    }
    expect(lerAlcanceCombinado(`${CAB}\n${linha({ ctr: '0.25' })}\n`)[0]!.ctr).toBe(0.25)
    expect(lerAlcanceCombinado(`${CAB}\n${linha({ ctr: '0' })}\n`)[0]!.ctr).toBe(0)
  })
  it('id de vídeo e de canal fora do formato do YouTube: linha inválida (M3)', () => {
    for (const video of ['abc', 'abcdefghijkl', 'abcdefghij ', 'abcdefghij\u0000', 'abcdefghij|', 'abcdefghijé']) {
      expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ video })}\n`))).toBe('linha_invalida')
    }
    for (const canal of ['UC1', 'XX' + 'b'.repeat(22), 'UC' + 'b'.repeat(23), 'UC' + 'b'.repeat(21), 'UC' + 'b'.repeat(21) + '|']) {
      expect(motivo(() => lerAlcanceCombinado(`${CAB}\n${linha({ canal })}\n`))).toBe('linha_invalida')
    }
    expect(lerAlcanceCombinado(`${CAB}\n${linha({ video: 'a_b-C1d2E3f', canal: 'UC' + 'a_b-'.repeat(5) + 'zz' })}\n`)).toHaveLength(1)
  })
  it('a mensagem de erro não leva o conteúdo da linha (M4)', () => {
    for (const csv of [`${CAB}\n${linha({ detalhe: '"termo secreto"' })}\n`, `${CAB}\n${linha({ detalhe: 'termo secreto', ctr: '33.3' })}\n`, `${CAB}\n${linha({ detalhe: 'termo secreto' })},x\n`]) {
      let msg = ''
      let stack = ''
      try { lerAlcanceCombinado(csv) } catch (e) { msg = String(e); stack = (e as Error).stack ?? '' }
      expect(msg).toContain('linha_invalida')
      expect(msg + stack).not.toContain('secreto')
    }
  })
})

describe('agregarAlcanceCombinado', () => {
  const agr = (csv: string) => agregarAlcanceCombinado(lerAlcanceCombinado(csv))
  it('linha de 0 impressões sem taxa não anula os cliques da chave (I2, desvio do plano a favor do dado)', () => {
    const r = agr(`${CAB}\n${linha({ imp: '0', ctr: '' })}\n${linha({ imp: '10', ctr: '0.5' })}\n`)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ impressions: 10 })
    expect(r.linhas[0]!.clicksEst).toBeCloseTo(5, 10)
  })
  it('linha com impressões e sem taxa continua anulando os cliques da chave (I2, outro lado)', () => {
    const r = agr(`${CAB}\n${linha({ imp: '0', ctr: '' })}\n${linha({ imp: '10', ctr: '' })}\n${linha({ imp: '4', ctr: '0.5' })}\n`)
    expect(r.linhas[0]).toMatchObject({ impressions: 14, clicksEst: null })
  })
  it('chave de 0 impressões e sem taxa sai e é contada mesmo sem taxa', () => {
    const r = agr(`${CAB}\n${linha({ imp: '0', ctr: '' })}\n`)
    expect(r.linhas).toEqual([])
    expect(r.descartadasZeradas).toBe(1)
  })
  it('o retorno é um objeto { linhas, descartadasZeradas } que sobrevive a map e a JSON', () => {
    const r = agr(`${CAB}\n${linha({ imp: '0', ctr: '0' })}\n${linha({ video: 'xyzxyzxyzxy' })}\n`)
    expect(Array.isArray(r)).toBe(false)
    expect(Object.keys(r).sort()).toEqual(['descartadasZeradas', 'linhas'])
    const copia = JSON.parse(JSON.stringify(r)) as typeof r
    expect(copia.descartadasZeradas).toBe(1)
    expect(copia.linhas.map(x => x.videoId)).toEqual(['xyzxyzxyzxy'])
  })
  it('duas linhas com a mesma chave e detalhe diferente viram uma (item 226)', () => {
    const csv = `${CAB}\n${linha({ detalhe: 'AAAA', imp: '3', ctr: '0' })}\n${linha({ detalhe: 'BBBBBB', imp: '5', ctr: '0.2' })}\n`
    const r = agregarAlcanceCombinado(lerAlcanceCombinado(csv)).linhas
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ day: '2026-09-30', videoId: 'abcdefghijk', trafficSourceType: '5', deviceType: '102', operatingSystem: '2', impressions: 8 })
    expect(r[0]!.clicksEst).toBeCloseTo(1, 10)
    expect(r[0]!.clicksEst! / r[0]!.impressions).toBeCloseTo(0.125, 10)
  })
  it('uma linha sem taxa na chave deixa cliques nulo', () => {
    const csv = `${CAB}\n${linha({ imp: '3', ctr: '' })}\n${linha({ imp: '5', ctr: '0.2' })}\n`
    const r = agregarAlcanceCombinado(lerAlcanceCombinado(csv)).linhas
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ impressions: 8, clicksEst: null })
  })
  it('chaves diferentes em aparelho ou sistema ficam separadas', () => {
    const csv = `${CAB}\n${linha({ aparelho: '101' })}\n${linha({ aparelho: '102' })}\n${linha({ so: '4' })}\n`
    expect(agregarAlcanceCombinado(lerAlcanceCombinado(csv)).linhas).toHaveLength(3)
  })
  it('0 impressões sai e é contada', () => {
    const csv = `${CAB}\n${linha({ imp: '0', ctr: '0' })}\n${linha({ video: 'xyzxyzxyzxy', imp: '2', ctr: '0.5' })}\n`
    const r = agregarAlcanceCombinado(lerAlcanceCombinado(csv))
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]!.videoId).toBe('xyzxyzxyzxy')
    expect(r.descartadasZeradas).toBe(1)
  })
  it('o arquivo sintético agrega sem perder impressões', () => {
    const linhas = lerAlcanceCombinado(SINTETICO)
    const r = agregarAlcanceCombinado(linhas)
    expect(r.linhas.reduce((s, x) => s + x.impressions, 0)).toBe(linhas.reduce((s, x) => s + x.impressions, 0))
    expect(r.descartadasZeradas).toBe(0)
  })
  it('o detalhe não aparece em nenhum campo do retorno', () => {
    const csv = `${CAB}\n${linha({ detalhe: 'termo-secreto-pesquisado' })}\n${linha({ origem: '4', detalhe: 'UCsegredo123' })}\n`
    const linhas = lerAlcanceCombinado(csv)
    const json = JSON.stringify([linhas, agregarAlcanceCombinado(linhas)])
    expect(json).not.toContain('termo-secreto-pesquisado')
    expect(json).not.toContain('UCsegredo123')
    // e na fixture: nenhum trecho de XXXX sai
    const todas = lerAlcanceCombinado(SINTETICO)
    expect(JSON.stringify([todas, agregarAlcanceCombinado(todas)])).not.toContain('XXXX')
  })
})
