// @vitest-environment node
// "Vigente" = aberto E expires_at > agora. Todo from('niche_signals') que filtra status = 'aberto' em leitura.ts/avisos.ts
// tem de conter .gt('expires_at'. Dívida declarada: "vigente" também existe em SQL (sincronizar_sino), coberta pela integração de paridade.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(__dirname, '../../../../src/lib/youtube/observatorio/sinais')
/** Exceções: consultas que olham `aberto` sem exigir vigência (nenhuma hoje). */
const EXCECOES: Record<string, number[]> = {}

describe('toda consulta de abertos a niche_signals exige expires_at', () => {
  for (const arq of ['leitura.ts', 'avisos.ts']) {
    it(arq, () => {
      const src = readFileSync(resolve(DIR, arq), 'utf8')
      const partes = src.split(/\.from\(\s*'niche_signals'\s*\)/).slice(1)
      expect(partes.length).toBeGreaterThan(0)
      partes.forEach((resto, i) => {
        const cadeia = resto.split(/\n\s*\n|\n(?=(?:async )?function |export |const )/)[0]!
        if (/\.eq\(\s*'status'\s*,\s*'aberto'\s*\)/.test(cadeia) && !(EXCECOES[arq] ?? []).includes(i)) expect(cadeia, `${arq} consulta #${i}`).toMatch(/\.gt\(\s*'expires_at'/)
      })
    })
  }
})
