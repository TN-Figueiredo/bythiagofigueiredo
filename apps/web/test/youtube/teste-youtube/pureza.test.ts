// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const LIB = fileURLToPath(new URL('../../../src/lib/youtube/', import.meta.url))
const arquivos = [...readdirSync(LIB + 'teste-youtube').filter(f => f.endsWith('.ts')).map(f => LIB + 'teste-youtube/' + f), LIB + 'thumb-hamming.ts']

/** Todo especificador de módulo no texto inteiro: `from 'x'` (inclusive import em várias linhas), `import 'x'` e `import('x')`. */
export function especificadores(texto: string): string[] {
  const sem = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return [...sem.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map(m => m[1]!)
}
const PERMITIDO = (m: string): boolean => m.startsWith('./') || m === 'zod' || m === '@/lib/youtube/thumb-hamming'

describe('C20: o detector de import pega as formas que escapavam', () => {
  it('import em várias linhas, import de efeito e import() dinâmico', () => {
    expect(especificadores("import {\n  default as s,\n} from 'sharp'\n")).toEqual(['sharp'])
    expect(especificadores("import 'sharp'\n")).toEqual(['sharp'])
    expect(especificadores("const x = await import('@/lib/youtube/thumb-fingerprint')\n")).toEqual(['@/lib/youtube/thumb-fingerprint'])
    expect(especificadores("export * from './tipos'\n// import 'x'\n")).toEqual(['./tipos'])
  })
})

describe('C20: pureza', () => {
  it('há arquivos para conferir', () => {
    expect(arquivos.length).toBeGreaterThan(8)
  })
  for (const a of arquivos) {
    it(a.replace(LIB, ''), () => {
      const texto = readFileSync(a, 'utf8')
      for (const m of especificadores(texto)) expect(PERMITIDO(m), `${a}: import proibido ${m}`).toBe(true)
      const linhas = texto.split('\n')
      const codigo = linhas.filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(codigo).not.toMatch(/Date\.now\(/)
      expect(codigo).not.toMatch(/new Date\(\s*\)/)
    })
  }
})
