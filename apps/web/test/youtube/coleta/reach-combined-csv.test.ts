// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  agregarAlcanceCombinado, CABECALHO_ALCANCE_COMBINADO, CsvAlcanceCombinadoError, lerAlcanceCombinado,
} from '@/lib/youtube/reporting/reach-combined-csv'

// Fixture SINTÉTICA sob o cabeçalho REAL de 9 colunas (F4). A exportada de produção (relatório de 30/09, 38 linhas)
// espera a pergunta 27 ao dono; o teste `lê o arquivo real` fica como todo até lá.
const SINTETICO = readFileSync(join(__dirname, 'fixtures/reach-combined-a1-sintetico.csv'), 'utf8')
const CAB = CABECALHO_ALCANCE_COMBINADO.join(',')
const motivo = (fn: () => unknown) => { try { fn() } catch (e) { return e instanceof CsvAlcanceCombinadoError ? e.motivo : `outro: ${String(e)}` } return 'não lançou' }
const linha = (o: Partial<Record<'data' | 'canal' | 'video' | 'aparelho' | 'so' | 'origem' | 'detalhe' | 'imp' | 'ctr', string>> = {}) =>
  [o.data ?? '20260930', o.canal ?? 'UC1', o.video ?? 'abc', o.aparelho ?? '102', o.so ?? '2', o.origem ?? '5', o.detalhe ?? 'XXXX', o.imp ?? '3', o.ctr ?? '0'].join(',')

describe('lerAlcanceCombinado', () => {
  it.todo('lê o arquivo real (espera a fixture c04 exportada de produção: pergunta 27 ao dono)')
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
})

describe('agregarAlcanceCombinado', () => {
  it('duas linhas com a mesma chave e detalhe diferente viram uma (item 226)', () => {
    const csv = `${CAB}\n${linha({ detalhe: 'AAAA', imp: '3', ctr: '0' })}\n${linha({ detalhe: 'BBBBBB', imp: '5', ctr: '0.2' })}\n`
    const r = agregarAlcanceCombinado(lerAlcanceCombinado(csv))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ day: '2026-09-30', videoId: 'abc', trafficSourceType: '5', deviceType: '102', operatingSystem: '2', impressions: 8 })
    expect(r[0]!.clicksEst).toBeCloseTo(1, 10)
    expect(r[0]!.clicksEst! / r[0]!.impressions).toBeCloseTo(0.125, 10)
  })
  it('uma linha sem taxa na chave deixa cliques nulo', () => {
    const csv = `${CAB}\n${linha({ imp: '3', ctr: '' })}\n${linha({ imp: '5', ctr: '0.2' })}\n`
    const r = agregarAlcanceCombinado(lerAlcanceCombinado(csv))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ impressions: 8, clicksEst: null })
  })
  it('chaves diferentes em aparelho ou sistema ficam separadas', () => {
    const csv = `${CAB}\n${linha({ aparelho: '101' })}\n${linha({ aparelho: '102' })}\n${linha({ so: '4' })}\n`
    expect(agregarAlcanceCombinado(lerAlcanceCombinado(csv))).toHaveLength(3)
  })
  it('0 impressões sai e é contada', () => {
    const csv = `${CAB}\n${linha({ imp: '0', ctr: '0' })}\n${linha({ video: 'xyz', imp: '2', ctr: '0.5' })}\n`
    const r = agregarAlcanceCombinado(lerAlcanceCombinado(csv))
    expect(r).toHaveLength(1)
    expect(r[0]!.videoId).toBe('xyz')
    expect(r.descartadasZeradas).toBe(1)
  })
  it('o arquivo sintético agrega sem perder impressões', () => {
    const linhas = lerAlcanceCombinado(SINTETICO)
    const r = agregarAlcanceCombinado(linhas)
    expect(r.reduce((s, x) => s + x.impressions, 0)).toBe(linhas.reduce((s, x) => s + x.impressions, 0))
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
