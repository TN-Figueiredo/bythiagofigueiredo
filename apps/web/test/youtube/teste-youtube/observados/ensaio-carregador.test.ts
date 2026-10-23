// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { carregarExport, extrairLinhas, isoDoBanco, linhasDaFixture, type FixtureColunar } from '@/lib/youtube/teste-youtube/observados/ensaio'

const lerFixture = (nome: string): string => readFileSync(fileURLToPath(new URL(`./fixtures/${nome}`, import.meta.url)), 'utf8')
const fixture = JSON.parse(lerFixture('replay-23-10.json')) as FixtureColunar

describe('isoDoBanco', () => {
  it('normaliza o formato do banco para ISO com milissegundos', () => {
    expect(isoDoBanco('2026-10-19 01:20:55.353+00')).toBe('2026-10-19T01:20:55.353Z')
    expect(isoDoBanco('2026-10-23 17:40:58.82+00')).toBe('2026-10-23T17:40:58.820Z')
    expect(isoDoBanco('2026-10-19 01:20:55+00')).toBe('2026-10-19T01:20:55.000Z')
    expect(isoDoBanco('2026-10-19 01:20:55.353123+00')).toBe('2026-10-19T01:20:55.353Z')
    expect(isoDoBanco('2026-10-23T19:21:03.734+00:00')).toBe('2026-10-23T19:21:03.734Z')
  })
})

describe('fixture do replay de 23/10', () => {
  const alvos = carregarExport(linhasDaFixture(fixture))
  it('tem 35 alvos, 1841 leituras e a agora do protótipo', () => {
    expect(alvos.size).toBe(35)
    expect([...alvos.values()].reduce((n, a) => n + a.leituras.length, 0)).toBe(1841)
    expect(fixture.agora).toBe('2026-10-23T17:41:00.698Z')
  })
  it('2emVR-6NEmM tem publicação e rodadas = rodada_id distintos', () => {
    const a = alvos.get('2emVR-6NEmM')!
    expect(a.publicadoEm).not.toBeNull()
    expect(a.rodadas).toBe(new Set(a.leituras.map(l => l.rodadaId)).size)
  })
  it('toda leitura com thumb_http tem a miniatura ligada', () => {
    let com = 0
    for (const a of alvos.values()) for (const l of a.leituras) if (l.miniaturaId !== null) { com++; expect(a.thumbsPorId.get(l.miniaturaId)).toBeDefined() }
    expect(com).toBeGreaterThan(0)
  })
})

describe('extrairLinhas', () => {
  const linhas = linhasDaFixture(fixture).slice(0, 3)
  it('aceita json_agg, array de linhas e colunar com o mesmo resultado', () => {
    const a = extrairLinhas(JSON.stringify([{ json_agg: linhas }]))
    const b = extrairLinhas(JSON.stringify(linhas))
    const c = extrairLinhas(JSON.stringify({ colunas: fixture.colunas, linhas: fixture.linhas.slice(0, 3) }))
    expect(a).toEqual(linhas)
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })
  it('aceita o envelope real da CLI (3 linhas)', () => {
    const r = extrairLinhas(lerFixture('amostra-cli.json'))
    expect(r).toHaveLength(3)
    expect(r[0]!.yt).toMatch(/^[\w-]{11}$/)
    expect(carregarExport(r).size).toBeGreaterThan(0)
  })
  it('texto que não é JSON lança', () => {
    expect(() => extrairLinhas('Initialising login role...')).toThrow('export ilegível')
    expect(() => extrairLinhas('{"a":1}')).toThrow('export ilegível')
  })
})
