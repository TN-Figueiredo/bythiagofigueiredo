// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Diario, sha256, type Estado } from '@/lib/youtube/portao-dhash/diario'

let pasta: string
let d: Diario
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0)
beforeEach(() => {
  pasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'portao-')), 'v')
  d = new Diario(pasta, () => T0)
})

const estado = (): Estado => ({
  versao: 1, video: '6jL-jeux_1Y', fase: 'preparado', criadoEm: 'x', atualizadoEm: 'x',
  original: { variante: 'maxresdefault', largura: 1280, altura: 720, sha256: 'a', sha256Hq: 'b', dhashHq: '0' },
  teste: { sha256: 'c', dhashComoHq: 'f', distanciaDoOriginal: 64 },
  trocaEm: null, devolucaoEm: null, cotaGasta: 1, tentativasDevolucao: 0, aparicao: null, volta: null,
})

describe('Diario', () => {
  it('gravar e ler voltam o mesmo estado e não sobra .tmp', () => {
    const e = estado()
    d.gravar(e)
    expect(d.ler()).toEqual(e)
    expect(fs.existsSync(path.join(pasta, 'estado.json.tmp'))).toBe(false)
  })
  it('salvarUmaVez devolve o sha256 e a segunda chamada lança EEXIST sem mudar os bytes', () => {
    const b = Buffer.from('original')
    expect(d.salvarUmaVez('o.jpg', b)).toBe(sha256(b))
    expect(() => d.salvarUmaVez('o.jpg', Buffer.from('teste'))).toThrow(/EEXIST/)
    expect(d.lerArquivo('o.jpg').equals(b)).toBe(true)
  })
  it('temAlgo: falso em pasta inexistente ou vazia, verdadeiro com um arquivo', () => {
    expect(d.temAlgo()).toBe(false)
    fs.mkdirSync(pasta, { recursive: true })
    expect(d.temAlgo()).toBe(false)
    fs.writeFileSync(path.join(pasta, 'x'), '1')
    expect(d.temAlgo()).toBe(true)
  })
  it('registrar acrescenta uma linha JSON por evento com em ISO', () => {
    d.registrar('a', { n: 1 })
    d.registrar('b')
    const linhas = fs.readFileSync(path.join(pasta, 'registro.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(linhas).toEqual([{ em: new Date(T0).toISOString(), evento: 'a', n: 1 }, { em: new Date(T0).toISOString(), evento: 'b' }])
  })
  it('ler devolve null sem estado.json e lança se corrompido', () => {
    expect(d.ler()).toBeNull()
    fs.mkdirSync(pasta, { recursive: true })
    fs.writeFileSync(path.join(pasta, 'estado.json'), '{quebrado')
    expect(() => d.ler()).toThrow()
  })
})
