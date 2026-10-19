// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { especificadores } from '../pureza.test'

const DIR = fileURLToPath(new URL('../../../../src/lib/youtube/teste-youtube/registro/', import.meta.url))
const SERVIDOR = new Set(['ler.ts', 'tarefa.ts', 'frescor.ts'])
const arquivos = readdirSync(DIR).filter(f => f.endsWith('.ts') && !SERVIDOR.has(f))
const PERMITIDO = (m: string): boolean =>
  m.startsWith('./') || m.startsWith('../') || m === 'zod' || m === '@/lib/youtube/watch/puro' || m === '@/lib/youtube/watch/rodada'

describe('pureza do registro', () => {
  it('há arquivos para conferir', () => {
    expect(arquivos.length).toBeGreaterThan(1)
  })
  for (const a of arquivos) {
    it(a, () => {
      const texto = readFileSync(DIR + a, 'utf8')
      for (const m of especificadores(texto)) expect(PERMITIDO(m), `${a}: import proibido ${m}`).toBe(true)
      const codigo = texto.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(codigo).not.toMatch(/Date\.now\(/)
      expect(codigo).not.toMatch(/new Date\(\s*\)/)
    })
  }
})
