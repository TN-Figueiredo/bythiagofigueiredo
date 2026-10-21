// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { especificadores } from '../pureza.test'

const DIR = fileURLToPath(new URL('../../../../src/lib/youtube/teste-youtube/observados/', import.meta.url))
const SERVIDOR = new Set(['passo.ts'])
const arquivos = readdirSync(DIR).filter(f => f.endsWith('.ts') && !SERVIDOR.has(f))
const PERMITIDO = (m: string): boolean => m.startsWith('./') || m === '../normalizar-titulo' || m === '@/lib/youtube/thumb-hamming'

describe('pureza do observador de trocas', () => {
  it('há arquivos para conferir (inferir, selecao, estado-de-leitura, flag)', () => {
    expect(arquivos.sort()).toEqual(['estado-de-leitura.ts', 'flag.ts', 'inferir.ts', 'selecao.ts'])
  })
  for (const a of arquivos) {
    it(a, () => {
      const texto = readFileSync(DIR + a, 'utf8')
      for (const m of especificadores(texto)) expect(PERMITIDO(m), `${a}: import proibido ${m}`).toBe(true)
      const codigo = texto.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(codigo).not.toMatch(/Date\.now\(/)
      expect(codigo).not.toMatch(/new Date\(\s*\)/)
      if (a !== 'flag.ts') expect(codigo).not.toMatch(/process\.env/) // só a flag lê o ambiente (por parâmetro, com process.env de padrão)
    })
  }
  it('não usa o detector do dono (avaliarVideo / detectarTesteYoutube)', () => {
    for (const a of arquivos) {
      const codigo = readFileSync(DIR + a, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(codigo).not.toMatch(/avaliarVideo|detectarTesteYoutube/)
    }
  })
})
