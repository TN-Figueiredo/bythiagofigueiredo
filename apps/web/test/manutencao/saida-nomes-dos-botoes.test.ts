// @vitest-environment node
/** M6a T12 layout r4 (mockup 19 B, 28/10): os nomes dos botões da saída de mês são "Ver o que sairia", "Esconder das telas", "Mostrar de novo" e "Apagar do banco".
 *  Nenhuma tela, frase ou mensagem da saída volta a usar os nomes velhos. Lê o texto de tela dos arquivos (literais e JSX), sem comentários. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../..')
const S = 'apps/web/src/'
const C = `${S}app/cms/(authed)/youtube/competitors/`
const ARQUIVOS = [
  `${C}_arquivo-saida/peca-tirar-mes.tsx`, `${C}_arquivo-saida/peca-interruptor.tsx`, `${C}_arquivo-saida/encaixar.ts`, `${C}_arquivo-saida/acoes.ts`,
  `${S}lib/youtube/observatorio/arquivo-mensal/frases-saida.ts`, `${S}lib/youtube/observatorio/arquivo-mensal/interruptor.ts`, `${S}lib/youtube/observatorio/arquivo-mensal/vermelhos.ts`, `${S}lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts`,
]
const VELHOS = /\bTirar\b|\bTire\b|Trazer de volta|Liberar o espaço|Liberar espaço|banco online|trazer de volta|Traga de volta|Libere o espaço|liberar o espaço|Espaço liberado/
const textos = (fonte: string): string[] => {
  const sem = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  return [...sem.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map(m => m[2]!).concat([...sem.matchAll(/>([^<>{}]*[a-zà-ú][^<>{}]*)</gi)].map(m => m[1]!))
}
describe('nomes dos botões da saída de mês', () => {
  it('o teste do teste enxerga o nome velho', () => { expect(textos("const a = 'Tirar o mês'").some(t => VELHOS.test(t))).toBe(true) })
  it.each(ARQUIVOS)('%s não usa Tirar, Trazer de volta, Liberar o espaço nem banco online', arq => {
    expect(textos(readFileSync(resolve(RAIZ, arq), 'utf8')).filter(t => VELHOS.test(t))).toEqual([])
  })
})
