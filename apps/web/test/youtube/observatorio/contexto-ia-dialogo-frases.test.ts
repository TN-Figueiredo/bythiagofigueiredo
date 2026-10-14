// @vitest-environment node
/**
 * E17 degrau 1, Tarefa 10: cada frase de `frases-do-dialogo.ts` existe no `pi.js` ou no `NOTAS.md` do mockup 22 versionado (as com variável, pela parte
 * fixa), salvo as da lista de texto novo, que NÃO podem existir no mockup. Arquivo ausente é falha. O CSS não tem `color-mix` nem `z-index` numérico.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FRASES_DO_MOCKUP, FRASES_NOVAS } from '@/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia/frases-do-dialogo'

const MOCKUP = resolve(__dirname, '../../../../../docs/superpowers/mockups/2026-10-13-a5-lote-2/22-perguntar-a-uma-ia')
const CSS = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia/perguntar-ia.css')

describe('as frases do diálogo contra o mockup congelado', () => {
  it('os dois arquivos do mockup existem (ausente é falha, não pulo)', () => {
    expect(existsSync(`${MOCKUP}/pi.js`)).toBe(true)
    expect(existsSync(`${MOCKUP}/NOTAS.md`)).toBe(true)
  })
  it('cada frase fixa está no pi.js ou no NOTAS.md', () => {
    const fonte = `${readFileSync(`${MOCKUP}/pi.js`, 'utf8')}\n${readFileSync(`${MOCKUP}/NOTAS.md`, 'utf8')}`
    const faltam = FRASES_DO_MOCKUP.filter((f) => f.length > 0 && !fonte.includes(f))
    expect(faltam).toEqual([])
  })
  it('a lista de texto novo tem as duas frases da pergunta 8 e nenhuma está no mockup', () => {
    expect([...FRASES_NOVAS].sort()).toEqual(['a leitura falhou agora', 'não foi possível conferir agora'])
    const fonte = `${readFileSync(`${MOCKUP}/pi.js`, 'utf8')}\n${readFileSync(`${MOCKUP}/NOTAS.md`, 'utf8')}`
    for (const f of FRASES_NOVAS) expect(fonte.includes(f), f).toBe(false)
  })
  it('perguntar-ia.css não tem color-mix nem z-index com número', () => {
    const css = readFileSync(CSS, 'utf8')
    expect(css).not.toMatch(/color-mix\s*\(/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
  })
})
