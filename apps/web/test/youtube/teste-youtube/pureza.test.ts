// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const LIB = fileURLToPath(new URL('../../../src/lib/youtube/', import.meta.url))
const arquivos = [...readdirSync(LIB + 'teste-youtube').filter(f => f.endsWith('.ts')).map(f => LIB + 'teste-youtube/' + f), LIB + 'thumb-hamming.ts']

describe('C20: pureza', () => {
  it('há arquivos para conferir', () => {
    expect(arquivos.length).toBeGreaterThan(8)
  })
  for (const a of arquivos) {
    it(a.replace(LIB, ''), () => {
      const linhas = readFileSync(a, 'utf8').split('\n')
      const modulos = linhas.filter(l => /^\s*(import|export)\b.*\bfrom\b/.test(l))
      for (const l of modulos) {
        expect(l).not.toMatch(/sharp|@vercel\/blob|next\/|supabase|thumb-fingerprint/i)
      }
      const codigo = linhas.filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(codigo).not.toMatch(/Date\.now\(/)
      expect(codigo).not.toMatch(/new Date\(\s*\)/)
    })
  }
})
