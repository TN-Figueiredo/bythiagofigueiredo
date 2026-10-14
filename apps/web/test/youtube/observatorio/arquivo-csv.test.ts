// @vitest-environment node
/**
 * A5 · E10, Tarefa 5: o CSV do arquivo. Puro. A promessa é a ida e a volta byte a byte: o que `linhaCsv` escreve, `lerCsv` devolve igual,
 * e o `\copy … csv header` do Postgres relê da mesma forma (nulo = vazio sem aspas, texto vazio = `""`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { linhaCsv, lerCsv, CsvInvalido } from '@/lib/youtube/observatorio/arquivo/csv'

const escrever = (colunas: string[], linhas: Array<Array<string | null>>): string =>
  [linhaCsv(colunas), ...linhas.map(l => linhaCsv(l))].join('\n') + '\n'
const voltar = (colunas: string[], linhas: Array<Array<string | null>>) => lerCsv(escrever(colunas, linhas))

describe('A5 E10 T5: csv', () => {
  it('nulo e texto vazio são diferentes na ida e na volta', () => {
    expect(linhaCsv([null, '', 'a'])).toBe(',"",a')
    const r = voltar(['a', 'b', 'c'], [[null, '', 'x'], ['', null, null]])
    expect(r.linhas).toEqual([[null, '', 'x'], ['', null, null]])
    // o campo vazio sem aspas nunca vira texto vazio, e o com aspas nunca vira nulo
    expect(lerCsv('a,b\n,""\n').linhas).toEqual([[null, '']])
  })

  it('vírgula, aspas e quebra de linha dentro do campo', () => {
    const valores = ['a,b', 'diz "oi"', 'linha1\nlinha2', 'cr\rlf', 'tudo, "junto"\r\n']
    expect(linhaCsv(valores)).toBe('"a,b","diz ""oi""","linha1\nlinha2","cr\rlf","tudo, ""junto""\r\n"')
    const r = voltar(valores.map((_, i) => `c${i}`), [valores])
    expect(r.linhas).toEqual([valores])
    expect(r.colunas).toEqual(['c0', 'c1', 'c2', 'c3', 'c4'])
  })

  it('texto que parece número ou data volta igual (nenhuma interpretação)', () => {
    const v = ['007', '1e5', '0.10', '2026-01-02', 'true', 'NULL', '-0', ' espaço ', '12345678901234567890']
    expect(linhaCsv(v)).toBe(v.join(','))
    expect(voltar(v.map((_, i) => `c${i}`), [v]).linhas).toEqual([v])
  })

  it('jsonb e vetor real[] como texto voltam byte a byte', () => {
    const v = ['{0.1,0.30000001,1e-05}', '{"a": "x,y", "b": [1, 2, {"c": null}], "u": "ação é中"}', '[1,2]', '{}']
    expect(voltar(['v', 'j', 'l', 'o'], [v]).linhas).toEqual([v])
  })

  it('instante com fração volta igual', () => {
    const v = ['2026-10-13 15:00:00.123456+00', '2026-10-13 15:00:00+00', '2026-10-13 15:00:00.5+00']
    expect(voltar(['a', 'b', 'c'], [v]).linhas).toEqual([v])
  })

  it('cabeçalho sem linhas', () => {
    expect(lerCsv('a,b\n')).toEqual({ colunas: ['a', 'b'], linhas: [] })
    expect(lerCsv('a,b')).toEqual({ colunas: ['a', 'b'], linhas: [] })
  })

  it('última linha sem fim de linha e com fim de linha dão o mesmo resultado', () => {
    const com = lerCsv('a,b\n1,2\n3,4\n')
    const sem = lerCsv('a,b\n1,2\n3,4')
    expect(com).toEqual(sem)
    expect(com.linhas).toEqual([['1', '2'], ['3', '4']])
    // vírgula no fim da última linha sem fim de linha: ainda há um campo (nulo)
    expect(lerCsv('a,b\n1,').linhas).toEqual([['1', null]])
    // \r\n é aceito como fim de linha
    expect(lerCsv('a,b\r\n1,2\r\n').linhas).toEqual([['1', '2']])
  })

  it('campo aberto sem fechar aspas lança', () => {
    expect(() => lerCsv('a,b\n"abc,2\n')).toThrow(CsvInvalido)
    expect(() => lerCsv('a,b\n1,"2')).toThrow(/sem fechar/)
  })

  it('aspas no meio de campo sem aspas, ou lixo depois de aspas fechadas, lançam', () => {
    expect(() => lerCsv('a,b\nab"c,2\n')).toThrow(CsvInvalido)
    expect(() => lerCsv('a,b\n"x"y,2\n')).toThrow(CsvInvalido)
    expect(() => lerCsv('a,b\nx\ry,2\n')).toThrow(CsvInvalido)
  })

  it('linha com número de campos diferente do cabeçalho lança (nunca completa com nulo)', () => {
    expect(() => lerCsv('a,b,c\n1,2\n')).toThrow(/linha 2 tem 2 campo/)
    expect(() => lerCsv('a,b\n1,2,3\n')).toThrow(CsvInvalido)
    expect(() => lerCsv('a,b\n1,2\n\n')).toThrow(CsvInvalido) // linha em branco no fim: um campo nulo, para duas colunas
  })

  it('texto sem cabeçalho e cabeçalho com coluna sem nome lançam', () => {
    expect(() => lerCsv('')).toThrow(/sem cabeçalho/)
    expect(() => lerCsv('a,,c\n')).toThrow(CsvInvalido)
  })

  it('tabela de uma coluna: linha vazia é nulo', () => {
    expect(lerCsv('a\n\n1\n').linhas).toEqual([[null], ['1']])
  })

  it('o módulo só importa de node: e de caminho relativo (o tsx da raiz o importa)', () => {
    const src = readFileSync(join(__dirname, '../../../src/lib/youtube/observatorio/arquivo/csv.ts'), 'utf8')
    for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) expect(m[1]!.startsWith('node:') || m[1]!.startsWith('.'), m[1]).toBe(true)
  })
})
