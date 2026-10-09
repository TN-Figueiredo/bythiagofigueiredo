// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { agregarAlcance, CABECALHO_ALCANCE_BASICO, CsvAlcanceError, lerAlcanceBasico } from '@/lib/youtube/reporting/reach-csv'

const fixture = (nome: string) => readFileSync(join(__dirname, '../../fixtures/yt-reporting', nome), 'utf8')
const REAL = fixture('channel_reach_basic_a1.csv')
const MAIOR = fixture('channel_reach_basic_a1-2026-09-30.csv')
const VAZIO = fixture('channel_reach_basic_a1-vazio.csv')
const motivo = (fn: () => unknown) => { try { fn() } catch (e) { return e instanceof CsvAlcanceError ? e.motivo : `outro: ${String(e)}` } return 'não lançou' }

describe('lerAlcanceBasico (CSV real exportado de produção)', () => {
  it('o cabeçalho do arquivo real é o esperado', () => {
    expect(REAL.split('\n')[0]!.trim().split(',')).toEqual([...CABECALHO_ALCANCE_BASICO])
  })
  it('lê as 11 linhas de 25/09 com o dia em AAAA-MM-DD, impressões inteiras e CTR em 0–1', () => {
    const linhas = lerAlcanceBasico(REAL)
    expect(linhas).toHaveLength(11)
    expect(new Set(linhas.map(l => l.day))).toEqual(new Set(['2026-09-25']))
    expect(new Set(linhas.map(l => l.channelId))).toEqual(new Set(['UCRHtzTwaEpcjspAS2hbqmrA']))
    expect(linhas.find(l => l.videoId === 'S1iMQVIOFL4')).toEqual({ day: '2026-09-25', channelId: 'UCRHtzTwaEpcjspAS2hbqmrA', videoId: 'S1iMQVIOFL4', impressions: 3, ctr: 0.3333333333333333 })
    expect(linhas.find(l => l.videoId === 'BKczyNOMdoc')).toMatchObject({ impressions: 2, ctr: 0 })
    expect(linhas.every(l => l.ctr === null || (l.ctr >= 0 && l.ctr <= 1))).toBe(true)
  })
  it('lê as 32 linhas de 30/09 e a soma das impressões é a do arquivo', () => {
    const linhas = lerAlcanceBasico(MAIOR)
    expect(linhas).toHaveLength(32)
    expect(linhas.reduce((s, l) => s + l.impressions, 0)).toBe(71)
  })
  it('arquivo só com o cabeçalho → lista vazia, sem erro', () => {
    expect(lerAlcanceBasico(VAZIO)).toEqual([])
  })
  it('aceita fim de linha CRLF e linha em branco no fim', () => {
    expect(lerAlcanceBasico(REAL.replace(/\n/g, '\r\n') + '\r\n')).toHaveLength(11)
  })
  it('as colunas são lidas pelo nome: outra ordem dá o mesmo resultado', () => {
    const [cab, ...resto] = REAL.trim().split('\n')
    const troca = (l: string) => { const c = l.split(','); return [c[2], c[0], c[4], c[3], c[1]].join(',') }
    expect(lerAlcanceBasico([troca(cab!), ...resto.map(troca)].join('\n'))).toEqual(lerAlcanceBasico(REAL))
  })
  it('cabeçalho com coluna a mais, a menos ou com outro nome → cabecalho_inesperado', () => {
    const linhas = REAL.trim().split('\n')
    expect(motivo(() => lerAlcanceBasico([linhas[0] + ',traffic_source_type', ...linhas.slice(1).map(l => l + ',1')].join('\n')))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceBasico('date,channel_id,video_id,video_thumbnail_impressions\n'))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceBasico(REAL.replace('video_thumbnail_impressions_ctr', 'ctr')))).toBe('cabecalho_inesperado')
    expect(motivo(() => lerAlcanceBasico(''))).toBe('cabecalho_inesperado')
  })
  it('linha com número de campos errado, data ilegível ou impressões não inteiras → linha_invalida (nada é lido pela metade)', () => {
    const cab = CABECALHO_ALCANCE_BASICO.join(',')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n2026-09-25,UC1,abc,3,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,três,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,-1,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,,3,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3,muito\n`))).toBe('linha_invalida')
  })
  it('CTR fora de 0–1 (percentual, por exemplo) → linha_invalida; 0 e 1 exatos são válidos', () => {
    const cab = CABECALHO_ALCANCE_BASICO.join(',')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3,33.3\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3,1.0000001\n`))).toBe('linha_invalida')
    expect(lerAlcanceBasico(`${cab}\n20260925,UC1,abc,1,1\n`)[0]!.ctr).toBe(1)
    expect(lerAlcanceBasico(`${cab}\n20260925,UC1,abc,1,0\n`)[0]!.ctr).toBe(0)
  })
  it('data que não existe no calendário → linha_invalida; 29/02 só em ano bissexto', () => {
    const cab = CABECALHO_ALCANCE_BASICO.join(',')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20261345,UC1,abc,3,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n00000000,UC1,abc,3,0\n`))).toBe('linha_invalida')
    expect(motivo(() => lerAlcanceBasico(`${cab}\n20260229,UC1,abc,3,0\n`))).toBe('linha_invalida')
    expect(lerAlcanceBasico(`${cab}\n20240229,UC1,abc,3,0\n`)[0]!.day).toBe('2024-02-29')
  })
  it('BOM no começo do arquivo não atrapalha o cabeçalho', () => {
    expect(lerAlcanceBasico('﻿' + REAL)).toHaveLength(11)
  })
  it('CTR vazio é nulo, nunca zero', () => {
    const cab = CABECALHO_ALCANCE_BASICO.join(',')
    expect(lerAlcanceBasico(`${cab}\n20260925,UC1,abc,3,\n`)[0]!.ctr).toBeNull()
  })
})

describe('agregarAlcance', () => {
  it('o arquivo real tem uma linha por vídeo e dia: agregar não muda nada', () => {
    const linhas = lerAlcanceBasico(REAL)
    expect(agregarAlcance(linhas)).toEqual(linhas.map(({ day, videoId, impressions, ctr }) => ({ day, videoId, impressions, ctr })))
  })
  it('mais de uma linha por vídeo e dia: impressões somam e o CTR é a média ponderada pelas impressões', () => {
    const base = { day: '2026-09-25', channelId: 'UC1', videoId: 'abc' }
    expect(agregarAlcance([{ ...base, impressions: 3, ctr: 1 / 3 }, { ...base, impressions: 1, ctr: 1 }])).toEqual([{ day: '2026-09-25', videoId: 'abc', impressions: 4, ctr: 0.5 }])
  })
  it('CTR nulo em todas as linhas → nulo; nulo em algumas → pondera só as que têm', () => {
    const base = { day: '2026-09-25', channelId: 'UC1', videoId: 'abc' }
    expect(agregarAlcance([{ ...base, impressions: 2, ctr: null }, { ...base, impressions: 2, ctr: null }])[0]!.ctr).toBeNull()
    expect(agregarAlcance([{ ...base, impressions: 2, ctr: null }, { ...base, impressions: 2, ctr: 0.5 }])[0]).toMatchObject({ impressions: 4, ctr: 0.5 })
  })
  it('zero impressões no total → CTR nulo (não há divisão por zero)', () => {
    expect(agregarAlcance([{ day: '2026-09-25', channelId: 'UC1', videoId: 'abc', impressions: 0, ctr: 0 }])[0]).toEqual({ day: '2026-09-25', videoId: 'abc', impressions: 0, ctr: null })
  })
})
